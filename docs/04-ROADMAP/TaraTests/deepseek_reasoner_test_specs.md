# Test Specifications: DeepSeek Reasoner Adapter & Trace Integration

## Overview
This document provides test specifications for verifying the DeepSeek Reasoner adapter as the primary DeepSeek adapter, its response shape, streaming reasoning behavior, and reasoning persistence in trace events.

## 1. Adapter Factory Selection (`backend/src/adapters/index.js`)

### Test Case 1.1: Provider Selection - DeepSeek/DeepSeekReasoner
- **ID**: FACTORY-001
- **File(s) under test**: `backend/src/adapters/index.js`
- **Setup**:
  - Set `process.env.ORION_MODEL_PROVIDER = 'DeepSeek'`
  - Set `process.env.DEEPSEEK_API_KEY = 'test-key'`
  - Mock `validateDeepSeekConfig` to succeed
- **Steps**:
  1. Call `createAdapter()`
  2. Inspect the returned instance
- **Expected Results**:
  - Returns an instance of `DS_ReasonerAdapter`
  - No errors thrown
  - Same behavior for `ORION_MODEL_PROVIDER='DeepSeekReasoner'` (case-insensitive)

### Test Case 1.2: Provider Selection - DeepSeekChat
- **ID**: FACTORY-002
- **File(s) under test**: `backend/src/adapters/index.js`
- **Setup**:
  - Set `process.env.ORION_MODEL_PROVIDER = 'DeepSeekChat'`
  - Set `process.env.DEEPSEEK_API_KEY = 'test-key'`
- **Steps**:
  1. Call `createAdapter()`
  2. Inspect the returned instance
- **Expected Results**:
  - Returns an instance of `DS_ChatAdapter`
  - No errors thrown

### Test Case 1.3: Provider Selection - OpenAI
- **ID**: FACTORY-003
- **File(s) under test**: `backend/src/adapters/index.js`
- **Setup**:
  - Set `process.env.ORION_MODEL_PROVIDER = 'OpenAI'`
  - Set `process.env.OPENAI_API_KEY = 'test-key'`
- **Steps**:
  1. Call `createAdapter()`
  2. Inspect the returned instance
- **Expected Results**:
  - Returns an instance of `GPT41Adapter`
  - No errors thrown

### Test Case 1.4: Missing API Key Error
- **ID**: FACTORY-004
- **File(s) under test**: `backend/src/adapters/index.js`
- **Setup**:
  - Set `process.env.ORION_MODEL_PROVIDER = 'DeepSeek'`
  - Unset `DEEPSEEK_API_KEY` or set to empty string
- **Steps**:
  1. Call `createAdapter()`
- **Expected Results**:
  - Throws a clear, descriptive error about missing `DEEPSEEK_API_KEY`
  - Error message includes guidance to set the environment variable

## 2. DS_ReasonerAdapter Response Shape (`backend/src/adapters/DS_ReasonerAdapter.js`)

### Test Case 2.1: Non-streaming Response with Reasoning + Tool Calls
- **ID**: RESPONSE-001
- **File(s) under test**: `backend/src/adapters/DS_ReasonerAdapter.js`
- **Setup**:
  - Mock `fetch` to return a successful response with:
    - `choices[0].message.content = "final answer text"`
    - `choices[0].message.tool_calls = [{ id: "call_1", type: "function", function: { name: "test", arguments: "{}" } }]`
    - `choices[0].message.reasoning_content = "chain of thought text"`
  - Instantiate `DS_ReasonerAdapter` with valid config
- **Steps**:
  1. Call `sendMessages()` with any valid messages array
  2. Capture the returned object
- **Expected Results**:
  - Returned object has shape: `{ content, toolCalls, reasoningContent }`
  - `content` equals "final answer text"
  - `toolCalls` array matches the mocked `tool_calls`
  - `reasoningContent` equals "chain of thought text"

### Test Case 2.2: Non-streaming Response without Reasoning
- **ID**: RESPONSE-002
- **File(s) under test**: `backend/src/adapters/DS_ReasonerAdapter.js`
- **Setup**:
  - Mock `fetch` to return a successful response with:
    - `choices[0].message.content = "answer"`
    - `choices[0].message.tool_calls` may be present or empty
    - No `reasoning_content` field in the message
  - Instantiate adapter with valid config
- **Steps**:
  1. Call `sendMessages()` with valid messages
  2. Capture the returned object
- **Expected Results**:
  - Returned object has `reasoningContent: null`
  - `content` and `toolCalls` are correctly parsed

### Test Case 2.3: Invalid Response Shape Handling
- **ID**: RESPONSE-003
- **File(s) under test**: `backend/src/adapters/DS_ReasonerAdapter.js`
- **Setup**:
  - Mock `fetch` to return a response missing `choices` or with malformed `choices[0].message`
  - Instantiate adapter with valid config
- **Steps**:
  1. Call `sendMessages()` with valid messages
- **Expected Results**:
  - Adapter throws a clear error (not silent failure)
  - Error message indicates invalid API response structure

## 3. Streaming Reasoning Behavior

### Test Case 3.1: Streaming Yields Reasoning, Content, and Tool Call Events
- **ID**: STREAM-001
- **File(s) under test**: `backend/src/adapters/DS_ReasonerAdapter.js`
- **Setup**:
  - Mock `fetch` to return a stream of SSE events containing:
    - `delta.reasoning_content` chunks
    - `delta.content` chunks
    - `delta.tool_calls` array
  - Instantiate adapter with valid config
