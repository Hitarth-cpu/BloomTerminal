import { useState, useEffect } from 'react';
import { Send, Eye, X, Sparkles } from 'lucide-react';
import {
  createBroadcast, fetchBroadcastTemplates,
  type ApiBroadcastTemplate,
} from '../../services/api/broadcastsApi';

// ─── Token cheat-sheet ─────────────────────────────────────────────────────────

const TOKEN_BUTTONS = [
  '{{firstName}}', '{{preferredName}}', '{{fullName}}',
  '{{orgName}}', '{{teamName}}', '{{role}}',
  '{{greeting}}', '{{date}}', '{{time}}',
  '{{marketStatus}}', '{{portfolioValue}}', '{{dailyPnl}}',
  '{{positionCount}}', '{{topHolding}}', '{{coverageTickers}}',
];

const AUDIENCE_OPTIONS = [
  { value: 'org_wide',   label: 'Entire Organisation' },
  { value: 'team',       label: 'Specific Team' },
  { value: 'role',       label: 'By Role' },
  { value: 'individual', label: 'Individual User' },
];

const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'critical'] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function insertAtCursor(ta: HTMLTextAreaElement, text: string): string {
  const start = ta.selectionStart ?? ta.value.length;
  const end   = ta.selectionEnd   ?? ta.value.length;
  return ta.value.slice(0, start) + text + ta.value.slice(end);
}

// ─── BroadcastComposer ─────────────────────────────────────────────────────────

interface Props {
  onSent?: () => void;
}

