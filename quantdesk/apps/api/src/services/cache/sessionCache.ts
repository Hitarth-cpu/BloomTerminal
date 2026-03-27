import { redis } from '../../db/redis';

const SESSION_TTL = 86_400; // 24 hours

function key(userId: string): string {
  return `session:${userId}`;
}

export async function setSession(userId: string, sessionData: Record<string, unknown>): Promise<void> {
  await redis.set(key(userId), JSON.stringify(sessionData), 'EX', SESSION_TTL);
}

export async function getSession(userId: string): Promise<Record<string, unknown> | null> {
  const raw = await redis.get(key(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function deleteSession(userId: string): Promise<void> {
  await redis.del(key(userId));
}

export async function refreshSession(userId: string): Promise<void> {
  await redis.expire(key(userId), SESSION_TTL);
}
