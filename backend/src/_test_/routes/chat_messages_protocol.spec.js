/**
 * @jest-environment node
 *
 * PROTO-004 – TwoStageProtocol gating via config
 *
 * Tests that verify:
 * 1. When TWO_STAGE_ENABLED is not set or false, the chat route uses StandardProtocol.
 * 2. When TWO_STAGE_ENABLED=true, the chat route uses TwoStageProtocol.
 * 3. The route does not use archived/legacy protocol code.
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
jest.mock('../../agents/OrionAgentV2');
jest.mock('../../db/connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] })
}));

const request = require('supertest');
const StandardProtocol = require('../../agents/protocols/StandardProtocol');
const TwoStageProtocol = require('../../agents/protocols/TwoStageProtocol');
const OrionAgentV2 = require('../../agents/OrionAgentV2');
const { createAdapter } = require('../../adapters/index');
const { getInstance: getTraceService } = require('../../services/trace/TraceService');
const { getTools } = require('../../../tools/registry');
const { query } = require('../../db/connection');

// Clear require cache and re-import app to pick up mocks
let app;
beforeEach(() => {
  jest.clearAllMocks();
  delete require.cache[require.resolve('../../server')];
  delete require.cache[require.resolve('../../routes/chatMessages')];
  // Set required environment variables
  process.env.PORT = '3000';
  process.env.CORS_ORIGIN_REGEX = '.*';
  process.env.SERVER_VERSION = 'test';
  process.env.ORION_MODEL_PROVIDER = 'DeepSeek';
  // Clear environment variable
  delete process.env.TWO_STAGE_ENABLED;
  app = require('../../server');
});

describe('PROTO-004: TwoStageProtocol gating via config in chat route', () => {
  let mockAdapter;
  let mockTools;
  let mockTraceService;
  let mockStandardProtocol;
  let mockTwoStageProtocol;
  let mockAgent;

  beforeEach(() => {
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
      }),
      getName: jest.fn(() => 'standard')
    };
    mockTwoStageProtocol = {
      executeStreaming: jest.fn().mockImplementation(async function* () {
        yield { type: 'CHUNK', content: 'Two-stage protocol response' };
        yield { type: 'DONE', fullContent: 'Two-stage protocol response' };
      }),
      getName: jest.fn(() => 'two-stage')
    };
    mockAgent = {
      processStreaming: jest.fn().mockImplementation(async function* () {
        yield { type: 'CHUNK', content: 'Agent response' };
        yield { type: 'DONE', fullContent: 'Agent response' };
      })
    };

    createAdapter.mockReturnValue(mockAdapter);
    getTraceService.mockReturnValue(mockTraceService);
    getTools.mockReturnValue(mockTools);
    StandardProtocol.mockImplementation(() => mockStandardProtocol);
    TwoStageProtocol.mockImplementation(() => mockTwoStageProtocol);
    OrionAgentV2.mockImplementation(() => mockAgent);
  });

  describe('MVP default: TWO_STAGE_ENABLED not set or false', () => {
    test('should use StandardProtocol when TWO_STAGE_ENABLED is not set', async () => {
      // Environment variable not set
      delete process.env.TWO_STAGE_ENABLED;

      const response = await request(app)
        .post('/api/chat/messages')
        .send({
          projectId: 'test-project',
          message: 'Hello'
        })
        .expect(200);

      // After implementation, when TWO_STAGE_ENABLED is not set, StandardProtocol should be used.
      expect(StandardProtocol).toHaveBeenCalledTimes(1);
      expect(TwoStageProtocol).not.toHaveBeenCalled();
    });

    test('should use StandardProtocol when TWO_STAGE_ENABLED=false', async () => {
      process.env.TWO_STAGE_ENABLED = 'false';

      await request(app)
        .post('/api/chat/messages')
        .send({
          projectId: 'test-project',
          message: 'Hello'
        })
        .expect(200);

      // After implementation, when TWO_STAGE_ENABLED=false, StandardProtocol should be used.
      expect(StandardProtocol).toHaveBeenCalledTimes(1);
      expect(TwoStageProtocol).not.toHaveBeenCalled();
    });
  });

  describe('Explicit opt-in: TWO_STAGE_ENABLED=true', () => {
    test('should use TwoStageProtocol when TWO_STAGE_ENABLED=true', async () => {
      process.env.TWO_STAGE_ENABLED = 'true';

      await request(app)
        .post('/api/chat/messages')
        .send({
          projectId: 'test-project',
          message: 'Hello'
        })
        .expect(200);

      // Currently TwoStageProtocol is always used, so this test passes.
      // But we need to ensure that StandardProtocol is not used.
      expect(TwoStageProtocol).toHaveBeenCalledTimes(1);
      expect(StandardProtocol).not.toHaveBeenCalled();
    });
  });

  describe('Protocol selection wiring', () => {
    test('should pass correct dependencies to selected protocol constructor', async () => {
      // We'll test with TWO_STAGE_ENABLED=true to see current behavior.
      process.env.TWO_STAGE_ENABLED = 'true';

      await request(app)
        .post('/api/chat/messages')
        .send({
          projectId: 'test-project',
          message: 'Hello'
        })
        .expect(200);

      // Verify TwoStageProtocol constructor was called with adapter, tools, traceService
      expect(TwoStageProtocol).toHaveBeenCalledTimes(1);
      const twoStageArgs = TwoStageProtocol.mock.calls[0][0];
      expect(twoStageArgs.adapter).toBe(mockAdapter);
      expect(twoStageArgs.tools).toBe(mockTools);
      expect(twoStageArgs.traceService).toBe(mockTraceService);

      // Verify OrionAgentV2 constructor was called with the same protocol instance
      expect(OrionAgentV2).toHaveBeenCalledTimes(1);
      const agentArgs = OrionAgentV2.mock.calls[0][0];
      expect(agentArgs.protocol).toBe(mockTwoStageProtocol);
    });

    test('should not instantiate both protocols for a single request', async () => {
      // Regardless of TWO_STAGE_ENABLED value, only one protocol should be instantiated.
      process.env.TWO_STAGE_ENABLED = 'true';

      await request(app)
        .post('/api/chat/messages')
        .send({
          projectId: 'test-project',
          message: 'Hello'
        })
        .expect(200);

      // Ensure only the correct protocol is instantiated.
      expect(StandardProtocol.mock.calls.length + TwoStageProtocol.mock.calls.length).toBe(1);
      // For this case, TwoStageProtocol should be instantiated, not StandardProtocol.
      expect(TwoStageProtocol).toHaveBeenCalledTimes(1);
      expect(StandardProtocol).not.toHaveBeenCalled();
    });
  });

  describe('Anti-placeholder validation', () => {
    test('should fail if route uses a hardcoded protocol without reading TWO_STAGE_ENABLED', async () => {
      // This test ensures that the route reads TWO_STAGE_ENABLED environment variable.
      // A placeholder that always uses TwoStageProtocol (or always StandardProtocol) would fail.

      // TWO_STAGE_ENABLED=false -> StandardProtocol
      process.env.TWO_STAGE_ENABLED = 'false';
      await request(app)
        .post('/api/chat/messages')
        .send({ projectId: 'test-project', message: 'Hello' })
        .expect(200);

      expect(StandardProtocol).toHaveBeenCalledTimes(1);
      expect(TwoStageProtocol).toHaveBeenCalledTimes(0);

      jest.clearAllMocks();

      // TWO_STAGE_ENABLED=true -> TwoStageProtocol
      process.env.TWO_STAGE_ENABLED = 'true';
      await request(app)
        .post('/api/chat/messages')
        .send({ projectId: 'test-project', message: 'Hello' })
        .expect(200);

      expect(StandardProtocol).toHaveBeenCalledTimes(0);
      expect(TwoStageProtocol).toHaveBeenCalledTimes(1);
    });

    test('should fail if route does not instantiate any protocol', async () => {
      // This test ensures that a protocol is actually instantiated.
      // A placeholder that bypasses protocols entirely (e.g., returns static response) would fail.

      await request(app)
        .post('/api/chat/messages')
        .send({
          projectId: 'test-project',
          message: 'Hello'
        })
        .expect(200);

      // At least one protocol should be instantiated.
      const totalProtocolInstantiations = StandardProtocol.mock.calls.length + TwoStageProtocol.mock.calls.length;
      expect(totalProtocolInstantiations).toBeGreaterThan(0);
    });
  });
});
