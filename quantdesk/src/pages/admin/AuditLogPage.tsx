import { useState, useEffect, useCallback } from 'react';
import { Shield } from 'lucide-react';
import { fetchAuditLog, type AuditEntry } from '../../services/api/adminApi';

export default function AuditLogPage() {
  const [logs,    setLogs]    = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action,  setAction]  = useState('');
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchAuditLog({ action: action || undefined, page });
      setLogs(r.logs);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [action, page]);

  useEffect(() => { load(); }, [load]);

  const ACTION_COLOR: Record<string, string> = {
    ADMIN_LOGIN: 'var(--positive)',
    ADMIN_LOGIN_FAILED: 'var(--negative)',
    ADMIN_CHAT_LINK: 'var(--accent-primary)',
    ADMIN_MEMBER_UPDATE: '#f59e0b',
    ADMIN_MEMBER_SUSPENDED: 'var(--negative)',
    ADMIN_SESSION_TERMINATED: 'var(--negative)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Audit Log</h1>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>All administrator actions — append-only</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={action} onChange={e => setAction(e.target.value)}
            placeholder="Filter by action…"
            style={{ padding: '5px 10px', fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', borderRadius: 3, width: 200 }}
          />
        </div>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 180px 150px', padding: '6px 24px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-primary)' }}>
        <span>ACTION</span><span>DETAILS</span><span>USER</span><span>TIMESTAMP</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Shield size={28} color="var(--text-muted)" style={{ opacity: 0.4 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No audit entries found.</p>
          </div>
        ) : logs.map(l => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 180px 150px', padding: '9px 24px', borderBottom: '1px solid var(--bg-border)', fontSize: 11, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: ACTION_COLOR[l.action] ?? 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {l.action}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {typeof l.metadata === 'object' ? JSON.stringify(l.metadata).slice(0, 120) : String(l.metadata ?? '')}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{l.display_name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              {new Date(l.created_at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div style={{ padding: '8px 24px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '4px 10px', fontSize: 10, background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', color: 'var(--text-muted)', borderRadius: 2, cursor: 'pointer' }}>← Prev</button>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50} style={{ padding: '4px 10px', fontSize: 10, background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', color: 'var(--text-muted)', borderRadius: 2, cursor: 'pointer' }}>Next →</button>
      </div>
    </div>
  );
}
