import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured');
}

const url = new URL(databaseUrl);

const isSupabasePooler =
  url.hostname === 'aws-0-ap-northeast-1.pooler.supabase.com';

if (isSupabasePooler) {
  url.hostname = '54.64.190.72';
}

const pool = new Pool({
  connectionString: url.toString(),
  ssl: isSupabasePooler
    ? {
        rejectUnauthorized: false,
        servername: 'aws-0-ap-northeast-1.pooler.supabase.com',
      }
    : {
        rejectUnauthorized: false,
      },
});

export const db = drizzle(pool, { schema });
