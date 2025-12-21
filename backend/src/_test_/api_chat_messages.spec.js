/**
 * Unit tests for Feature 2 - Task 0 - Subtask 2 (F2-T0-S2) API endpoints
 * 
 * Tests the POST and GET /api/chat/messages endpoints with project_id filtering.
 * 
 * These tests follow TDD principles: they should initially fail until Devon implements the API.
 */

process.env.PORT = process.env.PORT || '3500';
process.env.CORS_ORIGIN_REGEX = process.env.CORS_ORIGIN_REGEX || '^http:\\/\\/localhost:61[0-1][0-9]$';

const request = require('supertest');
const app = require('../../src/server'); // Assuming Express app is exported from here
const path = require('path');
const dotenv = require('dotenv');
const { query } = require('../../src/db/connection');

// Load environment variables explicitly from backend/.env for test environment consistency
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

describe('F2-T0-S2 Chat Messages API', () => {
  const baseUrl = '/api/chat/messages';
  const testProjectId = 'p1';
  let createdMessageId;

  describe('POST /api/chat/messages', () => {
    it('should create a new chat message with valid data', async () => {
      const response = await request(app)
        .post(baseUrl)
        .send({
          external_id: 'p1-abc123',
          sender: 'user',
          content: 'Hello, Orion!',
          metadata: { model: 'gpt-4' }
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.external_id).toBe('p1-abc123');
      expect(response.body.sender).toBe('user');
      expect(response.body.content).toBe('Hello, Orion!');
      createdMessageId = response.body.id;
    });

    it('should reject invalid sender values', async () => {
      await request(app)
        .post(baseUrl)
        .send({
          external_id: 'p1-abc123',
          sender: 'admin',
          content: 'Invalid sender test'
        })
        .expect(400);
    });

    it('should reject missing required fields', async () => {
      await request(app)
        .post(baseUrl)
        .send({
          external_id: 'p1-abc123',
          sender: 'user'
          // missing content
        })
        .expect(400);
    });
  });

  describe('GET /api/chat/messages', () => {
    it('should return messages filtered by project_id', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ project_id: testProjectId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Optionally check that all returned messages have external_id starting with project_id
      response.body.forEach(msg => {
        expect(msg.external_id.startsWith(testProjectId)).toBe(true);
      });
    });

    it('should support pagination with limit and offset', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ project_id: testProjectId, limit: 1, offset: 0 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should return 400 if project_id is missing', async () => {
      await request(app)
        .get(baseUrl)
        .expect(400);
    });
  });
});

