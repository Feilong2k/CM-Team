# Implementation Prompt for Devon – P1-F2-T1-S5 (A2 – Frontend streaming client integration)

**Date**: 12/20/2025  
**From**: Tara (TDD Engineer)  
**To**: Devon (Implementation Engineer)  
**Subject**: Implement frontend streaming in ChatPanel to pass updated tests

## Overview

Tara has updated the TDD tests for frontend streaming in `frontend/src/__tests__/ChatPanel.streaming.spec.js`. Your task is to implement the real streaming behavior in `ChatPanel.vue` so that these tests pass.

## Backend Streaming Contract (from 2-1-4 / S4)

- **Endpoint**: `POST http://localhost:3500/api/chat/messages`
- **Streaming trigger**: Include `Accept: text/event-stream` in the request headers.
- **Server‑Sent Events (SSE) format**: Each `data:` line contains a JSON‑encoded event with exactly one of these shapes:
  - `{ "chunk": "..." }` – partial reply text (append to the current AI message)
  - `{ "error": "..." }` – error message; streaming should stop and the UI should show an error
  - `{ "done": true, "fullContent": "..." }` – stream completion; `fullContent` is the final message text (if missing, fall back to accumulated chunks)

The backend persists the final AI message to `chat_messages` after streaming finishes. The frontend must not assume it needs to re‑POST the final content for persistence.

## Test Expectations (from Tara's updated spec)

1. **Streaming request contract**  
   - Send `Accept: text/event-stream` with the POST request.

2. **Incremental AI message updates**  
   - Create a single in‑flight AI message when streaming starts.
   - Append each `event.chunk` to that message as the stream progresses.
   - On `done`, finalize the message text using `event.fullContent` (or concatenated chunks).

3. **Typing/loading indicator during streaming**  
   - Show a typing indicator (`data-testid="typing-indicator"`) while streaming.
   - Remove the indicator on `done` or `error`.

4. **Auto‑scroll behavior (cooperation with C‑tasks)**  
   - When the user is at the bottom, auto‑scroll as the AI message grows (call `scrollToBottom`).
   - When the user has scrolled up, do not forcibly scroll (tests currently focus on the “at bottom” case).

5. **Error handling mid‑stream**  
   - On `event.error`, stop reading the stream, remove the typing indicator, and display an error message (`data-testid="chat-error"`).

6. **Final content presence**  
   - The final AI message in the UI must contain the full concatenated text (matching `fullContent`).

## Implementation Steps

### 1. Create a streaming helper (recommended)

Create `frontend/src/utils/streamOrionReply.js` (or similar) with the following responsibilities:

- Accept parameters: `endpoint`, `payload`, and callbacks (`onChunk`, `onDone`, `onError`).
- Use `fetch` with `Accept: text/event-stream`.
- Read the response body as an SSE stream (decode with `TextDecoder`, parse lines starting with `data:`).
- For each parsed event, dispatch to the appropriate callback.
- Handle network errors and stream termination.

### 2. Update ChatPanel.vue state

Add reactive properties:

- `streamingMessage` (object reference to the currently streaming AI message in the `messages` array)
- `isStreaming` (boolean to control the typing indicator)
- Optionally, `streamError` (string for error display)

### 3. Wire streaming into the send flow

In `handleSendMessage`:

- Keep the existing user message insertion.
- Immediately create an AI message entry (empty content) and store it as the streaming target.
- Set `isStreaming = true`.
- Call the streaming helper with the appropriate payload and callbacks.

### 4. Implement callbacks

- **onChunk(text)**: Append the chunk to `streamingMessage.content`. If `shouldAutoScroll` is true, call `scrollToBottom()`.
- **onDone(fullContent)**: Set `streamingMessage.content` to `fullContent` (or accumulated text). Set `isStreaming = false`.
- **onError(errorMessage)**: Set `isStreaming = false`, store the error, and display an error element.

### 5. Add typing indicator to the template

Add a conditional element in the template that is visible when `isStreaming` is true, with `data-testid="typing-indicator"`.

### 6. Error display

Add a conditional element (e.g., a div with `data-testid="chat-error"`) that shows when an error occurs during streaming.

### 7. Preserve existing behavior

Ensure non‑streaming requests (when streaming is not supported) continue to work as before.

## Success Criteria

- All six tests in `frontend/src/__tests__/ChatPanel.streaming.spec.js` pass (GREEN).
- Existing non‑streaming functionality remains intact.
- The implementation uses real SSE reading (no fake timeouts or mock typing).

## Files to Modify

- `frontend/src/components/ChatPanel.vue` (primary)
- `frontend/src/utils/streamOrionReply.js` (new, optional but recommended)
- No changes to test files.

## Questions?

If any part of Tara's tests appears incompatible with the backend contract, document the mismatch before changing the tests. Otherwise, implement to the spec.

Good luck!
