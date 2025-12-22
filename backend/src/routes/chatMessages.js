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
          type: 'user_message',
          source: 'user',
          timestamp: new Date().toISOString(),
          summary: `User message: ${String(content).slice(0, 80)}`,
          details: redactDetails({ external_id, content, metadata }),
          requestId,
        });
      } catch (err) {
        console.error('Trace logging failed for user message:', err);
      }

      // Check if client wants streaming
      const acceptHeader = req.get('Accept') || '';
      const wantsStreaming = acceptHeader.includes('text/event-stream');
      const mode = (metadata && metadata.mode) || 'plan';
      
      if (wantsStreaming) {
        // Use the real adapter streaming via OrionAgent.processStreaming
        const adapterStream = orionAgent.processStreaming(external_id, content, { mode });
        const stream = streamingService.streamFromAdapter(adapterStream);
        
        // Define onComplete callback to persist the message
        const onComplete = async (fullContent) => {
          try {
            if (fullContent) {
              const model = orionAgent.getModelName ? orionAgent.getModelName() : 'unknown';
              const persisted = await streamingService.persistStreamedMessage(
                external_id, 
                fullContent, 
                { model, mode, streamed: true, ...metadata }
              );

              // Log Orion streaming response
              try {
                await TraceService.logEvent({
                  projectId,
                  type: 'orion_response',
                  source: 'orion',
                  timestamp: new Date().toISOString(),
                  summary: `Orion streaming response (${mode})`,
                  details: redactDetails({ external_id, content: fullContent, metadata: persisted.metadata }),
                  requestId,
                });
              } catch (traceErr) {
                console.error('Trace logging failed for Orion streaming response:', traceErr);
              }
            }
          } catch (persistError) {
            console.error('Failed to persist streamed message:', persistError);
            // Error already sent via SSE in handleSSE
          }
        };
        
        // Handle SSE response
        await streamingService.handleSSE(stream, res, onComplete);
        return;
      } else {
        // Non-streaming response
        // Optional: log LLM call/result around orionAgent.process
        try {
          await TraceService.logEvent({
            projectId,
            type: 'llm_call',
            source: 'system',
            timestamp: new Date().toISOString(),
            summary: `LLM call (mode=${mode})`,
            details: { external_id, mode },
            requestId,
          });
        } catch (traceErr) {
          console.error('Trace logging failed for llm_call:', traceErr);
        }

        const response = await orionAgent.process(external_id, content, { mode });

        try {
          await TraceService.logEvent({
            projectId,
            type: 'llm_result',
            source: 'system',
            timestamp: new Date().toISOString(),
            summary: `LLM result (mode=${mode})`,
            details: { external_id, mode, model: orionAgent.getModelName ? orionAgent.getModelName() : 'unknown' },
            requestId,
          });
        } catch (traceErr) {
          console.error('Trace logging failed for llm_result:', traceErr);
        }
        
        // Persist the Orion response to database
        const savedMessage = await query(
          `INSERT INTO chat_messages (external_id, sender, content, metadata)
           VALUES ($1, $2, $3, $4)
           RETURNING id, external_id, sender, content, metadata, created_at, updated_at`,
          [external_id, 'orion', response.content, { ...response.metadata, mode }]
        );

        // Log Orion response trace event
        try {
          await TraceService.logEvent({
            projectId,
            type: 'orion_response',
            source: 'orion',
            timestamp: new Date().toISOString(),
            summary: `Orion response (${mode}): ${String(response.content || '').slice(0, 80)}`,
            details: redactDetails({ external_id, content: response.content, metadata: response.metadata }),
            requestId,
          });
        } catch (traceErr) {
          console.error('Trace logging failed for Orion response:', traceErr);
        }
        
        return res.status(200).json({
          id: savedMessage.rows[0].id,
          message: response.content,
          metadata: response.metadata,
        });
      }
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
