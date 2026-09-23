import type { HealthRecord, HealthRecordType, RecordFacts, WhatChanged } from '@/types';

const RECORD_TYPES: HealthRecordType[] = [
  'weight',
  'vaccination',
  'medication',
  'vet_visit',
  'symptom',
  'lab_result',
  'note',
];

// Metrics with a numeric `value` worth diffing over time. Extend this list
// as new quantifiable record types are added (e.g. temperature, heart rate).
const NUMERIC_METRIC_TYPES: HealthRecordType[] = ['weight', 'lab_result'];

function inRange(record: HealthRecord, rangeStart?: string, rangeEnd?: string): boolean {
  const t = new Date(record.date).getTime();
  if (rangeStart && t < new Date(rangeStart).getTime()) return false;
  if (rangeEnd && t > new Date(rangeEnd).getTime()) return false;
  return true;
}

/**
 * Deterministic delta of a numeric metric between the earliest and latest
 * record of that type within range. Never uses the LLM — arithmetic only.
 */
function computeMetricChange(records: HealthRecord[], type: HealthRecordType): WhatChanged | null {
  const withValues = records
    .filter((r) => r.type === type && typeof r.value === 'number')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (withValues.length < 2) return null;

  const from = withValues[0];
  const to = withValues[withValues.length - 1];
  const fromValue = from.value as number;
  const toValue = to.value as number;
  const deltaAbsolute = toValue - fromValue;
  const deltaPercent = fromValue !== 0 ? (deltaAbsolute / fromValue) * 100 : 0;

  return {
    metric: type,
    fromValue,
    toValue,
    deltaAbsolute: Math.round(deltaAbsolute * 100) / 100,
    deltaPercent: Math.round(deltaPercent * 100) / 100,
    fromDate: from.date,
    toDate: to.date,
  };
}

export function computeWhatChanged(records: HealthRecord[]): WhatChanged[] {
  return NUMERIC_METRIC_TYPES.map((type) => computeMetricChange(records, type)).filter(
    (c): c is WhatChanged => c !== null,
  );
}

export function computeFacts(
  petId: string,
  records: HealthRecord[],
  rangeStart?: string,
  rangeEnd?: string,
): RecordFacts {
  const scoped = records.filter((r) => inRange(r, rangeStart, rangeEnd));

  const countsByType = RECORD_TYPES.reduce(
    (acc, type) => {
      acc[type] = scoped.filter((r) => r.type === type).length;
      return acc;
    },
    {} as Record<HealthRecordType, number>,
  );

  const dates = scoped.map((r) => new Date(r.date).getTime());
  const resolvedStart = rangeStart ?? (dates.length ? new Date(Math.min(...dates)).toISOString() : new Date().toISOString());
  const resolvedEnd = rangeEnd ?? (dates.length ? new Date(Math.max(...dates)).toISOString() : new Date().toISOString());

  return {
    petId,
    rangeStart: resolvedStart,
    rangeEnd: resolvedEnd,
    totalRecords: scoped.length,
    countsByType,
    whatChanged: computeWhatChanged(scoped),
  };
}

/** Average gap in days between consecutive records of a given type. Null if fewer than 2. */
export function averageGapDays(records: HealthRecord[], type: HealthRecordType): number | null {
  const sorted = records
    .filter((r) => r.type === type)
    .map((r) => new Date(r.date).getTime())
    .sort((a, b) => a - b);

  if (sorted.length < 2) return null;

  const gaps = sorted.slice(1).map((t, i) => (t - sorted[i]) / (1000 * 60 * 60 * 24));
  const avg = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  return Math.round(avg * 10) / 10;
}
