/**
 * @jest-environment node
 *
 * TRACE‑00x – Chat route reasoning persistence in trace_events
 *
 * Integration-leaning tests that verify:
 * 1. TRACE‑001 – Standard path reasoning persistence via /api/chat/messages
 * 2. TRACE‑002 – Non‑Reasoner adapters do not store reasoning via route
 * 3. TRACE‑003 – Chat history retrieval correctness
 *
 * Uses real Express app, but mocks LLM adapter, database, and TraceService to keep tests deterministic.
 */

// Mock dependencies
jest.mock('../../adapters/index', () => ({
  createAdapter: jest.fn()
}));
jest.mock('../../../tools/registry', () => ({
  getTools: jest.fn(() => ({}))
}));
jest.mock('../../services/trace/TraceService', () => ({
  getInstance: jest.fn(() => ({
    logEvent: jest.fn()
  }))
}));
jest.mock('../../db/connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] })
}));

const request = require('supertest');
const { createAdapter } = require('../../adapters/index');
const { getTools } = require('../../../tools/registry');
const { getInstance: getTraceService } = require('../../services/trace/TraceService');
const { query } = require('../../db/connection');

describe('TRACE‑001 – Reasoning persisted in trace_events via /api/chat/messages (StandardProtocol path)', () => {
  let app;
  let mockAdapter;
  let mockTraceService;

  beforeEach(() => {
    // Clear require cache to pick up new mocks and env
    jest.clearAllMocks();
    delete require.cache[require.resolve('../../server')];
    delete require.cache[require.resolve('../../routes/chatMessages')];

    // Set environment for StandardProtocol (no TWO_STAGE_ENABLED)
    process.env.PORT = '3000';
    process.env.CORS_ORIGIN_REGEX = '.*';
    process.env.SERVER_VERSION = 'test';
    process.env.ORION_MODEL_PROVIDER = 'DeepSeek';
    delete process.env.TWO_STAGE_ENABLED;

    // Mock adapter that yields reasoning and content
    mockAdapter = {
      sendMessagesStreaming: jest.fn().mockImplementation(async function* () {
        yield { reasoningChunk: 'Let me think...' };
        yield { chunk: 'Hello' };
        yield { reasoningChunk: ' more' };
        yield { done: true, fullContent: 'Hello', fullReasoning: 'Let me think... more' };
      }),
      getModelName: jest.fn(() => 'DeepSeek‑Reasoner')
    };
    createAdapter.mockReturnValue(mockAdapter);

    // Mock tools
    getTools.mockReturnValue({});

    // Mock trace service
    mockTraceService = { logEvent: jest.fn() };
    getTraceService.mockReturnValue(mockTraceService);

    // Mock database queries (for storing user message and Orion response)
    query.mockResolvedValue({ rows: [] });

    app = require('../../server');
  });

  test('should store reasoning in trace_events.details.reasoning when using DeepSeek Reasoner via route', async () => {
    const projectId = 'trace-project-standard';

    // Make POST request to the route
    await request(app)
      .post('/api/chat/messages')
      .send({
        projectId,
        message: 'Hi',
        mode: 'plan'
      })
      .expect(200);

    // Wait a short time for async trace logging (the protocol logs asynchronously)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify that TraceService.logEvent was called with an event containing reasoning
    expect(mockTraceService.logEvent).toHaveBeenCalled();

    // Find the call that logged reasoning (type 'llm_call' or 'orion_response')
    const reasoningCall = mockTraceService.logEvent.mock.calls.find(call => {
      const event = call[0];
      return event.details && event.details.reasoning;
    });
    expect(reasoningCall).toBeDefined();

    const event = reasoningCall[0];
    expect(event.details.reasoning).toBe('Let me think... more');
    expect(event.details.content).toBe('Hello');
  });
});

