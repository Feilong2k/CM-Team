/**
 * Tests for F2-T1-S1: LLM Adapter Foundation
 * These tests verify the LLMAdapter interface and DS_ChatAdapter implementation.
 * 
 * IMPORTANT: These are RED stage tests - they must fail before implementation exists.
 * Tests must fail for the right reasons (missing implementation, not missing mocks).
 */

// Mock fetch/axios for HTTP testing
global.fetch = jest.fn();

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Reset environment variables
  delete process.env.DEEPSEEK_API_KEY;
});

describe('LLMAdapter Abstract Interface', () => {
  it('should not be directly instantiable (abstract class)', () => {
    // This test should fail because LLMAdapter doesn't exist yet
    // Once implemented, it should throw when trying to instantiate abstract class
    expect(() => {
      // Try to require/import the LLMAdapter
      const LLMAdapter = require('../../src/adapters/LLMAdapter');
      // If it's an abstract class, trying to instantiate should throw
      new LLMAdapter();
    }).toThrow();
  });

  it('should define required interface methods', () => {
    // Once implemented, LLMAdapter should have these methods
    // For now, the test will fail because module doesn't exist
    const LLMAdapter = require('../../src/adapters/LLMAdapter');
    
    // Check that it's a class/constructor
    expect(typeof LLMAdapter).toBe('function');
    
    // Check prototype for required methods
    const prototype = LLMAdapter.prototype;
    expect(typeof prototype.sendMessages).toBe('function');
    expect(typeof prototype.parseResponse).toBe('function');
    expect(typeof prototype.handleToolCalls).toBe('function');
    expect(typeof prototype.getUsageStats).toBe('function');
  });
});

describe('DS_ChatAdapter Implementation', () => {
  it('should extend LLMAdapter', () => {
    // This test should fail because DS_ChatAdapter doesn't exist yet
    const LLMAdapter = require('../../src/adapters/LLMAdapter');
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    
    expect(DS_ChatAdapter.prototype).toBeInstanceOf(LLMAdapter);
  });

  it('should require configuration with apiKey', () => {
    // Constructor should validate configuration
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    
    // Should throw when no configuration provided
    expect(() => new DS_ChatAdapter()).toThrow();
    
    // Should throw when apiKey is missing
    expect(() => new DS_ChatAdapter({})).toThrow();
    expect(() => new DS_ChatAdapter({ apiKey: '' })).toThrow();
    
    // Should succeed with valid apiKey
    const adapter = new DS_ChatAdapter({ apiKey: 'test-key-123' });
    expect(adapter).toBeDefined();
  });

  it('should validate environment variable DEEPSEEK_API_KEY', () => {
    // Test environment validation function
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    
    // Should throw when environment variable is missing
    expect(() => DS_ChatAdapter.validateDeepSeekConfig()).toThrow(/DEEPSEEK_API_KEY/);
    
    // Should succeed when environment variable is set
    process.env.DEEPSEEK_API_KEY = 'test-env-key-456';
    expect(() => DS_ChatAdapter.validateDeepSeekConfig()).not.toThrow();
  });
});

