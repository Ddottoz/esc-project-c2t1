import bcrypt from 'bcrypt';
import { pool } from './db.js';

const TEST_USERS = [
  { name: 'Test Educator', email: 'educator@das.org', password: 'Password123!', role: 'educator' },
  { name: 'DAS Admin', email: 'admin@das.org', password: 'Admin123!', role: 'admin' },
];

async function seed() {
  for (const u of TEST_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role)`,
      [u.name, u.email.toLowerCase(), hash, u.role]
    );
    console.log(`seeded ${u.email} (password: ${u.password})`);
  }
  await pool.end();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
