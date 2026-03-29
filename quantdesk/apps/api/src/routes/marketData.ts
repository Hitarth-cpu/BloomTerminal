import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? '';

// In-memory cache for market data
const dataCache = new Map<string, { data: unknown; ts: number }>();

function getCached(key: string, maxAgeMs: number): unknown | null {
  const entry = dataCache.get(key);
  if (!entry || Date.now() - entry.ts > maxAgeMs) return null;
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  dataCache.set(key, { data, ts: Date.now() });
}

// ─── Yahoo Finance proxy (no auth needed) ───────────────────────────────────────
async function yahooQuote(symbols: string[]): Promise<unknown[]> {
  if (!symbols.length) return [];
  const cacheKey = `yahoo:${symbols.join(',')}`;
  const cached = getCached(cacheKey, 60_000);
  if (cached) return cached as unknown[];

  try {
    const symbolStr = symbols.join(',');
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolStr)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const json = await res.json() as { quoteResponse?: { result?: unknown[] } };
    const results = json.quoteResponse?.result ?? [];
    setCache(cacheKey, results);
    return results;
  } catch {
    return (getCached(cacheKey, 300_000) as unknown[]) ?? [];
  }
}

// GET /api/market-data/quotes?symbols=AAPL,MSFT,GOOGL
router.get('/quotes', async (req: Request, res: Response) => {
  const symbols = ((req.query.symbols as string) ?? '').split(',').filter(Boolean);
  if (!symbols.length) {
    res.json({ quotes: [] });
    return;
  }
  const data = await yahooQuote(symbols);
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
  res.json({ quotes: data });
});

// GET /api/market-data/sectors
router.get('/sectors', async (_req: Request, res: Response) => {
  const sectorSymbols = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLI', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC', 'SMH'];
  const data = await yahooQuote(sectorSymbols);
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  res.json({ sectors: data });
});

// GET /api/market-data/commodities
router.get('/commodities', async (_req: Request, res: Response) => {
  const commoditySymbols = ['CL=F', 'BZ=F', 'GC=F', 'SI=F', 'HG=F', 'NG=F', 'ZC=F', 'ZW=F', 'ZS=F'];
  const data = await yahooQuote(commoditySymbols);
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  res.json({ commodities: data });
});

// GET /api/market-data/indices
router.get('/indices', async (_req: Request, res: Response) => {
  const indexSymbols = ['^DJI', '^GSPC', '^IXIC', '^RUT', '^VIX'];
  const data = await yahooQuote(indexSymbols);
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
  res.json({ indices: data });
});

// GET /api/market-data/crypto — CoinGecko proxy
router.get('/crypto', async (_req: Request, res: Response) => {
  const cacheKey = 'coingecko:markets';
  const cached = getCached(cacheKey, 60_000);
  if (cached) {
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    res.json({ crypto: cached });
    return;
  }

  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&sparkline=true&price_change_percentage=24h',
      { signal: AbortSignal.timeout(8000) },
    );
    if (!cgRes.ok) {
      res.json({ crypto: [] });
      return;
    }
    const data = await cgRes.json();
    setCache(cacheKey, data);
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    res.json({ crypto: data });
  } catch {
    res.json({ crypto: [] });
  }
});

// GET /api/market-data/fear-greed
router.get('/fear-greed', async (_req: Request, res: Response) => {
  const cacheKey = 'fear-greed';
  const cached = getCached(cacheKey, 300_000);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const fgRes = await fetch('https://api.alternative.me/fng/?limit=2', {
      signal: AbortSignal.timeout(5000),
    });
    if (!fgRes.ok) {
      res.json({ data: [] });
      return;
    }
    const data = await fgRes.json();
    setCache(cacheKey, data);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
    res.json(data);
  } catch {
    res.json({ data: [] });
  }
});

// ─── Finnhub proxy helpers ─────────────────────────────────────────────────────
// Shared rate-limit bucket: Finnhub free tier = 60 req/min.
// We cap at 55 to leave headroom for bursts.
const finnhubRequestTimes: number[] = [];

