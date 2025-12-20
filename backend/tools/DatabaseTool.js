const db = require('../src/db/connection.js');
const fs = require('fs');
const path = require('path');

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

      return updateResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  _checkRole() {
    if (this.role !== 'Orion') {
      throw new Error('DatabaseTool is only accessible to Orion');
    }
  }

  // ... rest of the existing methods unchanged ...
}

const defaultInstance = new DatabaseTool('Orion');

module.exports = defaultInstance;
module.exports.DatabaseTool = DatabaseTool;
