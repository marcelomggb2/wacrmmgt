export type AccountRole = "owner" | "admin" | "agent" | "viewer";
export type ConversationStatus = "open" | "pending" | "closed";
export type SenderType = "customer" | "agent" | "bot";
export type InboxChannelProvider = "whatsapp_official" | "uazapi" | "instagram";
export type ExternalInboxProvider = "uazapi" | "instagram";

export interface AccountSummary {
  id: string;
  name: string;
  default_currency: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  account_id: string;
  account_role: AccountRole;
  account?: AccountSummary | AccountSummary[] | null;
}

export interface Contact {
  id: string;
  account_id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  company: string | null;
  avatar_url: string | null;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
}

export interface Deal {
  id: string;
  account_id: string;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  title: string;
  value: number;
  currency: string | null;
  notes: string | null;
  expected_close_date: string | null;
  status: "open" | "won" | "lost";
  created_at: string;
  updated_at: string;
  contact?: Contact | null;
  stage?: PipelineStage | null;
}

export interface Conversation {
  id: string;
  account_id: string;
  contact_id: string;
  status: ConversationStatus;
  assigned_agent_id: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  channel_provider: InboxChannelProvider | null;
  external_channel_id: string | null;
  whatsapp_config_id: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content_type: string;
  content_text: string | null;
  media_url: string | null;
  status: string | null;
  created_at: string;
}

export interface ExternalInboxChannel {
  id: string;
  account_id: string;
  provider: ExternalInboxProvider;
  label: string | null;
  status: "connected" | "disconnected" | "setup_pending" | "error";
  display_identifier: string | null;
  connected_at: string | null;
  last_error: string | null;
}
