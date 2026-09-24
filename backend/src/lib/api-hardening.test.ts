import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The model is never called for real: streamText / generateObject are stubs.
const aiCalls = vi.hoisted(() => ({ stream: [] as Array<Record<string, unknown>> }));
vi.mock('ai', () => ({
  streamText: (opts: Record<string, unknown>) => {
    aiCalls.stream.push(opts);
    return { toTextStreamResponse: () => new Response('stubbed answer') };
  },
  generateObject: vi.fn(async () => ({
    object: {
      type: 'vaccination',
      title: 'Rabies',
      date: null,
      value: null,
      unit: null,
      notes: null,
      confidence: 'high',
    },
  })),
}));

import { POST as chatRoute } from '@/app/api/pets/[id]/chat/route';
import { POST as extractRoute } from '@/app/api/pets/[id]/extract-document/route';
import { GET as getRecordRoute } from '@/app/api/pets/[id]/records/[recordId]/route';
import { POST as createRecordRoute } from '@/app/api/pets/[id]/records/route';
import { PATCH as patchReminderRoute } from '@/app/api/pets/[id]/reminders/[reminderId]/route';
import { POST as createReminderRoute } from '@/app/api/pets/[id]/reminders/route';
import { GET as getPetRoute } from '@/app/api/pets/[id]/route';
import { GET as summaryRoute } from '@/app/api/pets/[id]/summary/route';
import { POST as createPetRoute } from '@/app/api/pets/route';
import { hashPassword, signToken } from '@/lib/auth';
import { CHAT_THROTTLE_LIMIT, SUMMARY_THROTTLE_LIMIT } from '@/lib/limits';
import { petsRepo } from '@/lib/repositories/pets';
import { recordsRepo } from '@/lib/repositories/records';
import { remindersRepo } from '@/lib/repositories/reminders';
import { usersRepo } from '@/lib/repositories/users';

// Legacy (HS256) tokens are used here purely as a way to get two distinct
// authenticated users; the Clerk verification path is covered in clerk.test.ts.

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

