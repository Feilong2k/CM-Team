const express = require('express');
const router = express.Router();

const { query } = require('../db/connection');
const OrionAgent = require('../agents/OrionAgent');
const { getToolsForRole } = require('../../tools/registry');
const { DS_ChatAdapter, GPT41Adapter } = require('../adapters');
const StreamingService = require('../services/StreamingService');
const TraceService = require('../services/trace/TraceService');

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

// Choose adapter based on environment.
// If OPENAI_API_KEY is set and ORION_MODEL_PROVIDER=openai, use GPT-4.1.
// Otherwise fall back to DeepSeek.
let adapter;
if (process.env.ORION_MODEL_PROVIDER === 'openai') {
  adapter = new GPT41Adapter({
    apiKey: process.env.OPENAI_API_KEY,
  });
} else {
  adapter = new DS_ChatAdapter({
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
}

// Get comprehensive tool set for Orion (DatabaseTool + FileSystemTool instances)
const tools = getToolsForRole('Orion', 'act');

// OrionAgent now expects the full tools map, and will use tools.DatabaseTool
// internally for chatMessages and DB operations.
const orionAgent = new OrionAgent(adapter, tools);

// Streaming service instance
const streamingService = new StreamingService();

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
  const requestId = metadata && metadata.requestId ? metadata.requestId : undefined;

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

              // Also write a final-response probe file for side-by-side comparison
              const {
                logDuplicationProbe,
              } = require("../services/trace/DuplicationProbeLogger");
              logDuplicationProbe("final", {
                projectId,
                requestId,
                mode,
                hash: contentHash,
                length: fullContent.length,
                sample: fullContent.slice(0, 300),
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

module.exports = router;
