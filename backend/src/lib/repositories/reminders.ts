import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';
import type { Reminder } from '@/types';

interface ReminderRow {
  id: string;
  pet_id: string;
  title: string;
  due_date: string;
  notes: string | null;
  is_done: number | boolean;
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
  async listByPet(petId: string): Promise<Reminder[]> {
    const rows = await db.all<ReminderRow>(
      'SELECT * FROM reminders WHERE pet_id = ? ORDER BY due_date ASC',
      [petId],
    );
    return rows.map(toReminder);
  },

  async findById(id: string): Promise<Reminder | null> {
    const row = await db.get<ReminderRow>('SELECT * FROM reminders WHERE id = ?', [id]);
    return row ? toReminder(row) : null;
  },

  async create(
    petId: string,
    data: Omit<Reminder, 'id' | 'petId' | 'createdAt' | 'isDone'>,
  ): Promise<Reminder> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.run(
      `INSERT INTO reminders (id, pet_id, title, due_date, notes, is_done, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [id, petId, data.title, data.dueDate, data.notes ?? null, createdAt],
    );
    return { id, petId, createdAt, isDone: false, ...data };
  },

  async update(
    id: string,
    data: Partial<Omit<Reminder, 'id' | 'petId' | 'createdAt'>>,
  ): Promise<Reminder | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.run('UPDATE reminders SET title = ?, due_date = ?, notes = ?, is_done = ? WHERE id = ?', [
      merged.title,
      merged.dueDate,
      merged.notes ?? null,
      merged.isDone ? 1 : 0,
      id,
    ]);
    return this.findById(id);
  },

  async remove(id: string): Promise<void> {
    await db.run('DELETE FROM reminders WHERE id = ?', [id]);
  },
};
