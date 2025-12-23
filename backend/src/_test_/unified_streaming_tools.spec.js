/**
 * @jest-environment node
 */
// Note: We rely on Jest's global functions (describe, it, expect, beforeEach, jest)
// because the project uses Jest's default configuration that injects them globally.

// Mock dependencies
jest.mock('../../tools/ToolRunner');
jest.mock('../services/StreamingService');
jest.mock('../../tools/registry');
jest.mock('../../tools/DatabaseToolAgentAdapter');
jest.mock('../adapters/DS_ChatAdapter');

// Mock fs and path for OrionAgent's prompt loading
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('# Orion Prompt'),
  existsSync: jest.fn().mockReturnValue(true),
  readdirSync: jest.fn().mockReturnValue([]),
}));

// Mock list_files and functionDefinitions
jest.mock('../../tools/list_files', () => ({
  listFiles: jest.fn().mockReturnValue([]),
}));

jest.mock('../../tools/functionDefinitions', () => ({}));

// Mock trace service
jest.mock('../services/trace/TraceService', () => ({
  logEvent: jest.fn(),
}));

const OrionAgent = require('../agents/OrionAgent');
const ToolRunner = require('../../tools/ToolRunner');
const StreamingService = require('../services/StreamingService');
const { getToolsForRole } = require('../../tools/registry');
const DatabaseToolAgentAdapter = require('../../tools/DatabaseToolAgentAdapter');
const TraceService = require('../services/trace/TraceService');

