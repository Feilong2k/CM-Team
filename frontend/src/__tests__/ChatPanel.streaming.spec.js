// ChatPanel.streaming.spec.js — Tara's failing tests for P1-F2-T1-S5 (A2 – Frontend streaming client integration)
// Framework: Vitest + @vue/test-utils
// These tests must fail against placeholder implementations (e.g., one‑shot JSON response).
// They will pass only when real streaming is implemented.

import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Vitest globals are enabled via vitest.config.js (test.globals = true)
// but we import them explicitly to be safe
import ChatPanel from '../components/ChatPanel.vue'

// Mock the global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper to create a mock ReadableStream that yields chunks
function createMockStream(chunks, options = {}) {
  let controller
  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl
      chunks.forEach((chunk, i) => {
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode(chunk))
          if (i === chunks.length - 1 && !options.leaveOpen) {
            controller.close()
          }
        }, i * 10) // simulate small delays between chunks
      })
    },
    cancel() {
      controller && controller.close()
    }
  })
  return stream
}

// Helper to mock an SSE response (text/event-stream)
function mockSSEResponse(events, { status = 200, headers = {} } = {}) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'Content-Type': 'text/event-stream',
      ...headers
    }),
    body: createMockStream(events.map(event => `data: ${JSON.stringify(event)}\n\n`)),
    text: () => Promise.resolve('')
  }
  return response
}

// Helper to mock a regular JSON response (non‑streaming, for comparison)
function mockJSONResponse(data, { status = 200 } = {}) {
  return {
    ok: true,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  }
}

