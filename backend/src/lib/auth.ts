import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const DEV_FALLBACK_SECRET = 'petolife-dev-secret-do-not-use-in-production';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return DEV_FALLBACK_SECRET;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: '30d' });
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function requireUserId(request: Request): string {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new UnauthorizedError('Missing token');

  try {
    const payload = jwt.verify(token, getSecret());
    if (typeof payload === 'string' || !payload.sub) throw new UnauthorizedError();
    return payload.sub;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
