import { Router } from 'express';
import type { Request, Response } from 'express';
import { getModel, setupSse, toGeminiMessages } from '../services/ai/geminiClient';
import { redisPublisher } from '../services/cache/pubsub';
import { query } from '../db/postgres';

const router = Router();

async function checkRateLimit(userId: string, res: Response): Promise<boolean> {
  try {
    const key = `rate:askb:${userId}`;
    const count = await redisPublisher.incr(key);
    if (count === 1) await redisPublisher.expire(key, 60);
    if (count > 15) {
      res.status(429).json({ error: 'Rate limit: 15 requests/minute' });
      return false;
    }
  } catch {
    // Redis unavailable — allow the request rather than block the user
    console.warn('[askb] Rate limit check skipped: Redis unavailable');
  }
  return true;
}

// POST /api/askb/stream — SSE streaming ASKB for traders/analysts
router.post('/stream', async (req: Request, res: Response) => {
  if (!(await checkRateLimit(req.user.id, res))) return;

  const { message, history = [], ticker } = req.body as {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    ticker?: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message required' });
    return;
  }

  // Gather user context
  const user = req.user;
  let tickerContext = '';
  if (ticker) {
    const [sec] = await query<{ name: string; sector: string; industry: string }>(
      'SELECT name, sector, industry FROM securities WHERE ticker = $1 LIMIT 1',
      [ticker],
    ).catch(() => [null]);
    if (sec) tickerContext = `\nActive ticker: ${ticker} (${sec.name}) — Sector: ${sec.sector}`;
  }

  // Fetch recent news for context
  const recentNews = await query<{ title: string; sentiment: string }>(
    `SELECT title, sentiment FROM news_items
     WHERE published_at > NOW() - INTERVAL '24 hours'
     ORDER BY published_at DESC LIMIT 10`,
    [],
  ).catch(() => []);

  const newsContext = recentNews.length > 0
    ? `\n\nRecent market headlines (last 24h):\n${recentNews.map(n => `- ${n.title} [${n.sentiment ?? 'unrated'}]`).join('\n')}`
    : '';

  const systemPrompt =
    `You are ASKB, an investment-grade AI research assistant embedded in QuantDesk, ` +
    `an institutional trading terminal. You assist ${user.display_name} (${user.role ?? 'Trader'}) ` +
    `at ${user.firm ?? 'the firm'}.\n\n` +
    `Guidelines:\n` +
    `- Provide institutional-quality analysis: specific data points, numbers, percentages\n` +
    `- Structure responses with clear headers (##) and bullet points\n` +
    `- Always cite the basis for your analysis (earnings data, valuation multiples, macro data)\n` +
    `- Include a risk/reward assessment when making directional calls\n` +
    `- Be direct — no hedging language like "it depends" without following up with specifics\n` +
    `- Flag data freshness: note when information may be outdated\n` +
    `- End actionable responses with a confidence level (High/Medium/Low) and key caveats\n` +
    `- NEVER provide personal financial advice or guarantees\n` +
    `- ALWAYS include disclaimer: [AI-Generated — Verify Before Trading]` +
    tickerContext +
    newsContext;

  const geminiHistory = toGeminiMessages([
    ...history.slice(-10),
    { role: 'user', content: message },
  ]);

  setupSse(res);

  try {
    const model = getModel();
    const chat = model.startChat({
      systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
      history: geminiHistory.slice(0, -1),
    });

    const lastMsg = geminiHistory[geminiHistory.length - 1];
    const result = await chat.sendMessageStream(lastMsg.parts[0].text);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    const msg = (err as Error).message ?? 'ASKB error';
    console.error('[askb] Streaming error:', msg);
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// POST /api/askb — non-streaming fallback
router.post('/', async (req: Request, res: Response) => {
  if (!(await checkRateLimit(req.user.id, res))) return;

  const { message, history = [] } = req.body as {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message required' });
    return;
  }

  try {
    const model = getModel();
    const geminiMessages = toGeminiMessages([
      ...history.slice(-10),
      { role: 'user', content: message },
    ]);

    const chat = model.startChat({
      systemInstruction: { role: 'user', parts: [{ text: 'You are ASKB, an investment-grade AI research assistant. Be direct and professional.' }] },
      history: geminiMessages.slice(0, -1),
    });

    const lastMsg = geminiMessages[geminiMessages.length - 1];
    const result = await chat.sendMessage(lastMsg.parts[0].text);
    const text = result.response.text();

    res.json({ response: text });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message ?? 'ASKB error' });
  }
});

export default router;
