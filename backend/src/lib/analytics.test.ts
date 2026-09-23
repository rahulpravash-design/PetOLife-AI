import { describe, expect, it } from 'vitest';

import { averageGapDays, computeFacts, computeWhatChanged } from './analytics';
import type { HealthRecord } from '../types';

function record(overrides: Partial<HealthRecord>): HealthRecord {
  return {
    id: overrides.id ?? Math.random().toString(36),
    petId: 'pet-1',
    type: 'weight',
    date: '2026-01-01T00:00:00.000Z',
    title: 'Weigh-in',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeWhatChanged', () => {
  it('returns empty when fewer than two numeric records exist', () => {
    const records = [record({ type: 'weight', value: 10 })];
    expect(computeWhatChanged(records)).toEqual([]);
  });

  it('computes delta and percent between earliest and latest weight', () => {
    const records = [
      record({ id: 'a', type: 'weight', value: 10, date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'weight', value: 12, date: '2026-02-01T00:00:00.000Z' }),
    ];
    const [change] = computeWhatChanged(records);
    expect(change.metric).toBe('weight');
    expect(change.fromValue).toBe(10);
    expect(change.toValue).toBe(12);
    expect(change.deltaAbsolute).toBe(2);
    expect(change.deltaPercent).toBe(20);
  });

  it('uses earliest and latest by date, not insertion order', () => {
    const records = [
      record({ id: 'later', type: 'weight', value: 15, date: '2026-03-01T00:00:00.000Z' }),
      record({ id: 'earlier', type: 'weight', value: 10, date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'middle', type: 'weight', value: 12, date: '2026-02-01T00:00:00.000Z' }),
    ];
    const [change] = computeWhatChanged(records);
    expect(change.fromValue).toBe(10);
    expect(change.toValue).toBe(15);
  });

  it('ignores records without a numeric value', () => {
    const records = [
      record({ id: 'a', type: 'weight', value: 10 }),
      record({ id: 'b', type: 'weight', value: undefined }),
    ];
    expect(computeWhatChanged(records)).toEqual([]);
  });
});

describe('computeFacts', () => {
  it('counts records by type within the full range when no bounds given', () => {
    const records = [
      record({ id: 'a', type: 'weight', value: 10, date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'vet_visit', date: '2026-01-15T00:00:00.000Z' }),
    ];
    const facts = computeFacts('pet-1', records);
    expect(facts.totalRecords).toBe(2);
    expect(facts.countsByType.weight).toBe(1);
    expect(facts.countsByType.vet_visit).toBe(1);
    expect(facts.countsByType.symptom).toBe(0);
  });

  it('excludes records outside the given range', () => {
    const records = [
      record({ id: 'a', type: 'weight', value: 10, date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'weight', value: 20, date: '2026-06-01T00:00:00.000Z' }),
    ];
    const facts = computeFacts('pet-1', records, '2026-05-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z');
    expect(facts.totalRecords).toBe(1);
    expect(facts.countsByType.weight).toBe(1);
  });
});

describe('averageGapDays', () => {
  it('returns null with fewer than two records', () => {
    expect(averageGapDays([record({ type: 'vet_visit' })], 'vet_visit')).toBeNull();
  });

  it('averages the gap in days between consecutive records', () => {
    const records = [
      record({ id: 'a', type: 'vet_visit', date: '2026-01-01T00:00:00.000Z' }),
      record({ id: 'b', type: 'vet_visit', date: '2026-01-11T00:00:00.000Z' }),
      record({ id: 'c', type: 'vet_visit', date: '2026-01-21T00:00:00.000Z' }),
    ];
    expect(averageGapDays(records, 'vet_visit')).toBe(10);
  });
});