describe('F2-T1-S4 Chat Messages Streaming API (A1)', () => {
  const baseUrl = '/api/chat/messages';

  // Mock LLM adapter and OrionAgent for streaming tests
  let mockAdapter;
  let mockOrionAgent;
  let mockStreamingService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock the adapter's streaming interface
    mockAdapter = {
      sendMessagesStreaming: jest.fn()
    };
    
    // Mock OrionAgent to use our mock adapter
    mockOrionAgent = {
      process: jest.fn(),
      processStreaming: jest.fn()
    };
    
    // Mock StreamingService
    mockStreamingService = {
      streamContent: jest.fn(),
      streamFromAdapter: jest.fn(),
      persistStreamedMessage: jest.fn(),
      handleSSE: jest.fn()
    };
    
    // Replace the real imports with mocks
    jest.mock('../../src/adapters/DS_ChatAdapter', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => mockAdapter)
    }));
    
    jest.mock('../../src/adapters/GPT41Adapter', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => mockAdapter)
    }));
    
    jest.mock('../../src/agents/OrionAgent', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => mockOrionAgent)
    }));
    
    jest.mock('../../src/services/StreamingService', () => ({
      __esModule: true,
      default: jest.fn().mockImplementation(() => mockStreamingService)
    }));
    
    // Clear require cache to pick up mocks
    delete require.cache[require.resolve('../../src/server')];
    delete require.cache[require.resolve('../../src/routes/chatMessages')];
  });

  afterEach(() => {
    // Restore original implementations
    jest.restoreAllMocks();
  });

  describe('POST /api/chat/messages (streaming)', () => {
    it('should return a stream (SSE) for user messages', async () => {
      // Setup mock streaming response
      async function* mockStream() {
        yield { chunk: 'Hello ' };
        yield { chunk: 'from ' };
        yield { chunk: 'AI' };
        yield { done: true, fullContent: 'Hello from AI' };
      }
      
      mockAdapter.sendMessagesStreaming.mockReturnValue(mockStream());
      mockOrionAgent.processStreaming.mockResolvedValue({
        content: 'Hello from AI',
        metadata: {}
      });
      
      mockStreamingService.streamFromAdapter.mockReturnValue(mockStream());
      mockStreamingService.handleSSE.mockImplementation(async (stream, res) => {
        // Simulate SSE response
        res.setHeader('Content-Type', 'text/event-stream');
        for await (const event of stream) {
          // Simulate writing SSE
        }
        res.end();
      });

      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'p1-stream-test-1',
          sender: 'user',
          content: 'Stream test message',
          metadata: { mode: 'plan' }
        })
        .expect('Content-Type', 'text/event-stream')
        .expect(200);

      // Verify we get streaming response
      expect(response.text).toBeTruthy();
      // Should contain SSE format
      expect(response.text).toMatch(/^data:/m);
      
      // Verify adapter was called with streaming flag
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ stream: true })
      );
    });

    it('should deliver real adapter chunks via SSE (not word-splitting simulation)', async () => {
      // Create a mock stream with specific chunk pattern that word-splitting wouldn't produce
      async function* mockStream() {
        yield { chunk: 'Hel' };
        yield { chunk: 'lo ' };
        yield { chunk: 'wor' };
        yield { chunk: 'ld' };
        yield { done: true, fullContent: 'Hello world' };
      }
      
      mockAdapter.sendMessagesStreaming.mockReturnValue(mockStream());
      mockStreamingService.streamFromAdapter.mockReturnValue(mockStream());
      mockStreamingService.handleSSE.mockImplementation(async (stream, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        const chunks = [];
        for await (const event of stream) {
          chunks.push(event);
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        res.end();
        
        // Verify chunks are not word-split (i.e., chunk boundaries don't align with spaces)
        const chunkTexts = chunks.filter(c => c.chunk).map(c => c.chunk);
        expect(chunkTexts).toEqual(['Hel', 'lo ', 'wor', 'ld']);
      });

      await request(app)
        .post(baseUrl)
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'p1-stream-test-2',
          sender: 'user',
          content: 'Hello world',
          metadata: { mode: 'plan' }
        })
        .expect('Content-Type', 'text/event-stream')
        .expect(200);

      // Verify streamFromAdapter was called, not streamContent (simulation)
      expect(mockStreamingService.streamFromAdapter).toHaveBeenCalled();
      expect(mockStreamingService.streamContent).not.toHaveBeenCalled();
    });

    it('should persist the complete message to chat_messages table after real adapter stream ends', async () => {
      const externalId = 'p1-stream-test-3-' + Date.now();
      
      async function* mockStream() {
        yield { chunk: 'Full ' };
        yield { chunk: 'message ' };
        yield { chunk: 'content' };
        yield { done: true, fullContent: 'Full message content' };
      }
      
      mockAdapter.sendMessagesStreaming.mockReturnValue(mockStream());
      mockStreamingService.streamFromAdapter.mockReturnValue(mockStream());
      
      // Mock persistence
      const mockPersistedMessage = {
        id: 1,
        external_id: externalId,
        sender: 'orion',
        content: 'Full message content',
        metadata: { mode: 'plan', streamed: true }
      };
      mockStreamingService.persistStreamedMessage.mockResolvedValue(mockPersistedMessage);
      
      mockStreamingService.handleSSE.mockImplementation(async (stream, res, onComplete) => {
        res.setHeader('Content-Type', 'text/event-stream');
        let fullContent = null;
        for await (const event of stream) {
          if (event.done && event.fullContent) {
            fullContent = event.fullContent;
          }
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        if (onComplete && fullContent) {
          await onComplete(fullContent);
        }
        res.end();
      });

      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'text/event-stream')
        .send({
          external_id: externalId,
          sender: 'user',
          content: 'Test persistence',
          metadata: { mode: 'plan' }
        })
        .expect('Content-Type', 'text/event-stream')
        .expect(200);

      // Verify persistence was called with correct content
      expect(mockStreamingService.persistStreamedMessage).toHaveBeenCalledWith(
        externalId,
        'Full message content',
        expect.objectContaining({ mode: 'plan', streamed: true })
      );
      
      // Verify the stream contained the done event with full content
      const lines = response.text.split('\n').filter(line => line.startsWith('data:'));
      const doneEvents = lines.filter(line => {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          return data.done === true;
        } catch {
          return false;
        }
      });
      expect(doneEvents.length).toBe(1);
    });

    it('should handle real adapter errors mid-stream with error event (not simulated)', async () => {
      // Mock adapter that throws after first chunk
      async function* mockErrorStream() {
        yield { chunk: 'First ' };
        throw new Error('Adapter connection lost');
      }
      
      mockAdapter.sendMessagesStreaming.mockReturnValue(mockErrorStream());
      mockStreamingService.streamFromAdapter.mockReturnValue(mockErrorStream());
      
      mockStreamingService.handleSSE.mockImplementation(async (stream, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        try {
          for await (const event of stream) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        } catch (error) {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        }
        res.end();
      });

      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'p1-stream-error-test',
          sender: 'user',
          content: 'Trigger real error',
          metadata: { mode: 'plan' }
        })
        .expect('Content-Type', 'text/event-stream');

      // Should get error event from adapter, not simulation flag
      const lines = response.text.split('\n').filter(line => line.startsWith('data:'));
      const errorLines = lines.filter(line => {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          return data.error !== undefined && data.error.includes('Adapter connection lost');
        } catch {
          return false;
        }
      });
      
      expect(errorLines.length).toBeGreaterThan(0);
      // Verify no simulation flags were used
      expect(mockAdapter.sendMessagesStreaming).toHaveBeenCalledWith(
        expect.any(Array),
        expect.not.objectContaining({ forceError: true })
      );
    });

    it('should handle database errors during persistence with error event', async () => {
      async function* mockStream() {
        yield { chunk: 'Content ' };
        yield { done: true, fullContent: 'Content to persist' };
      }
      
      mockAdapter.sendMessagesStreaming.mockReturnValue(mockStream());
      mockStreamingService.streamFromAdapter.mockReturnValue(mockStream());
      
      // Mock persistence to throw
      mockStreamingService.persistStreamedMessage.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      mockStreamingService.handleSSE.mockImplementation(async (stream, res, onComplete) => {
        res.setHeader('Content-Type', 'text/event-stream');
        let fullContent = null;
        for await (const event of stream) {
          if (event.done && event.fullContent) {
            fullContent = event.fullContent;
          }
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        if (onComplete && fullContent) {
          try {
            await onComplete(fullContent);
          } catch (error) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          }
        }
        res.end();
      });

      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'p1-stream-db-error-test',
          sender: 'user',
          content: 'Trigger DB error',
          metadata: { mode: 'plan' }
        })
        .expect('Content-Type', 'text/event-stream');

      // Should receive error event from persistence failure
      const lines = response.text.split('\n').filter(line => line.startsWith('data:'));
      const errorLines = lines.filter(line => {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          return data.error !== undefined && data.error.includes('Database connection failed');
        } catch {
          return false;
        }
      });
      
      expect(errorLines.length).toBeGreaterThan(0);
      // Verify no simulation flags were used
      expect(mockStreamingService.persistStreamedMessage).toHaveBeenCalled();
    });

    it('should maintain backward compatibility for non-streaming clients', async () => {
      // For non-streaming, adapter should be called without stream flag
      mockAdapter.sendMessages.mockResolvedValue({
        content: 'Non-streaming response',
        toolCalls: []
      });
      mockOrionAgent.process.mockResolvedValue({
        content: 'Non-streaming response',
        metadata: {}
      });

      const response = await request(app)
        .post(baseUrl)
        .send({
          external_id: 'p1-non-stream-test',
          sender: 'user',
          content: 'Non-streaming test',
          metadata: { mode: 'plan' }
        })
        .expect(200);

      // Should return JSON response (not stream)
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      // Adapter should be called without stream flag
      expect(mockAdapter.sendMessages).toHaveBeenCalledWith(
        expect.any(Array),
        expect.not.objectContaining({ stream: true })
      );
    });

    it('should still handle non-user messages as one-shot responses', async () => {
      const response = await request(app)
        .post(baseUrl)
        .send({
          external_id: 'p1-system-msg',
          sender: 'system',
          content: 'System message',
          metadata: { type: 'info' }
        })
        .expect(201);

      expect(response.body.sender).toBe('system');
      expect(response.body.content).toBe('System message');
      // Adapter should not be called for non-user messages
      expect(mockAdapter.sendMessages).not.toHaveBeenCalled();
      expect(mockAdapter.sendMessagesStreaming).not.toHaveBeenCalled();
    });

    it('should fail if adapter does not support streaming interface', async () => {
      // Mock adapter without streaming method
      delete mockAdapter.sendMessagesStreaming;
      
      // This test should fail because adapter doesn't support streaming
      // The implementation should throw a clear error
      await request(app)
        .post(baseUrl)
        .set('Accept', 'text/event-stream')
        .send({
          external_id: 'p1-no-stream-support',
          sender: 'user',
          content: 'Test',
          metadata: { mode: 'plan' }
        })
        .expect(500); // Should fail with server error
        
      // Alternative: could expect 400 with clear error message
    });
  });
});
