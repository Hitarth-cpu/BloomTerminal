import { Router } from 'express';
import { query } from '../../db/postgres';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';

const router = Router();
router.use(requireAdminAuth);

// GET /api/admin/security/audit
router.get('/audit', async (req, res) => {
  const { action, userId, from, to, page = '1', limit = '50' } = req.query as Record<string, string>;
  const orgId = req.adminUser.orgId;

  const conditions: string[] = ['u.org_id = $1'];
  const params: unknown[] = [orgId];

  if (action) { params.push(action); conditions.push(`al.action = $${params.length}`); }
  if (userId) { params.push(userId); conditions.push(`al.user_id = $${params.length}`); }
  if (from)   { params.push(from);   conditions.push(`al.created_at >= $${params.length}`); }
  if (to)     { params.push(to);     conditions.push(`al.created_at <= $${params.length}`); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  params.push(parseInt(limit), offset);

  const logs = await query<{
    id: string; action: string; user_id: string; display_name: string;
    metadata: unknown; created_at: string;
  }>(
    `SELECT al.id, al.action, al.user_id, u.display_name, al.metadata, al.created_at
     FROM audit_log al
     JOIN users u ON u.id = al.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY al.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.json({ logs });
});

// GET /api/admin/security/sessions
router.get('/sessions', async (req, res) => {
  const sessions = await query<{
    id: string; user_id: string; display_name: string; email: string;
    ip_address: string | null; created_at: string; last_active: string; expires_at: string;
  }>(
    `SELECT s.id, s.user_id, u.display_name, u.email,
            s.ip_address::text, s.created_at, s.last_active, s.expires_at
     FROM admin_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE u.org_id = $1 AND s.is_revoked = false AND s.expires_at > NOW()
     ORDER BY s.last_active DESC`,
    [req.adminUser.orgId],
  );
  res.json({ sessions });
});

// DELETE /api/admin/security/sessions/:sessionId
router.delete('/sessions/:sessionId', async (req, res) => {
  if (req.adminUser.orgRole !== 'super_admin') {
    res.status(403).json({ error: 'Super admin only' });
    return;
  }
  await query(
    `UPDATE admin_sessions SET is_revoked = true
     WHERE id = $1 AND user_id IN (SELECT id FROM users WHERE org_id = $2)`,
    [req.params.sessionId, req.adminUser.orgId],
  );
  await query(
    `INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, $2, $3)`,
    [req.adminUser.id, 'ADMIN_SESSION_TERMINATED', JSON.stringify({ sessionId: req.params.sessionId })],
  );
  res.json({ ok: true });
});

export default router;
