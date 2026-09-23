import { handleRoute } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';
import { buildHealthSummary } from '@/lib/ai/summary';
import { recordsRepo } from '@/lib/repositories/records';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id } = await params;
    requireOwnedPet(userId, id);

    const url = new URL(request.url);
    const rangeStart = url.searchParams.get('from') ?? undefined;
    const rangeEnd = url.searchParams.get('to') ?? undefined;

    const records = recordsRepo.listByPet(id);
    return buildHealthSummary(id, records, rangeStart, rangeEnd);
  });
}
