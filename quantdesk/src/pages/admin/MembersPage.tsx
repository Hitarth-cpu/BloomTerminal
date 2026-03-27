import { useState, useEffect, useCallback } from 'react';
import { Users, Search, UserPlus, X } from 'lucide-react';
import {
  fetchAdminMembers, fetchAdminMember, updateAdminMember, suspendMember,
  createInvitation,
  type AdminMember,
} from '../../services/api/adminApi';

// ─── Avatar ───────────────────────────────────────────────────────────────────

const COLORS = ['#ff6600','#00c8ff','#a8ff78','#f7d060','#ff3d3d','#c084fc','#34d399','#fb923c'];
function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % COLORS.length;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${bg}22`, border: `1px solid ${bg}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: bg,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    super_admin: '#ff3d3d', admin: '#ff3d3d',
    team_lead: '#f59e0b', member: 'var(--accent-primary)',
    analyst: 'var(--teal, #00c8ff)',
  };
  const color = map[role] ?? 'var(--text-muted)';
  return (
    <span style={{
      padding: '2px 7px', fontSize: 9, fontWeight: 700,
      background: `${color}22`, color, borderRadius: 2,
      border: `1px solid ${color}44`, textTransform: 'uppercase',
    }}>
      {role.replace('_', ' ')}
    </span>
  );
}

// ─── Member Detail Drawer ─────────────────────────────────────────────────────

