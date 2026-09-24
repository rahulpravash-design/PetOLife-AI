import { getClerkInstance } from '@clerk/expo';

import { CLERK_PUBLISHABLE_KEY } from '@/constants/config';

// Fresh Clerk session token for the Authorization header, or null when signed
// out. Clerk session tokens are short-lived (~60s) and getToken() returns a
// cached one until it nears expiry, so nothing long-lived is stored by the
// app: Clerk keeps its own client credential in expo-secure-store via the
// tokenCache passed to <ClerkProvider>.
export async function getAuthToken(): Promise<string | null> {
  if (!CLERK_PUBLISHABLE_KEY) return null;
  try {
    return (await getClerkInstance({ publishableKey: CLERK_PUBLISHABLE_KEY }).session?.getToken()) ?? null;
  } catch {
    return null;
  }
}
