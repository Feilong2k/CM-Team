# ProtocolStrategy Interface Design (Split into MVP and Future)

**Date:** 2025-12-24  
**Author:** Adam (Architect)  
**Context:** Task 3-0-1 (P1-F3-T0-S1) - Create ProtocolStrategy interface design document  
**Status:** Superseded by split documents  
**Approval Status:** See MVP and Future documents  
**Location:** `docs/02-ARCHITECTURE/designs/3-0/ProtocolStrategy_interface.md`

## Overview

This original design document has been split into two focused documents:

### 1. MVP Version (Locked for Implementation)
**File:** `ProtocolStrategy_interface_MVP.md`  
**Purpose:** Defines the minimal ProtocolStrategy interface required to ship the "Orion unified + two-stage" MVP without code duplication.  
**Status:** Approved for implementation

### 2. Future Enhancements (Deferred)
**File:** `ProtocolStrategy_interface_Future.md`  
**Purpose:** Outlines post-MVP enhancements and architectural improvements for a modular, extensible protocol system.  
**Status:** Future design (deferred)

## Why the Split?

Based on user feedback, the original document contained both MVP-critical and future enhancement content. To ensure clear focus and avoid scope creep during MVP implementation:

1. **MVP Document:** Contains only what's required to ship the unified protocol system
2. **Future Document:** Contains architectural improvements deferred to post-MVP

## Key Changes from Original to MVP

### Removed/Deferred in MVP:
- Service Definitions section (ContextService/ToolService/TraceService interfaces)
- Route handler pseudocode (duplicates existing route logic)
- Implementation Tasks 3.2/3.3/3.4/3.5 (service extraction, security, observability)
- Success metrics with specific percentages
- 4-phase migration plan

### Kept in MVP:
- Streaming-first interface with `executeStreaming()`
- Minimal dependency injection (adapter, toolRegistry, traceService)
- Route-based protocol selection only
- Execution context contract
- Stop policy with hard ceilings and duplicate guard
- TwoStageProtocol based on real A/B streaming
- StandardProtocol as wrapper for existing logic

## Next Steps

1. **Implementation Team:** Use `ProtocolStrategy_interface_MVP.md` as the authoritative source for MVP development
2. **Testing Team:** Reference MVP document for acceptance criteria
3. **Product/Architecture:** Review `ProtocolStrategy_interface_Future.md` for roadmap planning

## Document Links

- [MVP Specification](./ProtocolStrategy_interface_MVP.md)
- [Future Enhancements](./ProtocolStrategy_interface_Future.md)

## Revision History

- **2025-12-24:** Document split into MVP and Future versions
- **2025-12-24:** Original comprehensive design created
- **2025-12-24:** Initial design based on RED analysis and technical review

---

*Note: For implementation details, refer to the MVP document. For architectural vision, refer to the Future document.*

## 1. Design Decisions (Revised)

Based on technical review and alignment with current Orion implementation:

### 1.1 Design Philosophy: Streaming-First Simple Plug-in
- **Decision:** Streaming-first interface with `executeStreaming()` method
- **Rationale:** Aligns with Orion's SSE streaming architecture, enables real-time tool call interleaving
- **Alignment:** Supports making two-stage protocol the default way for LLMs to call tools in streaming contexts
- **Benefits:**
  - Prevents tool call spam via A/B cycling
  - Ensures consistent action on tool results with real-time feedback
  - Integrates with existing StreamingService and SSE events
  - Becomes the default protocol in the future

### 1.2 Compatibility Scope
- **Decision:** Works **only** with OrionAgent
- **Rationale:** TwoStageOrchestrator will be deprecated/removed
- **Goal:** Make OrionAgent protocol-agnostic via Strategy Pattern

### 1.3 Non-Negotiable Principles
1. **Must support A/B cycling** - Core of two-stage protocol
2. **Must prevent tool call spam** - Primary goal of staged execution
3. **Must ensure consistent action on results** - LLM must act on tool results
4. **Must be testable in isolation** - For Tara's testing
5. **Must be backward compatible** - Existing routes keep working

