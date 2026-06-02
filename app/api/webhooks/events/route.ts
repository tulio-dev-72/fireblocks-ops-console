import { NextResponse } from "next/server";
import { recentWebhookEvents } from "@/lib/webhook-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: recentWebhookEvents(25) });
}
