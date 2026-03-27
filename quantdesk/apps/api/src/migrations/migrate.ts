/**
 * Migration runner.
 *
 * Usage:
 *   npx ts-node src/migrations/migrate.ts            ← run pending migrations
 *   npx ts-node src/migrations/migrate.ts --seed     ← also run seed.sql after
 *
 * Tracks completed migrations in the schema_migrations table.
 * Each migration runs inside its own transaction — if any migration fails
 * the runner stops immediately and exits with code 1.
 */

import fs   from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  host:     process.env.POSTGRES_HOST     ?? 'localhost',
  port:     Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB       ?? 'quantdesk',
  user:     process.env.POSTGRES_USER     ?? 'quantdesk',
  password: process.env.POSTGRES_PASSWORD,
  ssl:      (process.env.POSTGRES_SSL === 'true' || process.env.NODE_ENV === 'production') ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR = __dirname;
const SEED_FILE      = path.join(__dirname, '..', '..', '..', '..', 'infra', 'postgres', 'seed.sql');

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL      PRIMARY KEY,
      name        TEXT        UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(client: PoolClient): Promise<Set<string>> {
  const result = await client.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map(r => r.name));
}

async function runMigration(client: PoolClient, file: string, sql: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [file]);
    await client.query('COMMIT');
    console.log(`  ✓ ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function migrate(): Promise<void> {
  const shouldSeed = process.argv.includes('--seed');

  console.log('\n═══ QuantDesk Migration Runner ═══════════════════════════\n');

  // Wait for Postgres to be ready (Docker healthcheck should handle this,
  // but add a small retry loop as belt-and-suspenders)
  let pgClient: PoolClient | null = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      pgClient = await pool.connect();
      break;
    } catch {
      console.warn(`  Waiting for Postgres… (attempt ${attempt}/10)`);
      await new Promise(r => setTimeout(r, 2_000));
    }
  }
  if (!pgClient) {
    console.error('  ✗ Could not connect to Postgres after 10 attempts');
    process.exit(1);
  }

  try {
    await ensureMigrationsTable(pgClient);
    const executed = await getExecutedMigrations(pgClient);

    // Collect *.sql files matching NNN_name.sql pattern, sorted ascending
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => /^\d{3}_.*\.sql$/.test(f))
      .sort();

    const pending = files.filter(f => !executed.has(f));

    if (pending.length === 0) {
      console.log('  All migrations already applied.\n');
    } else {
      console.log(`  Pending: ${pending.length} migration(s)\n`);
      for (const file of pending) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        try {
          await runMigration(pgClient, file, sql);
        } catch (err) {
          console.error(`\n  ✗ Failed at ${file}:`);
          console.error((err as Error).message);
          process.exit(1);
        }
      }
    }

    // Optional seed
    if (shouldSeed) {
      console.log('\n  Running seed data…');
      if (!fs.existsSync(SEED_FILE)) {
        console.warn(`  Seed file not found: ${SEED_FILE}`);
      } else {
        const seedSql = fs.readFileSync(SEED_FILE, 'utf8');
        try {
          await pgClient.query(seedSql);
          console.log('  ✓ Seed complete');
        } catch (err) {
          console.error('  ✗ Seed failed:', (err as Error).message);
          // Seed failures are non-fatal — continue
        }
      }
    }

    console.log('\n═══ Migrations complete ══════════════════════════════════\n');
  } finally {
    pgClient.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Unhandled migration error:', err);
  process.exit(1);
});
