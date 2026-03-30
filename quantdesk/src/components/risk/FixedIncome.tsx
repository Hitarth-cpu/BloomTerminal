import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MOCK_BONDS } from '../../services/mockData';

function generateBondPriceHistory() {
  const data = [];
  const base = 99.92;
  const now = Date.now();
  let price = base - 0.1;
  for (let i = 48; i >= 0; i--) {
    const ts = now - i * 3600000;
    const noise = (Math.sin(i * 0.8) * 0.05) + (Math.cos(i * 1.2) * 0.03);
    if (i === 20) price = base - 0.35; // V-dip
    else if (i === 18) price = base + 0.05; // recovery
    else price += noise;
    data.push({ ts, price: +price.toFixed(4), mid: +(price + 0.015).toFixed(4), bid: +(price).toFixed(4), ask: +(price + 0.029).toFixed(4) });
  }
  return data;
}

export function FixedIncome() {
  const bond = MOCK_BONDS[0];
  const chartData = useMemo(() => generateBondPriceHistory(), []);

  const MetaField = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 20 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Path */}
      <div className="panel-header" style={{ flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
          CAT 3¾ 02/23/2029 Corp &gt; IBVAL &gt; Related Functions
        </span>
      </div>

      {/* Security Header */}
      <div style={{ background: 'var(--accent-muted)', padding: '4px 10px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 700 }}>CAT 3 3/4 02/23/2029 Corp</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{bond.mid.toFixed(3)}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--positive)' }}>+.003</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{bond.bid.toFixed(3)} / {bond.ask.toFixed(3)}</span>
          <span style={{ color: 'var(--bg-border)' }}>|</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--highlight)' }}>G-Spread: +{bond.gSpread.toFixed(2)}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--highlight)' }}>I-Spread: +{bond.iSpread.toFixed(2)}</span>
          <span style={{ color: 'var(--bg-border)' }}>|</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>Yield: {bond.yield.toFixed(3)}%</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>Rating: {bond.rating}</span>
        </div>
      </div>

      {/* IBVAL Banner */}
      <div className="warning-banner" style={{ flexShrink: 0 }}>
        ■ CAT 3¾ 02/23/2029 Corp | Source: IBVAL | Price {bond.mid.toFixed(2)} as of {new Date().toLocaleString()}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
        {/* Range selector */}
        <div className="tab-bar" style={{ flexShrink: 0 }}>
          {['1D', '1W', '1M', '3M', '6M'].map((r, i) => (
            <div key={r} className={`tab-item${i === 0 ? ' active' : ''}`}>{r}</div>
          ))}
          <div className="tab-item" style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 9 }}>■ Mid Price</span>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <AreaChart data={chartData} margin={{ top: 4, right: 40, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="ts"
                tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--bg-border)' }}
                minTickGap={60}
              />
              <YAxis
                domain={['auto', 'auto']}
                orientation="right"
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                formatter={(value) => [Number(value).toFixed(3), 'Mid Price']}
                labelFormatter={v => new Date(v).toLocaleString()}
              />
              <ReferenceLine y={bond.mid} stroke="var(--text-muted)" strokeDasharray="2 2" strokeWidth={0.5} />
              <Area type="monotone" dataKey="mid" stroke="var(--info)" strokeWidth={1.5} fill="rgba(68,136,255,0.08)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metadata */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--bg-border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <MetaField label="ISSUER" value={bond.issuer} />
          <MetaField label="STRUCTURE" value={bond.structure} />
          <MetaField label="COUPON" value={`${bond.coupon.toFixed(6)}`} />
          <MetaField label="SECTOR" value={bond.sector} />
          <MetaField label="AMT OUTSTANDING" value={`${(bond.amtOutstanding / 1e6).toFixed(0)}M`} />
          <MetaField label="COUPON FREQ" value={bond.couponFreq} />
          <MetaField label="RATINGS" value={bond.rating} />
          <MetaField label="ISSUE DATE" value={bond.issueDate} />
          <MetaField label="DAY COUNT" value={bond.dayCount} />
        </div>
      </div>
    </div>
  );
}
