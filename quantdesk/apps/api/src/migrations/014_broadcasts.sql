-- ─── Admin broadcasts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       UUID NOT NULL REFERENCES users(id),
  title            TEXT NOT NULL,
  body_template    TEXT NOT NULL,
  broadcast_type   TEXT NOT NULL DEFAULT 'announcement'
                   CHECK (broadcast_type IN ('announcement','alert','morning_note','risk_update','trade_idea','compliance','system')),
  priority         TEXT NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','critical')),
  audience_type    TEXT NOT NULL
                   CHECK (audience_type IN ('org_wide','team','role','individual','custom')),
  audience_config  JSONB NOT NULL DEFAULT '{}',
  schedule_type    TEXT NOT NULL DEFAULT 'immediate'
                   CHECK (schedule_type IN ('immediate','scheduled','recurring')),
  scheduled_at     TIMESTAMPTZ,
  recurrence_rule  JSONB,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_approval','approved','sending','sent','cancelled','failed')),
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  delivered_count  INTEGER NOT NULL DEFAULT 0,
  read_count       INTEGER NOT NULL DEFAULT 0,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_org_id  ON broadcasts(org_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status  ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);

-- ─── Per-recipient delivery record ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id      UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  recipient_id      UUID NOT NULL REFERENCES users(id),
  personalized_body TEXT NOT NULL,
  delivery_channel  TEXT NOT NULL DEFAULT 'ib_chat'
                    CHECK (delivery_channel IN ('ib_chat','email','push','all')),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','delivered','read','failed')),
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}',
  UNIQUE (broadcast_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_broadcast ON broadcast_deliveries(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient ON broadcast_deliveries(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_unread    ON broadcast_deliveries(recipient_id)
  WHERE status = 'delivered';

CREATE OR REPLACE TRIGGER set_broadcasts_updated_at
  BEFORE UPDATE ON broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
