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
          <span class="text-neon-blue font-bold text-base">{{ feature.id }}</span>
          <span class="text-gray-200 ml-3 text-sm">{{ feature.title }}</span>
        </div>
        <select class="bg-[#0a0a0a] text-neon-blue border border-[#333333] rounded px-3 py-1 text-sm" v-model="feature.status" @click.stop>
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
              <span class="text-neon-blue text-sm">{{ task.id }}</span>
              <span class="text-gray-200 ml-3 text-sm">{{ task.title }}</span>
            </div>
            <select class="bg-[#111111] text-neon-blue border border-[#333333] rounded px-2 py-1 text-xs" v-model="task.status" @click.stop>
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
                <span class="text-neon-blue text-xs">{{ subtask.id }}</span>
                <span class="text-gray-200 ml-3 text-xs">{{ subtask.title }}</span>
              </div>
              <select class="bg-[#0a0a0a] text-neon-blue border border-[#333333] rounded px-2 py-1 text-xs" v-model="subtask.status" @click.stop>
                <option value="pending">pending</option>
                <option value="in progress">in progress</option>
                <option value="done">done</option>
              </select>
            </div>
            <SubtaskModal
              v-if="modalState.visible"
              :visible="modalState.visible"
              @close="closeModal"
            >
              <template #modal-heading>
                Subtask Modal
              </template>
              <template #modal-meta>
                Feature: {{ modalState.feature?.title }}<br>
                Task: {{ modalState.task?.title }}<br>
                Subtask: {{ modalState.subtask?.title }}
              </template>
            </SubtaskModal>
          </div>
        </div>
      </div>
    </div>
            <EntityModal
              v-if="entityModalState.visible"
              :visible="entityModalState.visible"
              @close="closeEntityModal"
            >
              <template #modal-heading>
                {{ entityModalState.type === 'feature' ? 'Feature Modal' : 'Task Modal' }}
              </template>
              <template #modal-meta>
                <span v-if="entityModalState.type === 'feature'">
                  Feature: {{ entityModalState.feature?.title }}
                </span>
                <span v-else>
                  Feature: {{ entityModalState.feature?.title }}<br>
                  Task: {{ entityModalState.task?.title }}
                </span>
              </template>
              <template #basic-info>
                Basic Info Placeholder
              </template>
              <template #activity-log>
                Activity Log Placeholder
              </template>
              <template #pvp-full>
                PVP Full Analysis Placeholder
              </template>
              <template #pvp-risks>
                PVP Risks/Gaps Placeholder
              </template>
              <template #pvp-clarifications>
                PVP Clarifications Placeholder
              </template>
              <template #cdp-full>
                CDP Full Analysis Placeholder
              </template>
              <template #cdp-risks>
                CDP Risks/Gaps Placeholder
              </template>
              <template #cdp-clarifications>
                CDP Clarifications Placeholder
              </template>
            </EntityModal>
    
    
    <!-- (Removed hardcoded Feature 1 block; all features are now rendered dynamically above) -->
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import SubtaskModal from './SubtaskModal.vue'
import EntityModal from './EntityModal.vue'

const props = defineProps({
  features: {
    type: Array,
    required: true
  }
})

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
</script>

<style scoped>
.feature-tree {
  width: 100%;
}
/* Neon blue for hover border */
:global(.border-neon-blue) {
  border-color: #00f3ff !important;
}
</style>
