/**
 * Composable for managing message expansion state
 * Provides functionality for clamping long messages and toggling expansion
 */

import { ref, computed } from 'vue'

/**
 * @typedef {Object} MessageExpansionOptions
 * @property {number} [charThreshold=150] - Character threshold for considering a message "long"
 * @property {number} [lineClamp=3] - Number of lines to clamp to when collapsed
 */

/**
 * Creates a message expansion manager
 * @param {import('vue').Ref<Array>} messagesRef - Reactive reference to messages array
 * @param {MessageExpansionOptions} [options] - Configuration options
 * @returns {Object} Message expansion utilities
 */
export function useMessageExpansion(messagesRef, options = {}) {
  const { charThreshold = 150, lineClamp = 3 } = options

  /**
   * Check if a message content is considered long based on character count
   * @param {string} content - Message content
   * @returns {boolean} True if message is long
   */
  const isMessageLong = (content) => {
    return content.length > charThreshold
  }

  /**
   * Toggle expansion state for a specific message
   * @param {number} index - Index of the message in the messages array
   */
  const toggleMessageExpansion = (index) => {
    if (messagesRef.value[index] && messagesRef.value[index].type === 'user') {
      const currentExpanded = messagesRef.value[index].isExpanded === true
      messagesRef.value[index].isExpanded = !currentExpanded
    }
  }

  /**
   * Get the clamped state for a message
   * @param {Object} message - Message object
   * @returns {boolean} True if message should be clamped
   */
  const isMessageClamped = (message) => {
    return message.type === 'user' && 
           message.isExpanded === false && 
           isMessageLong(message.content)
  }

  /**
   * Get CSS classes for message content based on expansion state
   * @param {Object} message - Message object
   * @returns {string} CSS classes
   */
  const getMessageContentClasses = (message) => {
    const classes = ['transition-all', 'duration-200', 'overflow-hidden']
    if (isMessageClamped(message)) {
      classes.push('line-clamp-3')
    }
    return classes.join(' ')
  }

  /**
   * Get toggle button text based on expansion state
   * @param {Object} message - Message object
   * @returns {string} Button text
   */
  const getToggleButtonText = (message) => {
    return message.isExpanded === false ? 'Show more' : 'Show less'
  }

  return {
    isMessageLong,
    toggleMessageExpansion,
    isMessageClamped,
    getMessageContentClasses,
    getToggleButtonText,
    charThreshold,
    lineClamp
  }
}
