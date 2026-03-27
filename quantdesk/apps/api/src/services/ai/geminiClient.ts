import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Response } from 'express';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

export function getModel(modelName = 'gemini-2.0-flash') {
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Set up SSE headers on an Express response.
 */
export function setupSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

/**
 * Stream a Gemini response to an SSE client.
 * Returns the full concatenated text.
 */
export async function streamGemini(
  res: Response,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
): Promise<string> {
  setupSse(res);

  const model = getModel();
  const chat = model.startChat({
    systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
    history: messages.slice(0, -1),
  });

  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessageStream(lastMessage.parts[0].text);

  let fullText = '';
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      fullText += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
  return fullText;
}

/**
 * Convert Anthropic-style role/content messages to Gemini format.
 */
export function toGeminiMessages(
  msgs: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  return msgs.map(m => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }));
}
