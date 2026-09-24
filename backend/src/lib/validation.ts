import { z } from 'zod';

// Shared request-validation building blocks. Limits are deliberately generous
// for real use (a vet-visit note is a few paragraphs at most) but bounded, so
// a client can't store or forward megabytes of text through the API or into
// an LLM prompt.

export const RECORD_TYPES = [
  'weight',
  'vaccination',
  'medication',
  'vet_visit',
  'symptom',
  'lab_result',
  'note',
] as const;

export const NAME_MAX = 100;
export const TITLE_MAX = 200;
export const NOTES_MAX = 2000;
export const UNIT_MAX = 32;
export const URL_MAX = 2048;
export const CHAT_MESSAGE_MAX = 2000;

export const nameText = z.string().trim().min(1, 'Name is required').max(NAME_MAX);
export const titleText = z.string().trim().min(1, 'Title is required').max(TITLE_MAX);
export const notesText = z.string().max(NOTES_MAX);
export const unitText = z.string().trim().max(UNIT_MAX);

// Anything `new Date()` can parse into a real instant. Rejects '', 'abc' and
// other strings that would otherwise reach the analytics code as NaN.
export function isValidDateString(value: string): boolean {
  return value.length <= 64 && !Number.isNaN(new Date(value).getTime());
}

export const dateString = z
  .string()
  .trim()
  .min(1, 'Date is required')
  .refine(isValidDateString, 'Invalid date');

// Only web URLs: rules out javascript:, data:, file: and similar schemes.
export const httpUrl = z
  .string()
  .max(URL_MAX)
  .refine((v) => /^https?:\/\//i.test(v) && URL.canParse(v), 'Must be an http(s) URL');

// JSON can't carry NaN/Infinity, but very large magnitudes are still nonsense
// for any health measurement and break downstream arithmetic/formatting.
export const measurement = z.number().finite().min(-1_000_000).max(1_000_000);
