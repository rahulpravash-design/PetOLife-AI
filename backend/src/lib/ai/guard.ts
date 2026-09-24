// Deterministic checks on model output. The system prompts forbid inventing
// numbers and giving treatment advice, but a prompt is a request, not a
// guarantee - these checks make the two most important rules enforceable for
// structured output (the summary). They are heuristics: they err on the side
// of rejecting, and a rejected narrative is replaced by the rule-based one, so
// a false positive costs prose quality, never correctness.

const NUMBER_RE = /\d+(?:[.,]\d+)?/g;

function normalizeNumber(raw: string): string {
  return String(Number.parseFloat(raw.replace(',', '.')));
}

// Calendar dates are handled separately from measurements. If the digits of
// source timestamps (2026-03-01 -> 2026, 3, 1) counted as "known numbers", an
// invented "3 weeks" would look grounded. So dates are removed from both
// sides before comparing, and only the years found in the source stay allowed.
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?/g;
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const WRITTEN_DATE_RES = [
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}(?:,?\\s+\\d{4})?`, 'gi'), // 1 March 2026
  // The day must not be followed by another digit, or "March 2026" would be
  // read as "March 20" plus a stray "26".
  new RegExp(`\\b${MONTH}\\s+\\d{1,2}(?!\\d)(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?`, 'gi'), // March 1, 2026
  new RegExp(`\\b${MONTH}\\s+\\d{4}\\b`, 'gi'), // March 2026
  /\b\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b/g, // 3/1/2026, 01.03.2026
];

function withoutDates(text: string): string {
  return WRITTEN_DATE_RES.reduce((acc, re) => acc.replace(re, ' '), text.replace(ISO_DATE_RE, ' '));
}

/**
 * Numbers that appear in `text` but nowhere in `source` (the exact data the
 * model was given). Anything the model computed or made up shows up here.
 */
export function findUngroundedNumbers(text: string, source: string): string[] {
  const allowed = new Set((withoutDates(source).match(NUMBER_RE) ?? []).map(normalizeNumber));
  for (const iso of source.match(ISO_DATE_RE) ?? []) allowed.add(normalizeNumber(iso.slice(0, 4))); // years
  const found = (withoutDates(text).match(NUMBER_RE) ?? []).map((raw) => ({ raw, norm: normalizeNumber(raw) }));
  return found.filter((n) => !allowed.has(n.norm)).map((n) => n.raw);
}

// Directive treatment advice or a stated diagnosis. Quoting what a vet
// already recorded ("Amoxicillin 5 mg was logged") is fine and is not matched.
const UNSAFE_PATTERNS: RegExp[] = [
  /\byou (?:should|must|need to|ought to) (?:give|administer|medicate|treat|feed|dose|increase|decrease|stop|start)\b/i,
  /\b(?:give|administer) (?:him|her|them|your (?:pet|dog|cat)) \d/i,
  /\b(?:i|we) (?:recommend|suggest|advise|prescribe)\b/i,
  /\b(?:your (?:pet|dog|cat)|he|she|they) (?:is|are|has|have) (?:likely |probably |definitely )?(?:suffering from|infected with|diagnosed with)\b/i,
  /\b(?:this|it) (?:is|means|indicates|suggests) (?:a |an )?(?:infection|disease|tumou?r|cancer|parasite|kidney|liver|diabetes|allergy)\b/i,
];

export function containsUnsafeMedicalClaim(text: string): boolean {
  return UNSAFE_PATTERNS.some((re) => re.test(text));
}

export type GuardVerdict = { ok: true } | { ok: false; reason: 'ungrounded-number' | 'unsafe-claim' };

/** Is this model-written text safe to show, given the data it was based on? */
export function checkModelText(text: string, source: string): GuardVerdict {
  if (containsUnsafeMedicalClaim(text)) return { ok: false, reason: 'unsafe-claim' };
  if (findUngroundedNumbers(text, source).length > 0) return { ok: false, reason: 'ungrounded-number' };
  return { ok: true };
}
