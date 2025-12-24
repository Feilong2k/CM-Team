# RED v2 (Recursive Execution Decomposition) — Triggered-Phase Protocol (vFinal)

**Plan under review:** `docs/design/two_stage_protocol_plan_vFinal.md`

**Objective:** Perform a comprehensive RED v2 audit on the triggered-phase protocol plan, decomposing it into atomic primitives and auditing tools/inputs/outputs with strict truthfulness.

> **Truthfulness / verification policy:**
> - If I cannot confirm an item via repo inspection (or a concrete reproducible check), I mark it **NEED_Verification**.
> - I only mark VERIFIED_HAVE when there is direct evidence in the repository or an explicitly-run check.

---

## Layer 0 — Source of Truth Audit (Design vs Current Reality)

### Design-level claims in the plan
- Add `POST /api/chat/messages_two_stage` with feature flag `TWO_STAGE_ENABLED`.
- Implement A/B cycling phases with budgets.
- Block duplicates by canonical signature; inject system refusal.
- Do not show raw tool output in chat UI (trace-only + injected to model).
- Add `phaseIndex/cycleIndex` to SSE and optional phase start/end trace events.

### Current reality (repo)
| Claim | Current reality | Status |
|---|---|---|
| Two-stage route exists | Not found in `backend/src` | VERIFIED_MISSING (search) |
| Feature flag `TWO_STAGE_ENABLED` exists | Not found in repo search | NEED_Verification (likely missing) |
| Existing streaming route exists | `/api/chat/messages` implemented | VERIFIED_HAVE |
| Streaming pipeline robust to delayed done | StreamingService delays done until end | VERIFIED_HAVE |
| ToolRunner canonical signatures exist | ToolRunner has signature normalization | VERIFIED_HAVE |
| Duplicate block behavior exists | ToolRunner emits DUPLICATE_BLOCKED results | VERIFIED_HAVE |
| Orion receives tool results as system messages today | In unified pipeline, tool results are boxed and appended as `role: system` | VERIFIED_HAVE |

---

## Layer 0.5 — Operationalization Audit (Ownership / When / Where)

| Output / Artifact | Consumer | When | Where | Trigger | Safety |
|---|---|---|---|---|---|
| New route `/api/chat/messages_two_stage` | Frontend UI / operators | runtime | dev/prod | HTTP call | Must be gated by env flag |
| Orchestrator module | backend runtime | runtime | dev/prod | called by route | Must not affect legacy route |
| Phase markers in SSE | frontend UI | runtime | dev/prod | streaming | Must not break existing SSE parser |
| Phase trace events | TraceDashboard | runtime | dev/prod | trace logging | must not log secrets |

**NEED_Verification:** frontend SSE event parsing tolerance for new fields (`phaseIndex`, etc.).

---

## Layer 1 — System Goal
**Implement triggered-phase orchestration to prevent DeepSeek tool loops while supporting tool chains.**

---

## Layer 2 — Operations (Top-Level Tasks)

1. Add new two-stage route (opt-in) and gating.
2. Implement triggered-phase orchestrator loop.
3. Integrate tool call merging/detection.
4. Integrate ToolRunner tool execution.
5. Implement duplicate detection and refusal injection.
6. Implement cycle budgets.
7. Ensure final persistence semantics remain correct.
8. Add trace instrumentation (optional).

---

## Layer 3/4 — Mechanism Decomposition (PCC-style breakdown)

### Operation 1: Add two-stage route + gating
- **Mechanisms:** Express route handler; env flag check.
- **Primitives:** read env var; branch; start SSE.

### Operation 2: Triggered-phase orchestrator loop
- **Mechanisms:** loop state machine inside request handler; maintain counters and message list.
- **Primitives:** while-loop; append system messages; call adapter; yield SSE events.

### Operation 3: Tool call detection/merging
- **Mechanisms:** accumulate tool_call deltas; choose first complete tool call.
- **Primitives:** merge map by id/index; JSON parse; validate structure.

### Operation 4: Tool execution
- **Mechanisms:** call ToolRunner.executeToolCalls() with single-element array.
- **Primitives:** parse tool call; execute tool; capture result; trace log.

### Operation 5: Duplicate handling
- **Mechanisms:** compute signature; check set; on duplicate inject refusal system message.
- **Primitives:** stable signature builder; set membership; message injection.

### Operation 6: Budgets
- **Mechanisms:** counters and thresholds; force-final-answer mode.
- **Primitives:** integer compare; branch; inject system instruction.

### Operation 7: Persistence
- **Mechanisms:** use StreamingService’s onComplete path to persist final content once.
- **Primitives:** concatenate chunks; emit one done; DB insert.

---

## Tools Audit (Resources Touched)

