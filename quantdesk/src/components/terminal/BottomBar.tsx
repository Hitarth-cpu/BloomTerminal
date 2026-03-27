import { X } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';

export function BottomBar() {
  const { alerts, dismissAlert } = useTerminalStore();
  const latest = alerts[0];

  return (
    <div style={{
      height: 24,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--bg-border)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 12px',
      flexShrink: 0,
    }}>
      {/* Market Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="status-dot open" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--positive)' }}>NYSE: OPEN</span>
        <span style={{ color: 'var(--bg-border)' }}>|</span>
        <span className="status-dot open" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--positive)' }}>NASDAQ: OPEN</span>
        <span style={{ color: 'var(--bg-border)' }}>|</span>
        <span className="status-dot closed" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--negative)' }}>LSE: CLOSED</span>
        <span style={{ color: 'var(--bg-border)' }}>|</span>
        <span className="status-dot closed" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--negative)' }}>TSE: CLOSED</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Active Alert */}
      {latest && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: latest.severity === 'CRITICAL' ? 'rgba(255,61,61,0.1)' : latest.severity === 'WARNING' ? 'rgba(255,170,0,0.1)' : 'rgba(68,136,255,0.1)', padding: '1px 6px', borderRadius: 2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: latest.severity === 'CRITICAL' ? 'var(--negative)' : latest.severity === 'WARNING' ? 'var(--warning)' : 'var(--info)' }}>
            [{latest.severity}] {latest.message}
          </span>
          <X size={8} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => dismissAlert(latest.id)} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>v1.0.0</span>
        <span style={{ color: 'var(--bg-border)' }}>|</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>QUANTDESK PRO</span>
        <span style={{ color: 'var(--bg-border)' }}>|</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>WS: CONNECTED</span>
        <span style={{ color: 'var(--bg-border)' }}>|</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--highlight)' }}>
          {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
        </span>
      </div>
    </div>
  );
}
