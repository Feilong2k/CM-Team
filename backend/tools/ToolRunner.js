// Centralized tool execution helpers for all agents and adapters.
// This module is the single place that knows how to:
// - Parse an LLM tool_call (OpenAI-style function call)
// - Look up the correct tool implementation
// - Execute it with a shared context object
//
// Any adapter (DeepSeek, GPT-4.1, Gemini, etc.) that surfaces tool_calls
// in the standard shape can pass them through ToolRunner, so we don’t need
// per-model or per-path (streaming vs non-streaming) tool wiring.

const { parseFunctionCall } = require('./functionDefinitions');

/**
 * Execute a single tool call against a tool registry.
 *
 * @param {Object} tools - Map of tool name -> implementation (e.g., from tools/registry.js)
 * @param {Object} toolCall - The tool_call object from the LLM
 * @param {Object} context - Shared context passed through to tools (projectId, requestId, etc.)
 * @returns {Promise<any>} The raw result returned by the tool implementation
 */
async function executeToolCall(tools, toolCall, context) {
  const { tool, action, params } = parseFunctionCall(toolCall);

  if (!tools || !tools[tool]) {
    throw new Error(`Tool "${tool}" not found in tool registry`);
  }

  const toolInstance = tools[tool];
  const fn = toolInstance && typeof toolInstance[action] === 'function'
    ? toolInstance[action].bind(toolInstance)
    : null;

  if (!fn) {
    throw new Error(`Tool "${tool}" action "${action}" is not callable`);
  }

  const toolArgs = { ...params, context };

  try {
    return await fn(toolArgs);
  } catch (error) {
    throw new Error(`Tool "${tool}_${action}" execution failed: ${error.message}`);
  }
}

/**
 * Execute an array of tool calls and return structured results for logging/prompting.
 * Implements a simple retry policy per tool_call: up to maxAttempts, sequentially.
 *
 * @param {Object} tools - Map of tool name -> implementation
 * @param {Array} toolCalls - Array of tool_call objects from the LLM
 * @param {Object} context - Shared context passed through to tools
 * @returns {Promise<Array>} Array of { toolCallId, toolName, result|error, success, attempts, timestamp }
 */
// In-memory maps for basic deduplication and rate limiting. These are process-
// local and reset on server restart, which is sufficient for MVP.
const recentToolCalls = new Map(); // key -> number[] of timestamps (ms)
const cachedToolResults = new Map(); // key -> { timestamp, resultSummary }

async function executeToolCalls(tools, toolCalls, context) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const results = [];
  const maxAttempts = 3;
  const rateWindowMs = 10_000; // 10 seconds
  const rateLimitCount = 3;    // max 3 real executions per window

  const now = Date.now();

  for (const toolCall of toolCalls) {
    let toolNameLabel = 'unknown';
    let parsed = null;

    try {
      parsed = parseFunctionCall(toolCall);
      const { tool, action } = parsed;
      toolNameLabel = action ? `${tool}.${action}` : tool;
    } catch (e) {
      // If parsing fails here, executeToolCall will also throw; keep label as 'unknown'.
    }

    // Build a coarse key for dedup / rate limiting. We intentionally include
    // params and the projectId (if present) so DatabaseTool calls like
    // get_subtask_full_context(subtask_id, project_id) group correctly.
    const params = parsed ? parsed.params || {} : {};
    const rateKey = `${toolNameLabel}|${JSON.stringify({ params, projectId: context?.projectId || null })}`;

    // Rate limiting: track timestamps per key and enforce 3 calls per 10s.
    const list = recentToolCalls.get(rateKey) || [];
    const freshList = list.filter(ts => now - ts <= rateWindowMs);

    if (freshList.length >= rateLimitCount) {
      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        success: false,
        error: 'TOOL_CALL_TOO_FREQUENT',
        details: {
          message: `You called ${toolNameLabel} too frequently. Please process existing results first.`,
          cooldown_seconds: Math.ceil((rateWindowMs - (now - freshList[0])) / 1000),
        },
        attempts: 0,
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    // Deduplication: if we have a cached successful result for this key in the
    // recent window, return a warning payload instead of executing again.
    const cached = cachedToolResults.get(rateKey);
    if (cached && now - cached.timestamp <= rateWindowMs) {
      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        success: true,
        result: {
          warning: 'DUPLICATE_TOOL_CALL',
          message: 'You already called this tool with these parameters. Reusing previous result.',
          previous_timestamp: new Date(cached.timestamp).toISOString(),
          previous_summary: cached.resultSummary || null,
        },
        attempts: 0,
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    // Record this attempt for rate tracking before actual execution.
    freshList.push(now);
    recentToolCalls.set(rateKey, freshList);

    let attempts = 0;
    let success = false;
    let finalResult = undefined;
    let finalError = undefined;

    while (attempts < maxAttempts && !success) {
      attempts += 1;
      try {
        finalResult = await executeToolCall(tools, toolCall, context);
        success = true;
      } catch (error) {
        finalError = error;
        if (attempts >= maxAttempts) {
          break;
        }
      }
    }

    if (success) {
      // Cache a lightweight summary for dedup responses. For now we just cache
      // the whole result; callers can decide how to summarize it.
      cachedToolResults.set(rateKey, {
        timestamp: now,
        resultSummary: finalResult,
      });

      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        result: finalResult,
        success: true,
        attempts,
        timestamp: new Date().toISOString(),
      });
    } else {
      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        error: finalError ? finalError.message : 'Unknown tool execution error',
        success: false,
        attempts,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

module.exports = {
  executeToolCall,
  executeToolCalls,
};
