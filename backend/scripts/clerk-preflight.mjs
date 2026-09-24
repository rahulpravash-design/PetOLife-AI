// Checks the backend's Clerk configuration before a real sign-in test, without
// needing a user account. Catches the usual mistakes: a JWT key copied from a
// different Clerk instance, mixed test/live keys, a mangled PEM.
//
// Usage (Node 20.6+ can load your env file directly; nothing is printed that
// would reveal a secret):
//   node --env-file=.env.local scripts/clerk-preflight.mjs \
//        --publishable-key pk_test_...        # from mobile/.env.local
//   add --offline to skip the two checks that call Clerk over the network.
import { createPublicKey } from 'node:crypto';

import { createClerkClient } from '@clerk/backend';

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const pkArg = args.indexOf('--publishable-key');
const publishableKey =
  (pkArg >= 0 ? args[pkArg + 1] : undefined) ??
  process.env.CLERK_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

let failures = 0;
const ok = (msg) => console.log(`  ok   - ${msg}`);
const warn = (msg) => console.log(`  warn - ${msg}`);
const fail = (msg) => {
  failures++;
  console.error(`  FAIL - ${msg}`);
};

const jwtKeyRaw = process.env.CLERK_JWT_KEY?.replace(/\\n/g, '\n');
const secretKey = process.env.CLERK_SECRET_KEY;

console.log('CLERK_JWT_KEY');
let jwk;
if (!jwtKeyRaw) {
  fail('not set (networkless verification needs it)');
} else {
  try {
    const key = createPublicKey(jwtKeyRaw);
    if (key.asymmetricKeyType !== 'rsa') throw new Error(`key type is ${key.asymmetricKeyType}, expected rsa`);
    jwk = key.export({ format: 'jwk' });
    ok(`valid RSA public key (${key.asymmetricKeyDetails?.modulusLength} bits)`);
  } catch (err) {
    fail(`not a valid PEM public key: ${err.message}. Use the "JWT public key" (PEM), not the secret key.`);
  }
}

console.log('CLERK_SECRET_KEY');
const secretMode = secretKey?.match(/^sk_(test|live)_/)?.[1];
if (!secretKey) fail('not set (needed to provision first-time users)');
else if (!secretMode) fail('does not look like a Clerk secret key (expected sk_test_... or sk_live_...)');
else ok(`present, ${secretMode} instance`);

console.log('Publishable key (mobile)');
let frontendApi;
if (!publishableKey) {
  warn('not provided; pass --publishable-key to check it belongs to the same instance');
} else {
  const m = publishableKey.match(/^pk_(test|live)_(.+)$/);
  if (!m) {
    fail('does not look like a Clerk publishable key (expected pk_test_... or pk_live_...)');
  } else {
    frontendApi = Buffer.from(m[2], 'base64').toString('utf8').replace(/\$$/, '');
    ok(`${m[1]} instance, Frontend API ${frontendApi}`);
    if (secretMode && secretMode !== m[1]) fail(`publishable key is ${m[1]} but secret key is ${secretMode}`);
  }
}

console.log('Authorization / legacy flags');
const legacy = process.env.LEGACY_AUTH_ENABLED ?? '(unset -> on outside production, off in production)';
console.log(`  info - LEGACY_AUTH_ENABLED=${legacy}`);
console.log(`  info - CLERK_LINK_EXISTING_BY_EMAIL=${process.env.CLERK_LINK_EXISTING_BY_EMAIL ?? '(unset -> on outside production, off in production)'}`);
console.log(`  info - CLERK_AUTHORIZED_PARTIES=${process.env.CLERK_AUTHORIZED_PARTIES ? 'set' : '(unset -> azp not enforced)'}`);

if (offline) {
  console.log('\n--offline: skipped the network checks (JWT key vs instance, secret key)');
} else {
  console.log('JWT key belongs to the publishable key\'s instance');
  if (!jwk || !frontendApi) {
    warn('skipped (needs a valid CLERK_JWT_KEY and --publishable-key)');
  } else {
    const url = process.env.CLERK_PREFLIGHT_JWKS_URL ?? `https://${frontendApi}/.well-known/jwks.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { keys } = await res.json();
      if (keys.some((k) => k.n === jwk.n && k.e === jwk.e)) ok('CLERK_JWT_KEY matches a signing key published by that instance');
      else fail('CLERK_JWT_KEY does NOT match that instance\'s published signing keys (wrong instance, or key rotated)');
    } catch (err) {
      fail(`could not fetch ${url}: ${err.message}`);
    }
  }

  console.log('Clerk Backend API (secret key)');
  if (!secretKey || !secretMode) {
    warn('skipped (no valid CLERK_SECRET_KEY)');
  } else {
    try {
      const { totalCount } = await createClerkClient({ secretKey }).users.getUserList({ limit: 1 });
      ok(`secret key accepted (${totalCount} user(s) in this instance)`);
    } catch (err) {
      fail(`Backend API rejected the request: ${err.message}`);
    }
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
