const LLMAdapter = require('./LLMAdapter');
const TraceService = require('../services/trace/TraceService');
const { TRACE_TYPES, TRACE_SOURCES } = require('../services/trace/TraceEvent');

/**
 * DeepSeek Chat API adapter.
 * Implements the LLMAdapter interface for DeepSeek's chat completions API.
 * This adapter only handles API communication - no factory methods, no tool handling.
 */
class DS_ChatAdapter extends LLMAdapter {
  /**
   * Create a new DeepSeek adapter instance.
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - DeepSeek API key (required)
   * @param {string} [config.model='deepseek-chat'] - Model to use
   * @param {string} [config.baseURL='https://api.deepseek.com'] - API base URL
   * @param {number} [config.timeout=30000] - Request timeout in milliseconds
   * @param {number} [config.maxRetries=3] - Maximum number of retries for failed requests
   */
  constructor(config = {}) {
    super();
    
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration object is required');
    }
    
    const { apiKey, model = 'deepseek-chat', baseURL = 'https://api.deepseek.com', timeout = 30000, maxRetries = 3 } = config;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error('apiKey is required and must be a non-empty string');
    }
    
    this.apiKey = apiKey.trim();
    this.model = model;
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash if present
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    
    // Validate timeout
    if (typeof this.timeout !== 'number' || this.timeout <= 0) {
      throw new Error('timeout must be a positive number');
    }
    
    // Validate maxRetries
    if (typeof this.maxRetries !== 'number' || this.maxRetries < 0) {
      throw new Error('maxRetries must be a non-negative number');
    }
  }

  /**
   * Send messages to DeepSeek API and get a response.
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.stream=false] - Whether to stream the response
   * @returns {Promise<Object>} The AI's response and tool calls
   */
  async sendMessages(messages, options = {}) {
    const { stream = false, tools = null, max_tokens, temperature } = options;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages must be a non-empty array');
    }
    
    // Validate each message
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object' || !msg.role || !msg.content) {
        throw new Error('Each message must be an object with role and content');
      }
    }
    
    const url = `${this.baseURL}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    
    const body = {
      model: this.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream,
    };

    if (max_tokens !== undefined) body.max_tokens = max_tokens;
    if (temperature !== undefined) body.temperature = temperature;

    // If tool/function definitions are provided, pass them through so DeepSeek
    // can return structured tool_calls compatible with OpenAI-style function calling.
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
            // Ignore JSON parsing errors for error response
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        return this.parseResponse(data);
        
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
        if (error.response) {
            console.error('Error details:', await error.response.text());
        }
        lastError = error;
        
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
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never be reached, but just in case
    throw lastError || new Error('Failed to send messages');
  }

  /**
   * Send messages to DeepSeek API and stream the response.
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} [options] - Additional options
   * @returns {AsyncGenerator<Object>} Stream of chunks with chunk content or tool calls
   */
  async *sendMessagesStreaming(messages, options = {}) {
    const { tools = null, max_tokens, temperature, context } = options;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages must be a non-empty array');
    }
    
    // Validate each message
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object' || !msg.role || !msg.content) {
        throw new Error('Each message must be an object with role and content');
      }
    }
    
    const url = `${this.baseURL}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    
    const body = {
      model: this.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
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
            // Ignore JSON parsing errors for error response
          }
          throw new Error(errorMessage);
        }
        
        // Parse Server-Sent Events stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') {
                  // Stream finished
                  hasYielded = true;
                  yield { done: true, fullContent };
                  return;
                }
                
                try {
                  const data = JSON.parse(dataStr);
                  if (data.choices && data.choices[0] && data.choices[0].delta) {
                    const delta = data.choices[0].delta;
                    const hasToolCall = Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0;

                    // Emit streaming trace event for each delta (LLM_STREAM_CHUNK)
                    try {
                      await TraceService.logEvent({
                        projectId: context?.projectId,
                        type: 'llm_stream_chunk',
                        source: 'system',
                        timestamp: new Date().toISOString(),
                        summary: 'LLM streaming delta',
                        details: { hasToolCall, delta },
                        requestId: context?.requestId,
                      });
                    } catch (traceErr) {
                      console.error('Trace logging failed for LLM streaming chunk:', traceErr);
                    }

                    if (delta.content) {
                      // Mark as yielded BEFORE yielding, so if yield throws (consumer aborted),
                      // we know not to retry.
                      hasYielded = true;
                      yield { chunk: delta.content };
                      fullContent += delta.content;
                    }
                    // TODO: Handle tool calls in streaming (tool_calls inside delta)
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        
        // If we reach here without [DONE], yield final event
        if (fullContent) {
          hasYielded = true;
          yield { done: true, fullContent };
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
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never be reached, but just in case
    throw lastError || new Error('Failed to send messages');
  }

  /**
   * Parse the DeepSeek API response to extract the message content and tool calls.
   * @param {Object} apiResponse - The raw response from DeepSeek API
   * @returns {Object} The extracted message content and tool calls
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
    const content = typeof message.content === 'string' ? message.content : '';
    const toolCalls = message.tool_calls || [];
    
    return { content, toolCalls };
  }

  /**
   * Handle tool/function calls from the LLM response.
   * @param {Array} toolCalls - Array of tool calls from the LLM
   * @returns {Promise<Array>} Results of tool executions
   */
  async handleToolCalls(toolCalls) {
    // DS_ChatAdapter does not execute tools itself.
    // Tool execution is handled by the Agent layer.
    return [];
  }

  /**
   * Extract usage statistics from the API response.
   * @param {Object} apiResponse - The raw response from DeepSeek API
   * @returns {Object} Usage statistics { promptTokens, completionTokens, totalTokens }
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

module.exports = DS_ChatAdapter;
