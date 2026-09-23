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
  async listByPet(petId: string): Promise<HealthRecord[]> {
    const rows = await db.all<RecordRow>(
      'SELECT * FROM health_records WHERE pet_id = ? ORDER BY date DESC',
      [petId],
    );
    return rows.map(toRecord);
  },

  async findById(id: string): Promise<HealthRecord | null> {
    const row = await db.get<RecordRow>('SELECT * FROM health_records WHERE id = ?', [id]);
    return row ? toRecord(row) : null;
  },

  async create(
    petId: string,
    data: Omit<HealthRecord, 'id' | 'petId' | 'createdAt'>,
  ): Promise<HealthRecord> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.run(
      `INSERT INTO health_records (id, pet_id, type, date, title, notes, value, unit, attachment_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );
    return { id, petId, createdAt, ...data };
  },

  async update(
    id: string,
    data: Partial<Omit<HealthRecord, 'id' | 'petId' | 'createdAt'>>,
  ): Promise<HealthRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.run(
      `UPDATE health_records SET type = ?, date = ?, title = ?, notes = ?, value = ?, unit = ?, attachment_url = ?
       WHERE id = ?`,
      [
        merged.type,
        merged.date,
        merged.title,
        merged.notes ?? null,
        merged.value ?? null,
        merged.unit ?? null,
        merged.attachmentUrl ?? null,
        id,
      ],
    );
    return this.findById(id);
  },

  async remove(id: string): Promise<void> {
    await db.run('DELETE FROM health_records WHERE id = ?', [id]);
  },
};
