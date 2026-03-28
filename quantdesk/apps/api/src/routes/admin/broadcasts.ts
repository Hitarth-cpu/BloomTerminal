import { Router } from 'express';
import { query } from '../../db/postgres';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';

const router = Router();
router.use(requireAdminAuth);

// GET /api/admin/broadcasts
router.get('/broadcasts', async (req, res) => {
  try {
    const broadcasts = await query<{
      id: string; title: string; body_template: string; priority: string;
      status: string; audience_type: string; created_at: string; sent_at: string | null;
      sender_name: string; delivery_count: number;
    }>(
      `SELECT b.id, b.title, b.body_template, b.priority, b.status,
              b.audience_type, b.created_at, b.sent_at,
              u.display_name AS sender_name,
              COUNT(bd.id)::int AS delivery_count
       FROM broadcasts b
       JOIN users u ON u.id = b.created_by
       LEFT JOIN broadcast_deliveries bd ON bd.broadcast_id = b.id
       WHERE b.org_id = $1
       GROUP BY b.id, u.display_name
       ORDER BY b.created_at DESC LIMIT 50`,
      [req.adminUser.orgId],
    );
    res.json({ broadcasts });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/admin/broadcasts — create and immediately send
router.post('/broadcasts', async (req, res) => {
  try {
    const { title, body, priority = 'normal', audienceType = 'org_wide' } = req.body as {
      title: string; body: string; priority?: string; audienceType?: string;
    };
    if (!title || !body) { res.status(400).json({ error: 'title and body required' }); return; }

    // Create broadcast
    const [bc] = await query<{ id: string }>(
      `INSERT INTO broadcasts (org_id, created_by, title, body_template, priority, audience_type, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent', NOW())
       RETURNING id`,
      [req.adminUser.orgId, req.adminUser.id, title, body, priority, audienceType],
    );

    // Deliver to all active org members
    const members = await query<{ id: string }>(
      `SELECT id FROM users WHERE org_id = $1 AND is_active = true`,
      [req.adminUser.orgId],
    );

    if (members.length > 0) {
      const values = members.map((_, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO broadcast_deliveries (broadcast_id, recipient_id) VALUES ${values}`,
        [bc.id, ...members.map(m => m.id)],
      ).catch(() => {}); // non-fatal if deliveries table missing
    }

    await query(
      `INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, $2, $3)`,
      [req.adminUser.id, 'ADMIN_BROADCAST_SENT', JSON.stringify({ broadcastId: bc.id, title, recipientCount: members.length })],
    ).catch(() => {});

    res.status(201).json({ broadcast: bc, recipientCount: members.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/admin/org — get org details
router.get('/org', async (req, res) => {
  try {
    const [org] = await query<{
      id: string; name: string; display_name: string; slug: string;
      plan: string; domain: string | null; logo_url: string | null; created_at: string;
    }>(
      `SELECT id, name, display_name, slug, plan, domain, logo_url, created_at
       FROM organizations WHERE id = $1`,
      [req.adminUser.orgId],
    );
    if (!org) { res.status(404).json({ error: 'Organisation not found' }); return; }

    const [stats] = await query<{ member_count: string; admin_count: string }>(
      `SELECT COUNT(*)::text AS member_count,
              COUNT(*) FILTER (WHERE org_role IN ('admin','super_admin'))::text AS admin_count
       FROM users WHERE org_id = $1 AND is_active = true`,
      [req.adminUser.orgId],
    );

    res.json({ org, stats });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /api/admin/org — update org details
router.patch('/org', async (req, res) => {
  try {
    if (req.adminUser.orgRole !== 'super_admin') {
      res.status(403).json({ error: 'Only super admins can update organisation settings' }); return;
    }
    const { name, displayName, domain } = req.body as { name?: string; displayName?: string; domain?: string };
    const updates: string[] = [];
    const params: unknown[] = [];

    if (name) { params.push(name); updates.push(`name = $${params.length}`); }
    if (displayName) { params.push(displayName); updates.push(`display_name = $${params.length}`); }
    if (domain !== undefined) { params.push(domain || null); updates.push(`domain = $${params.length}`); }

    if (updates.length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }

    params.push(req.adminUser.orgId);
    await query(`UPDATE organizations SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
