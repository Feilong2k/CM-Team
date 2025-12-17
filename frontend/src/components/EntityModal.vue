<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
    @keydown.esc="close"
    tabindex="0"
    data-testid="entity-modal"
  >
    <div class="bg-[#111111] rounded-lg shadow-lg w-[65vw] h-[90vh] p-6 relative outline-none flex flex-col">
      <button
        class="absolute top-2 right-2 text-neon-blue text-xl"
        @click="close"
        aria-label="Close modal"
        data-testid="entity-modal-close"
      >
        &times;
      </button>
      <!-- Heading -->
      <div class="mb-2">
        <div class="text-neon-blue text-xl font-bold" data-testid="entity-modal-heading">
          <slot name="modal-heading">
            Entity Modal
          </slot>
        </div>
        <div class="text-gray-200 text-sm mt-1" data-testid="entity-modal-meta">
          <slot name="modal-meta"></slot>
        </div>
      </div>
      <!-- Tabs -->
      <div class="flex border-b border-neon-blue mb-4 mt-2" data-testid="entity-modal-tabs">
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
          :data-testid="'entity-modal-tab-' + idx"
        >
          {{ tab }}
        </button>
      </div>
      <!-- Tab Content -->
      <div class="min-h-[120px] mt-2 flex-1 overflow-y-auto" data-testid="entity-modal-tab-content">
        <div v-if="activeTab === 0">
          <slot name="basic-info">Basic Info Placeholder</slot>
        </div>
        <div v-else-if="activeTab === 1">
          <slot name="activity-log">Activity Log Placeholder</slot>
        </div>
        <div v-else-if="activeTab === 2">
          <div>
            <div class="font-bold text-neon-blue mb-2">PVP Analysis</div>
            <details>
              <summary class="cursor-pointer text-gray-200">Full PVP Analysis (click to expand/collapse)</summary>
              <div class="mt-2">
                <slot name="pvp-full">PVP Full Analysis Placeholder</slot>
              </div>
            </details>
            <div class="mt-4">
              <div class="font-bold text-gray-300">Risks / Gaps & Recommendations</div>
              <slot name="pvp-risks">PVP Risks/Gaps Placeholder</slot>
              <div class="font-bold text-gray-300 mt-2">Clarifications Needed</div>
              <slot name="pvp-clarifications">PVP Clarifications Placeholder</slot>
            </div>
          </div>
        </div>
        <div v-else-if="activeTab === 3">
          <div>
            <div class="font-bold text-neon-blue mb-2">CDP Analysis</div>
            <details>
              <summary class="cursor-pointer text-gray-200">Full CDP Analysis (click to expand/collapse)</summary>
              <div class="mt-2">
                <slot name="cdp-full">CDP Full Analysis Placeholder</slot>
              </div>
            </details>
            <div class="mt-4">
              <div class="font-bold text-gray-300">Risks / Gaps & Recommendations</div>
              <slot name="cdp-risks">CDP Risks/Gaps Placeholder</slot>
              <div class="font-bold text-gray-300 mt-2">Clarifications Needed</div>
              <slot name="cdp-clarifications">CDP Clarifications Placeholder</slot>
            </div>
          </div>
        </div>
      </div>
      <!-- Message Input always at the bottom, for all tabs -->
      <div class="pt-4">
        <MessageInput
          :placeholder="'Type a message (max 3 lines)...'"
          @send="handleSendMessage"
          data-testid="entity-modal-message-input"
          :sendButtonColor="'gold'"
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

const tabs = [
  'Basic Info',
  'Activity Log',
  'PVP Analysis',
  'CDP Analysis'
]
const activeTab = ref(0)

const handleSendMessage = (messageText) => {
  // For now, just log to console. In a real app, this would update the activity log.
  // You can extend this to emit an event or update a prop as needed.
  // Example: emit('add-activity-log', messageText)
  // For demo:
  console.log('Entity modal message sent:', messageText)
}

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
</script>

<style scoped>
[data-testid="entity-modal"] .rounded-lg {
  border: 2px solid #00f3ff;
}
.border-neon-blue {
  border-color: #00f3ff !important;
}
.text-neon-blue {
  color: #00f3ff !important;
}
</style>
