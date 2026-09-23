import { z } from 'zod';

import { handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedRecord } from '@/lib/authorize';
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

const updateSchema = z.object({
  type: z.enum(RECORD_TYPES).optional(),
  date: z.string().optional(),
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  value: z.number().optional(),
  unit: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

type Params = { params: Promise<{ id: string; recordId: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id, recordId } = await params;
    return requireOwnedRecord(userId, id, recordId);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id, recordId } = await params;
    requireOwnedRecord(userId, id, recordId);
    const data = await parseBody(request, updateSchema);
    return recordsRepo.update(recordId, data);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id, recordId } = await params;
    requireOwnedRecord(userId, id, recordId);
    recordsRepo.remove(recordId);
    return new Response(null, { status: 204 });
  });
}
