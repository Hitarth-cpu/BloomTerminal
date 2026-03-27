import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_DOMAINS = new Set([
  'feeds.reuters.com', 'www.reuters.com', 'reuters.com',
  'www.cnbc.com', 'cnbc.com',
  'feeds.marketwatch.com', 'www.marketwatch.com',
  'finance.yahoo.com',
  'www.investing.com',
  'news.google.com',
  'www.coindesk.com',
  'feeds.bbci.co.uk', 'www.bbc.co.uk',
  'www.federalreserve.gov',
  'hnrss.org',
  'feeds.arstechnica.com',
  'www.theverge.com',
  'www.ft.com',
  'feeds.npr.org',
  'www.sec.gov',
  'feeds.abcnews.com',
  'rss.politico.com',
  'thehill.com',
  'api.axios.com',
  'www.aljazeera.com',
  'www.theguardian.com',
  'www.france24.com',
  'www.euronews.com',
  'rss.dw.com',
  'venturebeat.com',
  'www.technologyreview.com',
  'export.arxiv.org',
]);

function isAllowedDomain(hostname: string): boolean {
  const bare = hostname.replace(/^www\./, '');
  const withWww = hostname.startsWith('www.') ? hostname : `www.${hostname}`;
  return ALLOWED_DOMAINS.has(hostname) || ALLOWED_DOMAINS.has(bare) || ALLOWED_DOMAINS.has(withWww);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const feedUrl = req.query.url as string;
  if (!feedUrl) return res.status(400).json({ error: 'Missing url parameter' });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(feedUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!isAllowedDomain(parsedUrl.hostname)) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return res.status(response.status).json({ error: `Feed returned ${response.status}` });

    const xml = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=180, s-maxage=900, stale-while-revalidate=1800');
    return res.send(xml);
  } catch (err) {
    const isTimeout = (err as Error).name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Feed timeout' : 'Failed to fetch feed',
    });
  }
}
