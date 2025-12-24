# Test Status Summary: Subtask P1-F2-T1-S23 — Two-stage/Triggered-Phase Prototype

## Test Status: RED Phase (Implementation Bug Detected)
**Date**: 2025-12-23  
**Analyst**: Tara  
**Total Tests**: 10  
**Passing**: 9  
**Failing**: 1 (S23-T4 - duplicate handling infinite loop bug)  
**Skipped**: 0

## Test Alignment Update

### 🔧 **Key Alignment Applied:**

#### 1. **Strengthened duplicate handling test (S23-T4)**
   - Added regression guard comment for infinite loop bug
   - Enhanced test to simulate pathological case where model keeps trying same tool after `duplicateExceeded`
   - Added assertions to detect infinite loops:
     - `adapterCallCount <= 4` (guard against infinite loop)
     - ToolRunner called exactly once
     - Exactly one done event
     - System notice appears bounded number of times

#### 2. **Bug Confirmed: Infinite loop after duplicateExceeded**
   - Test now fails with `adapterCallCount = 5` (reaches error case)
   - Console error: "ERROR: Infinite loop detected - adapter called after duplicateExceeded"
   - Bug: When `duplicateExceeded = true`, orchestrator injects system message but continues loop
   - Pathological case: Model keeps trying same tool → infinite loop

## Current Test Results

### ✅ **S23-T1: Route Gating Tests (PASSING)**
1. ✅ `should return 501 when TWO_STAGE_ENABLED=false` - **PASSES**
2. ✅ `should return 200 (SSE) when TWO_STAGE_ENABLED=true (route exists)` - **PASSES**
3. ✅ `existing /api/chat/messages still works when TWO_STAGE_ENABLED=false` - **PASSES**

### ✅ **S23-T2: Single Tool Per Phase Test (PASSING)**
4. ✅ `should execute only first tool when adapter emits two toolCalls in one stream` - **PASSES**

### ✅ **S23-T3: A/B Cycling Test (PASSING)**
5. ✅ `should execute list_files, then read_file, then produce final answer` - **PASSES**

### ❌ **S23-T4: Duplicate Handling Test (FAILING - BUG DETECTED)**
6. ❌ `should ignore duplicate tool call and inject system refusal message` - **FAILS**
   - **Bug**: Infinite loop when model keeps trying same tool after `duplicateExceeded`
   - **Expected**: `adapterCallCount <= 4`
   - **Actual**: `adapterCallCount = 5` (reaches error case)
   - **Console**: "ERROR: Infinite loop detected - adapter called after duplicateExceeded"

### ✅ **S23-T5: Cycle Budget Enforcement Test (PASSING)**
7. ✅ `should execute only 3 tools when adapter emits 4 sequential non-duplicate tool calls` - **PASSES**

### ✅ **Additional Requirements Tests (PASSING)**
8. ✅ `should include phase metadata in SSE events when implemented` - **PASSES**
9. ✅ `should emit exactly one done event per user turn` - **PASSES**
10. ✅ `should persist message once at end of turn` - **PASSES**

## Implementation Verification Status

### ✅ **Verified Working:**
1. **Route exists** with feature flag gating
2. **Returns 501** when `TWO_STAGE_ENABLED=false`
3. **Returns 200 (SSE)** when `TWO_STAGE_ENABLED=true`
4. **Tool limiting** (`MAX_TOOLS_PER_TOOL_PHASE=1`)
5. **A/B cycling** (multiple adapter calls)
6. **Cycle budgets** (`MAX_PHASE_CYCLES_PER_TURN=3`)
7. **Phase metadata** in SSE events
8. **Single done event** per turn
9. **Message persistence** at end of turn

### ❌ **Bug Detected:**
1. **Infinite loop after duplicateExceeded**
   - When `MAX_DUPLICATE_ATTEMPTS_PER_TURN` (3) is reached
   - Orchestrator injects system message but continues loop
   - If model keeps trying same tool, infinite loop occurs
   - Need to break loop and force final answer

