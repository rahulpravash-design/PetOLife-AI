import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';
import type { Reminder } from '@/types';

interface ReminderRow {
  id: string;
  pet_id: string;
  title: string;
  due_date: string;
  notes: string | null;
  is_done: number;
  created_at: string;
}

function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    petId: row.pet_id,
    title: row.title,
    dueDate: row.due_date,
    notes: row.notes ?? undefined,
    isDone: Boolean(row.is_done),
    createdAt: row.created_at,
  };
}

export const remindersRepo = {
  listByPet(petId: string): Reminder[] {
    const rows = db
      .prepare('SELECT * FROM reminders WHERE pet_id = ? ORDER BY due_date ASC')
      .all(petId) as ReminderRow[];
    return rows.map(toReminder);
  },

  findById(id: string): Reminder | null {
    const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as
      | ReminderRow
      | undefined;
    return row ? toReminder(row) : null;
  },

  create(petId: string, data: Omit<Reminder, 'id' | 'petId' | 'createdAt' | 'isDone'>): Reminder {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO reminders (id, pet_id, title, due_date, notes, is_done, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    ).run(id, petId, data.title, data.dueDate, data.notes ?? null, createdAt);
    return { id, petId, createdAt, isDone: false, ...data };
  },

  update(
    id: string,
    data: Partial<Omit<Reminder, 'id' | 'petId' | 'createdAt'>>,
  ): Reminder | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    db.prepare(
      'UPDATE reminders SET title = ?, due_date = ?, notes = ?, is_done = ? WHERE id = ?',
    ).run(merged.title, merged.dueDate, merged.notes ?? null, merged.isDone ? 1 : 0, id);
    return this.findById(id);
  },

  remove(id: string): void {
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  },
};
