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
  await db.execute(sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_poster text`);
  await db.execute(sql`ALTER TABLE stories ADD COLUMN IF NOT EXISTS media_poster text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS supporter_number varchar(10)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS supporter_expires_at timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_strikes varchar(10) NOT NULL DEFAULT '0'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until timestamp`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_status varchar(20) NOT NULL DEFAULT 'active'`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false`);
  await db.execute(sql`UPDATE users SET supporter_expires_at = created_at + interval '60 days', verified_at = COALESCE(verified_at, created_at) WHERE supporter_number IS NOT NULL AND supporter_number::int BETWEEN 1 AND 1000`);
  await db.execute(sql`UPDATE users SET verified_at = COALESCE(verified_at, now()) WHERE lower(email) = lower('sdmtr033@gmail.com')`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS posts_feed_cursor_idx ON posts (created_at DESC, id DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS posts_video_cursor_idx ON posts (media_type, created_at DESC, id DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS posts_user_created_idx ON posts (user_id, created_at DESC, id DESC)`);
}
