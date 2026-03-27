import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth';
import { getFirebaseApp } from '../../services/auth/authService';
import { useAdminAuthStore } from '../../stores/adminAuthStore';
import { adminLogin, setupMfa, verifyMfa } from '../../services/api/adminApi';
import { Shield, AlertTriangle, Eye, EyeOff } from 'lucide-react';

type Step = 'credentials' | 'totp' | 'mfa_setup';

export default function AdminLoginPage() {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const { setAdmin } = useAdminAuthStore();

  const [step, setStep]         = useState<Step>('credentials');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [totp, setTotp]         = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  // MFA setup state
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [qrCode, setQrCode]       = useState<string | null>(null);

  const [setupCode, setSetupCode] = useState('');

  // Cached Firebase token for step 2
  const fbTokenRef = useRef<string | null>(null);

  const sessionExpired = params.get('reason') === 'session_expired';

  // Auto-submit TOTP when 6 digits entered
  useEffect(() => {
    if (totp.length === 6 && step === 'totp') handleTotp();
  }, [totp]);

  useEffect(() => {
    if (setupCode.length === 6 && step === 'mfa_setup') handleMfaSetup();
  }, [setupCode]);

  const handleCredentials = async () => {
    if (!email || !password) { setError('Email and password required'); return; }
    setError(null);
    setLoading(true);
    try {
      const auth = getAuth(getFirebaseApp());
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const fbToken = await cred.user.getIdToken();
      fbTokenRef.current = fbToken;

      // Peek at role — send dummy TOTP to get response shape
      const result = await adminLogin(fbToken, '000000', email);

      if (result.requiresMfaSetup && result.userId) {
        setMfaUserId(result.userId);
        const { qrCode: qr } = await setupMfa(result.userId);
        setQrCode(qr);
        setStep('mfa_setup');
      } else {
        setStep('totp');
      }
    } catch (e: unknown) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('Invalid MFA') || msg.includes('TOTP')) {
        setStep('totp'); // valid creds, just need real TOTP
      } else if (msg.includes('not authorized') || msg.includes('Not authorized')) {
        setError('This account does not have administrator access.');
      } else if (msg.includes('auth/')) {
        setError('Invalid email or password.');
      } else {
        setError(msg || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async () => {
    if (!fbTokenRef.current) { setStep('credentials'); return; }
    setError(null);
    setLoading(true);
    try {
      const result = await adminLogin(fbTokenRef.current, totp, email);
      setAdmin(
        {
          id:          result.user.id,
          email:       result.user.email,
          displayName: result.user.displayName,
          orgId:       result.user.orgId,
          orgRole:     result.user.orgRole as 'admin' | 'super_admin',
        },
        { token: result.token, expiresAt: result.expiresAt },
      );
      navigate('/admin', { replace: true });
    } catch (e: unknown) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('Invalid MFA') || msg.includes('Invalid code')) {
        setError('Invalid MFA code. Try again.');
        setTotp('');
      } else if (msg.includes('Too many')) {
        setError('Too many failed attempts. Account locked for 15 minutes.');
      } else {
        setError(msg || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSetup = async () => {
    if (!mfaUserId) return;
    setError(null);
    setLoading(true);
    try {
      await verifyMfa(mfaUserId, setupCode);
      setStep('totp');
      setSetupCode('');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Invalid code');
      setSetupCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: 'var(--font-mono)',
      backgroundImage: `
        radial-gradient(ellipse at 50% 0%, rgba(255,61,61,0.06) 0%, transparent 60%),
        linear-gradient(rgba(255,102,0,0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,102,0,0.015) 1px, transparent 1px)
      `,
      backgroundSize: 'cover, 40px 40px, 40px 40px',
    }}>
      {/* Restricted access status bar */}
      <div style={{
        width: '100%', height: 28, background: 'rgba(255,61,61,0.08)',
        borderBottom: '1px solid rgba(255,61,61,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: '#ff3d3d', letterSpacing: '0.15em',
      }}>
        ⚠ RESTRICTED ACCESS — ADMINISTRATOR TERMINAL ONLY
      </div>

      {/* Login card */}
      <div style={{
        marginTop: 80, width: 420,
        background: 'var(--bg-panel, #0d0d12)',
        border: '1px solid rgba(255,61,61,0.25)',
        borderRadius: 4, padding: 40,
        boxShadow: '0 0 40px rgba(255,61,61,0.06)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, margin: '0 auto 14px',
            background: 'rgba(255,61,61,0.12)',
            border: '1px solid rgba(255,61,61,0.4)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={22} color="#ff3d3d" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            <span style={{ color: 'var(--text-primary)' }}>Quant</span>
            <span style={{ color: '#ff3d3d' }}>Desk</span>
          </div>
          <div style={{ fontSize: 10, color: '#ff3d3d', letterSpacing: '0.2em', marginTop: 4 }}>
            ADMINISTRATOR ACCESS
          </div>
        </div>

        {/* Warning notice */}
        <div style={{
          background: 'rgba(255,61,61,0.06)', borderLeft: '3px solid #ff3d3d',
          padding: '10px 14px', marginBottom: 24, fontSize: 10,
          color: 'var(--text-secondary, #a0a0b0)', lineHeight: 1.6,
        }}>
          This terminal is restricted to authorized administrators.
          All access attempts are logged and monitored.
        </div>

        {sessionExpired && (
          <div style={{
            background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.3)',
            padding: '8px 12px', borderRadius: 3, fontSize: 11, color: '#ff3d3d',
            marginBottom: 16,
          }}>
            Your session has expired. Please re-authenticate.
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.3)',
            padding: '8px 12px', borderRadius: 3, fontSize: 11, color: '#ff3d3d',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        {/* ── Step: Credentials ── */}
        {step === 'credentials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelSt}>ADMIN EMAIL</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCredentials()}
                placeholder="admin@yourfirm.com"
                style={inputSt}
                autoFocus
              />
            </div>
            <div>
              <label style={labelSt}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCredentials()}
                  style={{ ...inputSt, paddingRight: 36 }}
                />
                <button
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <button onClick={handleCredentials} disabled={loading} style={btnSt}>
              {loading ? 'VERIFYING…' : 'CONTINUE →'}
            </button>
          </div>
        )}

        {/* ── Step: TOTP ── */}
        {step === 'totp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
              Enter the 6-digit code from your authenticator app.
            </div>
            <div>
              <label style={labelSt}>MFA CODE</label>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{ ...inputSt, letterSpacing: '0.4em', textAlign: 'center', fontSize: 18 }}
                autoFocus
              />
            </div>
            <button onClick={handleTotp} disabled={loading || totp.length !== 6} style={btnSt}>
              {loading ? 'AUTHENTICATING…' : 'AUTHENTICATE ADMINISTRATOR →'}
            </button>
            <button
              onClick={() => { setStep('credentials'); setTotp(''); setError(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Step: MFA Setup ── */}
        {step === 'mfa_setup' && qrCode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.7 }}>
              Scan this QR code with Google Authenticator or Authy to set up MFA.
            </div>
            <img src={qrCode} alt="MFA QR Code" style={{ width: 180, height: 180, border: '4px solid white', borderRadius: 4 }} />
            <div style={{ width: '100%' }}>
              <label style={labelSt}>CONFIRM CODE</label>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={setupCode} onChange={e => setSetupCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{ ...inputSt, letterSpacing: '0.4em', textAlign: 'center', fontSize: 18 }}
                autoFocus
              />
            </div>
            <button onClick={handleMfaSetup} disabled={loading || setupCode.length !== 6} style={{ ...btnSt, width: '100%' }}>
              {loading ? 'VERIFYING…' : 'CONFIRM MFA SETUP →'}
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 28, textAlign: 'center', fontSize: 10, color: 'var(--text-muted, #555)' }}>
          <Link to="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Return to trader login
          </Link>
          <br />
          <span style={{ marginTop: 6, display: 'block' }}>
            Forgotten admin credentials? Contact your system administrator.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
  color: 'var(--text-muted)', marginBottom: 5,
};

const inputSt: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 12,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,61,61,0.25)',
  borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
  fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
};

const btnSt: React.CSSProperties = {
  padding: '11px', fontSize: 12, fontWeight: 700,
  background: '#ff3d3d', color: '#000', border: 'none',
  borderRadius: 3, cursor: 'pointer', letterSpacing: '0.05em',
  transition: 'all 0.15s', width: '100%',
};
