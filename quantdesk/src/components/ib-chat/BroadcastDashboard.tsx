import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, CheckCircle, Clock, Send, AlertTriangle, XCircle,
} from 'lucide-react';
import { fetchOrgBroadcasts, cancelBroadcast, type ApiBroadcast } from '../../services/api/broadcastsApi';
import BroadcastComposer from './BroadcastComposer';

// ─── Status styles ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  draft:     '#6b7280',
  pending:   '#f59e0b',
  sent:      'var(--accent-primary)',
  cancelled: 'var(--negative)',
  failed:    'var(--negative)',
};

const STATUS_ICON: Record<string, typeof Send> = {
  draft:     Clock,
  pending:   Clock,
  sent:      CheckCircle,
  cancelled: XCircle,
  failed:    AlertTriangle,
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--negative)',
  high:     '#f59e0b',
  normal:   'var(--accent-primary)',
  low:      '#6b7280',
};

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 80, padding: '10px 12px',
      background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderRadius: 4,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Broadcast row ─────────────────────────────────────────────────────────────

function BroadcastRow({
  broadcast,
  onCancel,
}: {
  broadcast: ApiBroadcast;
  onCancel: (id: string) => void;
}) {
  const Icon = STATUS_ICON[broadcast.status] ?? Send;
  const color = STATUS_COLOR[broadcast.status] ?? 'var(--text-muted)';
  const pctDelivered = broadcast.total_recipients > 0
    ? Math.round((broadcast.delivered_count / broadcast.total_recipients) * 100)
    : 0;
  const pctRead = broadcast.delivered_count > 0
    ? Math.round((broadcast.read_count / broadcast.delivered_count) * 100)
    : 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 80px 100px 80px 80px 70px',
      gap: 8,
      padding: '10px 14px',
      borderBottom: '1px solid var(--bg-border)',
      alignItems: 'center',
      fontSize: 12,
    }}>
      {/* Title + type */}
      <div>
        <div style={{
          fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 260,
        }}>
          {broadcast.title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          <span style={{
            padding: '1px 5px', borderRadius: 2,
            background: `${PRIORITY_COLOR[broadcast.priority] ?? '#6b7280'}22`,
            color: PRIORITY_COLOR[broadcast.priority] ?? '#6b7280',
            fontWeight: 700, textTransform: 'uppercase',
            marginRight: 6, letterSpacing: '0.05em',
          }}>
            {broadcast.priority}
          </span>
          {broadcast.broadcast_type.replace('_', ' ')} · {formatDate(broadcast.created_at)}
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color }}>
        <Icon size={12} />
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
          {broadcast.status}
        </span>
      </div>

      {/* Audience */}
      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
        {broadcast.audience_type.replace('_', ' ')}
      </div>

      {/* Recipients */}
      <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
        {broadcast.total_recipients}
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}> recip.</span>
      </div>

      {/* Delivery % */}
      <div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
          {pctDelivered}%
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {pctRead}% read
        </div>
      </div>

      {/* Actions */}
      <div>
        {(broadcast.status === 'pending' || broadcast.status === 'draft') && (
          <button
            onClick={() => onCancel(broadcast.id)}
            style={{
              padding: '2px 8px', fontSize: 10, fontWeight: 600,
              background: 'rgba(239,68,68,0.1)', color: 'var(--negative)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 2, cursor: 'pointer',
            }}
          >
            CANCEL
          </button>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── BroadcastDashboard ─────────────────────────────────────────────────────────

type Tab = 'history' | 'compose';

export default function BroadcastDashboard() {
  const [tab, setTab]               = useState<Tab>('history');
  const [broadcasts, setBroadcasts] = useState<ApiBroadcast[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchOrgBroadcasts();
      setBroadcasts(data);
    } catch { /* no perms or network */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: string) => {
    try {
      await cancelBroadcast(id);
      setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    } catch { /* silent */ }
  };

  // Aggregate stats
  const total     = broadcasts.length;
  const sent      = broadcasts.filter(b => b.status === 'sent').length;
  const totalRecip = broadcasts.reduce((s, b) => s + (b.total_recipients ?? 0), 0);
  const totalRead  = broadcasts.reduce((s, b) => s + (b.read_count ?? 0), 0);
  const avgRead    = totalRecip > 0 ? Math.round((totalRead / totalRecip) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      {/* Header + tabs */}
      <div style={{ borderBottom: '1px solid var(--bg-border)' }}>
        <div style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <BarChart2 size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            BROADCAST ADMIN
          </span>
        </div>
        <div style={{ display: 'flex', paddingLeft: 16 }}>
          {(['history', 'compose'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600,
                borderBottom: `2px solid ${tab === t ? 'var(--accent-primary)' : 'transparent'}`,
                color: tab === t ? 'var(--accent-primary)' : 'var(--text-muted)',
                background: 'none', border: 'none',
                borderBottomWidth: 2, borderBottomStyle: 'solid',
                cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'compose' ? (
        <BroadcastComposer onSent={() => { setTab('history'); load(); }} />
      ) : (
        <>
          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--bg-border)' }}>
            <StatCard label="TOTAL" value={total} />
            <StatCard label="SENT" value={sent} />
            <StatCard label="RECIPIENTS" value={totalRecip} />
            <StatCard label="AVG READ" value={`${avgRead}%`} />
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 100px 80px 80px 70px',
            gap: 8, padding: '6px 14px',
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: '0.07em', textTransform: 'uppercase',
            borderBottom: '1px solid var(--bg-border)',
          }}>
            <span>BROADCAST</span>
            <span>STATUS</span>
            <span>AUDIENCE</span>
            <span>RECIP.</span>
            <span>METRICS</span>
            <span />
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, paddingTop: 40 }}>
                Loading…
              </div>
            ) : broadcasts.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 40 }}>
                <Send size={28} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
                  No broadcasts yet. Click COMPOSE to create one.
                </p>
              </div>
            ) : (
              broadcasts.map(b => (
                <BroadcastRow key={b.id} broadcast={b} onCancel={handleCancel} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
