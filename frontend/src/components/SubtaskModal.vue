<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
    @keydown.esc="close"
    tabindex="0"
    data-testid="modal"
  >
    <div class="bg-[#111111] rounded-lg shadow-lg w-[65vw] h-[90vh] p-6 relative outline-none flex flex-col">
      <button
        class="absolute top-2 right-2 text-neon-blue text-xl"
        @click="close"
        aria-label="Close modal"
        data-testid="modal-close"
      >
        &times;
      </button>
      <!-- Heading -->
      <div class="mb-2">
        <div class="text-neon-blue text-xl font-bold" data-testid="modal-heading">
          <slot name="modal-heading">
            Subtask Modal Placeholder
          </slot>
        </div>
        <div class="text-gray-200 text-sm mt-1" data-testid="modal-meta">
          <slot name="modal-meta"></slot>
        </div>
      </div>
      <!-- Tabs -->
      <div class="flex border-b border-neon-blue mb-4 mt-2" data-testid="modal-tabs">
        <button
          v-for="(tab, idx) in tabs"
          :key="tab"
          :class="[
            'px-4 py-2 text-sm font-bold focus:outline-none',
            activeTab === idx
              ? 'text-neon-blue border-b-2 border-neon-blue'
              : 'text-gray-400'
          ]"
          @click="activeTab = idx"
          :data-testid="'modal-tab-' + idx"
        >
          {{ tab }}
        </button>
      </div>
      <!-- Tab Content -->
      <div class="min-h-[120px] mt-2 flex-1 flex flex-col" data-testid="modal-tab-content">
        <div v-if="activeTab === 0">Basic Info Placeholder</div>
        <div v-else-if="activeTab === 1">Instruction Placeholder</div>
        <div v-else-if="activeTab === 2">Activity Log Placeholder</div>
        <div v-else-if="activeTab === 3">CDP Analysis Placeholder</div>
        <div v-else-if="activeTab === 4">Tests Placeholder</div>
        <div v-else-if="activeTab === 5">Implementations Placeholder</div>
        <div v-else-if="activeTab === 6">Review Placeholder</div>
      </div>
      <!-- Message Input always at the bottom, for all tabs -->
      <div class="pt-4">
        <MessageInput
          :placeholder="'Type a message (max 3 lines)...'"
          @send="handleSendMessage"
          data-testid="modal-message-input"
        />
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import MessageInput from './MessageInput.vue'

const props = defineProps({
  visible: { type: Boolean, required: true }
})
const emit = defineEmits(['close'])

function close() {
  emit('close')
}

// Tabs
const tabs = [
  'Basic Info',
  'Instruction',
  'Activity Log',
  'CDP Analysis',
  'Tests',
  'Implementations',
  'Review'
]
const activeTab = ref(0)

// Trap focus for accessibility
let lastActiveElement = null
onMounted(() => {
  if (props.visible) {
    lastActiveElement = document.activeElement
    document.body.style.overflow = 'hidden'
  }
})
onUnmounted(() => {
  document.body.style.overflow = ''
  if (lastActiveElement) lastActiveElement.focus()
})
const handleSendMessage = (messageText) => {
  // For now, just log to console. In a real app, this would update the activity log.
  // You can extend this to emit an event or update a prop as needed.
  // Example: emit('add-activity-log', messageText)
  // For demo:
  console.log('Modal message sent:', messageText)
}
</script>

<style scoped>
/* Neon blue accent for modal border and close button */
[data-testid="modal"] .rounded-lg {
  border: 2px solid #00f3ff;
}
.border-neon-blue {
  border-color: #00f3ff !important;
}
.text-neon-blue {
  color: #00f3ff !important;
}
</style>
