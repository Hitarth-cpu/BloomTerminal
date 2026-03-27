import { createHash } from 'crypto';
import { query } from '../../db/postgres';
import { redisPublisher } from '../cache/pubsub';

const POLYGON_KEY = process.env.POLYGON_API_KEY ?? '';
const BASE = 'https://api.polygon.io';

interface PolygonArticle {
  id: string;
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  description: string;
  keywords: string[];
  image_url: string | null;
}

async function fetchPolygon(path: string): Promise<PolygonArticle[]> {
  if (!POLYGON_KEY) return [];
  try {
    const res = await fetch(`${BASE}${path}&apiKey=${POLYGON_KEY}`);
    if (!res.ok) return [];
    const data = await res.json() as { results?: PolygonArticle[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

async function storeArticles(articles: PolygonArticle[], source = 'Polygon'): Promise<number> {
  let newCount = 0;
  for (const a of articles) {
    const externalId = createHash('sha256').update(a.article_url).digest('hex');
    try {
      const result = await query<{ id: string }>(
        `INSERT INTO news_items (external_id, title, summary, url, source, published_at, tickers, categories, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (external_id) DO NOTHING RETURNING id`,
        [
          externalId, a.title, a.description?.slice(0, 500) ?? '', a.article_url,
          source, a.published_utc, a.tickers ?? [], a.keywords?.slice(0, 5) ?? [],
          a.image_url ?? null,
        ],
      );
      if (result.length > 0) {
        newCount++;
        await redisPublisher.publish('news:new_items', JSON.stringify({
          id: result[0].id, title: a.title, tickers: a.tickers,
        }));
      }
    } catch { /* skip */ }
  }
  return newCount;
}

export async function fetchTickerNews(ticker: string, limit = 20): Promise<number> {
  const articles = await fetchPolygon(`/v2/reference/news?ticker=${ticker}&limit=${limit}&order=desc`);
  return storeArticles(articles, 'Polygon');
}

export async function fetchMarketNews(limit = 50): Promise<number> {
  const articles = await fetchPolygon(`/v2/reference/news?limit=${limit}&order=desc`);
  const count = await storeArticles(articles, 'Polygon');
  console.log(`[polygonNews] ${count} new market news items`);
  return count;
}
