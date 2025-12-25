# ProtocolStrategy Interface Design - MVP Version

**Date:** 2025-12-24  
**Author:** Adam (Architect)  
**Context:** Task 3-0-1 (P1-F3-T0-S1) - Create ProtocolStrategy interface design document  
**Status:** MVP Specification (Locked for Implementation)  
**Approval Status:** Approved for MVP Implementation  
**Location:** `docs/02-ARCHITECTURE/designs/3-0/ProtocolStrategy_interface_MVP.md`

## Executive Summary

This MVP defines the minimal ProtocolStrategy interface required to ship the "Orion unified + two-stage" MVP without code duplication. The design enables OrionAgent to be protocol-agnostic, supporting both standard and two-stage protocols through a Strategy Pattern implementation.

## 1. MVP Design Decisions (Locked)

### 1.1 Design Philosophy: Streaming-First Simple Plug-in
- **Decision:** Streaming-first interface with `executeStreaming()` method
- **Rationale:** Must align with Orion's existing SSE streaming architecture
- **Non-Negotiable:** All protocols must support streaming; no synchronous fallbacks

### 1.2 Compatibility Scope
- **Decision:** Works **only** with OrionAgent
- **Rationale:** TwoStageOrchestrator will be deprecated/removed
- **Goal:** Eliminate code duplication between OrionAgent and TwoStageOrchestrator

### 1.3 MVP Non-Negotiable Principles
1. **Must support A/B cycling** - Core of two-stage protocol
2. **Must prevent tool call spam** - Primary goal of staged execution
3. **Must ensure consistent action on results** - LLM must act on tool results
4. **Must be testable in isolation** - For Tara's testing
5. **Must be backward compatible** - Existing routes keep working

### 1.4 MVP Dependency Injection Pattern
- **Injectable Dependencies (Required):**
  - `adapter` (LLMAdapter) - For `sendMessagesStreaming()` calls
  - `tools` (Object) - ToolRunner tools map (e.g., { FileSystemTool, DatabaseTool, ... })
  - `traceService` (TraceService) - For protocol phase trace events
- **Note:** ContextService/ToolService extraction deferred to post-MVP

### 1.5 Protocol Selection Mechanism (MVP Only)
- **MVP Implementation:** Route-based selection only
- **Routes:**
  - `/api/chat/messages` → StandardProtocol (existing behavior)
  - `/api/chat/messages_two_stage` → TwoStageProtocol (new)
- **Environment Variable:** `TWO_STAGE_ENABLED=true/false` (controls route availability)
- **Post-MVP:** Request metadata override, UI toggles

### 1.6 Execution Context Specification (MVP Contract)
- **Required Fields:**
  - `messages[]` (system + history + user + injected tool results)
  - `mode` ('plan' | 'act')
  - `projectId` (for tool dedupe signatures + trace)
  - `requestId` (trace + dedupe)
  - `adapter` (LLMAdapter instance)
  - `tools` (ToolRunner tools map)
  - `traceService` (TraceService instance)
  - `config` (budgets, debug flags)

### 1.7 Stop Policy (MVP Scoped)
- **MVP Implementation:**
  - Hard ceiling: Configurable MAX cycles via environment (e.g., `MAX_PHASE_CYCLES=3`)
  - Duplicate guard: Detect and block repeated tool calls
- **DuplicateExceeded Contract (Standardized):**
  1. Inject final system instruction (no tools).
  2. Perform exactly one final Action-phase model call.
  3. Emit `done` and terminate the protocol.
- **Post-MVP:** Progress/time/token-based enhancements

## 2. Interface Specification

### 2.1 ProtocolStrategy Interface (Streaming-First)

