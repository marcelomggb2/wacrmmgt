const INSTAGRAM_WEBHOOK_PATH = "/api/instagram/webhook";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeOrigin(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimTrailingSlash(trimmed);
}

export function resolveInstagramWebhookOrigin(
  currentOrigin?: string | null,
): string | null {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_INSTAGRAM_WEBHOOK_ORIGIN) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeOrigin(currentOrigin)
  );
}

export function buildInstagramWebhookUrl(
  channelId: string,
  currentOrigin?: string | null,
): string {
  const origin = resolveInstagramWebhookOrigin(currentOrigin);
  if (!origin) {
    return `${INSTAGRAM_WEBHOOK_PATH}/${channelId}`;
  }

  return `${origin}${INSTAGRAM_WEBHOOK_PATH}/${channelId}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export interface InstagramWebhookSummary {
  object: string | null;
  entryCount: number;
  changedFields: string[];
  messageCount: number;
  lastEntryTime: string | null;
}

export function summarizeInstagramWebhookPayload(
  payload: unknown,
): InstagramWebhookSummary {
  const root = asRecord(payload);
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const fieldSet = new Set<string>();
  let messageCount = 0;
  let lastEntryTime: string | null = null;

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const changes = Array.isArray(entryRecord.changes) ? entryRecord.changes : [];
    const messaging = Array.isArray(entryRecord.messaging)
      ? entryRecord.messaging
      : [];

    for (const change of changes) {
      const field = asRecord(change).field;
      if (typeof field === "string" && field.trim()) {
        fieldSet.add(field.trim());
      }
    }

    messageCount += messaging.length;

    const rawTime = entryRecord.time;
    if (typeof rawTime === "number" && Number.isFinite(rawTime)) {
      lastEntryTime = new Date(rawTime * 1000).toISOString();
    }
  }

  return {
    object: typeof root.object === "string" ? root.object : null,
    entryCount: entries.length,
    changedFields: [...fieldSet],
    messageCount,
    lastEntryTime,
  };
}
