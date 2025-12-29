/**
 * @jest-environment node
 */

const DS_ReasonerAdapter = require('../../adapters/DS_ReasonerAdapter');

// Mock fetch globally
global.fetch = jest.fn();

// Mock console.error to reduce noise
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

describe('DS_ReasonerAdapter', () => {
  let adapter;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    fetch.mockClear();
    adapter = new DS_ReasonerAdapter({ apiKey: mockApiKey });
  });

  describe('RESPONSE-001: Non-streaming response with reasoning + tool calls', () => {
    test('should parse response and return { content, toolCalls, reasoningContent }', async () => {
      // Mock API response
      const mockResponse = {
        choices: [{
          message: {
            content: 'final answer text',
            tool_calls: [
              { id: 'call_1', type: 'function', function: { name: 'test', arguments: '{}' } }
            ],
            reasoning_content: 'chain of thought text'
          }
        }]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await adapter.sendMessages([{ role: 'user', content: 'Hello' }]);
      expect(result).toEqual({
        content: 'final answer text',
        toolCalls: [
          { id: 'call_1', type: 'function', function: { name: 'test', arguments: '{}' } }
        ],
        reasoningContent: 'chain of thought text'
      });
    });
  });

  describe('RESPONSE-002: Non-streaming response without reasoning', () => {
    test('should return reasoningContent: null when reasoning_content missing', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'answer',
            tool_calls: []
            // no reasoning_content field
          }
        }]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await adapter.sendMessages([{ role: 'user', content: 'Hello' }]);
      expect(result).toEqual({
        content: 'answer',
        toolCalls: [],
        reasoningContent: null
      });
    });
  });

  describe('RESPONSE-003: Invalid response shape handling', () => {
    test('should throw clear error when choices missing', async () => {
      const mockResponse = {}; // Missing choices

      fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      adapter.maxRetries = 0; // Avoid retry delays

      await expect(adapter.sendMessages([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow('Invalid API response: missing choices');
    });

    test('should throw clear error when choices[0].message malformed', async () => {
      const mockResponse = {
        choices: [{}] // No message
      };

      fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      adapter.maxRetries = 0;

      // The adapter currently throws a TypeError because it tries to access message.content.
      // This test expects an error with substring "Invalid API response".
      // It will fail until the adapter is fixed to validate the message field.
      await expect(adapter.sendMessages([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow('Invalid API response');
    });
  });

  describe('STREAM-001: Streaming yields reasoning, content, and tool call events', () => {
    test('should yield reasoningChunk, chunk, toolCalls, and final done event', async () => {
      // Simulate a stream of SSE events
      const mockStream = [
        'data: {"choices":[{"delta":{"reasoning_content":"Thinking"}}]}',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"id":"call1","type":"function"}]}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}]}',
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

      const events = [];
      for await (const event of adapter.sendMessagesStreaming([{ role: 'user', content: 'Hi' }])) {
        events.push(event);
      }

      // We expect events of different types
      const reasoningEvents = events.filter(e => e.reasoningChunk);
      const contentEvents = events.filter(e => e.chunk);
      const toolEvents = events.filter(e => e.toolCalls);
      const doneEvent = events.find(e => e.done);

      expect(reasoningEvents.length).toBeGreaterThan(0);
      expect(contentEvents.length).toBeGreaterThan(0);
      expect(toolEvents.length).toBeGreaterThan(0);
      expect(doneEvent).toBeDefined();
      expect(doneEvent.done).toBe(true);
      expect(typeof doneEvent.fullContent).toBe('string');
      expect(typeof doneEvent.fullReasoning).toBe('string');
    });
  });

  describe('STREAM-002: Duplicate delta suppression', () => {
    test('should not emit duplicate consecutive content or reasoning deltas', async () => {
      const mockStream = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}', // duplicate
        'data: {"choices":[{"delta":{"content":" world"}}]}',
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

      const events = [];
      for await (const event of adapter.sendMessagesStreaming([{ role: 'user', content: 'Hi' }])) {
        events.push(event);
      }

      const contentEvents = events.filter(e => e.chunk);
      // Should have only two content events: "Hello" and " world" (duplicate suppressed)
      expect(contentEvents).toHaveLength(2);
      expect(contentEvents[0].chunk).toBe('Hello');
      expect(contentEvents[1].chunk).toBe(' world');
    });
  });

  describe('STREAM-003: Streaming error handling', () => {
    test('should throw error after retries exhausted', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      adapter.maxRetries = 0; // No retries for quick test

      // sendMessagesStreaming returns an async generator, we need to iterate to get the error
      const stream = adapter.sendMessagesStreaming([{ role: 'user', content: 'Hi' }]);
      await expect(async () => {
        for await (const _ of stream) {
          // iterate
        }
      }).rejects.toThrow();
    });
  });

  describe('TEMP-001: Temperature passed from agent to adapter', () => {
    test('should include temperature in API request body when provided', async () => {
      // Mock a successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'response'
            }
          }]
        })
      });

      adapter.maxRetries = 0;

      await adapter.sendMessages(
        [{ role: 'user', content: 'Hello' }],
        { temperature: 1.3 }
      );

      expect(fetch).toHaveBeenCalledTimes(1);
      const call = fetch.mock.calls[0];
      const options = call[1];
      const body = JSON.parse(options.body);
      expect(body.temperature).toBe(1.3);
    });
  });

  describe('TEMP-002: Default temperature for ACT mode', () => {
    test('should default temperature to 0.0 when not provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'response'
            }
          }]
        })
      });

      adapter.maxRetries = 0;

      await adapter.sendMessages([{ role: 'user', content: 'Hello' }]);

      expect(fetch).toHaveBeenCalledTimes(1);
      const call = fetch.mock.calls[0];
      const options = call[1];
      const body = JSON.parse(options.body);
      expect(body.temperature).toBe(0.0);
    });
  });
});
