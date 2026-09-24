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

### Authentication (Clerk)

**Architecture.** Clerk is the identity provider; the app's own `users` table stays the internal identity. `users.id` is the canonical ID that every pet, record and reminder is owned by, and `users.clerk_user_id` (nullable, unique) maps a Clerk user onto it. Every request goes through one function, `requireUserId()` in `src/lib/auth.ts`, which verifies the bearer token and returns the internal `users.id`; all ownership checks (including the 404-not-403 behaviour) sit behind it unchanged. Email is never the identity key — only `clerk_user_id` is.

**Auth flow (Clerk):**
1. The mobile app signs the user in with Clerk (email + password + emailed code) and, for each API call, asks Clerk for a fresh session token (`getToken()`) and sends it as `Authorization: Bearer <token>`.
2. The backend reads the token's unverified `alg` header purely to pick a verifier: `RS256` → Clerk, `HS256` → legacy (below), anything else (including `none`) → 401. A token is only ever checked by one verifier, and each verifier enforces its own algorithm, so a token can't be replayed against the other.
3. Clerk verification (`@clerk/backend` `verifyToken`) checks signature, expiry / not-before and, when configured, the authorized party, and requires the token to be a session token (`sub` and `sid` present).
4. `sub` is looked up in `users.clerk_user_id`. On a user's first request there is no row yet, so the backend fetches the profile from the Clerk Backend API (needs `CLERK_SECRET_KEY`), requires a **verified primary email**, and creates the row (or links an existing one — see Migration).
5. Any failure to authenticate returns the same generic `401 Invalid or expired token`, so responses can't be used to tell which accounts exist.

**Environment variables (backend, server-side only — never in the mobile app or any `EXPO_PUBLIC_*` variable):**

| Variable | Purpose |
| --- | --- |
| `CLERK_JWT_KEY` | PEM public key (Clerk Dashboard → API keys → *Show JWT public key*). Enables networkless token verification. Multi-line PEM or literal `\n` both work. |
| `CLERK_SECRET_KEY` | Required to provision first-time users via the Clerk Backend API; also used to verify tokens via JWKS if `CLERK_JWT_KEY` is unset. |
| `CLERK_AUTHORIZED_PARTIES` | Optional comma-separated allowlist of the token's `azp` claim. Enforced only when set *and* the token carries `azp`. Not verified against real native-app tokens yet, so it is off by default. |
| `CLERK_LINK_EXISTING_BY_EMAIL` | `true`/`false`. Whether a first-time Clerk login may adopt an existing legacy account with the same verified email. Default: `true` outside production, `false` in production. |
| `LEGACY_AUTH_ENABLED` | `true`/`false`. Whether legacy email+password login/signup and self-issued HS256 tokens work. Default: `true` outside production, `false` in production. |
| `JWT_SECRET` | Signs legacy HS256 tokens. Only needed while `LEGACY_AUTH_ENABLED=true` (dev has a per-process fallback). |

