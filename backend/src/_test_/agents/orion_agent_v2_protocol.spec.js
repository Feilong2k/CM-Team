/**
 * @jest-environment node
 *
 * PROTO-001 – OrionAgentV2 protocol delegation and context construction
 *
 * Tests that verify:
 * 1. OrionAgentV2 delegates streaming execution to the protocol passed in its constructor.
 * 2. OrionAgentV2 builds the correct context (projectId, messages, etc.) for the protocol.
 * 3. The agent does not contain hardcoded responses (anti-placeholder).
 *
 * Note: Protocol selection (StandardProtocol vs TwoStageProtocol) is handled at the route level,
 * not inside OrionAgentV2. This test suite focuses on delegation and context building.
 */

// Mock dependencies
jest.mock('../../agents/protocols/StandardProtocol');
jest.mock('../../agents/protocols/TwoStageProtocol');
jest.mock('../../adapters/index', () => ({
  createAdapter: jest.fn()
}));
jest.mock('../../services/trace/TraceService', () => ({
  getInstance: jest.fn(() => ({
    logEvent: jest.fn()
  }))
}));
jest.mock('../../../tools/registry', () => ({
  getTools: jest.fn(() => ({}))
}));

const OrionAgentV2 = require('../../agents/OrionAgentV2');
const StandardProtocol = require('../../agents/protocols/StandardProtocol');
const TwoStageProtocol = require('../../agents/protocols/TwoStageProtocol');
const { createAdapter } = require('../../adapters/index');
const { getInstance: getTraceService } = require('../../services/trace/TraceService');
const { getTools } = require('../../../tools/registry');

