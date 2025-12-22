# Orion Tool Execution Guide

This document explains **how Orion uses tools now**, and what you need to do as a user (and as a dev) to:

- Get Orion to read a subtask from the DB and summarize it
- Understand the **PLAN vs ACT** behavior in the Chat Panel
- Add new tools or models without re‑wiring everything
- Understand how **tracing** will let you debug tool calls and streaming

---

## 1. High‑level Flow (ACT mode)

When you talk to Orion from the UI in **ACT** mode, and ask it to use a tool (e.g. `DatabaseTool_get_subtask_full_context`), the flow is:

1. **Frontend (ChatPanel.vue)**
   - You type a message and click **ACT**.
   - ChatPanel sends a **JSON POST** to:
     
     ```http
     POST http://localhost:3500/api/chat/messages
     Content-Type: application/json

     {
       "external_id": "P1",
       "sender": "user",
       "content": "Use DatabaseTool_get_subtask_full_context for subtask 2-1-8 and summarize it.",
       "metadata": { "mode": "act" }
     }
     ```

2. **Backend route: `backend/src/routes/chatMessages.js`**
   - For `sender === 'user'` and **non‑streaming** (no `Accept: text/event-stream`), it runs:
     
     ```js
     const response = await orionAgent.process(external_id, content, { mode });
     ```

3. **OrionAgent (non‑streaming): `backend/src/agents/OrionAgent.js`**
   - `process()` calls `_prepareRequest()` to:
     - Store the user message in `chat_messages` via `DatabaseTool.chatMessages.addMessage()`.
     - Build context (chat history + file list).
     - Build the system prompt from `SystemPrompt_Orion.md` + dynamic context.
   - Then it loops:
     
     ```js
     const adapterResponse = await this.adapter.sendMessages(safeMessages, {
       temperature: mode === 'plan' ? 0.7 : 0.3,
       max_tokens: 8192,
       tools: functionDefinitions,
     });

     const { content, toolCalls } = adapterResponse;
     ```

4. **Model adapter: `DS_ChatAdapter` or `GPT41Adapter`**
   - `sendMessages(...)` calls the provider (DeepSeek/OpenAI) with:
     - `messages` from OrionAgent
     - `tools: functionDefinitions` (OpenAI‑style function definitions)
   - It returns:
     
     ```js
     { content: '<LLM reply text>', toolCalls: [...] }
     ```

5. **Tool execution via ToolRunner: `backend/tools/ToolRunner.js`**
   - Back in `OrionAgent.process`, if `toolCalls` exist, it calls:
     
     ```js
     const toolCallResults = await this.handleToolCalls(toolCalls, context);
     ```

   - `OrionAgent` inherits `handleToolCalls` from `BaseAgent`, which now delegates to **ToolRunner**:
     
     ```js
     // BaseAgent
     async handleToolCalls(toolCalls, context) {
       return executeToolCalls(this.tools, toolCalls, context);
     }

     async executeTool(toolCall, context) {
       return executeToolCall(this.tools, toolCall, context);
     }
     ```

   - `ToolRunner` does the heavy lifting:
     
     ```js
     const { parseFunctionCall } = require('./functionDefinitions');

     async function executeToolCall(tools, toolCall, context) {
       const { tool, action, params } = parseFunctionCall(toolCall);

       const toolInstance = tools[tool];
       const fn = toolInstance && typeof toolInstance[action] === 'function'
         ? toolInstance[action].bind(toolInstance)
         : null;

       const argsWithContext = { ...params, context };
       return await fn(argsWithContext);
     }
     ```

   - This is **centralized**: any model that returns tool_calls in the same format can use it.

6. **DatabaseTool agent adapter: `backend/tools/DatabaseToolAgentAdapter.js`**
   - In the Orion tools registry (`backend/tools/registry.js`), Orion gets:
     
     ```js
     Orion: {
       FileSystemTool,
       DatabaseTool: DatabaseToolAgentAdapter,
       DatabaseToolInternal: DatabaseTool,
     },
     ```

   - For a tool_call named `DatabaseTool_get_subtask_full_context`, ToolRunner:
     - Picks `tools.DatabaseTool` → `DatabaseToolAgentAdapter`.
     - Calls its `get_subtask_full_context({ subtask_id, project_id?, context })`.

   - The adapter bridges the LLM args to the existing positional DB API:
     
     ```js
     const { subtask_id: subtaskId, project_id: explicitProjectId, context } = args;

     let projectId;
     if (explicitProjectId) projectId = explicitProjectId.trim();
     else if (context?.projectId) projectId = context.projectId.trim();

     const result = await DatabaseTool.get_subtask_full_context(subtaskId, projectId);
     ```

   - `DatabaseTool.get_subtask_full_context(...)` hits the **real Postgres DB** and returns:
     
     ```js
     {
       ok: true,
       subtask: {
         id,
         external_id,
         title,
         status,
         workflow_stage,
         basic_info,
         instruction,
         pcc,
         tests,
         implementations,
         review,
         ...
       },
     }
     ```

