import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Clock, Users, AlertTriangle, CheckCircle, Megaphone } from 'lucide-react';
import { fetchAdminBroadcasts, sendAdminBroadcast, type AdminBroadcast } from '../../services/api/adminApi';

const PRIORITY_COLOR: Record<string, string> = {
  low: 'var(--text-muted)', normal: 'var(--accent-primary)',
  high: '#f59e0b', critical: 'var(--negative)',
};

export default function BroadcastsPage() {
  const location = useLocation();
  const isHistory = location.pathname.includes('history');

  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Compose form
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [priority, setPriority]   = useState('normal');
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState('');

  useEffect(() => {
    fetchAdminBroadcasts()
      .then(d => setBroadcasts(d.broadcasts))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true); setSent('');
    try {
      const res = await sendAdminBroadcast({ title, body, priority, audienceType: 'org_wide' });
      setSent(`Sent to ${res.recipientCount} member${res.recipientCount !== 1 ? 's' : ''}`);
      setTitle(''); setBody('');
      const updated = await fetchAdminBroadcasts();
      setBroadcasts(updated.broadcasts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: 28, maxWidth: 900, fontFamily: 'var(--font-mono)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: 'var(--accent-primary)', letterSpacing: '0.15em', marginBottom: 6 }}>
          {isHistory ? '// BROADCAST HISTORY' : '// BROADCASTS'}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {isHistory ? 'Broadcast History' : 'Send Broadcast'}
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {isHistory ? 'View all past broadcasts sent to your organisation.' : 'Send announcements to all organisation members.'}
        </p>
      </div>

      {!isHistory && (
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: 4, padding: 24, marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Megaphone size={14} color="var(--accent-primary)" /> NEW BROADCAST
          </div>

          {sent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 3, marginBottom: 14, fontSize: 11, color: 'var(--positive)' }}>
              <CheckCircle size={12} /> {sent}
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.3)', borderRadius: 3, marginBottom: 14, fontSize: 11, color: 'var(--negative)' }}>
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>TITLE</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Market Closure Notice"
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>MESSAGE</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Write your broadcast message…"
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>PRIORITY</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: PRIORITY_COLOR[priority], outline: 'none' }}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={handleSend} disabled={sending || !title || !body}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: sending || !title || !body ? 'var(--bg-border)' : 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: sending || !title || !body ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
                <Send size={13} /> {sending ? 'SENDING…' : 'SEND TO ALL MEMBERS →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}>
          <span>{isHistory ? 'ALL BROADCASTS' : 'RECENT BROADCASTS'}</span>
          <span>{broadcasts.length} TOTAL</span>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>Loading…</div>
        ) : broadcasts.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>No broadcasts sent yet.</div>
        ) : (
          broadcasts.map(b => (
            <div key={b.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--bg-border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[b.priority] ?? 'var(--text-muted)', marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{b.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.body_template}</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} />{new Date(b.created_at).toLocaleString()}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={10} />{b.delivery_count} recipients</span>
                  <span style={{ color: PRIORITY_COLOR[b.priority] }}>{b.priority.toUpperCase()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
