import { handleRoute } from '@/lib/api-utils';
import { requireSession } from '@/lib/auth';
import { sessionsRepo } from '@/lib/repositories/sessions';

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { jti } = await requireSession(request);
    // Legacy sessions are revoked server-side. Clerk sessions have no local
    // row: the client ends them with Clerk's signOut, and the (~60s) token
    // simply expires - so for those this is a successful no-op.
    if (jti) await sessionsRepo.revoke(jti);
    return new Response(null, { status: 204 });
  });
}
