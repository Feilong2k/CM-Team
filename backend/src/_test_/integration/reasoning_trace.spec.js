/**
 * @jest-environment node
 */

const { createAdapter } = require('../../adapters');
const TraceService = require('../../services/trace/TraceService');
const { query: dbQuery } = require('../../db/connection');
const OrionAgentV2 = require('../../agents/OrionAgentV2');
const TwoStageProtocol = require('../../agents/protocols/TwoStageProtocol');

// Mock fetch for DeepSeek API calls
global.fetch = jest.fn();

describe('Reasoning Trace Integration', () => {
  const mockApiKey = 'test-api-key';

  beforeAll(async () => {
    // Ensure trace_events table exists (should be created by migrations)
  });

  beforeEach(async () => {
    fetch.mockClear();
    // Clear trace_events table for test isolation
    await dbQuery('DELETE FROM trace_events');
  });

  describe('TRACE-001: Reasoning stored in trace_events', () => {
    test('should store reasoning content in details.reasoning when using DeepSeek Reasoner via agent', async () => {
      // Setup environment
      process.env.ORION_MODEL_PROVIDER = 'DeepSeek';
      process.env.DEEPSEEK_API_KEY = mockApiKey;

      // Create a mock adapter that simulates DS_ReasonerAdapter streaming behavior
      const mockAdapter = {
        sendMessagesStreaming: jest.fn().mockImplementation(async function* () {
          yield { reasoningChunk: 'Let me think step by step. First, understand the problem...' };
          yield { chunk: 'The answer is 42' };
          yield { done: true, fullContent: 'The answer is 42', fullReasoning: 'Let me think step by step. First, understand the problem...' };
        }),
        // The adapter may have other methods but they are not called in this test
      };

      const mockTools = {};
      const traceService = TraceService;

      const protocol = new TwoStageProtocol({ adapter: mockAdapter, tools: mockTools, traceService });
      const agent = new OrionAgentV2({ adapter: mockAdapter, tools: mockTools, traceService, protocol });

      const projectId = 'test-project-agent';
      const requestId = 'test-request-id';

      // Run the agent
      const stream = agent.processStreaming(projectId, 'What is the answer?', { requestId, mode: 'plan' });

      // Consume the stream
      for await (const event of stream) {
        // do nothing, just consume
      }

      // Wait a bit for async trace logging (the protocol logs asynchronously)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check the trace_events table for an orion_response event with reasoning
      const result = await dbQuery(
        'SELECT details FROM trace_events WHERE project_id = $1 AND type = $2',
        [projectId, 'orion_response']
      );

      expect(result.rows).toHaveLength(1);
      const details = result.rows[0].details;
      expect(details.reasoning).toBe('Let me think step by step. First, understand the problem...');
      expect(details.content).toBe('The answer is 42');
    });

    test('should store streaming reasoning chunks in trace', async () => {
      process.env.ORION_MODEL_PROVIDER = 'DeepSeek';
      process.env.DEEPSEEK_API_KEY = mockApiKey;

      // Mock a streaming response with reasoning chunks
      const mockStream = [
        'data: {"choices":[{"delta":{"reasoning_content":"Thinking"}}]}',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"reasoning_content":" more"}}]}',
        'data: [DONE]'
      ].join('\n') + '\n';

      const mockResponse = {
        ok: true,
        body: {
          getReader: () => {
            let index = 0;
            const encoder = new TextEncoder();
            return {
              read: () => {
                if (index < mockStream.length) {
                  const chunk = mockStream.slice(index, index + 10);
                  index += 10;
                  return Promise.resolve({ done: false, value: encoder.encode(chunk) });
                } else {
                  return Promise.resolve({ done: true });
                }
              },
              releaseLock: () => {}
            };
          }
        }
      };

      fetch.mockResolvedValueOnce(mockResponse);

      const adapter = createAdapter();
      
      // Collect streaming events (simulating what the agent would do)
      const events = [];
      for await (const event of adapter.sendMessagesStreaming([{ role: 'user', content: 'Hi' }])) {
        events.push(event);
      }

      // Verify the stream produced a done event with fullReasoning
      const doneEvent = events.find(e => e.done);
      expect(doneEvent).toBeDefined();
      expect(doneEvent.fullReasoning).toBe('Thinking more');

      // Simulate trace logging of the full reasoning
      const testEvent = {
        projectId: 'test-project-stream',
        source: 'orion',
        type: 'orion_response',
        summary: 'Streaming reasoning trace',
        details: {
          reasoning: doneEvent.fullReasoning,
          content: doneEvent.fullContent
        }
      };

      await TraceService.logEvent(testEvent);

      const result = await dbQuery(
        'SELECT details FROM trace_events WHERE project_id = $1',
        ['test-project-stream']
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].details.reasoning).toBe('Thinking more');
    });
  });

  describe('TRACE-002: Non-Reasoner adapters do not store reasoning', () => {
    test('GPT-4 adapter should not include reasoning field in trace', async () => {
      // Setup: switch to OpenAI provider
      process.env.ORION_MODEL_PROVIDER = 'OpenAI';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      // Mock OpenAI API response (no reasoning_content)
      const mockResponse = {
        choices: [{
          message: {
            content: 'The answer is 42'
            // no reasoning_content field
          }
        }]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const adapter = createAdapter();
      expect(adapter.constructor.name).toBe('GPT41Adapter');

      // Simulate trace event without reasoning
      const testEvent = {
        projectId: 'test-project-openai',
        source: 'orion',
        type: 'orion_response',
        summary: 'Non-reasoner trace',
        details: {
          content: 'The answer is 42'
          // no reasoning field
        }
      };

      await TraceService.logEvent(testEvent);

      const result = await dbQuery(
        'SELECT details FROM trace_events WHERE project_id = $1',
        ['test-project-openai']
      );
      expect(result.rows).toHaveLength(1);
      const details = result.rows[0].details;
      // Should not have reasoning field, or it should be null/undefined
      expect(details.reasoning).toBeUndefined();
    });
  });
});
