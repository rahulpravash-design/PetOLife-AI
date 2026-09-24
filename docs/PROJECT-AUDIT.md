# PetOlife — Project Audit (Phase 0)

- **Date:** 2026-09-24
- **Baseline commit:** `e980761` (`checkpoint: working PetOlife app with Clerk auth`), branch `main`, working tree clean before and after the audit.
- **Method:** static reading of the repository plus the validation commands listed in §0. Nothing was modified except this file. Real `.env*` files were not opened.
- **Confidence markers:** findings come from reading code and are **not runtime-verified** unless the validation table says so. Items marked **(unverified)** need a runtime or device check.

## 0. Validation results (run during this audit)

| Check | Command | Result |
|---|---|---|
| Mobile typecheck | `cd mobile && npx tsc --noEmit` | PASS |
| Expo Doctor | `cd mobile && npx expo-doctor` | PASS (21/21) |
| Mobile lint | `cd mobile && npm run lint` | PASS |
| Backend typecheck | `cd backend && npx tsc --noEmit` | PASS (no script for this; run directly) |
| Backend lint | `cd backend && npm run lint` | PASS |
| Backend tests | `cd backend && npm test` | PASS: 6 files, 70 tests |
| Backend build | `cd backend && npm run build` | **FAIL** without `DATABASE_URL` (see below) |
| Integration script | `npm run test:integration` | NOT RUN (needs a live server and writes data) |

**Build failure detail.** `next build` sets `NODE_ENV=production`; `src/lib/db.ts` throws at import time when `DATABASE_URL` is unset, and Next imports every route module while collecting page data (`Failed to collect page data for /api/health`). Consequence: the backend cannot be built in CI or on any machine without a Postgres URL, even though the build itself does not need a database. This is not a code error in the compiled output; it is a build-time coupling. It is fixable by making the DB initialisation lazy (first query) instead of at module load, without changing the DB architecture.

## 1. Current architecture

- **Monorepo:** `mobile/`, `backend/`, `docs/`.
- **Mobile:** Expo SDK ~57, React Native 0.86, Expo Router with typed routes, React Compiler, TanStack Query, `@clerk/expo`, `expo-notifications` (local), `expo-image-picker`. Route guards via `Stack.Protected`.
- **Backend:** Next.js 16 App Router used only for `/api/*`. zod validation, `handleRoute` error mapper, repository pattern.
- **Auth:** Clerk (RS256) is primary. `requireSession` inspects the unverified JWT `alg` header only to pick a verifier: RS256 goes to Clerk, HS256 goes to the temporary legacy path, everything else gets 401. First Clerk login provisions an internal `users` row keyed by `clerk_user_id`.
- **Database:** `Db {get, all, run}` abstraction. Postgres (`pg`, max 3 connections, TLS verification on) with SQL migrations in `backend/migrations/` applied by `scripts/migrate.mjs`. SQLite (`better-sqlite3`) for local dev with an inline schema bootstrap.
- **AI:** Vercel AI SDK via AI Gateway, model `openai/gpt-4o-mini`. Summary (`generateObject` + deterministic fallback), streaming chat (`streamText`), document extraction (`generateObject` on an image; draft only, user confirms before saving). Analytics and patterns are deterministic TypeScript.
- **Rate limiting:** DB-backed table `rate_limit_state`. Login lockout (legacy login only) and a fixed-window throttle used only by extract-document.

## 2. Current features

Auth (Clerk sign-up/sign-in with email verification), pets, health records (7 types), reminders with local notifications, deterministic analytics/patterns, AI summary, AI chat, AI document scan, health endpoint, demo seed script.

## 3. Completed features (evidence-backed)

- Clerk verification incl. forged token, wrong algorithm, expiry, `azp`, and provisioning races (about 38 cases in `clerk.test.ts`).
- Ownership checks on every pet, record and reminder route via `requireOwned*` (404 on mismatch).
- Full API CRUD for pets, records, reminders.
- Deterministic weight trend, delta, and pattern logic with tests (`analytics.test.ts`, `patterns.test.ts`).
- Legacy login lockout with escalating backoff (`rate-limit.test.ts`).
- Postgres migrations plus `clerk-preflight.mjs` config check.
- Mobile flows verified manually by the owner: signup, login, pets, records, reminders, AI summary, AI chat, notifications.

