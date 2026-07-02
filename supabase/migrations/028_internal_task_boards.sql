-- ============================================================
-- 028 — Internal task boards
--
-- Replaces the static board embed with account-scoped boards
-- owned by WACRM. Cards keep operational fields relational and use
-- metadata JSONB for flexible secondary attributes.
-- ============================================================

CREATE TABLE IF NOT EXISTS task_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  board_type TEXT NOT NULL DEFAULT 'secondary'
    CHECK (board_type IN ('secondary')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_boards_account
  ON task_boards(account_id, created_at);

CREATE INDEX IF NOT EXISTS idx_task_boards_settings_gin
  ON task_boards USING GIN (settings jsonb_path_ops);

CREATE TABLE IF NOT EXISTS task_board_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#0f766e',
  wip_limit INTEGER,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_board_columns_board
  ON task_board_columns(board_id, position);

CREATE INDEX IF NOT EXISTS idx_task_board_columns_account
  ON task_board_columns(account_id, board_id);

CREATE INDEX IF NOT EXISTS idx_task_board_columns_settings_gin
  ON task_board_columns USING GIN (settings jsonb_path_ops);

CREATE TABLE IF NOT EXISTS task_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES task_board_columns(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_cards_column
  ON task_cards(column_id, archived_at, position);

CREATE INDEX IF NOT EXISTS idx_task_cards_board
  ON task_cards(board_id, archived_at, position);

CREATE INDEX IF NOT EXISTS idx_task_cards_account_due
  ON task_cards(account_id, archived_at, due_date);

CREATE INDEX IF NOT EXISTS idx_task_cards_assigned
  ON task_cards(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_cards_metadata_gin
  ON task_cards USING GIN (metadata jsonb_path_ops);

ALTER TABLE task_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_boards_select ON task_boards;
DROP POLICY IF EXISTS task_boards_insert ON task_boards;
DROP POLICY IF EXISTS task_boards_update ON task_boards;
DROP POLICY IF EXISTS task_boards_delete ON task_boards;

CREATE POLICY task_boards_select
  ON task_boards
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY task_boards_insert
  ON task_boards
  FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY task_boards_update
  ON task_boards
  FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY task_boards_delete
  ON task_boards
  FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS task_board_columns_select ON task_board_columns;
DROP POLICY IF EXISTS task_board_columns_insert ON task_board_columns;
DROP POLICY IF EXISTS task_board_columns_update ON task_board_columns;
DROP POLICY IF EXISTS task_board_columns_delete ON task_board_columns;

CREATE POLICY task_board_columns_select
  ON task_board_columns
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY task_board_columns_insert
  ON task_board_columns
  FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY task_board_columns_update
  ON task_board_columns
  FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY task_board_columns_delete
  ON task_board_columns
  FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS task_cards_select ON task_cards;
DROP POLICY IF EXISTS task_cards_insert ON task_cards;
DROP POLICY IF EXISTS task_cards_update ON task_cards;
DROP POLICY IF EXISTS task_cards_delete ON task_cards;

CREATE POLICY task_cards_select
  ON task_cards
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY task_cards_insert
  ON task_cards
  FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY task_cards_update
  ON task_cards
  FOR UPDATE
  USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY task_cards_delete
  ON task_cards
  FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON task_boards;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON task_boards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON task_board_columns;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON task_board_columns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON task_cards;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON task_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
