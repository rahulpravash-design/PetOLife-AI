# PetOLife — Demo Script

Prep: run backend (`npm run dev`) and seed demo data (`node scripts/seed-demo.mjs`) per [SETUP.md](./SETUP.md), then open the mobile app.

1. **Sign in** — `demo@petolife.app` / `demo12345`.
2. **Home tab** — shows Bruno (Golden Retriever). Tap into his profile.
3. **Pet detail (the core feature)**:
   - **What Happened**: narrative summary of 7 months of records.
   - **What Changed**: weight +4.5kg / +16.98% (July→September), computed deterministically — not guessed by AI.
   - **Patterns**: two vet visits within 60 days; "limping" reported twice in 4 days; weight steadily increasing across 7 logs.
   - **May Need Attention**: rule-based flag on the >15% weight change. Tap "Why am I seeing this?" on any pattern/attention card to show the exact reasoning and source records — nothing is asserted without a traceable basis.
4. **Timeline tab** — full chronological record list for Bruno, newest first.
5. **Scan** (pet detail → Scan) — take/choose a photo of a document; the AI extracts a draft record (type, title, date, value) which is shown for **review and edit before saving** — never auto-saved.
6. **Reminders** (pet detail) — Flea/tick prevention and Dental cleaning follow-up; tap to mark done, which also cancels the scheduled local notification.
7. **Chat tab** — ask "Has Bruno gained weight?" or "Should I be worried about anything?" — answers stay grounded in Bruno's actual records and never diagnose or prescribe.
8. **Add a record** — pet detail → "+ Add Record" → log a new weight entry; return to pet detail and pull to refresh to see the summary recompute live.

## What's genuinely real vs. what needs one more step
- Auth, pet/record/reminder CRUD, deterministic analytics, and pattern detection: fully real, tested (`npm test` + `npm run test:integration`), no external accounts needed.
- AI narration/chat/document extraction: real code against the Vercel AI Gateway; falls back to deterministic text if `AI_GATEWAY_API_KEY` isn't set (so the demo still works without it).
- Push notifications: real local scheduled notifications (no account needed). Remote push and production app builds need `eas login` — not run in this environment.