## 4. Partially implemented features

- **Mobile CRUD:** create/list/toggle only. No edit or delete UI for pets, records or reminders even though the API supports them.
- **Health record entry:** no date picker; date is always "now" (except when prefilled from a scan).
- **AI chat:** works but is hard-wired to the first pet, single-turn, no history.
- **Notifications:** scheduled locally on creation only. Reminder time is the time of day of creation (date-only picker).
- **Sign-up name:** collected but never sent to Clerk.
- **Rate limiting:** exists only for legacy login and extract-document.
- **Docs:** `SETUP.md` is good; everything else stale or boilerplate.

## 5. Missing features

- Password reset / forgot-password flow.
- Account deletion and data export.
- Remote push notifications.
- Pet photo upload (`photoUrl` is a free string, never collected).
- Notification reschedule on reminder edit, reinstall, or permission change.
- Pagination.
- CI pipeline, deployment configuration, monitoring, structured logging.
- Mobile tests.
- Release configuration (identifiers, production env, store assets).

## 6. Security vulnerabilities

| ID | Sev | Finding |
|---|---|---|
| S1 | High | `getClientIp` trusts client-supplied `x-forwarded-for` / `x-real-ip`; per-IP limits are bypassable unless the host overwrites the header. |
| S2 | High | AI chat and AI summary have no rate limit or quota. Summary is a `GET` that calls the LLM on every request. Cost-abuse exposure. |
| S3 | Med | Prompt injection: record `title`/`notes` and scanned document text enter prompts; the only defence is system-prompt wording. No output filtering. |
| S4 | Med | Extract-document `mimeType` is unvalidated and interpolated into a data URL; no magic-byte check. |
| S5 | Med | No max lengths on strings (`name`, `notes`, chat `message`); `photoUrl` / `attachmentUrl` accept arbitrary strings; no general JSON body size limit. |
| S6 | Low | `/api/health` is unauthenticated and reveals DB driver and connectivity. |
| S7 | Low | No security headers configured (`next.config.ts` is empty). Lower impact for a native-only API. |
| S8 | Low | Mobile `npm audit`: 25 moderate advisories via `@clerk/expo` → `stream-json` (documented as accepted in `SETUP.md`). |
| S9 | Info | Demo credentials (`demo@petolife.app` / `demo12345`) are committed in `seed-demo.mjs` and docs. Dev only; legacy auth must be off in production. |

## 7. Authentication risks

- Clerk tokens live about 60 s; with network-free verification a revoked session remains valid for up to that long (documented).
- A Clerk user whose verified email is held by a different account gets a permanent 401; the mobile app shows only empty/error states with no explanation.
- `CLERK_LINK_EXISTING_BY_EMAIL` links a Clerk identity to a legacy account by email. Safe only because Clerk verifies email; must stay off in production except for a deliberate one-time migration.
- The legacy path (HS256, `sessions` table, `/api/auth/login|signup|logout`) is a second auth system. If `LEGACY_AUTH_ENABLED=true` in production, `JWT_SECRET` becomes critical and legacy signup never verified email. It needs a removal date.
- `azp` enforcement is off unless `CLERK_AUTHORIZED_PARTIES` is set. **(unverified)** whether native Clerk tokens carry a usable `azp`.
- Mobile `getToken()` errors return `null` and the request is sent without credentials; there is no 401 handling, so an expired session leaves the UI in an error state instead of signing out. The React Query cache is only cleared on the manual sign-out button.
- `/api/auth/logout` is a no-op for Clerk users.
- Chat route maps every error in its auth block to 401 "Unauthorized", including DB failures and pet-not-found.

## 8. Authorization risks

