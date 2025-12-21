# TraceEvent Model and Lifecycle

This document is the **canonical reference** for the TraceEvent model used by Orion trace logging and the future `/api/trace/logs` endpoint.

Related artifacts:
- **Type definition & constants:** `backend/src/services/trace/TraceEvent.js`
- **Contract tests:** `backend/src/_test_/api_trace.spec.js`
- **Subtask spec:** `docs/implementation_prompts/subtask_2-1-7_trace_event_model.json`

---

## 1. TraceEvent Fields (Contract)

A `TraceEvent` is a structured log entry with the following fields:

- `id` *(string | number)* – Opaque unique identifier for the event. Stable for stored events.
- `timestamp` *(string)* – ISO 8601 UTC timestamp when the event occurred.
- `projectId` *(string)* – External project id (e.g. `"P1"`). All events exposed via the API are scoped by project.
- `source` *("user" | "orion" | "tool" | "system")* – Who/what produced the event.
- `type` *(string)* – Coarse-grained category of event, e.g.:
  - `"user_message"`
  - `"orion_response"`
  - `"tool_call"`
  - `"tool_result"`
  - `"llm_call"`
  - `"llm_result"`
  - `"system_error"`
- `direction` *("inbound" | "outbound" | "internal", optional)* – For transport-like events; may be omitted for purely internal events.
- `toolName` *(string, optional)* – Name of the tool for tool-related events (e.g. `"DatabaseTool"`, `"FileSystemTool"`).
- `requestId` *(string, optional)* – Correlation id tying a sequence of events for a single chat turn or request.
- `summary` *(string)* – Short, human-readable description suitable for list views.
- `details` *(object)* – Structured JSON payload with additional metadata; may include **redacted** snippets or summaries.
- `error` *(object, optional)* – Present for error events, shape `{ message: string, code?: string }`.
- `metadata` *(object, optional)* – Implementation-specific fields. Kept small enough for API responses.

> This field set is also captured in the JSDoc typedef in `backend/src/services/trace/TraceEvent.js` and is what Tara’s `api_trace.spec.js` tests assert against.

---

## 2. Event Types & Sources

Canonical `type` values and their typical `source` and emitters:

- `user_message`
  - **source:** `"user"`
  - **emitted by:** `chatMessages` route when a user sends a message.
- `orion_response`
  - **source:** `"orion"`
  - **emitted by:** `OrionAgent` when returning a reply to the user.
- `tool_call`
  - **source:** `"tool"`
  - **emitted by:** `DatabaseToolAgentAdapter`, `FileSystemTool` when a tool is invoked.
- `tool_result`
  - **source:** `"tool"`
  - **emitted by:** tool adapters when a tool returns a result.
- `llm_call`
  - **source:** typically `"orion"` or `"system"`
  - **emitted by:** `OrionAgent` when calling the LLM.
- `llm_result`
  - **source:** `"orion"` or `"system"`
  - **emitted by:** `OrionAgent` when receiving a response from the LLM.
- `system_error`
  - **source:** `"system"`
  - **emitted by:** Any layer when a non-user-facing internal error occurs (e.g., failed trace persistence, adapter failure).

These values are also exposed as `TRACE_SOURCES` and `TRACE_TYPES` in `TraceEvent.js` for reuse by future implementation (B2/B3).

---

## 3. Typical Chat Turn Lifecycle

A single chat turn normally produces a sequence of events:

1. **User sends a message**
   - Event type: `user_message`
   - Source: `user`
   - Emitted by: `backend/src/routes/chatMessages.js`
   - Fields: `projectId`, `timestamp`, `source`, `type`, `summary` (short version of the message), `details` (structured payload), `requestId`.

2. **Orion calls the LLM**
   - Event type: `llm_call`
   - Source: `orion` or `system`
   - Emitted by: `backend/src/agents/OrionAgent.js`
   - Fields: `projectId`, `requestId`, `summary` (e.g. prompt summary), `details` with redacted/ summarized prompt and config.

