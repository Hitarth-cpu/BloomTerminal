import { useState } from 'react';
import { Eye, EyeOff, Check, X, Lock } from 'lucide-react';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';
import { signInWithGoogle, createAccount } from '../services/auth/authService';
import { useAuthStore } from '../stores/authStore';

// ─── Password strength ────────────────────────────────────────────────────────
function calcStrength(p: string): number {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8)               s++;
  if (/[A-Z]/.test(p))             s++;
  if (/[0-9]/.test(p))             s++;
  if (/[^A-Za-z0-9]/.test(p))      s++;
  return s;
}
const STRENGTH_LABELS = ['', 'VERY WEAK', 'WEAK', 'STRONG', 'VERY STRONG'];
const STRENGTH_COLORS = ['', 'var(--negative)', 'var(--highlight)', 'var(--positive)', 'var(--positive)'];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const s = calcStrength(password);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= s ? STRENGTH_COLORS[s] : 'var(--bg-border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: STRENGTH_COLORS[s], textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {STRENGTH_LABELS[s]}
      </span>
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
function AuthInput({ label, type = 'text', value, onChange, placeholder, error, rightEl }: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; error?: string;
  rightEl?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width: '100%', background: 'var(--bg-elevated)',
            border: `1px solid ${error ? 'var(--negative)' : focused ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
            borderRadius: 3, padding: rightEl ? '9px 36px 9px 12px' : '9px 12px',
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', outline: 'none',
            boxShadow: focused ? (error ? '0 0 0 2px rgba(255,61,61,0.15)' : '0 0 0 2px rgba(255,102,0,0.12)') : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {rightEl && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>{rightEl}</div>
        )}
      </div>
      {error && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--negative)' }}>{error}</span>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
function AuthSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${focused ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
          borderRadius: 3, padding: '9px 12px',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          outline: 'none', width: '100%', cursor: 'pointer',
          boxShadow: focused ? '0 0 0 2px rgba(255,102,0,0.12)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}>
        <option value="" style={{ background: '#1a1a26', color: '#8888aa' }}>Select…</option>
        {options.map(o => <option key={o.value} value={o.value} style={{ background: '#1a1a26' }}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Asset tag pill ───────────────────────────────────────────────────────────
function AssetTag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'rgba(255,102,0,0.08)' : 'var(--bg-elevated)',
      border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
      borderRadius: 3, padding: '4px 10px', cursor: 'pointer',
      fontFamily: 'var(--font-mono)', fontSize: 10,
      color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function OrDivider({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--bg-border)' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--bg-border)' }} />
    </div>
  );
}

// ─── Feature item ─────────────────────────────────────────────────────────────
function FeatureItem({ color, text }: { color: string; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ width: 8, height: 8, background: color, borderRadius: 1, marginTop: 3, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

const ROLES = [
  { value: 'equity_analyst',    label: 'Equity Analyst' },
  { value: 'quant_researcher',  label: 'Quant Researcher' },
  { value: 'portfolio_manager', label: 'Portfolio Manager' },
  { value: 'risk_officer',      label: 'Risk Officer' },
  { value: 'trader',            label: 'Trader' },
  { value: 'other',             label: 'Other' },
];

const ASSET_CLASSES = ['Equities', 'Fixed Income', 'FX', 'Commodities', 'Crypto', 'Derivatives'];

// ─── SignUp page ──────────────────────────────────────────────────────────────
export function SignUpPage() {
  const { setAuthPage } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [firm,      setFirm]      = useState('');
  const [role,      setRole]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [showCfm,   setShowCfm]   = useState(false);
  const [assets,    setAssets]    = useState<string[]>([]);
  const [agreed,    setAgreed]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [emailErr,  setEmailErr]  = useState('');
  const [pwErr,     setPwErr]     = useState('');

  const toggleAsset = (a: string) =>
    setAssets(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const pwMatch = confirm.length > 0 && password === confirm;
  const pwMismatch = confirm.length > 0 && password !== confirm;

  const validate = () => {
    let ok = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailErr('Enter a valid work email'); ok = false; } else setEmailErr('');
    if (password.length < 8) { setPwErr('Minimum 8 characters'); ok = false; } else setPwErr('');
    if (pwMismatch) { setPwErr('Passwords do not match'); ok = false; }
    return ok;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true); setError(null);
    try {
      const displayName = `${firstName} ${lastName}`.trim() || email.split('@')[0];
      await createAccount(email, password, displayName, firm.trim() || undefined);
      // authService already calls setUser with token — no need to call it again
    } catch (e) {
      setError((e as Error).message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    await signInWithGoogle();
    // authService already calls setUser with token
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>

      {/* ── LEFT — Feature list ──────────────────────────────────────────────── */}
      <div className="auth-fade-up" style={{
        flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 48px',
        borderRight: '1px solid var(--bg-border)',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{
            width: 40, height: 40, flexShrink: 0,
            clipPath: 'polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
            background: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#000' }}>QD</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, lineHeight: 1 }}>
              <span style={{ color: 'var(--text-primary)' }}>Quant</span>
              <span style={{ color: 'var(--accent-primary)' }}>Desk</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.15em', marginTop: 3 }}>
              INSTITUTIONAL-GRADE QUANTITATIVE TERMINAL
            </div>
          </div>
        </div>

        {/* Headline */}
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28 }}>
          Join the terminal used by professional quants.
        </p>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 'auto' }}>
          <FeatureItem color="var(--accent-primary)" text="Real-time market data across 147 markets" />
          <FeatureItem color="var(--positive)"       text={<><span style={{ color: 'var(--positive)' }}>AES-256-GCM</span> end-to-end encrypted IB messaging</>} />
          <FeatureItem color="var(--highlight)"      text="AI-powered earnings analysis and document Q&A" />
          <FeatureItem color="var(--accent-primary)" text="Multi-asset risk management (MARS equivalent)" />
          <FeatureItem color="var(--positive)"       text="Bloomberg-style order management (TOMS)" />
        </div>

        {/* Compliance notice */}
        <div style={{
          padding: '12px 14px', background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)', borderRadius: 3, marginTop: 32,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            FOR PROFESSIONAL USE ONLY. Access to QuantDesk requires institutional verification.
            By registering, you agree to the Professional Services Agreement and Data Usage Policy.
          </p>
        </div>
      </div>

      {/* ── RIGHT — Sign up form ─────────────────────────────────────────────── */}
      <div style={{
        width: 460, flexShrink: 0, display: 'flex', flexDirection: 'column',
        padding: '32px 44px', background: 'var(--bg-secondary)', overflowY: 'auto',
      }}>

        {/* Header */}
        <div className="auth-fade-up" style={{ marginBottom: 22, animationDelay: '0.1s' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', letterSpacing: '0.15em', marginBottom: 6 }}>// NEW TERMINAL ACCESS</div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Request Access</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>Create your QuantDesk professional account</p>
        </div>

        {/* Google */}
        <div style={{ marginBottom: 18 }}>
          <GoogleAuthButton label="Sign up with Google" onAuth={handleGoogle} animDelay="0.2s" />
        </div>

        <div className="auth-fade-up" style={{ marginBottom: 18, animationDelay: '0.25s' }}>
          <OrDivider text="── OR CREATE WITH EMAIL ──" />
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.3)', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--negative)' }}>
            {error}
          </div>
        )}

        {/* Name row */}
        <div className="auth-fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, animationDelay: '0.3s' }}>
          <AuthInput label="First Name" value={firstName} onChange={setFirstName} placeholder="Jane" />
          <AuthInput label="Last Name"  value={lastName}  onChange={setLastName}  placeholder="Smith" />
        </div>

        {/* Firm + role row */}
        <div className="auth-fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, animationDelay: '0.35s' }}>
          <AuthInput label="Firm / Organization" value={firm} onChange={setFirm} placeholder="Goldman Sachs" />
          <AuthSelect label="Role / Title" value={role} onChange={setRole} options={ROLES} />
        </div>

        {/* Email */}
        <div className="auth-fade-up" style={{ marginBottom: 12, animationDelay: '0.38s' }}>
          <AuthInput label="Work Email Address" type="email" value={email} onChange={setEmail} placeholder="jane@firm.com" error={emailErr} />
        </div>

        {/* Password */}
        <div className="auth-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, animationDelay: '0.41s' }}>
          <AuthInput label="Password" type={showPw ? 'text' : 'password'} value={password} onChange={setPassword}
            placeholder="••••••••" error={pwErr}
            rightEl={
              <button onClick={() => setShowPw(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            }
          />
          <PasswordStrength password={password} />
        </div>

        {/* Confirm password */}
        <div className="auth-fade-up" style={{ marginBottom: 16, animationDelay: '0.44s' }}>
          <AuthInput label="Confirm Password" type={showCfm ? 'text' : 'password'} value={confirm} onChange={setConfirm}
            placeholder="••••••••"
            rightEl={
              confirm.length > 0 ? (
                pwMatch
                  ? <Check size={13} color="var(--positive)" />
                  : <X size={13} color="var(--negative)" />
              ) : (
                <button onClick={() => setShowCfm(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  {showCfm ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )
            }
          />
        </div>

        {/* Asset class tags */}
        <div className="auth-fade-up" style={{ marginBottom: 18, animationDelay: '0.47s' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            COVERAGE FOCUS <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ASSET_CLASSES.map(a => (
              <AssetTag key={a} label={a} active={assets.includes(a)} onClick={() => toggleAsset(a)} />
            ))}
          </div>
        </div>

        {/* Terms */}
        <div className="auth-fade-up" style={{ marginBottom: 20, animationDelay: '0.5s' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              style={{ accentColor: 'var(--accent-primary)', width: 12, height: 12, marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              I agree to the Professional Services Agreement and understand this platform is for institutional use only.
            </span>
          </label>
        </div>

        {/* CTA */}
        <div className="auth-fade-up" style={{ animationDelay: '0.53s', marginBottom: 16 }}>
          <button
            onClick={handleCreate}
            disabled={loading || !agreed}
            className="auth-cta-btn"
            style={{ width: '100%', height: 46, opacity: agreed ? 1 : 0.4, cursor: agreed ? 'pointer' : 'not-allowed' }}
          >
            {loading ? 'CREATING ACCESS…' : 'CREATE TERMINAL ACCESS →'}
          </button>
        </div>

        {/* Login link */}
        <div className="auth-fade-up" style={{ textAlign: 'center', marginBottom: 16, animationDelay: '0.56s' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            Already have access?{' '}
            <button onClick={() => setAuthPage('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', padding: 0 }}>
              Sign In
            </button>
          </span>
        </div>

        {/* Security badge */}
        <div className="auth-fade-up" style={{ animationDelay: '0.58s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 3 }}>
            <Lock size={11} color="var(--positive)" style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--positive)' }}>AES-256-GCM</span> encrypted · TLS 1.3 · Zero plaintext server storage
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
