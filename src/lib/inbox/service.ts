import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapExternalChannel,
  mapOfficialChannel,
  resolveConversationProvider,
} from "@/lib/inbox/channels";
import { findExistingContact, isUniqueViolation } from "@/lib/contacts/dedupe";
import type {
  Contact,
  Conversation,
  ExternalInboxChannel,
  InboxChannel,
  InboxChannelProvider,
  MessageTemplate,
  WhatsAppConfig,
} from "@/types";

export interface AuthAccountContext {
  userId: string;
  accountId: string;
}

type SupabaseAny = SupabaseClient;

interface ContactSeed {
  accountId: string;
  userId: string;
  name?: string | null;
  phone: string;
  email?: string | null;
  preserveExistingName?: boolean;
}

interface ConversationSeed {
  accountId: string;
  userId: string;
  contactId: string;
  provider: InboxChannelProvider;
  whatsappConfigId?: string | null;
  externalChannelId?: string | null;
}

export function lastMessagePreview(
  messageType: string,
  contentText?: string | null,
): string {
  if (contentText && contentText.trim().length > 0) {
    return contentText;
  }

  return `[${messageType}]`;
}

export async function resolveAccountId(
  supabase: SupabaseAny,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.account_id) return null;
  return data.account_id as string;
}

export async function resolveAuthAccountContext(
  supabase: SupabaseAny,
): Promise<AuthAccountContext | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const accountId = await resolveAccountId(supabase, user.id);
  if (!accountId) return null;

  return { userId: user.id, accountId };
}

export async function listInboxChannels(
  supabase: SupabaseAny,
  accountId: string,
): Promise<InboxChannel[]> {
  const [{ data: officialRows, error: officialError }, { data: externalRows, error: externalError }] =
    await Promise.all([
      supabase
        .from("whatsapp_config")
        .select(
          "id, user_id, account_id, phone_number_id, waba_id, access_token, verify_token, status, connected_at, label, registered_at, subscribed_apps_at, last_registration_error, created_at, updated_at",
        )
        .eq("account_id", accountId)
        .order("created_at", { ascending: true }),
      supabase
        .from("external_inbox_channels")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true }),
    ]);

  if (officialError) {
    throw officialError;
  }

  if (externalError) {
    throw externalError;
  }

  const official = ((officialRows ?? []) as WhatsAppConfig[]).map(mapOfficialChannel);
  const external = ((externalRows ?? []) as ExternalInboxChannel[]).map(mapExternalChannel);
  return [...official, ...external];
}

export async function getApprovedTemplate(
  supabase: SupabaseAny,
  accountId: string,
  name: string,
  language?: string | null,
): Promise<MessageTemplate | null> {
  const { data } = await supabase
    .from("message_templates")
    .select("*")
    .eq("account_id", accountId)
    .eq("name", name)
    .eq("language", language || "en_US")
    .maybeSingle();

  return (data as MessageTemplate | null) ?? null;
}

export async function syncContactTags(
  supabase: SupabaseAny,
  contactId: string,
  tagIds: string[],
): Promise<void> {
  const uniqueTagIds = [...new Set(tagIds.filter(Boolean))];

  const { error: deleteError } = await supabase
    .from("contact_tags")
    .delete()
    .eq("contact_id", contactId);

  if (deleteError) throw deleteError;

  if (uniqueTagIds.length === 0) return;

  const { error: insertError } = await supabase.from("contact_tags").insert(
    uniqueTagIds.map((tagId) => ({
      contact_id: contactId,
      tag_id: tagId,
    })),
  );

  if (insertError) throw insertError;
}

