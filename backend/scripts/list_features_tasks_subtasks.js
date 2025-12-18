// List all features, tasks, and subtasks with relationships for debugging
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const features = (await pool.query('SELECT * FROM features ORDER BY id')).rows;
    const tasks = (await pool.query('SELECT * FROM tasks ORDER BY id')).rows;
    const subtasks = (await pool.query('SELECT * FROM subtasks ORDER BY id')).rows;

    console.log('--- FEATURES ---');
    for (const f of features) {
      console.log(`Feature ID: ${f.id}, Title: ${f.title}, external_id: ${f.external_id}`);
      const fTasks = tasks.filter(t => t.feature_id === f.id);
      for (const t of fTasks) {
        console.log(`  Task ID: ${t.id}, Title: ${t.title}, external_id: ${t.external_id}`);
        const tSubtasks = subtasks.filter(s => s.task_id === t.id);
        for (const s of tSubtasks) {
          console.log(`    Subtask ID: ${s.id}, Title: ${s.title}, external_id: ${s.external_id}`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Failed to list features/tasks/subtasks:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();
