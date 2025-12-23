import { mount, flushPromises } from '@vue/test-utils'
// Vitest globals are enabled via vitest.config.js (test.globals = true)
// so we rely on global describe/it/expect/vi to avoid runner import issues.
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
})