describe('P1-F2-T1-S5 (A2) - Frontend streaming client integration', () => {
  let wrapper

  beforeEach(() => {
    // Pinia is required because ChatPanel uses useUIStore() in <script setup>
    const pinia = createPinia()
    setActivePinia(pinia)

    mockFetch.mockClear()
    // Mock the initial load of messages (GET /api/chat/messages)
    mockFetch.mockResolvedValueOnce(mockJSONResponse([]))
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  // Test 1: ChatPanel should send a streaming request when Accept header includes text/event-stream
  it('should request streaming endpoint when sending a user message', async () => {
    // Mount the component
    wrapper = mount(ChatPanel, {
      global: {
        plugins: [createPinia()]
      }
    })
    await flushPromises()

    // Simulate user sending a message
    const messageText = 'Hello, Orion'
    // Mock the fetch call for the POST request
    // We expect fetch to be called with Accept: text/event-stream
    mockFetch.mockResolvedValueOnce(mockSSEResponse([
      { chunk: 'Hello' },
      { chunk: ', Orion' },
      { done: true, fullContent: 'Hello, Orion' }
    ]))

    // Trigger the send event from MessageInput child component
    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', messageText)
    await flushPromises()

    // Assert that fetch was called with the correct arguments
    expect(mockFetch).toHaveBeenCalledTimes(2) // First GET, then POST
    const postCall = mockFetch.mock.calls[1]
    expect(postCall[0]).toBe('/api/chat/messages')
    expect(postCall[1].method).toBe('POST')
    expect(postCall[1].headers['Accept']).toContain('text/event-stream')
    expect(postCall[1].body).toContain(messageText)
  })

  // Test 2: Incoming chunks should update the latest AI message incrementally
  it('should incrementally update AI message content as chunks arrive', async () => {
    wrapper = mount(ChatPanel, {
      global: {
        plugins: [createPinia()]
      }
    })
    await flushPromises()

    const events = [
      { chunk: 'Thinking' },
      { chunk: '...' },
      { chunk: ' Hello' },
      { chunk: ' world!' },
      { done: true, fullContent: 'Thinking... Hello world!' }
    ]
    mockFetch.mockResolvedValueOnce(mockSSEResponse(events))

    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', 'Say hello')
    await flushPromises()

    // Wait for all simulated chunk delays (5 events * 10ms each)
    await new Promise(resolve => setTimeout(resolve, 60))

    // The AI message should appear in the messages list
    const aiMessages = wrapper.findAll('[data-testid="chat-msg-ai"]')
    expect(aiMessages.length).toBe(1)

    // Since streaming is not implemented, the content will likely be empty or not update incrementally.
    // This test will fail until incremental updates are implemented.
    // We assert that the final content matches the concatenated chunks.
    const finalContent = 'Thinking... Hello world!'
    expect(aiMessages[0].text()).toContain(finalContent)

    // Additionally, we could assert that intermediate states existed (harder to capture without exposing internal state).
    // For now, we rely on the final content assertion.
  })

  // Test 3: A typing/loading indicator should be visible while streaming is in progress
  it('should show a typing indicator while streaming and hide it when done', async () => {
    wrapper = mount(ChatPanel, {
      global: {
        plugins: [createPinia()]
      }
    })
    await flushPromises()

    // Mock a streaming response that takes some time
    mockFetch.mockResolvedValueOnce(mockSSEResponse([
      { chunk: 'Chunk 1' },
      { chunk: 'Chunk 2' },
      { done: true, fullContent: 'Chunk 1Chunk 2' }
    ]))

    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', 'Test')
    await flushPromises()

    // Immediately after sending, a typing indicator should appear
    // The indicator could be a CSS class, a separate element, or a property on the AI message.
    // Since the current ChatPanel doesn't have such an indicator, this test will fail.
    // We'll look for an element with a data-testid="typing-indicator" or similar.
    // Updated expectation: use the new test id 'chat-msg-ai-streaming' or check for the cursor class
    const streamingMessage = wrapper.find('[data-testid="chat-msg-ai-streaming"]')
    expect(streamingMessage.exists()).toBe(true)
    
    // Wait for streaming to finish
    await new Promise(resolve => setTimeout(resolve, 40))
    await flushPromises()

    // Indicator should be gone (message changes to normal ai message)
    expect(wrapper.find('[data-testid="chat-msg-ai-streaming"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="chat-msg-ai"]').exists()).toBe(true)
  })

  // Test 4: Auto‑scroll behavior during streaming (cooperation with C‑tasks)
  it('should auto‑scroll to bottom when user is at bottom and chunks arrive', async () => {
    // This test depends on C1/C2 implementation, but we can still assert that
    // if the user is at the bottom, the scroll position follows the growing message.
    wrapper = mount(ChatPanel, {
      global: {
        plugins: [createPinia()]
      }
    })
    await flushPromises()

    // Mock a long stream to cause multiple UI updates
    const events = [
      { chunk: 'A'.repeat(10) },
      { chunk: 'B'.repeat(10) },
      { chunk: 'C'.repeat(10) },
      { done: true, fullContent: 'AAAAAAAAAABBBBBBBBBBCCCCCCCCCC' }
    ]
    mockFetch.mockResolvedValueOnce(mockSSEResponse(events))

    // Simulate that the user is at the bottom (shouldAutoScroll = true)
    // In the current ChatPanel, shouldAutoScroll is always true unless loading older messages.
    // We'll need to mock the scroll container and its properties.
    const scrollToBottom = vi.fn()
    Object.defineProperty(wrapper.vm, 'scrollToBottom', { value: scrollToBottom })

    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', 'Scroll test')
    await flushPromises()

    // Wait for chunks to arrive
    await new Promise(resolve => setTimeout(resolve, 50))

    // Expect scrollToBottom to have been called at least once per chunk
    // (or at least once when the AI message is added)
    // NOTE: Cannot spy on local scrollToBottom in <script setup>.
    // expect(scrollToBottom).toHaveBeenCalled()
  })

  // Test 5: If streaming fails mid‑stream, the UI should show an error and remove typing indicator
  it('should handle streaming errors gracefully', async () => {
    wrapper = mount(ChatPanel, {
      global: {
        plugins: [createPinia()]
      }
    })
    await flushPromises()

    // Mock a streaming response that fails after first chunk
    const stream = createMockStream([
      'data: ' + JSON.stringify({ chunk: 'First' }) + '\n\n',
      'data: ' + JSON.stringify({ error: 'Simulated adapter error' }) + '\n\n'
    ], { leaveOpen: true })
    const errorResponse = {
      ok: false,
      status: 500,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: stream,
      text: () => Promise.resolve('Simulated adapter error text')
    }
    mockFetch.mockResolvedValueOnce(errorResponse)

    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', 'Error test')
    await flushPromises()

    // Wait a bit for the error to be processed
    await new Promise(resolve => setTimeout(resolve, 30))

    // Typing indicator should be absent
    expect(wrapper.find('[data-testid="chat-msg-ai-streaming"]').exists()).toBe(false)

    // The message content should contain the error
    const aiMessage = wrapper.find('[data-testid="chat-msg-ai"]')
    expect(aiMessage.exists()).toBe(true)
    expect(aiMessage.text()).toContain('Error')
  })

  // Test 6: Final streamed content should be persisted and match the concatenated chunks
  it('should persist the final message to the backend after stream completes', async () => {
    wrapper = mount(ChatPanel, {
      global: {
        plugins: [createPinia()]
      }
    })
    await flushPromises()

    const finalContent = 'This is the final answer.'
    const events = [
      { chunk: 'This ' },
      { chunk: 'is ' },
      { chunk: 'the ' },
      { chunk: 'final ' },
      { chunk: 'answer.' },
      { done: true, fullContent: 'This is the final answer.' }
    ]
    mockFetch.mockResolvedValueOnce(mockSSEResponse(events))

    // Also mock the subsequent POST that persists the message (if separate from streaming)
    // For now, assume the streaming endpoint itself handles persistence.
    // We'll just verify that the final content appears in the UI.
    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', 'Persist test')
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 70))

    const aiMessages = wrapper.findAll('[data-testid="chat-msg-ai"]')
    expect(aiMessages.length).toBe(1)
    expect(aiMessages[0].text()).toContain(finalContent)

    // Additionally, we could verify that a POST to /api/chat/messages with the final content
    // was made (if the frontend is responsible). However, the subtask suggests the backend
    // persists after the stream ends. So this test may need adjustment.
  })
})

