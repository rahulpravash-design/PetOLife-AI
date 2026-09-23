import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';
import type { HealthRecord } from '@/types';

interface RecordRow {
  id: string;
  pet_id: string;
  type: string;
  date: string;
  title: string;
  notes: string | null;
  value: number | null;
  unit: string | null;
  attachment_url: string | null;
  created_at: string;
}

function toRecord(row: RecordRow): HealthRecord {
  return {
    id: row.id,
    petId: row.pet_id,
    type: row.type as HealthRecord['type'],
    date: row.date,
    title: row.title,
    notes: row.notes ?? undefined,
    value: row.value ?? undefined,
    unit: row.unit ?? undefined,
    attachmentUrl: row.attachment_url ?? undefined,
    createdAt: row.created_at,
  };
}

export const recordsRepo = {
  listByPet(petId: string): HealthRecord[] {
    const rows = db
      .prepare('SELECT * FROM health_records WHERE pet_id = ? ORDER BY date DESC')
      .all(petId) as RecordRow[];
    return rows.map(toRecord);
  },

  findById(id: string): HealthRecord | null {
    const row = db.prepare('SELECT * FROM health_records WHERE id = ?').get(id) as
      | RecordRow
      | undefined;
    return row ? toRecord(row) : null;
  },

  create(petId: string, data: Omit<HealthRecord, 'id' | 'petId' | 'createdAt'>): HealthRecord {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO health_records (id, pet_id, type, date, title, notes, value, unit, attachment_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      petId,
      data.type,
      data.date,
      data.title,
      data.notes ?? null,
      data.value ?? null,
      data.unit ?? null,
      data.attachmentUrl ?? null,
      createdAt,
    );
    return { id, petId, createdAt, ...data };
  },

  update(
    id: string,
    data: Partial<Omit<HealthRecord, 'id' | 'petId' | 'createdAt'>>,
  ): HealthRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    db.prepare(
      `UPDATE health_records SET type = ?, date = ?, title = ?, notes = ?, value = ?, unit = ?, attachment_url = ?
       WHERE id = ?`,
    ).run(
      merged.type,
      merged.date,
      merged.title,
      merged.notes ?? null,
      merged.value ?? null,
      merged.unit ?? null,
      merged.attachmentUrl ?? null,
      id,
    );
    return this.findById(id);
  },

  remove(id: string): void {
    db.prepare('DELETE FROM health_records WHERE id = ?').run(id);
  },
};
