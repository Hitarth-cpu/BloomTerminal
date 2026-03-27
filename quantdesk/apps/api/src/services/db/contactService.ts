import { query, transaction } from '../../db/postgres';

export interface Contact {
  id:                 string;
  owner_id:           string;
  contact_user_id:    string;
  nickname:           string | null;
  notes:              string | null;
  group_id:           string | null;
  is_favorite:        boolean;
  is_blocked:         boolean;
  tags:               string[];
  last_interacted_at: Date | null;
  created_at:         Date;
  updated_at:         Date;
}

export interface ContactWithUser extends Contact {
  email:        string;
  display_name: string;
  photo_url:    string | null;
  firm:         string | null;
  org_id:       string | null;
  org_role:     string;
}

export interface ContactGroup {
  id:         string;
  owner_id:   string;
  name:       string;
  color:      string;
  sort_order: number;
  created_at: Date;
}

export interface ContactRequest {
  id:           string;
  requester_id: string;
  target_id:    string;
  message:      string | null;
  status:       'pending' | 'accepted' | 'declined' | 'blocked';
  responded_at: Date | null;
  created_at:   Date;
}

// ─── Contact groups ────────────────────────────────────────────────────────────

export async function listGroups(ownerId: string): Promise<ContactGroup[]> {
  return query<ContactGroup>(
    'SELECT * FROM contact_groups WHERE owner_id = $1 ORDER BY sort_order ASC, name ASC',
    [ownerId],
  );
}

export async function createGroup(ownerId: string, name: string, color = '#ff6600'): Promise<ContactGroup> {
  const rows = await query<ContactGroup>(
    `INSERT INTO contact_groups (owner_id, name, color)
     VALUES ($1, $2, $3)
     ON CONFLICT (owner_id, name) DO UPDATE SET color = EXCLUDED.color
     RETURNING *`,
    [ownerId, name, color],
  );
  return rows[0];
}

// ─── Contact CRUD ──────────────────────────────────────────────────────────────

export async function listContacts(ownerId: string): Promise<ContactWithUser[]> {
  return query<ContactWithUser>(
    `SELECT c.*,
            u.email, u.display_name, u.photo_url, u.firm, u.org_id, u.org_role
     FROM contacts c
     JOIN users u ON u.id = c.contact_user_id
     WHERE c.owner_id = $1
       AND c.is_blocked = false
     ORDER BY c.is_favorite DESC, u.display_name ASC`,
    [ownerId],
  );
}

export async function addContact(
  ownerId: string,
  contactUserId: string,
  opts: { nickname?: string; groupId?: string; tags?: string[] } = {},
): Promise<Contact> {
  const rows = await query<Contact>(
    `INSERT INTO contacts (owner_id, contact_user_id, nickname, group_id, tags)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (owner_id, contact_user_id) DO UPDATE
       SET nickname = COALESCE(EXCLUDED.nickname, contacts.nickname),
           group_id = COALESCE(EXCLUDED.group_id, contacts.group_id),
           tags     = EXCLUDED.tags
     RETURNING *`,
    [ownerId, contactUserId, opts.nickname ?? null, opts.groupId ?? null, opts.tags ?? []],
  );
  return rows[0];
}

export async function removeContact(ownerId: string, contactUserId: string): Promise<boolean> {
  const rows = await query(
    'DELETE FROM contacts WHERE owner_id = $1 AND contact_user_id = $2 RETURNING id',
    [ownerId, contactUserId],
  );
  return rows.length > 0;
}

export async function updateContact(
  ownerId: string,
  contactUserId: string,
  patch: Partial<Pick<Contact, 'nickname' | 'notes' | 'group_id' | 'is_favorite' | 'is_blocked' | 'tags'>>,
): Promise<Contact | null> {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (!fields.length) return null;
  const values = fields.map(f => patch[f]);
  const set = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const rows = await query<Contact>(
    `UPDATE contacts SET ${set} WHERE owner_id = $1 AND contact_user_id = $2 RETURNING *`,
    [ownerId, contactUserId, ...values],
  );
  return rows[0] ?? null;
}

export async function touchLastInteracted(ownerId: string, contactUserId: string): Promise<void> {
  await query(
    'UPDATE contacts SET last_interacted_at = NOW() WHERE owner_id = $1 AND contact_user_id = $2',
    [ownerId, contactUserId],
  );
}

// ─── Contact requests ──────────────────────────────────────────────────────────

export async function sendContactRequest(
  requesterId: string,
  targetId: string,
  message?: string,
): Promise<ContactRequest> {
  const rows = await query<ContactRequest>(
    `INSERT INTO contact_requests (requester_id, target_id, message)
     VALUES ($1, $2, $3)
     ON CONFLICT (requester_id, target_id) DO UPDATE SET message = EXCLUDED.message
     RETURNING *`,
    [requesterId, targetId, message ?? null],
  );
  return rows[0];
}

export async function listIncomingRequests(userId: string): Promise<(ContactRequest & {
  requester_display_name: string; requester_email: string; requester_photo_url: string | null;
})[]> {
  return query(
    `SELECT cr.*, u.display_name AS requester_display_name,
            u.email AS requester_email, u.photo_url AS requester_photo_url
     FROM contact_requests cr
     JOIN users u ON u.id = cr.requester_id
     WHERE cr.target_id = $1 AND cr.status = 'pending'
     ORDER BY cr.created_at DESC`,
    [userId],
  );
}

export async function respondToRequest(
  requestId: string,
  targetId: string,
  accept: boolean,
): Promise<ContactRequest | null> {
  const status = accept ? 'accepted' : 'declined';

  return transaction(async (client) => {
    const rows = await client.query<ContactRequest>(
      `UPDATE contact_requests
       SET status = $1, responded_at = NOW()
       WHERE id = $2 AND target_id = $3
       RETURNING *`,
      [status, requestId, targetId],
    );
    const req = rows.rows[0];
    if (!req) return null;

    if (accept) {
      // Add both sides to each other's contacts
      await client.query(
        `INSERT INTO contacts (owner_id, contact_user_id)
         VALUES ($1, $2), ($2, $1)
         ON CONFLICT DO NOTHING`,
        [req.requester_id, req.target_id],
      );
    }
    return req;
  });
}
