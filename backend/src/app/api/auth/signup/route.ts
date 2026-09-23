import { z } from 'zod';

import { errorResponse, handleRoute, parseBody } from '@/lib/api-utils';
import { hashPassword, signToken } from '@/lib/auth';
import { usersRepo } from '@/lib/repositories/users';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { email, password, name } = await parseBody(request, schema);

    if (await usersRepo.findByEmail(email)) {
      // Generic message/status (matches validation-error shape) so this endpoint
      // can't be used to enumerate which emails already have accounts.
      return errorResponse(400, 'Unable to create account with the provided details.');
    }

    const user = await usersRepo.create(email, hashPassword(password), name);
    const token = await signToken(user.id);
    return { token, user };
  });
}