| Tool / Resource Touched | Where used | VERIFIED_HAVE / NEED_Verification / MISSING | Verification Method | ✓ Verified |
|---|---|---|---|---:|
| Express router | route layer | VERIFIED_HAVE | `backend/src/routes/chatMessages.js` exists | ✓ |
| OrionAgent.processStreaming | current pipeline | VERIFIED_HAVE | file inspection | ✓ |
| StreamingService.handleSSE | SSE streaming | VERIFIED_HAVE | file inspection | ✓ |
| DS_ChatAdapter / GPT41Adapter | model streaming | VERIFIED_HAVE | route imports adapters | ✓ |
| ToolRunner | tool execution + dedupe | VERIFIED_HAVE | file exists; used in tests | ✓ |
| TraceService.logEvent | trace logging | VERIFIED_HAVE | file exists; used in route & ToolRunner | ✓ |
| TraceDashboard (frontend) | UI view | VERIFIED_HAVE | `frontend/src/components/TraceDashboard.vue` exists | ✓ |
| Environment flag `TWO_STAGE_ENABLED` | route gating | NEED_Verification | not present; must be added |  |
| New route `/api/chat/messages_two_stage` | runtime | MISSING | search found 0 matches |  |
| New orchestrator module | runtime | MISSING | does not exist yet |  |

---

## Inputs Audit (Resources Required)

| Input / Resource Required | Where used | Design Required? | Present now? | Status | Verification Method | ✓ Verified |
|---|---|---:|---:|---|---|---:|
| Existing `/api/chat/messages` route | fallback | Yes | Yes | VERIFIED_HAVE | file inspection | ✓ |
| SSE streaming support | both routes | Yes | Yes | VERIFIED_HAVE | StreamingService exists | ✓ |
| Stable requestId per user turn | dedupe + trace | Yes | Yes | VERIFIED_HAVE | `chatMessages.js` generates `requestId` | ✓ |
| Adapter streaming toolCalls format stability | tool detection | Yes | Unknown | NEED_Verification | requires runtime tests across DeepSeek/OpenAI |  |
| Tool-call merge logic correctness | parse tool args | Yes | Partially | NEED_Verification | merge logic exists but needs reuse in new route |  |
| ToolRunner signature builder works across tools | dedupe | Yes | Yes | VERIFIED_HAVE | ToolRunner includes buildCanonicalSignature | ✓ |
| Ability to inject system messages for tool results | action phase | Yes | Yes | VERIFIED_HAVE | OrionAgent appends boxed system messages | ✓ |
| Trace can accept new event types | phase boundaries | No (optional) | Unknown | NEED_Verification | depends on TraceEvent type constraints |  |
| Frontend can ignore/handle new SSE fields | UI | Yes | Unknown | NEED_Verification | must verify SSE parsing in ChatPanel |  |

---

## Outputs Audit (Artifacts / State)

| Output | Produced by | Consumed by | Auto / Scheduled |
|---|---|---|---|
| SSE chunks (assistant text) | Action Phase | Chat UI | Auto |
| Tool execution result | Tool Phase | Next Action Phase (system message) | Auto |
| Trace events | ToolRunner + route | TraceDashboard | Auto |
| Persisted final chat message row | onComplete | chat history/context | Auto |
| Refusal system message (duplicate) | Action Phase | model + (optionally UI) | Auto |

---

## Missing Fundamentals (must become explicit implementation tasks)

1. **Two-stage route implementation** (`/api/chat/messages_two_stage`) — currently missing.
2. **Orchestrator module** to isolate A/B loop from existing OrionAgent streaming.
3. **Definition + implementation of “stop phase without closing SSE”** in the new route.
4. **Duplicate handling in Action Phase before ToolRunner call** (to ensure “ignore + refusal” semantics).
5. **Budget enforcement** (cycle and duplicate attempt budgets).
6. **Frontend compatibility** with new SSE fields and possible new event shapes. **NEED_Verification**.
7. **Trace event type extensibility** for phase boundaries. **NEED_Verification**.

---

## RED v2 Verdict

### Execution readiness
**Verdict:** **NOT EXECUTION-READY (by design)** — this is a plan/spec; major deliverables do not exist yet.

### Design viability
**Verdict:** **CONDITIONALLY SOUND** — it aligns with the existing architecture (SSE streaming + ToolRunner), but success depends on correct tool-call merging, strict budgets, and careful phase handling.

### Highest-risk assumptions (NEED_Verification)
1. DeepSeek streaming tool_call format and completeness behavior across cycles.
2. Frontend’s ability to handle new SSE envelope fields/events without breaking.
3. Whether TraceService/TraceEvent schema restricts event type names.

### Suggested mitigations
- Build a minimal prototype route with a single A→B→A→B cycle and test with DeepSeek.
- Add backend tests that simulate streaming tool_call deltas.
- Add a feature-flag and runtime kill-switch to revert immediately.
