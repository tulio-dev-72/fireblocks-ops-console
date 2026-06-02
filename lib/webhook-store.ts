import "server-only";

export type WebhookEvent = {
  id: string;
  eventType: string;
  txId?: string;
  status?: string;
  subStatus?: string;
  assetId?: string;
  amount?: string;
  method: "v2" | "v1" | "skipped" | null;
  receivedAt: string;
};

// Best-effort, in-memory ring buffer of verified webhook deliveries.
// On serverless this persists only within a single instance's lifetime; a
// production console would persist deliveries to a database or queue. It is
// enough to prove the receiver verifies and parses real Fireblocks webhooks.
const MAX = 50;
const buffer: WebhookEvent[] = [];

export function recordWebhookEvent(event: WebhookEvent): void {
  buffer.unshift(event);
  if (buffer.length > MAX) buffer.length = MAX;
}

export function recentWebhookEvents(limit = 25): WebhookEvent[] {
  return buffer.slice(0, limit);
}
