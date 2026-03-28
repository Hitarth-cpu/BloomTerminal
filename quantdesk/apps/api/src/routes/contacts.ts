import { Router } from 'express';
import {
  listContacts, addContact, removeContact, updateContact,
  listGroups, createGroup,
  sendContactRequest, listIncomingRequests, respondToRequest,
} from '../services/db/contactService';
import { searchOrgMembers, searchAllUsers } from '../services/db/orgService';
import { findById } from '../services/db/userService';

const router = Router();

// ─── Contact groups ────────────────────────────────────────────────────────────

/** GET /api/contacts/groups */
router.get('/groups', async (req, res) => {
  const groups = await listGroups(req.user.id);
  res.json({ groups });
});

/** POST /api/contacts/groups */
router.post('/groups', async (req, res) => {
  const { name, color } = req.body as { name?: string; color?: string };
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  const group = await createGroup(req.user.id, name, color);
  res.status(201).json({ group });
});

// ─── Contacts ──────────────────────────────────────────────────────────────────

/** GET /api/contacts */
router.get('/', async (req, res) => {
  const contacts = await listContacts(req.user.id);
  res.json({ contacts });
});

/** POST /api/contacts — add a contact directly (same org, no request needed) */
router.post('/', async (req, res) => {
  const { contactUserId, nickname, groupId, tags } = req.body as {
    contactUserId?: string; nickname?: string; groupId?: string; tags?: string[];
  };
  if (!contactUserId) { res.status(400).json({ error: 'contactUserId required' }); return; }

  // Verify the target user exists
  const target = await findById(contactUserId);
  if (!target) { res.status(404).json({ error: 'User not found' }); return; }

  const contact = await addContact(req.user.id, contactUserId, { nickname, groupId, tags });
  res.status(201).json({ contact });
});

/** PATCH /api/contacts/:userId */
router.patch('/:userId', async (req, res) => {
  const patch = req.body as Parameters<typeof updateContact>[2];
  const updated = await updateContact(req.user.id, req.params.userId, patch);
  if (!updated) { res.status(404).json({ error: 'Contact not found' }); return; }
  res.json({ contact: updated });
});

/** DELETE /api/contacts/:userId */
router.delete('/:userId', async (req, res) => {
  const ok = await removeContact(req.user.id, req.params.userId);
  if (!ok) { res.status(404).json({ error: 'Contact not found' }); return; }
  res.json({ ok: true });
});

// ─── Contact requests ──────────────────────────────────────────────────────────

/** GET /api/contacts/requests — incoming pending requests */
router.get('/requests', async (req, res) => {
  const requests = await listIncomingRequests(req.user.id);
  res.json({ requests });
});

/** POST /api/contacts/requests */
router.post('/requests', async (req, res) => {
  const { targetId, message } = req.body as { targetId?: string; message?: string };
  if (!targetId) { res.status(400).json({ error: 'targetId required' }); return; }
  const request = await sendContactRequest(req.user.id, targetId, message);
  res.status(201).json({ request });
});

/** POST /api/contacts/requests/:id/respond */
router.post('/requests/:id/respond', async (req, res) => {
  const { accept } = req.body as { accept?: boolean };
  if (accept === undefined) { res.status(400).json({ error: 'accept (boolean) required' }); return; }
  const result = await respondToRequest(req.params.id, req.user.id, accept);
  if (!result) { res.status(404).json({ error: 'Request not found' }); return; }
  res.json({ request: result });
});

// ─── Org user discovery (for add-partner autocomplete) ───────────────────────

/** GET /api/contacts/discover?q=alice */
router.get('/discover', async (req, res) => {
  const { q, limit } = req.query as { q?: string; limit?: string };
  if (!q) { res.status(400).json({ error: 'q required' }); return; }

  const me = await findById(req.user.id);
  const lim = limit ? Number(limit) : 20;
  const users = me?.org_id
    ? await searchOrgMembers(me.org_id, q, req.user.id, lim)
    : await searchAllUsers(q, req.user.id, lim);
  res.json({ users });
});

export default router;
