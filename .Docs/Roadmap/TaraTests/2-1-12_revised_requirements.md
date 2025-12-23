# Revised Requirements for Subtask 2-1-12

Based on user clarification:

1. **All user messages are clamped** to ~3 lines by default with Show more/Show less toggle
2. **The latest user message is positioned at the top after clamping** - after sending a message, chat scrolls so newest user message is at top of viewport (block:start)

## Test Cases Required (from user feedback):

### A. Clamp applies only to latest user message
- Arrange: mount ChatPanel with at least 2 user messages; make the last one long
- Assert: the *latest* user message DOM has a clamp class/attribute
- Assert: earlier user messages do NOT have the clamp marker

**Note**: This seems contradictory to "all user message is clamped". Need clarification.

### B. Show more/less only appears when needed
- Long message: assert a toggle button renders (data-testid="user-msg-toggle")
- Short message: assert toggle button does NOT render

### C. Toggle expands and collapses
- Initial: clamped state
- Click "Show more" → assert message container is now expanded and toggle text changes to "Show less"
- Click "Show less" → assert clamped again

### D. Does not break streaming
- Send a message, start streaming AI response
- Assert the clamp/toggle behavior remains correct and AI streaming message still updates

### E. Align latest user message to top on send
- Stub `Element.prototype.scrollIntoView = vi.fn()`
- Send a user message
- Assert `scrollIntoView` was called on the latest user message element with `{ block: 'start' }`
- Assert it is called ONCE on user-send (not repeatedly during streaming chunks)

## Implementation Notes:
- Use CSS class presence or explicit attributes for testability
- Use stable selectors with `data-testid`
- JSDOM can't measure real line counts, so rely on class/attribute assertions
