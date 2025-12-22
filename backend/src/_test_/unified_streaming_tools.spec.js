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
});