describe('DS_ChatAdapter.sendMessages()', () => {
  let adapter;
  
  beforeEach(() => {
    // Create adapter instance for tests
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    adapter = new DS_ChatAdapter({ apiKey: 'test-key-123' });
  });

  it('should make HTTP request to DeepSeek API with correct parameters', async () => {
    // Mock successful response
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Test response from AI' } }],
        usage: { total_tokens: 42 }
      })
    };
    fetch.mockResolvedValue(mockResponse);

    const messages = [{ role: 'user', content: 'Hello, AI!' }];
    const result = await adapter.sendMessages(messages);

    // Verify fetch was called with correct URL and headers
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Authorization': 'Bearer test-key-123',
      'Content-Type': 'application/json'
    });
    expect(JSON.parse(options.body)).toEqual({
      model: 'deepseek-chat',
      messages: messages,
      stream: false
    });

    // Verify result
    expect(result).toBe('Test response from AI');
  });

  it('should handle network failures with retry logic', async () => {
    // Mock network failure
    fetch.mockRejectedValue(new Error('Network error'));

    await expect(adapter.sendMessages([{ role: 'user', content: 'test' }])).rejects.toThrow('Network error');
    
    // Should retry (default 3 times)
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('should handle API errors (4xx, 5xx responses)', async () => {
    // Mock API error response
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: jest.fn().mockResolvedValue({ error: 'Invalid API key' })
    };
    fetch.mockResolvedValue(mockResponse);

    await expect(adapter.sendMessages([{ role: 'user', content: 'test' }])).rejects.toThrow(/API error/);
  });

  it('should timeout after configured duration', async () => {
    // Mock slow response
    fetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 5000)));
    
    // Adapter should have timeout configuration
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    const adapterWithTimeout = new DS_ChatAdapter({ 
      apiKey: 'test-key-123',
      timeout: 100 // 100ms timeout
    });

    await expect(adapterWithTimeout.sendMessages([{ role: 'user', content: 'test' }])).rejects.toThrow(/timeout/i);
  });

  it('should validate messages array', async () => {
    await expect(adapter.sendMessages([])).rejects.toThrow('messages must be a non-empty array');
    await expect(adapter.sendMessages('not an array')).rejects.toThrow('messages must be a non-empty array');
    await expect(adapter.sendMessages([{}])).rejects.toThrow('Each message must be an object with role and content');
    await expect(adapter.sendMessages([{ role: 'user' }])).rejects.toThrow('Each message must be an object with role and content');
    await expect(adapter.sendMessages([{ content: 'hi' }])).rejects.toThrow('Each message must be an object with role and content');
  });
});

describe('DS_ChatAdapter.parseResponse()', () => {
  let adapter;
  
  beforeEach(() => {
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    adapter = new DS_ChatAdapter({ apiKey: 'test-key-123' });
  });

  it('should extract message content from DeepSeek response format', () => {
    const apiResponse = {
      choices: [
        { message: { content: 'Hello from DeepSeek!' } }
      ],
      usage: { total_tokens: 25 }
    };

    const result = adapter.parseResponse(apiResponse);
    expect(result).toBe('Hello from DeepSeek!');
  });

  it('should handle malformed API responses', () => {
    const malformedResponses = [
      {}, // Empty object
      { choices: [] }, // Empty choices
      { choices: [{}] }, // Choice without message
      { choices: [{ message: {} }] }, // Message without content
      null,
      undefined
    ];

    malformedResponses.forEach(response => {
      expect(() => adapter.parseResponse(response)).toThrow(/Invalid API response/);
    });
  });
});

describe('DS_ChatAdapter.handleToolCalls()', () => {
  it('should throw "not implemented" for Phase 1', async () => {
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    const adapter = new DS_ChatAdapter({ apiKey: 'test-key-123' });

    await expect(adapter.handleToolCalls([])).rejects.toThrow(/not implemented/);
  });
});

describe('DS_ChatAdapter.getUsageStats()', () => {
  it('should extract token usage from response', () => {
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    const adapter = new DS_ChatAdapter({ apiKey: 'test-key-123' });

    const apiResponse = {
      choices: [{ message: { content: 'Test' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    };

    const stats = adapter.getUsageStats(apiResponse);
    expect(stats).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30
    });
  });

  it('should handle missing usage data', () => {
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    const adapter = new DS_ChatAdapter({ apiKey: 'test-key-123' });

    const apiResponse = {
      choices: [{ message: { content: 'Test' } }]
      // No usage field
    };

    const stats = adapter.getUsageStats(apiResponse);
    expect(stats).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    });
  });
});

describe('Environment Validation Utility', () => {
  it('should validate DEEPSEEK_API_KEY exists', () => {
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    
    // Clear environment variable
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => DS_ChatAdapter.validateDeepSeekConfig()).toThrow(/DEEPSEEK_API_KEY is required/);
    
    // Set environment variable
    process.env.DEEPSEEK_API_KEY = 'valid-key';
    expect(() => DS_ChatAdapter.validateDeepSeekConfig()).not.toThrow();
  });

  it('should validate DEEPSEEK_API_KEY is not empty', () => {
    const DS_ChatAdapter = require('../../src/adapters/DS_ChatAdapter');
    
    process.env.DEEPSEEK_API_KEY = '';
    expect(() => DS_ChatAdapter.validateDeepSeekConfig()).toThrow(/DEEPSEEK_API_KEY is required/);
    
    process.env.DEEPSEEK_API_KEY = '   ';
    expect(() => DS_ChatAdapter.validateDeepSeekConfig()).toThrow(/DEEPSEEK_API_KEY is required/);
  });
});