```javascript
/**
 * ProtocolStrategy Interface
 * Defines the contract for all protocol implementations
 * Streaming-first design for SSE/real-time integration
 */
class ProtocolStrategy {
  /**
   * Execute the protocol with streaming support
   * @param {ProtocolExecutionContext} executionContext - Precise execution context
   * @returns {AsyncGenerator<ProtocolEvent>} - Stream of protocol events
   */
  async *executeStreaming(executionContext) {
    throw new Error('executeStreaming() must be implemented by protocol');
  }

  /**
   * Get protocol name (for logging/debugging)
   * @returns {string} - Protocol identifier
   */
  getName() {
    throw new Error('getName() must be implemented by protocol');
  }

  /**
   * Validate protocol can handle the request
   * @param {ProtocolExecutionContext} executionContext - Execution context
   * @returns {boolean} - True if protocol can handle request
   */
  canHandle(executionContext) {
    throw new Error('canHandle() must be implemented by protocol');
  }
}

/**
 * ProtocolExecutionContext - Precise contract for protocol execution
 * Ensures interoperability between protocols
 */
class ProtocolExecutionContext {
  constructor({
    messages,
    mode,
    projectId,
    requestId,
    adapter,
    tools,
    traceService,
    config = {}
  }) {
    this.messages = messages;           // Array<{role: string, content: string}>
    this.mode = mode;                   // 'plan' | 'act'
    this.projectId = projectId;         // string
    this.requestId = requestId;         // string
    this.adapter = adapter;             // LLMAdapter instance
    this.tools = tools;                 // ToolRunner tools map
    this.traceService = traceService;   // TraceService instance
    this.config = {
      maxPhaseCycles: config.maxPhaseCycles || 3,
      maxDuplicateAttempts: config.maxDuplicateAttempts || 3,
      debugShowToolResults: config.debugShowToolResults || false,
      ...config
    };
  }
}

/**
 * ProtocolEvent - Standardized event types for streaming
 */
const ProtocolEventTypes = {
  CHUNK: 'chunk',           // Text content chunk: { type: 'chunk', content: string }
  TOOL_CALLS: 'tool_calls', // Tool calls from LLM: { type: 'tool_calls', calls: Array }
  DONE: 'done',             // Protocol complete: { type: 'done', fullContent: string }
  PHASE: 'phase',           // Phase metadata: { type: 'phase', phase: 'action'|'tool', index: number }
  ERROR: 'error'            // Error event: { type: 'error', error: Error }
};
```

### 2.2 TwoStageProtocol Implementation (Actual A/B Streaming)

