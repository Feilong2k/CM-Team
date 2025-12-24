# CAP (Constraint-Aware Planning) — Triggered-Phase Protocol (vFinal)

**Plan under review:** `docs/design/two_stage_protocol_plan_vFinal.md`

**Objective:** Translate PCC findings into a constraint-aware execution plan: define the concrete deliverables, sequencing, dependencies, and verification tests needed to implement the triggered-phase protocol safely.

> **Truthfulness rule:** If a dependency/tool/state cannot be confirmed from repo inspection, mark **NEED_Verification**.

---

## 1) CAP Summary (What we’re building)

### Primary deliverable
An **opt-in** backend route that runs a triggered-phase orchestration loop:
- `POST /api/chat/messages_two_stage`
- gated by `TWO_STAGE_ENABLED`
- retains existing `/api/chat/messages` unchanged as fallback

### Core constraints (from PCC)
- Streaming tool calls are partial; must merge and only execute when complete.
- Phase boundaries must not close SSE.
- Duplicate handling must inject system refusal messages.
- Budgets must be deterministic.

---

## 2) Deliverables

### D1. New route + config gating
- New Express handler: `POST /api/chat/messages_two_stage`
- Env flag: `TWO_STAGE_ENABLED` (default false)
- Behavior when disabled: return 404 or 501

**NEED_Verification:** current env management patterns for feature flags (no explicit `TWO_STAGE_ENABLED` exists today).

### D2. Orchestration module (recommended isolation)
Create a dedicated orchestrator (e.g., `backend/src/services/TwoStageOrchestrator.js`) responsible for:
- maintaining `phaseIndex`, `cycleIndex`, budgets
- running Action Phase streams
- detecting/merging tool calls
- executing Tool Phase (single tool)
- appending system messages
- yielding SSE events to StreamingService

### D3. Tool-call completeness and parsing policy
- Reuse/port `mergeToolCallsIntoMap` logic.
- Define “complete enough” tool call = `function.name` exists AND `function.arguments` is JSON-parseable.
- If never parseable before stream ends: treat as model error; inject system message and force final answer.

### D4. Duplicate policy (hard-stop for duplicates)
- Maintain per-request set: `blockedSignatures`.
- In Action Phase:
  - if tool signature ∈ blockedSignatures → do not execute; inject system refusal message; continue Action Phase.
- If signature not blocked → proceed to Tool Phase and then add signature to blocked set.

### D5. Budget policy
- `MAX_TOOLS_PER_TOOL_PHASE = 1` (locked)
- `MAX_PHASE_CYCLES_PER_TURN = 3` (locked)
- `MAX_DUPLICATE_ATTEMPTS_PER_TURN = 3` (recommended)

When budgets are exceeded:
- inject system message forcing final answer
- disable further tool execution for remainder of turn

### D6. SSE event schema additions
Add phase markers:
- `phase`: `tool_phase` | `action_phase` | `complete`
- `phaseIndex`
- `cycleIndex`

### D7. Trace instrumentation
Add trace events:
- `orchestration_phase_start`
- `orchestration_phase_end`

**NEED_Verification:** whether TraceEvent type registry constrains `type` values.

---

## 3) Sequencing / Dependencies

### 3.1 Recommended implementation order
1. Add route skeleton + env gating (D1).
2. Implement orchestrator skeleton that can run a single Action Phase call and stream chunks (D2).
3. Add tool-call detection + merging + “execute first tool only” (D3).
4. Add Tool Phase execution via existing ToolRunner (D2/D3).
5. Add system message tool-result injection (D2).
6. Add duplicate blocking (D4).
7. Add budgets + force-final-answer path (D5).
8. Add phase markers to SSE events (D6).
9. Add trace phase start/end events (D7).

### 3.2 Critical dependency edges
- D3 (tool-call completeness) must exist before D4/D5 are meaningful.
- D5 (budgets) is mandatory before enabling for real users.

---

## 4) Data Flow Map (High Level)

**User request** → `/api/chat/messages_two_stage` → Orchestrator loop:

1) Action Phase:
- sends messages to LLM adapter
- streams text
- may detect tool call

2) Tool Phase:
- execute tool via ToolRunner
- trace log tool_call/tool_result
- append TOOL RESULT as system message

3) Next Action Phase:
- re-call model with injected tool results

Final:
- StreamingService emits one `done`
- Persist final message to DB

---

## 5) Gaps & Mitigations (CAP output)

| Gap | Impact | Mitigation |
|---|---|---|
| No existing two-stage route | feature not present | implement D1 |
| Tool-call merging correctness | malformed tool calls | implement D3 and add targeted tests |
| Phase boundaries vs done semantics | premature persistence | enforce single done at end; reuse StreamingService rules |
| Trace type extensibility | missing observability | if TraceEvent enum is strict, extend it; else log generic event with details |

---

## 6) Verification Tests (must-have)

### Backend tests
1. **two_stage_route_gated**
- when `TWO_STAGE_ENABLED=false`, route returns 404/501.

2. **executes_only_first_tool_per_tool_phase**
- model emits 2 tool calls in one stream → only first executed.

3. **action_phase_to_tool_phase_transition**
- first non-duplicate tool call ends action phase and triggers tool phase.

4. **duplicate_ignored_in_action_phase**
- after tool executed once, model emits same tool call again → no tool execution, system refusal injected.

5. **budget_forces_final_answer**
- model emits 4 sequential tool calls → only 3 executed; final phase must answer without executing 4th.

6. **single_done_persists_once**
- ensure only one done emitted; DB persistence occurs once.

---

## 7) CAP Verdict

**Verdict:** **Proceedable with constraints**.

This is implementable and aligns with the repo’s existing streaming + ToolRunner architecture, but correctness hinges on tool-call merging, strict budgets, and refusal injection.
