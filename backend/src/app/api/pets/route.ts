import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { petsRepo } from '@/lib/repositories/pets';
import { dateString, httpUrl, nameText } from '@/lib/validation';

const createSchema = z.object({
  name: nameText,
  species: z.enum(['dog', 'cat', 'other']),
  breed: nameText.optional(),
  birthDate: dateString.optional(),
  photoUrl: httpUrl.optional(),
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
