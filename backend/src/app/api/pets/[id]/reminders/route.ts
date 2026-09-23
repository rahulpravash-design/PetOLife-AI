import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';
import { remindersRepo } from '@/lib/repositories/reminders';

const createSchema = z.object({
  title: z.string().min(1),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id } = await params;
    requireOwnedPet(userId, id);
    return remindersRepo.listByPet(id);
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id } = await params;
    requireOwnedPet(userId, id);
    const data = await parseBody(request, createSchema);
    return remindersRepo.create(id, data);
  });
}
