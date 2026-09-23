import { describe, expect, it } from 'vitest';

import { toPostgresPlaceholders } from './sql-placeholders';

describe('toPostgresPlaceholders', () => {
  it('leaves a query with no placeholders unchanged', () => {
    expect(toPostgresPlaceholders('SELECT 1')).toBe('SELECT 1');
  });

  it('rewrites a single placeholder', () => {
    expect(toPostgresPlaceholders('SELECT * FROM users WHERE id = ?')).toBe(
      'SELECT * FROM users WHERE id = $1',
    );
  });

  it('rewrites multiple placeholders in order', () => {
    expect(
      toPostgresPlaceholders('INSERT INTO pets (id, user_id, name) VALUES (?, ?, ?)'),
    ).toBe('INSERT INTO pets (id, user_id, name) VALUES ($1, $2, $3)');
  });

  it('handles a real upsert query shape (rate-limits repo)', () => {
    const sql = `INSERT INTO rate_limit_state (key, count, window_start, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start, locked_until = excluded.locked_until`;
    const translated = toPostgresPlaceholders(sql);
    expect(translated).toContain('VALUES ($1, $2, $3, $4)');
    expect(translated).not.toContain('?');
  });
});
