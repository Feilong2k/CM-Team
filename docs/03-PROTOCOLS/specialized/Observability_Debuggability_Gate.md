# Observability & Debuggability Gate (ODG)

## Purpose
Ensure a feature/system is **debuggable in production-like conditions**. For AI orchestration work (streaming + tool calls), correctness is not enough — we need fast diagnosis when the model loops, stalls, or misuses tools.

**Definition:** If an incident happens, an engineer should be able to answer **"what happened and why" within 2 minutes** using logs/trace.

---

## 1) Required Correlation Keys

| Key | Required? | Where must it appear | Notes |
|---|---:|---|---|
| `requestId` | Yes | every trace event + server logs | one user turn = one requestId |
| `projectId` | Yes | every trace event | already in TraceEvent |
| `external_id` | Yes | trace details | ties to chat thread |
| `phaseIndex` | Yes (if phased) | every phase event + tool events | increments per phase |
| `cycleIndex` | Yes (if cyclical) | every phase event + tool events | increments per tool cycle |

**NEED_Verification rule:** if you can’t prove these keys are emitted, mark as NEED_Verification and create an implementation task.

---

## 2) Required Trace Events

| Event Type | When emitted | Must include in details |
|---|---|---|
| `user_message` | on user input | requestId, external_id, mode |
| `tool_registration` | at start of streaming session | tool names |
| `llm_call` | before calling LLM | model, provider, phaseIndex/cycleIndex |
| `llm_result` | after LLM completes | token usage if available |
| `tool_call` | before tool execution | toolName, canonicalSignature, params summary |
| `tool_result` | after tool execution | success/fail, duration_ms, result preview |
| `duplicate_tool_call` | when duplicate detected | signature, reason |
| `system_error` | any exception | stack in dev, sanitized in prod |
| `orchestration_phase_start` | beginning of phase | phase, phaseIndex, cycleIndex |
| `orchestration_phase_end` | end of phase | phase, phaseIndex, cycleIndex, reason |

**Note:** If your Trace schema restricts event types, update it or map these to allowed types with fields.

---

## 3) Required Decision Logging (the “why”)

You must be able to see *why* the controller made a decision.

| Decision | Must be logged as | Minimum details |
|---|---|---|
| Tool blocked (plan mode) | trace event or tool_result | mode, allowlist rule |
| Tool blocked (duplicate) | `duplicate_tool_call` + system refusal | signature, cooldown, previous timestamp |
| Tool blocked (budget) | phase_end + system message | budget type, counters |
| Phase transition triggered | phase_end + phase_start | trigger: tool_call / done / budget |

---

## 4) UI Debug Surfaces

Minimum requirements:
- TraceDashboard can filter by `requestId`.
- TraceDashboard shows event `details` JSON.

Optional:
- “Show tool outputs” toggle in Chat UI.
- “Copy debug bundle” button (exports requestId + trace events).

---

## 5) Replay / Repro Path

A minimal manual replay should be possible:
- Given `requestId`, you can retrieve:
  - system prompt version (hash or file path)
  - user message
  - tool calls + tool results
  - model provider + model name

**If replay depends on external state (filesystem, DB), note it explicitly.**

---

## 6) Gate Verdict

- **PASS**: All required keys + events exist, decisions are logged, and UI can inspect details.
- **CONDITIONAL**: Missing some non-critical observability; must add before enabling by default.
- **FAIL**: Cannot explain phase transitions / tool blocks / loops from trace.
