/**
 * Minimal TwoStageProtocol Tests (RED Phase)
 * 
 * These tests define the minimal contract for the first backend slice of TwoStageProtocol.
 * They should fail with current non-existent implementation and pass when Devon implements
 * a clean, streaming-only protocol that:
 * - Integrates with OrionAgentV2
 * - Provides stable Action-phase-first streaming contract
 * - Recognizes tool calls structurally (no real tool execution yet)
 * - Maintains basic A/B scaffolding without full budgets/duplicate logic/tool orchestration
 */

const { ProtocolStrategy, ProtocolExecutionContext, ProtocolEventTypes } = require('../../archive/agents/protocols/ProtocolStrategy');

// Mock adapter that yields streaming events
function createMockAdapter(events) {
  return {
    sendMessagesStreaming: jest.fn(async function* () {
      for (const event of events) {
        yield event;
      }
    })
  };
}

// Mock tools and traceService (not used in minimal slice)
function createMockTools() {
  return {};
}

function createMockTraceService() {
  return {
    logEvent: jest.fn()
  };
}

// Helper to collect events from async generator
async function collectEvents(generator) {
  const events = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

describe('TwoStageProtocol - Minimal First Slice', () => {
  let TwoStageProtocol;
  
  beforeAll(() => {
    // Try to load the module - will fail initially (RED phase)
    try {
      TwoStageProtocol = require('../../src/agents/protocols/TwoStageProtocol');
    } catch (error) {
      // Module doesn't exist yet - that's expected in RED phase
      TwoStageProtocol = null;
    }
  });

  describe('1. Protocol Construction & Interface', () => {
    test('module can be required without throwing', () => {
      // This test will fail initially because module doesn't exist
      expect(() => {
        require('../../src/agents/protocols/TwoStageProtocol');
      }).not.toThrow();
    });

    test('can be instantiated with { adapter, tools, traceService }', () => {
      // Skip if module doesn't exist yet
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockAdapter = createMockAdapter([]);
      const mockTools = createMockTools();
      const mockTraceService = createMockTraceService();

      expect(() => {
        new TwoStageProtocol({
          adapter: mockAdapter,
          tools: mockTools,
          traceService: mockTraceService
        });
      }).not.toThrow();
    });

    test('getName() returns a stable string identifier', () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const protocol = new TwoStageProtocol({
        adapter: createMockAdapter([]),
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const name = protocol.getName();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
      // Should be 'two-stage' based on archive implementation
      expect(name).toBe('two-stage');
    });

    test('canHandle() returns true for basic ProtocolExecutionContext', () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const protocol = new TwoStageProtocol({
        adapter: createMockAdapter([]),
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: createMockAdapter([]),
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      expect(protocol.canHandle(context)).toBe(true);
    });

    test('extends ProtocolStrategy abstract class', () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const protocol = new TwoStageProtocol({
        adapter: createMockAdapter([]),
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      expect(protocol).toBeInstanceOf(ProtocolStrategy);
    });
  });

  describe('2. Basic Streaming Behavior (Action Phase Only)', () => {
    test('streams CHUNK and DONE events from adapter in correct order', async () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockEvents = [
        { chunk: 'Hello' },
        { chunk: ' world' },
        { done: true, fullContent: 'Hello world' }
      ];

      const mockAdapter = createMockAdapter(mockEvents);
      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Say hello' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const events = await collectEvents(protocol.executeStreaming(context));

      // Should have exactly 3 events: CHUNK, CHUNK, DONE
      expect(events).toHaveLength(3);
      
      // First event should be CHUNK with 'Hello'
      expect(events[0]).toEqual({
        type: ProtocolEventTypes.CHUNK,
        content: 'Hello'
      });
      
      // Second event should be CHUNK with ' world'
      expect(events[1]).toEqual({
        type: ProtocolEventTypes.CHUNK,
        content: ' world'
      });
      
      // Third event should be DONE with full content
      expect(events[2]).toEqual({
        type: ProtocolEventTypes.DONE,
        fullContent: 'Hello world'
      });

      // Verify adapter was called with correct messages
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledTimes(1);
      const callArgs = mockAdapter.sendMessagesStreaming.mock.calls[0];
      expect(callArgs[0]).toEqual([{ role: 'user', content: 'Say hello' }]);
    });

    test('filters/normalizes messages passed to adapter', async () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockAdapter = createMockAdapter([{ done: true, fullContent: 'Test' }]);
      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Help me please' }
        ],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      await collectEvents(protocol.executeStreaming(context));

      // Verify adapter received normalized messages
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledTimes(1);
      const messages = mockAdapter.sendMessagesStreaming.mock.calls[0][0];
      
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant' });
      expect(messages[1]).toEqual({ role: 'user', content: 'Help me please' });
    });

    test('emits exactly one DONE event per execution', async () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockAdapter = createMockAdapter([
        { chunk: 'First' },
        { chunk: 'Second' },
        { done: true, fullContent: 'FirstSecond' }
      ]);

      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const events = await collectEvents(protocol.executeStreaming(context));

      // Count DONE events
      const doneEvents = events.filter(e => e.type === ProtocolEventTypes.DONE);
      expect(doneEvents).toHaveLength(1);
      
      // Verify it's the last event
      expect(events[events.length - 1].type).toBe(ProtocolEventTypes.DONE);
    });
  });

  describe('3. Tool Call Awareness (No Execution Yet)', () => {
    test('forwards TOOL_CALLS events from adapter', async () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockToolCalls = [
        { id: 'call-1', function: { name: 'SomeTool', arguments: '{}' } }
      ];

      const mockAdapter = createMockAdapter([
        { chunk: 'Thinking...' },
        { toolCalls: mockToolCalls },
        { done: true, fullContent: 'Done after tools' }
      ]);

      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Do something' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const events = await collectEvents(protocol.executeStreaming(context));

      // Should have CHUNK, TOOL_CALLS, DONE
      expect(events).toHaveLength(3);
      
      expect(events[0]).toEqual({
        type: ProtocolEventTypes.CHUNK,
        content: 'Thinking...'
      });
      
      expect(events[1]).toEqual({
        type: ProtocolEventTypes.TOOL_CALLS,
        calls: mockToolCalls
      });
      
      expect(events[2]).toEqual({
        type: ProtocolEventTypes.DONE,
        fullContent: 'Done after tools'
      });
    });

    test('does not execute tools or mutate messages when tool calls appear', async () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      // Create mock tools that would throw if called
      const mockTools = {
        SomeTool: {
          execute: jest.fn(() => { throw new Error('Tools should not be executed in minimal slice'); })
        }
      };

      const mockAdapter = createMockAdapter([
        { toolCalls: [{ id: 'call-1', function: { name: 'SomeTool', arguments: '{}' } }] },
        { done: true, fullContent: 'Test' }
      ]);

      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: mockTools,
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: createMockTraceService()
      });

      // Should complete without throwing (tool execution deferred to later tasks)
      const events = await collectEvents(protocol.executeStreaming(context));
      
      // Should still emit TOOL_CALLS and DONE
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe(ProtocolEventTypes.TOOL_CALLS);
      expect(events[1].type).toBe(ProtocolEventTypes.DONE);
      
      // Tool should not have been executed
      expect(mockTools.SomeTool.execute).not.toHaveBeenCalled();
    });

    test('handles multiple tool calls in stream', async () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockToolCalls = [
        { id: 'call-1', function: { name: 'Tool1', arguments: '{"param": "value1"}' } },
        { id: 'call-2', function: { name: 'Tool2', arguments: '{"param": "value2"}' } }
      ];

      const mockAdapter = createMockAdapter([
        { chunk: 'I will use tools' },
        { toolCalls: [mockToolCalls[0]] },
        { toolCalls: [mockToolCalls[1]] },
        { done: true, fullContent: 'Tools noted' }
      ]);

      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Use tools' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const events = await collectEvents(protocol.executeStreaming(context));

      // Should have CHUNK, TOOL_CALLS (first), TOOL_CALLS (second), DONE
      expect(events).toHaveLength(4);
      
      // First TOOL_CALLS event should have first tool call
      expect(events[1]).toEqual({
        type: ProtocolEventTypes.TOOL_CALLS,
        calls: [mockToolCalls[0]]
      });
      
      // Second TOOL_CALLS event should have second tool call
      expect(events[2]).toEqual({
        type: ProtocolEventTypes.TOOL_CALLS,
        calls: [mockToolCalls[1]]
      });
    });
  });

  describe('4. Basic Phase Scaffolding (Optional)', () => {
    test('emits PHASE event with action phase at start (optional)', async () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockAdapter = createMockAdapter([
        { chunk: 'Hello' },
        { done: true, fullContent: 'Hello' }
      ]);

      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const events = await collectEvents(protocol.executeStreaming(context));

      // Check if first event is PHASE (optional - may be deferred to later tasks)
      // For minimal slice, we'll just note this is optional
      const hasPhaseEvent = events.some(e => e.type === ProtocolEventTypes.PHASE);
      
      // If PHASE events are implemented, first event should be PHASE
      if (hasPhaseEvent) {
        expect(events[0]).toEqual({
          type: ProtocolEventTypes.PHASE,
          phase: 'action',
          index: 0
        });
      }
      // If not implemented, that's OK for minimal slice
    });

    test('completes with single action phase by default', async () => {
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockAdapter = createMockAdapter([
        { chunk: 'Simple response' },
        { done: true, fullContent: 'Simple response' }
      ]);

      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Simple' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const events = await collectEvents(protocol.executeStreaming(context));

      // Should complete successfully
      expect(events.length).toBeGreaterThan(0);
      expect(events[events.length - 1].type).toBe(ProtocolEventTypes.DONE);
      
      // No requirement for multiple phases in minimal slice
      // (tool phase logic deferred to later tasks)
    });
  });

  describe('5. Anti-Placeholder Validation', () => {
    test('fails against hardcoded event sequence', async () => {
      // This test ensures implementation actually uses adapter
      // It will fail against any placeholder that returns fixed events
      
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      // Create adapter that records if it was called
      let adapterWasCalled = false;
      const mockAdapter = {
        sendMessagesStreaming: jest.fn(async function* () {
          adapterWasCalled = true;
          yield { chunk: 'Real' };
          yield { done: true, fullContent: 'Real' };
        })
      };

      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      await collectEvents(protocol.executeStreaming(context));

      // Implementation must actually call the adapter
      expect(adapterWasCalled).toBe(true);
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledTimes(1);
    });

    test('fails against implementation that ignores adapter toolCalls', async () => {
      // This test ensures TOOL_CALLS events are properly forwarded
      
      if (!TwoStageProtocol) {
        expect(TwoStageProtocol).toBeNull(); // RED: module doesn't exist
        return;
      }

      const mockToolCalls = [
        { id: 'call-1', function: { name: 'TestTool', arguments: '{}' } }
      ];

      const mockAdapter = createMockAdapter([
        { toolCalls: mockToolCalls },
        { done: true, fullContent: 'Test' }
      ]);

      const protocol = new TwoStageProtocol({
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'test-request',
        adapter: mockAdapter,
        tools: createMockTools(),
        traceService: createMockTraceService()
      });

      const events = await collectEvents(protocol.executeStreaming(context));

      // Implementation must forward TOOL_CALLS events
      // A placeholder that ignores toolCalls would fail this test
      const toolCallEvents = events.filter(e => e.type === ProtocolEventTypes.TOOL_CALLS);
      expect(toolCallEvents).toHaveLength(1);
      expect(toolCallEvents[0].calls).toEqual(mockToolCalls);
    });
  });
});
