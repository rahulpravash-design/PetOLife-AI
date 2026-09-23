// End-to-end smoke test against a running backend dev server.
// Usage: npm run dev (in one terminal), then `node scripts/integration-test.mjs`.
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

async function main() {
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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
