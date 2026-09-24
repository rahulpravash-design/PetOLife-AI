import Constants from 'expo-constants';

const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

// Points at the backend/ Next.js API during development. Override via
// EXPO_PUBLIC_API_BASE_URL (preferred) or app.json -> extra.apiBaseUrl for
// staging/prod.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? fromExtra ?? 'http://localhost:3000';

// A release build must talk to a real HTTPS backend. Failing at startup is
// better than shipping an app that silently points at localhost (or cleartext
// HTTP, which Android blocks in release builds) and just shows network errors.
// Set EXPO_PUBLIC_ALLOW_INSECURE_API=true to deliberately test a release build
// against a local/HTTP server.
if (!__DEV__ && process.env.EXPO_PUBLIC_ALLOW_INSECURE_API !== 'true' && !API_BASE_URL.startsWith('https://')) {
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL must be set to an https:// URL for release builds (see docs/DEPLOYMENT.md).',
  );
}

// Clerk's publishable key is public by design (it ships in the app bundle).
// The Clerk SECRET key and JWT key live only on the backend - never put them
// behind an EXPO_PUBLIC_ variable.
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