**Mobile** needs only `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (public by design). See the Mobile section.

**Local setup.**
1. A backend with no Clerk variables works as before: legacy auth is on by default outside production, so `npm run dev`, `seed-demo.mjs` and the integration script keep working.
2. To use the mobile app you need a Clerk *development* instance (free): create an application at https://dashboard.clerk.com, enable the **Native API**, enable **email + password** sign-up/sign-in with **email verification code**, and enable **First and last name** (the sign-up screen sends the name). Then set `CLERK_JWT_KEY` and `CLERK_SECRET_KEY` in `backend/.env.local` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `mobile/.env.local`.
3. The seeded demo account (`demo@petolife.app`) is a legacy account. With the default dev linking, signing up in Clerk with that same (verified) email links to it and shows Bruno's data.

**Production setup.**
```bash
LEGACY_AUTH_ENABLED=false        # the default in production; set it explicitly anyway
CLERK_JWT_KEY=<PEM public key>
CLERK_SECRET_KEY=<sk_live_...>
CLERK_AUTHORIZED_PARTIES=        # optional, see table
CLERK_LINK_EXISTING_BY_EMAIL=false
npm run db:migrate               # applies migrations/002_clerk_user_id.sql (adds users.clerk_user_id + unique index)
```
With `LEGACY_AUTH_ENABLED=false`, `POST /api/auth/login` and `/api/auth/signup` return `404` and HS256 tokens are rejected, so production has a single authentication system. The local SQLite dev database picks up the new column automatically; Postgres needs the migration.

**Migration considerations.**
- **Legacy auth is a temporary migration/compatibility mechanism, not a second production auth system.** It exists so local dev, the demo account and the integration tests keep working while the app moves to Clerk. Plan to remove it (routes, HS256 verification, the `sessions` table) once no legacy accounts remain to migrate.
- **Linking existing users.** Legacy signup never verified email ownership. Linking a legacy account to whoever later signs up in Clerk with the same address hands over that account's pets and records, so it is off by default in production. If you have real legacy users to migrate, enable `CLERK_LINK_EXISTING_BY_EMAIL=true` for the cutover window only, then turn it back off. Linking only happens when exactly one legacy account matches, that account has no Clerk ID yet, and Clerk reports the email as verified; otherwise the request gets the generic 401. A legacy account is never re-linked to a second Clerk user.
- Clerk-only users have no local password: `password_hash` holds the non-hash sentinel `!clerk-managed`, which can never match a password, and login treats it like an unknown email so its timing does not reveal the account.
- Users are keyed by their Clerk ID, so changing an email in Clerk never changes which data they own.

**Logout and the revocation trade-off.**
- Legacy sessions: `POST /api/auth/logout` revokes the session server-side (`sessions` table); the token is rejected immediately afterwards.
- Clerk sessions: the app calls Clerk's `signOut()` (which ends the Clerk session and clears the on-device credential). `POST /api/auth/logout` accepts a Clerk token and returns 204 but has nothing to revoke.
- **Trade-off:** with `CLERK_JWT_KEY`, verification is networkless — fast and independent of Clerk's uptime, but the backend cannot see that a session was signed out, banned or revoked at Clerk. A Clerk session token lives about 60 seconds, so a stolen or revoked token stays usable for **up to ~60 seconds** (the maximum revocation-validation delay). Setting only `CLERK_SECRET_KEY` (JWKS) does not change this: it also validates the token locally. Closing the gap entirely would mean checking the session with Clerk's API on every request, which is not implemented.
- Failure modes: if the Clerk Backend API is unreachable while provisioning a *first-time* user, the request fails with 500 (not a misleading 401). Existing, already-mapped users never touch the Clerk API and are unaffected.

### Seed demo data
```bash
cd backend
node scripts/seed-demo.mjs
```
Creates a legacy account `demo@petolife.app` / `demo12345` (legacy password login only works while `LEGACY_AUTH_ENABLED=true`; the mobile app signs in through Clerk — see Authentication) with pet **Bruno** (Golden Retriever) and 18 health records + 2 reminders spanning March–September 2026.

### Tests
```bash
npm test              # unit tests (analytics, pattern engine, auth, Clerk verification/provisioning)
npm run test:integration   # requires `npm run dev` running in another terminal
```

The Clerk unit tests need no Clerk account: they sign tokens with a locally generated RSA key and pass its public half as `CLERK_JWT_KEY`, so the real `@clerk/backend` verification runs; only the Clerk Backend API call that fetches a user's profile is stubbed.

The integration script always runs the legacy flow. To also exercise Clerk-token auth over HTTP, generate a throwaway RSA key pair, start the server with the public key as `CLERK_JWT_KEY`, and point the script at both files:
```bash
CLERK_TEST_PRIVATE_KEY_FILE=priv.pem CLERK_TEST_PUBLIC_KEY_FILE=pub.pem npm run test:integration
# against a server started with LEGACY_AUTH_ENABLED=false:
EXPECT_LEGACY_DISABLED=true CLERK_TEST_PRIVATE_KEY_FILE=priv.pem CLERK_TEST_PUBLIC_KEY_FILE=pub.pem npm run test:integration
```
Neither exercises a real Clerk sign-in; that needs real Clerk credentials (see "Testing real Clerk sign-in" below).

**PostgreSQL.** Both suites also run against Postgres: set `DATABASE_URL` for `npm test`, and for the integration script set it to the same value as the server's (the script then seeds its Clerk users into Postgres instead of dev SQLite). Use a disposable database (for example the `embedded-postgres` npm package on a loopback port with a random password) — never production. Apply the migrations first with `npm run db:migrate`. The concurrent-provisioning test only produces a genuine race on Postgres: SQLite's driver is synchronous, so requests serialize there.

## 2. Mobile

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for an emulator/simulator.

Sign-in uses Clerk, so the app **requires** a Clerk publishable key and will not start without it:
```bash
# mobile/.env.local  (Clerk Dashboard -> API keys; the publishable key is public)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```
The app stores no long-lived token of its own: Clerk keeps its credential in `expo-secure-store` (Keychain/Keystore) and the app requests a fresh short-lived session token for each API call. The sign-in and sign-up screens are custom Clerk flows, which Clerk's docs say work in Expo Go; this has not been tested on a device here, so if Expo Go misbehaves, use a development build (`npx expo run:android|ios`).

