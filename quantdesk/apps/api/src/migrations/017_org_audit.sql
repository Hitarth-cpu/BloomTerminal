-- ─── Org / Contact / Broadcast audit actions ─────────────────────────────────
-- No schema change needed — audit_log.action is TEXT.
-- This migration documents the action strings used by the new features
-- and adds a trigram index on display_name + email for fuzzy search.

-- Enable pg_trgm if not already enabled (from 001_extensions.sql)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for fast fuzzy user search (Section 3 — searchOrgUsers)
CREATE INDEX IF NOT EXISTS idx_users_trgm_name
  ON users USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_trgm_email
  ON users USING gin (email gin_trgm_ops);

-- ─── Documented action strings for audit_log ─────────────────────────────────
-- Contact actions:
--   CONTACT_ADD | CONTACT_REMOVE | CONTACT_BLOCK
--   CONTACT_GROUP_CREATE | CONTACT_REQUEST_SEND
--   CONTACT_REQUEST_ACCEPT | CONTACT_REQUEST_DECLINE
--
-- Broadcast actions:
--   BROADCAST_CREATE | BROADCAST_EDIT | BROADCAST_APPROVE
--   BROADCAST_SEND | BROADCAST_CANCEL | BROADCAST_SCHEDULE
--
-- Organization actions:
--   ORG_USER_INVITE | ORG_USER_REMOVE | ORG_ROLE_CHANGE
--   ORG_TEAM_CREATE | ORG_TEAM_DELETE | ORG_SETTINGS_CHANGE
--   ORG_CREATED | ORG_BOT_CREATED
--
-- Onboarding actions:
--   USER_ONBOARDED | USER_AUTO_JOINED_ORG | USER_CREATED_ORG
