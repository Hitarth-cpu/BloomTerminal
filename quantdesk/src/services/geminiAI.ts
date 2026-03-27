import type { ParsedInquiry } from '../types';

const MODEL = 'gemini-2.0-flash';
const BASE = `/api/gemini/v1beta/models/${MODEL}:generateContent`;
const BASE_STREAM = `/api/gemini/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message { role: 'user' | 'assistant'; content: string; }

// ─── Streaming chat completion ─────────────────────────────────────────────────
export async function* streamChatCompletion(
  messages: Message[],
  systemPrompt: string,
  maxTokens = 1024,
): AsyncGenerator<string> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(BASE_STREAM, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const event = JSON.parse(data);
        const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text as string;
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

// ─── Non-streaming call ────────────────────────────────────────────────────────
async function callGemini(system: string, userContent: string, maxTokens = 512): Promise<string> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── IB Message Parser ─────────────────────────────────────────────────────────
export async function parseIBMessage(rawMessage: string): Promise<ParsedInquiry> {
  const fallback: ParsedInquiry = {
    ticker: null, side: null, quantity: null, price: null,
    currency: null, intent: null, confidence: 0,
  };

  try {
    const text = await callGemini(
      `You are a financial message parser for institutional chat. Extract trade inquiry data from messages.
Return ONLY valid JSON with these exact fields: ticker, side ("BUY"|"SELL"|null), quantity (number|null), price (number|null), currency (string|null), intent (string|null), confidence (0-1 float).
No explanation, only JSON.`,
      rawMessage,
      256,
    );

    const parsed = JSON.parse(text.trim());
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

// ─── News Summarization + Sentiment ───────────────────────────────────────────
export async function summarizeNews(
  headline: string,
  body: string,
): Promise<{ summary: string; sentiment: 'bullish' | 'bearish' | 'neutral' }> {
  try {
    const text = await callGemini(
      `You are a financial news analyst. Summarize news in 1-2 sentences and classify market sentiment.
Return ONLY valid JSON: { "summary": "...", "sentiment": "bullish"|"bearish"|"neutral" }. No explanation.`,
      `Headline: ${headline}\n\nBody: ${body}`,
      128,
    );

    const parsed = JSON.parse(text.trim());
    return {
      summary: parsed.summary ?? headline,
      sentiment: (['bullish', 'bearish', 'neutral'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral') as 'bullish' | 'bearish' | 'neutral',
    };
  } catch {
    return { summary: headline, sentiment: 'neutral' };
  }
}

// ─── ASKB System Prompt Builder ────────────────────────────────────────────────
export function buildASKBSystemPrompt(context: {
  ticker: string;
  price?: number;
  change?: number;
  changePct?: number;
  recentHeadlines?: string[];
}): string {
  const priceCtx = context.price
    ? `Current ${context.ticker}: $${context.price.toFixed(2)} (${context.changePct !== undefined ? (context.changePct >= 0 ? '+' : '') + context.changePct.toFixed(2) + '%' : 'N/A'})`
    : '';

  const newsCtx = context.recentHeadlines?.length
    ? `Recent headlines:\n${context.recentHeadlines.slice(0, 5).map(h => `• ${h}`).join('\n')}`
    : '';

  return `You are ASKB, an AI assistant embedded in QuantDesk — a professional financial terminal for institutional traders and quant analysts.

Terminal context: ${context.ticker} US Equity
${priceCtx}
${newsCtx}

Guidelines:
- Be precise, quantitative, and cite data sources with dates
- Format responses with markdown: headers, bullet points, tables
- Always label estimates vs actuals vs forecasts
- Add confidence level (HIGH/MEDIUM/LOW) to analysis
- Never give direct buy/sell recommendations — present analysis only
- Append: [AI-Generated — Verify Before Trading] to every response
- Today's date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
}
