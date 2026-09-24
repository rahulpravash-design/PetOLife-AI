# PetOLife AI Code-a-Thon submission

## Links

| | |
|---|---|
| GitHub | https://github.com/rahulpravash-design/PetOLife-AI |
| Live demo | _add APK or hosted URL if available_ |
| Demo video | _add link_ |
| Design prototype | N/A (no Figma prototype) |
| Product plan | https://docs.google.com/document/d/1UuAQKwPDgY1iG_5g-tuzs0_SjlCaTdgO/edit?usp=sharing&ouid=112125046115190589856&rtpof=true&sd=true |

## Summary

**Raw Pet Data -> Meaningful Health Story -> Personalized Insight -> Responsible Action**

PetOLife turns a pet's health records into an explainable timeline: what happened, what changed, what patterns repeat, and what may need attention.

- **Deterministic first.** Weight change, percentages, trends and patterns are computed by code (`backend/src/lib/analytics.ts`, `patterns.ts`). The AI only explains those verified results.
- **Guarded AI.** A deterministic output guard (`backend/src/lib/ai/guard.ts`) rejects AI text that contains numbers not in the source data, or that gives treatment/diagnosis advice, and falls back to rule-based text. See [AI.md](./AI.md).
- **Traceable.** Insights link to the records they came from, with a "Why am I seeing this?" explanation.
- **Human in the loop.** Document scan -> AI draft -> user review -> confirm -> save. Nothing is saved automatically.
- **Not veterinary advice.** No diagnosis, prescriptions or dosages; the app says so next to AI content.

## Implemented

Clerk authentication with ownership-checked APIs; multiple pets; health timeline (7 record types) with add/delete; reminders with local scheduled notifications; AI summary; AI chat; document/photo extraction; per-user rate limits, input validation and security headers.

## Verified

Backend: typecheck, lint, build and **136 automated tests** pass (authentication, cross-account access, validation, rate limiting, analytics, patterns, AI guard). Mobile: typecheck, lint and Expo Doctor (21/21) pass. See [FINAL-STATUS.md](./FINAL-STATUS.md).

## Not done (stated honestly)

Not deployed; no Android release build; no mobile unit tests; no password reset, account deletion, edit screens, search or remote push; streamed chat answers are not post-checked by the guard. Tested on Android only.

## Demo video shot list (about 3 minutes)

Prepare: run the backend (`cd backend && npm run dev`), seed the demo data once (`npm run seed:demo`, local SQLite only), open the app on the phone, sign in as the demo account (`demo@petolife.app` / `demo12345`). The demo account uses the legacy sign-in path, which is on in development; if your app build only shows Clerk sign-in, sign up with your own email instead and add a few records (weights 10 -> 12 kg a month apart, two vet visits, a repeated symptom).

1. **Problem (10 s):** "Pet records are scattered; owners can't see what changed."
2. **Home -> Bruno (10 s).**
3. **Pet screen (45 s):** read *What Happened*; show *What Changed* (weight delta and %, "computed by code, not by AI"); show *Patterns*; open a *May Need Attention* card and tap **Why am I seeing this?**; point at the "not veterinary advice" note.
4. **Timeline (15 s):** newest first; long-press a record to show the delete confirmation (cancel it).
5. **Add record (20 s):** pick a date, enter a weight, save; pull to refresh on the pet screen and show the summary recompute.
6. **Scan (25 s):** scan a vet document -> draft appears -> "review every field" banner -> edit -> save. Stress: nothing saved until confirmed.
7. **Reminder (20 s):** add one for tomorrow (fires at 9:00 AM), show it in the list, mark done.
8. **Chat (25 s):** ask "Has Bruno gained weight?" and "Should I be worried?"; note that it stays grounded in the records and refers concerns to the vet.
9. **Safety and tests (15 s):** show `npm test` -> 136 passing, and the security/AI docs.
10. **Close (10 s):** vision and next steps.

## Email

The submission email text (with the links above) is in the conversation that produced this file; keep the claims consistent with the "Implemented", "Verified" and "Not done" sections here.
