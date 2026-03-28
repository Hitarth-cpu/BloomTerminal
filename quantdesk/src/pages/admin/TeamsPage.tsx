import { useState, useEffect } from 'react';
import { Users, UserPlus, ChevronRight } from 'lucide-react';
import { fetchAdminMembers, type AdminMember } from '../../services/api/adminApi';

const ROLE_COLOR: Record<string, string> = {
  super_admin: '#f59e0b', admin: 'var(--negative)',
  team_lead: 'var(--accent-primary)', member: 'var(--text-muted)',
};

function groupByRole(members: AdminMember[]): Record<string, AdminMember[]> {
  return members.reduce((acc, m) => {
    const r = m.org_role || 'member';
    if (!acc[r]) acc[r] = [];
    acc[r].push(m);
    return acc;
  }, {} as Record<string, AdminMember[]>);
}

export default function TeamsPage() {
  const [members, setMembers]   = useState<AdminMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [roleFilter, setRole]   = useState('');

  useEffect(() => {
    fetchAdminMembers({ limit: 200 })
      .then(d => setMembers(d.members))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.display_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    const matchRole = !roleFilter || m.org_role === roleFilter;
    return matchSearch && matchRole;
  });

  const groups = groupByRole(filtered);
  const roleOrder = ['super_admin', 'admin', 'team_lead', 'member'];

  return (
    <div style={{ padding: 28, maxWidth: 900, fontFamily: 'var(--font-mono)' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: 'var(--accent-primary)', letterSpacing: '0.15em', marginBottom: 6 }}>// ORGANISATION</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Teams</h1>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Organisation members grouped by role.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'TOTAL MEMBERS', value: members.length },
          { label: 'ACTIVE', value: members.filter(m => m.is_active).length, color: 'var(--positive)' },
          { label: 'ADMINS', value: members.filter(m => ['admin','super_admin'].includes(m.org_role)).length, color: '#f59e0b' },
          { label: 'TEAM LEADS', value: members.filter(m => m.org_role === 'team_lead').length, color: 'var(--accent-primary)' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '12px 14px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color ?? 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…"
          style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }} />
        <select value={roleFilter} onChange={e => setRole(e.target.value)}
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}>
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="team_lead">Team Lead</option>
          <option value="member">Member</option>
        </select>
      </div>

      {error && <div style={{ color: 'var(--negative)', fontSize: 11, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Loading…</div>
      ) : (
        roleOrder.filter(r => groups[r]?.length).map(role => (
          <div key={role} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Users size={13} color={ROLE_COLOR[role]} />
              <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_COLOR[role], letterSpacing: '0.12em' }}>
                {role.replace('_', ' ').toUpperCase()}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({groups[role].length})</span>
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 4, overflow: 'hidden' }}>
              {groups[role].map((m, i) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', padding: '11px 16px', gap: 12,
                  borderBottom: i < groups[role].length - 1 ? '1px solid var(--bg-border)' : 'none',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: ROLE_COLOR[m.org_role], flexShrink: 0 }}>
                    {m.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.display_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.email}</div>
                  </div>
                  {m.firm && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 8 }}>{m.firm}</div>
                  )}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.is_active ? 'var(--positive)' : 'var(--text-muted)', flexShrink: 0 }} title={m.is_active ? 'Active' : 'Inactive'} />
                  <ChevronRight size={12} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <UserPlus size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No members found. Invite people from the Invitations page.</div>
        </div>
      )}
    </div>
  );
}
