import { getModel } from '../ai/geminiClient';
import { query } from '../../db/postgres';

interface TagResult {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  tickers: string[];
  categories: string[];
  aiSummary: string;
}

class QuotaExceededError extends Error {
  constructor() { super('Gemini quota exceeded'); this.name = 'QuotaExceededError'; }
}

// Module-level cooldown: skip all tagging until this timestamp
let quotaExhaustedUntil = 0;

export async function tagNewsSentiment(newsItemId: string): Promise<void> {
  const [item] = await query<{ id: string; title: string; summary: string | null }>(
    'SELECT id, title, summary FROM news_items WHERE id = $1 AND sentiment IS NULL',
    [newsItemId],
  );
  if (!item) return;

  try {
    const model = getModel();
    const result = await model.generateContent({
      systemInstruction: { role: 'user', parts: [{ text: `You are a financial news sentiment classifier. Return ONLY valid JSON with no markdown:
{"sentiment":"bullish"|"bearish"|"neutral","confidence":0.0-1.0,"tickers":[],"categories":[],"aiSummary":"2 sentences max"}` }] },
      contents: [{ role: 'user', parts: [{ text: `Headline: ${item.title}\nSummary: ${item.summary ?? ''}` }] }],
    });

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const tagResult: TagResult = JSON.parse(jsonMatch[0]);

    await query(
      `UPDATE news_items SET sentiment=$1, ai_summary=$2,
       tickers = CASE WHEN tickers = '{}' THEN $3::text[] ELSE tickers END,
       categories = CASE WHEN categories = '{}' THEN $4::text[] ELSE categories END
       WHERE id=$5`,
      [tagResult.sentiment, tagResult.aiSummary, tagResult.tickers, tagResult.categories, item.id],
    );

    // Publish per-ticker events
    for (const ticker of tagResult.tickers) {
      const { redisPublisher } = await import('../cache/pubsub');
      await redisPublisher.publish(
        `news:ticker:${ticker}`,
        JSON.stringify({ newsItemId, title: item.title, sentiment: tagResult.sentiment }),
      );
    }
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
      throw new QuotaExceededError();
    }
    console.warn(`[sentimentTagger] Failed for ${newsItemId}: ${msg}`);
  }
}

/** Tag recent untagged news items sequentially to avoid quota storms. */
export async function tagRecentUntagged(limit = 20): Promise<void> {
  if (Date.now() < quotaExhaustedUntil) {
    const minutesLeft = Math.ceil((quotaExhaustedUntil - Date.now()) / 60_000);
    console.log(`[sentimentTagger] Quota cooldown active — skipping (${minutesLeft}m remaining)`);
    return;
  }

  const items = await query<{ id: string }>(
    'SELECT id FROM news_items WHERE sentiment IS NULL ORDER BY created_at DESC LIMIT $1',
    [limit],
  );

  for (const item of items) {
    try {
      await tagNewsSentiment(item.id);
      // Small delay between requests to stay within rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        quotaExhaustedUntil = Date.now() + 60 * 60 * 1000; // 1-hour cooldown
        console.warn('[sentimentTagger] Quota exceeded — pausing sentiment tagging for 1 hour');
        return; // Stop processing remaining items
      }
      // Non-quota errors are already logged inside tagNewsSentiment
    }
  }
}

/** Alias for backward compatibility */
export const tagRecentUntaggeredNews = tagRecentUntagged;
