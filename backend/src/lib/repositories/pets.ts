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
  async listByUser(userId: string): Promise<Pet[]> {
    const rows = await db.all<PetRow>(
      'SELECT * FROM pets WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );
    return rows.map(toPet);
  },

  async findById(id: string): Promise<(Pet & { userId: string }) | null> {
    const row = await db.get<PetRow>('SELECT * FROM pets WHERE id = ?', [id]);
    return row ? { ...toPet(row), userId: row.user_id } : null;
  },

  async create(userId: string, data: Omit<Pet, 'id' | 'createdAt'>): Promise<Pet> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await db.run(
      `INSERT INTO pets (id, user_id, name, species, breed, birth_date, photo_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        data.name,
        data.species,
        data.breed ?? null,
        data.birthDate ?? null,
        data.photoUrl ?? null,
        createdAt,
      ],
    );
    return { id, createdAt, ...data };
  },

  async update(id: string, data: Partial<Omit<Pet, 'id' | 'createdAt'>>): Promise<Pet | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...data };
    await db.run(
      `UPDATE pets SET name = ?, species = ?, breed = ?, birth_date = ?, photo_url = ? WHERE id = ?`,
      [
        merged.name,
        merged.species,
        merged.breed ?? null,
        merged.birthDate ?? null,
        merged.photoUrl ?? null,
        id,
      ],
    );
    return this.findById(id);
  },

  async remove(id: string): Promise<void> {
    await db.run('DELETE FROM pets WHERE id = ?', [id]);
  },
};
