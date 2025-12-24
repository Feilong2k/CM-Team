<template>
  <div data-testid="chat-panel" class="w-full h-full bg-[#111111] border-r border-[#333333] overflow-hidden flex flex-col">
    <div class="p-4">
      <h2 class="text-lg mb-4 text-neon-blue">Chat Panel</h2>
    </div>
    <div 
      ref="messagesContainer"
      data-testid="chat-messages-container"
      class="flex-1 overflow-y-auto px-4 relative"
      @scroll="handleScroll"
    >
      <!-- Loading indicator when loading older messages -->
      <div v-if="loadingOlder" class="text-center py-2 text-neon-blue text-xs">
        Loading older messages...
      </div>
      
      <!-- Chat messages -->
      <div class="space-y-2">
        <!-- Iterate over messages -->
        <div
          v-for="(message, index) in messages"
          :key="index"
          :data-testid="getDataTestId(message)"
          :data-clamped="isMessageClamped(message) ? 'true' : 'false'"
          :class="[
            'p-3 rounded relative',
            message.type === 'user' ? 'bg-gray-800 text-gray-200 user-message' : 'ai-message'
          ]"
        >
          <div v-if="message.type === 'user'" class="flex flex-col">
            <div 
              :class="getMessageContentClasses(message)"
            >
              {{ message.content }}
            </div>
            <!-- Toggle button for long messages -->
            <button
              v-if="isMessageLong(message.content)"
              data-testid="user-msg-toggle"
              @click="toggleMessageExpansion(index)"
              class="mt-2 text-xs text-neon-blue hover:text-neon-cyan self-start"
            >
              {{ getToggleButtonText(message) }}
            </button>
          </div>
          <div v-else>
             <div v-html="message.html"></div>
             <!-- Cursor or indicator for streaming -->
             <span v-if="message.isStreaming" class="inline-block w-2 h-4 bg-neon-blue animate-pulse ml-1"></span>
          </div>
        </div>
      </div>
      
      <!-- Loading indicator when loading initial messages -->
      <div v-if="loadingInitial" class="text-center py-4 text-neon-blue text-xs">
        Loading messages...
      </div>

      <!-- Scroll to bottom indicator -->
      <button
        v-if="showScrollToBottomIndicator"
        data-testid="chat-scroll-to-bottom"
        aria-label="Scroll to newest message"
        @click="scrollToBottomAndHideIndicator"
        class="absolute bottom-4 right-4 p-2 bg-neon-blue text-black rounded-full shadow-lg hover:bg-neon-cyan transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
    <!-- Message input + mode/two-stage toggles -->
    <div class="p-4 border-t border-[#333333] flex items-center gap-4">
      <!-- Plan/Act Toggle -->
      <div class="flex items-center bg-gray-800 rounded p-1">
        <button
          @click="currentMode = 'plan'"
          :class="[
            'px-3 py-1 rounded text-xs font-bold transition-colors',
            currentMode === 'plan' ? 'bg-neon-blue text-black' : 'text-gray-400 hover:text-white'
          ]"
        >
          PLAN
        </button>
        <button
          @click="currentMode = 'act'"
          :class="[
            'px-3 py-1 rounded text-xs font-bold transition-colors',
            currentMode === 'act' ? 'bg-neon-pink text-black' : 'text-gray-400 hover:text-white'
          ]"
        >
          ACT
        </button>
      </div>

      <!-- Two-stage toggle -->
      <div class="flex items-center bg-gray-800 rounded p-1 text-xs text-gray-400">
        <label class="flex items-center cursor-pointer">
          <input
            type="checkbox"
            v-model="uiStore.twoStageEnabled"
            class="mr-1 accent-neon-blue"
          />
          2-stage
        </label>
      </div>

      <div class="flex-1">
        <MessageInput 
          @send="handleSendMessage" 
          v-model="draftMessage"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { useUIStore } from '../stores/uiStore'
import MessageInput from './MessageInput.vue'
import { renderMarkdown } from '../utils/markdown.js'
import { streamOrionReply } from '../utils/streamOrionReply.js'
import { useScrollIndicator } from '../composables/useScrollIndicator.js'
import { useMessageExpansion } from '../composables/useMessageExpansion.js'

