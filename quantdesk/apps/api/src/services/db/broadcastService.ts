import { query, transaction } from '../../db/postgres';
import { buildTokensForUser, renderTemplate } from '../broadcast/tokenizer';
import { recordAudit } from './userService';

export interface Broadcast {
  id:               string;
  org_id:           string;
  created_by:       string;
  title:            string;
  body_template:    string;
  broadcast_type:   string;
  priority:         string;
  audience_type:    string;
  audience_config:  Record<string, unknown>;
  schedule_type:    string;
  scheduled_at:     Date | null;
  status:           string;
  approved_by:      string | null;
  approved_at:      Date | null;
  sent_at:          Date | null;
  total_recipients: number;
  delivered_count:  number;
  read_count:       number;
  metadata:         Record<string, unknown>;
  created_at:       Date;
  updated_at:       Date;
}

export interface BroadcastDelivery {
  id:                string;
  broadcast_id:      string;
  recipient_id:      string;
  personalized_body: string;
  delivery_channel:  string;
  status:            string;
  delivered_at:      Date | null;
  read_at:           Date | null;
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createBroadcast(payload: {
  orgId:          string;
  createdBy:      string;
  title:          string;
  bodyTemplate:   string;
  broadcastType?: string;
  priority?:      string;
  audienceType:   string;
  audienceConfig: Record<string, unknown>;
  scheduleType?:  string;
  scheduledAt?:   Date;
}): Promise<Broadcast> {
  const rows = await query<Broadcast>(
    `INSERT INTO broadcasts
       (org_id, created_by, title, body_template, broadcast_type, priority,
        audience_type, audience_config, schedule_type, scheduled_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
     RETURNING *`,
    [
      payload.orgId, payload.createdBy, payload.title, payload.bodyTemplate,
      payload.broadcastType ?? 'announcement', payload.priority ?? 'normal',
      payload.audienceType, JSON.stringify(payload.audienceConfig),
      payload.scheduleType ?? 'immediate', payload.scheduledAt ?? null,
    ],
  );
  await recordAudit(payload.createdBy, 'BROADCAST_CREATE', { entityType: 'broadcast', entityId: rows[0].id });
  return rows[0];
}

// ─── Update (draft only) ──────────────────────────────────────────────────────

export async function updateBroadcast(
  id: string, orgId: string,
  patch: Partial<Pick<Broadcast, 'title' | 'body_template' | 'priority' | 'audience_type' | 'audience_config'>>,
): Promise<Broadcast | null> {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (!fields.length) return getBroadcastById(id);
  const values = fields.map(f => patch[f]);
  const set    = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const rows = await query<Broadcast>(
    `UPDATE broadcasts SET ${set}
     WHERE id = $1 AND org_id = $2 AND status = 'draft'
     RETURNING *`,
    [id, orgId, ...values],
  );
  return rows[0] ?? null;
}

// ─── Resolve audience ─────────────────────────────────────────────────────────

async function resolveAudience(
  orgId: string,
  audienceType: string,
  audienceConfig: Record<string, unknown>,
  createdBy: string,
): Promise<string[]> {
  let ids: string[] = [];
  switch (audienceType) {
    case 'org_wide': {
      const r = await query<{ id: string }>(
        'SELECT id FROM users WHERE org_id = $1 AND is_active = true AND id != $2',
        [orgId, createdBy],
      );
      ids = r.map(x => x.id);
      break;
    }
    case 'team': {
      const teamIds = (audienceConfig.teamIds as string[]) ?? [];
      const r = await query<{ user_id: string }>(
        'SELECT DISTINCT user_id FROM team_members WHERE team_id = ANY($1)',
        [teamIds],
      );
      ids = r.map(x => x.user_id);
      break;
    }
    case 'role': {
      const roles = (audienceConfig.roles as string[]) ?? [];
      const r = await query<{ id: string }>(
        'SELECT id FROM users WHERE org_id = $1 AND org_role = ANY($2) AND is_active = true',
        [orgId, roles],
      );
      ids = r.map(x => x.id);
      break;
    }
    case 'individual':
      ids = (audienceConfig.userIds as string[]) ?? [];
      break;
    case 'custom': {
      const s = new Set<string>((audienceConfig.userIds as string[]) ?? []);
      const teamIds = (audienceConfig.teamIds as string[]) ?? [];
      const roles   = (audienceConfig.roles   as string[]) ?? [];
      if (teamIds.length) {
        const r = await query<{ user_id: string }>(
          'SELECT DISTINCT user_id FROM team_members WHERE team_id = ANY($1)', [teamIds],
        );
        r.forEach(x => s.add(x.user_id));
      }
      if (roles.length) {
        const r = await query<{ id: string }>(
          'SELECT id FROM users WHERE org_id = $1 AND org_role = ANY($2) AND is_active = true',
          [orgId, roles],
        );
        r.forEach(x => s.add(x.id));
      }
      ids = [...s];
      break;
    }
  }

  // Exclude users with broadcasts disabled
  if (ids.length) {
    const filtered = await query<{ user_id: string }>(
      `SELECT user_id FROM user_personalization
       WHERE user_id = ANY($1)
         AND (notification_prefs->>'broadcasts')::boolean = false`,
      [ids],
    );
    const excluded = new Set(filtered.map(r => r.user_id));
    ids = ids.filter(id => !excluded.has(id));
  }

  return [...new Set(ids)];
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendBroadcast(
  broadcastId: string,
  approverId:  string,
  notify?: (userId: string, event: { type: string; [k: string]: unknown }) => Promise<void>,
): Promise<{ sent: number }> {
  const bc = await getBroadcastById(broadcastId);
  if (!bc) throw new Error('Broadcast not found');
  if (bc.status === 'sent') throw new Error('Already sent');

  const recipientIds = await resolveAudience(
    bc.org_id, bc.audience_type, bc.audience_config, bc.created_by,
  );

  // Mark as sending
  await query(
    `UPDATE broadcasts SET status='sending', approved_by=$2, approved_at=NOW(),
     total_recipients=$3 WHERE id=$1`,
    [broadcastId, approverId, recipientIds.length],
  );

  let delivered = 0;

  // Process in batches of 50
  for (let i = 0; i < recipientIds.length; i += 50) {
    const batch = recipientIds.slice(i, i + 50);
    await Promise.all(batch.map(async (recipientId) => {
      let retries = 0;
      while (retries < 3) {
        try {
          const tokens       = await buildTokensForUser(recipientId, bc.org_id);
          const personalized = renderTemplate(bc.body_template, tokens);
          await query(
            `INSERT INTO broadcast_deliveries
               (broadcast_id, recipient_id, personalized_body, status, delivered_at)
             VALUES ($1, $2, $3, 'delivered', NOW())
             ON CONFLICT (broadcast_id, recipient_id) DO NOTHING`,
            [broadcastId, recipientId, personalized],
          );
          delivered++;

          // Real-time notification via WebSocket
          if (notify) {
            await notify(recipientId, {
              type: 'BROADCAST_RECEIVED',
              broadcastId,
              priority:       bc.priority,
              broadcastType:  bc.broadcast_type,
              title:          bc.title,
            }).catch(() => {});
          }
          break;
        } catch (err) {
          retries++;
          if (retries === 3) {
            await query(
              `INSERT INTO broadcast_deliveries
                 (broadcast_id, recipient_id, personalized_body, status, metadata)
               VALUES ($1, $2, '', 'failed', $3)
               ON CONFLICT DO NOTHING`,
              [broadcastId, recipientId, JSON.stringify({ error: String(err) })],
            );
          } else {
            await new Promise(r => setTimeout(r, retries * 500));
          }
        }
      }
    }));
  }

  await query(
    `UPDATE broadcasts SET status='sent', sent_at=NOW(), delivered_count=$2 WHERE id=$1`,
    [broadcastId, delivered],
  );
  await recordAudit(approverId, 'BROADCAST_SEND', { entityType: 'broadcast', entityId: broadcastId });
  return { sent: delivered };
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelBroadcast(
  broadcastId: string, orgId: string, cancelledBy: string,
): Promise<boolean> {
  const rows = await query<Broadcast>(
    `UPDATE broadcasts SET status='cancelled'
     WHERE id=$1 AND org_id=$2
       AND status IN ('draft','pending_approval','approved','scheduled')
     RETURNING id`,
    [broadcastId, orgId],
  );
  if (rows.length) {
    await recordAudit(cancelledBy, 'BROADCAST_CANCEL', { entityType: 'broadcast', entityId: broadcastId });
  }
  return rows.length > 0;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

export async function getBroadcastById(id: string): Promise<Broadcast | null> {
  const rows = await query<Broadcast>('SELECT * FROM broadcasts WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function listOrgBroadcasts(
  orgId: string,
  opts: { status?: string; type?: string; createdBy?: string } = {},
  limit = 50,
): Promise<Broadcast[]> {
  const conditions = ['org_id = $1'];
  const values: unknown[] = [orgId];
  let i = 2;
  if (opts.status)    { conditions.push(`status = $${i++}`);         values.push(opts.status); }
  if (opts.type)      { conditions.push(`broadcast_type = $${i++}`); values.push(opts.type); }
  if (opts.createdBy) { conditions.push(`created_by = $${i++}`);     values.push(opts.createdBy); }
  values.push(limit);
  const limitClause = `LIMIT $${i}`;
  return query<Broadcast>(
    `SELECT * FROM broadcasts WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC ${limitClause}`,
    values,
  );
}

export async function getDeliveriesForUser(
  userId: string, limit = 20, status?: string,
): Promise<(BroadcastDelivery & {
  title: string; broadcast_type: string; priority: string;
  created_by_name: string; sent_at: Date | null;
})[]> {
  const statusClause = status === 'unread' ? `AND bd.status = 'delivered'`
                     : status === 'read'   ? `AND bd.status = 'read'`
                     : '';
  return query(
    `SELECT bd.*, b.title, b.broadcast_type, b.priority, b.sent_at,
            u.display_name AS created_by_name
     FROM broadcast_deliveries bd
     JOIN broadcasts b ON b.id = bd.broadcast_id
     JOIN users u ON u.id = b.created_by
     WHERE bd.recipient_id = $1 ${statusClause}
     ORDER BY b.sent_at DESC NULLS LAST
     LIMIT $2`,
    [userId, limit],
  );
}

export async function markDeliveryRead(deliveryId: string, recipientId: string): Promise<void> {
  const rows = await query<{ broadcast_id: string }>(
    `UPDATE broadcast_deliveries
     SET status = 'read', read_at = NOW()
     WHERE id = $1 AND recipient_id = $2 AND status = 'delivered'
     RETURNING broadcast_id`,
    [deliveryId, recipientId],
  );
  if (rows[0]) {
    await query('UPDATE broadcasts SET read_count = read_count + 1 WHERE id = $1', [rows[0].broadcast_id]);
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

export async function getBroadcastStats(broadcastId: string, orgId: string): Promise<{
  totalRecipients: number; deliveredCount: number; readCount: number;
  deliveryRate: number; readRate: number;
  deliveriesByStatus: Record<string, number>;
  avgReadTimeMinutes: number;
  recipientList: unknown[];
} | null> {
  const bc = await getBroadcastById(broadcastId);
  if (!bc || bc.org_id !== orgId) return null;

  const [byStatus] = await query<{
    pending: string; delivered: string; read: string; failed: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status='pending')   AS pending,
       COUNT(*) FILTER (WHERE status='delivered') AS delivered,
       COUNT(*) FILTER (WHERE status='read')      AS read,
       COUNT(*) FILTER (WHERE status='failed')    AS failed
     FROM broadcast_deliveries WHERE broadcast_id = $1`,
    [broadcastId],
  );

  const [avgRow] = await query<{ avg_min: string }>(
    `SELECT EXTRACT(EPOCH FROM AVG(read_at - delivered_at))/60 AS avg_min
     FROM broadcast_deliveries
     WHERE broadcast_id = $1 AND read_at IS NOT NULL`,
    [broadcastId],
  );

  const recipients = await query(
    `SELECT bd.recipient_id, u.display_name AS name,
            bd.status, bd.delivered_at, bd.read_at
     FROM broadcast_deliveries bd
     JOIN users u ON u.id = bd.recipient_id
     WHERE bd.broadcast_id = $1
     ORDER BY u.display_name ASC`,
    [broadcastId],
  );

  const total = bc.total_recipients || 1;
  return {
    totalRecipients:  bc.total_recipients,
    deliveredCount:   bc.delivered_count,
    readCount:        bc.read_count,
    deliveryRate:     Math.round((bc.delivered_count / total) * 100) / 100,
    readRate:         Math.round((bc.read_count / total) * 100) / 100,
    deliveriesByStatus: {
      pending:   Number(byStatus?.pending   ?? 0),
      delivered: Number(byStatus?.delivered ?? 0),
      read:      Number(byStatus?.read      ?? 0),
      failed:    Number(byStatus?.failed    ?? 0),
    },
    avgReadTimeMinutes: Math.round(Number(avgRow?.avg_min ?? 0) * 10) / 10,
    recipientList: recipients,
  };
}

// ─── Templates ─────────────────────────────────────────────────────────────────

export interface BroadcastTemplate {
  id: string; org_id: string; created_by: string; name: string;
  description: string | null; category: string | null;
  body_template: string; default_audience_type: string;
  default_priority: string; is_active: boolean;
  use_count: number; created_at: Date; updated_at: Date;
}

export async function createTemplate(
  orgId: string, createdBy: string,
  payload: { name: string; description?: string; category?: string; bodyTemplate: string; defaultAudienceType?: string; defaultPriority?: string },
): Promise<BroadcastTemplate> {
  const rows = await query<BroadcastTemplate>(
    `INSERT INTO broadcast_templates
       (org_id, created_by, name, description, category, body_template,
        default_audience_type, default_priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (org_id, name) DO UPDATE
       SET body_template = EXCLUDED.body_template,
           description   = EXCLUDED.description
     RETURNING *`,
    [
      orgId, createdBy, payload.name, payload.description ?? null,
      payload.category ?? null, payload.bodyTemplate,
      payload.defaultAudienceType ?? 'org_wide', payload.defaultPriority ?? 'normal',
    ],
  );
  return rows[0];
}

export async function listTemplates(orgId: string, category?: string): Promise<BroadcastTemplate[]> {
  const where = category ? 'AND category = $2' : '';
  const vals  = category ? [orgId, category] : [orgId];
  return query<BroadcastTemplate>(
    `SELECT * FROM broadcast_templates
     WHERE org_id = $1 AND is_active = true ${where}
     ORDER BY use_count DESC, name ASC`,
    vals,
  );
}

export async function createFromTemplate(
  templateId: string, createdBy: string, orgId: string,
  overrides: Partial<Parameters<typeof createBroadcast>[0]>,
): Promise<Broadcast> {
  const [tpl] = await query<BroadcastTemplate>(
    'SELECT * FROM broadcast_templates WHERE id = $1 AND org_id = $2',
    [templateId, orgId],
  );
  if (!tpl) throw new Error('Template not found');

  const broadcast = await createBroadcast({
    orgId,
    createdBy,
    title:          overrides.title        ?? tpl.name,
    bodyTemplate:   overrides.bodyTemplate ?? tpl.body_template,
    broadcastType:  overrides.broadcastType,
    priority:       overrides.priority ?? tpl.default_priority,
    audienceType:   overrides.audienceType ?? tpl.default_audience_type,
    audienceConfig: overrides.audienceConfig ?? {},
    ...overrides,
  });

  await query(
    'UPDATE broadcast_templates SET use_count = use_count + 1 WHERE id = $1',
    [templateId],
  );
  return broadcast;
}