describe('TRACE‑002 – Non‑Reasoner adapters do not store reasoning via route', () => {
  let app;
  let mockAdapter;
  let mockTraceService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete require.cache[require.resolve('../../server')];
    delete require.cache[require.resolve('../../routes/chatMessages')];

    // Set environment for OpenAI (non-Reasoner)
    process.env.PORT = '3000';
    process.env.CORS_ORIGIN_REGEX = '.*';
    process.env.SERVER_VERSION = 'test';
    process.env.ORION_MODEL_PROVIDER = 'OpenAI';
    delete process.env.TWO_STAGE_ENABLED;

    // Mock adapter that yields only content (no reasoning)
    mockAdapter = {
      sendMessagesStreaming: jest.fn().mockImplementation(async function* () {
        yield { chunk: 'The answer is 42' };
        yield { done: true, fullContent: 'The answer is 42' };
      }),
      getModelName: jest.fn(() => 'GPT‑4.1')
    };
    createAdapter.mockReturnValue(mockAdapter);

    // Mock tools
    getTools.mockReturnValue({});

    // Mock trace service
    mockTraceService = { logEvent: jest.fn() };
    getTraceService.mockReturnValue(mockTraceService);

    // Mock database
    query.mockResolvedValue({ rows: [] });

    app = require('../../server');
  });

  test('should not have reasoning field in trace_events when using non‑Reasoner adapter', async () => {
    const projectId = 'trace-project-noreason';

    await request(app)
      .post('/api/chat/messages')
      .send({
        projectId,
        message: 'What is the answer?',
        mode: 'plan'
      })
      .expect(200);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify that TraceService.logEvent was called at least once
    expect(mockTraceService.logEvent).toHaveBeenCalled();

    // Ensure no call contains a reasoning field
    const callsWithReasoning = mockTraceService.logEvent.mock.calls.filter(call => {
      const event = call[0];
      return event.details && event.details.reasoning !== undefined;
    });
    expect(callsWithReasoning).toHaveLength(0);
  });
});

describe('TRACE‑003 – Chat history retrieval correctness', () => {
  let app;
  let mockAdapter;
  let mockTraceService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete require.cache[require.resolve('../../server')];
    delete require.cache[require.resolve('../../routes/chatMessages')];

    // Set up environment
    process.env.PORT = '3000';
    process.env.CORS_ORIGIN_REGEX = '.*';
    process.env.SERVER_VERSION = 'test';
    process.env.ORION_MODEL_PROVIDER = 'DeepSeek';
    delete process.env.TWO_STAGE_ENABLED;

    // Mock adapter
    mockAdapter = {
      sendMessagesStreaming: jest.fn().mockImplementation(async function* () {
        yield { chunk: 'I am Orion' };
        yield { done: true, fullContent: 'I am Orion' };
      }),
      getModelName: jest.fn(() => 'DeepSeek‑Reasoner')
    };
    createAdapter.mockReturnValue(mockAdapter);

    // Mock tools
    getTools.mockReturnValue({});

    // Mock trace service
    mockTraceService = { logEvent: jest.fn() };
    getTraceService.mockReturnValue(mockTraceService);

    // Mock database: return a predefined set of chat messages for SELECT queries
    query.mockImplementation((sql, params) => {
      // If the query is a SELECT on chat_messages (GET /messages)
      if (sql && sql.includes('SELECT') && sql.includes('chat_messages')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              external_id: 'trace-project-history',
              sender: 'user',
              content: 'Hello',
              metadata: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: 2,
              external_id: 'trace-project-history',
              sender: 'orion',
              content: 'I am Orion',
              metadata: { mode: 'plan', streamed: true, model: 'DeepSeek‑Reasoner' },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]
        });
      }
      // For INSERT queries (POST /messages) return empty rows
      return Promise.resolve({ rows: [] });
    });

    app = require('../../server');
  });

  test('GET /api/chat/messages returns expected chat history structure', async () => {
    const projectId = 'trace-project-history';

    // No need to POST, we are mocking the database directly.
    // Just call the GET endpoint.
    const response = await request(app)
      .get('/api/chat/messages')
      .query({
        project_id: projectId,
        limit: 50,
        offset: 0
      })
      .expect(200);

    // Response should be an array
    expect(Array.isArray(response.body)).toBe(true);

    // There should be two messages (user and orion)
    expect(response.body).toHaveLength(2);

    // Check structure of each message
    response.body.forEach(msg => {
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('external_id');
      expect(msg).toHaveProperty('sender');
      expect(msg).toHaveProperty('content');
      expect(msg).toHaveProperty('metadata');
      expect(msg).toHaveProperty('created_at');
      expect(msg).toHaveProperty('updated_at');
    });

    // There should be one user and one orion message
    const senders = response.body.map(m => m.sender);
    expect(senders).toContain('user');
    expect(senders).toContain('orion');

    // Orion messages should have metadata with mode and streamed: true
    const orionMsg = response.body.find(m => m.sender === 'orion');
    expect(orionMsg.metadata).toMatchObject({
      mode: 'plan',
      streamed: true
    });
  });
});
