import type { ExternalInboxChannel } from "@/types";

import { decrypt } from "@/lib/whatsapp/encryption";

type InstagramGraphChannel = Pick<
  ExternalInboxChannel,
  "id" | "external_key" | "settings" | "token_encrypted"
>;

type InstagramRecipient =
  | { comment_id: string }
  | { id: string };

export interface InstagramSendResult {
  messageId: string | null;
  recipientId: string | null;
}

function graphVersion(): string {
  return process.env.META_GRAPH_API_VERSION || "v23.0";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function resolveInstagramPageId(
  channel: InstagramGraphChannel,
): string | null {
  const settings = asRecord(channel.settings);
  const settingsPageId = settings.page_id;
  if (typeof settingsPageId === "string" && settingsPageId.trim()) {
    return settingsPageId.trim();
  }

  return channel.external_key?.trim() || null;
}

export function resolveInstagramPageAccessToken(
  channel: InstagramGraphChannel,
): string {
  if (!channel.token_encrypted) {
    throw new Error("Instagram Page access token is not configured.");
  }

  return decrypt(channel.token_encrypted);
}

async function sendInstagramMessage(
  channel: InstagramGraphChannel,
  recipient: InstagramRecipient,
  text: string,
): Promise<InstagramSendResult> {
  const pageId = resolveInstagramPageId(channel);
  if (!pageId) {
    throw new Error("Facebook Page ID is required for Instagram messaging.");
  }

  const accessToken = resolveInstagramPageAccessToken(channel);
  const body = new URLSearchParams({
    recipient: JSON.stringify(recipient),
    message: JSON.stringify({ text }),
    access_token: accessToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion()}/${pageId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; type?: string };
    message_id?: string;
    recipient_id?: string;
  };

  if (!response.ok) {
    const errorMessage =
      payload.error?.message ||
      `Instagram Graph API returned HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return {
    messageId: payload.message_id ?? null,
    recipientId: payload.recipient_id ?? null,
  };
}

export function sendInstagramPrivateReply(
  channel: InstagramGraphChannel,
  commentId: string,
  text: string,
): Promise<InstagramSendResult> {
  return sendInstagramMessage(channel, { comment_id: commentId }, text);
}

export function sendInstagramDirectMessage(
  channel: InstagramGraphChannel,
  igScopedUserId: string,
  text: string,
): Promise<InstagramSendResult> {
  return sendInstagramMessage(channel, { id: igScopedUserId }, text);
}
