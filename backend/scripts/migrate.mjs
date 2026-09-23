// Applies backend/migrations/*.sql to the Postgres database at DATABASE_URL,
// in filename order, tracking what's already been applied in a
// schema_migrations table so re-running is a no-op. SQLite (local dev) never
// runs this - its schema is bootstrapped inline in db-sqlite.ts instead.
//
// Usage: DATABASE_URL=postgres://... node scripts/migrate.mjs
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), 'migrations');
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const client = new Client({
  connectionString,
  ssl: connectionString.includes('sslmode=disable') ? undefined : { rejectUnauthorized: true },
});

async function main() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, $2)', [
        file,
        new Date().toISOString(),
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  console.log('Migrations up to date.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
