CREATE TABLE IF NOT EXISTS portfolios (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT,
  currency    TEXT    DEFAULT 'USD',
  is_paper    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_portfolios_updated_at ON portfolios;
CREATE TRIGGER trg_portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS positions (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID         NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  security_id  UUID         NOT NULL REFERENCES securities(id),
  quantity     NUMERIC(20,6) NOT NULL DEFAULT 0,
  avg_cost     NUMERIC(20,6),
  side         TEXT         NOT NULL DEFAULT 'Long',
  opened_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(portfolio_id, security_id, side)
);

CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_positions_security  ON positions(security_id);

DROP TRIGGER IF EXISTS trg_positions_updated_at ON positions;
CREATE TRIGGER trg_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
