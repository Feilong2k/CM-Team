/**
 * Integration Test for Orion Workflow Schema (Subtask 1-1-1)
 * 
 * Tests that verify:
 * 1. Migration runs successfully
 * 2. All 5 tables exist with correct structure
 * 3. Foreign key constraints are properly defined
 * 4. JSONB columns are correctly typed
 * 5. Recursive foreign key exists for subtasks
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

describe('Orion Workflow Schema - Subtask 1-1-1', () => {
  let client;
  const migrationFile = path.join(__dirname, '..', '..', 'migrations', '002_orion_workflow.sql');

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  describe('Migration File Validation', () => {
    test('should have migration file 002_orion_workflow.sql', () => {
      expect(fs.existsSync(migrationFile)).toBe(true);
    });

    test('migration file should contain SQL content', () => {
      const content = fs.readFileSync(migrationFile, 'utf8');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(100); // Reasonable minimum SQL length
    });
  });

  describe('Migration Execution', () => {
    test('should have successfully applied migrations', async () => {
      // Check that migrations have been applied by verifying table structure
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'features'
        )
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('Table Structure Validation', () => {
    const expectedTables = [
      'planning_docs',
      'features', 
      'tasks',
      'subtasks',
      'task_steps'
    ];

    test.each(expectedTables)('should have table %s', async (tableName) => {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      expect(result.rows[0].exists).toBe(true);
    });

    describe('planning_docs table', () => {
      test('should have correct columns', async () => {
        const result = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'planning_docs'
          ORDER BY ordinal_position
        `);

        const columns = result.rows.map(row => ({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES'
        }));

        expect(columns).toContainEqual({ name: 'id', type: 'integer', nullable: false });
        expect(columns).toContainEqual({ name: 'project_id', type: 'character varying', nullable: true });
        expect(columns).toContainEqual({ name: 'title', type: 'character varying', nullable: true });
        expect(columns).toContainEqual({ name: 'type', type: 'character varying', nullable: true });
        expect(columns).toContainEqual({ name: 'content_md', type: 'text', nullable: true });
        expect(columns).toContainEqual({ name: 'status', type: 'character varying', nullable: true });
      });
    });

    describe('features table', () => {
      test('should have correct JSONB columns (basic_info, activity_log, pcc, pvp_analysis, fap_analysis)', async () => {
        const result = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'features'
          AND column_name IN ('basic_info', 'activity_log', 'pcc', 'pvp_analysis', 'fap_analysis')
        `);

        const jsonbColumns = result.rows.filter(row => row.data_type === 'jsonb');
        expect(jsonbColumns).toHaveLength(5);
        
        // Verify specific columns exist
        const columnNames = jsonbColumns.map(col => col.column_name);
        expect(columnNames).toContain('basic_info');
        expect(columnNames).toContain('activity_log');
        expect(columnNames).toContain('pcc');
        expect(columnNames).toContain('pvp_analysis');
        expect(columnNames).toContain('fap_analysis');
      });
    });

    describe('tasks table', () => {
      test('should have correct JSONB columns (basic_info, activity_log, pcc, pvp_analysis)', async () => {
        const result = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'tasks'
          AND column_name IN ('basic_info', 'activity_log', 'pcc', 'pvp_analysis')
        `);

        const jsonbColumns = result.rows.filter(row => row.data_type === 'jsonb');
        expect(jsonbColumns).toHaveLength(4);
        
        // Verify specific columns exist
        const columnNames = jsonbColumns.map(col => col.column_name);
        expect(columnNames).toContain('basic_info');
        expect(columnNames).toContain('activity_log');
        expect(columnNames).toContain('pcc');
        expect(columnNames).toContain('pvp_analysis');
      });

      test('should have foreign key to features', async () => {
        const result = await client.query(`
          SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'tasks'
          AND kcu.column_name = 'feature_id'
        `);

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].foreign_table_name).toBe('features');
      });
    });

    describe('subtasks table', () => {
      test('should have correct JSONB columns (basic_info, instruction, pcc, activity_log, tests, implementations, review)', async () => {
        const result = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = 'subtasks'
          AND column_name IN ('basic_info', 'instruction', 'pcc', 'activity_log', 'tests', 'implementations', 'review')
        `);

        const jsonbColumns = result.rows.filter(row => row.data_type === 'jsonb');
        expect(jsonbColumns).toHaveLength(7);
        
        // Verify specific columns exist
        const columnNames = jsonbColumns.map(col => col.column_name);
        expect(columnNames).toContain('basic_info');
        expect(columnNames).toContain('instruction');
        expect(columnNames).toContain('pcc');
        expect(columnNames).toContain('activity_log');
        expect(columnNames).toContain('tests');
        expect(columnNames).toContain('implementations');
        expect(columnNames).toContain('review');
      });

      test('should have recursive foreign key parent_id', async () => {
        const result = await client.query(`
          SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'subtasks'
          AND kcu.column_name = 'parent_id'
        `);

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].foreign_table_name).toBe('subtasks');
      });
    });

    describe('ON DELETE CASCADE validation', () => {
      test('foreign keys should have ON DELETE CASCADE', async () => {
        // Check a sample foreign key constraint
        const result = await client.query(`
          SELECT conname, pg_get_constraintdef(oid) as constraint_def
          FROM pg_constraint
          WHERE contype = 'f'
          AND conrelid::regclass::text IN ('tasks', 'subtasks', 'task_steps')
          AND pg_get_constraintdef(oid) LIKE '%ON DELETE CASCADE%'
        `);

        // Should have at least 4 FK constraints with CASCADE (tasks.feature_id, subtasks.task_id, subtasks.parent_id, task_steps.subtask_id)
        expect(result.rows.length).toBeGreaterThanOrEqual(4);
      });
    });
  });
});
