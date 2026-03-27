import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { query } from '../db/postgres';
import { compareDocuments } from '../services/ai/workspaceAI';

const router = Router();
router.use(requireAuth);

// GET /api/workspaces
router.get('/', async (req, res) => {
  const workspaces = await query(
    'SELECT id, name, document_ids, table_data, prompts, created_at, updated_at FROM workspaces WHERE user_id = $1 ORDER BY updated_at DESC',
    [(req as any).user.id],
  );
  res.json({ workspaces });
});

// POST /api/workspaces
router.post('/', async (req, res) => {
  const { name, documentIds = [] } = req.body as { name: string; documentIds?: string[] };
  const [workspace] = await query(
    'INSERT INTO workspaces (user_id, name, document_ids) VALUES ($1,$2,$3) RETURNING *',
    [(req as any).user.id, name, documentIds],
  );
  res.json(workspace);
});

// GET /api/workspaces/:id
router.get('/:id', async (req, res) => {
  const [workspace] = await query(
    'SELECT * FROM workspaces WHERE id = $1 AND user_id = $2',
    [req.params.id, (req as any).user.id],
  );
  if (!workspace) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(workspace);
});

// PATCH /api/workspaces/:id
router.patch('/:id', async (req, res) => {
  const { name, documentIds, tableData } = req.body as { name?: string; documentIds?: string[]; tableData?: unknown };
  const updates: string[] = [];
  const params: unknown[] = [req.params.id, (req as any).user.id];

  if (name !== undefined) { params.push(name); updates.push(`name=$${params.length}`); }
  if (documentIds !== undefined) { params.push(documentIds); updates.push(`document_ids=$${params.length}`); }
  if (tableData !== undefined) { params.push(JSON.stringify(tableData)); updates.push(`table_data=$${params.length}`); }

  if (!updates.length) { res.json({ ok: true }); return; }
  updates.push('updated_at=NOW()');

  await query(
    `UPDATE workspaces SET ${updates.join(',')} WHERE id=$1 AND user_id=$2`,
    params,
  );
  res.json({ ok: true });
});

// DELETE /api/workspaces/:id
router.delete('/:id', async (req, res) => {
  await query('DELETE FROM workspaces WHERE id=$1 AND user_id=$2', [req.params.id, (req as any).user.id]);
  res.json({ ok: true });
});

// POST /api/workspaces/:id/compare
router.post('/:id/compare', async (req, res) => {
  const { prompt, documentIds } = req.body as { prompt: string; documentIds: string[] };
  try {
    const result = await compareDocuments(req.params.id, prompt, documentIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
