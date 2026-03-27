import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Activity, DollarSign, Bitcoin } from 'lucide-react';
import { useSmartPoll } from '../../hooks/useSmartPoll';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface YahooQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
}

interface CryptoItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d?: { price: number[] };
}

interface FearGreedResponse {
  data: Array<{ value: string; value_classification: string }>;
}

type MarketTab = 'indices' | 'stocks' | 'crypto' | 'commodities';

// ─── Mini sparkline SVG ─────────────────────────────────────────────────────────
function Sparkline({ data, color, width = 60, height = 20 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────
export function MarketOverview() {
  const [tab, setTab] = useState<MarketTab>('indices');
  const [indices, setIndices] = useState<YahooQuote[]>([]);
  const [stocks, setStocks] = useState<YahooQuote[]>([]);
  const [crypto, setCrypto] = useState<CryptoItem[]>([]);
  const [commodities, setCommodities] = useState<YahooQuote[]>([]);
  const [fearGreed, setFearGreed] = useState<{ value: number; label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const [idxRes, stkRes, cryptoRes, cmdRes, fgRes] = await Promise.allSettled([
        fetch('/api/market-data/indices').then(r => r.json()),
        fetch('/api/market-data/quotes?symbols=AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA,JPM,V,MA').then(r => r.json()),
        fetch('/api/market-data/crypto').then(r => r.json()),
        fetch('/api/market-data/commodities').then(r => r.json()),
        fetch('/api/market-data/fear-greed').then(r => r.json()),
      ]);

      if (idxRes.status === 'fulfilled') setIndices(idxRes.value.indices ?? []);
      if (stkRes.status === 'fulfilled') setStocks(stkRes.value.quotes ?? []);
      if (cryptoRes.status === 'fulfilled') setCrypto(cryptoRes.value.crypto ?? []);
      if (cmdRes.status === 'fulfilled') setCommodities(cmdRes.value.commodities ?? []);
      if (fgRes.status === 'fulfilled') {
        const fg = fgRes.value as FearGreedResponse;
        if (fg.data?.[0]) {
          setFearGreed({ value: parseInt(fg.data[0].value), label: fg.data[0].value_classification });
        }
      }
      setLastUpdate(Date.now());
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useSmartPoll(fetchData, { intervalMs: 60_000, pauseWhenHidden: true });

  const TABS: { id: MarketTab; label: string; icon: React.ReactNode }[] = [
    { id: 'indices', label: 'INDICES', icon: <Activity size={12} /> },
    { id: 'stocks', label: 'STOCKS', icon: <TrendingUp size={12} /> },
    { id: 'crypto', label: 'CRYPTO', icon: <Bitcoin size={12} /> },
    { id: 'commodities', label: 'COMMODITIES', icon: <DollarSign size={12} /> },
  ];

  const renderQuote = (q: YahooQuote) => {
    const change = q.regularMarketChange ?? 0;
    const pct = q.regularMarketChangePercent ?? 0;
    const isUp = change > 0;
    const color = isUp ? '#22c55e' : change < 0 ? '#ef4444' : '#888';

    return (
      <div key={q.symbol} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e0e0e0' }}>{q.symbol}</div>
          <div style={{ fontSize: 9, color: '#888', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {q.shortName || q.longName || ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', fontVariantNumeric: 'tabular-nums' }}>
            {(q.regularMarketPrice ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 10, color, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
            {isUp ? <TrendingUp size={9} /> : change < 0 ? <TrendingDown size={9} /> : <Minus size={9} />}
            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </div>
        </div>
      </div>
    );
  };

  const renderCrypto = (c: CryptoItem) => {
    const pct = c.price_change_percentage_24h ?? 0;
    const isUp = pct > 0;
    const color = isUp ? '#22c55e' : pct < 0 ? '#ef4444' : '#888';

    return (
      <div key={c.id} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e0e0e0' }}>{c.symbol.toUpperCase()}</div>
          <div style={{ fontSize: 9, color: '#888' }}>{c.name}</div>
        </div>
        {c.sparkline_in_7d?.price && (
          <Sparkline data={c.sparkline_in_7d.price.slice(-24)} color={color} width={50} height={16} />
        )}
        <div style={{ textAlign: 'right', marginLeft: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', fontVariantNumeric: 'tabular-nums' }}>
            ${c.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 10, color, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
            {isUp ? <TrendingUp size={9} /> : pct < 0 ? <TrendingDown size={9} /> : <Minus size={9} />}
            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </div>
        </div>
      </div>
    );
  };

  const fgColor = !fearGreed ? '#888' :
    fearGreed.value >= 70 ? '#22c55e' :
    fearGreed.value >= 50 ? '#f59e0b' :
    fearGreed.value >= 30 ? '#f97316' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)' }}>
      {/* Fear & Greed banner */}
      {fearGreed && (
        <div style={{
          padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <span style={{ fontSize: 10, color: '#888' }}>FEAR & GREED INDEX</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 60, height: 6, background: '#222', borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{ width: `${fearGreed.value}%`, height: '100%', background: fgColor, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: fgColor, fontVariantNumeric: 'tabular-nums' }}>
              {fearGreed.value}
            </span>
            <span style={{ fontSize: 9, color: fgColor }}>{fearGreed.label}</span>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '4px 10px', fontSize: 9, fontWeight: 700, borderRadius: 2, border: 'none',
            background: tab === t.id ? 'var(--accent-primary, #ff6600)' : 'transparent',
            color: tab === t.id ? '#000' : '#888',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {lastUpdate > 0 && (
            <span style={{ fontSize: 8, color: '#555' }}>
              {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
          <RefreshCw
            size={10} style={{ color: '#555', cursor: 'pointer', animation: loading ? 'spin 1s linear infinite' : 'none' }}
            onClick={() => void fetchData()}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && !indices.length ? (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: 0.3 }}>
              <div style={{ height: 10, background: '#333', borderRadius: 2, width: '40%', marginBottom: 4 }} />
              <div style={{ height: 8, background: '#333', borderRadius: 2, width: '25%' }} />
            </div>
          ))
        ) : (
          <>
            {tab === 'indices' && indices.map(renderQuote)}
            {tab === 'stocks' && stocks.map(renderQuote)}
            {tab === 'crypto' && crypto.map(renderCrypto)}
            {tab === 'commodities' && commodities.map(renderQuote)}
            {((tab === 'indices' && !indices.length) ||
              (tab === 'stocks' && !stocks.length) ||
              (tab === 'crypto' && !crypto.length) ||
              (tab === 'commodities' && !commodities.length)) && (
              <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 11 }}>
                No data available. Markets may be closed.
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
