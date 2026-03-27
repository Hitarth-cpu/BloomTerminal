import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  fetchChatConnections, createChatLink, removeChatLink,
  updateChatSettings, fetchAdminMembers,
  type ChatConnection, type AdminMember,
} from '../../services/api/adminApi';

function MemberSelect({
  label, value, members, onChange,
}: { label: string; value: string; members: AdminMember[]; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 10px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', borderRadius: 3 }}
      >
        <option value="">— Select member —</option>
        {members.map(m => (
          <option key={m.id} value={m.id}>{m.display_name} ({m.email})</option>
        ))}
      </select>
    </div>
  );
}

export default function ChatPermissionsPage() {
  const [connections, setConnections] = useState<ChatConnection[]>([]);
  const [members,     setMembers]     = useState<AdminMember[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [userA,       setUserA]       = useState('');
  const [userB,       setUserB]       = useState('');
  const [reason,      setReason]      = useState('');
  const [linking,     setLinking]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        fetchChatConnections(),
        fetchAdminMembers({ limit: 200 }),
      ]);
      setConnections(c.connections);
      setMembers(m.members);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLink = async () => {
    if (!userA || !userB || !reason) { setError('All fields required'); return; }
    if (userA === userB) { setError('Cannot link a user to themselves'); return; }
    setError(null); setLinking(true);
    try {
      await createChatLink(userA, userB, reason);
      setSuccess('Users connected successfully.');
      setUserA(''); setUserB(''); setReason('');
      load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally { setLinking(false); }
  };

  const handleRemove = async (linkId: string) => {
    await removeChatLink(linkId);
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bg-border)' }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Chat Permissions</h1>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
          Manage who can communicate with whom
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Left: Connections list ── */}
        <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid var(--bg-border)', padding: '16px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>
            ADMIN-CREATED CONNECTIONS ({connections.filter(c => c.is_active).length})
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
          ) : connections.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No admin-created connections yet.</div>
          ) : connections.map(c => (
            <div key={c.id} style={{
              padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
              borderRadius: 4, marginBottom: 8,
              opacity: c.is_active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.user_a_name}
                    <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>↔</span>
                    {c.user_b_name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    Reason: {c.reason}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    Created {new Date(c.created_at).toLocaleDateString()} ·
                    <span style={{ marginLeft: 6, color: c.is_active ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
                      {c.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                </div>
                {c.is_active && (
                  <button
                    onClick={() => handleRemove(c.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--negative)', padding: 4 }}
                    title="Remove link"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: Actions panel ── */}
        <div style={{ width: 340, padding: '16px 20px', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>
            FORCE-LINK TWO USERS
          </div>
          <div style={{
            padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
            borderRadius: 4, marginBottom: 20,
          }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 14px' }}>
              Connect two members who have not mutually added each other. Both will be able to message.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MemberSelect label="USER A" value={userA} members={members} onChange={setUserA} />
              <MemberSelect label="USER B" value={userB} members={members} onChange={setUserB} />
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>REASON (REQUIRED)</div>
                <input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Project collaboration, client coverage overlap"
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', borderRadius: 3, boxSizing: 'border-box' }}
                />
              </div>

              {error   && <div style={{ fontSize: 11, color: 'var(--negative)' }}>{error}</div>}
              {success && <div style={{ fontSize: 11, color: 'var(--positive)' }}>{success}</div>}

              <button onClick={handleLink} disabled={linking} style={{
                padding: '8px', fontSize: 11, fontWeight: 700,
                background: '#ff3d3d', color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer',
              }}>
                {linking ? 'CONNECTING…' : 'CREATE ADMIN LINK →'}
              </button>
            </div>
          </div>

          {/* Org-wide settings */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
            ORG-WIDE CHAT SETTINGS
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 4 }}>
            {[
              { key: 'allowOpenMessaging',         label: 'Anyone can message anyone',        defaultVal: true },
              { key: 'requireAdminForCrossTeam',   label: 'Require admin for cross-team',     defaultVal: false },
              { key: 'allowCrossOrgContacts',      label: 'Allow cross-org contacts',         defaultVal: false },
              { key: 'allowUserBlocks',            label: 'Allow users to block each other',  defaultVal: true },
            ].map(({ key, label, defaultVal }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                <button
                  onClick={() => updateChatSettings({ [key]: !defaultVal }).catch(() => {})}
                  style={{
                    width: 36, height: 18, borderRadius: 9,
                    background: defaultVal ? 'var(--accent-primary)' : 'var(--bg-tertiary, #333)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