export async function findOrCreateContact(
  supabase: SupabaseAny,
  seed: ContactSeed,
): Promise<{ contact: Contact; wasCreated: boolean }> {
  const existing = await findExistingContact(supabase, seed.accountId, seed.phone);
  if (existing) {
    const nextName = seed.name?.trim();
    const nextEmail = seed.email?.trim();
    const existingName = existing.name?.trim() ?? "";
    const shouldUpdateName =
      Boolean(nextName) && (!seed.preserveExistingName || !existingName);
    if (
      (shouldUpdateName && nextName !== existing.name) ||
      (nextEmail && nextEmail !== existing.email)
    ) {
      await supabase
        .from("contacts")
        .update({
          name: shouldUpdateName ? nextName : existing.name || null,
          email: nextEmail || existing.email || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return { contact: existing as unknown as Contact, wasCreated: false };
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      account_id: seed.accountId,
      user_id: seed.userId,
      name: seed.name?.trim() || null,
      email: seed.email?.trim() || null,
      phone: seed.phone,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const raced = await findExistingContact(supabase, seed.accountId, seed.phone);
      if (raced) {
        return { contact: raced as unknown as Contact, wasCreated: false };
      }
    }
    throw error;
  }

  return { contact: data as Contact, wasCreated: true };
}

export async function findOrCreateConversation(
  supabase: SupabaseAny,
  seed: ConversationSeed,
): Promise<Conversation> {
  let query = supabase
    .from("conversations")
    .select("*")
    .eq("account_id", seed.accountId)
    .eq("contact_id", seed.contactId)
    .eq("channel_provider", seed.provider);

  if (seed.provider === "whatsapp_official") {
    query = query.eq("whatsapp_config_id", seed.whatsappConfigId ?? null) as typeof query;
  } else {
    query = query.eq("external_channel_id", seed.externalChannelId ?? null) as typeof query;
  }

  const { data: existing, error: existingError } = await query
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as Conversation;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      account_id: seed.accountId,
      user_id: seed.userId,
      contact_id: seed.contactId,
      whatsapp_config_id: seed.provider === "whatsapp_official" ? seed.whatsappConfigId ?? null : null,
      channel_provider: seed.provider,
      external_channel_id:
        seed.provider === "whatsapp_official" ? null : seed.externalChannelId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Conversation;
}

export async function loadConversationForSend(
  supabase: SupabaseAny,
  accountId: string,
  conversationId: string,
): Promise<(Conversation & { contact: Contact | null }) | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*, contact:contacts(*)")
    .eq("id", conversationId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as Conversation & { contact: Contact | null };
}

export async function pauseActiveFlows(
  supabase: SupabaseAny,
  accountId: string,
  contactId: string,
): Promise<void> {
  const { error } = await supabase
    .from("flow_runs")
    .update({
      status: "paused_by_agent",
      ended_at: new Date().toISOString(),
      end_reason: "agent_replied",
    })
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .eq("status", "active");

  if (error) {
    console.error("[flows] pause-on-agent-send failed:", error.message);
  }
}

export async function loadExternalChannel(
  supabase: SupabaseAny,
  accountId: string,
  externalChannelId: string,
): Promise<ExternalInboxChannel | null> {
  const { data, error } = await supabase
    .from("external_inbox_channels")
    .select("*")
    .eq("id", externalChannelId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw error;
  return (data as ExternalInboxChannel | null) ?? null;
}

export async function loadOfficialChannel(
  supabase: SupabaseAny,
  accountId: string,
  whatsappConfigId?: string | null,
): Promise<WhatsAppConfig | null> {
  let query = supabase
    .from("whatsapp_config")
    .select("*")
    .eq("account_id", accountId);

  if (whatsappConfigId) {
    query = query.eq("id", whatsappConfigId) as typeof query;
  }

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as WhatsAppConfig[];
  if (rows.length === 0) return null;

  if (!whatsappConfigId && rows.length > 1) {
    throw new Error(
      "This conversation is not assigned to a WhatsApp channel. Select a channel-specific conversation before replying.",
    );
  }

  return rows[0] ?? null;
}

export function resolveConversationChannelIds(
  conversation: Pick<
    Conversation,
    "channel_provider" | "whatsapp_config_id" | "external_channel_id"
  >,
) {
  return {
    provider: resolveConversationProvider(conversation),
    whatsappConfigId: conversation.whatsapp_config_id ?? null,
    externalChannelId: conversation.external_channel_id ?? null,
  };
}
