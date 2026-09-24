# Mobile app

Expo SDK 57, React Native 0.86, Expo Router (typed routes), React Compiler, TanStack Query, `@clerk/expo`.

## Structure

```
src/app/(auth)/        login, signup (email + code verification via Clerk)
src/app/(tabs)/        index (pets), timeline, chat, profile
src/app/pet/           new, [id]/index (detail), add-record, add-reminder, scan
src/services/          api.ts (timeout, auth), errors.ts, ai.ts, notifications.ts, per-resource services
src/hooks/             TanStack Query hooks
src/constants/config.ts  API base URL and Clerk key
```

## Configuration

`mobile/.env.local` (see `.env.example`): `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Only public values belong in `EXPO_PUBLIC_*`.

**Release builds refuse to start** unless `EXPO_PUBLIC_API_BASE_URL` is an `https://` URL (`config.ts`), so a build can never silently point at localhost. `EXPO_PUBLIC_ALLOW_INSECURE_API=true` overrides this for deliberate local release tests. On a physical device in development, use your computer's LAN IP, not `localhost`.

## Behaviour

- **Errors**: every API failure is turned into a user-safe message by `getErrorMessage()` (network, timeout after 20 s, 400 with the server's validation message, 401, 404, 429, 5xx). Lists show a retry button; create screens show inline errors; buttons are disabled while saving.
- **Sign-up**: name is sent to Clerk as first/last name (retried without it if the Clerk instance rejects the field).
- **Records**: date picker (defaults to today, or the date read from a scan); numeric value is validated; scanned drafts must be reviewed before saving.
- **Reminders**: the picker chooses a day; the reminder is set for **9:00 AM** that day. The reminder is saved even if the notification cannot be scheduled, and the user is told why (permission off, time already passed, scheduler error).
- **Notifications**: local scheduled notifications only (no remote push). Marking done cancels the notification; un-marking reschedules it if still in the future; deleting a reminder or pet cancels them.
- **Delete**: long-press a timeline record or a reminder; "Delete pet" at the bottom of the pet screen. All ask for confirmation.
- **Chat**: pet selector when there is more than one pet; the in-flight answer is cancelled when leaving the screen or switching pet; "not veterinary advice" note.
- **Accessibility**: roles, labels and hints on the main actions and inputs; controls are at least about 36-44 dp.

## Running

```
cd mobile
npm install
npx expo start            # Metro on 8081
npm run android           # development build on a connected device / emulator
npm run typecheck && npm run lint && npx expo-doctor
```

## Known gaps

- No edit screens for pets, records or reminders (API supports them).
- No mobile unit tests.
- Colours are hard-coded (no dark theme) although `userInterfaceStyle` is `automatic`.
- No offline cache or queue; the app needs a connection.
- No password reset, account deletion, or profile editing.
- `expo-image-picker` has no configured permission text (matters for iOS / store review).
- Not exercised on a device after the latest changes; do a manual pass (see [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md)).
- `mobile/scripts/reset-project.js` is an Expo template script that moves `src/`; do not run it.
