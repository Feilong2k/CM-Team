# Two-Stage Protocol Plan (v1.1) — Orion Orchestration

> **Purpose:** Introduce an opt-in two-stage orchestration pipeline (Stage A: Tool Phase → Stage B: Action Phase) to reduce DeepSeek tool-looping and enforce deterministic stopping conditions, while keeping the current unified streaming + soft-stop behavior intact as a fallback.

> **Decision (rollout):** During testing we will switch the UI default to the two-stage route. The current unified streaming route remains available as an immediate fallback.

---

## 1) Goals

1. Stop tool-call spam/loops during a single user turn (common with DeepSeek).
2. Preserve a safe fallback path (current unified route + existing soft-stop).
3. Make it easy to switch defaults during testing, and easy to roll back.

---

## 2) Non-Goals (for v1.1)

- No questionnaire/adapters per tool (future).
- No DB persistence of tool outcomes (future).
- No A/B/A/B bouncing between phases (keep it 2-phase only).
NOTE: Not necessaryily 2 pahse anymore, it's more like triggered phases. current phase B allows non-duplicate tool call, so when a tool call happens in Phase B, it is treated like a new phase A, it gets stopped. and a new phase B starts with the results passed over and so on until the chain of tools is ended. Let me know if this too complicated.

---

## 3) Key Definitions (clarified)

### 3.1 ToolRunner
ToolRunner is the server-side tool executor that:
- parses LLM `tool_call` payloads
- finds the correct tool function (FileSystemTool, DatabaseTool, etc.)
- executes it with `{ ...params, context }`
- returns a structured result (success or error)

### 3.2 Canonical Signature
A canonical signature is a stable “fingerprint” of a tool call:

`signature = toolName + action + normalizedArgs + projectId`

It exists so the server can reliably detect when the model is repeating the same tool call (even if argument key order differs).

**Decision (v1.1):** In the two-stage route we will *not rely on soft-stop as the primary defense* (because Stage A will terminate immediately upon tool call detection). We keep soft-stop available (shared ToolRunner) as a secondary guardrail.
NOTE: Soft-stop now acts as a hard-stop in Phase B, ingores and inject with system message

---

## 4) High-Level Protocol (v1.1)

### Stage A — Tool Phase (bounded)
- LLM streams.
- As soon as we detect the first complete tool call, we stop Stage A.
- Execute only the **first** tool call.
- Ignore any subsequent tool calls that appear in that same stream.
- Emit tool result(s) to:
  1) the **client UI** (SSE) NOTE: I'm not so sure I want to see the raw results, as long as it is logged in the trace and passed on in Stage B, I don't need to see it.
  2) Stage B as a **system message/tool result injection**.

### Stage B — Action Phase (answer + controlled tools)
- Start a fresh LLM call.
- Inject Stage A tool result as system message(s).
- Stage B produces the final answer.

**Decision (v1.1):** Stage B will **not** disable all tools. Instead we enforce:
- If the model attempts a **duplicate** tool call (same signature as Stage A or a blocked signature), we **ignore the tool call** and inject a refusal notice into the stream.NOTE: Make sure it is system message.

This aligns with your NOTE2 decision: “let’s just enforce (3)”.

---

## 5) API / Routing (keeping fallback intact)

### 5.1 Existing route (fallback)
- `POST /api/chat/messages`
  - Current unified streaming + ToolRunner behavior
  - Remains unchanged

### 5.2 New route (two-stage)
- `POST /api/chat/messages_two_stage`

**Feature flag:**
- `TWO_STAGE_ENABLED=false` by default

**Testing default switch:**
- Frontend can be configured to call the two-stage route by default during testing.
- Fallback is a single config change back to `/api/chat/messages`.

---

## 6) Stage A — Detailed Behavior

### 6.1 Streaming policy
- Allow partial natural-language content **before** the first tool call.
- Once tool call is detected:
  - stop consuming the upstream tool_call stream beyond what’s required to assemble the first call
  - close Stage A (end phase)

