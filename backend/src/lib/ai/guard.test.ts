import { describe, expect, it } from 'vitest';

import { checkModelText, containsUnsafeMedicalClaim, findUngroundedNumbers } from './guard';

const SOURCE = JSON.stringify({
  facts: { totalRecords: 4, whatChanged: [{ fromValue: 10, toValue: 12.5, deltaPercent: 25 }] },
  recentRecords: [{ date: '2026-03-01T00:00:00.000Z', title: 'Rabies vaccine', value: 12.5, unit: 'kg' }],
});

describe('findUngroundedNumbers', () => {
  it('accepts numbers that appear in the source data', () => {
    expect(findUngroundedNumbers('Weight rose from 10 to 12.5 kg, up 25%, across 4 records.', SOURCE)).toEqual([]);
  });

  it('treats decimal comma and trailing zeros as the same number', () => {
    expect(findUngroundedNumbers('It reached 12,50 kg.', SOURCE)).toEqual([]);
  });

  it('flags numbers the model computed or invented', () => {
    expect(findUngroundedNumbers('Weight rose by 2.5 kg over 3 weeks.', SOURCE)).toEqual(['2.5', '3']);
  });

  it('accepts written calendar dates and years from the source', () => {
    expect(findUngroundedNumbers('The vaccine was logged on March 1, 2026.', SOURCE)).toEqual([]);
    expect(findUngroundedNumbers('Logged 1 March 2026, then again on 2026-03-01.', SOURCE)).toEqual([]);
    expect(findUngroundedNumbers('Recorded in 2026.', SOURCE)).toEqual([]);
  });

  it('does not let source date digits ground unrelated small numbers', () => {
    // "2026-03-01" contains 3 and 1, but neither is a measurement in the data.
    expect(findUngroundedNumbers('Three symptoms over 3 weeks, 1 day apart.', SOURCE)).toEqual(['3', '1']);
  });

  it('flags years that are not in the source', () => {
    expect(findUngroundedNumbers('Recorded in 2019.', SOURCE)).toEqual(['2019']);
  });

  it('accepts text with no numbers', () => {
    expect(findUngroundedNumbers('Nothing notable was recorded.', SOURCE)).toEqual([]);
  });
});

describe('containsUnsafeMedicalClaim', () => {
  it.each([
    'You should give him 5 mg of ibuprofen every day.',
    'I recommend increasing the dose.',
    'Your dog is likely suffering from kidney disease.',
    'This suggests an infection.',
    'Give your cat 2 tablets tonight.',
  ])('rejects: %s', (text) => {
    expect(containsUnsafeMedicalClaim(text)).toBe(true);
  });

  it.each([
    'Amoxicillin 5 mg was logged on March 1.',
    'This may be worth mentioning to your vet.',
    'Weight increased 25% between the first and last record.',
    'This summary is not a diagnosis.',
  ])('allows: %s', (text) => {
    expect(containsUnsafeMedicalClaim(text)).toBe(false);
  });
});

describe('checkModelText', () => {
  it('reports why text was rejected', () => {
    expect(checkModelText('You should stop feeding him.', SOURCE)).toEqual({ ok: false, reason: 'unsafe-claim' });
    expect(checkModelText('Weight rose 99%.', SOURCE)).toEqual({ ok: false, reason: 'ungrounded-number' });
    expect(checkModelText('Weight rose 25%.', SOURCE)).toEqual({ ok: true });
  });
});
