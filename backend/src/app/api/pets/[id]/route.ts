import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';
import { petsRepo } from '@/lib/repositories/pets';
import { dateString, httpUrl, nameText } from '@/lib/validation';

const updateSchema = z.object({
  name: nameText.optional(),
  species: z.enum(['dog', 'cat', 'other']).optional(),
  breed: nameText.optional(),
  birthDate: dateString.optional(),
  photoUrl: httpUrl.optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    return requireOwnedPet(userId, id);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    await requireOwnedPet(userId, id);
    const data = await parseBody(request, updateSchema);
    return petsRepo.update(id, data);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    await requireOwnedPet(userId, id);
    await petsRepo.remove(id);
    return new Response(null, { status: 204 });
  });
}
