// Rewrites SQLite-style '?' positional placeholders into Postgres-style
// '$1, $2, ...', in order. Lets every repository query be written once and
// run unchanged against either driver. None of the app's queries contain a
// literal '?' inside a string/column value, so a plain sequential replace is
// safe here.
export function toPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
