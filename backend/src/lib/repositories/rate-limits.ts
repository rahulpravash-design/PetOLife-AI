import { db } from '@/lib/db';

interface RateLimitRow {
  key: string;
  count: number;
  window_start: string;
  locked_until: string | null;
}

export const rateLimitsRepo = {
  get(key: string): RateLimitRow | null {
    const row = db.prepare('SELECT * FROM rate_limit_state WHERE key = ?').get(key) as
      | RateLimitRow
      | undefined;
    return row ?? null;
  },

  upsert(key: string, count: number, windowStart: string, lockedUntil: string | null): void {
    db.prepare(
      `INSERT INTO rate_limit_state (key, count, window_start, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start, locked_until = excluded.locked_until`,
    ).run(key, count, windowStart, lockedUntil);
  },

  reset(key: string): void {
    db.prepare('DELETE FROM rate_limit_state WHERE key = ?').run(key);
  },
};
