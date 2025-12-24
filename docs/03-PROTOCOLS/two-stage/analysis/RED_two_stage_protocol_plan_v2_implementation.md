# Two-Stage Protocol — RED v2 Analysis (Implementation-Based)

**Based on**: Current prototype implementation (as of 2025-12-23)
**Reference**: Original RED analysis (`RED_two_stage_protocol_plan_vFinal_EXPANDED.md`)
**Goal**: Identify gaps between prototype and production-ready implementation

---

## 1. Executive Summary

The two-stage protocol prototype has been successfully implemented with:
- ✅ **Route**: `/api/chat/messages_two_stage` with `TWO_STAGE_ENABLED` gating
- ✅ **Orchestrator**: `TwoStageOrchestrator.js` with A/B cycling, duplicate detection, phase metadata
- ✅ **Frontend**: Toggle support with localStorage persistence
- ✅ **Tests**: 10/10 passing backend tests

However, critical operational safety gaps remain that prevent production deployment.

---

## 2. Implementation Status vs. RED Analysis

### 2.1. RED Analysis "Missing Fundamentals" - Current Status

| RED Analysis Missing Fundamental | Current Status | Notes |
|----------------------------------|----------------|-------|
| `/api/chat/messages_two_stage` route | ✅ **IMPLEMENTED** | Route exists with env gating (501 when disabled) |
| Orchestrator loop | ✅ **IMPLEMENTED** | `TwoStageOrchestrator.js` with phase cycling |
| Tool-call parsing | ✅ **PARTIAL** | Uses OrionAgent merging logic; "complete enough" criteria implemented |
| UI compatibility | ✅ **BASIC** | `streamOrionReply.js` ignores extra fields (phase, phaseIndex, cycleIndex) |
| Trace schema phase types | ❌ **STILL MISSING** | `TRACE_TYPES` lacks phase-specific events |

### 2.2. Newly Discovered Gaps (Not in Original RED)

| Gap Category | Specific Gap | Impact | Priority |
|--------------|--------------|--------|----------|
| **Operational Safety** | Duplicate termination loops indefinitely | User sees repeated system notices without final answer | HIGH |
| **Context Management** | No cross-turn context hydration | Orion loses conversation history across turns | HIGH |
| **Security** | `redactDetails()` is a stub | Sensitive content logged in trace events | MEDIUM |
| **Configuration** | Hard-coded `MAX_PHASE_CYCLES_PER_TURN=3` | Arbitrary limit may block legitimate workflows | MEDIUM |
| **Observability** | No phase-specific trace events | Cannot debug A/B cycling in trace dashboard | LOW |
| **Frontend UX** | No phase visualization | Users can't see phase transitions | LOW |

---

## 3. Detailed Gap Analysis

### 3.1. Duplicate Termination Flaw

**Location**: `backend/src/services/TwoStageOrchestrator.js`, `orchestrate()` method