- Ownership is enforced in the application layer only (no row-level security). The pet, record and reminder routes all call `requireOwned*` before acting; on this reading no IDOR was found. **Not runtime-verified for every route** — Phase 2 must prove it with cross-user tests (§14).
- Repository `update`/`remove` methods take ids without a `user_id` scope and depend on the route pre-check. Low TOCTOU risk, but it is defence in depth that is absent.
- Chat and extract-document authorize through `requireOwnedPet`, but chat's error mapping (§7) can mask authorization outcomes.
- There are no roles; single-user ownership only, so privilege escalation surface is small.

## 9. Database risks

- No transaction API on `Db`.
- Missing indexes: `health_records(pet_id, date)`, `reminders(due_date)` / `(pet_id)`, `sessions.expires_at`.
- `users.email` is UNIQUE and case-sensitive while lookups use `LOWER(email)` (no functional index).
- Dates and timestamps are `TEXT`; no format validation; `ORDER BY date` and client sorting are fragile for non-ISO input.
- No CHECK constraints on species / record type.
- SQLite schema is inlined in code and duplicated from the migrations; `seed-demo.mjs` creates a third variant without `sessions` / `clerk_user_id`. Drift risk.
- Rate-limit read-then-upsert is not atomic (race on Postgres); rows are never purged.
- No down-migrations, no documented backup or retention policy, no soft delete or audit trail.
- The Postgres pool has no visible `error` handler; an idle-client error could crash the process **(unverified)**.
- `clerk.test.ts` runs against the local dev SQLite database (its own header says so), so tests depend on and can write to local dev data.

## 10. API risks

- `POST /api/pets/[id]/chat`: `parseBody` sits outside `handleRoute`, so a validation failure becomes an unhandled 500; `streamText` errors are not handled; no message length cap; no timeout.
- `date` / `dueDate` are only "non-empty string"; invalid dates reach analytics as `NaN`. Summary `from` / `to` query params are unvalidated.
- No pagination on list endpoints; summary loads all records per call.
- PATCH cannot clear optional fields.
- Extract-document consumes throttle quota before body validation and before the API-key check; a 10 MB base64 body is parsed fully in memory.
- Signup returns a generic 400 for an existing email but the response shape still differs.
- `RECORD_TYPES` is duplicated across three route files and analytics.
- Reminders have no single-item GET route (list, create, PATCH, DELETE only).

## 11. AI risks

- **Cost/abuse:** no quotas, no summary caching, no usage logging.
- **Safety:** diagnosis / medication guardrails are prompt-only; output is not post-validated; no evals.
- **Injection:** see S3.
- **Privacy:** health notes and images go to a third-party provider with no user disclosure or consent screen. Provider retention settings are not documented.
- **Determinism / quality bugs (code-level):**
  - `patterns.ts` reports "steadily increasing" when all values are equal (both increasing and decreasing conditions are true).
  - Says "last N logs" but uses all logs.
  - Weight `deltaPercent` is 0 when the starting value is 0.
  - Server-side `toLocaleDateString()` is locale-dependent.
  - Pattern IDs are random per request.
  - Deterministic attention items have empty `sourceRecordIds`.
- **Config:** model ID hardcoded in three places; no timeout or abort on any LLM call; with no `AI_GATEWAY_API_KEY`, chat returns fallback text with HTTP 200.

## 12. Mobile issues

- Sign-up: name dropped; leftover `console.error`; `err: any`; mis-indented code; raw Clerk messages shown.
- `add-record`, `add-reminder`, `pet/new`: `mutateAsync` without a catch, so failures are unhandled rejections with no user-visible error. `Number(value)` can be `NaN`.
- Pet screen shows "No AI summary yet" for real errors.
- Chat: no abort on unmount; one generic error message; first pet only.
- `constants/config.ts` silently falls back to `http://localhost:3000` if the env var is missing; `app.json` also sets `extra.apiBaseUrl` to localhost. A release build could ship pointing at localhost. Cleartext HTTP to any non-localhost host would also need Android configuration **(unverified)**.
- `services/api.ts`: no timeout, no retry, no 401 handling; `body ? JSON.stringify(body) : undefined` drops falsy bodies.
- Screens hardcode colours; `constants/theme.ts` is unused Expo template code; `userInterfaceStyle: automatic` but no dark styling.
- No accessibility labels, no error boundary, no offline handling.
- `mobile/src/types` duplicates `backend/src/lib/types.ts`.
- **Verified:** `expo-image-picker` is not listed in `app.json` plugins, so no custom camera/photo permission text is configured (matters for iOS and store review).
- Dependencies with zero direct imports under `mobile/src`: `zustand`, `expo-device`, `expo-web-browser`, `expo-glass-effect`, `@expo/ui`, `expo-symbols`, `react-native-web`, and others. Several are Expo Router peers or native-build needs (`expo-dev-client`, `reanimated`, `worklets`, `gesture-handler`, `expo-linking`, `expo-font`, `expo-status-bar`). **Do not remove without checking each**; Expo Doctor currently passes.
- `mobile/scripts/reset-project.js` (Expo template) moves `src/` if run.

