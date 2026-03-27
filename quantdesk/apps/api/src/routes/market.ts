import { Router } from 'express';
import {
  searchSecurities, getSecurity,
  getWatchlist, addToWatchlist, removeFromWatchlist,
  getPositions,
} from '../services/db/marketDataService';
import { getPrice } from '../services/cache/priceCache';
import { query } from '../db/postgres';

const router = Router();

/** GET /api/market/portfolios — list the current user's portfolios */
router.get('/portfolios', async (req, res) => {
  const rows = await query<{ id: string; name: string; currency: string; created_at: Date }>(
    'SELECT id, name, currency, created_at FROM portfolios WHERE user_id = $1 ORDER BY created_at ASC',
    [req.user.id],
  );
  res.json({ portfolios: rows });
});

/** GET /api/market/search?q=AAPL */
router.get('/search', async (req, res) => {
  const { q, limit } = req.query as { q?: string; limit?: string };
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }
  const results = await searchSecurities(q, limit ? Number(limit) : 10);
  res.json({ results });
});

/** GET /api/market/securities/:ticker */
router.get('/securities/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const exchange   = req.query.exchange as string | undefined;
  const security   = await getSecurity(ticker, exchange);
  if (!security) { res.status(404).json({ error: 'Security not found' }); return; }

  // Augment with cached price if available
  const price = await getPrice(ticker);
  res.json({ security, price });
});

/** GET /api/market/watchlist */
router.get('/watchlist', async (req, res) => {
  const items = await getWatchlist(req.user.id);
  res.json({ items });
});

/** POST /api/market/watchlist */
router.post('/watchlist', async (req, res) => {
  const { securityId } = req.body as { securityId?: string };
  if (!securityId) { res.status(400).json({ error: 'securityId required' }); return; }
  await addToWatchlist(req.user.id, securityId);
  res.status(201).json({ ok: true });
});

/** DELETE /api/market/watchlist/:securityId */
router.delete('/watchlist/:securityId', async (req, res) => {
  await removeFromWatchlist(req.user.id, req.params.securityId);
  res.json({ ok: true });
});

/** GET /api/market/portfolios/:portfolioId/positions */
router.get('/portfolios/:portfolioId/positions', async (req, res) => {
  const positions = await getPositions(req.params.portfolioId);
  res.json({ positions });
});

export default router;
