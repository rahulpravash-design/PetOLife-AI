# Production checklist

`[x]` = verified in this repository (commands or tests). `[ ]` = not done / needs you. Nothing marked done relies on a deployment, because none exists.

## Code quality (verified)
- [x] `npm run typecheck`, `npm run lint`, `npm test` (136 tests) pass in `backend/`
- [x] `npm run build` passes without a database
- [x] `npm run typecheck`, `npm run lint` pass in `mobile/`; `npx expo-doctor` passed 21/21 at the start of this work

## Security (verified by tests unless noted)
- [x] Cross-user access returns 404 on pets, records, reminders, chat, summary, scan
- [x] Missing/garbage tokens return 401
- [x] Input validation (lengths, dates, numbers, URLs, mime types)
- [x] Per-user 429 limits on chat, summary, scan
- [x] Spoofable proxy headers not trusted by default in production
- [x] Security headers present in the build's route manifest (not checked on a live server)
- [x] AI output guard against invented numbers and treatment advice (summary)
- [ ] `LEGACY_AUTH_ENABLED=false` set in the production environment
- [ ] `CLERK_LINK_EXISTING_BY_EMAIL` unset/false in production
- [ ] Production Clerk instance keys configured; dev keys not used
- [ ] Privacy policy and AI-provider disclosure

## Backend deployment (not done)
- [ ] Postgres created, `npm run db:migrate` applied, backup in place
- [ ] Environment variables set on the host ([DEPLOYMENT.md](./DEPLOYMENT.md))
- [ ] `/api/health` returns ok on the deployed URL
- [ ] Headers confirmed with `curl -i`
- [ ] AI Gateway spend limit / alert configured
- [ ] Error monitoring and log retention

## Android release (not done)
- [ ] Final application ID chosen (currently placeholder `com.anonymous.petolife`)
- [ ] Production `EXPO_PUBLIC_API_BASE_URL` (https) and Clerk publishable key set in EAS
- [ ] `eas build --profile production` produces an AAB
- [ ] Signing keystore managed by EAS or stored securely (never in git)
- [ ] Store listing: icon, screenshots, privacy policy URL, data-safety form
- [ ] Account deletion in the app (Google Play policy)

## Manual device pass (not done since the latest changes)
- [ ] Sign up with a name, verify email, land on Home; Profile shows the name
- [ ] Log out and back in; session survives an app restart
- [ ] Add pet (validation error for empty name; success opens the pet)
- [ ] Add record with a picked date; bad value like `abc` shows an error; record appears on Timeline
- [ ] Add reminder for tomorrow: notification arrives at 9:00; with notifications denied, the saved-but-no-alert message appears
- [ ] Mark reminder done / undone; long-press to delete
- [ ] Long-press a timeline record to delete; delete a pet
- [ ] Summary loads; disclaimer visible; pull to refresh
- [ ] Chat works; pet selector with 2+ pets; 429 message after heavy use
- [ ] Scan a document; draft must be reviewed before saving
- [ ] Airplane mode: friendly "can't reach the server" messages, retry buttons work, no endless spinners
- [ ] A second account cannot see the first account's pets

## Known missing features
- [ ] Password reset, account deletion, edit screens, remote push, pet photos, mobile tests, CI
