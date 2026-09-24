-- Maps a Clerk user (the JWT `sub`, e.g. "user_2abc...") to the application's
-- own users row. users.id stays the canonical internal ID that pets/records/
-- reminders/sessions reference; email is never the identity key.
--
-- Nullable: legacy (password) users have no Clerk identity until they are
-- linked on first Clerk login. UNIQUE (via index, so it also works when
-- re-run) still allows any number of NULLs in Postgres and SQLite.
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
