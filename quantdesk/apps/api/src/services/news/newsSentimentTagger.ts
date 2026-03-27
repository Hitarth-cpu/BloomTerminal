import { getModel } from '../ai/geminiClient';
import { query } from '../../db/postgres';

interface TagResult {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  tickers: string[];
  categories: string[];
  aiSummary: string;
}

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
    console.warn(`[sentimentTagger] Failed for ${newsItemId}: ${(err as Error).message}`);
  }
}

/** Tag recent untagged news items. Exported as both names for compatibility. */
export async function tagRecentUntagged(limit = 20): Promise<void> {
  const items = await query<{ id: string }>(
    'SELECT id FROM news_items WHERE sentiment IS NULL ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  await Promise.allSettled(items.map(i => tagNewsSentiment(i.id)));
}

/** Alias for backward compatibility */
export const tagRecentUntaggeredNews = tagRecentUntagged;
