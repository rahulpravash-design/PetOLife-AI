import { createHmac, generateKeyPairSync, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { POST as signupRoute } from '@/app/api/auth/signup/route';
import { GET as getPetRoute, PATCH as patchPetRoute, DELETE as deletePetRoute } from '@/app/api/pets/[id]/route';
import { GET as listPetsRoute, POST as createPetRoute } from '@/app/api/pets/route';
import { GET as getRecordRoute } from '@/app/api/pets/[id]/records/[recordId]/route';
import { GET as listRecordsRoute, POST as createRecordRoute } from '@/app/api/pets/[id]/records/route';
import {
  DELETE as deleteReminderRoute,
  PATCH as patchReminderRoute,
} from '@/app/api/pets/[id]/reminders/[reminderId]/route';
import { GET as listRemindersRoute, POST as createReminderRoute } from '@/app/api/pets/[id]/reminders/route';
import { hashPassword, requireUserId, signToken, verifyPasswordOrDummy } from '@/lib/auth';
import { db, dbDriver } from '@/lib/db';
import { petsRepo } from '@/lib/repositories/pets';
import { CLERK_MANAGED_PASSWORD_HASH, usersRepo } from '@/lib/repositories/users';

// What is real here and what is stubbed:
//  - REAL: token signature/expiry/azp verification. Tokens are signed with a
//    locally generated RSA key and verified by @clerk/backend's own
//    verifyToken() using that key as CLERK_JWT_KEY (the networkless path).
//  - REAL: the app's dispatch, provisioning, mapping, routes, authorization
//    and database (the dev SQLite DB).
//  - STUBBED: only Clerk's Backend API user lookup (createClerkClient().users
//    .getUser), because there are no live Clerk credentials in tests.
// Nothing here talks to a real Clerk instance.
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@clerk/backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clerk/backend')>();
  return { ...actual, createClerkClient: () => ({ users: { getUser } }) };
});

const clerkKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CLERK_PUBLIC_PEM = clerkKeys.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const TEST_PARTY = 'https://app.petolife.test';

const ENV_KEYS = [
  'CLERK_JWT_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_AUTHORIZED_PARTIES',
  'CLERK_LINK_EXISTING_BY_EMAIL',
  'LEGACY_AUTH_ENABLED',
] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.CLERK_JWT_KEY = CLERK_PUBLIC_PEM;
  process.env.CLERK_SECRET_KEY = 'sk_test_unit_test_only_not_a_real_key';
  getUser.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.restoreAllMocks();
});

// --- helpers ---------------------------------------------------------------

interface TokenOptions {
  key?: typeof clerkKeys.privateKey;
  azp?: string;
  sid?: string | null;
  iatOffset?: number; // seconds relative to now
  expOffset?: number;
  nbfOffset?: number;
}

function clerkToken(sub: string, o: TokenOptions = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub,
    iss: 'https://test-instance.clerk.accounts.dev',
    iat: now + (o.iatOffset ?? 0),
    nbf: now + (o.nbfOffset ?? -10),
    exp: now + (o.expOffset ?? 60),
  };
  if (o.sid !== null) payload.sid = o.sid ?? `sess_${randomUUID()}`;
  if (o.azp) payload.azp = o.azp;
  return jwt.sign(payload, o.key ?? clerkKeys.privateKey, { algorithm: 'RS256' });
}

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

