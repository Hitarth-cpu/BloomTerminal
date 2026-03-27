import { query } from '../../db/postgres';

export interface RiskSnapshot {
  id:             string;
  portfolio_id:   string;
  snapshot_date:  string;
  var_95_1d:      number | null;
  var_99_1d:      number | null;
  cvar_95:        number | null;
  sharpe_ratio:   number | null;
  sortino_ratio:  number | null;
  max_drawdown:   number | null;
  beta_to_spx:    number | null;
  gross_exposure: number | null;
  net_exposure:   number | null;
  metadata:       Record<string, unknown>;
  created_at:     Date;
}

export interface StressTestResult {
  id:               string;
  portfolio_id:     string;
  scenario_name:    string;
  scenario_params:  Record<string, unknown>;
  pnl_impact:       number | null;
  pnl_pct_impact:   number | null;
  top_contributors: { security: string; contribution: number }[] | null;
  run_at:           Date;
}

export async function saveSnapshot(
  portfolioId: string,
  data: Omit<RiskSnapshot, 'id' | 'portfolio_id' | 'created_at'>,
): Promise<RiskSnapshot> {
  const rows = await query<RiskSnapshot>(`
    INSERT INTO risk_snapshots
      (portfolio_id, snapshot_date, var_95_1d, var_99_1d, cvar_95,
       sharpe_ratio, sortino_ratio, max_drawdown, beta_to_spx,
       gross_exposure, net_exposure, metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE SET
      var_95_1d      = EXCLUDED.var_95_1d,
      var_99_1d      = EXCLUDED.var_99_1d,
      cvar_95        = EXCLUDED.cvar_95,
      sharpe_ratio   = EXCLUDED.sharpe_ratio,
      sortino_ratio  = EXCLUDED.sortino_ratio,
      max_drawdown   = EXCLUDED.max_drawdown,
      beta_to_spx    = EXCLUDED.beta_to_spx,
      gross_exposure = EXCLUDED.gross_exposure,
      net_exposure   = EXCLUDED.net_exposure,
      metadata       = EXCLUDED.metadata
    RETURNING *
  `, [
    portfolioId, data.snapshot_date,
    data.var_95_1d, data.var_99_1d, data.cvar_95,
    data.sharpe_ratio, data.sortino_ratio, data.max_drawdown, data.beta_to_spx,
    data.gross_exposure, data.net_exposure, JSON.stringify(data.metadata ?? {}),
  ]);
  return rows[0];
}

export async function getLatestSnapshot(portfolioId: string): Promise<RiskSnapshot | null> {
  const rows = await query<RiskSnapshot>(`
    SELECT * FROM risk_snapshots
    WHERE portfolio_id = $1
    ORDER BY snapshot_date DESC
    LIMIT 1
  `, [portfolioId]);
  return rows[0] ?? null;
}

export async function getSnapshotHistory(
  portfolioId: string,
  days = 30,
): Promise<RiskSnapshot[]> {
  return query<RiskSnapshot>(`
    SELECT * FROM risk_snapshots
    WHERE portfolio_id = $1
      AND snapshot_date >= CURRENT_DATE - INTERVAL '${days} days'
    ORDER BY snapshot_date ASC
  `, [portfolioId]);
}

export async function saveStressTest(
  portfolioId: string,
  scenarioName: string,
  params: Record<string, unknown>,
  result: { pnlImpact: number; pnlPctImpact: number; topContributors: { security: string; contribution: number }[] },
): Promise<StressTestResult> {
  const rows = await query<StressTestResult>(`
    INSERT INTO stress_test_results
      (portfolio_id, scenario_name, scenario_params, pnl_impact, pnl_pct_impact, top_contributors)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `, [
    portfolioId, scenarioName, JSON.stringify(params),
    result.pnlImpact, result.pnlPctImpact, JSON.stringify(result.topContributors),
  ]);
  return rows[0];
}

export async function getStressTests(portfolioId: string, limit = 20): Promise<StressTestResult[]> {
  return query<StressTestResult>(`
    SELECT * FROM stress_test_results
    WHERE portfolio_id = $1
    ORDER BY run_at DESC
    LIMIT $2
  `, [portfolioId, limit]);
}
