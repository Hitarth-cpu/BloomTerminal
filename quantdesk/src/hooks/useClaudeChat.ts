import { useState, useCallback } from 'react';
import { streamChatCompletion, buildASKBSystemPrompt } from '../services/geminiAI';
import type { PriceData } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface UseClaudeChatOptions {
  ticker: string;
  priceData?: PriceData | null;
  recentHeadlines?: string[];
}

export function useClaudeChat({ ticker, priceData, recentHeadlines }: UseClaudeChatOptions) {
  const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `**ASKB Terminal AI** — Ready\n\nI can help with company research, market analysis, risk assessment, and trade ideas. Ask me anything about **${ticker}** or the broader market.\n\n*[AI-Generated — Verify Before Trading]*`,
      timestamp: Date.now(),
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText.trim(),
      timestamp: Date.now(),
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      // Build conversation history for Claude (exclude welcome message, last N turns)
      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      history.push({ role: 'user', content: userText.trim() });

      const systemPrompt = buildASKBSystemPrompt({
        ticker,
        price: priceData?.last,
        changePct: priceData?.changePct,
        recentHeadlines,
      });

      let fullContent = '';

      // If mock mode or no Anthropic key configured, use a simulated response
      if (isMockMode) {
        await new Promise(r => setTimeout(r, 800));
        fullContent = getMockResponse(userText, ticker, priceData);
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: fullContent, isStreaming: false } : m
        ));
      } else {
        // Real Claude streaming
        for await (const chunk of streamChatCompletion(history, systemPrompt)) {
          fullContent += chunk;
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: fullContent } : m
          ));
        }
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        ));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? {
          ...m,
          content: `**Error connecting to Gemini API**\n\n${errMsg}\n\nPlease check:\n• \`GEMINI_API_KEY\` is set in \`.env.local\`\n• Vite dev server is running (proxy handles CORS)\n\n*[AI-Generated — Verify Before Trading]*`,
          isStreaming: false,
        } : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, ticker, priceData, recentHeadlines, isMockMode]);

  const clearHistory = useCallback(() => {
    setMessages(prev => [prev[0]]); // keep welcome message
  }, []);

  return { messages, sendMessage, isStreaming, clearHistory };
}

// ─── Mock fallback ─────────────────────────────────────────────────────────────
function getMockResponse(question: string, ticker: string, price?: PriceData | null): string {
  const p = price?.last?.toFixed(2) ?? 'N/A';
  const chg = price?.changePct?.toFixed(2) ?? '0.00';
  const isUp = (price?.changePct ?? 0) >= 0;

  return `## Analysis: ${ticker} [AI-Generated — Verify Before Trading]

**Current price:** $${p} (${isUp ? '+' : ''}${chg}%)

### Response to: "${question.slice(0, 60)}${question.length > 60 ? '...' : ''}"

**Key Points:**
• ${ticker} is currently trading ${isUp ? 'above' : 'below'} yesterday's close
• Market sentiment appears ${isUp ? 'constructive' : 'cautious'} based on recent price action
• Volume and momentum indicators should be reviewed before taking any position

**Risk Factors:**
• Macro environment remains uncertain with Fed policy in focus
• Sector rotation continues to impact relative performance
• Monitor earnings calendar for upcoming catalysts

**Suggested Follow-ups:**
1. What is the technical outlook for ${ticker}?
2. How does ${ticker} compare to sector peers?
3. What are the key upcoming catalysts?

*Confidence: MEDIUM | Source: Mock Data | [AI-Generated — Verify Before Trading]*
*Note: Connect Gemini API key for real AI analysis.*`;
}
