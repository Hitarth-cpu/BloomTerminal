import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const symbols = ((req.query.symbols as string) ?? '').split(',').filter(Boolean);
  if (!symbols.length) return res.json({ quotes: [] });

  try {
    const symbolStr = symbols.join(',');
    const yfRes = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolStr)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!yfRes.ok) return res.json({ quotes: [] });
    const json = await yfRes.json() as { quoteResponse?: { result?: unknown[] } };
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    return res.json({ quotes: json.quoteResponse?.result ?? [] });
  } catch {
    return res.json({ quotes: [] });
  }
}
