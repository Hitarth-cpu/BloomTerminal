-- ─── User personalization profiles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_personalization (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_name     TEXT,
  timezone           TEXT NOT NULL DEFAULT 'America/New_York',
  preferred_assets   TEXT[] NOT NULL DEFAULT '{}',
  coverage_tickers   TEXT[] NOT NULL DEFAULT '{}',
  bio                TEXT,
  phone_ext          TEXT,
  desk_location      TEXT,
  notification_prefs JSONB NOT NULL DEFAULT '{
    "broadcasts": true,
    "contactRequests": true,
    "morningNote": true,
    "riskAlerts": true,
    "quietHoursStart": "18:00",
    "quietHoursEnd": "08:00"
  }',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER set_user_personalization_updated_at
  BEFORE UPDATE ON user_personalization
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