```javascript
/**
 * TwoStageProtocol - Actual two-stage protocol implementation matching production
 * Implements A/B cycling, duplicate detection, and streaming tool call interleaving
 */
class TwoStageProtocol extends ProtocolStrategy {
  constructor({ adapter, tools, traceService }) {
    super();
    this.adapter = adapter;
    this.tools = tools;  // ToolRunner tools map
    this.traceService = traceService;
    
    // Budget constants (configurable via executionContext.config)
    this.DEFAULT_MAX_TOOLS_PER_TOOL_PHASE = 1;
    this.DEFAULT_MAX_PHASE_CYCLES_PER_TURN = 3;
    this.DEFAULT_MAX_DUPLICATE_ATTEMPTS_PER_TURN = 3;
  }

  getName() {
    return 'two-stage';
  }

  canHandle(executionContext) {
    // Two-stage protocol can handle all requests
    return true;
  }

  async *executeStreaming(executionContext) {
    const {
      messages,
      mode,
      projectId,
      requestId,
      config
    } = executionContext;

    // Extract budgets from config or use defaults
    const MAX_TOOLS_PER_TOOL_PHASE = config.maxToolsPerToolPhase || this.DEFAULT_MAX_TOOLS_PER_TOOL_PHASE;
    const MAX_PHASE_CYCLES_PER_TURN = config.maxPhaseCycles || this.DEFAULT_MAX_PHASE_CYCLES_PER_TURN;
    const MAX_DUPLICATE_ATTEMPTS_PER_TURN = config.maxDuplicateAttempts || this.DEFAULT_MAX_DUPLICATE_ATTEMPTS_PER_TURN;
    const DEBUG_SHOW_TOOL_RESULTS = config.debugShowToolResults || false;

    // Request-scoped state
    const state = {
      phaseIndex: 0, // 0 = initial action phase
      cycleIndex: 0, // Number of tool executions completed
      blockedSignatures: new Set(), // Signatures of executed tools
      duplicateAttemptCount: 0, // Count of duplicate tool call attempts
      currentMessages: [...messages],
      doneEmitted: false,
      finalContent: ''
    };

    // Main A/B cycling loop
    while (state.cycleIndex < MAX_PHASE_CYCLES_PER_TURN && !state.doneEmitted) {
      // Action Phase (B): Stream from adapter, stop at first complete tool call
      const actionPhaseResult = await this._runActionPhase(state, executionContext);
      
      if (actionPhaseResult.done) {
        // Final answer produced
        yield { type: 'done', fullContent: actionPhaseResult.fullContent };
        state.doneEmitted = true;
        break;
      }

      // Always increment phaseIndex after action phase
      state.phaseIndex++;
      
      if (actionPhaseResult.toolCalls && actionPhaseResult.toolCalls.length > 0) {
        // Tool Phase (A): Execute first complete tool call
        const toolPhaseResult = await this._runToolPhase(
          actionPhaseResult.toolCalls,
          state,
          executionContext
        );

        if (toolPhaseResult.duplicateExceeded) {
          // Too many duplicate attempts: force a final answer (no more tool calls)
          state.currentMessages.push({
            role: 'system',
            content: 'Maximum duplicate tool call attempts exceeded. Provide a final answer now using existing results ONLY. Do NOT call tools.'
          });

          yield { type: 'chunk', content: '\n\n**System Notice**: Maximum duplicate tool call attempts exceeded. Provide final answer.\n\n' };

          // Exactly one final adapter call to let the model synthesize a final answer
          const finalResult = await this._callAdapter(state.currentMessages, executionContext);
          for await (const event of finalResult) {
            if (event.type === 'done') {
              yield { type: 'done', fullContent: event.fullContent || '' };
              state.doneEmitted = true;
              break;
            } else if (event.type === 'chunk') {
              yield { type: 'chunk', content: event.content };
            }
          }

          // Ensure termination even if adapter stream ends unexpectedly
          if (!state.doneEmitted) {
            yield { type: 'done', fullContent: '' };
            state.doneEmitted = true;
          }

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
          yield { type: 'done', fullContent: actionPhaseResult.fullContent };
          state.doneEmitted = true;
        }
        break;
      }
    }

    // Budget exhausted - force final answer if not already done
    if (!state.doneEmitted && state.cycleIndex >= MAX_PHASE_CYCLES_PER_TURN) {
      state.currentMessages.push({
        role: 'system',
        content: `Maximum tool execution cycles (${MAX_PHASE_CYCLES_PER_TURN}) reached. Provide final answer without further tool calls.`
      });
      
      yield { type: 'chunk', content: `\n\n**System Notice**: Maximum tool execution cycles (${MAX_PHASE_CYCLES_PER_TURN}) reached. Provide final answer.\n\n` };
      
      // One final adapter call for final answer
      const finalResult = await this._callAdapter(state.currentMessages, executionContext);
      for await (const event of finalResult) {
        if (event.type === 'done') {
          yield { type: 'done', fullContent: event.fullContent || '' };
          state.doneEmitted = true;
          break;
        } else if (event.type === 'chunk') {
          yield { type: 'chunk', content: event.content };
        }
      }
    }

    // Ensure exactly one done event
    if (!state.doneEmitted) {
      yield { type: 'done', fullContent: '' };
    }
  }

  /**
   * Run tool phase (execute first complete tool call)
   */
  async _runToolPhase(toolCalls, state, executionContext) {
    const result = {
      executed: false,
      duplicateExceeded: false
    };

    // Find first complete tool call
    const completeToolCall = this._findFirstCompleteToolCall(toolCalls);
    if (!completeToolCall) {
      // No complete tool call found
      state.currentMessages.push({
        role: 'system',
        content: 'Tool call incomplete or malformed. Continue reasoning.'
      });
      yield { type: 'chunk', content: '\n\n**System Notice**: Tool call incomplete or malformed. Continue reasoning.\n\n' };
      return result;
    }

    // Check for duplicates (using ToolRunner signature logic)
    const signature = this._computeToolSignature(completeToolCall, executionContext.projectId);
    
    // Handle null signature (malformed tool call)
    if (signature === null) {
      state.currentMessages.push({
        role: 'system',
        content: 'Tool call malformed (cannot compute signature). Continue reasoning.'
      });
      yield { type: 'chunk', content: '\n\n**System Notice**: Tool call malformed. Continue reasoning.\n\n' };
      return result;
    }
    
    if (state.blockedSignatures.has(signature)) {
      state.duplicateAttemptCount++;
      
      if (state.duplicateAttemptCount >= executionContext.config.maxDuplicateAttempts) {
        result.duplicateExceeded = true;
        return result;
      }

      // Inject refusal message
      const refusalMessage = `Duplicate tool call detected (already executed in this turn). Do NOT call this tool again. Use previous results.`;
      state.currentMessages.push({ role: 'system', content: refusalMessage });
      yield { type: 'chunk', content: `\n\n**System Notice**: ${refusalMessage}\n\n` };
      return result;
    }

    // Execute tool via ToolRunner
    const ToolRunner = require('../../tools/ToolRunner');
    const toolResults = await ToolRunner.executeToolCalls(
      executionContext.tools,
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
      state.currentMessages.push({ role: 'system', content: boxed });
      
      // Emit to stream only if debug mode is enabled
      if (executionContext.config.debugShowToolResults) {
        yield { type: 'chunk', content: `\n\n${boxed}\n\n` };
      }
      
      result.executed = true;
    }

    return result;
  }

  /**
   * Call adapter with messages (wrapper for adapter.sendMessagesStreaming)
   */
  async *_callAdapter(messages, executionContext) {
    const safeMessages = messages
      .filter(m => m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content }));

    const adapterStream = this.adapter.sendMessagesStreaming(safeMessages, {
      temperature: executionContext.mode === 'plan' ? 0.7 : 0.3,
      max_tokens: 8192,
      tools: require('../../tools/functionDefinitions'),
      context: {
        projectId: executionContext.projectId,
        requestId: executionContext.requestId
      }
    });

    // Transform adapter events to ProtocolEvent format
    for await (const event of adapterStream) {
      if (event.toolCalls) {
        yield { type: 'tool_calls', calls: event.toolCalls };
      } else if (event.done) {
        yield { type: 'done', fullContent: event.fullContent || '' };
      } else if (event.chunk) {
        yield { type: 'chunk', content: event.chunk };
      }
    }
  }

  // Helper methods for tool call merging, duplicate detection, etc.
  // (Implementation matches TwoStageOrchestrator.js logic)
  _mergeToolCallsIntoMap(toolCallMap, toolCalls) { /* ... */ }
  _findFirstCompleteToolCall(toolCalls) { /* ... */ }
  _computeToolSignature(toolCall, projectId) { /* ... */ }
  _formatToolResultBox(toolLabel, resultJson) { /* ... */ }
}
```

