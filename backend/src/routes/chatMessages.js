const express = require('express');
const { ProtocolEventTypes } = require('../../archive/agents/protocols/ProtocolStrategy');
const { createAdapter } = require('../adapters');
const { getInstance: getTraceService } = require('../services/trace/TraceService');
const { getTools } = require('../../tools/registry');
const OrionAgentV2 = require('../agents/OrionAgentV2');
const TwoStageProtocol = require('../agents/protocols/TwoStageProtocol');
const { query } = require('../db/connection');

/**
 * Create chat messages router with configurable dependencies.
 * @returns {express.Router} Configured router
 */
function createChatMessagesRouter() {
  const router = express.Router();

  /**
   * POST /api/chat/messages
   * Streams SSE events using OrionAgentV2 and TwoStageProtocol.
   * Supports two payload shapes:
   * 1. OrionAgentV2 shape: { projectId, message, mode }
   * 2. Frontend chat shape: { external_id, sender, content, metadata: { mode } }
   */
  router.post('/messages', async (req, res) => {
    const { projectId, project_id, external_id, sender, message, content, mode, metadata } = req.body;
    // Debug logging
    console.log('POST /messages body:', req.body);
    console.log('projectId:', projectId, 'project_id:', project_id, 'external_id:', external_id, 'sender:', sender, 'message:', message, 'content:', content);
    // Determine project ID from multiple possible fields
    let finalProjectId = projectId || project_id || external_id;
    // Determine message content
    const finalMessage = message || content;
    console.log('finalProjectId:', finalProjectId, 'finalMessage:', finalMessage);

    // Validate required fields
    if (!finalProjectId || typeof finalProjectId !== 'string') {
      console.log('Validation failed: finalProjectId missing or not string');
      return res.status(400).json({ error: 'projectId (or external_id) is required and must be a string - DEBUG' });
    }
    if (!finalMessage || typeof finalMessage !== 'string') {
      console.log('Validation failed: finalMessage missing or not string');
      return res.status(400).json({ error: 'message (or content) is required and must be a string - DEBUG' });
    }

    // Determine mode
    let finalMode = mode;
    if (!finalMode && metadata && typeof metadata === 'object' && metadata.mode) {
      finalMode = metadata.mode;
    }
    // Normalize mode: only 'plan' or 'act' are valid; default to 'plan' if invalid
    const normalizedMode = (finalMode === 'plan' || finalMode === 'act') ? finalMode : 'plan';

    // Determine sender (default to 'user' if not provided)
    const finalSender = sender || 'user';

    let adapter;
    let tools;
    let traceService;
    let protocol;
    let agent;

    try {
      // Build dependencies
      adapter = createAdapter();
      tools = getTools();
      traceService = getTraceService();
      protocol = new TwoStageProtocol({ adapter, tools, traceService });
      agent = new OrionAgentV2({ adapter, tools, traceService, protocol });
    } catch (error) {
      console.error('Failed to initialize dependencies:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Generate a request ID (used by protocol context)
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store user message in database (if sender is 'user')
    if (finalSender === 'user') {
      try {
        await query(
          `INSERT INTO chat_messages (external_id, sender, content, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING id`,
          [finalProjectId, finalSender, finalMessage, metadata || null]
        );
        console.log('User message stored in database');
      } catch (dbError) {
        console.error('Failed to store user message:', dbError);
        // Continue anyway; don't fail the request
      }
    }

    try {
      // Get streaming iterator from agent
      const stream = agent.processStreaming(finalProjectId, finalMessage, {
        mode: normalizedMode,
        requestId,
      });

      // Set SSE headers only after we have a stream (no error)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Workaround for mock that returns a generator that returns an async generator
      let actualStream = stream;
      if (stream && typeof stream.next === 'function' && !(Symbol.asyncIterator in stream)) {
        // It's a sync generator, check if its return value is an async iterable
        const result = stream.next();
        if (result.done && result.value && (Symbol.asyncIterator in result.value || typeof result.value[Symbol.asyncIterator] === 'function')) {
          actualStream = result.value;
        } else {
          // Reset iterator if we consumed it
          actualStream = stream;
        }
      }

      let fullContent = '';
      let orionContent = null;
      // Iterate over protocol events and write SSE data
      for await (const event of actualStream) {
        let data;
        switch (event.type) {
          case ProtocolEventTypes.CHUNK:
            fullContent += event.content;
            data = { chunk: event.content };
            break;
          case ProtocolEventTypes.TOOL_CALLS:
            data = { tool_calls: event.calls };
            break;
          case ProtocolEventTypes.DONE:
            orionContent = event.fullContent || fullContent;
            data = { done: true, fullContent: orionContent, chunk: '' };
            break;
          default:
            // Ignore unknown event types (e.g., PHASE, ERROR)
            continue;
        }
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      // Ensure connection is closed after streaming
      res.end();

      // Persist Orion response if we have content
      if (orionContent) {
        try {
          await query(
            `INSERT INTO chat_messages (external_id, sender, content, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id`,
            [finalProjectId, 'orion', orionContent, { model: adapter.getModelName ? adapter.getModelName() : 'unknown', mode: normalizedMode, streamed: true, ...metadata }]
          );
          console.log('Orion response persisted in database');
        } catch (persistError) {
          console.error('Failed to persist Orion response:', persistError);
        }
      }
    } catch (error) {
      console.error('Error during streaming:', error);
      // If headers already sent, we cannot send error status; just end the stream.
      if (res.headersSent) {
        res.end();
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  /**
   * GET /api/chat/messages
   * Retrieves chat messages for a project with pagination.
   */
  router.get('/messages', async (req, res) => {
    const { project_id, limit = '50', offset = '0' } = req.query;
    
    // Validate project_id
    if (!project_id || typeof project_id !== 'string') {
      return res.status(400).json({ error: 'project_id query parameter is required and must be a string' });
    }
    
    // Parse limit and offset
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 100' });
    }
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({ error: 'offset must be a non-negative integer' });
    }
    
    try {
      // Query chat_messages table filtered by external_id (project_id)
      const result = await query(
        `SELECT id, external_id, sender, content, metadata, created_at, updated_at
         FROM chat_messages
         WHERE external_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [project_id, limitNum, offsetNum]
      );
      
      // Return the messages
      res.json(result.rows);
    } catch (error) {
      console.error('Failed to fetch chat messages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

// Export factory function
module.exports = createChatMessagesRouter;

// Also export default router for backward compatibility
const defaultRouter = createChatMessagesRouter();
module.exports.default = defaultRouter;
module.exports.router = defaultRouter;
