import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

import { UnauthorizedError } from '@/lib/auth';

export function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function handleRoute<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const result = await fn();
    return result instanceof Response ? result : NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return errorResponse(401, err.message);
    if (err instanceof ValidationError) return errorResponse(400, err.message);
    if (err instanceof NotFoundError) return errorResponse(404, err.message);
    console.error(err);
    return errorResponse(500, 'Internal server error');
  }
}

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const json = await request.json().catch(() => null);
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join(', '));
  }
  return result.data;
}
