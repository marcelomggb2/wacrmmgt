-- ============================================================
-- 027 — Mobile push tokens
--
-- Stores Expo push tokens per authenticated seller/device. The app
-- writes directly through Supabase RLS; server-side workers can later
-- read these tokens with the service role to fan out lead alerts.
-- ============================================================

CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown'
    CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  device_name TEXT,
  device_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_mobile_push_tokens_user_token
  ON mobile_push_tokens(user_id, expo_push_token);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_account
  ON mobile_push_tokens(account_id, enabled, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_user
  ON mobile_push_tokens(user_id, enabled);

ALTER TABLE mobile_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_push_tokens_select ON mobile_push_tokens;
DROP POLICY IF EXISTS mobile_push_tokens_insert ON mobile_push_tokens;
DROP POLICY IF EXISTS mobile_push_tokens_update ON mobile_push_tokens;
DROP POLICY IF EXISTS mobile_push_tokens_delete ON mobile_push_tokens;

CREATE POLICY mobile_push_tokens_select
  ON mobile_push_tokens
  FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    AND is_account_member(account_id)
  );

CREATE POLICY mobile_push_tokens_insert
  ON mobile_push_tokens
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND is_account_member(account_id, 'agent')
  );

CREATE POLICY mobile_push_tokens_update
  ON mobile_push_tokens
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    AND is_account_member(account_id, 'agent')
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND is_account_member(account_id, 'agent')
  );

CREATE POLICY mobile_push_tokens_delete
  ON mobile_push_tokens
  FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    AND is_account_member(account_id, 'agent')
  );

DROP TRIGGER IF EXISTS set_updated_at ON mobile_push_tokens;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON mobile_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
