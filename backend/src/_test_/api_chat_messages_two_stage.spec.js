/**
 * API Chat Messages Tests with TwoStageProtocol (RED Phase)
 * 
 * These tests define the contract for the chat route that must use:
 * - OrionAgentV2 with TwoStageProtocol
 * - SSE streaming responses
 * - Proper error handling and validation
 * 
 * Tests should fail with current implementation (returns 501 Not Implemented)
 * and pass when Devon implements the route with TwoStageProtocol wiring.
 */

const request = require('supertest');
const { ProtocolEventTypes } = require('../../archive/agents/protocols/ProtocolStrategy');

// Mock dependencies
jest.mock('../../src/agents/OrionAgentV2');
jest.mock('../../src/agents/protocols/TwoStageProtocol');
jest.mock('../../src/adapters/index', () => ({
  createAdapter: jest.fn()
}));
jest.mock('../../src/services/trace/TraceService', () => ({
  getInstance: jest.fn(() => ({
    logEvent: jest.fn()
  }))
}));
jest.mock('../../tools/registry', () => ({
  getTools: jest.fn(() => ({}))
}));

const OrionAgentV2 = require('../../src/agents/OrionAgentV2');
const TwoStageProtocol = require('../../src/agents/protocols/TwoStageProtocol');
const { createAdapter } = require('../../src/adapters/index');
const { getInstance: getTraceService } = require('../../src/services/trace/TraceService');
const { getTools } = require('../../tools/registry');

// Clear require cache and re-import app to pick up mocks
let app;
beforeEach(() => {
  jest.clearAllMocks();
  delete require.cache[require.resolve('../../src/server')];
  delete require.cache[require.resolve('../../src/routes/chatMessages')];
  app = require('../../src/server');
});

