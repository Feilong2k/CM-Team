const express = require('express');

const { query } = require('../db/connection');
const OrionAgent = require('../agents/OrionAgent');
const { getToolsForRole } = require('../../tools/registry');
const { DS_ChatAdapter, GPT41Adapter } = require('../adapters');
const StreamingService = require('../services/StreamingService');
const TraceService = require('../services/trace/TraceService');

// ProtocolStrategy imports
const { ProtocolExecutionContext, ProtocolEventTypes } = require('../agents/protocols/ProtocolStrategy');
const TwoStageProtocol = require('../agents/protocols/TwoStageProtocol');
const StandardProtocol = require('../agents/protocols/StandardProtocol');

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

  /**
   * Convert ProtocolEvents to the stream format expected by streamingService.handleSSE
   * @param {AsyncGenerator<ProtocolEvent>} protocolStream
   * @returns {AsyncGenerator<{chunk?, toolCalls?, done?, fullContent?, error?}>}
   */
  async function* protocolStreamToAdapterStream(protocolStream) {
    for await (const event of protocolStream) {
      switch (event.type) {
        case ProtocolEventTypes.CHUNK:
          yield { chunk: event.content };
          break;
        case ProtocolEventTypes.TOOL_CALLS:
          yield { toolCalls: event.calls };
          break;
        case ProtocolEventTypes.DONE:
          yield { done: true, fullContent: event.fullContent || '' };
          break;
        case ProtocolEventTypes.ERROR:
          yield { error: event.error?.message || 'Protocol error' };
          break;
        case ProtocolEventTypes.PHASE:
          // Phase events are internal, not forwarded to client
          break;
        default:
          // Forward unknown events as-is
          yield event;
      }
    }
  }

  /**
   * Build messages for protocol execution based on user input and context.
   *
   * Uses OrionAgent._prepareRequest to generate the same system prompt + history
   * Orion would normally send to the LLM. If _prepareRequest fails, throws an error
   * instead of falling back to a placeholder (safety guard removed per user request).
   */
  async function buildProtocolMessages(projectId, userMessage, mode, requestId) {
    // OrionAgent._prepareRequest must be available; if not, it's a configuration error.
    if (!orionAgent || typeof orionAgent._prepareRequest !== 'function') {
      throw new Error('OrionAgent._prepareRequest is not available; cannot build protocol messages.');
    }

    try {
      const { messages } = await orionAgent._prepareRequest(projectId, userMessage, {
        mode,
        requestId,
      });
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('_prepareRequest returned empty or invalid messages array.');
      }
      return messages;
    } catch (err) {
      // Log the error and re-throw so the route handler can send an error response.
      console.error('buildProtocolMessages: _prepareRequest failed:', err);
      throw new Error(`Failed to prepare protocol messages: ${err.message}`);
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

        // Check if two-stage protocol is enabled via environment variable
        const isTwoStageEnabled = process.env.TWO_STAGE_ENABLED === 'true';
        
        if (isTwoStageEnabled) {
          // Use TwoStageProtocol via ProtocolStrategy
          const twoStageProtocol = new TwoStageProtocol({
            adapter,
            tools,
            traceService: TraceService,
          });

          // Build messages for protocol execution (reuse OrionAgent context when possible)
          const messages = await buildProtocolMessages(projectId, content, mode, requestId);

          // Trace the actual system prompt + messages used for this two-stage call
          const systemPrompt =
            messages[0] && messages[0].role === 'system' ? messages[0].content : null;

          const safeMessages = messages.map((m) => ({
            role: m.role,
            content:
              typeof m.content === 'string'
                ? m.content.length > 1000
                  ? m.content.slice(0, 1000) + '…'
                  : m.content
                : '',
          }));

          try {
            await TraceService.logEvent({
              projectId,
              type: 'llm_call',
              source: 'orion',
              timestamp: new Date().toISOString(),
              summary: `LLM call (two-stage streaming) – mode=${mode}`,
              details: {
                systemPrompt: systemPrompt || null,
                messages: safeMessages,
              },
              requestId,
            });
          } catch (traceErr) {
            console.error('Trace logging failed for llm_call (two-stage streaming):', traceErr);
          }

          // Create ProtocolExecutionContext
          const executionContext = new ProtocolExecutionContext({
            messages,
            mode,
            projectId,
            requestId,
            adapter,
            tools,
            traceService: TraceService,
            config: {
              maxPhaseCycles: parseInt(process.env.MAX_PHASE_CYCLES || '3', 10),
              maxDuplicateAttempts: parseInt(process.env.MAX_DUPLICATE_ATTEMPTS || '3', 10),
              debugShowToolResults: process.env.TWO_STAGE_DEBUG === 'true',
            },
          });

          // Execute protocol streaming
          const protocolStream = twoStageProtocol.executeStreaming(executionContext);
          // Convert to adapter stream format
          const stream = protocolStreamToAdapterStream(protocolStream);
          
          // Define onComplete callback to persist the message
          const onComplete = async (fullContent) => {
            try {
              if (fullContent) {
                const model = orionAgent.getModelName
                  ? orionAgent.getModelName()
                  : "unknown";
                await streamingService.persistStreamedMessage(
                  external_id,
                  fullContent,
                  { model, mode, streamed: true, protocol: 'two_stage', ...metadata }
                );

                // Log Orion response trace event
                try {
                  const { computeContentHash } = require("../agents/OrionAgent");
                  const contentHash = typeof computeContentHash === "function"
                    ? computeContentHash(fullContent)
                    : fullContent.length;

                  await TraceService.logEvent({
                    projectId,
                    type: "orion_response",
                    source: "orion",
                    timestamp: new Date().toISOString(),
                    summary: `Two-stage Orion response (${mode})`,
                    details: redactDetails({
                      external_id,
                      content: fullContent,
                      metadata: { model, mode, streamed: true, protocol: 'two_stage', ...metadata },
                      model,
                      provider: process.env.ORION_MODEL_PROVIDER || "deepseek",
                      contentHash,
                      contentLength: fullContent.length,
                    }),
                    requestId,
                  });
                } catch (traceErr) {
                  console.error("Trace logging failed for two-stage Orion response:", traceErr);
                }
              }
            } catch (persistError) {
              console.error("Failed to persist two-stage streamed message:", persistError);
            }
          };

          // Handle SSE response using the same service
          await streamingService.handleSSE(stream, res, onComplete);
        } else {
          // Use standard protocol (OrionAgent.processStreaming)
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
          await streamingService.handleSSE(stream, res, onComplete);
        }
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

  return router;
}

// Export factory function
module.exports = createChatMessagesRouter;

// Also export default router for backward compatibility
const defaultRouter = createChatMessagesRouter();
module.exports.default = defaultRouter;
module.exports.router = defaultRouter;
