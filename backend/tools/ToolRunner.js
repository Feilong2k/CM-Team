// Centralized tool execution helpers for all agents and adapters.
// This module is the single place that knows how to:
// - Parse an LLM tool_call (OpenAI-style function call)
// - Look up the correct tool implementation
// - Execute it with a shared context object
//
// Any adapter (DeepSeek, GPT-4.1, Gemini, etc.) that surfaces tool_calls
// in the standard shape can pass them through ToolRunner, so we don't need
// per-model or per-path (streaming vs non-streaming) tool wiring.

const { parseFunctionCall } = require('./functionDefinitions');
const TraceService = require('../src/services/trace/TraceService');

/**
 * Build a canonical signature for a tool call.
 * Normalizes arguments by deep-sorting keys and trimming strings.
 *
 * @param {string} toolName - Tool name (e.g., "DatabaseTool")
 * @param {string} action - Action name (e.g., "get_subtask_full_context")
 * @param {Object} params - Tool parameters
 * @param {string} projectId - Project ID from context
 * @returns {string} Canonical signature string
 */
function normalizePathForSignature(value) {
  if (value === undefined || value === null) return value;
  let p = String(value).trim();
  // normalize windows separators -> forward slashes
  p = p.replace(/\\/g, '/');
  // normalize common "current dir" variants
  if (p === '') p = '.';
  if (p === './') p = '.';
  // remove leading "./"
  if (p.startsWith('./')) p = p.slice(2);
  if (p === '') p = '.';
  // collapse duplicate slashes
  p = p.replace(/\/+/g, '/');
  // remove trailing slashes (but keep root '.' intact)
  if (p.length > 1) p = p.replace(/\/+$/g, '');
  return p;
}

function normalizeParamsForSignature(toolName, action, params) {
  const normalized = { ...(params || {}) };

  // Normalize common path-like params across tools so equivalent paths match.
  if (typeof normalized.path === 'string' || normalized.path !== undefined) {
    normalized.path = normalizePathForSignature(normalized.path);
  }

  // Normalize tool defaults so "omitted" == "default value" for dedupe.
  if (toolName === 'FileSystemTool' && action === 'list_files') {
    if (normalized.recursive === undefined) normalized.recursive = true;
    if (normalized.no_ignore === undefined) normalized.no_ignore = false;
  }

  if (toolName === 'FileSystemTool' && action === 'search_files') {
    if (normalized.no_ignore === undefined) normalized.no_ignore = false;
    // file_pattern is currently not implemented; treat undefined and null equivalently
    if (normalized.file_pattern === undefined) normalized.file_pattern = null;
  }

  return normalized;
}

function buildCanonicalSignature(toolName, action, params, projectId) {
  const deepSort = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(deepSort);

    const sorted = {};
    Object.keys(obj).sort().forEach((key) => {
      sorted[key] = deepSort(obj[key]);
    });
    return sorted;
  };

  const normalizeRecursive = (obj) => {
    if (typeof obj === 'string') return obj.trim();
    if (Array.isArray(obj)) return obj.map(normalizeRecursive);
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const key in obj) {
        result[key] = normalizeRecursive(obj[key]);
      }
      return result;
    }
    return obj;
  };

  const normalizedParams = normalizeRecursive(deepSort(normalizeParamsForSignature(toolName, action, params || {})));

  return JSON.stringify({
    tool: toolName,
    action,
    params: normalizedParams,
    projectId: projectId || null,
  });
}

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

  // Mark context so tools can avoid duplicate per-tool trace logging when ToolRunner is
  // already emitting centralized tool_call/tool_result events.
  const safeContext = { ...(context || {}), __trace_from_toolrunner: true };

  // Special case: DatabaseTool is sometimes passed as a class/adapter where methods are on prototype,
  // or as an instance. The registry might have it as `DatabaseTool: DatabaseToolAgentAdapter`.
  // However, function definitions use names like `DatabaseTool_get_feature_overview`.
  // The parser splits this into tool="DatabaseTool", action="get_feature_overview".
  
  let toolInstance = tools[tool];

  if (!toolInstance) {
     // Fallback 1: check if the tool name itself is a function in the registry (flat registry style)
     // e.g. if registry has "DatabaseTool_get_feature_overview": function(...)
     const fullName = `${tool}_${action}`;
     if (tools[fullName]) {
        toolInstance = { [action]: tools[fullName] };
     } else {
        // Fallback 2: Maybe the tool name in registry IS the base name (e.g. "DatabaseTool")
        // but it's an agent adapter that has the methods on itself or its prototype
        if (tools['DatabaseTool'] && tool === 'DatabaseTool') {
           toolInstance = tools['DatabaseTool'];
        } else {
           throw new Error(`Tool "${tool}" not found in tool registry`);
        }
     }
  }

  const fn = toolInstance && typeof toolInstance[action] === 'function'
    ? toolInstance[action].bind(toolInstance)
    : null;

  if (!fn) {
    // Debug info for DatabaseTool issues
    if (tool === 'DatabaseTool') {
       const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(toolInstance));
       throw new Error(`Tool "${tool}" action "${action}" is not callable. Available methods: ${availableMethods.join(', ')}`);
    }
    throw new Error(`Tool "${tool}" action "${action}" is not callable`);
  }

  const toolArgs = { ...params, context: safeContext };

  try {
    return await fn(toolArgs);
  } catch (error) {
    throw new Error(`Tool "${tool}_${action}" execution failed: ${error.message}`);
  }
}

