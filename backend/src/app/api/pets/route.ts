import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { petsRepo } from '@/lib/repositories/pets';

const createSchema = z.object({
  name: z.string().min(1),
  species: z.enum(['dog', 'cat', 'other']),
  breed: z.string().optional(),
  birthDate: z.string().optional(),
  photoUrl: z.string().optional(),
});

export async function GET(request: Request) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    return petsRepo.listByUser(userId);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const data = await parseBody(request, createSchema);
    return petsRepo.create(userId, data);
  });
}
