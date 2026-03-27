-- Migration 018: Admin security columns + admin sessions

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_secret          TEXT,
  ADD COLUMN IF NOT EXISTS mfa_enabled         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_admin_logins INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_locked_until  TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  last_active  TIMESTAMPTZ DEFAULT NOW(),
  is_revoked   BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user  ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(user_id, is_revoked, expires_at);
