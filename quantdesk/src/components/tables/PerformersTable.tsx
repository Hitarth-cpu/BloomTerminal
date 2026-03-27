import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useBatchQuotes } from '../../hooks/useFinnhubQuote';
import { useTerminalStore } from '../../stores/terminalStore';
import { SECURITIES } from '../../services/mockData';
import type { PriceData } from '../../types';

const ALL_TICKERS = SECURITIES.map(s => s.ticker);

export function PerformersTable() {
  const { setActiveTicker } = useTerminalStore();
  const { data: prices, isLoading, isFetching, dataUpdatedAt } = useBatchQuotes(ALL_TICKERS);

  const sorted = [...(prices ?? [])].sort((a, b) => b.changePct - a.changePct);
  const top10 = sorted.slice(0, 10);
  const bottom10 = sorted.slice(-10).reverse();
  const remaining = sorted.slice(10, sorted.length - 10);

  const fmtPrice = (p: number) => p > 0
    ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
  const secName = (ticker: string) => SECURITIES.find(s => s.ticker === ticker)?.name || ticker;

  const PerformerRow = ({ p, isPositive }: { p: PriceData; isPositive: boolean }) => (
    <tr
      className={isPositive ? 'row-positive' : 'row-negative'}
      style={{ cursor: 'pointer' }}
      onClick={() => setActiveTicker(p.ticker)}
    >
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isPositive ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>{p.ticker}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{fmtPrice(p.last)}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isPositive ? 'var(--positive)' : 'var(--negative)' }}>
        {p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}
      </td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isPositive ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
        {p.changePct >= 0 ? '+' : ''}{p.changePct.toFixed(2)}%
      </td>
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>MOVERS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isFetching && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--info)' }}>UPDATING...</span>}
          {dataUpdatedAt > 0 && !isFetching && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <RefreshCw size={10} color={isFetching ? 'var(--info)' : 'var(--text-muted)'} />
        </div>
      </div>

      {isLoading && !prices ? (
        <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 18, borderRadius: 2 }} />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Top Performers */}
          <div style={{ padding: '4px 8px 2px', borderBottom: '1px solid var(--bg-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <TrendingUp size={10} color="var(--positive)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--positive)', fontWeight: 600 }}>TOP (10)</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>TICKER</th>
                  <th>LAST</th>
                  <th>CHG</th>
                  <th>%CHG</th>
                </tr>
              </thead>
              <tbody>
                {top10.map(p => <PerformerRow key={p.ticker} p={p} isPositive={true} />)}
              </tbody>
            </table>
          </div>

          {/* Bottom Performers */}
          <div style={{ padding: '4px 8px 2px', borderBottom: '1px solid var(--bg-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <TrendingDown size={10} color="var(--negative)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--negative)', fontWeight: 600 }}>BOTTOM (10)</span>
            </div>
            <table className="data-table">
              <tbody>
                {bottom10.map(p => <PerformerRow key={p.ticker} p={p} isPositive={false} />)}
              </tbody>
            </table>
          </div>

          {/* Remaining */}
          <div style={{ padding: '4px 8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
              REMAINING ({remaining.length})
            </span>
            <div style={{ overflow: 'auto', maxHeight: 200 }}>
              <table className="data-table">
                <tbody>
                  {remaining.map(p => (
                    <tr key={p.ticker} style={{ cursor: 'pointer' }} onClick={() => setActiveTicker(p.ticker)}>
                      <td style={{ fontSize: 10 }}>{p.ticker}</td>
                      <td style={{ fontSize: 10 }}>{fmtPrice(p.last)}</td>
                      <td style={{ fontSize: 10, color: p.changePct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                        {p.changePct >= 0 ? '+' : ''}{p.changePct.toFixed(2)}%
                      </td>
                      <td style={{ fontSize: 10, color: 'var(--text-muted)' }}>{secName(p.ticker).slice(0, 14)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
