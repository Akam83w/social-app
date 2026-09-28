import { sql } from 'drizzle-orm';
import { db } from './index';

/**
 * The project schema has evolved faster than the deployed database migrations.
 * Keep the small set of auth-critical columns/sequence present so a fresh
 * deployment cannot fail during login before the normal migration workflow runs.
 *
 * Every statement is idempotent and safe to execute on an already-updated DB.
 */
export async function ensureAuthSchema() {
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS supporter_number_seq START WITH 1`);

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS supporter_number varchar(10)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS supporter_expires_at timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_strikes varchar(10) NOT NULL DEFAULT '0'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_status varchar(20) NOT NULL DEFAULT 'active'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false`);
}
