/**
 * @jest-environment node
 *
 * PROTO-002 – StandardProtocol handling of Reasoner streaming + reasoning
 * PROTO-003 – StandardProtocol delegation to ToolRunner
 *
 * Tests for StandardProtocol that verify:
 * 1. It correctly consumes adapter streaming output including reasoning_content.
 * 2. It exposes/logs reasoning via protocol events and TraceService.
 * 3. It delegates tool execution to ToolRunner.
 */

// We test the real StandardProtocol implementation.
const StandardProtocol = require('../../agents/protocols/StandardProtocol');

// Mock only the external collaborators we don’t want to hit for real.
jest.mock('../../../tools/ToolRunner');
jest.mock('../../services/trace/TraceService', () => ({
  logEvent: jest.fn(),
}));

const ToolRunner = require('../../../tools/ToolRunner');
const TraceService = require('../../services/trace/TraceService');

describe('PROTO-002: StandardProtocol handling of Reasoner streaming', () => {
  let mockAdapter;
  let mockTraceService;
  let mockTools;
  let standardProtocol;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAdapter = {
      sendMessagesStreaming: jest.fn(),
    };
    mockTraceService = {
      logEvent: jest.fn(),
    };
    mockTools = {};

    // Real StandardProtocol instance under test
    standardProtocol = new StandardProtocol({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
    });
  });

  describe('Streaming adapter integration with reasoning', () => {
    test('should yield CHUNK events for content and accumulate reasoning', async () => {
      // Arrange: a mock adapter stream that yields reasoning and content
      const mockStreamEvents = [
        { reasoningChunk: 'Let me think...' },
        { chunk: 'Hello' },
        { reasoningChunk: ' more thinking' },
        { chunk: ' world' },
        { done: true, fullContent: 'Hello world', fullReasoning: 'Let me think... more thinking' },
      ];

      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        for (const event of mockStreamEvents) {
          yield event;
        }
      });

      // Act: call executeStreaming
      const context = {
        messages: [{ role: 'user', content: 'Hi' }],
        mode: 'plan',
        projectId: 'test-project',
        requestId: 'req-123',
        tools: mockTools,
        traceService: mockTraceService,
      };

      const events = [];
      for await (const event of standardProtocol.executeStreaming(context)) {
        events.push(event);
      }

      // Assert: we should have received CHUNK and DONE events
      expect(events).toContainEqual({ type: 'CHUNK', content: 'Hello' });
      expect(events).toContainEqual({ type: 'CHUNK', content: ' world' });
      const doneEvent = events.find(e => e.type === 'DONE');
      expect(doneEvent).toBeDefined();
      expect(doneEvent.fullContent).toBe('Hello world');
      expect(doneEvent.fullReasoning).toBe('Let me think... more thinking');
    });

    test('should log reasoning in trace events', async () => {
      const mockStreamEvents = [
        { reasoningChunk: 'thinking' },
        { chunk: 'answer' },
        { done: true, fullContent: 'answer', fullReasoning: 'thinking' },
      ];

      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        for (const event of mockStreamEvents) {
          yield event;
        }
      });

      const context = {
        messages: [{ role: 'user', content: 'Hi' }],
        mode: 'plan',
        projectId: 'test-project',
        requestId: 'req-123',
        tools: mockTools,
        traceService: mockTraceService,
      };

      for await (const _ of standardProtocol.executeStreaming(context)) {
        // just drain the stream
      }

      // Verify trace logging got reasoning
      expect(mockTraceService.logEvent).toHaveBeenCalled();
      const call = mockTraceService.logEvent.mock.calls.find(([arg]) => arg.type === 'llm_call');
      expect(call).toBeDefined();
      const traceEvent = call[0];
      expect(traceEvent.details.reasoning).toBe('thinking');
      expect(traceEvent.details.content).toBe('answer');
      expect(traceEvent.mode || traceEvent.details.mode).toBe('plan');
    });
  });

  describe('Non-Reasoner adapters', () => {
    test('should not include reasoning field in trace events when adapter yields no reasoning', async () => {
      const mockStreamEvents = [
        { chunk: 'answer' },
        { done: true, fullContent: 'answer' },
      ];

      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        for (const event of mockStreamEvents) {
          yield event;
        }
      });

      const context = {
        messages: [{ role: 'user', content: 'Hi' }],
        mode: 'plan',
        projectId: 'test-project',
        requestId: 'req-123',
        tools: mockTools,
        traceService: mockTraceService,
      };

      for await (const _ of standardProtocol.executeStreaming(context)) {}

      expect(mockTraceService.logEvent).toHaveBeenCalled();
      const call = mockTraceService.logEvent.mock.calls.find(([arg]) => arg.type === 'llm_call');
      const traceEvent = call[0];
      expect(traceEvent.details.reasoning).toBeUndefined(); // or toBeNull(), depending on design
    });
  });
});

