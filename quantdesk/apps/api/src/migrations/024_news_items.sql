-- Migration 024: News items table for real-time news pipeline

CREATE TABLE IF NOT EXISTS news_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id  TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  summary      TEXT,
  url          TEXT NOT NULL,
  source       TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  tickers      TEXT[] DEFAULT '{}',
  categories   TEXT[] DEFAULT '{}',
  sentiment    TEXT CHECK (sentiment IN ('bullish','bearish','neutral')),
  ai_summary   TEXT,
  is_breaking  BOOLEAN DEFAULT false,
  full_text    TEXT,
  image_url    TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published  ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_tickers    ON news_items USING gin(tickers);
CREATE INDEX IF NOT EXISTS idx_news_categories ON news_items USING gin(categories);
CREATE INDEX IF NOT EXISTS idx_news_source     ON news_items(source);
CREATE INDEX IF NOT EXISTS idx_news_sentiment  ON news_items(sentiment);
CREATE INDEX IF NOT EXISTS idx_news_breaking   ON news_items(is_breaking, published_at DESC);