## 13. Notification issues

- Local scheduled notifications only; nothing survives uninstall or device change.
- Reminder time-of-day equals the moment of creation (date-only picker).
- Notification is scheduled once at creation; there is no edit UI, so no rescheduling. The toggle-done path's effect on the scheduled notification needs runtime verification **(unverified)**.
- Permission is requested lazily at scheduling; handling of denied / revoked permission and scheduling errors is not visible in the code read.
- Past-dated reminders are skipped silently.
- Duplicate-notification protection depends on using the reminder id as the notification identifier; not tested.

## 14. Testing gaps

- **Present:** 6 backend files / 70 tests (Clerk auth and authorization, analytics, patterns, rate limit, SQL placeholders, auth helpers) plus `scripts/integration-test.mjs` (needs a live server).
- **Missing:**
  - Mobile tests (none).
  - HTTP-level tests for summary, chat, extract-document.
  - Mocked-AI tests and AI safety tests.
  - Explicit cross-user (IDOR) test matrix for every route.
  - Rate-limit concurrency test.
  - Postgres tests (SQLite only).
  - Migration tests.
  - CI.
  - No `typecheck` or `test` scripts in mobile; no `typecheck` script in backend.
  - Tests use the dev SQLite DB rather than an isolated one.

## 15. Deployment gaps

- `npm run build` fails without `DATABASE_URL` (§0).
- No CI, no deploy configuration, no migration step in a pipeline.
- No health vs readiness distinction; `/api/health` is public.
- No monitoring, error tracking, or structured logging.
- No documented backup / restore.
- Production URL must be HTTPS; not enforced anywhere.
- Rate-limit table is never cleaned up.

## 16. Documentation gaps

- Root `README.md` is 2 lines. `backend/README.md` and `mobile/README.md` are template boilerplate.
- `docs/MOBILE_MIGRATION_PLAN.md` is stale (describes custom JWT auth, `@vercel/postgres`, `expo-camera`, zustand, "all 19 phases").
- `docs/SETUP.md` claims the sign-up screen sends the name to Clerk; it does not.
- Missing: ARCHITECTURE, SECURITY, API, DATABASE, AI, MOBILE, TESTING, DEPLOYMENT, PRODUCTION-CHECKLIST, TROUBLESHOOTING.
- Backend layout still has "Create Next App" metadata, Geist fonts and template SVGs.

## 17. Technical debt

- Legacy auth (routes, HS256 branch, `sessions` table, seed script) has no removal plan.
- Duplication: types (backend vs mobile), `RECORD_TYPES`, SQLite schema vs migrations, model ID.
- `sql-placeholders.ts` rewrites `?` naively (breaks on a literal `?` inside a SQL string).
- Template leftovers in both apps.
- Inconsistent formatting in `signup.tsx`.

## 18. Production-readiness gaps

- Android: `package` is the placeholder `com.anonymous.petolife`; no iOS `bundleIdentifier`; `eas.json` has no production env or API URL; `submit.production` empty; no signing setup documented; EAS builds never run; store assets and privacy policy absent.
- Clerk production instance and keys not verified.
- No account deletion (store policy requirement) and no AI-provider disclosure.
- No monitoring, alerts, cost limits on AI Gateway.
- Backend cannot build in a clean environment (§0).

