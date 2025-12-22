# Devon 2-1-19 (S20) – Unified Streaming Architecture

## Context
We are unifying the Orion agent architecture so that **both PLAN and ACT modes use the streaming pipeline**.
- Currently:
  - PLAN = `processStreaming` (streaming text, **no tools**).
  - ACT = `process` (non-streaming, **tools enabled**).
- Target State:
  - Both use `processStreaming`.
  - PLAN = streaming text + **read-only tools** allowed.
  - ACT = streaming text + **all tools** allowed.

## Implementation Steps

### 1. Refactor OrionAgent.processStreaming
**File:** `backend/src/agents/OrionAgent.js`
- Update `processStreaming` to accept `options.mode` (default 'plan').
- Enable tool execution loop within the stream:
  - When `adapterStream` yields `toolCalls`:
    1. Filter tools based on mode:
       - If `mode === 'plan'`, only allow read-only tools (whitelist: `read_file`, `search_files`, `list_files`, `DatabaseTool_get_*`, `DatabaseTool_list_*`, `DatabaseTool_search_*`).
       - If `mode === 'act'`, allow all.
    2. For allowed tools, execute via `ToolRunner.executeToolCalls` (which handles retries/dedup).
    3. For blocked tools, yield a system message chunk: "Tool [name] blocked in PLAN mode."
    4. **Inject results back into the stream:**
       - Format the result (using the new `════ TOOL RESULT ════` box).
       - Yield this text chunk so the frontend sees it immediately.
       - Add the result to the conversation history (`messages` array) so the LLM sees it for the next iteration.
    5. **Recursion/Loop:** If tools ran, call the adapter again (streaming) with the updated history to get the next response.

### 2. Update Chat Route
**File:** `backend/src/routes/chatMessages.js`
- Remove the `if (wantsStreaming)` branch logic that separates behaviors.
- **Always** use `processStreaming` for user messages.
- Ensure `onComplete` persistence logic captures the *full* conversation turn (including tool results if they were part of the stream).

### 3. Update Frontend ChatPanel
**File:** `frontend/src/components/ChatPanel.vue`
- Update `handleSendMessage`:
  - Remove the `if (currentMode === 'plan')` fork.
  - Always call `streamOrionReply`.
  - Ensure the `onChunk` handler correctly appends text to the message bubble.

### 4. Cleanup
- Remove the legacy `process` (non-streaming) method from `OrionAgent.js` once confirmed unused.
- Remove the non-streaming branch from `chatMessages.js`.

## Tool Filtering Logic (Plan Mode Whitelist)
- **Allowed:**
  - `read_file`, `list_files`, `search_files`, `list_code_definition_names`
  - `DatabaseTool_get_*`
  - `DatabaseTool_list_*`
  - `DatabaseTool_search_*`
- **Blocked:**
  - `write_to_file`, `replace_in_file`, `execute_command`
  - `DatabaseTool_create_*`
  - `DatabaseTool_update_*`
  - `DatabaseTool_delete_*` (if any)

## Key Constraints
- **Do not break existing ACT functionality.** Tools must still work, just streamed.
- **Do not regress on duplication.** Ensure the streaming loop doesn't double-yield or double-persist.
- **Visuals:** Tool results must be visible in the frontend stream as they happen.
