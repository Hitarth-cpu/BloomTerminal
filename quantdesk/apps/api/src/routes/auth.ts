import { Router } from 'express';
import { createHmac } from 'crypto';
import { verifyIdToken } from '../services/auth/firebaseAdmin';
import { upsertFromFirebase, updateLastLogin, recordAudit } from '../services/db/userService';
import { onboardNewUser } from '../services/auth/onboardingService';
import { setSession } from '../services/cache/sessionCache';

export function createDevToken(userId: string): string {
  const ts     = Date.now().toString();
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
  const hmac   = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex');
  return `${Buffer.from(userId).toString('base64url')}.${ts}.${hmac}`;
}

export function verifyDevToken(token: string): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const [b64, ts, hmac] = token.split('.');
    if (!b64 || !ts || !hmac) return null;
    const userId = Buffer.from(b64, 'base64url').toString();
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
    const expected = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex');
    if (expected !== hmac) return null;
    if (Date.now() - parseInt(ts) > 86_400_000) return null; // 24h expiry
    return userId;
  } catch { return null; }
}

const router = Router();

/** POST /api/auth/login
 *  Body: { idToken: string }
 *  Verifies Firebase token, upserts user, seeds Redis session. */
router.post('/login', async (req, res) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) { res.status(400).json({ error: 'idToken required' }); return; }

  try {
    const decoded = await verifyIdToken(idToken);
    const user    = await upsertFromFirebase(decoded);

    if (!user.is_active) { res.status(403).json({ error: 'Account deactivated' }); return; }

    // Onboard if first login (no org assigned)
    if (!user.org_id && decoded.email) {
      const domain = decoded.email.split('@')[1];
      if (domain) await onboardNewUser(user, domain).catch(() => {});
    }

    await Promise.all([
      updateLastLogin(user.id),
      setSession(user.id, { userId: user.id, firebaseUid: decoded.uid, email: user.email }),
      recordAudit(user.id, 'login', {
        ipAddress: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
                   ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }),
    ]);

    res.json({ user, ...(process.env.NODE_ENV !== 'production' && { token: createDevToken(user.id) }) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    res.status(401).json({ error: message });
  }
});

/** POST /api/auth/logout
 *  Body: { idToken: string } */
router.post('/logout', async (req, res) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) { res.status(400).json({ error: 'idToken required' }); return; }

  try {
    const decoded = await verifyIdToken(idToken);
    const { deleteSession } = await import('../services/cache/sessionCache');
    await deleteSession(decoded.uid);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // Always succeed on logout
  }
});

/** GET /api/auth/invite/:token — fetch invitation details (no auth required) */
router.get('/invite/:token', async (req, res) => {
  const { token } = req.params;
  const { query: dbQuery } = await import('../db/postgres');
  const [inv] = await dbQuery<{
    id: string; email: string; first_name: string | null; last_name: string | null;
    intended_role: string; status: string; expires_at: string; org_name: string;
    invited_by_name: string;
  }>(
    `SELECT i.id, i.email, i.first_name, i.last_name, i.intended_role, i.status, i.expires_at,
            o.name AS org_name, u.display_name AS invited_by_name
     FROM user_invitations i
     JOIN organizations o ON o.id = i.org_id
     JOIN users u ON u.id = i.invited_by
     WHERE i.token = $1`,
    [token],
  ).catch(() => [] as never[]);

  if (!inv) { res.status(404).json({ error: 'Invitation not found' }); return; }
  if (inv.status !== 'pending') { res.status(410).json({ error: 'Invitation already used or revoked' }); return; }
  if (new Date(inv.expires_at) < new Date()) { res.status(410).json({ error: 'Invitation has expired' }); return; }

  res.json({ invitation: inv });
});

/** POST /api/auth/accept-invite — accept an invitation after Firebase sign-up */
router.post('/accept-invite', async (req, res) => {
  const { token, idToken } = req.body as { token?: string; idToken?: string };
  if (!token || !idToken) { res.status(400).json({ error: 'token and idToken required' }); return; }

  const { query: dbQuery, transaction } = await import('../db/postgres');

  // Verify firebase token
  let decoded: Awaited<ReturnType<typeof verifyIdToken>>;
  try { decoded = await verifyIdToken(idToken); } catch {
    res.status(401).json({ error: 'Invalid Firebase token' }); return;
  }

  // Load invitation
  const [inv] = await dbQuery<{
    id: string; org_id: string; email: string; first_name: string | null; last_name: string | null;
    intended_role: string; intended_teams: string[]; status: string; expires_at: string;
  }>(
    `SELECT id, org_id, email, first_name, last_name, intended_role, intended_teams, status, expires_at
     FROM user_invitations WHERE token = $1`,
    [token],
  ).catch(() => [] as never[]);

  if (!inv) { res.status(404).json({ error: 'Invitation not found' }); return; }
  if (inv.status !== 'pending') { res.status(410).json({ error: 'Invitation already used or revoked' }); return; }
  if (new Date(inv.expires_at) < new Date()) { res.status(410).json({ error: 'Invitation has expired' }); return; }

  // Upsert user then assign org + role
  const user = await upsertFromFirebase({
    uid: decoded.uid, email: decoded.email ?? inv.email,
    name: inv.first_name ? `${inv.first_name} ${inv.last_name ?? ''}`.trim() : decoded.name,
    picture: decoded.picture,
  });

  await transaction(async (client) => {
    await client.query(
      `UPDATE users SET org_id = $1, org_role = $2, team_ids = $3, is_active = true
       WHERE id = $4`,
      [inv.org_id, inv.intended_role, inv.intended_teams, user.id],
    );
    await client.query(
      `UPDATE user_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [inv.id],
    );
  });

  await Promise.all([
    updateLastLogin(user.id),
    setSession(user.id, { userId: user.id, firebaseUid: decoded.uid, email: user.email }),
    recordAudit(user.id, 'invite_accepted', { metadata: { invitationId: inv.id, orgId: inv.org_id, role: inv.intended_role } }),
  ]);

  res.json({ ok: true, user, ...(process.env.NODE_ENV !== 'production' && { token: createDevToken(user.id) }) });
});

/** GET /api/auth/check?email=x — check if an account exists (no auth required) */
router.get('/check', async (req, res) => {
  const { email } = req.query as { email?: string };
  if (!email) { res.status(400).json({ error: 'email required' }); return; }
  const { findByEmail } = await import('../services/db/userService');
  const user = await findByEmail(email).catch(() => null);
  res.json({ exists: !!user });
});

/** POST /api/auth/dev-login  ── DEVELOPMENT ONLY
 *  Accepts mock user data directly (no Firebase token needed).
 *  Disabled in production. */
router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' }); return;
  }

  const { uid, email, name, picture, firm } = req.body as {
    uid?: string; email?: string; name?: string; picture?: string; firm?: string;
  };
  if (!uid || !email) { res.status(400).json({ error: 'uid and email required' }); return; }

  const user = await upsertFromFirebase({ uid, email, name, picture, firm });

  // Onboard if first login (no org assigned)
  if (!user.org_id) {
    const domain = email.split('@')[1];
    if (domain) await onboardNewUser(user, domain).catch(() => {});
  }

  await Promise.all([
    updateLastLogin(user.id),
    setSession(user.id, { userId: user.id, firebaseUid: uid, email: user.email }),
  ]);
  res.json({ user, token: createDevToken(user.id) });
});

export default router;
