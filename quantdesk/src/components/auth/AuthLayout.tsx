import { useEffect, useState } from 'react';
import { Lock, Shield, Wifi } from 'lucide-react';
import { TerminalTickerBar } from './TerminalTickerBar';

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
      {time.toLocaleTimeString('en-US', { hour12: false })}
    </span>
  );
}

function MarketStatus() {
  const isOpen = () => {
    const now = new Date();
    const day = now.getDay();
    const mins = now.getHours() * 60 + now.getMinutes();
    return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
  };
  const open = isOpen();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: open ? 'var(--positive)' : 'var(--text-muted)',
          boxShadow: open ? '0 0 6px var(--positive)' : 'none',
        }}
        className={open ? 'auth-pulse' : undefined}
      />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: open ? 'var(--positive)' : 'var(--text-muted)', letterSpacing: 0.5 }}>
        {open ? 'NYSE OPEN' : 'MARKET CLOSED'}
      </span>
    </div>
  );
}

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* CRT scanline overlay */}
      <div className="auth-scanlines" />

      {/* Drifting grid background */}
      <div className="auth-grid-bg" />

      {/* ── Top status bar ─────────────────────────────────────────────────── */}
      <div style={{
        height: 28, background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--bg-border)',
        display: 'flex', alignItems: 'center', flexShrink: 0,
        zIndex: 10, position: 'relative',
      }}>
        {/* Brand */}
        <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid var(--bg-border)', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, letterSpacing: 1 }}>
            QUANTDESK
          </span>
        </div>

        {/* Scrolling ticker */}
        <TerminalTickerBar />

        {/* Clock + market status */}
        <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--bg-border)', flexShrink: 0 }}>
          <MarketStatus />
          <LiveClock />
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {children}
      </div>

      {/* ── Bottom status bar ──────────────────────────────────────────────── */}
      <div style={{
        height: 22, background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--bg-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', flexShrink: 0, zIndex: 10, position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--positive)' }}>
            <Lock size={8} />
            <span><span style={{ color: 'var(--positive)' }}>AES-256-GCM</span> ENCRYPTED</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)' }}>
            <Shield size={8} /> TLS 1.3
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--positive)' }}>
            <Wifi size={8} /> SECURE CONNECTION
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>v1.0.0</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>© 2025 QuantDesk</span>
        </div>
      </div>
    </div>
  );
}
