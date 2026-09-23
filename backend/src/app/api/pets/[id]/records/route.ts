import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';
import { recordsRepo } from '@/lib/repositories/records';

const RECORD_TYPES = [
  'weight',
  'vaccination',
  'medication',
  'vet_visit',
  'symptom',
  'lab_result',
  'note',
] as const;

const createSchema = z.object({
  type: z.enum(RECORD_TYPES),
  date: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().optional(),
  value: z.number().optional(),
  unit: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    await requireOwnedPet(userId, id);
    return recordsRepo.listByPet(id);
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    await requireOwnedPet(userId, id);
    const data = await parseBody(request, createSchema);
    return recordsRepo.create(id, data);
  });
}
