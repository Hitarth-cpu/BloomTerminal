-- ─── Reusable broadcast templates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by            UUID NOT NULL REFERENCES users(id),
  name                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT,
  subject               TEXT,
  body_template         TEXT NOT NULL,
  default_audience_type TEXT NOT NULL DEFAULT 'org_wide',
  default_priority      TEXT NOT NULL DEFAULT 'normal',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  use_count             INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_templates_org ON broadcast_templates(org_id);

CREATE OR REPLACE TRIGGER set_broadcast_templates_updated_at
  BEFORE UPDATE ON broadcast_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
