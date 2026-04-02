import 'dotenv/config';
import { validateEnv } from './config/validateEnv';
import { validateMfaKeyEnv } from './routes/admin/auth';
validateEnv();
validateMfaKeyEnv();
import http from 'http';
import app from './app';
import { checkHealth } from './db/health';
import { connectMongo } from './db/mongo';
import { attachWebSocket } from './websocket/wsServer';
import { scheduleNewsJobs } from './jobs/newsJobs';

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);

async function start() {
  // Start listening immediately so HF Spaces health check passes
  const server = http.createServer(app);
  attachWebSocket(server);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[server] WebSocket available at ws://0.0.0.0:${PORT}/ws`);
  });

  // DB connections and jobs start in background — don't block HTTP server
  connectMongo()
    .then(() => checkHealth())
    .then(health => {
      if (!health.healthy) {
        console.error('[server] DB health check failed:', health);
      } else {
        console.log('[server] All DB connections healthy', health);
      }
    })
    .catch(err => console.error('[server] DB startup error:', err.message));

  scheduleNewsJobs().catch(err => console.error('[server] News jobs error:', err.message));
}

start().catch((err) => {
  console.error('[server] Fatal startup error', err);
  process.exit(1);
});
