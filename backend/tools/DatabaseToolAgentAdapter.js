// Thin agent-level adapter for DatabaseTool
// Bridges LLM tool_call argument shape ({ ...params, context }) to the
// existing positional DatabaseTool API.

const DatabaseToolModule = require('./DatabaseTool');
const TraceService = require('../src/services/trace/TraceService');
const { TRACE_TYPES, TRACE_SOURCES } = require('../src/services/trace/TraceEvent');

// Resolve a usable DatabaseTool **instance** (not the class constructor).
// In production, backend/tools/DatabaseTool exports a default instance with
// get_subtask_full_context, list_subtasks_for_task, etc. In tests, Jest may
// mock this module with a plain object. We prefer whatever exposes the
// instance-style API (get_subtask_full_context as a method).
const DatabaseToolInstance =
  DatabaseToolModule && typeof DatabaseToolModule.get_subtask_full_context === 'function'
    ? DatabaseToolModule
    : (DatabaseToolModule && DatabaseToolModule.DatabaseTool
        ? new DatabaseToolModule.DatabaseTool('Orion')
        : null);

const originalCreateSubtask =
  DatabaseToolInstance && typeof DatabaseToolInstance.create_subtask === 'function'
    ? DatabaseToolInstance.create_subtask.bind(DatabaseToolInstance)
    : null;

const originalGetSubtaskFullContext =
  DatabaseToolInstance && typeof DatabaseToolInstance.get_subtask_full_context === 'function'
    ? DatabaseToolInstance.get_subtask_full_context.bind(DatabaseToolInstance)
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

    // Log tool_call event (ensure type, source, and timestamp are friendly for UI)
    try {
      await TraceService.logEvent({
        projectId,
        type: 'tool_call',
        source: 'tool',
        timestamp: new Date().toISOString(),
        summary: 'DatabaseTool_get_subtask_full_context call',
        details: { subtaskId, projectId },
        requestId: context?.requestId,
      });
    } catch (err) {
      console.error('Trace logging failed for get_subtask_full_context call:', err);
    }

    // Call original method (falls back to direct call if bound version is not available,
    // e.g. when DatabaseTool is a Jest mock object in tests).
    const targetFn = originalGetSubtaskFullContext || (DatabaseToolInstance && DatabaseToolInstance.get_subtask_full_context);
    if (typeof targetFn !== 'function') {
      throw new Error('DatabaseTool_get_subtask_full_context: underlying implementation is not available');
    }

    let result;
    try {
      result = await targetFn(subtaskId, projectId);
    } catch (error) {
      // Log a tool_result-style error event so the gap is visible in the trace timeline
      try {
        await TraceService.logEvent({
          projectId,
          type: 'tool_result',
          source: 'tool',
          timestamp: new Date().toISOString(),
          summary: 'DatabaseTool_get_subtask_full_context error',
          details: {
            ok: false,
            hasSubtask: false,
            error: error.message,
          },
          error: { message: error.message },
          requestId: context?.requestId,
        });
      } catch (traceErr) {
        console.error('Trace logging failed for get_subtask_full_context error:', traceErr);
      }

      // Preserve existing behavior for callers (ToolRunner/OrionAgent)
      throw error;
    }

    // Log tool_result event with a compact summary of the outcome
    try {
      await TraceService.logEvent({
        projectId,
        type: 'tool_result',
        source: 'tool',
        timestamp: new Date().toISOString(),
        summary: 'DatabaseTool_get_subtask_full_context result',
        details: {
          ok: !!(result && result.ok),
          hasSubtask: !!(result && result.subtask),
          // Keep full result for debugging; frontend can pretty-print or collapse
          result,
        },
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
        type: 'tool_call',
        source: 'tool',
        timestamp: new Date().toISOString(),
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
        type: 'tool_result',
        source: 'tool',
        timestamp: new Date().toISOString(),
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
