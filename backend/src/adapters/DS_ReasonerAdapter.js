const LLMAdapter = require('./LLMAdapter');

/**
 * DeepSeek Reasoner API adapter.
 * Specialized for the 'deepseek-reasoner' model which supports chain-of-thought (reasoning_content).
 * Implements the LLMAdapter interface.
 */
class DS_ReasonerAdapter extends LLMAdapter {
  /**
   * Create a new DeepSeek Reasoner adapter instance.
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - DeepSeek API key (required)
   * @param {string} [config.model='deepseek-reasoner'] - Model to use
   * @param {string} [config.baseURL='https://api.deepseek.com'] - API base URL
   * @param {number} [config.timeout=60000] - Request timeout in milliseconds (higher for reasoning)
   * @param {number} [config.maxRetries=3] - Maximum number of retries for failed requests
   */
  constructor(config = {}) {
    super();

    if (!config || typeof config !== 'object') {
      throw new Error('Configuration object is required');
    }

    const {
      apiKey,
      model = 'deepseek-reasoner',
      baseURL = 'https://api.deepseek.com',
      timeout = 60000, // Reasoning models take longer
      maxRetries = 3,
    } = config;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error('apiKey is required and must be a non-empty string');
    }

    this.apiKey = apiKey.trim();
    this.model = model;
    this.baseURL = baseURL.replace(/\/$/, '');
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  /**
   * Send messages to DeepSeek Reasoner API.
   * @param {Array} messages - Array of message objects
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.stream=false] - Whether to stream the response
   * @param {number} [options.temperature] - Temperature (default 0.0 for ACT, 1.3 for PLAN)
   * @returns {Promise<Object>} The AI's response
   */
  async sendMessages(messages, options = {}) {
    const { stream = false, tools = null, max_tokens, temperature } = options;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages must be a non-empty array');
    }

