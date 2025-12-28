<template>
  <div class="h-full flex bg-black text-xs">
    <!-- Left pane: timeline (1/4 of dashboard width) -->
    <div class="w-1/4 border-r border-[#333333] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-2 py-1 border-b border-[#333333] bg-[#0a0a0a]">
        <h3 class="text-sm font-bold text-neon-blue">Trace Timeline</h3>
        <button
          type="button"
          data-testid="trace-refresh-button"
          class="px-2 py-1 text-[0.7rem] rounded bg-[#111111] border border-[#444444] hover:bg-[#1a1a1a] text-white"
          @click="refresh"
        >
          Refresh
        </button>
      </div>

      <div class="flex-1 overflow-y-auto bg-[#111111] text-white">
        <div
          v-if="errorMessage"
          data-testid="trace-error"
          class="px-2 py-2 text-red-400 text-[0.7rem] border-b border-[#333333] bg-[#1a0000]"
        >
          {{ errorMessage }}
        </div>

        <div v-for="group in groupedEvents" :key="group.requestId" data-testid="request-group">
          <div class="px-2 py-1 text-[0.65rem] text-gray-500 border-b border-[#333333] bg-[#0a0a0a]">
            Request: {{ group.requestId }}
          </div>
          <ul>
            <li
              v-for="event in group.events"
              :key="event.id"
              data-testid="trace-event-item"
              @click="selectEvent(event.id)"
              :class="[
                'px-2 py-1 cursor-pointer border-b border-[#222222] hover:bg-[#1a1a1a]',
                event.id === selectedEventId ? 'bg-[#222222]' : ''
              ]"
            >
              <div
                class="font-semibold"
                :class="typeClass(event.type)"
              >
                {{ event.type }}
              </div>
              <div class="text-[0.65rem] text-gray-400">{{ event.timestamp }}</div>
              <div class="text-[0.7rem] truncate text-gray-200">{{ event.summary }}</div>
            </li>
          </ul>
        </div>
        <div v-if="!loading && events.length === 0" class="px-2 py-2 text-[0.7rem] text-gray-500">
          No trace events yet.
        </div>

        <div v-if="loading" class="px-2 py-2 text-[0.7rem] text-gray-400">
          Loading trace logs...
        </div>
      </div>
    </div>

    <!-- Right pane: details (remaining width), styled similar to Orion messages -->
    <div class="w-3/4 p-3 overflow-y-auto bg-[#111111]">
      <div
        v-if="selectedEvent"
        data-testid="trace-event-detail"
        class="ai-message border border-[#333333] rounded-md p-3 bg-[#141414] text-white"
      >
        <h3 class="text-sm font-bold mb-2 text-neon-blue">Event Details</h3>
        <div class="mb-1">Type: <span class="font-mono">{{ selectedEvent.type }}</span></div>
        <div class="mb-1">Timestamp: <span class="font-mono">{{ selectedEvent.timestamp }}</span></div>
        <div class="mb-1">Source: <span class="font-mono">{{ selectedEvent.source }}</span></div>
        <div class="mb-1">Summary: <span class="font-mono">{{ selectedEvent.summary }}</span></div>

        <!-- Textual Details -->
        <div v-for="field in textualFields" :key="field.key" class="mt-3">
          <h4 class="mb-1 font-semibold text-neon-blue">{{ field.label }}</h4>
          <div class="bg-[#050505] border border-[#333333] rounded p-2 text-[0.75rem] overflow-x-auto">
            <div v-if="field.isLong && !field.expanded" v-html="renderMarkdown(firstFiveLines(field.content))"></div>
            <div v-else v-html="renderMarkdown(field.content)"></div>
            <button
              v-if="field.isLong"
              :data-testid="field.key === 'content' ? (field.expanded ? 'show-less-button' : 'show-more-button') : 'prompt-context-show-more'"
              class="mt-2 px-2 py-1 text-[0.7rem] rounded bg-[#111111] border border-[#444444] hover:bg-[#1a1a1a] text-white"
              @click="field.key === 'content' ? toggleDetailsExpansion() : togglePromptContextExpansion()"
            >
              {{ field.expanded ? 'Show less' : 'Show more' }}
            </button>
          </div>
        </div>

        <!-- Other Details & Metadata -->
        <div v-if="hasOtherDetails" class="mt-3">
          <h4 class="mb-1 font-semibold text-neon-blue">Other Details & Metadata</h4>
          <pre class="bg-[#050505] border border-[#333333] rounded p-2 whitespace-pre-wrap text-[0.75rem] overflow-x-auto">
{{ JSON.stringify({ details: otherDetails, metadata: selectedEvent.metadata }, null, 2) }}
          </pre>
        </div>

        <!-- Prompt Context (structured) -->
        <div v-if="selectedEvent?.details?.systemPrompt || selectedEvent?.details?.messages" class="mt-3">
          <h4 class="mb-1 font-semibold text-neon-blue">Prompt Context</h4>
          <div class="bg-[#050505] border border-[#333333] rounded p-2 text-[0.75rem] overflow-x-auto">
            <!-- System Prompt -->
            <div v-if="selectedEvent.details.systemPrompt">
              <div class="font-semibold text-neon-blue mb-1">System Prompt</div>
              <div v-if="isContentLong(selectedEvent.details.systemPrompt) && !promptContextExpanded" v-html="renderMarkdown(firstFiveLines(selectedEvent.details.systemPrompt))"></div>
              <div v-else v-html="renderMarkdown(selectedEvent.details.systemPrompt)"></div>
            </div>
            <!-- Messages -->
            <div v-if="selectedEvent.details.messages && selectedEvent.details.messages.length" class="mt-2">
              <div class="font-semibold text-neon-blue mb-1">Messages</div>
              <div v-for="(msg, idx) in selectedEvent.details.messages" :key="idx" class="mb-2">
                <div class="font-mono text-gray-400">{{ msg.role }}:</div>
                <div v-if="isContentLong(msg.content) && !promptContextExpanded" v-html="renderMarkdown(firstFiveLines(msg.content))"></div>
                <div v-else v-html="renderMarkdown(msg.content)"></div>
              </div>
            </div>
            <!-- Show more/less button for prompt context -->
            <button
              v-if="isPromptContextLong"
              data-testid="prompt-context-show-more"
              class="mt-2 px-2 py-1 text-[0.7rem] rounded bg-[#111111] border border-[#444444] hover:bg-[#1a1a1a] text-white"
              @click="togglePromptContextExpansion"
            >
              {{ promptContextExpanded ? 'Show less' : 'Show more' }}
            </button>
          </div>
        </div>
      </div>
      <div v-else class="h-full flex items-center justify-center text-gray-500 text-[0.75rem]">
        Select an event from the timeline to see details.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps({
  projectId: {
    type: String,
    default: 'P1'
  }
})

