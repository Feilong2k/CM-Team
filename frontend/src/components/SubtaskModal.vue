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
      <!-- Heading with status and workflow_stage dropdowns -->
      <div class="mb-2 flex items-center justify-between">
        <div class="text-neon-blue text-xl font-bold" data-testid="modal-heading">
          <slot name="modal-heading">
            Subtask Modal Placeholder
          </slot>
        </div>
        <div class="flex items-center gap-4">
          <div>
            <label class="text-xs text-gray-400 mr-1">Workflow Stage:</label>
            <select
              class="bg-[#0a0a0a] text-neon-blue border border-[#333333] rounded px-2 py-1 text-xs"
              v-model="localWorkflowStage"
              @change="updateWorkflowStage"
            >
              <option value="planning">planning</option>
              <option value="Orion_PCC">Orion_PCC</option>
              <option value="Tara_PCC">Tara_PCC</option>
              <option value="Tara_Tests">Tara_Tests</option>
              <option value="Devon_PCC">Devon_PCC</option>
              <option value="Devon_Impl">Devon_Impl</option>
              <option value="Devon_Refactor">Devon_Refactor</option>
              <option value="Adam_Review">Adam_Review</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-400 mr-1">Status:</label>
            <select
              class="bg-[#0a0a0a] text-neon-blue border border-[#333333] rounded px-2 py-1 text-xs"
              v-model="localStatus"
              @change="updateStatus"
            >
              <option value="pending">pending</option>
              <option value="in progress">in progress</option>
              <option value="done">done</option>
            </select>
          </div>
        </div>
      </div>
<div class="text-gray-200 text-sm mt-1" data-testid="modal-meta" style="width: 100%;">
  <slot name="modal-meta"></slot>
</div>
<!-- Tabs -->
<div class="flex border-b border-neon-blue mb-4 mt-2" data-testid="modal-tabs" style="width: 100%;">
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
<div class="mt-2 flex-1 flex flex-col" data-testid="modal-tab-content" style="width: 100%;">
  <InfoDisplay v-if="activeTab === 0" :data="subtask?.basic_info" label="No basic info available." />
  <InfoDisplay v-else-if="activeTab === 1" :data="subtask?.instruction" label="No instruction available." />
  <div v-else-if="activeTab === 2">
    <div v-if="subtask?.activity_log && subtask.activity_log.length">
      <div
        v-for="(entry, idx) in subtask.activity_log"
        :key="idx"
        :class="['chat-row', entry.sender === 'You' ? 'chat-row-right' : 'chat-row-left']"
      >
        <div
          class="chat-bubble"
          :class="entry.sender === 'You' ? 'chat-bubble-right' : 'chat-bubble-left'"
          style="flex-direction: row;"
        >
          <span class="chat-meta-inline" :class="entry.sender === 'You' ? 'chat-meta-right' : 'chat-meta-left'">
            {{ entry.sender || "You" }} •
            {{ entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' }}
          </span>
          <span class="chat-message ml-2">{{ entry.message || entry }}</span>
        </div>
      </div>
    </div>
    <span v-else>No activity log available.</span>
  </div>
  <InfoDisplay v-else-if="activeTab === 3" :data="subtask?.pcc" label="No PCC data available." />
  <InfoDisplay v-else-if="activeTab === 4" :data="subtask?.tests" label="No tests available." />
  <InfoDisplay v-else-if="activeTab === 5" :data="subtask?.implementations" label="No implementations available." />
  <InfoDisplay v-else-if="activeTab === 6" :data="subtask?.review" label="No review available." />
</div>
<!-- Message Input always at the bottom, for all tabs -->
<div class="pt-4" style="width: 100%;">
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
import { ref, onMounted, onUnmounted, watch, h } from 'vue'
import MessageInput from './MessageInput.vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
  subtask: { type: Object, required: true },
  featureId: { type: [String, Number], required: true }
})
const emit = defineEmits(['close'])

// Local state for status and workflow_stage
const localStatus = ref(props.subtask.status)
const localWorkflowStage = ref(props.subtask.workflow_stage || 'planning')

