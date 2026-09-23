import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedReminder } from '@/lib/authorize';
import { remindersRepo } from '@/lib/repositories/reminders';

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  notes: z.string().optional(),
  isDone: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string; reminderId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id, reminderId } = await params;
    await requireOwnedReminder(userId, id, reminderId);
    const data = await parseBody(request, updateSchema);
    return remindersRepo.update(reminderId, data);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id, reminderId } = await params;
    await requireOwnedReminder(userId, id, reminderId);
    await remindersRepo.remove(reminderId);
    return new Response(null, { status: 204 });
  });
}
