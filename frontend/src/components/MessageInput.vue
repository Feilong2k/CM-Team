<template>
  <div class="message-input-container">
    <div class="flex items-start border border-neon-blue rounded-md bg-[#111111] p-2">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        :rows="currentRows"
        @keydown="handleKeydown"
        @input="adjustHeight"
        class="flex-grow bg-transparent text-gray-200 resize-none outline-none placeholder-gray-500 overflow-y-auto align-top"
        :placeholder="placeholder"
        :max-rows="3"
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
import { ref, computed, onMounted } from 'vue'

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

const currentRows = ref(1)

const handleKeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
  // Shift+Enter will default to newline, which is what we want
}

const adjustHeight = () => {
  emit('update:modelValue', inputText.value)
  
  // Calculate rows based on line breaks
  const lines = inputText.value.split('\n').length
  currentRows.value = Math.min(Math.max(lines, 1), 3)
  
  // Also adjust the textarea height via CSS (handled by rows attribute)
}

const sendMessage = () => {
  if (inputText.value.trim()) {
    emit('send', inputText.value.trim())
    inputText.value = ''
    currentRows.value = 1
    emit('update:modelValue', '')
  }
}

// Watch for external modelValue changes
import { watch } from 'vue'
watch(() => props.modelValue, (newVal) => {
  inputText.value = newVal
  adjustHeight()
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
