import { useLivePrice } from '../../hooks/useLivePrice';
import { useTerminalStore } from '../../stores/terminalStore';
import { SECURITIES } from '../../services/mockData';

export function SecurityHeader() {
  const { activeTicker } = useTerminalStore();
  const { price, isLive, isLoading } = useLivePrice(activeTicker);
  const sec = SECURITIES.find(s => s.ticker === activeTicker);

  if (isLoading && !price) {
    return (
      <div style={{ height: 42, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
        <div className="skeleton" style={{ height: '100%', opacity: 0.5 }} />
      </div>
    );
  }

  if (!price) return null;

  const isUp = price.change >= 0;
  const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtVol = (n: number) =>
    n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
    : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
    : n > 0 ? `${(n / 1e3).toFixed(0)}K`
    : '—';

  const Field = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 16, flexShrink: 0 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ background: 'var(--accent-muted)', borderBottom: '1px solid var(--bg-border)', padding: '4px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', gap: 0 }}>
        {/* Ticker */}
        <div style={{ marginRight: 16, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-primary)', fontWeight: 700 }}>{activeTicker}</span>
          {sec && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', marginLeft: 6 }}>{sec.exchange}</span>}
        </div>

        <Field label="LAST" value={fmt(price.last)} color="var(--text-primary)" />
        <Field label="CHG" value={`${isUp ? '+' : ''}${fmt(price.change)}`} color={isUp ? 'var(--positive)' : 'var(--negative)'} />
        <Field label="%CHG" value={`${isUp ? '+' : ''}${fmt(price.changePct)}%`} color={isUp ? 'var(--positive)' : 'var(--negative)'} />

        {price.bid > 0 && <Field label="BID" value={fmt(price.bid)} />}
        {price.ask > 0 && <Field label="ASK" value={fmt(price.ask)} />}

        <div style={{ width: 1, background: 'var(--bg-border)', height: 30, margin: '0 12px', flexShrink: 0 }} />

        <Field label="OPEN" value={price.open > 0 ? fmt(price.open) : '—'} />
        <Field label="HI" value={price.high > 0 ? fmt(price.high) : '—'} color="var(--positive)" />
        <Field label="LO" value={price.low > 0 ? fmt(price.low) : '—'} color="var(--negative)" />
        <Field label="PREV" value={price.prevClose > 0 ? fmt(price.prevClose) : '—'} />
        {price.volume > 0 && <Field label="VOL" value={fmtVol(price.volume)} />}
        {price.vwap > 0 && <Field label="VWAP" value={fmt(price.vwap)} color="var(--highlight)" />}

        {sec && (
          <>
            <div style={{ width: 1, background: 'var(--bg-border)', height: 30, margin: '0 12px', flexShrink: 0 }} />
            <Field label="SECTOR" value={sec.sector} color="var(--text-secondary)" />
          </>
        )}

        {/* Live/Delayed indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span className={`status-dot ${isLive ? 'open' : 'pre-market'}`} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isLive ? 'var(--positive)' : 'var(--warning)' }}>
            {isLive ? 'LIVE' : 'DELAYED'}
          </span>
        </div>
      </div>
    </div>
  );
}
