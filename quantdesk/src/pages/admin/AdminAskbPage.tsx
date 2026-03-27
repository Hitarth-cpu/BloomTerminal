import { useState, useRef, useEffect } from 'react';
import { Send, Brain, RefreshCw } from 'lucide-react';
import { streamAdminAi } from '../../services/api/adminApi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const SUGGESTED = [
  'Who are the top 3 performers this month?',
  'Which trader has the highest concentration risk?',
  'What is the team\'s overall win rate?',
  'Summarize analyst research from last week',
  'Are there any traders approaching their daily loss limit?',
  'What sectors has the desk been most active in?',
];

export default function AdminAskbPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput('');

    const userMsg: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const assistantIdx = messages.length + 1;

    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);
    setBusy(true);

    try {
      await streamAdminAi(
        '/ai/askb',
        { message: content, conversationHistory: history },
        (chunk) => {
          setMessages(prev => prev.map((m, i) =>
            i === assistantIdx ? { ...m, content: m.content + chunk } : m,
          ));
        },
      );
    } catch (e: unknown) {
      setMessages(prev => prev.map((m, i) =>
        i === assistantIdx ? { ...m, content: `Error: ${(e as Error).message}`, streaming: false } : m,
      ));
    } finally {
      setMessages(prev => prev.map((m, i) =>
        i === assistantIdx ? { ...m, streaming: false } : m,
      ));
      setBusy(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={16} color="#ff3d3d" />
          <div>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Admin ASKB</h1>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>AI assistant with full org data access</p>
          </div>
        </div>
        <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--bg-border)', color: 'var(--text-muted)', fontSize: 10, padding: '4px 10px', borderRadius: 3, cursor: 'pointer' }}>
          <RefreshCw size={10} /> Clear
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {messages.length === 0 ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Brain size={36} color="#ff3d3d" style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7 }}>
                Ask anything about your organization's performance, risk, or activity.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SUGGESTED.map(q => (
                <button key={q} onClick={() => send(q)} style={{
                  padding: '6px 12px', fontSize: 11, background: 'var(--bg-secondary)',
                  border: '1px solid var(--bg-border)', color: 'var(--text-secondary)',
                  borderRadius: 3, cursor: 'pointer', textAlign: 'left', maxWidth: 280,
                }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{
              marginBottom: 16, display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: 4,
                background: m.role === 'user' ? 'rgba(255,61,61,0.12)' : 'var(--bg-secondary)',
                border: `1px solid ${m.role === 'user' ? 'rgba(255,61,61,0.3)' : 'var(--bg-border)'}`,
                fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}>
                {m.role === 'assistant' && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#ff3d3d', marginBottom: 6, letterSpacing: '0.1em' }}>
                    ASKB ADMIN
                  </div>
                )}
                {m.content}
                {m.streaming && (
                  <span style={{
                    display: 'inline-block', width: 8, height: 14, background: 'var(--accent-primary)',
                    marginLeft: 2, animation: 'blink 1s step-end infinite',
                    verticalAlign: 'text-bottom',
                  }} />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about performance, risk, activity, connections…"
          disabled={busy}
          style={{
            flex: 1, padding: '9px 12px', fontSize: 12,
            background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
            color: 'var(--text-primary)', borderRadius: 3, outline: 'none',
          }}
        />
        <button onClick={() => send()} disabled={busy || !input.trim()} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 18px', fontSize: 12, fontWeight: 700,
          background: busy ? 'var(--bg-tertiary, #222)' : '#ff3d3d',
          color: busy ? 'var(--text-muted)' : '#000',
          border: 'none', borderRadius: 3, cursor: busy ? 'not-allowed' : 'pointer',
        }}>
          <Send size={13} /> {busy ? '…' : 'ASK'}
        </button>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
