import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { query } from '../../db/postgres';
import { redisPublisher } from '../cache/pubsub';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'QuantDesk/1.0 (Financial News Aggregator)' },
});

const RSS_FEEDS = [
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', source: 'CNBC' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MarketWatch' },
  { url: 'https://finance.yahoo.com/news/rssindex',              source: 'Yahoo Finance' },
  { url: 'https://www.investing.com/rss/news.rss',               source: 'Investing.com' },
];

export interface RawNewsItem {
  externalId: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  tickers: string[];
  categories: string[];
  isBreaking: boolean;
  imageUrl: string | null;
}

function extractTickers(text: string): string[] {
  const matches = text.match(/\b[A-Z]{1,5}\b/g) ?? [];
  const COMMON_WORDS = new Set([
    'THE','AND','FOR','ARE','BUT','NOT','YOU','ALL','CAN','HER','WAS','ONE','OUR',
    'OUT','DAY','GET','HAS','HIM','HIS','HOW','ITS','MAY','NEW','NOW','OLD','SEE',
    'TWO','WAY','WHO','BOY','DID','ITS','LET','PUT','SAY','SHE','TOO','USE',
    'CEO','CFO','CTO','COO','IPO','GDP','CPI','PMI','ETF','ESG','EUR','USD','GBP',
    'JPY','SEC','FED','AI','US','UK',
  ]);
  return [...new Set(matches.filter(t => !COMMON_WORDS.has(t) && t.length >= 2))].slice(0, 6);
}

function categorize(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const cats: string[] = [];
  if (/earnings|eps|revenue|quarter|guidance|beat|miss/.test(text))         cats.push('Earnings');
  if (/fed|federal reserve|rate|inflation|fomc|powell/.test(text))           cats.push('Fed');
  if (/merger|acquisition|deal|buyout|takeover|m&a/.test(text))             cats.push('M&A');
  if (/macro|gdp|unemployment|jobs|economy|recession/.test(text))           cats.push('Macro');
  if (/oil|energy|crude|opec|gas|renewable/.test(text))                     cats.push('Energy');
  if (/crypto|bitcoin|ethereum|blockchain|defi/.test(text))                 cats.push('Crypto');
  if (/ipo|spac|listing|offering/.test(text))                               cats.push('IPO');
  if (/analyst|upgrade|downgrade|price target|rating/.test(text))           cats.push('Analyst');
  if (cats.length === 0) cats.push('Markets');
  return cats;
}

async function fetchFeed(feedConfig: { url: string; source: string }): Promise<RawNewsItem[]> {
  try {
    const feed = await parser.parseURL(feedConfig.url);
    return (feed.items ?? []).slice(0, 20).map(item => {
      const url = item.link ?? item.guid ?? '';
      const externalId = createHash('sha256').update(url).digest('hex');
      const title = item.title ?? '';
      const summary = item.contentSnippet ?? item.content ?? item.summary ?? '';
      return {
        externalId,
        title,
        summary: summary.replace(/<[^>]*>/g, '').slice(0, 500),
        url,
        source: feedConfig.source,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        tickers: extractTickers(`${title} ${summary}`),
        categories: categorize(title, summary),
        isBreaking: /breaking|urgent|alert/i.test(title),
        imageUrl: null,
      };
    });
  } catch (err) {
    console.warn(`[rssPoller] Failed to fetch ${feedConfig.source}: ${(err as Error).message}`);
    return [];
  }
}

export async function pollAllFeeds(): Promise<number> {
  const start = Date.now();
  const results = await Promise.allSettled(RSS_FEEDS.map(f => fetchFeed(f)));
  const allItems: RawNewsItem[] = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  let newCount = 0;
  for (const item of allItems) {
    try {
      const result = await query<{ id: string }>(
        `INSERT INTO news_items (external_id, title, summary, url, source, published_at, tickers, categories, is_breaking, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (external_id) DO NOTHING
         RETURNING id`,
        [
          item.externalId, item.title, item.summary, item.url, item.source,
          item.publishedAt.toISOString(), item.tickers, item.categories,
          item.isBreaking, item.imageUrl,
        ],
      );
      if (result.length > 0) {
        newCount++;
        await redisPublisher.publish('news:new_items', JSON.stringify({ id: result[0].id, ...item }));
      }
    } catch { /* skip duplicates */ }
  }

  console.log(`[rssPoller] ${newCount} new items from ${RSS_FEEDS.length} feeds in ${Date.now() - start}ms`);
  return newCount;
}
