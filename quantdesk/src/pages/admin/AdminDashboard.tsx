import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, BarChart2, MessageSquare, Shield, TrendingUp, Activity } from 'lucide-react';
import { fetchAdminMembers, fetchTraderPerformance, type TraderPerf } from '../../services/api/adminApi';
import { useAdminAuthStore } from '../../stores/adminAuthStore';

function StatCard({ label, value, sub, icon: Icon, color = 'var(--accent-primary)' }: {
  label: string; value: string | number; sub?: string;
  icon: typeof Users; color?: string;
}) {
  return (
    <div style={{
      flex: 1, padding: '14px 16px',
      background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 4,
      borderTop: `2px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {value}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
            {label}
          </div>
          {sub && <div style={{ fontSize: 11, color, marginTop: 4 }}>{sub}</div>}
        </div>
        <Icon size={20} color={color} style={{ opacity: 0.5 }} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { adminUser } = useAdminAuthStore();
  const [memberCount, setMemberCount] = useState(0);
  const [topTraders,  setTopTraders]  = useState<TraderPerf[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAdminMembers({ limit: 1 }).then(r => setMemberCount(r.total)).catch(() => {}),
      fetchTraderPerformance('1w').then(r => setTopTraders(r.traders.slice(0, 5))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const totalPnl = topTraders.reduce((s, t) => s + (t.total_pnl ?? 0), 0);

  return (
    <div style={{ padding: '20px 24px', flex: 1 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          Admin Dashboard
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
          Organization overview · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <StatCard label="TOTAL MEMBERS" value={memberCount} icon={Users} color="#ff3d3d" />
        <StatCard
          label="DESK P&L (1W)"
          value={`${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl / 1000).toFixed(1)}K`}
          icon={TrendingUp}
          color={totalPnl >= 0 ? 'var(--positive)' : 'var(--negative)'}
        />
        <StatCard label="ACTIVE TRADERS" value={topTraders.filter(t => t.trades_count > 0).length} icon={BarChart2} />
        <StatCard label="ADMIN ROLE" value={adminUser?.orgRole?.replace('_', ' ').toUpperCase() ?? ''} icon={Shield} color="#ff3d3d" />
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Manage Members',      to: '/admin/members',              icon: Users },
          { label: 'Trader Performance',  to: '/admin/performance/traders',  icon: BarChart2 },
          { label: 'Analyst Performance', to: '/admin/performance/analysts', icon: Activity },
          { label: 'Chat Permissions',    to: '/admin/chat/permissions',     icon: MessageSquare },
          { label: 'AI Session Reports',  to: '/admin/performance/sessions', icon: Activity },
          { label: 'Audit Log',           to: '/admin/security/audit',       icon: Shield },
        ].map(({ label, to, icon: Icon }) => (
          <Link key={to} to={to} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 4, textDecoration: 'none',
            background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
            color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
            transition: 'border-color 0.15s',
          }}>
            <Icon size={14} color="#ff3d3d" />
            {label}
          </Link>
        ))}
      </div>

      {/* Top traders table */}
      {!loading && topTraders.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 4 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>TOP PERFORMERS — 1 WEEK</span>
            <Link to="/admin/performance/traders" style={{ fontSize: 10, color: '#ff3d3d', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          {topTraders.map((t, i) => (
            <div key={t.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderBottom: i < topTraders.length - 1 ? '1px solid var(--bg-border)' : 'none',
              fontSize: 12,
            }}>
              <span style={{ width: 20, color: 'var(--text-muted)', textAlign: 'right' }}>#{i + 1}</span>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,61,61,0.15)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#ff3d3d',
              }}>
                {t.display_name.charAt(0).toUpperCase()}
              </div>
              <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500 }}>{t.display_name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {t.win_rate ? `${(t.win_rate * 100).toFixed(0)}% WR` : '—'}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: (t.total_pnl ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
              }}>
                {(t.total_pnl ?? 0) >= 0 ? '+' : ''}${Math.abs((t.total_pnl ?? 0) / 1000).toFixed(1)}K
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
