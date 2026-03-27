CREATE TABLE IF NOT EXISTS orders (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID         NOT NULL REFERENCES users(id),
  portfolio_id   UUID         REFERENCES portfolios(id),
  security_id    UUID         NOT NULL REFERENCES securities(id),
  side           TEXT         NOT NULL,
  order_type     TEXT         NOT NULL,
  quantity       NUMERIC(20,6) NOT NULL,
  limit_price    NUMERIC(20,6),
  stop_price     NUMERIC(20,6),
  filled_qty     NUMERIC(20,6) DEFAULT 0,
  avg_fill_price NUMERIC(20,6),
  status         TEXT         NOT NULL DEFAULT 'Pending',
  tif            TEXT         DEFAULT 'DAY',
  algo_strategy  TEXT,
  notes          TEXT,
  submitted_at   TIMESTAMPTZ  DEFAULT NOW(),
  filled_at      TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id     ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_security_id ON orders(security_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_submitted   ON orders(submitted_at DESC);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS order_fills (
  id        UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id  UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quantity  NUMERIC(20,6) NOT NULL,
  price     NUMERIC(20,6) NOT NULL,
  venue     TEXT,
  filled_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_fills_order ON order_fills(order_id);
