import { describe, expect, it } from 'vitest';

import { computePatterns } from './patterns';
import type { HealthRecord } from '../types';

function record(overrides: Partial<HealthRecord>): HealthRecord {
  return {
    id: overrides.id ?? Math.random().toString(36),
    petId: 'pet-1',
    type: 'note',
    date: '2026-01-01T00:00:00.000Z',
    title: 'Note',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computePatterns', () => {
  it('returns no patterns for an empty or unremarkable record set', () => {
    expect(computePatterns([])).toEqual([]);
    expect(computePatterns([record({ type: 'note' })])).toEqual([]);
  });

  it('flags two vet visits within 60 days', () => {
    const records = [
      record({ id: 'a', type: 'vet_visit', date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'vet_visit', date: '2026-01-20T00:00:00.000Z' }),
    ];
    const patterns = computePatterns(records);
    expect(patterns.some((p) => p.description.includes('vet visits'))).toBe(true);
  });

  it('does not flag vet visits more than 60 days apart', () => {
    const records = [
      record({ id: 'a', type: 'vet_visit', date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'vet_visit', date: '2026-06-01T00:00:00.000Z' }),
    ];
    const patterns = computePatterns(records);
    expect(patterns.some((p) => p.description.includes('vet visits'))).toBe(false);
  });

  it('flags a recurring symptom within 30 days and cites its source records', () => {
    const records = [
      record({ id: 'a', type: 'symptom', title: 'Limping', date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'symptom', title: 'Limping', date: '2026-01-10T00:00:00.000Z' }),
    ];
    const patterns = computePatterns(records);
    const match = patterns.find((p) => p.description.toLowerCase().includes('limping'));
    expect(match).toBeDefined();
    expect(match?.sourceRecordIds.sort()).toEqual(['a', 'b']);
  });

  it('flags a steady weight trend across 3+ logs with increasing confidence', () => {
    const records = [
      record({ id: 'a', type: 'weight', value: 10, date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'weight', value: 11, date: '2026-02-01T00:00:00.000Z' }),
      record({ id: 'c', type: 'weight', value: 12, date: '2026-03-01T00:00:00.000Z' }),
      record({ id: 'd', type: 'weight', value: 13, date: '2026-04-01T00:00:00.000Z' }),
    ];
    const patterns = computePatterns(records);
    const trend = patterns.find((p) => p.description.includes('increasing'));
    expect(trend).toBeDefined();
    expect(trend?.confidence).toBe('high');
    expect(trend?.sourceRecordIds).toHaveLength(4);
  });

  it('does not flag a non-monotonic weight series as a trend', () => {
    const records = [
      record({ id: 'a', type: 'weight', value: 10, date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'weight', value: 15, date: '2026-02-01T00:00:00.000Z' }),
      record({ id: 'c', type: 'weight', value: 9, date: '2026-03-01T00:00:00.000Z' }),
    ];
    const patterns = computePatterns(records);
    expect(patterns.some((p) => p.description.includes('Weight has been steadily'))).toBe(false);
  });
});
