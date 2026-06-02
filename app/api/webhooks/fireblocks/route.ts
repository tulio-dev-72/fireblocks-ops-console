import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyFireblocksWebhook } from "@/lib/webhook-verify";
import { recordWebhookEvent } from "@/lib/webhook-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const v2Signature = request.headers.get("fireblocks-webhook-signature");
  const legacySignature =
    request.headers.get("fireblocks-signature") ?? request.headers.get("Fireblocks-Signature");

  const verification = await verifyFireblocksWebhook(rawBody, { v2Signature, legacySignature });
  if (!verification.valid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  // Webhooks v2: dotted eventType + resourceId at the root; v1: TRANSACTION_* + data.id.
  const data = payload?.data ?? {};
  const eventType: string = payload?.eventType ?? payload?.type ?? "transaction.status.updated";
  const txId: string | undefined = data.id ?? payload?.resourceId;

  recordWebhookEvent({
    id: randomUUID(),
    eventType,
    txId,
    status: data.status,
    subStatus: data.subStatus,
    assetId: data.assetId,
    amount: data.amountInfo?.amount ?? (data.amount != null ? String(data.amount) : undefined),
    method: verification.method,
    receivedAt: new Date().toISOString(),
  });

  // Ack fast (2xx) or Fireblocks retries.
  return NextResponse.json({ ok: true, method: verification.method });
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    endpoint: `${origin}/api/webhooks/fireblocks`,
    method: "POST",
    webhooksVersion: "v2",
    signature: {
      v2Header: "Fireblocks-Webhook-Signature (detached JWS, validated via JWKS)",
      legacyHeader: "Fireblocks-Signature (RSA-SHA512, fallback)",
    },
    events: ["transaction.created", "transaction.status.updated", "transaction.approval_status.updated"],
    setup:
      "Fireblocks Sandbox -> Developer Center -> Webhooks v2 -> create webhook -> set endpoint URL -> subscribe to the transaction.* events.",
  });
}
