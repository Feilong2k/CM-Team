# Orion v2 Modular Architecture Plan

## 1. Overview

**Goal:** Build a stable, functional Orion that communicates normally and calls tools consistently, using only streaming and a single protocol route (TwoStageProtocol).

**Core Principles:**
- **Streaming-only:** Remove non-streaming paths to simplify.
- **Single Protocol:** Use TwoStageProtocol as the default (no StandardProtocol).
- **Modular Services:** Extract reusable components into services.
- **Thin OrionAgent:** OrionAgent becomes a thin orchestrator that delegates to services.

## 2. Modules Required for MVP

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| **OrionAgent (v2)** | Thin orchestrator | - Constructor with dependency injection<br>- `processStreaming()` delegates to ProtocolService |
| **ContextService** | Builds LLM context | - `buildContext()`: system prompt, chat history, file list<br>- `formatSystemPrompt()`<br>- `formatChatHistory()` |
| **ProtocolService** | Executes TwoStageProtocol | - `executeStreaming()`: runs TwoStageProtocol with provided context<br>- Handles protocol events (CHUNK, TOOL_CALLS, DONE) |
| **ToolService** | Manages tool calls | - `mergeToolCalls()`<br>- `validateToolCall()`<br>- `executeToolCalls()` (via ToolRunner)<br>- `formatToolResult()` |
| **PlanModeService** | Manages mode restrictions | - `isToolAllowed()`<br>- `filterToolCalls()`<br>- Agent-specific whitelists |
| **AdapterFactory** | Creates LLM adapter based on env | - `createAdapter()`: reads `LLM_ADAPTER` env, returns DS_ChatAdapter or GPT41Adapter |
| **StreamingService** | Handles SSE streaming to client | - `handleSSE()`<br>- `persistStreamedMessage()` (optional, could be moved) |
| **TraceService** | Logs trace events (LLM streaming, tool calls) | - `logEvent()`<br>- `getEvents()` |
| **ErrorService** | Logs errors for monitoring | - `logError()`<br>- `getErrors()` (optional) |

## 3. New Incremental Build Strategy

We will archive all historical files, break the system, and rebuild step-by-step.

### 3.1. Phase A: Archive Everything

Move the following directories and files to `backend/archive/`:

- `backend/src/agents/` (entire directory, we will recreate OrionAgentV2)
- `backend/src/services/` (except `/trace` maybe, but we can archive and recreate)
- `backend/src/_test_/` (all test files, we will create new tests)
- `backend/src/routes/chatMessages.js` (we will rewrite)
- `backend/src/services/TwoStageOrchestrator_DO_NOT_USE.js`
- Any other files that are part of the old Orion system.

**Goal:** After archiving, the system will be broken. We will then build from scratch.

### 3.2. Phase B: Build Order

1. **Step 1:** Create `OrionAgentV2` skeleton (streaming-only, thin) that can be instantiated with minimal dependencies.
2. **Step 2:** Ensure `TraceService` is available (or create a simple one) and integrate into OrionAgentV2.
3. **Step 3:** Integrate `TwoStageProtocol` (already exists, but we may need to adjust) and have OrionAgentV2 delegate streaming to it.
4. **Step 4:** Update `/api/chat/messages` route to use OrionAgentV2 with TwoStageProtocol.
5. **Step 5:** At this point, we should be able to communicate with Orion via TwoStage streaming, and see traces, but no context or tools.
6. **Step 6:** Gradually add `ContextService`, `ToolService`, `PlanModeService`, etc., each with their own tests.

### 3.3. How to Archive

