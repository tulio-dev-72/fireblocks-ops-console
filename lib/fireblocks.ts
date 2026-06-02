import "server-only";
import { readFileSync, existsSync } from "fs";
import {
  Fireblocks,
  BasePath,
  TransactionOperation,
  TransferPeerPathType,
  type TransactionRequest,
} from "@fireblocks/ts-sdk";
import type { Vault, Tx } from "./types";

// ─── credential resolution (server runtime only) ──────────────────────────────
/** Normalize a PEM from env/file: strip wrapping quotes, fix \n and CRLF, trim. */
function normalizePrivateKeyPem(raw: string): string {
  let pem = raw.trim();
  if (
    (pem.startsWith('"') && pem.endsWith('"')) ||
    (pem.startsWith("'") && pem.endsWith("'"))
  ) {
    pem = pem.slice(1, -1).trim();
  }
  return pem.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function resolveSecret(): string | null {
  // Canonical names align with the other apps; legacy names kept for back-compat.
  const inline =
    process.env.FIREBLOCKS_PRIVATE_KEY?.trim() || process.env.FIREBLOCKS_SECRET_KEY?.trim();
  if (inline) return normalizePrivateKeyPem(inline);

  const path =
    process.env.FIREBLOCKS_SECRET_KEY_PATH?.trim() ||
    process.env.FIREBLOCKS_SECRET_PATH?.trim() ||
    "./fireblocks_secret.key";
  if (existsSync(path)) return normalizePrivateKeyPem(readFileSync(path, "utf8"));
  return null;
}

function basePath(): BasePath {
  switch ((process.env.FIREBLOCKS_ENV ?? "sandbox").toLowerCase()) {
    case "us":
      return BasePath.US;
    case "eu":
      return BasePath.EU;
    default:
      return BasePath.Sandbox;
  }
}

export function isConfigured(): boolean {
  return Boolean(process.env.FIREBLOCKS_API_KEY) && Boolean(resolveSecret());
}

let _client: Fireblocks | null = null;
function client(): Fireblocks {
  if (_client) return _client;
  const apiKey = process.env.FIREBLOCKS_API_KEY;
  const secretKey = resolveSecret();
  if (!apiKey || !secretKey) {
    throw new Error("Fireblocks credentials are not configured on the server.");
  }
  _client = new Fireblocks({ apiKey, secretKey, basePath: basePath() });
  return _client;
}

// ─── domain helpers ───────────────────────────────────────────────────────────
export async function listVaults(): Promise<Vault[]> {
  const res = await client().vaults.getPagedVaultAccounts({ limit: 100 });
  const accounts = res.data?.accounts ?? [];
  return accounts.map((a: any) => ({
    id: String(a.id),
    name: a.name ?? `Vault ${a.id}`,
    assets: (a.assets ?? []).map((as: any) => ({
      id: as.id,
      total: as.total ?? "0",
      available: as.available ?? as.total ?? "0",
    })),
  }));
}

export async function listTransactions(limit = 25): Promise<Tx[]> {
  const res = await client().transactions.getTransactions({
    limit,
    orderBy: "createdAt",
    sort: "DESC",
  } as any);
  const txs = (res.data ?? []) as any[];
  return txs.map((t) => ({
    id: t.id,
    status: t.status,
    subStatus: t.subStatus,
    assetId: t.assetId,
    amount: t.amount != null ? String(t.amount) : undefined,
    sourceName: t.source?.name ?? t.source?.id,
    destName: t.destination?.name ?? t.destinationAddress ?? t.destination?.id,
    txHash: t.txHash || undefined,
    createdAt: t.createdAt,
  }));
}

export type TransferInput = {
  assetId: string;
  amount: string;
  sourceVaultId: string;
  // either a destination vault id OR an external address
  destVaultId?: string;
  destAddress?: string;
  note?: string;
};

export async function createTransfer(input: TransferInput) {
  const destination = input.destAddress
    ? {
        type: TransferPeerPathType.OneTimeAddress,
        oneTimeAddress: { address: input.destAddress },
      }
    : { type: TransferPeerPathType.VaultAccount, id: input.destVaultId! };

  const request: TransactionRequest = {
    assetId: input.assetId,
    operation: TransactionOperation.Transfer,
    source: { type: TransferPeerPathType.VaultAccount, id: input.sourceVaultId },
    destination: destination as any,
    amount: input.amount,
    note: input.note || "Created via Custody Ops Console",
  };

  const res = await client().transactions.createTransaction({
    transactionRequest: request,
  });
  return { id: res.data?.id, status: res.data?.status };
}
