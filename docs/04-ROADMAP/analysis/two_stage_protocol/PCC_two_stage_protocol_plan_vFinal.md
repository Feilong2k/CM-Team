# PCC (Preflight Constraint Check) — Triggered-Phase Protocol (vFinal)

**Plan under review:** `docs/design/two_stage_protocol_plan_vFinal.md`

**Objective:** Identify concrete physical/tooling constraints that will impact implementing the triggered-phase (A/B cycling) orchestration, highlight gaps, and propose mitigations.

> **Truthfulness rule:** Any statement about current code/runtime/config that I cannot verify from repo inspection is marked **NEED_Verification**.

---

## 0) Preflight Summary

### Proposed behavior (design intent)
- New route: `POST /api/chat/messages_two_stage` (feature-flagged).
- Orchestration is a **cycle**: `A1 → B1 → A2 → B2 → … → Final Answer`.
- Tool Phase executes **at most 1** tool call.
- Action Phase may emit a new (non-duplicate) tool call → triggers next Tool Phase.
- Duplicate tool calls are blocked by canonical signature; in Action Phase they are **ignored** and replaced with a **system refusal message**.
- Budgets: `MAX_TOOLS_PER_TOOL_PHASE = 1`, `MAX_PHASE_CYCLES_PER_TURN = 3`, and a duplicate-attempt threshold.

### Current system reality (verified)
- Existing route: `POST /api/chat/messages` exists and uses SSE streaming. ✅ Verified (`backend/src/routes/chatMessages.js`).
- Streaming pipeline exists: `OrionAgent.processStreaming()` + `StreamingService`. ✅ Verified (`backend/src/agents/OrionAgent.js`, `backend/src/services/StreamingService.js`).
- ToolRunner exists and includes canonical signatures + duplicate/soft-stop tracking. ✅ Verified (`backend/tools/ToolRunner.js`).
- TraceService exists and is used by chat route and ToolRunner. ✅ Verified (`backend/src/services/trace/TraceService.js`).
- **Two-stage route does not currently exist**. ✅ Verified (repo search for `messages_two_stage|two_stage` in `backend/src` returned 0 matches).

---

## 1) Atomic Actions (must succeed end-to-end)

1. **route_receive_two_stage_request** — Express receives POST `/api/chat/messages_two_stage`.
2. **derive_project_and_request_id** — derive `projectId` and create/propagate a unique `requestId` for the entire user turn.
3. **start_orchestration_cycle** — initialize budgets/counters: `cycleIndex`, `phaseIndex`, max cycles.
4. **run_action_phase_stream** — call model streaming and forward normal chunks.
5. **detect_first_complete_tool_call** — detect tool call(s) in stream; merge partial deltas until the first call is “complete enough”.
6. **terminate_action_phase_on_tool_call** — stop consuming output for that phase (without terminating the SSE connection).
7. **execute_tool_phase_single_call** — execute the first tool call via ToolRunner.
8. **trace_tool_call_and_result** — ensure `tool_call`, `tool_result`, and any duplicate events are logged.
9. **inject_tool_result_system_message** — append TOOL RESULT (or TOOL ERROR) to messages as `role: system` for next phase.
10. **resume_action_phase** — re-call model with updated messages.
11. **block_duplicates_in_action_phase** — if signature repeated, do not execute; inject refusal as **system message**.
12. **enforce_budgets** — if max cycles exceeded, force final answer.
13. **persist_final_message** — persist full content once at end of turn.
14. **emit_done_and_close_sse** — send one final `done` and close SSE.

---

## 2) Resources Touched

| Resource | Access | Where | Current state | Verification |
|---|---:|---|---|---|
| Express router | Write (add route) | Action 1 | EXISTS | ✅ Verified |
| `chatMessages.js` route module | Write | Actions 1–2 | EXISTS | ✅ Verified |
| OrionAgent streaming logic | Read/Extend/Wrap | Actions 4–11 | EXISTS | ✅ Verified |
| StreamingService | Read/Extend | Actions 4, 14 | EXISTS | ✅ Verified |
| ToolRunner | Read/Use | Actions 7, 11 | EXISTS | ✅ Verified |
| TraceService | Write | Actions 8 (+phase events) | EXISTS | ✅ Verified |
| DB `chat_messages` | Write | Action 13 | EXISTS (in use today) | ✅ Verified by usage |
| Env flag `TWO_STAGE_ENABLED` | Read | Action 1 | NOT SEEN | **NEED_Verification** (not yet added) |
| Frontend endpoint toggle | Read/Write | rollout | NOT IN SCOPE | **NEED_Verification** |

