import { Router } from 'express';
import { query } from '../../db/postgres';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { notifyUser } from '../../websocket/wsServer';

const router = Router();
router.use(requireAdminAuth);

async function writeAudit(adminId: string, action: string, meta: object = {}): Promise<void> {
  await query(
    `INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, $2, $3)`,
    [adminId, action, JSON.stringify(meta)],
  ).catch(() => {});
}

// GET /api/admin/chat/connections
router.get('/connections', async (req, res) => {
  const connections = await query<{
    id: string; user_a_id: string; user_a_name: string;
    user_b_id: string; user_b_name: string;
    reason: string; is_active: boolean; created_at: string;
  }>(
    `SELECT acl.id, acl.user_a_id, ua.display_name AS user_a_name,
            acl.user_b_id, ub.display_name AS user_b_name,
            acl.reason, acl.is_active, acl.created_at
     FROM admin_chat_links acl
     JOIN users ua ON ua.id = acl.user_a_id
     JOIN users ub ON ub.id = acl.user_b_id
     WHERE acl.org_id = $1
     ORDER BY acl.created_at DESC`,
    [req.adminUser.orgId],
  );
  res.json({ connections });
});

// POST /api/admin/chat/connections
router.post('/connections', async (req, res) => {
  const { userAId, userBId, reason } = req.body as {
    userAId: string; userBId: string; reason: string;
  };

  if (!userAId || !userBId || !reason) {
    res.status(400).json({ error: 'userAId, userBId, and reason are required' });
    return;
  }

  const users = await query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM users WHERE id = ANY($1) AND org_id = $2`,
    [[userAId, userBId], req.adminUser.orgId],
  );
  if (users.length !== 2) {
    res.status(400).json({ error: 'One or both users not found in your organization' });
    return;
  }

  const [link] = await query<{ id: string }>(
    `INSERT INTO admin_chat_links (org_id, created_by, user_a_id, user_b_id, reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_a_id, user_b_id)
     DO UPDATE SET is_active = true, reason = EXCLUDED.reason, revoked_at = NULL
     RETURNING id`,
    [req.adminUser.orgId, req.adminUser.id, userAId, userBId, reason],
  );

  // Create mutual contact entries
  for (const [owner, contact] of [[userAId, userBId], [userBId, userAId]]) {
    await query(
      `INSERT INTO contacts (owner_id, contact_user_id, notes)
       VALUES ($1, $2, 'Admin-linked')
       ON CONFLICT (owner_id, contact_user_id) DO NOTHING`,
      [owner, contact],
    ).catch(() => {});
  }

  // Notify both users via WebSocket
  const nameA = users.find(u => u.id === userAId)?.display_name ?? 'a colleague';
  const nameB = users.find(u => u.id === userBId)?.display_name ?? 'a colleague';
  await notifyUser(userAId, {
    type: 'CONTACT_REQUEST_ACCEPTED',
    message: `You have been connected to ${nameB} by your administrator`,
  }).catch(() => {});
  await notifyUser(userBId, {
    type: 'CONTACT_REQUEST_ACCEPTED',
    message: `You have been connected to ${nameA} by your administrator`,
  }).catch(() => {});

  await writeAudit(req.adminUser.id, 'ADMIN_CHAT_LINK', { userAId, userBId, reason, linkId: link.id });
  res.status(201).json({ link });
});

// DELETE /api/admin/chat/connections/:linkId
router.delete('/connections/:linkId', async (req, res) => {
  const [link] = await query<{ user_a_id: string; user_b_id: string }>(
    `UPDATE admin_chat_links SET is_active = false, revoked_at = NOW()
     WHERE id = $1 AND org_id = $2
     RETURNING user_a_id, user_b_id`,
    [req.params.linkId, req.adminUser.orgId],
  );
  if (!link) { res.status(404).json({ error: 'Link not found' }); return; }
  await writeAudit(req.adminUser.id, 'ADMIN_CHAT_LINK_REVOKED', { linkId: req.params.linkId });
  res.json({ ok: true });
});

// POST /api/admin/chat/unblock (super_admin only)
router.post('/unblock', async (req, res) => {
  if (req.adminUser.orgRole !== 'super_admin') {
    res.status(403).json({ error: 'Super admin only' });
    return;
  }
  const { userAId, userBId } = req.body as { userAId: string; userBId: string };
  await query(
    `UPDATE contacts SET is_blocked = false
     WHERE (owner_id = $1 AND contact_user_id = $2)
        OR (owner_id = $2 AND contact_user_id = $1)`,
    [userAId, userBId],
  );
  await writeAudit(req.adminUser.id, 'ADMIN_UNBLOCK', { userAId, userBId });
  res.json({ ok: true });
});

// PATCH /api/admin/chat/settings
router.patch('/settings', async (req, res) => {
  const allowed = [
    'allowOpenMessaging', 'requireAdminForCrossTeam',
    'allowCrossOrgContacts', 'allowUserBlocks', 'adminCanOverrideBlocks',
  ];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in req.body) updates[k] = (req.body as Record<string, unknown>)[k];
  }
  if (!Object.keys(updates).length) {
    res.status(400).json({ error: 'No valid settings provided' });
    return;
  }
  await query(
    `UPDATE organizations SET settings = settings || $1::jsonb WHERE id = $2`,
    [JSON.stringify(updates), req.adminUser.orgId],
  );
  await writeAudit(req.adminUser.id, 'ADMIN_CHAT_SETTINGS_UPDATE', updates);
  res.json({ ok: true });
});

export default router;
