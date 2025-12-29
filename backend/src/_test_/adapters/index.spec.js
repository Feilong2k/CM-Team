/**
 * @jest-environment node
 */

const { createAdapter } = require('../../adapters/index');

describe('Adapter Factory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    // Clear relevant environment variables for each test
    delete process.env.ORION_MODEL_PROVIDER;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('FACTORY-001: Provider Selection - DeepSeek/DeepSeekReasoner', () => {
    test('should return DS_ReasonerAdapter when ORION_MODEL_PROVIDER=DeepSeek', () => {
      process.env.ORION_MODEL_PROVIDER = 'DeepSeek';
      process.env.DEEPSEEK_API_KEY = 'test-key';

      const adapter = createAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('DS_ReasonerAdapter');
    });

    test('should return DS_ReasonerAdapter when ORION_MODEL_PROVIDER=DeepSeekReasoner (case-insensitive)', () => {
      process.env.ORION_MODEL_PROVIDER = 'DeepSeekReasoner';
      process.env.DEEPSEEK_API_KEY = 'test-key';

      const adapter = createAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('DS_ReasonerAdapter');
    });
  });

  describe('FACTORY-002: Provider Selection - DeepSeekChat', () => {
    test('should return DS_ChatAdapter when ORION_MODEL_PROVIDER=DeepSeekChat', () => {
      process.env.ORION_MODEL_PROVIDER = 'DeepSeekChat';
      process.env.DEEPSEEK_API_KEY = 'test-key';

      const adapter = createAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('DS_ChatAdapter');
    });
  });

  describe('FACTORY-003: Provider Selection - OpenAI', () => {
    test('should return GPT41Adapter when ORION_MODEL_PROVIDER=OpenAI', () => {
      process.env.ORION_MODEL_PROVIDER = 'OpenAI';
      process.env.OPENAI_API_KEY = 'test-key';

      const adapter = createAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('GPT41Adapter');
    });
  });

  describe('FACTORY-004: Missing API Key Error', () => {
    test('should throw clear error when DEEPSEEK_API_KEY is missing for DeepSeek provider', () => {
      process.env.ORION_MODEL_PROVIDER = 'DeepSeek';
      // DEEPSEEK_API_KEY not set

      expect(() => createAdapter()).toThrow('DEEPSEEK_API_KEY is required');
    });

    test('should throw clear error when OPENAI_API_KEY is missing for OpenAI provider', () => {
      process.env.ORION_MODEL_PROVIDER = 'OpenAI';
      // OPENAI_API_KEY not set

      expect(() => createAdapter()).toThrow('OPENAI_API_KEY is required');
    });
  });
});
