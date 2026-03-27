-- Migration 020: Daily session summaries

CREATE TABLE IF NOT EXISTS session_summaries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_date     DATE NOT NULL,
  total_pnl        NUMERIC(20,6),
  total_volume     NUMERIC(20,6),
  active_traders   INTEGER,
  active_analysts  INTEGER,
  total_trades     INTEGER,
  winning_trades   INTEGER,
  spx_return_pct   NUMERIC(10,4),
  ai_analysis_id   UUID REFERENCES ai_analyses(id),
  status           TEXT DEFAULT 'pending',
  generated_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_summaries_org_date ON session_summaries(org_id, session_date DESC);
