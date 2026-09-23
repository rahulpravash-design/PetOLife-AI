import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { hashPassword, requireUserId, signToken, verifyPasswordOrDummy } from './auth';
import { sessionsRepo } from './repositories/sessions';
import { usersRepo } from './repositories/users';

function authRequest(token: string): Request {
  return new Request('http://localhost/test', { headers: { authorization: `Bearer ${token}` } });
}

function createTestUser() {
  return usersRepo.create(`test-auth-${randomUUID()}@example.com`, hashPassword('irrelevant'), 'Test User');
}

describe('verifyPasswordOrDummy', () => {
  it('always returns false for an unknown account, regardless of the password', () => {
    expect(verifyPasswordOrDummy('anything', null)).toBe(false);
    expect(verifyPasswordOrDummy('', null)).toBe(false);
  });

  it('validates correctly against a real hash', () => {
    const hash = hashPassword('correct-horse-battery-staple');
    expect(verifyPasswordOrDummy('correct-horse-battery-staple', hash)).toBe(true);
    expect(verifyPasswordOrDummy('wrong-guess', hash)).toBe(false);
  });

  it('takes comparable time whether or not the account exists (timing-safety)', () => {
    const hash = hashPassword('correct-horse-battery-staple');
    const iterations = 5;

    const realStart = performance.now();
    for (let i = 0; i < iterations; i++) verifyPasswordOrDummy('wrong-guess', hash);
    const realElapsed = performance.now() - realStart;

    const dummyStart = performance.now();
    for (let i = 0; i < iterations; i++) verifyPasswordOrDummy('wrong-guess', null);
    const dummyElapsed = performance.now() - dummyStart;

    // Both paths must run one bcrypt.compareSync at the same cost factor. A
    // regression that short-circuits the dummy path (e.g. `hash ? compare() :
    // false` without a dummy compare) would make it orders of magnitude
    // faster than the real path; a generous ratio bound catches that without
    // being flaky about normal timing noise.
    const ratio = dummyElapsed / realElapsed;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(3);
  });
});

describe('session-backed auth (signToken / requireUserId / revocation)', () => {
  it('accepts a freshly-signed token', async () => {
    const user = await createTestUser();
    const token = await signToken(user.id);
    expect(await requireUserId(authRequest(token))).toBe(user.id);
  });

  it('rejects a token whose session has been revoked (logout)', async () => {
    const user = await createTestUser();
    const token = await signToken(user.id);

    // Mirrors what the logout route does: decode isn't exposed directly, so
    // pull the jti the same way requireSession does, via the token payload.
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { jti: string };
    await sessionsRepo.revoke(payload.jti);

    await expect(requireUserId(authRequest(token))).rejects.toThrow();
  });

  it('rejects a session that has already expired', async () => {
    const user = await createTestUser();
    // Bypass signToken's 7d TTL to simulate an expired session directly.
    const jti = await sessionsRepo.create(user.id, new Date(Date.now() - 1000).toISOString());
    expect(await sessionsRepo.isActive(jti)).toBe(false);
  });

  it('rejects requests with no token and with a malformed token', async () => {
    await expect(requireUserId(new Request('http://localhost/test'))).rejects.toThrow();
    await expect(requireUserId(authRequest('not-a-real-token'))).rejects.toThrow();
  });
});
