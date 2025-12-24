import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUIStore = defineStore('ui', () => {
  // --- State ---
  
  // Chat mode: 'plan' or 'act'
  const chatMode = ref(localStorage.getItem('orion_chat_mode') || 'plan')
  
  // Draft message text (persisted so it survives trace toggle/refresh)
  const draftMessage = ref(localStorage.getItem('orion_draft_message') || '')
  
  // Trace dashboard visibility
  const traceVisible = ref(localStorage.getItem('orion_trace_visible') === 'true')

  // Two-stage protocol toggle (routes messages to /api/chat/messages_two_stage)
  const twoStageEnabled = ref(localStorage.getItem('orion_two_stage_enabled') === 'true')

  // --- Watchers for Persistence ---
  
  watch(chatMode, (newVal) => {
    localStorage.setItem('orion_chat_mode', newVal)
  })

  watch(draftMessage, (newVal) => {
    localStorage.setItem('orion_draft_message', newVal)
  })

  watch(traceVisible, (newVal) => {
    localStorage.setItem('orion_trace_visible', String(newVal))
  })

  watch(twoStageEnabled, (newVal) => {
    localStorage.setItem('orion_two_stage_enabled', String(newVal))
  })

  // --- Actions ---
  
  function setChatMode(mode) {
    if (mode === 'plan' || mode === 'act') {
      chatMode.value = mode
    }
  }

  function setDraftMessage(text) {
    draftMessage.value = text
  }

  function toggleTrace() {
    traceVisible.value = !traceVisible.value
  }

  function toggleTwoStage() {
    twoStageEnabled.value = !twoStageEnabled.value
  }

  return {
    chatMode,
    draftMessage,
    traceVisible,
    twoStageEnabled,
    setChatMode,
    setDraftMessage,
    toggleTrace,
    toggleTwoStage
  }
})
