# Worklog: 2025-12-25 - Feature 3 (Protocol Strategy) Cleanup & Hardening

## Overview
This session focused on fixing architectural debt and improving the usability/configuration of the new Two-Stage Protocol service (Feature 3). We addressed strict duplicate rules, confusing configuration variables, legacy code removal, and tracing visibility.

## Key Changes & Decisions

### 1. Config Simplification: `MAX_PHASE_CYCLES`
**Problem:** We had introduced `ORION_MAX_TOOL_CALLS` on top of the existing `MAX_PHASE_CYCLES` variable, creating confusion about which one controlled the tool budget.
**Resolution:**
- Removed `ORION_MAX_TOOL_CALLS` entirely.
- Established **`MAX_PHASE_CYCLES`** (env var) as the single source of truth for the protocol’s per-turn tool budget.
- Default remains 3; user can set e.g. `MAX_PHASE_CYCLES=10` in `.env` to allow more tool execution cycles per turn.

### 2. Removal of `TwoStageOrchestrator` (Legacy)
**Problem:** The old `TwoStageOrchestrator` class was still being imported by `chatMessages.js` for a legacy route, causing server crashes after the file was renamed to `_DO_NOT_USE`.
**Resolution:**
- Removed the legacy import and the `/messages_two_stage` route from `chatMessages.js`.
- Cleaned up all remaining references to `TwoStageOrchestrator` in the backend.
- The file `backend/src/services/TwoStageOrchestrator_DO_NOT_USE.js` remains as a historical reference only.

### 3. Stricter Duplicate Semantics for Filesystem Tools
**Problem:** The protocol’s duplicate detection keyed on the full JSON arguments. This allowed repeated writes to the same file in one turn (e.g. `write_to_file("hello.js", contentA)` vs `contentB`), which wasted tokens and caused the tool budget to run out without the model realizing it was done.
**Resolution:**
- Implemented **path-aware signatures** for FS tools in `TwoStageProtocol`:
  - `write_to_file`: Duplicate if same `path` (content ignored).
  - `read_file`: Duplicate if same `path`.
  - `list_files`: Duplicate if same `path` + options.
  - `search_files`: Duplicate if same `path` + regex.
- Added a **per-turn cap** for `search_files` (max 3 executions) to prevent search looping.

### 4. Generic Success Guidance
**Problem:** Even when `write_to_file` succeeded, the protocol didn’t explicitly tell the model “You are done.” Instead, the model hit the budget limit and apologized.
**Resolution:**
- Updated `TwoStageProtocol` to inject a generic **success guidance** system message after every successful tool execution:
  > "Tool [name] executed successfully. Use the above result as ground truth... Do not call this same tool again with the same target..."
- This encourages the model to recognize success and stop calling tools, rather than looping until the budget kicks in.

### 5. Prompt Context Tracing (Planned)
**Problem:** It is hard to debug why Orion claims “I have no context” without seeing the exact system prompt sent to the LLM.
**Resolution:**
- Defined a task for Devon to log `llm_call` trace events containing the **full system prompt and messages**.
- Defined a task to update `TraceDashboard` to display this "Prompt Context" in a collapsible section.

## Next Steps
- Verify that `MAX_PHASE_CYCLES=10` works as expected in a new session.
- Confirm that `write_to_file` stops after one success and the model acknowledges it.
- Implement the `llm_call` tracing to finally debug the "I don't have context" disclaimer.

---
**Logged by:** Cline  
**Date:** 2025-12-25  
**Time:** ~02:30 AM (America/Toronto)
