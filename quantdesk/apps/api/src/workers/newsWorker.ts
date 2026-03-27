import { Worker, Queue } from 'bullmq';
import { pollAllFeeds } from '../services/news/rssPoller';
import { fetchMarketNews } from '../services/news/polygonNews';
import { tagRecentUntagged } from '../services/news/newsSentimentTagger';

const connection = {
  host:     process.env.REDIS_HOST     ?? 'localhost',
  port:     parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as null,
};

export const newsQueue = new Queue('news', { connection });

/** Schedule recurring BullMQ repeatable jobs for news polling and sentiment tagging. */
export async function scheduleNewsJobs(): Promise<void> {
  await newsQueue.upsertJobScheduler(
    'poll-rss',
    { every: 60_000 },
    { name: 'poll-rss', data: { type: 'rss' } },
  );
  await newsQueue.upsertJobScheduler(
    'poll-polygon',
    { every: 300_000 },
    { name: 'poll-polygon', data: { type: 'polygon' } },
  );
  await newsQueue.upsertJobScheduler(
    'tag-sentiment',
    { every: 120_000 },
    { name: 'tag-sentiment', data: { type: 'sentiment' } },
  );
  console.log('[newsWorker] News jobs scheduled');
}

export const newsWorker = new Worker(
  'news',
  async (job) => {
    switch (job.data.type as string) {
      case 'rss':
        await pollAllFeeds();
        break;
      case 'polygon':
        await fetchMarketNews(50);
        break;
      case 'sentiment':
        await tagRecentUntagged(20);
        break;
      default:
        console.warn(`[newsWorker] Unknown job type: ${job.data.type}`);
    }
  },
  { connection },
);

newsWorker.on('failed', (job, err) => {
  console.error(`[newsWorker] Job ${job?.name} failed:`, err.message);
});

newsWorker.on('completed', (job) => {
  console.log(`[newsWorker] Job ${job.name} completed`);
});
