import { query, transaction } from '../../db/postgres';
import type { PoolClient }   from 'pg';

export interface User {
  id:             string;
  firebase_uid:   string;
  email:          string;
  display_name:   string;
  photo_url:      string | null;
  firm:           string | null;
  role:           string | null;
  is_active:      boolean;
  org_id:         string | null;
  org_role:       string;
  team_ids:       string[];
  is_org_visible: boolean;
  created_at:     Date;
  updated_at:     Date;
  last_login_at:  Date | null;
}

export async function findByFirebaseUid(uid: string): Promise<User | null> {
  const rows = await query<User>('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<User | null> {
  const rows = await query<User>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const rows = await query<User>('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] ?? null;
}

/** Upsert a user from a Firebase decoded token. Returns the Postgres user row. */
export async function upsertFromFirebase(decoded: {
  uid:          string;
  email?:       string;
  name?:        string;
  picture?:     string;
  firm?:        string;
  role?:        string;
}): Promise<User> {
  const rows = await query<User>(`
    INSERT INTO users (firebase_uid, email, display_name, photo_url, firm, role, last_login_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (firebase_uid) DO UPDATE
      SET email         = EXCLUDED.email,
          display_name  = EXCLUDED.display_name,
          photo_url     = EXCLUDED.photo_url,
          firm          = COALESCE(EXCLUDED.firm, users.firm),
          role          = COALESCE(EXCLUDED.role, users.role),
          last_login_at = NOW()
    RETURNING *
  `, [decoded.uid, decoded.email ?? '', decoded.name ?? decoded.email ?? 'Unknown', decoded.picture ?? null, decoded.firm ?? null, decoded.role ?? null]);
  return rows[0];
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<User, 'display_name' | 'firm' | 'role' | 'photo_url'>>,
): Promise<User | null> {
  const fields  = Object.keys(patch) as (keyof typeof patch)[];
  const values  = fields.map(f => patch[f]);
  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  if (!setClause) return findById(userId);

  const rows = await query<User>(
    `UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`,
    [userId, ...values],
  );
  return rows[0] ?? null;
}

export async function updateLastLogin(userId: string, client?: PoolClient): Promise<void> {
  const sql = 'UPDATE users SET last_login_at = NOW() WHERE id = $1';
  if (client) {
    await client.query(sql, [userId]);
  } else {
    await query(sql, [userId]);
  }
}

export async function deactivate(userId: string): Promise<void> {
  await query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
}

export async function recordAudit(
  userId: string | null,
  action: string,
  opts?: { entityType?: string; entityId?: string; ipAddress?: string; userAgent?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5::inet, $6, $7)`,
    [userId, action, opts?.entityType ?? null, opts?.entityId ?? null,
     opts?.ipAddress ?? null, opts?.userAgent ?? null, JSON.stringify(opts?.metadata ?? {})],
  );
}

export async function deleteExpiredSessions(): Promise<number> {
  const rows = await query<{ count: string }>(
    `DELETE FROM user_sessions WHERE expires_at < NOW() RETURNING id`,
  );
  return rows.length;
}

export { transaction };