**Problem**: When `duplicateExceeded` is true, the orchestrator:
1. Injects system message: "Maximum duplicate tool call attempts exceeded..."
2. Continues the `while` loop (doesn't set `doneEmitted`)
3. `cycleIndex` remains below `MAX_PHASE_CYCLES_PER_TURN`
4. Loop continues indefinitely with repeated notices

**Root Cause**: The `duplicateExceeded` branch doesn't force a final Action-only phase or exit the loop.

**Impact**: User sees:
```
**System Notice**: Maximum duplicate tool call attempts exceeded...
I will list the root directory...
**System Notice**: Maximum duplicate tool call attempts exceeded...
I will list the root directory...
```

**Required Fix**: When `duplicateExceeded` is true:
1. Set `cycleIndex = MAX_PHASE_CYCLES_PER_TURN` to trigger budget-exhausted path
2. Force one final Action-only adapter call with instruction: "Provide final answer without tool calls"
3. Emit `done` and exit loop

### 3.2. Missing Cross-Turn Context Hydration

**Location**: `TwoStageOrchestrator` constructor, `state.messages` initialization

**Current Behavior**: Each new two-stage request starts with:
```javascript
messages: [
  { role: 'system', content: this._buildSystemPrompt(mode) },
  { role: 'user', content }
]
```

**Problem**: No prior conversation history is loaded from `chat_messages` table.

**Impact**: Orion says "I don't have context about earlier discussion" even when chat history exists.

**Required Solution**: Load last N messages from `chat_messages` where `external_id` matches, convert to message format, and prepend to `state.messages`.

**Design Questions**:
1. How many messages to load? (Suggested: 10)
2. How to handle token limits? (Summarization needed for long histories)
3. How to handle system/tool messages in history?

### 3.3. Incomplete Trace Redaction

**Location**: `backend/src/routes/chatMessages.js`, `redactDetails()` function

**Current Implementation**:
```javascript
function redactDetails(details) {
  // Implement redaction logic based on DEV_TRACE_EVENT_MODEL.md
  // For now, return details as is (to be improved)
  return details;
}
```

**Risk**: Sensitive content (API keys, file paths, tool arguments) may be logged verbatim.

**Reference**: `docs/DEV_TRACE_EVENT_MODEL.md` defines redaction rules.

**Required Implementation**: Redact:
- API keys (patterns like `sk-*`, `Bearer *`)
- File paths containing sensitive directories
- Tool arguments with sensitive data

### 3.4. Hard-Coded Budget Constants

**Location**: `TwoStageOrchestrator` constructor

**Current**:
```javascript
this.MAX_TOOLS_PER_TOOL_PHASE = 1;
this.MAX_PHASE_CYCLES_PER_TURN = 3;
this.MAX_DUPLICATE_ATTEMPTS_PER_TURN = 3;
```

**Problem**: Not configurable per project or environment.

**Solution**: Make configurable via environment variables:
- `TWO_STAGE_MAX_CYCLES` (default: 3)
- `TWO_STAGE_MAX_DUPLICATES` (default: 3)

### 3.5. Missing Trace Phase Types

**Location**: `backend/src/services/trace/TraceEvent.js`, `TRACE_TYPES` array

**Current**: No phase-specific event types.

**Required Additions**:
- `phase_start` (with phase: 'action' | 'tool')
- `phase_end`
- `cycle_advance`
- `budget_exhausted`
- `duplicate_blocked`

**Integration**: Update `TwoStageOrchestrator` to emit these events via `TraceService.logEvent()`.

---

## 4. Dependency & Resource Audit

### 4.1. Tools/Resources Touched - VERIFIED_HAVE

| Resource | Location | Status |
|----------|----------|--------|
| Express Router | `backend/src/routes/chatMessages.js` | ✅ |
| TwoStageOrchestrator | `backend/src/services/TwoStageOrchestrator.js` | ✅ |
| ToolRunner | `backend/tools/ToolRunner.js` | ✅ |
| TraceService | `backend/src/services/trace/TraceService.js` | ✅ |
| DS_ChatAdapter/GPT41Adapter | `backend/src/adapters/` | ✅ |
| StreamingService | `backend/src/services/StreamingService.js` | ✅ |
| Frontend SSE parser | `frontend/src/utils/streamOrionReply.js` | ✅ (ignores extra fields) |

### 4.2. Inputs/Resources Required - NEED_VERIFICATION

| Input | Where Used | Status |
|-------|------------|--------|
| `TWO_STAGE_ENABLED` env var | Route gating | ✅ **VERIFIED** |
| Chat history DB query | Context hydration | ❌ **MISSING** |
| Redaction patterns | `redactDetails()` function | ❌ **MISSING** |
| Configurable budget env vars | TwoStageOrchestrator | ❌ **MISSING** |
| Phase trace event types | TraceEvent.js | ❌ **MISSING** |

---

## 5. Risk Assessment

### 5.1. High Risk (Block Production)

1. **Duplicate termination loop** - Operational failure
   - **Probability**: High (reproducible with duplicate prompts)
   - **Impact**: User experience degradation, infinite loops
   - **Mitigation**: Fix in `TwoStageOrchestrator.orchestrate()`

2. **Missing context hydration** - Functional gap
   - **Probability**: High (affects all multi-turn conversations)
   - **Impact**: Breaks conversation continuity
   - **Mitigation**: Implement chat history loading

### 5.2. Medium Risk (Security/Config)

1. **Incomplete trace redaction** - Security exposure
   - **Probability**: Medium (depends on tool usage)
   - **Impact**: Sensitive data leakage in logs
   - **Mitigation**: Implement `redactDetails()` per DEV_TRACE_EVENT_MODEL

2. **Hard-coded budgets** - Operational rigidity
   - **Probability**: Medium (affects complex workflows)
   - **Impact**: Legitimate workflows may be blocked
   - **Mitigation**: Make configurable via env vars

### 5.3. Low Risk (Observability/UX)

1. **Missing phase trace events** - Debuggability gap
   - **Probability**: Low (doesn't affect functionality)
   - **Impact**: Harder to debug phase transitions
   - **Mitigation**: Add to `TRACE_TYPES`

2. **No frontend phase visualization** - UX gap
   - **Probability**: Low (users can still interact)
   - **Impact**: Reduced transparency
   - **Mitigation**: Optional enhancement

---

## 6. Implementation Requirements

### 6.1. Phase 1: Critical Fixes (Week 1)

#### Task 1.1: Fix Duplicate Termination (Devon)
- **File**: `backend/src/services/TwoStageOrchestrator.js`
- **Change**: Modify `orchestrate()` method to force final answer when `duplicateExceeded`
- **Acceptance Criteria**:
  - When `MAX_DUPLICATE_ATTEMPTS_PER_TURN` reached, exactly one final Action phase occurs
  - No infinite loops with repeated system notices
  - Single `done` event emitted
- **Test Updates**: Tara updates S23-T4 test to enforce termination

#### Task 1.2: Design Context Hydration (Adam)
- **Deliverable**: Specification document with:
  - DB query: `SELECT * FROM chat_messages WHERE external_id LIKE ? ORDER BY created_at DESC LIMIT ?`
  - Message window size (suggest: 10 messages)
  - Token limit handling (summarization strategy)
  - Integration point in `TwoStageOrchestrator` constructor
- **Output**: `docs/design/two_stage_context_hydration.md`

#### Task 1.3: Implement Context Hydration (Devon)
- **Files**: `TwoStageOrchestrator.js`, add dependency injection for message loading
- **Integration**: Load history before first Action phase
- **Tests**: Tara adds cross-turn context tests

### 6.2. Phase 2: Security & Configuration (Week 2)

#### Task 2.1: Implement Trace Redaction (Devon)
- **File**: `backend/src/routes/chatMessages.js`, `redactDetails()` function
- **Reference**: `docs/DEV_TRACE_EVENT_MODEL.md`
- **Scope**: Redact API keys, file paths, sensitive tool arguments
- **Tests**: Tara adds redaction unit tests

#### Task 2.2: Configurable Budgets (Devon)
- **Change**: Replace hard-coded constants with env vars
- **Env Vars**:
  - `TWO_STAGE_MAX_CYCLES` (default: 3)
  - `TWO_STAGE_MAX_DUPLICATES` (default: 3)
- **Backward Compatibility**: Keep defaults for existing tests

#### Task 2.3: Add Phase Trace Events (Devon)
- **File**: `backend/src/services/trace/TraceEvent.js`
- **Add to TRACE_TYPES**: `phase_start`, `phase_end`, `cycle_advance`, `budget_exhausted`, `duplicate_blocked`
- **Integration**: Update `TwoStageOrchestrator` to emit these events

### 6.3. Phase 3: Enhanced Intelligence (Week 3)

#### Task 3.1: Progress-Sensitive Budgeting (Adam)
- **Design**: RED v3 exploring alternatives to fixed cycle limits
- **Options**:
  - Distinct tool/argument tracking
  - Time-based limits (e.g., 30 seconds per turn)
  - User confirmation after N cycles
- **Output**: Implementation requirements

#### Task 3.2: Frontend Phase Visualization (Devon)
- **Optional**: Add phase indicator in ChatPanel
- **Data**: Use `phase`, `phaseIndex`, `cycleIndex` from SSE events
- **Low Priority**: Can be deferred

---

## 7. Rollout Strategy

### 7.1. Current State
- `TWO_STAGE_ENABLED=false` by default
- Route returns 501 when disabled
- Frontend toggle persists to localStorage

### 7.2. Recommended Rollout
1. **Phase 1 Complete**: Enable for project P1 only
2. **Phase 2 Complete**: Enable for all projects
3. **Phase 3 Complete**: Consider making default for new projects

### 7.3. Rollback Plan
- Flip `TWO_STAGE_ENABLED=false`
- Frontend automatically falls back to `/api/chat/messages`
- No data migration required

---

## 8. Conclusion

The two-stage protocol prototype is **architecturally sound** but has **critical operational safety gaps** that must be addressed before production use. The highest priority is fixing the duplicate termination loop and implementing cross-turn context hydration.

**Next Actions**:
1. **Immediate**: Fix duplicate termination flaw (Task 1.1)
2. **Parallel**: Design context hydration (Task 1.2)
3. **Follow-up**: Implement security and configuration improvements

**Recommendation**: Keep `TWO_STAGE_ENABLED=false` until Phase 1 fixes are complete and tested.

---

*Document generated: 2025-12-23*  
*Based on prototype analysis of: TwoStageOrchestrator.js, chatMessages.js, TraceEvent.js, streamOrionReply.js*
