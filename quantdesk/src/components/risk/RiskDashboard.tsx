import { useState, useEffect } from 'react';
import { MOCK_POSITIONS, MOCK_RISK_METRICS } from '../../services/mockData';
import { fetchPortfolios, fetchPositions, type ApiPosition } from '../../services/api/marketApi';
import { fetchLatestSnapshot, type ApiRiskSnapshot } from '../../services/api/riskApi';

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export function RiskDashboard() {
  const [positions, setPositions] = useState<ApiPosition[] | null>(null);
  const [snapshot,  setSnapshot]  = useState<ApiRiskSnapshot | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [portfolioName, setPortfolioName] = useState('PROP-001');

  useEffect(() => {
    fetchPortfolios()
      .then(async (portfolios) => {
        if (!portfolios.length) { setUsingMock(true); return; }
        const p = portfolios[0];
        setPortfolioName(p.name);
        const [pos, snap] = await Promise.all([
          fetchPositions(p.id).catch(() => null),
          fetchLatestSnapshot(p.id).catch(() => null),
        ]);
        if (!pos || pos.length === 0) setUsingMock(true);
        else { setPositions(pos); setUsingMock(false); }
        setSnapshot(snap);
      })
      .catch(() => setUsingMock(true));
  }, []);

  const m = MOCK_RISK_METRICS;
  const totalPnlPct = (m.totalPnl / (m.totalValue - m.totalPnl)) * 100;

  const MetricCard = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div style={{ padding: '6px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)', minWidth: 100 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: color || 'var(--text-primary)', fontWeight: 600 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div className="panel-header" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>MARS — MULTI-ASSET RISK SYSTEM</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>PORTFOLIO: {portfolioName.toUpperCase()} | 95% CI</span>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', flexWrap: 'wrap', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
        <MetricCard label="TOTAL VALUE" value={`$${(m.totalValue / 1e6).toFixed(2)}M`} color="var(--text-primary)" />
        <MetricCard label="TOTAL P&L" value={`+$${(m.totalPnl / 1000).toFixed(0)}K`} color="var(--positive)" />
        <MetricCard label="P&L %" value={fmtPct(totalPnlPct)} color="var(--positive)" />
        <MetricCard label="VAR (95% 1D)" value={snapshot?.var_95_1d != null ? `-$${(Math.abs(snapshot.var_95_1d)/1000).toFixed(0)}K` : `-$${(m.portfolioVar95/1000).toFixed(0)}K`} color="var(--negative)" />
        <MetricCard label="VAR (99% 1D)" value={snapshot?.var_99_1d != null ? `-$${(Math.abs(snapshot.var_99_1d)/1000).toFixed(0)}K` : `-$${(m.portfolioVar99/1000).toFixed(0)}K`} color="var(--negative)" />
        <MetricCard label="CVAR" value={snapshot?.cvar_95 != null ? `-$${(Math.abs(snapshot.cvar_95)/1000).toFixed(0)}K` : `-$${(m.cvar/1000).toFixed(0)}K`} color="var(--negative)" />
        <MetricCard label="SHARPE" value={(snapshot?.sharpe_ratio ?? m.sharpe).toFixed(2)} color={(snapshot?.sharpe_ratio ?? m.sharpe) > 1 ? 'var(--positive)' : 'var(--warning)'} />
        <MetricCard label="SORTINO" value={(snapshot?.sortino_ratio ?? m.sortino).toFixed(2)} color="var(--positive)" />
        <MetricCard label="MAX DD" value={`${(snapshot?.max_drawdown ?? m.maxDrawdown).toFixed(2)}%`} color="var(--negative)" />
        <MetricCard label="BETA (SPX)" value={(snapshot?.beta_to_spx ?? m.beta).toFixed(2)} color="var(--warning)" />
      </div>

      {/* Positions Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 8px' }}>
        <div style={{ padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)', borderBottom: '1px solid var(--bg-border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
          <span>POSITIONS ({usingMock ? MOCK_POSITIONS.length : (positions?.length ?? 0)})</span>
          {usingMock && <span style={{ color: 'var(--warning)' }}>⚠ MOCK DATA</span>}
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>TICKER</th>
              <th>QTY</th><th>AVG COST</th><th>SIDE</th>
            </tr>
          </thead>
          <tbody>
            {usingMock
              ? MOCK_POSITIONS.map(p => (
                  <tr key={p.ticker} className={p.pnl >= 0 ? 'row-positive' : 'row-negative'}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', fontWeight: 600 }}>{p.ticker}</td>
                    <td>{p.qty.toLocaleString()}</td>
                    <td>${p.avgCost.toFixed(2)}</td>
                    <td style={{ color: 'var(--positive)' }}>LONG</td>
                  </tr>
                ))
              : (positions ?? []).map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', fontWeight: 600 }}>{p.ticker}</td>
                    <td>{p.quantity.toLocaleString()}</td>
                    <td>{p.avg_cost != null ? `$${p.avg_cost.toFixed(2)}` : '—'}</td>
                    <td style={{ color: p.side === 'Long' ? 'var(--positive)' : 'var(--negative)' }}>{p.side.toUpperCase()}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Stress Test */}
      <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--bg-border)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)', fontWeight: 600, marginBottom: 6 }}>STRESS SCENARIOS</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: '2008 Crisis', pnl: -28.4 },
            { label: 'COVID Mar 2020', pnl: -22.1 },
            { label: '2022 Rate Shock', pnl: -15.8 },
            { label: 'Equity -20%', pnl: -18.2 },
            { label: 'Vol Spike 40', pnl: -8.4 },
          ].map(s => (
            <div key={s.label} style={{ padding: '4px 8px', background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.2)', borderRadius: 2, cursor: 'pointer' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--negative)', fontWeight: 600 }}>{s.pnl.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
