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

### 5) Two-stage / Triggered-Phase Toolcall Protocol (vFinal) + PCC/CAP/RED/ODG/OSRG + Prototype subtask (P1-F2-T1-S23)

**Context / why:** Even after fixing delta-level duplication, DeepSeek can still get into **tool-call loops** during a single user turn (repeating identical tool calls or emitting multiple tool calls rapidly). We designed a controller-side protocol to make tool execution deterministic and bounded.

**Locked plan (design spec):**
- `docs/design/two_stage_protocol_plan_vFinal.md`
- Protocol is **triggered phases** (A/B repeated): `A1 → B1 → A2 → B2 → … → Final Answer`
  - **Tool Phase (A):** execute **exactly 1** tool call (first complete call wins)
  - **Action Phase (B):** allow non-duplicate tools; duplicates are ignored and replaced with a **system refusal message**
  - Hard budgets: `MAX_TOOLS_PER_TOOL_PHASE=1`, `MAX_PHASE_CYCLES_PER_TURN=3`, plus `MAX_DUPLICATE_ATTEMPTS_PER_TURN`
  - UI policy: do not show raw tool outputs in chat UI by default; rely on Trace + system injection
  - SSE metadata proposed: `phase`, `phaseIndex`, `cycleIndex`

**Key problems discovered during analysis / verification:**
- **Two-stage route not implemented yet** (repo search found no `/api/chat/messages_two_stage`).
- Frontend SSE reader (`frontend/src/utils/streamOrionReply.js`) currently only reacts to `chunk|error|done`. Extra fields are ignored, so phase metadata won’t display without UI work (but should not break).
- Trace event type list (`backend/src/services/trace/TraceEvent.js`) does **not** include orchestration phase types (`orchestration_phase_start/end`), so adding them requires updating `TRACE_TYPES` or mapping to existing types.
- **Redaction risk:** `redactDetails()` in `backend/src/routes/chatMessages.js` is currently a stub that returns details verbatim; this becomes higher-risk as we add more orchestration trace.

**Analyses created (truthful; NEED_Verification used where appropriate):**
- PCC: `docs/analysis/two_stage_protocol/PCC_two_stage_protocol_plan_vFinal.md`
- CAP: `docs/analysis/two_stage_protocol/CAP_two_stage_protocol_plan_vFinal.md`
- RED (initial): `docs/analysis/two_stage_protocol/RED_two_stage_protocol_plan_vFinal.md`
- RED (expanded tables, per repo reference): `docs/analysis/two_stage_protocol/RED_two_stage_protocol_plan_vFinal_EXPANDED.md`
- ODG: `docs/analysis/two_stage_protocol/ODG_two_stage_protocol_plan_vFinal.md`
- OSRG: `docs/analysis/two_stage_protocol/OSRG_two_stage_protocol_plan_vFinal.md`

**New reusable protocol templates added:**
- Observability & Debuggability Gate (ODG): `.Docs/Protocols/Observability_Debuggability_Gate.md`
- Operational Safety & Rollback Gate (OSRG): `.Docs/Protocols/Operational_Safety_Rollback_Gate.md`

**Prototype execution plan:** We decided to validate feasibility with a prototype spike first, then run RED again for a hardened plan.

**DB subtask created (prototype):**
- Subtask: `P1-F2-T1-S23` (DB id `45`)
- JSON used to create subtask:
  - `backend/template/F2-T1-two_stage_prototype_subtasks.json`

**Dedicated instruction JSONs created for handoff:**
- Tara: `docs/implementation_prompts/tara_P1-F2-T1-S23_two_stage_prototype.json`
- Devon: `docs/implementation_prompts/devon_P1-F2-T1-S23_two_stage_prototype.json`
  - Updated to match Tara’s route gating expectations (**501 when disabled**, **200 SSE when enabled**)
  - Explicitly calls out the **Jest open-handle issue**: `backend/src/server.js` currently starts listening at import time (seen in test logs). Recommendation: guard `app.listen` with `if (require.main === module)`.

**Tara test review / issues encountered:**
- Initial Tara suite was not a strict RED wall: some tests passed without implementation and summary mismatched actual pass/fail.
- After revision, tests are route-level via supertest and strict on route existence and gating.
- Remaining known issue: server open-handle (live listener during Jest). Tara used a placeholder sanity test as a workaround; Devon should fix `server.js` so the placeholder can be removed.

---


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

Here’s a concise worklog-ready summary you can append under a new section in `.Docs/Worklog/2025-12-22_streaming_duplication_fix.md`.

