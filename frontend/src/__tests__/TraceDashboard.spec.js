import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TraceDashboard from '../components/TraceDashboard.vue'

// Helper to create a mock JSON response
function mockJSONResponse(data, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  }
}

describe('TraceDashboard.vue – Trace dashboard timeline and details', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('renders a timeline list of events with type, timestamp, and summary', async () => {
    const events = [
      {
        id: 'evt-1',
        timestamp: '2025-12-21T06:36:15.123Z',
        projectId: 'P1',
        source: 'agent',
        type: 'tool_call',
        summary: 'DatabaseTool_get_subtask_full_context call',
        details: { subtaskId: '2-1-6' },
        metadata: { requestId: 'req-1' }
      },
      {
        id: 'evt-2',
        timestamp: '2025-12-21T06:36:16.000Z',
        projectId: 'P1',
        source: 'tool',
        type: 'tool_result',
        summary: 'DatabaseTool_get_subtask_full_context result',
        details: { ok: true },
        metadata: { requestId: 'req-1' }
      }
    ]

    global.fetch.mockResolvedValueOnce(mockJSONResponse({ events }))

    const wrapper = mount(TraceDashboard, {
      props: { projectId: 'P1' }
    })

    await flushPromises()

    const items = wrapper.findAll('[data-testid="trace-event-item"]')
    expect(items.length).toBe(2)

    // First item should show type, timestamp, and summary text
    const firstText = items[0].text()
    expect(firstText).toContain('tool_call')
    expect(firstText).toContain('2025-12-21T06:36:15.123Z')
    expect(firstText).toContain('DatabaseTool_get_subtask_full_context call')
  })

  it('shows a detail pane when a timeline item is clicked', async () => {
    const events = [
      {
        id: 'evt-1',
        timestamp: '2025-12-21T06:36:15.123Z',
        projectId: 'P1',
        source: 'agent',
        type: 'tool_call',
        summary: 'DatabaseTool_get_subtask_full_context call',
        details: { subtaskId: '2-1-6' },
        metadata: { requestId: 'req-1' }
      }
    ]

    global.fetch.mockResolvedValueOnce(mockJSONResponse({ events }))

    const wrapper = mount(TraceDashboard, {
      props: { projectId: 'P1' }
    })

    await flushPromises()

    const items = wrapper.findAll('[data-testid="trace-event-item"]')
    expect(items.length).toBe(1)

    // Click the item to select it
    await items[0].trigger('click')
    await flushPromises()

    const detail = wrapper.find('[data-testid="trace-event-detail"]')
    expect(detail.exists()).toBe(true)

    // Detail pane should include key fields and a JSON snippet
    const detailText = detail.text()
    expect(detailText).toContain('tool_call')
    expect(detailText).toContain('DatabaseTool_get_subtask_full_context call')
    expect(detailText).toContain('subtaskId')
    expect(detailText).toContain('2-1-6')
  })

  it('supports manual refresh and preserves selected event when it still exists', async () => {
    const initialEvents = [
      {
        id: 'evt-1',
        timestamp: '2025-12-21T06:36:15.123Z',
        projectId: 'P1',
        source: 'agent',
        type: 'tool_call',
        summary: 'First call',
        details: { subtaskId: '2-1-6' },
        metadata: { requestId: 'req-1' }
      }
    ]

    const updatedEvents = [
      // Same event id, updated summary
      {
        id: 'evt-1',
        timestamp: '2025-12-21T06:36:15.123Z',
        projectId: 'P1',
        source: 'agent',
        type: 'tool_call',
        summary: 'First call (updated)',
        details: { subtaskId: '2-1-6' },
        metadata: { requestId: 'req-1' }
      },
      // New event
      {
        id: 'evt-2',
        timestamp: '2025-12-21T06:36:20.000Z',
        projectId: 'P1',
        source: 'tool',
        type: 'tool_result',
        summary: 'Result',
        details: { ok: true },
        metadata: { requestId: 'req-1' }
      }
    ]

    global.fetch
      .mockResolvedValueOnce(mockJSONResponse({ events: initialEvents }))
      .mockResolvedValueOnce(mockJSONResponse({ events: updatedEvents }))

    const wrapper = mount(TraceDashboard, {
      props: { projectId: 'P1' }
    })

    await flushPromises()

    // Select the first event
    let items = wrapper.findAll('[data-testid="trace-event-item"]')
    expect(items.length).toBe(1)
    await items[0].trigger('click')
    await flushPromises()

    // Trigger manual refresh
    const refreshBtn = wrapper.find('[data-testid="trace-refresh-button"]')
    expect(refreshBtn.exists()).toBe(true)
    await refreshBtn.trigger('click')
    await flushPromises()

    // Now we should have two events
    items = wrapper.findAll('[data-testid="trace-event-item"]')
    expect(items.length).toBe(2)

    // Detail pane should still be showing evt-1 (updated summary)
    const detail = wrapper.find('[data-testid="trace-event-detail"]')
    expect(detail.exists()).toBe(true)
    const detailText = detail.text()
    expect(detailText).toContain('First call (updated)')
  })

  it('shows an inline error message when the API request fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error')
    })

    const wrapper = mount(TraceDashboard, {
      props: { projectId: 'P1' }
    })

    await flushPromises()

    const error = wrapper.find('[data-testid="trace-error"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toMatch(/Internal Server Error|Failed to load trace logs/i)
  })

  // ===========================================================================
  // Phase 5 UI Behavior Tests (RED Phase - Must Fail with Current Implementation)
  // ===========================================================================

  describe('Phase 5: Human-readable trace content with markdown and snippets', () => {
    it('renders markdown-formatted content for textual details instead of raw JSON', async () => {
      const events = [
        {
          id: 'evt-md-1',
          timestamp: '2025-12-21T06:36:15.123Z',
          projectId: 'P1',
          source: 'agent',
          type: 'llm_call',
          summary: 'System prompt with markdown',
          details: {
            systemPrompt: '# System\nYou are Orion.\n- First item\n- Second item\n\n**Important** note.',
            content: 'This is a regular content field'
          },
          metadata: { requestId: 'req-md-1' }
        }
      ]

      global.fetch.mockResolvedValueOnce(mockJSONResponse({ events }))

      const wrapper = mount(TraceDashboard, {
        props: { projectId: 'P1' }
      })

      await flushPromises()

      const items = wrapper.findAll('[data-testid="trace-event-item"]')
      expect(items.length).toBe(1)
      await items[0].trigger('click')
      await flushPromises()

      const detail = wrapper.find('[data-testid="trace-event-detail"]')
      expect(detail.exists()).toBe(true)

      // Test should fail with current implementation (raw JSON in <pre>)
      // When markdown is implemented, the raw markdown syntax should NOT appear
      const detailHtml = detail.html()
      
      // Current behavior: raw JSON with markdown syntax visible
      // Expected behavior: markdown rendered as HTML
      // This test should fail until markdown rendering is implemented
      expect(detailHtml).not.toContain('# System')
      expect(detailHtml).not.toContain('- First item')
      expect(detailHtml).not.toContain('**Important**')
      
      // Instead, we should see HTML elements for markdown
      // Note: We're not testing specific HTML structure, just that raw markdown is not shown
      // The actual implementation should use the renderMarkdown utility
    })

    it('shows only first ~5 lines of long content with "Show more" control', async () => {
      // Create a long text with more than 10 lines
      const longText = Array.from({ length: 15 }, (_, i) => `Line ${i + 1}: Some content here`).join('\n')
      
      const events = [
        {
          id: 'evt-long-1',
          timestamp: '2025-12-21T06:36:15.123Z',
          projectId: 'P1',
          source: 'agent',
          type: 'llm_result',
          summary: 'Long LLM response',
          details: {
            content: longText,
            systemPrompt: 'Short system prompt'
          },
          metadata: { requestId: 'req-long-1' }
        }
      ]

      global.fetch.mockResolvedValueOnce(mockJSONResponse({ events }))

      const wrapper = mount(TraceDashboard, {
        props: { projectId: 'P1' }
      })

      await flushPromises()

      const items = wrapper.findAll('[data-testid="trace-event-item"]')
      expect(items.length).toBe(1)
      await items[0].trigger('click')
      await flushPromises()

      const detail = wrapper.find('[data-testid="trace-event-detail"]')
      expect(detail.exists()).toBe(true)

      // Test should fail with current implementation (shows all content)
      // When snippet behavior is implemented:
      // 1. Only first ~5 lines should be visible initially
      // 2. "Show more" button should be present
      // 3. Clicking "Show more" should reveal all content
      
      const detailText = detail.text()
      
      // Initially, content beyond line 5 should NOT be visible
      expect(detailText).not.toContain('Line 6:')
      expect(detailText).not.toContain('Line 10:')
      expect(detailText).not.toContain('Line 15:')
      
      // "Show more" button should be present
      const showMoreButton = detail.find('[data-testid="show-more-button"]')
      expect(showMoreButton.exists()).toBe(true)
      expect(showMoreButton.text()).toMatch(/Show more/i)
      
      // Click "Show more"
      await showMoreButton.trigger('click')
      await flushPromises()
      
      // After clicking, all content should be visible
      const updatedDetailText = wrapper.find('[data-testid="trace-event-detail"]').text()
      expect(updatedDetailText).toContain('Line 6:')
      expect(updatedDetailText).toContain('Line 10:')
      expect(updatedDetailText).toContain('Line 15:')
      
      // Button should change to "Show less"
      const showLessButton = detail.find('[data-testid="show-less-button"]')
      expect(showLessButton.exists()).toBe(true)
      expect(showLessButton.text()).toMatch(/Show less/i)
    })

    it('renders prompt context section with structured format instead of raw JSON', async () => {
      const events = [
        {
          id: 'evt-prompt-1',
          timestamp: '2025-12-21T06:36:15.123Z',
          projectId: 'P1',
          source: 'agent',
          type: 'llm_call',
          summary: 'LLM call with system prompt and messages',
          details: {
            systemPrompt: 'You are Orion, an AI assistant.',
            messages: [
              { role: 'user', content: 'Hello, how are you?' },
              { role: 'assistant', content: 'I am doing well, thank you!' }
            ]
          },
          metadata: { requestId: 'req-prompt-1' }
        }
      ]

      global.fetch.mockResolvedValueOnce(mockJSONResponse({ events }))

      const wrapper = mount(TraceDashboard, {
        props: { projectId: 'P1' }
      })

      await flushPromises()

      const items = wrapper.findAll('[data-testid="trace-event-item"]')
      expect(items.length).toBe(1)
      await items[0].trigger('click')
      await flushPromises()

      const detail = wrapper.find('[data-testid="trace-event-detail"]')
      expect(detail.exists()).toBe(true)

      // Test should fail with current implementation (raw JSON in <pre>)
      // When prompt context is properly rendered:
      // 1. Should show "Prompt Context" section
      // 2. Should NOT show raw JSON with "systemPrompt" and "messages" keys
      // 3. Should show structured, readable representation
      
      const detailText = detail.text()
      
      // Should have "Prompt Context" section
      expect(detailText).toContain('Prompt Context')
      
      // Should NOT show raw JSON structure
      expect(detailText).not.toContain('"systemPrompt":')
      expect(detailText).not.toContain('"messages":')
      expect(detailText).not.toContain('"role":')
      expect(detailText).not.toContain('"content":')
      
      // Should show readable content
      expect(detailText).toContain('You are Orion, an AI assistant.')
      expect(detailText).toContain('Hello, how are you?')
      expect(detailText).toContain('I am doing well, thank you!')
      
      // Should indicate roles (user/assistant) in readable format
      expect(detailText).toContain('user:')
      expect(detailText).toContain('assistant:')
    })

    it('applies snippet behavior to prompt context section for long content', async () => {
      // Create long system prompt and messages
      const longSystemPrompt = Array.from({ length: 12 }, (_, i) => `System instruction line ${i + 1}`).join('\n')
      const longMessage = Array.from({ length: 8 }, (_, i) => `Message content line ${i + 1}`).join('\n')
      
      const events = [
        {
          id: 'evt-long-prompt-1',
          timestamp: '2025-12-21T06:36:15.123Z',
          projectId: 'P1',
          source: 'agent',
          type: 'llm_call',
          summary: 'LLM call with long prompt context',
          details: {
            systemPrompt: longSystemPrompt,
            messages: [
              { role: 'user', content: 'Short question' },
              { role: 'assistant', content: longMessage }
            ]
          },
          metadata: { requestId: 'req-long-prompt-1' }
        }
      ]

      global.fetch.mockResolvedValueOnce(mockJSONResponse({ events }))

      const wrapper = mount(TraceDashboard, {
        props: { projectId: 'P1' }
      })

      await flushPromises()

      const items = wrapper.findAll('[data-testid="trace-event-item"]')
      expect(items.length).toBe(1)
      await items[0].trigger('click')
      await flushPromises()

      const detail = wrapper.find('[data-testid="trace-event-detail"]')
      expect(detail.exists()).toBe(true)

      // Test should fail with current implementation (shows all content)
      // When snippet behavior is implemented for prompt context:
      // 1. Long system prompt should be truncated to ~5 lines initially
      // 2. Long message content should be truncated to ~5 lines initially
      // 3. Should have "Show more" controls for each truncated section
      
      const detailText = detail.text()
      
      // Initially, long content beyond line 5 should NOT be visible
      expect(detailText).not.toContain('System instruction line 6')
      expect(detailText).not.toContain('System instruction line 12')
      expect(detailText).not.toContain('Message content line 6')
      expect(detailText).not.toContain('Message content line 8')
      
      // Should have "Show more" button for prompt context
      const promptShowMore = detail.find('[data-testid="prompt-context-show-more"]')
      expect(promptShowMore.exists()).toBe(true)
    })

    it('groups events by requestId in the timeline with visual indicators', async () => {
      const events = [
        {
          id: 'evt-group-1',
          timestamp: '2025-12-21T06:36:15.123Z',
          projectId: 'P1',
          source: 'agent',
          type: 'tool_call',
          summary: 'First tool call in request A',
          details: { tool: 'DatabaseTool' },
          metadata: { requestId: 'req-a' }
        },
        {
          id: 'evt-group-2',
          timestamp: '2025-12-21T06:36:16.000Z',
          projectId: 'P1',
          source: 'tool',
          type: 'tool_result',
          summary: 'Tool result for request A',
          details: { ok: true },
          metadata: { requestId: 'req-a' }
        },
        {
          id: 'evt-group-3',
          timestamp: '2025-12-21T06:36:17.000Z',
          projectId: 'P1',
          source: 'agent',
          type: 'tool_call',
          summary: 'Tool call in different request B',
          details: { tool: 'FileSystemTool' },
          metadata: { requestId: 'req-b' }
        }
      ]

      global.fetch.mockResolvedValueOnce(mockJSONResponse({ events }))

      const wrapper = mount(TraceDashboard, {
        props: { projectId: 'P1' }
      })

      await flushPromises()

      // Test should fail with current implementation (no grouping)
      // When requestId grouping is implemented:
      // 1. Events with same requestId should be visually grouped
      // 2. Groups should be clearly separated from other groups
      // 3. RequestId should be displayed as a label or heading
      
      const timeline = wrapper.find('.w-1\\/4') // Left pane selector
      expect(timeline.exists()).toBe(true)
      
      // Should show requestId labels/headings
      const timelineHtml = timeline.html()
      expect(timelineHtml).toContain('req-a')
      expect(timelineHtml).toContain('req-b')
      
      // Should have visual grouping elements
      const groupElements = wrapper.findAll('[data-testid="request-group"]')
      expect(groupElements.length).toBe(2) // Two request groups
      
      // Each group should contain its events
      const firstGroup = groupElements[0]
      expect(firstGroup.text()).toContain('First tool call in request A')
      expect(firstGroup.text()).toContain('Tool result for request A')
      expect(firstGroup.text()).not.toContain('Tool call in different request B')
    })
  })
})