7. **Orion summarizes and responds**
   - OrionAgent gets the tool result from ToolRunner and:
     - Optionally appends a system message like `Tool DatabaseTool_get_subtask_full_context returned: {...}` to the message list.
     - Makes another LLM call to ask for a natural‑language summary.
   - The final `response.content` is returned to the `chatMessages` route, stored in `chat_messages`, and sent back to the frontend.

---

## 2. How to *use* tools as a user (today)

### PLAN vs ACT behavior

- **PLAN mode**
  - Frontend sends **streaming** SSE requests via `streamOrionReply`.
  - Backend uses `orionAgent.processStreaming` + `sendMessagesStreaming`.
  - Streaming pipeline **does not yet execute tools**; it only streams text chunks.

- **ACT mode**
  - Frontend now sends a **non‑streaming JSON POST**.
  - Backend uses `orionAgent.process` (non‑streaming) where ToolRunner + DatabaseTool are wired.
  - This is the mode to use when you want Orion to call tools like `DatabaseTool_get_subtask_full_context`.

### Step‑by‑step: have Orion summarize a DB subtask

1. **Ensure backend + DB are running**
   - Backend: `npm --prefix backend run dev`
   - Frontend: `npm --prefix frontend run dev`
   - Postgres: running with `appdb` and `DATABASE_URL` correctly set.

2. **Open the UI**
   - Visit `http://localhost:6100/`.

3. **Switch to ACT mode in the Chat Panel**
   - In the lower left of Chat Panel, click the **ACT** button so it’s highlighted.

4. **Ask Orion to use the DB tool explicitly**
   - Example prompt:
     
     > "Use `DatabaseTool_get_subtask_full_context` for subtask `2-1-8` in project `P1`. Read its basic_info, instruction, tests, and implementations, then summarize the subtask for me in bullet points."

5. **What should happen**
   - ChatPanel sends a JSON POST (non‑streaming) with `metadata.mode = 'act'`.
   - Orion builds context and calls the LLM with tools attached.
   - The LLM chooses `DatabaseTool_get_subtask_full_context` and emits a tool_call.
   - ToolRunner + DatabaseToolAgentAdapter + DatabaseTool fetch the subtask from Postgres.
   - Orion uses that JSON to craft a summary and returns it as a single response.
   - You see the summary as the ACT response in the chat.

If Orion appears to ignore the tool, you can reinforce it by:
- Naming the tool explicitly in the prompt (as above).
- Mentioning the shorthand format: e.g. "shorthand 2-1-8 which maps to P1-F2-T1-S8".

---

## 3. How to add a new tool (conceptual)

With the new architecture, adding tools is mostly **declarative** and centralized.

1. **Define its schema** in `backend/tools/functionDefinitions.js`:

   ```js
   {
     type: 'function',
     function: {
       name: 'DatabaseTool_list_subtasks_by_status',
       description: 'List subtasks filtered by status across the project.',
       parameters: { ... },
     }
   }
   ```

2. **Implement it** on the backend:
   - DB logic in `DatabaseTool` (if needed), or a new tool module.
   - A thin agent adapter (like `DatabaseToolAgentAdapter`) if you need to bridge args/shape.

3. **Expose it to Orion** in `backend/tools/registry.js`:

   ```js
   Orion: {
     FileSystemTool,
     DatabaseTool: DatabaseToolAgentAdapter,
     // NewTool: NewToolAdapter,
   }
   ```

4. **That’s it** for non‑streaming:
   - Any model adapter (`DS_ChatAdapter`, `GPT41Adapter`, future Gemini adapter) that:
     - Accepts `tools: functionDefinitions` for `sendMessages`, and
     - Returns `toolCalls` in OpenAI function‑calling format

     will feed tool_calls into ToolRunner → the new tool.

