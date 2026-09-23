import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export const sessionsRepo = {
  // Creates a session row and returns its id, used as the JWT's `jti` claim.
  async create(userId: string, expiresAt: string): Promise<string> {
    const id = randomUUID();
    await db.run('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
      id,
      userId,
      new Date().toISOString(),
      expiresAt,
    ]);
    return id;
  },

  async isActive(jti: string): Promise<boolean> {
    const row = await db.get<Pick<SessionRow, 'expires_at' | 'revoked_at'>>(
      'SELECT expires_at, revoked_at FROM sessions WHERE id = ?',
      [jti],
    );
    if (!row) return false;
    if (row.revoked_at) return false;
    if (new Date(row.expires_at).getTime() <= Date.now()) return false;
    return true;
  },

  async revoke(jti: string): Promise<void> {
    await db.run('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [
      new Date().toISOString(),
      jti,
    ]);
  },
};
