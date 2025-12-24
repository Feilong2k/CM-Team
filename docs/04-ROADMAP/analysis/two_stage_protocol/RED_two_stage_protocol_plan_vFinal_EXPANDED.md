# Triggered-Phase Protocol (Two-Stage vFinal) — RED v2 Analysis (EXPANDED)

**Plan under review:** `docs/design/two_stage_protocol_plan_vFinal.md`

**Why this doc exists:** The earlier RED writeup read too much like a PCC. This version follows the repo’s reference style (see `.Docs/Roadmap/Analysis/Feature2_RED_Analysis.md`) and includes the **Section 2 expanded breakdown tables**, which is where RED provides the most value.

> **Truthfulness rule:** If something cannot be verified from repository inspection (or a concrete reproducible check), it is marked **NEED_Verification**. If it clearly does not exist yet, it is **MISSING**.

---

## 1. Overview

This RED analysis decomposes the triggered-phase orchestration into parent→child actions, expanding until we reach execution primitives (or until we hit “MISSING” mechanisms that must be implemented).

Scope focus:
- Backend triggered-phase orchestration (A/B cycling) in a new route.
- Integration with existing streaming pipeline, ToolRunner, and Trace.

---

## 2. RED Breakdown — Expanded Tables

### 2.1. Level 1 → Level 2

| L1 Action (Parent) | L2 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| User submits chat request | UI calls `fetch('/api/chat/messages_two_stage')` via SSE | Browser Fetch, Network | Frontend code updated to point to new endpoint | HTTP request (SSE) | ✓ | NEED_Verification (frontend not yet updated) |
| Backend receives two-stage request | Express route receives POST `/api/chat/messages_two_stage` | Node.js HTTP, Express Router | Route exists and registered | Request received | ✗ | **MISSING** (route not implemented; verified search = 0 matches) |
| Backend receives two-stage request | Gate route by `TWO_STAGE_ENABLED` | Node.js env, Express | Env flag exists | Allow/deny | ✓ | NEED_Verification (flag not found in repo) |
| Triggered-phase orchestration runs | Initialize turn state (`requestId`, counters, budgets) | Node.js memory | requestId creation logic; budget constants | Initialized state object | ✓ | NEED_Verification (new orchestrator not implemented) |
| Triggered-phase orchestration runs | Action Phase (B): stream LLM output | LLM Adapter stream, Node.js | Adapter streaming available | Text chunks | ✓ | VERIFIED_HAVE (streaming exists in current route/agent) |
| Triggered-phase orchestration runs | Detect first tool call in stream | Node.js memory | tool-call deltas present; merge logic | ToolCall candidate | ✗ | NEED_Verification (merge logic exists in OrionAgent; new route must reuse/port) |
| Triggered-phase orchestration runs | Tool Phase (A): execute exactly 1 tool | ToolRunner, tool impls | ToolRunner available; tool registry | Tool result | ✓ | VERIFIED_HAVE (ToolRunner exists; orchestration missing) |
| Triggered-phase orchestration runs | Inject tool result to next phase as **system message** | Node.js memory | message list structure; boxed format | System message added | ✓ | VERIFIED_HAVE concept (OrionAgent does this today) / NEED_Verification (new route must replicate) |
| Triggered-phase orchestration runs | Duplicate tool call attempt in Action Phase | Node.js memory | canonical signature builder | Refusal system message | ✓ | VERIFIED_HAVE (signature builder exists) / NEED_Verification (new route behavior) |
| Triggered-phase orchestration runs | Enforce budgets (`MAX_PHASE_CYCLES_PER_TURN=3`) | Node.js memory | counters incremented | Forced final-answer mode | ✓ | NEED_Verification (new route behavior) |
| Backend completes turn | Persist final assistant content once | PostgreSQL, pg lib | DB connection + table | `chat_messages` row | ✓ | VERIFIED_HAVE (existing persistence path) / NEED_Verification (new route wiring) |
| Backend completes turn | Emit `done` and close SSE | Express response | SSE response open | Stream end | ✓ | VERIFIED_HAVE (StreamingService) / NEED_Verification (new route wiring) |

**Notes (truthful):**
- The **new route** and **new orchestrator** are not implemented in code today (verified).
- The primitives needed (SSE streaming, ToolRunner, TraceService) exist.

---

### 2.2. Level 2 → Level 3 (Selected Deep Dives)

