// Minimal async query interface shared by both drivers (SQLite for local
// dev, Postgres for production). Repositories are written once against this
// interface and never talk to better-sqlite3 or pg directly. All queries use
// '?' positional placeholders (SQLite style); the Postgres driver rewrites
// them to '$1, $2, ...' internally - see sql-placeholders.ts.
export interface Db {
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
}
