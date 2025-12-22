# Tara 2-1-19 (S20) – Unified Streaming & Tool Filtering

## Context
We are replacing the separate "non-streaming ACT" branch with a **single unified streaming pipeline** for both PLAN and ACT modes.
- **PLAN mode:** Streams text. Allows **read-only** tools (e.g. `read_file`, `search_files`, `DatabaseTool_get_*`) but **blocks** write tools.
- **ACT mode:** Streams text. Allows **all** tools (read + write).

Your job is to write tests that verify this behavior is enforced at the agent/tool-runner level.

## Test Strategy (RED Phase)
Create a new test file: `backend/src/_test_/unified_streaming_tools.spec.js`.

### 1. Verify Tool Filtering by Mode
Mock the `ToolRunner` or `OrionAgent` internals to track which tools are executed.
- **Test A (PLAN Mode):**
  - Simulate a streaming request with `mode: 'plan'`.
  - Inject a prompt that asks Orion to call `DatabaseTool_create_subtask` (a write tool).
  - **Assert:** The tool execution is **blocked** or filtered out.
  - **Assert:** The stream continues (Orion might say "I cannot execute write tools in PLAN mode").
- **Test B (PLAN Mode - Read Only):**
  - Simulate a streaming request with `mode: 'plan'`.
  - Inject a prompt asking for `DatabaseTool_get_subtask_full_context` (a read tool).
  - **Assert:** The tool is **allowed** and executed.
  - **Assert:** The result appears in the stream/trace.

- **Test C (ACT Mode):**
  - Simulate a streaming request with `mode: 'act'`.
  - Inject a prompt asking for `DatabaseTool_create_subtask`.
  - **Assert:** The tool is **allowed** and executed.

### 2. Verify Streaming Mechanics
- **Test D (Stream Content):**
  - Verify that `processStreaming` yields chunks for both text and tool results.
  - Assert that tool results are formatted with the new `════ TOOL RESULT ════` highlighting (check content chunks).

### 3. Verify Persistence
- **Test E (DB Save):**
  - Mock the `StreamingService.persistStreamedMessage`.
  - Run a full streaming turn.
  - **Assert:** `persistStreamedMessage` is called exactly **once** at the end with the full aggregated content.

## Acceptance Criteria
- [ ] PLAN mode successfully runs read tools but blocks write tools.
- [ ] ACT mode runs all tools.
- [ ] Streaming output includes tool results in the correct format.
- [ ] Persistence happens only once per turn.

## Implementation Notes
- Use `vi.mock` for `ToolRunner` to intercept calls without actually hitting the DB.
- You may need to inspect `backend/tools/registry.js` to see how tools are tagged (read vs write) or define a list of allowed tools for PLAN mode in the test setup if it's not yet in code.