---

## 3) Physical Constraints, Risks, Mitigations

### 3.1 Tool-call completeness detection
- **Constraint:** streaming tool calls arrive as partial deltas; arguments may be incomplete.
- **Risk:** executing with incomplete/invalid JSON args → tool failure or wrong params.
- **Mitigation:**
  - Reuse the existing merge strategy (`mergeToolCallsIntoMap` concept) from `OrionAgent.processStreaming()`.
  - Only execute when `function.name` exists AND `function.arguments` is JSON-parseable.
  - If not parseable, keep consuming until parseable or end-of-stream.

### 3.2 Ending a “phase” without ending SSE
- **Constraint:** the design needs to stop a phase while keeping the client stream open.
- **Risk:** if we close SSE to end a phase, we cannot perform A/B cycling in one user turn.
- **Mitigation:** implement phases server-side only; SSE is continuous for the entire turn. Emit phase markers as SSE events.

### 3.3 Duplicate semantics: “ignore + refusal” vs ToolRunner `DUPLICATE_BLOCKED`
- **Constraint:** ToolRunner currently returns `DUPLICATE_BLOCKED` results (structured error).
- **Risk:** if Action Phase forwards that error payload as a tool result box, the model may retry anyway.
- **Mitigation:** detect duplicates **before** calling ToolRunner in Action Phase and inject a **system refusal** message that explicitly forbids retrying.

### 3.4 Budget enforcement
- **Constraint:** without strict limits, cycling becomes another infinite loop.
- **Mitigation:** enforce:
  - `MAX_TOOLS_PER_TOOL_PHASE = 1`
  - `MAX_PHASE_CYCLES_PER_TURN = 3`
  - `MAX_DUPLICATE_ATTEMPTS_PER_TURN` (e.g., 3)

### 3.5 UI visibility vs observability
- **Constraint:** you do not want raw tool outputs in the chat UI.
- **Risk:** debugging becomes harder.
- **Mitigation:** do not emit tool payloads as chat chunks; rely on TraceDashboard for raw tool results; optionally add UI toggle later.

### 3.6 Persisting full message exactly once
- **Constraint:** current `StreamingService` persists on a single `done`.
- **Risk:** phase markers or mid-stream `done` could cause premature persistence.
- **Mitigation:** only emit one final `done` at end of entire turn, preserving existing “persist once” semantics.

### 3.7 Feature flag gating
- **Constraint:** new route must be safe to deploy without breaking existing clients.
- **Mitigation:** gate `/messages_two_stage` behind `TWO_STAGE_ENABLED`, return 404/501 when disabled.

---

## 4) Gaps & Ambiguities (must be addressed)

| Gap | Why it matters | Mitigation |
|---|---|---|
| Where does the new orchestration logic live? | risk of entangling OrionAgent streaming loop | Create a dedicated orchestrator module used only by the two-stage route. |
| Definition of “complete tool call” | correctness | Require JSON-parseable args; define fallback behavior if stream ends before parseable. |
| PLAN vs ACT tool policy in new route | policy mismatch | Mirror current PLAN whitelist behavior from OrionAgent. |
| Tool error handling | can trigger loops | Count tool failures toward cycle budget; inject system message directing next step. |
| Trace “phase start/end” event types | observability | Add new trace types or log as generic events with `details.phaseIndex/cycleIndex`. **NEED_Verification**: existing TraceEvent enum supports custom strings? |

---

## 5) PCC Verdict

**Verdict:** **CONDITIONALLY SAFE**.

This plan is implementable, but only if we treat streaming tool-call merging, phase boundaries, and strict budgets as first-class constraints.

---

## 6) Verification Checklist (implementation-time)

- [ ] Two-stage route exists and is gated by `TWO_STAGE_ENABLED`.
- [ ] All phases share one `requestId` per user turn.
- [ ] First complete tool call triggers Tool Phase.
- [ ] Tool Phase executes exactly one tool call.
- [ ] Duplicate tool attempts in Action Phase are ignored and refused via **system message**, without tool execution.
- [ ] Cycle budget forces a final answer.
- [ ] Only one final `done` per user turn; persistence occurs once.
