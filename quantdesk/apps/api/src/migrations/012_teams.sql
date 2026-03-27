-- ─── Teams within an organization ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  team_type   TEXT NOT NULL DEFAULT 'custom'
              CHECK (team_type IN ('trading_desk','research','risk','sales','operations','custom')),
  color       TEXT NOT NULL DEFAULT '#ff6600',
  created_by  UUID REFERENCES users(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id   UUID NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  team_role TEXT NOT NULL DEFAULT 'member' CHECK (team_role IN ('member','lead')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_org_id       ON teams(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user  ON team_members(user_id);

CREATE OR REPLACE TRIGGER set_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
