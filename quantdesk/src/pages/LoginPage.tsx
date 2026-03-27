import { useState, useMemo } from 'react';
import { Lock } from 'lucide-react';
import { GoogleAuthButton } from '../components/auth/GoogleAuthButton';
import { signInWithGoogle, signInWithEmail } from '../services/auth/authService';
import { useAuthStore } from '../stores/authStore';

// ─── Deterministic ghost candlestick chart ────────────────────────────────────
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 0xffffffff;
  };
}

function GhostCandleChart() {
  const candles = useMemo(() => {
    const rng = seededRng(42);
    let price = 210;
    return Array.from({ length: 34 }, () => {
      price += (rng() - 0.48) * 6;
      const open  = price + (rng() - 0.5) * 4;
      const close = price + (rng() - 0.5) * 4;
      const high  = Math.max(open, close) + rng() * 5;
      const low   = Math.min(open, close) - rng() * 5;
      return { open, close, high, low, isUp: close >= open };
    });
  }, []);

  const W = 700; const H = 130;
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...prices); const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const toY   = (p: number) => H - ((p - minP) / range) * H;
  const slot  = W / candles.length;
  const bw    = slot * 0.55;

  return (
    <svg width="100%" height={H} viewBox={`0 ${0} ${W} ${H}`} preserveAspectRatio="none"
      style={{ opacity: 0.13, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      {candles.map((c, i) => {
        const cx = i * slot + slot / 2;
        const col = c.isUp ? '#00d4aa' : '#ff3d3d';
        const top = Math.min(toY(c.open), toY(c.close));
        const bh  = Math.max(Math.abs(toY(c.open) - toY(c.close)), 1);
        return (
          <g key={i}>
            <line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)} stroke={col} strokeWidth={1} />
            <rect x={cx - bw / 2} y={top} width={bw} height={bh} fill={col} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, change, changeColor, delay }: { label: string; value: string; change: string; changeColor: string; delay: string }) {
  return (
    <div className="auth-fade-up" style={{
      animationDelay: delay,
      background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
      borderRadius: 3, padding: '10px 14px', flex: 1,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: changeColor, marginTop: 3 }}>{change}</div>
    </div>
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

// ─── Input field ──────────────────────────────────────────────────────────────
function AuthInput({ label, type, value, onChange, placeholder, error }: {
  label: string; type: string; value: string;
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
          outline: 'none', width: '100%',
          boxShadow: focused ? (error ? '0 0 0 2px rgba(255,61,61,0.15)' : '0 0 0 2px rgba(255,102,0,0.12)') : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      />
      {error && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--negative)' }}>{error}</span>}
    </div>
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────
export function LoginPage() {
  const { setAuthPage } = useAuthStore();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState('');

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleEmailLogin = async () => {
    let valid = true;
    if (!validateEmail(email)) { setEmailErr('Enter a valid email address'); valid = false; }
    else setEmailErr('');
    if (!valid) return;

    setLoading(true); setError(null);
    try {
      await signInWithEmail(email, password);
      // authService already calls setUser with the token — no need to call it again
    } catch (e) {
      setError((e as Error).message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    await signInWithGoogle();
    // authService already calls setUser with the token
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>

      {/* ── LEFT — Branding ─────────────────────────────────────────────────── */}
      <div className="auth-fade-up" style={{
        flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 48px',
        borderRight: '1px solid var(--bg-border)', position: 'relative', overflow: 'hidden',
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

        {/* Headline copy */}
        <div style={{ marginBottom: 32 }}>
          {[
            <>Market intelligence for <span style={{ color: 'var(--accent-primary)' }}>professionals</span> who move first.</>,
            <>Real-time data. <span style={{ color: 'var(--accent-primary)' }}>AES-256</span> encrypted messaging.</>,
            <><span style={{ color: 'var(--accent-primary)' }}>AI-powered</span> research. Institutional-grade execution.</>,
          ].map((line, i) => (
            <p key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{line}</p>
          ))}
        </div>

        {/* Stat cards */}
        <div className="auth-fade-up" style={{ display: 'flex', gap: 10, marginBottom: 'auto', animationDelay: '0.2s' }}>
          <StatCard label="ACTIVE USERS"     value="4,821"  change="+12 today"    changeColor="var(--positive)"  delay="0.25s" />
          <StatCard label="MARKETS COVERED"  value="147"    change="6 asset classes" changeColor="var(--text-muted)" delay="0.30s" />
          <StatCard label="UPTIME"           value="99.97%" change="30-day avg"    changeColor="var(--positive)"  delay="0.35s" />
        </div>

        {/* Ghost candlestick chart */}
        <GhostCandleChart />
      </div>

      {/* ── RIGHT — Auth form ────────────────────────────────────────────────── */}
      <div style={{
        width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '40px 44px',
        background: 'var(--bg-secondary)', overflowY: 'auto',
      }}>

        {/* Header */}
        <div className="auth-fade-up" style={{ marginBottom: 28, animationDelay: '0.1s' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-primary)', letterSpacing: '0.15em', marginBottom: 8 }}>// TERMINAL ACCESS</div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Welcome Back</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>Sign in to your QuantDesk account</p>
        </div>

        {/* Google button */}
        <div style={{ marginBottom: 20 }}>
          <GoogleAuthButton onAuth={handleGoogle} animDelay="0.2s" />
        </div>

        <div className="auth-fade-up" style={{ marginBottom: 20, animationDelay: '0.25s' }}>
          <OrDivider text="── OR SIGN IN WITH EMAIL ──" />
        </div>

        {/* Global error */}
        {error && (
          <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.3)', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--negative)' }}>
            {error}
          </div>
        )}

        {/* Email + password */}
        <div className="auth-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16, animationDelay: '0.3s' }}>
          <AuthInput label="Email Address" type="email" value={email} onChange={setEmail} placeholder="trader@firm.com" error={emailErr} />
          <AuthInput label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
        </div>

        {/* Remember + forgot */}
        <div className="auth-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, animationDelay: '0.35s' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              style={{ accentColor: 'var(--accent-primary)', width: 12, height: 12 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>Remember terminal session</span>
          </label>
          <button onClick={() => {}} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', padding: 0 }}>
            Forgot credentials?
          </button>
        </div>

        {/* Sign in CTA */}
        <div className="auth-fade-up" style={{ animationDelay: '0.4s' }}>
          <button
            onClick={handleEmailLogin}
            disabled={loading}
            className="auth-cta-btn"
            style={{ width: '100%', height: 46, marginBottom: 18 }}
          >
            {loading ? 'AUTHENTICATING…' : 'AUTHENTICATE →'}
          </button>
        </div>

        {/* Sign up link */}
        <div className="auth-fade-up" style={{ textAlign: 'center', marginBottom: 24, animationDelay: '0.45s' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            New to QuantDesk?{' '}
            <button onClick={() => setAuthPage('signup')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)', padding: 0 }}>
              Request Access
            </button>
          </span>
        </div>

        {/* Security badge */}
        <div className="auth-fade-up" style={{ animationDelay: '0.5s' }}>
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
