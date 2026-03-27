import { useAuthStore } from '../../stores/authStore';

function apiHeaders(): HeadersInit {
  const token = useAuthStore.getState().apiToken;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface DocumentSummary {
  executiveSummary: string;
  keyPoints: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentJustification: string;
  keyMetrics: Array<{ name: string; reported: string; estimate: string | null; beat: boolean | null; note: string | null }>;
  risksIdentified: string[];
  keyQuotes: Array<{ speaker: string; quote: string; significance: string }>;
  highlights: Array<{ text: string; type: string; importance: number; charStart: number | null; charEnd: number | null }>;
}

export interface QAResponse {
  answer: string;
  supportingPoints: string[];
  citation: string;
  citedText: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string | null;
}

// Document AI
export async function fetchDocumentSummary(documentId: string, forceRefresh = false): Promise<DocumentSummary> {
  const url = `/api/documents/${documentId}/summary${forceRefresh ? '?forceRefresh=true' : ''}`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error('Failed to generate summary');
  return res.json() as Promise<DocumentSummary>;
}

export async function askDocumentQuestion(
  documentId: string,
  question: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<QAResponse> {
  const res = await fetch(`/api/documents/${documentId}/ask`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ question, conversationHistory }),
  });
  if (!res.ok) throw new Error('Failed to get answer');
  return res.json() as Promise<QAResponse>;
}

export async function generateResearchNote(documentId: string): Promise<string> {
  const res = await fetch(`/api/documents/${documentId}/research-note`, {
    method: 'POST',
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error('Failed to generate research note');
  const data = await res.json() as { note: string };
  return data.note;
}

export async function fetchDocumentHighlights(documentId: string) {
  const res = await fetch(`/api/documents/${documentId}/highlights`, { headers: apiHeaders() });
  if (!res.ok) return { highlights: [] };
  return res.json() as Promise<{ highlights: Array<{ id: string; text_excerpt: string; highlight_type: string; importance: number }> }>;
}

export async function fetchDocumentAnnotations(documentId: string) {
  const res = await fetch(`/api/documents/${documentId}/annotations`, { headers: apiHeaders() });
  if (!res.ok) return { annotations: [] };
  return res.json() as Promise<{ annotations: Array<{ id: string; selected_text: string; note: string; color: string; created_at: string }> }>;
}

export async function createAnnotation(documentId: string, data: { selectedText: string; note: string; color?: string; charStart?: number; charEnd?: number }) {
  const res = await fetch(`/api/documents/${documentId}/annotations`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save annotation');
  return res.json() as Promise<{ id: string }>;
}

export async function getDocumentDownloadUrl(documentId: string): Promise<string> {
  const res = await fetch(`/api/documents/${documentId}/download`, { headers: apiHeaders() });
  if (!res.ok) throw new Error('Download failed');
  const data = await res.json() as { url: string };
  return data.url;
}

// Documents list
export interface DocumentMeta {
  id: string;
  title: string;
  doc_type: string;
  ticker: string | null;
  company: string | null;
  filing_date: string | null;
  source: string;
  created_at: string;
  page_count: number | null;
  has_summary: boolean;
}

export async function fetchDocuments(): Promise<{ documents: DocumentMeta[] }> {
  const res = await fetch('/api/documents', { headers: apiHeaders() });
  if (!res.ok) return { documents: [] };
  return res.json() as Promise<{ documents: DocumentMeta[] }>;
}

export async function fetchDocument(documentId: string): Promise<{ id: string; title: string; content: string; doc_type: string; ticker: string | null; company: string | null; filing_date: string | null; source: string }> {
  const res = await fetch(`/api/documents/${documentId}`, { headers: apiHeaders() });
  if (!res.ok) throw new Error('Failed to fetch document');
  return res.json() as Promise<{ id: string; title: string; content: string; doc_type: string; ticker: string | null; company: string | null; filing_date: string | null; source: string }>;
}

// Workspace
export interface Workspace {
  id: string;
  name: string;
  document_ids: string[];
  table_data: ComparisonTable | null;
  prompts: string[];
  created_at: string;
  updated_at: string;
}

export interface ComparisonTable {
  question: string;
  columns: string[];
  rows: Array<{
    topic: string;
    values: Record<string, { content: string; sentiment: 'positive' | 'negative' | 'neutral'; sourceQuote: string | null }>;
  }>;
  summary: string;
  winner: string | null;
}

export async function fetchWorkspaces(): Promise<{ workspaces: Workspace[] }> {
  const res = await fetch('/api/workspaces', { headers: apiHeaders() });
  if (!res.ok) return { workspaces: [] };
  return res.json() as Promise<{ workspaces: Workspace[] }>;
}

export async function createWorkspace(name: string, documentIds: string[] = []): Promise<{ id: string }> {
  const res = await fetch('/api/workspaces', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ name, documentIds }),
  });
  if (!res.ok) throw new Error('Failed to create workspace');
  return res.json() as Promise<{ id: string }>;
}

export async function updateWorkspace(id: string, data: { name?: string; documentIds?: string[]; tableData?: ComparisonTable }) {
  const res = await fetch(`/api/workspaces/${id}`, {
    method: 'PATCH',
    headers: apiHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update workspace');
}

export async function compareDocuments(workspaceId: string, prompt: string, documentIds: string[]): Promise<ComparisonTable> {
  const res = await fetch(`/api/workspaces/${workspaceId}/compare`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ prompt, documentIds }),
  });
  if (!res.ok) throw new Error('Failed to compare documents');
  return res.json() as Promise<ComparisonTable>;
}

// ASKB streaming
export async function* streamAskb(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userContext: { orgName?: string; userRole?: string; coverageTickers?: string[] },
): AsyncGenerator<string> {
  const token = useAuthStore.getState().apiToken;
  const res = await fetch('/api/askb/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message, history: conversationHistory, userContext }),
  });
  if (!res.ok || !res.body) {
    const errBody = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(errBody.error ?? `ASKB error ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data) as { delta?: string; error?: string };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.delta) yield parsed.delta;
        } catch (e) {
          if (e instanceof Error && e.message !== data) throw e;
        }
      }
    }
  }
}
