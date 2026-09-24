// End-to-end smoke test against a running backend dev server.
// Usage: npm run dev (in one terminal), then `node scripts/integration-test.mjs`.
//
// Optional Clerk section (no real Clerk account needed): set
// CLERK_TEST_PRIVATE_KEY_FILE (and CLERK_TEST_PUBLIC_KEY_FILE) to an RSA key
// pair in PEM, and start the server with CLERK_JWT_KEY set to the public key.
// The script signs Clerk-shaped RS256 session tokens itself and seeds the
// mapped users straight into the database (real first-login provisioning
// needs the Clerk API, which the unit tests cover with a stub; they also run
// against Postgres when DATABASE_URL is set). Set DATABASE_URL here to the same
// value as the server's to seed a Postgres database instead of dev SQLite. Run with
// EXPECT_LEGACY_DISABLED=true against a server started with
// LEGACY_AUTH_ENABLED=false to check that mode instead of the legacy flow.
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ok - ${message}`);
  } else {
    failed++;
    console.error(`  FAIL - ${message}`);
  }
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function runLegacy() {
  const email = `test-${Date.now()}@example.com`;
  const password = 'supersecret123';

  console.log('auth');
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Integration Test' }),
  });
  const signup = await json(signupRes);
  assert(signupRes.status === 200 && signup.token, 'signup returns a token');

  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'wrong' }),
  });
  assert(badLoginRes.status === 401, 'login with wrong password is rejected');

  const token = signup.token;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('pets');
  const noAuthRes = await fetch(`${BASE_URL}/api/pets`);
  assert(noAuthRes.status === 401, 'listing pets without a token is rejected');

  const createPetRes = await fetch(`${BASE_URL}/api/pets`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'Bruno', species: 'dog', breed: 'Golden Retriever' }),
  });
  const pet = await json(createPetRes);
  assert(createPetRes.status === 200 && pet.id, 'pet is created');

  console.log('health records');
  const weights = [
    ['2026-07-01T00:00:00.000Z', 28.2],
    ['2026-08-01T00:00:00.000Z', 29.6],
    ['2026-09-01T00:00:00.000Z', 31.0],
  ];
  for (const [date, value] of weights) {
    const res = await fetch(`${BASE_URL}/api/pets/${pet.id}/records`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ type: 'weight', date, title: 'Weigh-in', value, unit: 'kg' }),
    });
    assert(res.status === 200, `weight record on ${date} is created`);
  }

  const listRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/records`, { headers: auth });
  const records = await json(listRes);
  assert(Array.isArray(records) && records.length === 3, 'all 3 records are listed');

  console.log('summary (deterministic what-changed)');
  const summaryRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/summary`, { headers: auth });
  const summary = await json(summaryRes);
  const weightChange = summary.whatChanged?.find((c) => c.metric === 'weight');
  assert(!!weightChange, 'summary includes a weight change entry');
  assert(weightChange?.deltaAbsolute === 2.8, `weight delta is 2.8 (got ${weightChange?.deltaAbsolute})`);
  assert(weightChange?.deltaPercent === 9.93, `weight delta percent is 9.93 (got ${weightChange?.deltaPercent})`);

  console.log('reminders');
  const reminderRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/reminders`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ title: 'Flea/tick prevention', dueDate: '2026-10-01T00:00:00.000Z' }),
  });
  const reminder = await json(reminderRes);
  assert(reminderRes.status === 200 && reminder.isDone === false, 'reminder is created, not done');

  const toggleRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/reminders/${reminder.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ isDone: true }),
  });
  const toggled = await json(toggleRes);
  assert(toggled.isDone === true, 'reminder can be marked done');

  console.log('authorization boundaries');
  const otherSignup = await json(
    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `other-${Date.now()}@example.com`, password, name: 'Other' }),
    }),
  );
  const otherAuth = { Authorization: `Bearer ${otherSignup.token}` };
  const crossAccessRes = await fetch(`${BASE_URL}/api/pets/${pet.id}`, { headers: otherAuth });
  assert(crossAccessRes.status === 404, "another user cannot access someone else's pet (404, not 403)");

  console.log('security: login rate limiting');
  const lockoutEmail = `lockout-${Date.now()}@example.com`;
  let lastLoginStatus = 0;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lockoutEmail, password: 'wrong-guess' }),
    });
    lastLoginStatus = res.status;
    if (i < 5) assert(res.status === 401, `login attempt ${i + 1} for a locked-out email is a normal 401`);
  }
  assert(lastLoginStatus === 429, `6th login attempt within the lockout window is rate-limited (got ${lastLoginStatus})`);

  console.log('security: document extraction size limit');
  const oversizedBase64 = 'A'.repeat(15_000_000); // well past the 10MB decoded / ~14M-char limit
  const oversizedRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/extract-document`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ imageBase64: oversizedBase64, mimeType: 'image/jpeg' }),
  });
  assert(oversizedRes.status === 413, `oversized document upload is rejected before processing (got ${oversizedRes.status})`);

  console.log('security: logout revokes the session');
  const sessionSignup = await json(
    await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `session-${Date.now()}@example.com`, password, name: 'Session Test' }),
    }),
  );
  const sessionAuth = { Authorization: `Bearer ${sessionSignup.token}` };
  const beforeLogoutRes = await fetch(`${BASE_URL}/api/pets`, { headers: sessionAuth });
  assert(beforeLogoutRes.status === 200, 'token works before logout');

  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', headers: sessionAuth });
  assert(logoutRes.status === 204, 'logout succeeds');

  const afterLogoutRes = await fetch(`${BASE_URL}/api/pets`, { headers: sessionAuth });
  assert(afterLogoutRes.status === 401, 'the same token is rejected after logout (session revoked)');
}

function signClerkToken(privateKey, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { sid: 'sess_integration', iss: 'https://clerk.example.test', iat: now, nbf: now - 5, exp: now + 60, ...overrides },
    privateKey,
    { algorithm: 'RS256' },
  );
}

// Inserts a Clerk-mapped user directly (no Clerk API involved) into whichever
// database the server uses. Rejects if the row violates a constraint.
async function seedClerkUser(clerkUserId, name, email = `${clerkUserId}@clerk.example.test`) {
  const row = [randomUUID(), email, name, new Date().toISOString(), clerkUserId];
  if (process.env.DATABASE_URL) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query(
        "INSERT INTO users (id, email, password_hash, name, created_at, clerk_user_id) VALUES ($1, $2, '!clerk-managed', $3, $4, $5)",
        row,
      );
    } finally {
      await client.end();
    }
    return;
  }
  const db = new Database(path.join(process.cwd(), 'data', 'petolife.db'));
  try {
    db.prepare(
      "INSERT INTO users (id, email, password_hash, name, created_at, clerk_user_id) VALUES (?, ?, '!clerk-managed', ?, ?, ?)",
    ).run(...row);
  } finally {
    db.close();
  }
}

async function runClerk() {
  const privateKey = readFileSync(process.env.CLERK_TEST_PRIVATE_KEY_FILE, 'utf8');
  const publicKey = readFileSync(process.env.CLERK_TEST_PUBLIC_KEY_FILE, 'utf8');
  const suffix = Date.now();
  const aId = `user_int_a_${suffix}`;
  const bId = `user_int_b_${suffix}`;
  await seedClerkUser(aId, 'Clerk A');
  await seedClerkUser(bId, 'Clerk B');
  const bearer = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
  const tokenA = signClerkToken(privateKey, { sub: aId });
  const tokenB = signClerkToken(privateKey, { sub: bId });
  const status = async (token) => (await fetch(`${BASE_URL}/api/pets`, { headers: bearer(token) })).status;

  console.log(`clerk: database (${process.env.DATABASE_URL ? 'postgres' : 'sqlite'})`);
  let duplicateRejected = false;
  await seedClerkUser(aId, 'Duplicate', `dup-${suffix}@clerk.example.test`).catch(() => {
    duplicateRejected = true;
  });
  assert(duplicateRejected, 'the database rejects a second user with the same clerk_user_id (unique constraint)');

  console.log('clerk: token verification');
  assert((await status(tokenA)) === 200, 'valid RS256 Clerk token is accepted');

  const expired = signClerkToken(privateKey, { sub: aId, iat: 1_000_000, nbf: 1_000_000, exp: 1_000_060 });
  assert((await status(expired)) === 401, 'expired Clerk token is rejected');

  const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert((await status(signClerkToken(wrongKey, { sub: aId }))) === 401, 'token signed with a different key is rejected');

  assert((await status(signClerkToken(privateKey, { sub: aId, sid: undefined }))) === 401, 'token without a session id is rejected');

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const algNone = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: aId, sid: 's', iat: now, exp: now + 60 })}.`;
  assert((await status(algNone)) === 401, 'alg=none token is rejected');

  const forgedHs = jwt.sign({ sub: aId, sid: 's', jti: 'x' }, publicKey, { algorithm: 'HS256', expiresIn: 60 });
  assert((await status(forgedHs)) === 401, 'HS256 token forged with the public key is rejected');

  assert((await fetch(`${BASE_URL}/api/pets`)).status === 401, 'request with no token is rejected');

  console.log('clerk: authorization boundaries');
  const petRes = await fetch(`${BASE_URL}/api/pets`, {
    method: 'POST',
    headers: bearer(tokenA),
    body: JSON.stringify({ name: 'ClerkPet', species: 'cat' }),
  });
  const pet = await json(petRes);
  assert(petRes.status === 200 && pet.id, 'Clerk user A creates a pet');
  assert((await fetch(`${BASE_URL}/api/pets/${pet.id}`, { headers: bearer(tokenA) })).status === 200, 'Clerk user A reads their own pet');
  assert((await fetch(`${BASE_URL}/api/pets/${pet.id}`, { headers: bearer(tokenB) })).status === 404, "Clerk user B cannot access A's pet (404, not 403)");
  const bList = await json(await fetch(`${BASE_URL}/api/pets`, { headers: bearer(tokenB) }));
  assert(Array.isArray(bList) && bList.length === 0, "Clerk user B's pet list does not include A's pet");

  console.log('clerk: user -> pet -> records -> reminders ownership');
  const recordRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/records`, {
    method: 'POST',
    headers: bearer(tokenA),
    body: JSON.stringify({ type: 'weight', date: '2026-09-01T00:00:00.000Z', title: 'Weigh-in', value: 4.2, unit: 'kg' }),
  });
  const record = await json(recordRes);
  assert(recordRes.status === 200 && record.id, "Clerk user A adds a record to their pet");
  const reminderRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/reminders`, {
    method: 'POST',
    headers: bearer(tokenA),
    body: JSON.stringify({ title: 'Vaccine booster', dueDate: '2026-10-01T00:00:00.000Z' }),
  });
  const reminder = await json(reminderRes);
  assert(reminderRes.status === 200 && reminder.id, 'Clerk user A adds a reminder to their pet');
  const aRecords = await json(await fetch(`${BASE_URL}/api/pets/${pet.id}/records`, { headers: bearer(tokenA) }));
  assert(Array.isArray(aRecords) && aRecords.length === 1, 'A lists their own records');
  assert((await fetch(`${BASE_URL}/api/pets/${pet.id}/records`, { headers: bearer(tokenB) })).status === 404, "B cannot list A's records (404)");
  assert((await fetch(`${BASE_URL}/api/pets/${pet.id}/records/${record.id}`, { headers: bearer(tokenB) })).status === 404, "B cannot read A's record (404)");
  assert((await fetch(`${BASE_URL}/api/pets/${pet.id}/reminders`, { headers: bearer(tokenB) })).status === 404, "B cannot list A's reminders (404)");
  const patchRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/reminders/${reminder.id}`, {
    method: 'PATCH',
    headers: bearer(tokenB),
    body: JSON.stringify({ isDone: true }),
  });
  assert(patchRes.status === 404, "B cannot modify A's reminder (404)");
  const after = await json(await fetch(`${BASE_URL}/api/pets/${pet.id}/reminders`, { headers: bearer(tokenA) }));
  assert(after?.[0]?.isDone === false, "A's reminder is untouched by B's attempt");
  const summaryRes = await fetch(`${BASE_URL}/api/pets/${pet.id}/summary`, { headers: bearer(tokenB) });
  assert(summaryRes.status === 404, "B cannot read A's pet summary (404)");

  console.log('clerk: logout');
  assert((await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', headers: bearer(tokenA) })).status === 204, 'logout with a Clerk token returns 204');
  // Documented trade-off: networkless verification cannot see the sign-out at
  // Clerk, so the (<=60s) token stays valid until it expires. The mobile app
  // ends the session by calling Clerk signOut.
  assert((await status(tokenA)) === 200, 'Clerk token stays valid until expiry after logout (documented ~60s trade-off)');
}

async function runLegacyDisabled() {
  console.log('legacy auth disabled (LEGACY_AUTH_ENABLED=false)');
  const post = (route) =>
    fetch(`${BASE_URL}/api/auth/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'legacy@example.com', password: 'supersecret123', name: 'Legacy' }),
    });
  assert((await post('login')).status === 404, 'legacy password login is rejected (404)');
  assert((await post('signup')).status === 404, 'legacy signup is rejected (404)');

  const legacyToken = jwt.sign({ sub: randomUUID(), jti: randomUUID() }, 'any-secret', { algorithm: 'HS256', expiresIn: 60 });
  const res = await fetch(`${BASE_URL}/api/pets`, { headers: { Authorization: `Bearer ${legacyToken}` } });
  assert(res.status === 401, 'HS256 legacy-style token is rejected');
}

async function main() {
  if (process.env.EXPECT_LEGACY_DISABLED === 'true') {
    await runLegacyDisabled();
  } else {
    await runLegacy();
  }
  if (process.env.CLERK_TEST_PRIVATE_KEY_FILE) await runClerk();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
