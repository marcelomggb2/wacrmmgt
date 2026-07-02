import type { SupabaseClient } from "@supabase/supabase-js";

import {
  findOrCreateContact,
  findOrCreateConversation,
} from "@/lib/inbox/service";
import {
  sendInstagramDirectMessage,
  sendInstagramPrivateReply,
} from "@/lib/inbox/instagram-graph";
import {
  asInstagramRecord,
  extractBrazilianWhatsapp,
  extractInstagramCommentEvents,
  extractInstagramMessageEvents,
  isInstagramKeywordComment,
  normalizeInstagramKeyword,
  type InstagramCommentEvent,
  type InstagramMessageEvent,
} from "@/lib/inbox/instagram-webhook";
import type { ExternalInboxChannel } from "@/types";

type SupabaseAny = SupabaseClient;

type InstagramLeadChannel = Pick<
  ExternalInboxChannel,
  | "id"
  | "account_id"
  | "created_by"
  | "provider"
  | "settings"
  | "external_key"
  | "token_encrypted"
  | "display_identifier"
>;

type InstagramLeadSession = {
  id: string;
  account_id: string;
  external_channel_id: string;
  created_by: string | null;
  ig_user_id: string | null;
  ig_scoped_user_id: string | null;
  ig_username: string | null;
  comment_id: string;
  media_id: string | null;
  media_product_type: string | null;
  keyword: string;
  state:
    | "awaiting_opt_in"
    | "awaiting_intent"
    | "awaiting_whatsapp"
    | "qualified"
    | "handed_off"
    | "expired"
    | "reply_failed";
  private_reply_message_id: string | null;
  last_inbound_message_id: string | null;
  contact_id: string | null;
  conversation_id: string | null;
  qualified_phone: string | null;
  retry_count: number;
  raw_comment: Record<string, unknown>;
  context: Record<string, unknown>;
  expires_at: string;
};

export interface InstagramIngestResult {
  ok: true;
  comments: number;
  messages: number;
  ignored: number;
  duplicates: number;
  qualified: number;
}

const KEYWORD = "INTEGRAR";

const COPY = {
  privateReply:
    'Oi! Vi seu comentario "INTEGRAR" no Reels. Te mando um checklist rapido pra conectar Instagram, WhatsApp e CRM sem perder lead?',
  intent:
    "Perfeito. Sao so 2 perguntinhas rapidas pra eu te mandar o caminho certo. Hoje voce quer integrar primeiro?\n1. Instagram DM\n2. WhatsApp\n3. CRM/funil",
  whatsapp:
    "Boa. Pra eu te mandar o checklist e, se fizer sentido, um diagnostico rapido, qual WhatsApp com DDD posso usar? Pode mandar so os numeros.",
  whatsappRetry:
    "Nao consegui identificar o WhatsApp. Me manda com DDD, por exemplo: 11 99999-9999. Se preferir, posso continuar por aqui tambem.",
  qualified:
    'Recebi. Vou te chamar por la com o checklist e o proximo passo. Enquanto isso: voce ja usa algum CRM hoje? Responde com o nome ou "ainda nao".',
};

const TAGS = [
  { name: "Instagram", color: "#e1306c" },
  { name: "Reels INTEGRAR", color: "#f97316" },
  { name: "Atendimento humano", color: "#22c55e" },
];

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { code?: string }).code === "23505",
  );
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveActorUserId(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
): Promise<string> {
  if (channel.created_by) return channel.created_by;

  const { data, error } = await admin
    .from("accounts")
    .select("owner_user_id")
    .eq("id", channel.account_id)
    .maybeSingle();

  if (error || !data?.owner_user_id) {
    throw new Error("Instagram channel is missing an owner user.");
  }

  return data.owner_user_id as string;
}

async function createOrLoadSession(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  userId: string,
  comment: InstagramCommentEvent,
): Promise<InstagramLeadSession> {
  const payload = {
    account_id: channel.account_id,
    external_channel_id: channel.id,
    created_by: userId,
    ig_user_id: comment.fromId,
    ig_username: comment.username,
    comment_id: comment.id,
    media_id: comment.mediaId,
    media_product_type: comment.mediaProductType,
    keyword: normalizeInstagramKeyword(KEYWORD),
    state: "awaiting_opt_in",
    raw_comment: comment.raw,
    context: {
      comment_text: comment.text,
      comment_timestamp: comment.timestamp,
      parent_id: comment.parentId,
    },
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };

  const { data, error } = await admin
    .from("instagram_lead_sessions")
    .insert(payload)
    .select("*")
    .single();

  if (!error && data) {
    return data as InstagramLeadSession;
  }

  if (!isUniqueViolation(error)) {
    throw error;
  }

  const { data: existing, error: selectError } = await admin
    .from("instagram_lead_sessions")
    .select("*")
    .eq("account_id", channel.account_id)
    .eq("external_channel_id", channel.id)
    .eq("comment_id", comment.id)
    .maybeSingle();

  if (selectError || !existing) {
    throw selectError ?? new Error("Failed to reload Instagram session.");
  }

  return existing as InstagramLeadSession;
}

