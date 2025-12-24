const ToolRunner = require('../../tools/ToolRunner');
const { buildCanonicalSignature } = require('../../tools/ToolRunner');
const TraceService = require('./trace/TraceService');
const { TRACE_TYPES, TRACE_SOURCES } = require('./trace/TraceEvent');

/**
 * TwoStageOrchestrator - Implements triggered-phase (A/B cycling) protocol
 * 
 * Protocol:
 * - Action phase (B): Model streams reasoning, may emit tool calls
 * - Tool phase (A): Execute first complete tool call, inject result as system message
 * - Repeat until budget exhausted or final answer produced
 * 
 * Budgets:
 * - MAX_TOOLS_PER_TOOL_PHASE = 1 (only execute first tool call per phase)
 * - MAX_PHASE_CYCLES_PER_TURN = 3 (max tool executions per user turn)
 * - MAX_DUPLICATE_ATTEMPTS_PER_TURN = 3 (max duplicate attempts before forcing final answer)
 */
class TwoStageOrchestrator {
  constructor(adapter, tools) {
    this.adapter = adapter;
    this.tools = tools;
    
    // Budget constants from locked decisions
    this.MAX_TOOLS_PER_TOOL_PHASE = 1;
    this.MAX_PHASE_CYCLES_PER_TURN = 3;
    this.MAX_DUPLICATE_ATTEMPTS_PER_TURN = 3;
    
    // Debug flag for tool result visibility
    this.DEBUG_SHOW_TOOL_RESULTS = process.env.TWO_STAGE_DEBUG === 'true';
  }

  /**
   * Main orchestration method
   * @param {Object} options - { external_id, content, mode, requestId, projectId }
   * @param {Function} streamCallback - Called with each SSE event
   * @returns {Promise<{finalContent: string}>} Final content for persistence
   */
  async orchestrate(options, streamCallback) {
    const {
      external_id,
      content,
      mode = 'act',
      requestId,
      projectId
    } = options;

    // Request-scoped state
    const state = {
      phaseIndex: 0, // 0 = initial action phase
      cycleIndex: 0, // Number of tool executions completed
      blockedSignatures: new Set(), // Signatures of executed tools (to prevent duplicates)
      duplicateAttemptCount: 0, // Count of duplicate tool call attempts
      messages: [
        { role: 'system', content: this._buildSystemPrompt(mode) },
        { role: 'user', content }
      ],
      adapterCallCount: 0,
      doneEmitted: false,
      finalContent: '', // Track final content for persistence
      mode, // Store mode for use in helper methods
      projectId, // Store projectId for use in helper methods
      requestId // Store requestId for use in helper methods
    };

    // Helper to emit SSE events
    const emit = (event) => {
      // Add phase metadata
      const eventWithMetadata = {
        ...event,
        phase: state.phaseIndex % 2 === 0 ? 'action' : 'tool',
        phaseIndex: state.phaseIndex,
        cycleIndex: state.cycleIndex
      };
      streamCallback(eventWithMetadata);
      
      // Track final content from done event
      if (event.done && event.fullContent) {
        state.finalContent = event.fullContent;
      }
    };

    // Helper to inject system message
    const injectSystemMessage = (content) => {
      state.messages.push({ role: 'system', content });
    };

    // Main orchestration loop
    while (state.cycleIndex < this.MAX_PHASE_CYCLES_PER_TURN && !state.doneEmitted) {
      state.adapterCallCount++;
      
      // Action phase: stream from adapter
      const actionPhaseResult = await this._runActionPhase(state, emit, injectSystemMessage);
      
      if (actionPhaseResult.done) {
        // Final answer produced
        emit({ done: true, fullContent: actionPhaseResult.fullContent });
        state.doneEmitted = true;
        break;
      }

      // Always increment phaseIndex after action phase
      state.phaseIndex++;
      
      if (actionPhaseResult.toolCalls && actionPhaseResult.toolCalls.length > 0) {
        // Tool phase: execute first complete tool call
        const toolPhaseResult = await this._runToolPhase(
          actionPhaseResult.toolCalls, 
          state, 
          emit, 
          injectSystemMessage
        );

        if (toolPhaseResult.duplicateExceeded) {
          // Too many duplicate attempts, force final answer
          injectSystemMessage('Maximum duplicate tool call attempts exceeded. Provide final answer without further tool calls.');
          emit({ chunk: '\n\n**System Notice**: Maximum duplicate tool call attempts exceeded. Provide final answer.\n\n' });
          // Emit done event directly and exit
          emit({ done: true, fullContent: '' });
          state.doneEmitted = true;
          break;
        }

        if (toolPhaseResult.executed) {
          state.cycleIndex++;
        }

        // Increment phaseIndex for tool phase completion
        state.phaseIndex++;
      } else {
        // No tool calls in action phase, assume final answer
        if (actionPhaseResult.fullContent) {
          emit({ done: true, fullContent: actionPhaseResult.fullContent });
          state.doneEmitted = true;
        }
        break;
      }
    }

    // Budget exhausted - force final answer if not already done
    if (!state.doneEmitted && state.cycleIndex >= this.MAX_PHASE_CYCLES_PER_TURN) {
      injectSystemMessage(`Maximum tool execution cycles (${this.MAX_PHASE_CYCLES_PER_TURN}) reached. Provide final answer without further tool calls.`);
      emit({ chunk: `\n\n**System Notice**: Maximum tool execution cycles (${this.MAX_PHASE_CYCLES_PER_TURN}) reached. Provide final answer.\n\n` });
      
      // One final adapter call for final answer
      const finalResult = await this._callAdapter(state.messages, mode, projectId, requestId);
      for await (const event of finalResult) {
        if (event.done) {
          emit({ done: true, fullContent: event.fullContent || '' });
          state.doneEmitted = true;
          break;
        } else if (event.chunk) {
          emit({ chunk: event.chunk });
        }
      }
    }

    // Ensure exactly one done event
    if (!state.doneEmitted) {
      emit({ done: true, fullContent: '' });
    }
    
    // Return final content for persistence
    return { finalContent: state.finalContent };
  }

