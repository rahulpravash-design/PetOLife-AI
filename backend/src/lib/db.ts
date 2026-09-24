import { createPostgresDb } from '@/lib/db-postgres';
import { createSqliteDb } from '@/lib/db-sqlite';
import type { Db } from '@/lib/db-types';

export const dbDriver: 'postgres' | 'sqlite' = process.env.DATABASE_URL ? 'postgres' : 'sqlite';

// Opened on first query, not at import: `next build` imports every route
// module (NODE_ENV=production) without a database, and must still succeed.
// The production guard against silently using the local SQLite dev database
// therefore fires on first use instead - a misconfigured deployment still
// fails on its first request (and on /api/health) rather than running on SQLite.
let instance: Db | undefined;

function open(): Db {
  if (instance) return instance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString && process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL must be set in production - refusing to silently fall back to the local SQLite dev database.',
    );
  }
  instance = connectionString ? createPostgresDb(connectionString) : createSqliteDb();
  return instance;
}

export const db: Db = {
  get: (sql, params) => open().get(sql, params),
  all: (sql, params) => open().all(sql, params),
  run: (sql, params) => open().run(sql, params),
};
