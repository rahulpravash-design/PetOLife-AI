import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';
import type { User } from '@/types';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name };
}

export const usersRepo = {
  findByEmail(email: string): (UserRow & User) | null {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | UserRow
      | undefined;
    return row ? { ...row, ...toUser(row) } : null;
  },

  findById(id: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? toUser(row) : null;
  },

  create(email: string, passwordHash: string, name: string): User {
    const id = randomUUID();
    db.prepare(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, email, passwordHash, name, new Date().toISOString());
    return { id, email, name };
  },
};
