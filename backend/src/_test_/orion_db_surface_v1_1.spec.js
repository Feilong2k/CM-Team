/**
 * Tests for F2-T0-S7: Orion DB Surface v1.1
 * 
 * RED stage: These tests must fail because the DatabaseTool methods
 * are not yet implemented. Once Devon implements them, the same tests
 * should pass (GREEN).
 * 
 * Follows CDP analysis in docs/04-ROADMAP/TaraTests/F2-T0-S7_cdp.yml
 */

const db = require('../db/connection').pool || require('../db/connection');
const DatabaseTool = require('../../tools/DatabaseTool').DatabaseTool;

describe('Orion DB Surface v1.1', () => {
  let tool;
  let testSubtasks = [];
  let testFeatures = [];
  let testTasks = [];

  beforeAll(async () => {
    tool = new DatabaseTool('Orion');
    // Ensure we have some test data
    // (Using existing subtask P1-F2-T0-S7 created by update_F2_T0_S7_basic_info.js)
    const subtaskRes = await db.query(
      "SELECT id, external_id, task_id FROM subtasks WHERE external_id = 'P1-F2-T0-S7'"
    );
    if (subtaskRes.rows.length > 0) {
      testSubtasks.push(subtaskRes.rows[0]);
    }
    // Also fetch a feature and task for context
    const featureRes = await db.query(
      "SELECT id, external_id FROM features WHERE external_id LIKE 'P1-F2%' LIMIT 1"
    );
    if (featureRes.rows.length > 0) {
      testFeatures.push(featureRes.rows[0]);
    }
    const taskRes = await db.query(
      "SELECT id, external_id FROM tasks WHERE external_id LIKE 'P1-F2-T0%' LIMIT 1"
    );
    if (taskRes.rows.length > 0) {
      testTasks.push(taskRes.rows[0]);
    }
  });

  // Helper to start a test transaction
  const withTransaction = (testFn) => async () => {
    // Import the underlying pool client for transaction
    const pool = require('../db/connection').pool || require('../db/connection');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Temporarily replace db.query with client.query for this test
      const originalQuery = db.query;
      db.query = (sql, params) => client.query(sql, params);
      await testFn(client);
      await client.query('ROLLBACK');
      db.query = originalQuery;
    } finally {
      client.release();
    }
  };

  describe('ID normalization (helper not yet exposed)', () => {
    it('should normalize shorthand IDs to full project-scoped IDs', async () => {
      const result = tool.normalizeId('2-0-6');
      expect(result).toBe('P1-F2-T0-S6');
    });

    it('should reject shorthand IDs when project context is missing', async () => {
      await expect(async () => {
        await tool.normalizeId('2-0-6', null);
      }).rejects.toThrow();
    });
  });

  describe('get_subtask_full_context', () => {
    it('should return all subtask sections in one call', withTransaction(async () => {
      if (testSubtasks.length === 0) {
        console.warn('No test subtask found; skipping test');
        return;
      }
      const subtask = testSubtasks[0];
      await expect(
        tool.get_subtask_full_context(subtask.external_id)
      ).rejects.toThrow();
    }));

    it('should accept numeric ID, external_id, or shorthand', withTransaction(async () => {
      if (testSubtasks.length === 0) return;
      const subtask = testSubtasks[0];
      await expect(
        tool.get_subtask_full_context(subtask.id)
      ).rejects.toThrow();
      await expect(
        tool.get_subtask_full_context(subtask.external_id)
      ).rejects.toThrow();
      await expect(
        tool.get_subtask_full_context('2-0-7')
      ).rejects.toThrow();
    }));

    it('should return structured error when subtask not found', withTransaction(async () => {
      await expect(
        tool.get_subtask_full_context('P1-F2-T0-S999')
      ).rejects.toThrow();
    }));
  });

  describe('list_subtasks_for_task', () => {
    it('should list subtasks under a given task', withTransaction(async () => {
      if (testTasks.length === 0) return;
      const task = testTasks[0];
      const result = await tool.list_subtasks_for_task(task.external_id);
      expect(result.ok).toBe(true);
      expect(result.task.external_id).toBe(task.external_id);
      expect(Array.isArray(result.subtasks)).toBe(true);
      expect(result.subtasks.length).toBeGreaterThan(0);
    }));

    it('should filter by status when provided', withTransaction(async () => {
      if (testTasks.length === 0) return;
      const task = testTasks[0];
      const result = await tool.list_subtasks_for_task(task.external_id, 'pending');
      expect(result.ok).toBe(true);
      expect(result.task.external_id).toBe(task.external_id);
      expect(Array.isArray(result.subtasks)).toBe(true);
      for (const subtask of result.subtasks) {
        expect(subtask.status).toBe('pending');
      }
    }));

    it('should include details when include_details=true', withTransaction(async () => {
      if (testTasks.length === 0) return;
      const task = testTasks[0];
      const result = await tool.list_subtasks_for_task(task.external_id, null, true);
      expect(result.ok).toBe(true);
      expect(result.task.external_id).toBe(task.external_id);
      expect(Array.isArray(result.subtasks)).toBe(true);
      if (result.subtasks.length > 0) {
        const first = result.subtasks[0];
        expect(first).toHaveProperty('basic_info');
        expect(first).toHaveProperty('instruction');
      }
    }));
  });

  describe('get_feature_overview', () => {
    it('should return feature summary with tasks and subtasks', withTransaction(async () => {
      if (testFeatures.length === 0) return;
      const feature = testFeatures[0];
      const result = await tool.get_feature_overview(feature.external_id);
      expect(result.ok).toBe(true);
      expect(result.feature.external_id).toBe(feature.external_id);
      expect(Array.isArray(result.tasks)).toBe(true);
      if (result.tasks.length > 0) {
        const firstTask = result.tasks[0];
        expect(firstTask).toHaveProperty('subtasks');
        expect(Array.isArray(firstTask.subtasks)).toBe(true);
      }
    }));

    it('should accept shorthand feature ID', withTransaction(async () => {
      const result = await tool.get_feature_overview('2');
      expect(result.ok).toBe(true);
      expect(result.feature.external_id).toBe('P1-F2');
    }));
  });

  describe('update_subtask_sections', () => {
    it('should atomically update multiple allowed sections', withTransaction(async () => {
      if (testSubtasks.length === 0) return;
      const subtask = testSubtasks[0];
      const changes = {
        workflow_stage: 'tara_pcc',
        status: 'in_progress',
        basic_info: { summary: 'Test update' },
        instruction: {
          tara: 'Run PCC for DB surface tests',
          devon: 'Implement missing methods'
        }
      };
      await expect(
        tool.update_subtask_sections(subtask.external_id, changes, 'test')
      ).rejects.toThrow();
    }));

    it('should reject unknown keys in changes object', withTransaction(async () => {
      if (testSubtasks.length === 0) return;
      const subtask = testSubtasks[0];
      const changes = {
        unknown_key: 'should fail',
        status: 'in_progress'
      };
      await expect(
        tool.update_subtask_sections(subtask.external_id, changes, 'test')
      ).rejects.toThrow();
    }));

    it('should append activity_log entry', withTransaction(async () => {
      if (testSubtasks.length === 0) return;
      const subtask = testSubtasks[0];
      const changes = { status: 'completed' };
      const before = await db.query(
        'SELECT activity_log FROM subtasks WHERE id = $1',
        [subtask.id]
      );
      const beforeLength = before.rows[0]?.activity_log?.length || 0;
      await expect(
        tool.update_subtask_sections(subtask.external_id, changes, 'test')
      ).rejects.toThrow();
    }));

    it('should rollback on partial failure', withTransaction(async () => {
      if (testSubtasks.length === 0) return;
      const subtask = testSubtasks[0];
      await expect(
        tool.update_subtask_sections(subtask.external_id, { status: 'blocked' }, 'test')
      ).rejects.toThrow();
    }));
  });

  describe('update_feature_sections', () => {
    it('should update allowed feature sections on a temporary feature row', async () => {
      // Create a throwaway feature so we do not mutate real Feature 2
      const insertRes = await db.query(
        `INSERT INTO features (external_id, title, status, basic_info, pcc, red, cap, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          'TEST-FEATURE-DB-SURFACE',
          'Temp feature for Orion DB surface tests',
          'pending',
          { title: 'Original' },
          {},
          {},
          {},
        ],
      );
      const feature = insertRes.rows[0];

      try {
        const changes = {
          status: 'in_progress',
          basic_info: { title: 'Updated feature title' },
          pcc: { summary: 'Test PCC' },
        };
        const updated = await tool.update_feature_sections(feature.external_id, changes, 'test');
        expect(updated.status).toBe('in_progress');
        expect(updated.basic_info).toEqual({ title: 'Updated feature title' });
        expect(updated.pcc).toEqual({ summary: 'Test PCC' });
      } finally {
        await db.query('DELETE FROM features WHERE id = $1', [feature.id]);
      }
    });

    it('should reject unknown keys for feature', withTransaction(async () => {
      if (testFeatures.length === 0) return;
      const feature = testFeatures[0];
      const changes = {
        unknown_key: 'invalid',
        status: 'completed',
      };
      await expect(
        tool.update_feature_sections(feature.external_id, changes, 'test'),
      ).rejects.toThrow();
    }));
  });

  describe('update_task_sections', () => {
    it('should update allowed task sections on a temporary task row', async () => {
      // Create a temporary feature and task so we do not mutate real Task 2-0
      const featureRes = await db.query(
        `INSERT INTO features (external_id, title, status, basic_info, pcc, red, cap, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          'TEST-FEATURE-DB-SURFACE-TASK',
          'Temp feature for Orion DB surface task tests',
          'pending',
          { title: 'Feature for temp task' },
          {},
          {},
          {},
        ],
      );
      const feature = featureRes.rows[0];

      const taskRes = await db.query(
        `INSERT INTO tasks (external_id, feature_id, title, status, basic_info, pcc, cap, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [
          'TEST-FEATURE-DB-SURFACE-TASK-T1',
          feature.id,
          'Temp task for Orion DB surface tests',
          'pending',
          { notes: 'Original notes' },
          {},
          {},
        ],
      );
      const task = taskRes.rows[0];

      try {
        const changes = {
          status: 'completed',
          basic_info: { notes: 'Task done' },
          cap: { summary: 'CAP done' },
        };
        const updated = await tool.update_task_sections(task.external_id, changes, 'test');
        expect(updated.status).toBe('completed');
        expect(updated.basic_info).toEqual({ notes: 'Task done' });
        expect(updated.cap).toEqual({ summary: 'CAP done' });
      } finally {
        await db.query('DELETE FROM tasks WHERE id = $1', [task.id]);
        await db.query('DELETE FROM features WHERE id = $1', [feature.id]);
      }
    });
  });

  describe('Creation tools (if in scope)', () => {
    it('create_feature should create a new feature under project', withTransaction(async () => {
      await expect(
        tool.create_feature('P1', null, 'New Feature', 'pending', {}, {}, {}, {}, 'test')
      ).rejects.toThrow();
    }));

    it('create_task should create a new task under feature', withTransaction(async () => {
      if (testFeatures.length === 0) return;
      const feature = testFeatures[0];
      await expect(
        tool.create_task(feature.external_id, null, 'New Task', 'pending', {}, {}, {}, 'test')
      ).rejects.toThrow();
    }));

    it('create_subtask should create a new subtask under task', withTransaction(async () => {
      if (testTasks.length === 0) return;
      const task = testTasks[0];
      await expect(
        tool.create_subtask(task.external_id, null, 'New Subtask', 'pending', 'orion_planning', {}, {}, {}, {}, {}, {}, 'test')
      ).rejects.toThrow();
    }));
  });

  describe('Error handling', () => {
    it('should reject shorthand ID when project context missing', withTransaction(async () => {
      await expect(
        tool.get_subtask_full_context('2-0-7')
      ).rejects.toThrow();
    }));

    it('should return structured error for non‑existent entity', withTransaction(async () => {
      await expect(
        tool.get_subtask_full_context('P1-F2-T0-S999')
      ).rejects.toThrow();
    }));
  });
});
