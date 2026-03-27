import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&sparkline=true&price_change_percentage=24h',
      { signal: AbortSignal.timeout(8000) },
    );
    if (!cgRes.ok) return res.json({ crypto: [] });
    const data = await cgRes.json();
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    return res.json({ crypto: data });
  } catch {
    return res.json({ crypto: [] });
  }
}
