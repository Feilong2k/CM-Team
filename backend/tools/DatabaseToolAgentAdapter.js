// Thin agent-level adapter for DatabaseTool
// Bridges LLM tool_call argument shape ({ ...params, context }) to the
// existing positional DatabaseTool API.

const DatabaseToolModule = require('./DatabaseTool');
const TraceService = require('../src/services/trace/TraceService');
const { TRACE_TYPES, TRACE_SOURCES } = require('../src/services/trace/TraceEvent');

// Support both default export (defaultInstance) and named export (.DatabaseTool)
// so tests that mock ../../tools/DatabaseTool with a plain object still work.
const DatabaseTool = DatabaseToolModule.DatabaseTool || DatabaseToolModule;

const originalCreateSubtask =
  DatabaseTool && typeof DatabaseTool.create_subtask === 'function'
    ? DatabaseTool.create_subtask.bind(DatabaseTool)
    : null;

const originalGetSubtaskFullContext =
  DatabaseTool && typeof DatabaseTool.get_subtask_full_context === 'function'
    ? DatabaseTool.get_subtask_full_context.bind(DatabaseTool)
    : null;

const DatabaseToolAgentAdapter = {
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

    // Log tool_call event
    try {
      await TraceService.logEvent({
        projectId,
        type: TRACE_TYPES.TOOL_CALL,
        source: TRACE_SOURCES.TOOL,
        timestamp: Date.now(),
        summary: 'DatabaseTool_get_subtask_full_context call',
        details: { subtaskId },
        requestId: context?.requestId,
      });
    } catch (err) {
      console.error('Trace logging failed for get_subtask_full_context call:', err);
    }

    // Call original method (falls back to direct call if bound version is not available,
    // e.g. when DatabaseTool is a Jest mock object in tests).
    const targetFn = originalGetSubtaskFullContext || DatabaseTool.get_subtask_full_context;
    if (typeof targetFn !== 'function') {
      throw new Error('DatabaseTool_get_subtask_full_context: underlying implementation is not available');
    }

    const result = await targetFn(subtaskId, projectId);

    // Log tool_result event
    try {
      await TraceService.logEvent({
        projectId,
        type: TRACE_TYPES.TOOL_RESULT,
        source: TRACE_SOURCES.TOOL,
        timestamp: Date.now(),
        summary: 'DatabaseTool_get_subtask_full_context result',
        details: { result },
        requestId: context?.requestId,
      });
    } catch (err) {
      console.error('Trace logging failed for get_subtask_full_context result:', err);
    }

    return result;
  },

  async create_subtask(args) {
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

    let projectId;
    if (context && typeof context.projectId === 'string' && context.projectId.trim() !== '') {
      projectId = context.projectId.trim();
    }

    // Log tool_call event
    try {
      await TraceService.logEvent({
        projectId,
        type: TRACE_TYPES.TOOL_CALL,
        source: TRACE_SOURCES.TOOL,
        timestamp: Date.now(),
        summary: 'DatabaseTool_create_subtask call',
        details: { taskId, title },
        requestId: context?.requestId,
      });
    } catch (err) {
      console.error('Trace logging failed for create_subtask call:', err);
    }

    const targetFn = originalCreateSubtask || DatabaseTool.create_subtask;
    if (typeof targetFn !== 'function') {
      throw new Error('DatabaseTool_create_subtask: underlying implementation is not available');
    }

    const result = await targetFn(
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

    // Log tool_result event
    try {
      await TraceService.logEvent({
        projectId,
        type: TRACE_TYPES.TOOL_RESULT,
        source: TRACE_SOURCES.TOOL,
        timestamp: Date.now(),
        summary: 'DatabaseTool_create_subtask result',
        details: { result },
        requestId: context?.requestId,
      });
    } catch (err) {
      console.error('Trace logging failed for create_subtask result:', err);
    }

    return result;
  },
};

module.exports = DatabaseToolAgentAdapter;
