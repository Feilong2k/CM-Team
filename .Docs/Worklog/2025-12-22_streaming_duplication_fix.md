# Work Log — 2025-12-22 — Streaming Duplication Bug (DeepSeek) + Tracing Probes + OpenAI Streaming Tool Calls

## Summary
We chased a persistent **duplicated Orion response** issue that appeared during **SSE streaming**. It presented as the assistant output containing repeated blocks (often effectively `X + X`). After instrumenting the stream at multiple points and isolating the pipeline, we determined the likely cause was **DeepSeek SSE occasionally emitting duplicate `delta.content` chunks**, which were blindly appended during assembly.

We implemented a defensive adapter-side guard in `DS_ChatAdapter.sendMessagesStreaming()` to **drop exact consecutive duplicate deltas**, and the duplication stopped in real usage.

In the process, we added optional tracing + duplication probes for side-by-side comparison and fixed dev-server stability (nodemon restarts) caused by probe file generation.

---

## Symptoms
- Chat UI shows duplicated Orion responses (repeated paragraphs/sections).
- Happened consistently with DeepSeek streaming.
- Switching providers (OpenAI) changed behavior; tool calling via streaming appeared broken on OpenAI due to missing `delta.tool_calls` parsing.

---

## Root cause (most likely)
**DeepSeek streaming provider duplicated content at the delta level.**

- The backend streaming pipeline (`OrionAgent -> StreamingService -> SSE`) does not introduce duplication in a deterministic mock.
- The DeepSeek adapter appended every received `delta.content`.
- If the provider repeats the same delta, the assembled fullContent becomes duplicated.

---

## Fix
### 1) DeepSeek adapter duplication guard
**File:** `backend/src/adapters/DS_ChatAdapter.js`

Added a simple guard:
- Track `lastContentDelta`
- Skip emitting/appending when the next `delta.content` is exactly the same as the previous one.

This prevents `X + X` when the stream repeats identical delta chunks.

**Test:** `backend/src/_test_/ds_adapter_dup_guard.spec.js`
- Mocks SSE lines with two identical `delta.content` values.
- Confirms output and `fullContent` are not duplicated.

---

## Tracing/probe instrumentation (debug-only)
To locate duplication precisely, we introduced disk probes and trace event logging. This became noisy in normal usage, so we made it opt-in.

### Probe files
**Files:**
- `backend/src/services/trace/DuplicationProbeLogger.js`
- `backend/src/agents/OrionAgent.js`
- `backend/src/routes/chatMessages.js`

Writes `agent_start`, `agent`, `agent_end`, and `final` JSON snapshots.

### Opt-in switches
**File:** `backend/src/services/trace/TraceConfig.js`
- `TRACE_ENABLED=true` enables TraceService + `/api/trace` route.
- `ORION_DUP_PROBE_ENABLED=true` enables on-disk probe JSON writing.

Default is OFF (to avoid 4 files per request).

---

## Dev stability fix: nodemon restarting on every message
Probe file writes were causing nodemon to detect file changes and restart the server.

**Fix:** `backend/nodemon.json`
- Watch only `src`
- Ignore `debug/**`, `**/dup_probe/**`, and tests.

---

## OpenAI (GPT-4.1) streaming tool calls
Observation:
- GPT41Adapter sends `tools` in the request body (`body.tools`), so the model *can* request tools.
- But `GPT41Adapter.sendMessagesStreaming()` currently has `// TODO: Handle tool calls in streaming` and does not parse `delta.tool_calls`.
- Therefore, in streaming mode, tools appear “broken” even though non-streaming tool calls would work.

Next task:
- Implement `delta.tool_calls` parsing in `GPT41Adapter.sendMessagesStreaming()` to match DeepSeek behavior.
- Optionally add the same duplicate delta guard there as a safety net.

---

## Key takeaway
The duplication bug was fixed by normalizing a flaky provider stream at the adapter boundary (DeepSeek), not by rewriting the whole frontend/backend pipeline.

---

## Follow-up work completed (same day)

### 1) Removed dup_probe instrumentation entirely (to eliminate noisy/ambiguous trace events)
The duplication probe instrumentation ended up confusing the trace timeline (e.g. events like `dup_probe_agent_full_content` and a misnamed `tool_result_stream` type showing up even when no tool execution occurred).

**Goal:** remove *all* dup_probe artifacts so the trace dashboard reflects real events only.

**Changes:**
- Deleted debug-only logger:
  - `backend/src/services/trace/DuplicationProbeLogger.js`
- Removed probe logging call-sites:
  - `backend/src/agents/OrionAgent.js`
  - `backend/src/routes/chatMessages.js`
