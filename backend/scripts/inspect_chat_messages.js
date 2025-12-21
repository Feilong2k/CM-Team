// Inspect chat_messages using the SAME pool/config as the running backend
// so we hit the exact same DATABASE_URL (remote Postgres, not localhost defaults).

const { getPool } = require('../src/db/connection');

(async () => {
  const pool = getPool();
  try {
    const total = await pool.query('SELECT COUNT(*) AS count FROM chat_messages');
    console.log('TOTAL chat_messages:', total.rows[0].count);

    const byExternalId = await pool.query(`
      SELECT external_id, COUNT(*) AS c
      FROM chat_messages
      GROUP BY external_id
      ORDER BY c DESC, external_id
      LIMIT 20
    `);
    console.log('BY external_id:');
    console.log(JSON.stringify(byExternalId.rows, null, 2));

    const sample = await pool.query(`
      SELECT id, external_id, sender, LEFT(content, 80) AS snippet, created_at
      FROM chat_messages
      ORDER BY created_at DESC
      LIMIT 20
    `);
    console.log('SAMPLE rows:');
    console.log(JSON.stringify(sample.rows, null, 2));
  } catch (err) {
    console.error('Error inspecting chat_messages:', err);
  }
})();
