import { useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { MOCK_EARNINGS } from '../../services/mockData';
import type { EarningsMetric } from '../../types';

const CATEGORIES = [
  { key: 'highlight', label: 'HIGHLIGHTS' },
  { key: 'segment', label: 'SEGMENT REVENUE' },
  { key: 'regional', label: 'REGIONAL REVENUE' },
  { key: 'fcf', label: 'FREE CASH FLOW' },
];

function fmtVal(v: number | null, unit: string): string {
  if (v === null) return '—';
  if (unit === '$M') return (v / 1000).toFixed(1) + 'B';
  if (unit === '%') return v.toFixed(2) + '%';
  return v.toFixed(2);
}

function BeatMiss({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const isUp = pct > 0;
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isUp ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
      {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function MetricRow({ m }: { m: EarningsMetric }) {
  const beat = m.beatMissPct !== null && m.beatMissPct > 0;
  const miss = m.beatMissPct !== null && m.beatMissPct < 0;
  return (
    <tr style={{ background: beat ? 'rgba(0,212,170,0.04)' : miss ? 'rgba(255,61,61,0.04)' : 'transparent' }}>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', paddingLeft: 20 }}>{m.label}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)', fontWeight: 600 }}>{fmtVal(m.actual, m.unit)}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{fmtVal(m.consensus, m.unit)}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--info)' }}>{fmtVal(m.gsEst, m.unit)}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--info)' }}>{fmtVal(m.jpmEst, m.unit)}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--info)' }}>{fmtVal(m.msEst, m.unit)}</td>
      <td><BeatMiss pct={m.beatMissPct} /></td>
    </tr>
  );
}

export function EarningsTable() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['highlight', 'segment']));
  const [ticker, setTicker] = useState('AAPL');

  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700 }}>{ticker} US EQUITY</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>&gt; IXFE &gt; EARNINGS CALCULATOR</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'].map(t => (
            <button key={t} className={`btn ${ticker === t ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 9 }} onClick={() => setTicker(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 10px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>PERIOD:</span>
        {['4Q25E', 'FY25', 'FY26E'].map(p => (
          <button key={p} className="btn btn-secondary" style={{ fontSize: 9 }}>{p}</button>
        ))}
        <span style={{ color: 'var(--bg-border)' }}>|</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>SORT:</span>
        <button className="btn btn-secondary" style={{ fontSize: 9 }}>Default <ChevronDown size={8} /></button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
          <Download size={9} /> EXPORT
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="data-table" style={{ fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: 160 }}>METRIC</th>
              <th style={{ color: 'var(--text-primary)' }}>ACTUAL</th>
              <th>CONSENSUS</th>
              <th style={{ color: 'var(--info)' }}>GS EST</th>
              <th style={{ color: 'var(--info)' }}>JPM EST</th>
              <th style={{ color: 'var(--info)' }}>MS EST</th>
              <th style={{ minWidth: 80 }}>BEAT/MISS</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(cat => {
              const rows = MOCK_EARNINGS.filter(m => m.category === cat.key);
              const open = expanded.has(cat.key);
              return (
                <>
                  <tr key={cat.key} style={{ background: 'var(--bg-secondary)', cursor: 'pointer' }} onClick={() => toggle(cat.key)}>
                    <td colSpan={7} style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        {cat.label}
                      </div>
                    </td>
                  </tr>
                  {open && rows.map(m => <MetricRow key={m.label} m={m} />)}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* AI Commentary */}
      <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--bg-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span className="ai-badge">[AI]</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', fontWeight: 600 }}>{ticker} EARNINGS PREVIEW</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--positive)', marginBottom: 2, fontWeight: 600 }}>▲ BULLISH TAKEAWAYS</div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {['Services revenue exceeded all 3 analyst estimates at $26.3B', 'Operating margin beat consensus by +2.59pp at 31.69%', 'FCF of $32B significantly above estimates, strong cash generation'].map(p => (
                <li key={p} style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2, paddingLeft: 8, borderLeft: '2px solid var(--positive)' }}>• {p}</li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--negative)', marginBottom: 2, fontWeight: 600 }}>▼ BEARISH TAKEAWAYS</div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {['EPS of $1.64 missed consensus by -2.96%', 'Greater China revenue -2.86% vs consensus, ongoing market share concerns', 'iPhone revenue missed estimates by -1.51%'].map(p => (
                <li key={p} style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2, paddingLeft: 8, borderLeft: '2px solid var(--negative)' }}>• {p}</li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 4 }}>
          [AI-Generated — Verify Before Trading] | Source: Mock Data
        </div>
      </div>
    </div>
  );
}
