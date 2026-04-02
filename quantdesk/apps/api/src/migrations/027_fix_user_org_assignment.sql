-- 027_fix_user_org_assignment.sql
-- Permanent fix: assign all orphaned users to the primary org,
-- create default teams, and sync users.team_ids.

BEGIN;

-- 1. Upsert the canonical default org (idempotent)
INSERT INTO organizations (name, slug, display_name, plan)
VALUES ('Default Org', 'default-org', 'Default Org', 'enterprise')
ON CONFLICT (slug) DO NOTHING;

-- 2. Pick the primary org: prefer any existing org that already has members,
--    fall back to the one we just upserted.
DO $$
DECLARE
  primary_org_id UUID;
BEGIN
  -- Prefer an org that already has at least one assigned user
  SELECT org_id INTO primary_org_id
  FROM users
  WHERE org_id IS NOT NULL
  GROUP BY org_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- If no org has users yet, use 'default-org'
  IF primary_org_id IS NULL THEN
    SELECT id INTO primary_org_id FROM organizations WHERE slug = 'default-org';
  END IF;

  -- 3. Assign all unassigned users to the primary org.
  --    Preserve existing super_admin/admin roles; everyone else becomes 'member'.
  UPDATE users
  SET org_id = primary_org_id
  WHERE org_id IS NULL;

  -- 4. Ensure the first user (by created_at) with admin/super_admin role is super_admin.
  --    If nobody has a privileged role, promote the oldest user.
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE org_id = primary_org_id AND org_role = 'super_admin'
  ) THEN
    UPDATE users
    SET org_role = 'super_admin'
    WHERE id = (
      SELECT id FROM users
      WHERE org_id = primary_org_id AND org_role IN ('admin', 'super_admin', 'member')
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;

  -- 5. Create default teams for the primary org (idempotent).
  INSERT INTO teams (org_id, name, team_type, color, created_by)
  SELECT
    primary_org_id,
    t.name,
    t.team_type,
    t.color,
    (SELECT id FROM users WHERE org_id = primary_org_id AND org_role = 'super_admin' LIMIT 1)
  FROM (VALUES
    ('Trading',    'trading_desk', '#ff6600'),
    ('Research',   'research',     '#00c8ff'),
    ('Risk',       'risk',         '#ff3d3d'),
    ('Operations', 'operations',   '#a8ff78')
  ) AS t(name, team_type, color)
  ON CONFLICT (org_id, name) DO NOTHING;

  -- 6. Add every active org member to the Trading team (default) if not already in any team.
  INSERT INTO team_members (team_id, user_id, team_role)
  SELECT
    (SELECT id FROM teams WHERE org_id = primary_org_id AND name = 'Trading'),
    u.id,
    'member'
  FROM users u
  WHERE u.org_id = primary_org_id
    AND u.is_active = true
    AND u.org_role NOT IN ('system')
    AND NOT EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.user_id = u.id
    )
  ON CONFLICT (team_id, user_id) DO NOTHING;

  -- 7. Sync users.team_ids array from team_members table (source of truth).
  UPDATE users u
  SET team_ids = COALESCE((
    SELECT ARRAY_AGG(tm.team_id)
    FROM team_members tm
    WHERE tm.user_id = u.id
  ), '{}')
  WHERE u.org_id = primary_org_id;

END $$;

COMMIT;
