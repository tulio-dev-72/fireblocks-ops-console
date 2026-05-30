import { NextResponse } from "next/server";
import {
  listTransactions,
  createTransfer,
  isConfigured,
  type TransferInput,
} from "@/lib/fireblocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  try {
    const transactions = await listTransactions(25);
    return NextResponse.json({ transactions });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to load transactions" },
      { status: 502 }
    );
  }
}

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  let body: Partial<TransferInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.assetId || !body.amount || !body.sourceVaultId) {
    return NextResponse.json(
      { error: "assetId, amount, and sourceVaultId are required" },
      { status: 400 }
    );
  }
  if (!body.destVaultId && !body.destAddress) {
    return NextResponse.json(
      { error: "Provide a destination vault or an external address" },
      { status: 400 }
    );
  }

  try {
    const result = await createTransfer(body as TransferInput);
    return NextResponse.json(result);
  } catch (e: any) {
    // Surface Fireblocks API error messages (e.g. policy rejections) to the UI.
    const msg =
      e?.response?.data?.message ?? e?.message ?? "Transaction failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
