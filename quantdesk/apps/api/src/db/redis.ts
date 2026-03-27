import Redis from 'ioredis';
import 'dotenv/config';

function createClient(name: string): Redis {
  const commonOpts = {
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error(`[redis:${name}] Max reconnect attempts reached`);
        return null;
      }
      return Math.min(times * 200, 5_000);
    },
    lazyConnect: false,
  };

  const client = new Redis({
    host:     process.env.REDIS_HOST     ?? 'localhost',
    port:     Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD  || undefined,
    tls:      process.env.REDIS_TLS === 'true' ? {} : undefined,
    username: 'default',
    ...commonOpts,
  });

  client.on('connect',       () => console.log(`[redis:${name}] Connected`));
  client.on('reconnecting',  () => console.warn(`[redis:${name}] Reconnecting…`));
  client.on('error',  (err) => console.error(`[redis:${name}] Error:`, err.message));

  return client;
}

// Main client (commands)
export const redis = createClient('main');

// Dedicated subscriber client — subscribing locks the connection for pub/sub only
export const redisSub = createClient('sub');

// ─── Typed helpers ─────────────────────────────────────────────────────────────

export async function get(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await redis.set(key, value, 'EX', ttlSeconds);
  } else {
    await redis.set(key, value);
  }
}

export async function del(key: string): Promise<void> {
  await redis.del(key);
}

export async function incr(key: string): Promise<number> {
  return redis.incr(key);
}

export async function expire(key: string, ttlSeconds: number): Promise<void> {
  await redis.expire(key, ttlSeconds);
}

export async function hset(key: string, field: string, value: string): Promise<void> {
  await redis.hset(key, field, value);
}

export async function hget(key: string, field: string): Promise<string | null> {
  return redis.hget(key, field);
}

export async function hgetall(key: string): Promise<Record<string, string>> {
  return redis.hgetall(key) as Promise<Record<string, string>>;
}

export async function publish(channel: string, message: string): Promise<void> {
  await redis.publish(channel, message);
}

export function subscribe(channel: string, handler: (message: string) => void): void {
  redisSub.subscribe(channel);
  redisSub.on('message', (ch, msg) => {
    if (ch === channel) handler(msg);
  });
}
