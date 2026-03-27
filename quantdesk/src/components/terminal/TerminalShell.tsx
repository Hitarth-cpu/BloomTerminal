import { useEffect, useRef, useState, useCallback } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';
import { TopBar } from './TopBar';
import { LeftNav } from './LeftNav';
import { BottomBar } from './BottomBar';
import { MarketDataPanel } from './MarketDataPanel';
import { IBChat } from '../ib-chat/IBChat';
import { RiskDashboard } from '../risk/RiskDashboard';
import { TradingBlotter } from '../trading/TradingBlotter';
import { ResearchModule } from '../../pages/research/ResearchModule';
import { ASKBPanel } from '../ai/ASKBPanel';

function MainContent() {
  const { activeModule, askbOpen, ibChatOpen } = useTerminalStore();
  const [rightWidth, setRightWidth] = useState(380);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(380);

  const rightOpen = askbOpen || ibChatOpen;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = rightWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.max(280, Math.min(600, startWidth.current + delta));
      setRightWidth(newWidth);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const renderMain = () => {
    switch (activeModule) {
      case 'markets':   return <MarketDataPanel />;
      case 'research':  return <ResearchModule />;
      case 'trading':   return <TradingBlotter />;
      case 'analytics': return <RiskDashboard />;
      case 'portfolio': return <RiskDashboard />;
      case 'messaging': return <IBChat />;
      case 'settings':  return <SettingsPanel />;
      default:          return <MarketDataPanel />;
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* Main content area */}
      <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
        {renderMain()}
      </div>

      {/* Drag handle */}
      {rightOpen && (
        <div
          onMouseDown={onMouseDown}
          style={{
            width: 4,
            background: 'var(--bg-border)',
            cursor: 'col-resize',
            flexShrink: 0,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-border)')}
        />
      )}

      {/* Right panel — always mounted, width-animated */}
      <div
        style={{
          width: rightOpen ? rightWidth : 0,
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          flexShrink: 0,
          transition: isDragging.current ? 'none' : 'width 0.18s ease',
          borderLeft: rightOpen ? '1px solid var(--bg-border)' : 'none',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {rightOpen && (
          <div style={{ width: rightWidth, height: '100%', overflow: 'hidden' }}>
            {askbOpen  && <ASKBPanel />}
            {!askbOpen && ibChatOpen && <IBChat />}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-primary)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--accent-primary)', fontWeight: 700 }}>QUANTDESK SETTINGS</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>v1.0.0 | gemini-2.0-flash | PRO TIER</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        {[
          { label: 'API KEY', value: 'sk-ant-••••••••••••••••' },
          { label: 'TRADER ID', value: 'J.SMITH' },
          { label: 'ACCOUNT', value: 'PROP-001' },
          { label: 'DATA REFRESH', value: '5s' },
          { label: 'THEME', value: 'DARK TERMINAL' },
          { label: 'TIMEZONE', value: 'America/New_York' },
        ].map(s => (
          <div key={s.label} style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', minWidth: 180 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TerminalShell() {
  const { toggleAskb, toggleIbChat, setActiveModule } = useTerminalStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'F9') { e.preventDefault(); toggleAskb(); }
      if (e.key === 'F8') { e.preventDefault(); toggleIbChat(); }
      if (e.key === 'F7') { e.preventDefault(); setActiveModule('messaging'); }
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="Search ticker"]')?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleAskb, toggleIbChat, setActiveModule]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <TopBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <LeftNav />
        <MainContent />
      </div>
      <BottomBar />
    </div>
  );
}