- **Steps**:
  1. Call `sendMessagesStreaming()` with valid messages
  2. Collect all yielded events
- **Expected Results**:
  - Events include:
    - `{ reasoningChunk: "<partial reasoning text>" }`
    - `{ chunk: "<partial content text>" }`
    - `{ toolCalls: [/* raw tool_calls delta */] }`
  - Final event: `{ done: true, fullContent: "<concatenated>", fullReasoning: "<concatenated>" }`

### Test Case 3.2: Duplicate Delta Suppression
- **ID**: STREAM-002
- **File(s) under test**: `backend/src/adapters/DS_ReasonerAdapter.js`
- **Setup**:
  - Mock `fetch` to return a stream with consecutive identical `delta.content` or `delta.reasoning_content`
  - Instantiate adapter with valid config
- **Steps**:
  1. Call `sendMessagesStreaming()` with valid messages
  2. Collect all yielded events
- **Expected Results**:
  - Identical consecutive deltas are not emitted twice
  - Only unique consecutive chunks appear in the stream

### Test Case 3.3: Streaming Error Handling
- **ID**: STREAM-003
- **File(s) under test**: `backend/src/adapters/DS_ReasonerAdapter.js`
- **Setup**:
  - Mock `fetch` to return a failing response (e.g., 429 rate limit)
  - Instantiate adapter with valid config
- **Steps**:
  1. Call `sendMessagesStreaming()` with valid messages
- **Expected Results**:
  - Adapter throws an error after retries exhausted
  - Error message includes API status and details if available

## 4. Reasoning Persistence in Trace

### Test Case 4.1: Reasoning Stored in Trace Events (Integration)
- **ID**: TRACE-001
- **File(s) under test**: 
  - `backend/src/adapters/DS_ReasonerAdapter.js`
  - `backend/src/services/trace/TraceService.js`
  - Agent layer (OrionAgentV2 or test harness)
- **Setup**:
  - Configure environment to use DeepSeek Reasoner (`ORION_MODEL_PROVIDER=DeepSeek`)
  - Use a test database with `trace_events` table
  - Mock DeepSeek API to return `reasoning_content: "test reasoning text"`
  - Ensure the adapter is `DS_ReasonerAdapter`
- **Steps**:
  1. Process a request through the chat route or test harness that goes through TraceService
  2. Query the `trace_events` table for the generated trace event
- **Expected Results**:
  - At least one trace event has `details.reasoning` field populated
  - The `details.reasoning` contains "test reasoning text" (or a recognizable substring)
  - Field is non-empty when Reasoner is used

### Test Case 4.2: Non-Reasoner Adapters Do Not Store Reasoning
- **ID**: TRACE-002
- **File(s) under test**: 
  - `backend/src/adapters/index.js`
  - `backend/src/services/trace/TraceService.js`
  - Agent layer
- **Setup**:
  - Set `ORION_MODEL_PROVIDER=OpenAI` (or other non‑Reasoner adapter)
  - Mock OpenAI API to return a response without `reasoning_content`
  - Use test database
- **Steps**:
  1. Process a request through the same test harness
  2. Query `trace_events` for the generated trace event
- **Expected Results**:
  - Trace events do not contain a `details.reasoning` field (or it is `null`/`undefined`)
  - This confirms reasoning traces are specific to Reasoner path

## 5. Temperature / Mode Sanity (Optional)

### Test Case 5.1: Temperature Passed from Agent to Adapter
- **ID**: TEMP-001
- **File(s) under test**: 
  - `backend/src/adapters/DS_ReasonerAdapter.js`
  - Agent layer (e.g., OrionAgentV2)
- **Setup**:
  - Instantiate `DS_ReasonerAdapter` with valid config
  - Mock `fetch` to capture the request body
- **Steps**:
  1. Call `sendMessages()` with `temperature: 1.3` in options
  2. Inspect the mocked fetch call's request body
- **Expected Results**:
  - The request body includes `"temperature": 1.3`
  - Adapter does not override with a hardcoded value

### Test Case 5.2: Default Temperature for ACT Mode
- **ID**: TEMP-002
- **File(s) under test**: `backend/src/adapters/DS_ReasonerAdapter.js`
- **Setup**:
  - Instantiate adapter with valid config
  - Mock `fetch` to capture request body
- **Steps**:
  1. Call `sendMessages()` without providing `temperature` in options
  2. Inspect the request body
- **Expected Results**:
  - The request body includes `"temperature": 0.0` (default for ACT mode)
  - This default is set by the adapter when temperature is undefined

## Test Implementation Notes

- All tests should be written in Jest.
- Mock external dependencies (fetch, database) appropriately.
- Unit tests should focus on single components; integration tests should verify cross‑component behavior.
- For trace persistence tests, use a test database that can be reset between tests.
- Ensure tests fail against placeholder implementations (e.g., hardcoded returns, missing logic).
- Follow the Red‑Green‑Refactor cycle: tests must fail initially, then pass after correct implementation.

## Files to Create

1. `backend/tests/adapters/index.spec.js` – Factory selection tests
2. `backend/tests/adapters/DS_ReasonerAdapter.spec.js` – Adapter unit tests
3. `backend/tests/integration/reasoning_trace.spec.js` – Trace integration tests

These specifications provide Devon with clear, actionable test cases to implement. After implementation, Tara can verify that the tests pass only when the real logic is in place.
