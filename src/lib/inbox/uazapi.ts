import type { ExternalInboxChannel } from "@/types";

type FetchLike = typeof fetch;

type UazapiRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type UazapiTextResponse = {
  messageId: string | null;
  raw: unknown;
};

const DEFAULT_UAZAPI_BASE_URL = "https://api.uazapi.com";
const DEFAULT_UAZAPI_SSE_EVENTS = ["messages"] as const;
const DEFAULT_UAZAPI_SSE_EXCLUDE_MESSAGES = [
  "wasSentByApi",
  "fromMeYes",
  "isGroupYes",
] as const;

export interface NormalizedUazapiWebhookMessage {
  providerMessageId: string | null;
  phone: string;
  chatId: string;
  fromMe: boolean;
  text: string | null;
  mediaUrl: string | null;
  mediaType: "text" | "image" | "video" | "audio" | "document";
  fileName: string | null;
  contactName: string | null;
  createdAt: string;
  raw: unknown;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeUazapiBaseUrl(value?: string | null): string {
  const trimmed = trimTrailingSlashes((value || "").trim());

  if (!trimmed) {
    return DEFAULT_UAZAPI_BASE_URL;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const withoutLeadingSlashes = trimmed.replace(/^\/+/, "");
  if (withoutLeadingSlashes.includes(".")) {
    return `https://${withoutLeadingSlashes}`;
  }

  return `https://${withoutLeadingSlashes}.uazapi.com`;
}

function ensureJsonHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    token,
  };
}

