/**
 * @jest-environment node
 *
 * TOOL-002 – ToolRunner: execution & instance-method fallback
 *
 * Tests for `backend/tools/ToolRunner.js` that verify:
 * 1. Basic execution for DatabaseTool via registry-style tools map.
 * 2. Instance-method fallback debug error text for missing action.
 * 3. Soft-stop duplicate blocking behavior (per-request duplicate blocking).
 * 4. Rate limiting / legacy dedup reuse (optional but recommended).
 */

// Mock dependencies
jest.mock('../../../tools/functionDefinitions', () => ({
  parseFunctionCall: jest.fn(),
}));
jest.mock('../../../src/services/trace/TraceService', () => ({
  logEvent: jest.fn(),
}));

const { parseFunctionCall } = require('../../../tools/functionDefinitions');
const TraceService = require('../../../src/services/trace/TraceService');
const ToolRunner = require('../../../tools/ToolRunner');

describe('TOOL-002: ToolRunner execution and fallback', () => {
  let mockDbInstance;
  let tools;

  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure a consistent soft-stop window for tests (60 seconds)
    process.env.TOOL_SOFTSTOP_WINDOW_MS = '60000';

    // Clear the per-request duplicate tracker to ensure test isolation
    ToolRunner.perRequestDuplicateTracker.clear();

    // Mock a DatabaseTool instance with the required methods
    mockDbInstance = {
      get_feature_overview: jest.fn().mockResolvedValue('feature overview result'),
      create_task: jest.fn().mockResolvedValue('task created'),
      create_subtask: jest.fn().mockResolvedValue('subtask created'),
      delete_subtask: jest.fn().mockResolvedValue('subtask deleted'),
      get_subtask_full_context: jest.fn().mockResolvedValue('full context'),
    };

    // Simulate the tools map as returned by the registry for Orion in ACT mode
    tools = {
      DatabaseTool: mockDbInstance,
      FileSystemTool: { /* mock if needed */ },
    };

    // Default mock for parseFunctionCall
    parseFunctionCall.mockReturnValue({
      tool: 'DatabaseTool',
      action: 'get_feature_overview',
      params: { feature_id: 'F1', project_id: 'P1' },
    });
  });

  afterEach(() => {
    delete process.env.TOOL_SOFTSTOP_WINDOW_MS;
  });

  describe('Basic execution for DatabaseTool via registry-style tools map', () => {
    test('should execute tool call and return success result', async () => {
      const toolCall = {
        id: 'call1',
        function: { name: 'DatabaseTool_get_feature_overview', arguments: '{"feature_id":"F1","project_id":"P1"}' },
      };
      parseFunctionCall.mockReturnValue({
        tool: 'DatabaseTool',
        action: 'get_feature_overview',
        params: { feature_id: 'F1', project_id: 'P1' },
      });

      const context = { projectId: 'P1', requestId: 'req-1' };
      const results = await ToolRunner.executeToolCalls(tools, [toolCall], context);

      // Verify the underlying method was called with correct arguments
      expect(mockDbInstance.get_feature_overview).toHaveBeenCalledTimes(1);
      expect(mockDbInstance.get_feature_overview).toHaveBeenCalledWith({
        feature_id: 'F1',
        project_id: 'P1',
        context: expect.objectContaining({ projectId: 'P1', requestId: 'req-1', __trace_from_toolrunner: true }),
      });

      // Verify the result structure
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        toolCallId: 'call1',
        toolName: 'DatabaseTool.get_feature_overview',
        success: true,
        result: 'feature overview result',
      });
    });
  });

    describe('Instance-method fallback debug error text for missing action', () => {
      test('should return error result when action is missing', async () => {
        // Simulate a tool call for an action that does not exist
        const toolCall = {
          id: 'call2',
          function: { name: 'DatabaseTool_unknown_action', arguments: '{}' },
        };
        parseFunctionCall.mockReturnValue({
          tool: 'DatabaseTool',
          action: 'unknown_action',
          params: {},
        });

        const results = await ToolRunner.executeToolCalls(tools, [toolCall], {});

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        // The error message should indicate the action is not callable
        expect(results[0].error).toMatch(/Tool "DatabaseTool" action "unknown_action" is not callable/);
        // Optionally, we could also check that the error lists available methods, but the exact format may vary.
      });
    });

  describe('Soft-stop duplicate blocking behavior', () => {
    test('should block duplicate tool calls within the same request within soft-stop window', async () => {
      // Use a unique tool call to avoid collisions with other tests
      const toolCall = {
        id: 'call-softstop',
        function: { name: 'DatabaseTool_create_task', arguments: '{"feature_id":"F_softstop","title":"Unique Task"}' },
      };
      parseFunctionCall.mockReturnValue({
        tool: 'DatabaseTool',
        action: 'create_task',
        params: { feature_id: 'F_softstop', title: 'Unique Task' },
      });

      const context = { projectId: 'P_softstop', requestId: 'req-dup' };

      // First call should succeed
      const firstResults = await ToolRunner.executeToolCalls(tools, [toolCall], context);
      console.log('First call results:', firstResults);
      expect(firstResults[0].success).toBe(true);
      expect(firstResults[0].result).toBe('task created'); // from mock

      // Reset the mock to track the second call
      mockDbInstance.create_task.mockClear();

      // Second call with same signature within soft-stop window should be blocked
      const secondResults = await ToolRunner.executeToolCalls(tools, [toolCall], context);
      console.log('Second call results:', secondResults);
      expect(secondResults[0].success).toBe(false);
      expect(secondResults[0].error).toBe('DUPLICATE_BLOCKED');

      // The underlying method should not be called again
      expect(mockDbInstance.create_task).not.toHaveBeenCalled();
    });
  });

  describe('Rate limiting / legacy dedup reuse', () => {
    test('should return reused result for duplicate tool call within rate window (legacy dedup)', async () => {
      // We need to test the legacy deduplication that returns a warning and reuses the previous result.
      // This behavior is triggered when the same tool call (same parameters) is repeated within the rate window (10 seconds).
      // We'll simulate two identical tool calls with a short time gap (within 10 seconds) but with different request IDs to bypass soft-stop.
      // Note: The legacy dedup uses a rateKey that does not include requestId, so it's global.

      const toolCall = {
        id: 'call4',
        function: { name: 'DatabaseTool_create_task', arguments: '{"title":"Task1","feature_id":"F1"}' },
      };
      parseFunctionCall.mockReturnValue({
        tool: 'DatabaseTool',
        action: 'create_task',
        params: { title: 'Task1', feature_id: 'F1' },
      });

      // First call with requestId 'req-a'
      const firstContext = { projectId: 'P1', requestId: 'req-a' };
      const firstResults = await ToolRunner.executeToolCalls(tools, [toolCall], firstContext);
      expect(firstResults[0].success).toBe(true);
      expect(mockDbInstance.create_task).toHaveBeenCalledTimes(1);

      // Second call with a different requestId but same parameters, within rate window
      // We need to ensure the soft-stop doesn't block because it's a different requestId.
      const secondContext = { projectId: 'P1', requestId: 'req-b' };
      const secondResults = await ToolRunner.executeToolCalls(tools, [toolCall], secondContext);

      // The second result should be a reused result (success: true with a warning)
      expect(secondResults[0].success).toBe(true);
      expect(secondResults[0].result).toMatchObject({
        warning: 'DUPLICATE_TOOL_CALL',
        message: expect.stringContaining('You already called this tool'),
      });

      // The underlying method should not have been called again (because it was reused)
      expect(mockDbInstance.create_task).toHaveBeenCalledTimes(1);
    });
  });
});
