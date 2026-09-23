import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { sessionsRepo } from '@/lib/repositories/sessions';

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
  const matched = bcrypt.compareSync(password, hash ?? DUMMY_PASSWORD_HASH);
  return hash !== null && matched;
}

export function signToken(userId: string): string {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const jti = sessionsRepo.create(userId, expiresAt);
  return jwt.sign({ sub: userId, jti }, getSecret(), { expiresIn: TOKEN_TTL });
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function verifyToken(request: Request): { userId: string; jti: string } {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new UnauthorizedError('Missing token');

  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub || !payload.jti) throw new UnauthorizedError();
    return { userId: payload.sub, jti: payload.jti };
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

// Like requireUserId, but also returns the session id (jti) - needed by the
// logout route to know which session to revoke.
export function requireSession(request: Request): { userId: string; jti: string } {
  const { userId, jti } = verifyToken(request);
  if (!sessionsRepo.isActive(jti)) throw new UnauthorizedError('Session expired or revoked');
  return { userId, jti };
}

export function requireUserId(request: Request): string {
  return requireSession(request).userId;
}
