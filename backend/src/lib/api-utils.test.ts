import { afterEach, describe, expect, it, vi } from 'vitest';

import { RateLimitError, ValidationError, getClientIp, handleRoute } from './api-utils';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function reqWith(headers: Record<string, string>) {
  return new Request('http://localhost/x', { headers });
}

describe('getClientIp', () => {
  it('uses the last x-forwarded-for hop (appended by our proxy), not the client-claimed first', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true');
    expect(getClientIp(reqWith({ 'x-forwarded-for': '6.6.6.6, 198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('ignores spoofable headers in production unless the proxy is trusted', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('TRUST_PROXY_HEADERS', '');
    expect(getClientIp(reqWith({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '7.7.7.7' }))).toBe('unknown');
  });

  it('trusts the headers on Vercel', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('TRUST_PROXY_HEADERS', '');
    expect(getClientIp(reqWith({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('TRUST_PROXY_HEADERS=false wins even on Vercel', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('TRUST_PROXY_HEADERS', 'false');
    expect(getClientIp(reqWith({ 'x-forwarded-for': '203.0.113.9' }))).toBe('unknown');
  });

  it('falls back to x-real-ip, then unknown, when trusted', () => {
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true');
    expect(getClientIp(reqWith({ 'x-real-ip': '192.0.2.4' }))).toBe('192.0.2.4');
    expect(getClientIp(reqWith({}))).toBe('unknown');
  });
});

describe('handleRoute error mapping', () => {
  it('maps RateLimitError to 429 with Retry-After', async () => {
    const res = await handleRoute(async () => {
      throw new RateLimitError('slow down', 42);
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(await res.json()).toEqual({ error: 'slow down' });
  });

  it('maps ValidationError to 400', async () => {
    const res = await handleRoute(async () => {
      throw new ValidationError('bad');
    });
    expect(res.status).toBe(400);
  });

  it('hides unexpected error details behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleRoute(async () => {
      throw new Error('connection string postgres://user:secret@host');
    });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});
