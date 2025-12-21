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
 *
 * @param {Object} tools - Map of tool name -> implementation
 * @param {Array} toolCalls - Array of tool_call objects from the LLM
 * @param {Object} context - Shared context passed through to tools
 * @returns {Promise<Array>} Array of { toolCallId, toolName, result|error, success, timestamp }
 */
async function executeToolCalls(tools, toolCalls, context) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const results = [];

  for (const toolCall of toolCalls) {
    let toolNameLabel = 'unknown';

    try {
      const { tool, action } = parseFunctionCall(toolCall);
      toolNameLabel = action ? `${tool}.${action}` : tool;
    } catch (e) {
      // If parsing fails here, executeToolCall will also throw; keep label as 'unknown'.
    }

    try {
      const result = await executeToolCall(tools, toolCall, context);
      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        result,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        error: error.message,
        success: false,
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
