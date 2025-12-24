# OSRG (Operational Safety & Rollback Gate) — Triggered-Phase Protocol (vFinal)

**Spec under review:** `docs/design/two_stage_protocol_plan_vFinal.md`

**Reference protocol:** `.Docs/Protocols/Operational_Safety_Rollback_Gate.md`

**Objective:** Apply OSRG to the triggered-phase protocol plan and identify operational risks, missing safeguards, and mitigations.

> **Truthfulness rule:** If not verifiable from repo inspection, mark **NEED_Verification**.

---

## 1) Feature Flagging (OSRG §1)

| Item | Required? | Current status | Evidence | Verdict |
|---|---:|---|---|---|
| Server-side flag `TWO_STAGE_ENABLED` | Yes | Not present | not in repo search | ❌ MISSING |
| Client-side switch (endpoint) | Yes | Present but hardcoded to `/api/chat/messages` | `frontend/src/components/ChatPanel.vue` sets endpoint = '/api/chat/messages' | ⚠️ NEED_Verification (needs toggle) |
| Default behavior unchanged | Yes | Achievable | existing route remains | ✅ VERIFIED_HAVE (current route exists) |

**Mitigation tasks:**
- Add env flag + route gating.
- Add frontend config/env switch to choose endpoint.

---

## 2) Kill Switch & Fast Rollback (OSRG §2)

| Requirement | Current status | Evidence | Verdict |
|---|---|---|---|
| Rollback path < 1 minute | Not formalized | no runbook | ⚠️ NEED_Verification |
| Fallback endpoint exists | Yes | `/api/chat/messages` | ✅ VERIFIED_HAVE |

**Mitigation tasks:**
- Create a short runbook:
  - set `TWO_STAGE_ENABLED=false`
  - deploy/restart
  - switch frontend endpoint back

---

## 3) Blast Radius Control (OSRG §3)

| Control | Required? | Current status | Verdict |
|---|---:|---|---|
| Scope by project | Recommended | Not specified | NEED_Verification |
| Scope by user | Optional | Not specified | NEED_Verification |
| Rate limiting | Recommended | Not specified | NEED_Verification |
| Budget enforcement | Required | Specified in plan | ✅ DESIGN_HAVE / NEED_Verification (implementation pending) |

**Mitigation tasks:**
- Implement `MAX_PHASE_CYCLES_PER_TURN` and `MAX_DUPLICATE_ATTEMPTS_PER_TURN` as hard caps.
- Consider enabling only for `projectId=P1` initially.

---

## 4) Failure Detection & Stop Criteria (OSRG §4)

| Signal | Threshold | Measurable today? | Evidence | Verdict |
|---|---|---:|---|---|
| duplicate_tool_call frequency | >N per requestId | Yes | trace events exist | ✅ VERIFIED_HAVE |
| latency p95 | >X seconds | Unclear | no metrics pipeline noted | ⚠️ NEED_Verification |
| error rate system_error | >Y% | Partially | system_error type exists | ⚠️ NEED_Verification |
| user-visible failures | manual | No | no automatic detection | NEED_Verification |

**Mitigation tasks:**
- Use TraceDashboard to monitor:
  - tool_call count per requestId
  - duplicate_tool_call events
  - total turn duration (NEED_Verification: may require adding duration)
- Add turn duration to `orion_response` details (optional).

---

## 5) Data Safety (OSRG §5)

| Safety concern | Current status | Evidence | Verdict |
|---|---|---|---|
| PLAN mode blocks write tools | Yes in current OrionAgent | whitelist exists | ✅ VERIFIED_HAVE |
| Two-stage route preserves PLAN policy | Unknown | route not built | NEED_Verification |
| Secrets redaction in trace | Weak | redactDetails is stubbed (`return details as is`) | ❌ HIGH RISK / VERIFIED_HAVE (stub) |

**Mitigation tasks (high priority):**
- Implement real redaction in `redactDetails()` or at TraceService level.
- Ensure tool params/results do not leak secrets.

---

## 6) Ownership (OSRG §6)

| Activity | Owner | Current status | Verdict |
|---|---|---|---|
| Enable feature flag | Operator | not specified | NEED_Verification |
| Monitor rollout | Operator/Dev | not specified | NEED_Verification |
| Decide rollback | Lead | not specified | NEED_Verification |

**Mitigation tasks:**
- Assign a minimal rollout owner (even if it’s just “Lei for MVP”).

---

## 7) OSRG Verdict

**Verdict:** **CONDITIONAL / HIGH RISK UNTIL REDACTION IS FIXED**

Rationale:
- Rollback path exists conceptually (keep old route), but it’s not formalized.
- Feature flag and frontend switching are not implemented.
- **Trace redaction is currently stubbed**, which is a real operational risk if we increase trace verbosity during orchestration.

**Minimum to PASS before defaulting to two-stage:**
- Add `TWO_STAGE_ENABLED` gate.
- Add frontend endpoint toggle.
- Implement trace redaction.
- Define rollback runbook.
