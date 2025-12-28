const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function check() {
  const connectionString = process.env.DATABASE_URL_TEST;
  console.log('Connecting to:', connectionString);
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query("SELECT current_database(), current_user");
    console.log('Current DB:', res.rows[0]);
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables.rows.map(r => r.table_name));
    const traceExists = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trace_events'");
    console.log('trace_events exists?', traceExists.rows.length > 0);
    if (traceExists.rows.length === 0) {
      console.log('Creating table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS trace_events (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          project_id VARCHAR(255) NOT NULL,
          source VARCHAR(50) NOT NULL,
          type VARCHAR(50) NOT NULL,
          direction VARCHAR(20),
          tool_name VARCHAR(255),
          request_id VARCHAR(255),
          summary TEXT NOT NULL,
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          error JSONB,
          metadata JSONB,
          phase_index INTEGER,
          cycle_index INTEGER
        )
      `);
      console.log('Table created.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
check();