const uiStore = useUIStore()

// Reactive array of messages
const messages = ref([])

// Map local currentMode to store state
const currentMode = computed({
  get: () => uiStore.chatMode,
  set: (val) => uiStore.setChatMode(val)
})

// Map draft message to store state
const draftMessage = computed({
  get: () => uiStore.draftMessage,
  set: (val) => uiStore.setDraftMessage(val)
})

// Reference to messages container for scrolling
const messagesContainer = ref(null)
// Loading states
const loadingInitial = ref(false)
const loadingOlder = ref(false)
// Pagination state
const hasMoreMessages = ref(true)
const currentOffset = ref(0)
const limit = 10
const projectId = 'P1' // Default project ID

// Message expansion composable
const {
  isMessageLong,
  toggleMessageExpansion,
  isMessageClamped,
  getMessageContentClasses,
  getToggleButtonText
} = useMessageExpansion(messages, { charThreshold: 150, lineClamp: 3 })

// Helper to determine data-testid
const getDataTestId = (message) => {
  if (message.type === 'user') return 'chat-msg-user'
  if (message.isStreaming) return 'chat-msg-ai-streaming'
  return 'chat-msg-ai'
}

// Load messages on mount
onMounted(() => {
  loadInitialMessages()
})

// Scroll indicator composable
const {
  shouldAutoScroll,
  showScrollToBottomIndicator,
  scrollToBottom: scrollToBottomIndicator,
  scrollToBottomAndHideIndicator: scrollToBottomAndHideIndicatorFn,
  handleScroll: handleScrollIndicator
} = useScrollIndicator(messages, messagesContainer, loadingOlder)

