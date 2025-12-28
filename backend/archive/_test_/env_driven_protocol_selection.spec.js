/**
 * @jest-environment node
 */

/**
 * Backend tests for subtask P1-F3-T1-S5 (env-driven protocol selection)
 *
 * These tests verify that the /api/chat/messages route selects protocol based on
 * environment variable TWO_STAGE_ENABLED.
 *
 * RED stage: tests will fail until Devon implements the env-driven selection.
 */

const express = require('express');
const request = require('supertest');

// We'll mock dependencies using jest.mock with factory functions
// that can be configured per test.
let mockProcessStreaming;
let mockOrchestrate;
let mockStreamingService;
let mockPrepareRequest;

// Mock OrionAgent
jest.mock('../agents/OrionAgent', () => {
  return jest.fn().mockImplementation(() => ({
    processStreaming: mockProcessStreaming,
    getModelName: jest.fn().mockReturnValue('mock-model'),
    _prepareRequest: mockPrepareRequest,
  }));
});

// Mock StreamingService
jest.mock('../services/StreamingService', () => {
  return jest.fn().mockImplementation(() => mockStreamingService);
});

// Mock TraceService
jest.mock('../services/trace/TraceService', () => ({
  logEvent: jest.fn(),
}));

describe('P1-F3-T1-S5: Env-driven protocol selection in /api/chat/messages', () => {
  let createChatMessagesRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    delete process.env.TWO_STAGE_ENABLED;
    // Reset mock functions
    mockProcessStreaming = jest.fn();
    mockOrchestrate = jest.fn();
    mockPrepareRequest = jest.fn().mockResolvedValue({
      messages: [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
      ],
    });
    mockStreamingService = {
      streamFromAdapter: jest.fn(),
      handleSSE: jest.fn(),
      persistStreamedMessage: jest.fn().mockResolvedValue({ metadata: {} }),
    };
    // Clear require cache for the router module to pick up new mocks
    delete require.cache[require.resolve('../routes/chatMessages')];
    createChatMessagesRouter = require('../routes/chatMessages');
  });

  afterEach(() => {
    delete process.env.TWO_STAGE_ENABLED;
  });

  const createApp = () => {
    const router = createChatMessagesRouter();
    const app = express();
    app.use(express.json());
    app.use('/api/chat', router);
    return app;
  };

  describe('when TWO_STAGE_ENABLED=false (or unset)', () => {
    test('should use OrionAgent.processStreaming (standard protocol)', async () => {
      process.env.TWO_STAGE_ENABLED = 'false';
      const app = createApp();

      // Mock OrionAgent.processStreaming to return a dummy stream
      const mockStream = (async function* () {
        yield { chunk: 'Hello' };
        yield { done: true, fullContent: 'Hello' };
      })();
      mockProcessStreaming.mockReturnValue(mockStream);

      // Mock streamingService.streamFromAdapter to return same stream
      mockStreamingService.streamFromAdapter.mockReturnValue(mockStream);
      // Mock handleSSE to call onComplete immediately (simulate streaming)
      mockStreamingService.handleSSE.mockImplementation(async (stream, res, onComplete) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: {"chunk":"Hello"}\n\n');
        res.write('data: {"done":true,"fullContent":"Hello"}\n\n');
        res.end();
        if (onComplete) await onComplete('Hello');
      });

      const response = await request(app)
        .post('/api/chat/messages')
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'P1',
          sender: 'user',
          content: 'Hello',
          metadata: { mode: 'plan' },
        });

      // Expect OrionAgent.processStreaming to have been called
      expect(mockProcessStreaming).toHaveBeenCalledTimes(1);
      // Expect streamingService.handleSSE to have been called
      expect(mockStreamingService.handleSSE).toHaveBeenCalledTimes(1);
    });
  });

  describe('when TWO_STAGE_ENABLED=true', () => {
    test('should use two-stage protocol (not standard streaming)', async () => {
      process.env.TWO_STAGE_ENABLED = 'true';
      const app = createApp();

      // Mock streamingService.handleSSE to end the request immediately (avoid timeout)
      mockStreamingService.handleSSE.mockImplementation(async (stream, res, onComplete) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: {"done":true,"fullContent":"Two-stage response"}\n\n');
        res.end();
        if (onComplete) await onComplete('Two-stage response');
      });

      // Mock persistStreamedMessage to avoid DB errors and satisfy route logging
      mockStreamingService.persistStreamedMessage.mockResolvedValue({ metadata: {} });

      const response = await request(app)
        .post('/api/chat/messages')
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'P1',
          sender: 'user',
          content: 'Hello',
          metadata: { mode: 'plan' },
        });

      // Expect OrionAgent.processStreaming NOT to have been called (since two-stage protocol should not use standard streaming)
      expect(mockProcessStreaming).not.toHaveBeenCalled();
      // The response should be SSE (status 200)
      expect(response.status).toBe(200);
      // Ensure the request completed (handleSSE was called)
      expect(mockStreamingService.handleSSE).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    test('should default to standard when TWO_STAGE_ENABLED is unset', async () => {
      // No env var set
      const app = createApp();
      mockProcessStreaming.mockReturnValue((async function* () {})());

      mockStreamingService.handleSSE.mockImplementation(async (stream, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.end();
      });

      await request(app)
        .post('/api/chat/messages')
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'P1',
          sender: 'user',
          content: 'Hello',
        });

      expect(mockProcessStreaming).toHaveBeenCalledTimes(1);
    });

    test('should ignore invalid TWO_STAGE_ENABLED values', async () => {
      process.env.TWO_STAGE_ENABLED = 'maybe';
      const app = createApp();
      mockProcessStreaming.mockReturnValue((async function* () {})());

      mockStreamingService.handleSSE.mockImplementation(async (stream, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.end();
      });

      await request(app)
        .post('/api/chat/messages')
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'P1',
          sender: 'user',
          content: 'Hello',
        });

      // Should default to standard (since 'maybe' !== 'true')
      expect(mockProcessStreaming).toHaveBeenCalledTimes(1);
    });
  });
});