function req(token?: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new Request('http://localhost/test', {
    method: init.method ?? 'GET',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      // Isolate login attempts from the shared 'unknown' IP rate-limit bucket.
      'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250) + 1}-${randomUUID()}`,
      ...init.headers,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

function clerkUser(email: string, opts: { verified?: boolean; first?: string; last?: string } = {}) {
  return {
    primaryEmailAddressId: 'idn_primary',
    emailAddresses: [
      {
        id: 'idn_primary',
        emailAddress: email,
        verification: { status: opts.verified === false ? 'unverified' : 'verified' },
      },
    ],
    firstName: opts.first ?? 'Clerk',
    lastName: opts.last ?? 'Tester',
    username: null,
  };
}

const newClerkId = () => `user_${randomUUID().replace(/-/g, '')}`;
const newEmail = () => `clerk-${randomUUID()}@example.com`;

// Registers a Clerk user with the stubbed Backend API and returns a valid token.
function loginAsNewClerkUser(email = newEmail()) {
  const sub = newClerkId();
  getUser.mockImplementation(async (id: string) => {
    if (id === sub) return clerkUser(email);
    throw new Error(`unexpected getUser(${id})`);
  });
  return { sub, email, token: clerkToken(sub) };
}

// Two distinct Clerk users, both provisioned, with a getUser stub serving both.
async function twoClerkUsers() {
  const a = { sub: newClerkId(), email: newEmail() };
  const b = { sub: newClerkId(), email: newEmail() };
  getUser.mockImplementation(async (id: string) => clerkUser(id === a.sub ? a.email : b.email));
  const tokenA = clerkToken(a.sub);
  const tokenB = clerkToken(b.sub);
  const userIdA = await requireUserId(req(tokenA));
  const userIdB = await requireUserId(req(tokenB));
  return { a, b, tokenA, tokenB, userIdA, userIdB };
}

const countByClerkId = async (sub: string) =>
  (await db.get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM users WHERE clerk_user_id = ?', [sub]))!.n;

// --- A. Clerk cryptographic verification (real @clerk/backend verifyToken) ---

describe('Clerk token verification', () => {
  it('accepts a valid RS256 token and resolves to the mapped internal user id', async () => {
    const { sub, token } = loginAsNewClerkUser();
    const userId = await requireUserId(req(token));

    const row = await usersRepo.findByClerkId(sub);
    expect(row?.id).toBe(userId);
    // The Clerk ID is the mapping key; the internal id is a different value.
    expect(userId).not.toBe(sub);
  });

  it('accepts a token shaped like a real Clerk session token (kid header, azp, v2 claims)', async () => {
    const { sub } = loginAsNewClerkUser();
    const now = Math.floor(Date.now() / 1000);
    // Mirrors what a Clerk instance issues: RS256 + kid, and the session-token
    // claims Clerk adds beyond sub/sid/exp.
    const token = jwt.sign(
      {
        sub,
        sid: `sess_${randomUUID()}`,
        azp: TEST_PARTY,
        iss: 'https://test-instance.clerk.accounts.dev',
        v: 2,
        fva: [5, -1],
        sts: 'active',
        iat: now,
        nbf: now - 5,
        exp: now + 60,
        jti: randomUUID().slice(0, 20),
      },
      clerkKeys.privateKey,
      { algorithm: 'RS256', keyid: 'ins_test_key_id', header: { alg: 'RS256', typ: 'JWT', kid: 'ins_test_key_id' } },
    );
    process.env.CLERK_AUTHORIZED_PARTIES = TEST_PARTY;

    const userId = await requireUserId(req(token));
    expect((await usersRepo.findByClerkId(sub))?.id).toBe(userId);
  });

  it('rejects an expired token', async () => {
    const { sub } = loginAsNewClerkUser();
    const expired = clerkToken(sub, { iatOffset: -300, nbfOffset: -300, expOffset: -120 });
    await expect(requireUserId(req(expired))).rejects.toThrow('Invalid or expired token');
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects a token that is not valid yet (nbf in the future)', async () => {
    const { sub } = loginAsNewClerkUser();
    const early = clerkToken(sub, { nbfOffset: 600, expOffset: 660 });
    await expect(requireUserId(req(early))).rejects.toThrow('Invalid or expired token');
  });

  it('rejects a token signed with a different RSA key', async () => {
    const { sub } = loginAsNewClerkUser();
    const forged = clerkToken(sub, { key: otherKeys.privateKey });
    await expect(requireUserId(req(forged))).rejects.toThrow('Invalid or expired token');
    expect(await countByClerkId(sub)).toBe(0);
  });

  it('rejects a token from an unauthorized party, and accepts an authorized one', async () => {
    process.env.CLERK_AUTHORIZED_PARTIES = TEST_PARTY;
    const { sub } = loginAsNewClerkUser();

    const wrongParty = clerkToken(sub, { azp: 'https://evil.example' });
    await expect(requireUserId(req(wrongParty))).rejects.toThrow('Invalid or expired token');

    const rightParty = clerkToken(sub, { azp: TEST_PARTY });
    await expect(requireUserId(req(rightParty))).resolves.toEqual(expect.any(String));
  });

  it('rejects an unsigned alg=none token', async () => {
    const { sub } = loginAsNewClerkUser();
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub, sid: 'sess_x', iat: now, exp: now + 60 })}.`;
    await expect(requireUserId(req(unsigned))).rejects.toThrow('Invalid or expired token');
    expect(await countByClerkId(sub)).toBe(0);
  });

  it('rejects an HS256 token forged using the Clerk public key as the HMAC secret', async () => {
    // Classic algorithm-confusion attack: the public key is, well, public.
    const { sub } = loginAsNewClerkUser();
    const now = Math.floor(Date.now() / 1000);
    const signingInput = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, sid: 'sess_x', jti: randomUUID(), iat: now, exp: now + 60 })}`;
    const sig = createHmac('sha256', CLERK_PUBLIC_PEM).update(signingInput).digest('base64url');
    const forged = `${signingInput}.${sig}`;

    await expect(requireUserId(req(forged))).rejects.toThrow('Invalid or expired token');
    // ...whether or not the legacy path is enabled.
    process.env.LEGACY_AUTH_ENABLED = 'false';
    await expect(requireUserId(req(forged))).rejects.toThrow('Invalid or expired token');
    expect(await countByClerkId(sub)).toBe(0);
  });

  it('rejects requests with no token, a malformed token, or a non-Bearer header', async () => {
    await expect(requireUserId(req())).rejects.toThrow('Missing token');
    await expect(requireUserId(req('not-a-jwt'))).rejects.toThrow('Invalid or expired token');
    await expect(
      requireUserId(new Request('http://localhost/test', { headers: { authorization: 'Basic abc' } })),
    ).rejects.toThrow('Missing token');
  });

  it('rejects a validly-signed token that is not a session token (no sid)', async () => {
    const { sub } = loginAsNewClerkUser();
    await expect(requireUserId(req(clerkToken(sub, { sid: null })))).rejects.toThrow('Invalid or expired token');
  });

  it('rejects RS256 tokens when Clerk is not configured', async () => {
    delete process.env.CLERK_JWT_KEY;
    delete process.env.CLERK_SECRET_KEY;
    const { token } = loginAsNewClerkUser();
    await expect(requireUserId(req(token))).rejects.toThrow('Invalid or expired token');
  });

  it('accepts a PEM stored with literal \\n sequences (as env dashboards often store it)', async () => {
    process.env.CLERK_JWT_KEY = CLERK_PUBLIC_PEM.replace(/\n/g, '\\n');
    const { token } = loginAsNewClerkUser();
    await expect(requireUserId(req(token))).resolves.toEqual(expect.any(String));
  });
});

// --- B. Provisioning and mapping (Clerk Backend API stubbed) ----------------

describe('Clerk user provisioning and mapping', () => {
  it('creates an internal user on first login and reuses it afterwards without calling Clerk again', async () => {
    const { sub, email, token } = loginAsNewClerkUser(`MixedCase-${randomUUID()}@Example.com`);

    const first = await requireUserId(req(token));
    expect(getUser).toHaveBeenCalledTimes(1);

    const second = await requireUserId(req(clerkToken(sub)));
    expect(second).toBe(first);
    expect(getUser).toHaveBeenCalledTimes(1);

    const row = await db.get<{ email: string; name: string; password_hash: string }>(
      'SELECT email, name, password_hash FROM users WHERE id = ?',
      [first],
    );
    expect(row?.email).toBe(email.toLowerCase());
    expect(row?.name).toBe('Clerk Tester');
    expect(row?.password_hash).toBe(CLERK_MANAGED_PASSWORD_HASH);
  });

  it('links an existing legacy account with the same verified email and preserves its pets', async () => {
    const email = newEmail();
    const legacy = await usersRepo.create(email, hashPassword('legacy-password-1'), 'Legacy Owner');
    const pet = await petsRepo.create(legacy.id, { name: 'Bruno', species: 'dog' });

    const sub = newClerkId();
    // Different letter case than the stored email: still the same address.
    getUser.mockResolvedValue(clerkUser(email.toUpperCase()));
    const token = clerkToken(sub);

    expect(await requireUserId(req(token))).toBe(legacy.id);
    expect((await usersRepo.findByClerkId(sub))?.id).toBe(legacy.id);

    const res = await getPetRoute(req(token), params({ id: pet.id }));
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('Bruno');
  });

  it('does not link when CLERK_LINK_EXISTING_BY_EMAIL=false, and leaves the legacy account untouched', async () => {
    process.env.CLERK_LINK_EXISTING_BY_EMAIL = 'false';
    const email = newEmail();
    const legacy = await usersRepo.create(email, hashPassword('legacy-password-1'), 'Legacy Owner');

    const sub = newClerkId();
    getUser.mockResolvedValue(clerkUser(email));
    await expect(requireUserId(req(clerkToken(sub)))).rejects.toThrow('Invalid or expired token');

    expect(await usersRepo.findByClerkId(sub)).toBeNull();
    const row = await db.get<{ clerk_user_id: string | null }>('SELECT clerk_user_id FROM users WHERE id = ?', [legacy.id]);
    expect(row?.clerk_user_id).toBeNull();
  });

  it('defaults linking to off in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const email = newEmail();
      await usersRepo.create(email, hashPassword('legacy-password-1'), 'Legacy Owner');
      getUser.mockResolvedValue(clerkUser(email));
      await expect(requireUserId(req(clerkToken(newClerkId())))).rejects.toThrow('Invalid or expired token');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('never re-links an account already bound to a different Clerk user', async () => {
    const owner = loginAsNewClerkUser();
    const ownerId = await requireUserId(req(owner.token));

    const intruderSub = newClerkId();
    getUser.mockResolvedValue(clerkUser(owner.email)); // same email, different Clerk identity
    await expect(requireUserId(req(clerkToken(intruderSub)))).rejects.toThrow('Invalid or expired token');

    expect(await usersRepo.findByClerkId(intruderSub)).toBeNull();
    expect((await usersRepo.findByClerkId(owner.sub))?.id).toBe(ownerId);
  });

  it('refuses to provision from an unverified primary email and creates nothing', async () => {
    const sub = newClerkId();
    const email = newEmail();
    getUser.mockResolvedValue(clerkUser(email, { verified: false }));

    await expect(requireUserId(req(clerkToken(sub)))).rejects.toThrow('Invalid or expired token');
    expect(await countByClerkId(sub)).toBe(0);
    expect(await usersRepo.findByEmail(email)).toBeNull();
  });

  it('refuses to provision when the user has no primary email', async () => {
    const sub = newClerkId();
    getUser.mockResolvedValue({ ...clerkUser(newEmail()), primaryEmailAddressId: null });
    await expect(requireUserId(req(clerkToken(sub)))).rejects.toThrow('Invalid or expired token');
    expect(await countByClerkId(sub)).toBe(0);
  });

  it('cannot provision an unknown user without CLERK_SECRET_KEY, but still serves already-mapped users', async () => {
    const mapped = loginAsNewClerkUser();
    const mappedId = await requireUserId(req(mapped.token));

    delete process.env.CLERK_SECRET_KEY; // JWT key alone = verification only
    await expect(requireUserId(req(clerkToken(mapped.sub)))).resolves.toBe(mappedId);
    await expect(requireUserId(req(clerkToken(newClerkId())))).rejects.toThrow('Invalid or expired token');
  });

  it('treats a Clerk API outage as a server error, not as an authentication result', async () => {
    getUser.mockRejectedValue(new Error('Clerk API unreachable'));
    await expect(requireUserId(req(clerkToken(newClerkId())))).rejects.toThrow('Clerk API unreachable');
  });

  it('resolves concurrent first-login requests for the same Clerk user to one row', async () => {
    const sub = newClerkId();
    const email = newEmail();
    // The delay lets every request pass the "not provisioned yet" check before
    // any of them inserts, forcing a real race on the unique indexes.
    getUser.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return clerkUser(email);
    });
    const token = clerkToken(sub);
    const createFromClerk = usersRepo.createFromClerk.bind(usersRepo);
    let attempted = 0;
    let rejected = 0;
    const insert = vi.spyOn(usersRepo, 'createFromClerk').mockImplementation(async (...args) => {
      attempted++;
      try {
        return await createFromClerk(...args);
      } catch (err) {
        rejected++;
        throw err;
      }
    });

    let ids: string[];
    try {
      ids = await Promise.all(Array.from({ length: 8 }, () => requireUserId(req(token))));
    } finally {
      insert.mockRestore();
    }

    expect(new Set(ids).size).toBe(1);
    expect(await countByClerkId(sub)).toBe(1);
    expect(await usersRepo.findAllByEmailInsensitive(email)).toHaveLength(1);
    // On Postgres the race is real: several inserts are attempted, the database
    // (not just the app) refuses all but one, and the losers still resolve to
    // the winner's row. SQLite's driver is synchronous, so requests serialize
    // and there is no race window to assert on.
    if (dbDriver === 'postgres') {
      expect(attempted).toBeGreaterThan(1);
      expect(attempted - rejected).toBe(1);
    }
  });

  it('resolves concurrent first-login requests that link the same legacy account', async () => {
    const email = newEmail();
    const legacy = await usersRepo.create(email, hashPassword('legacy-password-1'), 'Legacy Owner');
    const sub = newClerkId();
    getUser.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return clerkUser(email);
    });
    const token = clerkToken(sub);

    const ids = await Promise.all(Array.from({ length: 8 }, () => requireUserId(req(token))));

    expect(new Set(ids)).toEqual(new Set([legacy.id]));
    expect(await countByClerkId(sub)).toBe(1);
  });

  it('linkClerkId only links an unlinked row, and reports whether this call did the linking', async () => {
    const legacy = await usersRepo.create(newEmail(), hashPassword('legacy-password-1'), 'Legacy Owner');
    const first = newClerkId();

    expect(await usersRepo.linkClerkId(legacy.id, first)).toBe(true);
    // Already linked: neither the same nor a different Clerk id may overwrite it.
    expect(await usersRepo.linkClerkId(legacy.id, first)).toBe(false);
    expect(await usersRepo.linkClerkId(legacy.id, newClerkId())).toBe(false);
    expect(await usersRepo.linkClerkId('no-such-user', newClerkId())).toBe(false);
    expect((await usersRepo.findByClerkId(first))?.id).toBe(legacy.id);

    // A Clerk id already bound to one account can't be attached to a second one.
    const other = await usersRepo.create(newEmail(), hashPassword('legacy-password-2'), 'Other Owner');
    await expect(usersRepo.linkClerkId(other.id, first)).rejects.toThrow();
    expect(await usersRepo.findByClerkId(first)).toMatchObject({ id: legacy.id });
  });

  it('enforces one internal user per Clerk id at the database level', async () => {
    const sub = newClerkId();
    await usersRepo.createFromClerk(sub, newEmail(), 'One');
    await expect(usersRepo.createFromClerk(sub, newEmail(), 'Two')).rejects.toThrow();
  });

  it('rejects conflicts with the same generic response as any other bad token (no enumeration)', async () => {
    const owner = loginAsNewClerkUser();
    await requireUserId(req(owner.token));

    getUser.mockResolvedValue(clerkUser(owner.email));
    const conflict = await getPetRoute(req(clerkToken(newClerkId())), params({ id: 'x' }));
    const badSig = await getPetRoute(req(clerkToken(newClerkId(), { key: otherKeys.privateKey })), params({ id: 'x' }));

    expect(conflict.status).toBe(401);
    expect(badSig.status).toBe(401);
    expect(await conflict.json()).toEqual(await badSig.json());
  });
});

