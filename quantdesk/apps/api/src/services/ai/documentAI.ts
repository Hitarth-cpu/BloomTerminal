import { getModel } from './geminiClient';
import { query } from '../../db/postgres';
import { redisPublisher } from '../cache/pubsub';

export interface DocumentSummary {
  executiveSummary: string;
  keyPoints: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentJustification: string;
  keyMetrics: Array<{ name: string; reported: string; estimate: string | null; beat: boolean | null; note: string | null }>;
  risksIdentified: string[];
  keyQuotes: Array<{ speaker: string; quote: string; significance: string }>;
  highlights: Array<{ text: string; type: string; importance: number; charStart: number | null; charEnd: number | null }>;
}

export interface DocumentQAResponse {
  answer: string;
  supportingPoints: string[];
  citation: string;
  citedText: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string | null;
}

export async function generateDocumentSummary(documentId: string, forceRefresh = false): Promise<DocumentSummary> {
  const cacheKey = `ai:summary:${documentId}`;

  if (!forceRefresh) {
    const cached = await redisPublisher.get(cacheKey);
    if (cached) return JSON.parse(cached) as DocumentSummary;
  }

  const [doc] = await query<{
    title: string; doc_type: string; ticker: string | null;
    extracted_text: string | null; published_at: string | null; source: string | null;
  }>(
    'SELECT title, doc_type, ticker, extracted_text, published_at, source FROM documents WHERE id = $1',
    [documentId],
  );

  if (!doc) throw new Error('Document not found');

  const text = (doc.extracted_text ?? '').slice(0, 80_000);
  const ticker = doc.ticker ?? 'Unknown';
  const docType = doc.doc_type ?? 'document';
  const pubDate = doc.published_at ? new Date(doc.published_at).toDateString() : 'Unknown';

  const systemPrompt = `You are a senior equity research analyst at a top-tier investment bank reading a ${docType} for ${ticker} published on ${pubDate} by ${doc.source ?? 'Unknown'}.

Produce a structured, professional summary a portfolio manager can act on in 60 seconds.
Be specific — use exact numbers. Flag surprises. Be direct about sentiment.
Do NOT use vague language. Use the company name, not "the company".

Return ONLY valid JSON:
{
  "executiveSummary": "3-5 sentences with most important facts",
  "keyPoints": ["5-8 specific data-driven bullets"],
  "sentiment": "bullish|bearish|neutral",
  "sentimentJustification": "1 sentence",
  "keyMetrics": [{"name":"Revenue","reported":"$X","estimate":"$Y","beat":true,"note":null}],
  "risksIdentified": ["3-5 specific risks"],
  "keyQuotes": [{"speaker":"CEO Name","quote":"exact quote max 50 words","significance":"why it matters"}],
  "highlights": [{"text":"exact passage","type":"key_metric|risk_factor|guidance|catalyst|management_comment|price_target","importance":8,"charStart":null,"charEnd":null}]
}`;

  const model = getModel();
  const result = await model.generateContent({
    systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: `Document: ${doc.title}\n\n${text}` }] }],
  });

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response');

  const summary: DocumentSummary = JSON.parse(jsonMatch[0]);

  // Store in DB
  await query(
    `INSERT INTO document_summaries
     (document_id, executive_summary, key_points, sentiment, sentiment_justification, key_metrics, risks_identified, key_quotes, highlights, model_used)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (document_id) DO UPDATE SET
       executive_summary=$2, key_points=$3, sentiment=$4, sentiment_justification=$5,
       key_metrics=$6, risks_identified=$7, key_quotes=$8, highlights=$9, model_used=$10, generated_at=NOW()`,
    [documentId, summary.executiveSummary, JSON.stringify(summary.keyPoints),
     summary.sentiment, summary.sentimentJustification, JSON.stringify(summary.keyMetrics),
     JSON.stringify(summary.risksIdentified), JSON.stringify(summary.keyQuotes),
     JSON.stringify(summary.highlights), 'gemini-2.0-flash'],
  );

  // Store highlights
  if (summary.highlights?.length) {
    await query('DELETE FROM document_highlights WHERE document_id = $1', [documentId]);
    for (const h of summary.highlights) {
      await query(
        `INSERT INTO document_highlights (document_id, text_excerpt, highlight_type, importance, char_start, char_end)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [documentId, h.text, h.type, h.importance, h.charStart, h.charEnd],
      ).catch(() => {});
    }
  }

  await redisPublisher.set(cacheKey, JSON.stringify(summary), 'EX', 3600);
  return summary;
}

export async function askDocumentQuestion(
  documentId: string,
  question: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<DocumentQAResponse> {
  const [doc] = await query<{ title: string; doc_type: string; ticker: string | null }>(
    'SELECT title, doc_type, ticker FROM documents WHERE id = $1',
    [documentId],
  );
  if (!doc) throw new Error('Document not found');

  // Fetch relevant chunks via full-text search fallback
  const chunks = await query<{ chunk_text: string; chunk_index: number }>(
    `SELECT chunk_text, chunk_index FROM document_chunks
     WHERE document_id = $1
     ORDER BY ts_rank(to_tsvector('english', chunk_text), plainto_tsquery('english', $2)) DESC
     LIMIT 8`,
    [documentId, question],
  );

  const chunkedContext = chunks.map((c, i) => `[Passage ${i + 1}]: ${c.chunk_text}`).join('\n\n');

  // Get cached summary for context
  const cachedSummary = await redisPublisher.get(`ai:summary:${documentId}`);
  const summaryContext = cachedSummary
    ? `Document Summary: ${(JSON.parse(cachedSummary) as DocumentSummary).executiveSummary}`
    : '';

  const systemPrompt = `You are a financial document analyst answering questions about a specific ${doc.doc_type} for ${doc.ticker ?? 'unknown ticker'}.

Rules:
- Answer ONLY from information in the provided document context.
- If not found, say "This specific information is not found in the document."
- Always cite the specific passage or section.
- Use exact numbers when available.
- Keep answers concise: 2-4 sentences + supporting bullets.

Return valid JSON:
{
  "answer": "direct answer 2-4 sentences",
  "supportingPoints": ["2-4 specific data points from the document"],
  "citation": "section/page reference",
  "citedText": "exact quote from document max 100 chars",
  "confidence": "high|medium|low",
  "confidenceReason": null
}`;

  // Convert conversation history to Gemini format
  const geminiHistory = conversationHistory.map(m => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }));

  const model = getModel();
  const chat = model.startChat({
    systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
    history: geminiHistory,
  });

  const result = await chat.sendMessage(
    `${summaryContext}\n\nRelevant Passages:\n${chunkedContext}\n\nQuestion: ${question}`,
  );

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      answer: responseText,
      supportingPoints: [],
      citation: 'Document',
      citedText: '',
      confidence: 'medium',
      confidenceReason: null,
    };
  }

  return JSON.parse(jsonMatch[0]) as DocumentQAResponse;
}

export async function generateResearchNote(documentId: string): Promise<string> {
  const [doc] = await query<{ title: string; doc_type: string; ticker: string | null; extracted_text: string | null }>(
    'SELECT title, doc_type, ticker, extracted_text FROM documents WHERE id = $1',
    [documentId],
  );
  if (!doc) throw new Error('Document not found');

  const text = (doc.extracted_text ?? '').slice(0, 60_000);

  const model = getModel();
  const result = await model.generateContent({
    systemInstruction: { role: 'user', parts: [{ text: `You are a sell-side equity research analyst writing a research note based on source material.
Format it exactly like an institutional research note with these sections:

INVESTMENT SUMMARY | KEY TAKEAWAYS | FINANCIAL HIGHLIGHTS | INVESTMENT THESIS | RISKS | ESTIMATE CHANGES | CONCLUSION

Use professional sell-side language. Be specific and quantitative. Every sentence must count.` }] },
    contents: [{ role: 'user', parts: [{ text: `${doc.title}\n\n${text}` }] }],
  });

  const note = result.response.text();

  await query(
    `INSERT INTO research_notes (user_id, document_id, title, content, ticker, note_type)
     SELECT d.user_id, $1, $2, $3, d.ticker, 'ai_generated'
     FROM documents d WHERE d.id = $1`,
    [documentId, `Research Note: ${doc.title}`, note],
  ).catch(() => {});

  return note;
}
