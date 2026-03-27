-- Migration 023: Add 'system' to org_role check constraint (for bot/broadcast users)

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_org_role_check
  CHECK (org_role IN ('member','team_lead','admin','super_admin','system'));
