import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Search, RefreshCw, Loader, MessageSquare, BookOpen, Zap, Star } from 'lucide-react';
import {
  fetchDocuments, fetchDocument, fetchDocumentSummary,
  fetchDocumentHighlights, generateResearchNote, askDocumentQuestion,
  type DocumentMeta, type DocumentSummary, type QAResponse,
} from '../../services/api/researchApi';

type ContentTab = 'summary' | 'highlights' | 'fulltext' | 'note';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: QAResponse;
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ width = '100%', height = 14, style = {} }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, borderRadius: 3,
      background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ─── Sentiment badge ──────────────────────────────────────────────────────────
function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'bearish' | 'neutral' }) {
  const colors = {
    bullish: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: 'var(--positive, #22c55e)' },
    bearish: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: 'var(--negative, #ef4444)' },
    neutral: { bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.4)', text: 'var(--text-muted, #94a3b8)' },
  };
  const c = colors[sentiment];
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
      fontFamily: 'var(--font-mono)', letterSpacing: 1,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>
      {sentiment.toUpperCase()}
    </span>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const colors = {
    high:   { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  text: 'var(--positive, #22c55e)' },
    medium: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
    low:    { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: 'var(--negative, #ef4444)' },
  };
  const c = colors[confidence];
  return (
    <span style={{
      padding: '2px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700,
      fontFamily: 'var(--font-mono)', letterSpacing: 1,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>
      {confidence.toUpperCase()} CONFIDENCE
    </span>
  );
}

// ─── Highlight type chip ──────────────────────────────────────────────────────
function HighlightChip({ type, text }: { type: string; text: string }) {
  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    risk:         { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: 'var(--negative, #ef4444)' },
    opportunity:  { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   text: 'var(--positive, #22c55e)' },
    metric:       { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  text: 'var(--info, #3b82f6)' },
    guidance:     { bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.3)',  text: '#a855f7' },
    catalyst:     { bg: 'rgba(255,102,0,0.1)',   border: 'rgba(255,102,0,0.3)',   text: 'var(--accent-primary, #ff6600)' },
    default:      { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', text: 'var(--text-muted)' },
  };
  const c = typeColors[type.toLowerCase()] ?? typeColors.default;
  return (
    <div style={{
      padding: '6px 10px', borderRadius: 4, fontSize: 11,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontFamily: 'var(--font-mono)', lineHeight: 1.5, marginBottom: 6,
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, opacity: 0.8 }}>{type.toUpperCase()} · </span>
      {text}
    </div>
  );
}

export function DocumentViewerPage() {
  // Document library
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentMeta | null>(null);

  // Content tabs
  const [activeTab, setActiveTab] = useState<ContentTab>('summary');

  // Summary
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Highlights
  const [highlights, setHighlights] = useState<Array<{ id: string; text_excerpt: string; highlight_type: string; importance: number }>>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(false);

  // Full text
  const [fullText, setFullText] = useState<string | null>(null);
  const [fullTextLoading, setFullTextLoading] = useState(false);
  const [fullTextError, setFullTextError] = useState<string | null>(null);

  // Research note
  const [researchNote, setResearchNote] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Q&A
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Load documents ────────────────────────────────────────────────────────
  useEffect(() => {
    setDocsLoading(true);
    setDocsError(null);
    fetchDocuments()
      .then(d => setDocs(d.documents))
      .catch(e => setDocsError(String(e)))
      .finally(() => setDocsLoading(false));
  }, []);

  // ── When selected doc changes, reset content ──────────────────────────────
  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    setHighlights([]);
    setFullText(null);
    setFullTextError(null);
    setResearchNote(null);
    setNoteError(null);
    setMessages([]);
    setQaError(null);
    if (!selectedDoc) return;

    // Auto-load summary
    loadSummary(selectedDoc.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc]);

  // ── Tab switching ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDoc) return;
    if (activeTab === 'highlights' && highlights.length === 0 && !highlightsLoading) {
      loadHighlights(selectedDoc.id);
    }
    if (activeTab === 'fulltext' && fullText === null && !fullTextLoading) {
      loadFullText(selectedDoc.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedDoc]);

  // ── Auto scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadSummary = useCallback(async (docId: string, force: boolean) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const s = await fetchDocumentSummary(docId, force);
      setSummary(s);
    } catch (e) {
      setSummaryError(String(e));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadHighlights = useCallback(async (docId: string) => {
    setHighlightsLoading(true);
    try {
      const h = await fetchDocumentHighlights(docId);
      setHighlights(h.highlights);
    } finally {
      setHighlightsLoading(false);
    }
  }, []);

  const loadFullText = useCallback(async (docId: string) => {
    setFullTextLoading(true);
    setFullTextError(null);
    try {
      const doc = await fetchDocument(docId);
      setFullText(doc.content);
    } catch (e) {
      setFullTextError(String(e));
    } finally {
      setFullTextLoading(false);
    }
  }, []);

  const loadNote = useCallback(async (docId: string) => {
    setNoteLoading(true);
    setNoteError(null);
    try {
      const note = await generateResearchNote(docId);
      setResearchNote(note);
    } catch (e) {
      setNoteError(String(e));
    } finally {
      setNoteLoading(false);
    }
  }, []);

  const sendQuestion = useCallback(async () => {
    if (!selectedDoc || !qaInput.trim() || qaLoading) return;
    const question = qaInput.trim();
    setQaInput('');
    setQaError(null);

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setQaLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await askDocumentQuestion(selectedDoc.id, question, history);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer,
        response: res,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      setQaError(String(e));
    } finally {
      setQaLoading(false);
    }
  }, [selectedDoc, qaInput, qaLoading, messages]);

  // ── Filtered docs ─────────────────────────────────────────────────────────
  const filteredDocs = docs.filter(d => {
    const q = search.toLowerCase();
    return !q || d.title.toLowerCase().includes(q) || (d.ticker ?? '').toLowerCase().includes(q) || d.doc_type.toLowerCase().includes(q);
  });

  // ── Shared styles ─────────────────────────────────────────────────────────
  const panelHeaderStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--bg-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    background: 'var(--bg-secondary)',
  };


  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)', fontFamily: 'var(--font-mono)' }}>

      {/* ── LEFT PANEL: Document Library ──────────────────────────────────── */}
      <div style={{
        width: 280, flexShrink: 0,
        borderRight: '1px solid var(--bg-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-primary)',
      }}>
        {/* Header */}
        <div style={panelHeaderStyle}>
          <FileText size={13} color="var(--accent-primary)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1 }}>
            DOCUMENT LIBRARY
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={11} color="var(--text-muted)" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="terminal-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents..."
              style={{ width: '100%', paddingLeft: 26, fontSize: 11, boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Doc list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {docsLoading ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <Skeleton width="85%" height={12} style={{ marginBottom: 6 }} />
                  <Skeleton width="55%" height={10} />
                </div>
              ))}
            </div>
          ) : docsError ? (
            <div style={{ padding: 12, color: 'var(--negative)', fontSize: 11 }}>Error: {docsError}</div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
              {search ? 'No documents match your search.' : 'No documents available.'}
            </div>
          ) : (
            filteredDocs.map(doc => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  style={{
                    padding: '9px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--bg-border)',
                    borderLeft: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    background: isSelected ? 'rgba(255,102,0,0.07)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: 11, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isSelected ? 600 : 400, lineHeight: 1.4, marginBottom: 4 }}>
                    {doc.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
                      background: 'rgba(255,102,0,0.15)', color: 'var(--accent-primary)',
                      border: '1px solid rgba(255,102,0,0.3)', letterSpacing: 0.5,
                    }}>
                      {doc.doc_type.toUpperCase()}
                    </span>
                    {doc.ticker && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
                        background: 'rgba(59,130,246,0.1)', color: 'var(--info, #3b82f6)',
                        border: '1px solid rgba(59,130,246,0.25)',
                      }}>
                        {doc.ticker}
                      </span>
                    )}
                    {doc.filing_date && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {doc.filing_date.slice(0, 10)}
                      </span>
                    )}
                    {doc.has_summary && (
                      <span style={{ fontSize: 9, color: 'var(--positive, #22c55e)' }}>✓ AI</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── MIDDLE PANEL: Document Content ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <div style={{ ...panelHeaderStyle, background: 'var(--bg-primary)', justifyContent: 'space-between' }}>
          {selectedDoc ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <BookOpen size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedDoc.title}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                  {selectedDoc.source}{selectedDoc.ticker ? ` · ${selectedDoc.ticker}` : ''}
                </div>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>DOCUMENT VIEWER</span>
          )}
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ flexShrink: 0 }}>
          {(['summary', 'highlights', 'fulltext', 'note'] as ContentTab[]).map(tab => {
            const labels: Record<ContentTab, string> = { summary: 'SUMMARY', highlights: 'HIGHLIGHTS', fulltext: 'FULL TEXT', note: 'RESEARCH NOTE' };
            return (
              <button
                key={tab}
                className={`tab-item${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
                disabled={!selectedDoc}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--bg-base)' }}>
          {!selectedDoc ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <FileText size={36} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>Select a document from the library</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Choose a document on the left to view its analysis</div>
            </div>
          ) : activeTab === 'summary' ? (
            <SummaryTab
              doc={selectedDoc}
              summary={summary}
              loading={summaryLoading}
              error={summaryError}
              onGenerate={() => loadSummary(selectedDoc.id, false)}
              onRefresh={() => loadSummary(selectedDoc.id, true)}
            />
          ) : activeTab === 'highlights' ? (
            <HighlightsTab highlights={highlights} loading={highlightsLoading} />
          ) : activeTab === 'fulltext' ? (
            <FullTextTab text={fullText} loading={fullTextLoading} error={fullTextError} />
          ) : (
            <ResearchNoteTab
              note={researchNote}
              loading={noteLoading}
              error={noteError}
              onGenerate={() => loadNote(selectedDoc.id)}
            />
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Q&A ─────────────────────────────────────────────── */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: '1px solid var(--bg-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-primary)',
      }}>
        {/* Header */}
        <div style={panelHeaderStyle}>
          <MessageSquare size={13} color="var(--accent-primary)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1 }}>
            ASK DOCUMENT
          </span>
          {selectedDoc && <span className="ai-badge" style={{ marginLeft: 'auto', fontSize: 9 }}>AI</span>}
        </div>

        {/* Chat history */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!selectedDoc ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 24 }}>
              Select a document to start asking questions
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 24 }}>
              <MessageSquare size={24} strokeWidth={1} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div>Ask anything about this document</div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div style={{
                    padding: '7px 10px', borderRadius: 4,
                    background: 'rgba(255,102,0,0.1)', border: '1px solid rgba(255,102,0,0.25)',
                    fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5,
                  }}>
                    {msg.content}
                  </div>
                ) : (
                  <div style={{
                    padding: '8px 10px', borderRadius: 4,
                    background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
                    fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.6,
                  }}>
                    <div style={{ marginBottom: msg.response ? 6 : 0 }}>{msg.content}</div>
                    {msg.response && (
                      <>
                        {msg.response.supportingPoints.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>SUPPORTING POINTS</div>
                            {msg.response.supportingPoints.map((p, i) => (
                              <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                                <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>›</span>
                                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.response.citedText && (
                          <div style={{
                            marginTop: 6, padding: '5px 8px', borderRadius: 3,
                            background: 'rgba(59,130,246,0.08)', borderLeft: '2px solid rgba(59,130,246,0.4)',
                            fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5,
                          }}>
                            "{msg.response.citedText}"
                            {msg.response.citation && (
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'normal' }}>
                                — {msg.response.citation}
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{ marginTop: 6 }}>
                          <ConfidenceBadge confidence={msg.response.confidence} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {qaLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11 }}>
              <Loader size={12} className="spin" />
              <span>Analyzing document...</span>
            </div>
          )}
          {qaError && (
            <div style={{ padding: '6px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 3, fontSize: 10, color: 'var(--negative)' }}>
              Error: {qaError}
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: 10, borderTop: '1px solid var(--bg-border)', flexShrink: 0 }}>
          <textarea
            className="terminal-input"
            value={qaInput}
            onChange={e => setQaInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
            placeholder={selectedDoc ? 'Ask a question... (Enter to send)' : 'Select a document first'}
            disabled={!selectedDoc || qaLoading}
            rows={3}
            style={{ width: '100%', resize: 'none', fontSize: 11, boxSizing: 'border-box', marginBottom: 6 }}
          />
          <button
            className="btn btn-primary"
            onClick={sendQuestion}
            disabled={!selectedDoc || !qaInput.trim() || qaLoading}
            style={{ width: '100%', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            {qaLoading ? <Loader size={11} className="spin" /> : <Zap size={11} />}
            SEND
          </button>
        </div>
      </div>

      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        .spin { animation: spin 1s linear infinite }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────
function SummaryTab({
  doc, summary, loading, error, onGenerate, onRefresh,
}: {
  doc: DocumentMeta;
  summary: DocumentSummary | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onRefresh: () => void;
}) {
  const sectionStyle: React.CSSProperties = {
    marginBottom: 20,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)', letterSpacing: 1.5, marginBottom: 8,
    textTransform: 'uppercase' as const,
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: 'var(--text-muted)' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 12, fontWeight: 600 }}>Generating AI Summary...</div>
        <div style={{ fontSize: 10 }}>This may take 10–30 seconds</div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40 }}>
        <div style={{ color: 'var(--negative)', fontSize: 12, marginBottom: 12 }}>Failed to load summary</div>
        <div style={{ fontSize: 10, marginBottom: 16 }}>{error}</div>
        <button className="btn btn-primary" onClick={onGenerate} style={{ fontSize: 11 }}>
          GENERATE SUMMARY
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40, color: 'var(--text-muted)' }}>
        <Star size={28} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.5 }} />
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>No summary generated yet</div>
        <div style={{ fontSize: 10, marginBottom: 16 }}>AI will analyze "{doc.title}"</div>
        <button className="btn btn-primary" onClick={onGenerate} style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Zap size={11} /> GENERATE SUMMARY
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SentimentBadge sentiment={summary.sentiment} />
        </div>
        <button className="btn btn-secondary" onClick={onRefresh} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={10} /> REFRESH
        </button>
      </div>

      {/* Executive Summary */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Executive Summary</div>
        <div style={{
          padding: '12px 14px', borderRadius: 4,
          background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
          fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7,
        }}>
          {summary.executiveSummary}
        </div>
      </div>

      {/* Sentiment justification */}
      {summary.sentimentJustification && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Sentiment Rationale</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {summary.sentimentJustification}
          </div>
        </div>
      )}

      {/* Key Points */}
      {summary.keyPoints.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Key Points</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summary.keyPoints.map((pt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--accent-primary)', flexShrink: 0, fontSize: 12, lineHeight: 1.5 }}>›</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {summary.keyMetrics.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Key Metrics</div>
          <div style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid var(--bg-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['Metric', 'Reported', 'Estimate', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '6px 10px', textAlign: i > 0 ? 'right' : 'left',
                      color: 'var(--text-muted)', fontWeight: 700, fontSize: 9,
                      letterSpacing: 1, borderBottom: '1px solid var(--bg-border)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.keyMetrics.map((m, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{m.name}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>{m.reported}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{m.estimate ?? '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      {m.beat === true && <span style={{ color: 'var(--positive, #22c55e)', fontSize: 10, fontWeight: 700 }}>BEAT</span>}
                      {m.beat === false && <span style={{ color: 'var(--negative, #ef4444)', fontSize: 10, fontWeight: 700 }}>MISS</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Risks */}
      {summary.risksIdentified.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Risks Identified</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {summary.risksIdentified.map((r, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, padding: '5px 8px',
                background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 3,
              }}>
                <span style={{ color: 'var(--negative)', flexShrink: 0 }}>⚠</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Quotes */}
      {summary.keyQuotes.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Key Quotes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {summary.keyQuotes.map((q, i) => (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 4,
                background: 'var(--bg-secondary)', borderLeft: '3px solid var(--accent-primary)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 5 }}>
                  "{q.quote}"
                </div>
                <div style={{ fontSize: 9, color: 'var(--accent-primary)', fontWeight: 700, letterSpacing: 0.5 }}>
                  — {q.speaker}
                </div>
                {q.significance && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{q.significance}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Highlights Tab ───────────────────────────────────────────────────────────
function HighlightsTab({
  highlights, loading,
}: {
  highlights: Array<{ id: string; text_excerpt: string; highlight_type: string; importance: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
        <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading highlights...
      </div>
    );
  }
  if (highlights.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, paddingTop: 40 }}>
        No highlights available for this document.
      </div>
    );
  }

  // Group by type
  const groups: Record<string, typeof highlights> = {};
  for (const h of highlights) {
    const t = h.highlight_type || 'other';
    if (!groups[t]) groups[t] = [];
    groups[t].push(h);
  }

  return (
    <div>
      {Object.entries(groups).map(([type, items]) => (
        <div key={type} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1.5, marginBottom: 8 }}>
            {type.toUpperCase()} ({items.length})
          </div>
          {items
            .sort((a, b) => b.importance - a.importance)
            .map(h => (
              <HighlightChip key={h.id} type={type} text={h.text_excerpt} />
            ))}
        </div>
      ))}
    </div>
  );
}

// ─── Full Text Tab ────────────────────────────────────────────────────────────
function FullTextTab({ text, loading, error }: { text: string | null; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
        <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading document...
      </div>
    );
  }
  if (error) {
    return <div style={{ color: 'var(--negative)', fontSize: 11 }}>Error loading document: {error}</div>;
  }
  if (!text) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>No content available.</div>;
  }
  return (
    <pre style={{
      margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11,
      color: 'var(--text-secondary)', lineHeight: 1.7,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {text}
    </pre>
  );
}

// ─── Research Note Tab ────────────────────────────────────────────────────────
function ResearchNoteTab({
  note, loading, error, onGenerate,
}: {
  note: string | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12, color: 'var(--text-muted)' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 12 }}>Generating research note...</div>
      </div>
    );
  }
  if (error && !note) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40, color: 'var(--text-muted)' }}>
        <div style={{ color: 'var(--negative)', marginBottom: 8, fontSize: 11 }}>{error}</div>
        <button className="btn btn-primary" onClick={onGenerate} style={{ fontSize: 11 }}>RETRY</button>
      </div>
    );
  }
  if (!note) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40, color: 'var(--text-muted)' }}>
        <BookOpen size={28} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.5 }} />
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>No research note yet</div>
        <div style={{ fontSize: 10, marginBottom: 16 }}>Generate a structured investment research note using AI</div>
        <button className="btn btn-primary" onClick={onGenerate} style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Zap size={11} /> GENERATE NOTE
        </button>
      </div>
    );
  }

  // Render markdown-like note
  const lines = note.split('\n');
  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-secondary" onClick={onGenerate} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={10} /> REGENERATE
        </button>
      </div>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return <h2 key={i} style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>{line.slice(2)}</h2>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={i} style={{ margin: '16px 0 8px', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 700, letterSpacing: 1 }}>{line.slice(3).toUpperCase()}</h3>;
        }
        if (line.startsWith('### ')) {
          return <h4 key={i} style={{ margin: '12px 0 6px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 700 }}>{line.slice(4)}</h4>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: 'var(--accent-primary)' }}>›</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;
        return <p key={i} style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{line}</p>;
      })}
    </div>
  );
}
