import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data', 'petolife.db');

declare global {
  // eslint-disable-next-line no-var
  var __petolifeDb: Database.Database | undefined;
}

// Next.js dev server hot-reloads modules; cache the connection on `global`
// so repeated route reloads don't open a new file handle every time.
export const db = global.__petolifeDb ?? new Database(dbPath);
if (process.env.NODE_ENV !== 'production') global.__petolifeDb = db;

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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

  -- Generic keyed counter used for both login brute-force backoff (Finding 1)
  -- and fixed-window request throttling (Finding 3). "count" resets whenever
  -- "window_start" is older than the caller's window; "locked_until" (if set)
  -- blocks the key until that instant regardless of window/count.
  CREATE TABLE IF NOT EXISTS rate_limit_state (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    window_start TEXT NOT NULL,
    locked_until TEXT
  );

  -- One row per issued JWT (jti claim). Lets us revoke a specific token
  -- server-side (logout) instead of only relying on client-side deletion.
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
`);