## Estimated completion (evidence-based)

These are judgement calls from the repository evidence above, not measurements.

| Area | Estimate | Basis |
|---|---|---|
| Core MVP features | ~80% | All main flows work; mobile edit/delete, password reset, name capture missing |
| Backend security | ~55% | Strong auth core; no AI throttling, weak input limits, IP trust issue |
| Data layer | ~65% | Sound schema and ownership; missing indexes, constraints, transactions |
| Mobile robustness / UX | ~50% | Happy path only; little error/empty/offline handling, no a11y |
| Testing | ~35% | Good auth tests; nothing for routes, AI, mobile, CI |
| Deployment / release | ~20% | Build not reproducible, no CI, no release config |
| Documentation | ~35% | Good setup doc; rest stale |
| **Overall toward production-ready** | **~55%** | Rough average, weighting security and deployment more heavily |

## Recommended implementation order

Each step keeps Clerk auth and the database architecture unchanged, and is committed separately after tests pass.

1. **Baseline hygiene (small):** make `db.ts` initialise lazily so `npm run build` works without a live DB; add `typecheck` scripts; move tests to an isolated temp SQLite database.
2. **Security (backend):** cross-user tests for every route; chat error mapping and validation; throttle chat and summary; input length caps, date/enum/ID validation, `mimeType` allowlist; trusted-proxy handling for client IP; request body limits; security headers; sanitise error output.
3. **Backend data and API:** atomic rate limiter and cleanup; indexes and CHECK constraints via forward-only migrations; pagination; PATCH semantics; fix analytics bugs (equal-values trend, zero-start delta, locale dates).
4. **AI:** timeouts, quota, structured fact/calculation/interpretation/uncertainty output, output validation, injection hardening, tests with mocked `ai`.
5. **Mobile and UX:** sign-up name, mutation error handling, 401 handling, timeout and retry, fail-loud API URL, record date picker, chat pet selector, edit/delete flows, notification permission handling and rescheduling, empty/error/retry states, accessibility.
6. **Logging and observability:** structured, redacted logging with dev/prod separation.
7. **Production configuration:** env separation (dev/staging/prod), `.env.example` updates, `app.json` / `eas.json` identifiers and production API URL, Android signing and AAB configuration (no credentials committed).
8. **Documentation and final QA:** the docs set, `FINAL-STATUS.md`, and a full manual/device QA pass.

Legacy-auth removal and account deletion need a decision from the owner before they are scheduled.

---

## Update after hardening (2026-09-24)

This document is the **baseline audit** and is kept as written. Since then (commits `4ff412c`, `c018fc9`, `8be84fc`):

| Finding | Status |
|---|---|
| Backend build fails without `DATABASE_URL` | Fixed (lazy DB open) |
| S1 spoofable client IP | Fixed (trusted only on Vercel / non-production / `TRUST_PROXY_HEADERS=true`) |
| S2 no limits on chat and summary | Fixed (per-user 429) |
| S3 prompt injection / no output filtering | Partly fixed (summary output guard; chat stream still unchecked) |
| S4 unvalidated `mimeType` | Fixed (allowlist) |
| S5 no length caps, dates, URLs | Fixed |
| S6 `/api/health` driver disclosure | Fixed |
| S7 security headers | Added (verified in build manifest only) |
| Chat route 500 on bad body, errors mapped to 401 | Fixed |
| No LLM timeouts | Fixed |
| Analytics "steadily increasing" for equal weights | Fixed |
| Tests used dev database; no typecheck script | Fixed |
| Mobile: signup name dropped, unhandled mutation errors, NaN value, no 401/timeout handling, chat first-pet only, localhost fallback in release, no delete UI | Fixed |
| S8 npm audit advisories, S9 demo credentials | Unchanged (accepted / dev only) |
| Legacy auth, account deletion, password reset, edit screens, remote push, mobile tests, CI, deployment, Android release, package id, Postgres tests, indexes/constraints, pagination | **Open** |

See [FINAL-STATUS.md](./FINAL-STATUS.md) for the current state.