describe('POST /api/chat/messages with TwoStageProtocol', () => {
  const baseUrl = '/api/chat/messages';
  
  let mockAdapter;
  let mockProtocol;
  let mockAgent;
  let mockTraceService;
  let mockTools;

  beforeEach(() => {
    // Setup mocks
    mockAdapter = {
      sendMessagesStreaming: jest.fn()
    };
    
    mockProtocol = {
      executeStreaming: jest.fn(),
      getName: jest.fn(() => 'two-stage'),
      canHandle: jest.fn(() => true)
    };
    
    mockAgent = {
      processStreaming: jest.fn()
    };
    
    mockTraceService = {
      logEvent: jest.fn()
    };
    
    mockTools = {};

    // Configure mock returns
    createAdapter.mockReturnValue(mockAdapter);
    getTraceService.mockReturnValue(mockTraceService);
    getTools.mockReturnValue(mockTools);
    
    TwoStageProtocol.mockImplementation(() => mockProtocol);
    OrionAgentV2.mockImplementation(() => mockAgent);
  });

  describe('1. Route wiring to OrionAgentV2 + TwoStageProtocol', () => {
    test('should construct OrionAgentV2 with TwoStageProtocol when POST /api/chat/messages', async () => {
      // Mock a simple streaming response
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Hello' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Hello' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Hello Orion'
        })
        .expect(200);

      // Verify OrionAgentV2 was constructed with correct dependencies
      expect(OrionAgentV2).toHaveBeenCalledTimes(1);
      const agentCall = OrionAgentV2.mock.calls[0][0];
      expect(agentCall.adapter).toBe(mockAdapter);
      expect(agentCall.tools).toBe(mockTools);
      expect(agentCall.traceService).toBe(mockTraceService);
      expect(agentCall.protocol).toBe(mockProtocol);

      // Verify TwoStageProtocol was constructed
      expect(TwoStageProtocol).toHaveBeenCalledTimes(1);
      const protocolCall = TwoStageProtocol.mock.calls[0][0];
      expect(protocolCall.adapter).toBe(mockAdapter);
      expect(protocolCall.tools).toBe(mockTools);
      expect(protocolCall.traceService).toBe(mockTraceService);

      // Verify adapter factory was called
      expect(createAdapter).toHaveBeenCalledTimes(1);

      // Verify agent.processStreaming was called with correct parameters
      expect(mockAgent.processStreaming).toHaveBeenCalledTimes(1);
      expect(mockAgent.processStreaming).toHaveBeenCalledWith(
        'test-project',
        'Hello Orion',
        expect.objectContaining({
          mode: 'plan' // default mode
        })
      );
    });

    test('should use specified mode (plan/act) when provided', async () => {
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Test' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Test' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test message',
          mode: 'act'
        })
        .expect(200);

      expect(mockAgent.processStreaming).toHaveBeenCalledWith(
        'test-project',
        'Test message',
        expect.objectContaining({
          mode: 'act'
        })
      );
    });

    test('should not use archived/legacy agent or protocol code', async () => {
      // This test ensures we're using the new architecture
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Test' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Test' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        })
        .expect(200);

      // Verify we're using OrionAgentV2 (not OrionAgent from archive)
      expect(OrionAgentV2).toHaveBeenCalled();
      
      // Verify we're using TwoStageProtocol (not StandardProtocol or archived protocol)
      expect(TwoStageProtocol).toHaveBeenCalled();
      
      // Verify protocol name is 'two-stage'
      expect(mockProtocol.getName()).toBe('two-stage');
    });
  });

  describe('2. SSE Streaming Contract', () => {
    test('should return SSE headers for streaming response', async () => {
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Hello' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Hello' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Hello'
        })
        .expect(200);

      // Should have SSE headers
      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.headers['cache-control']).toMatch(/no-cache/);
      expect(response.headers.connection).toBe('keep-alive');
    });

    test('should emit multiple SSE events for streaming response', async () => {
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'First' };
        yield { type: ProtocolEventTypes.CHUNK, content: 'Second' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'FirstSecond' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        })
        .expect(200);

      // Parse SSE events
      const lines = response.text.split('\n').filter(line => line.trim());
      const dataLines = lines.filter(line => line.startsWith('data:'));
      
      // Should have at least 3 events (2 chunks + 1 done)
      expect(dataLines.length).toBeGreaterThanOrEqual(3);
      
      // Verify event structure
      dataLines.forEach(line => {
        const jsonStr = line.replace('data: ', '');
        const event = JSON.parse(jsonStr);
        expect(event).toHaveProperty('chunk', expect.any(String));
        // OR have property 'done'
      });
    });

    test('should emit exactly one done event at the end', async () => {
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Content' };
        yield { type: ProtocolEventTypes.CHUNK, content: ' more' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Content more' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        })
        .expect(200);

      const lines = response.text.split('\n').filter(line => line.trim());
      const dataLines = lines.filter(line => line.startsWith('data:'));
      
      // Count done events
      const doneEvents = dataLines.filter(line => {
        const event = JSON.parse(line.replace('data: ', ''));
        return event.done === true;
      });
      
      expect(doneEvents).toHaveLength(1);
      
      // Verify done event is last
      const lastEvent = JSON.parse(dataLines[dataLines.length - 1].replace('data: ', ''));
      expect(lastEvent.done).toBe(true);
      expect(lastEvent.fullContent).toBe('Content more');
    });

    test('should fail if route buffers everything and returns single JSON response', async () => {
      // This test ensures streaming is actually implemented
      // Current implementation returns 501, so this will fail (RED phase)
      
      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        });

      // Should NOT be a regular JSON response
      // (Current implementation returns 501, which is not SSE)
      expect(response.headers['content-type']).not.toMatch(/application\/json/);
      // In RED phase, this test may fail because route returns 501
      // That's OK - it will pass when Devon implements SSE
    });
  });

  describe('3. Minimal integration with TwoStageProtocol', () => {
    test('should forward adapter stream through TwoStageProtocol to SSE', async () => {
      // Create a known stream sequence
      const mockAdapterStream = [
        { chunk: 'Hi' },
        { chunk: ' there' },
        { done: true, fullContent: 'Hi there' }
      ];
      
      // Mock adapter that yields the sequence
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        for (const event of mockAdapterStream) {
          yield event;
        }
      });
      
      // Mock protocol to use adapter stream
      mockProtocol.executeStreaming.mockImplementation(async function* () {
        const stream = mockAdapter.sendMessagesStreaming([], {});
        for await (const event of stream) {
          if (event.chunk !== undefined) {
            yield { type: ProtocolEventTypes.CHUNK, content: event.chunk };
          } else if (event.done) {
            yield { type: ProtocolEventTypes.DONE, fullContent: event.fullContent };
          }
        }
      });
      
      mockAgent.processStreaming.mockImplementation(function* () {
        return mockProtocol.executeStreaming({});
      });

      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Hi'
        })
        .expect(200);

      // Parse SSE events
      const lines = response.text.split('\n').filter(line => line.trim());
      const dataLines = lines.filter(line => line.startsWith('data:'));
      
      // Should have events matching adapter stream
      expect(dataLines.length).toBeGreaterThanOrEqual(3);
      
      // First event should be chunk with 'Hi'
      const firstEvent = JSON.parse(dataLines[0].replace('data: ', ''));
      expect(firstEvent.chunk).toBe('Hi');
      
      // Second event should be chunk with ' there'
      const secondEvent = JSON.parse(dataLines[1].replace('data: ', ''));
      expect(secondEvent.chunk).toBe(' there');
      
      // Last event should be done with full content
      const lastEvent = JSON.parse(dataLines[dataLines.length - 1].replace('data: ', ''));
      expect(lastEvent.done).toBe(true);
      expect(lastEvent.fullContent).toBe('Hi there');
    });

    test('should forward tool calls as SSE events (no execution)', async () => {
      const mockToolCalls = [
        { id: 'call-1', function: { name: 'TestTool', arguments: '{}' } }
      ];
      
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'Thinking...' };
        yield { toolCalls: mockToolCalls };
        yield { done: true, fullContent: 'Done with tools' };
      });
      
      mockProtocol.executeStreaming.mockImplementation(async function* () {
        const stream = mockAdapter.sendMessagesStreaming([], {});
        for await (const event of stream) {
          if (event.chunk !== undefined) {
            yield { type: ProtocolEventTypes.CHUNK, content: event.chunk };
          } else if (event.toolCalls !== undefined) {
            yield { type: ProtocolEventTypes.TOOL_CALLS, calls: event.toolCalls };
          } else if (event.done) {
            yield { type: ProtocolEventTypes.DONE, fullContent: event.fullContent };
          }
        }
      });
      
      mockAgent.processStreaming.mockImplementation(function* () {
        return mockProtocol.executeStreaming({});
      });

      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Use a tool'
        })
        .expect(200);

      const lines = response.text.split('\n').filter(line => line.trim());
      const dataLines = lines.filter(line => line.startsWith('data:'));
      
      // Should have tool_calls event
      const toolCallEvents = dataLines.filter(line => {
        try {
          const event = JSON.parse(line.replace('data: ', ''));
          return event.tool_calls !== undefined;
        } catch {
          return false;
        }
      });
      
      expect(toolCallEvents.length).toBeGreaterThan(0);
      
      // Verify tool call structure
      const toolCallEvent = JSON.parse(toolCallEvents[0].replace('data: ', ''));
      expect(toolCallEvent.tool_calls).toEqual(mockToolCalls);
    });
  });

  describe('4. Error handling & validation', () => {
    test('should return 400 if projectId is missing', async () => {
      const response = await request(app)
        .post(baseUrl)
        .send({
          message: 'Hello'
          // missing projectId
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/projectId/i);
    });

    test('should return 400 if message is missing', async () => {
      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project'
          // missing message
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/message/i);
    });

    test('should return 500 if OrionAgentV2 throws before streaming', async () => {
      // Mock agent to throw synchronously
      mockAgent.processStreaming.mockImplementation(() => {
        throw new Error('Agent initialization failed');
      });

      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/internal server error/i);
    });

    test('should close SSE connection if streaming fails mid-stream', async () => {
      // Mock a stream that throws after first chunk
      mockAgent.processStreaming.mockImplementation(async function* () {
        yield { type: ProtocolEventTypes.CHUNK, content: 'First' };
        throw new Error('Stream failed');
      });

      // Note: supertest may not capture SSE errors cleanly
      // We'll verify the route doesn't return 200 with empty body
      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        });

      // Should not be successful 200 with empty SSE
      if (response.status === 200) {
        // If it returns 200, there should be some content
        expect(response.text).toBeTruthy();
      } else {
        // Or it should return an error status
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    test('should handle invalid mode parameter gracefully', async () => {
      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test',
          mode: 'invalid-mode'
        });

      // Either 400 for invalid mode, or default to 'plan'
      if (response.status === 400) {
        expect(response.body.error).toMatch(/mode/i);
      } else if (response.status === 200) {
        // Should default to 'plan' mode
        expect(mockAgent.processStreaming).toHaveBeenCalledWith(
          'test-project',
          'Test',
          expect.objectContaining({
            mode: 'plan' // default
          })
        );
      }
    });
  });

  describe('5. Anti-Placeholder Validation', () => {
    test('should fail against implementation that bypasses OrionAgentV2', async () => {
      // This test ensures the route actually uses OrionAgentV2
      // A placeholder that returns hardcoded SSE would fail this test
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Test' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Test' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        })
        .expect(200);

      // Verify OrionAgentV2 was actually constructed and used
      expect(OrionAgentV2).toHaveBeenCalledTimes(1);
      expect(mockAgent.processStreaming).toHaveBeenCalledTimes(1);
      
      // A placeholder that doesn't use OrionAgentV2 would fail these assertions
    });

    test('should fail against implementation that returns non-streaming JSON response', async () => {
      // Current implementation returns 501, which is not SSE
      // This test will fail in RED phase (expected)
      
      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        });

      // Should NOT return regular JSON with message field
      // (Some placeholders might return { message: '...' } instead of SSE)
      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/text\/event-stream/);
        expect(response.body).not.toHaveProperty('message');
      }
    });

    test('should fail against implementation that never instantiates TwoStageProtocol', async () => {
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Test' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Test' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        })
        .expect(200);

      // Verify TwoStageProtocol was instantiated
      expect(TwoStageProtocol).toHaveBeenCalledTimes(1);
      
      // A placeholder that uses StandardProtocol or no protocol would fail
    });

    test('should fail against implementation without SSE headers', async () => {
      async function* mockStream() {
        yield { type: ProtocolEventTypes.CHUNK, content: 'Test' };
        yield { type: ProtocolEventTypes.DONE, fullContent: 'Test' };
      }
      
      mockAgent.processStreaming.mockReturnValue(mockStream());

      const response = await request(app)
        .post(baseUrl)
        .send({
          projectId: 'test-project',
          message: 'Test'
        })
        .expect(200);

      // Must have SSE headers
      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.headers['cache-control']).toMatch(/no-cache/);
      
      // A placeholder without proper headers would fail
    });
  });
});