// In-memory maps for basic deduplication and rate limiting. These are process-
// local and reset on server restart, which is sufficient for MVP.
const recentToolCalls = new Map(); // key -> number[] of timestamps (ms)
const cachedToolResults = new Map(); // key -> { timestamp, resultSummary }

// Per-request duplicate tracking (enhanced soft stop)
const perRequestDuplicateTracker = new Map(); // requestId -> { signatures, blockedSignatures }

function safePreview(value, maxLen = 1200) {
  try {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string') return value.length > maxLen ? value.slice(0, maxLen) + '…' : value;
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return String(value);
    return json.length > maxLen ? json.slice(0, maxLen) + '…' : json;
  } catch (e) {
    return '[unserializable]';
  }
}

async function logToolTraceEvent({ projectId, requestId, type, toolName, summary, details, error }) {
  try {
    await TraceService.logEvent({
      projectId,
      type,
      source: 'tool',
      timestamp: new Date().toISOString(),
      toolName,
      requestId,
      summary,
      details: {
        ...(details || {}),
        // include requestId in details so it shows up in TraceDashboard JSON view
        requestId: requestId || null,
      },
      error: error || undefined,
    });
  } catch (e) {
    // best effort; never break tool execution
  }
}

function getRequestTracker(requestId) {
  if (!perRequestDuplicateTracker.has(requestId)) {
    perRequestDuplicateTracker.set(requestId, {
      signatures: new Map(), // signature -> { timestamp, resultSummary, fullResult }
      blockedSignatures: new Set(), // signatures temporarily blocked
      createdAt: Date.now(),
    });
  }
  return perRequestDuplicateTracker.get(requestId);
}

