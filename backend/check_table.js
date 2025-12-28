const { query } = require('./src/db/connection');
async function check() {
  try {
    const res = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trace_events'");
    console.log('Tables:', res.rows);
    if (res.rows.length === 0) {
      console.log('Table does not exist, creating...');
      await query(`
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
    } else {
      console.log('Table exists.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}
check();
