import { useState, useEffect } from 'react';
import { Building2, Users, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { fetchAdminOrg, updateAdminOrg, type AdminOrg } from '../../services/api/adminApi';
import { useAdminAuthStore } from '../../stores/adminAuthStore';

export default function OrgSettingsPage() {
  const { adminUser } = useAdminAuthStore();
  const isSuperAdmin = adminUser?.orgRole === 'super_admin';

  const [org, setOrg]     = useState<AdminOrg | null>(null);
  const [stats, setStats] = useState<{ member_count: string; admin_count: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [name, setName]           = useState('');
  const [displayName, setDisplayName] = useState('');
  const [domain, setDomain]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    fetchAdminOrg()
      .then(d => {
        setOrg(d.org); setStats(d.stats);
        setName(d.org.name); setDisplayName(d.org.display_name); setDomain(d.org.domain ?? '');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      await updateAdminOrg({ name, displayName, domain });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const PLAN_COLOR: Record<string, string> = {
    standard: 'var(--text-muted)', professional: 'var(--accent-primary)', enterprise: '#f59e0b',
  };

  return (
    <div style={{ padding: 28, maxWidth: 700, fontFamily: 'var(--font-mono)' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: 'var(--accent-primary)', letterSpacing: '0.15em', marginBottom: 6 }}>// SETTINGS</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Organisation Settings</h1>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Manage your organisation profile and configuration.</p>
      </div>

      {loading ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <>
          {/* Stats row */}
          {stats && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {[
                { icon: <Users size={16} />, label: 'TOTAL MEMBERS', value: stats.member_count },
                { icon: <Shield size={16} />, label: 'ADMINS', value: stats.admin_count },
                { icon: <Building2 size={16} />, label: 'PLAN', value: org?.plan?.toUpperCase() ?? '—', color: PLAN_COLOR[org?.plan ?? ''] },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '14px 16px' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color ?? 'var(--text-primary)' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Settings form */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 4, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, letterSpacing: '0.05em' }}>
              ORGANISATION PROFILE
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.3)', borderRadius: 3, marginBottom: 14, fontSize: 11, color: 'var(--negative)' }}>
                <AlertTriangle size={12} /> {error}
              </div>
            )}
            {saved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 3, marginBottom: 14, fontSize: 11, color: 'var(--positive)' }}>
                <CheckCircle size={12} /> Settings saved successfully.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'ORGANISATION NAME', value: name, setter: setName, placeholder: 'e.g. Suraksha Investment' },
                { label: 'DISPLAY NAME', value: displayName, setter: setDisplayName, placeholder: 'e.g. Suraksha Investment Firm' },
                { label: 'DOMAIN (optional)', value: domain, setter: setDomain, placeholder: 'e.g. suraksha.com' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                    disabled={!isSuperAdmin}
                    style={{ width: '100%', background: isSuperAdmin ? 'var(--bg-secondary)' : 'var(--bg-border)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', opacity: isSuperAdmin ? 1 : 0.6, cursor: isSuperAdmin ? 'text' : 'not-allowed' }} />
                </div>
              ))}

              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>SLUG (read-only)</label>
                <input value={org?.slug ?? ''} readOnly
                  style={{ width: '100%', background: 'var(--bg-border)', border: '1px solid var(--bg-border)', borderRadius: 3, padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', outline: 'none', boxSizing: 'border-box', cursor: 'not-allowed' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                {!isSuperAdmin && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Only super admins can edit these settings.</span>
                )}
                <div style={{ flex: 1 }} />
                {isSuperAdmin && (
                  <button onClick={handleSave} disabled={saving}
                    style={{ padding: '10px 20px', background: saving ? 'var(--bg-border)' : 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
                    {saving ? 'SAVING…' : 'SAVE CHANGES →'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Created info */}
          {org && (
            <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
              Organisation created {new Date(org.created_at).toLocaleDateString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
