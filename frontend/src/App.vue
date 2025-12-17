e<template>
  <div class="flex h-screen bg-black text-neon-blue font-mono">
    <!-- Left Panel: Chat Terminal -->
    <div class="w-1/2 border-r border-[#333333] overflow-hidden">
      <ChatPanel @send="handleSendMessage" />
    </div>

    <!-- Right Panel: Project Console -->
    <div data-testid="workflow-panel" class="w-1/2 bg-[#0a0a0a] overflow-hidden flex flex-col p-4">
      <!-- Project header -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg text-neon-blue">Project Console</h2>
          <select data-testid="project-selector" class="bg-[#111111] text-neon-blue border border-[#333333] rounded px-3 py-1 text-sm">
            <option value="P-000">Default Project</option>
          </select>
        </div>
        <div class="flex items-center">
          <span class="text-neon-blue mr-3 text-sm">P-000</span>
          <p class="text-gray-400 text-xs">Initial project for MVP</p>
        </div>
      </div>

      <!-- Features, Tasks, and Subtasks Tree -->
      <div class="flex-1 overflow-y-auto border border-[#333333] rounded p-4">
        <FeatureTree :features="features" @update:features="updateFeatures" />
      </div>
    </div>
  </div>
</template>

<script setup>
import ChatPanel from './components/ChatPanel.vue'
import FeatureTree from './components/FeatureTree.vue'
import { ref, watch } from 'vue'
import featureData from './utils/featureData.json'

const handleSendMessage = (message) => {
  console.log('Message sent:', message)
  // For now, just log. In a real app, this would be sent to the backend.
}

const features = ref(featureData.features)

const updateFeatures = (newFeatures) => {
  // This function is called when FeatureTree emits an update.
  // We update the local features ref with the new data.
  features.value = newFeatures
}

// Watch status changes to auto-expand when status becomes 'in progress'
watch(
  () => features.value.map(f => f.status),
  () => {
    features.value.forEach((feature, fIndex) => {
      if (feature.status === 'in progress' && !feature.expanded) {
        feature.expanded = true
      }
      feature.tasks.forEach((task, tIndex) => {
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
