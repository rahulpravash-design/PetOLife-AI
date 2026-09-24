import { createClerkClient, verifyToken } from '@clerk/backend';

import { usersRepo } from '@/lib/repositories/users';

// Everything Clerk-specific lives here. auth.ts calls verifyClerkToken() and
// resolveInternalUserId(), then the rest of the app only ever sees the
// application's own users.id - Clerk IDs never leak past this boundary.
//
// Server-side env (none of these may ever be shipped to the mobile app):
//   CLERK_JWT_KEY               PEM public key; enables networkless verification (recommended)
//   CLERK_SECRET_KEY            needed to provision first-time users (Clerk Backend API),
//                               and to verify via JWKS when CLERK_JWT_KEY is unset
//   CLERK_AUTHORIZED_PARTIES    optional comma-separated list of allowed `azp` origins
//   CLERK_LINK_EXISTING_BY_EMAIL  see linkExistingByEmail()

// Signals "reject this request as unauthenticated". Anything else thrown from
// here (e.g. the Clerk API being unreachable) is an infrastructure failure and
// surfaces as a 500, not a misleading 401.
export class ClerkAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClerkAuthError';
  }
}

export function isClerkConfigured(): boolean {
  return Boolean(process.env.CLERK_JWT_KEY || process.env.CLERK_SECRET_KEY);
}

function authorizedParties(): string[] | undefined {
  const parties = process.env.CLERK_AUTHORIZED_PARTIES?.split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parties?.length ? parties : undefined;
}

// Env files and hosting dashboards commonly store the multi-line PEM with
// literal "\n" sequences.
function jwtKey(): string | undefined {
  return process.env.CLERK_JWT_KEY?.replace(/\\n/g, '\n');
}

// Verifies the Clerk session token's signature, expiry/nbf and (when
// configured) authorized party, and returns the Clerk user ID (`sub`).
//
// With CLERK_JWT_KEY this makes no network call, so it cannot see a session
// revoked at Clerk (sign-out, ban) until the token expires - Clerk session
// tokens live ~60 seconds, which is the maximum revocation-validation delay.
export async function verifyClerkToken(token: string): Promise<string> {
  if (!isClerkConfigured()) throw new ClerkAuthError('Clerk is not configured');

  let payload;
  try {
    payload = await verifyToken(token, {
      jwtKey: jwtKey(),
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: authorizedParties(),
    });
  } catch (err) {
    // Bad signature, expired, not yet valid, wrong azp, unknown key, ... The
    // SDK's reason stays server-side; callers just get "unauthenticated".
    throw new ClerkAuthError(`Token verification failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Session tokens always carry a session id; a token without one is some
  // other kind of Clerk-signed JWT and is not accepted as a login.
  if (!payload.sub || !payload.sid) throw new ClerkAuthError('Not a session token');
  return payload.sub;
}

// Linking attaches a Clerk identity to a pre-existing legacy account that has
// the same (Clerk-verified) email, preserving its pets/records. Legacy signup
// never verified email ownership, so in production this is off unless
// explicitly enabled (e.g. for a one-time migration); in dev/test it's on so
// the demo account keeps working.
function linkExistingByEmail(): boolean {
  const flag = process.env.CLERK_LINK_EXISTING_BY_EMAIL;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

async function fetchClerkProfile(clerkUserId: string): Promise<{ email: string; name: string }> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new ClerkAuthError('CLERK_SECRET_KEY is required to provision new users');

  const user = await createClerkClient({ secretKey }).users.getUser(clerkUserId);

  // Only a verified primary email is trusted - it's what linking and the
  // stored email column are based on.
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  if (!primary || primary.verification?.status !== 'verified') {
    throw new ClerkAuthError('Primary email address is not verified');
  }

  const email = primary.emailAddress.trim().toLowerCase();
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.username ||
    email.split('@')[0];
  return { email, name };
}

// Maps a verified Clerk user ID to the application's users.id, provisioning
// the row on first login. Identity is the Clerk ID; email is only used once,
// at first login, to decide whether to link an existing legacy account.
export async function resolveInternalUserId(clerkUserId: string): Promise<string> {
  const existing = await usersRepo.findByClerkId(clerkUserId);
  if (existing) return existing.id;

  const { email, name } = await fetchClerkProfile(clerkUserId);
  const sameEmail = await usersRepo.findAllByEmailInsensitive(email);

  // A concurrent first-login request may have provisioned or linked this very
  // Clerk user while we were waiting on the Clerk API: that row is ours.
  const alreadyMine = sameEmail.find((u) => u.clerk_user_id === clerkUserId);
  if (alreadyMine) return alreadyMine.id;

  if (sameEmail.length === 0) {
    try {
      return (await usersRepo.createFromClerk(clerkUserId, email, name)).id;
    } catch (err) {
      // Two first-time requests can race past the lookup above; the unique
      // index lets exactly one insert win. The loser must resolve to that
      // same row, not fail or create a duplicate.
      const winner = await usersRepo.findByClerkId(clerkUserId);
      if (winner) return winner.id;
      throw err;
    }
  }

  const [candidate] = sameEmail;
  if (sameEmail.length === 1 && candidate.clerk_user_id === null && linkExistingByEmail()) {
    if (await usersRepo.linkClerkId(candidate.id, clerkUserId)) return candidate.id;
    // Lost a race to another request linking this same Clerk user.
    const winner = await usersRepo.findByClerkId(clerkUserId);
    if (winner) return winner.id;
  }

  // Email is already held by another account (already bound to a different
  // Clerk user, ambiguous, or linking is disabled). Never merge silently.
  throw new ClerkAuthError('Email address is already associated with another account');
}
