import { useState, useRef, useEffect } from 'react';
import { Send, Globe, Trash2, X } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';
import { useClaudeChat } from '../../hooks/useClaudeChat';
import { useLivePrice } from '../../hooks/useLivePrice';
import { useMarketNews } from '../../hooks/useFinnhubNews';

const SUGGESTED_PROMPTS = [
  "What are the key growth drivers for this stock?",
  "Summarize Fed commentary impact on rate-sensitive sectors",
  "Show tech stocks with P/E < 20 and revenue growth > 15%",
  "Generate 3 long/short equity pairs in energy sector",
  "What are key tail risks for a tech-heavy portfolio?",
];

export function ASKBPanel() {
  const { toggleAskb, activeTicker } = useTerminalStore();
  const { price: priceData } = useLivePrice(activeTicker);
  const { data: newsItems } = useMarketNews();
  const recentHeadlines = newsItems?.slice(0, 5).map(n => n.headline);

  const { messages, sendMessage, isStreaming, clearHistory } = useClaudeChat({
    ticker: activeTicker,
    priceData,
    recentHeadlines,
  });

  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (text?: string) => {
    const content = text || input.trim();
    if (!content || isStreaming) return;
    setInput('');
    sendMessage(content);
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600, margin: '6px 0 2px' }}>{line.replace(/\*\*/g, '')}</div>;
      }
      if (line.startsWith('## ')) {
        return <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 700, margin: '8px 0 3px' }}>{line.slice(3)}</div>;
      }
      if (line.startsWith('### ')) {
        return <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--highlight)', fontWeight: 600, margin: '6px 0 2px' }}>{line.slice(4)}</div>;
      }
      if (line.startsWith('• ') || line.startsWith('* ') || line.startsWith('- ')) {
        return <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 12, marginBottom: 1 }}>• {line.slice(2)}</div>;
      }
      if (/^\d+\./.test(line)) {
        return <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--info)', paddingLeft: 12, marginBottom: 1 }}>{line}</div>;
      }
      if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
        return <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 6 }}>{line.replace(/\*/g, '')}</div>;
      }
      if (line.trim() === '') return <div key={i} style={{ height: 4 }} />;
      return <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>{line}</div>;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ai-badge">[AI]</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700 }}>ASKB — TERMINAL AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setWebSearch(!webSearch)}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: webSearch ? 'rgba(68,136,255,0.15)' : 'transparent', border: `1px solid ${webSearch ? 'rgba(68,136,255,0.4)' : 'var(--bg-border)'}`, borderRadius: 2, cursor: 'pointer' }}
          >
            <Globe size={9} color={webSearch ? 'var(--info)' : 'var(--text-muted)'} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: webSearch ? 'var(--info)' : 'var(--text-muted)' }}>WEB</span>
          </button>
          <button onClick={clearHistory} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <Trash2 size={11} color="var(--text-muted)" />
          </button>
          <button onClick={toggleAskb} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={12} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {/* Chat history */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'user' && (
              <div style={{ background: 'rgba(255,102,0,0.12)', border: '1px solid rgba(255,102,0,0.25)', padding: '5px 10px', maxWidth: '90%', borderRadius: 2 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-primary)' }}>{msg.content}</div>
              </div>
            )}
            {msg.role === 'assistant' && (
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)', padding: '8px 10px', maxWidth: '95%', borderRadius: 2 }}>
                {msg.isStreaming && msg.content === '' ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', animation: `skel 0.8s ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                ) : (
                  <>
                    {renderContent(msg.content)}
                    {msg.isStreaming && (
                      <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--accent-primary)', marginLeft: 2, animation: 'skel 0.8s infinite', verticalAlign: 'text-bottom' }} />
                    )}
                    {!msg.isStreaming && msg.content && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {['Open Chart', 'Add Watchlist', 'Export Note', 'Send via IB'].map(action => (
                          <button key={action} className="btn btn-secondary" style={{ fontSize: 8, padding: '1px 5px' }}>{action}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      <div style={{ padding: '4px 8px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: 4, overflow: 'auto', flexShrink: 0 }}>
        {SUGGESTED_PROMPTS.slice(0, 3).map(p => (
          <button
            key={p}
            onClick={() => handleSend(p)}
            disabled={isStreaming}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: 2, opacity: isStreaming ? 0.5 : 1 }}
          >
            {p.slice(0, 30)}...
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: 6, flexShrink: 0 }}>
        <textarea
          className="terminal-input"
          style={{ flex: 1, resize: 'none', height: 52, lineHeight: 1.4 }}
          placeholder="Ask anything about markets, companies, risk, or trade ideas... (Shift+Enter for newline)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button
          className="btn btn-primary"
          onClick={() => handleSend()}
          disabled={isStreaming || !input.trim()}
          style={{ height: 52, padding: '0 12px', opacity: isStreaming ? 0.5 : 1 }}
        >
          <Send size={12} />
        </button>
      </div>
      <div style={{ padding: '3px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>
        [AI-Generated — Verify Before Trading] | gemini-2.0-flash | F9 to close
      </div>
    </div>
  );
}
