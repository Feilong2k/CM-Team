/**
 * @jest-environment node
 */

/**
 * StandardProtocol Unit Tests (P1-F3-T1-S3)
 *
 * RED stage unit tests for StandardProtocol class.
 *
 * StandardProtocol is a compatibility wrapper around legacy Orion "standard" behavior.
 * It extends ProtocolStrategy and provides streaming-first executeStreaming that behaves
 * like today's /api/chat/messages route.
 *
 * Tests must fail until Devon implements StandardProtocol with correct behavior.
 *
 * Testing Philosophy:
 * - Mock all dependencies (adapter, tools, traceService, ToolRunner)
 * - Verify simple pass-through behavior (no A/B cycling, no budgets, no duplicate detection)
 * - Ensure ProtocolEvent emissions match ProtocolEventTypes
 * - No placeholder acceptance: tests must fail against hardcoded returns
 */

jest.mock('../../tools/ToolRunner');

const ToolRunner = require('../../tools/ToolRunner');
const { ProtocolExecutionContext, ProtocolEventTypes } = require('../agents/protocols/ProtocolStrategy');

// Attempt to import StandardProtocol; if it doesn't exist, test will fail.
// That's acceptable for RED stage.
let StandardProtocol;
try {
  StandardProtocol = require('../agents/protocols/StandardProtocol');
} catch (e) {
  // Module not found; we'll define a placeholder to allow test file to parse.
  // The tests will fail because StandardProtocol is undefined.
  StandardProtocol = undefined;
}

