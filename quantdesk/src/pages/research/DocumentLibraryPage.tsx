import { useState, useEffect, useCallback } from 'react';
import { FileText, Search, RefreshCw, Eye, LayoutGrid } from 'lucide-react';
import { fetchDocuments, type DocumentMeta } from '../../services/api/researchApi';

function openDocument(_docId: string) {
  // In the tab-based shell, switching to the 'documents' viewer tab with a document open
  // is handled by the DocumentViewerPage's own document picker.
  // Emit a custom event so ResearchModule can switch to the documents tab.
  window.dispatchEvent(new CustomEvent('research:open-tab', { detail: { tab: 'documents' } }));
}

const DOC_TYPE_COLORS: Record<string, string> = {
  transcript:  '#4488ff',
  '10-k':      '#ff6600',
  '10-q':      '#f59e0b',
  'research':  '#22c55e',
  'report':    '#22c55e',
  'pdf':       '#a855f7',
};

export default function DocumentLibraryPage() {
  const [docs, setDocs]       = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchDocuments();
      setDocs(d.documents);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const docTypes = ['all', ...Array.from(new Set(docs.map(d => d.doc_type))).sort()];

  const filtered = docs.filter(d => {
    const matchesFilter = filter === 'all' || d.doc_type === filter;
    const matchesSearch = !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.ticker ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.company ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-mono)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Document Library</h1>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
            {docs.length} document{docs.length !== 1 ? 's' : ''} · Earnings transcripts, filings, research reports
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={10} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents…"
              style={{
                paddingLeft: 24, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
                background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)', fontSize: 11, borderRadius: 2, width: 180,
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>
          <button
            onClick={() => void load()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'none', border: '1px solid var(--bg-border)', color: 'var(--text-muted)', borderRadius: 2, fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            <RefreshCw size={10} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('research:open-tab', { detail: { tab: 'workspace' } }))}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', color: 'var(--text-muted)', borderRadius: 2, fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            <LayoutGrid size={10} /> Compare in Workspace
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 16px', borderBottom: '1px solid var(--bg-border)', overflowX: 'auto', flexShrink: 0 }}>
        {docTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: '3px 10px', fontSize: 10, fontWeight: 700, borderRadius: 2, border: 'none',
              background: filter === type ? 'var(--accent-primary, #ff6600)' : 'var(--bg-secondary)',
              color: filter === type ? '#000' : 'var(--text-muted)',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          [1,2,3,4,5].map(i => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', opacity: 0.4 }}>
              <div style={{ height: 12, background: 'var(--bg-secondary)', borderRadius: 2, marginBottom: 6, width: '60%' }} />
              <div style={{ height: 9, background: 'var(--bg-secondary)', borderRadius: 2, width: '40%' }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12, color: 'var(--text-muted)' }}>
            <FileText size={28} />
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              {docs.length === 0 ? 'No Documents Yet' : 'No Results Found'}
            </div>
            <div style={{ fontSize: 10, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>
              {docs.length === 0
                ? 'Upload documents via the sidebar to get started.'
                : 'Try a different search or filter.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--bg-border)', position: 'sticky', top: 0 }}>
                {['Document', 'Type', 'Ticker', 'Date', 'Source', 'Pages', 'Summary', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => {
                const typeColor = DOC_TYPE_COLORS[doc.doc_type] ?? 'var(--text-muted)';
                return (
                  <tr
                    key={doc.id}
                    style={{ borderBottom: '1px solid var(--bg-border)', cursor: 'pointer' }}
                    onClick={() => openDocument(doc.id)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-primary)', maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.title}>{doc.title}</div>
                      {doc.company && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{doc.company}</div>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: typeColor, background: `${typeColor}15`, padding: '2px 6px', borderRadius: 2, whiteSpace: 'nowrap' }}>
                        {doc.doc_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 10, color: 'var(--accent-primary)', fontWeight: 700 }}>
                      {doc.ticker ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {doc.filing_date ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text-muted)' }}>
                      {doc.source}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text-muted)' }}>
                      {doc.page_count ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {doc.has_summary ? (
                        <span style={{ fontSize: 9, color: 'var(--positive)', fontWeight: 700 }}>✓ Ready</span>
                      ) : (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); window.location.href = `/research/documents/${doc.id}`; }}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', color: 'var(--text-muted)', borderRadius: 2, fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}
                      >
                        <Eye size={9} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
