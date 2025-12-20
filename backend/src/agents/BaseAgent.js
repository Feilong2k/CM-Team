/**
 * Abstract base class for AI agents.
 * Provides common functionality for tool orchestration, context building, and conversation management.
 * 
 * @abstract
 */
class BaseAgent {
  /**
   * Constructor for BaseAgent.
   * @param {Object} adapter - Model adapter that implements LLMAdapter interface
   * @param {Object} tools - Tool registry or database tool for accessing tools
   * @param {string} name - Agent name (e.g., 'Orion', 'Tara', 'Devon')
   */
  constructor(adapter, tools, name) {
    if (new.target === BaseAgent) {
      throw new Error('BaseAgent is an abstract class and cannot be instantiated directly');
    }

    if (!adapter || typeof adapter.sendMessages !== 'function') {
      throw new Error('Adapter must implement LLMAdapter interface');
    }

    this.adapter = adapter;
    this.tools = tools || {};
    this.name = name || 'UnknownAgent';
    this.conversationHistory = [];
    this.maxHistoryLength = 20;
  }

  /**
   * Build context for a request.
   * @abstract
   * @param {string} projectId - Project ID
   * @param {string} taskId - Task ID (optional)
   * @returns {Promise<Object>} Context object
   */
  async buildContext(projectId, taskId) {
    throw new Error('buildContext() must be implemented by subclass');
  }

  /**
   * Process a user request with context and tools.
   * @abstract
   * @param {string} projectId - Project ID
   * @param {string} userMessage - User's message
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Response object
   */
  async process(projectId, userMessage, options = {}) {
    throw new Error('process() must be implemented by subclass');
  }

  /**
   * Handle tool calls from LLM response.
   * @param {Array} toolCalls - Array of tool call objects
   * @param {Object} context - Current context
   * @returns {Promise<Array>} Array of tool execution results
   */
  async handleToolCalls(toolCalls, context) {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return [];
    }

    const results = [];
    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall, context);
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result,
          success: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        results.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          error: error.message,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Execute a single tool call.
   * @param {Object} toolCall - Tool call object
   * @param {Object} context - Current context
   * @returns {Promise<any>} Tool execution result
   */
  async executeTool(toolCall, context) {
    const { name, arguments: args } = toolCall;

    if (!this.tools[name]) {
      throw new Error(`Tool "${name}" not found in agent's tool registry`);
    }

    const tool = this.tools[name];
    if (typeof tool !== 'function' && typeof tool.execute !== 'function') {
      throw new Error(`Tool "${name}" is not callable`);
    }

    // Add context to tool arguments
    const toolArgs = { ...args, context };

    try {
      if (typeof tool === 'function') {
        return await tool(toolArgs);
      } else {
        return await tool.execute(toolArgs);
      }
    } catch (error) {
      throw new Error(`Tool "${name}" execution failed: ${error.message}`);
    }
  }

  /**
   * Add message to conversation history.
   * @param {string} role - Message role ('user', 'assistant', 'system')
   * @param {string} content - Message content
   * @param {Object} metadata - Additional metadata
   */
  addToHistory(role, content, metadata = {}) {
    this.conversationHistory.push({
      role,
      content,
      metadata,
      timestamp: new Date().toISOString()
    });

    // Trim history if exceeds max length
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Get conversation history.
   * @returns {Array} Conversation history
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history.
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Format conversation history for model input.
   * @returns {Array} Formatted messages for model
   */
  formatHistoryForModel() {
    return this.conversationHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 
             msg.role === 'system' ? 'system' : 'user',
      content: msg.content
    }));
  }

  /**
   * Get agent name.
   * @returns {string} Agent name
   */
  getName() {
    return this.name;
  }

  /**
   * Get adapter model name.
   * @returns {string} Model name
   */
  getModelName() {
    return this.adapter.getModelName ? this.adapter.getModelName() : 'unknown';
  }

  /**
   * Validate tool configuration.
   * @throws {Error} If tools are misconfigured
   */
  validateTools() {
    if (!this.tools || typeof this.tools !== 'object') {
      throw new Error('Tools must be an object');
    }

    // Check that all tools are callable
    for (const [name, tool] of Object.entries(this.tools)) {
      if (typeof tool !== 'function' && (typeof tool !== 'object' || typeof tool.execute !== 'function')) {
        throw new Error(`Tool "${name}" must be a function or have an execute() method`);
      }
    }
  }
}

module.exports = BaseAgent;