No extra streaming vs non‑streaming glue per tool is required. The only remaining one‑time job is adding **streaming tool_call support** in `sendMessagesStreaming` + `OrionAgent.processStreaming` in a future subtask.

---

## 4. Gotchas and current limits

- **Streaming (PLAN mode) still does not execute tools.**
  - If you want Orion to use `DatabaseTool_*` today, keep the Chat Panel in **ACT**.

- **Tests:**
  - `database_tool_agent_adapter.spec.js` now passes and proves the adapter contract.
  - Some unrelated tests (`llm_adapter.spec.js`, `schema_v2.spec.js`) are still RED due to existing adapter/schema mismatches and are not affected by this change.

- **DB safety:**
  - Tests now use `DATABASE_URL_TEST` (cloned `appdb_test`), so destructive tests (like those that `DELETE FROM chat_messages`) no longer wipe your real history in `appdb`.

---

## 5. TL;DR

- **Use ACT mode** in the UI when you want tools (DB, filesystem, etc.).
- Orion’s tool execution is now **centralized** in `ToolRunner`, shared by all agents and adapters.
- `DatabaseTool_get_subtask_full_context` is wired end‑to‑end:
  - Function definition → ToolRunner → DatabaseToolAgentAdapter → DatabaseTool → Postgres.
- Adding new tools mostly means updating `functionDefinitions.js`, the tool implementation, and `tools/registry.js`—the rest of the pipeline stays unchanged.

---

## 6. Tracing & Debugging for Tool Calls and Streaming

This section captures Orions proposed tracing view and how it maps to the current implementation.

### 6.1 Tool Call Lifecycle (Conceptual Dashboard)

```text
TOOL CALL TRACE: DatabaseTool_get_subtask_full_context
┌─────────────────────────────────────────────────────────────┐
│ TOOL CALL TRACE: DatabaseTool_get_subtask_full_context      │
├─────────────────────────────────────────────────────────────┤
│ Timestamp: 2025-12-21T06:36:15.123Z                         │
│ AI Model: deepseek-chat                                     │
│ Session: P1-plan                                            │
├─────────────────────────────────────────────────────────────┤
│ [1] AI GENERATED TOOL CALL: ✅                              │
│     Function: DatabaseTool_get_subtask_full_context         │
│     Arguments: {"subtask_id":"2-1-6"}                       │
│     Raw JSON: {type:"function",function:{name:"Database...}}│
├─────────────────────────────────────────────────────────────┤
│ [2] BACKEND RECEIVED: ❓                                    │
│     Status: ?                                               │
│     Parse Error: ?                                          │
│     Validation: ?                                           │
├─────────────────────────────────────────────────────────────┤
│ [3] TOOL ROUTING: ❓                                         │
│     Handler: DatabaseToolAgentAdapter?                      │
│     Adapter Found: ?                                        │
│     Method Extraction: ?                                    │
├─────────────────────────────────────────────────────────────┤
│ [4] DATABASE TOOL EXECUTION: ❓                             │
│     Method: get_subtask_full_context                        │
│     Args: ["2-1-6"]                                         │
│     ID Normalization: P1-F2-T1-S6?                          │
│     SQL Query: ?                                            │
│     DB Response: ?                                          │
├─────────────────────────────────────────────────────────────┤
│ [5] RESPONSE TO AI: ❓                                       │
│     Formatted: ?                                            │
│     Sent: ?                                                 │
│     AI Received: ?                                          │
└─────────────────────────────────────────────────────────────┘
```

**Mapping to implementation:**
- [1] AI GENERATED TOOL CALL
  - Comes from `DS_ChatAdapter.sendMessages` / `GPT41Adapter.sendMessages` return value (`toolCalls`).
  - For streaming, would come from `sendMessagesStreaming` SSE chunks.
- [3] TOOL ROUTING
  - Implemented via `ToolRunner.executeToolCall` + `this.tools` (registry).
  - Adapter is `DatabaseToolAgentAdapter`.
- [4] DATABASE TOOL EXECUTION
  - Implemented by `DatabaseTool.get_subtask_full_context` and friends.
  - Already logs DB activity separately via ActivityLogTool.
- [2] / [5]
  - Partially implicit today. Additional `TraceService.logEvent` calls can make these explicit.

### 6.2 Streaming‑Specific Debugging View