## Test Execution Notes

### **Current Test Run Results:**
```bash
cd backend && set TWO_STAGE_ENABLED=true && npx jest two_stage_protocol.spec.js
Results: 1 failed, 9 passed, 10 total
```

### **S23-T4 Test Failure Details:**
```
expect(adapterCallCount).toBeLessThanOrEqual(4)
Expected: <= 4
Received: 5
```

### **Console Error:**
```
ERROR: Infinite loop detected - adapter called after duplicateExceeded
```

### **Bug Reproduction:**
1. Model calls tool (executed)
2. Model calls same tool again (duplicate attempt 1 - refusal injected)
3. Model calls same tool again (duplicate attempt 2 - triggers `duplicateExceeded`)
4. Model stubbornly calls same tool again (pathological case)
5. Orchestrator detects duplicate, sets `duplicateExceeded = true` again
6. Loop continues indefinitely (bug!)

## Updated Test File

**Location**: `backend/src/_test_/two_stage_protocol.spec.js`

**Key Improvements**:
1. **Regression guard comment**: Documents real-world infinite loop bug
2. **Pathological case simulation**: Model keeps trying tool after `duplicateExceeded`
3. **Infinite loop detection**: Checks `adapterCallCount <= 4`
4. **Error case**: Call 5 logs error if reached (confirms infinite loop)
5. **Comprehensive assertions**: Tool execution count, done events, system notices

**CDP Analysis**: `.Docs/Roadmap/TaraTests/P1-F2-T1-S23_two_stage_prototype_cdp.yml`

## Next Steps for Devon

### **Implementation Complete:**
- ✅ Route `/api/chat/messages_two_stage` exists
- ✅ Feature flag gating works
- ✅ Returns appropriate status codes
- ✅ Tool limiting works (`MAX_TOOLS_PER_TOOL_PHASE=1`)
- ✅ A/B cycling works
- ✅ Cycle budget enforcement works (`MAX_PHASE_CYCLES_PER_TURN=3`)
- ✅ Phase metadata in SSE events
- ✅ Single done event per turn
- ✅ Message persistence at end of turn

### **Bug Fix Required:**
1. **Fix infinite loop after duplicateExceeded**
   - When `toolPhaseResult.duplicateExceeded = true`
   - Orchestrator should break loop and force final answer
   - Not continue with `continue` statement
   - Implementation should handle pathological case where model ignores system message

### **Suggested Fix:**
In `TwoStageOrchestrator.orchestrate()`:
```javascript
if (toolPhaseResult.duplicateExceeded) {
  // Too many duplicate attempts, force final answer
  injectSystemMessage('Maximum duplicate tool call attempts exceeded. Provide final answer without further tool calls.');
  emit({ chunk: '\n\n**System Notice**: Maximum duplicate tool call attempts exceeded. Provide final answer.\n\n' });
  
  // Force final answer and break loop
  const finalResult = await this._callAdapter(state.messages, state.mode, state.projectId, state.requestId);
  for await (const event of finalResult) {
    if (event.done && event.fullContent) {
      emit({ done: true, fullContent: event.fullContent });
      state.doneEmitted = true;
      break;
    } else if (event.chunk) {
      emit({ chunk: event.chunk });
    }
  }
  break; // Exit while loop
}
```

## Verification Script

```bash
# Run all tests with TWO_STAGE_ENABLED=true
cd backend && set TWO_STAGE_ENABLED=true && npx jest two_stage_protocol.spec.js

# Expected: 1 test fails (S23-T4) until bug is fixed
# After fix: All 10 tests should pass
```

---

**Tara Signature**: Tests strengthened to detect infinite loop bug. S23-T4 now fails correctly when implementation has bug. Fix required in `TwoStageOrchestrator.orchestrate()` to break loop when `duplicateExceeded = true`.
