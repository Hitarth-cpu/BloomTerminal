import { query, transaction } from '../../db/postgres';

export interface Security {
  id:          string;
  ticker:      string;
  exchange:    string;
  name:        string;
  asset_class: string;
  currency:    string;
  isin:        string | null;
  sector:      string | null;
  industry:    string | null;
  country:     string | null;
  is_active:   boolean;
  metadata:    Record<string, unknown>;
  created_at:  Date;
}

export async function upsertSecurity(data: Omit<Security, 'id' | 'created_at'>): Promise<Security> {
  const rows = await query<Security>(`
    INSERT INTO securities
      (ticker, exchange, name, asset_class, currency, isin, sector, industry, country, is_active, metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (ticker, exchange) DO UPDATE SET
      name        = EXCLUDED.name,
      sector      = EXCLUDED.sector,
      industry    = EXCLUDED.industry,
      is_active   = EXCLUDED.is_active,
      metadata    = EXCLUDED.metadata
    RETURNING *
  `, [data.ticker, data.exchange, data.name, data.asset_class, data.currency,
      data.isin ?? null, data.sector ?? null, data.industry ?? null,
      data.country ?? null, data.is_active, JSON.stringify(data.metadata ?? {})]);
  return rows[0];
}

export async function getSecurity(ticker: string, exchange?: string): Promise<Security | null> {
  const rows = exchange
    ? await query<Security>('SELECT * FROM securities WHERE ticker=$1 AND exchange=$2 AND is_active=true', [ticker, exchange])
    : await query<Security>('SELECT * FROM securities WHERE ticker=$1 AND is_active=true LIMIT 1', [ticker]);
  return rows[0] ?? null;
}

export async function searchSecurities(q: string, limit = 10): Promise<Security[]> {
  return query<Security>(`
    SELECT * FROM securities
    WHERE is_active = true
      AND (ticker ILIKE $1 OR name ILIKE $1)
    ORDER BY ticker
    LIMIT $2
  `, [`%${q}%`, limit]);
}

// ─── Watchlists ───────────────────────────────────────────────────────────────

export interface WatchlistItem {
  security_id:  string;
  ticker:       string;
  name:         string;
  asset_class:  string;
  sort_order:   number;
  added_at:     Date;
}

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  return query<WatchlistItem>(`
    SELECT s.id AS security_id, s.ticker, s.name, s.asset_class,
           wi.sort_order, wi.added_at
    FROM watchlists w
    JOIN watchlist_items wi ON wi.watchlist_id = w.id
    JOIN securities      s  ON s.id = wi.security_id
    WHERE w.user_id = $1 AND w.is_default = true
    ORDER BY wi.sort_order, wi.added_at
  `, [userId]);
}

export async function ensureDefaultWatchlist(userId: string): Promise<string> {
  const rows = await query<{ id: string }>(
    'SELECT id FROM watchlists WHERE user_id=$1 AND is_default=true', [userId]);
  if (rows[0]) return rows[0].id;

  const created = await query<{ id: string }>(
    'INSERT INTO watchlists(user_id, name, is_default) VALUES($1,$2,true) RETURNING id',
    [userId, 'My Watchlist']);
  return created[0].id;
}

export async function addToWatchlist(userId: string, securityId: string): Promise<void> {
  const watchlistId = await ensureDefaultWatchlist(userId);
  await query(`
    INSERT INTO watchlist_items(watchlist_id, security_id)
    VALUES ($1, $2) ON CONFLICT DO NOTHING
  `, [watchlistId, securityId]);
}

export async function removeFromWatchlist(userId: string, securityId: string): Promise<void> {
  await query(`
    DELETE FROM watchlist_items
    WHERE security_id = $1
      AND watchlist_id IN (SELECT id FROM watchlists WHERE user_id = $2)
  `, [securityId, userId]);
}

// ─── Portfolios & Positions ───────────────────────────────────────────────────

export interface Position {
  id:           string;
  portfolio_id: string;
  security_id:  string;
  ticker:       string;
  name:         string;
  quantity:     number;
  avg_cost:     number | null;
  side:         string;
  opened_at:    Date;
  updated_at:   Date;
}

export async function getPositions(portfolioId: string): Promise<Position[]> {
  return query<Position>(`
    SELECT p.*, s.ticker, s.name
    FROM positions p
    JOIN securities s ON s.id = p.security_id
    WHERE p.portfolio_id = $1 AND p.quantity != 0
    ORDER BY s.ticker
  `, [portfolioId]);
}

export { transaction };
