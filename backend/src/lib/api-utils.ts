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
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } },
      );
    }
    console.error(err);
    return errorResponse(500, 'Internal server error');
  }
}

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const json = await request.json().catch(() => null);
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join(', '));
  }
  return result.data;
}

// x-forwarded-for / x-real-ip are plain request headers: a client can send any
// value, so they are only believable when a proxy we control sets or appends to
// them. They are trusted when running on Vercel (which overwrites them), when
// TRUST_PROXY_HEADERS=true is set explicitly (own reverse proxy / load balancer
// that appends the real peer address), and outside production (local dev has
// no proxy, so the header is normally absent anyway). Otherwise every request
// shares the 'unknown' bucket rather than letting callers pick their own IP
// and dodge per-IP limits.
function trustProxyHeaders(): boolean {
  if (process.env.TRUST_PROXY_HEADERS === 'true') return true;
  if (process.env.TRUST_PROXY_HEADERS === 'false') return false;
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV !== 'production';
}

export function getClientIp(request: Request): string {
  if (!trustProxyHeaders()) return 'unknown';
  // The LAST entry is the one appended by the nearest trusted proxy; earlier
  // entries are whatever the client claimed.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