### 1.4 Dependency Injection Pattern
- **Decision:** Constructor-based injection for core dependencies
- **Rationale:** Simpler, clearer dependency declaration, easier testing
- **Injectable Dependencies:**
  - `adapter` (LLMAdapter) - For `sendMessagesStreaming()` calls
  - `toolRegistry` (Object) - ToolRunner-compatible tool registry
  - `traceService` (TraceService) - For protocol phase trace events
  - **Note:** ContextService/ToolService extraction deferred to Phase 3 (optional)

### 1.5 Lifecycle Hooks
- **Decision:** No mandatory hooks initially
- **Rationale:** Hooks cannot improve LLM interactions (spam reduction/result handling are core protocol responsibilities)
- **Observability:** Use TraceService events instead (`phase_start`, `phase_end`, `tool_executed`, `error_occurred`)

### 1.6 Protocol Selection Mechanism
- **Decision:** Multi-level protocol selection precedence
- **Implementation Precedence:**
  1. **Route-based:** `/api/chat/messages` (StandardProtocol) vs `/api/chat/messages_two_stage` (TwoStageProtocol)
  2. **Request metadata override:** `metadata.protocol='two_stage'` (if enabled)
  3. **Environment default:** `TWO_STAGE_ENABLED=true/false` fallback
  4. **Fallback:** StandardProtocol
- **Rationale:** Enables safe rollout, per-route testing, and future UI toggles without global flag flipping

### 1.7 ProtocolStrategy Long-Term Value
- **Interface Permanence:** The ProtocolStrategy interface will remain valuable even with single protocol implementation because:
  1. **Clean Separation:** Isolates protocol logic from agent logic (Single Responsibility Principle)
  2. **Testability:** Enables Tara to test protocols in isolation by mocking dependencies
  3. **Streaming Architecture:** Encapsulates complex streaming/tool-call interleaving logic
  4. **Future Extensibility:** Accommodates future protocol variations without architectural changes
- **Evolution Path:** Compatible with future `backend/src/services/agents/` structure:
  - ProtocolService.js houses interface and implementations
  - AgentFactory.js handles dependency injection
  - Service extraction deferred to Phase 3 (after protocol stabilization)

### 1.8 Execution Context Specification
- **Decision:** Precise `ProtocolExecutionContext` contract
- **Rationale:** Ensures protocol interoperability and testability
- **Required Fields:**
  - `messages[]` (system + history + user + injected tool results)
  - `mode` ('plan' | 'act')
  - `projectId` (for tool dedupe signatures + trace)
  - `requestId` (trace + dedupe)
  - `adapter` (LLMAdapter instance)
  - `toolRegistry` (ToolRunner-compatible)
  - `traceService` (TraceService instance)
  - `config` (budgets, debug flags)

### 1.9 Stop Policy Design
- **Decision:** Multi-layer stop policy beyond fixed integer ceilings
- **Rationale:** Fixed `MAX_PHASE_CYCLES_PER_TURN=3` is insufficient for varied model behavior
- **Layers:**
  1. **Progress-based:** Stop if last N tool phases produce no new signatures/results
  2. **Time-based:** Max wall-clock time per turn (complements existing soft-stop)
  3. **Token-based:** Max tokens streamed per turn
  4. **Absolute ceiling:** Configurable MAX cycles (backstop, not primary control)
- **DuplicateExceeded Contract:** Standardized termination:
  1. Inject final system instruction: "Maximum duplicate attempts reached. Answer now with existing results."
  2. Exactly one final model call
  3. Emit `done` event

## 2. Architecture Overview

### 2.1 High-Level Design
```
┌─────────────────────────────────────────────────────────┐
│                     OrionAgent                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │          ProtocolStrategy Interface             │    │
│  │  ┌──────────────┐        ┌──────────────┐      │    │
│  │  │ TwoStage     │        │ Standard     │      │    │
│  │  │ Protocol     │        │ Protocol     │      │    │
│  │  └──────────────┘        └──────────────┘      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ Context  │  │  Tool    │  │  Trace   │  │  Adapter ││
│  │ Service  │  │ Service  │  │ Service  │  │ (LLM)    ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
└─────────────────────────────────────────────────────────┘
```

