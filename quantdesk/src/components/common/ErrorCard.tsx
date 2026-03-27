import { AlertTriangle, RefreshCw, Clipboard } from 'lucide-react';

interface ErrorCardProps {
  message: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorCard({ message, code = 'ERROR', onRetry }: ErrorCardProps) {
  const copyDetails = () => {
    void navigator.clipboard.writeText(`${code}: ${message}\n${new Date().toISOString()}`);
  };

  return (
    <div style={{
      background: 'rgba(255,61,61,0.06)',
      border: '1px solid rgba(255,61,61,0.25)',
      borderLeft: '3px solid #ff3d3d',
      borderRadius: 3,
      padding: '12px 16px',
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <AlertTriangle size={12} color="#ff3d3d" />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#ff3d3d', letterSpacing: '0.1em' }}>
          ERROR › {code}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
        {message}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-mono)',
              background: 'rgba(255,61,61,0.12)', border: '1px solid rgba(255,61,61,0.3)',
              borderRadius: 2, color: '#ff3d3d', cursor: 'pointer',
            }}
          >
            <RefreshCw size={9} /> RETRY
          </button>
        )}
        <button
          onClick={copyDetails}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-mono)',
            background: 'transparent', border: '1px solid var(--bg-border)',
            borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          <Clipboard size={9} /> COPY
        </button>
      </div>
    </div>
  );
}
