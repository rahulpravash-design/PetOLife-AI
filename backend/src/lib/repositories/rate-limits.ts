import { db } from '@/lib/db';

interface RateLimitRow {
  key: string;
  count: number;
  window_start: string;
  locked_until: string | null;
}

export const rateLimitsRepo = {
  async get(key: string): Promise<RateLimitRow | null> {
    const row = await db.get<RateLimitRow>('SELECT * FROM rate_limit_state WHERE key = ?', [key]);
    return row ?? null;
  },

  async upsert(key: string, count: number, windowStart: string, lockedUntil: string | null): Promise<void> {
    await db.run(
      `INSERT INTO rate_limit_state (key, count, window_start, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start, locked_until = excluded.locked_until`,
      [key, count, windowStart, lockedUntil],
    );
  },

  async reset(key: string): Promise<void> {
    await db.run('DELETE FROM rate_limit_state WHERE key = ?', [key]);
  },
};
