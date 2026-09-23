-- Mirrors the SQLite dev schema in backend/src/lib/db-sqlite.ts. Timestamps
-- are kept as TEXT (ISO 8601 strings) rather than TIMESTAMPTZ on purpose:
-- the app already treats every date field as an opaque string end-to-end
-- (never parsed into a native Date by the driver), so this preserves exact
-- current behavior instead of introducing pg's automatic Date parsing for
-- timestamp columns.

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
  value DOUBLE PRECISION,
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
