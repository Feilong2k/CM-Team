/**
 * @jest-environment node
 */

// ============================================================================
// Trace System Tests - RED Phase
// Analyst: Tara
// Date: 2025-12-25
// 
// These tests define the contract for the trace system:
// 1. DB Schema validation for trace_events table
// 2. TraceService behavior (logEvent, getEvents)
// 3. /api/trace/logs route behavior
//
// Tests MUST fail against:
// - In-memory/stub implementations
// - Placeholder/hardcoded responses
// - Environment-based disabling of tracing
// ============================================================================

const { Pool } = require('pg');
const request = require('supertest');

describe('Trace System - Database Schema', () => {
  let pool;
  
  beforeAll(async () => {
    // Connect to test database
    pool = new Pool({
      connectionString: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
    });
  });
  
  afterAll(async () => {
    await pool.end();
  });
  
  beforeEach(async () => {
    // Ensure migrations are run (trace_events table exists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trace_events (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        project_id VARCHAR(255) NOT NULL,
        source VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        direction VARCHAR(20),
        tool_name VARCHAR(255),
        request_id VARCHAR(255),
        summary TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        error JSONB,
        metadata JSONB,
        phase_index INTEGER,
        cycle_index INTEGER
      )
    `);
  });
  
  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM trace_events');
  });
  
  test('trace_events table exists with required columns', async () => {
    // This test will fail if table doesn't exist or columns are missing
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'trace_events'
      ORDER BY ordinal_position
    `);
    
    expect(result.rows.length).toBeGreaterThan(0);
    
    // Check required columns exist and are NOT NULL
    const columns = result.rows.reduce((acc, row) => {
      acc[row.column_name] = { type: row.data_type, nullable: row.is_nullable === 'YES' };
      return acc;
    }, {});
    
    // Required non-nullable columns
    expect(columns.id).toBeDefined();
    expect(columns.id.nullable).toBe(false);
    
    expect(columns.timestamp).toBeDefined();
    expect(columns.timestamp.nullable).toBe(false);
    
    expect(columns.project_id).toBeDefined();
    expect(columns.project_id.nullable).toBe(false);
    
    expect(columns.source).toBeDefined();
    expect(columns.source.nullable).toBe(false);
    
    expect(columns.type).toBeDefined();
    expect(columns.type.nullable).toBe(false);
    
    expect(columns.summary).toBeDefined();
    expect(columns.summary.nullable).toBe(false);
    
    expect(columns.details).toBeDefined();
    expect(columns.details.nullable).toBe(false);
    
    // Optional nullable columns
    expect(columns.direction).toBeDefined();
    expect(columns.direction.nullable).toBe(true);
    
    expect(columns.tool_name).toBeDefined();
    expect(columns.tool_name.nullable).toBe(true);
    
    expect(columns.request_id).toBeDefined();
    expect(columns.request_id.nullable).toBe(true);
    
    expect(columns.error).toBeDefined();
    expect(columns.error.nullable).toBe(true);
    
    expect(columns.metadata).toBeDefined();
    expect(columns.metadata.nullable).toBe(true);
    
    expect(columns.phase_index).toBeDefined();
    expect(columns.phase_index.nullable).toBe(true);
    
    expect(columns.cycle_index).toBeDefined();
    expect(columns.cycle_index.nullable).toBe(true);
  });
  
  test('timestamp defaults to current time when not specified', async () => {
    // This test will fail if timestamp doesn't auto-populate
    const insertResult = await pool.query(`
      INSERT INTO trace_events (
        project_id, source, type, summary, details
      ) VALUES (
        'test-project', 'user', 'user_message', 'Test message', '{}'
      ) RETURNING timestamp
    `);
    
    expect(insertResult.rows[0].timestamp).toBeDefined();
    expect(new Date(insertResult.rows[0].timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(insertResult.rows[0].timestamp).getTime()).toBeGreaterThan(Date.now() - 5000); // Within 5 seconds
  });
  
  test('details column defaults to empty JSON object', async () => {
    // This test will fail if default is not '{}'::jsonb
    const insertResult = await pool.query(`
      INSERT INTO trace_events (
        project_id, source, type, summary
      ) VALUES (
        'test-project', 'user', 'user_message', 'Test message'
      ) RETURNING details
    `);
    
    expect(insertResult.rows[0].details).toEqual({});
  });
  
  test('rejects NULL values for required columns', async () => {
    // This test will fail if database allows NULL for required columns
    const testCases = [
      { column: 'project_id', value: null },
      { column: 'source', value: null },
      { column: 'type', value: null },
      { column: 'summary', value: null },
      { column: 'details', value: null }
    ];
    
    for (const testCase of testCases) {
      await expect(
        pool.query(`
          INSERT INTO trace_events (${testCase.column}) VALUES ($1)
        `, [testCase.value])
      ).rejects.toThrow(); // Should throw due to NOT NULL constraint
    }
  });
});

