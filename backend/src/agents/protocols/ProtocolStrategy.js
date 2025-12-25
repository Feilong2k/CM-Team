/**
 * ProtocolStrategy Interface
 * Defines the contract for all protocol implementations
 * Streaming-first design for SSE/real-time integration
 */

/**
 * ProtocolStrategy - Abstract base class for protocol implementations
 * @abstract
 */
class ProtocolStrategy {
  /**
   * Constructor for ProtocolStrategy.
   * Prevents direct instantiation of abstract class.
   */
  constructor() {
    if (new.target === ProtocolStrategy) {
      throw new Error('ProtocolStrategy is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Execute the protocol with streaming support
   * @param {ProtocolExecutionContext} executionContext - Precise execution context
   * @returns {AsyncGenerator<ProtocolEvent>} - Stream of protocol events
   * @abstract
   */
  async *executeStreaming(executionContext) {
    throw new Error('executeStreaming() must be implemented by protocol');
  }

  /**
   * Get protocol name (for logging/debugging)
   * @returns {string} - Protocol identifier
   * @abstract
   */
  getName() {
    throw new Error('getName() must be implemented by protocol');
  }

  /**
   * Validate protocol can handle the request
   * @param {ProtocolExecutionContext} executionContext - Execution context
   * @returns {boolean} - True if protocol can handle request
   * @abstract
   */
  canHandle(executionContext) {
    throw new Error('canHandle() must be implemented by protocol');
  }
}

/**
 * ProtocolExecutionContext - Precise contract for protocol execution
 * Ensures interoperability between protocols
 */
class ProtocolExecutionContext {
  /**
   * Create a new ProtocolExecutionContext
   * @param {Object} params
   * @param {Array<{role: string, content: string}>} params.messages - Conversation messages
   * @param {'plan'|'act'} params.mode - Execution mode
   * @param {string} params.projectId - Project identifier
   * @param {string} params.requestId - Request identifier
   * @param {Object} params.adapter - LLMAdapter instance
   * @param {Object} params.tools - ToolRunner tools map
   * @param {Object} params.traceService - TraceService instance
   * @param {Object} [params.config={}] - Protocol configuration
   * @param {number} [params.config.maxPhaseCycles=3] - Maximum phase cycles
   * @param {number} [params.config.maxDuplicateAttempts=3] - Maximum duplicate attempts
   * @param {boolean} [params.config.debugShowToolResults=false] - Debug flag for tool results
   */
  constructor({
    messages,
    mode,
    projectId,
    requestId,
    adapter,
    tools,
    traceService,
    config = {}
  }) {
    this._validateRequiredFields({ messages, mode, projectId, requestId, adapter, tools, traceService });

    this.messages = messages;
    this.mode = mode;
    this.projectId = projectId;
    this.requestId = requestId;
    this.adapter = adapter;
    this.tools = tools;
    this.traceService = traceService;
    this.config = this._buildConfig(config);

    // Make the instance immutable to satisfy tests
    Object.freeze(this);
  }

  /**
   * Validate all required fields are present
   * @private
   */
  _validateRequiredFields(fields) {
    const required = [
      { name: 'messages', value: fields.messages },
      { name: 'mode', value: fields.mode },
      { name: 'projectId', value: fields.projectId },
      { name: 'requestId', value: fields.requestId },
      { name: 'adapter', value: fields.adapter },
      { name: 'tools', value: fields.tools },
      { name: 'traceService', value: fields.traceService }
    ];

    for (const { name, value } of required) {
      if (!value) {
        throw new Error(`${name} is required`);
      }
    }
  }

  /**
   * Build configuration with defaults
   * @private
   */
  _buildConfig(userConfig) {
    const defaults = {
      maxPhaseCycles: 3,
      maxDuplicateAttempts: 3,
      debugShowToolResults: false
    };

    return { ...defaults, ...userConfig };
  }
}

/**
 * ProtocolEventTypes - Standardized event types for streaming
 * @type {Readonly<{CHUNK: string, TOOL_CALLS: string, DONE: string, PHASE: string, ERROR: string}>}
 */
const ProtocolEventTypes = Object.freeze({
  CHUNK: 'chunk',           // Text content chunk: { type: 'chunk', content: string }
  TOOL_CALLS: 'tool_calls', // Tool calls from LLM: { type: 'tool_calls', calls: Array }
  DONE: 'done',             // Protocol complete: { type: 'done', fullContent: string }
  PHASE: 'phase',           // Phase metadata: { type: 'phase', phase: 'action'|'tool', index: number }
  ERROR: 'error'            // Error event: { type: 'error', error: Error }
});

module.exports = {
  ProtocolStrategy,
  ProtocolExecutionContext,
  ProtocolEventTypes
};
