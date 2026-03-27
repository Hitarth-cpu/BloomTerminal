import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Megaphone, AlertTriangle, CheckCircle, Info,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  fetchBroadcastInbox, markBroadcastRead,
  type ApiBroadcastDelivery,
} from '../../services/api/broadcastsApi';
import { useWebSocket } from '../../hooks/useWebSocket';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--negative)',
  high:     '#f59e0b',
  normal:   'var(--accent-primary)',
  low:      'var(--text-muted)',
};

const PRIORITY_BG: Record<string, string> = {
  critical: 'rgba(239,68,68,0.08)',
  high:     'rgba(245,158,11,0.08)',
  normal:   'rgba(0,200,255,0.06)',
  low:      'transparent',
};

const TYPE_ICON: Record<string, typeof Info> = {
  alert:        AlertTriangle,
  risk_update:  AlertTriangle,
  announcement: Megaphone,
  morning_note: Info,
  compliance:   CheckCircle,
  system:       Bell,
};

// ─── Broadcast Card ─────────────────────────────────────────────────────────────

function BroadcastCard({
  delivery,
  onMarkRead,
}: {
  delivery: ApiBroadcastDelivery;
  onMarkRead: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUnread = delivery.status !== 'read';
  const Icon = TYPE_ICON[delivery.broadcast_type] ?? Bell;
  const color = PRIORITY_COLOR[delivery.priority] ?? PRIORITY_COLOR.normal;
  const bg = PRIORITY_BG[delivery.priority] ?? 'transparent';

  const handleExpand = () => {
    setExpanded(prev => !prev);
    if (isUnread && !expanded) onMarkRead(delivery.id);
  };

  return (
    <div style={{
      border: `1px solid ${isUnread ? color : 'var(--bg-border)'}`,
      borderRadius: 4,
      marginBottom: 8,
      background: isUnread ? bg : 'var(--bg-secondary)',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <button
        onClick={handleExpand}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
        }}
      >
        <Icon size={15} color={color} style={{ flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isUnread && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: color, flexShrink: 0,
              }} />
            )}
            <span style={{
              fontSize: 13, fontWeight: isUnread ? 600 : 400,
              color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {delivery.title}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {delivery.created_by_name} · {formatTime(delivery.sent_at)}
            {delivery.priority !== 'normal' && (
              <span style={{
                marginLeft: 8, padding: '1px 6px', borderRadius: 2,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                background: color, color: '#000',
                textTransform: 'uppercase',
              }}>
                {delivery.priority}
              </span>
            )}
          </div>
        </div>

        {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
      </button>

      {/* Body */}
      {expanded && (
        <div style={{
          padding: '0 14px 14px',
          fontSize: 13, lineHeight: 1.6,
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--bg-border)',
          paddingTop: 12,
          whiteSpace: 'pre-wrap',
        }}>
          {delivery.personalized_body}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1)   return `${Math.round(diffH * 60)}m ago`;
  if (diffH < 24)  return `${Math.round(diffH)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── BroadcastInbox ─────────────────────────────────────────────────────────────

export default function BroadcastInbox() {
  const [deliveries, setDeliveries] = useState<ApiBroadcastDelivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'all' | 'unread' | 'critical'>('all');

  const load = useCallback(async () => {
    try {
      const data = await fetchBroadcastInbox(50);
      setDeliveries(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: new broadcast arrives
  useWebSocket(useCallback((event) => {
    if (event.type === 'BROADCAST_RECEIVED') load();
  }, [load]));

  const handleMarkRead = async (deliveryId: string) => {
    try {
      await markBroadcastRead(deliveryId);
      setDeliveries(prev =>
        prev.map(d => d.id === deliveryId ? { ...d, status: 'read', read_at: new Date().toISOString() } : d),
      );
    } catch { /* silent */ }
  };

  const filtered = deliveries.filter(d => {
    if (filter === 'unread')   return d.status !== 'read';
    if (filter === 'critical') return d.priority === 'critical' || d.priority === 'high';
    return true;
  });

  const unreadCount = deliveries.filter(d => d.status !== 'read').length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--bg-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={15} color="var(--accent-primary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            BROADCASTS
          </span>
          {unreadCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
              background: 'var(--accent-primary)', color: '#000',
            }}>
              {unreadCount}
            </span>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'unread', 'critical'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '2px 8px', fontSize: 10, fontWeight: 600,
                borderRadius: 2, border: 'none', cursor: 'pointer',
                textTransform: 'uppercase',
                background: filter === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: filter === f ? '#000' : 'var(--text-muted)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, paddingTop: 40 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <Bell size={28} color="var(--text-muted)" style={{ opacity: 0.4 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
              {filter === 'unread' ? 'All caught up.' : 'No broadcasts yet.'}
            </p>
          </div>
        ) : (
          filtered.map(d => (
            <BroadcastCard key={d.id} delivery={d} onMarkRead={handleMarkRead} />
          ))
        )}
      </div>
    </div>
  );
}
