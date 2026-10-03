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
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS user_settings (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, allow_messages varchar(20) NOT NULL DEFAULT 'everyone', notify_likes boolean NOT NULL DEFAULT true, notify_followers boolean NOT NULL DEFAULT true, notify_messages boolean NOT NULL DEFAULT true, updated_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS user_settings (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, allow_messages varchar(20) NOT NULL DEFAULT 'everyone', notify_likes boolean NOT NULL DEFAULT true, notify_followers boolean NOT NULL DEFAULT true, notify_messages boolean NOT NULL DEFAULT true, updated_at timestamp NOT NULL DEFAULT now())`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamp`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS comment_likes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now(), CONSTRAINT comment_likes_user_comment_unique UNIQUE(user_id, comment_id))`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON comment_likes(comment_id)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS user_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, content varchar(60) NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), expires_at timestamp NOT NULL, CONSTRAINT user_notes_user_unique UNIQUE(user_id))`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS user_notes_expires_at_idx ON user_notes(expires_at)`);
  await db.execute(sql`UPDATE users SET supporter_expires_at = created_at + interval '90 days', verified_at = COALESCE(verified_at, created_at) WHERE supporter_number IS NOT NULL AND supporter_number::int BETWEEN 1 AND 1932`);
  await db.execute(sql`UPDATE users SET verified_at = COALESCE(verified_at, now()) WHERE lower(email) = lower('sdmtr033@gmail.com')`);
}
