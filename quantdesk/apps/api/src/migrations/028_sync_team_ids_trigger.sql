-- 028_sync_team_ids_trigger.sql
-- Keeps users.team_ids in sync with team_members table automatically.

CREATE OR REPLACE FUNCTION sync_user_team_ids()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- For INSERT/DELETE on team_members, determine affected user_id
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  UPDATE users
  SET team_ids = COALESCE((
    SELECT ARRAY_AGG(team_id)
    FROM team_members
    WHERE user_id = target_user_id
  ), '{}')
  WHERE id = target_user_id;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_team_ids ON team_members;
CREATE TRIGGER trg_sync_team_ids
  AFTER INSERT OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION sync_user_team_ids();
