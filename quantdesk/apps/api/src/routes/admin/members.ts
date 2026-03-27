import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../../db/postgres';
import { randomBytes } from 'crypto';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { sendInvitationEmail } from '../../services/email/emailService';

const router = Router();
router.use(requireAdminAuth);

async function writeAudit(adminId: string, action: string, meta: object = {}): Promise<void> {
  await query(`INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, $2, $3)`,
    [adminId, action, JSON.stringify(meta)]).catch(() => {});
}

// GET /api/admin/members
router.get('/', async (req, res) => {
  const { search, role, team, status, sort = 'display_name', page = '1', limit = '50' } = req.query as Record<string, string>;
  const orgId = req.adminUser.orgId;

  const conditions: string[] = ['u.org_id = $1'];
  const params: unknown[] = [orgId];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.display_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (role) {
    params.push(role);
    conditions.push(`u.org_role = $${params.length}`);
  }
  if (status === 'active') conditions.push('u.is_active = true');
  if (status === 'inactive') conditions.push('u.is_active = false');

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const allowedSort: Record<string, string> = {
    display_name: 'u.display_name', email: 'u.email',
    org_role: 'u.org_role', created_at: 'u.created_at',
  };
  const orderBy = allowedSort[sort] ?? 'u.display_name';

  params.push(parseInt(limit), offset);
  const members = await query<{
    id: string; display_name: string; email: string; org_role: string;
    team_ids: string[]; is_active: boolean; created_at: string;
    last_login_at: string | null; photo_url: string | null;
    daily_pnl: number | null; firm: string | null;
  }>(
    `SELECT u.id, u.display_name, u.email, u.org_role, u.team_ids, u.is_active,
            u.created_at, u.last_login_at, u.photo_url, u.firm,
            ps.daily_pnl
     FROM users u
     LEFT JOIN performance_snapshots ps ON ps.user_id = u.id AND ps.snapshot_date = CURRENT_DATE
     WHERE ${conditions.join(' AND ')} AND u.is_org_visible = true
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM users u WHERE ${conditions.slice(0, -2).join(' AND ')} AND u.is_org_visible = true`,
    params.slice(0, -2),
  );

  res.json({ members, total: parseInt(count), page: parseInt(page) });
});

// GET /api/admin/members/:userId
router.get('/:userId', async (req, res) => {
  const [member] = await query<{
    id: string; display_name: string; email: string; org_role: string;
    team_ids: string[]; is_active: boolean; created_at: string;
    last_login_at: string | null; photo_url: string | null;
    mfa_enabled: boolean; firm: string | null; org_id: string;
  }>(
    `SELECT u.id, u.display_name, u.email, u.org_role, u.team_ids, u.is_active,
            u.created_at, u.last_login_at, u.photo_url, u.mfa_enabled, u.firm, u.org_id
     FROM users u WHERE u.id = $1 AND u.org_id = $2`,
    [req.params.userId, req.adminUser.orgId],
  );

  if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

  // Get recent sessions
  const sessions = await query<{ id: string; ip_address: string; created_at: string; last_active: string }>(
    `SELECT id, ip_address::text, created_at, last_active FROM admin_sessions
     WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
     ORDER BY last_active DESC LIMIT 10`,
    [member.id],
  );

  // Get 30d performance snapshot
  const snapshots = await query<{ snapshot_date: string; daily_pnl: number; cumulative_pnl: number; trades_count: number }>(
    `SELECT snapshot_date, daily_pnl, cumulative_pnl, trades_count
     FROM performance_snapshots WHERE user_id = $1 ORDER BY snapshot_date DESC LIMIT 30`,
    [member.id],
  );

  res.json({ member, sessions, snapshots });
});

