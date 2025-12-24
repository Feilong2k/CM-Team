const express = require('express');

const { query } = require('../db/connection');
const OrionAgent = require('../agents/OrionAgent');
const { getToolsForRole } = require('../../tools/registry');
const { DS_ChatAdapter, GPT41Adapter } = require('../adapters');
const StreamingService = require('../services/StreamingService');
const TraceService = require('../services/trace/TraceService');
const TwoStageOrchestrator = require('../services/TwoStageOrchestrator');

/**
 * Create chat messages router with configurable dependencies
 * @param {Object} options - Configuration options
 * @param {Object} options.adapter - Optional adapter to use (defaults to DS_ChatAdapter or GPT41Adapter based on env)
 * @param {Object} options.tools - Optional tools to use (defaults to getToolsForRole('Orion', 'act'))
 * @param {StreamingService} options.streamingService - Optional streaming service (defaults to new StreamingService())
 * @returns {express.Router} Configured router
 */
function createChatMessagesRouter(options = {}) {
  const router = express.Router();
  
  // Use provided adapter or create default based on environment
  let adapter = options.adapter;
  if (!adapter) {
    if (process.env.ORION_MODEL_PROVIDER === 'openai') {
      adapter = new GPT41Adapter({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else {
      adapter = new DS_ChatAdapter({
        apiKey: process.env.DEEPSEEK_API_KEY,
      });
    }
  }

  // Use provided tools or get default
  const tools = options.tools || getToolsForRole('Orion', 'act');

  // Use provided streaming service or create default
  const streamingService = options.streamingService || new StreamingService();

  // OrionAgent now expects the full tools map, and will use tools.DatabaseTool
  // internally for chatMessages and DB operations.
  const orionAgent = new OrionAgent(adapter, tools);

  function redactDetails(details) {
    // Implement redaction logic based on DEV_TRACE_EVENT_MODEL.md
    // For now, return details as is (to be improved)
    return details;
  }

  const validSenders = ['user', 'orion', 'system'];

  function validateSender(sender) {
    return validSenders.includes(sender);
  }

  function parsePaginationParams(limit, offset) {
    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);
    return {
      limit: isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit,
      offset: isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset,
    };
  }

  function deriveProjectId(externalId, metadata) {
    if (metadata && typeof metadata.projectId === 'string' && metadata.projectId.trim() !== '') {
      return metadata.projectId.trim();
    }
    if (typeof externalId === 'string') {
      const parts = externalId.split('-');
      if (parts.length > 0 && parts[0]) {
        return parts[0];
      }
    }
    return undefined;
  }

  // Helper to send error response for streaming or JSON
  function sendErrorResponse(err, req, res) {
    console.error('Error processing chat message:', err);
    
    const acceptHeader = req.get('Accept') || '';
    if (acceptHeader.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: err.message, 
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
      });
    }
  }

  router.post('/messages', async (req, res) => {
    const { external_id, sender, content, metadata } = req.body;

    if (!external_id || !sender || !content) {
      return res.status(400).json({ error: 'external_id, sender, and content are required' });
    }

    if (!validateSender(sender)) {
      return res.status(400).json({ error: 'Invalid sender value' });
    }

    const projectId = deriveProjectId(external_id, metadata) || 'P1';

    // Ensure every request gets a unique requestId so per-request tool dedup/soft-stop
    // never collides across different user turns.
    const requestId = (metadata && metadata.requestId)
      ? metadata.requestId
      : `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    try {
      if (sender === 'user') {
        // Log user message trace event
        try {
          await TraceService.logEvent({
            projectId,
            type: "user_message",
            source: "user",
            timestamp: new Date().toISOString(),
            summary: `User message: ${String(content).slice(0, 80)}`,
            details: redactDetails({
              external_id,
              content,
              metadata,
              model: orionAgent.getModelName
                ? orionAgent.getModelName()
                : "unknown",
              provider: process.env.ORION_MODEL_PROVIDER || "deepseek",
            }),
            requestId,
          });
        } catch (err) {
          console.error("Trace logging failed for user message:", err);
        }

        // Check if client wants streaming
        const acceptHeader = req.get("Accept") || "";
        const wantsStreaming = acceptHeader.includes("text/event-stream");
        const mode = (metadata && metadata.mode) || "plan";

        // Unified Streaming Logic for both PLAN and ACT modes
        // We ignore "wantsStreaming" check effectively, as the frontend will be updated to always stream.
        // But for backward compatibility with non-streaming clients (if any), we could keep a branch?
        // No, requirements say unified pipeline. We will force streaming or at least use the streaming agent method.
        // However, if the client sends a regular POST and expects JSON, we can't send SSE.
        // So we keep the check but use the SAME agent logic underneath? No, agent logic is generator.
        // Let's assume frontend IS updated to use SSE. If a client expects JSON, we'd need to consume the stream
        // and send JSON at end. But to simplify, let's assume we are serving our own frontend which uses SSE.

        // Use the unified streaming process
        const adapterStream = orionAgent.processStreaming(external_id, content, {
          mode,
          requestId,
        });
        const stream = streamingService.streamFromAdapter(adapterStream);

        // Define onComplete callback to persist the message
        const onComplete = async (fullContent) => {
          try {
            if (fullContent) {
              const model = orionAgent.getModelName
                ? orionAgent.getModelName()
                : "unknown";
              const persisted = await streamingService.persistStreamedMessage(
                external_id,
                fullContent,
                { model, mode, streamed: true, ...metadata }
              );

              // Log Orion streaming response
              try {
                const { computeContentHash } = require("../agents/OrionAgent");
                const contentHash =
                  typeof computeContentHash === "function"
                    ? computeContentHash(fullContent)
                    : fullContent.length; // Fallback simple metric if helper not exported

                await TraceService.logEvent({
                  projectId,
                  type: "orion_response",
                  source: "orion",
                  timestamp: new Date().toISOString(),
                  summary: `Orion streaming response (${mode})`,
                  details: redactDetails({
                    external_id,
                    content: fullContent,
                    metadata: persisted.metadata,
                    model: orionAgent.getModelName
                      ? orionAgent.getModelName()
                      : "unknown",
                    provider: process.env.ORION_MODEL_PROVIDER || "deepseek",
                    contentHash,
                    contentLength: fullContent.length,
                  }),
                  requestId,
                });

              } catch (traceErr) {
                console.error(
                  "Trace logging failed for Orion streaming response:",
                  traceErr
                );
              }
            }
          } catch (persistError) {
            console.error("Failed to persist streamed message:", persistError);
            // Error already sent via SSE in handleSSE
          }
        };

        // Handle SSE response
        // Note: If the client didn't ask for streaming (Accept: text/event-stream), handleSSE will likely
        // still try to write SSE headers. We should probably enforce SSE.
        // If we really need to support non-streaming clients, we would need a utility to consume the stream
        // and return JSON. For now, we assume the primary client (ChatPanel) will request streaming.

        await streamingService.handleSSE(stream, res, onComplete);
        return;
      } else {
        // For other senders, just store the message
        const result = await query(
          `INSERT INTO chat_messages (external_id, sender, content, metadata)
           VALUES ($1, $2, $3, $4)
           RETURNING id, external_id, sender, content, metadata, created_at, updated_at`,
          [external_id, sender, content, metadata || null]
        );
        return res.status(201).json(result.rows[0]);
      }
    } catch (err) {
      sendErrorResponse(err, req, res);
    }
  });

  router.get('/messages', async (req, res) => {
    const { project_id, limit, offset } = req.query;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    const { limit: limitNum, offset: offsetNum } = parsePaginationParams(limit, offset);

    try {
      const result = await query(
        `SELECT * FROM chat_messages
         WHERE external_id LIKE $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [`${project_id}%`, limitNum, offsetNum]
      );
      return res.json(result.rows);
    } catch (err) {
      console.error('Error fetching chat messages:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Two-stage/Triggered-Phase Prototype Route
  router.post('/messages_two_stage', async (req, res) => {
    const { external_id, sender, content, metadata } = req.body;

    // Check if two-stage protocol is enabled
    const isTwoStageEnabled = process.env.TWO_STAGE_ENABLED === 'true';
    
    if (!isTwoStageEnabled) {
      // Route exists but feature is disabled - return 501 Not Implemented
      return res.status(501).json({ 
        error: 'Two-stage protocol not enabled',
        message: 'Set TWO_STAGE_ENABLED=true to enable this feature'
      });
    }

    if (!external_id || !sender || !content) {
      return res.status(400).json({ error: 'external_id, sender, and content are required' });
    }

    if (!validateSender(sender)) {
      return res.status(400).json({ error: 'Invalid sender value' });
    }

    if (sender !== 'user') {
      return res.status(400).json({ error: 'Only user messages are accepted for two-stage protocol' });
    }

    const projectId = deriveProjectId(external_id, metadata) || 'P1';
    const requestId = (metadata && metadata.requestId)
      ? metadata.requestId
      : `req_two_stage_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const mode = (metadata && metadata.mode) || 'act';

    try {
      // Log user message trace event
      try {
        await TraceService.logEvent({
          projectId,
          type: "user_message",
          source: "user",
          timestamp: new Date().toISOString(),
          summary: `Two-stage user message: ${String(content).slice(0, 80)}`,
          details: redactDetails({
            external_id,
            content,
            metadata,
            protocol: 'two_stage',
            mode,
          }),
          requestId,
        });
      } catch (err) {
        console.error("Trace logging failed for two-stage user message:", err);
      }

      // Create TwoStageOrchestrator instance
      const twoStageOrchestrator = new TwoStageOrchestrator(adapter, tools);

      // Set up SSE response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Helper to write SSE events
      const writeSSE = (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Orchestrate the two-stage protocol and get final content
      const { finalContent } = await twoStageOrchestrator.orchestrate({
        external_id,
        content,
        mode,
        requestId,
        projectId
      }, writeSSE);

      // End the response
      res.end();

      // Persist the final message if we have content
      if (finalContent) {
        try {
          // Use StreamingService to persist the message (consistent with main route)
          const model = process.env.ORION_MODEL_PROVIDER === 'openai' ? 'gpt-4.1' : 'deepseek-chat';
          await streamingService.persistStreamedMessage(
            external_id,
            finalContent,
            { model, mode, streamed: true, protocol: 'two_stage', ...metadata }
          );

          // Log Orion response trace event
          try {
            const { computeContentHash } = require("../agents/OrionAgent");
            const contentHash = typeof computeContentHash === "function"
              ? computeContentHash(finalContent)
              : finalContent.length;

            await TraceService.logEvent({
              projectId,
              type: "orion_response",
              source: "orion",
              timestamp: new Date().toISOString(),
              summary: `Two-stage Orion response (${mode})`,
              details: redactDetails({
                external_id,
                content: finalContent,
                metadata: { model, mode, streamed: true, protocol: 'two_stage', ...metadata },
                model,
                provider: process.env.ORION_MODEL_PROVIDER || "deepseek",
                contentHash,
                contentLength: finalContent.length,
              }),
              requestId,
            });
          } catch (traceErr) {
            console.error("Trace logging failed for two-stage Orion response:", traceErr);
          }
        } catch (persistError) {
          console.error("Failed to persist two-stage streamed message:", persistError);
          // Error already sent via SSE, so just log
        }
      }

    } catch (err) {
      console.error('Error in two-stage protocol:', err);
      
      const acceptHeader = req.get('Accept') || '';
      if (acceptHeader.includes('text/event-stream')) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      } else {
        return res.status(500).json({ 
          error: 'Internal server error', 
          details: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
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