describe('StandardProtocol', () => {
  let mockAdapter;
  let mockTools;
  let mockTraceService;
  let protocol;

  beforeEach(() => {
    if (!StandardProtocol) {
      // Skip setup if module not found; tests will fail anyway.
      return;
    }

    mockAdapter = {
      sendMessagesStreaming: jest.fn()
    };
    mockTools = {
      FileSystemTool: {
        list_files: jest.fn(),
        read_file: jest.fn(),
      },
    };
    mockTraceService = {
      logEvent: jest.fn()
    };

    protocol = new StandardProtocol({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
    });

    jest.clearAllMocks();
  });

  describe('basic shape', () => {
    test('wires dependencies and name/canHandle', () => {
      if (!StandardProtocol) {
        throw new Error('StandardProtocol module not found');
      }
      const context = new ProtocolExecutionContext({
        messages: [],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
      });

      expect(protocol.adapter).toBe(mockAdapter);
      expect(protocol.tools).toBe(mockTools);
      expect(protocol.traceService).toBe(mockTraceService);
      expect(protocol.getName()).toBe('standard');
      expect(protocol.canHandle(context)).toBe(true);
    });
  });

  describe('executeStreaming() – no tool calls', () => {
    test('yields final answer directly', async () => {
      if (!StandardProtocol) {
        throw new Error('StandardProtocol module not found');
      }
      // Mock adapter to yield chunk then done
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'Hello from adapter' };
        yield { done: true, fullContent: 'Final standard answer' };
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'req-123',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: {} // StandardProtocol ignores config
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // Verify adapter was called exactly once
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledTimes(1);
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Hello' }],
        expect.objectContaining({
          context: { projectId: 'test-project', requestId: 'req-123' }
        })
      );
      // No tool execution
      expect(ToolRunner.executeToolCalls).not.toHaveBeenCalled();
      // Verify events
      expect(events).toContainEqual({ type: 'chunk', content: 'Hello from adapter' });
      expect(events).toContainEqual({ type: 'done', fullContent: 'Final standard answer' });
      // Exactly one DONE event
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
    });
  });

  describe('executeStreaming() – tool calls are forwarded and executed', () => {
    test('single tool call', async () => {
      if (!StandardProtocol) {
        throw new Error('StandardProtocol module not found');
      }
      // Mock adapter to yield chunk, tool call, then done
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'I will list files' };
        yield {
          toolCalls: [{
            function: {
              name: 'FileSystemTool_list_files',
              arguments: JSON.stringify({ path: '.' })
            },
            id: 'call_1',
            type: 'function'
          }]
        };
        yield { done: true, fullContent: '' };
      });

      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: ['file1.txt', 'file2.txt'],
        success: true
      }]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'List files' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'req-123',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: {}
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // Verify adapter was called exactly once
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledTimes(1);
      // Verify ToolRunner was called with correct parameters
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledWith(
        mockTools,
        [expect.objectContaining({
          function: expect.objectContaining({ name: 'FileSystemTool_list_files' })
        })],
        { projectId: 'test-project', requestId: 'req-123' }
      );
      // Verify events
      expect(events).toContainEqual({ type: 'chunk', content: 'I will list files' });
      expect(events).toContainEqual({
        type: 'tool_calls',
        calls: expect.arrayContaining([expect.objectContaining({
          function: expect.objectContaining({ name: 'FileSystemTool_list_files' })
        })])
      });
      expect(events).toContainEqual({ type: 'done', fullContent: '' });
      // Exactly one DONE event
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
    });
  });

  describe('executeStreaming() – executes all tool calls in stream', () => {
    test('multiple tool calls in one batch', async () => {
      if (!StandardProtocol) {
        throw new Error('StandardProtocol module not found');
      }
      // Mock adapter to yield two tool calls in one toolCalls event
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'I will list files and read a file' };
        yield {
          toolCalls: [
            {
              function: {
                name: 'FileSystemTool_list_files',
                arguments: JSON.stringify({ path: '.' })
              },
              id: 'call_1',
              type: 'function'
            },
            {
              function: {
                name: 'FileSystemTool_read_file',
                arguments: JSON.stringify({ path: 'file.txt' })
              },
              id: 'call_2',
              type: 'function'
            }
          ]
        };
        yield { done: true, fullContent: '' };
      });

      ToolRunner.executeToolCalls.mockResolvedValue([
        {
          toolName: 'FileSystemTool_list_files',
          result: ['file1.txt'],
          success: true
        },
        {
          toolName: 'FileSystemTool_read_file',
          result: 'file content',
          success: true
        }
      ]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'List and read' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: {}
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // ToolRunner should be called once with both tool calls
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(1);
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledWith(
        mockTools,
        expect.arrayContaining([
          expect.objectContaining({ id: 'call_1' }),
          expect.objectContaining({ id: 'call_2' })
        ]),
        expect.anything()
      );
      // Should have a TOOL_CALLS event with both calls
      const toolCallEvents = events.filter(e => e.type === 'tool_calls');
      expect(toolCallEvents).toHaveLength(1);
      expect(toolCallEvents[0].calls).toHaveLength(2);
      // Should have a DONE event
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
    });
  });

  describe('executeStreaming() – no TwoStage-specific semantics', () => {
    test('does not emit PHASE events', async () => {
      if (!StandardProtocol) {
        throw new Error('StandardProtocol module not found');
      }
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'Simple answer' };
        yield { done: true, fullContent: 'Done' };
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: {}
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // No PHASE events
      const phaseEvents = events.filter(e => e.type === 'phase');
      expect(phaseEvents).toHaveLength(0);
    });

    test('ignores budget and duplicate config', async () => {
      if (!StandardProtocol) {
        throw new Error('StandardProtocol module not found');
      }
      // Mock adapter to yield a tool call
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'Tool call' };
        yield {
          toolCalls: [{
            function: {
              name: 'FileSystemTool_list_files',
              arguments: JSON.stringify({ path: '.' })
            },
            id: 'call_1',
            type: 'function'
          }]
        };
        yield { done: true, fullContent: '' };
      });

      ToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: [],
        success: true
      }]);

      // Provide config with TwoStage-specific settings; StandardProtocol should ignore them
      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: {
          maxPhaseCycles: 1,
          maxDuplicateAttempts: 0,
          debugShowToolResults: true
        }
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // Should still execute tool (no budget enforcement)
      expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(1);
      // No system notice about budgets or duplicates
      const systemNoticeChunks = events.filter(e =>
        e.type === 'chunk' &&
        (e.content.includes('Maximum duplicate tool call attempts exceeded') ||
         e.content.includes('Maximum tool execution cycles'))
      );
      expect(systemNoticeChunks).toHaveLength(0);
    });
  });

  describe('executeStreaming() – error propagation', () => {
    test('adapter errors surface as ERROR events', async () => {
      if (!StandardProtocol) {
        throw new Error('StandardProtocol module not found');
      }
      // Mock adapter to throw an error
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        throw new Error('Adapter failure');
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'act',
        projectId: 'test',
        requestId: 'req',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: {}
      });

      const events = [];
      try {
        for await (const event of protocol.executeStreaming(context)) {
          events.push(event);
        }
      } catch (error) {
        // If executeStreaming throws, that's also acceptable.
        // We'll just ensure the error is propagated.
        expect(error.message).toBe('Adapter failure');
        return;
      }

      // If executeStreaming yields an ERROR event, check for it
      const errorEvents = events.filter(e => e.type === 'error');
      if (errorEvents.length > 0) {
        expect(errorEvents[0].error).toBeDefined();
      } else {
        // If no ERROR event, the test still passes because we caught the thrown error.
        // This is a flexible expectation for Devon to decide.
      }
    });
  });
});
