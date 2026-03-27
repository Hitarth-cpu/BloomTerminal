import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';
import { createAccount, signInWithGoogle } from '../services/auth/authService';
import { useAuthStore } from '../stores/authStore';

interface InviteDetails {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  intended_role: string;
  status: string;
  expires_at: string;
  org_name: string;
  invited_by_name: string;
}

function AuthInput({ label, type = 'text', value, onChange, placeholder, error }: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: 'var(--bg-elevated)', border: `1px solid ${error ? 'var(--negative)' : focused ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
          borderRadius: 3, padding: '10px 12px',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)',
          outline: 'none', width: '100%', boxSizing: 'border-box',
          boxShadow: focused ? '0 0 0 2px rgba(255,102,0,0.12)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      />
      {error && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--negative)' }}>{error}</span>}
    </div>
  );
}

export function InvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitErr, setSubmitErr]     = useState('');
  const [done, setDone]               = useState(false);

  useEffect(() => {
    if (!token) { setLoadErr('Missing invitation token.'); setLoading(false); return; }
    fetch(`/api/auth/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setLoadErr(data.error); }
        else { setInvite(data.invitation); setDisplayName(`${data.invitation.first_name ?? ''} ${data.invitation.last_name ?? ''}`.trim()); }
      })
      .catch(() => setLoadErr('Failed to load invitation.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function acceptInvite(idToken: string) {
    const res = await fetch('/api/auth/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, idToken }),
    });
    const data = await res.json() as { ok?: boolean; error?: string; token?: string };
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'Failed to accept invitation');
    if (data.token) useAuthStore.getState().setUser(useAuthStore.getState().user!, data.token);
    return data;
  }

  const handleCreate = async () => {
    if (!invite) return;
    if (password.length < 8) { setSubmitErr('Password must be at least 8 characters'); return; }
    if (password !== confirmPw) { setSubmitErr('Passwords do not match'); return; }
    setSubmitting(true); setSubmitErr('');
    try {
      const user = await createAccount(invite.email, password, displayName || invite.email.split('@')[0]);
      // Get Firebase ID token from the auth store
      const { getFirebaseApp } = await import('../services/auth/authService');
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth(getFirebaseApp()).currentUser?.getIdToken() ?? '';
      await acceptInvite(idToken);
      setDone(true);
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (e) {
      setSubmitErr((e as Error).message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (!invite) return;
    setSubmitting(true); setSubmitErr('');
    try {
      await signInWithGoogle();
      const { getFirebaseApp } = await import('../services/auth/authService');
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth(getFirebaseApp()).currentUser?.getIdToken() ?? '';
      await acceptInvite(idToken);
      setDone(true);
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (e) {
      setSubmitErr((e as Error).message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Layout wrapper ──────────────────────────────────────────────────────────
  const wrap = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
        borderRadius: 4, padding: '40px 40px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 34, height: 34, flexShrink: 0,
            clipPath: 'polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
            background: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#000' }}>QD</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, lineHeight: 1 }}>
              <span style={{ color: 'var(--text-primary)' }}>Quant</span>
              <span style={{ color: 'var(--accent-primary)' }}>Desk</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em', marginTop: 2 }}>
              INSTITUTIONAL TRADING PLATFORM
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) return wrap(
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
      Loading invitation…
    </div>
  );

  if (loadErr) return wrap(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <AlertTriangle size={32} color="var(--negative)" />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--negative)', textAlign: 'center' }}>{loadErr}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        The invitation link may be invalid, expired, or already used.
      </div>
    </div>
  );

  if (done) return wrap(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <CheckCircle size={36} color="var(--positive)" />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>You're in!</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Redirecting to your dashboard…
      </div>
    </div>
  );

  return wrap(
    <>
      {/* Invite banner */}
      <div style={{
        background: 'rgba(255,102,0,0.07)', border: '1px solid rgba(255,102,0,0.25)',
        borderRadius: 3, padding: '12px 16px', marginBottom: 28,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', letterSpacing: '0.1em', marginBottom: 4 }}>
          // INVITATION
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
          <strong>{invite!.invited_by_name}</strong> invited you to join
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          {invite!.org_name}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          as <span style={{ color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{invite!.intended_role}</span>
          {'  ·  '}{invite!.email}
        </div>
      </div>

      {/* Google button */}
      <div style={{ marginBottom: 16 }}>
        <GoogleAuthButton onAuth={handleGoogle} animDelay="0s" label="Continue with Google" />
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--bg-border)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>OR CREATE ACCOUNT</span>
        <div style={{ flex: 1, height: 1, background: 'var(--bg-border)' }} />
      </div>

      {/* Error */}
      {submitErr && (
        <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.3)', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--negative)' }}>
          {submitErr}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <AuthInput label="Full Name" value={displayName} onChange={setDisplayName} placeholder="Your name" />
        <AuthInput label="Email" type="email" value={invite!.email} onChange={() => {}} />
        <AuthInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" />
        <AuthInput label="Confirm Password" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="Repeat password" error={confirmPw && confirmPw !== password ? 'Passwords do not match' : undefined} />
      </div>

      <button
        onClick={handleCreate}
        disabled={submitting}
        className="auth-cta-btn"
        style={{ width: '100%', height: 44, marginBottom: 20 }}
      >
        {submitting ? 'SETTING UP…' : 'ACCEPT & CREATE ACCOUNT →'}
      </button>

      {/* Security note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 3 }}>
        <Lock size={11} color="var(--positive)" style={{ flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          <span style={{ color: 'var(--positive)' }}>Secured</span> · Invitation expires {new Date(invite!.expires_at).toLocaleDateString()}
        </span>
      </div>
    </>
  );
}