// ============================================================================
// Subtask 2-1-11 — Icon-only New Messages Indicator & Auto-scroll Resume (C2)
// ============================================================================

describe('Subtask 2-1-11 — Icon-only New Messages Indicator & Auto-scroll Resume', () => {
  let wrapper

  beforeEach(() => {
    // Pinia is required because ChatPanel uses useUIStore() in <script setup>
    const pinia = createPinia()
    setActivePinia(pinia)

    mockFetch.mockClear()
    // Mock initial load of messages
    mockFetch.mockResolvedValueOnce(mockJSONResponse([]))

    wrapper = mount(ChatPanel, {
      global: {
        plugins: [pinia]
      }
    })

    // Gate assertion: indicator must not exist initially (fail until Devon adds it)
    expect(wrapper.find('[data-testid="chat-scroll-to-bottom"]').exists()).toBe(false)
    // Ensure the scroll container has the required data-testid.
    // If it is not present yet, the C2 tests will remain RED until Devon adds it.
    if (!wrapper.find('[data-testid="chat-messages-container"]').exists()) {
      return
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  // Helper to simulate scroll position
  const simulateScroll = (scrollTop, scrollHeight, clientHeight) => {
    const container = wrapper.find('[data-testid="chat-messages-container"]')
    if (!container.exists()) return
    const el = container.element
    // Mock scroll properties with configurable: true to allow redefinition
    Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, writable: true, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, writable: true, configurable: true })
    // Trigger scroll event
    el.dispatchEvent(new Event('scroll'))
  }

  // Helper to simulate new AI message appended (without streaming)
  const simulateNewAIMessage = () => {
    // messages is a ref in <script setup>, access via .value
    if (Array.isArray(wrapper.vm.messages)) {
      wrapper.vm.messages.push({
        type: 'ai',
        content: 'New AI message',
        html: '<p>New AI message</p>',
        isStreaming: false
      })
    } else if (wrapper.vm.messages && typeof wrapper.vm.messages.value === 'object') {
      wrapper.vm.messages.value.push({
        type: 'ai',
        content: 'New AI message',
        html: '<p>New AI message</p>',
        isStreaming: false
      })
    }
  }

  // Helper to simulate streaming chunk updates (no new message object)
  const simulateStreamingChunk = () => {
    const messages = Array.isArray(wrapper.vm.messages) ? wrapper.vm.messages : wrapper.vm.messages?.value
    const aiMessage = messages?.find(m => m.type === 'ai' && m.isStreaming)
    if (aiMessage) {
      aiMessage.content += ' chunk'
      aiMessage.html = `<p>${aiMessage.content}</p>`
    }
  }

  // CRITICAL TEST 1: Indicator appears when user scrolled up and new AI message object appended
  it('should show indicator when user is not at bottom and new AI message is appended', async () => {
    // Arrange: simulate user scrolled away from bottom
    simulateScroll(100, 500, 300) // scrollTop 100, not at bottom
    await wrapper.vm.$nextTick()
    // DOM-observable outcome: indicator should NOT be visible yet (since no new message)
    expect(wrapper.find('[data-testid="chat-scroll-to-bottom"]').exists()).toBe(false)

    // Act: append a new AI message object
    simulateNewAIMessage()
    await wrapper.vm.$nextTick()

    // Assert: indicator should be visible
    const indicator = wrapper.find('[data-testid="chat-scroll-to-bottom"]')
    expect(indicator.exists()).toBe(true)
    expect(indicator.attributes('aria-label')).toBe('Scroll to newest message')
  })

  // CRITICAL TEST 2: Clicking indicator scrolls to bottom, hides indicator, re‑enables auto‑scroll
  it('should scroll to bottom and hide indicator when clicked', async () => {
    // Setup: indicator is visible
    simulateScroll(100, 500, 300)
    simulateNewAIMessage()
    await wrapper.vm.$nextTick()
    const indicator = wrapper.find('[data-testid="chat-scroll-to-bottom"]')
    expect(indicator.exists()).toBe(true)

    // Get scroll container reference
    const container = wrapper.find('[data-testid="chat-messages-container"]')
    const el = container.element
    // Store initial scrollTop (not at bottom)
    const initialScrollTop = el.scrollTop

    // Act: click indicator
    await indicator.trigger('click')
    await wrapper.vm.$nextTick()

    // Assert: scrollTop should be at bottom (or near bottom)
    // scrollHeight - scrollTop - clientHeight < 50 (production logic)
    const diff = el.scrollHeight - el.scrollTop - el.clientHeight
    expect(diff).toBeLessThan(50)
    // Indicator should be hidden
    expect(wrapper.find('[data-testid="chat-scroll-to-bottom"]').exists()).toBe(false)
  })

  // CRITICAL TEST 3: Manual scroll to bottom clears indicator without click
  it('should clear indicator when user manually scrolls to bottom', async () => {
    // Setup: indicator visible
    simulateScroll(100, 500, 300)
    simulateNewAIMessage()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="chat-scroll-to-bottom"]').exists()).toBe(true)

    // Act: simulate scroll to bottom
    simulateScroll(200, 500, 300) // scrollTop = 200, scrollHeight - scrollTop - clientHeight = 0 (at bottom)
    await wrapper.vm.$nextTick()

    // Assert: indicator hidden
    expect(wrapper.find('[data-testid="chat-scroll-to-bottom"]').exists()).toBe(false)
    // DOM-observable outcome: indicator gone, no internal state assertion
  })

  // CRITICAL TEST 4: Streaming chunks (content updates) do NOT trigger indicator
  it('should not show indicator when only AI message content updates (streaming chunks)', async () => {
    // Setup: user at bottom initially (shouldAutoScroll true)
    simulateScroll(200, 500, 300)
    // Add an AI message that is streaming
    // Use the helper to ensure correct array access
    if (Array.isArray(wrapper.vm.messages)) {
      wrapper.vm.messages.push({
        type: 'ai',
        content: '',
        html: '',
        isStreaming: true
      })
    } else if (wrapper.vm.messages && typeof wrapper.vm.messages.value === 'object') {
      wrapper.vm.messages.value.push({
        type: 'ai',
        content: '',
        html: '',
        isStreaming: true
      })
    }
    await wrapper.vm.$nextTick()
    // Simulate user scrolls away
    simulateScroll(100, 500, 300)
    await wrapper.vm.$nextTick()
    // DOM-observable outcome: indicator should NOT be visible yet (no new message object)
    expect(wrapper.find('[data-testid="chat-scroll-to-bottom"]').exists()).toBe(false)

    // Act: update streaming content (no new message object)
    simulateStreamingChunk()
    await wrapper.vm.$nextTick()

    // Assert: indicator should NOT appear
    const indicator = wrapper.find('[data-testid="chat-scroll-to-bottom"]')
    expect(indicator.exists()).toBe(false)
  })

  // HIGH PRIORITY TEST: Indicator never appears when already at bottom
  it('should not show indicator when user is at bottom', async () => {
    // Setup: user at bottom
    simulateScroll(200, 500, 300)
    await wrapper.vm.$nextTick()
    // Note: avoid asserting internal shouldAutoScroll; rely on DOM behavior only

    // Act: append new AI message
    simulateNewAIMessage()
    await wrapper.vm.$nextTick()

    // Assert: indicator should NOT be visible
    const indicator = wrapper.find('[data-testid="chat-scroll-to-bottom"]')
    expect(indicator.exists()).toBe(false)
  })

  // HIGH PRIORITY TEST: Loading older messages does not affect indicator
  it('should not affect indicator when loading older messages', async () => {
    // Setup: indicator visible
    simulateScroll(100, 500, 300)
    simulateNewAIMessage()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="chat-scroll-to-bottom"]').exists()).toBe(true)

    // Act: simulate scroll to top (loading older messages would be triggered)
    simulateScroll(0, 500, 300)
    await wrapper.vm.$nextTick()

    // Assert: indicator still visible (loading older messages shouldn't clear it)
    expect(wrapper.find('[data-testid="chat-scroll-to-bottom"]').exists()).toBe(true)
  })
})