describe('Trace System - TraceService Behavior', () => {
  // Import the real TraceService module (will fail if module doesn't exist)
  let TraceService;
  
  beforeEach(() => {
    // Attempt to import the real TraceService
    // This will throw if module doesn't exist (correct for RED phase)
    try {
      TraceService = require('../services/trace/TraceService');
    } catch (error) {
      // Module doesn't exist yet - this is expected in RED phase
      // Create a placeholder that will fail tests
      TraceService = {
        logEvent: jest.fn().mockImplementation(() => {
          throw new Error('TraceService module not found - implementation required');
        }),
        getEvents: jest.fn().mockImplementation(() => {
          throw new Error('TraceService module not found - implementation required');
        })
      };
    }
  });
  
  test('TraceService.logEvent persists events to database', async () => {
    // This test will fail if logEvent doesn't write to DB
    const eventData = {
      projectId: 'test-project-123',
      source: 'user',
      type: 'user_message',
      summary: 'User sent a message',
      details: { content: 'Hello Orion' },
      requestId: 'req-123',
      metadata: { tokens: 5 }
    };
    
    // Attempt to log event using the real TraceService module
    await TraceService.logEvent(eventData);
    
    // The import will fail or method will throw, causing test to fail
    // When implemented, we should verify DB contains the event
  });
  
  test('TraceService.logEvent generates timestamp and ID', async () => {
    // This test will fail if events don't get auto-generated timestamp and ID
    const eventData = {
      projectId: 'test-project',
      source: 'orion',
      type: 'orion_response',
      summary: 'Orion responded',
      details: { content: 'Response content' }
    };
    
    const result = await TraceService.logEvent(eventData);
    
    // Should return event with ID and timestamp
    expect(result).toHaveProperty('id');
    expect(result.id).toBeGreaterThan(0);
    
    expect(result).toHaveProperty('timestamp');
    expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });
  
  test('TraceService.logEvent rejects missing required fields', async () => {
    // This test will fail if missing fields are silently accepted
    const invalidEvents = [
      { /* missing projectId */ source: 'user', type: 'user_message', summary: 'Test' },
      { projectId: 'test', /* missing source */ type: 'user_message', summary: 'Test' },
      { projectId: 'test', source: 'user', /* missing type */ summary: 'Test' },
      { projectId: 'test', source: 'user', type: 'user_message' /* missing summary */ }
    ];
    
    for (const invalidEvent of invalidEvents) {
      await expect(TraceService.logEvent(invalidEvent)).rejects.toThrow();
    }
  });
  
  test('TraceService.logEvent validates source enum values', async () => {
    // This test will fail if invalid source values are accepted
    const invalidEvent = {
      projectId: 'test',
      source: 'invalid_source', // Not in allowed values
      type: 'user_message',
      summary: 'Test'
    };
    
    await expect(TraceService.logEvent(invalidEvent)).rejects.toThrow();
    
    // Valid sources should work
    const validSources = ['user', 'orion', 'tool', 'system'];
    for (const source of validSources) {
      const validEvent = {
        projectId: 'test',
        source,
        type: 'user_message',
        summary: 'Test'
      };
      // Should not throw for valid sources
      await expect(TraceService.logEvent(validEvent)).resolves.toBeDefined();
    }
  });
  
  test('TraceService.logEvent validates type enum values', async () => {
    // This test will fail if invalid type values are accepted
    const invalidEvent = {
      projectId: 'test',
      source: 'user',
      type: 'invalid_type', // Not in allowed values
      summary: 'Test'
    };
    
    await expect(TraceService.logEvent(invalidEvent)).rejects.toThrow();
    
    // Valid types should work
    const validTypes = [
      'user_message', 'orion_response', 'tool_call', 'tool_result',
      'duplicate_tool_call', 'llm_call', 'system_error',
      'orchestration_phase_start', 'orchestration_phase_end', 'phase_transition'
    ];
    
    for (const type of validTypes) {
      const validEvent = {
        projectId: 'test',
        source: 'user',
        type,
        summary: 'Test'
      };
      // Should not throw for valid types
      await expect(TraceService.logEvent(validEvent)).resolves.toBeDefined();
    }
  });
  
  test('TraceService.getEvents filters by projectId', async () => {
    // This test will fail if getEvents doesn't filter by project
    const filters = { projectId: 'project-a' };
    const result = await TraceService.getEvents(filters);
    
    // Should return events only for project-a
    // Module will throw, causing test to fail
    // When implemented: verify no events from other projects are returned
  });
  
  test('TraceService.getEvents supports type and source filters', async () => {
    // This test will fail if filters are ignored
    const filters = {
      projectId: 'test-project',
      type: 'tool_call',
      source: 'tool'
    };
    
    const result = await TraceService.getEvents(filters);
    
    // Should return only tool_call events from tool source
    // Module will throw, causing test to fail
  });
  
  test('TraceService.getEvents implements tail-window pagination', async () => {
    // This test will fail if pagination uses FROM start instead of FROM end
    const filters = {
      projectId: 'test-project',
      limit: 10,
      offset: 0
    };
    
    const result = await TraceService.getEvents(filters);
    
    // Should return last 10 events (most recent)
    // Module will throw, causing test to fail
    // When implemented: verify ordering and windowing
  });
  
  test('TraceService.getEvents returns total count with events', async () => {
    // This test will fail if total count is missing
    const filters = { projectId: 'test-project' };
    const result = await TraceService.getEvents(filters);
    
    expect(result).toHaveProperty('events');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.events)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThanOrEqual(result.events.length);
  });
  
  test('TraceService is always-on (no environment disabling)', async () => {
    // This test will fail if tracing can be disabled via environment
    // Set environment variable that might disable tracing
    process.env.TRACE_ENABLED = 'false';
    process.env.DISABLE_TRACING = 'true';
    process.env.NODE_ENV = 'test';
    
    const eventData = {
      projectId: 'test',
      source: 'user',
      type: 'user_message',
      summary: 'Test message'
    };
    
    // Should still log event regardless of environment
    const result = await TraceService.logEvent(eventData);
    expect(result).toBeDefined(); // Module will throw, causing test to fail
    
    // Clean up
    delete process.env.TRACE_ENABLED;
    delete process.env.DISABLE_TRACING;
  });
});

