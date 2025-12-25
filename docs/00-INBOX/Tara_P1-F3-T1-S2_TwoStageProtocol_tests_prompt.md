# Tara Test Prompt: TwoStageProtocol Implementation Tests (P1-F3-T1-S2)

## System / Role Prompt (for GPT-4.1 mini)

**You are Tara**, the TDD test author for the CM-Team project. Your job is to write or update **tests only** so that Devon (implementation agent) can later make them pass.

**Role Boundaries:**
- ✅ **You do:** Create or modify test files only, following TDD principles
- ❌ **You do NOT:** Write implementation code or modify production files
- **STRICT RULE:** Your output must leave the system **RED** until Devon implements the corresponding subtask

**Work Context:**
- **Backend:** Node.js/Express, Jest tests in `backend/src/_test_/`
- **Testing Philosophy:** Make tests explicit so Devon knows exactly what to implement
- **Current Status:** ProtocolStrategy base interface exists (P1-F3-T1-S1 complete). Now need TwoStageProtocol concrete implementation.

---

## User Content

### 1. Architecture Reference

**TwoStageProtocol Design (from MVP):**
- **Purpose:** Eliminate code duplication between OrionAgent and TwoStageOrchestrator
- **Inheritance:** Extends `ProtocolStrategy` base class
- **Protocol:** A/B cycling (Action Phase → Tool Phase → repeat)
- **Key Features:**
  1. Executes only first complete tool call per action phase
  2. Duplicate detection and prevention (MAX_DUPLICATE_ATTEMPTS)
  3. Budget enforcement (MAX_PHASE_CYCLES)
  4. Streaming-first: `executeStreaming()` returns AsyncGenerator<ProtocolEvent>

**Existing Implementation Reference:**
- **File:** `backend/src/services/TwoStageOrchestrator.js`
- **Status:** Working production code to be migrated to ProtocolStrategy pattern
- **Key Methods:** `orchestrate()`, `_runActionPhase()`, `_runToolPhase()`, `_callAdapter()`

**Integration Point:**
- TwoStageProtocol will be injected into OrionAgent when route `/api/chat/messages_two_stage` is called
- Environment variable: `TWO_STAGE_ENABLED=true` enables the route

### 2. Subtask Entry (P1-F3-T1-S2)

**From Feature 3 Roadmap:**
- **Task:** 3.1.2: Implement TwoStageProtocol class
- **Goal:** Migrate TwoStageOrchestrator logic into ProtocolStrategy pattern
- **Acceptance Criteria:**
  1. TwoStageProtocol extends ProtocolStrategy with `executeStreaming()`, `getName()`, `canHandle()`
  2. Implements A/B cycling with duplicate detection
  3. Respects config budgets (maxPhaseCycles, maxDuplicateAttempts)
  4. Emits ProtocolEventTypes (CHUNK, TOOL_CALLS, DONE, PHASE, ERROR)
  5. Integrates with existing ToolRunner for tool execution
  6. Passes all existing TwoStageOrchestrator tests (migrated)

### 3. Reference Implementation (TwoStageOrchestrator.js)

**Key Logic to Migrate:**

```javascript
// Current TwoStageOrchestrator.orchestrate() logic:
async orchestrate(options, streamCallback) {
  // Main A/B cycling loop
  while (state.cycleIndex < this.MAX_PHASE_CYCLES_PER_TURN && !state.doneEmitted) {
    // Action Phase
    const actionPhaseResult = await this._runActionPhase(state, emit, injectSystemMessage);
    
    if (actionPhaseResult.done) {
      emit({ done: true, fullContent: actionPhaseResult.fullContent });
      state.doneEmitted = true;
      break;
    }
    
    state.phaseIndex++;
    
    if (actionPhaseResult.toolCalls && actionPhaseResult.toolCalls.length > 0) {
      // Tool Phase
      const toolPhaseResult = await this._runToolPhase(
        actionPhaseResult.toolCalls, 
        state, 
        emit, 
        injectSystemMessage
      );
      
      // Handle duplicateExceeded
      if (toolPhaseResult.duplicateExceeded) {
        // Force final answer
        injectSystemMessage('Maximum duplicate tool call attempts exceeded...');
        emit({ chunk: '...' });
        emit({ done: true, fullContent: '' });
        state.doneEmitted = true;
        break;
      }
      
      if (toolPhaseResult.executed) {
        state.cycleIndex++;
      }
      
      state.phaseIndex++;
    } else {
      // No tool calls, final answer
      if (actionPhaseResult.fullContent) {
        emit({ done: true, fullContent: actionPhaseResult.fullContent });
        state.doneEmitted = true;
      }
      break;
    }
  }
  
  // Budget exhausted handling
  if (!state.doneEmitted && state.cycleIndex >= this.MAX_PHASE_CYCLES_PER_TURN) {
    // Force final answer
  }
}
```