### 2.2 Key Components

1. **ProtocolStrategy Interface** - Abstract protocol definition
2. **TwoStageProtocol** - Two-stage protocol implementation
3. **StandardProtocol** - Current protocol implementation (for backward compatibility)
4. **Shared Services** - Injected dependencies
5. **OrionAgent** - Protocol-agnostic agent using Strategy Pattern

## 3. Interface Specification

### 3.1 ProtocolStrategy Interface (Streaming-First)

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
    toolRegistry,
    traceService,
    config = {}
  }) {
    this.messages = messages;           // Array<{role: string, content: string}>
    this.mode = mode;                   // 'plan' | 'act'
    this.projectId = projectId;         // string
    this.requestId = requestId;         // string
    this.adapter = adapter;             // LLMAdapter instance
    this.toolRegistry = toolRegistry;   // ToolRunner-compatible object
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

### 3.2 TwoStageProtocol Implementation (Actual A/B Streaming)

```javascript
/**
 * TwoStageProtocol - Actual two-stage protocol implementation matching production
 * Implements A/B cycling, duplicate detection, and streaming tool call interleaving
 */
class TwoStageProtocol extends ProtocolStrategy {
  constructor({ adapter, toolRegistry, traceService }) {
    super();
    this.adapter = adapter;
    this.toolRegistry = toolRegistry;
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
          // Too many duplicate attempts, force final answer
          state.currentMessages.push({
            role: 'system',
            content: 'Maximum duplicate tool call attempts exceeded. Provide final answer without further tool calls.'
          });
          
          yield { type: 'chunk', content: '\n\n**System Notice**: Maximum duplicate tool call attempts exceeded. Provide final answer.\n\n' };
          
          // Emit done event directly and exit
          yield { type: 'done', fullContent: '' };
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
   * Run action phase (model streams reasoning)
   * Stops immediately when first complete tool call is detected
   */
  async _runActionPhase(state, executionContext) {
    const result = {
      toolCalls: [],
      done: false,
      fullContent: ''
    };

    // Call adapter with current messages
    const adapterStream = this._callAdapter(state.currentMessages, executionContext);
    
    // Track tool calls from stream (merges partial streaming deltas)
    const toolCallMap = new Map();
    let pendingDoneEvent = null;
    let hasCompleteToolCall = false;

    for await (const event of adapterStream) {
      if (event.type === 'tool_calls') {
        // Merge tool calls (handles partial streaming)
        this._mergeToolCallsIntoMap(toolCallMap, event.calls);
        // Filter out the indexToId map
        result.toolCalls = Array.from(toolCallMap.entries())
          .filter(([key]) => key !== '__index_to_id__')
          .map(([, value]) => value);
        
        // Check if we have a complete tool call
        const completeToolCall = this._findFirstCompleteToolCall(result.toolCalls);
        if (completeToolCall) {
          hasCompleteToolCall = true;
          // Forward tool calls for UI visibility
          yield { type: 'tool_calls', calls: result.toolCalls };
          // Stop processing further events - action phase ends when complete tool call detected
          break;
        }
        
        // Forward tool calls for UI visibility
        yield { type: 'tool_calls', calls: result.toolCalls };
        continue;
      }

      if (event.type === 'done') {
        pendingDoneEvent = event;
        // Don't break here - we need to process any remaining chunks
        continue;
      }

      if (event.type === 'chunk') {
        yield { type: 'chunk', content: event.content };
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
    const toolResults = await this.toolRegistry.executeToolCalls(
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

### 3.3 StandardProtocol Implementation (Wrapper for OrionAgent Logic)

```javascript
/**
 * StandardProtocol - Wrapper for existing OrionAgent.processStreaming() logic
 * Maintains backward compatibility with current standard protocol behavior
 */
class StandardProtocol extends ProtocolStrategy {
  constructor({ adapter, toolRegistry, traceService }) {
    super();
    this.adapter = adapter;
    this.toolRegistry = toolRegistry;
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
    const {
      messages,
      mode,
      projectId,
      requestId
    } = executionContext;

    // Log tool registration snapshot for streaming session
    try {
      await this.traceService.record({
        projectId,
        type: 'tool_registration',
        source: 'system',
        timestamp: new Date().toISOString(),
        summary: 'Streaming tool registry for standard protocol',
        details: { tools: Object.keys(this.toolRegistry || {}) },
        requestId,
      });
    } catch (err) {
      console.error('Trace logging failed for tool registration (standard protocol):', err);
    }

    let iteration = 0;
    const maxIterations = 5;
    let continueLoop = true;
    let currentMessages = [...messages];

    // PLAN mode whitelist (matches OrionAgent implementation)
    const PLAN_MODE_WHITELIST = [
      'read_file', 'list_files', 'search_files', 'list_code_definition_names',
      'FileSystemTool_read_file', 'FileSystemTool_list_files', 'FileSystemTool_search_files',
      'DatabaseTool_get_subtask_full_context', 'DatabaseTool_list_subtasks_by_status', 'DatabaseTool_search_subtasks'
    ];

    while (continueLoop && iteration < maxIterations) {
      iteration++;

      const safeMessages = currentMessages
        .filter(m => m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content }));

      // Call adapter with current messages
      const adapterStream = this.adapter.sendMessagesStreaming(safeMessages, {
        temperature: mode === 'plan' ? 0.7 : 0.3,
        max_tokens: 8192,
        tools: require('../../tools/functionDefinitions'),
        context: { projectId, requestId },
      });

      // Track tool calls from stream (merges partial streaming deltas)
      const toolCallMap = new Map();
      let toolCallsFromStream = [];
      let pendingDoneEvent = null;

      for await (const event of adapterStream) {
        if (event.toolCalls) {
          this._mergeToolCallsIntoMap(toolCallMap, event.toolCalls);
          toolCallsFromStream = Array.from(toolCallMap.values());
          
          // Forward toolCalls for UI visibility
          yield { type: 'tool_calls', calls: toolCallsFromStream };
          continue;
        }

        if (event.done) {
          pendingDoneEvent = event;
          continue;
        }

        if (event.chunk) {
          yield { type: 'chunk', content: event.chunk };
        }
      }

      if (toolCallsFromStream.length > 0) {
        // Filter tool calls based on mode (PLAN mode restrictions)
        const allowedToolCalls = [];
        const blockedToolCalls = [];

        for (const call of toolCallsFromStream) {
          const toolName = this._safeToolName(call);
          if (!toolName) continue;

          if (mode === 'plan' && !PLAN_MODE_WHITELIST.some(allowed => toolName.startsWith(allowed) || toolName === allowed)) {
            blockedToolCalls.push(call);
          } else {
            allowedToolCalls.push(call);
          }
        }

        if (blockedToolCalls.length > 0) {
          const blockedMsg = `\n\n**System Notice:** The following tool calls were blocked because they are not allowed in PLAN mode: ${blockedToolCalls.map(c => this._safeToolName(c)).filter(Boolean).join(', ')}. Switch to ACT mode to execute write operations.`;
          
          yield { type: 'chunk', content: blockedMsg };
          
          currentMessages.push({
            role: 'system',
            content: `Refusal: The tool calls [${blockedToolCalls.map(c => this._safeToolName(c)).filter(Boolean).join(', ')}] were blocked by system policy because the user is in PLAN mode. You must ask the user to switch to ACT mode if these actions are required.`
          });
        }

        if (allowedToolCalls.length > 0) {
          // Execute allowed tool calls via ToolRunner
          const results = await this.toolRegistry.executeToolCalls(
            allowedToolCalls,
            { projectId, requestId }
          );

          for (const result of results) {
            const toolLabel = result.toolName || 'tool';
            
            // Handle duplicate blocked case
            if (!result.success && result.error === 'DUPLICATE_BLOCKED') {
              const stopRetryMsg = `\n\n**System Notice:** Tool call was blocked as DUPLICATE_BLOCKED. Do NOT call this tool again in this turn. Reuse the previous results included below.\n\n`;
              yield { type: 'chunk', content: stopRetryMsg };
              currentMessages.push({
                role: 'system',
                content: `Stop: ${toolLabel} was blocked as DUPLICATE_BLOCKED. You MUST NOT retry this tool call again in this turn. Use the previous results provided in the TOOL RESULT payload.`
              });
            }

            // Format tool result
            const payload = result.success
              ? { ok: true, result: result.result }
              : {
                  ok: false,
                  error: result.error || 'Unknown tool error',
                  details: result.details || null,
                  attempts: result.attempts || 0,
                  toolCallId: result.toolCallId || null,
                };

            const resultJson = JSON.stringify(payload, null, 2);
            const boxed = this._formatToolResultBox(toolLabel, resultJson);
            
            yield { type: 'chunk', content: `\n\n${boxed}\n\n` };
            currentMessages.push({ role: 'system', content: boxed });
          }
        }

        continueLoop = true;
      } else {
        continueLoop = false;
      }

      // Emit the saved done event only after tool handling
      if (!continueLoop && pendingDoneEvent) {
        yield { type: 'done', fullContent: pendingDoneEvent.fullContent || '' };
      }
    }

    // Ensure done event if loop exits without one
    if (continueLoop && iteration >= maxIterations) {
      yield { type: 'done', fullContent: '' };
    }
  }

  // Helper methods matching OrionAgent implementation
  _mergeToolCallsIntoMap(toolCallMap, toolCalls) { /* ... */ }
  _safeToolName(call) { /* ... */ }
  _formatToolResultBox(toolLabel, resultJson) { /* ... */ }
}
```

## 4. Integration with OrionAgent

### 4.1 OrionAgent Protocol Integration (Phase 1 - Minimal Change)

```javascript
class OrionAgent {
  constructor(config = {}) {
    // Dependencies (Phase 1: use existing services, no extraction yet)
    this.adapter = createAdapter(config.adapterType);
    this.toolRegistry = config.tools; // ToolRunner-compatible registry
    this.traceService = new TraceService(config);
    
    // Note: Context building logic remains in OrionAgent during Phase 1
    // Service extraction deferred to Phase 3

    // Protocol selection (multi-level precedence handled by route)
    // Default: use environment variable for fallback
    const useTwoStage = process.env.TWO_STAGE_ENABLED === 'true';
    
    // Create protocol strategy (Phase 1: minimal dependencies)
    this.protocol = useTwoStage 
      ? new TwoStageProtocol({
          adapter: this.adapter,
          toolRegistry: this.toolRegistry,
          traceService: this.traceService
        })
      : new StandardProtocol({
          adapter: this.adapter,
          toolRegistry: this.toolRegistry,
          traceService: this.traceService
        });
  }

