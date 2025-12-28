/**
 * @jest-environment node
 */

// This test will fail until OrionAgentV2 is implemented
// It enforces the streaming-only interface described in the two-stage protocol plan

describe('OrionAgentV2', () => {
  let mockAdapter;
  let mockTools;
  let mockTraceService;
  let mockProtocol;
  
  beforeEach(() => {
    // Create realistic mocks based on the expected interface
    mockAdapter = {
      sendMessagesStreaming: jest.fn().mockImplementation(async function* () {
        yield { chunk: 'Test response' };
        yield { done: true, fullContent: 'Test response' };
      })
    };
    
    mockTools = {
      DatabaseTool: {
        chatMessages: {
          getMessages: jest.fn().mockResolvedValue([]),
          addMessage: jest.fn().mockResolvedValue({ id: 1 })
        }
      },
      FileSystemTool: {
        list_files: jest.fn().mockResolvedValue(['file1.txt']),
        read_file: jest.fn().mockResolvedValue('File content')
      }
    };
    
    mockTraceService = {
      logEvent: jest.fn().mockResolvedValue(undefined)
    };
    
    mockProtocol = {
      executeStreaming: jest.fn().mockImplementation(async function* (context) {
        yield { type: 'CHUNK', data: { chunk: 'Protocol response' } };
        yield { type: 'DONE', data: { fullContent: 'Protocol response' } };
      })
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('should be defined when module exists', () => {
    // This test will fail if OrionAgentV2 module cannot be required
    // It ensures the module exists (even if empty)
    expect(() => require('../agents/OrionAgentV2')).not.toThrow();
    
    const OrionAgentV2 = require('../agents/OrionAgentV2');
    expect(OrionAgentV2).toBeDefined();
    expect(typeof OrionAgentV2).toBe('function');
  });
  
  test('should accept dependencies in constructor', () => {
    // This test will fail if constructor does not store dependencies
    const OrionAgentV2 = require('../agents/OrionAgentV2');
    
    // Attempt to create instance with dependencies
    const agent = new OrionAgentV2({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
      protocol: mockProtocol
    });
    
    expect(agent).toBeDefined();
    expect(agent).toBeInstanceOf(OrionAgentV2);
    
    // The agent should store dependencies for later use
    // We can't directly assert private fields, but we can verify
    // the agent has the expected method that uses them
    expect(typeof agent.processStreaming).toBe('function');
  });
  
  test('processStreaming should return an async iterator', () => {
    // This test will fail if method does not return an async iterable
    const OrionAgentV2 = require('../agents/OrionAgentV2');
    const agent = new OrionAgentV2({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
      protocol: mockProtocol
    });
    
    const result = agent.processStreaming('test-project', 'Hello Orion', { mode: 'act' });
    
    // Should return an object that is async iterable
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    
    // Check for async iterator protocol
    expect(typeof result[Symbol.asyncIterator]).toBe('function');
    
    // Should be able to call next() (though we won't consume here)
    const iterator = result[Symbol.asyncIterator]();
    expect(typeof iterator.next).toBe('function');
  });
  
  test('processStreaming should delegate to protocol.executeStreaming with correct context (act mode)', async () => {
    // This test will fail if protocol.executeStreaming is not called
    // or called with incorrect context
    const OrionAgentV2 = require('../agents/OrionAgentV2');
    const agent = new OrionAgentV2({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
      protocol: mockProtocol
    });
    
    const projectId = 'test-project-123';
    const userMessage = 'List files in the project';
    const options = { 
      mode: 'act',
      requestId: 'req-123'
    };
    
    // Reset mock before test
    mockProtocol.executeStreaming.mockClear();
    
    // Call processStreaming
    const stream = agent.processStreaming(projectId, userMessage, options);
    
    // Consume the stream to trigger protocol execution
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    // Verify protocol.executeStreaming was called exactly once
    expect(mockProtocol.executeStreaming).toHaveBeenCalledTimes(1);
    
    // Verify it was called with a ProtocolExecutionContext
    const callArgs = mockProtocol.executeStreaming.mock.calls[0];
    expect(callArgs).toHaveLength(1);
    
    const context = callArgs[0];
    expect(context).toBeDefined();
    expect(typeof context).toBe('object');
    
    // Verify context contains required fields
    expect(context.projectId).toBe(projectId);
    expect(context.mode).toBe(options.mode);
    expect(context.requestId).toBe(options.requestId);
    
    // Verify context contains dependencies
    expect(context.adapter).toBe(mockAdapter);
    expect(context.tools).toBe(mockTools);
    expect(context.traceService).toBe(mockTraceService);
    
    // Verify context has messages array with system and user messages
    expect(Array.isArray(context.messages)).toBe(true);
    expect(context.messages.length).toBeGreaterThanOrEqual(2);
    
    // Should have system message
    const systemMessage = context.messages.find(m => m.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(typeof systemMessage.content).toBe('string');
    
    // System message should include project ID and mode
    expect(systemMessage.content).toContain(projectId);
    expect(systemMessage.content).toContain(options.mode);
    
    // Should have user message
    const userMsg = context.messages.find(m => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toBe(userMessage);
  });

  test('processStreaming should delegate to protocol.executeStreaming with correct context (plan mode)', async () => {
    // This test will fail if protocol.executeStreaming is not called
    // or called with incorrect context for plan mode
    const OrionAgentV2 = require('../agents/OrionAgentV2');
    const agent = new OrionAgentV2({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
      protocol: mockProtocol
    });
    
    const projectId = 'plan-project-456';
    const userMessage = 'Create a plan for the feature';
    const options = { 
      mode: 'plan',
      requestId: 'req-456'
    };
    
    // Reset mock before test
    mockProtocol.executeStreaming.mockClear();
    
    // Call processStreaming
    const stream = agent.processStreaming(projectId, userMessage, options);
    
    // Consume the stream to trigger protocol execution
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    
    // Verify protocol.executeStreaming was called exactly once
    expect(mockProtocol.executeStreaming).toHaveBeenCalledTimes(1);
    
    // Verify it was called with a ProtocolExecutionContext
    const callArgs = mockProtocol.executeStreaming.mock.calls[0];
    expect(callArgs).toHaveLength(1);
    
    const context = callArgs[0];
    expect(context).toBeDefined();
    expect(typeof context).toBe('object');
    
    // Verify context contains required fields
    expect(context.projectId).toBe(projectId);
    expect(context.mode).toBe(options.mode);
    expect(context.requestId).toBe(options.requestId);
    
    // Verify context contains dependencies
    expect(context.adapter).toBe(mockAdapter);
    expect(context.tools).toBe(mockTools);
    expect(context.traceService).toBe(mockTraceService);
    
    // Verify context has messages array with system and user messages
    expect(Array.isArray(context.messages)).toBe(true);
    expect(context.messages.length).toBeGreaterThanOrEqual(2);
    
    // Should have system message
    const systemMessage = context.messages.find(m => m.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(typeof systemMessage.content).toBe('string');
    
    // System message should include project ID and mode
    expect(systemMessage.content).toContain(projectId);
    expect(systemMessage.content).toContain(options.mode);
    
    // Should have user message
    const userMsg = context.messages.find(m => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toBe(userMessage);
  });
  
  test('processStreaming should yield protocol events', async () => {
    // This test will fail if agent does not forward protocol events
    const OrionAgentV2 = require('../agents/OrionAgentV2');
    
    // Create a protocol that yields specific events
    const testEvents = [
      { type: 'CHUNK', data: { chunk: 'Thinking...' } },
      { type: 'TOOL_CALLS', data: { toolCalls: [{ id: '1', type: 'function' }] } },
      { type: 'CHUNK', data: { chunk: 'Done' } },
      { type: 'DONE', data: { fullContent: 'Final answer' } }
    ];
    
    const testProtocol = {
      executeStreaming: jest.fn().mockImplementation(async function* () {
        for (const event of testEvents) {
          yield event;
        }
      })
    };
    
    const agent = new OrionAgentV2({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
      protocol: testProtocol
    });
    
    const stream = agent.processStreaming('test-project', 'Test', { mode: 'act' });
    
    // Collect all events from the stream
    const receivedEvents = [];
    for await (const event of stream) {
      receivedEvents.push(event);
    }
    
    // Should receive the same events the protocol yields
    expect(receivedEvents).toEqual(testEvents);
  });
  
  test('should fail with placeholder implementation', () => {
    // This test ensures the implementation is not a placeholder
    // A placeholder would be: class OrionAgentV2 { processStreaming() { return []; } }
    const OrionAgentV2 = require('../agents/OrionAgentV2');
    const agent = new OrionAgentV2({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
      protocol: mockProtocol
    });
    
    const result = agent.processStreaming('test', 'test', {});
    
    // Should not be a simple array (common placeholder)
    expect(Array.isArray(result)).toBe(false);
    
    // Should not be a promise that resolves to empty array
    if (result && typeof result.then === 'function') {
      // It's a promise - this is also wrong for streaming interface
      // But we'll check in the async test
    }
  });
  
  test('should handle errors from protocol gracefully', async () => {
    // This test will fail if error handling is not implemented
    const OrionAgentV2 = require('../agents/OrionAgentV2');
    
    const errorProtocol = {
      executeStreaming: jest.fn().mockImplementation(async function* () {
        throw new Error('Protocol error');
      })
    };
    
    const agent = new OrionAgentV2({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService,
      protocol: errorProtocol
    });
    
    const stream = agent.processStreaming('test', 'test', {});
    
    // Should propagate error through async iterator
    await expect(async () => {
      for await (const _ of stream) {
        // Consume stream
      }
    }).rejects.toThrow('Protocol error');
  });
});
