import { query } from '../../db/postgres';

export interface Organization {
  id:           string;
  name:         string;
  slug:         string;
  display_name: string;
  logo_url:     string | null;
  domain:       string | null;
  plan:         string;
  is_active:    boolean;
  settings:     Record<string, unknown>;
  created_at:   Date;
  updated_at:   Date;
}

export async function findOrgById(id: string): Promise<Organization | null> {
  const rows = await query<Organization>('SELECT * FROM organizations WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findOrgBySlug(slug: string): Promise<Organization | null> {
  const rows = await query<Organization>('SELECT * FROM organizations WHERE slug = $1', [slug]);
  return rows[0] ?? null;
}

export async function findOrgByDomain(domain: string): Promise<Organization | null> {
  const rows = await query<Organization>('SELECT * FROM organizations WHERE domain = $1 AND is_active = true', [domain]);
  return rows[0] ?? null;
}

/** Assign user to org. If user already has an org, updates it. */
export async function assignUserToOrg(
  userId: string,
  orgId: string,
  role: 'member' | 'team_lead' | 'admin' | 'super_admin' = 'member',
): Promise<void> {
  await query(
    'UPDATE users SET org_id = $1, org_role = $2 WHERE id = $3',
    [orgId, role, userId],
  );
}

/** Returns org members visible to other members (is_org_visible = true). */
export async function listOrgMembers(orgId: string): Promise<{
  id: string; email: string; display_name: string; photo_url: string | null;
  org_role: string; firm: string | null;
}[]> {
  return query(
    `SELECT id, email, display_name, photo_url, org_role, firm
     FROM users
     WHERE org_id = $1 AND is_active = true AND is_org_visible = true
     ORDER BY display_name ASC`,
    [orgId],
  );
}

/** Search org members by name or email. Used for add-partner autocomplete. */
export async function searchOrgMembers(
  orgId: string,
  q: string,
  excludeUserId: string,
  limit = 20,
): Promise<{ id: string; email: string; display_name: string; photo_url: string | null; firm: string | null }[]> {
  return query(
    `SELECT id, email, display_name, photo_url, firm
     FROM users
     WHERE org_id = $1
       AND id <> $2
       AND is_active = true
       AND (display_name ILIKE $3 OR email ILIKE $3)
     ORDER BY
       CASE WHEN display_name ILIKE $4 THEN 0 ELSE 1 END,
       display_name ASC
     LIMIT $5`,
    [orgId, excludeUserId, `%${q}%`, `${q}%`, limit],
  );
}

/** Search all active users by name or email. When orgId is provided, org members are ranked first. */
export async function searchAllUsers(
  q: string,
  excludeUserId: string,
  limit = 20,
  orgId: string | null = null,
): Promise<{ id: string; email: string; display_name: string; photo_url: string | null; firm: string | null }[]> {
  if (orgId) {
    return query(
      `SELECT id, email, display_name, photo_url, firm
       FROM users
       WHERE id <> $1
         AND is_active = true
         AND (display_name ILIKE $2 OR email ILIKE $2)
       ORDER BY
         CASE WHEN org_id = $4 THEN 0 ELSE 1 END,
         CASE WHEN display_name ILIKE $3 THEN 0 ELSE 1 END,
         display_name ASC
       LIMIT $5`,
      [excludeUserId, `%${q}%`, `${q}%`, orgId, limit],
    );
  }
  return query(
    `SELECT id, email, display_name, photo_url, firm
     FROM users
     WHERE id <> $1
       AND is_active = true
       AND (display_name ILIKE $2 OR email ILIKE $2)
     ORDER BY
       CASE WHEN display_name ILIKE $3 THEN 0 ELSE 1 END,
       display_name ASC
     LIMIT $4`,
    [excludeUserId, `%${q}%`, `${q}%`, limit],
  );
}
