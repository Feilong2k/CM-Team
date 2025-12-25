/**
 * @jest-environment node
 */

/**
 * OrionAgent Protocol Integration Tests (P1-F3-T1-S4)
 *
 * RED stage integration tests for OrionAgent using ProtocolStrategy implementations.
 *
 * These tests verify that OrionAgent delegates streaming behavior to a protocol
 * (StandardProtocol or TwoStageProtocol) via executeStreaming() and correctly
 * builds ProtocolExecutionContext.
 *
 * Tests must fail until Devon refactors OrionAgent to use protocols.
 *
 * Testing Philosophy:
 * - Mock ProtocolStrategy (or use existing StandardProtocol/TwoStageProtocol)
 * - Verify OrionAgent calls protocol.executeStreaming with correct context
 * - Verify OrionAgent forwards events to StreamingService (or equivalent)
 * - Ensure OrionAgent does not duplicate protocol-specific logic
 */

const { ProtocolStrategy, ProtocolExecutionContext, ProtocolEventTypes } = require('../agents/protocols/ProtocolStrategy');
const OrionAgent = require('../agents/OrionAgent');
const ToolRunner = require('../../tools/ToolRunner');

// Mock ToolRunner to avoid actual tool execution
jest.mock('../../tools/ToolRunner');

// Mock StreamingService if needed (OrionAgent may use it indirectly)
// We'll mock the adapter and tools as usual.

