import { pollAllFeeds } from '../services/news/rssPoller';
import { fetchMarketNews } from '../services/news/polygonNews';
import { tagRecentUntagged } from '../services/news/newsSentimentTagger';

export async function scheduleNewsJobs(): Promise<void> {
  const run = (fn: () => Promise<unknown>, label: string) =>
    fn().catch(err => console.error(`[newsJobs] ${label} failed:`, err.message));

  // Initial run on startup
  run(pollAllFeeds, 'pollAllFeeds');

  // Same intervals as before: RSS 60s, Polygon 5min, Sentiment 2min
  setInterval(() => run(pollAllFeeds,                  'pollAllFeeds'),    60_000);
  setInterval(() => run(() => fetchMarketNews(50),     'fetchMarketNews'), 300_000);
  setInterval(() => run(() => tagRecentUntagged(20),   'tagSentiment'),    120_000);

  console.log('[newsJobs] News worker started');
}
