# Two-Stage / Triggered-Phase Protocol (vFinal) — Orion Orchestration

> **Purpose:** Provide a robust orchestration protocol that prevents DeepSeek tool-looping while still supporting chained tools (e.g., `list_files → read_file → summarize`).
>
> This protocol keeps the **current unified streaming route** intact as an immediate fallback.

> **Rollout decision:** During testing, make the new protocol the default route in the UI. Keep the current unified streaming + existing soft-stop as a backup path that can be toggled back instantly.

---

## 1) Goals

1. Stop tool-call spam/loops during a single user turn (common with DeepSeek).
2. Support **chained tool usage** without allowing infinite loops.
3. Preserve a safe fallback path (current unified route + existing tooling).
4. Ensure we can later add pause/stop/resume.

---

## 2) Non-Goals (for vFinal MVP)

- Questionnaire/adapters per tool (future).
- DB persistence of tool outcomes (future).
- Complex multi-agent workflows (future).

---

## 3) Key Definitions

### 3.1 ToolRunner
ToolRunner is the server-side executor that:
- parses LLM `tool_call` payloads
- finds the correct tool function (FileSystemTool, DatabaseTool, etc.)
- executes it with `{ ...params, context }`
- returns a structured result

### 3.2 Canonical Signature
A canonical signature is a stable fingerprint of a tool call:

`signature = toolName + action + normalizedArgs + projectId`

It exists so we can detect semantic duplicates even if argument ordering differs.

### 3.3 Soft-stop usage in this protocol
**Decision:** Soft-stop becomes a **hard-stop only for duplicates**:
- In Action Phase, if the model attempts a duplicate signature, we do **not execute** and we inject a **system message refusal notice**.
- Non-duplicate tool calls are allowed (subject to tool/cycle budgets below).

---

## 4) Protocol Overview (Triggered Phases)

This is no longer strictly “2 phases once”. It is a **cycle**:

- **Tool Phase (A):** run at most one tool call, then stop.
- **Action Phase (B):** the model reasons using results; if it emits a new (non-duplicate) tool call, we immediately start a new Tool Phase.

So the protocol is:

`A1 → B1 → A2 → B2 → … → Final Answer`

### Why this is not “too complicated”
It’s a controlled state machine with strict budgets, and it matches how real multi-step tasks work (find file → read file → summarize).

---

## 5) Tool Phase (A) — Behavior

### A.1 Streaming policy
- Allow partial natural-language content **before** the first complete tool call.
- As soon as we detect the first complete tool call:
  - stop consuming further upstream output for this phase
  - execute that tool call

### A.2 Tool execution policy
**Decision:** Execute only the first tool call for the phase.
- Ignore any additional tool calls emitted in the same stream.

### A.3 Client output policy (UI)
**Decision:** Do **not** show raw tool outputs in the Chat UI by default.
- Tool outputs must still be:
  1) logged to **Trace**
  2) injected into the next Action Phase as **system messages**

Optional (later): a UI toggle like “Show tool outputs”.

---

## 6) Action Phase (B) — Behavior

### B.1 Tool-result injection
Tool results (or tool errors) are injected as **system messages** appended after the initial system prompt.

### B.2 Tool policy in B
**Decision:** Tools are allowed in Action Phase **only if non-duplicate**.
- If the model emits a tool call:
  - compute signature
  - if signature is a duplicate (already executed in this request / blocked set):
    - do not execute
    - inject a **system message refusal notice**
    - continue the same Action Phase
  - else:
    - end the current Action Phase and start a new Tool Phase (next cycle)

---

## 7) Budgets / Stopping Conditions (hard guardrails)

These are critical to prevent looping.

### 7.1 Tool budget per Tool Phase
**Decision:** `MAX_TOOLS_PER_TOOL_PHASE = 1`

### 7.2 Cycle budget per user turn
**Decision (recommended default):** `MAX_PHASE_CYCLES_PER_TURN = 3`

Meaning we allow:
- at most 3 tool executions in a single user turn (A1, A2, A3)

If exceeded:
- stop allowing new tools
- inject a system message: “Tool budget reached; answer using existing results.”

### 7.3 Duplicate handling
Duplicates do not consume tool budget (because we don’t execute), but they can still cause churn.
So additionally:
- if we see duplicate attempts > N (e.g., 3) in a single turn, force final answer.

---

## 8) API / Routing (fallback intact)

### 8.1 Existing route (fallback)
- `POST /api/chat/messages`
  - current unified streaming behavior
  - remains unchanged

### 8.2 New route (triggered-phase protocol)
- `POST /api/chat/messages_two_stage`

**Feature flag:**
- `TWO_STAGE_ENABLED=false` by default

**Testing default switch:**
- Frontend calls the new route by default during testing.
- One config flip falls back to `/api/chat/messages`.

---

## 9) SSE Phase Metadata

Every SSE event includes:
- `phase`: `tool_phase` | `action_phase` | `complete`
- `requestId`
- `projectId`
- `phaseIndex`: integer incrementing each phase (1..N)
- `cycleIndex`: integer incrementing each tool cycle (1..MAX_PHASE_CYCLES_PER_TURN)

**Decision:** Replace `toolBatchId` with `phaseIndex` + `cycleIndex` (simpler for A/B/A/B behavior).

---

## 10) Trace Enhancements

Keep existing trace events:
- `tool_registration`, `tool_call`, `tool_result`, `duplicate_tool_call`

Add (recommended):
- `orchestration_phase_start` with details `{ phase, phaseIndex, cycleIndex }`
- `orchestration_phase_end` with details `{ phase, phaseIndex, cycleIndex, reason }`

---

## 11) Pause / Stop / Resume (Phase 2)

### 11.1 Resume endpoint
- `POST /api/chat/messages_two_stage/resume`
- Input: `{ requestId, resumeFromPhaseIndex }`

### 11.2 Pause point
Natural pause point = immediately after Tool Phase tool_result is emitted and logged.

### 11.3 Stop/Cancel
- Stop SSE by ending the connection.
- Prevent resume by marking requestId “cancelled”.

---

## 12) Implementation Plan (Phased)

### Phase 1 — Backend MVP
1. Implement `POST /api/chat/messages_two_stage` behind `TWO_STAGE_ENABLED`.
2. Implement the triggered-phase loop:
   - Action Phase streams
   - On non-duplicate tool call: run Tool Phase (execute 1 tool)
   - Inject tool result as system message
   - Return to Action Phase
   - Enforce cycle budget
3. Ensure:
   - tool outputs are not shown raw in UI by default
   - trace logging contains everything

### Phase 2 — UX control
4. Implement resume endpoint
5. Implement pause/stop UI

---

## 13) Success Criteria

- Orion can complete common multi-step tasks (e.g., summarize a roadmap doc) without tool spam.
- Duplicate tool calls in Action Phase are ignored and refused via **system message**.
- The system terminates deterministically when budgets are hit.
- Old route remains usable as fallback.

---

## 14) Locked Decisions (summary)

- New protocol is **triggered phases** (A/B repeated) with hard budgets.
- Tool Phase executes **one tool call only**.
- Action Phase allows **non-duplicate** tools; duplicates are ignored + refused via **system message**.
- Do not show raw tool output in Chat UI by default (trace-only + injected to model).
- Add `phaseIndex/cycleIndex` metadata.
