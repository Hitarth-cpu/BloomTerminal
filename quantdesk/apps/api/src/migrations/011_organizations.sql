-- ─── Organizations (multi-tenant boundary) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  slug         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  logo_url     TEXT,
  domain       TEXT,
  plan         TEXT NOT NULL DEFAULT 'standard'
               CHECK (plan IN ('standard','professional','enterprise')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  settings     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orgs_slug   ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_orgs_domain ON organizations(domain);

-- Link users to their organization
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS org_id         UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS org_role       TEXT NOT NULL DEFAULT 'member'
                                          CHECK (org_role IN ('member','team_lead','admin','super_admin','system')),
  ADD COLUMN IF NOT EXISTS team_ids       UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_org_visible BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);

CREATE OR REPLACE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed a default organization for dev
INSERT INTO organizations (name, slug, display_name, domain, plan)
VALUES ('QuantDesk Internal', 'quantdesk-internal', 'QuantDesk Internal', 'quantdesk.io', 'enterprise')
ON CONFLICT (slug) DO NOTHING;
