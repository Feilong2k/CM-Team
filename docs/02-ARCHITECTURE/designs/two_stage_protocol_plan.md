# Two-Stage Protocol Plan (Opt-in) — Orion Orchestration

> **Purpose:** Introduce an opt-in two-stage orchestration pipeline (Stage A: Tool Phase → Stage B: Action Phase) to reduce DeepSeek tool-looping and enforce deterministic stopping conditions, while keeping the current unified streaming + soft-stop behavior intact as the default and as a fallback.
NOTE: once this has been established and during the testing phase, make this the default option. whith current unified streaming and soft stop as the backup. Make it easy to fall back on if this does not work.
**Response:** Yes — that’s a good rollout strategy. Concretely: keep `/api/chat/messages` (current behavior) unchanged; implement `/api/chat/messages_two_stage` behind `TWO_STAGE_ENABLED`; once validated, flip the frontend to call the two-stage route by default, but keep a single config toggle/env var to swap back instantly.

---

## Goals

1. **Stop tool-call spam/loops** during a single user turn (common with DeepSeek) by enforcing a bounded tool phase.
2. Preserve existing behavior:
   - **Current route stays default**: `/api/chat/messages`
   - **Soft stop stays intact** (ToolRunner canonical signature + DUPLICATE_BLOCKED)
3. Provide a **safe rollback path**: new orchestration runs on a **separate route**, gated by an env flag.

---

## Constraints / Guardrails

- Do **not** remove or change current `/api/chat/messages` behavior.
- Two-stage must reuse **ToolRunner** (canonical signature, dedupe/soft-stop, trace logging). NOTE: I don't know what this means, what's canonical signature? definitely trace logging every stage, we can ignore dedupe/softstop for now
  **Response:**
  - **ToolRunner** = the server-side executor that takes an LLM `tool_call`, finds the right tool function, runs it, and returns a structured result.
  - **Canonical signature** = a stable “fingerprint” string for a tool call built from `(toolName + action + normalized args + projectId)`.
    - Example: `FileSystemTool.list_files` with `{ path: ".Docs/Roadmap", recursive: true }` always hashes to the same signature even if arg key order differs.
  - **Why it matters:** it’s the basis for dedupe/soft-stop. If we want to *ignore dedupe/soft-stop initially*, we can keep ToolRunner but disable (or greatly relax) duplicate blocking in the two-stage route. I still recommend keeping soft-stop available because it’s already implemented and it protects Stage A from tool spam.
   NOTE2: if stream is closed when tool call is detected why would there be tool spam? and only the first tool call should be executed, the rest of the same tool call should be ignored.

- Two-stage must be **feature-flagged** and trivially disable-able.
- Ensure streaming semantics remain correct (don’t emit `done` early).

---

## High-Level Design

### Stage A — Tool Phase
- Orion calls the LLM with system prompt + user message.
- Stream until we detect tool_call(s).
- Execute those tool calls server-side (ToolRunner).
- Emit tool results to the client.

### Stage B — Action Phase
- Start a fresh LLM call.
- Inject tool results as **system-level TOOL RESULT boxes**.
- **Disable tools** in this phase. NOTE: would this prevent multi-step tool actions?
  **Response:** Yes — *if we disable all tools in Stage B*, Orion cannot do multi-step chains like `list_files → read_file` within one “turn”. To support multi-step tasks, we have two options:
  1) Keep Stage B tools **disabled** and force all chaining to happen inside Stage A using a small “tool budget” (e.g., allow 1–2 tool calls per Stage A). OR
  2) Allow **Stage B tools but only non-duplicate + only from an allowlist** (recommended for your use-case): e.g. allow `read_file` in Stage B if Stage A already listed candidates.
  
  For your “summarize a doc” example, the cleanest is: **Stage A allows 2 calls max** (list then read), Stage B is answer-only.
- Stream final answer.

---

## Feature Set to Implement

### F1) New route (opt-in) using two-stage protocol
Add a new backend route:

- `POST /api/chat/messages_two_stage`

Properties:
- Default OFF behind env flag: `TWO_STAGE_ENABLED=false`.
- Uses the same model adapter and the same ToolRunner.
- Allows immediate rollback by switching the frontend endpoint back to `/api/chat/messages`.

**Rationale:** isolate risk; no regression to existing clients.

---

### F2) Phase metadata envelope (phase markers)
Standardize the event envelope for two-stage SSE so the client (and TraceDashboard) can understand where we are.

