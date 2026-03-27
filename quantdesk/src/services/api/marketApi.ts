import { api } from './apiClient';

export interface ApiPosition {
  id:           string;
  portfolio_id: string;
  security_id:  string;
  ticker:       string;
  name:         string;
  quantity:     number;
  avg_cost:     number | null;
  side:         string;
}

export interface ApiWatchlistItem {
  security_id:  string;
  ticker:       string;
  name:         string;
  asset_class:  string;
  sort_order:   number;
}

export interface ApiSecurity {
  id: string; ticker: string; exchange: string; name: string;
  asset_class: string; sector: string | null;
}

export interface ApiPortfolio {
  id:         string;
  name:       string;
  currency:   string;
  created_at: string;
}

export async function fetchPortfolios(): Promise<ApiPortfolio[]> {
  const { portfolios } = await api.get<{ portfolios: ApiPortfolio[] }>('/market/portfolios');
  return portfolios;
}

export async function fetchPositions(portfolioId: string): Promise<ApiPosition[]> {
  const { positions } = await api.get<{ positions: ApiPosition[] }>(`/market/portfolios/${portfolioId}/positions`);
  return positions;
}

export async function fetchWatchlist(): Promise<ApiWatchlistItem[]> {
  const { items } = await api.get<{ items: ApiWatchlistItem[] }>('/market/watchlist');
  return items;
}

export async function addToWatchlist(securityId: string): Promise<void> {
  await api.post('/market/watchlist', { securityId });
}

export async function removeFromWatchlist(securityId: string): Promise<void> {
  await api.delete(`/market/watchlist/${securityId}`);
}

export async function searchSecurities(q: string): Promise<ApiSecurity[]> {
  const { results } = await api.get<{ results: ApiSecurity[] }>(`/market/search?q=${encodeURIComponent(q)}`);
  return results;
}
