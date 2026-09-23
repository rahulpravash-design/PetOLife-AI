# PetOLife — Mobile Migration Plan

> Status (2026-09-23): all 19 phases implemented and verified (typecheck, lint, unit tests,
> integration tests against a running backend, and Metro bundle compiles). See
> [DEMO.md](./DEMO.md) and [SETUP.md](./SETUP.md). Two things remain genuinely external and
> require the user's own account login: provisioning real Postgres/Clerk via Vercel Marketplace
> (currently a local SQLite dev DB + custom JWT auth, swappable via the repository layer in
> `backend/src/lib/repositories/`), and running `eas login` / `eas build` for real device builds.

## 1. Current state (audit, 2026-09-23)

The repo was scaffolded once via `create-next-app` and never built on. It contains:
- Next.js 16 App Router, TypeScript, Tailwind, ESLint
- One git commit, default template pages only (`src/app/layout.tsx`, `page.tsx`, `globals.css`)
- No database, no auth, no API routes, no AI integration, no domain models
- A failed `shadcn` init (irrelevant now — mobile UI isn't shadcn)

**Conclusion: there is no web-specific code to migrate or remove.** This is a greenfield build. The only carryover is the product spec (health timeline, deterministic analytics, AI summary/chat, pattern detection, safety rules), which is platform-agnostic and becomes the backend API contract.

## 2. Target monorepo layout

```
petolife/
  backend/     # Next.js API routes only — no pages/UI. DB, auth, AI live here.
  mobile/      # Expo + TypeScript + Expo Router. The actual product.
  docs/        # This file and future architecture notes.
```

The existing Next.js scaffold is repurposed as `backend/` (API routes, DB access, AI calls). It never gets a frontend — `src/app/page.tsx` and friends are deleted since mobile is the only client.

## 3. Backend responsibilities (owns all secrets)

- Auth (Clerk via Vercel Marketplace) issuing tokens the mobile app stores in SecureStore
- Postgres (Vercel Marketplace) — pets, health records, reminders
- Deterministic analytics engine (TypeScript, not LLM) — weight deltas, %, frequency, gaps
- AI layer via Vercel AI Gateway, Zod-schema-constrained `generateObject` for summary/what-changed/patterns/attention; streaming chat endpoint
- Authorization (row ownership), rate limiting on AI routes, input validation

No LLM keys, DB credentials, or server secrets ever ship in the mobile bundle — mobile only holds a base API URL and session token.

## 4. Mobile app (`mobile/`)

Expo + Expo Router, structure:
```
app/(auth)/        # login, signup
app/(tabs)/         # home, timeline, chat, profile
app/pet/[id]/...    # pet detail, add record, document scan
components/
services/           # API client (fetch wrapper + React Query hooks)
hooks/
store/              # Zustand — UI state only
types/
utils/
constants/
assets/
```
State: Zustand (UI/local state) + TanStack Query (server state/caching). Secure token storage via `expo-secure-store`. Camera/OCR via `expo-camera` + `expo-document-picker`. Push via `expo-notifications`.

## 5. Migration/build sequence (19 phases)

1. Audit (this doc)
2. Mobile project structure (Expo scaffold + folders)
3. Connect mobile to backend (API client, env config)
4. Auth (backend endpoints + mobile screens + secure token storage)
5. Pet management (schema, CRUD API, mobile screens)
6. Health records (schema, CRUD API, mobile forms)
7. Timeline UI (mobile)
8. Deterministic analytics engine (backend)
9. Pattern detection engine (backend)
10. AI health summary (backend `generateObject` + mobile rendering)
11. Explainable insights ("Why am I seeing this?")
12. AI chat (streaming + citations)
13. Camera/document scanning + AI extraction (confirm-before-save)
14. Reminders
15. Push notifications
16. UX polish (native feel, safe areas, pull-to-refresh)
17. Testing (unit/integration/E2E)
18. Android/iOS builds (EAS)
19. Final docs + demo data

Each phase is built and smoke-tested before the next starts.

## 6. Risks

- Vercel Marketplace provisioning (Postgres, Clerk) requires interactive dashboard/CLI auth — cannot be fully scripted; flagged when reached.
- EAS builds (phase 18) require an Expo account/credentials — flagged when reached.
- AI Gateway usage requires a Vercel project linked with the AI Gateway integration enabled.

## 7. Dependencies

Backend: `next`, `@vercel/postgres`/marketplace Postgres client, `@clerk/nextjs` (or marketplace equivalent), `ai` (AI SDK v6) via AI Gateway, `zod`.
Mobile: `expo`, `expo-router`, `zustand`, `@tanstack/react-query`, `expo-secure-store`, `expo-camera`, `expo-document-picker`, `expo-notifications`, `axios` or `fetch`.