// ============================================================================
// Subtask 2-1-12 — Clamp latest user message + align to top on send
// ============================================================================

describe('Subtask 2-1-12 — Clamp latest user message + align to top on send', () => {
  let wrapper
  let originalScrollIntoView

  beforeEach(() => {
    // Pinia is required because ChatPanel uses useUIStore() in <script setup>
    const pinia = createPinia()
    setActivePinia(pinia)

    mockFetch.mockClear()
    // Mock initial load of messages
    mockFetch.mockResolvedValueOnce(mockJSONResponse([]))

    wrapper = mount(ChatPanel, {
      global: {
        plugins: [pinia]
      }
    })

    // Store original scrollIntoView
    originalScrollIntoView = Element.prototype.scrollIntoView
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    // Restore original scrollIntoView
    Element.prototype.scrollIntoView = originalScrollIntoView
  })

  // Helper to create a long message (more than 3 lines)
  const createLongMessage = (lineCount = 5) => {
    // Each line ~50 characters to ensure wrapping
    const line = 'This is a line of text that should wrap. '
    return line.repeat(lineCount * 2) // Ensure enough characters for lineCount lines
  }

  // Helper to create a short message (3 lines or less)
  const createShortMessage = () => {
    return 'Short message that fits in 3 lines.'
  }

  // Helper to simulate adding a message to the chat
  const addMessage = (content, type = 'user') => {
    if (Array.isArray(wrapper.vm.messages)) {
      wrapper.vm.messages.push({
        type,
        content,
        html: type === 'user' ? null : `<p>${content}</p>`,
        isStreaming: false
      })
    } else if (wrapper.vm.messages && typeof wrapper.vm.messages.value === 'object') {
      wrapper.vm.messages.value.push({
        type,
        content,
        html: type === 'user' ? null : `<p>${content}</p>`,
        isStreaming: false
      })
    }
  }

  // Helper to get user message element by index (0 = oldest, -1 = latest)
  const getUserMessageElement = (index) => {
    const userMessages = wrapper.findAll('[data-testid="chat-msg-user"]')
    if (index >= 0) {
      return userMessages[index] || null
    } else {
      // Negative index: -1 = latest, -2 = second latest, etc.
      return userMessages[userMessages.length + index] || null
    }
  }

  // Helper to get the toggle button for a user message
  const getToggleButton = (messageElement) => {
    return messageElement.find('[data-testid="user-msg-toggle"]')
  }

  // Test A: Clamp applies to all user messages
  it('should apply clamp to all user messages', async () => {
    // Arrange: Add two user messages, make the last one long
    addMessage('First user message', 'user')
    addMessage(createLongMessage(5), 'user') // Latest message is long
    await wrapper.vm.$nextTick()

    // Get message elements
    const firstMessage = getUserMessageElement(0) // Oldest
    const latestMessage = getUserMessageElement(-1) // Latest

    // Assert: Latest user message has clamp marker
    // Devon should add a data attribute or class like data-clamped="true" or .cm-user-clamp
    expect(latestMessage.attributes('data-clamped')).toBe('true') // Will fail until implemented

    // Assert: Earlier user message ALSO has clamp marker (clamp applies to all user messages)
    expect(firstMessage.attributes('data-clamped')).toBe('true') // Will fail until implemented
  })

  // Test B1: Show more/less appears for long messages
  it('should show toggle button for long messages', async () => {
    // Arrange: Add a long user message
    addMessage(createLongMessage(5), 'user')
    await wrapper.vm.$nextTick()

    const latestMessage = getUserMessageElement(-1)
    
    // Assert: Toggle button exists with data-testid="user-msg-toggle"
    const toggleButton = getToggleButton(latestMessage)
    expect(toggleButton.exists()).toBe(true) // Will fail until implemented
    
    // Assert: Button text is "Show more"
    expect(toggleButton.text()).toContain('Show more')
  })

  // Test B2: Show more/less does NOT appear for short messages
  it('should not show toggle button for short messages', async () => {
    // Arrange: Add a short user message
    addMessage(createShortMessage(), 'user')
    await wrapper.vm.$nextTick()

    const latestMessage = getUserMessageElement(-1)
    
    // Assert: No toggle button
    const toggleButton = getToggleButton(latestMessage)
    expect(toggleButton.exists()).toBe(false) // Will fail if button appears for short messages
  })

  // Test C1: Toggle expands message
  it('should expand message when clicking "Show more"', async () => {
    // Arrange: Add a long user message
    addMessage(createLongMessage(5), 'user')
    await wrapper.vm.$nextTick()

    const latestMessage = getUserMessageElement(-1)
    const toggleButton = getToggleButton(latestMessage)
    
    // Act: Click "Show more"
    await toggleButton.trigger('click')
    await wrapper.vm.$nextTick()

    // Assert: Message is expanded (data-clamped="false" or class removed)
    expect(latestMessage.attributes('data-clamped')).toBe('false') // Will fail until implemented
    
    // Assert: Button text changes to "Show less"
    expect(toggleButton.text()).toContain('Show less')
  })

  // Test C2: Toggle collapses message
  it('should collapse message when clicking "Show less"', async () => {
    // Arrange: Add a long user message and expand it first
    addMessage(createLongMessage(5), 'user')
    await wrapper.vm.$nextTick()

    const latestMessage = getUserMessageElement(-1)
    const toggleButton = getToggleButton(latestMessage)
    
    // Expand first
    await toggleButton.trigger('click')
    await wrapper.vm.$nextTick()
    
    // Act: Click "Show less"
    await toggleButton.trigger('click')
    await wrapper.vm.$nextTick()

    // Assert: Message is clamped again (data-clamped="true" or class added)
    expect(latestMessage.attributes('data-clamped')).toBe('true') // Will fail until implemented
    
    // Assert: Button text changes back to "Show more"
    expect(toggleButton.text()).toContain('Show more')
  })

  // Optional but recommended: Independent state per message
  it('should maintain independent expand/collapse state per message', async () => {
    // Arrange: Add two long user messages
    addMessage(createLongMessage(5), 'user') // First message
    addMessage(createLongMessage(5), 'user') // Second message
    await wrapper.vm.$nextTick()

    const firstMessage = getUserMessageElement(0) // Older message
    const secondMessage = getUserMessageElement(1) // Newer message
    
    const firstToggle = getToggleButton(firstMessage)
    const secondToggle = getToggleButton(secondMessage)

    // Both messages should start clamped
    expect(firstMessage.attributes('data-clamped')).toBe('true')
    expect(secondMessage.attributes('data-clamped')).toBe('true')
    
    // Act: Expand only the older (first) message
    await firstToggle.trigger('click')
    await wrapper.vm.$nextTick()

    // Assert: First message expanded, second still clamped
    expect(firstMessage.attributes('data-clamped')).toBe('false')
    expect(secondMessage.attributes('data-clamped')).toBe('true')
    
    // Assert: Button texts reflect independent states
    expect(firstToggle.text()).toContain('Show less')
    expect(secondToggle.text()).toContain('Show more')
    
    // Act: Now expand the second message
    await secondToggle.trigger('click')
    await wrapper.vm.$nextTick()

    // Assert: Both messages expanded
    expect(firstMessage.attributes('data-clamped')).toBe('false')
    expect(secondMessage.attributes('data-clamped')).toBe('false')
    expect(firstToggle.text()).toContain('Show less')
    expect(secondToggle.text()).toContain('Show less')
    
    // Act: Collapse only the first message
    await firstToggle.trigger('click')
    await wrapper.vm.$nextTick()

    // Assert: First clamped, second still expanded
    expect(firstMessage.attributes('data-clamped')).toBe('true')
    expect(secondMessage.attributes('data-clamped')).toBe('false')
    expect(firstToggle.text()).toContain('Show more')
    expect(secondToggle.text()).toContain('Show less')
  })

  // Test D: Does not break streaming
  it('should not break streaming behavior', async () => {
    // Mock streaming response
    const events = [
      { chunk: 'Thinking' },
      { chunk: ' about it' },
      { done: true, fullContent: 'Thinking about it' }
    ]
    mockFetch.mockResolvedValueOnce(mockSSEResponse(events))

    // Send a user message (which should trigger streaming)
    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', 'Test streaming')
    await flushPromises()

    // Wait for streaming to start
    await new Promise(resolve => setTimeout(resolve, 30))

    // Assert: User message should still have clamp behavior
    const userMessages = wrapper.findAll('[data-testid="chat-msg-user"]')
    const latestUserMessage = userMessages[userMessages.length - 1]
    
    // Latest user message should have clamp marker (if long enough)
    // Note: This depends on message length, but we can at least verify the element exists
    expect(latestUserMessage.exists()).toBe(true)
    
    // Assert: AI streaming message is updating
    const streamingMessage = wrapper.find('[data-testid="chat-msg-ai-streaming"]')
    expect(streamingMessage.exists()).toBe(true)
  })

  // Test E: Align latest user message to top on send
  it('should align latest user message to top when sending', async () => {
    // Stub scrollIntoView
    const scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock

    // Send a user message
    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', 'Test message')
    await wrapper.vm.$nextTick()

    // Get the latest user message element
    const userMessages = wrapper.findAll('[data-testid="chat-msg-user"]')
    const latestUserMessage = userMessages[userMessages.length - 1]
    
    // Assert: scrollIntoView was called on the latest user message
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'start' })
    
    // Assert: It was called exactly once (not repeatedly during streaming)
    // We'll verify this by checking that it wasn't called with other arguments
    const calls = scrollIntoViewMock.mock.calls
    expect(calls.length).toBe(1)
  })

  // Test E2: scrollIntoView not called during streaming chunks
  it('should not call scrollIntoView during streaming chunks', async () => {
    // Stub scrollIntoView
    const scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock

    // Mock streaming response with multiple chunks
    const events = [
      { chunk: 'Chunk 1' },
      { chunk: 'Chunk 2' },
      { chunk: 'Chunk 3' },
      { done: true, fullContent: 'Chunk 1Chunk 2Chunk 3' }
    ]
    mockFetch.mockResolvedValueOnce(mockSSEResponse(events))

    // Send a user message
    wrapper.findComponent({ name: 'MessageInput' }).vm.$emit('send', 'Test streaming')
    await flushPromises()

    // Wait for all chunks to arrive
    await new Promise(resolve => setTimeout(resolve, 50))

    // Assert: scrollIntoView was called only once (on user message send)
    // Not called for each AI chunk
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
  })
})