### 6.2 Tool execution policy
- Execute the first tool call only.
- Ignore remaining tool calls from the same Stage A stream.

**Decision (v1.1):**
- `TWO_STAGE_MAX_TOOLS = 1`

### 6.3 Why “tool spam” can still exist even if we stop on first tool call
DeepSeek can emit multiple tool-call deltas quickly (or repeatedly) before the orchestrator stops. Stage A must be coded defensively:
- “first complete tool call wins”
- ignore subsequent tool calls in the same stage

### 6.4 Tool results destination (“client” clarification)
- **Client** means the frontend UI (you). NOTE: see my previous note, I don't need to see the raw results, just needed it in trace.
- Tool results are also injected back to Orion in Stage B via system messages.

---

## 7) Stage B — Detailed Behavior

### 7.1 Are tool results currently sent as System Messages?
Yes — the current unified pipeline already injects tool results as `role: 'system'` message blocks (the “TOOL RESULT box”).

Two-stage Stage B will follow the same concept:
- initial system prompt
- appended system messages containing tool results (and any refusal notices)

### 7.2 Tool policy in Stage B (v1.1 decision)
Stage B allows tools, BUT:
- If a tool call is a duplicate of an already-executed signature (from Stage A) or otherwise blocked, then:
  - do not execute
  - inject refusal notice
  - proceed with reasoning

(We can optionally add budgets later if needed.)

---

## 8) SSE Phase Metadata

Each SSE event includes:
- `phase`: `tool_phase` | `action_phase` | `complete`
- `requestId`
- `projectId`
- `toolBatchId`: `1` for Stage A, `2` for Stage B NOTE: this may need to be changed if B has a tool call as well, for stages that sends a result and has a tool call, it can be 3

We will not support going back and forth between phases in v1.1.

---

## 9) Pause/Stop/Resume (planned, not in v1.1 MVP)

### 9.1 Pause / Resume endpoint
- `POST /api/chat/messages_two_stage/resume`
- Input: `{ requestId, toolBatchId }`

**Decision:** Desired feature (pause/stop) but can be Phase 2.

### 9.2 Stop/Cancel
- Stop SSE by ending the connection.
- For true cancel, also prevent subsequent resume for that `requestId`.

---

## 10) Trace Enhancements

Keep existing trace events:
- `tool_registration`, `tool_call`, `tool_result`, `duplicate_tool_call`

Optional (recommended) additions:
- `orchestration_phase_start` with `details.phase = tool_phase|action_phase`
- `orchestration_phase_end` with `details.phase = tool_phase|action_phase`

---

## 11) Implementation Plan

### Phase 1 — Backend-only MVP (v1.1)
1. Implement `POST /api/chat/messages_two_stage` behind `TWO_STAGE_ENABLED`.
2. Stage A:
   - stream until first complete tool call
   - execute only first tool call
   - ignore remaining tool calls
   - emit tool result event(s)
3. Stage B:
   - fresh LLM call
   - inject tool result box as system message
   - allow tools, but ignore blocked duplicates + inject refusal notices
4. Tests:
   - two-stage route stops Stage A after first tool call
   - tool executed once
   - Stage B gets tool result injected
   - duplicate tool calls in Stage B are ignored (not executed)

### Phase 2 — Optional
- resume endpoint
- pause/stop UI wiring
- DB persistence of tool outcomes

---

## 12) Success Criteria

- Stage A executes at most **one** tool call.
- Repeated tool calls in the same turn do not trigger repeated executions.
- Tool results and errors are reliably injected into Stage B.
- The old route remains usable as immediate fallback.

---

## 13) Open Items to Confirm

1. Should Stage B allow *any* tool calls that are not duplicates, or should it be allowlisted (read-only only)?
2. Should we add a Stage B tool budget (e.g., max 1 tool call) as an extra anti-loop guard?
