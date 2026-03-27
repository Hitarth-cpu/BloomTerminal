import { Router } from 'express';
import { query } from '../../db/postgres';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';

const router = Router();
router.use(requireAdminAuth);

function getPeriodDates(period: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case '1d':  start.setDate(start.getDate() - 1); break;
    case '1w':  start.setDate(start.getDate() - 7); break;
    case '1m':  start.setMonth(start.getMonth() - 1); break;
    case '3m':  start.setMonth(start.getMonth() - 3); break;
    case 'ytd': start.setMonth(0); start.setDate(1); break;
    default:    start.setDate(start.getDate() - 30);
  }
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  };
}

// GET /api/admin/performance/traders
router.get('/traders', async (req, res) => {
  const { period = '1m' } = req.query as Record<string, string>;
  const { start, end } = getPeriodDates(period);
  const orgId = req.adminUser.orgId;

  const traders = await query<{
    user_id: string; display_name: string; email: string; team_ids: string[];
    total_pnl: string; trades_count: string; winning_trades: string;
    volume_traded: string; sharpe_ratio: string | null; max_drawdown: string | null;
  }>(
    `SELECT u.id AS user_id, u.display_name, u.email, u.team_ids,
            COALESCE(SUM(ps.daily_pnl), 0)::text AS total_pnl,
            COALESCE(SUM(ps.trades_count), 0)::text AS trades_count,
            COALESCE(SUM(ps.winning_trades), 0)::text AS winning_trades,
            COALESCE(SUM(ps.volume_traded), 0)::text AS volume_traded,
            AVG(ps.sharpe_ratio)::text AS sharpe_ratio,
            MIN(ps.max_drawdown)::text AS max_drawdown
     FROM users u
     LEFT JOIN performance_snapshots ps ON ps.user_id = u.id
       AND ps.snapshot_date BETWEEN $2 AND $3
     WHERE u.org_id = $1 AND u.is_active = true AND u.is_org_visible = true
     GROUP BY u.id, u.display_name, u.email, u.team_ids
     ORDER BY total_pnl DESC`,
    [orgId, start, end],
  );

  // Daily sparkline for each trader (last 10 days)
  const sparklines = await query<{ user_id: string; snapshot_date: string; daily_pnl: string }>(
    `SELECT user_id, snapshot_date, daily_pnl::text
     FROM performance_snapshots
     WHERE org_id = $1 AND snapshot_date >= CURRENT_DATE - 10
     ORDER BY user_id, snapshot_date`,
    [orgId],
  );

  const sparklineMap: Record<string, Array<{ date: string; pnl: number }>> = {};
  for (const row of sparklines) {
    if (!sparklineMap[row.user_id]) sparklineMap[row.user_id] = [];
    sparklineMap[row.user_id].push({ date: row.snapshot_date, pnl: Number(row.daily_pnl) });
  }

  const result = traders.map(t => ({
    ...t,
    total_pnl:     Number(t.total_pnl),
    trades_count:  Number(t.trades_count),
    winning_trades: Number(t.winning_trades),
    volume_traded: Number(t.volume_traded),
    sharpe_ratio:  t.sharpe_ratio ? Number(t.sharpe_ratio) : null,
    max_drawdown:  t.max_drawdown  ? Number(t.max_drawdown)  : null,
    win_rate:      Number(t.trades_count) > 0
      ? Number(t.winning_trades) / Number(t.trades_count)
      : 0,
    sparkline: sparklineMap[t.user_id] ?? [],
  }));

  res.json({ traders: result, period, start, end });
});

