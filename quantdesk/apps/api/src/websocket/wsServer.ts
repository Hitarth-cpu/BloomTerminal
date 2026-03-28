import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { verifyDevToken } from '../routes/auth';
import { findById } from '../services/db/userService';
import { redisSubscriber, redisPublisher } from '../services/cache/pubsub';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WsEventType =
  | 'CONTACT_REQUEST_RECEIVED'
  | 'CONTACT_REQUEST_ACCEPTED'
  | 'BROADCAST_RECEIVED'
  | 'USER_PRESENCE_UPDATE'
  | 'IB_MESSAGE'
  | 'NEWS_UPDATE'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'ERROR';

export interface WsEvent {
  type: WsEventType;
  [key: string]: unknown;
}

// ─── Client registry: userId → Set<WebSocket> ────────────────────────────────

const clients = new Map<string, Set<WebSocket>>();

function registerClient(userId: string, ws: WebSocket): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(ws);
}

function removeClient(userId: string, ws: WebSocket): void {
  clients.get(userId)?.delete(ws);
  if (clients.get(userId)?.size === 0) clients.delete(userId);
}

function sendToUser(userId: string, event: WsEvent): void {
  const sockets = clients.get(userId);
  if (!sockets) return;
  const payload = JSON.stringify(event);
  sockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}

// ─── Redis → WebSocket bridge ─────────────────────────────────────────────────

// Track which chat rooms each user is subscribed to
const userRooms = new Map<string, Set<string>>();

async function subscribeUserChannels(userId: string): Promise<void> {
  const channels = [
    `user:notifications:${userId}`,
    `user:broadcasts:${userId}`,
    `user:presence:${userId}`,
  ];

  // Also subscribe to all chat rooms this user belongs to
  try {
    const { query } = await import('../db/postgres');
    const rooms = await query<{ room_id: string }>(
      'SELECT room_id FROM chat_members WHERE user_id = $1',
      [userId],
    );
    const roomChannels = rooms.map(r => `chat:${r.room_id}`);
    userRooms.set(userId, new Set(rooms.map(r => r.room_id)));
    channels.push(...roomChannels);
  } catch {
    // DB unavailable — user channels only
  }

  if (channels.length > 0) {
    await redisSubscriber.subscribe(...channels);
  }
}

// Global message handler (registered once)
let messageHandlerAttached = false;
function ensureMessageHandler(): void {
  if (messageHandlerAttached) return;
  messageHandlerAttached = true;

  redisSubscriber.on('message', (channel: string, message: string) => {
    try {
      const event = JSON.parse(message) as WsEvent;

      // Chat room message — deliver to all members of that room who are connected
      if (channel.startsWith('chat:') && !channel.startsWith('chat:online:') && !channel.startsWith('chat:presence')) {
        const roomId = channel.slice(5);
        // Find all connected users who are members of this room
        for (const [uid, rooms] of userRooms.entries()) {
          if (rooms.has(roomId)) {
            sendToUser(uid, { ...event, type: 'IB_MESSAGE' } as WsEvent);
          }
        }
        return;
      }

      // User-specific channels — deliver to that user
      for (const [uid] of clients.entries()) {
        if (
          channel === `user:notifications:${uid}` ||
          channel === `user:broadcasts:${uid}` ||
          channel === `user:presence:${uid}`
        ) {
          // Server-initiated room subscription (e.g. new DM room created)
          if (event.type === 'SUBSCRIBE_ROOM' && typeof event.roomId === 'string') {
            const roomId = event.roomId as string;
            redisSubscriber.subscribe(`chat:${roomId}`).catch(() => {});
            if (!userRooms.has(uid)) userRooms.set(uid, new Set());
            userRooms.get(uid)!.add(roomId);
            return; // Don't forward to client
          }
          sendToUser(uid, event);
        }
      }
    } catch { /* ignore parse errors */ }
  });
}

async function unsubscribeUserChannels(userId: string): Promise<void> {
  const channels = [
    `user:notifications:${userId}`,
    `user:broadcasts:${userId}`,
    `user:presence:${userId}`,
  ];
  // Unsubscribe from chat rooms
  const rooms = userRooms.get(userId);
  if (rooms) {
    channels.push(...[...rooms].map(r => `chat:${r}`));
    userRooms.delete(userId);
  }
  await redisSubscriber.unsubscribe(...channels).catch(() => {});
}

// ─── Presence helpers ─────────────────────────────────────────────────────────

async function setOnline(userId: string): Promise<void> {
  const prev = await redisPublisher.get(`chat:online:${userId}`);
  await redisPublisher.set(`chat:online:${userId}`, 'online', 'EX', 30);
  if (!prev) {
    // Fan out presence update to contacts
    await fanOutPresence(userId, 'online');
  }
}