// --- Legacy auth compatibility --------------------------------------------

describe('legacy authentication (LEGACY_AUTH_ENABLED)', () => {
  it('still accepts legacy HS256 tokens when enabled (default outside production)', async () => {
    const user = await usersRepo.create(newEmail(), hashPassword('legacy-password-1'), 'Legacy');
    const token = await signToken(user.id);
    expect(await requireUserId(req(token))).toBe(user.id);
    expect((await listPetsRoute(req(token))).status).toBe(200);
  });

  it('still supports legacy login and signup when enabled', async () => {
    const email = newEmail();
    const signup = await signupRoute(req(undefined, { method: 'POST', body: { email, password: 'longenough1', name: 'Legacy' } }));
    expect(signup.status).toBe(200);
    const login = await loginRoute(req(undefined, { method: 'POST', body: { email, password: 'longenough1' } }));
    expect(login.status).toBe(200);
    expect((await login.json()).token).toEqual(expect.any(String));
  });

  it('rejects legacy tokens, login and signup when LEGACY_AUTH_ENABLED=false', async () => {
    const email = newEmail();
    const user = await usersRepo.create(email, hashPassword('legacy-password-1'), 'Legacy');
    const token = await signToken(user.id);

    process.env.LEGACY_AUTH_ENABLED = 'false';

    await expect(requireUserId(req(token))).rejects.toThrow('Invalid or expired token');
    expect((await listPetsRoute(req(token))).status).toBe(401);

    const login = await loginRoute(req(undefined, { method: 'POST', body: { email, password: 'legacy-password-1' } }));
    expect(login.status).toBe(404);
    const signup = await signupRoute(
      req(undefined, { method: 'POST', body: { email: newEmail(), password: 'longenough1', name: 'X' } }),
    );
    expect(signup.status).toBe(404);
  });

  it('disables legacy auth by default in production but still serves Clerk tokens', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const user = await usersRepo.create(newEmail(), hashPassword('legacy-password-1'), 'Legacy');
      const legacyToken = await signToken(user.id).catch(() => null); // JWT_SECRET may be absent in production
      if (legacyToken) await expect(requireUserId(req(legacyToken))).rejects.toThrow('Invalid or expired token');

      const { token } = loginAsNewClerkUser();
      await expect(requireUserId(req(token))).resolves.toEqual(expect.any(String));
      const login = await loginRoute(req(undefined, { method: 'POST', body: { email: 'a@b.co', password: 'x' } }));
      expect(login.status).toBe(404);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('a Clerk-managed account cannot be logged into with a password and is indistinguishable from an unknown email', async () => {
    const { token } = loginAsNewClerkUser();
    await requireUserId(req(token));
    const clerkOnly = (await db.get<{ email: string }>('SELECT email FROM users WHERE clerk_user_id IS NOT NULL ORDER BY created_at DESC LIMIT 1'))!.email;

    expect(verifyPasswordOrDummy('anything', CLERK_MANAGED_PASSWORD_HASH)).toBe(false);
    expect(verifyPasswordOrDummy(CLERK_MANAGED_PASSWORD_HASH, CLERK_MANAGED_PASSWORD_HASH)).toBe(false);

    const known = await loginRoute(req(undefined, { method: 'POST', body: { email: clerkOnly, password: 'guess-guess-1' } }));
    const unknown = await loginRoute(req(undefined, { method: 'POST', body: { email: newEmail(), password: 'guess-guess-1' } }));
    expect(known.status).toBe(401);
    expect(await known.json()).toEqual(await unknown.json());
  });
});

// --- Logout -----------------------------------------------------------------

describe('logout', () => {
  it('revokes a legacy session server-side', async () => {
    const user = await usersRepo.create(newEmail(), hashPassword('legacy-password-1'), 'Legacy');
    const token = await signToken(user.id);

    expect((await logoutRoute(req(token, { method: 'POST' }))).status).toBe(204);
    expect((await listPetsRoute(req(token))).status).toBe(401);
  });

  it('succeeds for a Clerk session as a no-op (the client signs out via Clerk) and creates no local session rows', async () => {
    const { token } = loginAsNewClerkUser();
    const userId = await requireUserId(req(token));

    expect((await logoutRoute(req(token, { method: 'POST' }))).status).toBe(204);

    const sessions = await db.get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM sessions WHERE user_id = ?', [userId]);
    expect(sessions?.n).toBe(0);

    // Documents the accepted trade-off: networkless verification cannot see
    // a Clerk-side sign-out, so the token stays usable until it expires
    // (Clerk session tokens live ~60 seconds).
    expect((await listPetsRoute(req(token))).status).toBe(200);
  });

  it('requires authentication', async () => {
    expect((await logoutRoute(req(undefined, { method: 'POST' }))).status).toBe(401);
    expect((await logoutRoute(req('garbage', { method: 'POST' }))).status).toBe(401);
  });
});

// --- Authorization through the real routes, with Clerk identities -----------

describe('authorization boundaries with Clerk-authenticated users', () => {
  it('rejects unauthenticated access to every protected route with 401', async () => {
    const pid = 'p', rid = 'r';
    const p = params({ id: pid });
    const responses = await Promise.all([
      listPetsRoute(req()),
      createPetRoute(req(undefined, { method: 'POST', body: { name: 'x', species: 'dog' } })),
      getPetRoute(req(), p),
      patchPetRoute(req(undefined, { method: 'PATCH', body: { name: 'y' } }), p),
      deletePetRoute(req(undefined, { method: 'DELETE' }), p),
      listRecordsRoute(req(), p),
      createRecordRoute(req(undefined, { method: 'POST', body: { type: 'note', date: 'd', title: 't' } }), p),
      getRecordRoute(req(), params({ id: pid, recordId: rid })),
      listRemindersRoute(req(), p),
      createReminderRoute(req(undefined, { method: 'POST', body: { title: 't', dueDate: 'd' } }), p),
      patchReminderRoute(req(undefined, { method: 'PATCH', body: { isDone: true } }), params({ id: pid, reminderId: rid })),
      deleteReminderRoute(req(undefined, { method: 'DELETE' }), params({ id: pid, reminderId: rid })),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(responses.length).fill(401));
  });

  it("keeps each user's pets, records and reminders private, and answers 404 (not 403) across accounts", async () => {
    const { tokenA, tokenB } = await twoClerkUsers();

    const petRes = await createPetRoute(req(tokenA, { method: 'POST', body: { name: 'Bruno', species: 'dog' } }));
    expect(petRes.status).toBe(200);
    const pet = await petRes.json();
    const petParams = params({ id: pet.id });

    const recRes = await createRecordRoute(
      req(tokenA, { method: 'POST', body: { type: 'weight', date: '2026-09-01T00:00:00.000Z', title: 'Weigh-in', value: 30, unit: 'kg' } }),
      petParams,
    );
    expect(recRes.status).toBe(200);
    const record = await recRes.json();

    const remRes = await createReminderRoute(
      req(tokenA, { method: 'POST', body: { title: 'Vaccine', dueDate: '2026-12-01T00:00:00.000Z' } }),
      petParams,
    );
    expect(remRes.status).toBe(200);
    const reminder = await remRes.json();

    // Owner can read everything.
    expect((await getPetRoute(req(tokenA), petParams)).status).toBe(200);
    expect((await listRecordsRoute(req(tokenA), petParams)).status).toBe(200);
    expect((await getRecordRoute(req(tokenA), params({ id: pet.id, recordId: record.id }))).status).toBe(200);
    expect((await listRemindersRoute(req(tokenA), petParams)).status).toBe(200);

    // Another authenticated user gets 404 on every path - same as a pet that doesn't exist.
    const missing = await getPetRoute(req(tokenB), params({ id: randomUUID() }));
    const denied = await Promise.all([
      getPetRoute(req(tokenB), petParams),
      patchPetRoute(req(tokenB, { method: 'PATCH', body: { name: 'stolen' } }), petParams),
      deletePetRoute(req(tokenB, { method: 'DELETE' }), petParams),
      listRecordsRoute(req(tokenB), petParams),
      createRecordRoute(req(tokenB, { method: 'POST', body: { type: 'note', date: 'd', title: 'planted' } }), petParams),
      getRecordRoute(req(tokenB), params({ id: pet.id, recordId: record.id })),
      listRemindersRoute(req(tokenB), petParams),
      createReminderRoute(req(tokenB, { method: 'POST', body: { title: 'planted', dueDate: 'd' } }), petParams),
      patchReminderRoute(req(tokenB, { method: 'PATCH', body: { isDone: true } }), params({ id: pet.id, reminderId: reminder.id })),
      deleteReminderRoute(req(tokenB, { method: 'DELETE' }), params({ id: pet.id, reminderId: reminder.id })),
    ]);
    expect(denied.map((r) => r.status)).toEqual(Array(denied.length).fill(404));
    expect(await denied[0].json()).toEqual(await missing.json());

    // B's pet list doesn't contain A's pet, and nothing of A's changed.
    const bPets = await (await listPetsRoute(req(tokenB))).json();
    expect(bPets.find((p: { id: string }) => p.id === pet.id)).toBeUndefined();
    const still = await (await getPetRoute(req(tokenA), petParams)).json();
    expect(still.name).toBe('Bruno');
    expect(await (await listRecordsRoute(req(tokenA), petParams)).json()).toHaveLength(1);
    expect(await (await listRemindersRoute(req(tokenA), petParams)).json()).toHaveLength(1);
  });

  it("a legacy-authenticated user cannot reach a Clerk user's data either (and vice versa)", async () => {
    const { tokenA } = await twoClerkUsers();
    const pet = await (await createPetRoute(req(tokenA, { method: 'POST', body: { name: 'Bruno', species: 'dog' } }))).json();

    const legacy = await usersRepo.create(newEmail(), hashPassword('legacy-password-1'), 'Legacy');
    const legacyToken = await signToken(legacy.id);
    expect((await getPetRoute(req(legacyToken), params({ id: pet.id }))).status).toBe(404);

    const legacyPet = await petsRepo.create(legacy.id, { name: 'Milo', species: 'cat' });
    expect((await getPetRoute(req(tokenA), params({ id: legacyPet.id }))).status).toBe(404);
  });

  it("a user cannot act on another user's data by presenting a token whose sub they don't own", async () => {
    const { a, tokenA } = await twoClerkUsers();
    const pet = await (await createPetRoute(req(tokenA, { method: 'POST', body: { name: 'Bruno', species: 'dog' } }))).json();

    // Attacker signs their own token claiming A's Clerk id with the wrong key.
    const forged = clerkToken(a.sub, { key: otherKeys.privateKey });
    expect((await getPetRoute(req(forged), params({ id: pet.id }))).status).toBe(401);
  });
});
