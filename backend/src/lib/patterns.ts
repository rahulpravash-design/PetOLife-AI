import { randomUUID } from 'node:crypto';

import type { HealthRecord, Pattern } from '@/types';

const DAY_MS = 1000 * 60 * 60 * 24;

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY_MS;
}

/**
 * All patterns here are plain heuristics over the record list — no LLM
 * involved. The AI layer (Phase 10+) explains these in natural language and
 * cites `sourceRecordIds`; it never invents patterns of its own.
 */
export function computePatterns(records: HealthRecord[]): Pattern[] {
  const patterns: Pattern[] = [];

  const vetVisits = records
    .filter((r) => r.type === 'vet_visit')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (let i = 0; i + 1 < vetVisits.length; i++) {
    if (daysBetween(vetVisits[i].date, vetVisits[i + 1].date) <= 60) {
      patterns.push({
        id: randomUUID(),
        description: 'Two or more vet visits within a 60-day window',
        sourceRecordIds: [vetVisits[i].id, vetVisits[i + 1].id],
        confidence: 'high',
      });
      break;
    }
  }

  const symptomsByTitle = new Map<string, HealthRecord[]>();
  for (const r of records.filter((r) => r.type === 'symptom')) {
    const key = r.title.trim().toLowerCase();
    const list = symptomsByTitle.get(key) ?? [];
    list.push(r);
    symptomsByTitle.set(key, list);
  }
  for (const [title, group] of symptomsByTitle) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const span = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
    if (span <= 30) {
      patterns.push({
        id: randomUUID(),
        description: `"${title}" reported ${group.length} times within ${Math.ceil(span)} days`,
        sourceRecordIds: sorted.map((r) => r.id),
        confidence: group.length >= 3 ? 'high' : 'medium',
      });
    }
  }

  const weights = records
    .filter((r) => r.type === 'weight' && typeof r.value === 'number')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (weights.length >= 3) {
    const values = weights.map((r) => r.value as number);
    const increasing = values.every((v, i) => i === 0 || v >= values[i - 1]);
    const decreasing = values.every((v, i) => i === 0 || v <= values[i - 1]);
    // All-equal values satisfy both checks; that's "stable", not a trend.
    if (increasing !== decreasing) {
      patterns.push({
        id: randomUUID(),
        description: `Weight has been steadily ${increasing ? 'increasing' : 'decreasing'} across ${values.length} logs`,
        sourceRecordIds: weights.map((r) => r.id),
        confidence: values.length >= 4 ? 'high' : 'medium',
      });
    }
  }

  return patterns;
}
