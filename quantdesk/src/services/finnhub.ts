import type { PriceData, NewsItem } from '../types';
import { generatePriceData, MOCK_NEWS } from './mockData';

// No API key on the client — all Finnhub calls go through the server proxy at
// /api/market-data/finnhub/* which injects FINNHUB_API_KEY server-side.
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';
const BASE = '/api/market-data/finnhub';

function isMock() {
  return MOCK_MODE;
}

// ─── Quote ─────────────────────────────────────────────────────────────────────
interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // change %
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // prev close
  t: number; // timestamp
}

export async function fetchQuote(ticker: string): Promise<PriceData> {
  if (isMock()) return generatePriceData(ticker);

  const res = await fetch(`${BASE}/quote?symbol=${ticker}`);
  if (!res.ok) return generatePriceData(ticker);

  const q: FinnhubQuote = await res.json();

  // Finnhub returns 0 for pre/after-market with no data
  if (!q.c || q.c === 0) return generatePriceData(ticker);

  return {
    ticker,
    last: q.c,
    open: q.o,
    high: q.h,
    low: q.l,
    close: q.c,
    prevClose: q.pc,
    change: q.d,
    changePct: q.dp,
    volume: 0, // not in free quote endpoint
    vwap: q.c, // approximation
    bid: +(q.c - 0.01).toFixed(2),
    ask: +(q.c + 0.01).toFixed(2),
    bidSize: 0,
    askSize: 0,
    timestamp: q.t * 1000,
  };
}

// ─── Batch Quotes (throttled to stay under Finnhub 60 req/min) ──────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchAllQuotes(tickers: string[]): Promise<PriceData[]> {
  if (isMock()) {
    return tickers.map(t => generatePriceData(t));
  }

  // Process in batches of 8 with 1.2s pause between batches
  const BATCH_SIZE = 8;
  const BATCH_DELAY = 1200;
  const results: PriceData[] = [];

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(t => fetchQuote(t)));
    results.push(
      ...batchResults.map((r, j) =>
        r.status === 'fulfilled' ? r.value : generatePriceData(batch[j])
      ),
    );
    // Pause between batches (skip after last batch)
    if (i + BATCH_SIZE < tickers.length) await delay(BATCH_DELAY);
  }

  return results;
}

// ─── News ──────────────────────────────────────────────────────────────────────
interface FinnhubNewsItem {
  id: number;
  headline: string;
  source: string;
  datetime: number;
  summary: string;
  url: string;
  category: string;
  related?: string;
}

function mapNewsItem(n: FinnhubNewsItem, index: number): NewsItem {
  const categories: NewsItem['tags'] = [];
  if (n.category) categories.push(n.category.charAt(0).toUpperCase() + n.category.slice(1));
  return {
    id: String(n.id ?? index),
    headline: n.headline,
    source: n.source,
    timestamp: n.datetime * 1000,
    summary: n.summary || n.headline,
    tags: categories,
    sentiment: 'neutral', // will be enriched by Claude
    tickers: n.related ? n.related.split(',').map(s => s.trim()).filter(Boolean) : [],
    url: n.url,
  };
}

export async function fetchMarketNews(): Promise<NewsItem[]> {
  if (isMock()) return MOCK_NEWS;

  try {
    const res = await fetch(`${BASE}/news?category=general&minId=0`);
    if (!res.ok) return MOCK_NEWS;
    const data: FinnhubNewsItem[] = await res.json();
    return data.slice(0, 30).map(mapNewsItem);
  } catch {
    return MOCK_NEWS;
  }
}

export async function fetchCompanyNews(ticker: string): Promise<NewsItem[]> {
  if (isMock()) return MOCK_NEWS.filter(n => n.tickers.includes(ticker));

  const today = new Date();
  const from = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  try {
    const res = await fetch(`${BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}`);
    if (!res.ok) return [];
    const data: FinnhubNewsItem[] = await res.json();
    return data.slice(0, 20).map(mapNewsItem);
  } catch {
    return [];
  }
}

// ─── Symbol search ─────────────────────────────────────────────────────────────
export interface SymbolResult {
  symbol: string;
  description: string;
  type: string;
}

export async function searchSymbol(query: string): Promise<SymbolResult[]> {
  if (isMock() || !query) return [];
  try {
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.result ?? []).slice(0, 10);
  } catch {
    return [];
  }
}
