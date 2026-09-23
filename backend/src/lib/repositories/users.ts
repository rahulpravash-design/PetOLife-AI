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
  async findByEmail(email: string): Promise<(UserRow & User) | null> {
    const row = await db.get<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
    return row ? { ...row, ...toUser(row) } : null;
  },

  async findById(id: string): Promise<User | null> {
    const row = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    return row ? toUser(row) : null;
  },

  async create(email: string, passwordHash: string, name: string): Promise<User> {
    const id = randomUUID();
    await db.run(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, email, passwordHash, name, new Date().toISOString()],
    );
    return { id, email, name };
  },
};
