import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Newspaper, FileText, LayoutGrid, TrendingUp, MessageSquare, Upload, X } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/research/news',      label: 'News Feed',        icon: Newspaper },
  { to: '/research/documents', label: 'Document Library', icon: FileText },
  { to: '/research/workspace', label: 'Workspaces',       icon: LayoutGrid },
  { to: '/research/earnings',  label: 'Earnings',         icon: TrendingUp },
  { to: '/research/askb',      label: 'ASKB Assistant',   icon: MessageSquare },
];

export default function ResearchLayout() {
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState('');

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMsg('');
    try {
      // Simulate upload — actual upload would POST to /api/documents/upload
      await new Promise(r => setTimeout(r, 800));
      setUploadMsg(`Uploaded ${files.length} file(s). Processing…`);
      setTimeout(() => {
        setUploadOpen(false);
        setUploadMsg('');
        navigate('/research/documents');
      }, 1500);
    } catch {
      setUploadMsg('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-mono)' }}>

      {/* Sub-nav */}
      <div style={{
        width: 180,
        borderRight: '1px solid var(--bg-border)',
        padding: '12px 0',
        flexShrink: 0,
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '4px 14px 10px',
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
        }}>
          RESEARCH
        </div>

        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              fontSize: 11,
              textDecoration: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              background: isActive ? 'rgba(255,102,0,0.08)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-primary, #ff6600)' : '2px solid transparent',
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.1s',
            })}
          >
            <Icon size={12} />
            {label}
          </NavLink>
        ))}

        <div style={{
          padding: '12px 14px 4px',
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          marginTop: 8,
          borderTop: '1px solid var(--bg-border)',
        }}>
          UPLOAD
        </div>

        <button
          onClick={() => setUploadOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            fontFamily: 'var(--font-mono)',
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Upload size={12} /> Upload Document
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--bg-border)',
            borderRadius: 4,
            padding: 24,
            width: 440,
            fontFamily: 'var(--font-mono)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Upload Document</span>
              <button onClick={() => setUploadOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); void handleUpload(e.dataTransfer.files); }}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent-primary, #ff6600)' : 'var(--bg-border)'}`,
                borderRadius: 4,
                padding: 32,
                textAlign: 'center',
                marginBottom: 16,
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Drag & drop PDF, DOCX, or TXT here
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12 }}>
                or click to browse
              </div>
              <label style={{ cursor: 'pointer' }}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.doc"
                  style={{ display: 'none' }}
                  onChange={e => void handleUpload(e.target.files)}
                />
                <span style={{
                  padding: '6px 16px',
                  background: 'var(--accent-primary, #ff6600)',
                  color: '#000',
                  borderRadius: 2,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}>
                  Browse Files
                </span>
              </label>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12 }}>
              Supported: Earnings transcripts, 10-K/10-Q filings, research reports, PDFs
            </div>

            {uploadMsg && (
              <div style={{
                fontSize: 11,
                color: uploadMsg.includes('failed') ? 'var(--negative)' : 'var(--positive)',
                padding: '6px 10px',
                background: uploadMsg.includes('failed') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${uploadMsg.includes('failed') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                borderRadius: 2,
              }}>
                {uploading ? '⏳ ' : '✓ '}{uploadMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
