import { Router } from 'express';
import {
  saveMessage, getMessages, markDelivered, markRead,
  softDeleteMessage, savePublicKey, getPublicKey,
  type NewMessage,
} from '../services/db/chatService';
import { publishMessage, redisPublisher } from '../services/cache/pubsub';
import { query } from '../db/postgres';

const router = Router();

/** GET /api/chat/rooms — list rooms the current user belongs to */
router.get('/rooms', async (req, res) => {
  const rooms = await query<{
    room_id: string; room_name: string; room_type: string;
    other_user_id: string | null; other_display_name: string | null;
    other_photo_url: string | null;
  }>(`
    SELECT cm.room_id, cr.name AS room_name, cr.room_type,
           ou.id AS other_user_id, ou.display_name AS other_display_name,
           ou.photo_url AS other_photo_url
    FROM chat_members cm
    JOIN chat_rooms cr ON cr.id = cm.room_id
    LEFT JOIN chat_members cm2 ON cm2.room_id = cm.room_id AND cm2.user_id != $1
    LEFT JOIN users ou ON ou.id = cm2.user_id
    WHERE cm.user_id = $1
    ORDER BY cr.created_at DESC
  `, [req.user.id]);
  res.json({ rooms });
});

/** GET /api/chat/dm/:contactUserId — find or create DM room with contact */
router.get('/dm/:contactUserId', async (req, res) => {
  const { contactUserId } = req.params;
  const myId = req.user.id;

  // Find existing DM room between these two users
  const existing = await query<{ room_id: string }>(`
    SELECT cm1.room_id FROM chat_members cm1
    JOIN chat_members cm2 ON cm1.room_id = cm2.room_id
    JOIN chat_rooms cr ON cr.id = cm1.room_id
    WHERE cm1.user_id = $1 AND cm2.user_id = $2 AND cr.room_type = 'DirectMessage'
    LIMIT 1
  `, [myId, contactUserId]);

  if (existing.length > 0) {
    res.json({ roomId: existing[0].room_id });
    return;
  }

  // Create new DM room
  const [room] = await query<{ id: string }>(`
    INSERT INTO chat_rooms (name, room_type, created_by)
    VALUES ('DM', 'DirectMessage', $1) RETURNING id
  `, [myId]);

  await query(`
    INSERT INTO chat_members (room_id, user_id)
    VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING
  `, [room.id, myId, contactUserId]);

  // Push both users to subscribe to the new room channel in real-time
  const subEvent = JSON.stringify({ type: 'SUBSCRIBE_ROOM', roomId: room.id });
  await Promise.all([
    redisPublisher.publish(`user:notifications:${myId}`, subEvent),
    redisPublisher.publish(`user:notifications:${contactUserId}`, subEvent),
  ]).catch(() => {});

  res.json({ roomId: room.id });
});

/** GET /api/chat/rooms/:roomId/messages */
router.get('/rooms/:roomId/messages', async (req, res) => {
  const { before, limit } = req.query as { before?: string; limit?: string };
  const messages = await getMessages(req.params.roomId, {
    before: before ? new Date(before) : undefined,
    limit:  limit  ? Number(limit)    : undefined,
  });
  res.json({ messages });
});

/** POST /api/chat/rooms/:roomId/messages */
router.post('/rooms/:roomId/messages', async (req, res) => {
  const body = req.body as Omit<NewMessage, 'chatRoomId' | 'senderId' | 'encryptionVersion'>;
  const payload: NewMessage = {
    ...body,
    chatRoomId:        req.params.roomId,
    senderId:          req.user.id,
    encryptionVersion: 'AES256GCM_V1',
  };

  const id = await saveMessage(payload);

  // Publish to Redis for real-time subscribers
  await publishMessage(req.params.roomId, {
    type:        'IB_MESSAGE',
    chatRoomId:  req.params.roomId,
    senderId:    req.user.id,
    messageId:   id,
    encrypted:   payload.encrypted,
    aad:         payload.aad,
    timestamp:   Date.now(),
  });

  res.status(201).json({ id });
});

/** PATCH /api/chat/messages/:id/delivered */
router.patch('/messages/:id/delivered', async (req, res) => {
  await markDelivered(req.params.id, req.user.id);
  res.json({ ok: true });
});

/** PATCH /api/chat/messages/:id/read */
router.patch('/messages/:id/read', async (req, res) => {
  await markRead(req.params.id, req.user.id);
  res.json({ ok: true });
});

/** DELETE /api/chat/messages/:id */
router.delete('/messages/:id', async (req, res) => {
  const deleted = await softDeleteMessage(req.params.id, req.user.id);
  if (!deleted) { res.status(404).json({ error: 'Message not found or not authorised' }); return; }
  res.json({ ok: true });
});

/** PUT /api/chat/keys — publish ECDH public key */
router.put('/keys', async (req, res) => {
  const { publicKey } = req.body as { publicKey?: string };
  if (!publicKey) { res.status(400).json({ error: 'publicKey required' }); return; }
  await savePublicKey(req.user.id, publicKey);
  res.json({ ok: true });
});

/** GET /api/chat/keys/:userId */
router.get('/keys/:userId', async (req, res) => {
  const key = await getPublicKey(req.params.userId);
  if (!key) { res.status(404).json({ error: 'No public key for user' }); return; }
  res.json({ publicKey: key });
});

export default router;
