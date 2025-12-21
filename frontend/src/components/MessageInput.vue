<template>
  <div class="message-input-container">
    <div class="flex items-start border border-neon-blue rounded-md bg-[#111111] p-2">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        rows="1"
        @keydown="handleKeydown"
        @input="adjustHeight"
        class="flex-grow bg-transparent text-gray-200 resize-none outline-none placeholder-gray-500 overflow-y-hidden align-top"
        :placeholder="placeholder"
      />
      <button
        @click="sendMessage"
        class="ml-2 px-4 py-2 bg-[#111111] text-gold border border-gold rounded hover:bg-gold hover:text-black transition-colors self-end"
        data-testid="send-button"
      >
        Send
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'Type a message...'
  },
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['send', 'update:modelValue'])

const textareaRef = ref(null)
const inputText = ref(props.modelValue)

const handleKeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
  // Shift+Enter will default to newline, which is what we want
}

const adjustHeight = () => {
  emit('update:modelValue', inputText.value)
  
  const textarea = textareaRef.value
  if (textarea) {
    // Reset height to shrink if text was deleted
    textarea.style.height = 'auto'
    
    // Get line height to calculate max height
    const style = window.getComputedStyle(textarea)
    const lineHeight = parseFloat(style.lineHeight)
    // If line-height is 'normal', approximate it (usually 1.2 * fontSize)
    const computedLineHeight = isNaN(lineHeight) ? parseFloat(style.fontSize) * 1.2 : lineHeight
    
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    // Max height for 3 lines + padding
    const maxContentHeight = computedLineHeight * 3
    
    const newHeight = Math.min(textarea.scrollHeight, maxContentHeight + padding)
    textarea.style.height = `${newHeight}px`
    
    // Show scrollbar if content exceeds max height
    textarea.style.overflowY = textarea.scrollHeight > newHeight ? 'auto' : 'hidden'
  }
}

const sendMessage = () => {
  if (inputText.value.trim()) {
    emit('send', inputText.value.trim())
    inputText.value = ''
    emit('update:modelValue', '')
    // Reset height after update
    nextTick(() => {
      const textarea = textareaRef.value
      if (textarea) {
        textarea.style.height = 'auto'
        adjustHeight()
      }
    })
  }
}

// Watch for external modelValue changes
watch(() => props.modelValue, (newVal) => {
  inputText.value = newVal
  nextTick(() => adjustHeight())
})

onMounted(() => {
  adjustHeight()
})
</script>

<style scoped>
.message-input-container {
  width: 100%;
}

textarea {
  line-height: 1.4;
  font-family: 'Consolas', 'Courier New', monospace;
}

/* Custom scrollbar for textarea */
textarea::-webkit-scrollbar {
  width: 6px;
}

textarea::-webkit-scrollbar-track {
  background: #111111;
}

textarea::-webkit-scrollbar-thumb {
  background: #333333;
  border-radius: 3px;
}

textarea::-webkit-scrollbar-thumb:hover {
  background: #444444;
}
.text-gold {
  color: #ffd700 !important;
}
.border-gold {
  border-color: #ffd700 !important;
}
.bg-gold {
  background-color: #ffd700 !important;
}
</style>
