import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';
import { recordsRepo } from '@/lib/repositories/records';
import {
  RECORD_TYPES,
  dateString,
  httpUrl,
  measurement,
  notesText,
  titleText,
  unitText,
} from '@/lib/validation';

const createSchema = z.object({
  type: z.enum(RECORD_TYPES),
  date: dateString,
  title: titleText,
  notes: notesText.optional(),
  value: measurement.optional(),
  unit: unitText.optional(),
  attachmentUrl: httpUrl.optional(),
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
