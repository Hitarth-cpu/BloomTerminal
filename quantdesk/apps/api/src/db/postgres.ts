import { Pool, PoolClient, type QueryResultRow } from 'pg';
import 'dotenv/config';

export const pool = new Pool({
  host:     process.env.POSTGRES_HOST     ?? 'localhost',
  port:     Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB       ?? 'quantdesk',
  user:     process.env.POSTGRES_USER     ?? 'quantdesk',
  password: process.env.POSTGRES_PASSWORD,
  min:      Number(process.env.POSTGRES_POOL_MIN ?? 2),
  max:      Number(process.env.POSTGRES_POOL_MAX ?? 20),
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis:  5_000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

pool.on('error', (err) => {
  console.error('[postgres] Unexpected pool error:', err.message);
});

// ─── Typed query helper ────────────────────────────────────────────────────────
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

// ─── Transaction helper ────────────────────────────────────────────────────────
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
