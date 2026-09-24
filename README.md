# PetOLife

AI-assisted pet health companion. Owners keep a health timeline (weight, vaccines, medication, vet visits, symptoms, lab results, notes), set reminders, get a summary of what changed, and ask questions about their pet's records.

- **Numbers are computed by code**, not by AI. The AI only explains them, and its output is checked against the data.
- **Not veterinary advice.** The app never diagnoses or suggests treatment.

```
mobile/   Expo + React Native app (Clerk auth, TanStack Query, local notifications)
backend/  Next.js API routes (Postgres in production, SQLite in development)
docs/     documentation
```

## Quick start (development)

Prerequisites: Node.js, a Clerk development instance, an Android device or emulator.

```bash
# Backend (port 3000)
cd backend
npm install
cp .env.example .env.local      # then fill in the Clerk values; see docs/SETUP.md
npm run dev

# Mobile (Metro on 8081)
cd mobile
npm install
cp .env.example .env.local      # set EXPO_PUBLIC_API_BASE_URL and the Clerk publishable key
npx expo start
npm run android                 # development build
```

On a physical device use your computer's LAN IP in `EXPO_PUBLIC_API_BASE_URL`, not `localhost`.

## Checks

```bash
cd backend && npm run typecheck && npm run lint && npm test && npm run build
cd mobile  && npm run typecheck && npm run lint && npx expo-doctor
```

## Documentation

| Doc | Contents |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Detailed setup: Clerk, Postgres, seed data |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit together |
| [docs/API.md](docs/API.md) | Endpoints, validation limits, rate limits |
| [docs/SECURITY.md](docs/SECURITY.md) | Protections, known limitations |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, migrations, resetting dev data |
| [docs/AI.md](docs/AI.md) | AI design, output guard, limits |
| [docs/MOBILE.md](docs/MOBILE.md) | App behaviour and configuration |
| [docs/TESTING.md](docs/TESTING.md) | What is and isn't tested |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Backend deploy and Android release steps |
| [docs/PRODUCTION-CHECKLIST.md](docs/PRODUCTION-CHECKLIST.md) | Verified vs outstanding items |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems |
| [docs/PROJECT-AUDIT.md](docs/PROJECT-AUDIT.md) | Initial audit (baseline, before hardening) |
| [docs/FINAL-STATUS.md](docs/FINAL-STATUS.md) | Current status and remaining work |
| [docs/DEMO.md](docs/DEMO.md) | Demo walkthrough (local seed data) |

## Status

A working, hardened MVP. It has **not** been deployed and no Android release has been built; see [docs/FINAL-STATUS.md](docs/FINAL-STATUS.md) for what remains.
