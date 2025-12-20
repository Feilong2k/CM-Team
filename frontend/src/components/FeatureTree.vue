<template>
  <div class="feature-tree">
    <!-- Render all features dynamically -->
    <div
      v-for="(feature, fIdx) in features"
      :key="feature.id || fIdx"
      class="mb-6"
    >
      <div
        class="flex items-center justify-between p-3 bg-[#111111] rounded border border-[#333333] hover:bg-[#1a1a1a] hover:border-neon-blue transition"
        style="cursor: pointer"
        @click="openEntityModal('feature', feature)"
        data-testid="feature-row"
      >
        <div class="flex items-center">
          <button class="text-neon-blue mr-3" @click.stop="toggleFeature(fIdx)">
            {{ feature.expanded ? '▼' : '▶' }}
          </button>
          <span class="text-neon-blue font-bold text-base">{{ stripProjectPrefix(feature.external_id || feature.id) }}</span>
          <span class="text-gray-200 ml-3 text-sm">{{ feature.title }}</span>
        </div>
        <select class="bg-[#0a0a0a] text-neon-blue border border-[#333333] rounded px-3 py-1 text-sm" v-model="feature.status" @change="updateFeatureStatus(feature)" @click.stop>
          <option value="pending">pending</option>
          <option value="in progress">in progress</option>
          <option value="done">done</option>
        </select>
      </div>

      <!-- Tasks for Feature -->
      <div v-if="feature.expanded && feature.tasks && feature.tasks.length" class="ml-8 mt-3 space-y-4 border-l-2 border-[#333333] pl-4">
        <!-- Render all tasks dynamically -->
        <div
          v-for="(task, tIdx) in feature.tasks"
          :key="task.id || tIdx"
          class="mb-4"
        >
          <div
            class="flex items-center justify-between p-2 bg-[#0a0a0a] rounded border border-[#333333] hover:bg-[#222222] hover:border-neon-blue transition"
            style="cursor: pointer"
            @click="openEntityModal('task', feature, task)"
            data-testid="task-row"
          >
            <div class="flex items-center">
              <button class="text-neon-blue mr-3" @click.stop="toggleTask(fIdx, tIdx)">
                {{ task.expanded ? '▼' : '▶' }}
              </button>
              <span class="text-neon-blue text-sm">{{ stripProjectPrefix(task.external_id || task.id) }}</span>
              <span class="text-gray-200 ml-3 text-sm">{{ task.title }}</span>
            </div>
            <select class="bg-[#111111] text-neon-blue border border-[#333333] rounded px-2 py-1 text-xs" v-model="task.status" @change="updateTaskStatus(feature, task)" @click.stop>
              <option value="pending">pending</option>
              <option value="in progress">in progress</option>
              <option value="done">done</option>
            </select>
          </div>

          <!-- Render all subtasks dynamically -->
          <div v-if="task.expanded && task.subtasks && task.subtasks.length" class="ml-8 mt-2 space-y-2 border-l-2 border-[#444444] pl-4">
            <div
              v-for="(subtask, sIdx) in task.subtasks"
              :key="subtask.id || sIdx"
              class="flex items-center justify-between p-2 bg-[#111111] rounded border border-[#333333] hover:bg-[#222222] hover:border-neon-blue transition"
              @click="openModal(feature, task, subtask)"
              style="cursor: pointer"
              data-testid="subtask-row"
            >
              <div class="flex items-center">
                <span class="text-neon-blue text-xs">{{ stripProjectPrefix(subtask.external_id || subtask.id) }}</span>
                <span class="text-gray-200 ml-3 text-xs">{{ subtask.title }}</span>
              </div>
              <select class="bg-[#0a0a0a] text-neon-blue border border-[#333333] rounded px-2 py-1 text-xs" v-model="subtask.status" @change="updateSubtaskStatus(feature, task, subtask)" @click.stop>
                <option value="pending">pending</option>
                <option value="in progress">in progress</option>
                <option value="done">done</option>
              </select>
            </div>
            <SubtaskModal
              v-if="modalState.visible"
              :visible="modalState.visible"
              :subtask="modalState.subtask"
              :feature-id="modalState.feature?.id"
              @close="closeModal"
            >
              <template #modal-heading>
                {{ modalState.subtask?.title }}
              </template>
              <template #modal-meta>
                {{ stripProjectPrefix(modalState.feature?.external_id || modalState.feature?.id) }}: {{ modalState.feature?.title }}<br>
                {{ stripProjectPrefix(modalState.task?.external_id || modalState.task?.id) }}: {{ modalState.task?.title }}<br>
                {{ stripProjectPrefix(modalState.subtask?.external_id || modalState.subtask?.id) }}: {{ modalState.subtask?.title }}
              </template>
            </SubtaskModal>
          </div>
        </div>
      </div>
    </div>
    <EntityModal
      v-if="entityModalState.visible"
      :visible="entityModalState.visible"
      :entityType="entityModalState.type"
      :feature="entityModalState.feature"
      :task="entityModalState.task"
      @close="closeEntityModal"
    >
      <template #modal-heading>
        <span v-if="entityModalState.type === 'feature'">
          {{ entityModalState.feature?.title }}
        </span>
        <span v-else>
          {{ entityModalState.task?.title }}
        </span>
      </template>
      <template #modal-meta>
        <span v-if="entityModalState.type === 'feature'">
          {{ stripProjectPrefix(entityModalState.feature?.external_id || entityModalState.feature?.id) }}: {{ entityModalState.feature?.title }}
        </span>
        <span v-else>
          {{ stripProjectPrefix(entityModalState.feature?.external_id || entityModalState.feature?.id) }}: {{ entityModalState.feature?.title }}<br>
          {{ stripProjectPrefix(entityModalState.task?.external_id || entityModalState.task?.id) }}: {{ entityModalState.task?.title }}
        </span>
      </template>
      <template #basic-info>
        <InfoDisplay
          v-if="entityModalState.type === 'feature'"
          :data="entityModalState.feature?.basic_info"
          label="No basic info available."
        />
        <InfoDisplay
          v-else-if="entityModalState.type === 'task'"
          :data="entityModalState.task?.basic_info"
          label="No basic info available."
        />
        <span v-else>No basic info available.</span>
      </template>
      <template #activity-log>
        <div v-if="entityModalState.type === 'feature' && entityModalState.feature?.activity_log && entityModalState.feature.activity_log.length">
          <div
            v-for="(entry, idx) in entityModalState.feature.activity_log"
            :key="idx"
            class="chat-row"
          >
            <div class="chat-bubble chat-bubble-left">
              <span class="chat-message">{{ entry.message || entry }}</span>
              <span class="chat-meta-inline chat-meta-left">
                {{ entry.sender || "You" }} •
                {{ entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' }}
              </span>
            </div>
          </div>
        </div>
        <div v-else-if="entityModalState.type === 'task' && entityModalState.task?.activity_log && entityModalState.task.activity_log.length">
          <div
            v-for="(entry, idx) in entityModalState.task.activity_log"
            :key="idx"
            class="chat-row"
          >
            <div class="chat-bubble chat-bubble-left">
              <span class="chat-message">{{ entry.message || entry }}</span>
              <span class="chat-meta-inline chat-meta-left">
                {{ entry.sender || "You" }} •
                {{ entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' }}
              </span>
            </div>
          </div>
        </div>
        <span v-else>No activity log available.</span>
      </template>
      <template #cap-full>
        <InfoDisplay
          v-if="entityModalState.type === 'feature'"
          :data="entityModalState.feature?.cap"
          label="No CAP data available."
        />
        <InfoDisplay
          v-else-if="entityModalState.type === 'task'"
          :data="entityModalState.task?.cap"
          label="No CAP data available."
        />
        <span v-else>No CAP data available.</span>
      </template>
      <template #cap-risks>
        <InfoDisplay
          v-if="entityModalState.type === 'feature'"
          :data="entityModalState.feature?.cap?.risks"
          label="No CAP risks/gaps available."
        />
        <InfoDisplay
          v-else-if="entityModalState.type === 'task'"
          :data="entityModalState.task?.cap?.risks"
          label="No CAP risks/gaps available."
        />
        <span v-else>No CAP risks/gaps available.</span>
      </template>
      <template #cap-clarifications>
        <InfoDisplay
          v-if="entityModalState.type === 'feature'"
          :data="entityModalState.feature?.cap?.questions"
          label="No CAP clarifications available."
        />
        <InfoDisplay
          v-else-if="entityModalState.type === 'task'"
          :data="entityModalState.task?.cap?.questions"
          label="No CAP clarifications available."
        />
        <span v-else>No CAP clarifications available.</span>
      </template>
      <template #pcc-full>
        <InfoDisplay
          v-if="entityModalState.type === 'feature'"
          :data="entityModalState.feature?.pcc"
          label="No PCC data available."
        />
        <InfoDisplay
          v-else-if="entityModalState.type === 'task'"
          :data="entityModalState.task?.pcc"
          label="No PCC data available."
        />
        <span v-else>No PCC data available.</span>
      </template>
      <template #pcc-risks>
        <InfoDisplay
          v-if="entityModalState.type === 'feature'"
          :data="entityModalState.feature?.pcc?.risks"
          label="No PCC risks/gaps available."
        />
        <InfoDisplay
          v-else-if="entityModalState.type === 'task'"
          :data="entityModalState.task?.pcc?.risks"
          label="No PCC risks/gaps available."
        />
        <span v-else>No PCC risks/gaps available.</span>
      </template>
      <template #pcc-clarifications>
        <InfoDisplay
          v-if="entityModalState.type === 'feature'"
          :data="entityModalState.feature?.pcc?.questions"
          label="No PCC clarifications available."
        />
        <InfoDisplay
          v-else-if="entityModalState.type === 'task'"
          :data="entityModalState.task?.pcc?.questions"
          label="No PCC clarifications available."
        />
        <span v-else>No PCC clarifications available.</span>
      </template>
      <template #red-full>
        <InfoDisplay
          v-if="entityModalState.type === 'feature'"
          :data="entityModalState.feature?.red"
        />
      </template>
      <template #red-risks>
        <InfoDisplay
          :data="entityModalState.feature?.red?.risks_gaps_recommendations"
        />
      </template>
      <template #red-clarifications>
        <InfoDisplay
          :data="entityModalState.feature?.red?.clarification_questions"
        />
      </template>
    </EntityModal>
  </div>
</template>


<script setup>
import { ref, watch, h, computed } from 'vue'
import SubtaskModal from './SubtaskModal.vue'
import EntityModal from './EntityModal.vue'

// Utility to strip "P1-" prefix from externalId
function stripProjectPrefix(id) {
  if (!id) return '';
  return id.replace(/^P\d+-/, '');
}

const props = defineProps({
  features: {
    type: Array,
    required: true
  }
})

// Expose a computed alias so the template can use `features`
const features = computed(() => props.features)

const emit = defineEmits(['update:features'])

const modalState = ref({
  visible: false,
  feature: null,
  task: null,
  subtask: null
})
const entityModalState = ref({
  visible: false,
  type: null, // 'feature' or 'task'
  feature: null,
  task: null
})

function openModal(feature, task, subtask) {
  modalState.value = {
    visible: true,
    feature,
    task,
    subtask
  }
}
function closeModal() {
  modalState.value = {
    visible: false,
    feature: null,
    task: null,
    subtask: null
  }
}

function openEntityModal(type, feature, task = null) {
  entityModalState.value = {
    visible: true,
    type,
    feature,
    task
  }
}
function closeEntityModal() {
  entityModalState.value = {
    visible: false,
    type: null,
    feature: null,
    task: null
  }
}

const toggleFeature = (index) => {
  props.features[index].expanded = !props.features[index].expanded
  emit('update:features', props.features)
}

const toggleTask = (featureIndex, taskIndex) => {
  const task = props.features[featureIndex].tasks[taskIndex]
  task.expanded = !task.expanded
  emit('update:features', props.features)
}

// Watch status changes to auto-expand when status becomes 'in progress'
watch(
  () => props.features.map(f => f.status),
  () => {
    props.features.forEach((feature, fIndex) => {
      if (feature.status === 'in progress' && !feature.expanded) {
        feature.expanded = true
      }
      feature.tasks.forEach((task, tIndex) => {
        if (task.status === 'in progress' && !task.expanded) {
          task.expanded = true
        }
      })
    })
    emit('update:features', props.features)
  },
  { deep: true }
)
async function updateFeatureStatus(feature) {
  try {
    await fetch(`/api/features/${feature.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: feature.status })
    });
    emit('update:features', props.features);
  } catch (err) {
    console.error('Failed to update feature status:', err);
  }
}

async function updateTaskStatus(feature, task) {
  try {
    await fetch(`/api/features/${feature.id}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: task.status })
    });
    emit('update:features', props.features);
  } catch (err) {
    console.error('Failed to update task status:', err);
  }
}

async function updateSubtaskStatus(feature, task, subtask) {
  try {
    await fetch(`/api/features/${feature.id}/tasks/${task.id}/subtasks/${subtask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: subtask.status })
    });
    emit('update:features', props.features);
  } catch (err) {
    console.error('Failed to update subtask status:', err);
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
.feature-tree {
  width: 100%;
}
/* Neon blue for hover border */
:global(.border-neon-blue) {
  border-color: #00f3ff !important;
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
.chat-bubble {
  border-radius: 12px;
  padding: 8px 12px;
  max-width: 80%;
  word-break: break-word;
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  background: #222;
  color: #fff;
}
.chat-bubble-left {
  align-self: flex-start;
  justify-content: flex-start;
}
.chat-meta-inline {
  font-size: 0.75em;
  color: #00f3ff;
  font-weight: bold;
  margin-left: 8px;
  white-space: nowrap;
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