async function updateSession(
  admin: SupabaseAny,
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin
    .from("instagram_lead_sessions")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

async function processComment(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  comment: InstagramCommentEvent,
): Promise<"ignored" | "duplicate" | "sent"> {
  if (!isInstagramKeywordComment(comment.text, KEYWORD)) {
    return "ignored";
  }

  const userId = await resolveActorUserId(admin, channel);
  const session = await createOrLoadSession(admin, channel, userId, comment);

  if (session.private_reply_message_id || session.state === "qualified") {
    return "duplicate";
  }

  try {
    const result = await sendInstagramPrivateReply(
      channel,
      comment.id,
      COPY.privateReply,
    );

    await updateSession(admin, session.id, {
      state: "awaiting_opt_in",
      private_reply_message_id: result.messageId,
      ig_scoped_user_id: result.recipientId ?? session.ig_scoped_user_id,
      last_prompt_at: new Date().toISOString(),
      context: {
        ...asInstagramRecord(session.context),
        private_reply_text: COPY.privateReply,
      },
    });

    return "sent";
  } catch (error) {
    await updateSession(admin, session.id, {
      state: "reply_failed",
      context: {
        ...asInstagramRecord(session.context),
        private_reply_error:
          error instanceof Error ? error.message : "Private reply failed",
      },
    });
    throw error;
  }
}

async function claimMessageEvent(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  message: InstagramMessageEvent,
): Promise<boolean> {
  const eventKey =
    message.messageId ||
    `dm:${message.senderId}:${message.timestamp ?? "unknown"}:${message.text ?? ""}`;

  const { error } = await admin.from("instagram_webhook_events").insert({
    account_id: channel.account_id,
    external_channel_id: channel.id,
    event_key: eventKey,
    event_type: "message",
    provider_event_id: message.messageId,
    payload: message.raw,
    processed_at: new Date().toISOString(),
  });

  if (!error) return true;
  if (isUniqueViolation(error)) return false;
  throw error;
}

async function loadActiveSessionForSender(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  senderId: string,
): Promise<InstagramLeadSession | null> {
  const activeStates = [
    "awaiting_opt_in",
    "awaiting_intent",
    "awaiting_whatsapp",
    "handed_off",
  ];

  const baseSelect = () =>
    admin
      .from("instagram_lead_sessions")
      .select("*")
      .eq("account_id", channel.account_id)
      .eq("external_channel_id", channel.id)
      .in("state", activeStates)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

  const { data: scoped, error: scopedError } = await baseSelect()
    .eq("ig_scoped_user_id", senderId)
    .maybeSingle();

  if (scopedError) throw scopedError;
  if (scoped) return scoped as InstagramLeadSession;

  const { data: user, error: userError } = await baseSelect()
    .eq("ig_user_id", senderId)
    .maybeSingle();

  if (userError) throw userError;
  return (user as InstagramLeadSession | null) ?? null;
}

async function ensureContactTagsByName(
  admin: SupabaseAny,
  accountId: string,
  userId: string,
  contactId: string,
): Promise<void> {
  const tagIds: string[] = [];

  for (const tag of TAGS) {
    const { data: existing, error: selectError } = await admin
      .from("tags")
      .select("id")
      .eq("account_id", accountId)
      .eq("name", tag.name)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing?.id) {
      tagIds.push(existing.id as string);
      continue;
    }

    const { data: created, error: insertError } = await admin
      .from("tags")
      .insert({
        account_id: accountId,
        user_id: userId,
        name: tag.name,
        color: tag.color,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    tagIds.push(created.id as string);
  }

  const { error } = await admin.from("contact_tags").upsert(
    tagIds.map((tagId) => ({
      contact_id: contactId,
      tag_id: tagId,
    })),
    { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
  );

  if (error) throw error;
}

async function resolveLeadPipelineStage(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  userId: string,
): Promise<{ pipelineId: string; stageId: string }> {
  const settings = asInstagramRecord(channel.settings);
  const configuredPipelineId = nonEmptyString(settings.lead_pipeline_id);
  const configuredStageId = nonEmptyString(settings.lead_stage_id);

  let pipelineId = configuredPipelineId;
  if (pipelineId) {
    const { data } = await admin
      .from("pipelines")
      .select("id")
      .eq("id", pipelineId)
      .eq("account_id", channel.account_id)
      .maybeSingle();
    pipelineId = (data?.id as string | undefined) ?? null;
  }

  if (!pipelineId) {
    const { data: pipeline } = await admin
      .from("pipelines")
      .select("id")
      .eq("account_id", channel.account_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    pipelineId = (pipeline?.id as string | undefined) ?? null;
  }

  if (!pipelineId) {
    const { data: created, error } = await admin
      .from("pipelines")
      .insert({
        account_id: channel.account_id,
        user_id: userId,
        name: "Instagram Leads",
      })
      .select("id")
      .single();

    if (error) throw error;
    pipelineId = created.id as string;
  }

  let stageId = configuredStageId;
  if (stageId) {
    const { data } = await admin
      .from("pipeline_stages")
      .select("id, pipeline:pipelines!inner(account_id)")
      .eq("id", stageId)
      .eq("pipeline.account_id", channel.account_id)
      .maybeSingle();
    stageId = (data?.id as string | undefined) ?? null;
  }

  if (!stageId) {
    const { data: instagramStage } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .ilike("name", "%Instagram%")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    stageId = (instagramStage?.id as string | undefined) ?? null;
  }

  if (!stageId) {
    const { data: firstStage } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    stageId = (firstStage?.id as string | undefined) ?? null;
  }

  if (!stageId) {
    const { data: createdStage, error } = await admin
      .from("pipeline_stages")
      .insert({
        pipeline_id: pipelineId,
        name: "Leads - Instagram",
        color: "#e1306c",
        position: 0,
      })
      .select("id")
      .single();

    if (error) throw error;
    stageId = createdStage.id as string;
  }

  return { pipelineId, stageId };
}

async function ensureLeadDeal(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  userId: string,
  session: InstagramLeadSession,
  contactId: string,
  conversationId: string,
): Promise<void> {
  const { data: existing, error: existingError } = await admin
    .from("deals")
    .select("id")
    .eq("account_id", channel.account_id)
    .eq("conversation_id", conversationId)
    .neq("status", "lost")
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return;

  const { pipelineId, stageId } = await resolveLeadPipelineStage(
    admin,
    channel,
    userId,
  );

  const { data: account } = await admin
    .from("accounts")
    .select("default_currency")
    .eq("id", channel.account_id)
    .maybeSingle();

  const username = session.ig_username ? `@${session.ig_username}` : "Instagram";
  const { error } = await admin.from("deals").insert({
    account_id: channel.account_id,
    user_id: userId,
    pipeline_id: pipelineId,
    stage_id: stageId,
    contact_id: contactId,
    conversation_id: conversationId,
    title: `Lead ${username} - ${KEYWORD}`,
    value: 0,
    currency: account?.default_currency ?? "USD",
    status: "open",
    notes: [
      `Origem: Instagram ${channel.display_identifier ?? ""}`.trim(),
      `Palavra-chave: ${KEYWORD}`,
      session.media_id ? `Media/Reels: ${session.media_id}` : null,
      session.ig_username ? `Usuario: @${session.ig_username}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (error) throw error;
}

async function insertConversationContext(
  admin: SupabaseAny,
  session: InstagramLeadSession,
  conversationId: string,
): Promise<void> {
  const origin = [
    session.ig_username ? `@${session.ig_username}` : "Usuario Instagram",
    `comentou "${KEYWORD}"`,
    session.media_product_type ? `em ${session.media_product_type}` : null,
    session.media_id ? `(${session.media_id})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "bot",
    content_type: "text",
    content_text: `Origem do lead: ${origin}. Fluxo iniciado por resposta privada do Instagram.`,
    message_id: `instagram-context:${session.id}`,
    status: "sent",
  });

  if (error && !isUniqueViolation(error)) throw error;
}

async function insertInboundMessage(
  admin: SupabaseAny,
  conversationId: string,
  message: InstagramMessageEvent,
): Promise<void> {
  if (message.messageId) {
    const { data: existing, error } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("message_id", message.messageId)
      .maybeSingle();

    if (error) throw error;
    if (existing) return;
  }

  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "customer",
    content_type: "text",
    content_text: message.text,
    message_id: message.messageId,
    status: "delivered",
    created_at: message.timestamp ?? new Date().toISOString(),
  });

  if (error) throw error;
}

async function qualifySession(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  session: InstagramLeadSession,
  message: InstagramMessageEvent,
  phone: string,
): Promise<void> {
  const userId = await resolveActorUserId(admin, channel);
  const contactOutcome = await findOrCreateContact(admin, {
    accountId: channel.account_id,
    userId,
    phone,
    name: session.ig_username ? `@${session.ig_username}` : "Instagram lead",
    preserveExistingName: true,
  });

  await ensureContactTagsByName(
    admin,
    channel.account_id,
    userId,
    contactOutcome.contact.id,
  );

  const conversation = await findOrCreateConversation(admin, {
    accountId: channel.account_id,
    userId,
    contactId: contactOutcome.contact.id,
    provider: "instagram",
    externalChannelId: channel.id,
  });

  await insertConversationContext(admin, session, conversation.id);
  await insertInboundMessage(admin, conversation.id, message);

  const result = await sendInstagramDirectMessage(
    channel,
    message.senderId,
    COPY.qualified,
  );

  await admin.from("messages").insert({
    conversation_id: conversation.id,
    sender_type: "bot",
    content_type: "text",
    content_text: COPY.qualified,
    message_id: result.messageId,
    status: "sent",
  });

  await admin
    .from("conversations")
    .update({
      last_message_text: COPY.qualified,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
      channel_provider: "instagram",
      external_channel_id: channel.id,
    })
    .eq("id", conversation.id);

  await ensureLeadDeal(
    admin,
    channel,
    userId,
    session,
    contactOutcome.contact.id,
    conversation.id,
  );

  await updateSession(admin, session.id, {
    state: "qualified",
    ig_scoped_user_id: message.senderId,
    last_inbound_message_id: message.messageId,
    contact_id: contactOutcome.contact.id,
    conversation_id: conversation.id,
    qualified_phone: phone,
    context: {
      ...asInstagramRecord(session.context),
      whatsapp_message_text: message.text,
    },
  });
}

async function processMessage(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  message: InstagramMessageEvent,
): Promise<"ignored" | "duplicate" | "prompted" | "qualified"> {
  if (message.isEcho || !message.text) return "ignored";

  const claimed = await claimMessageEvent(admin, channel, message);
  if (!claimed) return "duplicate";

  const session = await loadActiveSessionForSender(
    admin,
    channel,
    message.senderId,
  );

  if (!session) return "ignored";

  const phone = extractBrazilianWhatsapp(message.text);
  if (phone) {
    await qualifySession(admin, channel, session, message, phone);
    return "qualified";
  }

  if (session.state === "awaiting_opt_in") {
    await sendInstagramDirectMessage(channel, message.senderId, COPY.intent);
    await updateSession(admin, session.id, {
      state: "awaiting_intent",
      ig_scoped_user_id: message.senderId,
      last_inbound_message_id: message.messageId,
      last_prompt_at: new Date().toISOString(),
      context: {
        ...asInstagramRecord(session.context),
        opt_in_reply: message.text,
        intent_prompt_text: COPY.intent,
      },
    });
    return "prompted";
  }

  if (session.state === "awaiting_intent") {
    await sendInstagramDirectMessage(channel, message.senderId, COPY.whatsapp);
    await updateSession(admin, session.id, {
      state: "awaiting_whatsapp",
      ig_scoped_user_id: message.senderId,
      last_inbound_message_id: message.messageId,
      last_prompt_at: new Date().toISOString(),
      context: {
        ...asInstagramRecord(session.context),
        intent_reply: message.text,
        whatsapp_prompt_text: COPY.whatsapp,
      },
    });
    return "prompted";
  }

  const nextRetryCount = (session.retry_count ?? 0) + 1;
  await sendInstagramDirectMessage(channel, message.senderId, COPY.whatsappRetry);
  await updateSession(admin, session.id, {
    state: "awaiting_whatsapp",
    ig_scoped_user_id: message.senderId,
    last_inbound_message_id: message.messageId,
    retry_count: nextRetryCount,
    last_prompt_at: new Date().toISOString(),
    context: {
      ...asInstagramRecord(session.context),
      last_invalid_whatsapp_reply: message.text,
    },
  });

  return "prompted";
}

export async function ingestInstagramWebhookPayload(
  admin: SupabaseAny,
  channel: InstagramLeadChannel,
  payload: unknown,
): Promise<InstagramIngestResult> {
  if (channel.provider !== "instagram") {
    throw new Error("Channel is not an Instagram channel.");
  }

  const result: InstagramIngestResult = {
    ok: true,
    comments: 0,
    messages: 0,
    ignored: 0,
    duplicates: 0,
    qualified: 0,
  };

  for (const comment of extractInstagramCommentEvents(payload)) {
    const status = await processComment(admin, channel, comment);
    result.comments += 1;
    if (status === "ignored") result.ignored += 1;
    if (status === "duplicate") result.duplicates += 1;
  }

  for (const message of extractInstagramMessageEvents(payload)) {
    const status = await processMessage(admin, channel, message);
    result.messages += 1;
    if (status === "ignored") result.ignored += 1;
    if (status === "duplicate") result.duplicates += 1;
    if (status === "qualified") result.qualified += 1;
  }

  return result;
}
