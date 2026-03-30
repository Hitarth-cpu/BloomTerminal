import { useState } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area } from 'recharts';
import { useOHLCV } from '../../hooks/useAlphaVantageOHLCV';
import type { TimeRange } from '../../types';

interface PriceChartProps {
  ticker: string;
  showVolume?: boolean;
  compact?: boolean;
}

const TIME_RANGES: TimeRange[] = ['1D', '3D', '1M', '6M', 'YTD', '1Y', '5Y', 'Max'];

function formatDate(ts: number, range: TimeRange) {
  const d = new Date(ts);
  if (range === '1D' || range === '3D') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (range === '1M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number; name: string }[]; label?: number }) => {
  if (!active || !payload?.length) return null;
  const price = payload.find(p => p.name === 'close');
  const vol = payload.find(p => p.name === 'volume');
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
      {price && <div style={{ color: 'var(--text-primary)' }}>Price: <span style={{ color: 'var(--highlight)' }}>{Number(price.value).toFixed(2)}</span></div>}
      {vol && vol.value > 0 && <div style={{ color: 'var(--text-secondary)' }}>Vol: {(Number(vol.value) / 1e6).toFixed(1)}M</div>}
    </div>
  );
};

export function PriceChart({ ticker, showVolume = true, compact = false }: PriceChartProps) {
  const [range, setRange] = useState<TimeRange>('1Y');
  const { data, isLoading, isError } = useOHLCV(ticker, range);

  const bars = data ?? [];
  const firstClose = bars[0]?.close || 0;
  const lastClose = bars[bars.length - 1]?.close || 0;
  const isUp = lastClose >= firstClose;
  const minPrice = bars.length ? Math.min(...bars.map(d => d.low)) * 0.999 : 0;
  const maxPrice = bars.length ? Math.max(...bars.map(d => d.high)) * 1.001 : 1;
  const maxVol = bars.length ? Math.max(...bars.map(d => d.volume)) : 1;
  const chartColor = isUp ? 'var(--chart-up)' : 'var(--chart-down)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Range selector */}
      {!compact && (
        <div style={{ display: 'flex', gap: 2, padding: '4px 8px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
          {TIME_RANGES.map(r => (
            <button
              key={r}
              className={`tab-item${range === r ? ' active' : ''}`}
              style={{ border: 'none', background: range === r ? 'var(--bg-tertiary)' : 'transparent' }}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="skeleton" style={{ width: '90%', height: '60%', borderRadius: 2 }} />
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="no-data" style={{ flex: 1 }}>NO DATA</div>
      )}

      {/* Chart */}
      {!isLoading && bars.length > 0 && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <ComposedChart data={bars} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v) => formatDate(v, range)}
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--bg-border)' }}
                minTickGap={40}
              />
              <YAxis
                yAxisId="price"
                domain={[minPrice, maxPrice]}
                orientation="right"
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v.toFixed(0)}
              />
              {showVolume && (
                <YAxis yAxisId="vol" orientation="left" domain={[0, maxVol * 4]} hide />
              )}
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine yAxisId="price" y={firstClose} stroke="var(--text-muted)" strokeDasharray="3 3" strokeWidth={0.5} />
              {showVolume && (
                <Bar yAxisId="vol" dataKey="volume" fill="var(--chart-volume)" opacity={0.6} />
              )}
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke={chartColor}
                strokeWidth={1.5}
                fill={isUp ? 'rgba(0,212,170,0.06)' : 'rgba(255,61,61,0.06)'}
                dot={false}
                activeDot={{ r: 3, fill: chartColor }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
