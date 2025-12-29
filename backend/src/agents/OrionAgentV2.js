/**
 * OrionAgentV2 - Thin wrapper that delegates streaming execution to a protocol.
 * Implements the two-stage protocol plan interface.
 */
class OrionAgentV2 {
  /**
   * Create a new OrionAgentV2 instance.
   * @param {Object} dependencies
   * @param {Object} dependencies.adapter - LLM adapter
   * @param {Object} dependencies.tools - Tools registry
   * @param {Object} dependencies.traceService - Trace service
   * @param {Object} dependencies.protocol - Protocol instance with executeStreaming method
   */
  constructor({ adapter, tools, traceService, protocol }) {
    this.adapter = adapter;
    this.tools = tools;
    this.traceService = traceService;
    this.protocol = protocol;
  }

  /**
   * Process a user message with streaming response.
   * @param {string} projectId - Project identifier
   * @param {string} userMessage - User message content
   * @param {Object} [options={}] - Additional options
   * @param {'plan'|'act'} [options.mode='plan'] - Execution mode
   * @param {string} [options.requestId] - Request identifier
   * @param {Object} [options.projectConfig] - Project-specific configuration
   * @returns {AsyncIterable} Async iterator yielding protocol events
   */
  processStreaming(projectId, userMessage, options = {}) {
    const { mode = 'plan', requestId, projectConfig } = options;

    // Temperature policy - owned by OrionAgentV2
    let temperature;
    if (mode === 'act') {
      temperature = 0.0;
    } else {
      temperature = 1.3;
    }

    // Project-level overrides
    if (projectConfig && projectConfig.temperature && typeof projectConfig.temperature === 'object') {
      const overrideForMode = projectConfig.temperature[mode];
      if (typeof overrideForMode === 'number') {
        temperature = overrideForMode;
      }
    }

    // Build system message that includes project ID and mode
    const systemMessage = {
      role: 'system',
      content: `You are Orion assisting project ${projectId} in ${mode} mode.`
    };

    const messages = [
      systemMessage,
      { role: 'user', content: userMessage }
    ];

    // Ensure requestId is present (required by ProtocolExecutionContext)
    const finalRequestId = requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create ProtocolExecutionContext object with defaults matching ProtocolExecutionContext
    const context = {
      messages,
      mode,
      projectId,
      requestId: finalRequestId,
      adapter: this.adapter,
      tools: this.tools,
      traceService: this.traceService,
      temperature, // Temperature policy owned by agent
      config: {
        maxPhaseCycles: 3,
        maxDuplicateAttempts: 1,
        debugShowToolResults: false
      }
    };

    // Delegate to protocol
    return this.protocol.executeStreaming(context);
  }
}

module.exports = OrionAgentV2;
