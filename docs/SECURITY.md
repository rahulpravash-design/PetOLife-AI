# Security

## What is enforced (and tested)

- **Authentication**: Clerk RS256 tokens verified on every request; `alg: none`, wrong-key, expired, wrong-`azp` and non-session tokens are rejected (`clerk.test.ts`).
- **Authorization**: every pet/record/reminder/AI route checks ownership and returns 404 for other users' data (`api-hardening.test.ts` covers read, write, chat, summary and scan across two users).
- **Input validation**: zod schemas with length, date, number, enum, URL and mime-type limits ([API.md](./API.md)); malformed bodies return 400.
- **Abuse limits**: per-user throttles on chat, summary and document scan; legacy login lockout. See [API.md](./API.md).
- **Proxy headers**: `x-forwarded-for` / `x-real-ip` are only trusted on Vercel, outside production, or when `TRUST_PROXY_HEADERS=true`; the last (proxy-appended) hop is used.
- **Headers**: no-store, nosniff, frame deny, CSP, HSTS, `X-Powered-By` removed.
- **Errors**: unexpected errors return a generic 500; details go to server logs only.
- **AI**: model output is guarded against invented numbers and treatment advice ([AI.md](./AI.md)).
- **Secrets**: Clerk secret/JWT keys, DB URL and AI key are server-side only. The mobile app only has the Clerk publishable key. `.env*` files are git-ignored; only `.env.example` files are tracked.

## Known limitations and accepted risks

- **Revocation lag**: with `CLERK_JWT_KEY` (network-free verification) a revoked Clerk session stays valid up to ~60 s, the token lifetime.
- **Legacy auth**: temporary second auth system (HS256 + `sessions` table). Keep `LEGACY_AUTH_ENABLED=false` in production. Legacy signup has no rate limit and does not verify email. The demo account (`demo@petolife.app`) exists only in local seed data.
- **`CLERK_LINK_EXISTING_BY_EMAIL`**: links a first Clerk login to an existing legacy account with the same verified email. Off by default in production; leave it off unless doing a one-time migration.
- **Email conflict**: if a Clerk user's verified email belongs to a different account, the API returns 401 for that user permanently and the app shows a "session expired" message.
- **Ownership is application-level**: there is no database row-level security. Repository update/delete methods rely on the route's ownership check.
- **Prompt injection**: record text is passed to the model as data with instructions to ignore commands in it. The summary output is guarded; the streamed chat answer is **not** post-checked.
- **Third-party data sharing**: health notes and scanned images are sent to the AI provider. There is no in-app consent screen or privacy policy yet.
- **Dependencies**: `npm audit` reports 25 moderate advisories in mobile via `@clerk/expo` -> `stream-json` (accepted, see SETUP.md).
- **No account deletion or data export** yet.
- **Rate-limit race**: the counter is read-then-write, so concurrent requests can slightly exceed a limit; rows are never purged.

## Reporting / rotating

Rotate a leaked Clerk secret in the Clerk dashboard and update the host's environment variables; nothing in the repo needs to change.
