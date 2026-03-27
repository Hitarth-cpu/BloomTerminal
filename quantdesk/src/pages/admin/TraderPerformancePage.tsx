import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchTraderPerformance, type TraderPerf } from '../../services/api/adminApi';

type Period = '1d' | '1w' | '1m' | '3m' | 'ytd';

function Sparkline({ data }: { data: Array<{ pnl: number }> }) {
  if (!data.length) return <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>;
  const vals = data.map(d => d.pnl);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const range = max - min || 1;
  const W = 100, H = 28;

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {vals.map((v, i) => {
        const x = (i / (vals.length - 1 || 1)) * (W - 6) + 3;
        const h = Math.max(2, ((v - min) / range) * (H - 4));
        const y = H - h - 2;
        return (
          <rect key={i} x={x - 2} y={y} width={4} height={h}
            fill={v >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)'}
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}

function pnlColor(v: number): string {
  return v > 0 ? 'var(--positive)' : v < 0 ? 'var(--negative)' : 'var(--text-muted)';
}
function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${v >= 0 ? '+' : ''}$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `${v >= 0 ? '+' : ''}$${(v / 1_000).toFixed(1)}K`;
  return `${v >= 0 ? '+' : ''}$${v.toFixed(0)}`;
}

export default function TraderPerformancePage() {
  const navigate = useNavigate();
  const [period,  setPeriod]  = useState<Period>('1m');
  const [traders, setTraders] = useState<TraderPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState<keyof TraderPerf>('total_pnl');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    fetchTraderPerformance(period)
      .then(r => setTraders(r.traders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const sorted = [...traders].sort((a, b) => {
    const av = (a[sortCol] as number) ?? 0;
    const bv = (b[sortCol] as number) ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const totalPnl = traders.reduce((s, t) => s + (t.total_pnl ?? 0), 0);
  const totalVol  = traders.reduce((s, t) => s + (t.volume_traded ?? 0), 0);
  const best      = traders.reduce((b, t) => (t.total_pnl ?? 0) > (b.total_pnl ?? 0) ? t : b, traders[0] ?? null);

  const thClick = (col: keyof TraderPerf) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const thSt = (col: keyof TraderPerf): React.CSSProperties => ({
    padding: '6px 8px', fontSize: 9, fontWeight: 700, color: sortCol === col ? '#ff3d3d' : 'var(--text-muted)',
    letterSpacing: '0.07em', cursor: 'pointer', textAlign: 'right', whiteSpace: 'nowrap',
    userSelect: 'none',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Trader Performance</h1>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{traders.length} active traders</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['1d','1w','1m','3m','ytd'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 10px', fontSize: 10, fontWeight: 700,
              background: period === p ? '#ff3d3d' : 'var(--bg-secondary)',
              color: period === p ? '#000' : 'var(--text-muted)',
              border: `1px solid ${period === p ? '#ff3d3d' : 'var(--bg-border)'}`,
              borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase',
            }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--bg-border)' }}>
        {[
          { label: 'DESK P&L',     value: fmt(totalPnl),    color: pnlColor(totalPnl) },
          { label: 'TOTAL VOLUME', value: fmt(totalVol),    color: 'var(--text-primary)' },
          { label: 'BEST TRADER',  value: best?.display_name ?? '—', color: 'var(--accent-primary)' },
          { label: 'TRADERS',      value: traders.length,   color: 'var(--text-primary)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-primary)' }}>
              <th style={{ ...thSt('display_name'), textAlign: 'left', padding: '6px 24px' }} onClick={() => thClick('display_name')}>TRADER</th>
              <th style={thSt('total_pnl')}      onClick={() => thClick('total_pnl')}>P&L</th>
              <th style={thSt('win_rate')}        onClick={() => thClick('win_rate')}>WIN RATE</th>
              <th style={thSt('trades_count')}    onClick={() => thClick('trades_count')}>TRADES</th>
              <th style={thSt('volume_traded')}   onClick={() => thClick('volume_traded')}>VOLUME</th>
              <th style={thSt('sharpe_ratio')}    onClick={() => thClick('sharpe_ratio')}>SHARPE</th>
              <th style={thSt('max_drawdown')}    onClick={() => thClick('max_drawdown')}>MAX DD</th>
              <th style={{ ...thSt('sparkline' as keyof TraderPerf), cursor: 'default' }}>10D CHART</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : sorted.map(t => {
              const wr = t.win_rate ?? 0;
              const wrColor = wr >= 0.6 ? 'var(--positive)' : wr >= 0.4 ? '#f59e0b' : 'var(--negative)';
              const sh = t.sharpe_ratio ?? 0;
              const shColor = sh > 1.5 ? 'var(--positive)' : sh > 0.5 ? '#f59e0b' : 'var(--negative)';

              return (
                <tr
                  key={t.user_id}
                  onClick={() => navigate(`/admin/performance/traders/${t.user_id}`)}
                  style={{ borderBottom: '1px solid var(--bg-border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,61,61,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 24px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.display_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.email}</div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: pnlColor(t.total_pnl ?? 0) }}>
                    {fmt(t.total_pnl ?? 0)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: wrColor }}>
                    {(wr * 100).toFixed(1)}%
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--text-primary)' }}>
                    {t.trades_count}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 8px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {fmt(t.volume_traded ?? 0)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 8px', color: shColor, fontFamily: 'var(--font-mono)' }}>
                    {t.sharpe_ratio != null ? t.sharpe_ratio.toFixed(2) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--negative)', fontFamily: 'var(--font-mono)' }}>
                    {t.max_drawdown != null ? `${(Math.abs(t.max_drawdown) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <Sparkline data={t.sparkline} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