  /**
   * Run action phase (model streams reasoning)
   * Stops immediately when first complete tool call is detected
   */
  async _runActionPhase(state, emit, injectSystemMessage) {
    const result = {
      toolCalls: [],
      done: false,
      fullContent: ''
    };

    // Call adapter with current messages
    const adapterStream = this._callAdapter(state.messages, state.mode, state.projectId, state.requestId);
    
    // Track tool calls from stream
    const toolCallMap = new Map();
    let pendingDoneEvent = null;
    let hasCompleteToolCall = false;

    for await (const event of adapterStream) {
      if (event.toolCalls) {
        // Merge tool calls (handles partial streaming)
        this._mergeToolCallsIntoMap(toolCallMap, event.toolCalls);
        // Filter out the indexToId map (stored with key '__index_to_id__')
        result.toolCalls = Array.from(toolCallMap.entries())
          .filter(([key]) => key !== '__index_to_id__')
          .map(([, value]) => value);
        
        // Check if we have a complete tool call
        const completeToolCall = this._findFirstCompleteToolCall(result.toolCalls);
        if (completeToolCall) {
          hasCompleteToolCall = true;
          // Forward tool calls for UI visibility
          emit({ ...event, toolCalls: result.toolCalls });
          // Stop processing further events - action phase ends when complete tool call detected
          break;
        }
        
        // Forward tool calls for UI visibility
        emit({ ...event, toolCalls: result.toolCalls });
        continue;
      }

      if (event.done) {
        pendingDoneEvent = event;
        // Don't break here - we need to process any remaining chunks
        continue;
      }

      if (event.chunk) {
        emit(event);
        if (pendingDoneEvent && pendingDoneEvent.fullContent) {
          result.fullContent += event.chunk;
        }
      }
    }

    // If we have a complete tool call, action phase ends (don't process done event)
    if (hasCompleteToolCall) {
      return result;
    }

    // Process pending done event (no complete tool call found)
    if (pendingDoneEvent) {
      result.done = true;
      result.fullContent = pendingDoneEvent.fullContent || result.fullContent;
    }

    return result;
  }

