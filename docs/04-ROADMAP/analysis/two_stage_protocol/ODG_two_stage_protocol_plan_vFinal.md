# ODG (Observability & Debuggability Gate) — Triggered-Phase Protocol (vFinal)

**Spec under review:** `docs/design/two_stage_protocol_plan_vFinal.md`

**Reference protocol:** `.Docs/Protocols/Observability_Debuggability_Gate.md`

**Objective:** Apply ODG to the triggered-phase protocol and identify missing observability requirements, with mitigations.

> **Truthfulness rule:** If not verifiable from repo inspection, mark **NEED_Verification**.

---

## 1) Correlation Keys (ODG §1)

| Key | Required? | Where should it appear | Current status (repo) | Evidence | Verdict |
|---|---:|---|---|---|---|
| `requestId` | Yes | every trace event + server logs | Present in `/api/chat/messages` + ToolRunner | `backend/src/routes/chatMessages.js` generates requestId; ToolRunner logs requestId | ✅ VERIFIED_HAVE |
| `projectId` | Yes | every trace event | Present | trace events include projectId | ✅ VERIFIED_HAVE |
| `external_id` | Yes | trace details | Present in user_message/orion_response details | route logs external_id in details | ✅ VERIFIED_HAVE |
| `phaseIndex` | Yes (phased) | phase events + tool events | Not implemented | no code yet | ❌ MISSING (two-stage not built) |
| `cycleIndex` | Yes (cyclical) | phase events + tool events | Not implemented | no code yet | ❌ MISSING (two-stage not built) |

**Mitigation tasks:**
- Add `phaseIndex` and `cycleIndex` to:
  - orchestration phase start/end trace events
  - tool_call/tool_result events emitted during the two-stage route
  - optionally include in SSE event envelope for debugging

---

## 2) Required Trace Events (ODG §2)

| Event Type | Required? | Current status | Evidence | Verdict |
|---|---:|---|---|---|
| `user_message` | Yes | Exists | logged in chat route | ✅ VERIFIED_HAVE |
| `tool_registration` | Yes | Exists | logged in OrionAgent.processStreaming | ✅ VERIFIED_HAVE |
| `llm_call` / `llm_result` | Recommended | Unclear in streaming path | search not performed here | ⚠️ NEED_Verification |
| `tool_call` | Yes | Exists | ToolRunner logs tool_call | ✅ VERIFIED_HAVE |
| `tool_result` | Yes | Exists | ToolRunner logs tool_result | ✅ VERIFIED_HAVE |
| `duplicate_tool_call` | Yes | Exists | ToolRunner logs duplicate_tool_call | ✅ VERIFIED_HAVE |
| `system_error` | Yes | Exists | TraceEvent types include system_error | ✅ VERIFIED_HAVE |
| `orchestration_phase_start/end` | Recommended | Not present in TRACE_TYPES | `backend/src/services/trace/TraceEvent.js` lacks these types | ❌ MISSING (must add or map) |

**Mitigation tasks:**
- Decide: either
  1) extend `TRACE_TYPES` to include `orchestration_phase_start` and `orchestration_phase_end`, OR
  2) log these as existing allowed types (e.g., `llm_call`/`llm_result` or `tool_registration`) with `details.phase` fields.

---

## 3) Decision Logging (“Why”) (ODG §3)

| Decision | Must be visible? | Current status | Evidence | Verdict |
|---|---:|---|---|---|
| Plan-mode tool blocked | Yes | Implemented in OrionAgent | `processStreaming` blocks tool calls in PLAN | ✅ VERIFIED_HAVE (current route) |
| Duplicate blocked | Yes | Implemented in ToolRunner | duplicate_tool_call + DUPLICATE_BLOCKED result | ✅ VERIFIED_HAVE |
| Budget blocked | Yes | Not implemented | two-stage route not built | ❌ MISSING |
| Phase transitions | Yes | Not implemented | two-stage route not built | ❌ MISSING |

**Mitigation tasks:**
- In two-stage route, log explicit decisions:
  - “phase transition triggered by tool_call”
  - “budget reached: cycleIndex=X”
  - “duplicate ignored in action phase: signature=…”

---

## 4) UI Debug Surfaces (ODG §4)

| Surface | Required? | Current status | Evidence | Verdict |
|---|---:|---|---|---|
| TraceDashboard shows details JSON | Yes | Exists | `frontend/src/components/TraceDashboard.vue` | ✅ VERIFIED_HAVE |
| TraceDashboard filter by requestId | Recommended | Not present | no requestId filter UI | ⚠️ NEED_Verification (likely missing) |
| Chat UI show tool outputs toggle | Optional | Not present | ChatPanel doesn’t show raw tool results | ✅ OK (optional) |

**Mitigation tasks:**
- Add a basic requestId filter input to TraceDashboard (optional but high value).

---

## 5) Replay / Repro Path (ODG §5)

| Requirement | Current status | Evidence | Verdict |
|---|---|---|---|
| Retrieve prompt version | Partial | Orion prompt file path exists in context build | ⚠️ NEED_Verification (no hash) |
| Retrieve tool calls/results via trace | Yes | trace logs include tool_call/tool_result | ✅ VERIFIED_HAVE |
| Re-run a request deterministically | No | depends on filesystem/DB state | ⚠️ NEED_Verification |

**Mitigation tasks:**
- Add `promptFile` and optionally `promptHash` into trace details for llm_call.

---

## 6) ODG Verdict

**Verdict:** **CONDITIONAL**

Rationale:
- Base trace & tool logging exists.
- Two-stage-specific observability (phase events + phaseIndex/cycleIndex) is not yet implemented.
- TraceEvent type list currently blocks/complicates adding new phase event types.

**Minimum to PASS before making two-stage default:**
- Add phase correlation keys.
- Implement phase start/end trace logs (or mapping approach).
- Ensure budget/duplicate decisions are visible in trace.
