-- Migration 021: Daily performance snapshots per user

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id         UUID NOT NULL REFERENCES organizations(id),
  snapshot_date  DATE NOT NULL,
  daily_pnl      NUMERIC(20,6) DEFAULT 0,
  cumulative_pnl NUMERIC(20,6) DEFAULT 0,
  trades_count   INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  volume_traded  NUMERIC(20,6) DEFAULT 0,
  open_positions INTEGER DEFAULT 0,
  sharpe_ratio   NUMERIC(10,4),
  max_drawdown   NUMERIC(10,4),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user ON performance_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_org  ON performance_snapshots(org_id, snapshot_date DESC);
