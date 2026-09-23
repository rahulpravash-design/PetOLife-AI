import Constants from 'expo-constants';

const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

// Points at the backend/ Next.js API during development. Override via
// EXPO_PUBLIC_API_BASE_URL or app.json -> extra.apiBaseUrl for staging/prod.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? fromExtra ?? 'http://localhost:3000';
