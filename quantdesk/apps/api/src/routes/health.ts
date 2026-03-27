import { Router } from 'express';
import { checkHealth } from '../db/health';

const router = Router();

router.get('/', async (_req, res) => {
  const health = await checkHealth();
  const ok = Object.values(health).every(v => v === 'ok');
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', services: health });
});

export default router;
