import { ref, watch, nextTick } from 'vue'

/**
 * Composable for managing scroll-to-bottom indicator logic
 * 
 * @param {import('vue').Ref} messages - Reactive array of chat messages
 * @param {import('vue').Ref} messagesContainer - Reference to scroll container element
 * @param {import('vue').Ref} loadingOlder - Reactive boolean for loading older messages
 * @returns {Object} Scroll indicator state and methods
 */
export function useScrollIndicator(messages, messagesContainer, loadingOlder) {
  // Track if we should auto-scroll (when new messages are added at the end)
  const shouldAutoScroll = ref(true)
  // Track whether to show scroll-to-bottom indicator
  const showScrollToBottomIndicator = ref(false)

  /**
   * Check if user is at bottom of scroll container
   * @returns {boolean} True if user is within 50px of bottom
   */
  const isAtBottom = () => {
    if (!messagesContainer.value) return false
    const container = messagesContainer.value
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    return scrollHeight - scrollTop - clientHeight < 50
  }

  /**
   * Scroll to bottom of messages container
   */
  const scrollToBottom = () => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }

  /**
   * Scroll to bottom and hide indicator
   */
  const scrollToBottomAndHideIndicator = () => {
    scrollToBottom()
    showScrollToBottomIndicator.value = false
    shouldAutoScroll.value = true
  }

  /**
   * Handle scroll events for auto-scroll detection and indicator logic
   */
  const handleScroll = () => {
    if (!messagesContainer.value) return
    
    const container = messagesContainer.value
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    
    // Smart auto-scroll: only true if user is near bottom (within 50px)
    // Only update if we are not loading older messages to prevent interference
    if (!loadingOlder.value) {
      const atBottom = scrollHeight - scrollTop - clientHeight < 50
      shouldAutoScroll.value = atBottom
      // If user scrolls to bottom manually, hide the indicator
      if (atBottom) {
        showScrollToBottomIndicator.value = false
      }
    }
  }

  /**
   * Watch for new AI message objects (non-streaming) when user is not at bottom.
   *
   * Important: `messages` is a ref to an array that is usually mutated via push/splice.
   * For deep watches, Vue may pass the same array reference for old/new values.
   * So we watch the array length instead, which is stable for detecting append/prepend.
   */
  const watchForNewAIMessages = () => {
    watch(
      () => (Array.isArray(messages.value) ? messages.value.length : 0),
      (newLen, oldLen) => {
        if (typeof oldLen !== 'number') return
        if (newLen <= oldLen) return

        const added = messages.value.slice(oldLen)
        const hasNewAIMessage = added.some(m => m.type === 'ai' && !m.isStreaming)

        if (hasNewAIMessage && !shouldAutoScroll.value) {
          // User is not at bottom and a new AI message object appended → show indicator
          showScrollToBottomIndicator.value = true
        }
      }
    )
  }

  /**
   * Auto-scroll when new messages are added and shouldAutoScroll is true
   */
  const watchForAutoScroll = () => {
    watch(messages, () => {
      if (shouldAutoScroll.value) {
        nextTick(() => {
          scrollToBottom()
        })
      }
    }, { deep: true })
  }

  /**
   * Watch for streaming completion (ai message transitions isStreaming:true -> false).
   *
   * In the real UI we append the AI message as `{ isStreaming: true }` and then
   * mutate the same object until it becomes `{ isStreaming: false }`. That means
   * there is no "new non-streaming AI message object" append event to detect.
   */
  watch(
    () => (Array.isArray(messages.value)
      ? messages.value.map(m => (m?.type === 'ai' ? (m.isStreaming ? '1' : '0') : '_')).join('')
      : ''),
    (newSig, oldSig) => {
      if (!oldSig) return

      const oldArr = oldSig.split('')
      const newArr = (newSig || '').split('')

      // If any AI message flips 1 -> 0 while user is not at bottom, show indicator.
      const completedIdx = newArr.findIndex((v, i) => v === '0' && oldArr[i] === '1')
      if (completedIdx !== -1 && !shouldAutoScroll.value) {
        showScrollToBottomIndicator.value = true
      }
    }
  )

  // Initialize watchers
  watchForNewAIMessages()
  watchForAutoScroll()

  return {
    shouldAutoScroll,
    showScrollToBottomIndicator,
    isAtBottom,
    scrollToBottom,
    scrollToBottomAndHideIndicator,
    handleScroll
  }
}
