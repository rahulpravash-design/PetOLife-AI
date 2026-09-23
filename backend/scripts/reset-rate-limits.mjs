// Dev/test-only utility: clears all rate-limit state (login backoff +
// document-extraction throttle counters) from the local SQLite dev DB.
// Not exposed via any API route - exposing a reset endpoint would itself be
// a way to defeat the rate limiter. Run between local test iterations so
// state from one run doesn't affect the next.
//
// Usage: node scripts/reset-rate-limits.mjs
import path from 'node:path';

import Database from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'data', 'petolife.db');
const db = new Database(dbPath);

db.exec('CREATE TABLE IF NOT EXISTS rate_limit_state (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start TEXT NOT NULL, locked_until TEXT)');

const { changes } = db.prepare('DELETE FROM rate_limit_state').run();
console.log(`Cleared ${changes} rate-limit row(s).`);