```text
STREAMING DEBUG PANEL
┌─────────────────────────────────────────────────────────────┐
│ STREAMING DEBUG PANEL                                       │
├─────────────────────────────────────────────────────────────┤
│ Streaming Mode: ✅ Enabled                                  │
│ Tool Calling in Stream: ❓ Unknown                          │
│ Chunk Sequence:                                             │
│   [1] content: "Let me check..."                           │
│   [2] tool_call: DatabaseTool_get_subtask_full_context     │
│   [3] content: "" (empty final chunk)                      │
├─────────────────────────────────────────────────────────────┤
│ OpenAI/DeepSeek Streaming Support:                          │
│   • tool_calls in stream: ✅ Supported                      │
│   • Partial tool calls: ❓                                  │
│   • Tool results in stream: ❓                              │
└─────────────────────────────────────────────────────────────┘
```

**Current state:**
- We **do** send `tools` + `tool_choice: 'auto'` in `sendMessagesStreaming`.
- We **do not yet**:
  - Parse tool_calls out of streaming deltas.
  - Execute tools mid‑stream.
  - Log streaming‑level trace events.

### 6.3 Trace Points We Care About

From Orions sketch, the key checkpoints are:

```js
const TRACE_POINTS = [
  {
    id: 'AI_TOOL_GENERATION',
    check: 'Did AI actually generate tool call in stream?',
    log: 'Raw AI response chunks with tool_calls'
  },
  {
    id: 'STREAM_PARSER',
    check: 'Does stream parser extract tool_calls?',
    log: 'Parser output after each chunk'
  },
  {
    id: 'TOOL_HANDLER_REGISTRATION',
    check: 'Are tools registered for streaming?',
    log: 'Registered tools list with streaming flag'
  },
  {
    id: 'ADAPTER_INVOCATION',
    check: 'Does adapter get called?',
    log: 'Adapter entry with arguments'
  },
  {
    id: 'DATABASE_CONNECTION',
    check: 'Does DB tool execute?',
    log: 'SQL query and response time'
  },
  {
    id: 'RESULT_STREAMING_BACK',
    check: 'Is result sent back to AI?',
    log: 'Tool result chunk sent to stream'
  }
];
```

**How this maps to our code:**
- `AI_TOOL_GENERATION` / `STREAM_PARSER`
  - Extend `DS_ChatAdapter.sendMessagesStreaming` to log `LLM_STREAM_CHUNK` events via `TraceService` when tool_calls appear in SSE deltas.
- `TOOL_HANDLER_REGISTRATION`
  - At the start of `OrionAgent.processStreaming`, log which tools are available from `this.tools`.
- `ADAPTER_INVOCATION`
  - Already covered in non‑streaming via `DatabaseToolAgentAdapter` trace logs.
  - Streaming would reuse the same adapter when we execute tools mid‑stream.
- `DATABASE_CONNECTION`
  - Implicitly covered by DB logs / ActivityLogTool today; can be surfaced in trace events if we want timings.
- `RESULT_STREAMING_BACK`
  - Will be added when we implement streaming tool execution; we can log an event whenever we write a tool result chunk to SSE.

### 6.4 Immediate Debugging Hooks (when we implement streaming tools)

Examples of the kinds of logs we would add:

1. **Raw stream chunk logging (temporary, behind a debug flag)**

```js
// Inside DS_ChatAdapter.sendMessagesStreaming loop
console.log('STREAM CHUNK (raw delta):', JSON.stringify(data));

await TraceService.logEvent({
  projectId: context?.projectId,
  type: TRACE_TYPES.LLM_STREAM_CHUNK,
  source: TRACE_SOURCES.LLM,
  timestamp: Date.now(),
  summary: 'LLM streaming delta',
  details: { hasToolCall: !!delta.tool_calls, delta },
  requestId: context?.requestId,
});
```

2. **Tool registration snapshot**

```js
// At start of OrionAgent.processStreaming
await TraceService.logEvent({
  projectId,
  type: TRACE_TYPES.TOOL_REGISTRATION,
  source: TRACE_SOURCES.AGENT,
  timestamp: Date.now(),
  summary: 'Streaming tool registry for Orion',
  details: { tools: Object.keys(this.tools || {}) },
  requestId: options?.requestId,
});
```

3. **Adapter invocation + DB execution**

These are already logged in `DatabaseToolAgentAdapter` for non‑streaming, and will be reused for streaming tool calls.

