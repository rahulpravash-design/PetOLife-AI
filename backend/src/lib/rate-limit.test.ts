import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { checkAndConsumeThrottle, checkLoginLock, recordLoginFailure, recordLoginSuccess } from './rate-limit';

// Each test uses freshly-randomized keys so runs never collide with each
// other or with real login/extraction traffic in the shared dev DB.
function uniqueKey(label: string): string {
  return `test:${label}:${randomUUID()}`;
}

describe('checkLoginLock / recordLoginFailure', () => {
  it('is unlocked for a key that has never failed', () => {
    const emailKey = uniqueKey('email');
    const ipKey = uniqueKey('ip');
    expect(checkLoginLock(emailKey, ipKey).locked).toBe(false);
  });

  it('locks the email bucket once the failure threshold is reached', () => {
    const emailKey = uniqueKey('email');
    const ipKey = uniqueKey('ip');
    const now = Date.now();

    for (let i = 0; i < 4; i++) recordLoginFailure(emailKey, ipKey, now);
    expect(checkLoginLock(emailKey, ipKey, now).locked).toBe(false); // 4 failures: below threshold (5)

    recordLoginFailure(emailKey, ipKey, now); // 5th failure crosses the threshold
    const status = checkLoginLock(emailKey, ipKey, now);
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('escalates the lockout duration on repeated failures (exponential backoff)', () => {
    const emailKey = uniqueKey('email');
    const ipKey = uniqueKey('ip');
    const now = Date.now();

    for (let i = 0; i < 5; i++) recordLoginFailure(emailKey, ipKey, now);
    const firstLock = checkLoginLock(emailKey, ipKey, now);

    for (let i = 0; i < 2; i++) recordLoginFailure(emailKey, ipKey, now);
    const secondLock = checkLoginLock(emailKey, ipKey, now);

    expect(secondLock.retryAfterSeconds).toBeGreaterThan(firstLock.retryAfterSeconds);
  });

  it('clears the email bucket on success, without needing the IP bucket to also reset', () => {
    const emailKey = uniqueKey('email');
    const ipKey = uniqueKey('ip');
    const now = Date.now();

    for (let i = 0; i < 5; i++) recordLoginFailure(emailKey, ipKey, now);
    expect(checkLoginLock(emailKey, ipKey, now).locked).toBe(true);

    recordLoginSuccess(emailKey);
    expect(checkLoginLock(emailKey, ipKey, now).locked).toBe(false);
  });

  it('a locked email key still blocks even from a totally fresh IP', () => {
    const emailKey = uniqueKey('email');
    const now = Date.now();
    for (let i = 0; i < 5; i++) recordLoginFailure(emailKey, uniqueKey('ip'), now);
    expect(checkLoginLock(emailKey, uniqueKey('ip'), now).locked).toBe(true);
  });
});

describe('checkAndConsumeThrottle', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const key = uniqueKey('throttle');
    const now = Date.now();
    const limit = 3;
    const windowMs = 60_000;

    for (let i = 0; i < limit; i++) {
      expect(checkAndConsumeThrottle(key, limit, windowMs, now).locked).toBe(false);
    }
    const over = checkAndConsumeThrottle(key, limit, windowMs, now);
    expect(over.locked).toBe(true);
    expect(over.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets once the window has fully elapsed', () => {
    const key = uniqueKey('throttle');
    const now = Date.now();
    const limit = 2;
    const windowMs = 1_000;

    checkAndConsumeThrottle(key, limit, windowMs, now);
    checkAndConsumeThrottle(key, limit, windowMs, now);
    expect(checkAndConsumeThrottle(key, limit, windowMs, now).locked).toBe(true);

    const later = now + windowMs + 1;
    expect(checkAndConsumeThrottle(key, limit, windowMs, later).locked).toBe(false);
  });
});