**Helper Methods to Migrate:**
- `_runActionPhase()` - Streams from adapter, stops at first complete tool call
- `_runToolPhase()` - Executes first complete tool call via ToolRunner
- `_callAdapter()` - Wrapper for adapter.sendMessagesStreaming
- `_mergeToolCallsIntoMap()` - Handles streaming tool call deltas
- `_findFirstCompleteToolCall()` - Validates tool call completeness
- `_computeToolSignature()` - Duplicate detection
- `_formatToolResultBox()` - Formats tool results for injection

### 4. TwoStageProtocol Interface Specification

**Expected Class Structure:**

```javascript
class TwoStageProtocol extends ProtocolStrategy {
  constructor({ adapter, tools, traceService }) {
    super();
    this.adapter = adapter;
    this.tools = tools;  // ToolRunner tools map
    this.traceService = traceService;
  }

  getName() {
    return 'two-stage';
  }

  canHandle(executionContext) {
    return true; // Can handle all requests
  }

  async *executeStreaming(executionContext) {
    // Implementation migrated from TwoStageOrchestrator.orchestrate()
    // Must yield ProtocolEvent objects (not old SSE format)
    // Must use executionContext.config for budgets
    // Must emit exactly one DONE event
  }
}
```

**ProtocolEvent Format (from ProtocolEventTypes):**
- `{ type: 'chunk', content: string }`
- `{ type: 'tool_calls', calls: Array }`
- `{ type: 'done', fullContent: string }`
- `{ type: 'phase', phase: 'action'|'tool', index: number }`
- `{ type: 'error', error: Error }`

### 5. Current Test Files

**Existing Test File:** `backend/src/_test_/two_stage_protocol.spec.js`
- **Status:** Tests the old TwoStageOrchestrator prototype
- **Problem:** Tests route integration (`/api/chat/messages_two_stage`), not unit tests
- **Action:** Create new unit test file for TwoStageProtocol class

**New Test File:** `backend/src/_test_/two_stage_protocol_unit.spec.js`
- **Purpose:** Unit tests for TwoStageProtocol class in isolation
- **Location:** Same directory, different name to avoid conflicts

### 6. Instructions for Tara

**Create comprehensive unit tests for TwoStageProtocol:**

1. **Create new test file** `backend/src/_test_/two_stage_protocol_unit.spec.js`
2. **Test the TwoStageProtocol class:**
   - Constructor sets dependencies (adapter, tools, traceService)
   - `getName()` returns 'two-stage'
   - `canHandle()` always returns true
   - `executeStreaming()` returns AsyncGenerator
3. **Test A/B cycling behavior:**
   - Single tool call → executes tool → returns final answer
   - Multiple tool calls in one action phase → executes only first
   - No tool calls → returns final answer directly
   - Budget exhaustion (maxPhaseCycles) → forces final answer
4. **Test duplicate detection:**
   - Duplicate tool call → injects refusal message
   - MAX_DUPLICATE_ATTEMPTS exceeded → forces final answer (DuplicateExceeded contract)
   - DuplicateExceeded contract: exactly one final Action-phase model call then done
5. **Test ProtocolEvent emissions:**
   - CHUNK events for streaming text
   - TOOL_CALLS events with proper structure
   - DONE event with fullContent (exactly one)
   - PHASE events for phase metadata
   - ERROR events on failures
6. **Test ToolRunner integration:**
   - Tool execution via `ToolRunner.executeToolCalls()`
   - Tool results injected as system messages
   - Tool signatures computed for duplicate detection
7. **Test configuration:**
   - Respects `executionContext.config.maxPhaseCycles`
   - Respects `executionContext.config.maxDuplicateAttempts`
   - Respects `executionContext.config.debugShowToolResults`

