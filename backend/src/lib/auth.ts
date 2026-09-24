import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { ClerkAuthError, resolveInternalUserId, verifyClerkToken } from '@/lib/clerk';
import { sessionsRepo } from '@/lib/repositories/sessions';
import { CLERK_MANAGED_PASSWORD_HASH } from '@/lib/repositories/users';

// Generated per-process, not hardcoded: a fixed dev secret in source would be a known
// value anyone could forge tokens with. Restarting the server invalidates existing
// dev tokens, which is fine for local dev.
const DEV_FALLBACK_SECRET = randomBytes(32).toString('hex');

const TOKEN_TTL = '7d';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Precomputed once at module load, same cost factor as real password hashes.
// Compared against on every login for an email that doesn't exist, so an
// unknown-email response takes the same time as a wrong-password response -
// otherwise the missing bcrypt call would leak whether the email is registered.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('petolife-timing-safety-dummy', 10);

// Legacy email/password + self-issued HS256 JWT auth. Clerk is the production
// identity provider; this is a temporary migration/compatibility path kept for
// local development and the demo account, not a permanent second auth system.
// Defaults to on outside production and off in production; set
// LEGACY_AUTH_ENABLED explicitly to override either way.
export function isLegacyAuthEnabled(): boolean {
  const flag = process.env.LEGACY_AUTH_ENABLED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return DEV_FALLBACK_SECRET;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// Always performs a bcrypt comparison, even when `hash` is null (unknown
// email) - against the fixed dummy hash instead. The result is forced to
// false whenever `hash` is null regardless of what the dummy compare
// returns, so this is safe to call unconditionally in the login route.
export function verifyPasswordOrDummy(password: string, hash: string | null): boolean {
  // A Clerk-managed account has no local password; treat it exactly like an
  // unknown email so the (much faster) invalid-hash compare can't reveal it.
  const realHash = hash === CLERK_MANAGED_PASSWORD_HASH ? null : hash;
  const matched = bcrypt.compareSync(password, realHash ?? DUMMY_PASSWORD_HASH);
  return realHash !== null && matched;
}

export async function signToken(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const jti = await sessionsRepo.create(userId, expiresAt);
  return jwt.sign({ sub: userId, jti }, getSecret(), { expiresIn: TOKEN_TTL });
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface Session {
  userId: string;
  // Legacy sessions are server-side rows that logout revokes. Clerk sessions
  // are managed (and revoked) by Clerk, so they have no jti here.
  jti: string | null;
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new UnauthorizedError('Missing token');
  return token;
}

// Reads the algorithm from the (still unverified) JWT header purely to choose
// which verifier runs. It is never trusted: each verifier enforces its own
// algorithm on its own key, and a token is only ever checked by one of them.
function peekAlg(token: string): string | null {
  try {
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    return typeof header?.alg === 'string' ? header.alg : null;
  } catch {
    return null;
  }
}

function verifyLegacyToken(token: string): { userId: string; jti: string } {
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub || !payload.jti) throw new UnauthorizedError();
    return { userId: payload.sub, jti: payload.jti };
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

async function requireLegacySession(token: string): Promise<Session> {
  if (!isLegacyAuthEnabled()) throw new UnauthorizedError('Invalid or expired token');
  const { userId, jti } = verifyLegacyToken(token);
  if (!(await sessionsRepo.isActive(jti))) throw new UnauthorizedError('Session expired or revoked');
  return { userId, jti };
}

async function requireClerkSession(token: string): Promise<Session> {
  try {
    const clerkUserId = await verifyClerkToken(token);
    return { userId: await resolveInternalUserId(clerkUserId), jti: null };
  } catch (err) {
    if (err instanceof ClerkAuthError) {
      console.warn(`Clerk auth rejected: ${err.message}`);
      throw new UnauthorizedError('Invalid or expired token');
    }
    // Anything else (e.g. the Clerk API being unreachable while provisioning)
    // is an infrastructure failure, not an authentication result.
    throw err;
  }
}

// Resolves the caller to an internal user id. Clerk tokens are RS256, legacy
// tokens HS256; anything else (including `alg: none`) is rejected outright.
export async function requireSession(request: Request): Promise<Session> {
  const token = bearerToken(request);
  const alg = peekAlg(token);
  if (alg === 'HS256') return requireLegacySession(token);
  if (alg === 'RS256') return requireClerkSession(token);
  throw new UnauthorizedError('Invalid or expired token');
}

export async function requireUserId(request: Request): Promise<string> {
  return (await requireSession(request)).userId;
}
