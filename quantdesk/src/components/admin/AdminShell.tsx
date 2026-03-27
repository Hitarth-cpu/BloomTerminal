import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Shield, Users, BarChart2, MessageSquare, Brain, Lock,
  ExternalLink, BarChart, PieChart,
  FileText, Settings, Building2, UserPlus, History,
  Activity, Mail, Layers,
} from 'lucide-react';
import { useAdminAuthStore } from '../../stores/adminAuthStore';
import { adminLogout } from '../../services/api/adminApi';

// ─── Nav structure ─────────────────────────────────────────────────────────────

const NAV = [
  {
    section: 'ORGANIZATION',
    items: [
      { label: 'Dashboard',    icon: Building2,    to: '/admin' },
      { label: 'Members',      icon: Users,        to: '/admin/members' },
      { label: 'Teams',        icon: Layers,       to: '/admin/teams' },
      { label: 'Invitations',  icon: UserPlus,     to: '/admin/invitations' },
    ],
  },
  {
    section: 'PERFORMANCE',
    items: [
      { label: 'Traders',      icon: BarChart2,    to: '/admin/performance/traders' },
      { label: 'Analysts',     icon: PieChart,     to: '/admin/performance/analysts' },
      { label: 'Teams',        icon: BarChart,     to: '/admin/performance/teams' },
      { label: 'Sessions',     icon: Activity,     to: '/admin/performance/sessions' },
    ],
  },
  {
    section: 'COMMUNICATIONS',
    items: [
      { label: 'Chat Permissions', icon: MessageSquare, to: '/admin/chat/permissions' },
      { label: 'Broadcasts',       icon: Mail,          to: '/admin/broadcasts' },
      { label: 'Broadcast History',icon: History,       to: '/admin/broadcasts/history' },
    ],
  },
  {
    section: 'INTELLIGENCE',
    items: [
      { label: 'AI Summaries',  icon: Brain,       to: '/admin/ai/summaries' },
      { label: 'Performance AI',icon: BarChart2,   to: '/admin/ai/performance' },
      { label: 'Ask ASKB',      icon: Brain,       to: '/admin/ai/askb' },
    ],
  },
  {
    section: 'SECURITY',
    items: [
      { label: 'Audit Log',    icon: FileText,     to: '/admin/security/audit' },
      { label: 'Sessions',     icon: Lock,         to: '/admin/security/sessions' },
    ],
  },
  {
    section: 'SETTINGS',
    items: [
      { label: 'Organization', icon: Settings,     to: '/admin/settings/org' },
    ],
  },
] as const;

// ─── Session Timer ─────────────────────────────────────────────────────────────

function useSessionTimer(): string {
  const { adminSession } = useAdminAuthStore();
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!adminSession) { setRemaining(''); return; }
    const tick = () => {
      const diff = new Date(adminSession.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('EXPIRED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [adminSession]);

  return remaining;
}

// ─── AdminShell ────────────────────────────────────────────────────────────────

export default function AdminShell() {
  const { adminUser, clearAdmin } = useAdminAuthStore();
  const navigate    = useNavigate();
  const sessionTime = useSessionTimer();
  const isWarning   = sessionTime.startsWith('0:') || sessionTime === 'EXPIRED';

  const handleLogout = async () => {
    await adminLogout();
    navigate('/admin/login', { replace: true });
  };

  const handleLock = () => {
    clearAdmin();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-mono)' }}>

      {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 28, flexShrink: 0, display: 'flex', alignItems: 'center',
        borderBottom: '1px solid rgba(255,61,61,0.2)',
        background: 'rgba(255,61,61,0.04)',
        padding: '0 16px', gap: 16, fontSize: 11,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={13} color="#ff3d3d" />
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>QuantDesk</span>
          <span style={{ color: '#ff3d3d', fontWeight: 700 }}>ADMIN</span>
        </div>

        <span style={{ color: 'rgba(255,61,61,0.4)' }}>|</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {adminUser?.displayName ?? ''} › Admin Center
        </span>

        <div style={{ flex: 1 }} />

        {/* Session timer */}
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: isWarning ? '#f59e0b' : 'var(--text-muted)',
        }}>
          SESSION: {sessionTime}
        </span>

        {/* Role badge */}
        <span style={{
          padding: '1px 7px', fontSize: 9, fontWeight: 700,
          background: 'rgba(255,61,61,0.15)', color: '#ff3d3d',
          border: '1px solid rgba(255,61,61,0.3)', borderRadius: 2,
          textTransform: 'uppercase',
        }}>
          {adminUser?.orgRole?.replace('_', ' ')}
        </span>

        <a href="/terminal" target="_blank" rel="noopener" style={{
          display: 'flex', alignItems: 'center', gap: 3,
          color: 'var(--text-muted)', fontSize: 10, textDecoration: 'none',
        }}>
          <ExternalLink size={10} /> Terminal
        </a>

        <button onClick={handleLock} title="Lock admin session" style={{
          display: 'flex', alignItems: 'center', gap: 3,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#ff3d3d', fontSize: 10, padding: '2px 6px',
        }}>
          <Lock size={10} /> Lock
        </button>

        <button onClick={handleLogout} style={{
          background: 'rgba(255,61,61,0.1)', border: '1px solid rgba(255,61,61,0.3)',
          color: '#ff3d3d', fontSize: 10, fontWeight: 700, padding: '2px 8px',
          borderRadius: 2, cursor: 'pointer',
        }}>
          SIGN OUT
        </button>
      </div>

      {/* ─── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left Nav ──────────────────────────────────────────────────── */}
        <nav style={{
          width: 220, flexShrink: 0, borderRight: '1px solid var(--bg-border)',
          background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div style={{
                padding: '10px 14px 4px', fontSize: 9, fontWeight: 700,
                color: 'var(--text-muted)', letterSpacing: '0.12em',
              }}>
                {section}
              </div>
              {items.map(({ label, icon: Icon, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/admin'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px', fontSize: 11, textDecoration: 'none',
                    color: isActive ? '#ff3d3d' : 'var(--text-secondary)',
                    background: isActive ? 'rgba(255,61,61,0.08)' : 'transparent',
                    borderLeft: `2px solid ${isActive ? '#ff3d3d' : 'transparent'}`,
                    transition: 'all 0.1s',
                  })}
                >
                  <Icon size={12} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Main Content ──────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      </div>

      {/* ─── Bottom Status Bar ────────────────────────────────────────────── */}
      <div style={{
        height: 22, flexShrink: 0, display: 'flex', alignItems: 'center',
        borderTop: '1px solid var(--bg-border)', padding: '0 12px', gap: 12,
        background: 'var(--bg-secondary)', fontSize: 9,
      }}>
        <span style={{ padding: '1px 6px', background: 'rgba(255,61,61,0.15)', color: '#ff3d3d', fontWeight: 700, borderRadius: 2 }}>
          ADMIN MODE
        </span>
        <span style={{ padding: '1px 6px', background: 'rgba(0,200,100,0.1)', color: '#00c864', fontWeight: 700, borderRadius: 2 }}>
          AES-256-GCM
        </span>
        <span style={{ padding: '1px 6px', background: 'rgba(0,200,100,0.1)', color: '#00c864', fontWeight: 700, borderRadius: 2 }}>
          TLS 1.3
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)' }}>v1.0.0</span>
      </div>
    </div>
  );
}