By default the app points at `http://localhost:3000`. On a **physical device**, `localhost` won't reach your machine — set your LAN IP instead:
```bash
# mobile/.env.local
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000
```

### Testing real Clerk sign-in (development instance)

Nothing in the automated suites talks to a real Clerk instance, so a real sign-in has to be checked by hand once. Use a Clerk **development** instance and a mailbox you control (plus-addressing such as `you+a@example.com` / `you+b@example.com` gives you two users).

**Setup**
1. In the Clerk Dashboard: turn on the **Native API**; enable **email + password** with **email verification code** at sign-up; enable **First and last name**. Leave Client Trust (new-device email code) at its default.
2. Put `CLERK_JWT_KEY` (Dashboard → API keys → *Show JWT public key*) and `CLERK_SECRET_KEY` in `backend/.env.local`, and the publishable key in `mobile/.env.local` (see above; plus `EXPO_PUBLIC_API_BASE_URL` with your LAN IP for a physical device).
3. Run the preflight and fix anything it flags before touching the app:
   ```bash
   cd backend
   node --env-file=.env.local scripts/clerk-preflight.mjs --publishable-key pk_test_...
   ```
   It checks the PEM, key modes (test vs live), and — over the network — that `CLERK_JWT_KEY` really belongs to the publishable key's instance and that the secret key is accepted. A JWT key from the wrong instance is the most common failure and shows up as every request returning 401.
4. `npm run dev` in `backend/`, `npx expo start` in `mobile/`.

**Checks** (tick each; "DB" means inspect the `users` table — `sqlite3 backend/data/petolife.db` locally)
| # | Do | Expect |
| --- | --- | --- |
| 1 | Sign up as user A with name, email, password. Enter the emailed code. | Lands on the tabs. DB: one row with `clerk_user_id = user_…`, lowercased email, `password_hash = '!clerk-managed'`. Profile shows A's name and email. |
| 2 | Add a pet, a record and a reminder. Force-quit and reopen the app. | Still signed in (no login screen) and the data is there. |
| 3 | Tap Sign Out. Reopen the app. | Login screen both times. The previous user's data is not shown. |
| 4 | Sign in as A again on the same device. | Straight in (no code), or an emailed code if Clerk treats it as a new device — the app should show the code screen and continue after it. |
| 5 | Wrong password. | Generic "Could not sign in" message; no crash. |
| 6 | Sign up as user B; leave the code screen without verifying, then try to sign in as B. | Not signed in. Nothing about B in the DB. Then verify properly: B sees an empty pet list, not A's pet. |
| 7 | As B, request A's pet id with B's token (`curl -H "Authorization: Bearer <B token>" $API/api/pets/<A pet id>`). To get a token, temporarily `console.log(await getAuthToken())` in a local, uncommitted change. | `404`, not `403`. |
| 8 | Optional revocation timing: with a copied token, sign out in the app (or revoke the session in the Dashboard), then keep calling `GET /api/pets`. | Still `200` for up to ~60 s, then `401` — the documented trade-off. |
| 9 | Linking (dev default on): create a legacy account for a mailbox you control (`curl -X POST $API/api/auth/signup -H 'content-type: application/json' -d '{"email":"you+legacy@example.com","password":"supersecret123","name":"Legacy"}'`), add a pet through the legacy token, then sign up in the app with that same email. | The app shows the legacy pet. DB: that same row now has a `clerk_user_id`. |
| 10 | Set `CLERK_LINK_EXISTING_BY_EMAIL=false`, restart the backend, repeat 9 with a new legacy email. | The app cannot load data (`401`); backend log shows `Clerk auth rejected: Email address is already associated with another account`; the legacy row is unchanged. |
| 11 | Production behaviour: start the backend with `LEGACY_AUTH_ENABLED=false` and `curl -X POST $API/api/auth/login …`. | `404`; Clerk sign-in still works. |

