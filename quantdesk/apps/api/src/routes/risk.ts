import { Router } from 'express';
import {
  saveSnapshot, getLatestSnapshot, getSnapshotHistory,
  saveStressTest, getStressTests,
  type RiskSnapshot,
} from '../services/db/riskService';

const router = Router();

/** GET /api/risk/portfolios/:portfolioId/snapshot */
router.get('/portfolios/:portfolioId/snapshot', async (req, res) => {
  const snap = await getLatestSnapshot(req.params.portfolioId);
  if (!snap) { res.status(404).json({ error: 'No snapshot found' }); return; }
  res.json({ snapshot: snap });
});

/** GET /api/risk/portfolios/:portfolioId/history?days=30 */
router.get('/portfolios/:portfolioId/history', async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 30;
  const history = await getSnapshotHistory(req.params.portfolioId, days);
  res.json({ history });
});

/** POST /api/risk/portfolios/:portfolioId/snapshot */
router.post('/portfolios/:portfolioId/snapshot', async (req, res) => {
  const body = req.body as Omit<RiskSnapshot, 'id' | 'portfolio_id' | 'created_at'>;
  const snap = await saveSnapshot(req.params.portfolioId, body);
  res.status(201).json({ snapshot: snap });
});

/** GET /api/risk/portfolios/:portfolioId/stress-tests */
router.get('/portfolios/:portfolioId/stress-tests', async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const tests = await getStressTests(req.params.portfolioId, limit);
  res.json({ tests });
});

/** POST /api/risk/portfolios/:portfolioId/stress-tests */
router.post('/portfolios/:portfolioId/stress-tests', async (req, res) => {
  const { scenarioName, params, result } = req.body as {
    scenarioName: string;
    params:       Record<string, unknown>;
    result: {
      pnlImpact:       number;
      pnlPctImpact:    number;
      topContributors: { security: string; contribution: number }[];
    };
  };
  const test = await saveStressTest(req.params.portfolioId, scenarioName, params, result);
  res.status(201).json({ test });
});

export default router;
