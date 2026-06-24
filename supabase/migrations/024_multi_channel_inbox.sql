-- ============================================================
-- 024 — Multi-channel inbox: allow N WhatsApp numbers per account
--
-- Removes the one-number-per-account constraint and adds the
-- minimal columns needed to label channels and link conversations
-- back to the channel they arrived on.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add `label` to whatsapp_config
--    A human-readable name for the number, e.g. "Vendas BR"
--    or "Suporte". Nullable so existing rows don't need a
--    backfill and the form can default to the phone_number_id.
-- ------------------------------------------------------------
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS label TEXT;

-- ------------------------------------------------------------
-- 2. Drop the one-row-per-account UNIQUE constraint.
--    Post-017 this was whatsapp_config_account_id_key.
--    UNIQUE(phone_number_id) stays (migration 013) because the
--    webhook still routes by phone_number_id — two accounts must
--    not claim the same physical number.
-- ------------------------------------------------------------
ALTER TABLE whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_account_id_key;

-- ------------------------------------------------------------
-- 3. Add `whatsapp_config_id` to conversations
--    Links each conversation to the specific number (channel)
--    it arrived on. Nullable so existing rows are unaffected
--    and the backfill below fills what it can.
-- ------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS whatsapp_config_id UUID
    REFERENCES whatsapp_config(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_config
  ON conversations(whatsapp_config_id);

-- ------------------------------------------------------------
-- 4. Backfill: for accounts that still have exactly one config,
--    stamp that config's id on every conversation in the account.
--    Accounts with zero or multiple configs are left NULL —
--    the inbox will show those conversations in "Todos" only.
-- ------------------------------------------------------------
UPDATE conversations c
SET whatsapp_config_id = wc.id
FROM whatsapp_config wc
WHERE wc.account_id = c.account_id
  AND c.whatsapp_config_id IS NULL
  AND (
    SELECT count(*) FROM whatsapp_config w2
    WHERE w2.account_id = c.account_id
  ) = 1;

-- ------------------------------------------------------------
-- 5. RLS — conversations with whatsapp_config_id
--    Existing policies (017) already gate on account membership;
--    whatsapp_config_id is just a filter column, no extra policy
--    needed. The whatsapp_config RLS also stays unchanged.
-- ------------------------------------------------------------

-- Done. The app can now:
--   • store multiple whatsapp_config rows per account (each with
--     its own phone_number_id, access_token, verify_token, label).
--   • tag each conversation with the config it arrived on.
--   • filter the inbox by whatsapp_config_id for the channel
--     selector, or show all when no filter is active.
