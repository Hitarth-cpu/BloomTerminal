CREATE TABLE IF NOT EXISTS securities (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker      TEXT    NOT NULL,
  exchange    TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  asset_class TEXT    NOT NULL,
  currency    TEXT    DEFAULT 'USD',
  isin        TEXT,
  sedol       TEXT,
  figi        TEXT,
  sector      TEXT,
  industry    TEXT,
  country     TEXT,
  is_active   BOOLEAN DEFAULT true,
  metadata    JSONB   DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, exchange)
);

CREATE INDEX IF NOT EXISTS idx_securities_ticker   ON securities(ticker);
CREATE INDEX IF NOT EXISTS idx_securities_class    ON securities(asset_class);
CREATE INDEX IF NOT EXISTS idx_securities_meta     ON securities USING gin(metadata);

CREATE TABLE IF NOT EXISTS watchlists (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID    NOT NULL REFERENCES watchlists(id)  ON DELETE CASCADE,
  security_id  UUID    NOT NULL REFERENCES securities(id),
  sort_order   INTEGER DEFAULT 0,
  added_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, security_id)
);
