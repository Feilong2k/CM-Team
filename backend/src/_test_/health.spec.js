/**
 * @jest-environment node
 *
 * PROTO-005 – Health check observability
 *
 * Tests that verify:
 * 1. The /health endpoint returns 200 and the expected response shape.
 * 2. The response reflects the current environment (ORION_MODEL_PROVIDER, SERVER_VERSION).
 * 3. The response includes the current tool soft‑stop window.
 */

const request = require('supertest');
const { getSoftStopWindowMs } = require('../../tools/ToolRunner');

// Mock the ToolRunner module
jest.mock('../../tools/ToolRunner', () => ({
  getSoftStopWindowMs: jest.fn()
}));

// Clear require cache and re-import app to pick up mocks
let app;
beforeEach(() => {
  jest.clearAllMocks();
  delete require.cache[require.resolve('../server')];
  app = require('../server');
});

describe('PROTO-005: Health check endpoint', () => {
  describe('Response shape and status', () => {
    test('should return 200 OK with correct JSON structure', async () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SERVER_VERSION: '1.0.0-test',
        ORION_MODEL_PROVIDER: 'DeepSeek'
      };
      // Mock getSoftStopWindowMs to return a known value
      getSoftStopWindowMs.mockReturnValue(30000);

      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      // Restore original env
      process.env = originalEnv;

      // Verify response shape
      expect(response.body).toEqual({
        ok: true,
        serverVersion: '1.0.0-test',
        orionModelProvider: 'DeepSeek',
        toolSoftStopWindowMs: 30000
      });
    });

    test('should return ok: true even if SERVER_VERSION and ORION_MODEL_PROVIDER are not set', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SERVER_VERSION: undefined,
        ORION_MODEL_PROVIDER: undefined
      };
      getSoftStopWindowMs.mockReturnValue(30000);

      const response = await request(app)
        .get('/health')
        .expect(200);

      process.env = originalEnv;

      expect(response.body.ok).toBe(true);
      expect(response.body.serverVersion).toBeNull();
      expect(response.body.orionModelProvider).toBeNull();
      expect(response.body.toolSoftStopWindowMs).toBe(30000);
    });
  });

  describe('Environment reflection', () => {
    test('should reflect the current ORION_MODEL_PROVIDER', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, ORION_MODEL_PROVIDER: 'OpenAI' };
      getSoftStopWindowMs.mockReturnValue(30000);

      const response = await request(app)
        .get('/health')
        .expect(200);

      process.env = originalEnv;

      expect(response.body.orionModelProvider).toBe('OpenAI');
    });

    test('should reflect the current SERVER_VERSION', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, SERVER_VERSION: '2.3.4' };
      getSoftStopWindowMs.mockReturnValue(30000);

      const response = await request(app)
        .get('/health')
        .expect(200);

      process.env = originalEnv;

      expect(response.body.serverVersion).toBe('2.3.4');
    });
  });

  describe('Tool soft‑stop window', () => {
    test('should include the current soft‑stop window from ToolRunner', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      // Mock different values
      getSoftStopWindowMs.mockReturnValue(60000);

      const response = await request(app)
        .get('/health')
        .expect(200);

      process.env = originalEnv;

      expect(response.body.toolSoftStopWindowMs).toBe(60000);
      expect(getSoftStopWindowMs).toHaveBeenCalledTimes(1);
    });

    test('should update when the soft‑stop window changes', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      // First call returns 30000, second returns 45000
      getSoftStopWindowMs
        .mockReturnValueOnce(30000)
        .mockReturnValueOnce(45000);

      // First request
      const response1 = await request(app)
        .get('/health')
        .expect(200);

      expect(response1.body.toolSoftStopWindowMs).toBe(30000);

      // Second request (note: we need to clear the require cache to re‑import app? No, the mock is already set for the second call.)
      // But we need to reset the mock call count? Actually, we don't care.
      // However, the app uses the same mocked function, which we have set to return 45000 on the second call.
      const response2 = await request(app)
        .get('/health')
        .expect(200);

      expect(response2.body.toolSoftStopWindowMs).toBe(45000);

      process.env = originalEnv;
    });
  });

  describe('Anti‑placeholder validation', () => {
    test('should fail if the endpoint returns a hardcoded response that does not match environment', async () => {
      // This test ensures the health endpoint reads environment variables and calls getSoftStopWindowMs.
      // A placeholder that returns static values would fail.

      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SERVER_VERSION: 'should-not-be-this',
        ORION_MODEL_PROVIDER: 'should-not-be-this'
      };
      getSoftStopWindowMs.mockReturnValue(99999);

      const response = await request(app)
        .get('/health')
        .expect(200);

      process.env = originalEnv;

      // If the endpoint is hardcoded, it might return, for example:
      // { ok: true, serverVersion: '1.0.0', orionModelProvider: 'DeepSeek', toolSoftStopWindowMs: 30000 }
      // Then the following assertions would fail.
      expect(response.body.serverVersion).toBe('should-not-be-this');
      expect(response.body.orionModelProvider).toBe('should-not-be-this');
      expect(response.body.toolSoftStopWindowMs).toBe(99999);
    });

    test('should fail if the endpoint does not call getSoftStopWindowMs', async () => {
      // We can verify that the mocked function was called.
      getSoftStopWindowMs.mockClear();
      getSoftStopWindowMs.mockReturnValue(30000);

      await request(app)
        .get('/health')
        .expect(200);

      expect(getSoftStopWindowMs).toHaveBeenCalledTimes(1);
    });
  });
});
