import { randomUUID } from 'node:crypto';

import { db } from '@/lib/db';
import type { Pet } from '@/types';

interface PetRow {
  id: string;
  user_id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  photo_url: string | null;
  created_at: string;
}

function toPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species as Pet['species'],
    breed: row.breed ?? undefined,
    birthDate: row.birth_date ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    createdAt: row.created_at,
  };
}

export const petsRepo = {
  listByUser(userId: string): Pet[] {
    const rows = db
      .prepare('SELECT * FROM pets WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as PetRow[];
    return rows.map(toPet);
  },

  findById(id: string): (Pet & { userId: string }) | null {
    const row = db.prepare('SELECT * FROM pets WHERE id = ?').get(id) as PetRow | undefined;
    return row ? { ...toPet(row), userId: row.user_id } : null;
  },

  create(userId: string, data: Omit<Pet, 'id' | 'createdAt'>): Pet {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO pets (id, user_id, name, species, breed, birth_date, photo_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      data.name,
      data.species,
      data.breed ?? null,
      data.birthDate ?? null,
      data.photoUrl ?? null,
      createdAt,
    );
    return { id, createdAt, ...data };
  },

  update(id: string, data: Partial<Omit<Pet, 'id' | 'createdAt'>>): Pet | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    db.prepare(
      `UPDATE pets SET name = ?, species = ?, breed = ?, birth_date = ?, photo_url = ? WHERE id = ?`,
    ).run(
      merged.name,
      merged.species,
      merged.breed ?? null,
      merged.birthDate ?? null,
      merged.photoUrl ?? null,
      id,
    );
    return this.findById(id);
  },

  remove(id: string): void {
    db.prepare('DELETE FROM pets WHERE id = ?').run(id);
  },
};
