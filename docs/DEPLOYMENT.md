# Deployment

> Status: **nothing has been deployed and no release build has been made from this repository.** These are the steps to do it; verify each one as you go.

## Environments

| | Development | Staging (recommended) | Production |
|---|---|---|---|
| Backend DB | SQLite (`backend/data`) | Postgres | Postgres |
| Clerk | development instance (`pk_test_`, `sk_test_`) | separate dev or staging instance | production instance (`pk_live_`, `sk_live_`) |
| Legacy auth | on | off | **off** |
| API URL | `http://<LAN-IP>:3000` | `https://staging...` | `https://api...` |

Keep separate Clerk instances and databases per environment. Never point a development build at production data.

## Backend variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes (prod) | Postgres URL, TLS verified. Use your provider's pooled URL. |
| `CLERK_SECRET_KEY` | yes | Provisions first-time users. Server only. |
| `CLERK_JWT_KEY` | recommended | Clerk PEM public key; network-free verification. Server only. |
| `CLERK_AUTHORIZED_PARTIES` | optional | Comma-separated allowed token origins. |
| `CLERK_LINK_EXISTING_BY_EMAIL` | no | Leave unset/false in production. |
| `LEGACY_AUTH_ENABLED` | no | Set `false` explicitly in production. |
| `JWT_SECRET` | only if legacy auth is on | Not needed when legacy auth is off. |
| `AI_GATEWAY_API_KEY` | optional | Without it AI falls back (see [AI.md](./AI.md)). |
| `TRUST_PROXY_HEADERS` | optional | `true` only behind your own proxy; automatic on Vercel. |

## Backend steps

1. Create the Postgres database and take note of `DATABASE_URL`.
2. Apply migrations: `cd backend && DATABASE_URL=... npm run db:migrate`. Back up first if the database has data.
3. Optional check of Clerk settings: `node scripts/clerk-preflight.mjs` (see `docs/SETUP.md`).
4. Set the variables above in your host (e.g. Vercel project settings). Do not commit them.
5. Build and start: `npm run build` then `npm start` (a host such as Vercel does this for you). `npm run build` works without a database; the database is needed at runtime.
6. Verify: `GET /api/health` returns `{"status":"ok",...,"database":{"connected":true}}`. Then sign in from a build of the app and load pets.
7. Confirm response headers (no-store, nosniff, CSP, HSTS) with `curl -i https://<host>/api/health`.

Rollback: redeploy the previous build. Migrations are additive, so an older build keeps working against a newer schema.

## Mobile release (Android)

Prerequisites: an Expo account, `npx eas-cli@latest login`, the production Clerk publishable key, and the HTTPS API URL.

1. **Decide the application ID.** `mobile/app.json` still has the placeholder `android.package` = `com.anonymous.petolife`. It cannot be changed after publishing to Google Play. If you register the package in Clerk (native application), change both together.
2. Set build-time variables for the production profile (`eas env:create` or the EAS dashboard), not in git:
   `EXPO_PUBLIC_API_BASE_URL=https://...`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`.
   A production build fails at startup if the API URL is not `https://`.
3. `cd mobile && npx eas-cli@latest build --platform android --profile production` produces an AAB (`autoIncrement` bumps the version code; `appVersionSource` is remote).
4. Let EAS manage the signing keystore (or provide your own). **Never commit keystores** (`*.jks` is git-ignored).
5. Install the build on a device and run the manual checklist in [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md).
6. `npx eas-cli submit` needs a Google Play service account and a completed store listing (privacy policy URL, data-safety form, screenshots, icons). None of that exists yet.

Google Play requires an in-app way to delete the account for apps that create accounts. This app does not have one yet.
