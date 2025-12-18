// Script to check activity_log for a subtask by external_id
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(
      "SELECT id, external_id, title, activity_log FROM subtasks WHERE external_id = $1",
      ['P1-F1-T3-S2']
    );
    if (res.rows.length === 0) {
      console.log('No subtask found with external_id P1-F1-T3-S2');
    } else {
      const subtask = res.rows[0];
      console.log(`Subtask: ${subtask.external_id} - ${subtask.title}`);
      console.log('activity_log:', JSON.stringify(subtask.activity_log, null, 2));
    }
  } catch (err) {
    console.error('❌ Failed to fetch subtask activity_log:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();
