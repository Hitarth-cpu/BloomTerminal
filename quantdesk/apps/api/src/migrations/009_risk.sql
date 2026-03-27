CREATE TABLE IF NOT EXISTS risk_snapshots (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id   UUID         NOT NULL REFERENCES portfolios(id),
  snapshot_date  DATE         NOT NULL,
  var_95_1d      NUMERIC(20,6),
  var_99_1d      NUMERIC(20,6),
  cvar_95        NUMERIC(20,6),
  sharpe_ratio   NUMERIC(10,4),
  sortino_ratio  NUMERIC(10,4),
  max_drawdown   NUMERIC(10,4),
  beta_to_spx    NUMERIC(10,4),
  gross_exposure NUMERIC(20,6),
  net_exposure   NUMERIC(20,6),
  metadata       JSONB        DEFAULT '{}',
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_risk_portfolio ON risk_snapshots(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_risk_date      ON risk_snapshots(snapshot_date DESC);

CREATE TABLE IF NOT EXISTS stress_test_results (
  id               UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id     UUID  NOT NULL REFERENCES portfolios(id),
  scenario_name    TEXT  NOT NULL,
  scenario_params  JSONB NOT NULL,
  pnl_impact       NUMERIC(20,6),
  pnl_pct_impact   NUMERIC(10,4),
  top_contributors JSONB,
  run_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stress_portfolio ON stress_test_results(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_stress_run_at    ON stress_test_results(run_at DESC);
