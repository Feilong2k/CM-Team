const { ProtocolStrategy, ProtocolExecutionContext, ProtocolEventTypes } = require('./ProtocolStrategy');
const ToolRunner = require('../../../tools/ToolRunner');
const functionDefinitions = require('../../../tools/functionDefinitions');

/**
 * TwoStageProtocol - Implements triggered-phase (A/B cycling) protocol
 * Extends ProtocolStrategy for integration with protocol-based architecture
 */
class TwoStageProtocol extends ProtocolStrategy {
  /**
   * Create a new TwoStageProtocol
   * @param {Object} params
   * @param {Object} params.adapter - LLMAdapter instance
   * @param {Object} params.tools - Tool registry
   * @param {Object} params.traceService - TraceService instance
   */
  constructor({ adapter, tools, traceService }) {
    super();
    this.adapter = adapter;
    this.tools = tools;
    this.traceService = traceService;
  }

  /**
   * Get protocol name
   * @returns {string} Protocol identifier
   */
  getName() {
    return 'two-stage';
  }

  /**
   * Check if protocol can handle the request
   * @param {ProtocolExecutionContext} executionContext - Execution context
   * @returns {boolean} Always true for TwoStageProtocol
   */
  canHandle(executionContext) {
    return true;
  }

  /**
   * Execute the protocol with streaming support
   * @param {ProtocolExecutionContext} executionContext - Precise execution context
   * @returns {AsyncGenerator<ProtocolEvent>} Stream of protocol events
   */
  async *executeStreaming(executionContext) {
    const { config } = executionContext;
    const maxPhaseCycles = config.maxPhaseCycles || 3;
    const maxDuplicateAttempts = config.maxDuplicateAttempts || 3;
    const debugShowToolResults = !!config.debugShowToolResults;

    // Internal state
    const state = {
      phaseIndex: 0,
      cycleIndex: 0,
      blockedSignatures: new Set(),
      duplicateAttemptCount: 0,
      currentMessages: [...executionContext.messages],
      doneEmitted: false,
      finalContent: ''
    };

    // Helper to emit phase events
    const emitPhase = function*(phase, index) {
      yield { type: ProtocolEventTypes.PHASE, phase, index };
    };

    // Helper to inject system message
    const injectSystemMessage = (content) => {
      state.currentMessages.push({ role: 'system', content });
    };

    // Main orchestration loop
    while (state.cycleIndex < maxPhaseCycles && !state.doneEmitted) {
      // Action Phase
      yield* emitPhase('action', state.phaseIndex);
      const actionPhaseResult = yield* this._runActionPhase(state, executionContext);
      
      if (actionPhaseResult.done) {
        // Final answer produced
        yield { type: ProtocolEventTypes.DONE, fullContent: actionPhaseResult.fullContent };
        state.doneEmitted = true;
        state.finalContent = actionPhaseResult.fullContent;
        break;
      }

      state.phaseIndex++;
      
      if (actionPhaseResult.toolCalls && actionPhaseResult.toolCalls.length > 0) {
        // Tool Phase
        yield* emitPhase('tool', state.phaseIndex);
        const toolPhaseResult = yield* this._runToolPhase(
          actionPhaseResult.toolCalls,
          state,
          executionContext,
          debugShowToolResults,
          injectSystemMessage
        );

        if (toolPhaseResult.duplicateExceeded) {
          // Too many duplicate attempts, force final answer
          injectSystemMessage('Maximum duplicate tool call attempts exceeded. Provide final answer without further tool calls.');
          yield { type: ProtocolEventTypes.CHUNK, content: '\n\n**System Notice**: Maximum duplicate tool call attempts exceeded. Provide final answer.\n\n' };
          
          // One final adapter call for final answer - delegate to the adapter stream
          for await (const event of this._callAdapter(state.currentMessages, executionContext)) {
            if (event.type === ProtocolEventTypes.DONE) {
              yield { type: ProtocolEventTypes.DONE, fullContent: event.fullContent || '' };
              state.doneEmitted = true;
              break;
            } else {
              yield event;
            }
          }
          break;
        }

        // Only increment cycle index when a tool was actually executed
        if (toolPhaseResult.executed) {
          state.cycleIndex++;
        }
        
        state.phaseIndex++;
      } else {
        // No tool calls in action phase, assume final answer
        if (actionPhaseResult.fullContent) {
          yield { type: ProtocolEventTypes.DONE, fullContent: actionPhaseResult.fullContent };
          state.doneEmitted = true;
          state.finalContent = actionPhaseResult.fullContent;
        }
        break;
      }
    }

    // Budget exhausted - force final answer if not already done
    if (!state.doneEmitted && state.cycleIndex >= maxPhaseCycles) {
      injectSystemMessage(`Maximum tool execution cycles (${maxPhaseCycles}) reached. Provide final answer without further tool calls.`);
      yield { type: ProtocolEventTypes.CHUNK, content: `\n\n**System Notice**: Maximum tool execution cycles (${maxPhaseCycles}) reached. Provide final answer.\n\n` };
      
      // One final adapter call for final answer
      for await (const event of this._callAdapter(state.currentMessages, executionContext)) {
        if (event.type === ProtocolEventTypes.DONE) {
          yield { type: ProtocolEventTypes.DONE, fullContent: event.fullContent || '' };
          state.doneEmitted = true;
          break;
        } else {
          yield event;
        }
      }
    }

    // Ensure exactly one done event
    if (!state.doneEmitted) {
      yield { type: ProtocolEventTypes.DONE, fullContent: state.finalContent || '' };
    }
  }

