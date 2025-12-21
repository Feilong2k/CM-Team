// Thin agent-level adapter for DatabaseTool
// Bridges LLM tool_call argument shape ({ ...params, context }) to the
// existing positional DatabaseTool API.

const DatabaseTool = require('./DatabaseTool');

/**
 * Adapter object exposed to agents (via tools/registry) under the name
 * "DatabaseTool". Each method accepts a single args object, matching the
 * JSON schema defined in functionDefinitions plus an optional `context` field.
 */
const DatabaseToolAgentAdapter = {
  /**
   * Handle DatabaseTool_get_subtask_full_context tool calls.
   *
   * Expected args shape:
   *   {
   *     subtask_id: string | number,          // required
   *     project_id?: string,                  // optional explicit project id
   *     context?: { projectId?: string, ... } // injected by BaseAgent
   *   }
   *
   * This method must:
   * - validate that args is an object and subtask_id is present
   * - derive projectId from project_id or context.projectId (in that order)
   * - delegate to DatabaseTool.get_subtask_full_context(subtaskId, projectId)
   * - propagate any DatabaseTool errors without masking their messages
   */
  async get_subtask_full_context(args) {
    // Basic shape validation so bad tool_calls fail fast and clearly.
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw new Error(
        'DatabaseTool_get_subtask_full_context: args must be an object',
      );
    }

    const { subtask_id: subtaskId, project_id: explicitProjectId, context } = args;

    if (
      subtaskId === undefined ||
      subtaskId === null ||
      (typeof subtaskId === 'string' && subtaskId.trim() === '')
    ) {
      throw new Error(
        'DatabaseTool_get_subtask_full_context: subtask_id is required',
      );
    }

    // Derive projectId using the documented precedence.
    let projectId;
    if (typeof explicitProjectId === 'string' && explicitProjectId.trim() !== '') {
      projectId = explicitProjectId.trim();
    } else if (
      context &&
      typeof context.projectId === 'string' &&
      context.projectId.trim() !== ''
    ) {
      projectId = context.projectId.trim();
    }
    // If neither is provided, we intentionally leave projectId undefined so
    // that DatabaseTool can apply its own defaults or throw
    // MISSING_PROJECT_CONTEXT as defined in F2-T0.

    // Delegate to the existing DatabaseTool positional API. We do not catch
    // and wrap errors here; BaseAgent / callers should see the original
    // DatabaseTool error messages.
    return DatabaseTool.get_subtask_full_context(subtaskId, projectId);
  },

  /**
   * Handle DatabaseTool_create_subtask tool calls.
   *
   * Expected args shape (from functionDefinitions):
   *   {
   *     task_id: string,                    // required
   *     external_id?: string,               // optional explicit external_id
   *     title: string,                      // required
   *     status?: string,                    // optional (default: 'pending')
   *     workflow_stage?: string,            // optional (default: 'orion_planning')
   *     basic_info?: object,                // optional JSONB payload
   *     instruction?: object,               // optional JSONB payload
   *     pcc?: object,                       // optional JSONB payload
   *     tests?: object,                     // optional JSONB payload
   *     implementation?: object,            // optional JSONB payload
   *     review?: object,                    // optional JSONB payload
   *     reason?: string,                    // optional reason for logging
   *     context?: { projectId?: string, ... } // injected by BaseAgent
   *   }
   *
   * This method must:
   * - validate that args is an object and required fields are present
   * - delegate to DatabaseTool.create_subtask with positional parameters
   * - propagate any DatabaseTool errors without masking their messages
   */
  async create_subtask(args) {
    // Basic shape validation
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw new Error(
        'DatabaseTool_create_subtask: args must be an object',
      );
    }

    const {
      task_id: taskId,
      external_id: externalId = null,
      title,
      status = 'pending',
      workflow_stage = 'orion_planning',
      basic_info = {},
      instruction = {},
      pcc = {},
      tests = {},
      implementation = {},
      review = {},
      reason = '',
      context
    } = args;

    // Validate required parameters
    if (!taskId || (typeof taskId === 'string' && taskId.trim() === '')) {
      throw new Error(
        'DatabaseTool_create_subtask: task_id is required',
      );
    }

    if (!title || (typeof title === 'string' && title.trim() === '')) {
      throw new Error(
        'DatabaseTool_create_subtask: title is required',
      );
    }

    // Derive projectId from context for ID normalization if needed
    let projectId;
    if (context && typeof context.projectId === 'string' && context.projectId.trim() !== '') {
      projectId = context.projectId.trim();
    }
    // Note: DatabaseTool.create_subtask doesn't need projectId parameter,
    // but it uses normalizeId internally which may need it for shorthand IDs.
    // We'll pass undefined and let DatabaseTool handle it.

    // Delegate to the existing DatabaseTool positional API
    return DatabaseTool.create_subtask(
      taskId,
      externalId,
      title,
      status,
      workflow_stage,
      basic_info,
      instruction,
      pcc,
      tests,
      implementation,
      review,
      reason
    );
  },
};

module.exports = DatabaseToolAgentAdapter;
