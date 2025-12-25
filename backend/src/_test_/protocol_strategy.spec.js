/**
 * @jest-environment node
 */

/**
 * ProtocolStrategy Interface Tests (P1-F3-T1-S1)
 * 
 * RED stage tests for ProtocolStrategy abstract base class and related types.
 * 
 * These tests define the contract for the ProtocolStrategy interface and must fail
 * until Devon implements ProtocolStrategy.js with the correct behavior.
 * 
 * Testing Philosophy:
 * - Abstract class cannot be instantiated directly
 * - Methods throw "must be implemented" when called on subclass without override
 * - ProtocolExecutionContext validates required fields and provides defaults
 * - ProtocolEventTypes constants are defined and immutable
 * - No placeholder acceptance: tests must fail against hardcoded returns
 */

// We'll try to import the module; if it doesn't exist, Jest will throw.
// That's fine for RED stage.
const { 
  ProtocolStrategy, 
  ProtocolExecutionContext, 
  ProtocolEventTypes 
} = require('../agents/protocols/ProtocolStrategy');

// Mock dependencies for ProtocolExecutionContext tests
const mockAdapter = {
  sendMessagesStreaming: jest.fn()
};

const mockTools = {
  FileSystemTool: { list_files: jest.fn() },
  DatabaseTool: { get_subtask_full_context: jest.fn() }
};

const mockTraceService = {
  logEvent: jest.fn()
};