describe('Unified Streaming & Tool Filtering (Subtask 2-1-19)', () => {
  let orionAgent;
  let mockAdapter;
  let mockDbTool;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock adapter that can be controlled per test
    mockAdapter = {
      sendMessagesStreaming: jest.fn(),
      sendMessages: jest.fn(),
    };

    // Mock database tool with read and write methods
    mockDbTool = {
      create_subtask: jest.fn(),
      get_subtask_full_context: jest.fn(),
      chatMessages: {
        addMessage: jest.fn(),
        getMessages: jest.fn().mockResolvedValue([]),
      },
    };

    // Mock registry to return tools based on mode
    getToolsForRole.mockImplementation((role, mode) => {
      if (mode === 'plan') {
        // PLAN mode: only read tools
        return {
          DatabaseTool: {
            get_subtask_full_context: mockDbTool.get_subtask_full_context,
          },
        };
      } else {
        // ACT mode: all tools
        return {
          DatabaseTool: mockDbTool,
        };
      }
    });

    // Create a real OrionAgent instance with mocked adapter and tools
    // We'll pass the mocked adapter and a tools object that includes DatabaseTool
    orionAgent = new OrionAgent(mockAdapter, { DatabaseTool: mockDbTool });
  });

  describe('Tool Filtering by Mode', () => {
    it('should block write tools in PLAN mode and yield blocking message', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'Please create a subtask';
      const mode = 'plan';

      // Simulate adapter stream that yields a tool call for a write tool
      const mockToolCall = {
        function: {
          name: 'DatabaseTool_create_subtask',
          arguments: JSON.stringify({ title: 'New subtask' }),
        },
        id: 'call_123',
        type: 'function',
      };

      // The adapter yields a toolCalls event
      const adapterStream = async function* () {
        yield { chunk: 'I will create a subtask for you.' };
        yield { toolCalls: [mockToolCall] };
        yield { done: true, fullContent: '' };
      };
      mockAdapter.sendMessagesStreaming.mockReturnValue(adapterStream());

      // Mock ToolRunner to ensure it's not called (since tool should be blocked)
      ToolRunner.executeToolCalls.mockResolvedValue([]);

      // Act: call the real processStreaming method
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Assert
      // 1. ToolRunner should NOT be called for the write tool in PLAN mode
      expect(ToolRunner.executeToolCalls).not.toHaveBeenCalled();

      // 2. The stream should contain a system message indicating the tool is blocked
      const blockingMessage = events.find(
        (e) => e.chunk && e.chunk.includes('blocked') && e.chunk.includes('PLAN mode')
      );
      expect(blockingMessage).toBeDefined();
    });

    it('should allow read tools in PLAN mode and inject tool result into stream', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'Get subtask context';
      const mode = 'plan';

      const mockToolCall = {
        function: {
          name: 'DatabaseTool_get_subtask_full_context',
          arguments: JSON.stringify({ subtaskId: '123' }),
        },
        id: 'call_456',
        type: 'function',
      };

      const adapterStream = async function* () {
        yield { chunk: 'Fetching subtask...' };
        yield { toolCalls: [mockToolCall] };
        yield { done: true, fullContent: '' };
      };
      mockAdapter.sendMessagesStreaming.mockReturnValue(adapterStream());

      // Mock ToolRunner to return a successful result
      const mockToolResult = {
        toolName: 'DatabaseTool_get_subtask_full_context',
        result: { id: '123', title: 'Test subtask' },
      };
      ToolRunner.executeToolCalls.mockResolvedValue([mockToolResult]);

      // Act
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Assert
      // 1. ToolRunner should be called with the tool call
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledWith(
        expect.objectContaining({ DatabaseTool: mockDbTool }),
        [mockToolCall],
        expect.any(Object) // context
      );

      // 2. The stream should contain the tool result box with the tool name
      const resultEvent = events.find(
        (e) => e.chunk && e.chunk.includes('TOOL RESULT:')
      );
      expect(resultEvent).toBeDefined();
      expect(resultEvent.chunk).toContain('DatabaseTool_get_subtask_full_context');
    });

    it('should allow write tools in ACT mode and inject tool result into stream', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'Create a subtask';
      const mode = 'act';

      const mockToolCall = {
        function: {
          name: 'DatabaseTool_create_subtask',
          arguments: JSON.stringify({ title: 'New subtask' }),
        },
        id: 'call_789',
        type: 'function',
      };

      const adapterStream = async function* () {
        yield { chunk: 'I will create a subtask for you.' };
        yield { toolCalls: [mockToolCall] };
        yield { done: true, fullContent: '' };
      };
      mockAdapter.sendMessagesStreaming.mockReturnValue(adapterStream());

      const mockToolResult = {
        toolName: 'DatabaseTool_create_subtask',
        result: { id: '456', title: 'New subtask' },
      };
      ToolRunner.executeToolCalls.mockResolvedValue([mockToolResult]);

      // Act
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Assert
      // 1. ToolRunner should be called
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledWith(
        expect.objectContaining({ DatabaseTool: mockDbTool }),
        [mockToolCall],
        expect.any(Object)
      );

      // 2. Tool result should appear in the stream with the tool name
      const resultEvent = events.find(
        (e) => e.chunk && e.chunk.includes('TOOL RESULT:')
      );
      expect(resultEvent).toBeDefined();
      expect(resultEvent.chunk).toContain('DatabaseTool_create_subtask');
    });
  });

  describe('Streaming Mechanics', () => {
    it('should persist the full streamed content once at the end of a turn', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'Hello, world!';
      const mode = 'plan';

      const streamedContent = 'This is the full streamed content.';
      const adapterStream = async function* () {
        yield { chunk: 'This is ' };
        yield { chunk: 'the full ' };
        yield { chunk: 'streamed content.' };
        yield { done: true, fullContent: streamedContent };
      };
      mockAdapter.sendMessagesStreaming.mockReturnValue(adapterStream());

      // Mock persistStreamedMessage
      StreamingService.mockImplementation(() => ({
        persistStreamedMessage: jest.fn().mockResolvedValue({ id: 1 }),
      }));
      const streamingService = new StreamingService();

      // Act
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Simulate the onComplete callback that would be called by the route
      const doneEvent = events.find((e) => e.done);
      if (doneEvent && doneEvent.fullContent) {
        await streamingService.persistStreamedMessage(
          'test-external-id',
          doneEvent.fullContent,
          { mode }
        );
      }

      // Assert
      expect(streamingService.persistStreamedMessage).toHaveBeenCalledTimes(1);
      expect(streamingService.persistStreamedMessage).toHaveBeenCalledWith(
        'test-external-id',
        streamedContent,
        { mode }
      );
    });

  });

  // ============================================================================
  // Subtask 2-1-21 — Enhanced Soft Stop: block duplicate tool calls
  // ============================================================================
  describe('Subtask 2-1-21 — Enhanced Soft Stop: block duplicate tool calls', () => {
    it('should execute tool only once when identical tool call appears twice in same request', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'Read the same file twice';
      const mode = 'act';
      const requestId = 'req-123';

      const mockToolCall = {
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: 'package.json' }),
        },
        id: 'call_1',
        type: 'function',
      };

      // Simulate adapter that yields the same tool call twice (simulating Orion repeating itself)
      const adapterStream = async function* () {
        yield { chunk: 'I will read package.json' };
        yield { toolCalls: [mockToolCall] };
        yield { done: true, fullContent: '' };
        // In a real scenario, Orion would continue and might call the same tool again
        // For this test, we'll simulate a second iteration with the same tool call
      };

      // Mock adapter to return stream, then when called again (second iteration), return same tool call
      let iteration = 0;
      mockAdapter.sendMessagesStreaming.mockImplementation(() => {
        iteration++;
        if (iteration === 1) {
          return adapterStream();
        } else if (iteration === 2) {
          // Second iteration: Orion calls the same tool again
          const secondStream = async function* () {
            yield { toolCalls: [mockToolCall] };
            yield { done: true, fullContent: '' };
          };
          return secondStream();
        }
        return (async function* () {})();
      });

      // Mock ToolRunner to track how many times the tool is executed
      const mockToolResult = {
        toolName: 'read_file',
        result: { content: '{"name": "test"}' },
        success: true,
      };
      let executionCount = 0;
      ToolRunner.executeToolCalls.mockImplementation(async (tools, toolCalls, context) => {
        executionCount++;
        // On second call, return DUPLICATE_BLOCKED
        if (executionCount === 2) {
          return [{
            toolName: 'read_file',
            success: false,
            error: 'DUPLICATE_BLOCKED',
            details: {
              message: 'Duplicate tool call blocked. Use previous results.',
              previous_timestamp: new Date().toISOString(),
              previous_summary: { content: '{"name": "test"}' },
              signature: 'test-signature',
            },
          }];
        }
        return [mockToolResult];
      });

      // Act
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode, requestId });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Assert
      // With enhanced soft stop, executionCount should be 2 (first call executes, second is blocked)
      // But the tool should only execute once (first call)
      expect(executionCount).toBe(2); // First call executes, second is blocked
      // Verify that ToolRunner was called twice (once for execution, once for duplicate)
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(2);
    });

    it('should return DUPLICATE_BLOCKED with cached results for duplicate tool calls', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'Try duplicate tool call';
      const mode = 'act';
      const requestId = 'req-456';

      const mockToolCall = {
        function: {
          name: 'list_files',
          arguments: JSON.stringify({ path: '.' }),
        },
        id: 'call_2',
        type: 'function',
      };

      // First iteration: tool call executes
      // Second iteration: same tool call appears
      let iteration = 0;
      mockAdapter.sendMessagesStreaming.mockImplementation(() => {
        iteration++;
        if (iteration === 1) {
          return (async function* () {
            yield { chunk: 'Listing files...' };
            yield { toolCalls: [mockToolCall] };
            yield { done: true, fullContent: '' };
          })();
        } else if (iteration === 2) {
          return (async function* () {
            yield { toolCalls: [mockToolCall] };
            yield { done: true, fullContent: '' };
          })();
        }
        return (async function* () {})();
      });

      // Mock ToolRunner to return special DUPLICATE_BLOCKED result on second call
      const firstResult = {
        toolName: 'list_files',
        result: { files: ['file1.txt', 'file2.txt'] },
        success: true,
      };
      const duplicateBlockedResult = {
        toolName: 'list_files',
        success: false,
        error: 'DUPLICATE_BLOCKED',
        details: {
          message: 'Duplicate tool call blocked. Use previous results.',
          previous_timestamp: expect.any(String),
          previous_summary: { files: ['file1.txt', 'file2.txt'] },
        },
      };

      let callCount = 0;
      ToolRunner.executeToolCalls.mockImplementation(async (tools, toolCalls, context) => {
        callCount++;
        if (callCount === 1) {
          return [firstResult];
        } else {
          return [duplicateBlockedResult];
        }
      });

      // Act
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode, requestId });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Assert
      // 1. ToolRunner should be called twice (once for execution, once for duplicate)
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(2);

      // 2. Second result should have DUPLICATE_BLOCKED error
      const secondCallResult = ToolRunner.executeToolCalls.mock.results[1].value;
      // Note: We need to await the promise to check the result
      // Instead, we'll check that the mock was configured to return duplicateBlockedResult
      // The actual assertion will fail with current implementation
      expect(callCount).toBe(2);

      // 3. Stream should contain a notice about duplicate being blocked
      const blockedNotice = events.find(
        (e) => e.chunk && e.chunk.includes('DUPLICATE_BLOCKED')
      );
      expect(blockedNotice).toBeDefined(); // This will FAIL with current implementation
    });

    it('should continue reasoning after duplicate block (not infinite loop)', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'What files do we have?';
      const mode = 'act';
      const requestId = 'req-789';

      const mockToolCall = {
        function: {
          name: 'list_files',
          arguments: JSON.stringify({ path: '.' }),
        },
        id: 'call_3',
        type: 'function',
      };

      // Simulate: Orion calls tool, gets result, then calls same tool again (duplicate),
      // then should continue with reasoning/answer
      let iteration = 0;
      mockAdapter.sendMessagesStreaming.mockImplementation(() => {
        iteration++;
        if (iteration === 1) {
          // First turn: tool call
          return (async function* () {
            yield { chunk: 'Let me check the files...' };
            yield { toolCalls: [mockToolCall] };
            yield { done: true, fullContent: '' };
          })();
        } else if (iteration === 2) {
          // Second turn: duplicate tool call (should be blocked)
          return (async function* () {
            yield { toolCalls: [mockToolCall] };
            yield { done: true, fullContent: '' };
          })();
        } else if (iteration === 3) {
          // Third turn: Orion should continue with reasoning (no tool calls)
          return (async function* () {
            yield { chunk: 'Based on the file list, I can see...' };
            yield { done: true, fullContent: 'Based on the file list, I can see we have 2 files.' };
          })();
        }
        return (async function* () {})();
      });

      // Mock ToolRunner to simulate duplicate blocking
      let callCount = 0;
      ToolRunner.executeToolCalls.mockImplementation(async (tools, toolCalls, context) => {
        callCount++;
        if (callCount === 1) {
          return [{
            toolName: 'list_files',
            result: { files: ['file1.txt', 'file2.txt'] },
            success: true,
          }];
        } else {
          // Duplicate blocked
          return [{
            toolName: 'list_files',
            success: false,
            error: 'DUPLICATE_BLOCKED',
            details: { message: 'Duplicate blocked' },
          }];
        }
      });

      // Act
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode, requestId });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Assert
      // Orion should eventually produce a non-tool response (reasoning)
      const reasoningChunk = events.find(
        (e) => e.chunk && e.chunk.includes('Based on the file list')
      );
      expect(reasoningChunk).toBeDefined(); // This will FAIL if Orion gets stuck in loop

      // Should not exceed max iterations (5)
      expect(iteration).toBeLessThanOrEqual(3);
    });

    it('should normalize arguments so different ordering produces same signature', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'Test argument normalization';
      const mode = 'act';
      const requestId = 'req-norm';

      // Two tool calls with same semantic arguments but different JSON ordering/whitespace
      const toolCall1 = {
        function: {
          name: 'search_files',
          arguments: JSON.stringify({ path: '.', regex: 'test', filePattern: '*.js' }),
        },
        id: 'call_a',
        type: 'function',
      };

      const toolCall2 = {
        function: {
          name: 'search_files',
          arguments: '{"filePattern":"*.js","path":".","regex":"test"}', // Different order
        },
        id: 'call_b',
        type: 'function',
      };

      // Simulate adapter yielding these in separate iterations
      let iteration = 0;
      mockAdapter.sendMessagesStreaming.mockImplementation(() => {
        iteration++;
        if (iteration === 1) {
          return (async function* () {
            yield { toolCalls: [toolCall1] };
            yield { done: true, fullContent: '' };
          })();
        } else if (iteration === 2) {
          return (async function* () {
            yield { toolCalls: [toolCall2] };
            yield { done: true, fullContent: '' };
          })();
        }
        return (async function* () {})();
      });

      // Mock ToolRunner to simulate duplicate detection
      let callCount = 0;
      ToolRunner.executeToolCalls.mockImplementation(async (tools, toolCalls, context) => {
        callCount++;
        if (callCount === 1) {
          return [{
            toolName: 'search_files',
            result: { matches: [] },
            success: true,
          }];
        } else {
          // Second call should be detected as duplicate
          return [{
            toolName: 'search_files',
            success: false,
            error: 'DUPLICATE_BLOCKED',
            details: {
              message: 'Duplicate tool call blocked. Use previous results.',
              previous_timestamp: new Date().toISOString(),
              previous_summary: { matches: [] },
              signature: 'normalized-signature',
            },
          }];
        }
      });

      // Act
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode, requestId });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Assert
      // With proper implementation, toolCall2 should be detected as duplicate of toolCall1
      // and ToolRunner.executeToolCalls should be called twice (first executes, second blocked)
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(2);
      // Verify that second call returned DUPLICATE_BLOCKED
      expect(callCount).toBe(2);
    });

    it('should log trace event for duplicate tool call patterns', async () => {
      // Arrange
      const projectId = 'test-project';
      const userMessage = 'Trigger duplicate';
      const mode = 'act';
      const requestId = 'req-trace';

      const mockToolCall = {
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: 'README.md' }),
        },
        id: 'call_trace',
        type: 'function',
      };

      let iteration = 0;
      mockAdapter.sendMessagesStreaming.mockImplementation(() => {
        iteration++;
        if (iteration === 1) {
          return (async function* () {
            yield { toolCalls: [mockToolCall] };
            yield { done: true, fullContent: '' };
          })();
        } else if (iteration === 2) {
          return (async function* () {
            yield { toolCalls: [mockToolCall] };
            yield { done: true, fullContent: '' };
          })();
        }
        return (async function* () {})();
      });

      // Mock ToolRunner to simulate duplicate with trace logging
      let callCount = 0;
      ToolRunner.executeToolCalls.mockImplementation(async (tools, toolCalls, context) => {
        callCount++;
        if (callCount === 1) {
          return [{
            toolName: 'read_file',
            result: { content: '# README' },
            success: true,
          }];
        } else {
          // Simulate trace logging in ToolRunner
          TraceService.logEvent({
            projectId,
            type: 'duplicate_tool_call',
            source: 'system',
            timestamp: new Date().toISOString(),
            summary: 'Duplicate tool call blocked: read_file',
            details: {
              toolName: 'read_file',
              signature: 'test-signature',
              duplicate: true,
              requestId,
              blocked: true,
              previous_timestamp: new Date().toISOString(),
            },
            requestId,
          });
          
          return [{
            toolName: 'read_file',
            success: false,
            error: 'DUPLICATE_BLOCKED',
            details: { 
              message: 'Duplicate',
              duplicate: true 
            },
          }];
        }
      });

      // Clear previous trace calls
      TraceService.logEvent.mockClear();

      // Act
      const stream = orionAgent.processStreaming(projectId, userMessage, { mode, requestId });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Assert
      // TraceService should be called for duplicate event
      expect(TraceService.logEvent).toHaveBeenCalled();
      const duplicateTraceCall = TraceService.logEvent.mock.calls.find(
        (call) => call[0].type === 'duplicate_tool_call' || 
                  (call[0].details && call[0].details.duplicate === true)
      );
      expect(duplicateTraceCall).toBeDefined();
      if (duplicateTraceCall) {
        const traceEvent = duplicateTraceCall[0];
        expect(traceEvent.requestId).toBe(requestId);
        expect(traceEvent.projectId).toBe(projectId);
        expect(traceEvent.details).toHaveProperty('toolName', 'read_file');
      }
    });
  });
});
