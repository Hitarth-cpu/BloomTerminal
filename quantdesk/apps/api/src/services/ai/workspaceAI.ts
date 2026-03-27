import { getModel } from './geminiClient';
import { query } from '../../db/postgres';
import { redisPublisher } from '../cache/pubsub';
import { createHash } from 'crypto';

export interface ComparisonTable {
  question: string;
  columns: string[];
  rows: Array<{
    topic: string;
    values: Record<string, { content: string; sentiment: 'positive' | 'negative' | 'neutral'; sourceQuote: string | null }>;
  }>;
  summary: string;
  winner: string | null;
}

export async function compareDocuments(
  workspaceId: string,
  prompt: string,
  documentIds: string[],
): Promise<ComparisonTable> {
  const cacheKey = `ai:compare:${workspaceId}:${createHash('md5').update(prompt).digest('hex')}`;
  const cached = await redisPublisher.get(cacheKey);
  if (cached) return JSON.parse(cached) as ComparisonTable;

  const docs = await Promise.all(documentIds.map(async id => {
    const [doc] = await query<{ id: string; title: string; ticker: string | null; published_at: string | null; extracted_text: string | null }>(
      'SELECT id, title, ticker, published_at, extracted_text FROM documents WHERE id = $1',
      [id],
    );
    if (!doc) return null;

    // Get cached summary
    const cached = await redisPublisher.get(`ai:summary:${id}`);
    const summary = cached ? JSON.parse(cached) as { executiveSummary: string } : null;

    // Get relevant chunks
    const chunks = await query<{ chunk_text: string }>(
      `SELECT chunk_text FROM document_chunks WHERE document_id = $1
       ORDER BY ts_rank(to_tsvector('english', chunk_text), plainto_tsquery('english', $2)) DESC LIMIT 5`,
      [id, prompt],
    );

    return {
      ticker: doc.ticker ?? doc.title,
      title: doc.title,
      date: doc.published_at,
      summaryText: summary?.executiveSummary ?? '',
      relevantPassages: chunks.map(c => c.chunk_text).join('\n---\n'),
      text: (doc.extracted_text ?? '').slice(0, 20_000),
    };
  }));

  const validDocs = docs.filter(Boolean) as NonNullable<typeof docs[0]>[];
  if (!validDocs.length) throw new Error('No valid documents found');

  const docContexts = validDocs.map(d => ({
    company: d.ticker,
    title: d.title,
    date: d.date,
    summary: d.summaryText,
    relevantPassages: d.relevantPassages,
  }));

  const model = getModel();
  const geminiResult = await model.generateContent({
    systemInstruction: { role: 'user', parts: [{ text: `You are a senior equity research analyst comparing multiple companies based on their financial documents.

For the given question, extract the answer from EACH company's document and present in a structured comparison.
Be specific — use exact numbers. Be consistent. If information is not found, state "Not disclosed in document."

Return ONLY valid JSON:
{
  "question": "original prompt",
  "columns": ["Company A","Company B"],
  "rows": [{"topic":"Revenue Growth","values":{"Company A":{"content":"12% YoY","sentiment":"positive","sourceQuote":"Revenue grew 12%"}}}],
  "summary": "2-3 sentence synthesis",
  "winner": "Company name or null"
}` }] },
    contents: [{ role: 'user', parts: [{ text: `Compare these ${validDocs.length} companies on: ${prompt}\n\n${JSON.stringify(docContexts, null, 2)}` }] }],
  });

  const responseText = geminiResult.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse comparison response');

  const result: ComparisonTable = JSON.parse(jsonMatch[0]);

  await redisPublisher.set(cacheKey, JSON.stringify(result), 'EX', 1800);

  // Save prompt to workspace
  await query(
    'UPDATE workspaces SET prompts = array_append(prompts, $1), updated_at = NOW() WHERE id = $2',
    [prompt, workspaceId],
  ).catch(() => {});

  return result;
}
