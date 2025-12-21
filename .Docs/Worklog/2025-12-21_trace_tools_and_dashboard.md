# Work Log — 2025-12-21 — Tools, Tracing, and Trace Dashboard

## Context
- Subtasks: **2-1-8** (tool execution + tracing) and early **2-1-9** (Trace Dashboard).
- Goal: Make Orion reliably call tools (esp. `DatabaseTool_get_subtask_full_context`) from ACT mode, add trace plumbing, and start a UI to inspect trace data between Chat and Project Console.

---

## 1. Backend Tooling & Tracing (2-1-8)

### 1.1 Centralized Tool Execution (ToolRunner)
**Files:**
- `backend/tools/ToolRunner.js`
- `backend/src/agents/BaseAgent.js`

**What we did**
- Created **ToolRunner** as the single place that knows how to execute tools:
  - `executeToolCall(tools, toolCall, context)`
  - `executeToolCalls(tools, toolCalls, context)`
- Refactored `BaseAgent` to delegate tool handling to ToolRunner:
  - `handleToolCalls` → `executeToolCalls(this.tools, toolCalls, context)`
  - `executeTool` → `executeToolCall(this.tools, toolCall, context)`
- ToolRunner uses `parseFunctionCall` from `functionDefinitions` to:
  - Parse `tool` / `action` / `params` from the LLM tool_call.
  - Look up implementation from `this.tools[tool]` (e.g., `DatabaseTool`, `FileSystemTool`).
  - Invoke the function with `{ ...params, context }`.

**Why it matters**
- All agents (currently Orion) and all adapters (DeepSeek, GPT4.1, future Gemini) share the **same execution pipeline**.
- Adding new tools becomes: **schema → implementation → registry**, not editing each agent/adapter.

**Gotchas / notes**
- We had to be careful that tests mocking tools still see the right shape. This influenced how we wrote ToolRunner and BaseAgent.

---

### 1.2 DatabaseTool Agent Adapter
**Files:**
- `backend/tools/DatabaseToolAgentAdapter.js`
- `backend/src/_test_/database_tool_agent_adapter.spec.js`
- `backend/tools/DatabaseTool.js`

**What we did**
- Implemented a **thin adapter** so LLM tool calls map cleanly to the existing positional `DatabaseTool` API.
- Adapter behavior:
  - Accepts `{ subtask_id, project_id?, context? }`.
  - Derives `projectId` from `project_id` or `context.projectId`.
  - Delegates to `DatabaseTool.get_subtask_full_context(subtaskId, projectId)`.
  - Logs TOOL_CALL / TOOL_RESULT via `TraceService`.
  - Validates args (clear errors if `subtask_id` missing or args not an object).
- Fixed import/binding so it works with both runtime and Jest mocks:
  - `const DatabaseToolModule = require('./DatabaseTool');`
  - `const DatabaseTool = DatabaseToolModule.DatabaseTool || DatabaseToolModule;`
  - Handles cases where tests mock `../../tools/DatabaseTool` as a plain object.

**Tests**
- `database_tool_agent_adapter.spec.js` now **GREEN**:
  - Forwards `subtask_id` + `project_id` correctly.
  - Uses `context.projectId` when explicit `project_id` is missing.
  - Propagates `MISSING_PROJECT_CONTEXT` errors from underlying tool.
  - Fails fast for missing `subtask_id` or non-object args.

**Gotchas / mess‑ups**
- Initial version bound methods directly on `require('./DatabaseTool')` assuming a particular export shape → broke tests where the module was mocked differently.
- Fix: introduced `DatabaseToolModule.DatabaseTool || DatabaseToolModule` and guarded `.bind` calls.

---

### 1.3 Tracing Infrastructure
**Files:**
- `backend/src/services/trace/TraceEvent.js`
- `backend/src/services/trace/TraceService.js`
- `backend/src/routes/trace.js`
- `backend/DEV_TRACE_EVENT_MODEL.md`
- `docs/DEV_TRACE_EVENT_MODEL.md`
- `backend/src/_test_/api_trace.spec.js` (RED tests defining behavior)

**What we did**
- Defined `TraceEvent` model and constants (`TRACE_TYPES`, `TRACE_SOURCES`).
- Implemented `TraceService` with:
  - `logEvent(event)` — for now, in-memory storage with a well-defined shape.
  - `getEvents({ projectId })` — returns events filtered by project.
- Added `/api/trace/logs` route that:
  - Accepts `projectId` query.
  - Responds with `{ events }` following `TraceEvent` shape.
- Logged trace events in key places:
  - `DatabaseToolAgentAdapter` (TOOL_CALL + TOOL_RESULT).
  - `FileSystemTool` (for file read/write tool calls).