function cleanupOldTrackers() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [requestId, tracker] of perRequestDuplicateTracker.entries()) {
    if (tracker.createdAt < oneHourAgo) {
      perRequestDuplicateTracker.delete(requestId);
    }
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
function getSoftStopWindowMs() {
  const raw = process.env.TOOL_SOFTSTOP_WINDOW_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 60_000;
  return parsed;
}

async function executeToolCalls(tools, toolCalls, context) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const results = [];

  const maxAttempts = 3;

  // Legacy rate limiting/dedup window.
  const rateWindowMs = 10_000; // 10 seconds
  const rateLimitCount = 3; // max 3 real executions per window

  // Enhanced soft-stop window: block identical calls within a single requestId for this long.
  // NOTE: In streaming, a single user turn can easily take 20-60s; keep this large enough
  // to prevent Orion from spamming the same tool call within one turn.
  // Can be overridden via env var TOOL_SOFTSTOP_WINDOW_MS.
  const softStopWindowMs = getSoftStopWindowMs();

  const requestId = context?.requestId || 'default';
  const projectId = context?.projectId || null;

  const tracker = getRequestTracker(requestId);
  const { signatures, blockedSignatures } = tracker;

  function isDeterministicNonRetryable(err) {
    const msg = (err && err.message) ? String(err.message) : '';
    if (/not found/i.test(msg)) return true;
    if (/MISSING_PROJECT_CONTEXT/i.test(msg)) return true;
    return false;
  }

  for (const toolCall of toolCalls) {
    const now = Date.now();

    let toolNameLabel = 'unknown';
    let parsed = null;
    let canonicalSignature = null;

    try {
      parsed = parseFunctionCall(toolCall);
      const { tool, action, params = {} } = parsed;
      toolNameLabel = action ? `${tool}.${action}` : tool;
      canonicalSignature = buildCanonicalSignature(tool, action, params, projectId);
    } catch (e) {
      // leave toolNameLabel as unknown
    }

    // Emit a centralized TOOL_CALL trace event as early as possible.
    // Even blocked/early-return cases should have a TOOL_CALL + TOOL_RESULT in trace.
    await logToolTraceEvent({
      projectId,
      requestId,
      type: 'tool_call',
      toolName: toolNameLabel,
      summary: `Tool call: ${toolNameLabel}`,
      details: {
        toolCallId: toolCall.id || null,
        params: parsed ? (parsed.params || {}) : {},
        canonicalSignature,
        softStopWindowMs,
      },
    });

    // Enhanced soft stop: canonical signature per request
    if (parsed && canonicalSignature) {

      // If the signature is currently blocked, enforce within the softStopWindowMs.
      if (blockedSignatures.has(canonicalSignature)) {
        const cached = signatures.get(canonicalSignature);
        if (cached && (now - cached.timestamp) > softStopWindowMs) {
          // Cooldown elapsed: unblock and allow execution.
          blockedSignatures.delete(canonicalSignature);
        } else {
          // Still blocked: return DUPLICATE_BLOCKED.
          try {
            await TraceService.logEvent({
              projectId,
              type: 'duplicate_tool_call',
              source: 'system',
              timestamp: new Date().toISOString(),
              summary: `Duplicate tool call blocked (repeated): ${toolNameLabel}`,
              details: {
                toolName: toolNameLabel,
                signature: canonicalSignature,
                duplicate: true,
                requestId,
                blocked: true,
                reason: 'signature_previously_blocked',
                previous_timestamp: cached ? cached.timestamp : null,
                softStopWindowMs,
              },
              requestId,
            });
          } catch (err) {
            // best effort
          }

          const blocked = {
            toolCallId: toolCall.id || null,
            toolName: toolNameLabel,
            success: false,
            error: 'DUPLICATE_BLOCKED',
            details: {
              message: `Duplicate blocked (cooldown ${softStopWindowMs}ms). Use previous results or wait for cooldown.`,
              previous_timestamp: cached ? new Date(cached.timestamp).toISOString() : null,
              previous_summary: cached ? cached.resultSummary : null,
              signature: canonicalSignature,
              softStopWindowMs,
            },
            attempts: 0,
            timestamp: new Date().toISOString(),
          };

          await logToolTraceEvent({
            projectId,
            requestId,
            type: 'tool_result',
            toolName: toolNameLabel,
            summary: `Tool blocked: ${toolNameLabel}`,
            details: {
              success: false,
              error: blocked.error,
              toolCallId: blocked.toolCallId,
              attempts: blocked.attempts,
              blocked: true,
              reason: 'duplicate_blocked',
              details: blocked.details,
            },
            error: { message: blocked.error, code: 'DUPLICATE_BLOCKED' },
          });

          results.push(blocked);
          continue;
        }
      }

      // If we have a recent execution for this signature, block within window.
      if (signatures.has(canonicalSignature)) {
        const cached = signatures.get(canonicalSignature);
        if (cached && (now - cached.timestamp) <= softStopWindowMs) {
          blockedSignatures.add(canonicalSignature);

          try {
            await TraceService.logEvent({
              projectId,
              type: 'duplicate_tool_call',
              source: 'system',
              timestamp: new Date().toISOString(),
              summary: `Duplicate tool call blocked: ${toolNameLabel}`,
              details: {
                toolName: toolNameLabel,
                signature: canonicalSignature,
                duplicate: true,
                requestId,
                blocked: true,
                reason: 'signature_seen_recently_in_request',
                previous_timestamp: cached ? cached.timestamp : null,
                softStopWindowMs,
              },
              requestId,
            });
          } catch (err) {
            // best effort
          }

          const blocked = {
            toolCallId: toolCall.id || null,
            toolName: toolNameLabel,
            success: false,
            error: 'DUPLICATE_BLOCKED',
            details: {
              message: `Duplicate tool call blocked (cooldown ${softStopWindowMs}ms). Use previous results or wait for cooldown.`,
              previous_timestamp: cached ? new Date(cached.timestamp).toISOString() : null,
              previous_summary: cached ? cached.resultSummary || null : null,
              signature: canonicalSignature,
              softStopWindowMs,
            },
            attempts: 0,
            timestamp: new Date().toISOString(),
          };

          await logToolTraceEvent({
            projectId,
            requestId,
            type: 'tool_result',
            toolName: toolNameLabel,
            summary: `Tool blocked: ${toolNameLabel}`,
            details: {
              success: false,
              error: blocked.error,
              toolCallId: blocked.toolCallId,
              attempts: blocked.attempts,
              blocked: true,
              reason: 'duplicate_seen_recently',
              details: blocked.details,
            },
            error: { message: blocked.error, code: 'DUPLICATE_BLOCKED' },
          });

          results.push(blocked);
          continue;
        }

        // Cooldown elapsed: treat as fresh and allow execution.
        blockedSignatures.delete(canonicalSignature);
      }
    }

    // Legacy rate limiting: coarse key for spam prevention
    const params = parsed ? parsed.params || {} : {};
    const rateKey = `${toolNameLabel}|${JSON.stringify({ params, projectId })}`;

    const list = recentToolCalls.get(rateKey) || [];
    const freshList = list.filter((ts) => now - ts <= rateWindowMs);

    if (freshList.length >= rateLimitCount) {
      const limited = {
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
      };

      await logToolTraceEvent({
        projectId,
        requestId,
        type: 'tool_result',
        toolName: toolNameLabel,
        summary: `Tool blocked: ${toolNameLabel}`,
        details: {
          success: false,
          error: limited.error,
          toolCallId: limited.toolCallId,
          attempts: limited.attempts,
          blocked: true,
          reason: 'rate_limited',
          details: limited.details,
        },
        error: { message: limited.error, code: 'TOOL_CALL_TOO_FREQUENT' },
      });

      results.push(limited);
      continue;
    }

    // Legacy deduplication (warning/reuse) within rateWindowMs
    const cachedLegacy = cachedToolResults.get(rateKey);
    if (cachedLegacy && now - cachedLegacy.timestamp <= rateWindowMs) {
      const reused = {
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        success: true,
        result: {
          warning: 'DUPLICATE_TOOL_CALL',
          message: 'You already called this tool with these parameters. Reusing previous result.',
          previous_timestamp: new Date(cachedLegacy.timestamp).toISOString(),
          previous_summary: cachedLegacy.resultSummary || null,
        },
        attempts: 0,
        timestamp: new Date().toISOString(),
      };

      await logToolTraceEvent({
        projectId,
        requestId,
        type: 'tool_result',
        toolName: toolNameLabel,
        summary: `Tool result (reused): ${toolNameLabel}`,
        details: {
          success: true,
          reused: true,
          toolCallId: reused.toolCallId,
          attempts: reused.attempts,
          result_preview: safePreview(reused.result),
        },
      });

      results.push(reused);
      continue;
    }

    // Record this attempt for rate tracking before actual execution.
    freshList.push(now);
    recentToolCalls.set(rateKey, freshList);

    let attempts = 0;
    let success = false;
    let finalResult;
    let finalError;

    const execStart = Date.now();

    while (attempts < maxAttempts && !success) {
      attempts += 1;
      try {
        finalResult = await executeToolCall(tools, toolCall, context);
        success = true;
      } catch (error) {
        finalError = error;
        if (isDeterministicNonRetryable(error)) break;
        if (attempts >= maxAttempts) break;
      }
    }

    const execDurationMs = Math.max(0, Date.now() - execStart);

    if (success) {
      cachedToolResults.set(rateKey, { timestamp: now, resultSummary: finalResult });

      await logToolTraceEvent({
        projectId,
        requestId,
        type: 'tool_result',
        toolName: toolNameLabel,
        summary: `Tool result: ${toolNameLabel}`,
        details: {
          success: true,
          toolCallId: toolCall.id || null,
          attempts,
          duration_ms: execDurationMs,
          result_preview: safePreview(finalResult),
          softStopWindowMs,
        },
      });

      if (canonicalSignature) {
        signatures.set(canonicalSignature, {
          timestamp: now,
          resultSummary: finalResult,
          fullResult: finalResult,
        });
      }

      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        result: finalResult,
        success: true,
        attempts,
        timestamp: new Date().toISOString(),
      });
    } else {
      const errMsg = finalError ? finalError.message : 'Unknown tool execution error';

      await logToolTraceEvent({
        projectId,
        requestId,
        type: 'tool_result',
        toolName: toolNameLabel,
        summary: `Tool failed: ${toolNameLabel}`,
        details: {
          success: false,
          toolCallId: toolCall.id || null,
          attempts,
          duration_ms: execDurationMs,
          error: errMsg,
          softStopWindowMs,
        },
        error: { message: errMsg, code: 'TOOL_EXECUTION_FAILED' },
      });

      results.push({
        toolCallId: toolCall.id || null,
        toolName: toolNameLabel,
        error: errMsg,
        success: false,
        attempts,
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (Math.random() < 0.01) {
    cleanupOldTrackers();
  }

  return results;
}

module.exports = {
  executeToolCall,
  executeToolCalls,
  buildCanonicalSignature,
  getRequestTracker,
  getSoftStopWindowMs,
  perRequestDuplicateTracker,
};
