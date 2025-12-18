// One-time script: Clear features, tasks, and subtasks tables before re-import
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('TRUNCATE subtasks, tasks, features RESTART IDENTITY CASCADE;');
    console.log('✅ Cleared features, tasks, and subtasks tables');
  } catch (err) {
    console.error('❌ Failed to clear tables:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();
