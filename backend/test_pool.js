const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function test() {
  const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  console.log('Connection string:', JSON.stringify(connectionString));
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query('SELECT 1 as test');
    console.log('Query succeeded:', res.rows[0]);
    await pool.query('CREATE TABLE IF NOT EXISTS trace_events (id SERIAL PRIMARY KEY)');
    console.log('CREATE TABLE succeeded');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
test();
