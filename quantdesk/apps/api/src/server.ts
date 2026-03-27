import 'dotenv/config';
import { validateEnv } from './config/validateEnv';
validateEnv();
import http from 'http';
import app from './app';
import { checkHealth } from './db/health';
import { connectMongo } from './db/mongo';
import { attachWebSocket } from './websocket/wsServer';
import { scheduleNewsJobs } from './jobs/newsJobs';

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);

async function start() {
  // Establish MongoDB connection before health check
  await connectMongo();

  // Verify all DB connections before accepting traffic
  const health = await checkHealth();
  if (!health.healthy) {
    console.error('[server] DB health check failed:', health);
    process.exit(1);
  }
  console.log('[server] All DB connections healthy', health);

  // Start background news polling jobs
  await scheduleNewsJobs();

  const server = http.createServer(app);
  attachWebSocket(server);
  server.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
    console.log(`[server] WebSocket available at ws://localhost:${PORT}/ws`);
  });
}

start().catch((err) => {
  console.error('[server] Fatal startup error', err);
  process.exit(1);
});