  /**
   * Run action phase (model streams reasoning)
   * @private
   */
  async *_runActionPhase(state, executionContext) {
    const result = {
      toolCalls: [],
      done: false,
      fullContent: ''
    };

    // Call adapter with current messages
    const adapterStream = this._callAdapter(state.currentMessages, executionContext);
    
    // Track tool calls from stream
    const toolCallMap = new Map();
    let pendingDoneEvent = null;
    let hasCompleteToolCall = false;

    for await (const event of adapterStream) {
      if (event.type === ProtocolEventTypes.TOOL_CALLS && event.calls) {
        // Merge tool calls (handles partial streaming)
        this._mergeToolCallsIntoMap(toolCallMap, event.calls);
        // Filter out the indexToId map (stored with key '__index_to_id__')
        result.toolCalls = Array.from(toolCallMap.entries())
          .filter(([key]) => key !== '__index_to_id__')
          .map(([, value]) => value);
        
        // Check if we have a complete tool call
        const completeToolCall = this._findFirstCompleteToolCall(result.toolCalls);
        if (completeToolCall) {
          hasCompleteToolCall = true;
          // Forward tool calls for UI visibility
          yield { type: ProtocolEventTypes.TOOL_CALLS, calls: result.toolCalls };
          // Stop processing further events - action phase ends when complete tool call detected
          break;
        }
        
        // Forward tool calls for UI visibility
        yield { type: ProtocolEventTypes.TOOL_CALLS, calls: result.toolCalls };
        continue;
      }

      if (event.type === ProtocolEventTypes.DONE) {
        pendingDoneEvent = event;
        // Don't break here - we need to process any remaining chunks
        continue;
      }

      if (event.type === ProtocolEventTypes.CHUNK && event.content) {
        yield { type: ProtocolEventTypes.CHUNK, content: event.content };
        if (pendingDoneEvent && pendingDoneEvent.fullContent) {
          result.fullContent += event.content;
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
   * @private
   */
  async *_runToolPhase(toolCalls, state, executionContext, debugShowToolResults, injectSystemMessage) {
    const result = {
      executed: false,
      duplicateExceeded: false
    };

    // Find first complete tool call
    const completeToolCall = this._findFirstCompleteToolCall(toolCalls);
    if (!completeToolCall) {
      // No complete tool call found
      injectSystemMessage('Tool call incomplete or malformed. Continue reasoning.');
      yield { type: ProtocolEventTypes.CHUNK, content: '\n\n**System Notice**: Tool call incomplete or malformed. Continue reasoning.\n\n' };
      return result;
    }

    // Check for duplicates
    const signature = this._computeToolSignature(completeToolCall, executionContext.projectId);
    
    // Handle null signature (malformed tool call)
    if (signature === null) {
      injectSystemMessage('Tool call malformed (cannot compute signature). Continue reasoning.');
      yield { type: ProtocolEventTypes.CHUNK, content: '\n\n**System Notice**: Tool call malformed. Continue reasoning.\n\n' };
      return result;
    }
    
    if (state.blockedSignatures.has(signature)) {
      state.duplicateAttemptCount++;
      
      const maxDuplicateAttempts = executionContext.config.maxDuplicateAttempts || 3;
      if (state.duplicateAttemptCount >= maxDuplicateAttempts) {
        result.duplicateExceeded = true;
        return result;
      }

      // Inject refusal message
      const refusalMessage = `Duplicate tool call detected (already executed in this turn). Do NOT call this tool again. Use previous results.`;
      injectSystemMessage(refusalMessage);
      yield { type: ProtocolEventTypes.CHUNK, content: `\n\n**System Notice**: ${refusalMessage}\n\n` };
      return result;
    }

    // Execute tool
    const toolResults = await ToolRunner.executeToolCalls(
      this.tools,
      [completeToolCall],
      { projectId: executionContext.projectId, requestId: executionContext.requestId }
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
      if (debugShowToolResults) {
        yield { type: ProtocolEventTypes.CHUNK, content: `\n\n${boxed}\n\n` };
      }
      
      result.executed = true;
    }

    return result;
  }

  /**
   * Call adapter with messages
   * @private
   */
  async *_callAdapter(messages, executionContext) {
    const { adapter, projectId, requestId, mode } = executionContext;

    const safeMessages = messages
      .filter(m => m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content }));

    const adapterStream = adapter.sendMessagesStreaming(safeMessages, {
      temperature: mode === 'plan' ? 0.7 : 0.3,
      max_tokens: 8192,
      tools: functionDefinitions,
      context: { projectId, requestId },
    });

    for await (const event of adapterStream) {
      // Convert adapter events to ProtocolEvent format
      if (event.chunk) {
        yield { type: ProtocolEventTypes.CHUNK, content: event.chunk };
      } else if (event.toolCalls) {
        yield { type: ProtocolEventTypes.TOOL_CALLS, calls: event.toolCalls };
      } else if (event.done) {
        yield { type: ProtocolEventTypes.DONE, fullContent: event.fullContent || '' };
      }
    }
  }

  /**
   * Merge tool calls from streaming deltas
   * @private
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
   * @private
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
   * @private
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
   * @private
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
   * @private
   */
  _computeToolSignature(toolCall, projectId) {
    const fn = toolCall.function;
    if (!fn) return null;

    try {
      const params = JSON.parse(fn.arguments || '{}');
      const toolName = fn.name.split('_')[0] || 'UnknownTool';
      const action = fn.name.split('_').slice(1).join('_') || 'unknown';
      const signature = ToolRunner.buildCanonicalSignature(
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
   * @private
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
}

module.exports = TwoStageProtocol;
