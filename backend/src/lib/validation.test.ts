import { describe, expect, it } from 'vitest';

import {
  CHAT_MESSAGE_MAX,
  NAME_MAX,
  NOTES_MAX,
  dateString,
  httpUrl,
  isValidDateString,
  measurement,
  nameText,
  notesText,
} from './validation';

describe('isValidDateString / dateString', () => {
  it.each(['2024-05-01', '2024-05-01T10:30:00.000Z', 'May 1, 2024'])('accepts %s', (v) => {
    expect(isValidDateString(v)).toBe(true);
    expect(dateString.safeParse(v).success).toBe(true);
  });

  it.each(['', '   ', 'abc', 'not-a-date', '2024-13-45'])('rejects %j', (v) => {
    expect(dateString.safeParse(v).success).toBe(false);
  });

  it('rejects absurdly long strings even if a prefix parses', () => {
    expect(isValidDateString(`2024-05-01${' '.repeat(100)}`)).toBe(false);
  });
});

describe('httpUrl', () => {
  it.each(['https://example.com/a.png', 'http://example.com'])('accepts %s', (v) => {
    expect(httpUrl.safeParse(v).success).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html;base64,AAAA',
    'file:///etc/passwd',
    'ftp://x.com',
    'example.com',
    'https://',
  ])('rejects %s', (v) => {
    expect(httpUrl.safeParse(v).success).toBe(false);
  });

  it('rejects overly long URLs', () => {
    expect(httpUrl.safeParse(`https://example.com/${'a'.repeat(3000)}`).success).toBe(false);
  });
});

describe('measurement', () => {
  it('accepts normal values including zero and negatives', () => {
    for (const v of [0, 4.2, -3, 999_999]) expect(measurement.safeParse(v).success).toBe(true);
  });

  it('rejects huge, non-finite and non-number values', () => {
    for (const v of [1e12, -1e12, Infinity, NaN, '5', null]) {
      expect(measurement.safeParse(v).success).toBe(false);
    }
  });
});

describe('text fields', () => {
  it('trims and requires a non-empty name', () => {
    expect(nameText.parse('  Bruno  ')).toBe('Bruno');
    expect(nameText.safeParse('   ').success).toBe(false);
  });

  it('enforces maximum lengths', () => {
    expect(nameText.safeParse('a'.repeat(NAME_MAX)).success).toBe(true);
    expect(nameText.safeParse('a'.repeat(NAME_MAX + 1)).success).toBe(false);
    expect(notesText.safeParse('a'.repeat(NOTES_MAX + 1)).success).toBe(false);
    expect(CHAT_MESSAGE_MAX).toBeGreaterThan(0);
  });
});
