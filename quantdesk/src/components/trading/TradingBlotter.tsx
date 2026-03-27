import { useState, useEffect, useCallback } from 'react';
import { fetchOrders, submitOrder, cancelOrder, type ApiOrder } from '../../services/api/ordersApi';
import { searchSecurities, type ApiSecurity } from '../../services/api/marketApi';
import { MOCK_ORDERS } from '../../services/mockData';
import type { Order } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  Pending: 'var(--warning)', PartialFill: 'var(--info)',
  Filled: 'var(--positive)', Cancelled: 'var(--text-muted)', Rejected: 'var(--negative)',
  // legacy mock statuses
  PENDING: 'var(--warning)', PARTIAL: 'var(--info)', FILLED: 'var(--positive)', CANCELLED: 'var(--text-muted)',
};

function apiOrderToDisplay(o: ApiOrder) {
  return {
    id:        o.id,
    ticker:    o.security_id, // will be overridden if we have security info
    side:      o.side.toUpperCase() as Order['side'],
    qty:       o.quantity,
    filled:    o.filled_qty,
    remaining: o.quantity - o.filled_qty,
    orderType: o.order_type.toUpperCase() as Order['orderType'],
    price:     o.limit_price,
    status:    o.status.toUpperCase().replace('PARTIALFILL', 'PARTIAL') as Order['status'],
    trader:    'ME',
    timestamp: new Date(o.submitted_at).getTime(),
    account:   'PROP-001',
    _apiId:    o.id,
  };
}

