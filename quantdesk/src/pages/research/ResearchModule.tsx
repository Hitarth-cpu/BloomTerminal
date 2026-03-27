import { useState, useRef, useEffect } from 'react';
import {
  Newspaper, FileText, LayoutGrid, MessageSquare, TrendingUp, Upload, X,
} from 'lucide-react';
import { NewsFeedPage } from './NewsFeedPage';
import { AskbPage } from './AskbPage';

import { DocumentWorkspacePage } from './DocumentWorkspacePage';
import DocumentLibraryPage from './DocumentLibraryPage';
import EarningsPage from './EarningsPage';
import { useAuthStore } from '../../stores/authStore';

type TabId = 'news' | 'documents' | 'workspace' | 'askb' | 'earnings';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'news',      label: 'NEWS FEED',  icon: <Newspaper size={14} /> },
  { id: 'documents', label: 'DOCUMENTS',  icon: <FileText size={14} /> },
  { id: 'workspace', label: 'WORKSPACE',  icon: <LayoutGrid size={14} /> },
  { id: 'askb',      label: 'ASKB',       icon: <MessageSquare size={14} /> },
  { id: 'earnings',  label: 'EARNINGS',   icon: <TrendingUp size={14} /> },
];



interface UploadModalProps {
  onClose: () => void;
}

function UploadModal({ onClose }: UploadModalProps) {
  const { apiToken } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const getDocType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || ext === 'docx' || ext === 'txt') return 'general';
    return 'general';
  };

  const uploadFile = async (file: File) => {
    setStatus('uploading');
    setStatusMessage(`Uploading ${file.name}...`);

    const title = file.name.replace(/\.[^/.]+$/, '');
    const docType = getDocType(file.name);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('docType', docType);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      setStatus('success');
      setStatusMessage(`"${title}" uploaded successfully.`);
    } catch (err: unknown) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
          width: 440, padding: 24, fontFamily: 'var(--font-mono)', position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>UPLOAD DOCUMENT</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Drag-and-drop area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragOver ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
            background: isDragOver ? 'var(--bg-tertiary, var(--bg-primary))' : 'var(--bg-primary)',
            borderRadius: 4,
            padding: '32px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            marginBottom: 16,
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={28} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: 10 }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Drag and drop a file here
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
            Supported: .pdf, .docx, .txt
          </div>
        </div>

        {/* Browse button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%', padding: '8px 0', background: 'var(--bg-border)',
            border: '1px solid var(--bg-border)', color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          BROWSE FILES
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Status */}
        {status !== 'idle' && (
          <div
            style={{
              fontSize: 10, padding: '8px 10px',
              background: status === 'success' ? 'rgba(0,200,100,0.08)' : status === 'error' ? 'rgba(255,80,80,0.08)' : 'var(--bg-primary)',
              border: `1px solid ${status === 'success' ? 'var(--accent-green, #00c864)' : status === 'error' ? 'var(--accent-red, #ff5050)' : 'var(--bg-border)'}`,
              color: status === 'success' ? 'var(--accent-green, #00c864)' : status === 'error' ? 'var(--accent-red, #ff5050)' : 'var(--text-muted)',
            }}
          >
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export function ResearchModule() {
  const [activeTab, setActiveTab] = useState<TabId>('news');
  const [uploadOpen, setUploadOpen] = useState(false);

  // Listen for tab-switch events from child components
  useEffect(() => {
    const askbHandler = () => setActiveTab('askb');
    const tabHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab: TabId }>).detail;
      if (detail?.tab) setActiveTab(detail.tab);
    };
    window.addEventListener('research:open-askb', askbHandler);
    window.addEventListener('research:open-tab', tabHandler);
    return () => {
      window.removeEventListener('research:open-askb', askbHandler);
      window.removeEventListener('research:open-tab', tabHandler);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'news':      return <NewsFeedPage />;
      case 'documents': return <DocumentLibraryPage />;
      case 'workspace': return <DocumentWorkspacePage />;
      case 'askb':      return <AskbPage />;
      case 'earnings':  return <EarningsPage />;
      default:          return <NewsFeedPage />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 160, flexShrink: 0, height: '100%',
          background: 'var(--bg-secondary)', borderRight: '1px solid var(--bg-border)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Title */}
        <div
          style={{
            padding: '14px 14px 10px',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)',
            borderBottom: '1px solid var(--bg-border)',
            flexShrink: 0,
          }}
        >
          RESEARCH
        </div>

        {/* Tab list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px',
                  background: isActive ? 'var(--bg-tertiary, rgba(255,255,255,0.04))' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                  letterSpacing: '0.06em',
                  textAlign: 'left',
                  transition: 'background 0.1s, color 0.1s',
                }}
              >
                <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Upload section */}
        <div
          style={{
            padding: '10px 14px 14px',
            borderTop: '1px solid var(--bg-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 8 }}>
            UPLOAD
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '7px 0',
              background: 'var(--bg-primary)', border: '1px solid var(--bg-border)',
              cursor: 'pointer', color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              transition: 'border-color 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-primary)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bg-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            <Upload size={13} />
            UPLOAD FILE
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
        {renderContent()}
      </div>

      {/* Upload modal */}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} />}
    </div>
  );
}
