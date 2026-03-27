import { Router } from 'express';
import { createHmac, randomBytes } from 'crypto';
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

  const { uid, email, name, picture } = req.body as {
    uid?: string; email?: string; name?: string; picture?: string;
  };
  if (!uid || !email) { res.status(400).json({ error: 'uid and email required' }); return; }

  const user = await upsertFromFirebase({ uid, email, name, picture });

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
