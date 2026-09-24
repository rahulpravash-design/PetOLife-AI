import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const model = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('ai', () => ({ generateObject: model.generate, streamText: vi.fn() }));

import type { HealthRecord } from '@/types';

import { buildHealthSummary } from './summary';

function weight(id: string, value: number, date: string): HealthRecord {
  return { id, petId: 'pet-1', type: 'weight', date, title: 'Weigh-in', value, unit: 'kg', createdAt: date };
}

// 10 kg -> 12 kg is a +20% change, which trips the rule-based >=15% flag.
const RECORDS = [weight('a', 10, '2026-01-01T00:00:00.000Z'), weight('b', 12, '2026-02-01T00:00:00.000Z')];

const reply = (whatHappened: string, attention: { message: string; reasoning: string }[] = []) => ({
  object: { whatHappened, attention: attention.map((a) => ({ ...a, relatedPatternIds: [] })) },
});

beforeEach(() => {
  vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key-not-real');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  model.generate.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('buildHealthSummary output guard', () => {
  it('shows model text that only uses numbers from the data', async () => {
    model.generate.mockResolvedValue(reply('Weight went from 10 to 12 kg across 2 records.'));
    const summary = await buildHealthSummary('pet-1', RECORDS);
    expect(summary.whatHappened).toBe('Weight went from 10 to 12 kg across 2 records.');
  });

  it('replaces a narrative containing an invented number with the rule-based one', async () => {
    model.generate.mockResolvedValue(reply('Weight rose by 2 kg over 6 weeks.'));
    const summary = await buildHealthSummary('pet-1', RECORDS);
    expect(summary.whatHappened).not.toContain('6 weeks');
    expect(summary.whatHappened).toContain('weight went from 10 to 12');
  });

  it('drops model attention items that give treatment advice and keeps the rule-based flag', async () => {
    model.generate.mockResolvedValue(
      reply('Weight went from 10 to 12 kg.', [
        { message: 'You should give him a lower dose of food.', reasoning: 'Weight went up.' },
      ]),
    );
    const summary = await buildHealthSummary('pet-1', RECORDS);
    expect(summary.attention.map((a) => a.message).join(' ')).not.toContain('You should give');
    expect(summary.attention.length).toBeGreaterThan(0);
    expect(summary.attention[0].reasoning).toContain('not a diagnosis');
  });

  it('keeps acceptable model attention items', async () => {
    model.generate.mockResolvedValue(
      reply('Weight went from 10 to 12 kg.', [
        { message: 'The weight change may be worth mentioning to your vet.', reasoning: 'It changed by 20%.' },
      ]),
    );
    const summary = await buildHealthSummary('pet-1', RECORDS);
    expect(summary.attention.map((a) => a.message)).toEqual([
      'The weight change may be worth mentioning to your vet.',
    ]);
  });

  it('falls back to the rule-based summary when the model call fails or times out', async () => {
    model.generate.mockRejectedValue(new Error('gateway timeout'));
    const summary = await buildHealthSummary('pet-1', RECORDS);
    expect(summary.whatHappened).toContain('weight went from 10 to 12');
  });

  it('never calls the model without an API key', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    const summary = await buildHealthSummary('pet-1', RECORDS);
    expect(model.generate).not.toHaveBeenCalled();
    expect(summary.whatChanged[0].deltaPercent).toBe(20);
  });

  it('always reports the deterministic calculations, whatever the model says', async () => {
    model.generate.mockResolvedValue(reply('Weight rose 99%.'));
    const summary = await buildHealthSummary('pet-1', RECORDS);
    expect(summary.whatChanged).toEqual([
      expect.objectContaining({ metric: 'weight', fromValue: 10, toValue: 12, deltaAbsolute: 2, deltaPercent: 20 }),
    ]);
  });
});