  async *handleRequestStreaming(executionContext) {
    // Validate protocol can handle request
    if (!this.protocol.canHandle(executionContext)) {
      throw new Error(`Protocol ${this.protocol.getName()} cannot handle request`);
    }

    // Build messages array (context building remains in OrionAgent for now)
    const messages = await this._buildMessages(executionContext);
    
    // Create enriched execution context
    const enrichedContext = new ProtocolExecutionContext({
      ...executionContext,
      messages,
      adapter: this.adapter,
      toolRegistry: this.toolRegistry,
      traceService: this.traceService
    });

    // Execute protocol with streaming
    yield* this.protocol.executeStreaming(enrichedContext);
  }

  // Helper method to build messages (context building - to be extracted to ContextService in Phase 3)
  async _buildMessages(executionContext) {
    const { projectId, userMessage, mode } = executionContext;
    
    // 1. Load chat history (existing OrionAgent logic)
    const chatHistory = await this._loadChatHistory(projectId);
    
    // 2. Build system prompt with file list (existing OrionAgent logic)
    const systemPrompt = await this._buildSystemPrompt(projectId, mode);
    
    // 3. Format messages array
    return [
      { role: 'system', content: systemPrompt },
      ...this._formatChatHistory(chatHistory),
      { role: 'user', content: userMessage }
    ];
  }