1. Create `backend/archive/` directory.
2. Use `git mv` to move files (preserves history).
3. Update any configuration files (like `jest.config.js`) to ignore archived files.
4. Ensure no remaining imports point to archived files (the system will be broken, but we'll fix as we rebuild).

## 4. Incremental Build Steps

We will break the system and rebuild in the following order:

# Step 1: Archive Historical Files - Completed
- Move entire `backend/src/agents/` to `backend/archive/agents/`
- Move entire `backend/src/services/` to `backend/archive/services/` (except maybe trace, but we'll archive and recreate)
- Move entire `backend/src/_test_/` to `backend/archive/_test_/`
- Move `backend/src/routes/chatMessages.js` to `backend/archive/routes/chatMessages.js`
- Move any other Orion-related files (e.g., `TwoStageOrchestrator_DO_NOT_USE.js`)

# Step 2: Create OrionAgentV2 Skeleton - Complete
- Create `backend/src/agents/OrionAgentV2.js` with a streaming-only interface.
- Constructor accepts `adapter`, `tools`, `traceService`, `protocol` (TwoStageProtocol).
- `processStreaming(projectId, userMessage, options)` delegates to protocol's `executeStreaming`.

# Step 3: Integrate TraceService - In Progress
- Ensure `TraceService` is available (use existing or create a simple one).
- Pass `traceService` to OrionAgentV2 and TwoStageProtocol.
NOTES: 1. Event type should be User_message, orion response, tool call, tool reult, duplicate tool call, llm call, ssytem error. But in the future I want to be able to trace stage A and Stage B separately so I can know for sure what is passed from Stage B to Stage A and the final result
2. Core functions should stay the same, but I want to be able to store this into DB rathe than memory
3. should always be on, no need for the environment variable, how does this now integrte with OrionAgent, is it linked to individual modules directly?

## Goal (North Star)

Design a trace system where:

- All trace events are __persisted in PostgreSQL__ (table `trace_events`).
- Events cover core types: `user_message`, `orion_response`, `tool_call`, `tool_result`, `duplicate_tool_call`, `llm_call`, `system_error`.
- The system is __phase‑aware__ so we can later see exactly what passes between Stage A (tool phase) and Stage B (action phase).
- Tracing is __always on__ (no env flag gate).
- The existing `/api/trace/logs` route uses the DB storage.
- The frontend can format results as markdown and show 5‑line snippets per section (expandable), based on the structured trace data.

All of this must be done via __TDD__: Tara writes failing tests first; Devon then implements the minimal production code to turn them green.

---

## Phase 1 — Schema & Event Model (Tara First)

### Tara’s Responsibilities (RED)

1. __Validate DB schema assumptions__ (trace_events)

   - Write tests (or migration‑validation tests) that assert:

     - A table `trace_events` exists after migrations run.
     - Required columns: `timestamp`, `project_id`, `source`, `type`, `summary`, `details`.
     - Optional columns: `direction`, `tool_name`, `request_id`, `error`, `metadata`, `phase_index`, `cycle_index`.

   - Tests must fail if the schema is missing or if required fields are nullable when they should not be.

2. __Define a valid TraceEvent contract__

   - Tests that describe what a “valid trace event” must contain:

     - Allowed __sources__: `user`, `orion`, `tool`, `system`.

     - Allowed __types__ (for now):

       - `user_message`, `orion_response`, `tool_call`, `tool_result`, `duplicate_tool_call`, `llm_call`, `system_error`.
       - Plus phase‑aware event types: `orchestration_phase_start`, `orchestration_phase_end`, `phase_transition`.

     - Presence of `projectId`, `summary`, and a `details` object.

   - Tests must fail if an event with an unsupported type or missing mandatory fields is accepted as valid.

3. __Phase‑awareness prerequisites__

   - Tests that ensure trace events for phase‑aware types can carry `phaseIndex` and `cycleIndex`.
   - These tests shouldn’t require the protocol to exist yet; they only verify that the event model and persistence can store these fields.

> Outcome: Clear, failing tests that define the contract for what *must* be storable and distinguishable in the trace system.

### Devon’s Responsibilities (GREEN)

- Implement or refine the migration and event‑shape helpers so all of Tara’s schema/event‑shape tests pass.
- No extra functionality beyond what the tests require.

Refactor later if needed (e.g., adjust naming or add indexes) while keeping tests green.

---

## Phase 2 — TraceService API (logEvent / getEvents)

### Tara’s Responsibilities (RED)

Design tests around __behavior__, not implementation details.

1. __logEvent behavior__

   - When `logEvent` is called with a valid event:

     - An event row appears in `trace_events` with matching fields.
     - `timestamp` is set if the caller omits it.
     - A stable `id` is present.

   - When `logEvent` is called with missing critical fields (e.g., no `projectId` or `type`):
     - The test should define the expected behavior (either reject explicitly or fail loudly). No silent success.

   - Tests must fail if `logEvent` does nothing (e.g., remains in‑memory only or is a no‑op stub).

2. __getEvents behavior & pagination__

   - Given a set of events for a project:

     - `getEvents({ projectId })` returns events __for that project only__.
     - Results are ordered as a __chronological slice from the tail__ (most recent window, but returned oldest → newest within that window).

   - Pagination:

     - `limit` controls the maximum number of events returned.
     - `offset` is interpreted as “offset from the most recent events,” not from the beginning.

   - Filtering:
     - Optional `type` and `source` filters narrow the result set.

   - Tests must fail if:

     - No DB query is made (e.g., results come from a memory array).
     - Ordering or pagination semantics don’t match expectations.

3. __Always‑on tracing (no env switch)__

   - Tests that explicitly verify:

     - `logEvent` persists events regardless of any environment variables.
     - There is no way to disable `TraceService` using `TRACE_ENABLED`.

   - Tests should fail if tracing is gated by configuration.

> Outcome: Failing tests that nail down the observable behavior of `TraceService.logEvent` and `TraceService.getEvents` in a DB‑backed, always‑on context.

### Devon’s Responsibilities (GREEN)

- Implement `TraceService` so that:

  - `logEvent` writes to `trace_events` using the shared DB connection.
  - `getEvents` reads from `trace_events` with the exact filtering and pagination behavior Tara’s tests assert.
  - No environment flag is checked to enable/disable tracing.

Refactor after green to clean up internal structure (e.g., helpers for query building) without changing externally observed behavior.

---

## Phase 3 — API Route Integration (`/api/trace/logs`)

### Tara’s Responsibilities (RED)

1. __Route contract tests__

   - For `GET /api/trace/logs?projectId=P1`:

     - Response shape: `{ events: [...], total: N }`.
     - Respects `type`, `source`, `limit`, `offset` query params.

   - Tests must fail if the route responds with a hardcoded payload, bypasses `TraceService`, or ignores filters.

2. __Error handling & edge cases__

   - Missing `projectId` → 400 with a clear error.
   - DB failure simulation (e.g., connection error) → 500 with an error message, not a silent empty success.

> Outcome: Failing route‑level tests that prove the route is wired through `TraceService` and behaves correctly.

### Devon’s Responsibilities (GREEN)

- Ensure the route imports and calls the new `TraceService` and passes query parameters correctly.
- Maintain the existing URL and response shape so the frontend remains compatible.

Refactor: Once green, internal cleanup of controller/route layering is allowed, but behavior must stay fixed.

---

## Phase 4 — Phase‑Aware Orchestration Logging (future‑facing)

This phase is partly speculative, but Tara should still define the expectations __now__, so we don’t end up with untestable behavior later.

### Tara’s Responsibilities (RED)

1. __Phase event expectations__

   - When a new protocol implementation (e.g., `TwoStageProtocol`) starts a phase:
     - It must log `orchestration_phase_start` with `phase`, `phaseIndex`, `cycleIndex`, and `requestId`.

   - When a phase ends:
     - It must log `orchestration_phase_end` with `phase`, `phaseIndex`, `cycleIndex`, `reason`.

   - For transitions between Stage A and Stage B:
     - `phase_transition` events must capture what was produced in the previous phase and handed off to the next (at least at a summary level within `details`).

   - Tests must be able to detect differences between:

     - Tool‑phase events.
     - Action‑phase events.
     - Final answer events.

2. __Non‑acceptance of placeholders__

   - Tests must fail if:

     - A phase event is logged but `phaseIndex`/`cycleIndex` are missing.
     - `phase_transition` exists but does not reflect any real data (e.g., an empty `details` object that could be a placeholder).

> Outcome: RED tests that will drive the later implementation of `TwoStageProtocol` and its integration with `TraceService`.

### Devon’s Responsibilities (GREEN, later)

- Implement protocol logic that logs phase events through `TraceService`, respecting Tara’s test constraints.

---

## Phase 5 — UI Formatting & Snippets (Specification Only for Now)

This is mostly a __frontend concern__, but Tara should define observable behavior, and Devon (frontend) will implement later.

### Tara’s Responsibilities (RED, UI side)

1. __Trace timeline rendering expectations__

   - The UI should:

     - Render events grouped by `requestId` and ordered chronologically.

     - For large `details` payloads (e.g., tool results, LLM prompts):

       - Show only the first ~5 lines by default.
       - Allow expanding to see the full content.

     - Render text content using markdown for readability.

   - Tests (Vitest or integration) must fail if:

     - The UI shows raw JSON without markdown formatting where we expect readable content.
     - The UI always shows full content with no snippet behavior.

### Devon’s Responsibilities (GREEN, UI side)

- Build Vue components that:

  - Consume the backend’s `{ events, total }` payload.
  - Implement the 5‑line preview + expand behavior.
  - Use markdown rendering where appropriate.

---

## Summary (TDD Sequencing)

1. __Tara first__: Define failing tests for

   - DB schema & event model.
   - `TraceService` behavior (`logEvent`, `getEvents`).
   - `/api/trace/logs` route behavior.
   - Phase‑aware events (for future protocol work).
   - UI timeline behavior (snippets + markdown).

2. __Devon second__: Implement only enough backend and frontend logic to make those tests pass, respecting architectural boundaries (routes → services → DB, no placeholders).

3. __Refactor afterwards__: Clean up internal implementations while keeping all tests green.

If you’d like, I can now write a concrete __Tara task brief__ (in prose, still no code) that she can use directly to design the first batch of tests for `TraceService` and `trace_events`.
    1. __Phase 1 — Schema & Event Model (trace_events)__

   - __Status:__ Complete
   - __Notes:__ `trace_events` table migration exists; Tara’s schema tests and TraceService use the expected columns including phaseIndex/cycleIndex.

2. __Phase 2 — TraceService API (logEvent / getEvents)__

   - __Status:__ Complete
   - __Notes:__ DB‑backed TraceService implemented with validation, allowed sources/types, tail‑window pagination, always‑on behavior, and `{ events, total }` contract.

3. __Phase 3 — API Route Integration (`/api/trace/logs`)__

   - __Status:__ Complete
   - __Notes:__ Route wired to TraceService, enforces `projectId`, forwards filters/pagination, returns `{ events, total }`, and handles errors with 500.

4. __Phase 4 — Phase‑Aware Orchestration Logging (TwoStageProtocol)__

   - __Status:__ Pending
   - __Notes:__ Schema and TraceService support phase events, but TwoStageProtocol does not yet emit `orchestration_phase_start/_end` or `phase_transition` via TraceService.

5. __Phase 5 — UI Formatting & Snippets (Trace Dashboard)__

   - __Status:__ Complete (for current backend scope)
   - __Notes:__ TraceDashboard now uses markdown rendering, 5‑line snippets with Show more/less, structured prompt context, and requestId grouping, all driven by Tara’s Phase 5 tests.

So for “step 3” in the plan (TraceService integration), Phases 1–3 and 5 are effectively done; Phase 4 (protocol‑level phase logging) is the main remaining backend piece.

## Fixing problems with FileSystemTool.js
- __Short-term (Devon only):__ Remove the broken per‑tool tracing in `FileSystemTool.js` and rely on ToolRunner for runtime tool traces.

- __Medium-term (Tara + Devon):__ Add tests around ToolRunner → TraceService trace events, then implement centralized, rich tool tracing in ToolRunner to satisfy those tests.


# Step 4: Rewrite TwoStageProtocol from Scratch
- Archive existing `TwoStageProtocol.js` and `ProtocolStrategy.js` (if any) as reference.
- Create new `ProtocolStrategy` base class (if needed) and `TwoStageProtocol` implementation from scratch.
- Ensure the new TwoStageProtocol follows the same interface but is clean and free of unknown behaviors.
- OrionAgentV2 creates a `ProtocolExecutionContext` and calls `protocol.executeStreaming(context)`.
- Protocol yields events (CHUNK, TOOL_CALLS, DONE) which OrionAgentV2 forwards as SSE.
    ## B. Features in the old TwoStageProtocol (things not to lose)

From `backend/archive/agents/protocols/TwoStageProtocol.js` (legacy version):

### 1. Triggered-phase A/B orchestration - COMPLETED

- __Action Phase__:

  - Streams LLM output (`CHUNK`).
  - Collects streaming `TOOL_CALLS` deltas and merges them.
  - Stops the phase as soon as a __complete tool call__ is detected.
  - If no tool call is produced, treats the final `DONE` as the final answer.

- __Tool Phase__:

  - Executes __only the first complete tool call__ in the current cycle.
  - Injects tool results into the conversation as system messages.
  - Returns to Action Phase with updated messages.

### 2. Budgets & guardrails

- `maxPhaseCycles`:
  - Limits how many tool execution cycles are allowed per user turn.
- `maxDuplicateAttempts`:
  - Caps how many times a duplicate tool call can be attempted.
- `searchExecutionCount`:
  - Caps the number of `FileSystemTool_search_files` executions per turn.

### 3. Duplicate detection and signature handling

- Builds __canonical signatures__ for tool calls using:

  - `ToolRunner.buildCanonicalSignature(...)`.

  - Special-casing:

    - `FileSystemTool_write_to_file` → path-only signature.
    - `FileSystemTool_read_file` → path-only.
    - `FileSystemTool_list_files` → path + flags.
    - `FileSystemTool_search_files` → path + regex + file_pattern.

- Maintains a `blockedSignatures` set:

  - Refuses duplicate tool calls within the same request.
  - Injects system refusal messages when duplicates are attempted.

### 4. System notices and guidance injection

- In-tool-phase or error situations, injects system messages like:

  - “Tool call incomplete or malformed. Continue reasoning.”
  - “Duplicate tool call detected… Do NOT call this tool again.”
  - Notices when search limit or tool cycle budget is reached.

- After tool results:

  - Injects guidance like:

    - For `write_to_file`: “You have successfully created/updated `<path>`… do not call tools again this turn.”
    - For `read_file`: “You have successfully read `<path>`… use that content, do not re-read.”
    - Generic: “Use TOOL RESULT as ground truth; do not call same tool again with same target.”

### 5. Tool result formatting & debug mode

- Formats tool results into a __boxed text block__:

  - Header lines (`═════════…`).
  - `TOOL RESULT: <toolLabel>`.
  - JSON payload inside the box.

- Injects boxed results as system messages.

- When `debugShowToolResults` is true:

  - Also streams the box as `CHUNK` events for the UI.

### 6. Streaming adapter integration

- `_callAdapter(messages, executionContext)`:

  - Calls `adapter.sendMessagesStreaming(...)` with:

    - `messages` (system + history + latest user).
    - `functionDefinitions` for tools.
    - `context: { projectId, requestId }`.

  - Converts adapter events to protocol events:

    - `chunk` → `CHUNK`.
    - `toolCalls` → `TOOL_CALLS`.
    - `done` → `DONE` with `fullContent`.

### 7. Tool call merging and completeness

- `_mergeToolCallsIntoMap` and `_mergeToolCall`:

  - Merge streaming tool call deltas into stable tool call objects.
  - Tracks `index` ↔ `id` mapping to unify partial calls.

- `_mergeArgumentStrings`:
  - Heuristically merges fragmented JSON argument strings from streaming.

- `_findFirstCompleteToolCall`:

  - Finds the first tool call with:

    - Non-empty `name`.
    - JSON-parseable `arguments`.

### 8. Fallback behavior and DONE guarantees

- Ensures exactly one `DONE` event is eventually emitted:
  - If budgets are exhausted or tool phase fails, runs a final adapter call to get a final answer.
- Handles malformed tool calls gracefully:
  - Injects system notices instead of crashing.




# Step 5: Update Chat Route
- Rewrite `backend/src/routes/chatMessages.js` to use OrionAgentV2.
- Remove environment-driven protocol selection (always use TwoStageProtocol).
- Ensure SSE streaming works with the new event format.

# Step 6: Test Basic Communication
- At this point, you should be able to send a message to Orion and receive a streaming response via TwoStageProtocol.
- Traces should be logged (if enabled).
- No context building or tool calling yet.

# Step 7: Add ContextService
- Create `ContextService` that builds minimal context (system prompt only initially).
- Integrate into OrionAgentV2 to provide context to the protocol.

# Step 8: Add ToolService and PlanModeService
- Create `ToolService` for tool validation and execution.
- Create `PlanModeService` for mode restrictions.
- Integrate into OrionAgentV2 and TwoStageProtocol to enable tool calls.

# Step 9: Add AdapterFactory and StreamingService
- Create `AdapterFactory` to select adapter based on env.
- Update `StreamingService` to handle SSE and persistence.

# Step 10: Iterate and Refine
- Gradually add more context (chat history, file list).
- Improve error handling and logging.
- Write tests for each module as you build.

# 5. What You Might Be Missing

- **DatabaseTool integration:** The new ContextService may still need DatabaseTool for chat history. Ensure DatabaseTool is available in the tool registry.
- **Error handling:** Ensure errors in services are properly logged and propagated to the client.
- **Streaming events format:** The TwoStageProtocol emits `ProtocolEventTypes` (CHUNK, TOOL_CALLS, DONE). The frontend expects a specific SSE format (e.g., `data: {"chunk": "..."}`). We need to adapt protocol events to SSE.
- **Configuration:** How will the agent's role (Orion) be configured? Use a config file or environment variables.
- **Logging:** Consider adding a logging service for debugging.

# 6. Next Steps

1. Review and finalize this plan.
2. Start with Step 1 (archiving) to break the system.
3. Proceed with Step 2 (OrionAgentV2 skeleton) and build incrementally.

Let's lock this down and begin.
