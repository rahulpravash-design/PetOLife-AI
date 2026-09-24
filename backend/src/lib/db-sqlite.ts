import path from 'node:path';

import Database from 'better-sqlite3';

import type { Db } from '@/lib/db-types';

declare global {
  var __petolifeSqliteDb: Database.Database | undefined;
}

function openRawDb(): Database.Database {
  const dbPath = path.join(process.cwd(), 'data', 'petolife.db');

  // Next.js dev server hot-reloads modules; cache the connection on `global`
  // so repeated route reloads don't open a new file handle every time.
  const raw = global.__petolifeSqliteDb ?? new Database(dbPath);
  if (process.env.NODE_ENV !== 'production') global.__petolifeSqliteDb = raw;

  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  raw.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      birth_date TEXT,
      photo_url TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pets_user_id ON pets(user_id);

    CREATE TABLE IF NOT EXISTS health_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      value REAL,
      unit TEXT,
      attachment_url TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_records_pet_id ON health_records(pet_id);

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      due_date TEXT NOT NULL,
      notes TEXT,
      is_done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_pet_id ON reminders(pet_id);

    CREATE TABLE IF NOT EXISTS rate_limit_state (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      window_start TEXT NOT NULL,
      locked_until TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);

  // Mirrors migrations/002_clerk_user_id.sql. SQLite has no
  // `ADD COLUMN IF NOT EXISTS`, so check the table first; existing dev
  // databases pick the column up here without a manual migration.
  const userColumns = raw.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!userColumns.some((c) => c.name === 'clerk_user_id')) {
    raw.exec('ALTER TABLE users ADD COLUMN clerk_user_id TEXT');
  }
  raw.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id)');

  return raw;
}

export function createSqliteDb(): Db {
  const raw = openRawDb();

  return {
    async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      return raw.prepare(sql).get(...params) as T | undefined;
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return raw.prepare(sql).all(...params) as T[];
    },
    async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      const result = raw.prepare(sql).run(...params);
      return { changes: result.changes };
    },
  };
}
