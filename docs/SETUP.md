# PetOLife — Setup

## Prerequisites
- Node.js 20+
- Expo Go app (for quick device testing) or Android Studio / Xcode for emulators

## 1. Backend

```bash
cd backend
npm install
npm run dev          # http://localhost:3000
```

Uses a local SQLite file at `backend/data/petolife.db` (auto-created, gitignored) — no external database setup required for local dev.

Optional AI features (health summary narration, chat, document extraction) require a Vercel AI Gateway key:

```bash
# backend/.env.local
AI_GATEWAY_API_KEY=your_key_here
JWT_SECRET=some_long_random_string   # required in production, dev has a fallback
```

Without `AI_GATEWAY_API_KEY`, the app still works fully — "What Happened" and "What May Need Attention" fall back to deterministic, rule-based text instead of AI narration, and chat/document-scan return a clear "not configured" message instead of crashing.

### Production database (Postgres)

Local dev always uses SQLite unless `DATABASE_URL` is set. In production, `DATABASE_URL` is **required** — the backend throws at startup rather than silently falling back to SQLite (see `src/lib/db.ts`). Set it, then apply the schema:

```bash
# backend/.env.local (or your host's env config)
DATABASE_URL=postgres://user:password@host:5432/dbname

npm run db:migrate   # applies backend/migrations/*.sql, safe to re-run
```

`GET /api/health` reports which driver is active (`"sqlite"` or `"postgres"`) and whether a live query succeeded, without exposing the connection string.

**`DATABASE_URL` must also be present when running `next build`, not just at runtime.** Next.js imports every route module during its build-time "collecting page data" step to discover route config, and `db.ts`'s production guard runs at module load — so a production build fails fast if `DATABASE_URL` is missing, before a broken build can ever be deployed. This is pure config validation: the build never opens a real database connection or runs a query (a `pg.Pool` is lazy — it only connects on first use), and it never runs migrations (`scripts/migrate.mjs` is a standalone script, not imported by the app). On Vercel, environment variables scoped to the "Production" environment are available during the production build by default, so this needs no extra setup — just confirm `DATABASE_URL` is configured there before the first deploy. If `DATABASE_URL` is ever missing at runtime (e.g. a misconfigured environment), every DB-touching request fails with a `500` rather than silently reading/writing SQLite.

### Seed demo data
```bash
cd backend
node scripts/seed-demo.mjs
```
Creates `demo@petolife.app` / `demo12345` with pet **Bruno** (Golden Retriever) and 18 health records + 2 reminders spanning March–September 2026.

### Tests
```bash
npm test              # unit tests (analytics + pattern engine)
npm run test:integration   # requires `npm run dev` running in another terminal
```

## 2. Mobile

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for an emulator/simulator.

By default the app points at `http://localhost:3000`. On a **physical device**, `localhost` won't reach your machine — set your LAN IP instead:
```bash
# mobile/.env.local
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000
```

## 3. Production builds (not yet run)
`mobile/eas.json` has build profiles configured (development/preview/production), but actually building requires an Expo account:
```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile preview --platform android
```
This is a manual step — nobody has run `eas login` in this environment.
