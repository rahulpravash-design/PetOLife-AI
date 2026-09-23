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
