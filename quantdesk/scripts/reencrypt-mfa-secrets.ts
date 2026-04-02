/**
 * One-time MFA secret re-encryption utility.
 *
 * Usage:
 *   OLD_MFA_KEY=<old-key> ADMIN_MFA_KEY=<new-key> \
 *   DATABASE_URL=<neon-url> npx ts-node scripts/reencrypt-mfa-secrets.ts
 *
 * The script is idempotent — it only processes rows where mfa_secret IS NOT NULL.
 * Run it ONCE after rotating ADMIN_MFA_KEY.
 */
import { Pool } from 'pg';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const OLD_KEY = (process.env.OLD_MFA_KEY ?? 'dev-mfa-key-change-in-production').padEnd(32, '0').slice(0, 32);
const NEW_KEY = (process.env.ADMIN_MFA_KEY ?? '').padEnd(32, '0').slice(0, 32);

if (!process.env.ADMIN_MFA_KEY) {
  console.error('ADMIN_MFA_KEY must be set to the new key');
  process.exit(1);
}
if (OLD_KEY === NEW_KEY) {
  console.log('OLD_MFA_KEY and ADMIN_MFA_KEY are identical — nothing to do.');
  process.exit(0);
}

function decrypt(encrypted: string, key: string): string {
  const [ivHex, encHex, tagHex] = encrypted.split(':');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(ivHex, 'hex'));
  (decipher as NodeJS.WriteStream & { setAuthTag(buf: Buffer): void })
    .setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

function encrypt(secret: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = (cipher as NodeJS.WriteStream & { getAuthTag(): Buffer }).getAuthTag();
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const { rows } = await pool.query<{ id: string; mfa_secret: string }>(
    `SELECT id, mfa_secret FROM users WHERE mfa_secret IS NOT NULL`,
  );

  console.log(`Found ${rows.length} user(s) with mfa_secret to re-encrypt.`);

  for (const row of rows) {
    try {
      const plaintext = decrypt(row.mfa_secret, OLD_KEY);
      const newEncrypted = encrypt(plaintext, NEW_KEY);
      await pool.query(`UPDATE users SET mfa_secret = $1 WHERE id = $2`, [newEncrypted, row.id]);
      console.log(`  ✓ Re-encrypted mfa_secret for user ${row.id}`);
    } catch (err) {
      console.error(`  ✗ Failed to re-encrypt user ${row.id}:`, err);
    }
  }

  await pool.end();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