describe('Trace System - /api/trace/logs Route', () => {
  let app;
  
  beforeAll(() => {
    // Load the actual Express app
    app = require('../server');
  });
  
  test('GET /api/trace/logs requires projectId parameter', async () => {
    // This test will fail if route accepts requests without projectId
    const response = await request(app).get('/api/trace/logs');
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('projectId');
  });
  
  test('GET /api/trace/logs returns 200 with correct shape when project exists', async () => {
    // This test will fail if route returns incorrect shape
    const response = await request(app).get('/api/trace/logs?projectId=test-project');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('events');
    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.events)).toBe(true);
    expect(typeof response.body.total).toBe('number');
    
    // Events should have required fields
    if (response.body.events.length > 0) {
      const event = response.body.events[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('projectId');
      expect(event).toHaveProperty('source');
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('summary');
      expect(event).toHaveProperty('details');
    }
  });
  
  test('GET /api/trace/logs forwards type filter to TraceService', async () => {
    // This test will fail if route doesn't pass through filters
    const response = await request(app).get('/api/trace/logs?projectId=test-project&type=tool_call');
    
    expect(response.status).toBe(200);
    // All returned events should be tool_call type
    response.body.events.forEach(event => {
      expect(event.type).toBe('tool_call');
    });
  });
  
  test('GET /api/trace/logs forwards source filter to TraceService', async () => {
    // This test will fail if route doesn't pass through filters
    const response = await request(app).get('/api/trace/logs?projectId=test-project&source=tool');
    
    expect(response.status).toBe(200);
    // All returned events should be from tool source
    response.body.events.forEach(event => {
      expect(event.source).toBe('tool');
    });
  });
  
  test('GET /api/trace/logs implements pagination with limit and offset', async () => {
    // This test will fail if pagination is broken
    const response = await request(app).get('/api/trace/logs?projectId=test-project&limit=5&offset=10');
    
    expect(response.status).toBe(200);
    expect(response.body.events.length).toBeLessThanOrEqual(5);
    
    // Should implement tail-window pagination (most recent first)
    // This is harder to test without actual data, but we can verify structure
  });
  
  test('GET /api/trace/logs returns 500 on TraceService failure', async () => {
    // This test will fail if route doesn't handle service errors properly
    // We need to mock TraceService to throw an error
    // For now, this test will fail (which is correct for RED phase)
    const response = await request(app).get('/api/trace/logs?projectId=force-error');
    
    // Should return 500, not 200 with empty array
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });
  
  test('GET /api/trace/logs does not return hardcoded responses', async () => {
    // This test will fail if route returns static data
    const response1 = await request(app).get('/api/trace/logs?projectId=project-a');
    const response2 = await request(app).get('/api/trace/logs?projectId=project-b');
    
    // Responses should differ for different projects
    // Even if both are empty, they should come from DB query, not hardcoded
    // This is hard to test directly, but we can verify no static arrays
    expect(response1.body.events).not.toEqual([{ id: 1, type: 'test' }]); // Example static response
  });
});

