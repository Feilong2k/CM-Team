<template>
  <div data-testid="chat-panel" class="w-full h-full bg-[#111111] border-r border-[#333333] overflow-hidden flex flex-col">
    <div class="p-4">
      <h2 class="text-lg mb-4 text-neon-blue">Chat Panel</h2>
    </div>
    <div class="flex-1 overflow-y-auto px-4">
      <!-- Chat messages -->
      <div class="space-y-2">
        <!-- Iterate over messages -->
        <div
          v-for="(message, index) in messages"
          :key="index"
          :data-testid="message.type === 'user' ? 'chat-msg-user' : 'chat-msg-ai'"
          :class="[
            'p-3 rounded',
            message.type === 'user' ? 'bg-gray-800 text-gray-200' : 'text-neon-blue'
          ]"
        >
          <div v-if="message.type === 'user'" class="text-sm">
            {{ message.content }}
          </div>
          <div v-else class="text-xs ai-message" v-html="message.html"></div>
        </div>
      </div>
    </div>
    <!-- Message input -->
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
      <div class="flex-1">
        <MessageInput @send="handleSendMessage" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import MessageInput from './MessageInput.vue'
import { renderMarkdown, exampleMarkdown } from '../utils/markdown.js'

// Reactive array of messages
const messages = ref([])
// Current mode (default: 'plan')
const currentMode = ref('plan')

// Initialize with example messages
onMounted(() => {
  // Optionally, start with an empty chat or a minimal welcome message
  // messages.value.push({
  //   type: 'ai',
  //   content: 'Welcome!',
  //   html: renderMarkdown('Welcome!')
  // })
})

const handleSendMessage = async (messageText) => {
  // Add user message
  messages.value.push({
    type: 'user',
    content: messageText,
    html: null
  })

  try {
    const response = await fetch('http://localhost:3500/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        external_id: 'P1', // Use project ID as external_id to group messages for this project
        sender: 'user',
        content: messageText,
        metadata: {
          mode: currentMode.value
        }
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Add AI response
    messages.value.push({
      type: 'ai',
      content: data.message,
      html: renderMarkdown(data.message)
    })
  } catch (error) {
    console.error('Error sending message:', error)
    messages.value.push({
      type: 'ai',
      content: 'Error: Failed to get response from Orion.',
      html: renderMarkdown('**Error**: Failed to get response from Orion.')
    })
  }
}
</script>

<style scoped>
/* Additional scoped styles if needed */
.ai-message {
  color: #fff;
  font-size: 0.75rem; /* 12px, 2pt smaller than user text (14px) */
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
