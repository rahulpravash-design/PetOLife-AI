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
  create(userId: string, expiresAt: string): string {
    const id = randomUUID();
    db.prepare(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ).run(id, userId, new Date().toISOString(), expiresAt);
    return id;
  },

  isActive(jti: string): boolean {
    const row = db.prepare('SELECT expires_at, revoked_at FROM sessions WHERE id = ?').get(jti) as
      | Pick<SessionRow, 'expires_at' | 'revoked_at'>
      | undefined;
    if (!row) return false;
    if (row.revoked_at) return false;
    if (new Date(row.expires_at).getTime() <= Date.now()) return false;
    return true;
  },

  revoke(jti: string): void {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(
      new Date().toISOString(),
      jti,
    );
  },
};