    // Validate messages
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object' || !msg.role) {
        throw new Error('Each message must be an object with a role');
      }
      // Content is required unless it's an assistant message with tool calls
      if (msg.role === 'assistant' && msg.tool_calls) continue;
      if (msg.content === undefined || msg.content === null) {
        throw new Error(`Message with role '${msg.role}' must have content`);
      }
    }

    const url = `${this.baseURL}/chat/completions`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = {
      model: this.model,
      // IMPORTANT: match probe behavior (probe_runner + DS_ChatAdapter)
      // so that Reasoner sees the same message history shape that we
      // already know works in practice.
      messages: messages.map((msg) => {
        const m = { role: msg.role };
        if (msg.content !== undefined && msg.content !== null) m.content = msg.content;
        if (msg.tool_calls) m.tool_calls = msg.tool_calls;
        if (msg.tool_call_id) m.tool_call_id = msg.tool_call_id;
        if (msg.name) m.name = msg.name;
        // Preserve previous reasoning_content in history, exactly like
        // DS_ChatAdapter does, because this combination has been proven
        // to work in the probes.
        if (msg.reasoning_content) m.reasoning_content = msg.reasoning_content;
        return m;
      }),
      stream,
    };

    if (max_tokens !== undefined) body.max_tokens = max_tokens;
    // Default to 0.0 if not provided, per DeepSeek recommendations for reasoning/coding
    if (temperature !== undefined) {
      body.temperature = temperature;
    } else {
      // Safe default for "Act Mode" / generic usage if Agent doesn't specify
      body.temperature = 0.0;
    }

    if (tools && Array.isArray(tools) && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    // Retry logic
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = `API error: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage += ` - ${JSON.stringify(errorData)}`;
          } catch (e) { /* ignore */ }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        return this.parseResponse(data);

      } catch (error) {
        lastError = this._handleError(error, attempt);
        // Wait before retrying
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError || new Error('Failed to send messages');
  }

  /**
   * Send messages and stream response (SSE).
   */
  async *sendMessagesStreaming(messages, options = {}) {
    const { tools = null, max_tokens, temperature } = options;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages must be a non-empty array');
    }

    const url = `${this.baseURL}/chat/completions`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = {
      model: this.model,
      messages: messages.map((msg) => {
        const m = { role: msg.role };
        if (msg.content) m.content = msg.content;
        if (msg.reasoning_content) m.reasoning_content = msg.reasoning_content;
        return m;
      }),
      stream: true,
    };

    if (max_tokens !== undefined) body.max_tokens = max_tokens;
    body.temperature = temperature !== undefined ? temperature : 0.0;

    if (tools && Array.isArray(tools) && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    let hasYielded = false;
    let fullContent = '';
    let fullReasoning = '';

    // De-duplication state
    let lastContentDelta = null;
    let lastReasoningDelta = null;

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = `API error: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage += ` - ${JSON.stringify(errorData)}`;
          } catch (e) {}
          throw new Error(errorMessage);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') {
                hasYielded = true;
                yield { done: true, fullContent, fullReasoning };
                return;
              }

              try {
                const data = JSON.parse(dataStr);
                if (!data.choices || !data.choices[0] || !data.choices[0].delta) continue;

                const delta = data.choices[0].delta;

                // Handle Tool Calls
                if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
                  yield { toolCalls: delta.tool_calls };
                }

                // Handle Reasoning Content (Think)
                if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
                  if (lastReasoningDelta !== null && delta.reasoning_content === lastReasoningDelta) {
                    continue;
                  }
                  lastReasoningDelta = delta.reasoning_content;
                  
                  hasYielded = true;
                  // Yield a specialized reasoning chunk if the consumer supports it
                  // or just accumulate it. For now, we yield it so TraceService can log it.
                  yield { reasoningChunk: delta.reasoning_content };
                  fullReasoning += delta.reasoning_content;
                }

                // Handle Standard Content
                if (typeof delta.content === 'string' && delta.content.length > 0) {
                  if (lastContentDelta !== null && delta.content === lastContentDelta) {
                    continue;
                  }
                  lastContentDelta = delta.content;

                  hasYielded = true;
                  yield { chunk: delta.content };
                  fullContent += delta.content;
                }

              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (fullContent || fullReasoning) {
          hasYielded = true;
          yield { done: true, fullContent, fullReasoning };
        }
        return;

      } catch (error) {
        if (hasYielded) throw error; // Cannot retry mid-stream
        lastError = this._handleError(error, attempt);
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError || new Error('Failed to send messages');
  }

  /**
   * Helper to handle and log errors during retries.
   */
  _handleError(error, attempt) {
    // If error is undefined, create a generic error
    if (!error) {
      error = new Error('Unknown error during request');
    }

    // Only log errors that are not going to be retried (last attempt) or are non-retryable
    const isLastAttempt = attempt === this.maxRetries;
    const isNonRetryable = error.name === 'AbortError' || 
                          (error.message && error.message.includes('timeout')) ||
                          (error.message && error.message.includes('API error: 4'));

    if (isLastAttempt || isNonRetryable) {
      console.error(`Attempt ${attempt} failed:`, error.message);
    }
    
    // Don't retry on abort (timeout) or certain client errors
    if (error.name === 'AbortError' || (error.message && error.message.includes('timeout'))) {
      throw new Error(`Request timeout after ${this.timeout}ms`);
    }
    if (error.message && error.message.includes('API error: 4')) {
      throw error;
    }
    if (isLastAttempt) {
      throw error;
    }
    return error;
  }

  /**
   * Parse the API response.
   */
  parseResponse(apiResponse) {
    if (!apiResponse || typeof apiResponse !== 'object') {
      throw new Error('Invalid API response');
    }
    if (!apiResponse.choices || !Array.isArray(apiResponse.choices) || apiResponse.choices.length === 0) {
      throw new Error('Invalid API response: missing choices');
    }

    const firstChoice = apiResponse.choices[0];
    if (!firstChoice || typeof firstChoice !== 'object' || !firstChoice.message) {
      throw new Error('Invalid API response: missing or malformed message in first choice');
    }

    const message = firstChoice.message;
    const content = typeof message.content === 'string' ? message.content : '';
    const toolCalls = message.tool_calls || [];
    const reasoningContent = typeof message.reasoning_content === 'string' ? message.reasoning_content : null;

    return { content, toolCalls, reasoningContent };
  }

  // ... handleToolCalls and getUsageStats can be inherited or copied as standard ...
  getUsageStats(apiResponse) {
    if (!apiResponse?.usage) return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const u = apiResponse.usage;
    return {
      promptTokens: u.prompt_tokens || 0,
      completionTokens: u.completion_tokens || 0,
      totalTokens: u.total_tokens || 0,
    };
  }
}

module.exports = DS_ReasonerAdapter;