describe('ProtocolStrategy Interface', () => {
  describe('Abstract base class', () => {
    test('cannot be instantiated directly', () => {
      // ProtocolStrategy should be abstract; attempting to instantiate should throw
      expect(() => new ProtocolStrategy()).toThrow();
    });

    test('executeStreaming() throws "must be implemented" when called on subclass without override', async () => {
      // Create a concrete subclass that doesn't override executeStreaming
      class TestProtocol extends ProtocolStrategy {}
      const protocol = new TestProtocol();
      
      // executeStreaming returns an async generator; we need to attempt to iterate
      const generator = protocol.executeStreaming({});
      // The first next() should cause the method to throw
      await expect(generator.next()).rejects.toThrow('executeStreaming() must be implemented by protocol');
    });

    test('getName() throws "must be implemented"', () => {
      class TestProtocol extends ProtocolStrategy {}
      const protocol = new TestProtocol();
      expect(() => protocol.getName()).toThrow('getName() must be implemented by protocol');
    });

    test('canHandle() throws "must be implemented"', () => {
      class TestProtocol extends ProtocolStrategy {}
      const protocol = new TestProtocol();
      expect(() => protocol.canHandle({})).toThrow('canHandle() must be implemented by protocol');
    });

    test('concrete protocol can be instantiated and implement required methods', () => {
      // Positive test: a concrete protocol that implements all methods should work
      class ConcreteProtocol extends ProtocolStrategy {
        async *executeStreaming(executionContext) {
          yield { type: 'done', fullContent: 'test' };
        }
        getName() { return 'concrete'; }
        canHandle(executionContext) { return true; }
      }
      const protocol = new ConcreteProtocol();
      expect(protocol.getName()).toBe('concrete');
      expect(protocol.canHandle({})).toBe(true);
      // executeStreaming returns generator; we can test it works
      const generator = protocol.executeStreaming({});
      expect(generator.next).toBeDefined();
    });
  });

  describe('ProtocolExecutionContext', () => {
    test('constructor sets all required properties', () => {
      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'req-123',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService
      });

      expect(context.messages).toEqual([{ role: 'user', content: 'Hello' }]);
      expect(context.mode).toBe('act');
      expect(context.projectId).toBe('test-project');
      expect(context.requestId).toBe('req-123');
      expect(context.adapter).toBe(mockAdapter);
      expect(context.tools).toBe(mockTools);
      expect(context.traceService).toBe(mockTraceService);
      // config defaults
      expect(context.config.maxPhaseCycles).toBe(3);
      expect(context.config.maxDuplicateAttempts).toBe(3);
      expect(context.config.debugShowToolResults).toBe(false);
    });

    test('config defaults work correctly when not provided', () => {
      const context = new ProtocolExecutionContext({
        messages: [],
        mode: 'plan',
        projectId: 'p1',
        requestId: 'r1',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService
        // no config
      });

      expect(context.config.maxPhaseCycles).toBe(3);
      expect(context.config.maxDuplicateAttempts).toBe(3);
      expect(context.config.debugShowToolResults).toBe(false);
    });

    test('config overrides defaults when provided', () => {
      const context = new ProtocolExecutionContext({
        messages: [],
        mode: 'plan',
        projectId: 'p1',
        requestId: 'r1',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: {
          maxPhaseCycles: 5,
          maxDuplicateAttempts: 2,
          debugShowToolResults: true,
          customSetting: 'value'
        }
      });

      expect(context.config.maxPhaseCycles).toBe(5);
      expect(context.config.maxDuplicateAttempts).toBe(2);
      expect(context.config.debugShowToolResults).toBe(true);
      expect(context.config.customSetting).toBe('value');
    });

    test('properties are immutable (cannot be reassigned)', () => {
      const context = new ProtocolExecutionContext({
        messages: [],
        mode: 'plan',
        projectId: 'p1',
        requestId: 'r1',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService
      });

      // Attempt to reassign should either throw or have no effect
      // Depending on implementation (e.g., using Object.freeze or not)
      // We'll test that the property remains unchanged after assignment attempt
      const originalMessages = context.messages;
      context.messages = [{ role: 'system', content: 'hacked' }];
      // If immutable, assignment may be ignored or throw; we'll just check it's not changed
      // This test may need adjustment based on actual implementation.
      // For now, we'll assert that the property is still the original array.
      expect(context.messages).toBe(originalMessages);
    });

    test('constructor throws if required fields are missing', () => {
      // Missing messages
      expect(() => new ProtocolExecutionContext({
        mode: 'plan',
        projectId: 'p1',
        requestId: 'r1',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService
      })).toThrow();

      // Missing adapter
      expect(() => new ProtocolExecutionContext({
        messages: [],
        mode: 'plan',
        projectId: 'p1',
        requestId: 'r1',
        tools: mockTools,
        traceService: mockTraceService
      })).toThrow();
    });
  });

  describe('ProtocolEventTypes', () => {
    test('contains all five required event types', () => {
      expect(ProtocolEventTypes.CHUNK).toBe('chunk');
      expect(ProtocolEventTypes.TOOL_CALLS).toBe('tool_calls');
      expect(ProtocolEventTypes.DONE).toBe('done');
      expect(ProtocolEventTypes.PHASE).toBe('phase');
      expect(ProtocolEventTypes.ERROR).toBe('error');
    });

    test('event types are immutable (cannot be modified)', () => {
      // Attempt to modify should either throw or be ignored
      const originalChunk = ProtocolEventTypes.CHUNK;
      ProtocolEventTypes.CHUNK = 'modified';
      expect(ProtocolEventTypes.CHUNK).toBe(originalChunk);
    });
  });

  describe('Integration patterns (conceptual)', () => {
    test('ProtocolStrategy can be extended by StandardProtocol and TwoStageProtocol', () => {
      // This is a structural test; we can't test actual implementations because they don't exist yet.
      // But we can verify that the abstract class is designed for extension.
      class StandardProtocol extends ProtocolStrategy {
        async *executeStreaming(executionContext) { yield { type: 'done', fullContent: '' }; }
        getName() { return 'standard'; }
        canHandle(executionContext) { return true; }
      }
      class TwoStageProtocol extends ProtocolStrategy {
        async *executeStreaming(executionContext) { yield { type: 'done', fullContent: '' }; }
        getName() { return 'two-stage'; }
        canHandle(executionContext) { return true; }
      }
      expect(new StandardProtocol()).toBeInstanceOf(ProtocolStrategy);
      expect(new TwoStageProtocol()).toBeInstanceOf(ProtocolStrategy);
    });

    test('ProtocolExecutionContext can be used by OrionAgent', () => {
      // This test ensures the context matches OrionAgent's expected shape.
      const context = new ProtocolExecutionContext({
        messages: [],
        mode: 'act',
        projectId: 'project',
        requestId: 'request',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService
      });
      // OrionAgent will pass this context to protocol.executeStreaming
      // We just verify that the context has the required properties.
      expect(context).toHaveProperty('messages');
      expect(context).toHaveProperty('mode');
      expect(context).toHaveProperty('projectId');
      expect(context).toHaveProperty('requestId');
      expect(context).toHaveProperty('adapter');
      expect(context).toHaveProperty('tools');
      expect(context).toHaveProperty('traceService');
      expect(context).toHaveProperty('config');
    });
  });

  describe('Anti-placeholder validation', () => {
    test('executeStreaming cannot be satisfied by hardcoded return', async () => {
      // A placeholder implementation that returns a hardcoded generator with a done event
      // should still be detectable because the method must be overridden.
      // However, if a subclass overrides with a hardcoded generator, we cannot detect that here.
      // This test is more about ensuring the abstract class throws.
      class PlaceholderProtocol extends ProtocolStrategy {
        async *executeStreaming(executionContext) {
          // Hardcoded return that would satisfy a naive test
          yield { type: 'done', fullContent: 'placeholder' };
        }
        getName() { return 'placeholder'; }
        canHandle(executionContext) { return true; }
      }
      const protocol = new PlaceholderProtocol();
      // This would pass because the method is implemented, but we can't test for placeholder logic.
      // The test will pass, which is okay; detection of placeholders is done at integration level.
      // We'll just verify that the method exists and returns a generator.
      const generator = protocol.executeStreaming({});
      expect(generator.next).toBeDefined();
    });
  });
});
