-- ============================================================
-- 026 — Instagram comment lead capture
--
-- Stores the short-lived state machine used by Instagram private
-- replies ("comment keyword -> DM -> ask WhatsApp -> create lead") and
-- a lightweight idempotency log for Meta webhook deliveries.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS instagram_lead_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  external_channel_id UUID NOT NULL REFERENCES external_inbox_channels(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ig_user_id TEXT,
  ig_scoped_user_id TEXT,
  ig_username TEXT,
  comment_id TEXT NOT NULL,
  media_id TEXT,
  media_product_type TEXT,
  keyword TEXT NOT NULL DEFAULT 'INTEGRAR',
  state TEXT NOT NULL DEFAULT 'awaiting_opt_in' CHECK (
    state IN (
      'awaiting_opt_in',
      'awaiting_intent',
      'awaiting_whatsapp',
      'qualified',
      'handed_off',
      'expired',
      'reply_failed'
    )
  ),
  private_reply_message_id TEXT,
  last_inbound_message_id TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  qualified_phone TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  raw_comment JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_prompt_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_instagram_lead_sessions_comment
  ON instagram_lead_sessions(account_id, external_channel_id, comment_id);

CREATE INDEX IF NOT EXISTS idx_instagram_lead_sessions_scoped_user
  ON instagram_lead_sessions(account_id, external_channel_id, ig_scoped_user_id, state, expires_at);

CREATE INDEX IF NOT EXISTS idx_instagram_lead_sessions_user
  ON instagram_lead_sessions(account_id, external_channel_id, ig_user_id, state, expires_at);

CREATE INDEX IF NOT EXISTS idx_instagram_lead_sessions_conversation
  ON instagram_lead_sessions(conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE instagram_lead_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_lead_sessions_select ON instagram_lead_sessions;
DROP POLICY IF EXISTS instagram_lead_sessions_insert ON instagram_lead_sessions;
DROP POLICY IF EXISTS instagram_lead_sessions_update ON instagram_lead_sessions;
DROP POLICY IF EXISTS instagram_lead_sessions_delete ON instagram_lead_sessions;

CREATE POLICY instagram_lead_sessions_select
  ON instagram_lead_sessions
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY instagram_lead_sessions_insert
  ON instagram_lead_sessions
  FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY instagram_lead_sessions_update
  ON instagram_lead_sessions
  FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY instagram_lead_sessions_delete
  ON instagram_lead_sessions
  FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON instagram_lead_sessions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON instagram_lead_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS instagram_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  external_channel_id UUID NOT NULL REFERENCES external_inbox_channels(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_instagram_webhook_events_key
  ON instagram_webhook_events(account_id, external_channel_id, event_key);

CREATE INDEX IF NOT EXISTS idx_instagram_webhook_events_channel
  ON instagram_webhook_events(account_id, external_channel_id, created_at DESC);

ALTER TABLE instagram_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_webhook_events_select ON instagram_webhook_events;
DROP POLICY IF EXISTS instagram_webhook_events_delete ON instagram_webhook_events;

CREATE POLICY instagram_webhook_events_select
  ON instagram_webhook_events
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY instagram_webhook_events_delete
  ON instagram_webhook_events
  FOR DELETE
  USING (is_account_member(account_id, 'admin'));
