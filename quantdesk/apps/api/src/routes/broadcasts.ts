import { Router } from 'express';
import { z } from 'zod';
import {
  createBroadcast, sendBroadcast, cancelBroadcast,
  getDeliveriesForUser, markDeliveryRead,
  listOrgBroadcasts, getBroadcastById, getBroadcastStats,
  updateBroadcast,
  createTemplate, listTemplates, createFromTemplate,
} from '../services/db/broadcastService';
import { buildTokensForUser, renderTemplate } from '../services/broadcast/tokenizer';
import { findById } from '../services/db/userService';
import { notifyBroadcast } from '../websocket/wsServer';
type NotifyFn = (userId: string, event: { type: string; [k: string]: unknown }) => Promise<void>;

const router = Router();

// ─── Guards ───────────────────────────────────────────────────────────────────

function isAdminRole(role: string): boolean {
  return ['admin', 'super_admin', 'team_lead'].includes(role);
}

const CreateSchema = z.object({
  title:          z.string().min(1).max(200),
  bodyTemplate:   z.string().min(1),
  broadcastType:  z.string().optional(),
  priority:       z.enum(['low','normal','high','critical']).optional(),
  audienceType:   z.enum(['org_wide','team','role','individual','custom']),
  audienceConfig: z.record(z.string(), z.unknown()).optional(),
  scheduleType:   z.enum(['immediate','scheduled','recurring']).optional(),
  scheduledAt:    z.string().optional(),
});

// ─── Recipient-facing routes ──────────────────────────────────────────────────

/** GET /api/broadcasts/inbox */
router.get('/inbox', async (req, res) => {
  const { limit, status } = req.query as { limit?: string; status?: string };
  const deliveries = await getDeliveriesForUser(req.user.id, limit ? Number(limit) : 20, status as string | undefined);
  res.json({ deliveries });
});

/** PATCH /api/broadcasts/inbox/:deliveryId/read */
router.patch('/inbox/:deliveryId/read', async (req, res) => {
  await markDeliveryRead(req.params.deliveryId, req.user.id);
  res.json({ ok: true });
});

// ─── Template routes ──────────────────────────────────────────────────────────

/** GET /api/broadcasts/templates */
router.get('/templates', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id) { res.json({ templates: [] }); return; }
  const templates = await listTemplates(me.org_id, req.query.category as string | undefined);
  res.json({ templates });
});

/** POST /api/broadcasts/templates */
router.post('/templates', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.status(403).json({ error: 'Insufficient permissions' }); return;
  }
  const { name, description, category, bodyTemplate, defaultAudienceType, defaultPriority } = req.body as {
    name: string; description?: string; category?: string; bodyTemplate: string;
    defaultAudienceType?: string; defaultPriority?: string;
  };
  if (!name || !bodyTemplate) { res.status(400).json({ error: 'name and bodyTemplate required' }); return; }
  const template = await createTemplate(me.org_id, req.user.id, { name, description, category, bodyTemplate, defaultAudienceType, defaultPriority });
  res.status(201).json({ template });
});

/** POST /api/broadcasts/from-template/:templateId */
router.post('/from-template/:templateId', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.status(403).json({ error: 'Insufficient permissions' }); return;
  }
  const broadcast = await createFromTemplate(req.params.templateId, req.user.id, me.org_id, req.body);
  res.status(201).json({ broadcast });
});

// ─── Admin broadcast CRUD + lifecycle ─────────────────────────────────────────

/** GET /api/broadcasts */
router.get('/', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.json({ broadcasts: [] }); return;
  }
  const broadcasts = await listOrgBroadcasts(me.org_id, {
    status:    req.query.status    as string | undefined,
    type:      req.query.type      as string | undefined,
    createdBy: req.query.createdBy as string | undefined,
  });
  res.json({ broadcasts });
});

/** POST /api/broadcasts */
router.post('/', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.status(403).json({ error: 'Insufficient permissions' }); return;
  }
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const data = parsed.data;
  const broadcast = await createBroadcast({
    orgId: me.org_id, createdBy: req.user.id, ...data,
    audienceConfig: data.audienceConfig ?? {},
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
  });

  // Auto-send if immediate
  if (!data.scheduleType || data.scheduleType === 'immediate') {
    await sendBroadcast(broadcast.id, req.user.id, notifyBroadcast as NotifyFn);
    res.status(201).json({ broadcast: { ...broadcast, status: 'sent' } });
  } else {
    res.status(201).json({ broadcast });
  }
});

/** GET /api/broadcasts/:id */
router.get('/:id', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.status(403).json({ error: 'Insufficient permissions' }); return;
  }
  const broadcast = await getBroadcastById(req.params.id);
  if (!broadcast || broadcast.org_id !== me.org_id) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ broadcast });
});

/** PATCH /api/broadcasts/:id */
router.patch('/:id', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.status(403).json({ error: 'Insufficient permissions' }); return;
  }
  const broadcast = await updateBroadcast(req.params.id, me.org_id, req.body);
  if (!broadcast) { res.status(404).json({ error: 'Not found or not editable' }); return; }
  res.json({ broadcast });
});

/** POST /api/broadcasts/:id/approve */
router.post('/:id/approve', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !['admin','super_admin'].includes(me.org_role ?? '')) {
    res.status(403).json({ error: 'Admin only' }); return;
  }
  const bc = await getBroadcastById(req.params.id);
  if (!bc || bc.org_id !== me.org_id) { res.status(404).json({ error: 'Not found' }); return; }
  if (bc.created_by === req.user.id) {
    res.status(403).json({ error: 'Four-eyes: approver cannot be the creator' }); return;
  }
  await sendBroadcast(bc.id, req.user.id, notifyBroadcast);
  res.json({ ok: true });
});

/** POST /api/broadcasts/:id/cancel */
router.post('/:id/cancel', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.status(403).json({ error: 'Insufficient permissions' }); return;
  }
  const ok = await cancelBroadcast(req.params.id, me.org_id, req.user.id);
  if (!ok) { res.status(400).json({ error: 'Cannot cancel at current status' }); return; }
  res.json({ ok: true });
});

/** GET /api/broadcasts/:id/preview?userId= */
router.get('/:id/preview', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.status(403).json({ error: 'Insufficient permissions' }); return;
  }
  const bc = await getBroadcastById(req.params.id);
  if (!bc || bc.org_id !== me.org_id) { res.status(404).json({ error: 'Not found' }); return; }

  const previewUserId = (req.query.userId as string) || req.user.id;
  const tokens        = await buildTokensForUser(previewUserId, me.org_id);
  const rendered      = renderTemplate(bc.body_template, tokens);
  res.json({ renderedBody: rendered, tokenMap: tokens });
});

/** GET /api/broadcasts/:id/stats */
router.get('/:id/stats', async (req, res) => {
  const me = await findById(req.user.id);
  if (!me?.org_id || !isAdminRole(me.org_role ?? '')) {
    res.status(403).json({ error: 'Insufficient permissions' }); return;
  }
  const stats = await getBroadcastStats(req.params.id, me.org_id);
  if (!stats) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(stats);
});

export default router;