  /**
   * Run tool phase (execute first complete tool call)
   */
  async _runToolPhase(toolCalls, state, emit, injectSystemMessage) {
    const result = {
      executed: false,
      duplicateExceeded: false
    };

    // Find first complete tool call
    const completeToolCall = this._findFirstCompleteToolCall(toolCalls);
    if (!completeToolCall) {
      // No complete tool call found
      injectSystemMessage('Tool call incomplete or malformed. Continue reasoning.');
      emit({ chunk: '\n\n**System Notice**: Tool call incomplete or malformed. Continue reasoning.\n\n' });
      return result;
    }

    // Check for duplicates
    const signature = this._computeToolSignature(completeToolCall, state.projectId);
    
    // Handle null signature (malformed tool call)
    if (signature === null) {
      injectSystemMessage('Tool call malformed (cannot compute signature). Continue reasoning.');
      emit({ chunk: '\n\n**System Notice**: Tool call malformed. Continue reasoning.\n\n' });
      return result;
    }
    
    if (state.blockedSignatures.has(signature)) {
      state.duplicateAttemptCount++;
      
      if (state.duplicateAttemptCount >= this.MAX_DUPLICATE_ATTEMPTS_PER_TURN) {
        result.duplicateExceeded = true;
        return result;
      }

      // Inject refusal message
      const refusalMessage = `Duplicate tool call detected (already executed in this turn). Do NOT call this tool again. Use previous results.`;
      injectSystemMessage(refusalMessage);
      emit({ chunk: `\n\n**System Notice**: ${refusalMessage}\n\n` });
      return result;
    }

    // Execute tool
    const toolResults = await ToolRunner.executeToolCalls(
      this.tools,
      [completeToolCall],
      { projectId: state.projectId, requestId: state.requestId }
    );

    // Block this signature to prevent future duplicates
    state.blockedSignatures.add(signature);

    // Process tool result
    if (toolResults.length > 0) {
      const toolResult = toolResults[0];
      
      // Format tool result for injection
      const toolLabel = toolResult.toolName || 'tool';
      const payload = toolResult.success
        ? { ok: true, result: toolResult.result }
        : {
            ok: false,
            error: toolResult.error || 'Unknown tool error',
            details: toolResult.details || null
          };

      const resultJson = JSON.stringify(payload, null, 2);
      const boxed = this._formatToolResultBox(toolLabel, resultJson);
      
      // Inject as system message
      injectSystemMessage(boxed);
      
      // Emit to stream only if debug mode is enabled
      if (this.DEBUG_SHOW_TOOL_RESULTS) {
        emit({ chunk: `\n\n${boxed}\n\n` });
      }
      
      result.executed = true;
    }

    return result;
  }

