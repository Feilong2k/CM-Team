<template>
  <div class="flex h-screen bg-black text-neon-blue font-mono overflow-hidden">
    <!-- Layout when trace dashboard is hidden: Chat (1/2) + Project Console (1/2) -->
    <template v-if="!traceVisible">
      <!-- Left Panel: Chat Terminal -->
      <div class="relative w-1/2 border-r border-[#333333] overflow-hidden">
        <ChatPanel @send="handleSendMessage" />

        <!-- Trace dashboard toggle arrow -->
        <button
          type="button"
          data-testid="trace-toggle"
          class="absolute top-1/2 -right-2 transform -translate-y-1/2 bg-[#111111] border border-[#444444] rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-[#1a1a1a]"
          @click="toggleTrace"
          title="Show Trace Dashboard"
        >
          ≡
        </button>
      </div>

      <!-- Right Panel: Project Console -->
      <div
        data-testid="workflow-panel"
        class="w-1/2 bg-[#0a0a0a] overflow-hidden flex flex-col p-4"
      >
        <!-- Project header -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg text-neon-blue">Project Console</h2>
            <select
              data-testid="project-selector"
              class="bg-[#111111] text-neon-blue border border-[#333333] rounded px-3 py-1 text-sm"
              v-model="currentProjectId"
            >
              <option value="P1">P1</option>
            </select>
          </div>
          <div class="flex items-center">
            <span class="text-neon-blue mr-3 text-sm">{{ currentProjectId }}</span>
            <p class="text-gray-400 text-xs">Initial project for MVP</p>
          </div>
        </div>

        <!-- Features, Tasks, and Subtasks Tree -->
        <div class="flex-1 overflow-y-auto border border-[#333333] rounded p-4">
          <FeatureTree :features="features" @update:features="updateFeatures" />
        </div>
      </div>
    </template>

    <!-- Layout when trace dashboard is visible: Chat (1/3) + Trace Timeline/Details (2/3), Project Console hidden -->
    <template v-else>
      <!-- Left Panel: Chat Terminal (1/3) -->
      <div class="relative w-1/3 border-r border-[#333333] overflow-hidden">
        <ChatPanel @send="handleSendMessage" />

        <!-- Trace dashboard toggle arrow -->
        <button
          type="button"
          data-testid="trace-toggle"
          class="absolute top-1/2 -right-2 transform -translate-y-1/2 bg-[#111111] border border-[#444444] rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-[#1a1a1a]"
          @click="toggleTrace"
          title="Hide Trace Dashboard"
        >
          ×
        </button>
      </div>

      <!-- Right: Trace Timeline + Details (2/3) -->
      <div class="w-2/3 overflow-hidden">
        <TraceDashboard :project-id="currentProjectId" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useUIStore } from './stores/uiStore'
import ChatPanel from './components/ChatPanel.vue'
import FeatureTree from './components/FeatureTree.vue'
import TraceDashboard from './components/TraceDashboard.vue'

const uiStore = useUIStore()
const currentProjectId = ref('P1')

// Use store state for persistence
const traceVisible = computed(() => uiStore.traceVisible)

const handleSendMessage = (message) => {
  console.log('Message sent:', message)
}

const toggleTrace = () => {
  uiStore.toggleTrace()
}

const features = ref([])

const fetchFeatures = async () => {
  try {
    const res = await fetch('/api/features')
    if (!res.ok) throw new Error('Failed to fetch features')
    const data = await res.json()
    features.value = data.features || []
  } catch (err) {
    console.error('Error fetching features:', err)
  }
}

onMounted(fetchFeatures)

const updateFeatures = (newFeatures) => {
  // This function is called when FeatureTree emits an update.
  // We update the local features ref with the new data.
  features.value = newFeatures
}

// Watch status changes to auto-expand when status becomes 'in progress'
watch(
  () => features.value.map(f => f.status),
  () => {
    features.value.forEach((feature) => {
      if (feature.status === 'in progress' && !feature.expanded) {
        feature.expanded = true
      }
      feature.tasks.forEach((task) => {
        if (task.status === 'in progress' && !task.expanded) {
          task.expanded = true
        }
      })
    })
  },
  { deep: true }
)
</script>

<style scoped>
/* Additional scoped styles if needed */
</style>
