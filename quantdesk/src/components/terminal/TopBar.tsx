import { useState, useEffect, useRef } from 'react';
import { Search, Bell, User, Wifi, ChevronDown, LogOut, Settings, Shield } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../services/auth/authService';
import { useBatchQuotes } from '../../hooks/useFinnhubQuote';

// ETF proxies for index display (Finnhub doesn't support index symbols directly)
const INDEX_MAP = [
  { display: 'SPX', fetch: 'SPY', name: 'S&P 500' },
  { display: 'NDX', fetch: 'QQQ', name: 'NASDAQ' },
  { display: 'DJIA', fetch: 'DIA', name: 'DOW' },
  { display: 'RUT', fetch: 'IWM', name: 'RUSS 2K' },
  { display: 'GLD', fetch: 'GLD', name: 'GOLD' },
  { display: 'USO', fetch: 'USO', name: 'WTI' },
  { display: 'VIX', fetch: 'VIXY', name: 'VIX' },
];

const FETCH_TICKERS = INDEX_MAP.map(i => i.fetch);

export function TopBar() {
  const { activeTicker, toggleAskb, toggleIbChat, alerts } = useTerminalStore();
  const { user, logout } = useAuthStore();
  const [time, setTime] = useState(new Date());
  const [searchVal, setSearchVal] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await signOut().catch(() => {});
    logout();
  };

  const { data: indexPrices } = useBatchQuotes(FETCH_TICKERS);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (d: Date, tz: string) =>
    d.toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;

  return (
    <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--bg-border)', height: '48px', display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
      {/* Logo + Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRight: '1px solid var(--bg-border)', minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 24, height: 24, background: 'var(--accent-primary)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#000' }}>QD</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600, letterSpacing: 1 }}>QUANTDESK</span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>{activeTicker} &gt; MKT</span>
      </div>

      {/* Omnisearch */}
      <div style={{ flex: '0 0 280px', display: 'flex', alignItems: 'center', padding: '0 8px', borderRight: '1px solid var(--bg-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '3px 8px', width: '100%' }}>
          <Search size={11} color="var(--text-muted)" />
          <input
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11, width: '100%' }}
            placeholder="Search ticker, function, contact..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-border)', padding: '1px 4px', borderRadius: 2 }}>Ctrl+L</span>
        </div>
      </div>

      {/* Global Indices Ticker — live via Finnhub */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', padding: '0 8px', gap: 16, borderRight: '1px solid var(--bg-border)' }}>
        {INDEX_MAP.map(idx => {
          const q = indexPrices?.find(p => p.ticker === idx.fetch);
          const changePct = q?.changePct ?? 0;
          const price = q?.last ?? 0;
          return (
            <div key={idx.display} style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{idx.display}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>
                {price > 0 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: changePct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {price > 0 ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', borderLeft: '1px solid var(--bg-border)' }}>
        {/* World Clocks */}
        <div style={{ display: 'flex', gap: 12, padding: '0 8px', borderRight: '1px solid var(--bg-border)', marginRight: 8 }}>
          {[
            { label: 'NY', tz: 'America/New_York' },
            { label: 'LON', tz: 'Europe/London' },
            { label: 'TYO', tz: 'Asia/Tokyo' },
          ].map(c => (
            <div key={c.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{c.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--highlight)' }}>{fmt(time, c.tz)}</div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
          <span className="status-dot open" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--positive)' }}>LIVE</span>
        </div>
        <Wifi size={12} color="var(--positive)" />

        {/* AI Button */}
        <button onClick={toggleAskb} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(255,102,0,0.15)', border: '1px solid rgba(255,102,0,0.4)', borderRadius: 2, cursor: 'pointer', marginLeft: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', fontWeight: 600 }}>AI</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)' }}>F9</span>
        </button>

        {/* IB */}
        <button onClick={toggleIbChat} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)', borderRadius: 2, cursor: 'pointer', marginLeft: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>IB</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>F8</span>
        </button>

        {/* Alerts */}
        <div style={{ position: 'relative', padding: '0 6px', cursor: 'pointer' }}>
          <Bell size={14} color={criticalAlerts > 0 ? 'var(--negative)' : 'var(--text-muted)'} />
          {criticalAlerts > 0 && (
            <div style={{ position: 'absolute', top: -2, right: 2, background: 'var(--negative)', color: '#fff', borderRadius: '50%', width: 12, height: 12, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)' }}>
              {criticalAlerts}
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setUserMenuOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', cursor: 'pointer', height: 48, transition: 'background 0.1s', background: userMenuOpen ? 'rgba(255,102,0,0.08)' : 'transparent' }}
            onMouseEnter={e => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{ width: 22, height: 22, background: 'var(--accent-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={12} color="var(--accent-primary)" />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
              {(user?.displayName ?? user?.email?.split('@')[0] ?? 'TRADER').toUpperCase().slice(0, 12)}
            </span>
            <ChevronDown
              size={10}
              color="var(--text-muted)"
              style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            />
          </div>

          {/* Dropdown panel */}
          {userMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0,
              width: 200, background: 'var(--bg-secondary)',
              border: '1px solid var(--bg-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
            }}>
              {/* User info header */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={14} color="var(--accent-primary)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(user?.displayName ?? user?.email?.split('@')[0] ?? 'Trader')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email ?? ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <span className="status-dot open" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--positive)' }}>SESSION ACTIVE</span>
                </div>
              </div>

              {/* Menu items */}
              {[
                { icon: Settings, label: 'SETTINGS',   action: () => setUserMenuOpen(false) },
                { icon: Shield,   label: 'SECURITY',   action: () => setUserMenuOpen(false) },
              ].map(item => (
                <div
                  key={item.label}
                  onClick={item.action}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <item.icon size={11} color="var(--text-muted)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>{item.label}</span>
                </div>
              ))}

              {/* Divider + Sign out */}
              <div style={{ borderTop: '1px solid var(--bg-border)' }}>
                <div
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,61,61,0.08)'; (e.currentTarget.querySelector('span') as HTMLElement).style.color = 'var(--negative)'; (e.currentTarget.querySelector('svg') as SVGElement).style.color = 'var(--negative)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget.querySelector('span') as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget.querySelector('svg') as SVGElement).style.color = 'var(--text-muted)'; }}
                >
                  <LogOut size={11} color="var(--text-muted)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 0.5, fontWeight: 600 }}>SIGN OUT</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
