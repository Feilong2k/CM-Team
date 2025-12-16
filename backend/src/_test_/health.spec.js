const request = require('supertest');
const app = require('../server'); // We'll need to export app from server.js

describe('Health Endpoint', () => {
  it('should return 200 and { ok: true }', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
