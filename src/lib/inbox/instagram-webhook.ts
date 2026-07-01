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

export function asInstagramRecord(value: unknown): Record<string, unknown> {
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
  const root = asInstagramRecord(payload);
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const fieldSet = new Set<string>();
  let messageCount = 0;
  let lastEntryTime: string | null = null;

  for (const entry of entries) {
    const entryRecord = asInstagramRecord(entry);
    const changes = Array.isArray(entryRecord.changes) ? entryRecord.changes : [];
    const messaging = Array.isArray(entryRecord.messaging)
      ? entryRecord.messaging
      : [];

    for (const change of changes) {
      const field = asInstagramRecord(change).field;
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

export interface InstagramCommentEvent {
  id: string;
  text: string;
  fromId: string | null;
  username: string | null;
  mediaId: string | null;
  mediaProductType: string | null;
  parentId: string | null;
  timestamp: string | null;
  raw: Record<string, unknown>;
}

export interface InstagramMessageEvent {
  senderId: string;
  recipientId: string | null;
  messageId: string | null;
  text: string | null;
  timestamp: string | null;
  isEcho: boolean;
  raw: Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function timestampOrNull(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }

  return stringOrNull(value);
}

export function normalizeInstagramKeyword(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function isInstagramKeywordComment(
  text: string,
  keyword = "INTEGRAR",
): boolean {
  return normalizeInstagramKeyword(text) === normalizeInstagramKeyword(keyword);
}

export function extractInstagramCommentEvents(
  payload: unknown,
): InstagramCommentEvent[] {
  const root = asInstagramRecord(payload);
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const comments: InstagramCommentEvent[] = [];

  for (const entry of entries) {
    const entryRecord = asInstagramRecord(entry);
    const changes = Array.isArray(entryRecord.changes) ? entryRecord.changes : [];

    for (const change of changes) {
      const changeRecord = asInstagramRecord(change);
      const field = stringOrNull(changeRecord.field);
      if (field !== "comments" && field !== "live_comments") continue;

      const value = asInstagramRecord(changeRecord.value);
      const id = stringOrNull(value.id);
      const text = stringOrNull(value.text);
      if (!id || !text) continue;

      const from = asInstagramRecord(value.from);
      const media = asInstagramRecord(value.media);

      comments.push({
        id,
        text,
        fromId: stringOrNull(from.id),
        username: stringOrNull(from.username),
        mediaId: stringOrNull(media.id),
        mediaProductType: stringOrNull(media.media_product_type),
        parentId: stringOrNull(value.parent_id),
        timestamp: timestampOrNull(value.timestamp),
        raw: value,
      });
    }
  }

  return comments;
}

export function extractInstagramMessageEvents(
  payload: unknown,
): InstagramMessageEvent[] {
  const root = asInstagramRecord(payload);
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const messages: InstagramMessageEvent[] = [];

  for (const entry of entries) {
    const entryRecord = asInstagramRecord(entry);
    const messaging = Array.isArray(entryRecord.messaging)
      ? entryRecord.messaging
      : [];

    for (const item of messaging) {
      const itemRecord = asInstagramRecord(item);
      const sender = asInstagramRecord(itemRecord.sender);
      const recipient = asInstagramRecord(itemRecord.recipient);
      const message = asInstagramRecord(itemRecord.message);
      const senderId = stringOrNull(sender.id);
      if (!senderId) continue;

      messages.push({
        senderId,
        recipientId: stringOrNull(recipient.id),
        messageId: stringOrNull(message.mid),
        text: stringOrNull(message.text),
        timestamp: timestampOrNull(itemRecord.timestamp),
        isEcho: message.is_echo === true,
        raw: itemRecord,
      });
    }
  }

  return messages;
}

export function extractBrazilianWhatsapp(input: string): string | null {
  const candidates =
    input.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)9?\d{4}[-\s]?\d{4}/g) ??
    [];

  for (const candidate of candidates) {
    let digits = candidate.replace(/\D/g, "");

    if (digits.startsWith("55")) {
      digits = digits.slice(2);
    }

    if (digits.length !== 10 && digits.length !== 11) continue;

    const ddd = digits.slice(0, 2);
    const subscriber = digits.slice(2);
    if (!/^[1-9]\d$/.test(ddd)) continue;
    if (!/^\d{8,9}$/.test(subscriber)) continue;

    return `55${digits}`;
  }

  return null;
}
