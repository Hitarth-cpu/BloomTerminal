import { query, transaction } from '../../db/postgres';
import * as userSvc from '../db/userService';
import type { User } from '../db/userService';

const { recordAudit, findById, upsertFromFirebase, updateLastLogin } = userSvc;

// ─── Default contact groups created for every new user ──────────────────────
const DEFAULT_GROUPS = [
  { name: 'Internal',       color: '#ff6600', sort_order: 0 },
  { name: 'Counterparties', color: '#00c8ff', sort_order: 1 },
  { name: 'Research',       color: '#a8ff78', sort_order: 2 },
  { name: 'Brokers',        color: '#f7d060', sort_order: 3 },
];

// ─── Default teams created when a user founds a new org ─────────────────────
const DEFAULT_TEAMS = [
  { name: 'Trading',    team_type: 'trading_desk', color: '#ff6600' },
  { name: 'Research',   team_type: 'research',     color: '#00c8ff' },
  { name: 'Risk',       team_type: 'risk',         color: '#ff3d3d' },
  { name: 'Operations', team_type: 'operations',   color: '#a8ff78' },
];

// ─── Create the system broadcast bot for an org ──────────────────────────────
async function createOrgBotUser(
  orgId: string, orgName: string, orgSlug: string, logoUrl: string | null,
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO users
       (firebase_uid, email, display_name, photo_url, org_id, org_role, is_org_visible, is_active)
     VALUES ($1, $2, $3, $4, $5, 'system', false, true)
     ON CONFLICT (firebase_uid) DO UPDATE
       SET display_name = EXCLUDED.display_name, photo_url = EXCLUDED.photo_url
     RETURNING id`,
    [
      `bot-${orgId}`,
      `broadcasts@${orgSlug}.quantdesk.internal`,
      `${orgName} Broadcasts`,
      logoUrl,
      orgId,
    ],
  );
  const botId = rows[0].id;

  // Store botUserId in org settings
  await query(
    `UPDATE organizations SET settings = settings || jsonb_build_object('botUserId', $1::text) WHERE id = $2`,
    [botId, orgId],
  );
  return botId;
}

// ─── Main onboarding entry point ─────────────────────────────────────────────

export async function onboardNewUser(user: User, emailDomain: string): Promise<void> {
  // 1. Look for an existing org by domain
  const [matchedOrg] = await query<{
    id: string; name: string; slug: string; display_name: string;
    logo_url: string | null; settings: Record<string, unknown>;
  }>(
    'SELECT id, name, slug, display_name, logo_url, settings FROM organizations WHERE domain = $1 AND is_active = true',
    [emailDomain],
  );

  await transaction(async (client) => {
    if (matchedOrg) {
      // ── Auto-join existing org ───────────────────────────────────────────
      const autoJoin = (matchedOrg.settings as { autoJoin?: boolean })?.autoJoin !== false;
      if (autoJoin) {
        await client.query(
          'UPDATE users SET org_id = $1, org_role = $2 WHERE id = $3',
          [matchedOrg.id, 'member', user.id],
        );
        await _createDefaultGroups(client, user.id);
        await _createDefaultPersonalization(client, user.id);
        await recordAudit(user.id, 'USER_AUTO_JOINED_ORG', { entityType: 'organization', entityId: matchedOrg.id });
      }
    } else {
      // ── Found no org → create one, user becomes super_admin ─────────────
      const slug = emailDomain
        .replace(/\./g, '-')
        .replace(/[^a-z0-9-]/gi, '')
        .toLowerCase();

      // Handle duplicate slugs
      const slugCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM organizations WHERE slug LIKE $1`,
        [`${slug}%`],
      );
      const suffix = Number(slugCount.rows[0].count) > 0 ? `-${slugCount.rows[0].count}` : '';
      const finalSlug = `${slug}${suffix}`;

      const orgDisplay = emailDomain
        .split('.')[0]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      const [org] = (await client.query<{ id: string; name: string; slug: string; display_name: string }>(
        `INSERT INTO organizations (name, slug, display_name, domain, plan, settings)
         VALUES ($1, $2, $3, $4, 'standard', '{"autoJoin": true}')
         RETURNING id, name, slug, display_name`,
        [orgDisplay, finalSlug, orgDisplay, emailDomain],
      )).rows;

      // Assign user as super_admin
      await client.query(
        'UPDATE users SET org_id = $1, org_role = $2 WHERE id = $3',
        [org.id, 'super_admin', user.id],
      );

      // Create default teams
      for (const t of DEFAULT_TEAMS) {
        await client.query(
          `INSERT INTO teams (org_id, name, team_type, color, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [org.id, t.name, t.team_type, t.color, user.id],
        );
      }

      // Create system bot
      const botId = await createOrgBotUser(org.id, org.display_name, org.slug, null);
      await recordAudit(user.id, 'ORG_BOT_CREATED', { entityType: 'user', entityId: botId });

      await _createDefaultGroups(client, user.id);
      await _createDefaultPersonalization(client, user.id);
      await recordAudit(user.id, 'USER_CREATED_ORG', { entityType: 'organization', entityId: org.id });
      await recordAudit(user.id, 'USER_ONBOARDED');
    }
  });
}

async function _createDefaultGroups(client: { query: Function }, userId: string): Promise<void> {
  for (const g of DEFAULT_GROUPS) {
    await client.query(
      `INSERT INTO contact_groups (owner_id, name, color, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_id, name) DO NOTHING`,
      [userId, g.name, g.color, g.sort_order],
    );
  }
}

async function _createDefaultPersonalization(client: { query: Function }, userId: string): Promise<void> {
  await client.query(
    `INSERT INTO user_personalization (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

export { findById, upsertFromFirebase, updateLastLogin, recordAudit } from '../db/userService';