If a request returns 401, the backend log line `Clerk auth rejected: <reason>` says why (bad signature, expired, not a session token, unverified email…). Record which checks passed; only then can "real Clerk sign-in tested" be claimed. Untested in this repo so far: the sign-in/sign-up screens on a real device or in Expo Go, the client-trust code step, and whether native tokens carry an `azp` claim (relevant to `CLERK_AUTHORIZED_PARTIES`).

### Known dependency advisories (accepted risk)

`npm audit` in `mobile/` reports 13 more moderate advisories after adding `@clerk/expo` (12 → 25). They all descend from one advisory, [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x) (`stream-json` ≤ 3.4.0: crafted deeply nested JSON can block the event loop — a DoS in a Node stream parser), through this exact chain:

`@clerk/expo@4.6.9` → `@clerk/clerk-js@6.33.0` → `@solana/wallet-adapter-base@0.9.27` (and `-react`, `@solana/wallet-standard`) → `@solana/web3.js@1.99.0` → `jayson@4.3.0` → `stream-json@1.9.1`

The other flagged packages are the Solana wallet-adapter/standard packages above `web3.js` in that chain, plus `@clerk/clerk-js` and `@clerk/expo` themselves.

**Not shipped.** These packages are declared runtime dependencies of `@clerk/clerk-js` (used by its Web3 wallet sign-in), but an Android Metro export of the app (1,599 modules, source map inspected) contains none of them: 0 modules from `@solana/*`, `@solana-mobile/*`, `jayson` or `stream-json`, and `@clerk/clerk-js` contributes only its prebuilt `clerk.native.js`. The handful of "solana" strings in the bundle are Clerk's own identifiers (e.g. `web3_solana_signature`); the wallet libraries load from a separate lazy chunk that is not part of the React Native bundle. The packages exist only in `node_modules` on developer/CI machines. The app does not use Web3 sign-in, and no code path in the app parses untrusted JSON through `stream-json`.

**Why not "fixed".** No safe non-breaking fix exists: `@clerk/clerk-js` 6.33.0 is the latest stable release and hard-pins the Solana packages; the fixed `stream-json` is 3.7.0, three majors above the `^1.9.1` that `jayson@4.3.0` requires. An `overrides` entry forcing `stream-json@^3.7.0` clears 12 of the 13 in a scratch test (the last is `@clerk/expo` flagging via `expo`, already in the baseline), but it would only silence the scanner for code that is never bundled or run, using an unsupported version pairing. `npm audit fix --force` was not used and Expo was not downgraded.

**Revisit** when `@clerk/expo` ships a `@clerk/clerk-js` that updates or drops the Solana pins, or when `jayson` 5 is adopted upstream; then re-run `npm audit` and re-inspect the export with `npx expo export --platform android --no-bytecode --dump-sourcemap`.

## 3. Production builds (not yet run)
`mobile/eas.json` has build profiles configured (development/preview/production), but actually building requires an Expo account:
```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile preview --platform android
```
This is a manual step — nobody has run `eas login` in this environment.