### 2.3 StandardProtocol Implementation (Wrapper for OrionAgent Logic)

```javascript
/**
 * StandardProtocol - Wrapper for existing OrionAgent.processStreaming() logic
 * Maintains backward compatibility with current standard protocol behavior
 */
class StandardProtocol extends ProtocolStrategy {
  constructor({ adapter, tools, traceService }) {
    super();
    this.adapter = adapter;
    this.tools = tools;  // ToolRunner tools map
    this.traceService = traceService;
  }

  getName() {
    return 'standard';
  }

  canHandle(executionContext) {
    // Standard protocol can handle all requests
    return true;
  }

  async *executeStreaming(executionContext) {
    // Wraps existing OrionAgent.processStreaming() logic
    // Maintains current tool execution, PLAN mode restrictions, and duplicate blocking
  }
}
```

## 3. Integration with OrionAgent

### 3.1 OrionAgent Protocol Integration (MVP)

**MVP rule:** protocol selection is decided by the route (`/messages` vs `/messages_two_stage`). OrionAgent must support both in-process; `TWO_STAGE_ENABLED` only gates route availability.

```javascript
class OrionAgent {
  constructor(config = {}) {
    // Dependencies (use existing services, no extraction yet)
    this.adapter = createAdapter(config.adapterType);
    this.tools = config.tools; // ToolRunner tools map
    this.traceService = new TraceService(config);
    
    // Note: Context building logic remains in OrionAgent during MVP
    // Service extraction deferred to post-MVP

    // Protocol selection: provided by the caller (route). OrionAgent must be able to run
    // either protocol regardless of global env flags.
    // Env flag TWO_STAGE_ENABLED only gates whether the /messages_two_stage route exists.
    const protocolName = config.protocol || 'standard';

    this.protocol = (protocolName === 'two-stage')
      ? new TwoStageProtocol({
          adapter: this.adapter,
          tools: this.tools,
          traceService: this.traceService
        })
      : new StandardProtocol({
          adapter: this.adapter,
          tools: this.tools,
          traceService: this.traceService
        });
  }

  async *handleRequestStreaming(executionContext) {
    // Validate protocol can handle request
    if (!this.protocol.canHandle(executionContext)) {
      throw new Error(`Protocol ${this.protocol.getName()} cannot handle request`);
    }

    // Build messages array (context building remains in OrionAgent for MVP)
    const messages = await this._buildMessages(executionContext);
    
    // Create enriched execution context
    const enrichedContext = new ProtocolExecutionContext({
      ...executionContext,
      messages,
      adapter: this.adapter,
      tools: this.tools,
      traceService: this.traceService
    });

    // Execute protocol with streaming
    yield* this.protocol.executeStreaming(enrichedContext);
  }

  // Helper method to build messages (to be extracted to ContextService post-MVP)
  async _buildMessages(executionContext) {
    // Existing OrionAgent context building logic
    // Returns messages array for protocol execution
  }
}
```

