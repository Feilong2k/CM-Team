const ToolRunner = require('../../../tools/ToolRunner');

/**
 * StandardProtocol - Simple protocol that streams LLM output, executes tools, and logs traces.
 */
class StandardProtocol {
  constructor({ adapter, tools, traceService }) {
    this.adapter = adapter;
    this.tools = tools;
    this.traceService = traceService;
  }

  /**
   * Execute streaming with the given context.
   * @param {Object} context - Protocol execution context
   * @returns {AsyncIterable} Async iterator yielding protocol events
   */
  async *executeStreaming(context) {
    const { messages, mode, projectId, requestId, tools = this.tools, traceService = this.traceService, temperature } = context;

    let fullContent = '';
    let fullReasoning = '';

    // Use temperature from context if provided, otherwise fallback to old defaults
    const resolvedTemperature = (temperature !== undefined) ? temperature : (mode === 'plan' ? 0.7 : 0.3);

    // Call adapter streaming
    const adapterStream = this.adapter.sendMessagesStreaming(messages, {
      temperature: resolvedTemperature,
      max_tokens: 8192,
      // tools are passed via adapter's internal handling
    });

    for await (const event of adapterStream) {
      if (event.reasoningChunk) {
        fullReasoning += event.reasoningChunk;
      } else if (event.chunk) {
        fullContent += event.chunk;
        yield { type: 'CHUNK', content: event.chunk };
      } else if (event.toolCalls) {
        // Delegate tool execution to ToolRunner
        const results = await ToolRunner.executeToolCalls(
          tools,
          event.toolCalls,
          { projectId, requestId }
        );
        yield { type: 'TOOL_RESULTS', results };
      } else if (event.done) {
        // Use final values if provided
        if (event.fullContent !== undefined) {
          fullContent = event.fullContent;
        }
        if (event.fullReasoning !== undefined) {
          fullReasoning = event.fullReasoning;
        }
        // No break, continue to consume any remaining events (if any)
      }
    }

    // Log trace event
    if (traceService && typeof traceService.logEvent === 'function') {
      await traceService.logEvent({
        projectId,
        requestId,
        source: 'orion',
        type: 'llm_call',
        summary: `LLM call in ${mode} mode`,
        details: {
          content: fullContent,
          reasoning: fullReasoning || undefined,
          mode,
        },
      });
    }

    // Yield final DONE event
    yield { type: 'DONE', fullContent, fullReasoning: fullReasoning || undefined };
  }

  /**
   * Get the name of the protocol.
   * @returns {string} Protocol name
   */
  getName() {
    return 'standard';
  }
}

module.exports = StandardProtocol;