#### A) Express route receives POST `/api/chat/messages_two_stage`

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Express route receives POST `/api/chat/messages_two_stage` | Define router handler function | Express Router | `router.post()` | Handler registered | ✓ | MISSING (route not present) |
| Express route receives POST `/api/chat/messages_two_stage` | Parse request body (`external_id`, `sender`, `content`, `metadata`) | Express JSON middleware | express.json enabled | Parsed payload | ✓ | VERIFIED_HAVE (existing `/messages` route does this) |
| Express route receives POST `/api/chat/messages_two_stage` | Derive `projectId` and `requestId` | Node.js | `deriveProjectId` logic | IDs for this turn | ✓ | VERIFIED_HAVE (existing route derives + generates requestId) |
| Express route receives POST `/api/chat/messages_two_stage` | Gate by `TWO_STAGE_ENABLED` | Node.js env | env var present | 404/501 or proceed | ✓ | NEED_Verification |
| Express route receives POST `/api/chat/messages_two_stage` | Start SSE response | Express response | `Content-Type: text/event-stream` | SSE open | ✓ | VERIFIED_HAVE (StreamingService) |

#### B) Action Phase: stream LLM output

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Action Phase: stream LLM output | Build message list (system + history + user + system tool results) | Node.js memory | chat history retrieval + prompt | messages[] | ✓ | VERIFIED_HAVE (OrionAgent `_prepareRequest`) / NEED_Verification (new route custom list) |
| Action Phase: stream LLM output | Call adapter streaming API | DS_ChatAdapter / GPT41Adapter | API key, network | async stream | ✓ | VERIFIED_HAVE (existing agent uses adapter streaming) |
| Action Phase: stream LLM output | Forward `chunk` events to SSE | Express response | active SSE | chunk events | ✓ | VERIFIED_HAVE (StreamingService) |
| Action Phase: stream LLM output | Forward `toolCalls` events (optional) | SSE | UI compatibility | toolCalls event | ✓ | VERIFIED_HAVE (current pipeline forwards toolCalls) / NEED_Verification (new route policy: do we hide?) |

#### C) Detect first tool call in stream (partial tool-call deltas)

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Detect first tool call in stream | Merge toolCall deltas by `id` or `index` | Node.js memory | merge algorithm | merged toolCallMap | ✗ | VERIFIED_HAVE (implemented in OrionAgent) / NEED_Verification (reuse in new orchestrator) |
| Detect first tool call in stream | Determine “complete enough” tool call | JSON parse | arguments string present | executable toolCall | ✗ | NEED_Verification (policy not implemented) |
| Detect first tool call in stream | Stop current phase without closing SSE | Node.js control flow | ability to stop consuming generator | phase transition | ✗ | NEED_Verification (new orchestrator behavior) |

#### D) Tool Phase: execute exactly 1 tool

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Tool Phase: execute exactly 1 tool | Compute canonical signature | ToolRunner helper | tool name + args | signature | ✓ | VERIFIED_HAVE (ToolRunner has buildCanonicalSignature) |
| Tool Phase: execute exactly 1 tool | Execute tool | ToolRunner + tool impl | tool registry | tool result | ✓ | VERIFIED_HAVE |
| Tool Phase: execute exactly 1 tool | Trace `tool_call` and `tool_result` | TraceService | DB tables for trace events | trace rows | ✓ | VERIFIED_HAVE |
| Tool Phase: execute exactly 1 tool | Block duplicates across phases | in-memory map | `blockedSignatures` set | refusal decision | ✓ | NEED_Verification (must be implemented in orchestrator) |

#### E) Inject refusal as **system message** for duplicates

| L2 Action (Parent) | L3 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Duplicate detected in Action Phase | Do not execute tool | Node.js control flow | signature tracking | tool execution skipped | ✓ | NEED_Verification (new orchestrator behavior) |
| Duplicate detected in Action Phase | Append refusal system message to messages[] | Node.js memory | system message format | updated messages[] | ✓ | VERIFIED_HAVE concept (OrionAgent already appends system messages) / NEED_Verification (new orchestrator) |
| Duplicate detected in Action Phase | (Optional) emit SSE notice | SSE | UI compatibility | user-visible note | ✓ | NEED_Verification (plan says system message; UI may not need) |

---

### 2.3. Level 3 → Level 4 (If Needed)

#### Merge toolCall deltas by `id` or `index`

| L3 Action (Parent) | L4 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| Merge toolCall deltas | Maintain `index→id` map | Node.js memory | toolCall.index | stable key mapping | ✓ | VERIFIED_HAVE (OrionAgent has this) |
| Merge toolCall deltas | Merge `function.arguments` fragments | String concatenation | partial deltas | final arg string | ✓ | VERIFIED_HAVE (OrionAgent has this) |
| Merge toolCall deltas | Store merged call in map | Map structure | key resolved | call ready | ✓ | VERIFIED_HAVE |

