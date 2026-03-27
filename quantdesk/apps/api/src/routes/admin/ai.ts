import { Router } from 'express';
import type { Response } from 'express';
import { query } from '../../db/postgres';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { redisPublisher } from '../../services/cache/pubsub';
import { getModel, setupSse, toGeminiMessages, streamGemini } from '../../services/ai/geminiClient';

const router = Router();
router.use(requireAdminAuth);

async function checkAiRateLimit(adminId: string, res: Response): Promise<boolean> {
  const key = `rate:admin_ai:${adminId}`;
  const count = await redisPublisher.incr(key);
  if (count === 1) await redisPublisher.expire(key, 60);
  if (count > 10) {
    res.status(429).json({ error: 'AI rate limit: 10 requests/minute' });
    return false;
  }
  return true;
}

async function streamGeminiAdmin(
  res: Response,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const messages = toGeminiMessages([{ role: 'user', content: userMessage }]);
  return streamGemini(res, systemPrompt, messages);
}

// POST /api/admin/ai/analyze/trader/:userId
router.post('/analyze/trader/:userId', async (req, res) => {
  if (!(await checkAiRateLimit(req.adminUser.id, res))) return;

  const { period = '1m', forceRefresh = false } = req.body as {
    period?: string; forceRefresh?: boolean;
  };
  const { userId }    = req.params;
  const { orgId, id: adminId } = req.adminUser;

  const cacheKey = `ai:trader:${userId}:${period}`;
  if (!forceRefresh) {
    const cached = await redisPublisher.get(cacheKey);
    if (cached) { res.json({ analysis: cached, fromCache: true }); return; }
  }

  const [trader] = await query<{
    display_name: string; org_role: string; created_at: string;
  }>(
    `SELECT display_name, org_role, created_at FROM users WHERE id = $1 AND org_id = $2`,
    [userId, orgId],
  );
  if (!trader) { res.status(404).json({ error: 'Trader not found' }); return; }

  const snapshots = await query<{
    snapshot_date: string; daily_pnl: string; trades_count: number; winning_trades: number;
  }>(
    `SELECT snapshot_date, daily_pnl::text, trades_count, winning_trades
     FROM performance_snapshots WHERE user_id = $1 ORDER BY snapshot_date DESC LIMIT 30`,
    [userId],
  );

  const trades = await query<{ ticker: string; side: string; quantity: number; price: string; created_at: string }>(
    `SELECT ticker, side, quantity, price::text, created_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );

  const totalPnl = snapshots.reduce((s, r) => s + Number(r.daily_pnl), 0);
  const totalTrades = snapshots.reduce((s, r) => s + r.trades_count, 0);
  const winningTrades = snapshots.reduce((s, r) => s + r.winning_trades, 0);
  const winRate = totalTrades > 0
    ? ((winningTrades / totalTrades) * 100).toFixed(1)
    : 'N/A';

  const systemPrompt =
    `You are a senior risk officer and performance analyst at an institutional trading firm. ` +
    `Provide a professional, rigorous performance review. Be honest — if performance is poor, say so clearly but constructively. ` +
    `Always ground observations in the specific numbers provided. ` +
    `Format your response with these exact section headers: ` +
    `EXECUTIVE SUMMARY, PERFORMANCE METRICS, STRENGTHS, AREAS OF CONCERN, RISK PROFILE, RECOMMENDATIONS. ` +
    `Use bullet points within each section. Be concise and precise.`;

  const userMessage =
    `Analyze the performance of ${trader.display_name}, ${trader.org_role} for the period [${period}].\n\n` +
    `Performance Summary:\n` +
    `- Total P&L: $${totalPnl.toFixed(0)}\n` +
    `- Total Trades: ${totalTrades}\n` +
    `- Win Rate: ${winRate}%\n` +
    `- Daily P&L (recent): ${snapshots.slice(0, 10).map(s => `${s.snapshot_date}: $${s.daily_pnl}`).join(', ')}\n\n` +
    `Recent trades: ${JSON.stringify(trades.slice(0, 20))}\n\n` +
    `Provide a comprehensive professional performance analysis.`;

  const fullText = await streamGeminiAdmin(res, systemPrompt, userMessage);

  await redisPublisher.set(cacheKey, fullText, 'EX', 1800);
  await query(
    `INSERT INTO ai_analyses
       (org_id, analysis_type, subject_user_id, period_end, raw_response, model_used, generated_by)
     VALUES ($1, 'trader_performance', $2, CURRENT_DATE, $3, 'gemini-2.0-flash', $4)`,
    [orgId, userId, fullText, adminId],
  ).catch(() => {});
});

// POST /api/admin/ai/analyze/analyst/:userId
router.post('/analyze/analyst/:userId', async (req, res) => {
  if (!(await checkAiRateLimit(req.adminUser.id, res))) return;

  const { userId }    = req.params;
  const { orgId, id: adminId } = req.adminUser;

  const [analyst] = await query<{ display_name: string; org_role: string }>(
    `SELECT display_name, org_role FROM users WHERE id = $1 AND org_id = $2`,
    [userId, orgId],
  );
  if (!analyst) { res.status(404).json({ error: 'Analyst not found' }); return; }

  const docs = await query<{ title: string; doc_type: string; created_at: string }>(
    `SELECT title, doc_type, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );

  const systemPrompt =
    `You are a research director evaluating an analyst's output and effectiveness. ` +
    `Focus on research quality, coverage depth, and impact on trading decisions. ` +
    `Use section headers: EXECUTIVE SUMMARY, RESEARCH OUTPUT, COVERAGE ANALYSIS, ` +
    `STRENGTHS, AREAS OF CONCERN, RECOMMENDATIONS. Use bullet points. Be concise.`;

  const userMessage =
    `Analyze the research performance of ${analyst.display_name}, ${analyst.org_role}.\n\n` +
    `Documents published (last 30 days): ${docs.length}\n` +
    `Recent research: ${JSON.stringify(docs.slice(0, 10))}\n\n` +
    `Provide a professional analyst performance review.`;

  const fullText = await streamGeminiAdmin(res, systemPrompt, userMessage);

  await query(
    `INSERT INTO ai_analyses
       (org_id, analysis_type, subject_user_id, period_end, raw_response, model_used, generated_by)
     VALUES ($1, 'analyst_performance', $2, CURRENT_DATE, $3, 'gemini-2.0-flash', $4)`,
    [orgId, userId, fullText, adminId],
  ).catch(() => {});
});