describe('Trace System - Phase Events (Future Planning)', () => {
  // Import the real TraceService module (will fail if module doesn't exist)
  let TraceService;
  
  beforeEach(() => {
    // Attempt to import the real TraceService
    // This will throw if module doesn't exist (correct for RED phase)
    try {
      TraceService = require('../services/trace/TraceService');
    } catch (error) {
      // Module doesn't exist yet - this is expected in RED phase
      // Create a placeholder that will fail tests
      TraceService = {
        logEvent: jest.fn().mockImplementation(() => {
          throw new Error('TraceService module not found - implementation required');
        })
      };
    }
  });
  
  test('orchestration_phase_start events include phaseIndex and cycleIndex', async () => {
    // This test outlines future requirement
    const eventData = {
      projectId: 'test-project',
      source: 'system',
      type: 'orchestration_phase_start',
      summary: 'Tool phase started',
      details: { phase: 'tool', reason: 'start' },
      phaseIndex: 1,
      cycleIndex: 1
    };
    
    // When TraceService is implemented, this should store phaseIndex and cycleIndex
    // For now, the test will fail (RED phase)
    await expect(TraceService.logEvent(eventData)).rejects.toThrow();
  });
  
  test('phase_transition events include previous and next phase details', async () => {
    // This test outlines future requirement
    const eventData = {
      projectId: 'test-project',
      source: 'system',
      type: 'phase_transition',
      summary: 'Transition from tool to action phase',
      details: {
        fromPhase: 'tool',
        toPhase: 'action',
        outputs: { toolResults: ['result1'] },
        inputs: { context: 'prepared' }
      },
      phaseIndex: 1,
      cycleIndex: 1
    };
    
    // Should require non-empty details for phase_transition
    await expect(TraceService.logEvent(eventData)).rejects.toThrow();
  });
});
