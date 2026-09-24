# Database

## Drivers

| Environment | Driver | Selected by |
|---|---|---|
| Production / staging | Postgres via `pg` (max 3 connections, TLS certificate verification on) | `DATABASE_URL` is set |
| Local dev | SQLite via `better-sqlite3` at `backend/data/petolife.db` | `DATABASE_URL` unset |
| Tests | SQLite in a throwaway temp file | `vitest.config.mts` sets `SQLITE_PATH` |

The connection is opened on first query (`src/lib/db.ts`). In production with no `DATABASE_URL` the first query throws instead of silently using SQLite, so a misconfigured deployment fails immediately (and `/api/health` returns 503). All SQL uses `?` placeholders; the Postgres driver rewrites them to `$1, $2...`. Values are always passed as parameters, never concatenated.

## Schema

| Table | Purpose | Key columns |
|---|---|---|
| `users` | App users | `id` (internal), `email` (unique), `clerk_user_id` (unique, nullable), `name`, `password_hash` (a fixed marker for Clerk-managed users) |
| `pets` | Pets | `user_id` -> users (cascade), `name`, `species`, `breed`, `birth_date`, `photo_url` |
| `health_records` | Timeline entries | `pet_id` -> pets (cascade), `type`, `date`, `title`, `notes`, `value`, `unit`, `attachment_url` |
| `reminders` | Reminders | `pet_id` -> pets (cascade), `title`, `due_date`, `notes`, `is_done` |
| `sessions` | Legacy HS256 sessions only | `user_id`, `expires_at`, revoked flag |
| `rate_limit_state` | Throttle and lockout counters | `key`, `count`, `window_start`, `locked_until` |
| `schema_migrations` | Applied migrations (Postgres) | filename |

Deleting a user deletes their pets, records and reminders; deleting a pet deletes its records and reminders (foreign keys with `ON DELETE CASCADE`; SQLite runs with `foreign_keys = ON`). Dates are stored as ISO-8601 text.

## Migrations

Postgres: `backend/migrations/*.sql`, applied in filename order by `npm run db:migrate` (needs `DATABASE_URL`). Applied files are recorded in `schema_migrations`, so re-running is a no-op. Migrations are additive and idempotent (`IF NOT EXISTS`). There are no down-migrations; take a backup before applying to a database with data.

SQLite: the schema is created inline in `src/lib/db-sqlite.ts`. **If you add a migration, mirror it there** - the two are maintained by hand.

## Data ownership

Ownership is enforced in the API layer (see [SECURITY.md](./SECURITY.md)): `pets.user_id` is the root; records and reminders are reached only through an owned pet.

## Resetting local data

- Delete `backend/data/petolife.db` (dev SQLite only) and restart the server; the schema is recreated.
- `npm run reset:rate-limits` clears throttle/lockout counters (SQLite only).
- `npm run seed:demo` adds the demo user and sample data (SQLite only).
- Never run these against a production database; they do not connect to Postgres.

## Known gaps

- No composite indexes such as `health_records(pet_id, date)` or `reminders(due_date)`; current data volumes do not need them.
- No CHECK constraints on `species` / `type` (validated in the API instead).
- No transaction API on the `Db` interface.
- `users.email` is case-sensitive unique while lookups lower-case it.
- `rate_limit_state` rows are never purged.
- List endpoints are not paginated.