---

## 3. Tools, Inputs, and Outputs Audit

### 3.1 Tools Audit (Resources Touched)

| Tool / Resource Touched | Where Used | VERIFIED_HAVE / MISSING / NEED_Verification | Evidence |
|---|---|---|---|
| Express Router | new route | VERIFIED_HAVE | `backend/src/routes/chatMessages.js` exists |
| DS_ChatAdapter stream | Action Phase | VERIFIED_HAVE | used in OrionAgent today |
| ToolRunner | Tool Phase | VERIFIED_HAVE | `backend/tools/ToolRunner.js` exists |
| TraceService | tool tracing | VERIFIED_HAVE | `backend/src/services/trace/TraceService.js` exists |
| Trace event types for phase start/end | observability | NEED_Verification | `TRACE_TYPES` currently does **not** include orchestration phase types (see `backend/src/services/trace/TraceEvent.js`) |
| Frontend SSE parser tolerance for new event fields | UI | NEED_Verification | `frontend/src/utils/streamOrionReply.js` currently only handles `chunk|error|done` |
| New route `/api/chat/messages_two_stage` | runtime | MISSING | repo search shows none |
| New orchestrator module | runtime | MISSING | not present |

### 3.2 Inputs Audit (Resources Required)

| Input / Resource Required | Where Used | VERIFIED_HAVE / MISSING / NEED_Verification | Notes |
|---|---|---|---|
| `TWO_STAGE_ENABLED` env flag | route gating | NEED_Verification | must be added |
| Adapter tool_call event format stability across cycles | tool detection | NEED_Verification | requires runtime testing with DeepSeek |
| Ability to stop consuming a phase without closing SSE | phase transitions | NEED_Verification | must be implemented carefully |
| Chat UI endpoint switch | rollout | NEED_Verification | ChatPanel hardcodes `/api/chat/messages` today |

### 3.3 Outputs Audit

| Output / Artifact Produced | Produced by | Depended on by | Auto / Scheduled |
|---|---|---|---|
| SSE `chunk` events | Action Phase | ChatPanel UI | Auto |
| Tool result (raw) | Tool Phase | Trace logs + next phase system message | Auto |
| System tool-result message | orchestrator | next Action Phase model call | Auto |
| System refusal message (duplicate) | orchestrator | next Action Phase model call | Auto |
| Persisted final assistant message | onComplete persistence | chat history + context builder | Auto |

---

## 4. Missing Fundamentals

| Category | Missing Fundamental | Impact | Resolution Task |
|---|---|---|---|
| Backend route | `/api/chat/messages_two_stage` not implemented | cannot run protocol | implement new route |
| Orchestration | orchestrator loop not implemented | cannot do A/B cycling | implement orchestrator module |
| Tool-call parsing | “complete enough tool call” criteria not implemented | risk invalid tool execution | define/implement criterion + tests |
| UI compatibility | SSE parser ignores unknown events (OK) but can’t display phase markers | phase visibility lost | optionally extend UI; at minimum ensure it doesn’t break |
| Trace schema | `TRACE_TYPES` lacks phase types | phase tracing may be rejected/ignored depending on validation | update TRACE_TYPES or treat as NEED_Verification until confirmed |

---

## 5. Dependency & Assumption Audit (truthful)

| Category | Status | Detail | Verification Method | Resolution Task |
|---|---|---|---|---|
| Tooling | VERIFIED_HAVE | ToolRunner exists | repo inspection | — |
| Tooling | VERIFIED_HAVE | SSE pipeline exists | repo inspection | — |
| Tooling | MISSING | two-stage route | repo search | implement |
| Tooling | MISSING | orchestrator module | repo search | implement |
| Schema | NEED_Verification | whether TraceService enforces `TRACE_TYPES` at runtime | requires reading TraceService validation path | verify + update TRACE_TYPES |
| UI | NEED_Verification | whether adding `phase` events affects ChatPanel | inspect `streamOrionReply.js` behavior | verify; it ignores unknown fields unless they are `chunk/error/done` |

---

## 6. Summary

This expanded RED shows exactly where the plan becomes executable primitives vs. where it becomes **missing implementation**:
- Most primitives exist (SSE, ToolRunner, Trace).
- The critical missing pieces are the **two-stage route + orchestrator loop + phase tool-call handling**.

If you want, the next step after this RED is to turn the “Missing Fundamentals” into an implementation task list (Devon) + verification tests (Tara).
