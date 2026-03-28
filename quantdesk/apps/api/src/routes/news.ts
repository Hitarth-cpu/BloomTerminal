import { Router } from 'express';
import { query } from '../db/postgres';
import { pollAllFeeds } from '../services/news/rssPoller';
import { fetchMarketNews } from '../services/news/polygonNews';

const router = Router();

// GET /api/news
router.get('/', async (req, res) => {
  const {
    tickers, categories, source, sentiment, from, to,
    page = '1', limit = '20',
  } = req.query as Record<string, string>;

  const pageNum   = Math.max(1, parseInt(page));
  const limitNum  = Math.min(100, parseInt(limit));
  const offset    = (pageNum - 1) * limitNum;

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let idx = 1;

  if (tickers) {
    const tickerArr = tickers.split(',').map(t => t.trim().toUpperCase());
    conditions.push(`tickers && $${idx++}::text[]`);
    params.push(tickerArr);
  }
  if (categories) {
    const catArr = categories.split(',');
    conditions.push(`categories && $${idx++}::text[]`);
    params.push(catArr);
  }
  if (source) {
    conditions.push(`source ILIKE $${idx++}`);
    params.push(`%${source}%`);
  }
  if (sentiment) {
    conditions.push(`sentiment = $${idx++}`);
    params.push(sentiment);
  }
  if (from) {
    conditions.push(`published_at >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`published_at <= $${idx++}`);
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const limitIdx  = idx;
  const offsetIdx = idx + 1;

  try {
    const items = await query(
      `SELECT id, title, summary, url, source, published_at, tickers, categories,
              sentiment, ai_summary, is_breaking, image_url
       FROM news_items ${where}
       ORDER BY published_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limitNum, offset],
    );
    res.json({ items, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('[news] query failed', err);
    res.json({ items: [], page: pageNum, limit: limitNum });
  }
});

// GET /api/news/ticker/:ticker
router.get('/ticker/:ticker', async (req, res) => {
  const items = await query(
    `SELECT id, title, summary, url, source, published_at, tickers, categories,
            sentiment, ai_summary, is_breaking, image_url
     FROM news_items WHERE tickers @> $1::text[]
     ORDER BY published_at DESC LIMIT 50`,
    [[req.params.ticker.toUpperCase()]],
  );
  res.json({ items });
});

// GET /api/news/breaking
router.get('/breaking', async (_req, res) => {
  const items = await query(
    `SELECT id, title, summary, url, source, published_at, tickers, categories, sentiment
     FROM news_items
     WHERE is_breaking = true AND published_at > NOW() - INTERVAL '1 hour'
     ORDER BY published_at DESC LIMIT 10`,
    [],
  );
  res.json({ items });
});

// POST /api/news/refresh — trigger manual poll (admin)
router.post('/refresh', async (_req, res) => {
  try {
    const [rssCount, polyCount] = await Promise.all([
      pollAllFeeds(),
      fetchMarketNews(50),
    ]);
    res.json({ newItems: rssCount + polyCount, sources: ['RSS', 'Polygon'] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
