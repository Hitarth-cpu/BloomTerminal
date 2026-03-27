/**
 * Pub/Sub service for IB Chat real-time delivery.
 *
 * Two separate ioredis clients are used:
 *   redis     (from db/redis) — publishes commands
 *   redisSub  (from db/redis) — dedicated subscriber (subscribe locks the conn)
 */

import { redis, redisSub } from '../../db/redis';

// Named exports used by wsServer.ts
export const redisPublisher  = redis;
export const redisSubscriber = redisSub;

export interface IBMessagePayload {
  type:       'IB_MESSAGE' | 'IB_TYPING' | 'IB_READ' | 'PRESENCE';
  chatRoomId?: string;
  senderId?:   string;
  messageId?:  string;
  encrypted?: {
    iv:         string;
    ciphertext: string;
    tag:        string;
  };
  aad?: {
    chatRoomId:  string;
    senderId:    string;
    messageType: string;
  };
  timestamp: number;
}

// ─── Publish ──────────────────────────────────────────────────────────────────

export async function publishMessage(
  chatRoomId: string,
  payload: IBMessagePayload,
): Promise<void> {
  await redis.publish(`chat:${chatRoomId}`, JSON.stringify(payload));
}

export async function publishPresence(
  userId: string,
  status: 'online' | 'away' | 'offline',
): Promise<void> {
  // Set key with TTL for presence indicator
  if (status !== 'offline') {
    await redis.set(`chat:online:${userId}`, status, 'EX', 30);
  } else {
    await redis.del(`chat:online:${userId}`);
  }
  // Broadcast to a global presence channel
  await redis.publish('chat:presence', JSON.stringify({ userId, status, timestamp: Date.now() }));
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

const roomHandlers = new Map<string, Set<(payload: IBMessagePayload) => void>>();

// Single message handler on the subscriber client
redisSub.on('message', (channel: string, raw: string) => {
  const roomId = channel.startsWith('chat:') ? channel.slice(5) : channel;
  const handlers = roomHandlers.get(roomId);
  if (!handlers) return;
  try {
    const payload = JSON.parse(raw) as IBMessagePayload;
    handlers.forEach(h => h(payload));
  } catch {
    // malformed message — ignore
  }
});

export function subscribeToRoom(
  chatRoomId: string,
  onMessage: (payload: IBMessagePayload) => void,
): void {
  if (!roomHandlers.has(chatRoomId)) {
    roomHandlers.set(chatRoomId, new Set());
    redisSub.subscribe(`chat:${chatRoomId}`);
  }
  roomHandlers.get(chatRoomId)!.add(onMessage);
}

export function unsubscribeFromRoom(
  chatRoomId: string,
  onMessage?: (payload: IBMessagePayload) => void,
): void {
  const handlers = roomHandlers.get(chatRoomId);
  if (!handlers) return;
  if (onMessage) {
    handlers.delete(onMessage);
  } else {
    handlers.clear();
  }
  if (handlers.size === 0) {
    roomHandlers.delete(chatRoomId);
    redisSub.unsubscribe(`chat:${chatRoomId}`);
  }
}
