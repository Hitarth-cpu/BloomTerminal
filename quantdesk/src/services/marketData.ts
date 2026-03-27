/**
 * Market Data Service — Multi-source aggregation
 * Sources: Yahoo Finance (via proxy), CoinGecko (public), Finnhub (existing)
 * Pattern: worldmonitor's seed-then-serve approach adapted for client-side
 */

// ─── Types ──────────────────────────────────────────────────────────────────────
export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  marketCap?: number;
  updatedAt: number;
  source: 'yahoo' | 'finnhub' | 'coingecko' | 'mock';
}

export interface CryptoQuote {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePct24h: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  rank: number;
  sparkline?: number[];
  updatedAt: number;
}

export interface CommodityQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  unit: string;
  updatedAt: number;
}

export interface FearGreedData {
  value: number;
  label: string;
  previousValue: number;
  previousLabel: string;
  timestamp: string;
}

export interface SectorPerformance {
  symbol: string;
  name: string;
  changePct: number;
  volume: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────────
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export const MAJOR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B',
  'JPM', 'V', 'MA', 'UNH', 'HD', 'PG', 'JNJ', 'BAC', 'XOM', 'WMT',
  'AVGO', 'LLY', 'COST', 'NFLX', 'ORCL', 'NVO', 'TSM',
];

export const INDEX_SYMBOLS = ['^DJI', '^GSPC', '^IXIC', '^RUT'];

export const SECTOR_ETFS = [
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLV', name: 'Healthcare' },
  { symbol: 'XLY', name: 'Consumer Disc.' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLC', name: 'Communication' },
  { symbol: 'SMH', name: 'Semiconductors' },
];

export const COMMODITY_MAP: Record<string, { name: string; unit: string }> = {
  'CL=F': { name: 'Crude Oil (WTI)', unit: '$/bbl' },
  'BZ=F': { name: 'Brent Crude', unit: '$/bbl' },
  'GC=F': { name: 'Gold', unit: '$/oz' },
  'SI=F': { name: 'Silver', unit: '$/oz' },
  'HG=F': { name: 'Copper', unit: '$/lb' },
  'NG=F': { name: 'Natural Gas', unit: '$/MMBtu' },
  'ZC=F': { name: 'Corn', unit: '¢/bu' },
  'ZW=F': { name: 'Wheat', unit: '¢/bu' },
  'ZS=F': { name: 'Soybeans', unit: '¢/bu' },
};

export const TOP_CRYPTO_IDS = [
  'bitcoin', 'ethereum', 'binancecoin', 'solana', 'ripple',
  'cardano', 'dogecoin', 'avalanche-2', 'polkadot', 'chainlink',
  'toncoin', 'polygon-ecosystem-token', 'near', 'litecoin', 'uniswap',
];

// ─── In-memory cache ────────────────────────────────────────────────────────────
interface CacheEntry<T> { data: T; ts: number; }
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string, maxAgeMs: number): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.ts > maxAgeMs) return null;
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

// ─── CoinGecko (public, no auth) ────────────────────────────────────────────────
export async function fetchCryptoQuotes(ids?: string[]): Promise<CryptoQuote[]> {
  const cacheKey = 'crypto:quotes';
  const cached = getCached<CryptoQuote[]>(cacheKey, 60_000);
  if (cached) return cached;

  const coinIds = (ids ?? TOP_CRYPTO_IDS).join(',');
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return getCached<CryptoQuote[]>(cacheKey, 300_000) ?? [];
    const data = await res.json() as Array<{
      id: string; symbol: string; name: string; current_price: number;
      price_change_24h: number; price_change_percentage_24h: number;
      market_cap: number; total_volume: number; high_24h: number; low_24h: number;
      market_cap_rank: number; sparkline_in_7d?: { price: number[] };
    }>;

    const quotes: CryptoQuote[] = data.map(c => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change24h: c.price_change_24h,
      changePct24h: c.price_change_percentage_24h,
      marketCap: c.market_cap,
      volume24h: c.total_volume,
      high24h: c.high_24h,
      low24h: c.low_24h,
      rank: c.market_cap_rank,
      sparkline: c.sparkline_in_7d?.price?.slice(-24),
      updatedAt: Date.now(),
    }));

    setCache(cacheKey, quotes);
    return quotes;
  } catch {
    return getCached<CryptoQuote[]>(cacheKey, 300_000) ?? [];
  }
}

// ─── Fear & Greed Index (Alternative.me — public) ───────────────────────────────
export async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
  const cacheKey = 'fear-greed';
  const cached = getCached<FearGreedData>(cacheKey, 300_000);
  if (cached) return cached;

  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=2', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data: Array<{ value: string; value_classification: string; timestamp: string }> };
    const [current, previous] = json.data;
    if (!current) return null;

    const data: FearGreedData = {
      value: parseInt(current.value),
      label: current.value_classification,
      previousValue: previous ? parseInt(previous.value) : 0,
      previousLabel: previous?.value_classification ?? '',
      timestamp: current.timestamp,
    };

    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}