  /**
   * Call adapter with messages
   */
  async *_callAdapter(messages, mode, projectId, requestId) {
    const safeMessages = messages
      .filter(m => m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content }));

    const adapterStream = this.adapter.sendMessagesStreaming(safeMessages, {
      temperature: mode === 'plan' ? 0.7 : 0.3,
      max_tokens: 8192,
      tools: require('../../tools/functionDefinitions'),
      context: { projectId, requestId }
    });

    for await (const event of adapterStream) {
      yield event;
    }
  }

  /**
   * Merge tool calls from streaming deltas
   */
  _mergeToolCallsIntoMap(toolCallMap, toolCalls) {
    if (!toolCallMap || !Array.isArray(toolCalls)) return;

    const indexToIdKey = '__index_to_id__';
    const indexToId = toolCallMap.get(indexToIdKey) || new Map();

    for (const call of toolCalls) {
      if (!call || typeof call !== 'object') continue;

      // Establish index->id mapping
      if (typeof call.index === 'number' && typeof call.id === 'string' && call.id.trim() !== '') {
        indexToId.set(call.index, call.id);
      }

      // Resolve key
      let key = null;
      if (typeof call.id === 'string' && call.id.trim() !== '') {
        key = call.id;
      } else if (typeof call.index === 'number' && indexToId.has(call.index)) {
        key = indexToId.get(call.index);
      } else if (typeof call.index === 'number') {
        key = String(call.index);
      }

      if (!key) continue;

      const existing = toolCallMap.get(key);
      toolCallMap.set(key, this._mergeToolCall(existing, call));
    }

    toolCallMap.set(indexToIdKey, indexToId);
  }

  /**
   * Merge individual tool call
   */
  _mergeToolCall(existing, patch) {
    if (!existing) return patch;
    if (!patch || typeof patch !== 'object') return existing;

    const merged = { ...existing, ...patch };

    const existingFn = existing.function && typeof existing.function === 'object' ? existing.function : {};
    const patchFn = patch.function && typeof patch.function === 'object' ? patch.function : {};

    merged.function = {
      ...existingFn,
      ...patchFn,
      name: patchFn.name || existingFn.name,
      arguments: this._mergeArgumentStrings(existingFn.arguments, patchFn.arguments)
    };

    return merged;
  }

  /**
   * Merge argument strings from streaming
   */
  _mergeArgumentStrings(existing, incoming) {
    if (typeof incoming !== 'string' || incoming.length === 0) return existing;
    if (typeof existing !== 'string' || existing.length === 0) return incoming;

    if (incoming.startsWith(existing)) return incoming;
    if (existing.startsWith(incoming)) return existing;
    if (existing.endsWith(incoming)) return existing;

    return existing + incoming;
  }

  /**
   * Find first complete tool call
   */
  _findFirstCompleteToolCall(toolCalls) {
    for (const call of toolCalls) {
      if (!call || typeof call !== 'object') continue;
      
      const fn = call.function;
      if (!fn || typeof fn !== 'object') continue;
      
      const name = fn.name;
      const args = fn.arguments;
      
      if (typeof name === 'string' && name.trim() !== '' && 
          typeof args === 'string' && args.trim() !== '') {
        try {
          JSON.parse(args); // Validate JSON
          return call;
        } catch {
          // Invalid JSON, skip
        }
      }
    }
    return null;
  }

  /**
   * Compute canonical signature for duplicate detection
   */
  _computeToolSignature(toolCall, projectId) {
    const fn = toolCall.function;
    if (!fn) return null;

    try {
      const params = JSON.parse(fn.arguments || '{}');
      const toolName = fn.name.split('_')[0] || 'UnknownTool';
      const action = fn.name.split('_').slice(1).join('_') || 'unknown';
      const signature = buildCanonicalSignature(
        toolName,
        action,
        params,
        projectId
      );
      
      // Handle case where buildCanonicalSignature returns undefined (e.g., in tests with mocks)
      if (signature === undefined) {
        // Create a simple fallback signature for testing
        return JSON.stringify({
          tool: toolName,
          action,
          params,
          projectId: projectId || null,
        });
      }
      
      return signature;
    } catch (error) {
      return null;
    }
  }

  /**
   * Format tool result as boxed text
   */
  _formatToolResultBox(toolLabel, resultJson) {
    const header = '═══════════════════════════════════════════════════════════════════════════════';
    const titleLine = `TOOL RESULT: ${toolLabel}`;
    return [
      header,
      titleLine,
      header,
      resultJson,
      header,
    ].join('\n');
  }

  /**
   * Build system prompt for two-stage protocol
   */
  _buildSystemPrompt(mode) {
    const basePrompt = `You are an AI assistant operating in a two-stage (triggered-phase) protocol.

PROTOCOL RULES:
1. You operate in alternating phases:
   - ACTION PHASE (B): You reason and may emit tool calls
   - TOOL PHASE (A): Tool calls are executed, results injected as system messages

2. Only the FIRST complete tool call per action phase is executed.

3. Do NOT repeat tool calls already executed in this turn - use previous results.

4. Maximum ${this.MAX_PHASE_CYCLES_PER_TURN} tool executions per user turn.

5. When system messages indicate "Maximum duplicate tool call attempts exceeded" or "Maximum tool execution cycles reached", provide final answer without further tool calls.

6. Mode: ${mode === 'plan' ? 'PLAN (exploratory, higher temperature)' : 'ACT (execution, lower temperature)'}

Respond concisely and follow the protocol strictly.`;
    return basePrompt;
  }
}

module.exports = TwoStageOrchestrator;
