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
const createChatMessagesRouter = require('../routes/chatMessages');

// Mock dependencies
const mockAdapter = {
  sendMessagesStreaming: jest.fn(),
  sendMessages: jest.fn(),
  getModelName: jest.fn().mockReturnValue('mock-model'),
};

const mockTools = {
  FileSystemTool: { list_files: jest.fn() },
  DatabaseTool: { getMessages: jest.fn() },
};

const mockStreamingService = {
  streamFromAdapter: jest.fn(),
  handleSSE: jest.fn(),
  persistStreamedMessage: jest.fn(),
};

// Mock TraceService to avoid side effects
jest.mock('../services/trace/TraceService', () => ({
  logEvent: jest.fn(),
}));

// Mock TwoStageOrchestrator to detect if it's used
const mockOrchestrate = jest.fn();
jest.mock('../services/TwoStageOrchestrator', () => {
  return jest.fn().mockImplementation(() => ({
    orchestrate: mockOrchestrate,
  }));
});

// Mock OrionAgent to spy on its processStreaming
const mockProcessStreaming = jest.fn();
const mockGetModelName = jest.fn().mockReturnValue('mock-model');
jest.mock('../agents/OrionAgent', () => {
  return jest.fn().mockImplementation(() => ({
    processStreaming: mockProcessStreaming,
    getModelName: mockGetModelName,
  }));
});

describe('P1-F3-T1-S5: Env-driven protocol selection in /api/chat/messages', () => {
  let router;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    delete process.env.TWO_STAGE_ENABLED;
  });

  afterEach(() => {
    delete process.env.TWO_STAGE_ENABLED;
  });

  const createApp = () => {
    router = createChatMessagesRouter({
      adapter: mockAdapter,
      tools: mockTools,
      streamingService: mockStreamingService,
    });
    app = express();
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
      // Expect TwoStageOrchestrator NOT to have been instantiated
      const TwoStageOrchestrator = require('../services/TwoStageOrchestrator');
      expect(TwoStageOrchestrator).not.toHaveBeenCalled();
      // Expect streamingService.handleSSE to have been called
      expect(mockStreamingService.handleSSE).toHaveBeenCalledTimes(1);
    });
  });

  describe('when TWO_STAGE_ENABLED=true', () => {
    test('should use TwoStageOrchestrator (two-stage protocol)', async () => {
      process.env.TWO_STAGE_ENABLED = 'true';
      const app = createApp();

      // Mock TwoStageOrchestrator to return a result
      const TwoStageOrchestrator = require('../services/TwoStageOrchestrator');
      mockOrchestrate.mockResolvedValue({ finalContent: 'Two-stage response' });

      // Mock streamingService.persistStreamedMessage to avoid DB calls
      mockStreamingService.persistStreamedMessage.mockResolvedValue({});

      const response = await request(app)
        .post('/api/chat/messages')
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'P1',
          sender: 'user',
          content: 'Hello',
          metadata: { mode: 'plan' },
        });

      // Expect TwoStageOrchestrator to have been instantiated
      expect(TwoStageOrchestrator).toHaveBeenCalledTimes(1);
      // Expect orchestrate to have been called with appropriate arguments
      expect(mockOrchestrate).toHaveBeenCalledTimes(1);
      // Expect OrionAgent.processStreaming NOT to have been called
      expect(mockProcessStreaming).not.toHaveBeenCalled();
      // The response should be SSE (status 200)
      expect(response.status).toBe(200);
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
      const TwoStageOrchestrator = require('../services/TwoStageOrchestrator');
      expect(TwoStageOrchestrator).not.toHaveBeenCalled();
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
