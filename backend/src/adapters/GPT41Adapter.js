const LLMAdapter = require('./LLMAdapter');

/**
 * GPT-4.1 Chat API adapter (OpenAI).
 * Implements the LLMAdapter interface for OpenAI's chat completions API.
 * This adapter only handles API communication - no factory methods, no tool handling.
 */
class GPT41Adapter extends LLMAdapter {
  /**
   * Create a new GPT-4.1 adapter instance.
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - OpenAI API key (required)
   * @param {string} [config.model='gpt-4.1'] - Model to use
   * @param {string} [config.baseURL='https://api.openai.com/v1'] - API base URL
   * @param {number} [config.timeout=30000] - Request timeout in milliseconds
   * @param {number} [config.maxRetries=3] - Maximum number of retries for failed requests
   */
  constructor(config = {}) {
    super();

    if (!config || typeof config !== 'object') {
      throw new Error('Configuration object is required');
    }

    const {
      apiKey,
      model = 'gpt-4.1',
      baseURL = 'https://api.openai.com/v1',
      timeout = 30000,
      maxRetries = 3,
    } = config;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error('apiKey is required and must be a non-empty string');
    }

    this.apiKey = apiKey.trim();
    this.model = model;
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash if present
    this.timeout = timeout;
    this.maxRetries = maxRetries;

    if (typeof this.timeout !== 'number' || this.timeout <= 0) {
      throw new Error('timeout must be a positive number');
    }

    if (typeof this.maxRetries !== 'number' || this.maxRetries < 0) {
      throw new Error('maxRetries must be a non-negative number');
    }
  }

  /**
   * Send messages to OpenAI GPT-4.1 API and get a response.
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.stream=false] - Whether to stream the response
   * @param {Array} [options.tools=null] - OpenAI-style tool definitions
   * @returns {Promise<Object>} The AI's response and tool calls
   */
  async sendMessages(messages, options = {}) {
    const { stream = false, tools = null, max_tokens, temperature } = options;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages must be a non-empty array');
    }

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object' || !msg.role) {
        throw new Error('Each message must be an object with role and content');
      }
    }

    const url = `${this.baseURL}/chat/completions`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = {
      model: this.model,
      messages: messages.map((msg) => ({
        role: msg.role,
        // Coerce any non-string content into a string so the API always
        // receives valid text, even if upstream passed objects/arrays.
        content:
          typeof msg.content === 'string'
            ? msg.content
            : msg.content == null
              ? ''
              : JSON.stringify(msg.content),
      })),
      stream,
    };

    if (max_tokens !== undefined) body.max_tokens = max_tokens;
    if (temperature !== undefined) body.temperature = temperature;

    // Pass tools through so GPT-4.1 can return structured tool_calls
    if (tools && Array.isArray(tools) && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

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
          } catch (e) {
            // ignore JSON parse errors for error responses
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        return this.parseResponse(data);
      } catch (error) {
        console.error(`GPT41Adapter attempt ${attempt} failed:`, error.message);
        lastError = error;

        if (error.name === 'AbortError' || (error.message && error.message.includes('timeout'))) {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }

        if (error.message && error.message.includes('API error: 4')) {
          // 4xx client errors – don't retry
          throw error;
        }

        if (attempt === this.maxRetries) {
          throw lastError || error;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Failed to send messages');
  }

  /**
   * Send messages to OpenAI GPT-4.1 API and stream the response.
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} [options] - Additional options
   * @returns {AsyncGenerator<Object>} Stream of chunks with chunk content or tool calls
   */
  async *sendMessagesStreaming(messages, options = {}) {
    const { tools = null, max_tokens, temperature } = options;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages must be a non-empty array');
    }

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object' || !msg.role) {
        throw new Error('Each message must be an object with role and content');
      }
    }

    const url = `${this.baseURL}/chat/completions`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = {
      model: this.model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === 'string'
            ? msg.content
            : msg.content == null
              ? ''
              : JSON.stringify(msg.content),
      })),
      stream: true,
    };

    if (max_tokens !== undefined) body.max_tokens = max_tokens;
    if (temperature !== undefined) body.temperature = temperature;

    if (tools && Array.isArray(tools) && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    let lastError;
    let hasYielded = false;

    // Safety guard (mirrors DS behavior): drop exact consecutive duplicate deltas
    let lastContentDelta = null;

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
          } catch (e) {
            // ignore JSON parse errors for error responses
          }
          throw new Error(errorMessage);
        }

        // Parse Server-Sent Events stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let toolCalls = [];

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
                // Stream finished
                yield { done: true, fullContent, toolCalls };
                return;
              }

              try {
                const data = JSON.parse(dataStr);
                const delta = data?.choices?.[0]?.delta;
                if (!delta) continue;

                // Tool calls (OpenAI streams tool_calls in delta.tool_calls)
                if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
                  toolCalls = delta.tool_calls;
                  // Yield toolCalls so OrionAgent can execute tools mid-stream
                  yield { toolCalls: delta.tool_calls };
                }

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

        // If we reach here without [DONE], yield final event
        if (fullContent || toolCalls.length > 0) {
          yield { done: true, fullContent, toolCalls };
        }
        return;

      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
        lastError = error;

        // If we have already yielded content, we cannot transparently retry
        // because the consumer has already received partial data.
        if (hasYielded) {
          throw error;
        }

        // Don't retry on abort (timeout) or certain client errors
        if (error.name === 'AbortError' || (error.message && error.message.includes('timeout'))) {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }

        // Don't retry on 4xx errors (client errors)
        if (error.message && error.message.includes('API error: 4')) {
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === this.maxRetries) {
          if (lastError.message && lastError.message.includes('Network error')) {
            throw new Error(`Network error after ${this.maxRetries + 1} attempts: ${lastError.message}`);
          }
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error('Failed to send messages');
  }

  /**
   * Parse the OpenAI API response to extract message content and tool calls.
   * @param {Object} apiResponse
   * @returns {{ content: string, toolCalls: Array }}
   */
  parseResponse(apiResponse) {
    if (!apiResponse || typeof apiResponse !== 'object') {
      throw new Error('Invalid API response: response must be an object');
    }

    if (!apiResponse.choices || !Array.isArray(apiResponse.choices) || apiResponse.choices.length === 0) {
      throw new Error('Invalid API response: missing or empty choices array');
    }

    const firstChoice = apiResponse.choices[0];
    if (!firstChoice.message || typeof firstChoice.message !== 'object') {
      throw new Error('Invalid API response: choice missing message object');
    }

    const message = firstChoice.message;

    // OpenAI "responses v1" style: content may be a string (classic) or an
    // array of parts (e.g., [{ type: 'text', text: { value: '...', ... } }, ...]).
    let content = '';
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      // Concatenate all text parts; ignore tool_use/tool_results parts here
      content = message.content
        .filter(part => part && part.type === 'text' && part.text && typeof part.text.value === 'string')
        .map(part => part.text.value)
        .join('\n');
    }

    const toolCalls = message.tool_calls || [];

    return { content, toolCalls };
  }

  /**
   * GPT41Adapter does not execute tools itself.
   * Tool execution is handled by the Agent layer.
   */
  async handleToolCalls() {
    return [];
  }

  /**
   * Extract usage statistics from the API response.
   * @param {Object} apiResponse
   */
  getUsageStats(apiResponse) {
    if (!apiResponse || typeof apiResponse !== 'object') {
      return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }

    const usage = apiResponse.usage;
    if (!usage || typeof usage !== 'object') {
      return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }

    return {
      promptTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
      completionTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
      totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : 0,
    };
  }
}

module.exports = GPT41Adapter;
