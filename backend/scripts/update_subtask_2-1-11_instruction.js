// One-off helper to update subtask 2-1-11 instruction payload in DB
// Usage: node backend/scripts/update_subtask_2-1-11_instruction.js

const { DatabaseTool } = require('../tools/DatabaseTool');

async function main() {
  const tool = new DatabaseTool('Orion');

  const instruction = {
    adam: {
      summary:
        'C2 (2-1-11): While user has scrolled up (auto-scroll paused), new messages must still append in real time but viewport must not jump. Show a non-text icon-only indicator (down arrow) when new messages arrive while paused. Clicking the indicator or manually returning to bottom clears it and resumes auto-scroll.',
      decisions_locked: [
        'Auto-scroll pause on scroll-up already implemented; do not redesign.',
        'Indicator must be icon-only (down arrow), no "New messages" text.',
        'No per-chunk indicator/count updates during streaming; only when new message objects are appended.',
        'No counter badge for MVP of C2 (icon-only). We can add an optional count later if needed.',
        'TDD: Tara tests first; Devon implements to satisfy tests.'
      ],
      selectors_locked: {
        scroll_container: {
          description: 'The scrollable messages container div that owns scrollTop/scrollHeight/clientHeight.',
          target: 'Add data-testid="chat-messages-container" on the messages scroll container (the div with ref=messagesContainer).'
        },
        scroll_to_bottom_indicator: {
          description: 'The icon-only indicator shown when new messages arrive while auto-scroll is paused.',
          target: 'Render a button with data-testid="chat-scroll-to-bottom" and aria-label="Scroll to newest message".'
        }
      },
      acceptance_criteria: [
        'When not at bottom and a new AI message is appended/stream starts, viewport stays fixed and indicator appears.',
        'Clicking indicator scrolls to bottom and hides indicator; auto-scroll resumes.',
        'Manual scroll to bottom hides indicator; auto-scroll resumes.',
        'Indicator never appears when already at bottom.',
        'No interference with loading older messages at top.'
      ],
      scope: {
        frontend_only: true,
        files: [
          'frontend/src/components/ChatPanel.vue',
          'frontend/src/__tests__/ChatPanel.streaming.spec.js'
        ]
      }
    },

    tara: {
      goal:
        'Write/extend Vitest tests for ChatPanel to cover the icon-only indicator and resume behavior, using TDD.',
      tasks: [
        {
          name: 'Indicator appears when paused and a new message object is appended',
          details: [
            'Simulate user scrolled away from bottom so shouldAutoScroll becomes false (trigger handleScroll with appropriate scrollTop/scrollHeight/clientHeight).',
            'Append/push a new AI message object (or simulate handleSendMessage creating AI placeholder) while paused.',
            'Assert indicator exists (prefer data-testid or aria-label such as aria-label="Scroll to newest message").',
            'Assert viewport did not jump (scrollTop unchanged).'
          ]
        },
        {
          name: 'Clicking indicator scrolls to bottom, clears indicator, and re-enables auto-scroll',
          details: [
            'With indicator visible, click it.',
            'Assert scrollTop is now at bottom (or scrollToBottom called / scrollTop set near scrollHeight).',
            'Assert indicator hidden after click.',
            'Append another message and assert auto-scroll happens again.'
          ]
        },
        {
          name: 'Manual scroll to bottom clears indicator',
          details: [
            'With indicator visible, simulate scrolling to bottom (handleScroll sets shouldAutoScroll true).',
            'Assert indicator clears without clicking.'
          ]
        },
        {
          name: 'Streaming guard: do not treat SSE chunks as new messages',
          details: [
            'Simulate streaming by updating aiMessage.content multiple times without pushing a new message object.',
            'Assert indicator/count does not increment per chunk (no flicker/spam).',
            'If maintaining a count, ensure it increments once per new message object, not per chunk.'
          ]
        },
        {
          name: 'Regression: infinite scroll older messages does not accidentally clear/set indicator',
          details: [
            'Simulate loadOlderMessages path (loadingOlder true) and ensure shouldAutoScroll logic does not wrongly clear indicator unless user is at bottom.'
          ]
        }
      ],
      notes: [
        'Keep tests resilient: identify indicator via aria-label/data-testid, not text content.',
        'Prefer asserting state transitions over pixel-perfect layout.'
      ]
    },

    devon: {
      goal:
        'Implement icon-only down-arrow indicator and resume behavior in ChatPanel without changing the existing pause-on-scroll-up behavior.',
      implementation_steps: [
        'Add reactive state: hasNewMessagesBelow boolean (and optional newMessagesBelowCount).',
        'When messages array length increases and shouldAutoScroll is false, set hasNewMessagesBelow true (and increment count once per appended message object).',
        'Clear hasNewMessagesBelow (and reset count) when user returns to bottom (isAtBottom true) or after clicking indicator.',
        'Render a small floating button inside the scroll container (bottom-right or above input) with a down-arrow icon (SVG or simple character). No "New messages" text.',
        'Add aria-label="Scroll to newest message" and/or data-testid="chat-scroll-to-bottom" for testing.',
        'On click: call scrollToBottom(); set shouldAutoScroll true; clear hasNewMessagesBelow.'
      ],
      pitfalls: [
        'Do not flip/increment indicator on every streaming chunk (aiMessage.content updates). Only react to message object insertion.',
        'Do not break loadOlderMessages scroll preservation.',
        'Ensure no overlap with input area; keep visual consistent with neon theme.'
      ]
    }
  };

  await tool.update_subtask_sections(
    '2-1-11',
    { instruction },
    'Adam: Added TDD-first specs for C2 icon-only new-messages indicator + resume auto-scroll.'
  );

  const updated = await tool.get_subtask_full_context('2-1-11', 'P1');
  console.log(
    JSON.stringify(
      {
        ok: updated.ok,
        external_id: updated.subtask.external_id,
        title: updated.subtask.title,
        instruction: updated.subtask.instruction
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
