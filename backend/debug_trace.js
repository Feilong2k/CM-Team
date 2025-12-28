const { query } = require('./src/db/connection');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function debug() {
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL_TEST:', process.env.DATABASE_URL_TEST);
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  try {
    const res = await query("SELECT current_database(), current_user, version()");
    console.log('Current DB:', res.rows[0]);
    const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables.rows.map(r => r.table_name));
    const traceExists = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trace_events'");
    console.log('trace_events exists?', traceExists.rows.length > 0);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
debug();
