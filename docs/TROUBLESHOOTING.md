# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `next build` prints `DATABASE_URL must be set in production` | Old behaviour; the DB is now opened on first query | Update to the current code. A deployed server without `DATABASE_URL` will fail its first request and `/api/health` returns 503 - set the variable. |
| App shows "Can't reach the server" | Backend not running, wrong URL, or a phone using `localhost` | Start the backend (`npm run dev`); on a device set `EXPO_PUBLIC_API_BASE_URL` to `http://<LAN-IP>:3000` in `mobile/.env.local` and restart Metro (`npx expo start -c`). |
| Release build crashes at launch with `EXPO_PUBLIC_API_BASE_URL must be set to an https:// URL` | Guard in `constants/config.ts` | Set an https URL in the EAS build environment. For a deliberate local release test only, set `EXPO_PUBLIC_ALLOW_INSECURE_API=true`. |
| "Your session has expired. Please sign out and sign in again." | 401 from the API: token expired/invalid, backend Clerk keys missing/mismatched, or the account's email is already used by a different account | Sign out and in. If it persists, check backend `CLERK_JWT_KEY` / `CLERK_SECRET_KEY` belong to the same Clerk instance as the app's publishable key (`node scripts/clerk-preflight.mjs`), and look for `Clerk auth rejected:` in the backend log. |
| "Too many requests..." (429) | Per-user limits: chat 30 / 10 min, summary 30 / 10 min, scan 10 / 5 min | Wait; the `Retry-After` header says how long. Limits live in `backend/src/lib/limits.ts`. |
| Legacy login says "too many attempts" | Login lockout | `npm run reset:rate-limits` (dev SQLite only). |
| Sign-up fails with a Clerk message | Clerk rejects the email/password or the field | The Clerk message is shown as-is. If the name field is rejected the app retries without it. |
| Reminder saved but no notification | Permission denied, time already passed (reminders fire at 9:00 AM on the chosen day), or the scheduler failed | The app shows which. Enable notifications in Android settings for PetOLife. |
| Chat says AI isn't configured / summary is plain text | `AI_GATEWAY_API_KEY` unset | Set it on the backend. |
| Summary text looks plain although the key is set | The model output was rejected by the guard, the model timed out, or the call failed | Look for `output guard` warnings or `AI summary generation failed` in the backend log; the rule-based text is a deliberate fallback. |
| `Another next dev server is already running` | One dev server per folder | Use the existing one, or stop it first. |
| Tests touch my dev data | They don't | `npm test` uses a temp SQLite file (`SQLITE_PATH`). |
| `adb` device not found / Metro not connecting | USB / network | `adb devices`; `adb reverse tcp:8081 tcp:8081` for Metro; run `npx expo start` and open the dev build. |
| Windows line-ending warnings on commit (`LF will be replaced by CRLF`) | Git autocrlf | Harmless. |

Health check: `GET /api/health` -> `{"status":"ok","database":{"connected":true}}`.
