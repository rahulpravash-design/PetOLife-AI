import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedRecord } from '@/lib/authorize';
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

const updateSchema = z.object({
  type: z.enum(RECORD_TYPES).optional(),
  date: dateString.optional(),
  title: titleText.optional(),
  notes: notesText.optional(),
  value: measurement.optional(),
  unit: unitText.optional(),
  attachmentUrl: httpUrl.optional(),
});

type Params = { params: Promise<{ id: string; recordId: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id, recordId } = await params;
    return requireOwnedRecord(userId, id, recordId);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id, recordId } = await params;
    await requireOwnedRecord(userId, id, recordId);
    const data = await parseBody(request, updateSchema);
    return recordsRepo.update(recordId, data);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id, recordId } = await params;
    await requireOwnedRecord(userId, id, recordId);
    await recordsRepo.remove(recordId);
    return new Response(null, { status: 204 });
  });
}