function finnhubRateCheck(): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  while (finnhubRequestTimes.length > 0 && finnhubRequestTimes[0] < windowStart) {
    finnhubRequestTimes.shift();
  }
  if (finnhubRequestTimes.length >= 55) return false;
  finnhubRequestTimes.push(now);
  return true;
}

async function finnhubFetch(path: string, signal?: AbortSignal): Promise<globalThis.Response> {
  return fetch(
    `https://finnhub.io/api/v1/${path}${path.includes('?') ? '&' : '?'}token=${FINNHUB_KEY}`,
    { signal: signal ?? AbortSignal.timeout(8000) },
  );
}

// GET /api/market-data/finnhub/quote?symbol=AAPL
router.get('/finnhub/quote', async (req: Request, res: Response) => {
  const symbol = req.query.symbol as string;
  if (!symbol) { res.status(400).json({ error: 'Missing symbol' }); return; }
  if (!finnhubRateCheck()) { res.status(429).json({ error: 'Rate limit — try again shortly' }); return; }

  const cacheKey = `finnhub:quote:${symbol}`;
  const cached = getCached(cacheKey, 60_000);
  if (cached) { res.json(cached); return; }

  try {
    const fhRes = await finnhubFetch(`quote?symbol=${encodeURIComponent(symbol)}`);
    if (!fhRes.ok) { res.status(fhRes.status).json({ error: 'Finnhub error' }); return; }
    const data = await fhRes.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Finnhub timeout' });
  }
});

// GET /api/market-data/finnhub/news?category=general
router.get('/finnhub/news', async (req: Request, res: Response) => {
  const category = (req.query.category as string) || 'general';
  const cacheKey = `finnhub:news:${category}`;
  const cached = getCached(cacheKey, 300_000); // 5 min cache for news
  if (cached) { res.json(cached); return; }
  if (!finnhubRateCheck()) { res.status(429).json({ error: 'Rate limit — try again shortly' }); return; }

  try {
    const fhRes = await finnhubFetch(`news?category=${encodeURIComponent(category)}`);
    if (!fhRes.ok) { res.status(fhRes.status).json({ error: 'Finnhub error' }); return; }
    const data = await fhRes.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Finnhub timeout' });
  }
});

// GET /api/market-data/finnhub/company-news?symbol=AAPL&from=2024-01-01&to=2024-01-07
router.get('/finnhub/company-news', async (req: Request, res: Response) => {
  const { symbol, from, to } = req.query as Record<string, string>;
  if (!symbol || !from || !to) {
    res.status(400).json({ error: 'Missing symbol, from, or to' });
    return;
  }
  const cacheKey = `finnhub:company-news:${symbol}:${from}:${to}`;
  const cached = getCached(cacheKey, 300_000);
  if (cached) { res.json(cached); return; }
  if (!finnhubRateCheck()) { res.status(429).json({ error: 'Rate limit — try again shortly' }); return; }

  try {
    const fhRes = await finnhubFetch(
      `company-news?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    if (!fhRes.ok) { res.status(fhRes.status).json({ error: 'Finnhub error' }); return; }
    const data = await fhRes.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Finnhub timeout' });
  }
});

// GET /api/market-data/finnhub/search?q=apple
router.get('/finnhub/search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q) { res.status(400).json({ error: 'Missing q' }); return; }
  const cacheKey = `finnhub:search:${q.toLowerCase()}`;
  const cached = getCached(cacheKey, 600_000); // 10 min — symbol list changes rarely
  if (cached) { res.json(cached); return; }
  if (!finnhubRateCheck()) { res.status(429).json({ error: 'Rate limit — try again shortly' }); return; }

  try {
    const fhRes = await finnhubFetch(`search?q=${encodeURIComponent(q)}`);
    if (!fhRes.ok) { res.status(fhRes.status).json({ error: 'Finnhub error' }); return; }
    const data = await fhRes.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Finnhub timeout' });
  }
});

export default router;
