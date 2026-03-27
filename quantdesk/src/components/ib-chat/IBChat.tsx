import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send, Video, Phone, MoreHorizontal, Lock, ShieldAlert,
  UserPlus, Search, X, Star, Bell, ChevronDown, ChevronRight,
  Megaphone, CheckCircle, AlertTriangle, Info, BarChart2,
} from 'lucide-react';
import { getOrCreateChatKey, encryptMessage, decryptMessage } from '../../services/crypto';
import {
  fetchContacts, addContact, discoverOrgUsers,
  fetchContactRequests, respondToContactRequest,
  type ApiContact, type ApiContactRequest, type ApiOrgUser,
} from '../../services/api/contactsApi';
import {
  fetchBroadcastInbox, markBroadcastRead,
  type ApiBroadcastDelivery,
} from '../../services/api/broadcastsApi';
import {
  sendMessage as apiSendMessage, fetchMessages as apiFetchMessages,
} from '../../services/api/chatApi';
import { api } from '../../services/api/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import BroadcastInbox from './BroadcastInbox';
import BroadcastDashboard from './BroadcastDashboard';
import type { ChatMessage, EncryptedPayload } from '../../types';

type MainTab = 'chat' | 'inbox' | 'admin';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--negative)',
  high:     'var(--warning)',
  normal:   'var(--accent-primary)',
  low:      'var(--text-muted)',
};

const BROADCAST_ICON: Record<string, typeof Info> = {
  alert:       AlertTriangle,
  risk_update: AlertTriangle,
  announcement: Megaphone,
  morning_note: Info,
  compliance:  CheckCircle,
  system:      Info,
};

// ─── Add Partner Modal ─────────────────────────────────────────────────────────

function AddPartnerModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<ApiOrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded]     = useState<Set<string>>(new Set());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await discoverOrgUsers(query.trim());
        setResults(users);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  const handleAdd = async (user: ApiOrgUser) => {
    try {
      await addContact(user.id);
      setAdded(prev => new Set(prev).add(user.id));
      onAdded();
    } catch { /* already added or error */ }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        width: 420, background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
        borderRadius: 4, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={13} color="var(--accent-primary)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600 }}>ADD PARTNER</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
            <X size={13} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '4px 8px' }}>
            <Search size={11} color="var(--text-muted)" />
            <input
              autoFocus
              style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}
              placeholder="Search by name or email…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {loading && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>…</span>}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 5 }}>
            Searching your organization's directory
          </div>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {results.length === 0 && query.trim() && !loading && (
            <div style={{ padding: '16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              No users found for "{query}"
            </div>
          )}
          {results.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              transition: 'background 0.1s',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700 }}>
                {u.display_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{u.display_name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}{u.firm ? ` · ${u.firm}` : ''}</div>
              </div>
              <button
                onClick={() => handleAdd(u)}
                disabled={added.has(u.id)}
                style={{
                  padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                  background: added.has(u.id) ? 'rgba(0,200,100,0.15)' : 'rgba(255,102,0,0.15)',
                  border: `1px solid ${added.has(u.id) ? 'rgba(0,200,100,0.4)' : 'rgba(255,102,0,0.4)'}`,
                  color: added.has(u.id) ? 'var(--positive)' : 'var(--accent-primary)',
                  cursor: added.has(u.id) ? 'default' : 'pointer', borderRadius: 2,
                  transition: 'all 0.15s',
                }}
              >
                {added.has(u.id) ? '✓ ADDED' : '+ ADD'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 2 }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Broadcast banner ─────────────────────────────────────────────────────────

function BroadcastBanner({
  delivery, onRead,
}: { delivery: ApiBroadcastDelivery; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = BROADCAST_ICON[delivery.broadcast_type] ?? Info;
  const color = PRIORITY_COLOR[delivery.priority] ?? 'var(--accent-primary)';
  const isUnread = delivery.status === 'delivered';

  const handleExpand = () => {
    setExpanded(e => !e);
    if (isUnread) onRead(delivery.id);
  };

  return (
    <div style={{
      margin: '4px 8px', border: `1px solid ${color}30`,
      background: `${color}08`, borderRadius: 2,
      transition: 'all 0.15s',
    }}>
      <div
        onClick={handleExpand}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer' }}
      >
        <Icon size={11} color={color} />
        <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)', fontWeight: isUnread ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {delivery.title}
        </span>
        {isUnread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>
          {delivery.sent_at ? new Date(delivery.sent_at).toLocaleDateString() : ''}
        </span>
        {expanded ? <ChevronDown size={10} color="var(--text-muted)" /> : <ChevronRight size={10} color="var(--text-muted)" />}
      </div>
      {expanded && (
        <div style={{ padding: '4px 8px 8px', borderTop: `1px solid ${color}20` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginBottom: 4 }}>
            FROM {delivery.created_by_name?.toUpperCase()} · {delivery.broadcast_type?.toUpperCase().replace('_', ' ')}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {delivery.personalized_body}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contact item ─────────────────────────────────────────────────────────────

function ContactItem({
  contact, active, onClick, presence,
}: { contact: ApiContact; active: boolean; onClick: () => void; presence?: string }) {
  const isOnline = presence === 'online';
  const isAway   = presence === 'away';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
        background: active ? 'rgba(255,102,0,0.1)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
        cursor: 'pointer', transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', fontWeight: 700, border: '1px solid var(--bg-border)' }}>
          {(contact.nickname ?? contact.display_name).charAt(0).toUpperCase()}
        </div>
        <div style={{
          position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%',
          background: isOnline ? '#00c853' : isAway ? '#ffc107' : '#666',
          border: '1.5px solid var(--bg-secondary)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: active ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {contact.nickname ?? contact.display_name}
          </span>
          {contact.is_favorite && <Star size={8} color="var(--warning)" fill="var(--warning)" />}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.firm ?? contact.email}
        </div>
      </div>
    </div>
  );
}

// ─── Incoming request badge ────────────────────────────────────────────────────

function RequestBadge({
  request, onRespond,
}: { request: ApiContactRequest; onRespond: () => void }) {
  return (
    <div style={{ margin: '4px 8px', padding: '6px 8px', background: 'rgba(255,102,0,0.08)', border: '1px solid rgba(255,102,0,0.25)', borderRadius: 2 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>
        CONTACT REQUEST
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)', marginBottom: 4, fontWeight: 600 }}>
        {request.requester_display_name}
      </div>
      {request.message && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', marginBottom: 6, fontStyle: 'italic' }}>
          "{request.message}"
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={async () => { await respondToContactRequest(request.id, true); onRespond(); }}
          style={{ flex: 1, padding: '3px 0', fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(0,200,100,0.15)', border: '1px solid rgba(0,200,100,0.4)', color: 'var(--positive)', cursor: 'pointer', borderRadius: 2 }}
        >
          ACCEPT
        </button>
        <button
          onClick={async () => { await respondToContactRequest(request.id, false); onRespond(); }}
          style={{ flex: 1, padding: '3px 0', fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(255,61,61,0.1)', border: '1px solid rgba(255,61,61,0.3)', color: 'var(--negative)', cursor: 'pointer', borderRadius: 2 }}
        >
          DECLINE
        </button>
      </div>
    </div>
  );
}

// ─── Encrypted message bubble ─────────────────────────────────────────────────

function EncryptedContent({ payload, chatKey }: { payload: EncryptedPayload; chatKey: CryptoKey | undefined }) {
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [error, setError]         = useState(false);

  useEffect(() => {
    if (!chatKey) { setPlaintext(null); return; }
    setPlaintext(null); setError(false);
    decryptMessage(payload, chatKey).then(setPlaintext).catch(() => setError(true));
  }, [payload, chatKey]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--negative)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        <ShieldAlert size={11} /> <span>[DECRYPTION FAILED]</span>
      </div>
    );
  }
  if (plaintext === null) {
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>decrypting…</span>;
  }
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>{plaintext}</span>;
}

function MessageBubble({ msg, chatKey }: { msg: ChatMessage; chatKey: CryptoKey | undefined }) {
  const isMe        = msg.senderId === 'me';
  const isEncrypted = !!msg.encrypted;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 10, padding: '0 10px' }}>
      {!isMe && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)', marginBottom: 2 }}>{msg.senderName}</span>}
      <div style={{
        maxWidth: '78%', background: isMe ? 'rgba(255,102,0,0.13)' : 'var(--bg-elevated)',
        border: `1px solid ${isMe ? 'rgba(255,102,0,0.28)' : 'var(--bg-border)'}`,
        padding: '5px 9px', borderRadius: 2,
      }}>
        {isEncrypted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid var(--bg-border)' }}>
            <Lock size={8} color="var(--positive)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--positive)', letterSpacing: 0.5 }}>E2E ENCRYPTED · AES-256-GCM</span>
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {isEncrypted
            ? <EncryptedContent payload={msg.encrypted!} chatKey={chatKey} />
            : msg.content}
        </div>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

// ─── Main IBChat ──────────────────────────────────────────────────────────────

export function IBChat() {
  const { user } = useAuthStore();

  // Contacts
  const [contacts,  setContacts]  = useState<ApiContact[]>([]);
  const [requests,  setRequests]  = useState<ApiContactRequest[]>([]);
  const [broadcasts, setBroadcasts] = useState<ApiBroadcastDelivery[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  // UI state
  const [mainTab,         setMainTab]           = useState<MainTab>('chat');
  const [activeContactId, setActiveContactId]   = useState<string | null>(null);
  const [showAddPartner,  setShowAddPartner]     = useState(false);
  const [searchQ,         setSearchQ]           = useState('');
  const [showBroadcasts,  setShowBroadcasts]    = useState(true);

  // Messaging
  const [messages,   setMessages]  = useState<Record<string, ChatMessage[]>>({});
  const [input,      setInput]     = useState('');
  const [chatKeys,   setChatKeys]  = useState<Map<string, CryptoKey>>(new Map());
  const [cryptoReady, setCryptoReady] = useState(false);
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);

  // Presence: userId → 'online' | 'away' | 'offline'
  const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, b] = await Promise.all([
        fetchContacts().catch(() => null),
        fetchContactRequests().catch(() => []),
        fetchBroadcastInbox().catch(() => []),
      ]);
      if (c === null) {
        setUsingMock(true);
      } else {
        setContacts(c);
        setUsingMock(false);
      }
      setRequests(r ?? []);
      setBroadcasts(b ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Crypto key per chat ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeContactId) return;
    setCryptoReady(false); setCryptoError(null);
    getOrCreateChatKey(activeContactId)
      .then(key => { setChatKeys(prev => new Map(prev).set(activeContactId, key)); setCryptoReady(true); })
      .catch(err => { setCryptoError((err as Error).message ?? 'Crypto init failed'); setCryptoReady(true); });
  }, [activeContactId]);

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeContactId]);

  // ── Room ID cache: contactUserId → roomId ─────────────────────────────────
  const roomCache = useRef<Map<string, string>>(new Map());

  const getRoomId = useCallback(async (contactUserId: string): Promise<string> => {
    const cached = roomCache.current.get(contactUserId);
    if (cached) return cached;
    const { roomId } = await api.get<{ roomId: string }>(`/chat/dm/${contactUserId}`);
    roomCache.current.set(contactUserId, roomId);
    return roomId;
  }, []);

  // ── Load messages when opening a chat ────────────────────────────────────
  useEffect(() => {
    if (!activeContactId) return;
    let cancelled = false;
    (async () => {
      try {
        const roomId = await getRoomId(activeContactId);
        const msgs = await apiFetchMessages(roomId);
        if (cancelled) return;
        const mapped: ChatMessage[] = msgs.map(m => ({
          id:         m._id,
          chatId:     activeContactId,
          senderId:   m.senderId === user?.uid ? 'me' : m.senderId,
          senderName: m.senderId === user?.uid ? (user?.displayName ?? 'You') : m.aad?.senderId ?? 'Contact',
          content:    '', // encrypted; will decrypt below
          timestamp:  new Date(m.createdAt).getTime(),
          type:       m.messageType === 'text' ? 'text' : 'text',
          encrypted:  m.encrypted as unknown as EncryptedPayload | undefined,
        }));
        setMessages(prev => ({ ...prev, [activeContactId]: mapped }));
      } catch {
        // API unavailable — keep existing messages
      }
    })();
    return () => { cancelled = true; };
  }, [activeContactId, getRoomId, user]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMsg = useCallback(async () => {
    if (!input.trim() || !activeContactId) return;
    const plaintext = input.trim();
    setInput('');

    const activeChatKey = chatKeys.get(activeContactId);
    let encrypted: EncryptedPayload | undefined;

    if (activeChatKey) {
      try {
        encrypted = await encryptMessage(plaintext, activeChatKey, { chatId: activeContactId, senderId: 'me' });
      } catch { /* encryption failure — fall through to plaintext */ }
    }

    const msg: ChatMessage = {
      id:         Date.now().toString(),
      chatId:     activeContactId,
      senderId:   'me',
      senderName: user?.displayName ?? 'You',
      content:    encrypted ? '' : plaintext,
      timestamp:  Date.now(),
      type:       'text',
      encrypted,
    };

    // Optimistic update
    setMessages(prev => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] ?? []), msg],
    }));

    // POST to API
    try {
      const roomId = await getRoomId(activeContactId);
      await apiSendMessage(roomId, {
        messageType: 'text',
        encrypted: (encrypted as unknown as { iv: string; ciphertext: string; tag: string } | undefined) ?? { iv: '', ciphertext: btoa(plaintext), tag: '' },
        aad: { chatRoomId: roomId, senderId: user?.uid ?? 'me', messageType: 'text' },
      });
    } catch (err) {
      console.warn('[chat] Failed to send message to API:', (err as Error).message);
    }
  }, [input, activeContactId, chatKeys, user, getRoomId]);

  // ── WebSocket: live broadcast + contact + chat events ──────────────────────
  useWebSocket(useCallback((event) => {
    if (event.type === 'BROADCAST_RECEIVED') {
      fetchBroadcastInbox().then(b => setBroadcasts(b)).catch(() => {});
    }
    if (event.type === 'CONTACT_REQUEST_RECEIVED') {
      loadAll();
    }
    if (event.type === 'USER_PRESENCE_UPDATE') {
      const uid = event.userId as string;
      const status = event.status as string;
      if (uid) setPresenceMap(prev => ({ ...prev, [uid]: status }));
    }
    if (event.type === 'IB_MESSAGE') {
      const senderId = event.senderId as string;
      // Don't duplicate our own messages (already added optimistically)
      if (senderId === user?.uid || senderId === 'me') return;

      // Find which contact this message is from
      const contactId = senderId;
      const incomingMsg: ChatMessage = {
        id:         (event.messageId as string) ?? Date.now().toString(),
        chatId:     contactId,
        senderId:   contactId,
        senderName: contacts.find(c => c.contact_user_id === contactId)?.display_name ?? 'Contact',
        content:    '',
        timestamp:  (event.timestamp as number) ?? Date.now(),
        type:       'text',
        encrypted:  event.encrypted as EncryptedPayload | undefined,
      };

      setMessages(prev => ({
        ...prev,
        [contactId]: [...(prev[contactId] ?? []), incomingMsg],
      }));
    }
  }, [loadAll, user, contacts]));

  // ── Broadcast read ─────────────────────────────────────────────────────────
  const handleBroadcastRead = useCallback(async (deliveryId: string) => {
    await markBroadcastRead(deliveryId).catch(() => {});
    setBroadcasts(prev =>
      prev.map(d => d.id === deliveryId ? { ...d, status: 'read' } : d)
    );
  }, []);

  // ── Filtered contacts ──────────────────────────────────────────────────────
  const filteredContacts = contacts.filter(c =>
    !searchQ || (c.nickname ?? c.display_name).toLowerCase().includes(searchQ.toLowerCase())
               || c.email.toLowerCase().includes(searchQ.toLowerCase())
  );
  const favorites  = filteredContacts.filter(c => c.is_favorite);
  const others     = filteredContacts.filter(c => !c.is_favorite);
  const activeContact = contacts.find(c => c.contact_user_id === activeContactId);
  const chatMessages  = activeContactId ? (messages[activeContactId] ?? []) : [];

  const unreadBroadcasts = broadcasts.filter(b => b.status === 'delivered').length;

  return (
    <>
      {showAddPartner && (
        <AddPartnerModal
          onClose={() => setShowAddPartner(false)}
          onAdded={loadAll}
        />
      )}

      <div style={{ display: 'flex', height: '100%', background: 'var(--bg-secondary)' }}>

        {/* ─── Left: Contact List ──────────────────────────────────────────── */}
        <div style={{ width: 210, borderRight: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

          {/* Header */}
          <div className="panel-header" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>IB MANAGER</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {usingMock && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--warning)' }}>⚠ MOCK</span>}
              <button
                onClick={() => setShowAddPartner(true)}
                title="Add Partner"
                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: 'rgba(255,102,0,0.15)', border: '1px solid rgba(255,102,0,0.4)', borderRadius: 2, cursor: 'pointer' }}
              >
                <UserPlus size={10} color="var(--accent-primary)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent-primary)' }}>ADD</span>
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', padding: '2px 6px' }}>
              <Search size={9} color="var(--text-muted)" />
              <input
                style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-primary)', width: '100%' }}
                placeholder="Search contacts…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={9} /></button>}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Broadcasts section */}
            {broadcasts.length > 0 && (
              <div>
                <div
                  onClick={() => setShowBroadcasts(s => !s)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderTop: '1px solid var(--bg-border)', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Bell size={9} color={unreadBroadcasts > 0 ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                    <span style={{ letterSpacing: 0.5 }}>BROADCASTS</span>
                    {unreadBroadcasts > 0 && (
                      <span style={{ background: 'var(--accent-primary)', color: '#000', borderRadius: '50%', width: 13, height: 13, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{unreadBroadcasts}</span>
                    )}
                  </div>
                  {showBroadcasts ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                </div>
                {showBroadcasts && broadcasts.slice(0, 5).map(d => (
                  <BroadcastBanner key={d.id} delivery={d} onRead={handleBroadcastRead} />
                ))}
              </div>
            )}

            {/* Incoming requests */}
            {requests.length > 0 && (
              <div>
                <div style={{ padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--warning)', background: 'var(--bg-primary)', borderTop: '1px solid var(--bg-border)', letterSpacing: 0.5 }}>
                  PENDING REQUESTS ({requests.length})
                </div>
                {requests.map(r => (
                  <RequestBadge key={r.id} request={r} onRespond={loadAll} />
                ))}
              </div>
            )}

            {/* Favorites */}
            {favorites.length > 0 && (
              <div>
                <div style={{ padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderTop: '1px solid var(--bg-border)', letterSpacing: 0.5 }}>⭐ FAVORITES</div>
                {favorites.map(c => (
                  <ContactItem key={c.id} contact={c} active={c.contact_user_id === activeContactId} presence={presenceMap[c.contact_user_id]} onClick={() => setActiveContactId(c.contact_user_id)} />
                ))}
              </div>
            )}

            {/* All contacts */}
            <div>
              <div style={{ padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-primary)', borderTop: '1px solid var(--bg-border)', letterSpacing: 0.5 }}>
                CONTACTS {loading ? '…' : `(${others.length})`}
              </div>
              {loading && (
                <div style={{ padding: '12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>LOADING…</div>
              )}
              {!loading && others.length === 0 && !searchQ && (
                <div style={{ padding: '12px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  No contacts yet.<br />Click <span style={{ color: 'var(--accent-primary)' }}>+ ADD</span> to find colleagues.
                </div>
              )}
              {others.map(c => (
                <ContactItem key={c.id} contact={c} active={c.contact_user_id === activeContactId} onClick={() => setActiveContactId(c.contact_user_id)} />
              ))}
            </div>
          </div>
        </div>

        {/* ─── Right: Main panel ───────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Tab bar */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--bg-border)',
            flexShrink: 0, background: 'var(--bg-primary)',
          }}>
            {([
              { id: 'chat',  label: 'CHAT',    icon: Send      },
              { id: 'inbox', label: 'INBOX',   icon: Bell      },
              { id: 'admin', label: 'ADMIN',   icon: BarChart2 },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMainTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', fontSize: 10, fontWeight: 700,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: mainTab === id ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: `2px solid ${mainTab === id ? 'var(--accent-primary)' : 'transparent'}`,
                  letterSpacing: '0.06em',
                  position: 'relative',
                }}
              >
                <Icon size={11} />
                {label}
                {id === 'inbox' && unreadBroadcasts > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent-primary)',
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {mainTab === 'inbox' ? (
            <BroadcastInbox />
          ) : mainTab === 'admin' ? (
            <BroadcastDashboard />
          ) : !activeContactId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, background: 'var(--accent-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={16} color="var(--accent-primary)" />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 }}>
                Select a contact to start messaging<br />
                <span style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 10 }} onClick={() => setShowAddPartner(true)}>
                  + Add a partner
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="panel-header" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700 }}>
                    {((activeContact?.nickname ?? activeContact?.display_name) ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
                      {activeContact?.nickname ?? activeContact?.display_name ?? activeContactId}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                        background: presenceMap[activeContactId!] === 'online' ? '#00c853' : presenceMap[activeContactId!] === 'away' ? '#ffc107' : '#666',
                      }} />
                      {presenceMap[activeContactId!] === 'online' ? 'Online' : presenceMap[activeContactId!] === 'away' ? 'Away' : 'Offline'}
                      {' · '}{activeContact?.firm ?? activeContact?.email}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {cryptoError ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--negative)' }}>
                      <ShieldAlert size={9} /> CRYPTO ERROR
                    </span>
                  ) : cryptoReady ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--positive)' }}>
                      <Lock size={9} /> AES-256-GCM
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>INITIALISING…</span>
                  )}
                  <Video size={12} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
                  <Phone size={12} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
                  <MoreHorizontal size={12} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                    No messages yet — say hello
                  </div>
                ) : (
                  chatMessages.map(m => (
                    <MessageBubble key={m.id} msg={m} chatKey={chatKeys.get(m.chatId)} />
                  ))
                )}
                <div ref={messagesEnd} />
              </div>

              {/* Input */}
              <div style={{ padding: '6px 10px', borderTop: '1px solid var(--bg-border)', display: 'flex', gap: 6, flexShrink: 0 }}>
                <input
                  className="terminal-input"
                  style={{ flex: 1 }}
                  placeholder={cryptoReady ? 'Message — encrypted before send' : 'Initialising encryption…'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()}
                  disabled={!cryptoReady}
                />
                <button
                  className="btn btn-primary"
                  onClick={sendMsg}
                  disabled={!input.trim() || !cryptoReady}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                >
                  <Lock size={9} />
                  <Send size={10} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