describe('PROTO-001: OrionAgentV2 delegation and context construction', () => {
  let mockAdapter;
  let mockTools;
  let mockTraceService;
  let mockStandardProtocol;
  let mockTwoStageProtocol;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAdapter = {
      sendMessagesStreaming: jest.fn()
    };
    mockTools = {};
    mockTraceService = {
      logEvent: jest.fn()
    };
    mockStandardProtocol = {
      executeStreaming: jest.fn().mockImplementation(async function* () {
        yield { type: 'CHUNK', content: 'Standard protocol response' };
        yield { type: 'DONE', fullContent: 'Standard protocol response' };
      })
    };
    mockTwoStageProtocol = {
      executeStreaming: jest.fn().mockImplementation(async function* () {
        yield { type: 'CHUNK', content: 'Two-stage protocol response' };
        yield { type: 'DONE', fullContent: 'Two-stage protocol response' };
      })
    };

    createAdapter.mockReturnValue(mockAdapter);
    getTraceService.mockReturnValue(mockTraceService);
    getTools.mockReturnValue(mockTools);
    StandardProtocol.mockImplementation(() => mockStandardProtocol);
    TwoStageProtocol.mockImplementation(() => mockTwoStageProtocol);
  });

  describe('Delegation from agent to protocol', () => {
    test('should delegate streaming execution to the provided StandardProtocol', async () => {
      const agent = new OrionAgentV2({
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        protocol: mockStandardProtocol
      });

      const stream = agent.processStreaming('test-project', 'Hello', { mode: 'plan' });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(mockStandardProtocol.executeStreaming).toHaveBeenCalledTimes(1);
      expect(mockTwoStageProtocol.executeStreaming).not.toHaveBeenCalled();
    });

    test('should delegate streaming execution to the provided TwoStageProtocol', async () => {
      const agent = new OrionAgentV2({
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        protocol: mockTwoStageProtocol
      });

      const stream = agent.processStreaming('test-project', 'Hello', { mode: 'plan' });
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(mockTwoStageProtocol.executeStreaming).toHaveBeenCalledTimes(1);
      expect(mockStandardProtocol.executeStreaming).not.toHaveBeenCalled();
    });

    test('OrionAgentV2.processStreaming should delegate to protocol.executeStreaming with correct context', async () => {
      const agent = new OrionAgentV2({
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        protocol: mockStandardProtocol
      });

      const stream = agent.processStreaming('test-project', 'User message', {
        mode: 'act',
        requestId: 'req-123'
      });

      // Consume stream
      for await (const _ of stream) {
        // consume
      }

      expect(mockStandardProtocol.executeStreaming).toHaveBeenCalledTimes(1);
      const context = mockStandardProtocol.executeStreaming.mock.calls[0][0];
      expect(context.projectId).toBe('test-project');
      expect(context.mode).toBe('act');
      expect(context.requestId).toBe('req-123');
      expect(context.adapter).toBe(mockAdapter);
      expect(context.tools).toBe(mockTools);
      expect(context.traceService).toBe(mockTraceService);
      expect(context.messages).toEqual([
        expect.objectContaining({ role: 'system', content: expect.stringContaining('test-project') }),
        expect.objectContaining({ role: 'user', content: 'User message' })
      ]);
    });
  });

  describe('Anti-placeholder validation', () => {
    test('should fail if OrionAgentV2 uses a hardcoded response instead of delegating to protocol', async () => {
      const agent = new OrionAgentV2({
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        protocol: mockStandardProtocol
      });

      const stream = agent.processStreaming('test', 'test', {});
      // If OrionAgentV2 is a placeholder returning e.g., a simple array, this will fail.
      expect(stream[Symbol.asyncIterator]).toBeDefined();

      // Consume stream to ensure it yields events from protocol
      const events = [];
      for await (const event of stream) {
        events.push(event);
      }
      expect(events.length).toBeGreaterThan(0);
      // Ensure events came from protocol mock
      expect(mockStandardProtocol.executeStreaming).toHaveBeenCalled();
    });
  });

  describe('Checklist #4: Temperature policy and project overrides', () => {
    // We'll use a mock adapter that captures the options passed to sendMessagesStreaming
    let capturedOptions;

    beforeEach(() => {
      capturedOptions = null;
      // Override the mock adapter to capture options
      mockAdapter.sendMessagesStreaming = jest.fn().mockImplementation(async function* (messages, options) {
        capturedOptions = options;
        // Yield a minimal stream to satisfy consumption
        yield { chunk: 'test' };
        yield { done: true, fullContent: 'test' };
      });

      // Also override the mock protocol to call the adapter with the context's temperature
      mockStandardProtocol.executeStreaming = jest.fn().mockImplementation(async function* (context) {
        // Simulate the protocol calling the adapter with the temperature from context
        const stream = mockAdapter.sendMessagesStreaming(context.messages, {
          temperature: context.temperature,
          // other options if needed
        });
        for await (const event of stream) {
          yield event;
        }
      });
    });

    describe('TEMP-001: Mode → Temperature mapping in OrionAgentV2', () => {
      test('should use temperature 1.3 for PLAN mode by default', async () => {
        const agent = new OrionAgentV2({
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService,
          protocol: mockStandardProtocol
        });

        await agent.processStreaming('test-project', 'Hello', { mode: 'plan' }).next(); // start the stream

        // The adapter should have been called with temperature 1.3
        expect(capturedOptions).not.toBeNull();
        expect(capturedOptions.temperature).toBe(1.3);
      });

      test('should use temperature 0.0 for ACT mode by default', async () => {
        const agent = new OrionAgentV2({
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService,
          protocol: mockStandardProtocol
        });

        await agent.processStreaming('test-project', 'Hello', { mode: 'act' }).next();

        expect(capturedOptions).not.toBeNull();
        expect(capturedOptions.temperature).toBe(0.0);
      });
    });

    describe('TEMP-002: Project-level temperature override', () => {
      test('should override PLAN temperature when projectConfig provides plan temperature', async () => {
        const agent = new OrionAgentV2({
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService,
          protocol: mockStandardProtocol
        });

        const projectConfig = {
          temperature: {
            plan: 1.5,
            act: 0.2,
          },
        };

        await agent.processStreaming('test-project', 'Hello', { mode: 'plan', projectConfig }).next();

        expect(capturedOptions).not.toBeNull();
        expect(capturedOptions.temperature).toBe(1.5);
      });

      test('should override ACT temperature when projectConfig provides act temperature', async () => {
        const agent = new OrionAgentV2({
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService,
          protocol: mockStandardProtocol
        });

        const projectConfig = {
          temperature: {
            plan: 1.5,
            act: 0.2,
          },
        };

        await agent.processStreaming('test-project', 'Hello', { mode: 'act', projectConfig }).next();

        expect(capturedOptions).not.toBeNull();
        expect(capturedOptions.temperature).toBe(0.2);
      });

      test('should fall back to default temperature when projectConfig does not specify for the mode', async () => {
        const agent = new OrionAgentV2({
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService,
          protocol: mockStandardProtocol
        });

        const projectConfig = {
          temperature: {
            // only plan is specified, act is missing
            plan: 1.8,
          },
        };

        await agent.processStreaming('test-project', 'Hello', { mode: 'act', projectConfig }).next();

        expect(capturedOptions).not.toBeNull();
        // Should fall back to default act temperature 0.0
        expect(capturedOptions.temperature).toBe(0.0);
      });
    });

    describe('TEMP-003: No auto-switch logic based on prompt content', () => {
      test('should not change mode or protocol based on message content', async () => {
        const agent = new OrionAgentV2({
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService,
          protocol: mockStandardProtocol
        });

        const messages = [
          'Just a normal message',
          'Please use tools now',
          'two-stage',
          'plan mode',
        ];

        for (const message of messages) {
          capturedOptions = null;
          await agent.processStreaming('test-project', message, { mode: 'plan' }).next();
          // The mode should remain 'plan' and temperature should be 1.3
          expect(capturedOptions.temperature).toBe(1.3);
        }

        // Also ensure the protocol was called the same number of times as messages
        expect(mockStandardProtocol.executeStreaming).toHaveBeenCalledTimes(messages.length);
        // Ensure no other protocol was instantiated
        expect(TwoStageProtocol).not.toHaveBeenCalled();
      });
    });

    describe('TEMP-004: Maintain protocol selection boundaries', () => {
      test('should not instantiate a new protocol internally', async () => {
        const agent = new OrionAgentV2({
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService,
          protocol: mockStandardProtocol
        });

        await agent.processStreaming('test-project', 'Hello', { mode: 'plan' }).next();

        // OrionAgentV2 should not have constructed any protocol itself
        expect(StandardProtocol).toHaveBeenCalledTimes(0); // because we passed a mock instance
        expect(TwoStageProtocol).toHaveBeenCalledTimes(0);
        // It should have used the provided protocol instance
        expect(mockStandardProtocol.executeStreaming).toHaveBeenCalledTimes(1);
      });
    });
  });
});
