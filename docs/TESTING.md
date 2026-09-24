# Testing

## Commands

```
cd backend
npm run typecheck     # tsc --noEmit
npm run lint
npm test              # Vitest: 136 tests in 11 files
npm run build         # next build (works without DATABASE_URL)
npm run test:integration   # needs a running dev server (see below)

cd mobile
npm run typecheck
npm run lint
npx expo-doctor
```

Tests run against a throwaway SQLite file (`SQLITE_PATH` is set in `vitest.config.mts`), never `backend/data`. The AI SDK (`ai`) is mocked, so no test calls a model or needs a key.

## What is covered

| File | Covers |
|---|---|
| `clerk.test.ts` | Clerk verification (forged/expired/wrong-key/alg-confusion tokens, `azp`), first-login provisioning and races, email linking rules, ownership across CRUD routes, legacy-auth switch |
| `api-hardening.test.ts` | Cross-user access (IDOR) on pets, records, reminders, chat, summary, scan; 401 for missing/garbage tokens; chat 400 vs 500; per-user 429 + `Retry-After`; invalid dates, oversized text, bad values, non-http URLs, non-image mime types |
| `api-utils.test.ts` | Client-IP trust rules, 429/400/500 error mapping (no internals leaked) |
| `validation.test.ts` | Date, URL, number and text validators |
| `ai/guard.test.ts`, `ai/summary.test.ts` | Invented-number and unsafe-claim rejection, fallback to rule-based text, deterministic calculations always returned |
| `analytics.test.ts`, `patterns.test.ts` | Deterministic deltas and patterns (incl. unchanged weight is not a trend) |
| `rate-limit.test.ts` | Login lockout/backoff and fixed-window throttle |
| `auth.test.ts`, `sql-placeholders.test.ts` | Password/token helpers, SQL placeholder rewriting |

## Integration script

`npm run test:integration` (`scripts/integration-test.mjs`) runs an end-to-end smoke test against a running server: `npm run dev` in one terminal, then run it. It writes to whatever database that server uses, so point the server at a scratch DB (`SQLITE_PATH=...`). Next.js allows only one dev server per folder, so stop your normal dev server first, or use a copy of the repo.

## Not covered

- Mobile: no unit or component tests; screens were type-checked and linted only.
- No Postgres test run in CI (the suite runs on SQLite; the Clerk tests also run against Postgres when `DATABASE_URL` is set).
- No end-to-end device tests, no load tests, no AI answer-quality evaluation.
- Rate-limit behaviour under true concurrency.
- No CI pipeline is configured yet.
