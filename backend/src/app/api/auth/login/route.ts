import { z } from 'zod';

import { errorResponse, handleRoute, parseBody } from '@/lib/api-utils';
import { signToken, verifyPassword } from '@/lib/auth';
import { usersRepo } from '@/lib/repositories/users';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { email, password } = await parseBody(request, schema);

    const user = usersRepo.findByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return errorResponse(401, 'Invalid email or password');
    }

    const token = signToken(user.id);
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  });
}
