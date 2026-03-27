import { useState, useEffect, useCallback } from 'react';
import { Plus, Play, RefreshCw, X, Check, Loader, LayoutGrid } from 'lucide-react';
import {
  fetchWorkspaces, createWorkspace, updateWorkspace, compareDocuments,
  fetchDocuments,
  type Workspace, type ComparisonTable, type DocumentMeta,
} from '../../services/api/researchApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';

// ─── Sentiment cell styling ───────────────────────────────────────────────────
function sentimentBg(sentiment: 'positive' | 'negative' | 'neutral'): string {
  if (sentiment === 'positive') return 'rgba(34,197,94,0.07)';
  if (sentiment === 'negative') return 'rgba(239,68,68,0.07)';
  return 'transparent';
}
function sentimentBorderColor(sentiment: 'positive' | 'negative' | 'neutral'): string {
  if (sentiment === 'positive') return 'rgba(34,197,94,0.2)';
  if (sentiment === 'negative') return 'rgba(239,68,68,0.2)';
  return 'var(--bg-border)';
}

// ─── Comparison table renderer ────────────────────────────────────────────────
function ComparisonTableView({ table }: { table: ComparisonTable }) {
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  return (
    <div>
      {/* Question label */}
      <div style={{
        padding: '8px 12px', borderRadius: 4, marginBottom: 16,
        background: 'rgba(255,102,0,0.08)', border: '1px solid rgba(255,102,0,0.25)',
        fontSize: 11, color: 'var(--text-primary)', fontStyle: 'italic',
      }}>
        Q: {table.question}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 12px', textAlign: 'left',
                borderBottom: '1px solid var(--bg-border)',
                fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1,
                background: 'var(--bg-secondary)', minWidth: 120,
              }}>
                TOPIC
              </th>
              {table.columns.map(col => (
                <th key={col} style={{
                  padding: '8px 12px', textAlign: 'left',
                  borderBottom: '1px solid var(--bg-border)',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-primary)',
                  background: 'var(--bg-secondary)', minWidth: 180, maxWidth: 260,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                <td style={{
                  padding: '8px 12px', verticalAlign: 'top',
                  borderBottom: '1px solid var(--bg-border)',
                  borderRight: '1px solid var(--bg-border)',
                  fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)',
                  background: 'var(--bg-secondary)', whiteSpace: 'nowrap',
                }}>
                  {row.topic}
                </td>
                {table.columns.map(col => {
                  const cell = row.values[col];
                  const cellKey = `${ri}-${col}`;
                  const isExpanded = expandedCell === cellKey;
                  if (!cell) {
                    return (
                      <td key={col} style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--bg-border)',
                        borderRight: '1px solid var(--bg-border)',
                        color: 'var(--text-muted)', fontSize: 10,
                      }}>—</td>
                    );
                  }
                  return (
                    <td key={col} style={{
                      padding: '8px 12px', verticalAlign: 'top',
                      borderBottom: '1px solid var(--bg-border)',
                      borderRight: '1px solid var(--bg-border)',
                      background: sentimentBg(cell.sentiment),
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {cell.content}
                      </div>
                      {cell.sourceQuote && (
                        <>
                          <button
                            onClick={() => setExpandedCell(isExpanded ? null : cellKey)}
                            style={{
                              marginTop: 4, fontSize: 9, color: 'var(--text-muted)',
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: '2px 0', fontFamily: 'var(--font-mono)',
                              textDecoration: 'underline dotted',
                            }}
                          >
                            {isExpanded ? 'Hide source' : 'View source'}
                          </button>
                          {isExpanded && (
                            <div style={{
                              marginTop: 5, padding: '5px 8px', borderRadius: 3,
                              background: 'rgba(59,130,246,0.06)',
                              border: `1px solid ${sentimentBorderColor(cell.sentiment)}`,
                              fontSize: 10, color: 'var(--text-secondary)',
                              fontStyle: 'italic', lineHeight: 1.5,
                            }}>
                              "{cell.sourceQuote}"
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary + winner */}
      {(table.summary || table.winner) && (
        <div style={{
          padding: '12px 14px', borderRadius: 4,
          background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)',
        }}>
          {table.winner && (
            <div style={{ marginBottom: table.summary ? 8 : 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>WINNER</span>
              <span style={{
                padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                color: 'var(--positive, #22c55e)', fontFamily: 'var(--font-mono)',
              }}>
                {table.winner}
              </span>
            </div>
          )}
          {table.summary && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {table.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Doc picker modal ─────────────────────────────────────────────────────────
function DocPickerModal({
  allDocs,
  selectedIds,
  onClose,
  onSave,
}: {
  allDocs: DocumentMeta[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Array.from(checked));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 480, maxHeight: '70vh',
        background: 'var(--bg-primary)', border: '1px solid var(--bg-border)',
        borderRadius: 6, display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
            ADD DOCUMENTS TO WORKSPACE
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
            <X size={14} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {allDocs.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <div>Loading documents...</div>
            </div>
          ) : allDocs.map(doc => {
            const isChecked = checked.has(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => toggle(doc.id)}
                style={{
                  padding: '9px 14px', cursor: 'pointer',
                  borderBottom: '1px solid var(--bg-border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: isChecked ? 'rgba(255,102,0,0.06)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { if (!isChecked) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                  border: `1px solid ${isChecked ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                  background: isChecked ? 'var(--accent-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isChecked && <Check size={10} color="white" strokeWidth={3} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.title}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                    {doc.doc_type.toUpperCase()}{doc.ticker ? ` · ${doc.ticker}` : ''}
                    {doc.filing_date ? ` · ${doc.filing_date.slice(0, 10)}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 14px', borderTop: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {checked.size} document{checked.size !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 10 }}>CANCEL</button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {saving
                ? <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} />
                : <Check size={10} />}
              SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DocumentWorkspacePage() {
  const {
    workspaces, activeWorkspaceId,
    setWorkspaces, setActiveWorkspace,
    isGenerating, setGenerating,
    promptHistory, addPrompt,
    updateWorkspaceTable,
  } = useWorkspaceStore();

  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);

  const [allDocs, setAllDocs] = useState<DocumentMeta[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);

  const [promptInput, setPromptInput] = useState('');
  const [compareError, setCompareError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonTable | null>(null);

  const [showDocPicker, setShowDocPicker] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  // Load workspaces on mount
  useEffect(() => {
    setWorkspacesLoading(true);
    setWorkspacesError(null);
    fetchWorkspaces()
      .then(d => setWorkspaces(d.workspaces))
      .catch(e => setWorkspacesError(String(e)))
      .finally(() => setWorkspacesLoading(false));
  }, [setWorkspaces]);

  // Load docs when picker opens
  useEffect(() => {
    if (!showDocPicker || docsLoaded) return;
    fetchDocuments().then(d => {
      setAllDocs(d.documents);
      setDocsLoaded(true);
    });
  }, [showDocPicker, docsLoaded]);

  const activeWorkspace: Workspace | null = workspaces.find(w => w.id === activeWorkspaceId) ?? null;

  // Reset comparison state when workspace changes
  useEffect(() => {
    setComparisonResult(activeWorkspace?.table_data ?? null);
    setCompareError(null);
    setPromptInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  const reloadWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true);
    try {
      const d = await fetchWorkspaces();
      setWorkspaces(d.workspaces);
    } catch (e) {
      setWorkspacesError(String(e));
    } finally {
      setWorkspacesLoading(false);
    }
  }, [setWorkspaces]);

  const handleCreateWorkspace = useCallback(async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    try {
      const { id } = await createWorkspace(name);
      const d = await fetchWorkspaces();
      setWorkspaces(d.workspaces);
      setActiveWorkspace(id);
    } catch {
      // silently fail - user can retry
    } finally {
      setNewWorkspaceName('');
      setCreatingWorkspace(false);
    }
  }, [newWorkspaceName, setWorkspaces, setActiveWorkspace]);

  const handleAnalyze = useCallback(async () => {
    if (!activeWorkspace || !promptInput.trim() || isGenerating) return;
    const prompt = promptInput.trim();
    setCompareError(null);
    setGenerating(true);
    addPrompt(prompt);
    try {
      const result = await compareDocuments(activeWorkspace.id, prompt, activeWorkspace.document_ids);
      setComparisonResult(result);
      updateWorkspaceTable(activeWorkspace.id, result);
    } catch (e) {
      setCompareError(String(e));
    } finally {
      setGenerating(false);
    }
  }, [activeWorkspace, promptInput, isGenerating, setGenerating, addPrompt, updateWorkspaceTable]);

  const handleSaveDocs = useCallback(async (ids: string[]) => {
    if (!activeWorkspace) return;
    await updateWorkspace(activeWorkspace.id, { documentIds: ids });
    await reloadWorkspaces();
  }, [activeWorkspace, reloadWorkspaces]);

  const activeDocCount = activeWorkspace?.document_ids.length ?? 0;

  const panelHeaderStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--bg-border)',
    display: 'flex', alignItems: 'center', gap: 8,
    flexShrink: 0,
    background: 'var(--bg-secondary)',
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)', fontFamily: 'var(--font-mono)' }}>

      {/* ── LEFT SIDEBAR: Workspaces ─────────────────────────────────────── */}
      <div style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid var(--bg-border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-primary)',
      }}>
        {/* Header */}
        <div style={{ ...panelHeaderStyle, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LayoutGrid size={12} color="var(--accent-primary)" />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1 }}>WORKSPACES</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              title="Refresh"
              onClick={reloadWorkspaces}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
            >
              <RefreshCw size={11} />
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setCreatingWorkspace(true)}
              style={{ fontSize: 9, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <Plus size={9} /> NEW
            </button>
          </div>
        </div>

        {/* New workspace inline form */}
        {creatingWorkspace && (
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-secondary)' }}>
            <input
              className="terminal-input"
              autoFocus
              value={newWorkspaceName}
              onChange={e => setNewWorkspaceName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateWorkspace();
                if (e.key === 'Escape') { setCreatingWorkspace(false); setNewWorkspaceName(''); }
              }}
              placeholder="Workspace name..."
              style={{ width: '100%', fontSize: 10, marginBottom: 5, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-primary" onClick={handleCreateWorkspace} style={{ fontSize: 9, flex: 1 }}>CREATE</button>
              <button
                className="btn btn-secondary"
                onClick={() => { setCreatingWorkspace(false); setNewWorkspaceName(''); }}
                style={{ fontSize: 9 }}
              >
                <X size={9} />
              </button>
            </div>
          </div>
        )}

        {/* Workspace list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {workspacesLoading ? (
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{
                  height: 32, borderRadius: 3,
                  background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%)',
                  backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
                }} />
              ))}
            </div>
          ) : workspacesError ? (
            <div style={{ padding: 10, color: 'var(--negative)', fontSize: 10 }}>{workspacesError}</div>
          ) : workspaces.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>
              No workspaces. Create one to get started.
            </div>
          ) : workspaces.map(ws => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <div
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                style={{
                  padding: '8px 12px', cursor: 'pointer',
                  borderBottom: '1px solid var(--bg-border)',
                  borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  background: isActive ? 'rgba(255,102,0,0.07)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{
                  fontSize: 11,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ws.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                  {ws.document_ids.length} doc{ws.document_ids.length !== 1 ? 's' : ''}
                  {ws.table_data ? ' · analyzed' : ''}
                </div>
              </div>
            );
          })}
        </div>

        {/* Documents in active workspace */}
        {activeWorkspace && (
          <>
            <div style={{
              padding: '5px 12px',
              borderTop: '1px solid var(--bg-border)',
              borderBottom: '1px solid var(--bg-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-secondary)',
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>
                DOCUMENTS ({activeDocCount})
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDocPicker(true)}
                style={{ fontSize: 8, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <Plus size={8} /> ADD DOCS
              </button>
            </div>
            <div style={{ maxHeight: 130, overflowY: 'auto' }}>
              {activeDocCount === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No documents added yet
                </div>
              ) : activeWorkspace.document_ids.map((docId, i) => (
                <div key={docId} style={{
                  padding: '4px 12px', fontSize: 9, color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--bg-border)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 5 }}>{i + 1}.</span>
                  {docId}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── MAIN AREA: Comparison ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <div style={{ ...panelHeaderStyle, background: 'var(--bg-primary)', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutGrid size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1 }}>
              {activeWorkspace ? activeWorkspace.name.toUpperCase() : 'COMPARISON WORKSPACE'}
            </span>
          </div>
          {activeWorkspace && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              {activeDocCount} document{activeDocCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!activeWorkspace ? (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <LayoutGrid size={40} strokeWidth={1} style={{ marginBottom: 14, opacity: 0.3 }} />
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Create or select a workspace</div>
            <div style={{ fontSize: 11 }}>Use the sidebar to create a new workspace or select an existing one</div>
          </div>
        ) : (
          <>
            {/* Prompt bar */}
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--bg-border)',
              background: 'var(--bg-primary)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  className="terminal-input"
                  value={promptInput}
                  onChange={e => setPromptInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnalyze(); } }}
                  placeholder={
                    activeDocCount < 2
                      ? 'Add at least 2 documents to compare...'
                      : 'Enter a comparison prompt, e.g. "Compare revenue growth and margins across documents"'
                  }
                  disabled={isGenerating || activeDocCount < 2}
                  rows={2}
                  style={{ flex: 1, resize: 'none', fontSize: 11, boxSizing: 'border-box' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAnalyze}
                  disabled={isGenerating || !promptInput.trim() || activeDocCount < 2}
                  style={{
                    fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
                    alignSelf: 'stretch', padding: '0 14px',
                  }}
                >
                  {isGenerating
                    ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Play size={12} />}
                  ANALYZE
                </button>
              </div>
              {activeDocCount < 2 && (
                <div style={{
                  marginTop: 6, padding: '4px 8px', borderRadius: 3, fontSize: 10,
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  color: '#f59e0b',
                }}>
                  Add at least 2 documents to the workspace to run a comparison.
                </div>
              )}
            </div>

            {/* Prompt history */}
            {promptHistory.length > 0 && (
              <div style={{
                padding: '5px 14px', borderBottom: '1px solid var(--bg-border)',
                background: 'var(--bg-secondary)',
                display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0, alignItems: 'center',
              }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>
                  RECENT:
                </span>
                {promptHistory.slice(0, 6).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPromptInput(p)}
                    style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: 3, flexShrink: 0,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)',
                      color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={p}
                  >
                    {p.length > 45 ? p.slice(0, 45) + '…' : p}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {isGenerating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: 'var(--text-muted)' }}>
                  <Loader size={28} style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Generating AI comparison…</div>
                  <div style={{ fontSize: 10 }}>Analyzing {activeDocCount} documents across topics</div>
                </div>
              ) : compareError ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 4,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  color: 'var(--negative)', fontSize: 11,
                }}>
                  Error: {compareError}
                </div>
              ) : comparisonResult ? (
                <ComparisonTableView table={comparisonResult} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-muted)' }}>
                  <Play size={30} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.35 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>No comparison yet</div>
                  <div style={{ fontSize: 11 }}>Enter a prompt above and click ANALYZE to compare documents</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Doc picker modal */}
      {showDocPicker && (
        <DocPickerModal
          allDocs={allDocs}
          selectedIds={activeWorkspace?.document_ids ?? []}
          onClose={() => setShowDocPicker(false)}
          onSave={handleSaveDocs}
        />
      )}

      {/* Global keyframes */}
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
