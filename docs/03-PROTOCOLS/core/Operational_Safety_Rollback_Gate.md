# Operational Safety & Rollback Gate (OSRG)

## Purpose
Ensure a feature can be deployed and operated safely:
- It can be enabled gradually.
- It has a fast rollback.
- It has clear failure detection and stop criteria.

---

## 1) Feature Flagging

| Item | Required? | Notes |
|---|---:|---|
| Server-side flag (env/config) | Yes | e.g. `TWO_STAGE_ENABLED=false` |
| Client-side switch | Yes | endpoint switch or header flag |
| Default behavior unchanged | Yes | fallback path must remain |

---

## 2) Kill Switch & Fast Rollback

Define the rollback path that takes < 1 minute:
- Disable feature flag and restart service (or hot reload if supported).
- Switch client back to fallback endpoint.

**Deliverable:** 1-page runbook: “How to turn it off fast”.

---

## 3) Blast Radius Control

| Control | Required? | Examples |
|---|---:|---|
| Scope by project | Recommended | enable only for projectId=P1 |
| Scope by user | Optional | enable for admin only |
| Rate limiting | Recommended | cap requests/min |
| Budget enforcement | Required (AI orchestration) | cap cycles, tool calls |

---

## 4) Failure Detection & Stop Criteria

Define measurable criteria that trigger disabling:

| Signal | Threshold | Action |
|---|---|---|
| Tool spam | >N duplicate_tool_call per requestId | disable two-stage for that request |
| Latency | p95 > X seconds | disable feature flag |
| Error rate | >Y% system_error | rollback |
| User-visible failures | repeated incomplete responses | rollback |

**NEED_Verification:** If you cannot measure a signal, mark NEED_Verification and add instrumentation tasks.

---

## 5) Data Safety

- Ensure no destructive operations can occur in PLAN mode.
- Ensure tool execution is audited in trace.
- Ensure secrets are not logged (redaction policy).

---

## 6) Operational Ownership

| Activity | Owner | When |
|---|---|---|
| Enable flag | Operator | deploy |
| Monitor trace/metrics | Operator/Dev | rollout |
| Decide rollback | Operator/Lead | incident |
| Update runbook | Devon/Orion | after learnings |

---

## 7) Gate Verdict

- **PASS**: feature flag + rollback path + stop criteria + ownership defined.
- **CONDITIONAL**: rollback exists but stop criteria/ownership incomplete.
- **FAIL**: cannot rollback quickly or cannot detect failure.