function req(token: string | undefined, init: { method?: string; body?: unknown; url?: string } = {}) {
  return new Request(init.url ?? 'http://localhost/test', {
    method: init.method ?? 'GET',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function newUser() {
  const user = await usersRepo.create(`hard-${randomUUID()}@example.com`, hashPassword('pw-not-used-12345'), 'Test');
  return { user, token: await signToken(user.id) };
}

beforeEach(() => {
  aiCalls.stream.length = 0;
  vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key-not-real');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('cross-user access (IDOR)', () => {
  it("user B cannot read, write, chat about or summarise user A's pet data", async () => {
    const a = await newUser();
    const b = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    const record = await recordsRepo.create(pet.id, { type: 'note', date: new Date().toISOString(), title: 'Private' });
    const reminder = await remindersRepo.create(pet.id, { title: 'Private', dueDate: new Date().toISOString() });

    const notFound = async (p: Promise<Response>) => expect((await p).status).toBe(404);

    await notFound(getPetRoute(req(b.token), params({ id: pet.id })));
    await notFound(getRecordRoute(req(b.token), params({ id: pet.id, recordId: record.id })));
    await notFound(
      createRecordRoute(
        req(b.token, { method: 'POST', body: { type: 'note', date: '2024-01-01', title: 'x' } }),
        params({ id: pet.id }),
      ),
    );
    await notFound(
      createReminderRoute(
        req(b.token, { method: 'POST', body: { title: 'x', dueDate: '2024-01-01' } }),
        params({ id: pet.id }),
      ),
    );
    await notFound(
      patchReminderRoute(
        req(b.token, { method: 'PATCH', body: { isDone: true } }),
        params({ id: pet.id, reminderId: reminder.id }),
      ),
    );
    await notFound(chatRoute(req(b.token, { method: 'POST', body: { message: 'hi' } }), params({ id: pet.id })));
    await notFound(summaryRoute(req(b.token), params({ id: pet.id })));
    await notFound(
      extractRoute(req(b.token, { method: 'POST', body: { imageBase64: 'AAAA' } }), params({ id: pet.id })),
    );

    // Nothing was created or changed under A's pet, and no model call was made.
    expect(await recordsRepo.listByPet(pet.id)).toHaveLength(1);
    expect(await remindersRepo.listByPet(pet.id)).toHaveLength(1);
    expect(aiCalls.stream).toHaveLength(0);
  });

  it('a record id from one pet is not reachable through another pet the caller owns', async () => {
    const a = await newUser();
    const petOne = await petsRepo.create(a.user.id, { name: 'One', species: 'cat' });
    const petTwo = await petsRepo.create(a.user.id, { name: 'Two', species: 'cat' });
    const record = await recordsRepo.create(petOne.id, { type: 'note', date: '2024-01-01', title: 'x' });
    const res = await getRecordRoute(req(a.token), params({ id: petTwo.id, recordId: record.id }));
    expect(res.status).toBe(404);
  });
});

describe('unauthenticated access', () => {
  it('rejects missing and malformed tokens with 401 JSON (not a stack trace)', async () => {
    const a = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    for (const token of [undefined, 'garbage', 'a.b.c']) {
      const chat = await chatRoute(req(token, { method: 'POST', body: { message: 'hi' } }), params({ id: pet.id }));
      expect(chat.status).toBe(401);
      expect((await chat.json()).error).toBeTruthy();
      expect((await summaryRoute(req(token), params({ id: pet.id }))).status).toBe(401);
    }
  });
});

describe('POST /pets/:id/chat', () => {
  it('returns 400, not 500, for a malformed or oversized message', async () => {
    const a = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    for (const body of [{}, { message: '' }, { message: '   ' }, { message: 'x'.repeat(2001) }, { message: 5 }]) {
      const res = await chatRoute(req(a.token, { method: 'POST', body }), params({ id: pet.id }));
      expect(res.status).toBe(400);
    }
    expect(aiCalls.stream).toHaveLength(0);
  });

  it('streams an answer and bounds the model call (output tokens + timeout)', async () => {
    const a = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    const res = await chatRoute(req(a.token, { method: 'POST', body: { message: 'How is he?' } }), params({ id: pet.id }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('stubbed answer');
    expect(aiCalls.stream).toHaveLength(1);
    expect(aiCalls.stream[0].maxOutputTokens).toBeGreaterThan(0);
    expect(aiCalls.stream[0].abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('rate limits per user with 429 + Retry-After, and invalid requests do not use the budget', async () => {
    const a = await newUser();
    const other = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    const otherPet = await petsRepo.create(other.user.id, { name: 'Milo', species: 'cat' });
    const send = (token: string, id: string, message: unknown) =>
      chatRoute(req(token, { method: 'POST', body: { message } }), params({ id }));

    for (let i = 0; i < 5; i++) expect((await send(a.token, pet.id, '')).status).toBe(400);

    for (let i = 0; i < CHAT_THROTTLE_LIMIT; i++) expect((await send(a.token, pet.id, 'hi')).status).toBe(200);
    const blocked = await send(a.token, pet.id, 'hi');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);

    // Another user has their own budget.
    expect((await send(other.token, otherPet.id, 'hi')).status).toBe(200);
  });
});

describe('GET /pets/:id/summary', () => {
  it('rejects invalid from/to dates with 400', async () => {
    const a = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    const res = await summaryRoute(
      req(a.token, { url: 'http://localhost/test?from=not-a-date' }),
      params({ id: pet.id }),
    );
    expect(res.status).toBe(400);
  });

  it('rate limits per user', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    const a = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    for (let i = 0; i < SUMMARY_THROTTLE_LIMIT; i++) {
      expect((await summaryRoute(req(a.token), params({ id: pet.id }))).status).toBe(200);
    }
    const blocked = await summaryRoute(req(a.token), params({ id: pet.id }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });
});

describe('POST /pets/:id/extract-document', () => {
  it('only accepts image mime types', async () => {
    const a = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    const bad = await extractRoute(
      req(a.token, { method: 'POST', body: { imageBase64: 'AAAA', mimeType: 'text/html;base64,<script>' } }),
      params({ id: pet.id }),
    );
    expect(bad.status).toBe(400);

    const ok = await extractRoute(
      req(a.token, { method: 'POST', body: { imageBase64: 'AAAA', mimeType: 'image/png' } }),
      params({ id: pet.id }),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).title).toBe('Rabies');
  });
});

describe('input validation on create routes', () => {
  it('rejects invalid dates, oversized text, absurd values and non-http URLs on records', async () => {
    const a = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    const good = { type: 'weight', date: '2024-03-01', title: 'Weigh-in', value: 12.5, unit: 'kg' };
    const post = (body: unknown) =>
      createRecordRoute(req(a.token, { method: 'POST', body }), params({ id: pet.id }));

    expect((await post(good)).status).toBe(200);

    const bads: unknown[] = [
      { ...good, date: 'nonsense' },
      { ...good, date: '' },
      { ...good, title: '' },
      { ...good, title: 'x'.repeat(201) },
      { ...good, notes: 'x'.repeat(2001) },
      { ...good, value: 1e12 },
      { ...good, value: '12' },
      { ...good, type: 'diagnosis' },
      { ...good, attachmentUrl: 'javascript:alert(1)' },
    ];
    for (const body of bads) expect((await post(body)).status).toBe(400);
    expect(await recordsRepo.listByPet(pet.id)).toHaveLength(1);
  });

  it('rejects invalid reminder dates and pet fields', async () => {
    const a = await newUser();
    const pet = await petsRepo.create(a.user.id, { name: 'Bruno', species: 'dog' });
    const reminder = (body: unknown) =>
      createReminderRoute(req(a.token, { method: 'POST', body }), params({ id: pet.id }));
    expect((await reminder({ title: 'Vaccine', dueDate: 'soon' })).status).toBe(400);
    expect((await reminder({ title: 'Vaccine', dueDate: '2030-01-01T09:00:00.000Z' })).status).toBe(200);

    const newPet = (body: unknown) => createPetRoute(req(a.token, { method: 'POST', body }));
    expect((await newPet({ name: 'x'.repeat(101), species: 'dog' })).status).toBe(400);
    expect((await newPet({ name: '  ', species: 'dog' })).status).toBe(400);
    expect((await newPet({ name: 'Rex', species: 'dog', photoUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await newPet({ name: 'Rex', species: 'dog', birthDate: 'yesterday-ish' })).status).toBe(400);
    expect((await newPet({ name: '  Rex  ', species: 'dog' })).status).toBe(200);
  });
});
