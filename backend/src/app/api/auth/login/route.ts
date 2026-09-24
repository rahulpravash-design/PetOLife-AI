import { z } from 'zod';

import { errorResponse, getClientIp, handleRoute, parseBody } from '@/lib/api-utils';
import { isLegacyAuthEnabled, signToken, verifyPasswordOrDummy } from '@/lib/auth';
import {
  checkLoginLock,
  loginEmailKey,
  loginIpKey,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/rate-limit';
import { usersRepo } from '@/lib/repositories/users';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    // Checked before anything else (no body parse, no rate-limit writes) so a
    // production deployment exposes no password-login surface at all.
    if (!isLegacyAuthEnabled()) return errorResponse(404, 'Not found');

    const { email, password } = await parseBody(request, schema);

    const emailKey = loginEmailKey(email);
    const ipKey = loginIpKey(getClientIp(request));

    if ((await checkLoginLock(emailKey, ipKey)).locked) {
      return errorResponse(429, 'Too many attempts. Please try again later.');
    }

    const user = await usersRepo.findByEmail(email);
    const valid = verifyPasswordOrDummy(password, user?.password_hash ?? null);

    if (!user || !valid) {
      await recordLoginFailure(emailKey, ipKey);
      return errorResponse(401, 'Invalid email or password');
    }

    await recordLoginSuccess(emailKey);
    const token = await signToken(user.id);
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  });
}
