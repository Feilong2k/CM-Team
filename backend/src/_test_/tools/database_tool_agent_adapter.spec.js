/**
 * @jest-environment node
 *
 * TOOL-003 – DatabaseToolAgentAdapter delegation & trace
 *
 * Tests for `backend/tools/DatabaseToolAgentAdapter.js` that verify:
 * 1. TOOL‑003‑A: get_feature_overview – delegates with correct arguments.
 * 2. TOOL‑003‑B: create_task and create_subtask – delegates and validates required fields.
 * 3. TOOL‑003‑C: delete_subtask – delegates with subtask_id and reason.
 * 4. TOOL‑003‑D: get_subtask_full_context trace behavior – emits trace events only when not called from ToolRunner.
 */

// Mock dependencies
jest.mock('../../../tools/DatabaseTool', () => ({
  get_feature_overview: jest.fn(),
  create_task: jest.fn(),
  create_subtask: jest.fn(),
  delete_subtask: jest.fn(),
  get_subtask_full_context: jest.fn(),
}));
jest.mock('../../../src/services/trace/TraceService', () => ({
  logEvent: jest.fn(),
}));

const DatabaseTool = require('../../../tools/DatabaseTool');
const TraceService = require('../../../src/services/trace/TraceService');
const DatabaseToolAgentAdapter = require('../../../tools/DatabaseToolAgentAdapter');

