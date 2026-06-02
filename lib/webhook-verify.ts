import "server-only";
import { createPublicKey, verify } from "crypto";
import { createRemoteJWKSet, compactVerify } from "jose";

// Legacy (Webhooks v1) static public key for the Fireblocks Developer Sandbox.
// Retained only as a fallback; Webhooks v2 validates via JWKS (below).
const SANDBOX_WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApZE6wL2+7P1ohvVYSpCd
gSgtmyGwiLbUC1UoGJhn1zwfY7ZWbNH7Pg8Osk8OzZTZHSG/arcgE8HnGCmGKtbE
QBkf2XlBRBQ01FcCMlZuJQJ3nElCPaMl9N6fq0VKNEIlVSVUpDCgvag5kFhDKS/L
p3YYJLFR46/hDlVLn+vM84diO3xGyMc16YJGNz7Z4jb8dmSZQE5E2XaQMDXW6uxC
c2ChjWJ3X5H70MzRG35JsN0j58SQTwbf4Pxm0aJfhPuaIBn3mJuZL5etsuFihoFG
FDnT+qWRcgD/pRNulBFAFhJeUnFrE4fFTJ1iaHhjBrStBCrxJk6QI0pGznoapTgA
QwIDAQAB
-----END PUBLIC KEY-----`;

const JWKS_ENDPOINTS = {
  sandbox: "https://sandbox-keys.fireblocks.io/.well-known/jwks.json",
  us: "https://keys.fireblocks.io/.well-known/jwks.json",
  eu: "https://eu-keys.fireblocks.io/.well-known/jwks.json",
  eu2: "https://eu2-keys.fireblocks.io/.well-known/jwks.json",
} as const;

function resolveEnv(): keyof typeof JWKS_ENDPOINTS {
  switch ((process.env.FIREBLOCKS_ENV ?? "sandbox").toLowerCase()) {
    case "us":
      return "us";
    case "eu":
      return "eu";
    case "eu2":
      return "eu2";
    default:
      return "sandbox";
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  const url = process.env.FIREBLOCKS_WEBHOOK_JWKS_URL ?? JWKS_ENDPOINTS[resolveEnv()];
  let set = jwksCache.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, set);
  }
  return set;
}

/** Webhooks v2 — validate the detached JWS from `Fireblocks-Webhook-Signature`. */
async function verifyV2(rawBody: Buffer, jwsSignature: string): Promise<boolean> {
  try {
    const [header, , sig] = jwsSignature.split(".");
    if (!header || !sig) return false;
    const payload = rawBody.toString("base64url");
    await compactVerify(`${header}.${payload}.${sig}`, getJwks());
    return true;
  } catch {
    return false;
  }
}

/** Legacy (Webhooks v1) — RSA-SHA512 over the raw body from `Fireblocks-Signature`. */
function verifyLegacy(rawBody: Buffer, signatureB64: string): boolean {
  try {
    const publicKey = createPublicKey(
      process.env.FIREBLOCKS_WEBHOOK_PUBLIC_KEY ?? SANDBOX_WEBHOOK_PUBLIC_KEY,
    );
    return verify("RSA-SHA512", rawBody, publicKey, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

/**
 * Combined verifier. Prefers Webhooks v2 (JWKS) and falls back to the legacy v1
 * signature so the receiver works across the migration window and after v1 retires.
 */
export async function verifyFireblocksWebhook(
  rawBody: Buffer,
  headers: { v2Signature: string | null; legacySignature: string | null },
): Promise<{ valid: boolean; method: "v2" | "v1" | "skipped" | null }> {
  if (process.env.FIREBLOCKS_WEBHOOK_SKIP_VERIFY === "true") {
    return { valid: true, method: "skipped" };
  }
  if (headers.v2Signature && (await verifyV2(rawBody, headers.v2Signature))) {
    return { valid: true, method: "v2" };
  }
  if (headers.legacySignature && verifyLegacy(rawBody, headers.legacySignature)) {
    return { valid: true, method: "v1" };
  }
  return { valid: false, method: null };
}
