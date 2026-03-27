/**
 * RSS Proxy Service — Client-side RSS feed fetching
 * Uses Vite dev proxy or Vercel serverless function to fetch RSS feeds
 * Parses XML on the client side using DOMParser
 */

export interface RssItem {
  id: string;
  title: string;
  link: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: Date;
  isBreaking: boolean;
}

// Feed definitions — inspired by worldmonitor's multi-category structure
export const RSS_FEEDS: Record<string, Array<{ name: string; url: string }>> = {
  Markets: [
    { name: 'CNBC', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
    { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
    { name: 'Reuters Business', url: 'https://news.google.com/rss/search?q=site:reuters.com+business+markets&hl=en-US&gl=US&ceid=US:en' },
  ],
  Crypto: [
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'Crypto News', url: 'https://news.google.com/rss/search?q=cryptocurrency+bitcoin+ethereum+when:1d&hl=en-US&gl=US&ceid=US:en' },
  ],
  Macro: [
    { name: 'Fed Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
    { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  ],
  Tech: [
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  ],
  Earnings: [
    { name: 'Earnings News', url: 'https://news.google.com/rss/search?q=earnings+report+EPS+revenue+when:1d&hl=en-US&gl=US&ceid=US:en' },
  ],
  Energy: [
    { name: 'Energy News', url: 'https://news.google.com/rss/search?q=oil+energy+opec+crude+when:1d&hl=en-US&gl=US&ceid=US:en' },
  ],
};

const feedCache = new Map<string, { items: RssItem[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min cooldown per feed

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function parseRssXml(xml: string, source: string, category: string): RssItem[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Handle both RSS 2.0 (<item>) and Atom (<entry>) feeds
    const items = doc.querySelectorAll('item, entry');
    const results: RssItem[] = [];

    items.forEach((item, i) => {
      if (i >= 15) return; // cap at 15 items per feed

      const title = item.querySelector('title')?.textContent?.trim() ?? '';
      const link =
        item.querySelector('link')?.textContent?.trim() ??
        item.querySelector('link')?.getAttribute('href') ?? '';
      const description =
        item.querySelector('description, summary, content')?.textContent?.trim() ?? '';
      const pubDateStr =
        item.querySelector('pubDate, published, updated')?.textContent?.trim() ?? '';

      if (!title) return;

      const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();
      const isBreaking = /breaking|urgent|alert/i.test(title);

      results.push({
        id: hashString(`${source}:${link || title}`),
        title,
        link,
        summary: description.replace(/<[^>]*>/g, '').slice(0, 300),
        source,
        category,
        publishedAt: isNaN(pubDate.getTime()) ? new Date() : pubDate,
        isBreaking,
      });
    });

    return results;
  } catch {
    return [];
  }
}

export async function fetchRssFeed(
  feedUrl: string,
  source: string,
  category: string,
): Promise<RssItem[]> {
  const cacheKey = `${source}:${feedUrl}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.items;

  try {
    // Use the RSS proxy route to avoid CORS issues
    const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(feedUrl)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return cached?.items ?? [];

    const xml = await res.text();
    const items = parseRssXml(xml, source, category);

    feedCache.set(cacheKey, { items, ts: Date.now() });
    return items;
  } catch {
    return cached?.items ?? [];
  }
}

export async function fetchAllRssFeeds(categories?: string[]): Promise<RssItem[]> {
  const feedEntries = categories
    ? Object.entries(RSS_FEEDS).filter(([cat]) => categories.includes(cat))
    : Object.entries(RSS_FEEDS);

  const promises = feedEntries.flatMap(([category, feeds]) =>
    feeds.map(feed => fetchRssFeed(feed.url, feed.name, category))
  );

  const results = await Promise.allSettled(promises);
  const allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Sort by date, deduplicate by title similarity
  const seen = new Set<string>();
  return allItems
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .filter(item => {
      const key = item.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