3. **Orion makes tool calls (optional)**
   - Event type: `tool_call`
   - Source: `tool`
   - Emitted by: `DatabaseToolAgentAdapter`, `FileSystemTool`
   - Fields: `projectId`, `toolName`, `summary` (what the tool is doing), `details` with sanitized arguments.

4. **Tools return results**
   - Event type: `tool_result`
   - Source: `tool`
   - Emitted by: tool adapters
   - Fields: `projectId`, `toolName`, `summary` (high-level outcome), `details` with sanitized/ summarized results.

5. **LLM returns a result**
   - Event type: `llm_result`
   - Source: `orion` or `system`
   - Emitted by: `OrionAgent`
   - Fields: `projectId`, `requestId`, `summary` (short description), `details` with redacted/ summarized response payload.

6. **Orion responds to the user**
   - Event type: `orion_response`
   - Source: `orion`
   - Emitted by: `OrionAgent` / chat route when sending the final reply back to the UI.
   - Fields: `projectId`, `summary` (e.g. first line of reply), `details` (structured content), `requestId`.

Throughout this sequence, `projectId` and `requestId` allow grouping events for a single chat turn and project.

---

## 4. Redaction and Safety Rules

TraceEvents must be safe to expose via the trace API and UI:

- **Must NOT include:**
  - Secrets (API keys, tokens, passwords).
  - Full raw payloads that may contain secrets (full SQL with parameters, entire file contents, full prompts/responses when very large or sensitive).
- **Should include instead:**
  - Short summaries.
  - Truncated snippets.
  - Redacted structures (e.g., replacing sensitive values with `"***"`).

Tara’s tests (`api_trace.spec.js`) treat these redaction rules as part of the contract and will assert that `details` does **not** leak obvious secrets.

---

## 5. API Contract Stub: `GET /api/trace/logs`

B1 defines the contract; B2 will implement it. The expected API shape, as per the spec and tests, is:

**Endpoint**

- `GET /api/trace/logs`

**Query Parameters**

- `projectId` *(required for now)* – external project id, e.g. `"P1"`. All returned events are scoped to this project.
- `type` *(optional)* – filter by event type, e.g. `"user_message"`, `"tool_call"`.
- `source` *(optional)* – filter by source: `"user" | "orion" | "tool" | "system"`.
- `limit` *(optional)* – positive integer, default 50, max 200.
- `offset` *(optional)* – non-negative integer for pagination.

**Response Shape (example)**

```json
{
  "events": [
    {
      "id": "...",
      "timestamp": "2025-01-01T12:00:00.000Z",
      "projectId": "P1",
      "source": "user",
      "type": "user_message",
      "summary": "User asked about file structure",
      "details": { "path": "src/" },
      "metadata": { "requestId": "req-123" }
    }
  ],
  "total": 123
}
```

- `events` – array of `TraceEvent` objects in a stable, deterministic order (B2 will define exact ordering, but tests assume consistency).
- `total` – optional total count (may be `null` if too expensive to compute).

Tara’s tests for B1 expect that when `/api/trace/logs` exists, each event includes at least the core TraceEvent fields; until B2 implements the route, those tests remain RED or skipped by design.

---

## 6. How This Guides Implementation (B2/B3)

- **B2 (backend trace logging & API)** will:
  - Implement a trace logging service that works with `TraceEvent` objects.
  - Instrument `chatMessages` route, `OrionAgent`, `DatabaseToolAgentAdapter`, and `FileSystemTool` to emit TraceEvents according to this model.
  - Implement `GET /api/trace/logs` matching the query parameters and response shape above.

- **B3 (frontend trace dashboard)** will:
  - Use `/api/trace/logs` to render a timeline + details view of events.
  - Rely on `summary`, `type`, `timestamp`, and `source` for list views; `details`/`metadata` for the detail pane.

This document, together with `TraceEvent.js` and `api_trace.spec.js`, forms the locked contract for the trace event model in subtask 2-1-7 (B1).
