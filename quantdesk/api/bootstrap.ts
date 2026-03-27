import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Bootstrap endpoint — two-tier hydration (worldmonitor pattern)
 * Fetches market data + crypto + fear/greed in a single batched call.
 * Fast tier: indices, breaking news count
 * Slow tier: crypto, sectors, commodities, fear/greed
 */

const COINGECKO = 'https://api.coingecko.com/api/v3';
const FEAR_GREED = 'https://api.alternative.me/fng/?limit=2';

async function fetchJson(url: string, timeoutMs = 5000): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const tier = req.query.tier as string | undefined;

  const data: Record<string, unknown> = {};
  const missing: string[] = [];

  if (!tier || tier === 'fast') {
    // Fast tier: major indices via Yahoo Finance
    const indicesPromise = fetchJson(
      'https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EDJI%2C%5EGSPC%2C%5EIXIC%2C%5ERUT%2C%5EVIX',
      3000,
    );

    const indices = await indicesPromise;
    if (indices) {
      data.indices = (indices as { quoteResponse?: { result?: unknown[] } }).quoteResponse?.result ?? [];
    } else {
      missing.push('indices');
    }
  }

  if (!tier || tier === 'slow') {
    // Slow tier: crypto, fear/greed
    const [crypto, fearGreed] = await Promise.allSettled([
      fetchJson(`${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=15&sparkline=false`, 5000),
      fetchJson(FEAR_GREED, 3000),
    ]);

    if (crypto.status === 'fulfilled' && crypto.value) {
      data.crypto = crypto.value;
    } else {
      missing.push('crypto');
    }

    if (fearGreed.status === 'fulfilled' && fearGreed.value) {
      data.fearGreed = fearGreed.value;
    } else {
      missing.push('fearGreed');
    }
  }

  const cacheControl = tier === 'fast'
    ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=120'
    : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

  res.setHeader('Cache-Control', cacheControl);
  return res.json({ data, missing });
}
