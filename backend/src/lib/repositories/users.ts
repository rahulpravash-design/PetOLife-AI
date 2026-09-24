import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';
import type { User } from '@/types';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  clerk_user_id: string | null;
}

// password_hash is NOT NULL, and Clerk-managed users have no local password.
// This is deliberately not a valid bcrypt hash, so no password can ever match
// it; auth.ts also treats it like "no such account" so login timing doesn't
// reveal that the email belongs to a Clerk-only user.
export const CLERK_MANAGED_PASSWORD_HASH = '!clerk-managed';

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

  async findByClerkId(clerkUserId: string): Promise<User | null> {
    const row = await db.get<UserRow>('SELECT * FROM users WHERE clerk_user_id = ?', [clerkUserId]);
    return row ? toUser(row) : null;
  },

  // Legacy emails were stored as typed, so match case-insensitively. Returns
  // every match (normally 0 or 1) so the caller can refuse an ambiguous link.
  async findAllByEmailInsensitive(email: string): Promise<UserRow[]> {
    return db.all<UserRow>('SELECT * FROM users WHERE LOWER(email) = ?', [email.trim().toLowerCase()]);
  },

  async createFromClerk(clerkUserId: string, email: string, name: string): Promise<User> {
    const id = randomUUID();
    await db.run(
      'INSERT INTO users (id, email, password_hash, name, created_at, clerk_user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, CLERK_MANAGED_PASSWORD_HASH, name, new Date().toISOString(), clerkUserId],
    );
    return { id, email, name };
  },

  // Only links a row that has no Clerk identity yet, so a concurrent request
  // (or a row already bound to a different Clerk user) can never be
  // overwritten. Returns whether this call performed the link.
  async linkClerkId(userId: string, clerkUserId: string): Promise<boolean> {
    const { changes } = await db.run(
      'UPDATE users SET clerk_user_id = ? WHERE id = ? AND clerk_user_id IS NULL',
      [clerkUserId, userId],
    );
    return changes === 1;
  },
};
