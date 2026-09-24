import { ValidationError, handleRoute } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';
import { buildHealthSummary } from '@/lib/ai/summary';
import { SUMMARY_THROTTLE_LIMIT, SUMMARY_THROTTLE_WINDOW_MS } from '@/lib/limits';
import { enforceUserThrottle } from '@/lib/rate-limit';
import { recordsRepo } from '@/lib/repositories/records';
import { isValidDateString } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    await requireOwnedPet(userId, id);

    const url = new URL(request.url);
    const rangeStart = url.searchParams.get('from') ?? undefined;
    const rangeEnd = url.searchParams.get('to') ?? undefined;
    for (const value of [rangeStart, rangeEnd]) {
      if (value !== undefined && !isValidDateString(value)) {
        throw new ValidationError('"from" and "to" must be valid dates');
      }
    }

    await enforceUserThrottle(
      'summary',
      userId,
      SUMMARY_THROTTLE_LIMIT,
      SUMMARY_THROTTLE_WINDOW_MS,
      'Too many summary requests. Please wait a few minutes and try again.',
    );

    const records = await recordsRepo.listByPet(id);
    return buildHealthSummary(id, records, rangeStart, rangeEnd);
  });
}
