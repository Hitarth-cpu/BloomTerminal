import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Globe, Trash2, Copy, ThumbsUp, ThumbsDown, RotateCcw,
  BookOpen, MessageSquare, Clock, Search, ChevronRight,
} from 'lucide-react';
import { streamAskb } from '../../services/api/researchApi';
import { useAuthStore } from '../../stores/authStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: number;
  feedback?: 'up' | 'down';
  webSearched?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  messages: Message[];
}

const SUGGESTED_PROMPTS = [
  { label: 'Market overview today',        prompt: 'Give me a comprehensive market overview for today, including major indices, sector rotation, and key themes.' },
  { label: 'Rate environment outlook',     prompt: 'Analyze the current interest rate environment and its outlook over the next 6-12 months.' },
  { label: 'Give me a trade idea',         prompt: 'Generate a high-conviction trade idea with entry, target, and stop loss, including the investment thesis.' },
  { label: 'Sector rotation opportunities',prompt: 'Which sectors are showing the most compelling rotation opportunities right now and why?' },
  { label: 'Fed policy impact',            prompt: 'Analyze the latest Fed communications and their impact on equity and fixed income markets.' },
  { label: 'Analyze AAPL',                 prompt: 'Provide a comprehensive analysis of Apple (AAPL) including fundamentals, technicals, and near-term catalysts.' },
];

// Minimal markdown renderer
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (buf: string[]) => {
    if (buf.length < 2) {
      buf.forEach((l, i) => nodes.push(<div key={`tbl-raw-${i}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{l}</div>));
      return;
    }
    const headers = buf[0].split('|').map(s => s.trim()).filter(Boolean);
    const rows = buf.slice(2).map(r => r.split('|').map(s => s.trim()).filter(Boolean));
    nodes.push(
      <div key={`table-${nodes.length}`} style={{ overflowX: 'auto', marginBottom: 10 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-secondary)' }}>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '4px 10px', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '4px 10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 10, verticalAlign: 'top' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.startsWith('|')) {
      tableBuffer.push(line);
      continue;
    } else if (tableBuffer.length > 0) {
      flushTable(tableBuffer);
      tableBuffer = [];
    }

    const key = `line-${i}`;
    if (line.startsWith('### ')) {
      nodes.push(<div key={key} style={{ fontSize: 12, fontWeight: 700, color: 'var(--highlight, #f59e0b)', margin: '10px 0 4px', fontFamily: 'var(--font-mono)' }}>{line.slice(4)}</div>);
    } else if (line.startsWith('## ')) {
      nodes.push(<div key={key} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', margin: '12px 0 4px', fontFamily: 'var(--font-mono)' }}>{line.slice(3)}</div>);
    } else if (line.startsWith('# ')) {
      nodes.push(<div key={key} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 6px', fontFamily: 'var(--font-mono)' }}>{line.slice(2)}</div>);
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      nodes.push(
        <div key={key} style={{ display: 'flex', gap: 6, marginBottom: 3, paddingLeft: 8, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1, fontSize: 11 }}>›</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{inlineMarkdown(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const [num, ...rest] = line.split('. ');
      nodes.push(
        <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 3, paddingLeft: 8 }}>
          <span style={{ color: 'var(--accent-primary)', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>{num}.</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{inlineMarkdown(rest.join('. '))}</span>
        </div>
      );
    } else if (line.startsWith('> ')) {
      nodes.push(
        <div key={key} style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: 10, margin: '6px 0', fontStyle: 'italic', fontSize: 11, color: 'var(--text-muted)' }}>
          {line.slice(2)}
        </div>
      );
    } else if (line.startsWith('```')) {
      // skip code fences — collect until closing
      const lang = line.slice(3);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={key} style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--bg-border)',
          borderRadius: 3,
          padding: '8px 12px',
          fontSize: 10,
          color: 'var(--text-primary)',
          overflowX: 'auto',
          margin: '6px 0',
          fontFamily: 'var(--font-mono)',
        }}>
          {lang && <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 9 }}>{lang.toUpperCase()}</div>}
          {codeLines.join('\n')}
        </pre>
      );
    } else if (line === '---' || line === '***') {
      nodes.push(<div key={key} style={{ borderTop: '1px solid var(--bg-border)', margin: '10px 0' }} />);
    } else if (line.trim() === '') {
      nodes.push(<div key={key} style={{ height: 6 }} />);
    } else {
      nodes.push(
        <div key={key} style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 2 }}>
          {inlineMarkdown(line)}
        </div>
      );
    }
  }

  if (tableBuffer.length > 0) flushTable(tableBuffer);

  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Bold **text**, inline code `code`, italic *text*
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 2, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: 'var(--text-secondary)' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function newConvId() {
  return `conv-${Date.now()}`;
}