### 3.2 Route Handler Strategy (MVP)

- **Existing Route:** `/api/chat/messages` → StandardProtocol (unchanged behavior)
- **New Route:** `/api/chat/messages_two_stage` → TwoStageProtocol (if `TWO_STAGE_ENABLED=true`)
- **Transport:** SSE streaming (existing StreamingService)
- **Backward Compatibility:** Standard route remains unchanged

### 3.3 Environment Configuration (MVP)

```bash
# .env configuration (MVP required)
TWO_STAGE_ENABLED=true  # or false to disable two-stage route
MAX_PHASE_CYCLES=3      # Configurable budget ceiling
MAX_DUPLICATE_ATTEMPTS=3 # Duplicate guard limit
```

## 4. MVP Implementation Tasks

### Task 3.1: Protocol Strategy Implementation (MVP Only)
1. **Create ProtocolStrategy interface** - Abstract base class
2. **Implement TwoStageProtocol** - Full two-stage protocol matching TwoStageOrchestrator
3. **Implement StandardProtocol** - Wrapper for existing OrionAgent logic
4. **Update OrionAgent** - Integrate protocol strategy
5. **Add route gating** - `/api/chat/messages_two_stage` route with `TWO_STAGE_ENABLED` flag
6. **Ensure three critical gaps are closed:** Route-based protocol selection (not env-based), DuplicateExceeded termination contract (one final model call), ToolRunner contract (protocols execute via ToolRunner.executeToolCalls)

### Task 3.2: Configuration & Security (MVP Minimal)
1. **Add environment variables** for budgets and flags
2. **Align with trace logging** - Ensure redactDetails() if trace logging is on

## 5. MVP Definition of Done

### MVP Acceptance Criteria
1. ✅ **Standard route unchanged** - `/api/chat/messages` works exactly as before
2. ✅ **Two-stage route works** - `/api/chat/messages_two_stage` implements A/B cycling
3. ✅ **No infinite loops** - Budget ceilings and duplicate detection prevent endless execution
4. ✅ **Tests pass** - Tara's existing test suite passes (no regressions)
5. ✅ **No code duplication** - TwoStageOrchestrator logic merged into ProtocolStrategy pattern

### MVP Testing Strategy
- **Unit Tests:** ProtocolStrategy interface validation
- **Integration Tests:** Both protocol implementations with OrionAgent
- **Backward Compatibility:** Standard route behavior unchanged
- **Two-Stage Specific:** A/B cycling, duplicate detection, budget enforcement

## 6. MVP Rollout & Rollback

### MVP Rollout Strategy
1. **Phase 1:** Implement ProtocolStrategy with both protocols
2. **Phase 2:** Add `/api/chat/messages_two_stage` route (disabled by default)
3. **Phase 3:** Enable two-stage route in staging with `TWO_STAGE_ENABLED=true`
4. **Phase 4:** Monitor, test, and iterate

### MVP Rollback Strategy
- **Immediate:** Set `TWO_STAGE_ENABLED=false` to disable two-stage route
- **Complete:** Remove new route, revert to standard-only OrionAgent
- **Zero Risk:** Standard route remains functional throughout

## 7. Risk Mitigation (MVP)

### 7.1 Technical Risks
- **Risk:** Protocol switching introduces bugs
  - **Mitigation:** Comprehensive testing, gradual rollout, immediate rollback
- **Risk:** Performance degradation in two-stage protocol
  - **Mitigation:** Budget ceilings prevent infinite loops, monitoring in staging

### 7.2 Operational Risks
- **Risk:** Configuration errors in production
  - **Mitigation:** Default to `TWO_STAGE_ENABLED=false`, validation on startup

---

**Next Step:** MVP design locked. Implementation can begin with Task 3.1.

**Future Work:** See `ProtocolStrategy_interface_Future.md` for post-MVP enhancements.
