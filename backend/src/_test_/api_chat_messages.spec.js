/**
 * Unit tests for Feature 2 - Task 0 - Subtask 2 (F2-T0-S2) API endpoints
 * 
 * Tests the POST and GET /api/chat/messages endpoints with project_id filtering.
 * 
 * These tests follow TDD principles: they should initially fail until Devon implements the API.
 */

process.env.PORT = process.env.PORT || '3500';
process.env.CORS_ORIGIN_REGEX = process.env.CORS_ORIGIN_REGEX || '^http:\\/\\/localhost:61[0-1][0-9]$';

const request = require('supertest');
const app = require('../../src/server'); // Assuming Express app is exported from here
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables explicitly from backend/.env for test environment consistency
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

describe('F2-T0-S2 Chat Messages API', () => {
  const baseUrl = '/api/chat/messages';
  const testProjectId = 'p1';
  let createdMessageId;

  describe('POST /api/chat/messages', () => {
    it('should create a new chat message with valid data', async () => {
      const response = await request(app)
        .post(baseUrl)
        .send({
          external_id: 'p1-abc123',
          sender: 'user',
          content: 'Hello, Orion!',
          metadata: { model: 'gpt-4' }
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.external_id).toBe('p1-abc123');
      expect(response.body.sender).toBe('user');
      expect(response.body.content).toBe('Hello, Orion!');
      createdMessageId = response.body.id;
    });

    it('should reject invalid sender values', async () => {
      await request(app)
        .post(baseUrl)
        .send({
          external_id: 'p1-abc123',
          sender: 'admin',
          content: 'Invalid sender test'
        })
        .expect(400);
    });

    it('should reject missing required fields', async () => {
      await request(app)
        .post(baseUrl)
        .send({
          external_id: 'p1-abc123',
          sender: 'user'
          // missing content
        })
        .expect(400);
    });
  });

  describe('GET /api/chat/messages', () => {
    it('should return messages filtered by project_id', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ project_id: testProjectId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Optionally check that all returned messages have external_id starting with project_id
      response.body.forEach(msg => {
        expect(msg.external_id.startsWith(testProjectId)).toBe(true);
      });
    });

    it('should support pagination with limit and offset', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ project_id: testProjectId, limit: 1, offset: 0 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should return 400 if project_id is missing', async () => {
      await request(app)
        .get(baseUrl)
        .expect(400);
    });
  });
});