4. **Result streaming back**

When we implement streaming tools, we can log when we send tool results down the SSE stream:

```js
// In StreamingService.handleSSE, when writing a tool result event
await TraceService.logEvent({
  projectId,
  type: TRACE_TYPES.TOOL_RESULT_STREAM,
  source: TRACE_SOURCES.AGENT,
  timestamp: Date.now(),
  summary: 'Tool result streamed back to client',
  details: { toolName, truncatedResult: JSON.stringify(result).slice(0, 500) },
  requestId,
});
```

### 6.5 Conceptual Streaming Tool Handler (Future Work)

This is the shape of what well build later for streaming tool_calls. It is **not implemented yet**, but ToolRunner + current tracing are designed to support it:

```js
async function handleStreamWithTools(projectId, userMessage, options) {
  const stream = this.adapter.sendMessagesStreaming(messages, {
    tools: functionDefinitions,
    stream: true,
    tool_choice: 'auto',
    ...options,
  });

  for await (const chunk of stream) {
    // 1. Forward chunk (content) to client
    yield chunk;

    // 2. Detect tool_calls in streaming deltas
    const toolCalls = extractToolCallsFromDelta(chunk);
    for (const toolCall of toolCalls) {
      const results = await this.handleToolCalls([toolCall], { projectId, ...options });
      // 3. Option A: stream tool result back to client as SSE event
      yield { type: 'tool_result', toolCallId: toolCall.id, result: results[0] };

      // 4. Option B: make a follow-up LLM call including the tool result
      // (new API call) if we want the model to continue reasoning.
    }
  }
}
```

---

## 7. TODOs / Next Steps (Streaming + Tracing)

These are the concrete follow‑ups well tackle in future subtasks (e.g. 2‑1‑9 and beyond). They are **not required** for current ACT‑mode tool usage.

- [ ] **Streaming tool_call detection**
  - Extend `DS_ChatAdapter.sendMessagesStreaming` to:
    - Parse SSE deltas into a typed structure.
    - Detect `tool_calls` in `delta.tool_calls`.
    - Log `LLM_STREAM_CHUNK` trace events via `TraceService` when tool_calls appear.

- [ ] **Streaming tool execution via ToolRunner**
  - Update `OrionAgent.processStreaming` to:
    - Intercept tool_call events extracted from streaming deltas.
    - Use `ToolRunner.executeToolCall` with `this.tools` and `context` (same as non‑streaming).
    - Yield `{ type: 'tool_result', ... }` events into the SSE stream (so frontend can display them).

- [ ] **Trace points for streaming lifecycle**
  - Define/extend trace types in `TraceEvent` for:
    - `LLM_STREAM_CHUNK`
    - `TOOL_REGISTRATION`
    - `TOOL_RESULT_STREAM`
  - Add `TraceService.logEvent` calls at:
    - Start of `processStreaming` (tool registry snapshot).
    - Each streamed tool_call detection.
    - Each streamed tool result sent to the client.

- [ ] **Minimal trace dashboard (optional)**
  - Build a small frontend view (or dev‑only page) that:
    - Calls `/api/trace/logs?projectId=P1`.
    - Renders a ladder view similar to the ASCII diagrams above for a given `requestId`.

- [ ] **Frontend support for streamed tool results (optional)**
  - Extend `streamOrionReply` and `ChatPanel` to recognize `{ type: 'tool_result', ... }` SSE events and display them distinctly (e.g., collapsible JSON panel or summarized text).

- [ ] **Tests for trace API and streaming traces**
  - Add tests in `backend/src/_test_/api_trace.spec.js` to:
    - Verify `/api/trace/logs` filtering by `projectId`, `type`, `source`.
    - (Later) verify that streaming tool calls emit the expected trace events.

These TODOs are intentionally incremental: we already have the core ToolRunner + trace infrastructure in place; the next work is mostly about **wiring streaming paths into that same pipeline** and surfacing richer debugging information via `/api/trace/logs` and a small dashboard.

- __Ladder‑style trace visualization__
  - We have a basic timeline + detail view, not the full requestId‑grouped “ladder” view Orion sketched.

- __Frontend support for streamed tool results__
  - `streamOrionReply` / ChatPanel don’t recognize or render `{ type: 'tool_result' }` SSE events (because we don’t emit them yet).

- __Extra trace API tests__
  - `api_trace.spec.js`
