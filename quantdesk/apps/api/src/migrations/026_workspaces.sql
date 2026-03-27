-- Migration 026: Document comparison workspaces

CREATE TABLE IF NOT EXISTS workspaces (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  document_ids UUID[] DEFAULT '{}',
  table_data   JSONB DEFAULT '{}',
  prompts      TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id, updated_at DESC);

CREATE OR REPLACE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