// PATCH /api/admin/members/:userId
router.patch('/:userId', async (req, res) => {
  const { role, teamIds, isActive } = req.body as {
    role?: string; teamIds?: string[]; isActive?: boolean;
  };
  const userId = req.params.userId;
  const adminUser = req.adminUser;

  // Only super_admin can promote to admin
  if (role && ['admin', 'super_admin'].includes(role) && adminUser.orgRole !== 'super_admin') {
    res.status(403).json({ error: 'Only super admins can grant admin roles' }); return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (role !== undefined) { params.push(role); updates.push(`org_role = $${params.length}`); }
  if (teamIds !== undefined) { params.push(teamIds); updates.push(`team_ids = $${params.length}`); }
  if (isActive !== undefined) { params.push(isActive); updates.push(`is_active = $${params.length}`); }

  if (updates.length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }

  params.push(userId, adminUser.orgId);
  const [updated] = await query<{ id: string }>(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND org_id = $${params.length} RETURNING id`,
    params,
  );

  if (!updated) { res.status(404).json({ error: 'Member not found' }); return; }

  await writeAudit(adminUser.id, 'ADMIN_MEMBER_UPDATE', { targetUserId: userId, changes: req.body });
  res.json({ ok: true });
});

// DELETE /api/admin/members/:userId (soft delete)
router.delete('/:userId', async (req, res) => {
  const { userId } = req.params;
  await query(
    `UPDATE users SET is_active = false WHERE id = $1 AND org_id = $2`,
    [userId, req.adminUser.orgId],
  );
  // Revoke all sessions
  await query(`UPDATE admin_sessions SET is_revoked = true WHERE user_id = $1`, [userId]);
  await writeAudit(req.adminUser.id, 'ADMIN_MEMBER_SUSPENDED', { targetUserId: userId });
  res.json({ ok: true });
});

// POST /api/admin/invitations
router.post('/invitations', async (req, res) => {
  const { email, firstName, lastName, role, teamIds, expiryHours = 48 } = req.body as {
    email: string; firstName?: string; lastName?: string;
    role: string; teamIds?: string[]; expiryHours?: number;
  };

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

  const [inv] = await query<{ id: string }>(
    `INSERT INTO user_invitations
       (org_id, invited_by, email, first_name, last_name, intended_role, intended_teams, token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [req.adminUser.orgId, req.adminUser.id, email, firstName, lastName,
     role, teamIds ?? [], token, expiresAt.toISOString()],
  );

  await writeAudit(req.adminUser.id, 'ADMIN_INVITATION_CREATED', { email, role, invitationId: inv.id });

  // Send invitation email (non-blocking — don't fail if email fails)
  const [orgRow] = await query<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [req.adminUser.orgId]).catch(() => []);
  sendInvitationEmail({
    to: email,
    firstName,
    inviterName: req.adminUser.displayName ?? req.adminUser.email,
    orgName: orgRow?.name ?? 'BloomTerminal',
    token,
    role,
    expiryHours,
  }).catch(err => console.error('[invite] Email send failed:', err.message));

  res.status(201).json({ invitation: inv, token });
});

// GET /api/admin/invitations
router.get('/invitations', async (req, res) => {
  const invitations = await query<{
    id: string; email: string; first_name: string; last_name: string;
    intended_role: string; status: string; expires_at: string; created_at: string;
    invited_by_name: string;
  }>(
    `SELECT i.id, i.email, i.first_name, i.last_name, i.intended_role, i.status,
            i.expires_at, i.created_at, u.display_name AS invited_by_name
     FROM user_invitations i
     JOIN users u ON u.id = i.invited_by
     WHERE i.org_id = $1 ORDER BY i.created_at DESC`,
    [req.adminUser.orgId],
  );
  res.json({ invitations });
});

// DELETE /api/admin/invitations/:id
router.delete('/invitations/:id', async (req, res) => {
  await query(
    `UPDATE user_invitations SET status = 'revoked' WHERE id = $1 AND org_id = $2`,
    [req.params.id, req.adminUser.orgId],
  );
  await writeAudit(req.adminUser.id, 'ADMIN_INVITATION_REVOKED', { invitationId: req.params.id });
  res.json({ ok: true });
});

export default router;
