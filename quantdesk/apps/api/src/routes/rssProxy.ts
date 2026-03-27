import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// Allowed RSS feed domains (security whitelist)
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

// GET /api/rss-proxy?url=<feed_url>
router.get('/', async (req: Request, res: Response) => {
  const feedUrl = req.query.url as string;

  if (!feedUrl) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(feedUrl);
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  if (!isAllowedDomain(parsedUrl.hostname)) {
    res.status(403).json({ error: 'Domain not allowed' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      res.status(response.status).json({ error: `Feed returned ${response.status}` });
      return;
    }

    const xml = await response.text();

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=180, s-maxage=900, stale-while-revalidate=1800');
    res.send(xml);
  } catch (err) {
    const isTimeout = (err as Error).name === 'AbortError';
    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Feed timeout' : 'Failed to fetch feed',
    });
  }
});

export default router;
