import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';
import { remindersRepo } from '@/lib/repositories/reminders';
import { dateString, notesText, titleText } from '@/lib/validation';

const createSchema = z.object({
  title: titleText,
  dueDate: dateString,
  notes: notesText.optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    await requireOwnedPet(userId, id);
    return remindersRepo.listByPet(id);
  });
}

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    await requireOwnedPet(userId, id);
    const data = await parseBody(request, createSchema);
    return remindersRepo.create(id, data);
  });
}