// Load initial messages (most recent 10)
const loadInitialMessages = async () => {
  loadingInitial.value = true
  try {
    const response = await fetch(`/api/chat/messages?project_id=${projectId}&limit=${limit}&offset=0`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    const data = await response.json()
    
    // Convert API messages to component format
    messages.value = data.map(msg => ({
      id: msg.id, // Store ID for deduplication
      type: msg.sender === 'user' ? 'user' : 'ai',
      content: msg.content,
      html: msg.sender === 'user' ? null : renderMarkdown(msg.content),
      createdAt: msg.created_at
    })).reverse() // Reverse to show newest at bottom
    
    currentOffset.value = data.length
    hasMoreMessages.value = data.length === limit
    
    // Scroll to bottom after loading
    nextTick(() => {
      scrollToBottomIndicator()
    })
  } catch (error) {
    console.error('Error loading messages:', error)
  } finally {
    loadingInitial.value = false
  }
}

// Load older messages for infinite scroll
const loadOlderMessages = async () => {
  if (loadingOlder.value || !hasMoreMessages.value) return
  
  loadingOlder.value = true
  // Disable auto-scroll while loading older messages
  shouldAutoScroll.value = false
  
  try {
    const response = await fetch(`/api/chat/messages?project_id=${projectId}&limit=${limit}&offset=${currentOffset.value}`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    const data = await response.json()
    
    if (data.length === 0) {
      hasMoreMessages.value = false
      return
    }
    
    // Convert API messages to component format and prepend to existing messages
    const olderMessages = data.map(msg => ({
      id: msg.id, // Store ID for deduplication
      type: msg.sender === 'user' ? 'user' : 'ai',
      content: msg.content,
      html: msg.sender === 'user' ? null : renderMarkdown(msg.content),
      createdAt: msg.created_at
    })).reverse()
    
    // Deduplicate: filter out any older messages that are already in the array
    const existingIds = new Set(messages.value.map(m => m.id).filter(id => id !== undefined))
    const uniqueOlderMessages = olderMessages.filter(m => !existingIds.has(m.id))

    // Store current scroll position and height before updating
    const container = messagesContainer.value
    const scrollTopBefore = container ? container.scrollTop : 0
    const scrollHeightBefore = container ? container.scrollHeight : 0
    
    // Prepend older messages
    messages.value = [...uniqueOlderMessages, ...messages.value]
    
    currentOffset.value += data.length
    hasMoreMessages.value = data.length === limit
    
    // Maintain scroll position after loading older messages
    nextTick(() => {
      if (container) {
        const scrollHeightAfter = container.scrollHeight
        const heightDifference = scrollHeightAfter - scrollHeightBefore
        container.scrollTop = scrollTopBefore + heightDifference
      }
    })
  } catch (error) {
    console.error('Error loading older messages:', error)
    shouldAutoScroll.value = true
  } finally {
    loadingOlder.value = false
  }
}

// Handle scroll for infinite loading and auto-scroll detection
const handleScroll = () => {
  if (!messagesContainer.value) return
  
  const container = messagesContainer.value
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  
  // Load older messages when scrolled to top
  if (scrollTop === 0 && hasMoreMessages.value && !loadingOlder.value) {
    loadOlderMessages()
  }

  // Delegate scroll indicator logic to composable
  handleScrollIndicator()
}

// Scroll to bottom of messages (legacy function, use scrollToBottomIndicator from composable)
const scrollToBottom = () => {
  scrollToBottomIndicator()
}

// Scroll to bottom and hide indicator
const scrollToBottomAndHideIndicator = () => {
  scrollToBottomAndHideIndicatorFn()
}

const handleSendMessage = async (messageText) => {
  // Prevent duplicate sending if already streaming the last message
  const lastMsg = messages.value[messages.value.length - 1]
  if (lastMsg && lastMsg.isStreaming) return

  // Clear draft immediately on send
  draftMessage.value = ''

  // STEP 1: Add user message with default isExpanded = false
  messages.value.push({
    type: 'user',
    content: messageText,
    html: null,
    isExpanded: false
  })
  
  // Update offset for user message
  currentOffset.value += 1

  // STEP 2: Scroll user message to top BEFORE adding AI message
  await nextTick()
  
  const userMessages = messagesContainer.value?.querySelectorAll('[data-testid="chat-msg-user"]')
  if (userMessages && userMessages.length > 0) {
    const lastUserMessage = userMessages[userMessages.length - 1]
    lastUserMessage.scrollIntoView({ 
      block: 'start', 
      inline: 'nearest',
      behavior: 'instant'
    })
  }

  // STEP 3: Now add AI message placeholder
  messages.value.push({
    type: 'ai',
    content: '',
    html: '',
    isStreaming: true
  })
  
  const aiMessage = messages.value[messages.value.length - 1]
  currentOffset.value += 1

  // Choose endpoint based on two-stage toggle
  const endpoint = uiStore.twoStageEnabled
    ? '/api/chat/messages_two_stage'
    : '/api/chat/messages'
  
  const payload = {
    external_id: projectId,
    sender: 'user',
    content: messageText,
    metadata: {
      mode: currentMode.value
    }
  }

  try {
    await streamOrionReply(endpoint, payload, {
      onChunk: (chunk) => {
        if (aiMessage) {
          aiMessage.content += chunk
          aiMessage.html = renderMarkdown(aiMessage.content)
        }
      },
      onDone: (fullContent) => {
        if (aiMessage) {
          aiMessage.content = fullContent 
          aiMessage.html = renderMarkdown(fullContent)
          aiMessage.isStreaming = false
        }
      },
      onError: (errorMsg) => {
        if (aiMessage) {
          aiMessage.isStreaming = false
          aiMessage.content += `\n\n**Error**: ${errorMsg}`
          aiMessage.html = renderMarkdown(aiMessage.content)
        }
        console.error('Streaming error:', errorMsg)
      }
    })
  } catch (error) {
    console.error('Error sending message:', error)
    if (aiMessage) {
      aiMessage.isStreaming = false
      aiMessage.content = `Error: Failed to get response from Orion.\n\n**Details**: ${error.message || error}`
      aiMessage.html = renderMarkdown(aiMessage.content)
    }
  }
}
</script>

<style scoped>
/* Additional scoped styles if needed */
.user-message {
  font-size: 0.75rem; /* 12px, match Orion text size */
}

.ai-message {
  color: #fff;
  font-size: 0.75rem; /* 12px, same as user text */
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