function MemberDetailDrawer({ userId, onClose, onUpdate }: {
  userId: string; onClose: () => void; onUpdate: () => void;
}) {
  const [tab, setTab] = useState<'profile' | 'performance' | 'security'>('profile');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminMember>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminMember(userId).then(d => {
      setData(d);
      setEditRole(d.member.org_role);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const handleRoleSave = async () => {
    if (!data || editRole === data.member.org_role) return;
    setSaving(true);
    try {
      await updateAdminMember(userId, { role: editRole });
      onUpdate();
      setData(prev => prev ? { ...prev, member: { ...prev.member, org_role: editRole } } : prev);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleSuspend = async () => {
    if (!confirm(`Suspend ${data?.member.display_name}? They will be immediately logged out.`)) return;
    await suspendMember(userId);
    onClose(); onUpdate();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{
        width: 480, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--bg-border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', borderBottom: '1px solid var(--bg-border)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {data && <Avatar name={data.member.display_name} size={48} />}
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {loading ? 'Loading…' : data?.member.display_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{data?.member.email}</div>
                {data && <div style={{ marginTop: 6 }}><RoleBadge role={data.member.org_role} /></div>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['profile', 'performance', 'security'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '6px 14px', fontSize: 10, fontWeight: 700,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? '#ff3d3d' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === t ? '#ff3d3d' : 'transparent'}`,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 20, flex: 1 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
          ) : data ? (
            <>
              {/* Profile tab */}
              {tab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Full Name',   value: data.member.display_name },
                      { label: 'Email',       value: data.member.email },
                      { label: 'Firm',        value: data.member.firm ?? '—' },
                      { label: 'Status',      value: data.member.is_active ? 'Active' : 'Suspended' },
                      { label: 'Joined',      value: new Date(data.member.created_at).toLocaleDateString() },
                      { label: 'Last Login',  value: data.member.last_login_at ? new Date(data.member.last_login_at).toLocaleString() : 'Never' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 3 }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Role edit */}
                  <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: 4, border: '1px solid var(--bg-border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>CHANGE ROLE</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', borderRadius: 3 }}
                      >
                        {['member', 'team_lead', 'admin', 'super_admin'].map(r => (
                          <option key={r} value={r}>{r.replace('_', ' ')}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleRoleSave}
                        disabled={saving || editRole === data.member.org_role}
                        style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: '#ff3d3d', color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer' }}
                      >
                        {saving ? '…' : 'Save'}
                      </button>
                    </div>
                  </div>

                  <button onClick={handleSuspend} style={{
                    padding: '8px', fontSize: 11, fontWeight: 700,
                    background: 'rgba(255,61,61,0.1)', color: '#ff3d3d',
                    border: '1px solid rgba(255,61,61,0.3)', borderRadius: 3, cursor: 'pointer',
                  }}>
                    Suspend Account
                  </button>
                </div>
              )}

              {/* Performance tab */}
              {tab === 'performance' && (
                <div>
                  {data.snapshots.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No performance data available.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        {[
                          { label: 'Total P&L', value: `$${data.snapshots.reduce((s, r) => s + Number(r.daily_pnl), 0).toFixed(0)}` },
                          { label: 'Total Trades', value: data.snapshots.reduce((s, r) => s + r.trades_count, 0) },
                          { label: 'Data Points', value: data.snapshots.length },
                          { label: 'Latest P&L', value: `$${Number(data.snapshots[0]?.daily_pnl ?? 0).toFixed(0)}` },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ padding: '10px', background: 'var(--bg-primary)', borderRadius: 4, border: '1px solid var(--bg-border)' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Security tab */}
              {tab === 'security' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                    MFA: <span style={{ color: data.member.mfa_enabled ? 'var(--positive)' : 'var(--negative)', fontWeight: 700 }}>
                      {data.member.mfa_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>ACTIVE SESSIONS</div>
                  {data.sessions.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No active sessions.</div>
                  ) : data.sessions.map(s => (
                    <div key={s.id} style={{ padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 3, marginBottom: 6, fontSize: 11 }}>
                      <div style={{ color: 'var(--text-primary)' }}>{s.ip_address ?? 'Unknown IP'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>
                        Active {new Date(s.last_active).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', role: 'member', expiryHours: 48,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.email || !form.role) { setError('Email and role required'); return; }
    setLoading(true);
    try {
      await createInvitation(form);
      onCreated(); onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ width: 420, background: 'var(--bg-secondary)', border: '1px solid rgba(255,61,61,0.3)', borderRadius: 4, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Invite Member</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>
        {error && <div style={{ color: '#ff3d3d', fontSize: 11, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'WORK EMAIL', key: 'email', type: 'email', placeholder: 'trader@firm.com' },
            { label: 'FIRST NAME', key: 'firstName', type: 'text', placeholder: 'First' },
            { label: 'LAST NAME',  key: 'lastName',  type: 'text', placeholder: 'Last' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</label>
              <input
                type={type} placeholder={placeholder}
                value={(form as Record<string, string | number>)[key] as string}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', borderRadius: 3, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>ROLE</label>
            <select
              value={form.role}
              onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', borderRadius: 3 }}
            >
              {['member', 'team_lead', 'admin'].map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <button onClick={handleSubmit} disabled={loading} style={{
            padding: '9px', fontSize: 12, fontWeight: 700,
            background: '#ff3d3d', color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer',
          }}>
            {loading ? 'SENDING…' : 'SEND INVITATION →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MembersPage ──────────────────────────────────────────────────────────────

export default function MembersPage() {
  const [members,    setMembers]    = useState<AdminMember[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchAdminMembers({ search: search || undefined, role: roleFilter || undefined });
      setMembers(r.members);
      setTotal(r.total);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {selectedId && (
        <MemberDetailDrawer
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={load}
        />
      )}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onCreated={load}
        />
      )}

      {/* Page header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Organization Members
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            {total} total members
          </p>
        </div>
        <button onClick={() => setShowInvite(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', fontSize: 11, fontWeight: 700,
          background: '#ff3d3d', color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer',
        }}>
          <UserPlus size={12} /> Invite Member
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--bg-border)', display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '5px 10px', flex: 1, maxWidth: 300 }}>
          <Search size={12} color="var(--text-muted)" />
          <input
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', flex: 1 }}
          />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={10} /></button>}
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: '5px 10px', fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', borderRadius: 3 }}
        >
          <option value="">All Roles</option>
          {['member', 'team_lead', 'admin', 'super_admin'].map(r => (
            <option key={r} value={r}>{r.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 90px 80px',
        padding: '6px 24px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
        letterSpacing: '0.08em', borderBottom: '1px solid var(--bg-border)',
        background: 'var(--bg-primary)',
      }}>
        <span>MEMBER</span><span>ROLE</span><span>STATUS</span>
        <span>JOINED</span><span>LAST ACTIVE</span><span>P&L TODAY</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Users size={28} color="var(--text-muted)" style={{ opacity: 0.4 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No members found.</p>
          </div>
        ) : members.map(m => (
          <div
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 90px 80px',
              padding: '10px 24px', borderBottom: '1px solid var(--bg-border)',
              cursor: 'pointer', fontSize: 12, alignItems: 'center',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,61,61,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={m.display_name} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.display_name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.email}</div>
              </div>
            </div>
            <RoleBadge role={m.org_role} />
            <div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 600,
                color: m.is_active ? 'var(--positive)' : 'var(--negative)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.is_active ? 'var(--positive)' : 'var(--negative)' }} />
                {m.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : 'Never'}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
              color: m.daily_pnl == null ? 'var(--text-muted)'
                : m.daily_pnl >= 0 ? 'var(--positive)' : 'var(--negative)',
            }}>
              {m.daily_pnl == null ? '—' : `${m.daily_pnl >= 0 ? '+' : ''}$${Math.abs(m.daily_pnl / 1000).toFixed(1)}K`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
