import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';
import { petsRepo } from '@/lib/repositories/pets';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  species: z.enum(['dog', 'cat', 'other']).optional(),
  breed: z.string().optional(),
  birthDate: z.string().optional(),
  photoUrl: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id } = await params;
    return requireOwnedPet(userId, id);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id } = await params;
    requireOwnedPet(userId, id);
    const data = await parseBody(request, updateSchema);
    return petsRepo.update(id, data);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id } = await params;
    requireOwnedPet(userId, id);
    petsRepo.remove(id);
    return new Response(null, { status: 204 });
  });
}
