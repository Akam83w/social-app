import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

// Keep the HTTP process bootable even when the database environment variable
// is missing. Database operations will fail normally until DATABASE_URL is set.
const url = databaseUrl ? new URL(databaseUrl) : null;

const pool = new Pool({
  connectionString: url?.toString(),
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle(pool, { schema });
