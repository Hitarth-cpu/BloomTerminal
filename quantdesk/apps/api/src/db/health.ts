import { pool }  from './postgres';
import { redis }  from './redis';
import { getDb }  from './mongo';

export interface HealthStatus {
  postgres: 'ok' | 'error';
  redis:    'ok' | 'error';
  mongo:    'ok' | 'error';
  healthy:  boolean;
}

export async function checkHealth(): Promise<HealthStatus> {
  const [pgOk, redisOk, mongoOk] = await Promise.all([
    pool.query('SELECT 1').then(() => true).catch(() => false),
    redis.ping().then(r => r === 'PONG').catch(() => false),
    getDb().command({ ping: 1 }).then(() => true).catch(() => false),
  ]);

  return {
    postgres: pgOk    ? 'ok' : 'error',
    redis:    redisOk ? 'ok' : 'error',
    mongo:    mongoOk ? 'ok' : 'error',
    healthy:  pgOk && redisOk && mongoOk,
  };
}
