import type { SupabaseClient } from "@supabase/supabase-js";

import {
  findOrCreateContact,
  findOrCreateConversation,
} from "@/lib/inbox/service";
import { normalizeUazapiWebhookPayload } from "@/lib/inbox/uazapi";
import type { ExternalInboxChannel } from "@/types";

type SupabaseAny = SupabaseClient;

type UazapiIngestChannel = Pick<
  ExternalInboxChannel,
  "id" | "account_id" | "created_by" | "provider"
>;

export type UazapiIngestResult = {
  ok: true;
  ignored?: boolean;
  duplicate?: boolean;
  conversationId?: string;
};

function normalizeContentType(mediaType: string) {
  if (mediaType === "image") return "image";
  if (mediaType === "video") return "video";
  if (mediaType === "audio") return "audio";
  if (mediaType === "document") return "document";
  return "text";
}

export async function ingestUazapiInboundPayload(
  admin: SupabaseAny,
  channel: UazapiIngestChannel,
  payload: unknown,
): Promise<UazapiIngestResult> {
  if (channel.provider !== "uazapi") {
    throw new Error("Channel is not a UAZAPI channel");
  }

  if (!channel.created_by) {
    throw new Error("Channel is missing an owner user");
  }

  const normalized = normalizeUazapiWebhookPayload(payload);

  if (!normalized || normalized.fromMe) {
    return { ok: true, ignored: true };
  }

  const contactOutcome = await findOrCreateContact(admin, {
    accountId: channel.account_id,
    userId: channel.created_by,
    phone: normalized.phone,
    name: normalized.contactName,
  });

  const conversation = await findOrCreateConversation(admin, {
    accountId: channel.account_id,
    userId: channel.created_by,
    contactId: contactOutcome.contact.id,
    provider: "uazapi",
    externalChannelId: channel.id,
  });

  if (normalized.providerMessageId) {
    const { data: existing } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("message_id", normalized.providerMessageId)
      .maybeSingle();

    if (existing) {
      return { ok: true, duplicate: true, conversationId: conversation.id };
    }
  }

  const contentType = normalizeContentType(normalized.mediaType);
  const { error: messageError } = await admin.from("messages").insert({
    conversation_id: conversation.id,
    sender_type: "customer",
    content_type: contentType,
    content_text: normalized.text,
    media_url: normalized.mediaUrl,
    message_id: normalized.providerMessageId,
    status: "delivered",
    created_at: normalized.createdAt,
  });

  if (messageError) {
    throw messageError;
  }

  await admin
    .from("conversations")
    .update({
      last_message_text: normalized.text || "[Attachment]",
      last_message_at: normalized.createdAt,
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
      channel_provider: "uazapi",
      external_channel_id: channel.id,
    })
    .eq("id", conversation.id);

  return { ok: true, conversationId: conversation.id };
}
