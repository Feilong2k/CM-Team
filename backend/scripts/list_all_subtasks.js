// Script to list all subtasks with external_id and title
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(
      "SELECT id, external_id, title FROM subtasks ORDER BY id"
    );
    if (res.rows.length === 0) {
      console.log('No subtasks found.');
    } else {
      for (const subtask of res.rows) {
        console.log(`Subtask: ${subtask.external_id} - ${subtask.title}`);
      }
    }
  } catch (err) {
    console.error('❌ Failed to list subtasks:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();
