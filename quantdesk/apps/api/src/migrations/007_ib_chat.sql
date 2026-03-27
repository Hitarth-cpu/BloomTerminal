-- Postgres stores only structural metadata for chat.
-- Encrypted message payloads live in MongoDB.

CREATE TABLE IF NOT EXISTS chat_rooms (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT,
  room_type  TEXT    NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_by UUID    REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
  room_id      UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

-- ECDH public keys for E2E key exchange
CREATE TABLE IF NOT EXISTS ib_public_keys (
  user_id     UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key  TEXT    NOT NULL,
  key_version INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_ib_public_keys_updated_at ON ib_public_keys;
CREATE TRIGGER trg_ib_public_keys_updated_at
  BEFORE UPDATE ON ib_public_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