- Removed/cleaned probe-related configuration:
  - `backend/src/services/trace/TraceConfig.js`
- Removed probe tests:
  - `backend/src/_test_/dup_probe_agent_emission.spec.js`
  - `backend/src/_test_/dup_probe_long_path.spec.js`
  - Removed the probe assertion block from `backend/src/_test_/unified_streaming_tools.spec.js`

**Verification:**
- Targeted backend tests passed:
  - `npm test --prefix backend -- src/_test_/unified_streaming_tools.spec.js`

**Commit:** `bf21f3d` (Remove dup_probe instrumentation)

---

### 2) Fixed “Chat UI only shows latest message” (history not loading)
**Symptom:** The ChatPanel UI would show only the most recent message (the one locally appended after sending), but not historical messages.

**Root cause:** Frontend used hard-coded absolute backend URLs (`http://localhost:3500/...`). When running the UI on the Vite dev server (`http://localhost:6100`), history fetches could be blocked by backend CORS (which only allows `localhost:6100-6120`), and/or bypassed the Vite proxy.

**Fix:** Use same-origin `/api/...` calls so the Vite dev-server proxy (`frontend/vite.config.js`) routes traffic to the backend without relying on CORS.

**Changes:**
- `frontend/src/components/ChatPanel.vue`
  - History loading uses: `fetch('/api/chat/messages?...')`
  - Streaming uses: `POST '/api/chat/messages'`
- Updated expectation in `frontend/src/__tests__/ChatPanel.streaming.spec.js` to match `'/api/chat/messages'`

**Commit:** `fe858b9` (Fix chat history loading via Vite /api proxy)

---

### 3) Root cause analysis: chat_messages were being deleted by backend tests
**Observation:** `chat_messages` count in the dev DB was unexpectedly low.

**Findings:**
- Dev DB (`DATABASE_URL`) had **8** `chat_messages` rows.
- Test DB (`DATABASE_URL_TEST`) had **63** rows.
- `backend/src/_test_/chat_messages_migration.spec.js` includes `DELETE FROM chat_messages` cleanup, but it was connecting via `process.env.DATABASE_URL` (dev DB), meaning running `npm test --prefix backend` could wipe the dev conversation history.

**Fixes:**
- Updated tests that created direct `pg.Client` connections to select `DATABASE_URL_TEST` when `NODE_ENV=test`:
  - `backend/src/_test_/chat_messages_migration.spec.js`
  - `backend/src/_test_/schema_v2.spec.js`
- Added a hard safety guard in `backend/src/db/connection.js`:
  - If `NODE_ENV=test` and `DATABASE_URL_TEST` is missing, throw immediately.
  - Prevents test runs from accidentally using the dev DB through the shared connection module.

**Verification:**
- Re-ran a focused test subset and re-checked the dev DB count; it remained unchanged.

**Commit:** `96f4559` (Protect dev DB from tests (use DATABASE_URL_TEST))

---

### 4) Tool-call reliability fixes: stop retry spam + surface tool errors to Orion
**Symptom:** When requesting a non-existent subtask (e.g., `2-1-199`), Orion would:
- trigger repeated tool calls
- show empty TOOL RESULT boxes (no error text)
- user could still see the real error in the trace (`Subtask with ID ... not found`)

**Root cause:**
- `ToolRunner.executeToolCalls()` has an internal retry policy (`maxAttempts=3`). Each attempt was logged as a new `tool_call`/`tool_result` pair by `DatabaseToolAgentAdapter`, creating the impression of “more than 3 calls”.
- OrionAgent boxed tool results as `JSON.stringify(result.result)`; on failures ToolRunner returns `{ success:false, error: ... }`, so `result.result` was undefined → empty box.

**Fixes:**
- `backend/src/agents/OrionAgent.js`
  - When ToolRunner returns `success:false`, stream a TOOL RESULT payload containing `{ ok:false, error, details, attempts, toolCallId }` so Orion can react and stop retrying.
- `backend/tools/ToolRunner.js`
  - Added `isDeterministicNonRetryable()` guard so deterministic errors do **not** retry (e.g., `/not found/i`, `MISSING_PROJECT_CONTEXT`).
- Added regression test:
  - `backend/src/_test_/toolrunner_nonretryable_errors.spec.js`

**Verification:**
- `npm test --prefix backend -- src/_test_/toolrunner_nonretryable_errors.spec.js src/_test_/orion_streaming_partial_toolcalls.spec.js src/_test_/unified_streaming_tools.spec.js`

**Commit:** `0d0fb6c` (Tool errors: show in chat; avoid retry spam for not-found)
