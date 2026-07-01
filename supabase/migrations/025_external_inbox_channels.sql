-- ============================================================
-- 025 — External inbox channels (UAZAPI + Instagram prep)
--
-- Adds a dedicated table for non-official inbox providers and
-- extends conversations so those channels never interfere with
-- the existing Meta WhatsApp configuration rows.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS external_inbox_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('uazapi', 'instagram')),
  label TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (
    status IN ('connected', 'disconnected', 'setup_pending', 'error')
  ),
  base_url TEXT,
  external_key TEXT,
  display_identifier TEXT,
  token_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_inbox_channels_account
  ON external_inbox_channels(account_id, provider, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_external_inbox_channels_key
  ON external_inbox_channels(account_id, provider, external_key)
  WHERE external_key IS NOT NULL;

ALTER TABLE external_inbox_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS external_inbox_channels_select ON external_inbox_channels;
DROP POLICY IF EXISTS external_inbox_channels_insert ON external_inbox_channels;
DROP POLICY IF EXISTS external_inbox_channels_update ON external_inbox_channels;
DROP POLICY IF EXISTS external_inbox_channels_delete ON external_inbox_channels;

CREATE POLICY external_inbox_channels_select
  ON external_inbox_channels
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY external_inbox_channels_insert
  ON external_inbox_channels
  FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY external_inbox_channels_update
  ON external_inbox_channels
  FOR UPDATE
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY external_inbox_channels_delete
  ON external_inbox_channels
  FOR DELETE
  USING (is_account_member(account_id, 'admin'));

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel_provider TEXT
    NOT NULL DEFAULT 'whatsapp_official'
    CHECK (channel_provider IN ('whatsapp_official', 'uazapi', 'instagram'));

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS external_channel_id UUID
    REFERENCES external_inbox_channels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_channel_provider
  ON conversations(channel_provider);

CREATE INDEX IF NOT EXISTS idx_conversations_external_channel
  ON conversations(external_channel_id);

UPDATE conversations
SET channel_provider = CASE
  WHEN external_channel_id IS NOT NULL THEN channel_provider
  ELSE 'whatsapp_official'
END
WHERE channel_provider IS DISTINCT FROM CASE
  WHEN external_channel_id IS NOT NULL THEN channel_provider
  ELSE 'whatsapp_official'
END;
