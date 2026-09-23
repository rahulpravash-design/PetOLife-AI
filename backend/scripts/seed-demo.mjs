// Seeds a demo account: demo@petolife.app / demo12345, with Bruno the
// Golden Retriever and ~18 health records + 2 reminders spanning several
// months, for code-a-thon demo purposes.
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'data', 'petolife.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    name TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, species TEXT NOT NULL, breed TEXT, birth_date TEXT, photo_url TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS health_records (
    id TEXT PRIMARY KEY, pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type TEXT NOT NULL, date TEXT NOT NULL, title TEXT NOT NULL, notes TEXT,
    value REAL, unit TEXT, attachment_url TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY, pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    title TEXT NOT NULL, due_date TEXT NOT NULL, notes TEXT, is_done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

const DEMO_EMAIL = 'demo@petolife.app';
const DEMO_PASSWORD = 'demo12345';
const now = new Date().toISOString();

let user = db.prepare('SELECT * FROM users WHERE email = ?').get(DEMO_EMAIL);
if (!user) {
  const userId = randomUUID();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, DEMO_EMAIL, bcrypt.hashSync(DEMO_PASSWORD, 10), 'Demo Owner', now);
  user = { id: userId };
  console.log(`Created demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
} else {
  console.log(`Demo user ${DEMO_EMAIL} already exists, reusing`);
}

let pet = db.prepare('SELECT * FROM pets WHERE user_id = ? AND name = ?').get(user.id, 'Bruno');
if (!pet) {
  const petId = randomUUID();
  db.prepare(
    `INSERT INTO pets (id, user_id, name, species, breed, birth_date, created_at)
     VALUES (?, ?, 'Bruno', 'dog', 'Golden Retriever', '2021-04-12T00:00:00.000Z', ?)`,
  ).run(petId, user.id, now);
  pet = { id: petId };
  console.log('Created pet Bruno');
} else {
  console.log('Pet Bruno already exists, reusing');
}

const existingRecords = db
  .prepare('SELECT COUNT(*) as c FROM health_records WHERE pet_id = ?')
  .get(pet.id).c;

if (existingRecords > 0) {
  console.log(`Pet already has ${existingRecords} records, skipping record seed`);
} else {
  const insertRecord = db.prepare(
    `INSERT INTO health_records (id, pet_id, type, date, title, notes, value, unit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const records = [
    ['weight', '2026-03-01', 'Monthly weigh-in', null, 26.5, 'kg'],
    ['vaccination', '2026-03-05', 'Rabies booster', 'Annual booster, no reaction', null, null],
    ['weight', '2026-04-01', 'Monthly weigh-in', null, 27.1, 'kg'],
    ['vet_visit', '2026-04-10', 'Annual checkup', 'Overall healthy, teeth cleaning recommended', null, null],
    ['weight', '2026-05-01', 'Monthly weigh-in', null, 27.4, 'kg'],
    ['symptom', '2026-05-14', 'Limping', 'Slight limp on left hind leg after a long walk', null, null],
    ['symptom', '2026-05-18', 'Limping', 'Still limping intermittently', null, null],
    ['medication', '2026-05-18', 'Carprofen', 'Vet-prescribed anti-inflammatory, 5 day course', 75, 'mg'],
    ['weight', '2026-06-01', 'Monthly weigh-in', null, 27.6, 'kg'],
    ['vet_visit', '2026-06-02', 'Follow-up for limping', 'Mild soft tissue strain, resolved', null, null],
    ['lab_result', '2026-06-02', 'Bloodwork panel', 'All values within normal range', null, null],
    ['weight', '2026-07-01', 'Monthly weigh-in', null, 28.2, 'kg'],
    ['note', '2026-07-10', 'New food brand', 'Switched to a higher-protein kibble', null, null],
    ['weight', '2026-08-01', 'Monthly weigh-in', null, 29.6, 'kg'],
    ['vet_visit', '2026-08-15', 'Annual checkup', 'All good, slight weight gain noted since food switch', null, null],
    ['vaccination', '2026-08-20', 'Bordetella booster', 'Ahead of boarding stay', null, null],
    ['weight', '2026-09-01', 'Monthly weigh-in', null, 31.0, 'kg'],
    ['symptom', '2026-09-10', 'Reduced appetite', 'Ate less than usual for two days, resolved on its own', null, null],
  ];

  for (const [type, date, title, notes, value, unit] of records) {
    insertRecord.run(
      randomUUID(),
      pet.id,
      type,
      new Date(date).toISOString(),
      title,
      notes,
      value,
      unit,
      now,
    );
  }
  console.log(`Inserted ${records.length} health records for Bruno`);

  const insertReminder = db.prepare(
    'INSERT INTO reminders (id, pet_id, title, due_date, is_done, created_at) VALUES (?, ?, ?, ?, 0, ?)',
  );
  insertReminder.run(randomUUID(), pet.id, 'Flea/tick prevention', new Date('2026-10-01').toISOString(), now);
  insertReminder.run(randomUUID(), pet.id, 'Dental cleaning follow-up', new Date('2026-10-15').toISOString(), now);
  console.log('Inserted 2 reminders for Bruno');
}

console.log('\nDemo login: demo@petolife.app / demo12345');
db.close();