async function setOffline(userId: string): Promise<void> {
  await redisPublisher.del(`chat:online:${userId}`);
  await fanOutPresence(userId, 'offline');
}

async function fanOutPresence(userId: string, status: 'online' | 'away' | 'offline'): Promise<void> {
  try {
    const { query } = await import('../db/postgres');
    // Fan out to everyone who shares a DM room with this user (bidirectional)
    const peers = await query<{ user_id: string }>(
      `SELECT DISTINCT cm2.user_id
       FROM chat_members cm1
       JOIN chat_members cm2 ON cm1.room_id = cm2.room_id
       WHERE cm1.user_id = $1 AND cm2.user_id <> $1`,
      [userId],
    );
    // Also fan out to contacts list (for users who haven't chatted yet)
    const contactPeers = await query<{ contact_user_id: string }>(
      `SELECT contact_user_id FROM contacts
       WHERE (owner_id = $1 OR contact_user_id = $1) AND is_blocked = false`,
      [userId],
    );
    const allPeerIds = new Set([
      ...peers.map(p => p.user_id),
      ...contactPeers.map(c => c.contact_user_id === userId ? c.contact_user_id : c.contact_user_id),
    ]);
    const event: WsEvent = { type: 'USER_PRESENCE_UPDATE', userId, status };
    for (const peerId of allPeerIds) {
      if (peerId === userId) continue;
      await redisPublisher.publish(`user:presence:${peerId}`, JSON.stringify(event));
    }
  } catch { /* non-fatal */ }
}

// ─── Authenticate WebSocket upgrade ──────────────────────────────────────────

async function authenticateRequest(req: IncomingMessage): Promise<string | null> {
  try {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) return null;

    // Try dev token first
    const userId = verifyDevToken(token);
    if (userId) {
      const user = await findById(userId);
      return user?.is_active ? userId : null;
    }

    // Try Firebase token
    const { verifyIdToken } = await import('../services/auth/firebaseAdmin');
    const decoded = await verifyIdToken(token);
    const { findByFirebaseUid } = await import('../services/db/userService');
    const user = await findByFirebaseUid(decoded.uid);
    return user?.is_active ? user.id : null;
  } catch {
    return null;
  }
}

// ─── Attach WebSocket server to HTTP server ───────────────────────────────────

export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const userId = await authenticateRequest(req);
    if (!userId) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    registerClient(userId, ws);
    ensureMessageHandler();
    await subscribeUserChannels(userId);
    await setOnline(userId);

    console.log(`[ws] ${userId} connected (${clients.get(userId)?.size ?? 1} sockets)`);

    // Heartbeat handler
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

    const resetHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(async () => {
        // No heartbeat received in 35s — consider offline
        await setOffline(userId).catch(() => {});
        ws.terminate();
      }, 35_000);
    };
    resetHeartbeat();

    ws.on('message', async (raw) => {
      try {
        const msg: WsEvent = JSON.parse(String(raw));
        if (msg.type === 'HEARTBEAT') {
          await setOnline(userId);
          resetHeartbeat();
          ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', ts: Date.now() }));
        }
        // Client requests subscription to a specific chat room
        if (msg.type === 'SUBSCRIBE_ROOM' && typeof msg.roomId === 'string') {
          const roomId = msg.roomId as string;
          try {
            const { query } = await import('../db/postgres');
            const [member] = await query<{ room_id: string }>(
              'SELECT room_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
              [roomId, userId],
            );
            if (member) {
              await redisSubscriber.subscribe(`chat:${roomId}`);
              if (!userRooms.has(userId)) userRooms.set(userId, new Set());
              userRooms.get(userId)!.add(roomId);
            }
          } catch { /* non-fatal */ }
        }
      } catch { /* ignore malformed messages */ }
    });

    ws.on('close', async () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      removeClient(userId, ws);
      // Only go offline if no other sockets remain for this user
      if (!clients.has(userId)) {
        await unsubscribeUserChannels(userId);
        await setOffline(userId).catch(() => {});
      }
      console.log(`[ws] ${userId} disconnected`);
    });

    ws.on('error', () => { /* handled by close */ });
  });

  console.log('[ws] WebSocket server attached at /ws');
  return wss;
}

// ─── Publish helpers used by service layer ────────────────────────────────────

export async function notifyUser(userId: string, event: WsEvent): Promise<void> {
  await redisPublisher.publish(
    `user:notifications:${userId}`,
    JSON.stringify(event),
  );
}

export async function notifyBroadcast(userId: string, event: { type: string; [k: string]: unknown }): Promise<void> {
  await redisPublisher.publish(
    `user:broadcasts:${userId}`,
    JSON.stringify(event),
  );
}