Fields:
- `phase`: `tool_phase` | `action_phase` | `complete`
- `requestId`
- `projectId`
- `toolBatchId` (incrementing per stage/tool batch)
- `blockedSignatures` (optional summary)
NOTE: Can Orion go back and forth in tool_phase and action_phase to complete chained tool calls?
**Response:** Yes, we *can* support back-and-forth, but it becomes a **multi-stage state machine** (A1→B1→A2→B2). For MVP stability, I recommend **no bouncing**: do all tool chaining in Stage A (within a strict tool budget), then do a single Stage B final answer. If later we need A/B/A/B, we add it with a hard cap (e.g., max 2 cycles).

SSE event examples (all still sent as JSON on `data:` lines):
- `{ phase: 'tool_phase', toolCalls: [...] }` (optional UI/debug)
- `{ phase: 'tool_phase', toolResults: [...] }` (or tool result boxes as chunks)
- `{ phase: 'action_phase', chunk: '...' }`
- `{ phase: 'complete', done: true, fullContent: '...' }`

---

### F3) Stage A policy (tool phase behavior)

**Core behavior:**
1. Call the LLM with the user message + system prompt.
2. Stream until we detect complete tool_call(s).
3. Stop consuming further assistant free-form content in Stage A (optional, but recommended).
4. Execute tool calls via ToolRunner (soft-stop applies). NOTE: do we need soft-stop?
   **Response:** Not strictly required for two-stage to work, but it’s a strong safety net. Two-stage limits the *number of tool calls*, while soft-stop prevents repeating the *same* tool call. I recommend keeping it ON (especially for DeepSeek), but we can configure it so it only activates inside Stage A and only for exact duplicates.
5. Emit tool results to client. NOTE: when you say client, do you mean the me? or Orion?
   **Response:** “Client” = the frontend UI (you). Separately, we also inject the tool results back into Orion’s next model call as **system messages** so Orion can use them.

**Budgets / stopping conditions:**
- `TWO_STAGE_MAX_TOOLS` (default 2): maximum tool calls executed in Stage A. NOTE: make it max 1 for now.
  **Response:** We can set it to 1 for the MVP, but note it limits multi-step tasks (list then read). If your primary immediate pain is tool loops, start with 1. If your primary immediate goal is “summarize doc”, you likely want **2**.
- If the model emits more tool calls than allowed, only execute the first N and mark the remainder as blocked with a system notice.

**Special cases:**
- If no tool calls occur, skip Stage A and go straight to Stage B. NOTE: if no tool call, then the stream should continue its course, and be treated like a normal message right?
  **Response:** Correct. In that case Stage A is effectively empty and Stage B just becomes “normal streaming answer”. Implementation-wise: we can immediately enter Stage B using the same initial messages.

---

### F4) Stage B policy (action phase behavior)

**Core behavior:**
1. Start a *fresh* LLM call.
2. Message list includes:
   - system prompt
   - user message
   - TOOL RESULT boxes from Stage A (system messages) NOTE: System message is different from system prompt?
     **Response:** Yes.
     - **System prompt** = the initial “Orion rules + context” prompt.
     - **System messages** = additional high-priority instructions we append during orchestration (e.g., TOOL RESULT boxes, refusal notices). They use the same `role: 'system'` in the chat array, but they are appended after the initial system prompt.
NOTE2: is the current results not sent to Orion as System Message?

   - an explicit instruction: *Tools are disabled in this phase; answer using the results.* NOTE: rather than disabling tools, what if we disable duplicate calls, like the soft_stop, but rather than error messages, the tool call is ignored and inject a refusal notice into the stream, but other tools can be used?
     **Response:** That’s a valid (and probably better) hybrid. Two options for Stage B:
     - **Strict (simpler):** tools fully disabled.
     - **Hybrid (recommended for your needs):** tools allowed, but enforce:
       1) no duplicate signatures (soft-stop),
       2) per-tool budget (e.g., allow only `read_file` after `list_files`),
       3) if a blocked duplicate happens, ignore it + inject refusal notice.
       NOTE2: let's just enforce 3

3. Disable tools entirely in this stage. NOTE: can you explain the reason as to why you decide to disable tools entirely in this stage?
   **Response:** The reason is to prevent the known DeepSeek failure mode where it sees tool results and then immediately issues another tool call anyway (looping). Disabling tools in Stage B makes the final answer deterministic. That said, for multi-step tasks, the hybrid approach above is often better.
4. Stream the final answer.

**Hard rule:**
- If the model emits tool_calls in Stage B anyway, ignore them and inject a refusal notice into the stream.

---

### F5) Auto-resume vs pause-after-tool
Two-stage can run in two modes:

- **Auto-resume** (recommended initial MVP):
  - Stage A executes tools, then server immediately runs Stage B.
