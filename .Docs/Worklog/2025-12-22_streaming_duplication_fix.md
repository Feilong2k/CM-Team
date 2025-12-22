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
