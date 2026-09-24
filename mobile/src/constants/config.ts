import Constants from 'expo-constants';

const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

// Points at the backend/ Next.js API during development. Override via
// EXPO_PUBLIC_API_BASE_URL or app.json -> extra.apiBaseUrl for staging/prod.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? fromExtra ?? 'http://localhost:3000';

// Clerk's publishable key is public by design (it ships in the app bundle).
// The Clerk SECRET key and JWT key live only on the backend - never put them
// behind an EXPO_PUBLIC_ variable.
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
