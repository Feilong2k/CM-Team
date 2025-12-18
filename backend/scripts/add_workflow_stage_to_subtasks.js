// One-time migration: Add workflow_stage column to subtasks
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(50) DEFAULT 'planning';");
    console.log('✅ workflow_stage column added to subtasks');
  } catch (err) {
    console.error('❌ Failed to add workflow_stage:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}

main();