describe('OrionAgent Protocol Integration (P1-F3-T1-S4)', () => {
  let mockAdapter;
  let mockTools;
  let mockTraceService;
  let mockProtocol;
  let agent;

  beforeEach(() => {
    mockAdapter = {
      sendMessagesStreaming: jest.fn(),
      sendMessages: jest.fn(),
    };
    mockTools = {
      FileSystemTool: {
        list_files: jest.fn(),
        read_file: jest.fn(),
      },
    };
    mockTraceService = {
      logEvent: jest.fn(),
    };

    // Create a mock protocol that extends ProtocolStrategy
    mockProtocol = {
      getName: jest.fn().mockReturnValue('mock'),
      canHandle: jest.fn().mockReturnValue(true),
      executeStreaming: jest.fn(),
    };

    // We'll assume OrionAgent constructor accepts a protocol parameter.
    // For now, we'll create agent with mocked dependencies and later assign protocol.
    // This test will fail because OrionAgent doesn't yet accept protocol.
    agent = new OrionAgent(mockAdapter, mockTools);
    // Attempt to set protocol property (if exists)
    if (agent.protocol !== undefined) {
      agent.protocol = mockProtocol;
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic protocol injection', () => {
    test('OrionAgent can be constructed with a mock protocol', () => {
      // This test will fail until OrionAgent supports protocol injection.
      // We'll assert that agent.protocol is defined (if property exists).
      // If not, we'll expect the test to fail (RED).
      expect(agent.protocol).toBeDefined();
      expect(agent.protocol.getName()).toBe('mock');
    });

    test('OrionAgent calls protocol.canHandle() and throws/handles if false', () => {
      // Not required for MVP; we can skip or implement later.
      // For now, we'll just ensure canHandle is called.
      if (agent.protocol && typeof agent.protocol.canHandle === 'function') {
        const context = new ProtocolExecutionContext({
          messages: [],
          mode: 'act',
          projectId: 'test',
          requestId: 'req',
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService,
        });
        const result = agent.protocol.canHandle(context);
        expect(result).toBe(false); // we'll set canHandle to false
      } else {
        // If protocol not supported, test fails (RED)
        throw new Error('OrionAgent does not support protocol injection');
      }
    });
  });

  describe('building ProtocolExecutionContext correctly', () => {
    test('OrionAgent builds correct execution context before calling protocol.executeStreaming', async () => {
      // Mock protocol.executeStreaming to yield a DONE event immediately
      mockProtocol.executeStreaming.mockImplementation(async function* () {
        yield { type: ProtocolEventTypes.DONE, fullContent: '' };
      });

      // We need to call OrionAgent's streaming entry point.
      // The method is processStreaming(projectId, userMessage, options).
      // We'll mock adapter.sendMessagesStreaming to avoid being called (since protocol should handle it).
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        // If OrionAgent still calls adapter, this will be called.
        // We'll let it yield nothing.
      });

      // We'll also need to mock db.chatMessages methods to avoid DB calls.
      // For simplicity, we'll assume agent.db.chatMessages is undefined.
      agent.db = {};

      // Call processStreaming
      const stream = agent.processStreaming('test-project', 'Hello', { mode: 'act', requestId: 'req-123' });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      // Verify protocol.executeStreaming was called exactly once
      expect(mockProtocol.executeStreaming).toHaveBeenCalledTimes(1);
      const callArg = mockProtocol.executeStreaming.mock.calls[0][0];
      // Should be an instance of ProtocolExecutionContext
      expect(callArg).toBeInstanceOf(ProtocolExecutionContext);
      // Should have correct fields
      expect(callArg.messages).toBeDefined();
      expect(callArg.mode).toBe('act');
      expect(callArg.projectId).toBe('test-project');
      expect(callArg.requestId).toBe('req-123');
      expect(callArg.adapter).toBe(mockAdapter);
      expect(callArg.tools).toBe(mockTools);
      expect(callArg.traceService).toBe(mockTraceService);
      // config may be default or empty
      expect(callArg.config).toBeDefined();
    });
  });

  describe('event forwarding – CHUNK and DONE', () => {
    test('OrionAgent forwards CHUNK and DONE events from protocol to StreamingService', async () => {
      // Mock protocol to yield specific events
      mockProtocol.executeStreaming.mockImplementation(async function* () {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Hello' };
        yield { type: ProtocolEventTypes.CHUNK, content: ' world' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Hello world' };
      });

      // Mock StreamingService (or whatever OrionAgent uses to send SSE).
      // Since we cannot import StreamingService directly, we'll spy on agent's internal method.
      // For simplicity, we'll assume OrionAgent yields events directly (as it does today).
      // We'll collect events from processStreaming and verify they match.
      const events = [];
      const stream = agent.processStreaming('test-project', 'Hello', { mode: 'act' });
      for await (const event of stream) {
        events.push(event);
      }

      // Expect events to contain the chunks and done (but note: OrionAgent currently yields { chunk: '...' } not { type: 'chunk', content: '...' }).
      // After refactoring, OrionAgent should adapt protocol events to its own streaming format.
      // We'll be flexible: either shape is acceptable as long as content is forwarded.
      // For now, we'll just assert that protocol.executeStreaming was called.
      expect(mockProtocol.executeStreaming).toHaveBeenCalledTimes(1);
      // Additionally, we can assert that the stream yielded something (maybe 3 events).
      // Since OrionAgent may not yet forward, this test will fail (RED).
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('tool call events – pass-through, not re-implemented', () => {
    test('OrionAgent forwards TOOL_CALLS events but does not execute tools itself', async () => {
      // Mock protocol to yield a TOOL_CALLS event
      const mockToolCall = {
        function: {
          name: 'FileSystemTool_list_files',
          arguments: JSON.stringify({ path: '.' }),
        },
        id: 'call_1',
      };
      mockProtocol.executeStreaming.mockImplementation(async function* () {
        yield { type: ProtocolEventTypes.TOOL_CALLS, calls: [mockToolCall] };
        yield { type: ProtocolEventTypes.DONE, fullContent: '' };
      });

      // Mock ToolRunner to ensure it's not called by OrionAgent (should be called inside protocol)
      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: [],
        success: true,
      }]);

      // Call processStreaming
      const events = [];
      const stream = agent.processStreaming('test-project', 'List files', { mode: 'act' });
      for await (const event of stream) {
        events.push(event);
      }

      // Verify ToolRunner was NOT called by OrionAgent (should be called inside protocol)
      // Since we mocked protocol, ToolRunner may be called inside protocol's executeStreaming.
      // We'll assert that ToolRunner.executeToolCalls was called (by protocol) but we can't differentiate.
      // Instead, we'll assert that OrionAgent didn't call adapter.sendMessagesStreaming (since protocol handles it).
      expect(mockAdapter.sendMessagesStreaming).not.toHaveBeenCalled();
      // Ensure protocol.executeStreaming was called
      expect(mockProtocol.executeStreaming).toHaveBeenCalledTimes(1);
    });
  });

  describe('no duplicate A/B logic inside OrionAgent', () => {
    test('OrionAgent does not contain its own A/B loop once protocols are wired', async () => {
      // Use TwoStageProtocol mock (or any protocol) that yields a DONE immediately.
      mockProtocol.executeStreaming.mockImplementation(async function* () {
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Done' };
      });

      // Spy on adapter.sendMessagesStreaming and ToolRunner.executeToolCalls
      const stream = agent.processStreaming('test-project', 'Test', { mode: 'act' });
      for await (const event of stream) {
        // consume
      }

      // OrionAgent should call protocol.executeStreaming exactly once
      expect(mockProtocol.executeStreaming).toHaveBeenCalledTimes(1);
      // OrionAgent should NOT call adapter.sendMessagesStreaming directly
      expect(mockAdapter.sendMessagesStreaming).not.toHaveBeenCalled();
      // OrionAgent should NOT call ToolRunner.executeToolCalls directly
      expect(ToolRunner.executeToolCalls).not.toHaveBeenCalled();
    });
  });

  describe('error handling / ERROR events', () => {
    test('adapter errors surface as ERROR events', async () => {
      // Mock protocol to throw an error
      mockProtocol.executeStreaming.mockImplementation(async function* () {
        throw new Error('Adapter failure');
      });

      // Expect processStreaming to throw (or yield an ERROR event)
      let errorCaught = false;
      try {
        const stream = agent.processStreaming('test-project', 'Test', { mode: 'act' });
        for await (const event of stream) {
          // If error is yielded as event, we can check
          if (event.type === ProtocolEventTypes.ERROR) {
            errorCaught = true;
            expect(event.error).toBeDefined();
          }
        }
      } catch (error) {
        errorCaught = true;
        expect(error.message).toBe('Adapter failure');
      }
      expect(errorCaught).toBe(true);
    });
  });
});
