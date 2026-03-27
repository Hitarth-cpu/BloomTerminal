import { BarChart2, Briefcase, FileText, TrendingUp, Activity, MessageSquare, Settings, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../services/auth/authService';
import type { ActiveModule } from '../../types';

const NAV_ITEMS: { id: ActiveModule; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'markets', label: 'MARKETS', icon: BarChart2 },
  { id: 'portfolio', label: 'PORTFOLIO', icon: Briefcase },
  { id: 'research', label: 'RESEARCH', icon: FileText },
  { id: 'trading', label: 'TRADING', icon: TrendingUp },
  { id: 'analytics', label: 'ANALYTICS', icon: Activity },
  { id: 'messaging', label: 'MESSAGING', icon: MessageSquare },
  { id: 'settings', label: 'SETTINGS', icon: Settings },
];

export function LeftNav() {
  const { activeModule, sidebarCollapsed, setActiveModule, toggleSidebar } = useTerminalStore();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await signOut().catch(() => {});
    logout();
  };

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'TRADER';

  return (
    <div style={{
      width: sidebarCollapsed ? 40 : 140,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--bg-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.15s ease',
      flexShrink: 0,
    }}>
      {/* Collapse toggle */}
      <div
        onClick={toggleSidebar}
        style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'flex-end', padding: '6px 8px', borderBottom: '1px solid var(--bg-border)', cursor: 'pointer', color: 'var(--text-muted)' }}
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </div>

      {/* Nav Items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: sidebarCollapsed ? '10px 0' : '8px 12px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                cursor: 'pointer',
                borderLeft: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                background: active ? 'rgba(255,102,0,0.08)' : 'transparent',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon size={13} color={active ? 'var(--accent-primary)' : 'var(--text-muted)'} />
              {!sidebarCollapsed && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                  letterSpacing: 0.5,
                  fontWeight: active ? 600 : 400,
                }}>
                  {item.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Session + Logout */}
      <div style={{ borderTop: '1px solid var(--bg-border)' }}>
        {!sidebarCollapsed && (
          <div style={{ padding: '8px 12px 4px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>SESSION</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="status-dot open" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--positive)' }}>ACTIVE</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)', marginTop: 2, fontWeight: 600 }}>
              {displayName.toUpperCase()}
            </div>
          </div>
        )}
        <div
          onClick={handleLogout}
          title="Sign Out"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: sidebarCollapsed ? '10px 0' : '6px 12px',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            cursor: 'pointer', color: 'var(--text-muted)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--negative)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        >
          <LogOut size={12} />
          {!sidebarCollapsed && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 0.5 }}>SIGN OUT</span>
          )}
        </div>
      </div>
    </div>
  );
}
