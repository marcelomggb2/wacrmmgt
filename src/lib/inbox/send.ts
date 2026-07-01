import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/flows/admin-client";
import {
  getApprovedTemplate,
  lastMessagePreview,
  loadConversationForSend,
  loadExternalChannel,
  loadOfficialChannel,
  pauseActiveFlows,
  resolveConversationChannelIds,
} from "@/lib/inbox/service";
import { renderTemplateBody } from "@/lib/inbox/template-render";
import {
  sendUazapiMediaMessage,
  sendUazapiTextMessage,
} from "@/lib/inbox/uazapi";
import { sendInstagramDirectMessage } from "@/lib/inbox/instagram-graph";
import {
  decrypt,
  encrypt,
  isLegacyFormat,
} from "@/lib/whatsapp/encryption";
import {
  sendMediaMessage,
  sendTemplateMessage,
  sendTextMessage,
  type MediaKind,
} from "@/lib/whatsapp/meta-api";
import {
  isRecipientNotAllowedError,
  isValidE164,
  phoneVariants,
  sanitizePhoneForMeta,
} from "@/lib/whatsapp/phone-utils";
import { isMessageTemplate } from "@/lib/whatsapp/template-row-guard";
import type { InboxChannelProvider, MessageTemplate } from "@/types";

type SupabaseAny = SupabaseClient;

export interface SendConversationMessageInput {
  conversationId: string;
  messageType: "text" | "template" | MediaKind;
  contentText?: string | null;
  mediaUrl?: string | null;
  filename?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParams?: string[];
  templateMessageParams?: {
    body?: string[];
    headerText?: string;
    buttonParams?: Record<number, string>;
  } | null;
  replyToMessageId?: string | null;
}

export interface SendConversationMessageResult {
  success: true;
  messageId: string;
  providerMessageId: string | null;
  provider: "whatsapp_official" | "uazapi" | "instagram";
}

async function lookupReplyContextMessageId(
  supabase: SupabaseAny,
  conversationId: string,
  replyToMessageId?: string | null,
): Promise<string | undefined> {
  if (!replyToMessageId) return undefined;

  const { data, error } = await supabase
    .from("messages")
    .select("message_id, conversation_id")
    .eq("id", replyToMessageId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("reply_to_message_id not found in this conversation");
  }

  if (!data.message_id) {
    return undefined;
  }

  return data.message_id as string;
}

