# Tara Test Prompt: ProtocolStrategy Interface Tests (P1-F3-T1-S1)

## System / Role Prompt (for GPT-4.1 mini)

**You are Tara**, the TDD test author for the CM-Team project. Your job is to write or update **tests only** so that Devon (implementation agent) can later make them pass.

**Role Boundaries:**
- ✅ **You do:** Create or modify test files only, following TDD principles
- ❌ **You do NOT:** Write implementation code or modify production files
- **STRICT RULE:** Your output must leave the system **RED** until Devon implements the corresponding subtask

**Work Context:**
- **Backend:** Node.js/Express, Jest tests in `backend/src/_test_/`
- **Frontend:** Vue 3, Vitest tests in `frontend/src/__tests__/`
- **Testing Philosophy:** Make tests explicit so Devon knows exactly what to implement

---

## User Content

### 1. Architecture Reminder

**ProtocolStrategy Pattern (MVP):**
- New protocol strategy pattern to eliminate code duplication between OrionAgent and TwoStageOrchestrator
- **ProtocolStrategy** is abstract base class with `executeStreaming()` method
- **TwoStageProtocol** implements A/B cycling with duplicate detection and budget ceilings
- **StandardProtocol** wraps existing OrionAgent logic for backward compatibility
- **OrionAgent** delegates to protocols via dependency injection
- **Route-based selection:** `/api/chat/messages` → StandardProtocol, `/api/chat/messages_two_stage` → TwoStageProtocol

**Key Design Decisions (Locked in MVP):**
- Streaming-first interface (`executeStreaming()` returns AsyncGenerator)
- Protocol selection via route, not environment variables inside OrionAgent
- DuplicateExceeded termination: exactly one final Action-phase model call then done
- ToolRunner contract: protocols execute via `ToolRunner.executeToolCalls(tools, toolCalls, context)`

### 2. Subtask Entry (P1-F3-T1-S1)

**From `backend/template/F3-two_stage_protocol_service_foundation.json`:**

```json
{
  "task_id": "3-1",
  "external_id": "P1-F3-T1-S1",
  "title": "F3.1.1: Implement ProtocolStrategy.js from approved design",
  "status": "pending",
  "workflow_stage": "devon_implementing",
  "basic_info": {
    "goal": "Implement ProtocolStrategy interface class based on approved design document",
    "area": "Protocol Implementation",
    "notes": [
      "Must follow exact design specification",
      "Should be in backend/src/agents/protocols/ directory",
      "Must export as ES module"
    ]
  },
  "instruction": {
    "overview": "Create ProtocolStrategy.js file with execute() method interface and lifecycle hooks",
    "technical_details": {
      "requirements": [
        "Create class with execute(context) method",
        "Implement optional preExecute() and postExecute() hooks",
        "Add error handling with try/catch",
        "Export class as default export"
      ],
      "implementation_touchpoints": [
        "File: backend/src/agents/protocols/ProtocolStrategy.js",
        "Reference: docs/design/ProtocolStrategy_interface.md",
        "Integration: update import statements in dependent files"
      ]
    },
    "acceptance_criteria": [
      "ProtocolStrategy.js created with correct interface",
      "Class can be extended by StandardProtocol and TwoStageProtocol",
      "No TypeScript/ESLint errors"
    ]
  },
  "reason": "Core implementation of protocol strategy pattern"
}
```

**Note:** The above is the implementation subtask for Devon. As Tara, you need to create **tests** for this implementation.

### 3. Reference Design Document

**Key Interface Specification from `docs/02-ARCHITECTURE/designs/3-0/ProtocolStrategy_interface_MVP.md`:**

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

### 4. Current Test File (To Create)

**File to create:** `backend/src/_test_/protocol_strategy.spec.js`

**Current contents:** (File doesn't exist yet - you need to create it from scratch)

### 5. Instructions for Tara

**Create comprehensive tests for ProtocolStrategy interface:**

1. **Create new test file** `backend/src/_test_/protocol_strategy.spec.js`
2. **Test the ProtocolStrategy base class:**
   - Abstract class cannot be instantiated directly
   - `executeStreaming()` throws "must be implemented" error
   - `getName()` throws "must be implemented" error  
   - `canHandle()` throws "must be implemented" error
3. **Test ProtocolExecutionContext:**
   - Constructor validates required fields
   - Config defaults work correctly
   - Immutable properties cannot be modified
4. **Test ProtocolEventTypes constants:**
   - All event types defined and immutable
5. **Test concrete protocol implementations (mock implementations):**
   - Create mock protocol that extends ProtocolStrategy
   - Test that mock protocol can be instantiated
   - Test that mock protocol implements required methods
6. **Integration test patterns:**
   - How protocols integrate with OrionAgent (conceptual)
   - How protocols integrate with ToolRunner (conceptual)

**Test Requirements:**
- Follow existing Jest patterns from `backend/src/_test_/`
- Use proper mocking for dependencies (LLMAdapter, tools, traceService)
- Include both positive and negative test cases
- Ensure tests are runnable (will fail until Devon implements ProtocolStrategy)
- Export test utilities for reuse in StandardProtocol and TwoStageProtocol tests

**Output Format:**
- Provide the complete contents of `backend/src/_test_/protocol_strategy.spec.js`
- Do not modify any other files
- Keep tests focused on interface contract, not implementation details

---

## Example Test Structure (for reference)

```javascript
/**
 * @jest-environment node
 */

const { ProtocolStrategy, ProtocolExecutionContext, ProtocolEventTypes } = require('../agents/protocols/ProtocolStrategy');

describe('ProtocolStrategy Interface', () => {
  describe('Abstract base class', () => {
    test('cannot be instantiated directly', () => {
      expect(() => new ProtocolStrategy()).toThrow();
    });

    test('executeStreaming() throws "must be implemented"', async () => {
      class TestProtocol extends ProtocolStrategy {}
      const protocol = new TestProtocol();
      await expect(async () => {
        const generator = protocol.executeStreaming({});
        await generator.next();
      }).rejects.toThrow('executeStreaming() must be implemented by protocol');
    });
    // ... more tests
  });

  describe('ProtocolExecutionContext', () => {
    test('constructor sets all required properties', () => {
      const context = new ProtocolExecutionContext({
        messages: [],
        mode: 'act',
        projectId: 'test-project',
        requestId: 'req-123',
        adapter: {},
        tools: {},
        traceService: {}
      });
      expect(context.messages).toEqual([]);
      expect(context.mode).toBe('act');
      // ... more assertions
    });
    // ... more tests
  });
});
```

---

**Now, Tara, please create the complete test file `backend/src/_test_/protocol_strategy.spec.js` following these instructions.**
