-- Migration 022: Admin-created chat links

CREATE TABLE IF NOT EXISTS admin_chat_links (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id),
  user_a_id    UUID NOT NULL REFERENCES users(id),
  user_b_id    UUID NOT NULL REFERENCES users(id),
  reason       TEXT NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_links_org ON admin_chat_links(org_id);

-- User invitations
CREATE TABLE IF NOT EXISTS user_invitations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by     UUID NOT NULL REFERENCES users(id),
  email          TEXT NOT NULL,
  first_name     TEXT,
  last_name      TEXT,
  intended_role  TEXT,
  intended_teams UUID[],
  token          TEXT UNIQUE NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  status         TEXT DEFAULT 'pending',
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_org   ON user_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
