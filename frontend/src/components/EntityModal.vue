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
      <!-- Heading with status dropdown -->
      <div class="mb-2 flex items-center justify-between">
        <div class="flex-1">
          <div class="text-neon-blue text-xl font-bold" data-testid="entity-modal-heading">
            <slot name="modal-heading">
              Entity Modal
            </slot>
          </div>
        </div>
        <div v-if="feature || task" class="flex items-center gap-2 ml-4">
          <label class="text-xs text-gray-400 mr-1">Status:</label>
          <select
            class="bg-[#0a0a0a] text-neon-blue border border-[#333333] rounded px-2 py-1 text-xs"
            :value="feature ? feature.status : (task ? task.status : '')"
            @change="onStatusDropdownChange($event)"
          >
            <option value="pending">pending</option>
            <option value="in progress">in progress</option>
            <option value="done">done</option>
          </select>
        </div>
      </div>
      <div class="text-gray-200 text-sm mt-1" data-testid="entity-modal-meta">
        <slot name="modal-meta"></slot>
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
            <div class="font-bold text-neon-blue mb-2">PCC (Preflight Constraint Check)</div>
            <details>
              <summary class="cursor-pointer text-gray-200">Full PCC Analysis (click to expand/collapse)</summary>
              <div class="mt-2">
                <slot name="pcc-full">PCC Full Analysis Placeholder</slot>
              </div>
            </details>
            <div class="mt-4">
              <div class="font-bold text-gray-300">Risks / Gaps & Recommendations</div>
              <slot name="pcc-risks">PCC Risks/Gaps Placeholder</slot>
              <div class="font-bold text-gray-300 mt-2">Clarifications Needed</div>
              <slot name="pcc-clarifications">PCC Clarifications Placeholder</slot>
            </div>
          </div>
        </div>
        <!-- RED tab (only for features) -->
        <div v-else-if="props.entityType === 'feature' && activeTab === 3">
          <div>
            <div class="font-bold text-neon-blue mb-2">RED (Recursive Execution Decomposition)</div>
            <details>
              <summary class="cursor-pointer text-gray-200">Full RED Analysis (click to expand/collapse)</summary>
              <div class="mt-2">
                <slot name="red-full">RED Full Analysis Placeholder</slot>
              </div>
            </details>
            <div class="mt-4">
              <div class="font-bold text-gray-300">Risks / Gaps & Recommendations</div>
              <slot name="red-risks">RED Risks/Gaps Placeholder</slot>
              <div class="font-bold text-gray-300 mt-2">Clarifications Needed</div>
              <slot name="red-clarifications">RED Clarifications Placeholder</slot>
            </div>
          </div>
        </div>
        <!-- CAP tab (index depends on entity type) -->
        <div v-else-if="(props.entityType === 'feature' && activeTab === 4) || (props.entityType === 'task' && activeTab === 3)">
          <div>
            <div class="font-bold text-neon-blue mb-2">CAP (Constraint-Aware Planning)</div>
            <details>
              <summary class="cursor-pointer text-gray-200">Full CAP Analysis (click to expand/collapse)</summary>
              <div class="mt-2">
                <slot name="cap-full">CAP Full Analysis Placeholder</slot>
              </div>
            </details>
            <div class="mt-4">
              <div class="font-bold text-gray-300">Risks / Gaps & Recommendations</div>
              <slot name="cap-risks">CAP Risks/Gaps Placeholder</slot>
              <div class="font-bold text-gray-300 mt-2">Clarifications Needed</div>
              <slot name="cap-clarifications">CAP Clarifications Placeholder</slot>
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
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import MessageInput from './MessageInput.vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
  entityType: { type: String, default: 'feature' }, // 'feature' or 'task'
  feature: { type: Object, default: null },
  task: { type: Object, default: null }
})
const emit = defineEmits(['close'])

function close() {
  emit('close')
}

// Local state for status
const statusValue = ref(props.feature?.status || props.task?.status || 'pending')

// Watch for prop changes (when opening a new feature/task)
watch(
  () => [props.feature, props.task],
  ([newFeature, newTask]) => {
    if (newFeature && props.entityType === 'feature') statusValue.value = newFeature.status
    if (newTask && props.entityType === 'task') statusValue.value = newTask.status
  }
)

function onStatusDropdownChange(event) {
  const newStatus = event.target.value;
  if (props.feature) {
    fetch(`/api/features/${props.feature.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(err => console.error('Failed to update feature status:', err));
    props.feature.status = newStatus;
  } else if (props.task) {
    fetch(`/api/features/${props.task.feature_id}/tasks/${props.task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(err => console.error('Failed to update task status:', err));
    props.task.status = newStatus;
  }
}

// Dynamic tabs based on entity type
const tabs = computed(() => {
  const baseTabs = ['Basic Info', 'Activity Log', 'PCC']
  if (props.entityType === 'feature') {
    return [...baseTabs, 'RED', 'CAP']
  } else {
    // task - no RED tab
    return [...baseTabs, 'CAP']
  }
})

const activeTab = ref(0)

const handleSendMessage = async (messageText) => {
  if (!messageText) return;
  const sender = "You";
  const timestamp = new Date().toISOString();
  try {
    if (props.entityType === 'feature' && props.feature) {
      await fetch(`/api/features/${props.feature.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_log_entry: { message: messageText, timestamp, sender } })
      });
      if (!props.feature.activity_log) props.feature.activity_log = [];
      props.feature.activity_log.push({ message: messageText, timestamp, sender });
    } else if (props.entityType === 'task' && props.task) {
      await fetch(`/api/features/${props.task.feature_id}/tasks/${props.task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_log_entry: { message: messageText, timestamp, sender } })
      });
      if (!props.task.activity_log) props.task.activity_log = [];
      props.task.activity_log.push({ message: messageText, timestamp, sender });
    }
  } catch (err) {
    console.error('Failed to append to activity_log:', err);
  }
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