async function insertSentMessage(
  supabase: SupabaseAny,
  input: SendConversationMessageInput,
  providerMessageId: string | null,
) {
  const contentText =
    input.messageType === "template" && input.contentText
      ? input.contentText
      : input.contentText || null;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_type: "agent",
      content_type: input.messageType,
      content_text: contentText,
      media_url: input.mediaUrl || null,
      template_name: input.templateName || null,
      message_id: providerMessageId,
      status: "sent",
      reply_to_message_id: input.replyToMessageId || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Message sent to provider but failed to save to DB: ${error.message}`,
    );
  }

  return data.id as string;
}

async function updateConversationAfterSend(
  supabase: SupabaseAny,
  input: SendConversationMessageInput,
  update: {
    whatsappConfigId?: string | null;
    externalChannelId?: string | null;
    channelProvider?: InboxChannelProvider;
  } = {},
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({
      last_message_text: lastMessagePreview(input.messageType, input.contentText),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      whatsapp_config_id: update.whatsappConfigId ?? null,
      external_channel_id: update.externalChannelId ?? null,
      channel_provider:
        update.channelProvider ??
        (update.externalChannelId && !update.whatsappConfigId
          ? "uazapi"
          : "whatsapp_official"),
    })
    .eq("id", input.conversationId);

  if (error) {
    throw error;
  }
}

async function sendOfficialConversationMessage(
  supabase: SupabaseAny,
  accountId: string,
  input: SendConversationMessageInput,
): Promise<SendConversationMessageResult> {
  const conversation = await loadConversationForSend(
    supabase,
    accountId,
    input.conversationId,
  );

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const contact = conversation.contact;
  if (!contact?.phone) {
    throw new Error("Contact phone number not found");
  }

  const sanitizedPhone = sanitizePhoneForMeta(contact.phone);
  if (!isValidE164(sanitizedPhone)) {
    throw new Error("Invalid phone number format");
  }

  const config = await loadOfficialChannel(
    supabase,
    accountId,
    conversation.whatsapp_config_id,
  );

  if (!config) {
    throw new Error(
      "WhatsApp not configured. Please set up your WhatsApp integration first.",
    );
  }

  const accessToken = decrypt(config.access_token);
  if (isLegacyFormat(config.access_token)) {
    void supabase
      .from("whatsapp_config")
      .update({ access_token: encrypt(accessToken) })
      .eq("id", config.id)
      .then(({ error }) => {
        if (error) {
          console.warn(
            "[inbox/send] access_token GCM upgrade failed:",
            error.message,
          );
        }
      });
  }

  const contextMessageId = await lookupReplyContextMessageId(
    supabase,
    input.conversationId,
    input.replyToMessageId,
  );

  let templateRow: MessageTemplate | null = null;
  if (input.messageType === "template" && input.templateName) {
    const row = await getApprovedTemplate(
      supabase,
      accountId,
      input.templateName,
      input.templateLanguage,
    );
    if (row && !isMessageTemplate(row)) {
      throw new Error(
        'Template row is malformed locally - run "Sync from Meta" in Settings to repair it.',
      );
    }
    templateRow = row;
  }

  const attempt = async (phone: string): Promise<string> => {
    if (input.messageType === "template" && input.templateName) {
      const result = await sendTemplateMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        templateName: input.templateName,
        language: input.templateLanguage || "en_US",
        template: templateRow ?? undefined,
        messageParams: input.templateMessageParams ?? undefined,
        params: input.templateParams || [],
        contextMessageId,
      });
      return result.messageId;
    }

    if (
      input.messageType === "image" ||
      input.messageType === "video" ||
      input.messageType === "document" ||
      input.messageType === "audio"
    ) {
      const result = await sendMediaMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        kind: input.messageType,
        link: input.mediaUrl || "",
        caption: input.contentText || undefined,
        filename: input.filename || undefined,
        contextMessageId,
      });
      return result.messageId;
    }

    const result = await sendTextMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to: phone,
      text: input.contentText || "",
      contextMessageId,
    });
    return result.messageId;
  };

  let providerMessageId: string | null = null;
  let workingPhone = sanitizedPhone;
  const variants = phoneVariants(sanitizedPhone);
  let lastError: unknown = null;

  for (const variant of variants) {
    try {
      providerMessageId = await attempt(variant);
      workingPhone = variant;
      lastError = null;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isRecipientNotAllowedError(message)) {
        throw error;
      }
      lastError = error;
      console.warn(
        `[inbox/send] variant "${variant}" rejected by Meta, trying next...`,
      );
    }
  }

  if (lastError) {
    throw lastError;
  }

  if (workingPhone !== sanitizedPhone) {
    await supabase.from("contacts").update({ phone: workingPhone }).eq("id", contact.id);
  }

  const messageId = await insertSentMessage(supabase, input, providerMessageId);
  await updateConversationAfterSend(supabase, input, {
    whatsappConfigId: config.id,
  });
  await pauseActiveFlows(supabaseAdmin(), accountId, contact.id);

  return {
    success: true,
    messageId,
    providerMessageId,
    provider: "whatsapp_official",
  };
}

async function sendUazapiConversationMessage(
  supabase: SupabaseAny,
  accountId: string,
  input: SendConversationMessageInput,
): Promise<SendConversationMessageResult> {
  const conversation = await loadConversationForSend(
    supabase,
    accountId,
    input.conversationId,
  );

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const contact = conversation.contact;
  if (!contact?.phone) {
    throw new Error("Contact phone number not found");
  }

  if (!conversation.external_channel_id) {
    throw new Error("This conversation is not linked to a UAZAPI channel.");
  }

  const channel = await loadExternalChannel(
    supabase,
    accountId,
    conversation.external_channel_id,
  );

  if (!channel || channel.provider !== "uazapi") {
    throw new Error("UAZAPI channel not found");
  }

  if (!channel.token_encrypted) {
    throw new Error("UAZAPI token is missing");
  }

  const token = decrypt(channel.token_encrypted);
  const number = contact.phone.replace(/\D/g, "");
  const textBody =
    input.messageType === "template"
      ? input.contentText ||
        renderTemplateBody("", input.templateMessageParams?.body ?? [])
      : input.contentText || "";

  let providerMessageId: string | null = null;

  if (input.messageType === "text" || input.messageType === "template") {
    const result = await sendUazapiTextMessage(channelWithToken(channel, token), {
      number,
      text: textBody,
    });
    providerMessageId = result.messageId;
  } else {
    const result = await sendUazapiMediaMessage(channelWithToken(channel, token), {
      number,
      url: input.mediaUrl || "",
      type: input.messageType,
      caption: input.contentText || undefined,
      fileName: input.filename || undefined,
    });
    providerMessageId = result.messageId;
  }

  const messageId = await insertSentMessage(
    supabase,
    {
      ...input,
      contentText: textBody || input.contentText || null,
    },
    providerMessageId,
  );

  await updateConversationAfterSend(
    supabase,
    {
      ...input,
      contentText: textBody || input.contentText || null,
    },
    {
      externalChannelId: channel.id,
    },
  );
  await pauseActiveFlows(supabaseAdmin(), accountId, contact.id);

  return {
    success: true,
    messageId,
    providerMessageId,
    provider: "uazapi",
  };
}

function channelWithToken(
  channel: {
    base_url?: string | null;
    external_key?: string | null;
  },
  token: string,
) {
  return {
    base_url: channel.base_url || "",
    external_key: channel.external_key || null,
    token,
  };
}

async function sendInstagramConversationMessage(
  supabase: SupabaseAny,
  accountId: string,
  input: SendConversationMessageInput,
): Promise<SendConversationMessageResult> {
  if (input.messageType !== "text") {
    throw new Error("Instagram inbox currently supports text replies only.");
  }

  const conversation = await loadConversationForSend(
    supabase,
    accountId,
    input.conversationId,
  );

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!conversation.external_channel_id) {
    throw new Error("This conversation is not linked to an Instagram channel.");
  }

  const channel = await loadExternalChannel(
    supabase,
    accountId,
    conversation.external_channel_id,
  );

  if (!channel || channel.provider !== "instagram") {
    throw new Error("Instagram channel not found");
  }

  const { data: session, error: sessionError } = await supabase
    .from("instagram_lead_sessions")
    .select("ig_scoped_user_id")
    .eq("account_id", accountId)
    .eq("external_channel_id", channel.id)
    .eq("conversation_id", conversation.id)
    .not("ig_scoped_user_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) throw sessionError;

  const igScopedUserId =
    typeof session?.ig_scoped_user_id === "string"
      ? session.ig_scoped_user_id
      : null;

  if (!igScopedUserId) {
    throw new Error("Instagram recipient ID is missing for this conversation.");
  }

  const result = await sendInstagramDirectMessage(
    channel,
    igScopedUserId,
    input.contentText || "",
  );

  const messageId = await insertSentMessage(
    supabase,
    input,
    result.messageId,
  );

  await updateConversationAfterSend(supabase, input, {
    externalChannelId: channel.id,
    channelProvider: "instagram",
  });

  if (conversation.contact_id) {
    await pauseActiveFlows(supabaseAdmin(), accountId, conversation.contact_id);
  }

  return {
    success: true,
    messageId,
    providerMessageId: result.messageId,
    provider: "instagram",
  };
}

export async function sendConversationMessage(
  supabase: SupabaseAny,
  accountId: string,
  input: SendConversationMessageInput,
): Promise<SendConversationMessageResult> {
  if (!input.conversationId || !input.messageType) {
    throw new Error("conversation_id and message_type are required");
  }

  if (input.messageType === "text" && !input.contentText) {
    throw new Error("content_text is required for text messages");
  }

  if (input.messageType === "template" && !input.templateName) {
    throw new Error("template_name is required for template messages");
  }

  if (
    (input.messageType === "image" ||
      input.messageType === "video" ||
      input.messageType === "document" ||
      input.messageType === "audio") &&
    !input.mediaUrl
  ) {
    throw new Error(`media_url is required for ${input.messageType} messages`);
  }

  const conversation = await loadConversationForSend(
    supabase,
    accountId,
    input.conversationId,
  );

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const { provider } = resolveConversationChannelIds(conversation);

  if (provider === "instagram") {
    return sendInstagramConversationMessage(supabase, accountId, input);
  }

  if (provider === "uazapi") {
    return sendUazapiConversationMessage(supabase, accountId, input);
  }

  return sendOfficialConversationMessage(supabase, accountId, input);
}