export default function BroadcastComposer({ onSent }: Props) {
  const [title, setTitle]               = useState('');
  const [body, setBody]                 = useState('');
  const [audienceType, setAudienceType] = useState('org_wide');
  const [audienceValue, setAudienceValue] = useState('');
  const [priority, setPriority]         = useState<typeof PRIORITY_OPTIONS[number]>('normal');
  const [broadcastType, setBroadcastType] = useState('announcement');
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledAt, setScheduledAt]   = useState('');
  const [templates, setTemplates]       = useState<ApiBroadcastTemplate[]>([]);
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);
  const [preview, setPreview]           = useState(false);
  const [taRef, setTaRef]               = useState<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetchBroadcastTemplates().then(setTemplates).catch(() => {});
  }, []);

  const loadTemplate = (tpl: ApiBroadcastTemplate) => {
    setBody(tpl.body_template);
    if (tpl.default_priority) setPriority(tpl.default_priority as typeof PRIORITY_OPTIONS[number]);
    if (tpl.default_audience_type) setAudienceType(tpl.default_audience_type);
  };

  const insertToken = (token: string) => {
    if (!taRef) { setBody(prev => prev + token); return; }
    const newBody = insertAtCursor(taRef, token);
    setBody(newBody);
    // Restore focus
    setTimeout(() => taRef.focus(), 0);
  };

  const buildAudienceConfig = (): Record<string, unknown> => {
    if (audienceType === 'org_wide') return {};
    if (audienceType === 'team')     return { teamId: audienceValue };
    if (audienceType === 'role')     return { role: audienceValue };
    if (audienceType === 'individual') return { userId: audienceValue };
    return {};
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.'); return;
    }
    setSending(true); setError(null);
    try {
      await createBroadcast({
        title: title.trim(),
        bodyTemplate: body,
        broadcastType,
        priority,
        audienceType,
        audienceConfig: buildAudienceConfig(),
        scheduleType,
        scheduledAt: scheduleType === 'scheduled' ? scheduledAt : undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTitle(''); setBody('');
        onSent?.();
      }, 2000);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const priorityColor: Record<string, string> = {
    low: 'var(--text-muted)', normal: 'var(--accent-primary)',
    high: '#f59e0b', critical: 'var(--negative)',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--bg-border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Send size={14} color="var(--accent-primary)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          COMPOSE BROADCAST
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Templates */}
        {templates.length > 0 && (
          <div>
            <label style={labelStyle}>TEMPLATE</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {templates.map(t => (
                <button key={t.id} onClick={() => loadTemplate(t)} style={chipStyle}>
                  <Sparkles size={11} /> {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label style={labelStyle}>TITLE</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Morning Market Update"
            style={inputStyle}
          />
        </div>

        {/* Token toolbar */}
        <div>
          <label style={labelStyle}>INSERT TOKEN</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {TOKEN_BUTTONS.map(t => (
              <button key={t} onClick={() => insertToken(t)} style={chipStyle}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={labelStyle}>BODY</label>
            <button
              onClick={() => setPreview(prev => !prev)}
              style={{ ...chipStyle, gap: 4, display: 'flex', alignItems: 'center' }}
            >
              <Eye size={11} /> {preview ? 'EDIT' : 'PREVIEW (RAW)'}
            </button>
          </div>
          {preview ? (
            <div style={{
              ...inputStyle, minHeight: 140, whiteSpace: 'pre-wrap',
              lineHeight: 1.6, color: 'var(--text-secondary)',
            }}>
              {body || <span style={{ opacity: 0.4 }}>Nothing to preview.</span>}
            </div>
          ) : (
            <textarea
              ref={el => setTaRef(el)}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message… use {{tokens}} for personalization."
              rows={8}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
          )}
        </div>

        {/* Audience */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>AUDIENCE</label>
            <select
              value={audienceType}
              onChange={e => setAudienceType(e.target.value)}
              style={inputStyle}
            >
              {AUDIENCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {audienceType !== 'org_wide' && (
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>
                {audienceType === 'team' ? 'TEAM ID' : audienceType === 'role' ? 'ROLE' : 'USER ID'}
              </label>
              <input
                value={audienceValue}
                onChange={e => setAudienceValue(e.target.value)}
                placeholder={audienceType === 'role' ? 'e.g. admin' : 'UUID'}
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {/* Priority + Type row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>PRIORITY</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  style={{
                    flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 700,
                    borderRadius: 2, border: `1px solid ${priority === p ? priorityColor[p] : 'var(--bg-border)'}`,
                    background: priority === p ? `${priorityColor[p]}22` : 'var(--bg-secondary)',
                    color: priority === p ? priorityColor[p] : 'var(--text-muted)',
                    cursor: 'pointer', textTransform: 'uppercase',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <label style={labelStyle}>TYPE</label>
            <select
              value={broadcastType}
              onChange={e => setBroadcastType(e.target.value)}
              style={inputStyle}
            >
              {['announcement','morning_note','alert','risk_update','compliance','system'].map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label style={labelStyle}>DELIVERY</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['immediate', 'scheduled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScheduleType(s)}
                style={{
                  padding: '5px 14px', fontSize: 11, fontWeight: 600,
                  borderRadius: 2, border: `1px solid ${scheduleType === s ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                  background: scheduleType === s ? 'rgba(0,200,255,0.1)' : 'var(--bg-secondary)',
                  color: scheduleType === s ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', textTransform: 'uppercase',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          {scheduleType === 'scheduled' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              style={{ ...inputStyle, marginTop: 8 }}
            />
          )}
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 4, fontSize: 12,
            background: 'rgba(239,68,68,0.1)', color: 'var(--negative)',
            border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            {error}
            <X size={12} style={{ cursor: 'pointer' }} onClick={() => setError(null)} />
          </div>
        )}
        {success && (
          <div style={{
            padding: '8px 12px', borderRadius: 4, fontSize: 12,
            background: 'rgba(34,197,94,0.1)', color: '#22c55e',
            border: '1px solid rgba(34,197,94,0.3)',
          }}>
            Broadcast sent successfully.
          </div>
        )}
      </div>

      {/* Footer send button */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--bg-border)',
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 20px', fontSize: 12, fontWeight: 700,
            borderRadius: 3, border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
            background: sending ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
            color: sending ? 'var(--text-muted)' : '#000',
            opacity: (!title.trim() || !body.trim()) ? 0.5 : 1,
            transition: 'all 0.15s',
          }}
        >
          <Send size={13} />
          {sending ? 'SENDING…' : scheduleType === 'immediate' ? 'SEND NOW' : 'SCHEDULE'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
  color: 'var(--text-muted)', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
  borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  padding: '2px 7px', fontSize: 10, fontWeight: 600,
  background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)',
  borderRadius: 2, cursor: 'pointer', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', gap: 3,
};