// POST /api/admin/ai/analyze/team
router.post('/analyze/team', async (req, res) => {
  if (!(await checkAiRateLimit(req.adminUser.id, res))) return;

  const { orgId, id: adminId } = req.adminUser;
  const [org] = await query<{ display_name: string }>(
    'SELECT display_name FROM organizations WHERE id = $1', [orgId],
  );

  const members = await query<{
    display_name: string; org_role: string; doc_count: string; total_pnl: string;
  }>(
    `SELECT u.display_name, u.org_role,
            COUNT(DISTINCT d.id)::text AS doc_count,
            COALESCE(SUM(ps.daily_pnl), 0)::text AS total_pnl
     FROM users u
     LEFT JOIN documents d ON d.user_id = u.id AND d.created_at > NOW() - INTERVAL '1 month'
     LEFT JOIN performance_snapshots ps ON ps.user_id = u.id
       AND ps.snapshot_date > CURRENT_DATE - 30
     WHERE u.org_id = $1 AND u.is_active = true AND u.is_org_visible = true
     GROUP BY u.id, u.display_name, u.org_role
     ORDER BY total_pnl DESC`,
    [orgId],
  );

  const systemPrompt =
    `You are a Chief Investment Officer preparing a combined team performance analysis. ` +
    `Analyze both trading and research teams together. Focus on collaboration, ` +
    `research impact on trades, and overall team health. Be direct and data-driven. ` +
    `Use sections: EXECUTIVE SUMMARY, TRADING PERFORMANCE, RESEARCH ACTIVITY, ` +
    `TRADER-ANALYST COLLABORATION, TEAM HEALTH, RECOMMENDATIONS.`;

  const userMessage =
    `Analyze the combined team performance for ${org?.display_name ?? 'the organization'}.\n\n` +
    `Team data: ${JSON.stringify(members)}\n\n` +
    `Provide a comprehensive combined team analysis.`;

  const fullText = await streamGeminiAdmin(res, systemPrompt, userMessage);

  await query(
    `INSERT INTO ai_analyses
       (org_id, analysis_type, period_end, raw_response, model_used, generated_by)
     VALUES ($1, 'team_combined', CURRENT_DATE, $2, 'gemini-2.0-flash', $3)`,
    [orgId, fullText, adminId],
  ).catch(() => {});
});

// POST /api/admin/ai/askb
router.post('/askb', async (req, res) => {
  if (!(await checkAiRateLimit(req.adminUser.id, res))) return;

  const { message, conversationHistory = [] } = req.body as {
    message: string;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  const { orgId } = req.adminUser;
  const [org]     = await query<{ display_name: string }>(
    'SELECT display_name FROM organizations WHERE id = $1', [orgId],
  );

  const [{ count: memberCount }] = await query<{ count: string }>(
    'SELECT COUNT(*) FROM users WHERE org_id = $1 AND is_active = true', [orgId],
  );
  const [{ total: weekPnl }] = await query<{ total: string }>(
    `SELECT COALESCE(SUM(daily_pnl), 0)::text AS total FROM performance_snapshots
     WHERE org_id = $1 AND snapshot_date >= CURRENT_DATE - 7`, [orgId],
  );

  const systemPrompt =
    `You are an AI assistant embedded in the administrator control panel of QuantDesk, ` +
    `an institutional trading terminal. You have access to organizational data for ` +
    `${org?.display_name ?? 'the organization'}.\n\n` +
    `Organization context:\n` +
    `- Active members: ${memberCount}\n` +
    `- 7-day P&L: $${Number(weekPnl).toFixed(0)}\n\n` +
    `Answer questions about team performance, risk, activity, and organizational health. ` +
    `Always cite specific data points. Never reveal individual message content (chat is encrypted). ` +
    `Be direct and professional. Flag any concerns proactively.`;

  const geminiMessages = toGeminiMessages([
    ...conversationHistory,
    { role: 'user', content: message },
  ]);

  await streamGemini(res, systemPrompt, geminiMessages);
});

export default router;
