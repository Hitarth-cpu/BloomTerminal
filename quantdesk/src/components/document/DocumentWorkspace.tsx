import { useState } from 'react';
import { Plus, Save } from 'lucide-react';

const MOCK_DOCS = [
  { id: 'd1', title: 'NVIDIA Q4 2025 Earnings Call', date: '2025-11-20', source: 'TRANSCRIPT', color: '#4488ff' },
  { id: 'd2', title: 'AMD Q4 2025 Earnings Call', date: '2025-11-18', source: 'TRANSCRIPT', color: '#00d4aa' },
  { id: 'd3', title: 'Intel Q4 2025 Earnings Call', date: '2025-11-15', source: 'TRANSCRIPT', color: '#ffcc00' },
  { id: 'd4', title: 'Apple Q4 2025 10-Q Filing', date: '2025-11-01', source: 'SEC', color: '#ff6600' },
];

const MOCK_TABLE_DATA: Record<string, Record<string, string>> = {
  'AI Investment Strategy': {
    'd1': '• NVIDIA committed $10B+ to AI infrastructure in FY2026\n• Blackwell GPU architecture driving 3x compute density\n• Partnership with hyperscalers for custom silicon development',
    'd2': '• AMD allocated $3.5B R&D budget, 40% toward AI accelerators\n• MI300X gaining enterprise adoption with competitive TCO\n• Targeting $8B AI chip revenue by end of 2025',
    'd3': '• Intel Gaudi 3 AI accelerator launched targeting LLM workloads\n• $2B investment in AI foundry services partnership\n• Restructuring to focus on high-margin AI product lines',
  },
  'Revenue Growth': {
    'd1': '• Data Center revenue +112% YoY to $35.6B\n• Total revenue $39.3B vs. consensus $37.1B (beat +5.9%)\n• Gaming revenue recovery +15% QoQ',
    'd2': '• Data Center revenue +122% YoY to $5.8B\n• Client segment revenue +42% YoY\n• Total revenue $7.7B, beat consensus by +3.2%',
    'd3': '• Data Center revenue -8% YoY, disappointing vs. peers\n• Client segment revenue +35% YoY, better than expected\n• Total revenue $14.3B, missed consensus by -2.1%',
  },
  'Margin Trends': {
    'd1': '• Gross margin 76.0%, expansion of +3pp YoY\n• Operating margin 62%, record high for company\n• EBITDA margin 68%',
    'd2': '• Gross margin 53.0%, expansion of +2pp YoY\n• Non-GAAP operating margin 22%, improving trajectory\n• FCF conversion >90% of net income',
    'd3': '• Gross margin 45.1%, compression vs. prior year\n• Operating margin 15.5%, restructuring charges impacting\n• Targeting 60%+ gross margin by 2027',
  },
};

const FORD_TRANSCRIPT = `FINAL TRANSCRIPT | 2025-10-23
Ford Motor Co (F US Equity)
Q3 2025 Earnings Call

Company Participants:
  Jim Farley — President and CEO
  John Lawler — Chief Financial Officer
  Lynn Antipas Tyson — Executive Director, Investor Relations

Other Participants:
  John Murphy — Bank of America
  Adam Jonas — Morgan Stanley
  Emmanuel Rosner — Deutsche Bank

Presentation

Operator
Good day, and thank you for standing by. Welcome to the Ford Motor Company Third Quarter 2025 Earnings Conference Call. At this time, all participants are in listen-only mode. After the speakers' presentation, there will be a question and answer session.

Lynn Antipas Tyson
Thank you, operator, and good afternoon, everyone. Welcome to Ford Motor Company's third quarter 2025 earnings call. With me today are Jim Farley, our president and CEO, and John Lawler, our chief financial officer.

Jim Farley
Thanks, Lynn. Q3 was a strong quarter for Ford Pro and Ford Blue, even as we continue to work through the Model e challenges. Ford Pro EBIT was $1.8 billion, up significantly year-over-year, driven by strong commercial vehicle demand and pricing.

On Model e, we lost $1.3 billion in the quarter, bringing year-to-date losses to $3.6 billion. Approximately $3 billion of those losses are attributed to first-generation EV products that we're transitioning away from. We're confident the next-generation platform will achieve significantly better economics.`;

type ViewMode = 'comparative' | 'viewer';