- Documented the trace model and lifecycle in `DEV_TRACE_EVENT_MODEL.md` and referenced it from the Orion Tool Execution Guide.

**What’s still RED / incomplete**
- `api_trace.spec.js` contains:
  - A passing core-fields test.
  - Skipped tests for filtering (type/source) and redaction.
  - A deliberately failing test to ensure we handle trace logging failures gracefully.
- Redaction and rich filtering aren’t implemented yet.

---

### 1.4 Chat Route & ACT-mode Tools
**Files:**
- `backend/src/routes/chatMessages.js`
- `backend/src/agents/OrionAgent.js`
- `backend/src/adapters/DS_ChatAdapter.js`
- `backend/tools/registry.js`

**What we did**
- In `chatMessages.js`:
  - Choose adapter based on env (`DeepSeek` vs `OpenAI`).
  - Build OrionAgent with full tools registry: `getToolsForRole('Orion', 'act')`.
  - For `POST /api/chat/messages`:
    - If `sender === 'user'` and **non-streaming** (no SSE Accept), call:
      ```js
      const response = await orionAgent.process(external_id, content, { mode });
      ```
    - Persist Orion’s response to `chat_messages`.
- Ensured `OrionAgent.process` uses `this.handleToolCalls` (now ToolRunner-based) so ACT-mode calls can execute tools.
- Kept streaming path (`processStreaming`) as text‑only for now (no tool execution).

**Key decision**
- **Tools are enabled only in ACT + non-streaming** path today.
- Streaming (PLAN mode) still **does not** execute tools; we’ll handle that in future subtasks.

---

### 1.5 DB Safety for Tests
**Files:**
- `backend/src/db/connection.js`
- `backend/.env`

**What we did**
- Introduced `DATABASE_URL_TEST` in `.env` pointing to `appdb_test`.
- `connection.js` reads `DATABASE_URL_TEST` when `NODE_ENV === 'test'`.
- Result: Jest tests that delete from `chat_messages` now hit the **test DB**, not the real app DB.

**Why this mattered**
- Before this, running tests could blow away real conversation history; we fixed that.

---

## 2. Frontend: ACT-mode Tools & Trace Dashboard (2-1-8 → 2-1-9)

### 2.1 ChatPanel: PLAN vs ACT
**Files:**
- `frontend/src/components/ChatPanel.vue`
- `frontend/src/utils/streamOrionReply.js`

**What we did**
- Refined ChatPanel behavior:
  - **PLAN mode**:
    - Uses SSE via `streamOrionReply` (streamed text only).
  - **ACT mode**:
    - Sends **one-shot JSON POST** to `/api/chat/messages`:
      ```js
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      ```
    - Expects `{ message, metadata }` and renders a single Orion reply.
- This aligns with backend: `orionAgent.process` (non-streaming) is where ToolRunner runs.

**Result**
- When user selects **ACT** and asks Orion to use `DatabaseTool_get_subtask_full_context`, the pipeline can now:
  - Issue a tool_call.
  - Execute it via ToolRunner + DatabaseToolAgentAdapter + DatabaseTool.
  - Return a summarized subtask.

---

### 2.2 Orion Tool Execution Guide
**File:**
- `.Docs/Orion_Tool_Execution_Guide.md`

**What we did**
- Created a consolidated guide documenting:
  - PLAN vs ACT behavior.
  - Tool pipeline end-to-end (ChatPanel → chatMessages → OrionAgent → ToolRunner → DatabaseToolAgentAdapter → DatabaseTool → Postgres).
  - How to **use** tools from the UI.
  - How to **add** new tools.
  - Tracing & streaming plan, including Orion’s suggested ladder diagrams for tool calls and streaming debug.
  - A TODO list for future streaming + tracing work.

**Notes**
- This became the reference spec for 2-1-9 and beyond.

---

## 3. 2-1-9: Trace Dashboard (Tara + Devon)

### 3.1 Tara – Frontend Tests
**File:**
- `frontend/src/__tests__/TraceDashboard.spec.js`

**What we did**
- Defined tests for the Trace Dashboard:
  1. **Timeline list**
     - Asserts events render in a list with type, timestamp, summary.
  2. **Detail pane**
     - Clicking an item shows expanded details and metadata.
  3. **Manual refresh**
     - Refreshing adds new events while preserving selection where possible.
  4. **Error handling**
     - API failure shows an inline error, not a crash.

**Issue encountered**
- Running `npm --prefix frontend test -- TraceDashboard.spec.js` initially failed with:
  - `Error: No test suite found in file ... TraceDashboard.spec.js`.
