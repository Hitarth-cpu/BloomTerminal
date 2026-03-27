import { Queue, Worker } from 'bullmq';
import { redisPublisher } from '../services/cache/pubsub';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  username: process.env.REDIS_PASSWORD ? 'default' : undefined,
};

export const newsQueue = new Queue('news', { connection });

export function startNewsWorker(): void {
  const worker = new Worker('news', async (job) => {
    if (job.name === 'poll_rss') {
      const { pollAllFeeds } = await import('../services/news/rssPoller');
      return pollAllFeeds();
    }
    if (job.name === 'poll_polygon') {
      const { fetchMarketNews } = await import('../services/news/polygonNews');
      return fetchMarketNews(50);
    }
    if (job.name === 'tag_sentiment') {
      const { tagRecentUntaggeredNews } = await import('../services/news/newsSentimentTagger');
      return tagRecentUntaggeredNews(20);
    }
  }, { connection });

  worker.on('failed', (job, err) => console.error(`[newsJobs] Job ${job?.name} failed:`, err.message));
  console.log('[newsJobs] News worker started');
}

export async function scheduleNewsJobs(): Promise<void> {
  startNewsWorker();
  await newsQueue.upsertJobScheduler('poll_rss',      { every: 60_000  }, { name: 'poll_rss' });
  await newsQueue.upsertJobScheduler('poll_polygon',  { every: 300_000 }, { name: 'poll_polygon' });
  await newsQueue.upsertJobScheduler('tag_sentiment', { every: 120_000 }, { name: 'tag_sentiment' });
  console.log('[newsJobs] News jobs scheduled');
}