export function TradingBlotter() {
  const [orders, setOrders]       = useState<(Order & { _apiId?: string })[]>([]);
  const [apiError, setApiError]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [ticker, setTicker]       = useState('');
  const [securityId, setSecurityId] = useState('');
  const [suggestions, setSuggestions] = useState<ApiSecurity[]>([]);
  const [side, setSide]           = useState<'Buy' | 'Sell' | 'Short'>('Buy');
  const [qty, setQty]             = useState('');
  const [orderType, setOrderType] = useState<'Limit' | 'Market' | 'Stop' | 'Algo'>('Limit');
  const [price, setPrice]         = useState('');
  const [activeTab, setActiveTab] = useState<'entry' | 'orders' | 'pnl'>('orders');
  const [submitting, setSubmitting] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchOrders({ limit: 100 });
      setOrders(data.map(apiOrderToDisplay));
      setApiError(false);
    } catch {
      // Fall back to mock data if API is unavailable
      setOrders(MOCK_ORDERS as (Order & { _apiId?: string })[]);
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Ticker search → security lookup
  useEffect(() => {
    if (ticker.length < 1) { setSuggestions([]); setSecurityId(''); return; }
    const t = setTimeout(async () => {
      try {
        const results = await searchSecurities(ticker);
        setSuggestions(results);
        if (results.length === 1) setSecurityId(results[0].id);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [ticker]);

  const handleSubmit = async () => {
    if (!ticker || !qty) return;
    setSubmitting(true);
    try {
      if (securityId && !apiError) {
        const order = await submitOrder({
          securityId,
          side:       side as 'Buy' | 'Sell' | 'Short' | 'Cover',
          orderType:  orderType as 'Market' | 'Limit' | 'Stop' | 'StopLimit' | 'Algo',
          quantity:   parseInt(qty),
          limitPrice: price ? parseFloat(price) : undefined,
          tif:        'DAY',
        });
        setOrders(prev => [apiOrderToDisplay(order), ...prev]);
      } else {
        // Offline / mock mode
        const mock: Order & { _apiId?: string } = {
          id: Date.now().toString(), ticker: ticker.toUpperCase(),
          side: side.toUpperCase() as 'BUY', qty: parseInt(qty), filled: 0,
          remaining: parseInt(qty), orderType: orderType.toUpperCase() as 'LIMIT',
          price: price ? parseFloat(price) : null,
          status: 'PENDING', trader: 'J.SMITH', timestamp: Date.now(), account: 'PROP-001',
        };
        setOrders(prev => [mock, ...prev]);
      }
      setTicker(''); setQty(''); setPrice(''); setSecurityId(''); setSuggestions([]);
    } catch (err) {
      console.error('[blotter] Submit failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (order: Order & { _apiId?: string }) => {
    if (order._apiId && !apiError) {
      try {
        await cancelOrder(order._apiId);
        await loadOrders();
        return;
      } catch { /* fall through to local cancel */ }
    }
    setOrders(prev => prev.map(o =>
      o.id === order.id && (o.status === 'PENDING' || o.status === 'PARTIAL')
        ? { ...o, status: 'CANCELLED' as const }
        : o,
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>TOMS — TRADE ORDER MANAGEMENT</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: apiError ? 'var(--warning)' : 'var(--positive)' }}>
          {apiError ? '⚠ MOCK DATA' : '● LIVE'}
        </span>
      </div>

      <div className="tab-bar">
        {(['entry', 'orders', 'pnl'] as const).map(tab => (
          <div key={tab} className={`tab-item${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'entry' ? 'ORDER ENTRY' : tab === 'orders' ? `BLOTTER (${orders.length})` : 'P&L'}
          </div>
        ))}
      </div>

      {activeTab === 'entry' && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            Shortcuts: <span style={{ color: 'var(--positive)' }}>B</span>=Buy&nbsp;&nbsp;
            <span style={{ color: 'var(--negative)' }}>S</span>=Sell&nbsp;&nbsp;
            <span style={{ color: 'var(--info)' }}>Enter</span>=Submit
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 6 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>TICKER</div>
              <input
                className="terminal-input"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL"
                style={{ textTransform: 'uppercase' }}
              />
              {suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', zIndex: 10 }}>
                  {suggestions.slice(0, 5).map(s => (
                    <div
                      key={s.id}
                      style={{ padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10 }}
                      onClick={() => { setTicker(s.ticker); setSecurityId(s.id); setSuggestions([]); }}
                    >
                      <span style={{ color: 'var(--accent-primary)' }}>{s.ticker}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>SIDE</div>
              <select
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: side === 'Buy' ? 'var(--positive)' : 'var(--negative)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 8px', width: '100%', outline: 'none' }}
                value={side} onChange={e => setSide(e.target.value as 'Buy' | 'Sell' | 'Short')}
              >
                <option value="Buy">BUY</option>
                <option value="Sell">SELL</option>
                <option value="Short">SHORT</option>
              </select>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>QUANTITY</div>
              <input className="terminal-input" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" type="number" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>TYPE</div>
              <select
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 8px', width: '100%', outline: 'none' }}
                value={orderType} onChange={e => setOrderType(e.target.value as 'Limit' | 'Market' | 'Stop' | 'Algo')}
              >
                <option value="Limit">LIMIT</option>
                <option value="Market">MARKET</option>
                <option value="Stop">STOP</option>
                <option value="Algo">ALGO</option>
              </select>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>PRICE</div>
              <input className="terminal-input" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" type="number" step="0.01" disabled={orderType === 'Market'} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              className="btn"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ background: side === 'Buy' ? 'rgba(0,212,170,0.2)' : 'rgba(255,61,61,0.2)', border: `1px solid ${side === 'Buy' ? 'var(--positive)' : 'var(--negative)'}`, color: side === 'Buy' ? 'var(--positive)' : 'var(--negative)', padding: '5px 20px', fontWeight: 600, fontSize: 12 }}
            >
              {submitting ? 'SUBMITTING…' : `${side.toUpperCase()} ${ticker || '—'}`}
            </button>
            <button className="btn btn-secondary">PRE-TRADE CHECK</button>
            <button className="btn btn-secondary">COMPLIANCE</button>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
            [AI-Generated — Verify Before Trading] | Account: PROP-001
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Loading orders…</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>TIME</th>
                  <th>TICKER</th><th>SIDE</th><th>QTY</th>
                  <th>FILLED</th><th>REM</th><th>PRICE</th>
                  <th>TYPE</th><th>STATUS</th><th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(o.timestamp).toLocaleTimeString()}</td>
                    <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{o.ticker}</td>
                    <td style={{ color: o.side === 'BUY' ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>{String(o.side).toUpperCase()}</td>
                    <td>{o.qty.toLocaleString()}</td>
                    <td style={{ color: o.filled > 0 ? 'var(--positive)' : 'var(--text-muted)' }}>{o.filled.toLocaleString()}</td>
                    <td style={{ color: o.remaining > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{o.remaining.toLocaleString()}</td>
                    <td>{o.price ? `$${o.price.toFixed(2)}` : 'MKT'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{String(o.orderType).toUpperCase()}</td>
                    <td style={{ color: STATUS_COLORS[o.status] ?? 'var(--text-muted)', fontWeight: 600 }}>{String(o.status).toUpperCase()}</td>
                    <td>
                      {(o.status === 'PENDING' || o.status === 'PARTIAL') && (
                        <button className="btn btn-negative" style={{ fontSize: 8, padding: '1px 5px' }} onClick={() => handleCancel(o)}>CANCEL</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'pnl' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', marginBottom: 12 }}>DAILY P&L ATTRIBUTION</div>
          {[
            { trader: 'J.SMITH', pnl: 28450, pct: 2.14, trades: 12, strategy: 'Equity L/S' },
            { trader: 'M.JONES', pnl: -8200, pct: -0.98, trades: 5, strategy: 'Event Driven' },
            { trader: 'S.LEE', pnl: 15600, pct: 1.45, trades: 8, strategy: 'Index Arb' },
          ].map(row => (
            <div key={row.trader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--bg-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{row.trader}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{row.strategy}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{row.trades} trades</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: row.pnl >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
                {row.pnl >= 0 ? '+' : ''}${row.pnl.toLocaleString()}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: row.pct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {row.pct >= 0 ? '+' : ''}{row.pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
