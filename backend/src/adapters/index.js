/**
 * Adapter factory and utilities.
 * Provides a centralized way to create and manage LLM adapters.
 */

const LLMAdapter = require('./LLMAdapter');
const DS_ChatAdapter = require('./DS_ChatAdapter');
const DS_ReasonerAdapter = require('./DS_ReasonerAdapter');
const GPT41Adapter = require('./GPT41Adapter');

/**
 * Validate DeepSeek configuration from environment variables.
 * @throws {Error} If DEEPSEEK_API_KEY is missing or invalid
 */
function validateDeepSeekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error('DEEPSEEK_API_KEY is required and must be a non-empty string in environment variables');
  }

  return true;
}

/**
 * Create a DeepSeek Reasoner adapter from environment variables.
 * Uses DEEPSEEK_API_KEY from environment.
 * @param {Object} [options] - Additional options
 * @param {string} [options.model] - Model to use (default: deepseek-reasoner)
 * @returns {DS_ReasonerAdapter} Configured adapter instance
 * @throws {Error} If DEEPSEEK_API_KEY is not set
 */
function createDeepSeekReasonerAdapterFromEnv(options = {}) {
  validateDeepSeekConfig();

  const config = {
    apiKey: process.env.DEEPSEEK_API_KEY.trim(),
    model: 'deepseek-reasoner',
    ...options,
  };

  return new DS_ReasonerAdapter(config);
}

/**
 * Create a DeepSeek Chat adapter from environment variables.
 * @param {Object} [options] - Additional options
 * @returns {DS_ChatAdapter} Configured adapter instance
 */
function createDeepSeekChatAdapterFromEnv(options = {}) {
  validateDeepSeekConfig();

  const config = {
    apiKey: process.env.DEEPSEEK_API_KEY.trim(),
    model: 'deepseek-chat',
    ...options,
  };

  return new DS_ChatAdapter(config);
}

/**
 * Legacy/Default create method for DeepSeek (defaults to Chat for now unless updated).
 * DEPRECATED: Prefer createDeepSeekReasonerAdapterFromEnv or createDeepSeekChatAdapterFromEnv.
 */
function createDeepSeekAdapterFromEnv(options = {}) {
  // For backwards compatibility or default usage, we can point this to Reasoner if desired,
  // but let's point it to Chat to avoid breaking legacy assumptions, 
  // or point to Reasoner if that's the new mandate.
  // Given MVP goal is Reasoner, let's make this return ReasonerAdapter if no model specified?
  // Actually, safe to keep as ChatAdapter for explicit legacy calls, 
  // and update createAdapter() to choose Reasoner.
  return createDeepSeekChatAdapterFromEnv(options);
}

/**
 * Create a DeepSeek chat adapter with configuration.
 * @param {Object} config - Configuration object
 * @returns {DS_ChatAdapter} Configured DeepSeek adapter instance
 */
function createDeepSeekAdapter(config) {
  return new DS_ChatAdapter(config);
}

/**
 * Create a GPT-4.1 chat adapter with configuration.
 * @param {Object} config - Configuration object
 * @param {string} config.apiKey - OpenAI API key (required)
 * @param {string} [config.model] - Model to use (default: 'gpt-4.1')
 * @param {string} [config.baseURL] - API base URL (default: 'https://api.openai.com/v1')
 * @param {number} [config.timeout] - Request timeout in milliseconds (default: 30000)
 * @param {number} [config.maxRetries] - Maximum retries (default: 3)
 * @returns {GPT41Adapter} Configured GPT-4.1 adapter instance
 */
function createGPT41Adapter(config) {
  return new GPT41Adapter(config);
}

/**
 * Create a GPT-4.1 adapter from environment variables.
 * Uses OPENAI_API_KEY from environment.
 */
function createGPT41AdapterFromEnv(options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error('OPENAI_API_KEY is required and must be a non-empty string in environment variables');
  }

  const config = {
    apiKey: apiKey.trim(),
    ...options,
  };

  return new GPT41Adapter(config);
}

/**
 * Validate that an adapter instance implements the LLMAdapter interface.
 * @param {Object} adapter - Adapter instance to validate
 * @returns {boolean} True if adapter implements required interface
 * @throws {Error} If adapter doesn't implement required interface
 */
function validateAdapterInterface(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error('Adapter must be an object');
  }

  const requiredMethods = ['sendMessage', 'parseResponse', 'handleToolCalls', 'getUsageStats'];

  for (const method of requiredMethods) {
    if (typeof adapter[method] !== 'function') {
      throw new Error(`Adapter missing required method: ${method}()`);
    }
  }

  return true;
}

/**
 * Get adapter type name.
 * @param {Object} adapter - Adapter instance
 * @returns {string} Adapter type name
 */
function getAdapterType(adapter) {
  if (adapter instanceof DS_ChatAdapter) {
    return 'DeepSeek Chat API';
  }
  if (adapter instanceof GPT41Adapter) {
    return 'OpenAI GPT-4.1 API';
  }
  if (adapter instanceof LLMAdapter) {
    return 'Generic LLM Adapter';
  }
  return 'Unknown Adapter';
}

/**
 * Create an adapter based on environment configuration.
 * Uses ORION_MODEL_PROVIDER environment variable (defaults to deepseek).
 * @returns {DS_ReasonerAdapter|DS_ChatAdapter|GPT41Adapter} Adapter instance
 * @throws {Error} If required API key is missing
 */
function createAdapter() {
  const provider = (process.env.ORION_MODEL_PROVIDER || 'deepseek').toLowerCase();
  
  if (provider === 'openai') {
    return createGPT41AdapterFromEnv();
  } 
  
  if (provider === 'deepseek' || provider === 'deepseekreasoner') {
    // Default "deepseek" now maps to Reasoner for MVP
    return createDeepSeekReasonerAdapterFromEnv();
  }

  if (provider === 'deepseekchat') {
    // Explicit opt-in for standard chat model
    return createDeepSeekChatAdapterFromEnv();
  }

  // Fallback default
  return createDeepSeekReasonerAdapterFromEnv();
}

module.exports = {
  LLMAdapter,
  DS_ChatAdapter,
  GPT41Adapter,
  createAdapter,
  createDeepSeekAdapter,
  createDeepSeekAdapterFromEnv,
  createGPT41Adapter,
  createGPT41AdapterFromEnv,
  validateDeepSeekConfig,
  validateAdapterInterface,
  getAdapterType,
};