// Watch for prop changes (when opening a new subtask)
watch(
  () => props.subtask,
  (newSubtask) => {
    localStatus.value = newSubtask.status
    localWorkflowStage.value = newSubtask.workflow_stage || 'planning'
  }
)

async function updateStatus() {
  try {
    await fetch(`/api/features/${props.featureId}/tasks/${props.subtask.task_id}/subtasks/${props.subtask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: localStatus.value })
    });
    // Update local subtask object and emit event to parent to refresh data
    props.subtask.status = localStatus.value;
  } catch (err) {
    console.error('Failed to update subtask status:', err);
  }
}

async function updateWorkflowStage() {
  try {
    await fetch(`/api/features/${props.featureId}/tasks/${props.subtask.task_id}/subtasks/${props.subtask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_stage: localWorkflowStage.value })
    });
    // Update local subtask object and emit event to parent to refresh data
    props.subtask.workflow_stage = localWorkflowStage.value;
  } catch (err) {
    console.error('Failed to update subtask workflow_stage:', err);
  }
}

function close() {
  emit('close')
}

// Tabs
const tabs = [
  'Basic Info',
  'Instruction',
  'Activity Log',
  'PCC',
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
const handleSendMessage = async (messageText) => {
  if (!messageText) return;
  try {
    // Append to activity_log in DB
    await fetch(`/api/features/${props.featureId}/tasks/${props.subtask.task_id}/subtasks/${props.subtask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_log_entry: { message: messageText, timestamp: new Date().toISOString() } })
    });
    // Update local activity_log in UI
    if (!props.subtask.activity_log) props.subtask.activity_log = [];
    props.subtask.activity_log.push({ message: messageText, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Failed to append to activity_log:', err);
  }
}

// InfoDisplay as a functional component using render function
const InfoDisplay = (props) => {
  const { data, label } = props;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return h('div', { class: 'basic-info-list' },
      Object.entries(data).map(([key, value]) =>
        h('div', { class: 'mb-2' }, [
          h('div', { class: 'font-bold text-neon-blue mb-1' }, key.charAt(0).toUpperCase() + key.slice(1)),
          Array.isArray(value)
            ? h('ul', { class: 'list-disc ml-6' },
                value.map((item, idx) =>
                  h('li', { key: idx, class: 'break-words text-white' }, item)
                )
              )
            : typeof value === 'object' && value !== null
              ? h('div', { class: 'break-words text-white' }, [
                  h('pre', null, JSON.stringify(value, null, 2))
                ])
              : h('div', { class: 'break-words text-white' }, value)
        ])
      )
    );
  } else if (Array.isArray(data)) {
    return h('ul', { class: 'basic-info-list list-disc ml-6' },
      data.map((item, idx) =>
        h('li', { key: idx, class: 'break-words text-white' }, item)
      )
    );
  } else if (typeof data === 'string' || typeof data === 'number') {
    return h('div', { class: 'basic-info-list break-words text-white' }, data);
  } else {
    return h('span', null, label);
  }
};
InfoDisplay.props = {
  data: { type: [Object, Array, String, Number], default: null },
  label: { type: String, default: '' }
};
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
.basic-info-list {
  max-height: 300px;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-line;
}
.chat-row {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  margin-bottom: 8px;
}
.chat-row-right {
  justify-content: flex-end;
}
.chat-row-left {
  justify-content: flex-start;
}
.chat-bubble {
  border-radius: 12px;
  padding: 8px 12px;
  max-width: 80%;
  word-break: break-word;
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}
.chat-bubble-right {
  background: #00f3ff;
  color: #111;
  align-self: flex-end;
  justify-content: flex-end;
}
.chat-bubble-left {
  background: #222;
  color: #fff;
  align-self: flex-start;
  justify-content: flex-start;
}
.chat-meta-inline {
  font-size: 0.75em;
  color: #00f3ff;
  font-weight: bold;
  margin-right: 8px;
  white-space: nowrap;
}
.chat-meta-right {
  color: #00f3ff;
  text-align: right;
}
.chat-meta-left {
  color: #00f3ff;
  text-align: left;
}
.chat-message {
  font-size: 1em;
  color: inherit;
}
</style>
