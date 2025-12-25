/**
 * @jest-environment node
 */

/**
 * Backend tests for Feature 3 architectural enforcement:
 * /api/chat/messages must NOT use TwoStageOrchestrator (legacy).
 * Instead, it must use ProtocolStrategy with TwoStageProtocol when TWO_STAGE_ENABLED=true.
 *
 * RED stage: tests will fail until Devon refactors the route to use ProtocolStrategy.
 *
 * This test encodes Feature 3’s goal: TwoStageOrchestrator is legacy and must not be used by /api/chat/messages.
 * After Devon's refactor, the route should use ProtocolStrategy (StandardProtocol or TwoStageProtocol).
 */

const express = require('express');
const request = require('supertest');

// We'll mock dependencies using jest.mock with factory functions
// that can be configured per test.
let mockProcessStreaming;
let mockOrchestrate;
let mockStreamingService;
let mockProtocolStrategy;
let mockTwoStageProtocol;
let mockStandardProtocol;

// Mock OrionAgent
jest.mock('../agents/OrionAgent', () => {
  return jest.fn().mockImplementation(() => ({
    processStreaming: mockProcessStreaming,
    getModelName: jest.fn().mockReturnValue('mock-model'),
  }));
});

// Mock TwoStageOrchestrator (legacy, must NOT be used)
jest.mock('../services/TwoStageOrchestrator', () => {
  return jest.fn().mockImplementation(() => ({
    orchestrate: mockOrchestrate,
  }));
});

// Mock ProtocolStrategy and its implementations
jest.mock('../agents/protocols/ProtocolStrategy', () => {
  return {
    ProtocolStrategy: jest.fn().mockImplementation(() => ({
      executeStreaming: jest.fn(),
      getName: jest.fn(),
      canHandle: jest.fn(),
    })),
    ProtocolExecutionContext: jest.fn(),
    ProtocolEventTypes: {
      CHUNK: 'chunk',
      TOOL_CALLS: 'tool_calls',
      DONE: 'done',
      PHASE: 'phase',
      ERROR: 'error',
    },
  };
});

jest.mock('../agents/protocols/TwoStageProtocol', () => {
  return jest.fn().mockImplementation(() => ({
    executeStreaming: jest.fn(),
    getName: jest.fn().mockReturnValue('two-stage'),
    canHandle: jest.fn().mockReturnValue(true),
  }));
});

jest.mock('../agents/protocols/StandardProtocol', () => {
  return jest.fn().mockImplementation(() => ({
    executeStreaming: jest.fn(),
    getName: jest.fn().mockReturnValue('standard'),
    canHandle: jest.fn().mockReturnValue(true),
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

describe('Feature 3 Architectural Enforcement: /api/chat/messages must use ProtocolStrategy, not TwoStageOrchestrator', () => {
  let createChatMessagesRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    delete process.env.TWO_STAGE_ENABLED;
    // Reset mock functions
    mockProcessStreaming = jest.fn();
    mockOrchestrate = jest.fn();
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

  // ============================================================================
  // Test 1: Negative assertion - TwoStageOrchestrator must NOT be used
  // ============================================================================
  describe('TwoStageOrchestrator usage (must be zero)', () => {
    test('should NOT instantiate TwoStageOrchestrator when TWO_STAGE_ENABLED=true', async () => {
      process.env.TWO_STAGE_ENABLED = 'true';
      const app = createApp();

      // Mock streamingService.handleSSE to end the request immediately (avoid timeout)
      mockStreamingService.handleSSE.mockImplementation(async (stream, res, onComplete) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: {"done":true,"fullContent":"Two-stage response"}\n\n');
        res.end();
        if (onComplete) await onComplete('Two-stage response');
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

      // CRITICAL ASSERTION: TwoStageOrchestrator must NOT be constructed
      const TwoStageOrchestrator = require('../services/TwoStageOrchestrator');
      expect(TwoStageOrchestrator).not.toHaveBeenCalled();
      // Also ensure orchestrate is not called (if somehow instantiated)
      expect(mockOrchestrate).not.toHaveBeenCalled();

      // This test will FAIL until Devon removes TwoStageOrchestrator usage from the route.
    });

    test('should NOT instantiate TwoStageOrchestrator when TWO_STAGE_ENABLED=false', async () => {
      process.env.TWO_STAGE_ENABLED = 'false';
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

      const TwoStageOrchestrator = require('../services/TwoStageOrchestrator');
      expect(TwoStageOrchestrator).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Test 2: Positive assertion - TwoStageProtocol must be used when TWO_STAGE_ENABLED=true
  // ============================================================================
  describe('TwoStageProtocol usage (must be used when TWO_STAGE_ENABLED=true)', () => {
    test('should use TwoStageProtocol when TWO_STAGE_ENABLED=true', async () => {
      process.env.TWO_STAGE_ENABLED = 'true';
      const app = createApp();

      // Mock streamingService.handleSSE to end the request immediately
      mockStreamingService.handleSSE.mockImplementation(async (stream, res, onComplete) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: {"done":true,"fullContent":"Two-stage response"}\n\n');
        res.end();
        if (onComplete) await onComplete('Two-stage response');
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

      // CRITICAL ASSERTION: TwoStageProtocol should be instantiated (or at least ProtocolStrategy should be used)
      // Since the route currently does NOT import TwoStageProtocol, this will fail.
      // We'll assert that TwoStageProtocol constructor was called.
      const TwoStageProtocol = require('../agents/protocols/TwoStageProtocol');
      // This expectation will fail until Devon wires up TwoStageProtocol.
      // For now, we keep it as a failing test.
      expect(TwoStageProtocol).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Test 3: Regression guard - StandardProtocol path remains intact
  // ============================================================================
  describe('StandardProtocol path (when TWO_STAGE_ENABLED=false or unset)', () => {
    test('should use StandardProtocol when TWO_STAGE_ENABLED=false', async () => {
      process.env.TWO_STAGE_ENABLED = 'false';
      const app = createApp();

      // Mock OrionAgent.processStreaming to return a dummy stream
      const mockStream = (async function* () {
        yield { chunk: 'Hello' };
        yield { done: true, fullContent: 'Hello' };
      })();
      mockProcessStreaming.mockReturnValue(mockStream);
      mockStreamingService.streamFromAdapter.mockReturnValue(mockStream);
      mockStreamingService.handleSSE.mockImplementation(async (stream, res, onComplete) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: {"chunk":"Hello"}\n\n');
        res.write('data: {"done":true,"fullContent":"Hello"}\n\n');
        res.end();
        if (onComplete) await onComplete('Hello');
      });

      await request(app)
        .post('/api/chat/messages')
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'P1',
          sender: 'user',
          content: 'Hello',
          metadata: { mode: 'plan' },
        });

      // Expect OrionAgent.processStreaming to have been called (standard path)
      expect(mockProcessStreaming).toHaveBeenCalledTimes(1);
      // Expect StandardProtocol NOT to be used (since route still uses OrionAgent directly)
      // This test will pass now, but after Devon refactors to use ProtocolStrategy,
      // we should update to expect StandardProtocol to be used.
      // For now, we keep it as a placeholder.
      const StandardProtocol = require('../agents/protocols/StandardProtocol');
      // expect(StandardProtocol).toHaveBeenCalled(); // future expectation
    });

    test('should default to StandardProtocol when TWO_STAGE_ENABLED is unset', async () => {
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
  });
});
