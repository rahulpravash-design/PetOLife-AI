import { createPostgresDb } from '@/lib/db-postgres';
import { createSqliteDb } from '@/lib/db-sqlite';
import type { Db } from '@/lib/db-types';

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === 'production') {
  throw new Error(
    'DATABASE_URL must be set in production - refusing to silently fall back to the local SQLite dev database.',
  );
}

export const dbDriver: 'postgres' | 'sqlite' = connectionString ? 'postgres' : 'sqlite';

export const db: Db = connectionString ? createPostgresDb(connectionString) : createSqliteDb();
