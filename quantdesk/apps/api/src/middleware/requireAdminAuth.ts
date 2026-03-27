import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { query } from '../db/postgres';
import { redisPublisher } from '../services/cache/pubsub';

declare global {
  namespace Express {
    interface Request {
      adminUser: {
        id: string;
        orgId: string;
        orgRole: string;
        email: string;
        displayName: string;
      };
    }
  }
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }

  // Check rate limit: 100 req/min per session
  const rateLimitKey = `rate:admin_api:${token.slice(0, 16)}`;
  const count = await redisPublisher.incr(rateLimitKey);
  if (count === 1) await redisPublisher.expire(rateLimitKey, 60);
  if (count > 100) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const [session] = await query<{
    user_id: string; expires_at: string; is_revoked: boolean;
    org_id: string; org_role: string; email: string; display_name: string;
    ip_address: string | null;
  }>(
    `SELECT s.user_id, s.expires_at, s.is_revoked,
            u.org_id, u.org_role, u.email, u.display_name
     FROM admin_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [tokenHash],
  );

  if (!session || session.is_revoked) {
    res.status(401).json({ error: 'Invalid or revoked admin session' });
    return;
  }

  if (new Date(session.expires_at) < new Date()) {
    res.status(401).json({ error: 'Admin session expired' });
    return;
  }

  if (!['admin', 'super_admin'].includes(session.org_role)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  // Update last_active
  await query(
    'UPDATE admin_sessions SET last_active = NOW() WHERE token_hash = $1',
    [tokenHash],
  ).catch(() => {});

  req.adminUser = {
    id: session.user_id,
    orgId: session.org_id,
    orgRole: session.org_role,
    email: session.email,
    displayName: session.display_name,
  };

  next();
}
