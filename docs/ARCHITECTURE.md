# Architecture

PetOlife is a monorepo with two apps and shared docs.

```
mobile/   Expo (SDK 57) + React Native app, Expo Router, TanStack Query, Clerk
backend/  Next.js 16 (App Router) used only for JSON API routes under /api
docs/     documentation
```

## Request flow

```
Mobile screen -> hook (TanStack Query) -> service (services/*.ts) -> api.ts (timeout, auth header)
   -> HTTPS -> Next.js route (src/app/api/**/route.ts)
        -> handleRoute (error mapping) -> requireUserId (auth) -> requireOwned* (ownership)
        -> zod validation (lib/validation.ts) -> repository (lib/repositories/*) -> Db (Postgres | SQLite)
```

## Authentication

- **Clerk** is the identity provider. The mobile app signs users in with `@clerk/expo`; each API call sends the short-lived Clerk session token as `Authorization: Bearer`.
- The backend (`lib/auth.ts`, `lib/clerk.ts`) verifies the RS256 token (network-free with `CLERK_JWT_KEY`), then maps the Clerk user id to an internal `users.id`, creating the row on first login. Only a verified primary email is trusted.
- A **legacy** email/password + HS256 path exists for local development and the demo account. It is on by default outside production and off in production (`LEGACY_AUTH_ENABLED`).

## Authorization

Every pet/record/reminder route calls `requireOwnedPet` / `requireOwnedRecord` / `requireOwnedReminder` (`lib/authorize.ts`). A resource that is missing or owned by someone else returns **404** (never 403), so ids cannot be probed. Records and reminders must also belong to the pet in the URL.

## Data

`lib/db.ts` exposes a small `Db {get, all, run}` interface, opened lazily on first query. Postgres (`pg`) is used when `DATABASE_URL` is set; otherwise SQLite (`better-sqlite3`, `backend/data/petolife.db` or `SQLITE_PATH`) for local dev. See [DATABASE.md](./DATABASE.md).

## AI

Vercel AI SDK through AI Gateway (`openai/gpt-4o-mini`). Numbers and trends are computed in TypeScript; the model only narrates them, and its output is checked by a deterministic guard. See [AI.md](./AI.md).

## Mobile

File-based routing in `mobile/src/app`: `(auth)` screens (login, signup), `(tabs)` (home, timeline, chat, profile) and `pet/*` (detail, new, add-record, add-reminder, scan). `Stack.Protected` gates screens on the Clerk session. See [MOBILE.md](./MOBILE.md).

## Deliberate decisions

- Clerk stays the only production auth; the legacy path is temporary.
- The DB abstraction is kept small; migrations are plain SQL in `backend/migrations/`.
- Local notifications only (no remote push).
