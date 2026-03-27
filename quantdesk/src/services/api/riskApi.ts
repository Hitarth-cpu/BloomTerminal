import { api } from './apiClient';

export interface ApiRiskSnapshot {
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
}

export async function fetchLatestSnapshot(portfolioId: string): Promise<ApiRiskSnapshot | null> {
  try {
    const { snapshot } = await api.get<{ snapshot: ApiRiskSnapshot }>(`/risk/portfolios/${portfolioId}/snapshot`);
    return snapshot;
  } catch {
    return null;
  }
}

export async function fetchSnapshotHistory(portfolioId: string, days = 30): Promise<ApiRiskSnapshot[]> {
  try {
    const { history } = await api.get<{ history: ApiRiskSnapshot[] }>(`/risk/portfolios/${portfolioId}/history?days=${days}`);
    return history;
  } catch {
    return [];
  }
}
