import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { createCipheriv, createDecipheriv, randomBytes as rb } from 'crypto';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { query } from '../../db/postgres';
import { redisPublisher } from '../../services/cache/pubsub';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encryptMfaSecret(secret: string): string {
  const key = (process.env.ADMIN_MFA_KEY ?? 'dev-mfa-key-change-in-production').padEnd(32, '0').slice(0, 32);
  const iv = rb(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = (cipher as import('crypto').CipherGCM).getAuthTag();
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

function decryptMfaSecret(encrypted: string): string {
  const [ivHex, encHex, tagHex] = encrypted.split(':');
  const key = (process.env.ADMIN_MFA_KEY ?? 'dev-mfa-key-change-in-production').padEnd(32, '0').slice(0, 32);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(ivHex, 'hex'));
  (decipher as import('crypto').DecipherGCM).setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

async function writeAdminAudit(userId: string, action: string, meta: Record<string, unknown> = {}): Promise<void> {
  await query(
    `INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, $2, $3)`,
    [userId, action, JSON.stringify(meta)],
  ).catch(() => {});
}

// ─── POST /api/admin/auth/login ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { firebaseToken, totpCode, email } = req.body as {
    firebaseToken: string; totpCode: string; email: string;
  };
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const ua = req.headers['user-agent'] ?? '';

  // Rate limit: 5 attempts per 15 minutes per email
  const rateLimitKey = `rate:admin_login:${email}`;
  const attempts = await redisPublisher.incr(rateLimitKey);
  if (attempts === 1) await redisPublisher.expire(rateLimitKey, 900);
  if (attempts > 5) {
    res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    return;
  }

  try {
    // Step 1: Verify Firebase token
    const { verifyIdToken } = await import('../../services/auth/firebaseAdmin');
    const decoded = await verifyIdToken(firebaseToken);

    // Step 2: Lookup user and check admin role
    const [user] = await query<{
      id: string; org_id: string; org_role: string; email: string;
      display_name: string; mfa_secret: string | null; mfa_enabled: boolean;
      admin_locked_until: string | null;
    }>(
      `SELECT id, org_id, org_role, email, display_name, mfa_secret, mfa_enabled, admin_locked_until
       FROM users WHERE firebase_uid = $1 AND is_active = true`,
      [decoded.uid],
    );

    if (!user || !['admin', 'super_admin'].includes(user.org_role)) {
      await writeAdminAudit(user?.id ?? 'unknown', 'ADMIN_LOGIN_FAILED', { reason: 'not_admin', email, ip });
      res.status(403).json({ error: 'Not authorized for admin access' });
      return;
    }

    // Check account lock
    if (user.admin_locked_until && new Date(user.admin_locked_until) > new Date()) {
      res.status(403).json({ error: 'Account temporarily locked. Contact your administrator.' });
      return;
    }

    // Step 3: MFA setup required if no secret stored
    if (!user.mfa_enabled || !user.mfa_secret) {
      res.json({ requiresMfaSetup: true, userId: user.id });
      return;
    }

    // Step 4: Verify TOTP
    const secret = decryptMfaSecret(user.mfa_secret);
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });

    if (!valid) {
      // Increment failed logins
      await query(
        `UPDATE users SET failed_admin_logins = failed_admin_logins + 1,
         admin_locked_until = CASE WHEN failed_admin_logins >= 4
           THEN NOW() + INTERVAL '15 minutes' ELSE admin_locked_until END
         WHERE id = $1`,
        [user.id],
      );
      await writeAdminAudit(user.id, 'ADMIN_LOGIN_FAILED', { reason: 'invalid_totp', ip });
      res.status(401).json({ error: 'Invalid MFA code' });
      return;
    }

    // Reset failed logins
    await query('UPDATE users SET failed_admin_logins = 0, admin_locked_until = NULL WHERE id = $1', [user.id]);

    // Step 5: Issue admin session
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4h

    await query(
      `INSERT INTO admin_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenHash, ip, ua, expiresAt.toISOString()],
    );

    // Clear rate limit on success
    await redisPublisher.del(rateLimitKey);

    await writeAdminAudit(user.id, 'ADMIN_LOGIN', { ip, ua });

    res.json({
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        orgId: user.org_id,
        orgRole: user.org_role,
      },
    });
  } catch (err) {
    console.error('[admin/auth] login error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ─── POST /api/admin/auth/logout ──────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await query('UPDATE admin_sessions SET is_revoked = true WHERE token_hash = $1', [tokenHash]).catch(() => {});
  }
  res.json({ ok: true });
});

// ─── POST /api/admin/auth/setup-mfa ──────────────────────────────────────────
router.post('/setup-mfa', async (req, res) => {
  const { userId } = req.body as { userId: string };
  const [user] = await query<{ email: string; org_role: string }>(
    'SELECT email, org_role FROM users WHERE id = $1 AND is_active = true',
    [userId],
  );
  if (!user || !['admin', 'super_admin'].includes(user.org_role)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const secret = speakeasy.generateSecret({
    name: `QuantDesk Admin (${user.email})`,
    length: 20,
  });

  // Store unconfirmed secret temporarily in Redis (5 min TTL)
  await redisPublisher.set(`admin:mfa_setup:${userId}`, secret.base32, 'EX', 300);

  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
  res.json({ qrCode: qrCodeUrl, secret: secret.base32 });
});

// ─── POST /api/admin/auth/verify-mfa ─────────────────────────────────────────
router.post('/verify-mfa', async (req, res) => {
  const { userId, totpCode } = req.body as { userId: string; totpCode: string };

  const base32Secret = await redisPublisher.get(`admin:mfa_setup:${userId}`);
  if (!base32Secret) {
    res.status(400).json({ error: 'MFA setup session expired. Please restart.' }); return;
  }

  const valid = speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token: totpCode,
    window: 1,
  });

  if (!valid) {
    res.status(401).json({ error: 'Invalid code. Please try again.' }); return;
  }

  const encrypted = encryptMfaSecret(base32Secret);
  await query(
    'UPDATE users SET mfa_secret = $1, mfa_enabled = true WHERE id = $2',
    [encrypted, userId],
  );
  await redisPublisher.del(`admin:mfa_setup:${userId}`);
  res.json({ ok: true, message: 'MFA configured successfully' });
});

// ─── POST /api/admin/auth/refresh ────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'No token' }); return; }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [session] = await query<{ user_id: string; expires_at: string; is_revoked: boolean }>(
    'SELECT user_id, expires_at, is_revoked FROM admin_sessions WHERE token_hash = $1',
    [tokenHash],
  );

  if (!session || session.is_revoked || new Date(session.expires_at) < new Date()) {
    res.status(401).json({ error: 'Session invalid or expired' }); return;
  }

  const newToken = randomBytes(32).toString('hex');
  const newHash = createHash('sha256').update(newToken).digest('hex');
  const newExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000);

  await query(
    `UPDATE admin_sessions SET token_hash = $1, expires_at = $2, last_active = NOW() WHERE token_hash = $3`,
    [newHash, newExpiry.toISOString(), tokenHash],
  );

  res.json({ token: newToken, expiresAt: newExpiry.toISOString() });
});

export default router;
