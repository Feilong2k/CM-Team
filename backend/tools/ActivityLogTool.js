const baseDb = require('../src/db/connection.js');
const db = baseDb.pool || baseDb;

/**
 * Unified Activity Log Tool
 * 
 * Provides consistent activity logging for all entities:
 * - Features
 * - Tasks  
 * - Subtasks
 * 
 * Uses a single unified table with entity_type and entity_id columns
 * for maximum flexibility and consistency.
 */
class ActivityLogTool {
  constructor(role) {
    if (!role) {
      throw new Error('ActivityLogTool requires a role');
    }
    this.role = role;
  }

  /**
   * Check if the current role is Orion.
   * @throws {Error} If role is not Orion.
   */
  _checkRole() {
    if (this.role !== 'Orion') {
      throw new Error('ActivityLogTool is only accessible to Orion');
    }
  }

  /**
   * Create a unified activity log table if it doesn't exist.
   * This table can handle logs for features, tasks, and subtasks.
   */
  async ensureActivityLogTable() {
    this._checkRole();
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS unified_activity_logs (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('feature', 'task', 'subtask')),
        entity_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        agent VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        parent_id INTEGER,
        attachments JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_unified_activity_logs_entity 
        ON unified_activity_logs (entity_type, entity_id);
      
      CREATE INDEX IF NOT EXISTS idx_unified_activity_logs_type 
        ON unified_activity_logs (type);
      
      CREATE INDEX IF NOT EXISTS idx_unified_activity_logs_timestamp 
        ON unified_activity_logs (timestamp DESC);
    `;

    try {
      await db.query(createTableSQL);
      console.log('ActivityLogTool: Unified activity logs table created/verified');
      return true;
    } catch (error) {
      console.error('ActivityLogTool: Failed to create unified activity logs table:', error.message);
      throw error;
    }
  }

  /**
   * Log an activity for any entity (feature, task, or subtask).
   * 
   * @param {string} entityType - 'feature', 'task', or 'subtask'
   * @param {number} entityId - Internal ID of the entity
   * @param {string} type - Type of activity (e.g., 'creation', 'update', 'status_change')
   * @param {string} content - Description of the activity
   * @param {Object} options - Additional options
   * @param {string} options.agent - Agent performing the action (default: 'Orion')
   * @param {string} options.status - Status of the log entry (default: 'open')
   * @param {number} options.parentId - Parent log entry ID for threading
   * @param {Array} options.attachments - Array of attachment metadata
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} The created log entry
   */
  async logActivity(entityType, entityId, type, content, options = {}) {
    this._checkRole();
    
    const {
      agent = 'Orion',
      status = 'open',
      parentId = null,
      attachments = [],
      metadata = {}
    } = options;

    // Validate entity type
    if (!['feature', 'task', 'subtask'].includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}. Must be 'feature', 'task', or 'subtask'`);
    }

    try {
      // First ensure the table exists
      await this.ensureActivityLogTable();
      
      const result = await db.query(
        `INSERT INTO unified_activity_logs 
         (entity_type, entity_id, type, agent, content, status, parent_id, attachments, metadata, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [entityType, entityId, type, agent, content, status, parentId, attachments, metadata]
      );
      
      console.log(`ActivityLogTool: Logged ${type} activity for ${entityType} ${entityId}`);
      return result.rows[0];
    } catch (error) {
      console.error('ActivityLogTool: Failed to log activity:', error.message);
      throw error;
    }
  }

  /**
   * Get activity logs for an entity.
   * 
   * @param {string} entityType - 'feature', 'task', or 'subtask'
   * @param {number} entityId - Internal ID of the entity
   * @param {Object} options - Query options
   * @param {string} options.type - Filter by activity type
   * @param {string} options.status - Filter by status
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Pagination offset
   * @param {boolean} options.desc - Sort descending by timestamp
   * @returns {Promise<Array>} Array of log entries
   */
  async getActivityLogs(entityType, entityId, options = {}) {
    this._checkRole();
    
    const {
      type = null,
      status = null,
      limit = 50,
      offset = 0,
      desc = true
    } = options;

    let query = `
      SELECT * FROM unified_activity_logs 
      WHERE entity_type = $1 AND entity_id = $2
    `;
    
    const params = [entityType, entityId];
    let paramIndex = 3;

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY timestamp ${desc ? 'DESC' : 'ASC'}`;
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);
    
    paramIndex++;
    query += ` OFFSET $${paramIndex}`;
    params.push(offset);

    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('ActivityLogTool: Failed to get activity logs:', error.message);
      throw error;
    }
  }

  /**
   * Update DatabaseTool to use this unified logging system.
   * This method updates an existing DatabaseTool instance to use ActivityLogTool.
   */
  static patchDatabaseTool(DatabaseToolClass) {
    const originalUpdateSubtaskSections = DatabaseToolClass.prototype.update_subtask_sections;
    const originalCreateSubtask = DatabaseToolClass.prototype.create_subtask;
    const originalUpdateFeatureSections = DatabaseToolClass.prototype.update_feature_sections;
    const originalUpdateTaskSections = DatabaseToolClass.prototype.update_task_sections;
    
    // Create a shared ActivityLogTool instance
    const activityLogTool = new ActivityLogTool('Orion');
    
    // Patch update_subtask_sections
    DatabaseToolClass.prototype.update_subtask_sections = async function(subtask_id, changes, reason = '') {
      // Call original method
      const result = await originalUpdateSubtaskSections.call(this, subtask_id, changes, reason);
      
      // Also log to unified system
      try {
        const subtask = await this._findSubtaskByIdOrExternal(subtask_id);
        await activityLogTool.logActivity(
          'subtask',
          subtask.id,
          'bulk_update',
          reason || 'Updated subtask sections',
          { agent: this.role }
        );
      } catch (logError) {
        console.error('Failed to log to unified activity system:', logError.message);
        // Don't fail the original operation
      }
      
      return result;
    };
    
    // Patch create_subtask
    DatabaseToolClass.prototype.create_subtask = async function(task_id, external_id, title, status, workflow_stage, basic_info = {}, instruction = {}, pcc = {}, tests = {}, implementation = {}, review = {}, reason = '') {
      // Call original method
      const result = await originalCreateSubtask.call(this, task_id, external_id, title, status, workflow_stage, basic_info, instruction, pcc, tests, implementation, review, reason);
      
      // Also log to unified system
      try {
        await activityLogTool.logActivity(
          'subtask',
          result.id,
          'creation',
          reason || 'Created new subtask',
          { agent: this.role }
        );
      } catch (logError) {
        console.error('Failed to log to unified activity system:', logError.message);
        // Don't fail the original operation
      }
      
      return result;
    };
    
    // Patch update_feature_sections
    DatabaseToolClass.prototype.update_feature_sections = async function(feature_id, changes, reason = '') {
      // Call original method
      const result = await originalUpdateFeatureSections.call(this, feature_id, changes, reason);
      
      // Also log to unified system
      try {
        const featureResult = await db.query(
          'SELECT id FROM features WHERE external_id = $1 OR id::text = $1',
          [feature_id]
        );
        if (featureResult.rows.length > 0) {
          await activityLogTool.logActivity(
            'feature',
            featureResult.rows[0].id,
            'bulk_update',
            reason || 'Updated feature sections',
            { agent: this.role }
          );
        }
      } catch (logError) {
        console.error('Failed to log to unified activity system:', logError.message);
        // Don't fail the original operation
      }
      
      return result;
    };
    
    // Patch update_task_sections
    DatabaseToolClass.prototype.update_task_sections = async function(task_id, changes, reason = '') {
      // Call original method
      const result = await originalUpdateTaskSections.call(this, task_id, changes, reason);
      
      // Also log to unified system
      try {
        const taskResult = await db.query(
          'SELECT id FROM tasks WHERE external_id = $1 OR id::text = $1',
          [task_id]
        );
        if (taskResult.rows.length > 0) {
          await activityLogTool.logActivity(
            'task',
            taskResult.rows[0].id,
            'bulk_update',
            reason || 'Updated task sections',
            { agent: this.role }
          );
        }
      } catch (logError) {
        console.error('Failed to log to unified activity system:', logError.message);
        // Don't fail the original operation
      }
      
      return result;
    };
    
    console.log('ActivityLogTool: DatabaseTool patched to use unified activity logging');
  }
}

// Create a default instance with role 'Orion' for testing and general use
const defaultInstance = new ActivityLogTool('Orion');

// Export the instance as default (for tests and direct use)
module.exports = defaultInstance;

// Also export the class for patching and other uses
module.exports.ActivityLogTool = ActivityLogTool;