- **Pause-after-tool** (future / optional):
  - Stage A stops after tool results; client must call resume.
  NOTE: stage B should be auto when the result is completed.
  **Response:** Agreed for MVP: Stage B auto-runs immediately after Stage A tool results are ready.

We should start with **auto-resume** for minimal UX change.

---

### F6) Resume endpoint (optional but aligns with 2-1-22)
Add:

- `POST /api/chat/messages_two_stage/resume`

Input:
- `{ requestId, toolBatchId }`

Server behavior:
- Rehydrates Stage A tool results and runs Stage B.

Benefits:
- Enables future UI controls: “pause after tool”, “manual approve tool results”, “stop/cancel”.
NOTE: this is somehting I want to implement, a stop/pause ability
**Response:** Yes — the two-stage + resume design is the right foundation for stop/pause. The pause point is naturally “after Stage A tool results”. Stop/cancel is easiest to implement by terminating the SSE connection and refusing any further resume for that `requestId`.

---

### F7) Persist tool outcomes (optional / phase 2)
Add DB persistence for tool outcomes keyed by:
- `(requestId, toolBatchId, toolCallId)`

Optionally link requestId to the streamed chat message row.

Benefits:
- Reliable resume across server restart
- Audit/replay
- Cross-turn tool result reuse (reduces repeated tools)

---
NOTE: maybe in the future.
**Response:** Agreed — it’s a good Phase 2. MVP can keep request-scoped tool outcomes in memory.

### F8) Trace enhancements
Keep existing trace events:
- `tool_registration`, `tool_call`, `tool_result`, `duplicate_tool_call`

Optionally add:
- `orchestration_phase_start`
- `orchestration_phase_end`
NOTE: separate into Stage A and Stage B?
**Response:** Yes. If we add these, we should include `details.phase = 'tool_phase' | 'action_phase'` (and include requestId/toolBatchId) so TraceDashboard can show stage boundaries clearly.

**Important:** All phases must share the same `requestId` so TraceDashboard correlates Stage A and Stage B.

---

## Keeping Current Soft-Stop Intact (Fallback)

- Leave `/api/chat/messages` unchanged.
- Keep ToolRunner as shared utility.
- Two-stage route is gated by `TWO_STAGE_ENABLED`.
- Frontend endpoint selection can be toggled (env or UI).

Rollback strategy:
- Disable env flag and/or switch frontend endpoint back.

---

## Implementation Plan (Phased)

### Phase 1 — Backend-only MVP (minimal risk)
1. Add `/api/chat/messages_two_stage` behind `TWO_STAGE_ENABLED`.
2. Implement Stage A:
   - detect tool calls
   - execute via ToolRunner
   - emit tool results
3. Implement Stage B:
   - second model call with tools disabled
   - inject tool results as system messages
   - stream final response
4. Add backend tests:
   - Stage A ends after first tool batch
   - Stage B produces final answer
   - soft-stop still works in Stage A

### Phase 2 — Optional UX/robustness
5. Add resume endpoint (`/resume`).
6. Persist tool outcomes to DB.
7. Add frontend toggle / config to choose orchestration route.

---

## Success Criteria

- Two-stage mode prevents “tool call spam” loops by construction (bounded Stage A, no tools in Stage B).
- ToolRunner soft-stop remains functional and unchanged.
- Default route continues to work exactly as before.
- Easy rollback: disable env flag and/or switch frontend endpoint back.

---

## Open Questions (for review)

1. Initial UX: **Auto-resume** vs **pause-after-tool**? NOTE: I like Auto-resume
   **Response:** Agree.
2. Stage A budget defaults: `TWO_STAGE_MAX_TOOLS = 1` or `2`? NOTE: 1
   **Response:** OK for loop control; but to support “list then read then summarize” in one turn, you’ll probably want 2. We can make it configurable per request.
3. Should Stage A ignore all free-form assistant text (tool-only), or allow partial natural language before tools? NOTE: allow partial before tools
   **Response:** Agree. We can stream partial explanation until a tool_call appears, then freeze Stage A and run the tool.
4. Do we allow any tools in Stage B (whitelist), or strictly none? NOTE: see my previous notes
   **Response:** Recommend **Stage B allowlist** (hybrid): allow only read-only tools needed for completion, block duplicates, and enforce a small tool budget.

---

## Notes / Why this helps DeepSeek
DeepSeek often re-calls tools repeatedly within a single streaming turn. Two-stage reduces the search space:
- The model can’t loop tools indefinitely because Stage A is bounded.
- The model can’t “decide to tool again” after seeing results because Stage B disables tools.

This is orchestration (controller policy), not model prompting.