function messageProviderId(payload: Record<string, unknown>): string | null {
  const key = payload.key as Record<string, unknown> | undefined;
  const value =
    payload.messageid ||
    payload.messageId ||
    payload.id ||
    payload.provider_message_id ||
    key?.id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function cleanPhone(value: string): string {
  return value.split("@")[0].replace(/\D/g, "");
}

function normalizeMediaType(value: string): NormalizedUazapiWebhookMessage["mediaType"] {
  const type = value.toLowerCase();
  if (
    type.includes("image") ||
    type.includes("sticker") ||
    type.includes("webp")
  ) {
    return "image";
  }
  if (type.includes("video")) return "video";
  if (type.includes("audio") || type.includes("ptt") || type.includes("ogg")) {
    return "audio";
  }
  if (
    type.includes("document") ||
    type.includes("pdf") ||
    type.includes("sheet") ||
    type.includes("word")
  ) {
    return "document";
  }
  return "text";
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value > 100000000000 ? value : value * 1000).toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return normalizeTimestamp(asNumber);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function hasMessageEnvelope(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(
    record.messageid ||
      record.messageId ||
      record.key ||
      record.chatid ||
      record.chatId ||
      record.wa_chatid ||
      record.remoteJid ||
      record.fromMe !== undefined ||
      record.messageType ||
      record.content !== undefined ||
      record.text ||
      record.body ||
      record.fileURL,
  );
}

function rootEnvelope(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const data = payload as Record<string, unknown>;
  for (const candidate of [data.body, data.data, data]) {
    if (hasMessageEnvelope(candidate)) {
      return candidate;
    }
  }
  return data;
}

function bodyEnvelope(root: Record<string, unknown>): Record<string, unknown> {
  if (
    root.message &&
    typeof root.message === "object" &&
    !hasMessageEnvelope(root.message)
  ) {
    return root.message as Record<string, unknown>;
  }
  return root;
}

async function uazapiRequest<T>(
  channel: Pick<ExternalInboxChannel, "base_url" | "external_key"> & {
    token: string;
  },
  pathname: string,
  options: UazapiRequestOptions = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(pathname, `${normalizeUazapiBaseUrl(channel.base_url)}/`);

    const response = await fetchImpl(url, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: ensureJsonHeaders(channel.token),
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof data === "object" &&
        data &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : `UAZAPI request failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildUazapiSseUrl(
  channel: Pick<ExternalInboxChannel, "base_url"> & { token: string },
  options: {
    events?: readonly string[];
    excludeMessages?: readonly string[];
  } = {},
): URL {
  const url = new URL("/sse", `${normalizeUazapiBaseUrl(channel.base_url)}/`);
  url.searchParams.set("token", channel.token);
  url.searchParams.set(
    "events",
    (options.events ?? DEFAULT_UAZAPI_SSE_EVENTS).join(","),
  );
  const excludeMessages =
    options.excludeMessages ?? DEFAULT_UAZAPI_SSE_EXCLUDE_MESSAGES;
  if (excludeMessages.length > 0) {
    url.searchParams.set("excludeMessages", excludeMessages.join(","));
  }
  return url;
}

export async function fetchUazapiStatus(
  channel: Pick<
    ExternalInboxChannel,
    "base_url" | "external_key"
  > & {
    token: string;
  },
  fetchImpl?: FetchLike,
) {
  return uazapiRequest<Record<string, unknown>>(
    channel,
    "/instance/status",
    { fetchImpl },
  );
}

export async function sendUazapiTextMessage(
  channel: Pick<
    ExternalInboxChannel,
    "base_url" | "external_key"
  > & {
    token: string;
  },
  payload: {
    number: string;
    text: string;
    trackSource?: string;
  },
  fetchImpl?: FetchLike,
): Promise<UazapiTextResponse> {
  const raw = await uazapiRequest<Record<string, unknown>>(
    channel,
    "/send/text",
    {
      method: "POST",
      body: {
        number: payload.number,
        text: payload.text,
        track_source: payload.trackSource ?? "wacrm",
      },
      fetchImpl,
    },
  );

  return {
    messageId: messageProviderId(raw),
    raw,
  };
}

export async function sendUazapiMediaMessage(
  channel: Pick<
    ExternalInboxChannel,
    "base_url" | "external_key"
  > & {
    token: string;
  },
  payload: {
    number: string;
    url: string;
    type: "image" | "video" | "audio" | "document";
    caption?: string;
    fileName?: string;
  },
  fetchImpl?: FetchLike,
): Promise<UazapiTextResponse> {
  const raw = await uazapiRequest<Record<string, unknown>>(
    channel,
    "/send/media",
    {
      method: "POST",
      body: {
        number: payload.number,
        file: payload.url,
        type: payload.type,
        text: payload.caption,
        docName: payload.fileName,
        track_source: "wacrm",
      },
      fetchImpl,
    },
  );

  return {
    messageId: messageProviderId(raw),
    raw,
  };
}

export function normalizeUazapiWebhookPayload(
  payload: unknown,
): NormalizedUazapiWebhookMessage | null {
  const root = rootEnvelope(payload);
  const msg = bodyEnvelope(root);
  const key = (msg.key as Record<string, unknown> | undefined) || {};
  const chatId = pickFirstString(
    msg.chatid,
    msg.chatId,
    msg.wa_chatid,
    msg.remoteJid,
    key.remoteJid,
    root.chatid,
    root.wa_chatid,
  );

  const remote = chatId || pickFirstString(msg.from, root.from, root.number) || "";
  const phone = cleanPhone(
    pickFirstString(remote, msg.number, msg.phone, root.number) || "",
  );

  if (!phone) return null;

  const text = pickFirstString(
    msg.text,
    msg.body,
    msg.conversation,
    root.text,
    root.body,
  );

  const mediaRecord =
    (msg.media as Record<string, unknown> | undefined) ||
    (msg.imageMessage as Record<string, unknown> | undefined) ||
    (msg.audioMessage as Record<string, unknown> | undefined) ||
    (msg.videoMessage as Record<string, unknown> | undefined) ||
    (msg.documentMessage as Record<string, unknown> | undefined);

  const mediaUrl = pickFirstString(
    msg.fileURL,
    msg.fileUrl,
    msg.media_url,
    msg.mediaUrl,
    mediaRecord?.fileURL,
    mediaRecord?.fileUrl,
    root.fileURL,
  );

  const rawMediaType = pickFirstString(
    msg.messageType,
    msg.media_type,
    msg.mediaType,
    msg.type,
    mediaRecord?.messageType,
    mediaRecord?.mediaType,
    mediaRecord?.mimetype,
    root.messageType,
    root.media_type,
  );

  return {
    providerMessageId: messageProviderId(msg) || messageProviderId(root),
    phone,
    chatId: chatId || `${phone}@s.whatsapp.net`,
    fromMe: Boolean(msg.fromMe ?? root.fromMe ?? key.fromMe),
    text: text || (mediaUrl ? "[Attachment]" : null),
    mediaUrl,
    mediaType: normalizeMediaType(rawMediaType || ""),
    fileName: pickFirstString(
      msg.fileName,
      msg.filename,
      msg.name,
      mediaRecord?.fileName,
      mediaRecord?.filename,
    ),
    contactName: pickFirstString(
      msg.senderName,
      msg.pushName,
      msg.name,
      root.senderName,
      root.pushName,
      root.name,
    ),
    createdAt: normalizeTimestamp(
      msg.messageTimestamp ??
        root.messageTimestamp ??
        msg.timestamp ??
        root.timestamp,
    ),
    raw: payload,
  };
}
