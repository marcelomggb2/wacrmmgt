import type {
  Conversation,
  ExternalInboxChannel,
  InboxChannel,
  InboxChannelProvider,
  WhatsAppConfig,
} from "@/types";

export const EXTERNAL_INBOX_PROVIDERS = ["uazapi", "instagram"] as const;
export const SENDABLE_INBOX_PROVIDERS = [
  "whatsapp_official",
  "uazapi",
] as const;

export function isExternalInboxProvider(value: string): value is ExternalInboxChannel["provider"] {
  return (EXTERNAL_INBOX_PROVIDERS as readonly string[]).includes(value);
}

export function isInboxChannelProvider(value: string): value is InboxChannelProvider {
  return value === "whatsapp_official" || isExternalInboxProvider(value);
}

export function isSendableInboxProvider(
  provider: InboxChannelProvider,
): boolean {
  return (SENDABLE_INBOX_PROVIDERS as readonly string[]).includes(provider);
}

export function resolveConversationProvider(
  conversation: Pick<
    Conversation,
    "channel_provider" | "external_channel_id" | "whatsapp_config_id"
  >,
): InboxChannelProvider {
  if (
    conversation.channel_provider &&
    isInboxChannelProvider(conversation.channel_provider)
  ) {
    return conversation.channel_provider;
  }

  if (conversation.external_channel_id) {
    return "uazapi";
  }

  return "whatsapp_official";
}

export function mapOfficialChannel(config: WhatsAppConfig): InboxChannel {
  return {
    id: config.id,
    provider: "whatsapp_official",
    label: config.label || config.phone_number_id,
    status: config.status,
    phone_number_id: config.phone_number_id,
    official_config_id: config.id,
    external_channel_id: null,
    selectable: config.status === "connected",
    last_error: config.last_registration_error ?? null,
  };
}

export function mapExternalChannel(channel: ExternalInboxChannel): InboxChannel {
  const fallbackLabel =
    channel.label ||
    channel.display_identifier ||
    channel.external_key ||
    channel.provider;

  return {
    id: channel.id,
    provider: channel.provider,
    label: fallbackLabel,
    status: channel.status,
    display_identifier: channel.display_identifier ?? null,
    official_config_id: null,
    external_channel_id: channel.id,
    selectable:
      channel.provider === "uazapi" && channel.status === "connected",
    last_error: channel.last_error ?? null,
  };
}
