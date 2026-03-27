-- ─── Contact groups (folders) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#ff6600',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contact_groups_owner ON contact_groups(owner_id);

-- ─── Personal contact book entries ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname           TEXT,
  notes              TEXT,
  group_id           UUID REFERENCES contact_groups(id) ON DELETE SET NULL,
  is_favorite        BOOLEAN NOT NULL DEFAULT false,
  is_blocked         BOOLEAN NOT NULL DEFAULT false,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  last_interacted_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, contact_user_id),
  CHECK (owner_id <> contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_owner   ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact ON contacts(contact_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_group   ON contacts(group_id);
CREATE INDEX IF NOT EXISTS idx_contacts_fav     ON contacts(owner_id, is_favorite) WHERE is_favorite = true;

-- ─── Contact requests (privacy-gated) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id),
  target_id    UUID NOT NULL REFERENCES users(id),
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','blocked')),
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_requests_target ON contact_requests(target_id, status);

CREATE OR REPLACE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