- The file *does* contain `describe(...)`; this appears to be a Vitest/CLI nuance when directly specifying the file.
- Mitigation: run `npm --prefix frontend test` and allow Vitest to pick up tests via its default pattern (to be validated in future runs).

---

### 3.2 Devon – TraceDashboard Component
**File:**
- `frontend/src/components/TraceDashboard.vue`

**What we did**
- Implemented the dashboard UI:
  - Left pane: timeline of trace events.
  - Right pane: selected event details.
- Features:
  - Fetches `/api/trace/logs?projectId=<projectId>` on mount and when `projectId` changes.
  - `Refresh` button to re-fetch events.
  - Preserves selection for events that still exist after refresh.
  - Shows inline error `[data-testid="trace-error"]` when API fails.
  - Pretty-prints `details` + `metadata` JSON in the detail view.

---

### 3.3 Devon – 3-Column Layout & Toggle
**File:**
- `frontend/src/App.vue`

**What we did**
- Changed the main layout to support a **Trace Dashboard column** between Chat and Project Console.
- Behavior:
  - **When trace hidden** (`traceVisible === false`):
    - Chat: `w-1/2` (left).
    - Project Console: `w-1/2` (right).
  - **When trace visible** (`traceVisible === true`):
    - Chat: `w-1/3`.
    - Trace Dashboard: `w-1/3`.
    - Project Console: `w-1/3`.
- Added a toggle button on the right edge of the Chat panel:
  - `data-testid="trace-toggle"`.
  - Shows `≡` when closed, `×` when open.
  - Clicking toggles `traceVisible`.
- Wired project selector to a `currentProjectId` ref and passed it to `TraceDashboard` via `:project-id` prop.

**Result**
- Matches your requested UX:
  - Default: 2-pane Chat + Project.
  - When opened: 3-pane Chat + Trace + Project.
  - Arrow/chevron toggles the middle pane.

---

## 4. Testing & Tooling

### 4.1 Frontend Testing Setup
**Files:**
- `frontend/package.json`
- `frontend/vitest.config.js`

**What we did**
- Added a `test` script to `frontend/package.json`:
  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  }
  ```
- Confirmed Vitest config uses `jsdom` and Vue plugin.

**Remaining to verify**
- Running `npm --prefix frontend test` (without extra args) to ensure TestDashboard + existing ChatPanel tests are discovered and passing.

---

## 5. Git & Checkpointing

**Actions**
- Staged and committed 2-1-8 changes:
  - Commit: `F2-T1-S8 (2-1-8): centralize tool execution, add trace plumbing, and wire ACT-mode tools from UI`.
- Pushed to `origin/main`.
- After that, started 2-1-9 work (TraceDashboard tests and implementation) in the working tree.

---

## 6. Known Gaps / Future Work

1. **Streaming + tools**
   - PLAN mode streaming still does not execute tools.
   - ToolRunner is ready; we still need streaming tool_call detection + execution.

2. **Trace filtering & redaction**
   - `/api/trace/logs` currently filters by `projectId` only.
   - No type/source filters or redaction logic implemented yet (tests are skipped / RED).

3. **Trace Dashboard polish**
   - More advanced filters (type/source, requestId).
   - Better time grouping or session views.
   - Integration with streaming tool events once they exist.

4. **Vitest CLI quirk**
   - Direct `vitest TraceDashboard.spec.js` invocation reported “No test suite found” even though tests exist.
   - Needs follow-up to confirm how Vitest resolves paths / patterns in this repo.

---

## 7. Summary

**Accomplishments**
- Centralized tool execution with ToolRunner + BaseAgent refactor.
- Solid DatabaseToolAgentAdapter with passing contract tests.
- Trace service and route implemented; key tool calls now logged.
- ACT mode wired for real tool usage from the UI.
- Comprehensive Orion Tool Execution Guide authored.
- TraceDashboard tests (Tara) + component + 3-column layout with collapsible middle pane (Devon) implemented.

**Failures / Mess-ups**
- Initial DatabaseToolAdapter binding assumed a specific export shape → broke tests until fixed.
- DS_ChatAdapter / schema_v2 tests remain RED from earlier work (not fully addressed here).
- Initial attempt to run frontend tests failed due to missing `test` script; added later.
- Direct Vitest invocation by file path reported “No test suite found” even though tests exist (needs follow-up).

**Overall**
- The system can now:
  - Execute DB tools in ACT mode from the UI.
  - Log trace events for tool calls.
  - Display trace logs in a basic dashboard between Chat and Project Console.
- We have a clear roadmap for streaming tool support and richer tracing/debugging (captured in `.Docs/Orion_Tool_Execution_Guide.md`).