const events = ref([])
const selectedEventId = ref(null)
const loading = ref(false)
const errorMessage = ref('')
let intervalId = null

const selectedEvent = computed(() => {
  return events.value.find(e => e.id === selectedEventId.value) || null
})

const groupedEvents = computed(() => {
  const groups = {}
  events.value.forEach(event => {
    const requestId = event.metadata?.requestId || 'unknown'
    if (!groups[requestId]) {
      groups[requestId] = {
        requestId,
        events: []
      }
    }
    groups[requestId].events.push(event)
  })
  // Convert to array and sort by first event timestamp maybe
  return Object.values(groups).sort((a, b) => {
    const aTime = a.events[0]?.timestamp || ''
    const bTime = b.events[0]?.timestamp || ''
    return aTime.localeCompare(bTime)
  })
})

const formattedDetails = computed(() => {
  if (!selectedEvent.value) return ''
  const payload = {
    details: selectedEvent.value.details ?? null,
    metadata: selectedEvent.value.metadata ?? null
  }
  try {
    return JSON.stringify(payload, null, 2)
  } catch (e) {
    return String(payload)
  }
})

const formattedPromptContext = computed(() => {
  if (!selectedEvent.value || !selectedEvent.value.details) return ''
  const { systemPrompt, messages } = selectedEvent.value.details
  if (!systemPrompt && !messages) return ''

  const payload = {
    systemPrompt: systemPrompt || null,
    messages: Array.isArray(messages) ? messages : null,
  }

  try {
    return JSON.stringify(payload, null, 2)
  } catch (e) {
    return String(payload)
  }
})

// Expansion states
const detailsExpanded = ref(false)
const promptContextExpanded = ref(false)

// Helper to count lines in text
const countLines = (text) => {
  if (!text) return 0
  return text.split('\n').length
}

// Determine if content is long (more than 5 lines)
const isContentLong = (text) => countLines(text) > 5

// Get first 5 lines of text
const firstFiveLines = (text) => {
  if (!text) return ''
  const lines = text.split('\n')
  return lines.slice(0, 5).join('\n')
}

// Rendered markdown for system prompt
const renderedSystemPrompt = computed(() => {
  if (!selectedEvent.value?.details?.systemPrompt) return ''
  return renderMarkdown(selectedEvent.value.details.systemPrompt)
})

// Rendered markdown for content (if any)
const renderedContent = computed(() => {
  const content = selectedEvent.value?.details?.content
  if (!content) return ''
  return renderMarkdown(content)
})

// Determine if we should show snippet for details content
const isDetailsContentLong = computed(() => {
  const content = selectedEvent.value?.details?.content
  return content && isContentLong(content)
})

// Determine if we should show snippet for prompt context
const isPromptContextLong = computed(() => {
  const systemPrompt = selectedEvent.value?.details?.systemPrompt
  const messages = selectedEvent.value?.details?.messages
  let totalLines = 0
  if (systemPrompt) totalLines += countLines(systemPrompt)
  if (Array.isArray(messages)) {
    messages.forEach(msg => {
      if (msg.content) totalLines += countLines(msg.content)
    })
  }
  return totalLines > 5
})

