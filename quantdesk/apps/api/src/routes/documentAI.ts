import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { generateDocumentSummary, askDocumentQuestion, generateResearchNote } from '../services/ai/documentAI';
import { query } from '../db/postgres';

const router = Router();
router.use(requireAuth);

// POST /api/documents/:id/summary
router.post('/:id/summary', async (req, res) => {
  const { forceRefresh = false } = req.body as { forceRefresh?: boolean };
  try {
    const summary = await generateDocumentSummary(req.params.id, forceRefresh);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/documents/:id/summary (fetch cached)
router.get('/:id/summary', async (req, res) => {
  const [summary] = await query(
    `SELECT ds.*, d.title, d.ticker, d.doc_type FROM document_summaries ds
     JOIN documents d ON d.id = ds.document_id
     WHERE ds.document_id = $1`,
    [req.params.id],
  );
  if (!summary) { res.status(404).json({ error: 'No summary yet' }); return; }
  res.json(summary);
});

// POST /api/documents/:id/ask
router.post('/:id/ask', async (req, res) => {
  const { question, conversationHistory = [] } = req.body as {
    question: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  try {
    const answer = await askDocumentQuestion(req.params.id, question, conversationHistory);
    res.json(answer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/documents/:id/research-note
router.post('/:id/research-note', async (req, res) => {
  try {
    const note = await generateResearchNote(req.params.id);
    res.json({ note });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/documents/:id/highlights
router.get('/:id/highlights', async (req, res) => {
  const highlights = await query(
    'SELECT * FROM document_highlights WHERE document_id = $1 ORDER BY importance DESC',
    [req.params.id],
  );
  res.json({ highlights });
});

// GET /api/documents/:id/annotations
router.get('/:id/annotations', async (req, res) => {
  const annotations = await query(
    'SELECT * FROM document_annotations WHERE document_id = $1 AND user_id = $2 ORDER BY created_at DESC',
    [req.params.id, (req as any).user.id],
  );
  res.json({ annotations });
});

// POST /api/documents/:id/annotations
router.post('/:id/annotations', async (req, res) => {
  const { selectedText, note, color = 'amber', charStart, charEnd } = req.body as {
    selectedText: string; note?: string; color?: string; charStart?: number; charEnd?: number;
  };
  const [annotation] = await query(
    `INSERT INTO document_annotations (document_id, user_id, selected_text, note, color, char_start, char_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.id, (req as any).user.id, selectedText, note ?? null, color, charStart ?? null, charEnd ?? null],
  );
  res.json(annotation);
});

// DELETE /api/documents/:id/annotations/:annotationId
router.delete('/:id/annotations/:annotationId', async (req, res) => {
  await query(
    'DELETE FROM document_annotations WHERE id=$1 AND document_id=$2 AND user_id=$3',
    [req.params.annotationId, req.params.id, (req as any).user.id],
  );
  res.json({ ok: true });
});

// GET /api/documents/research-notes
router.get('/research-notes', async (req, res) => {
  const notes = await query(
    'SELECT id, title, ticker, note_type, created_at FROM research_notes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [(req as any).user.id],
  );
  res.json({ notes });
});

export default router;
