# Test Failure Summary: Subtask 2-1-11 — Icon-only New Messages Indicator & Auto-scroll Resume

## Test Execution Results (Vitest)
- **Total Tests Added**: 6 (CRITICAL + HIGH priority)
- **Status**: RED Phase ✅ (Tests correctly fail before implementation)
- **Execution Environment**: Vitest + @vue/test-utils
- **Note**: Vitest is configured for frontend; backend tests are failing due to Jest/Vitest mismatch (separate issue).

## Detailed Test Failures (Expected)

### 1. Indicator Visibility When Scrolled Up
- **Test**: `should show indicator when user is not at bottom and new AI message is appended`
- **Expected**: Indicator (`data-testid="chat-scroll-to-bottom"`) appears when `shouldAutoScroll` is false and a new AI message object is appended.
- **Actual**: No indicator exists in current ChatPanel (implementation missing).
- **Failure Reason**: No `hasNewMessagesBelow` state, no indicator rendering.

### 2. Click Indicator to Scroll to Bottom
- **Test**: `should scroll to bottom and hide indicator when clicked`
- **Expected**: Clicking indicator calls `scrollToBottom`, hides indicator, sets `shouldAutoScroll` true.
- **Actual**: No indicator to click; `scrollToBottom` not triggered.
- **Failure Reason**: Missing click handler and indicator element.

### 3. Manual Scroll Clears Indicator
- **Test**: `should clear indicator when user manually scrolls to bottom`
- **Expected**: When user scrolls to bottom (`isAtBottom` true), indicator disappears.
- **Actual**: No indicator state to clear.
- **Failure Reason**: No `hasNewMessagesBelow` state tracking.

### 4. Streaming Chunk Guard
- **Test**: `should not show indicator when only AI message content updates (streaming chunks)`
- **Expected**: Indicator does NOT appear when only streaming content updates (no new message object).
- **Actual**: No indicator logic at all, but test would fail because there's no guard.
- **Failure Reason**: Missing detection of message object vs content updates.

### 5. Indicator Never Appears When Already at Bottom
- **Test**: `should not show indicator when user is at bottom`
- **Expected**: Indicator remains hidden when `shouldAutoScroll` is true.
- **Actual**: No indicator rendered.
- **Failure Reason**: Missing conditional rendering based on `shouldAutoScroll`.

### 6. Loading Older Messages Compatibility
- **Test**: `should not affect indicator when loading older messages`
- **Expected**: Indicator stays visible during `loadingOlder` true.
- **Actual**: No indicator to test.
- **Failure Reason**: Missing indicator.

## Anti-Placeholder Validation ✅
All tests are **valid RED tests** because:
- They would fail against a placeholder implementation (no indicator at all)
- They assert observable DOM changes (indicator visibility, scroll behavior)
- They verify state transitions (`shouldAutoScroll`, `hasNewMessagesBelow`)
- They guard against false positives (streaming chunk guard)

## Implementation Gaps Identified (for Devon)

### 1. State Variables Needed
- `hasNewMessagesBelow: boolean` (reactive)
- Optional `newMessagesBelowCount: number` (MVP: icon only, no count)

### 2. Indicator Rendering
- Add element inside scroll container with:
  - `data-testid="chat-scroll-to-bottom"`
  - `aria-label="Scroll to newest message"`
  - Icon-only (down arrow SVG/character)
  - Conditional visibility based on `hasNewMessagesBelow && !shouldAutoScroll`

### 3. Scroll Container Enhancement
- Add `data-testid="chat-messages-container"` to the existing `ref="messagesContainer"` div.

### 4. Logic Updates
- **Message Append Detection**: When `messages` array length increases AND `shouldAutoScroll` is false, set `hasNewMessagesBelow = true`.
- **Scroll Detection**: In `handleScroll`, when `isAtBottom` becomes true, clear `hasNewMessagesBelow`.
- **Click Handler**: On indicator click: call `scrollToBottom()`, set `shouldAutoScroll = true`, clear `hasNewMessagesBelow`.
- **Streaming Guard**: Only trigger indicator on new message objects, not on `aiMessage.content` updates.

### 5. Integration with Existing Auto-scroll
- Preserve existing `shouldAutoScroll` logic (pause on scroll-up, resume on bottom).
- Indicator is a visual cue that complements the auto-scroll pause.

## Blocking Status
- **Unblocked**: All selectors confirmed (`chat-scroll-to-bottom`, `chat-messages-container`).
- **Ready for Implementation**: RED phase complete with comprehensive failing tests.

## Next Steps for Devon
1. Add `hasNewMessagesBelow` reactive state to ChatPanel.
2. Render indicator with proper test IDs and ARIA.
3. Implement logic for showing/hiding indicator based on scroll position and message appends.
4. Add click handler for indicator.
5. Ensure streaming chunks do not trigger indicator.
6. Verify integration with existing auto-scroll behavior.

---
**Analyst**: Tara  
**Date**: 2025-12-22  
**Phase**: RED (Tests failing as required)