  // Existing OrionAgent helper methods (to be extracted to services in Phase 3)
  async _loadChatHistory(projectId) { /* ... */ }
  async _buildSystemPrompt(projectId, mode) { /* ... */ }
  _formatChatHistory(chatHistory) { /* ... */ }

  // Getter for testing/monitoring
  getCurrentProtocol() {
    return this.protocol.getName();
  }
}
```

### 4.2 Route Handler Integration

```javascript
// Route handler for /api/chat/messages (StandardProtocol)
app.post('/api/chat/messages', async (req, res) => {
  const { projectId, content, mode = 'act', metadata = {} } = req.body;
  const requestId = uuid.v4();
  
  // Create OrionAgent instance (configured for standard protocol)
  const agent = new OrionAgent(config);
  
  // Build execution context
  const executionContext = {
    projectId,
    userMessage: content,
    mode,
    requestId,
    config: {
      // Protocol-specific configuration
    }
  };
  
  // Set up streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Stream protocol events
  try {
    const stream = agent.handleRequestStreaming(executionContext);
    for await (const event of stream) {
      // Transform ProtocolEvent to SSE format
      const sseEvent = this._protocolEventToSSE(event);
      res.write(sseEvent);
    }
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route handler for /api/chat/messages_two_stage (TwoStageProtocol)
app.post('/api/chat/messages_two_stage', async (req, res) => {
  // Same structure as above, but OrionAgent configured with TWO_STAGE_ENABLED=true
  // or route-specific configuration
});
```

### 4.2 Environment Configuration

```bash
# .env configuration
TWO_STAGE_ENABLED=true  # or false for standard protocol
ADAPTER_TYPE=gpt-4.1    # or deepseek, etc.
```

## 5. Service Definitions

### 5.1 ContextService Interface
```javascript
class ContextService {
  async buildContext(request, initialContext = {}) {
    // Build complete context from request, chat history, etc.
  }
  
  async loadChatHistory(conversationId) {
    // Load conversation history
  }
  
  async updateContext(context, newData) {
    // Update context with new information
  }
}
```

### 5.2 ToolService Interface
```javascript
class ToolService {
  async executeTools(toolCalls, context) {
    // Execute multiple tools with A/B cycling support
  }
  
  async validateToolCall(toolCall) {
    // Validate tool call before execution
  }
  
  async mergeToolResults(results) {
    // Merge and format tool results for LLM consumption
  }
}
```

### 5.3 TraceService Interface
```javascript
class TraceService {
  async record(eventType, data) {
    // Record trace events for observability
  }
  
  async getTrace(requestId) {
    // Retrieve trace for debugging
  }
}
```

## 6. Implementation Tasks

### Task 3.1: Protocol Strategy Implementation
1. **Create ProtocolStrategy interface** - Abstract base class
2. **Implement TwoStageProtocol** - Full two-stage protocol
3. **Implement StandardProtocol** - Backward compatibility
4. **Update OrionAgent** - Integrate protocol strategy
5. **Add environment configuration** - `TWO_STAGE_ENABLED` support

### Task 3.2: ContextService Extraction
1. **Extract context building logic** from OrionAgent and TwoStageOrchestrator
2. **Create ContextService** with shared methods
3. **Update all callers** to use ContextService

### Task 3.3: ToolService Extraction
1. **Extract tool execution logic** from OrionAgent and TwoStageOrchestrator
2. **Create ToolService** with A/B cycling support
3. **Update all callers** to use ToolService

### Task 3.4: Security & Configuration
1. **Add configuration validation**
2. **Implement security checks** for tool execution
3. **Add rate limiting** per protocol

### Task 3.5: Observability & Stabilization
1. **Enhance TraceService** with protocol-specific events
2. **Add metrics collection** per protocol
3. **Implement health checks** for all services

## 7. Testing Strategy

### 7.1 Unit Tests (Tara)
- **ProtocolStrategy interface** - Contract validation
- **TwoStageProtocol** - All phases, error handling
- **StandardProtocol** - Backward compatibility
- **OrionAgent integration** - Protocol switching

### 7.2 Integration Tests
- **End-to-end protocol execution**
- **Service integration** (ContextService, ToolService, TraceService)
- **Environment configuration** switching

### 7.3 Acceptance Criteria
1. ✅ OrionAgent works with both protocols via environment variable
2. ✅ TwoStageProtocol prevents tool call spam via A/B cycling
3. ✅ LLM consistently acts on tool results
4. ✅ All services are testable in isolation
5. ✅ Existing routes remain functional (backward compatible)
6. ✅ TraceService provides observability for both protocols

## 8. Migration Plan

### Phase 1: Implementation (Current)
- Implement ProtocolStrategy interface and protocols
- Extract shared services (ContextService, ToolService)
- Update OrionAgent to use protocol strategy
- Add `TWO_STAGE_ENABLED` environment variable

### Phase 2: Testing & Validation
- Tara tests all components
- Integration testing with existing routes
- Performance comparison between protocols

### Phase 3: Gradual Rollout
- Deploy with `TWO_STAGE_ENABLED=false` (standard protocol)
- Test with `TWO_STAGE_ENABLED=true` in staging
- Monitor performance and stability

### Phase 4: Deprecation
- Remove TwoStageOrchestrator (code and tests)
- Set `TWO_STAGE_ENABLED=true` as default
- Eventually remove environment variable flag

## 9. Risk Mitigation

### 9.1 Technical Risks
- **Risk:** Protocol switching introduces bugs
  - **Mitigation:** Comprehensive testing, gradual rollout
- **Risk:** Service extraction breaks existing functionality
  - **Mitigation:** Extract incrementally, maintain backward compatibility
- **Risk:** Performance degradation in two-stage protocol
  - **Mitigation:** Performance testing, optimization opportunities identified

### 9.2 Operational Risks
- **Risk:** Configuration errors in production
  - **Mitigation:** Configuration validation, default to standard protocol
- **Risk:** Insufficient observability for debugging
  - **Mitigation:** Enhanced TraceService with protocol-specific events

## 10. Success Metrics

1. **Code Duplication Elimination:** 100% reduction between OrionAgent and TwoStageOrchestrator
2. **Protocol Agnosticism:** OrionAgent supports multiple protocols via Strategy Pattern
3. **Test Coverage:** All protocols and services have >90% test coverage
4. **Performance:** Two-stage protocol maintains or improves response times
5. **Reliability:** No regressions in existing chat functionality
6. **Observability:** All protocol phases traceable via TraceService

## 11. Appendix

### 11.1 Related Documents
- `RED_Feature3_TwoStage_Protocol_Service_Foundation_Analysis_v3.md`
- `two_stage_protocol_strategy_architecture.md`
- `2025-12-24_ProtocolStrategy_Design_Questions.md`

### 11.2 Decision Log
- **2025-12-24:** Design approved - Simple Plug-in approach
- **2025-12-24:** Constructor-based injection selected over factory pattern
- **2025-12-24:** No lifecycle hooks - use TraceService events instead
- **2025-12-24:** Environment variable for protocol selection

### 11.3 Open Questions
- None - all design questions resolved through user feedback

---

## Review Checklist

- [ ] Architecture aligns with Feature 3 goals
- [ ] ProtocolStrategy interface is minimal and extensible
- [ ] TwoStageProtocol implements A/B cycling correctly
- [ ] StandardProtocol maintains backward compatibility
- [ ] All non-negotiable principles are addressed
- [ ] Dependency injection pattern is clear and testable
- [ ] Environment-based protocol selection works as specified
- [ ] Migration plan is feasible and low-risk
- [ ] Testing strategy covers all critical paths

**Next Step:** Design approved and locked. Implementation can begin.
