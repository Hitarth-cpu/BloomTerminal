import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const fgRes = await fetch('https://api.alternative.me/fng/?limit=2', {
      signal: AbortSignal.timeout(5000),
    });
    if (!fgRes.ok) return res.json({ data: [] });
    const data = await fgRes.json();
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
    return res.json(data);
  } catch {
    return res.json({ data: [] });
  }
}
