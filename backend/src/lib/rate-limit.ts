import { RateLimitError } from '@/lib/api-utils';
import { rateLimitsRepo } from '@/lib/repositories/rate-limits';

export interface LockStatus {
  locked: boolean;
  retryAfterSeconds: number;
}

// --- Login brute-force protection (Finding 1) ---------------------------
//
// Two independent buckets are checked per attempt: one keyed by the email
// being logged into, one keyed by the client IP. Either being locked blocks
// the request. Failures are only counted within a rolling window (old,
// isolated failures don't accumulate forever); once the threshold is
// crossed, each further failure escalates the lockout duration up to a cap.
// The IP threshold is intentionally higher than the email threshold since a
// single IP can legitimately represent many users (NAT, shared networks,
// or - in local dev - every request, since there's no reverse proxy setting
// x-forwarded-for).

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_EMAIL_THRESHOLD = 5;
const LOGIN_IP_THRESHOLD = 20;
const LOGIN_BACKOFF_MS = [30_000, 60_000, 120_000, 240_000, 480_000, 900_000];

export function loginEmailKey(email: string): string {
  return `login:email:${email.trim().toLowerCase()}`;
}

export function loginIpKey(ip: string): string {
  return `login:ip:${ip}`;
}

async function readLock(key: string, now: number): Promise<LockStatus> {
  const row = await rateLimitsRepo.get(key);
  if (!row?.locked_until) return { locked: false, retryAfterSeconds: 0 };
  const lockedUntilMs = new Date(row.locked_until).getTime();
  if (lockedUntilMs <= now) return { locked: false, retryAfterSeconds: 0 };
  return { locked: true, retryAfterSeconds: Math.ceil((lockedUntilMs - now) / 1000) };
}

async function bumpFailure(key: string, threshold: number, now: number): Promise<void> {
  const row = await rateLimitsRepo.get(key);
  const windowStartMs = row ? new Date(row.window_start).getTime() : now;
  const withinWindow = Boolean(row) && now - windowStartMs <= LOGIN_WINDOW_MS;

  const count = withinWindow ? row!.count + 1 : 1;
  const windowStart = withinWindow ? row!.window_start : new Date(now).toISOString();

  let lockedUntil: string | null = null;
  if (count >= threshold) {
    const idx = Math.min(count - threshold, LOGIN_BACKOFF_MS.length - 1);
    lockedUntil = new Date(now + LOGIN_BACKOFF_MS[idx]).toISOString();
  }

  await rateLimitsRepo.upsert(key, count, windowStart, lockedUntil);
}

export async function checkLoginLock(emailKey: string, ipKey: string, now = Date.now()): Promise<LockStatus> {
  const emailLock = await readLock(emailKey, now);
  if (emailLock.locked) return emailLock;
  return readLock(ipKey, now);
}

export async function recordLoginFailure(emailKey: string, ipKey: string, now = Date.now()): Promise<void> {
  await bumpFailure(emailKey, LOGIN_EMAIL_THRESHOLD, now);
  await bumpFailure(ipKey, LOGIN_IP_THRESHOLD, now);
}

// Only the email bucket is cleared on success: a shared IP may still have
// another account under active attack, so we don't want one unrelated
// successful login to reset that IP's failure count.
export async function recordLoginSuccess(emailKey: string): Promise<void> {
  await rateLimitsRepo.reset(emailKey);
}

// --- Generic fixed-window throttle (Finding 3: AI/document extraction) --
//
// Unlike the login limiter, this counts every call (success or failure) and
// simply blocks once the limit is exceeded until the window rolls over -
// there's no "good" outcome to reset on, since the point is capping cost,
// not punishing bad credentials.

export function extractUserKey(userId: string): string {
  return `extract:user:${userId}`;
}

// Per-user, per-feature key so each expensive endpoint has its own budget.
export function userThrottleKey(scope: string, userId: string): string {
  return `${scope}:user:${userId}`;
}

// Consumes one unit of the user's budget for `scope` and throws a 429
// (RateLimitError, handled by handleRoute with a Retry-After header) once the
// window's limit is exceeded.
export async function enforceUserThrottle(
  scope: string,
  userId: string,
  limit: number,
  windowMs: number,
  message: string,
): Promise<void> {
  const status = await checkAndConsumeThrottle(userThrottleKey(scope, userId), limit, windowMs);
  if (status.locked) throw new RateLimitError(message, status.retryAfterSeconds);
}

export async function checkAndConsumeThrottle(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<LockStatus> {
  const row = await rateLimitsRepo.get(key);
  const windowStartMs = row ? new Date(row.window_start).getTime() : now;
  const withinWindow = Boolean(row) && now - windowStartMs <= windowMs;

  const count = withinWindow ? row!.count + 1 : 1;
  const windowStart = withinWindow ? row!.window_start : new Date(now).toISOString();
  const windowStartResolvedMs = withinWindow ? windowStartMs : now;

  if (count > limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStartResolvedMs + windowMs - now) / 1000),
    );
    await rateLimitsRepo.upsert(key, count, windowStart, new Date(windowStartResolvedMs + windowMs).toISOString());
    return { locked: true, retryAfterSeconds };
  }

  await rateLimitsRepo.upsert(key, count, windowStart, null);
  return { locked: false, retryAfterSeconds: 0 };
}