export function DocumentWorkspace() {
  const [viewMode, setViewMode] = useState<ViewMode>('comparative');
  const [prompt, setPrompt] = useState('How is the company investing in AI or data center growth?');
  const [activePrompt, setActivePrompt] = useState('AI Investment Strategy');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const askQuestion = async () => {
    if (!question.trim()) return;
    setIsAsking(true);
    await new Promise(r => setTimeout(r, 1000));
    setAnswer(`**Analysis based on document** [AI]\n\n• Ford reported **$3.6B in EV losses year-to-date** through Q3 2025\n• Approximately **$3B attributed to first-generation EV products** being phased out\n• Management guided toward profitability on next-generation EV platform\n• Ford Pro segment offsetting EV losses with **$1.8B EBIT in Q3**\n• Target: 8% EBIT margin on commercial vehicles by 2026\n\n*Source: Ford Q3 2025 Earnings Call Transcript, paragraph 4 | [AI-Generated — Verify Before Trading]*`);
    setIsAsking(false);
  };

  const rows = Object.keys(MOCK_TABLE_DATA);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>DOCUMENT WORKSPACE</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn ${viewMode === 'comparative' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('comparative')}>COMPARATIVE</button>
          <button className={`btn ${viewMode === 'viewer' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('viewer')}>VIEWER</button>
        </div>
      </div>

      <div className="warning-banner" style={{ flexShrink: 0 }}>
        ⚠ Warning: AI-generated content. Data may not be accurate. Verify before use.
      </div>

      {viewMode === 'comparative' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Doc list */}
          <div style={{ width: 180, borderRight: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>ALL TABLES</span>
              <button className="btn btn-secondary" style={{ fontSize: 8, padding: '1px 4px', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Plus size={8} /> NEW
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>DOCUMENTS</div>
              {MOCK_DOCS.map(doc => (
                <div key={doc.id} style={{ padding: '5px 8px', borderBottom: '1px solid rgba(42,42,56,0.5)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 1, background: doc.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 1, paddingLeft: 10 }}>{doc.date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Main: Comparison table */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Prompt bar */}
            <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
              <input
                className="terminal-input"
                style={{ flex: 1 }}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Add a prompt to compare across documents..."
              />
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Save size={9} /> SAVE TABLE
              </button>
            </div>

            {/* Row selectors */}
            <div className="tab-bar">
              {rows.map(r => (
                <div key={r} className={`tab-item${activePrompt === r ? ' active' : ''}`} onClick={() => setActivePrompt(r)}>{r}</div>
              ))}
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--bg-border)' }}>
                    <th style={{ width: 160, padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textAlign: 'left', borderRight: '1px solid var(--bg-border)' }}>PROMPT</th>
                    {MOCK_DOCS.slice(0, 3).map(doc => (
                      <th key={doc.id} style={{ padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)', textAlign: 'left', borderRight: '1px solid var(--bg-border)' }}>
                        <span style={{ color: doc.color }}>●</span> {doc.title.split(' ').slice(0, 2).join(' ')}
                        <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 400 }}>{doc.date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row} style={{ borderBottom: '1px solid var(--bg-border)', background: activePrompt === row ? 'rgba(255,102,0,0.04)' : 'transparent' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)', borderRight: '1px solid var(--bg-border)', verticalAlign: 'top', fontWeight: 600 }}>{row}</td>
                      {MOCK_DOCS.slice(0, 3).map(doc => (
                        <td key={doc.id} style={{ padding: '6px 8px', borderRight: '1px solid var(--bg-border)', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                            <span className="ai-badge">[AI]</span>
                          </div>
                          {(MOCK_TABLE_DATA[row]?.[doc.id] || '—').split('\n').map((line, i) => (
                            <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 2 }}>{line}</div>
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '4px 10px', borderTop: '1px solid var(--bg-border)', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>
              Responses generated by AI. Check to make sure this is correct and complete. [AI-Generated — Verify Before Trading]
            </div>
          </div>
        </div>
      )}

      {viewMode === 'viewer' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Q&A panel */}
          <div style={{ width: 260, borderRight: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column' }}>
            <div className="tab-bar">
              {['History', 'Ask', 'Topics', 'Annotations'].map((t, i) => (
                <div key={t} className={`tab-item${i === 1 ? ' active' : ''}`}>{t}</div>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              <div style={{ marginBottom: 8 }}>
                <textarea
                  className="terminal-input"
                  style={{ resize: 'none', height: 60, marginBottom: 4 }}
                  placeholder="Ask a question about the document..."
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), askQuestion())}
                />
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={askQuestion} disabled={isAsking}>
                  {isAsking ? 'Analyzing...' : 'ASK'}
                </button>
              </div>
              {answer && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)', padding: '8px', borderRadius: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <span className="ai-badge">[AI]</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>Answer</span>
                  </div>
                  {answer.split('\n').map((line, i) => (
                    <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: line.startsWith('•') ? 'var(--text-secondary)' : line.startsWith('*') ? 'var(--text-muted)' : 'var(--text-primary)', lineHeight: 1.5, marginBottom: 2 }}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Document text */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {['All Summary', 'Actions', 'Comment', 'Highlight', 'Compare'].map((action, i) => (
                <button key={action} className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 9 }}>{action}</button>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {FORD_TRANSCRIPT.split('\n').map((line, i) => {
                const isHeader = i < 5;
                const isParticipant = line.includes('—');
                const isSection = ['Company Participants:', 'Other Participants:', 'Presentation', 'Operator'].includes(line.trim());
                return (
                  <div key={i} style={{
                    color: isHeader ? 'var(--highlight)' : isSection ? 'var(--accent-primary)' : isParticipant ? 'var(--info)' : 'var(--text-secondary)',
                    fontWeight: isHeader || isSection ? 600 : 400,
                    fontFamily: isHeader ? 'var(--font-mono)' : 'var(--font-ui)',
                    fontSize: isHeader ? 10 : 11,
                    marginBottom: isHeader || isSection ? 4 : 1,
                  }}>
                    {line || '\u00a0'}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