describe('TOOL-003: DatabaseToolAgentAdapter delegation & trace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TOOL‑003‑A: get_feature_overview', () => {
    test('should call underlying DatabaseTool.get_feature_overview with correct arguments', async () => {
      const mockResult = { ok: true, feature: { id: 'F1', name: 'Feature 1' } };
      DatabaseTool.get_feature_overview.mockResolvedValue(mockResult);

      const result = await DatabaseToolAgentAdapter.get_feature_overview({
        feature_id: 'F1',
        project_id: 'P1',
        context: { projectId: 'P1', requestId: 'req-1' },
      });

      expect(DatabaseTool.get_feature_overview).toHaveBeenCalledTimes(1);
      expect(DatabaseTool.get_feature_overview).toHaveBeenCalledWith('F1', 'P1');
      expect(result).toEqual(mockResult);
    });

    test('should throw error when feature_id is missing', async () => {
      await expect(
        DatabaseToolAgentAdapter.get_feature_overview({
          project_id: 'P1',
          context: {},
        })
      ).rejects.toThrow('feature_id is required');
    });
  });

  describe('TOOL‑003‑B: create_task and create_subtask', () => {
    test('create_task should delegate with correct arguments', async () => {
      const mockResult = { ok: true, task_id: 'T1' };
      DatabaseTool.create_task.mockResolvedValue(mockResult);

      const result = await DatabaseToolAgentAdapter.create_task({
        feature_id: 'F1',
        external_id: 'ext-123',
        title: 'New Task',
        status: 'pending',
        basic_info: { description: 'test' },
        pcc: {},
        cap: {},
        reason: '',
        context: { projectId: 'P1', requestId: 'req-1' },
      });

      expect(DatabaseTool.create_task).toHaveBeenCalledTimes(1);
      expect(DatabaseTool.create_task).toHaveBeenCalledWith(
        'F1',
        'ext-123',
        'New Task',
        'pending',
        { description: 'test' },
        {},
        {},
        ''
      );
      expect(result).toEqual(mockResult);
    });

    test('create_task should throw error when required fields are missing', async () => {
      await expect(
        DatabaseToolAgentAdapter.create_task({
          feature_id: 'F1',
          // missing title
          context: {},
        })
      ).rejects.toThrow('title is required');
    });

    test('create_subtask should delegate with correct arguments', async () => {
      const mockResult = { ok: true, subtask_id: 'S1' };
      DatabaseTool.create_subtask.mockResolvedValue(mockResult);

      const result = await DatabaseToolAgentAdapter.create_subtask({
        task_id: 'T1',
        external_id: 'ext-456',
        title: 'New Subtask',
        status: 'pending',
        workflow_stage: 'orion_planning',
        basic_info: {},
        instruction: {},
        pcc: {},
        tests: {},
        implementation: {},
        review: {},
        reason: '',
        context: { projectId: 'P1', requestId: 'req-2' },
      });

      expect(DatabaseTool.create_subtask).toHaveBeenCalledTimes(1);
      expect(DatabaseTool.create_subtask).toHaveBeenCalledWith(
        'T1',
        'ext-456',
        'New Subtask',
        'pending',
        'orion_planning',
        {},
        {},
        {},
        {},
        {},
        {},
        ''
      );
      expect(result).toEqual(mockResult);
    });

    test('create_subtask should throw error when task_id or title is missing', async () => {
      await expect(
        DatabaseToolAgentAdapter.create_subtask({
          // missing task_id
          title: 'Title',
          context: {},
        })
      ).rejects.toThrow('task_id is required');

      await expect(
        DatabaseToolAgentAdapter.create_subtask({
          task_id: 'T1',
          // missing title
          context: {},
        })
      ).rejects.toThrow('title is required');
    });
  });

  describe('TOOL‑003‑C: delete_subtask', () => {
    test('should call underlying DatabaseTool.delete_subtask with subtask_id and reason', async () => {
      const mockResult = { ok: true };
      DatabaseTool.delete_subtask.mockResolvedValue(mockResult);

      const result = await DatabaseToolAgentAdapter.delete_subtask({
        subtask_id: 'S1',
        reason: 'no longer needed',
        context: { projectId: 'P1', requestId: 'req-3' },
      });

      expect(DatabaseTool.delete_subtask).toHaveBeenCalledTimes(1);
      expect(DatabaseTool.delete_subtask).toHaveBeenCalledWith('S1', 'no longer needed');
      expect(result).toEqual(mockResult);
    });

    test('should throw error when subtask_id is missing', async () => {
      await expect(
        DatabaseToolAgentAdapter.delete_subtask({
          reason: 'test',
          context: {},
        })
      ).rejects.toThrow('subtask_id is required');
    });
  });

  describe('TOOL‑003‑D: get_subtask_full_context trace behavior', () => {
    test('should emit trace events when NOT called from ToolRunner', async () => {
      const mockResult = { ok: true, subtask: { id: 'S1' } };
      DatabaseTool.get_subtask_full_context.mockResolvedValue(mockResult);

      const context = { projectId: 'P1', requestId: 'req-4' }; // no __trace_from_toolrunner flag

      const result = await DatabaseToolAgentAdapter.get_subtask_full_context({
        subtask_id: 'S1',
        project_id: 'P1',
        context,
      });

      expect(DatabaseTool.get_subtask_full_context).toHaveBeenCalledTimes(1);
      expect(DatabaseTool.get_subtask_full_context).toHaveBeenCalledWith('S1', 'P1');
      expect(result).toEqual(mockResult);

      // Should have logged both tool_call and tool_result events
      expect(TraceService.logEvent).toHaveBeenCalledTimes(2);
      expect(TraceService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_call',
          summary: 'DatabaseTool_get_subtask_full_context call',
          details: { subtaskId: 'S1', projectId: 'P1' },
          requestId: 'req-4',
        })
      );
      expect(TraceService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_result',
          summary: 'DatabaseTool_get_subtask_full_context result',
          details: expect.objectContaining({ ok: true, hasSubtask: true, result: mockResult }),
          requestId: 'req-4',
        })
      );
    });

    test('should NOT emit trace events when called from ToolRunner (__trace_from_toolrunner true)', async () => {
      const mockResult = { ok: true, subtask: { id: 'S2' } };
      DatabaseTool.get_subtask_full_context.mockResolvedValue(mockResult);

      const context = {
        projectId: 'P1',
        requestId: 'req-5',
        __trace_from_toolrunner: true,
      };

      const result = await DatabaseToolAgentAdapter.get_subtask_full_context({
        subtask_id: 'S2',
        project_id: 'P1',
        context,
      });

      expect(DatabaseTool.get_subtask_full_context).toHaveBeenCalledTimes(1);
      expect(DatabaseTool.get_subtask_full_context).toHaveBeenCalledWith('S2', 'P1');
      expect(result).toEqual(mockResult);

      // No trace events should be logged
      expect(TraceService.logEvent).not.toHaveBeenCalled();
    });

    test('should log error trace when underlying call fails and not from ToolRunner', async () => {
      const error = new Error('Database error');
      DatabaseTool.get_subtask_full_context.mockRejectedValue(error);

      const context = { projectId: 'P1', requestId: 'req-6' };

      await expect(
        DatabaseToolAgentAdapter.get_subtask_full_context({
          subtask_id: 'S3',
          project_id: 'P1',
          context,
        })
      ).rejects.toThrow('Database error');

      // Should have logged tool_call and tool_result (error) events
      expect(TraceService.logEvent).toHaveBeenCalledTimes(2);
      expect(TraceService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tool_call' })
      );
      expect(TraceService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_result',
          summary: 'DatabaseTool_get_subtask_full_context error',
          error: { message: 'Database error' },
        })
      );
    });
  });
});