// GET /api/admin/performance/traders/:userId
router.get('/traders/:userId', async (req, res) => {
  const { userId } = req.params;
  const { period = '1m' } = req.query as Record<string, string>;
  const { start, end } = getPeriodDates(period);

  const [user] = await query<{
    id: string; display_name: string; email: string;
    org_role: string; team_ids: string[]; created_at: string;
  }>(
    `SELECT id, display_name, email, org_role, team_ids, created_at
     FROM users WHERE id = $1 AND org_id = $2`,
    [userId, req.adminUser.orgId],
  );
  if (!user) { res.status(404).json({ error: 'Trader not found' }); return; }

  const snapshots = await query<{
    snapshot_date: string; daily_pnl: string; cumulative_pnl: string;
    trades_count: number; winning_trades: number; volume_traded: string;
    sharpe_ratio: string | null; max_drawdown: string | null;
  }>(
    `SELECT snapshot_date, daily_pnl::text, cumulative_pnl::text, trades_count,
            winning_trades, volume_traded::text, sharpe_ratio::text, max_drawdown::text
     FROM performance_snapshots
     WHERE user_id = $1 AND snapshot_date BETWEEN $2 AND $3
     ORDER BY snapshot_date`,
    [userId, start, end],
  );

  const trades = await query<{
    id: string; ticker: string; side: string; quantity: number;
    price: string; status: string; created_at: string;
  }>(
    `SELECT id, ticker, side, quantity, price::text, status, created_at
     FROM orders WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
     ORDER BY created_at DESC LIMIT 100`,
    [userId, new Date(start).toISOString(), new Date(end + 'T23:59:59').toISOString()],
  );

  res.json({ user, snapshots, trades, period });
});

// GET /api/admin/performance/analysts
router.get('/analysts', async (req, res) => {
  const { period = '1m' } = req.query as Record<string, string>;
  const { start, end } = getPeriodDates(period);
  const orgId = req.adminUser.orgId;

  const analysts = await query<{
    user_id: string; display_name: string; email: string; team_ids: string[];
    doc_count: string; last_doc_at: string | null;
  }>(
    `SELECT u.id AS user_id, u.display_name, u.email, u.team_ids,
            COUNT(d.id)::text AS doc_count,
            MAX(d.created_at) AS last_doc_at
     FROM users u
     LEFT JOIN documents d ON d.user_id = u.id
       AND d.created_at BETWEEN $2 AND $3
     WHERE u.org_id = $1 AND u.is_active = true AND u.is_org_visible = true
     GROUP BY u.id, u.display_name, u.email, u.team_ids
     ORDER BY doc_count DESC`,
    [orgId, new Date(start).toISOString(), new Date(end + 'T23:59:59').toISOString()],
  );

  res.json({ analysts, period });
});

// GET /api/admin/performance/sessions
router.get('/sessions', async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const orgId = req.adminUser.orgId;
  const start = from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const end   = to   ?? new Date().toISOString().slice(0, 10);

  const sessions = await query<{
    id: string; session_date: string; total_pnl: string | null;
    total_volume: string | null; active_traders: number | null;
    total_trades: number | null; status: string; generated_at: string | null;
  }>(
    `SELECT id, session_date, total_pnl::text, total_volume::text,
            active_traders, total_trades, status, generated_at
     FROM session_summaries
     WHERE org_id = $1 AND session_date BETWEEN $2 AND $3
     ORDER BY session_date DESC`,
    [orgId, start, end],
  );
  res.json({ sessions });
});

// GET /api/admin/performance/sessions/:date
router.get('/sessions/:date', async (req, res) => {
  const rows = await query<{
    id: string; session_date: string; total_pnl: string | null;
    active_traders: number | null; total_trades: number | null;
    status: string; generated_at: string | null; ai_content: string | null;
  }>(
    `SELECT ss.id, ss.session_date, ss.total_pnl::text, ss.active_traders,
            ss.total_trades, ss.status, ss.generated_at, ai.raw_response AS ai_content
     FROM session_summaries ss
     LEFT JOIN ai_analyses ai ON ai.id = ss.ai_analysis_id
     WHERE ss.org_id = $1 AND ss.session_date = $2`,
    [req.adminUser.orgId, req.params.date],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json({ summary: rows[0] });
});

// POST /api/admin/performance/sessions/:date/generate
router.post('/sessions/:date/generate', async (req, res) => {
  const orgId = req.adminUser.orgId;
  const date  = req.params.date;

  await query(
    `INSERT INTO session_summaries (org_id, session_date, status)
     VALUES ($1, $2, 'generating')
     ON CONFLICT (org_id, session_date) DO UPDATE SET status = 'generating'`,
    [orgId, date],
  );

  res.json({ status: 'generating', date });
});

export default router;