**Test Requirements:**
- Use proper mocking for dependencies (adapter, tools, traceService, ToolRunner)
- Follow existing Jest patterns from `backend/src/_test_/`
- Include both positive and negative test cases
- Ensure tests are runnable (will fail until Devon implements TwoStageProtocol)
- Test edge cases: malformed tool calls, adapter errors, etc.

**Mocking Guidelines:**
- **Adapter:** Mock `sendMessagesStreaming()` to yield test events
- **Tools:** Mock tool map (e.g., { FileSystemTool: { list_files: jest.fn() } })
- **ToolRunner:** Mock `executeToolCalls()` to return test results
- **TraceService:** Mock `logEvent()` for observability

**Output Format:**
- Provide the complete contents of `backend/src/_test_/two_stage_protocol_unit.spec.js`
- Do not modify any other files
- Keep tests focused on TwoStageProtocol unit behavior, not route integration

---

## Example Test Structure (for reference)

```javascript
/**
 * @jest-environment node
 */

const { TwoStageProtocol } = require('../agents/protocols/TwoStageProtocol');
const { ProtocolExecutionContext, ProtocolEventTypes } = require('../agents/protocols/ProtocolStrategy');

describe('TwoStageProtocol', () => {
  let mockAdapter;
  let mockTools;
  let mockTraceService;
  let protocol;

  beforeEach(() => {
    mockAdapter = {
      sendMessagesStreaming: jest.fn()
    };
    mockTools = {
      FileSystemTool: { list_files: jest.fn() },
      DatabaseTool: { get_subtask_full_context: jest.fn() }
    };
    mockTraceService = {
      logEvent: jest.fn()
    };

    protocol = new TwoStageProtocol({
      adapter: mockAdapter,
      tools: mockTools,
      traceService: mockTraceService
    });
  });

  describe('constructor and basic methods', () => {
    test('sets dependencies correctly', () => {
      expect(protocol.adapter).toBe(mockAdapter);
      expect(protocol.tools).toBe(mockTools);
      expect(protocol.traceService).toBe(mockTraceService);
    });

    test('getName() returns "two-stage"', () => {
      expect(protocol.getName()).toBe('two-stage');
    });

    test('canHandle() always returns true', () => {
      const context = new ProtocolExecutionContext({/* ... */});
      expect(protocol.canHandle(context)).toBe(true);
    });
  });

  describe('executeStreaming() - single tool call', () => {
    test('executes tool and returns final answer', async () => {
      // Mock adapter to yield tool call then done
      mockAdapter.sendMessagesStreaming.mockImplementation(async function* () {
        yield { chunk: 'Let me list files...' };
        yield { 
          toolCalls: [{
            function: {
              name: 'FileSystemTool_list_files',
              arguments: JSON.stringify({ path: '.' })
            },
            id: 'call_1',
            type: 'function'
          }]
        };
        yield { done: true, fullContent: '' };
      });

      // Mock ToolRunner execution
      const mockToolRunner = require('../../../tools/ToolRunner');
      mockToolRunner.executeToolCalls.mockResolvedValue([{
        toolName: 'FileSystemTool_list_files',
        result: ['file1.txt', 'file2.txt'],
        success: true
      }]);

      const context = new ProtocolExecutionContext({
        messages: [{ role: 'user', content: 'List files' }],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'req-123',
        adapter: mockAdapter,
        tools: mockTools,
        traceService: mockTraceService,
        config: { maxPhaseCycles: 3, maxDuplicateAttempts: 3 }
      });

      const events = [];
      for await (const event of protocol.executeStreaming(context)) {
        events.push(event);
      }

      // Verify events
      expect(events).toContainEqual({ type: 'chunk', content: 'Let me list files...' });
      expect(events).toContainEqual({ 
        type: 'tool_calls', 
        calls: expect.arrayContaining([expect.objectContaining({
          function: expect.objectContaining({
            name: 'FileSystemTool_list_files'
          })
        })])
      });
      expect(events).toContainEqual({ type: 'done', fullContent: expect.any(String) });
      
      // Verify exactly one DONE event
      const doneEvents = events.filter(e => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
    });
  });

  // ... more tests for duplicate detection, budget exhaustion, etc.
});
```

---

**Now, Tara, please create the complete test file `backend/src/_test_/two_stage_protocol_unit.spec.js` following these instructions.**