// Extract textual fields from details (only content, systemPrompt is handled in prompt context)
const textualFields = computed(() => {
  const details = selectedEvent.value?.details
  if (!details) return []
  const fields = []
  if (details.content !== undefined) {
    fields.push({
      label: 'Content',
      key: 'content',
      content: details.content,
      isLong: isContentLong(details.content),
      expanded: detailsExpanded.value // reuse detailsExpanded for content
    })
  }
  // systemPrompt is displayed in prompt context section, not here
  return fields
})

// Other fields (excluding textual fields)
const otherDetails = computed(() => {
  const details = selectedEvent.value?.details
  if (!details) return {}
  const { content, systemPrompt, messages, ...rest } = details
  return rest
})

// Determine if there are other details or metadata to show
const hasOtherDetails = computed(() => {
  return Object.keys(otherDetails.value).length > 0 || selectedEvent.value?.metadata
})

// Toggle methods
const toggleDetailsExpansion = () => {
  detailsExpanded.value = !detailsExpanded.value
}

const togglePromptContextExpansion = () => {
  promptContextExpanded.value = !promptContextExpanded.value
}

const typeClass = (type) => {
  switch (type) {
    case 'orion_response':
      return 'text-neon-blue'
    case 'tool_call':
      return 'text-neon-pink'
    case 'duplicate_tool_call':
      return 'text-red-300'
    case 'tool_result':
      return 'text-green-300'
    case 'llm_call':
      return 'text-cyan-300'
    case 'llm_result':
      return 'text-amber-300'
    case 'system_error':
      return 'text-red-400'
    default:
      return 'text-white'
  }
}

const loadEvents = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`/api/trace/logs?projectId=${encodeURIComponent(props.projectId)}`)
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      errorMessage.value = text || 'Failed to load trace logs'
      events.value = []
      return
    }
    const data = await res.json()
    const newEvents = Array.isArray(data.events) ? data.events : []
    events.value = newEvents

    // If we had a selected event and it still exists, keep it selected
    if (selectedEventId.value) {
      const stillExists = newEvents.some(e => e.id === selectedEventId.value)
      if (!stillExists) {
        selectedEventId.value = null
      }
    }
  } catch (err) {
    console.error('Failed to load trace logs:', err)
    errorMessage.value = err?.message || 'Failed to load trace logs'
    events.value = []
  } finally {
    loading.value = false
  }
}

const refresh = () => {
  loadEvents()
}

const selectEvent = (id) => {
  selectedEventId.value = id
}

onMounted(() => {
  loadEvents()
  // Auto-refresh every 5 seconds
  intervalId = setInterval(loadEvents, 5000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
})

// If projectId prop changes, reload events
watch(
  () => props.projectId,
  () => {
    loadEvents()
  }
)
</script>

<style scoped>
.ai-message {
  color: #fff;
  font-size: 0.75rem;
}

.ai-message :deep(h1) {
  font-size: 1.5em;
  margin-top: 0.2em;
  margin-bottom: 0.2em;
  color: #00ffff; /* Neon blue */
}

.ai-message :deep(h2) {
  font-size: 1.3em;
  margin-top: 0.18em;
  margin-bottom: 0.18em;
  color: #00e676; /* Neon green */
}

.ai-message :deep(h3) {
  font-size: 1.1em;
  margin-top: 0.15em;
  margin-bottom: 0.15em;
  color: #ffea00; /* Neon yellow */
}

.ai-message :deep(h4) {
  font-size: 1em;
  margin-top: 0.12em;
  margin-bottom: 0.12em;
  color: #ff3d00; /* Neon orange */
}

.ai-message :deep(h5) {
  font-size: 0.95em;
  margin-top: 0.1em;
  margin-bottom: 0.1em;
  color: #d500f9; /* Neon purple */
}

.ai-message :deep(h6) {
  font-size: 0.9em;
  margin-top: 0.08em;
  margin-bottom: 0.08em;
  color: #00bcd4; /* Neon cyan */
}

.ai-message :deep(p),
.ai-message :deep(li),
.ai-message :deep(blockquote),
.ai-message :deep(pre) {
  margin-top: 0.08em;
  margin-bottom: 0.08em;
}

.ai-message :deep(code) {
  background-color: #222222;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Consolas', 'Courier New', monospace;
}

.ai-message :deep(pre) {
  background-color: #222222;
  padding: 1em;
  border-radius: 5px;
  overflow-x: auto;
  margin: 0.5em 0;
}

.ai-message :deep(ul) {
  padding-left: 1.5em;
  margin: 0.5em 0;
  list-style-type: disc;
}

.ai-message :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
  list-style-type: decimal;
}

.ai-message :deep(li) {
  margin: 0.2em 0;
}

.ai-message :deep(blockquote) {
  border-left: 3px solid #00ffff;
  padding-left: 1em;
  margin: 0.5em 0;
  color: #cccccc;
}
</style>