export function AskbPage() {
  const { user } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState('');
  const [isStreaming, setIsStreaming]      = useState(false);
  const [webSearch, setWebSearch]         = useState(true);
  const [searchStatus, setSearchStatus]   = useState<string | null>(null);
  const [copied, setCopied]               = useState<string | null>(null);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef      = useRef<boolean>(false);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const getHistory = useCallback((): Array<{ role: 'user' | 'assistant'; content: string }> => {
    return messages
      .filter(m => !m.isStreaming)
      .map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    const assistantId = `msg-${Date.now()}-ai`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
      webSearched: webSearch,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    abortRef.current = false;

    if (webSearch) {
      setSearchStatus('Searching financial data…');
      setTimeout(() => setSearchStatus(null), 2000);
    }

    const history = getHistory();
    const userCtx = {
      orgName: 'QuantDesk',
      userRole: user?.displayName ?? 'Analyst',
      coverageTickers: [],
    };

    let accumulated = '';
    try {
      for await (const chunk of streamAskb(text.trim(), history, userCtx)) {
        if (abortRef.current) break;
        accumulated += chunk;
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
        );
      }
    } catch {
      accumulated = accumulated || '[Error: Could not reach ASKB. Please check your connection and try again.]';
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
      );
    } finally {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m)
      );
      setIsStreaming(false);
      setSearchStatus(null);

      // Save to conversation history
      const title = text.trim().slice(0, 40) + (text.length > 40 ? '…' : '');
      const convId = activeConvId ?? newConvId();
      const newConv: Conversation = {
        id: convId,
        title,
        preview: accumulated.slice(0, 60),
        timestamp: Date.now(),
        messages: [], // reference only
      };
      if (!activeConvId) {
        setActiveConvId(convId);
        setConversations(prev => [newConv, ...prev.slice(0, 9)]);
      } else {
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, preview: accumulated.slice(0, 60), timestamp: Date.now() } : c));
      }
    }
  }, [isStreaming, webSearch, getHistory, user, activeConvId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleRegenerate = () => {
    if (isStreaming) return;
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    // Remove last assistant message
    setMessages(prev => {
      const idx = [...prev].reverse().findIndex(m => m.role === 'assistant');
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.slice(0, realIdx);
    });
    void sendMessage(lastUser.content);
  };

  const startNewConversation = () => {
    if (messages.length > 0) {
      const title = messages.find(m => m.role === 'user')?.content.slice(0, 40) ?? 'Conversation';
      setConversations(prev => {
        const exists = prev.find(c => c.id === activeConvId);
        if (!exists && messages.length > 0) {
          return [{ id: newConvId(), title, preview: messages.find(m => m.role === 'assistant')?.content.slice(0, 60) ?? '', timestamp: Date.now(), messages: [] }, ...prev.slice(0, 9)];
        }
        return prev;
      });
    }
    setMessages([]);
    setActiveConvId(null);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-mono)' }}>

      {/* Left sidebar — conversation history */}
      <div style={{
        width: 220,
        borderRight: '1px solid var(--bg-border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        flexShrink: 0,
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-border)' }}>
          <button
            onClick={startNewConversation}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'var(--accent-primary, #ff6600)',
              color: '#000',
              border: 'none',
              borderRadius: 2,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <MessageSquare size={11} /> New Conversation
          </button>
        </div>

        <div style={{ padding: '6px 10px 2px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          RECENT
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '12px 12px', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Your conversations will appear here.
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--bg-border)',
                  cursor: 'pointer',
                  background: activeConvId === conv.id ? 'rgba(255,102,0,0.08)' : 'transparent',
                  borderLeft: activeConvId === conv.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  if (activeConvId !== conv.id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                }}
                onMouseLeave={e => {
                  if (activeConvId !== conv.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.title}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.preview}
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={7} /> {new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--bg-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '1px 5px', borderRadius: 2 }}>AI</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>ASKB Assistant</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Investment-Grade AI</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setWebSearch(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px',
                background: webSearch ? 'rgba(68,136,255,0.1)' : 'transparent',
                border: `1px solid ${webSearch ? 'rgba(68,136,255,0.4)' : 'var(--bg-border)'}`,
                borderRadius: 2,
                cursor: 'pointer',
                fontSize: 10,
                color: webSearch ? '#4488ff' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <Globe size={10} /> Web Search {webSearch ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => { setMessages([]); setActiveConvId(null); }}
              title="Clear conversation"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Web search indicator */}
        {searchStatus && (
          <div style={{
            padding: '6px 16px',
            background: 'rgba(68,136,255,0.08)',
            borderBottom: '1px solid rgba(68,136,255,0.2)',
            fontSize: 10,
            color: '#4488ff',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
            <Search size={10} style={{ animation: 'spin 1s linear infinite' }} />
            {searchStatus}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, opacity: 0.7 }}>
              <BookOpen size={32} color="var(--text-muted)" />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>Investment-Grade AI Analysis</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 340, textAlign: 'center', lineHeight: 1.6 }}>
                Ask ASKB about markets, earnings, macro trends, trade ideas, sector analysis, or any financial research question.
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              style={{
                marginBottom: 16,
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'user' ? (
                <div style={{
                  background: 'rgba(255,102,0,0.1)',
                  border: '1px solid rgba(255,102,0,0.25)',
                  borderRadius: 3,
                  padding: '8px 12px',
                  maxWidth: '80%',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: '92%', width: '100%' }}>
                  {/* AI label row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '1px 4px', borderRadius: 2 }}>AI</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>ASKB</span>
                    {msg.webSearched && !msg.isStreaming && (
                      <span style={{ fontSize: 9, color: '#4488ff', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Globe size={9} /> Web enhanced
                      </span>
                    )}
                    {msg.isStreaming && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', animation: 'pulse 1s ease-in-out infinite' }}>generating…</span>
                    )}
                  </div>

                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 3,
                    padding: '12px 14px',
                  }}>
                    {msg.isStreaming && msg.content === '' ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: 'var(--accent-primary)',
                            animation: `bounce 0.8s ${i * 0.15}s ease-in-out infinite`,
                          }} />
                        ))}
                      </div>
                    ) : (
                      <>
                        {renderMarkdown(msg.content)}
                        {msg.isStreaming && (
                          <span style={{
                            display: 'inline-block', width: 8, height: 14,
                            background: 'var(--accent-primary)',
                            marginLeft: 2, verticalAlign: 'text-bottom',
                            animation: 'blink 0.7s step-end infinite',
                          }} />
                        )}
                      </>
                    )}
                  </div>

                  {/* Message actions (shown when not streaming) */}
                  {!msg.isStreaming && msg.content && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        title="Copy"
                        style={{
                          background: 'none', border: '1px solid var(--bg-border)',
                          borderRadius: 2, padding: '2px 6px', cursor: 'pointer',
                          color: copied === msg.id ? 'var(--positive)' : 'var(--text-muted)',
                          fontSize: 9, display: 'flex', alignItems: 'center', gap: 3,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <Copy size={9} /> {copied === msg.id ? 'Copied!' : 'Copy'}
                      </button>
                      {idx === messages.length - 1 && (
                        <button
                          onClick={handleRegenerate}
                          title="Regenerate"
                          style={{
                            background: 'none', border: '1px solid var(--bg-border)',
                            borderRadius: 2, padding: '2px 6px', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: 9,
                            display: 'flex', alignItems: 'center', gap: 3,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <RotateCcw size={9} /> Regenerate
                        </button>
                      )}
                      <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
                        <button
                          onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, feedback: 'up' } : m))}
                          style={{
                            background: msg.feedback === 'up' ? 'rgba(34,197,94,0.15)' : 'none',
                            border: `1px solid ${msg.feedback === 'up' ? 'rgba(34,197,94,0.4)' : 'var(--bg-border)'}`,
                            borderRadius: 2, padding: '2px 5px', cursor: 'pointer',
                            color: msg.feedback === 'up' ? 'var(--positive)' : 'var(--text-muted)',
                          }}
                          title="Helpful"
                        >
                          <ThumbsUp size={9} />
                        </button>
                        <button
                          onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, feedback: 'down' } : m))}
                          style={{
                            background: msg.feedback === 'down' ? 'rgba(239,68,68,0.15)' : 'none',
                            border: `1px solid ${msg.feedback === 'down' ? 'rgba(239,68,68,0.4)' : 'var(--bg-border)'}`,
                            borderRadius: 2, padding: '2px 5px', cursor: 'pointer',
                            color: msg.feedback === 'down' ? 'var(--negative)' : 'var(--text-muted)',
                          }}
                          title="Not helpful"
                        >
                          <ThumbsDown size={9} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 3 }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ borderTop: '1px solid var(--bg-border)', padding: '10px 16px', flexShrink: 0 }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--bg-border)',
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about markets, earnings, macro, trade ideas… (Enter to send, Shift+Enter for newline)"
              disabled={isStreaming}
              rows={2}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                padding: '10px 12px',
                resize: 'none',
                minHeight: 44,
                maxHeight: 160,
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderTop: '1px solid var(--bg-border)',
            }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                [AI-Generated — Verify Before Trading] · gemini-2.0-flash
              </span>
              <button
                onClick={() => void sendMessage(input)}
                disabled={isStreaming || !input.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 14px',
                  background: input.trim() && !isStreaming ? 'var(--accent-primary, #ff6600)' : 'var(--bg-border)',
                  color: input.trim() && !isStreaming ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 2,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-mono)',
                  transition: 'background 0.1s',
                }}
              >
                {isStreaming ? (
                  <>
                    <div style={{ width: 10, height: 10, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Generating…
                  </>
                ) : (
                  <><Send size={11} /> Send</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar — suggestions & quick actions */}
      <div style={{
        width: 240,
        borderLeft: '1px solid var(--bg-border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        flexShrink: 0,
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-border)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>SUGGESTED PROMPTS</div>
          {SUGGESTED_PROMPTS.map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '6px 8px', marginBottom: 4,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--bg-border)',
                borderRadius: 2,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-primary, #ff6600)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bg-border)')}
            >
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>{label}</span>
              <ChevronRight size={9} color="var(--text-muted)" />
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-border)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>WEB SEARCH STATUS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: webSearch ? 'var(--positive, #22c55e)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 10, color: webSearch ? 'var(--positive)' : 'var(--text-muted)', fontWeight: webSearch ? 700 : 400 }}>
              {webSearch ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {webSearch
              ? 'ASKB will search for real-time market data, news, and financial information.'
              : 'Using knowledge base only. Enable for real-time data.'}
          </div>
        </div>

        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>QUICK ACTIONS</div>
          {[
            { label: 'Export conversation', action: () => {
              const text = messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');
              const blob = new Blob([text], { type: 'text/plain' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `askb-${Date.now()}.txt`;
              a.click();
            }},
            { label: 'Copy last response', action: () => {
              const last = [...messages].reverse().find(m => m.role === 'assistant');
              if (last) void navigator.clipboard.writeText(last.content);
            }},
            { label: 'Clear history', action: () => { setMessages([]); setActiveConvId(null); } },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                display: 'block', width: '100%', padding: '5px 8px', marginBottom: 3,
                background: 'none', border: '1px solid var(--bg-border)',
                color: 'var(--text-muted)', fontSize: 10,
                textAlign: 'left', cursor: 'pointer', borderRadius: 2,
                fontFamily: 'var(--font-mono)',
                transition: 'color 0.1s, border-color 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--bg-border)'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