```md
### 6) Two-stage prototype implemented end-to-end (route + orchestrator + UI toggle) — P1-F2-T1-S23

**Goal:** Move from design-only two-stage protocol to a working, test-backed prototype that can be toggled on/off and exercised in the real app.

**Key backend changes:**
- **New two-stage route (gated)**
  - File: `backend/src/routes/chatMessages.js`
  - Added `POST /api/chat/messages_two_stage`:
    - Gated by `TWO_STAGE_ENABLED === 'true'` → 501 when disabled, 200 SSE when enabled.
    - Accepts only `sender: 'user'`.
    - Derives `projectId` from `external_id` and seeds a two-stage-specific `requestId`.
    - Logs `user_message` and `orion_response` trace events with `protocol: 'two_stage'`.
    - Uses `TwoStageOrchestrator` for streaming instead of `OrionAgent.processStreaming`.
    - Persists final content once via `StreamingService.persistStreamedMessage` when `finalContent` is non-empty.

- **Router factory for testability**
  - `createChatMessagesRouter(options)` now accepts injected `adapter`, `tools`, and `streamingService`.
  - `server.js` uses the default instance; Tara’s tests create a dedicated app with mocks using the factory.

- **TwoStageOrchestrator implementation**
  - File: `backend/src/services/TwoStageOrchestrator.js`
  - Implements A/B cycling per two-stage spec:
    - **Action phase (B):** streams from adapter; stops as soon as the first *complete* tool call is detected (using a tool_call merge map that filters out internal `__index_to_id__` key).
    - **Tool phase (A):** executes only the **first complete** tool call via `ToolRunner.executeToolCalls`.
  - Budgets:
    - `MAX_TOOLS_PER_TOOL_PHASE = 1` — exactly one tool per action phase.
    - `MAX_PHASE_CYCLES_PER_TURN = 3` — at most 3 tool executions per user turn.
    - `MAX_DUPLICATE_ATTEMPTS_PER_TURN = 3` — at most 3 duplicate attempts before forcing final answer.
  - Duplicate handling:
    - Computes canonical signature via `buildCanonicalSignature(toolName, action, params, projectId)` with a fallback JSON signature when mocks return `undefined`.
    - Maintains `blockedSignatures` per request; if repeated, injects a system refusal message and emits a `System Notice` chunk.
    - On `duplicateExceeded`, injects a “maximum duplicate attempts exceeded” system message and emits a final `done` event (no further tool calls).
  - Cycle budget:
    - When `cycleIndex` hits the budget and `doneEmitted` is still false, injects a “maximum cycles reached” system message, performs one more Action-only adapter call, streams its chunks, and emits a single `done` as final answer.
  - Phase metadata:
    - Every SSE event from the orchestrator is augmented with `{ phase, phaseIndex, cycleIndex }`.
  - Tool results:
    - Always injected as boxed system messages for the model.
    - Only streamed to UI when `TWO_STAGE_DEBUG === 'true'` (default is hidden in UI).

- **Server open-handle fix**
  - File: `backend/src/server.js`
  - Now guards `app.listen(port, ...)` with `if (require.main === module)` so Jest can import the app without starting a real listener.

**Key frontend changes:**
- **Two-stage toggle in ChatPanel**
  - Files:
    - `frontend/src/stores/uiStore.js`
    - `frontend/src/components/ChatPanel.vue`
  - `uiStore` now tracks `twoStageEnabled` (persisted to `localStorage` as `orion_two_stage_enabled`).
  - ChatPanel footer has a `2-stage` checkbox next to the PLAN/ACT toggle.
  - `handleSendMessage` chooses endpoint based on toggle:
    - `false` → `POST /api/chat/messages` (unified route)
    - `true` → `POST /api/chat/messages_two_stage` (two-stage prototype)
  - Streaming client (`frontend/src/utils/streamOrionReply.js`) still reads `chunk|error|done` and ignores the extra phase metadata fields (safe).

**Tara test suite (backend) — now fully GREEN (10/10):**
- File: `backend/src/_test_/two_stage_protocol.spec.js`
- Coverage:
  - **S23-T1:** Route gating & SSE behavior when flag disabled/enabled; legacy `/messages` sanity check.
  - **S23-T2:** Only first tool call executes when multiple toolCalls appear in a single action phase.
  - **S23-T3:** A/B cycling — list_files → read_file → final answer using multiple adapter invocations.
  - **S23-T4:** Duplicate handling:
    - Executes only the first non-duplicate tool call once.
    - Injects system refusal messages on duplicates.
    - Regression guard for the real-world infinite-loop bug: once `duplicateExceeded` is hit, orchestrator must not keep calling the adapter indefinitely and must emit exactly one `done`.
  - **S23-T5:** Cycle budget — 4 sequential non-duplicate toolCalls result in only 3 actual tool executions + 1 final answer adapter call.
  - **Additional:**
    - Phase metadata present in SSE events.
    - Exactly one `done` event per user turn.
    - `persistStreamedMessage` is called exactly once at end of turn.

**Manual validation:**
- With `TWO_STAGE_ENABLED=true` and the 2-stage toggle on in ChatPanel:
  - Prompt: “can you list the frontend?”
    - Observed:
      - Tool calls: list_files on root, then list_files on `frontend/`.
      - Final two-stage Orion response correctly summarizes frontend structure.
      - Trace events tagged with `protocol: 'two_stage'` and proper tool_call/tool_result details.
  - Prompt: “list the root, then list the root again, and tell me what you see”:
    - Observed:
      - First call executes normally.
      - Subsequent identical tool calls are blocked; system refusal + duplicateExceeded behavior kicks in.
      - After Devon’s fix, the orchestrator no longer loops infinitely after hitting the duplicate limit.

**Known open gaps (for future phases):**
- Cross-turn context hydration: two-stage route currently seeds messages with only the two-stage system prompt + current user message; prior chat history is not yet preloaded into the turn.
- Budget strategy: budgets are fixed small integers (3) and not yet configurable or progress-sensitive.
- Redaction: `redactDetails()` is still a stub; needs to be updated per `DEV_TRACE_EVENT_MODEL` to avoid logging sensitive content as we add richer two-stage trace events.
- Frontend phase UX: phase/phaseIndex/cycleIndex are present in SSE events but not surfaced in the Chat UI yet.

**Supporting docs & artifacts:**
- Design: `docs/design/two_stage_protocol_plan_vFinal.md`
- Analyses: `docs/analysis/two_stage_protocol/*` (PCC, CAP, RED vFinal + v2, ODG, OSRG)
- Context transfer snapshot: `docs/context_transfer-two_staged.json`
- Implementation prompts:
  - Tara: `docs/implementation_prompts/tara_P1-F2-T1-S23_two_stage_prototype.json`
  - Devon: `docs/implementation_prompts/devon_P1-F2-T1-S23_two_stage_prototype.json`
```