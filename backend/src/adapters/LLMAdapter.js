/**
 * Abstract base class for LLM adapters.
 * Defines the interface that all LLM adapters must implement.
 * 
 * @abstract
 */
class LLMAdapter {
  /**
   * Constructor for LLMAdapter. Abstract classes cannot be instantiated directly.
   * @throws {Error} If instantiated directly
   */
  constructor() {
    if (new.target === LLMAdapter) {
      throw new Error('LLMAdapter is an abstract class and cannot be instantiated directly');
    }
    
    // Note: We don't check for method implementation in constructor
    // because subclasses might define methods on prototype after super() call.
    // The check is done at runtime when methods are called.
  }

  /**
   * Send messages to the LLM and get a response.
   * @abstract
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} [options] - Additional options
   * @returns {Promise<string>} The LLM's response
   */
  async sendMessages(messages, options) {
    throw new Error('sendMessages() must be implemented by subclass');
  }

  /**
   * Parse the raw API response to extract the message content.
   * @abstract
   * @param {Object} apiResponse - The raw response from the LLM API
   * @returns {string} The extracted message content
   */
  parseResponse(apiResponse) {
    throw new Error('parseResponse() must be implemented by subclass');
  }

  /**
   * Handle tool/function calls from the LLM response.
   * @abstract
   * @param {Array} toolCalls - Array of tool calls from the LLM
   * @returns {Promise<Array>} Results of tool executions
   */
  async handleToolCalls(toolCalls) {
    throw new Error('handleToolCalls() must be implemented by subclass');
  }

  /**
   * Extract usage statistics from the API response.
   * @abstract
   * @param {Object} apiResponse - The raw response from the LLM API
   * @returns {Object} Usage statistics { promptTokens, completionTokens, totalTokens }
   */
  getUsageStats(apiResponse) {
    throw new Error('getUsageStats() must be implemented by subclass');
  }
}

module.exports = LLMAdapter;
