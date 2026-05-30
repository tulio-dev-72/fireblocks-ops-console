import { NextResponse } from "next/server";
import { listVaults, isConfigured } from "@/lib/fireblocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  try {
    const vaults = await listVaults();
    return NextResponse.json({ vaults });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to load vaults" },
      { status: 502 }
    );
  }
}
