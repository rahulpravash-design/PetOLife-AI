import { handleRoute } from '@/lib/api-utils';
import { requireSession } from '@/lib/auth';
import { sessionsRepo } from '@/lib/repositories/sessions';

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { jti } = await requireSession(request);
    await sessionsRepo.revoke(jti);
    return new Response(null, { status: 204 });
  });
}
