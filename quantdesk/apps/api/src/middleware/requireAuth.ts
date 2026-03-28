import type { Request, Response, NextFunction } from 'express';
import { verifyIdToken, type DecodedToken } from '../services/auth/firebaseAdmin';
import { upsertFromFirebase, findById, recordAudit } from '../services/db/userService';
import type { User } from '../services/db/userService';
import { verifyDevToken } from '../routes/auth';
import { ensureOrgAssigned } from '../services/auth/onboardingService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user:        User;
      firebaseUid: string;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);

  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  // ── Dev token (non-production only) ────────────────────────────────────────
  const devUserId = verifyDevToken(token);
  if (devUserId) {
    try {
      const user = await findById(devUserId);
      if (!user || !user.is_active) { res.status(401).json({ error: 'Invalid dev token' }); return; }
      if (!user.org_id) {
        const orgId = await ensureOrgAssigned(user).catch(() => null);
        if (orgId) user.org_id = orgId;
      }
      req.user        = user;
      req.firebaseUid = user.firebase_uid;
      next();
    } catch (err) {
      console.error('[requireAuth] Dev token DB error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
    return;
  }

  // ── Firebase token ──────────────────────────────────────────────────────────
  let decoded: DecodedToken;
  try {
    decoded = await verifyIdToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    res.status(401).json({ error: message });
    return;
  }

  try {
    const user = await upsertFromFirebase({
      uid:     decoded.uid,
      email:   decoded.email,
      name:    decoded.name,
      picture: decoded.picture,
    });

    if (!user.is_active) {
      res.status(403).json({ error: 'Account deactivated' });
      return;
    }

    // Auto-assign org if missing — required for contacts, teams, broadcasts, chat, etc.
    if (!user.org_id) {
      const orgId = await ensureOrgAssigned(user).catch(() => null);
      if (orgId) user.org_id = orgId;
    }

    req.user        = user;
    req.firebaseUid = decoded.uid;

    // Fire-and-forget audit log — don't block the request
    recordAudit(user.id, 'api_request', {
      entityType: req.method,
      entityId:   req.path,
      ipAddress:  (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
                  ?? req.socket.remoteAddress,
      userAgent:  req.headers['user-agent'],
    }).catch(() => { /* non-critical */ });

    next();
  } catch (err) {
    console.error('[requireAuth] DB error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** Same as requireAuth but only verifies the token — does not upsert the user.
 *  Use for high-frequency paths (e.g. price subscriptions) to reduce DB load. */
export async function requireAuthLight(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);

  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  try {
    const decoded   = await verifyIdToken(token);
    req.firebaseUid = decoded.uid;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token verification failed';
    res.status(401).json({ error: message });
  }
}
