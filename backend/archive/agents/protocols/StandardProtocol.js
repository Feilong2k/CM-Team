const { ProtocolStrategy, ProtocolExecutionContext, ProtocolEventTypes } = require('./ProtocolStrategy');
const ToolRunner = require('../../../tools/ToolRunner');
const functionDefinitions = require('../../../tools/functionDefinitions');

/**
 * StandardProtocol - Compatibility wrapper for legacy Orion "standard" behavior
 * Extends ProtocolStrategy to provide streaming-first executeStreaming that behaves
 * like today's /api/chat/messages route.
 * 
 * Key characteristics:
 * - Single adapter call per turn
 * - Pass-through streaming of chunks and toolCalls
 * - Executes all tool calls in a batch (no A/B cycling)
 * - No phase events, budgets, or duplicate detection
 */
class StandardProtocol extends ProtocolStrategy {
  /**
   * Create a new StandardProtocol
   * @param {Object} params
   * @param {Object} params.adapter - LLMAdapter instance
   * @param {Object} params.tools - Tool registry
   * @param {Object} params.traceService - TraceService instance
   */
  constructor({ adapter, tools, traceService }) {
    super();
    this.adapter = adapter;
    this.tools = tools;
    this.traceService = traceService;
  }

  /**
   * Get protocol name
   * @returns {string} Protocol identifier
   */
  getName() {
    return 'standard';
  }

  /**
   * Check if protocol can handle the request
   * @param {ProtocolExecutionContext} executionContext - Execution context
   * @returns {boolean} Always true for StandardProtocol
   */
  canHandle(executionContext) {
    return true;
  }

  /**
   * Execute the protocol with streaming support
   * @param {ProtocolExecutionContext} executionContext - Precise execution context
   * @returns {AsyncGenerator<ProtocolEvent>} Stream of protocol events
   */
  async *executeStreaming(executionContext) {
    const { messages, mode, projectId, requestId } = executionContext;
    
    // Prepare messages for adapter (filter and normalize)
    const safeMessages = messages
      .filter(m => m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content }));

    // Build adapter options
    const adapterOptions = {
      temperature: mode === 'plan' ? 0.7 : 0.3,
      max_tokens: 8192,
      tools: functionDefinitions,
      context: {
        projectId,
        requestId,
      },
    };

    // Track final content for DONE event
    let finalContent = '';
    
    try {
      // Single adapter call per turn (standard behavior)
      const adapterStream = this.adapter.sendMessagesStreaming(safeMessages, adapterOptions);
      
      for await (const event of adapterStream) {
        if (event.chunk) {
          // Forward chunk as ProtocolEvent
          yield { type: ProtocolEventTypes.CHUNK, content: event.chunk };
          finalContent += event.chunk;
        } else if (event.toolCalls) {
          // Forward tool calls as ProtocolEvent
          const calls = event.toolCalls;
          yield { type: ProtocolEventTypes.TOOL_CALLS, calls };
          
          // Execute all tool calls in batch (standard behavior)
          await ToolRunner.executeToolCalls(
            this.tools,
            calls,
            { projectId, requestId }
          );
        } else if (event.done) {
          // Prefer adapter's fullContent if provided
          if (event.fullContent !== undefined) {
            finalContent = event.fullContent;
          }
        }
      }
    } catch (error) {
      // Let the error propagate (tests accept either thrown error or ERROR event)
      throw error;
    }

    // Emit exactly one DONE event at the end
    yield { type: ProtocolEventTypes.DONE, fullContent: finalContent };
  }
}

module.exports = StandardProtocol;
