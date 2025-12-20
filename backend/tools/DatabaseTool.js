const db = require('../src/db/connection.js');
const fs = require('fs');
const path = require('path');
const { ActivityLogTool } = require('./ActivityLogTool');

class DatabaseTool {
  constructor(role) {
    if (!role) {
      throw new Error('DatabaseTool requires a role');
    }
    this.role = role;

    this.BLOCKED_PATTERNS = [
      /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)/i,
      /\bTRUNCATE\b/i,
      /\bDELETE\s+FROM\s+\w+\s*$/i,
      /\bDELETE\s+FROM\s+\w+\s*;/i,
      /\bALTER\s+TABLE\s+\w+\s+DROP/i,
    ];

    this.TDD_TEAM_TABLES = [
      'subtasks',
      'subtask_state',
      'subtask_logs',
      'projects',
      'tasks',
      'features',
    ];

    this.PROTECTED_TABLES = [
      ...this.TDD_TEAM_TABLES,
      '_migrations',
      'agents',
      'tools',
    ];

    // Unified activity logger for features/tasks/subtasks (relational table, not JSONB)
    this.activityLogTool = new ActivityLogTool('Orion');

    // Add chatMessages support
    this.chatMessages = {
      getMessages: async (projectId, limit = 20) => {
        const result = await db.query(
          `SELECT external_id, sender, content, metadata, created_at
           FROM chat_messages
           WHERE external_id LIKE $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [`${projectId}%`, limit]
        );
        return result.rows.reverse(); // Return in ascending order
      },
      addMessage: async (externalId, sender, content, metadata = {}) => {
        const result = await db.query(
          `INSERT INTO chat_messages (external_id, sender, content, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING *`,
          [externalId, sender, content, metadata]
        );
        return result.rows[0];
      }
    };
  }

  async update_subtask_sections(subtask_id, changes, reason = '') {
    this._checkRole();

    // Validate changes keys
    const allowedKeys = new Set([
      'workflow_stage',
      'status',
      'basic_info',
      'instruction',
      'pcc',
      'tests',
      'implementation',
      'review',
    ]);
    for (const key of Object.keys(changes)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Invalid change key: ${key}`);
      }
    }

    // Normalize shorthand if string
    let normalizedId = subtask_id;
    if (typeof subtask_id === 'string' && !subtask_id.startsWith('P')) {
      normalizedId = this.normalizeId(subtask_id);
    }

    // Resolve subtask by id or external_id
    const subtask = await this._findSubtaskByIdOrExternal(normalizedId);
    const internalId = subtask.id;

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');

      // Build update query dynamically
      const setClauses = [];
      const values = [];
      let idx = 1;
      for (const [key, value] of Object.entries(changes)) {
        const column = key === 'implementation' ? 'implementations' : key;
        setClauses.push(`${column} = $${idx}`);
        values.push(value);
        idx += 1;
      }
      setClauses.push('updated_at = NOW()');

      const updateQuery = `UPDATE subtasks SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
      values.push(internalId);

      const updateResult = await client.query(updateQuery, values);
      if (updateResult.rows.length === 0) {
        throw new Error(`Subtask with ID ${normalizedId} not found`);
      }

      // Add activity log entry to the new subtask_activity_logs table
      try {
        const newLogEntry = {
          type: 'bulk_update',
          agent: 'Orion',
          content: reason || 'Updated subtask sections',
          status: 'open',
          metadata: {},
        };

        await client.query(
          `INSERT INTO subtask_activity_logs (subtask_id, type, agent, content, status, metadata, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            internalId,
            newLogEntry.type,
            newLogEntry.agent,
            newLogEntry.content,
            newLogEntry.status,
            newLogEntry.metadata
          ]
        );
      } catch (logError) {
        // Don't fail the whole transaction if activity log fails
      }

      await client.query('COMMIT');

      // Also log to unified activity log table (subtasks)
      try {
        await this._addToActivityLog('subtask', internalId, 'bulk_update', reason || 'Updated subtask sections');
      } catch (logError) {
        // Do not fail main operation if logging fails
        console.error('DatabaseTool: failed to append unified activity log for subtask:', logError.message);
      }

      return updateResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update_feature_sections(feature_id, changes, reason = '') {
    this._checkRole();

    const allowedKeys = new Set([
      'status',
      'basic_info',
      'pcc',
      'pvp_analysis',
      'fap_analysis',
      'activity_log',
    ]);

    for (const key of Object.keys(changes)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Invalid change key for feature: ${key}`);
      }
    }

    // Resolve feature by id or external_id (accept shorthand like '2')
    const feature = await this._findFeatureByIdOrExternal(feature_id);
    const internalId = feature.id;

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');

      const setClauses = [];
      const values = [];
      let idx = 1;
      for (const [key, value] of Object.entries(changes)) {
        setClauses.push(`${key} = $${idx}`);
        values.push(value);
        idx += 1;
      }
      setClauses.push('updated_at = NOW()');

      const updateQuery = `UPDATE features SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
      values.push(internalId);

      const updateResult = await client.query(updateQuery, values);
      if (updateResult.rows.length === 0) {
        throw new Error(`Feature with ID ${feature_id} not found`);
      }

      await client.query('COMMIT');

      // Unified activity log for feature
      await this._addToActivityLog('feature', internalId, 'bulk_update', reason || 'Updated feature sections');

      return updateResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update_task_sections(task_id, changes, reason = '') {
    this._checkRole();

    const allowedKeys = new Set([
      'status',
      'basic_info',
      'pcc',
      'pvp_analysis',
      'activity_log',
    ]);

    for (const key of Object.keys(changes)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Invalid change key for task: ${key}`);
      }
    }

    const task = await this._findTaskByIdOrExternal(task_id);
    const internalId = task.id;

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');

      const setClauses = [];
      const values = [];
      let idx = 1;
      for (const [key, value] of Object.entries(changes)) {
        setClauses.push(`${key} = $${idx}`);
        values.push(value);
        idx += 1;
      }
      setClauses.push('updated_at = NOW()');

      const updateQuery = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
      values.push(internalId);

      const updateResult = await client.query(updateQuery, values);
      if (updateResult.rows.length === 0) {
        throw new Error(`Task with ID ${task_id} not found`);
      }

      await client.query('COMMIT');

      // Unified activity log for task
      await this._addToActivityLog('task', internalId, 'bulk_update', reason || 'Updated task sections');

      return updateResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async get_subtask_full_context(subtask_id, projectId = 'P1') {
    this._checkRole();
    const subtask = await this._findSubtaskByIdOrExternal(subtask_id, projectId);

    // Return all core workflow sections for the subtask in one object
    return {
      ok: true,
      subtask: {
        id: subtask.id,
        external_id: subtask.external_id,
        task_id: subtask.task_id,
        title: subtask.title,
        status: subtask.status,
        parent_id: subtask.parent_id,
        workflow_stage: subtask.workflow_stage,
        basic_info: subtask.basic_info,
        instruction: subtask.instruction,
        pcc: subtask.pcc,
        activity_log: subtask.activity_log,
        tests: subtask.tests,
        implementations: subtask.implementations,
        review: subtask.review,
        created_at: subtask.created_at,
        updated_at: subtask.updated_at,
      },
    };
  }

  async list_subtasks_for_task(task_id, status = null, include_details = false, projectId = 'P1') {
    this._checkRole();

    const task = await this._findTaskByIdOrExternal(task_id, projectId);

    const params = [task.id];
    let sql = 'SELECT * FROM subtasks WHERE task_id = $1';
    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }
    sql += ' ORDER BY id ASC';

    const res = await db.query(sql, params);
    let subtasks = res.rows;

    if (!include_details) {
      // Trim to summary view
      subtasks = subtasks.map(st => ({
        id: st.id,
        external_id: st.external_id,
        title: st.title,
        status: st.status,
      }));
    }

    return {
      ok: true,
      task: {
        id: task.id,
        external_id: task.external_id,
        title: task.title,
        status: task.status,
      },
      subtasks,
    };
  }

  async get_feature_overview(feature_id, projectId = 'P1') {
    this._checkRole();

    const feature = await this._findFeatureByIdOrExternal(feature_id, projectId);

    // Fetch tasks for this feature
    const taskRes = await db.query(
      'SELECT * FROM tasks WHERE feature_id = $1 ORDER BY id ASC',
      [feature.id]
    );

    const tasks = [];
    for (const task of taskRes.rows) {
      const subtasksRes = await db.query(
        'SELECT id, external_id, title, status FROM subtasks WHERE task_id = $1 ORDER BY id ASC',
        [task.id]
      );

      tasks.push({
        id: task.id,
        external_id: task.external_id,
        title: task.title,
        status: task.status,
        subtasks: subtasksRes.rows,
      });
    }

    return {
      ok: true,
      feature: {
        id: feature.id,
        external_id: feature.external_id,
        title: feature.title,
        status: feature.status,
        basic_info: feature.basic_info,
      },
      tasks,
    };
  }

  async list_subtasks_by_status(status, limit = 50, projectId = 'P1') {
    this._checkRole();

    if (!status) {
      throw new Error('status is required');
    }

    const res = await db.query(
      `SELECT s.*
       FROM subtasks s
       JOIN tasks t ON s.task_id = t.id
       JOIN features f ON t.feature_id = f.id
       WHERE s.status = $1 AND f.project_id = $2
       ORDER BY s.id ASC
       LIMIT $3`,
      [status, projectId, limit]
    );

    return {
      ok: true,
      status,
      count: res.rowCount,
      subtasks: res.rows.map(st => ({
        id: st.id,
        external_id: st.external_id,
        task_id: st.task_id,
        title: st.title,
        status: st.status,
      })),
    };
  }

  async search_subtasks_by_keyword(keyword, limit = 20, projectId = 'P1') {
    this._checkRole();

    if (!keyword || typeof keyword !== 'string') {
      throw new Error('keyword is required');
    }

    const like = `%${keyword}%`;

    const res = await db.query(
      `SELECT s.*
       FROM subtasks s
       JOIN tasks t ON s.task_id = t.id
       JOIN features f ON t.feature_id = f.id
       WHERE f.project_id = $1
         AND (
           s.title ILIKE $2
           OR CAST(s.basic_info AS TEXT) ILIKE $2
         )
       ORDER BY s.id ASC
       LIMIT $3`,
      [projectId, like, limit]
    );

    return {
      ok: true,
      keyword,
      count: res.rowCount,
      subtasks: res.rows.map(st => ({
        id: st.id,
        external_id: st.external_id,
        task_id: st.task_id,
        title: st.title,
        status: st.status,
      })),
    };
  }

  /**
   * Create a new feature under a project.
   * If external_id is not provided, auto-generate the next P{n}-F{n} id.
   */
  async create_feature(projectId, external_id = null, title, status = 'pending', basic_info = {}, pcc = {}, cap = {}, red = {}, reason = '') {
    this._checkRole();

    const project = projectId || 'P1';

    let externalId = external_id;
    if (!externalId) {
      // Determine next feature number for this project
      const res = await db.query(
        'SELECT external_id FROM features WHERE external_id LIKE $1',
        [`${project}-F%`]
      );
      let maxNum = 0;
      for (const row of res.rows) {
        const m = row.external_id && row.external_id.match(/F(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
        }
      }
      externalId = `${project}-F${maxNum + 1}`;
    }

    const insertRes = await db.query(
      `INSERT INTO features (project_id, external_id, title, status, basic_info, pcc, pvp_analysis, fap_analysis, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [project, externalId, title, status, basic_info, pcc, cap, red]
    );

    const feature = insertRes.rows[0];

    await this._addToActivityLog('feature', feature.id, 'creation', reason || 'Created feature');

    return feature;
  }

  /**
   * Create a new task under a feature.
   * If external_id is not provided, auto-generate next P1-Fx-Ty id.
   */
  async create_task(feature_id, external_id = null, title, status = 'pending', basic_info = {}, pcc = {}, cap = {}, reason = '') {
    this._checkRole();

    const feature = await this._findFeatureByIdOrExternal(feature_id);

    let externalId = external_id;
    if (!externalId) {
      const prefix = feature.external_id;
      const res = await db.query(
        'SELECT external_id FROM tasks WHERE external_id LIKE $1',
        [`${prefix}-T%`]
      );
      let maxNum = 0;
      for (const row of res.rows) {
        const m = row.external_id && row.external_id.match(/T(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
        }
      }
      externalId = `${prefix}-T${maxNum + 1}`;
    }

    const insertRes = await db.query(
      `INSERT INTO tasks (feature_id, external_id, title, status, basic_info, pcc, pvp_analysis, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [feature.id, externalId, title, status, basic_info, pcc, cap]
    );

    const task = insertRes.rows[0];

    await this._addToActivityLog('task', task.id, 'creation', reason || 'Created task');

    return task;
  }

  /**
   * Create a new subtask under a task.
   * If external_id is not provided, auto-generate next Px-Fy-Tz-Sn id.
   */
  async create_subtask(
    task_id,
    external_id = null,
    title,
    status = 'pending',
    workflow_stage = 'orion_planning',
    basic_info = {},
    instruction = {},
    pcc = {},
    tests = {},
    implementation = {},
    review = {},
    reason = ''
  ) {
    this._checkRole();

    const task = await this._findTaskByIdOrExternal(task_id);

    let externalId = external_id;
    if (!externalId) {
      const prefix = task.external_id;
      const res = await db.query(
        'SELECT external_id FROM subtasks WHERE external_id LIKE $1',
        [`${prefix}-S%`]
      );
      let maxNum = 0;
      for (const row of res.rows) {
        const m = row.external_id && row.external_id.match(/S(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
        }
      }
      externalId = `${prefix}-S${maxNum + 1}`;
    }

    const insertRes = await db.query(
      `INSERT INTO subtasks (
         task_id, external_id, title, status, workflow_stage,
         parent_id, basic_info, instruction, pcc, activity_log,
         tests, implementations, review, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5,
               NULL, $6, $7, $8, $9,
               $10, $11, $12, NOW(), NOW())
       RETURNING *`,
      [
        task.id,
        externalId,
        title,
        status,
        workflow_stage,
        basic_info,
        instruction,
        pcc,
        [], // activity_log defaults to empty array
        tests,
        implementation,
        review,
      ]
    );

    const subtask = insertRes.rows[0];

    // Subtask-specific log table
    try {
      await db.query(
        `INSERT INTO subtask_activity_logs (subtask_id, type, agent, content, status, metadata, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [subtask.id, 'creation', 'Orion', reason || 'Created new subtask', 'open', {}]
      );
    } catch (e) {
      // best-effort only
    }

    // Unified activity log
    await this._addToActivityLog('subtask', subtask.id, 'creation', reason || 'Created new subtask');

    return subtask;
  }

  _checkRole() {
    if (this.role !== 'Orion') {
      throw new Error('DatabaseTool is only accessible to Orion');
    }
  }

  /**
   * Normalize shorthand IDs to full project-scoped external IDs.
   *
   * Supported forms (assuming projectId = 'P1'):
   * - "P1-F2-T1-S3"  -> returns as-is
   * - "F2"           -> "P1-F2"
   * - "F2-T1"        -> "P1-F2-T1"
   * - "F2-T1-S3"     -> "P1-F2-T1-S3"
   * - "2"            -> "P1-F2"
   * - "2-1"          -> "P1-F2-T1"
   * - "2-1-3"        -> "P1-F2-T1-S3"
   *
   * If projectId is null/undefined and a shorthand is used, an error is thrown.
   * This matches the expectations in orion_db_surface_v1_1.spec.js.
   *
   * @param {string} rawId - Shorthand or full ID
   * @param {string} [projectId='P1'] - Project external ID prefix (e.g. 'P1')
   * @returns {string} Normalized external ID
   */
  normalizeId(rawId, projectId = 'P1') {
    if (!rawId || typeof rawId !== 'string') {
      throw new Error('normalizeId: rawId must be a non-empty string');
    }

    const trimmed = rawId.trim();

    // Already a full project-scoped ID
    if (/^P\d+-F\d+(-T\d+(-S\d+)?)?$/i.test(trimmed)) {
      return trimmed;
    }

    // If this looks like a shorthand but we have no project context, bail out
    if (!projectId) {
      throw new Error('normalizeId: MISSING_PROJECT_CONTEXT');
    }

    const project = projectId.trim(); // e.g. 'P1'

    // Forms starting with F... (e.g. 'F2', 'F2-T1', 'F2-T1-S3')
    if (/^F\d+(-T\d+(-S\d+)?)?$/i.test(trimmed)) {
      // Simply prefix the project ID
      return `${project}-${trimmed.toUpperCase()}`;
    }

    // Pure numeric shorthand: '2', '2-1', '2-1-3'
    if (/^\d+(-\d+){0,2}$/.test(trimmed)) {
      const parts = trimmed.split('-');
      const [featureNum, taskNum, subtaskNum] = parts;
      let result = `${project}-F${featureNum}`;
      if (typeof taskNum !== 'undefined') {
        result += `-T${taskNum}`;
      }
      if (typeof subtaskNum !== 'undefined') {
        result += `-S${subtaskNum}`;
      }
      return result;
    }

    // Mixed shorthand starting with feature but missing project prefix, e.g. 'F2-T1-S3'
    // (covered by the F... regex above), so any other pattern is unsupported for now.
    throw new Error(`normalizeId: Unsupported ID format "${rawId}"`);
  }

  _checkSafety(sql) {
    if (!sql || typeof sql !== 'string') {
      throw new Error('SQL must be a non-empty string');
    }
    const trimmed = sql.trim();

    // Basic guard: only allow SELECT for generic queries when starting with SELECT
    // (More specific rules can be added later.)
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new Error('Blocked: Dangerous SQL pattern detected');
      }
    }
  }

  /**
   * Execute a generic SQL query with safety checks.
   * Blocks dangerous operations like DROP, TRUNCATE, DELETE without WHERE.
   * @param {string} sql - SQL query to execute
   * @param {Array} params - Query parameters (optional)
   * @returns {Promise<Object>} Query result { rows, rowCount, command }
   */
  async query(sql, params = []) {
    this._checkRole();
    this._checkSafety(sql);

    try {
      const result = await db.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command,
      };
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Find a subtask by internal numeric id or external_id (full or shorthand).
   * Uses normalizeId for shorthand like '2-0-6'.
   * @param {string|number} idOrExternal
   * @param {string} [projectId='P1']
   * @returns {Promise<Object>} Subtask row
   */
  async _findSubtaskByIdOrExternal(idOrExternal, projectId = 'P1') {
    let subtask;

    // Numeric id
    if (typeof idOrExternal === 'number') {
      const res = await db.query('SELECT * FROM subtasks WHERE id = $1', [idOrExternal]);
      subtask = res.rows[0];
    } else if (typeof idOrExternal === 'string') {
      let externalId = idOrExternal;
      if (!externalId.startsWith('P')) {
        externalId = this.normalizeId(externalId, projectId);
      }
      const res = await db.query(
        'SELECT * FROM subtasks WHERE external_id = $1',
        [externalId]
      );
      subtask = res.rows[0];
    }

    if (!subtask) {
      throw new Error(`Subtask with ID ${idOrExternal} not found`);
    }

    return subtask;
  }

  /**
   * Resolve a feature by numeric id or external_id/shorthand.
   * Accepts forms like: 2, '2', 'F2', 'P1-F2'.
   */
  async _findFeatureByIdOrExternal(idOrExternal, projectId = 'P1') {
    let feature;

    if (typeof idOrExternal === 'number') {
      const res = await db.query('SELECT * FROM features WHERE id = $1', [idOrExternal]);
      feature = res.rows[0];
    } else if (typeof idOrExternal === 'string') {
      let externalId = idOrExternal.trim();
      if (!externalId.startsWith('P')) {
        // Normalize, then keep only project + feature portion (drop -T/-S if present)
        externalId = this.normalizeId(externalId, projectId);
      }
      // Strip task/subtask suffixes if present
      externalId = externalId.replace(/-T\d+(-S\d+)?$/i, '');

      const res = await db.query(
        'SELECT * FROM features WHERE external_id = $1',
        [externalId]
      );
      feature = res.rows[0];
    }

    if (!feature) {
      throw new Error(`Feature with ID ${idOrExternal} not found`);
    }

    return feature;
  }

  /**
   * Resolve a task by numeric id or external_id/shorthand.
   * Accepts forms like: '2-0', 'F2-T0', 'P1-F2-T0'.
   */
  async _findTaskByIdOrExternal(idOrExternal, projectId = 'P1') {
    let task;

    if (typeof idOrExternal === 'number') {
      const res = await db.query('SELECT * FROM tasks WHERE id = $1', [idOrExternal]);
      task = res.rows[0];
    } else if (typeof idOrExternal === 'string') {
      let externalId = idOrExternal.trim();
      if (!externalId.startsWith('P')) {
        // Normalize, then drop any -S segment (subtasks) to get the task ID
        externalId = this.normalizeId(externalId, projectId);
      }
      // Strip subtask suffix if present
      externalId = externalId.replace(/-S\d+$/i, '');

      const res = await db.query(
        'SELECT * FROM tasks WHERE external_id = $1',
        [externalId]
      );
      task = res.rows[0];
    }

    if (!task) {
      throw new Error(`Task with ID ${idOrExternal} not found`);
    }

    return task;
  }

  /**
   * Append an entry to the unified activity log table for any entity.
   * This is the single helper all write tools should use so that
   * features, tasks, and subtasks share a consistent audit trail.
   *
   * @param {('feature'|'task'|'subtask')} entityType
   * @param {number} entityId - Internal numeric ID
   * @param {string} type - Activity type (e.g. 'bulk_update', 'creation')
   * @param {string} content - Human-readable description
   * @param {Object} [metadata={}] - Optional structured metadata
   */
  async _addToActivityLog(entityType, entityId, type, content, metadata = {}) {
    try {
      await this.activityLogTool.logActivity(entityType, entityId, type, content, {
        agent: this.role,
        status: 'open',
        metadata,
      });
    } catch (error) {
      // Never throw from logging helper; surface as console error only.
      console.error(
        `DatabaseTool: failed to log activity for ${entityType} ${entityId}:`,
        error.message
      );
    }
  }
}

const defaultInstance = new DatabaseTool('Orion');

module.exports = defaultInstance;
module.exports.DatabaseTool = DatabaseTool;
