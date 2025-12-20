/**
 * Tara's failing tests for Subtask F2-T0-S1 (Chat Messages Schema)
 *
 * These tests define the expected behavior of migration 004_chat_messages.sql
 * and the resulting `chat_messages` table.
 *
 * They should currently FAIL because:
 * - The migration file 004_chat_messages.sql does not exist or is incomplete
 * - The chat_messages table and its constraints are not fully implemented
 *
 * They must NOT pass if:
 * - The table is missing or has wrong columns / types
 * - The sender CHECK constraint is missing or too loose
 * - Timestamps do not behave as specified
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
// Load environment variables explicitly from backend/.env for test environment consistency
require('dotenv').config({ path: path.resolve(__dirname, '../../../backend/.env') });

describe('Chat Messages Schema - Subtask F2-T0-S1', () => {
  let client;
  const migrationFile = path.join(__dirname, '..', '..', '..', 'backend', 'migrations', '004_chat_messages.sql');

  // Remove duplicate declaration of 'path' variable

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  describe('Migration File Validation', () => {
    test('should have migration file 004_chat_messages.sql', () => {
      // RED: This will fail until Devon creates the migration file
      expect(fs.existsSync(migrationFile)).toBe(true);
    });

    test('migration file should contain non-trivial SQL content', () => {
      // RED: This will fail until the migration file has real SQL
      const content = fs.readFileSync(migrationFile, 'utf8');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(100); // Reasonable minimum length
      expect(content.toUpperCase()).toContain('CREATE TABLE');
      expect(content).toContain('chat_messages');
    });
  });

  describe('Table Structure Validation', () => {
    test('chat_messages table should exist', async () => {
      // RED: Fails while table does not exist
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'chat_messages'
        )
      `);

      expect(result.rows[0].exists).toBe(true);
    });

    test('chat_messages should have expected columns and types', async () => {
      // RED: Fails until table is created with the correct schema
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chat_messages'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.map(row => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
      }));

      // id SERIAL PRIMARY KEY
      expect(columns).toContainEqual({ name: 'id', type: 'integer', nullable: false });

      // external_id VARCHAR(255) UNIQUE (optional)
      // optional means nullable is allowed
      expect(columns).toContainEqual({ name: 'external_id', type: 'character varying', nullable: true });

      // sender VARCHAR(50) NOT NULL
      expect(columns).toContainEqual({ name: 'sender', type: 'character varying', nullable: false });

      // content TEXT NOT NULL
      expect(columns).toContainEqual({ name: 'content', type: 'text', nullable: false });

      // metadata JSONB (nullable allowed)
      expect(columns).toContainEqual({ name: 'metadata', type: 'jsonb', nullable: true });

      // created_at TIMESTAMPTZ DEFAULT NOW()
      expect(columns).toContainEqual({ name: 'created_at', type: 'timestamp with time zone', nullable: false });

      // updated_at TIMESTAMPTZ DEFAULT NOW() with auto-update trigger
      expect(columns).toContainEqual({ name: 'updated_at', type: 'timestamp with time zone', nullable: false });
    });
  });

  describe('Sender CHECK Constraint Validation', () => {
    test('sender should only allow user, orion, system', async () => {
      // RED: This should fail until a proper CHECK constraint is implemented
      // We test via behavior, not by parsing constraint text

      // Clean up any test data for a deterministic run
      await client.query('DELETE FROM chat_messages');

      const validSenders = ['user', 'orion', 'system'];

      for (const sender of validSenders) {
        const result = await client.query(
          `INSERT INTO chat_messages (sender, content) VALUES ($1, $2) RETURNING id`,
          [sender, `test message from ${sender}`]
        );
        expect(result.rows[0].id).toBeDefined();
      }

      // Invalid sender should be rejected
      await expect(
        client.query(
          `INSERT INTO chat_messages (sender, content) VALUES ($1, $2)`,
          ['admin', 'this should fail']
        )
      ).rejects.toThrow();
    });
  });

  describe('Timestamp Behavior Validation', () => {
    test('created_at and updated_at should be set on insert and updated_at should change on update', async () => {
      // RED: This will fail until default values and trigger/function are implemented

      // Clean up test data
      await client.query('DELETE FROM chat_messages');

      // Insert a message
      const insertResult = await client.query(
        `INSERT INTO chat_messages (sender, content, metadata)
         VALUES ($1, $2, $3)
         RETURNING id, created_at, updated_at`,
        ['user', 'timestamp test', { source: 'test' }]
      );

      const row = insertResult.rows[0];
      expect(row.id).toBeDefined();
      expect(row.created_at).toBeTruthy();
      expect(row.updated_at).toBeTruthy();

      // On insert, created_at and updated_at may be equal or very close
      // We assert that they are equal at the SQL level
      expect(row.created_at.getTime()).toBe(row.updated_at.getTime());

      // Wait a bit and then update the row
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateResult = await client.query(
        `UPDATE chat_messages
         SET metadata = $1
         WHERE id = $2
         RETURNING created_at, updated_at`,
        [{ source: 'test-updated' }, row.id]
      );

      const updatedRow = updateResult.rows[0];
      expect(updatedRow.created_at.getTime()).toBe(row.created_at.getTime());
      expect(updatedRow.updated_at.getTime()).toBeGreaterThan(row.updated_at.getTime());
    });
  });

  describe('Isolation & Cleanup Behavior', () => {
    test('deleting by external_id should not affect other conversations', async () => {
      // RED: This sets expectations for safe scoped deletes used in tests/cleanup

      // Clean state
      await client.query('DELETE FROM chat_messages');

      // Insert messages for two different external_ids
      await client.query(
        `INSERT INTO chat_messages (external_id, sender, content)
         VALUES
         ('conv-1', 'user', 'msg 1'),
         ('conv-1', 'orion', 'msg 2'),
         ('conv-2', 'user', 'msg 3')
         ON CONFLICT DO NOTHING`
      );

      // Delete only conv-1 messages
      await client.query(`DELETE FROM chat_messages WHERE external_id = 'conv-1'`);

      const result = await client.query(`SELECT external_id, COUNT(*) AS count FROM chat_messages GROUP BY external_id`);
      const rows = result.rows;

      // We expect only conv-2 to remain with exactly 1 row
      expect(rows).toHaveLength(1);
      expect(rows[0].external_id).toBe('conv-2');
      expect(Number(rows[0].count)).toBe(1);
    });
  });
});