describe('PROTO-003: StandardProtocol delegation to ToolRunner', () => {
  let mockAdapter;
  let mockTraceService;
  let mockTools;
  let standardProtocol;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAdapter = {
      sendMessagesStreaming: jest.fn(),
    };
    mockTraceService = {
      logEvent: jest.fn(),
    };
    mockTools = {};

    standardProtocol = new StandardProtocol({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
    });
  });

  test('should delegate tool calls to ToolRunner with correct context', async () => {
    const mockToolCalls = [
      { id: 'call1', function: { name: 'DatabaseTool_get_feature_overview', arguments: '{}' } },
    ];

    const mockStreamEvents = [
      { chunk: 'I will use a tool' },
      { toolCalls: mockToolCalls },
      { done: true, fullContent: 'I used a tool' },
    ];

    mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
      for (const event of mockStreamEvents) {
        yield event;
      }
    });

    const mockToolResults = [{
      toolName: 'DatabaseTool_get_feature_overview',
      success: true,
      result: 'tool result',
    }];
    ToolRunner.executeToolCalls.mockResolvedValue(mockToolResults);

    const context = {
      messages: [{ role: 'user', content: 'Use a tool' }],
      mode: 'act',
      projectId: 'test-project',
      requestId: 'req-456',
      tools: mockTools,
      traceService: mockTraceService,
    };

    const events = [];
    for await (const event of standardProtocol.executeStreaming(context)) {
      events.push(event);
    }

    // Verify ToolRunner was called with correct arguments
    expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(1);
    expect(ToolRunner.executeToolCalls).toHaveBeenCalledWith(
      mockTools,
      mockToolCalls,
      { projectId: 'test-project', requestId: 'req-456' },
    );

    // Verify that a TOOL_RESULTS event was yielded (or appropriate handling)
    // Note: The exact event shape is up to the implementation; we can adjust.
    const toolResultsEvent = events.find(e => e.type === 'TOOL_RESULTS');
    expect(toolResultsEvent).toBeDefined();
    expect(toolResultsEvent.results).toEqual(mockToolResults);
  });

  test('should handle duplicate tool calls via ToolRunner duplicate detection', async () => {
    const mockToolCalls = [
      { id: 'call1', function: { name: 'DatabaseTool_get_feature_overview', arguments: '{}' } },
    ];

    const mockStreamEvents = [
      { toolCalls: mockToolCalls },
      { toolCalls: mockToolCalls }, // duplicate event
      { done: true, fullContent: 'done' },
    ];

    mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
      for (const event of mockStreamEvents) {
        yield event;
      }
    });

    ToolRunner.executeToolCalls.mockResolvedValue([]);

    const context = {
      messages: [{ role: 'user', content: 'Use a tool' }],
      mode: 'act',
      projectId: 'test-project',
      requestId: 'req-789',
      tools: mockTools,
      traceService: mockTraceService,
    };

    for await (const _ of standardProtocol.executeStreaming(context)) {}

    // Depending on the design, we can require either:
    // - exactly one ToolRunner call (StandardProtocol dedupes), or
    // - two calls (StandardProtocol forwards all and ToolRunner does dedupe).
    // The checklist suggests relying on ToolRunner for dedupe, so we'll assert two calls.
    expect(ToolRunner.executeToolCalls).toHaveBeenCalledTimes(2);
  });
});
