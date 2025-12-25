// Tara's Failing Tests for Subtask 1-2-1 — JSON Plan Schema & Import Logic
// These tests MUST fail with placeholder implementation
// Implementation contract: JSON Plan Schema v1.1 (docs/03-PROTOCOLS/core/JSON_Plan_Schema_v1.1.md)

const { importPlan } = require('./jsonImporter');

// Mock the database module
const mockBegin = jest.fn();
const mockCommit = jest.fn();
const mockRollback = jest.fn();

jest.mock('../../config/db', () => {
  const mockQuery = jest.fn();
  const mockWithTransaction = jest.fn();
  
  return {
    query: mockQuery,
    connect: jest.fn(),
    end: jest.fn(),
    withTransaction: mockWithTransaction
  };
});

const db = require('../../config/db');

describe('JSON Plan Importer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock transaction methods
    db.query.mockImplementation((sql, params) => {
      if (sql === 'BEGIN') {
        mockBegin();
        return Promise.resolve();
      }
      if (sql === 'COMMIT') {
        mockCommit();
        return Promise.resolve();
      }
      if (sql === 'ROLLBACK') {
        mockRollback();
        return Promise.resolve();
      }
      // Default mock for other queries - return a valid row with id
      if (sql.includes('INSERT')) {
        return Promise.resolve({ rows: [{ id: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    
    // Mock withTransaction to call callback with mock client
    db.withTransaction.mockImplementation(async (callback) => {
      const mockClient = {
        query: db.query
      };
      return callback(mockClient);
    });
  });

  // ====================
  // CRITICAL TESTS (C1-C5)
  // ====================

  describe('C1: Schema Validation - Valid JSON passes', () => {
    test('should accept valid JSON with correct schema v1.1', async () => {
      const validPlan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Feature 1 — Orion Foundation',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'P1-F1',
              title: 'Test Feature',
              status: 'pending',
              basic_info: { owner: 'Adam' },
              activity_log: [],
              pcc: { checks: [], risks: [], questions: [] },
              cap: { summary: 'CAP analysis', risks: [], questions: [] },
              red: { summary: 'RED analysis', decomposition: [], external_decisions: [] },
              tasks: []
            }
          ]
        }
      };

      // This test should FAIL with placeholder implementation
      // Placeholder would either throw error or accept invalid data
      await expect(importPlan(validPlan)).resolves.not.toThrow();
      
      // Verify validation actually happened (not just passing through)
      // This assertion will fail with placeholder
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT'), expect.any(Array));
    });
  });

  describe('C2: Schema Validation - Invalid externalId format fails', () => {
    test('should reject invalid externalId format (not P1-F1-T1-S1 pattern)', async () => {
      const invalidPlan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'INVALID-ID', // Invalid format
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: []
        }
      };

      // This test should FAIL with placeholder implementation
      // Placeholder might accept invalid format
      await expect(importPlan(invalidPlan)).rejects.toThrow(/externalId.*P.*project/i);
      
      // Should NOT begin transaction for invalid data
      expect(mockBegin).not.toHaveBeenCalled();
    });

    test('should reject feature with invalid externalId', async () => {
      const invalidPlan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'INVALID-FEATURE', // Invalid format
              title: 'Test Feature',
              status: 'pending',
              tasks: []
            }
          ]
        }
      };

      await expect(importPlan(invalidPlan)).rejects.toThrow(/externalId.*P.*project.*F.*feature/i);
    });
  });

  describe('C3: Database Insertion - Creates correct rows with JSONB data', () => {
    test('should insert plan, feature, task, and subtask with all JSONB fields', async () => {
      const testPlan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test Plan',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'P1-F1',
              title: 'Test Feature',
              status: 'pending',
              basic_info: { owner: 'Adam', priority: 'high' },
              activity_log: [{ timestamp: '2025-12-17T00:00:00.000Z', action: 'created' }],
              pcc: { checks: ['check1'], risks: ['risk1'], questions: ['q1'] },
              cap: { summary: 'CAP', risks: [], questions: [] },
              red: { summary: 'RED', decomposition: [], external_decisions: [] },
              tasks: [
                {
                  externalId: 'P1-F1-T1',
                  title: 'Test Task',
                  status: 'in_progress',
                  basic_info: { purpose: 'testing' },
                  activity_log: [],
                  pcc: { checks: [], risks: [], questions: [] },
                  cap: { summary: 'Task CAP', risks: [], questions: [] },
                  subtasks: [
                    {
                      externalId: 'P1-F1-T1-S1',
                      title: 'Test Subtask',
                      status: 'pending',
                      workflow_stage: 'planning',
                      basic_info: { estimate: 'S' },
                      instruction: { steps: ['step1', 'step2'] },
                      activity_log: [],
                      pcc: { checks: [], risks: [], questions: [] },
                      tests: { tara: ['test1'] },
                      implementations: { devon: ['impl1'] },
                      review: { notes: 'needs review' }
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      // Mock successful inserts with transaction support
      // Mock withTransaction to simulate BEGIN/COMMIT/ROLLBACK
      let clientQueryCalls = [];
      db.withTransaction.mockImplementation(async (callback) => {
        // Simulate BEGIN
        mockBegin();
        
        const mockClient = {
          query: (sql, params) => {
            clientQueryCalls.push({ sql, params });
            // Handle INSERT queries
            if (sql && sql.includes('INSERT INTO planning_docs')) {
              return Promise.resolve({ rows: [{ id: 1 }] });
            }
            if (sql && sql.includes('INSERT INTO features')) {
              return Promise.resolve({ rows: [{ id: 100 }] });
            }
            if (sql && sql.includes('INSERT INTO tasks')) {
              return Promise.resolve({ rows: [{ id: 200 }] });
            }
            if (sql && sql.includes('INSERT INTO subtasks')) {
              return Promise.resolve({ rows: [{ id: 300 }] });
            }
            return Promise.resolve({ rows: [] });
          }
        };
        
        try {
          const result = await callback(mockClient);
          // Simulate COMMIT
          mockCommit();
          return result;
        } catch (error) {
          // Simulate ROLLBACK
          mockRollback();
          throw error;
        }
      });
      
      // Also mock db.query for any direct queries (though withTransaction should handle them)
      db.query.mockImplementation((sql, params) => {
        // Handle transaction commands
        if (sql && (sql.trim() === 'BEGIN' || sql.includes('BEGIN'))) {
          mockBegin();
          return Promise.resolve();
        }
        if (sql && (sql.trim() === 'COMMIT' || sql.includes('COMMIT'))) {
          mockCommit();
          return Promise.resolve();
        }
        if (sql && (sql.trim() === 'ROLLBACK' || sql.includes('ROLLBACK'))) {
          mockRollback();
          return Promise.resolve();
        }
        if (sql && sql.includes('INSERT INTO planning_docs')) {
          return Promise.resolve({ rows: [{ id: 1 }] });
        }
        if (sql && sql.includes('INSERT INTO features')) {
          return Promise.resolve({ rows: [{ id: 100 }] });
        }
        if (sql && sql.includes('INSERT INTO tasks')) {
          return Promise.resolve({ rows: [{ id: 200 }] });
        }
        if (sql && sql.includes('INSERT INTO subtasks')) {
          return Promise.resolve({ rows: [{ id: 300 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      await importPlan(testPlan);

      // Verify all inserts were called with correct JSONB data
      // Check that client.query was called with the expected SQL and parameters
      // We need to check clientQueryCalls since the import uses client.query inside the transaction
      const planningDocCall = clientQueryCalls.find(call => 
        call.sql && call.sql.includes('INSERT INTO planning_docs')
      );
      expect(planningDocCall).toBeDefined();
      expect(planningDocCall.params).toEqual(
        expect.arrayContaining([
          'P1',
          'CM-TEAM',
          'Test Plan',
          'implementation_requirements',
          'pending',
          1,
          expect.any(String) // content_md
        ])
      );

      const featureCall = clientQueryCalls.find(call => 
        call.sql && call.sql.includes('INSERT INTO features')
      );
      expect(featureCall).toBeDefined();
      expect(featureCall.params).toEqual(
        expect.arrayContaining([
          'P1-F1',
          expect.any(Number), // project_id from planning_docs
          'Test Feature',
          'pending',
          expect.any(String), // basic_info JSONB as string
          expect.any(String), // activity_log JSONB as string
          expect.any(String), // pcc JSONB as string
          expect.any(String), // cap JSONB as string
          expect.any(String)  // red JSONB as string
        ])
      );

      // Verify transaction was used
      expect(mockBegin).toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalled();
      expect(mockRollback).not.toHaveBeenCalled();
    });
  });

  describe('C4: Idempotency - Second import updates existing rows', () => {
    test('should update existing plan when imported twice with same externalId', async () => {
      const plan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'First Title',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: []
        }
      };

      // First import - insert
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO planning_docs')) {
          return Promise.resolve({ rows: [{ id: 1 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      await importPlan(plan);

      // Second import - should update
      plan.plan.title = 'Updated Title';
      plan.plan.revision = 2;

      // Mock to simulate conflict and update
      db.query.mockImplementation((sql, params) => {
        // The query already has ON CONFLICT clause, so it should handle duplicates
        // without throwing an error
        if (sql.includes('INSERT INTO planning_docs')) {
          // Return success with id 1 (same as first insert)
          return Promise.resolve({ rows: [{ id: 1 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      await importPlan(plan);

      // Verify UPSERT was used (ON CONFLICT clause)
      // This assertion will FAIL with placeholder implementation
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (external_id)'),
        expect.any(Array)
      );
    });
  });

  describe('C5: Transaction Safety - Rollback on validation error', () => {
    test('should rollback transaction when feature validation fails', async () => {
      const invalidPlan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'P1-F1',
              title: 'Feature 1',
              status: 'pending',
              tasks: []
            }
          ]
        }
      };

      // Mock withTransaction to handle BEGIN/COMMIT/ROLLBACK
      db.withTransaction.mockImplementation(async (callback) => {
        // Simulate BEGIN
        mockBegin();
        
        const mockClient = {
          query: (sql, params) => {
            if (sql && sql.includes('INSERT INTO features')) {
              // Simulate validation error at DB level (not null constraint)
              const error = new Error('null value in column "external_id" violates not-null constraint');
              error.code = '23502';
              throw error;
            }
            // For other queries, return success
            if (sql && sql.includes('INSERT')) {
              return Promise.resolve({ rows: [{ id: 1 }] });
            }
            return Promise.resolve({ rows: [] });
          }
        };
        
        try {
          const result = await callback(mockClient);
          // Simulate COMMIT
          mockCommit();
          return result;
        } catch (error) {
          // Simulate ROLLBACK
          mockRollback();
          throw error;
        }
      });

      await expect(importPlan(invalidPlan)).rejects.toThrow();

      // Verify rollback was called
      // This assertion will FAIL with placeholder implementation
      expect(mockRollback).toHaveBeenCalled();
      expect(mockCommit).not.toHaveBeenCalled();
    });
  });

  // ====================
  // HIGH PRIORITY TESTS (H1-H4)
  // ====================

  describe('H1: Hierarchical Relationships - Correct parent-child assignments', () => {
    test('should parse externalId to determine feature_id for tasks', async () => {
      const plan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'P1-F1',
              title: 'Feature 1',
              status: 'pending',
              tasks: [
                {
                  externalId: 'P1-F1-T1',
                  title: 'Task 1',
                  status: 'pending',
                  subtasks: []
                }
              ]
            }
          ]
        }
      };

      // Mock feature insert returns id 100
      let featureId = null;
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO features')) {
          featureId = 100;
          return Promise.resolve({ rows: [{ id: featureId }] });
        }
        if (sql.includes('INSERT INTO tasks')) {
          // Verify task insert includes correct feature_id
          // This assertion will FAIL with placeholder
          expect(params).toContain(featureId);
          return Promise.resolve({ rows: [{ id: 200 }] });
        }
        // Default mock for other queries
        if (sql.includes('INSERT')) {
          return Promise.resolve({ rows: [{ id: 1 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      await importPlan(plan);
    });
  });

  describe('H2: JSONB Field Preservation - All fields stored correctly', () => {
    test('should preserve nested JSONB structures exactly', async () => {
      const complexPCC = {
        checks: [
          { id: 'check1', description: 'Test check', passed: true },
          { id: 'check2', description: 'Another check', passed: false }
        ],
        risks: [
          { severity: 'high', description: 'Data loss risk', mitigation: 'Backup' }
        ],
        questions: ['What is the purpose?', 'Who is the owner?']
      };

      const plan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'P1-F1',
              title: 'Feature',
              status: 'pending',
              pcc: complexPCC,
              cap: { summary: 'test' },
              red: { summary: 'test' },
              tasks: []
            }
          ]
        }
      };

      let capturedPCC = null;
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO features')) {
          // Capture the pcc parameter (should be at index based on column order)
          // pcc is at index 6 (0: external_id, 1: project_id, 2: title, 3: status, 4: basic_info, 5: activity_log, 6: pcc)
          capturedPCC = params[6]; // pcc is at index 6
        }
        return Promise.resolve({ rows: [{ id: 1 }] });
      });

      await importPlan(plan);

      // Verify PCC structure preserved exactly (as JSON string)
      // This assertion will FAIL with placeholder
      expect(JSON.parse(capturedPCC)).toEqual(complexPCC);
    });
  });

  describe('H3: Workflow Stage Default - Subtasks default to planning', () => {
    test('should set workflow_stage to "planning" when not provided', async () => {
      const plan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'P1-F1',
              title: 'Feature',
              status: 'pending',
              tasks: [
                {
                  externalId: 'P1-F1-T1',
                  title: 'Task',
                  status: 'pending',
                  subtasks: [
                    {
                      externalId: 'P1-F1-T1-S1',
                      title: 'Subtask',
                      status: 'pending'
                      // workflow_stage not specified
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      let capturedWorkflowStage = null;
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO subtasks')) {
          // workflow_stage should be at index 5 (0: external_id, 1: task_id, 2: parent_id, 3: title, 4: status, 5: workflow_stage)
          capturedWorkflowStage = params[5]; // workflow_stage is at index 5
        }
        return Promise.resolve({ rows: [{ id: 1 }] });
      });

      await importPlan(plan);

      // Verify default workflow_stage
      // This assertion will FAIL with placeholder
      expect(capturedWorkflowStage).toBe('planning');
    });
  });

  describe('H4: Status Normalization - in_progress in DB', () => {
    test('should store "in_progress" in DB even if JSON has "in progress"', async () => {
      const plan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'in progress', // With space
          revision: 1,
          features: []
        }
      };

      let capturedStatus = null;
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO planning_docs')) {
          // status should be at appropriate index
          capturedStatus = params[4]; // Adjust based on column order
        }
        return Promise.resolve({ rows: [{ id: 1 }] });
      });

      await importPlan(plan);

      // Verify normalization to snake_case
      // This assertion will FAIL with placeholder
      expect(capturedStatus).toBe('in_progress');
    });
  });

  // ====================
  // MEDIUM PRIORITY TESTS (M1-M3)
  // ====================

  describe('M1: Recursive Subtasks - Support nested subtasks', () => {
    test('should handle recursive subtasks with parent_id relationships', async () => {
      const plan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'P1-F1',
              title: 'Feature',
              status: 'pending',
              tasks: [
                {
                  externalId: 'P1-F1-T1',
                  title: 'Task',
                  status: 'pending',
                  subtasks: [
                    {
                      externalId: 'P1-F1-T1-S1',
                      title: 'Parent Subtask',
                      status: 'pending',
                      workflow_stage: 'planning',
                      subtasks: [
                        {
                          externalId: 'P1-F1-T1-S2',
                          title: 'Child Subtask',
                          status: 'pending',
                          workflow_stage: 'planning'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      let parentSubtaskId = null;
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO subtasks')) {
          if (params[0] === 'P1-F1-T1-S1') {
            parentSubtaskId = 300;
            return Promise.resolve({ rows: [{ id: parentSubtaskId }] });
          }
          if (params[0] === 'P1-F1-T1-S2') {
            // Verify child subtask includes correct parent_id
            // This assertion will FAIL with placeholder
            expect(params).toContain(parentSubtaskId);
            return Promise.resolve({ rows: [{ id: 301 }] });
          }
        }
        // Default mock for other INSERT queries
        if (sql.includes('INSERT')) {
          return Promise.resolve({ rows: [{ id: 1 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      await importPlan(plan);
    });
  });

  describe('M2: Missing Optional Fields - Handle gracefully', () => {
    test('should handle missing optional JSONB fields with defaults', async () => {
      const plan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Test',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features: [
            {
              externalId: 'P1-F1',
              title: 'Feature',
              status: 'pending'
              // Missing optional fields: basic_info, pcc, cap, red, tasks
            }
          ]
        }
      };

      await expect(importPlan(plan)).resolves.not.toThrow();
      
      // Should still insert with default/empty JSONB values
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO features'),
        expect.any(Array)
      );
    });
  });

  describe('M3: Large Import - Handle many items', () => {
    test('should import 100+ items within reasonable time', async () => {
      // Create a plan with 10 features, each with 10 tasks, each with 1 subtask = 100+ items
      const features = [];
      for (let f = 1; f <= 10; f++) {
        const tasks = [];
        for (let t = 1; t <= 10; t++) {
          tasks.push({
            externalId: `P1-F${f}-T${t}`,
            title: `Task ${f}.${t}`,
            status: 'pending',
            subtasks: [
              {
                externalId: `P1-F${f}-T${t}-S1`,
                title: `Subtask ${f}.${t}.1`,
                status: 'pending',
                workflow_stage: 'planning'
              }
            ]
          });
        }
        features.push({
          externalId: `P1-F${f}`,
          title: `Feature ${f}`,
          status: 'pending',
          tasks
        });
      }

      const largePlan = {
        schemaVersion: '1.1',
        plan: {
          externalId: 'P1',
          projectId: 'CM-TEAM',
          title: 'Large Plan',
          type: 'implementation_requirements',
          status: 'pending',
          revision: 1,
          features
        }
      };

      // Mock all inserts
      let insertCount = 0;
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT')) {
          insertCount++;
        }
        return Promise.resolve({ rows: [{ id: insertCount }] });
      });

      const startTime = Date.now();
      await importPlan(largePlan);
      const duration = Date.now() - startTime;

      // Verify all inserts were attempted
      // 1 plan + 10 features + 100 tasks + 100 subtasks = 211 inserts
      expect(insertCount).toBeGreaterThan(200);
      
      // Should complete within 5 seconds (adjust based on performance requirements)
      // This assertion will FAIL with placeholder if it's synchronous/blocking
      expect(duration).toBeLessThan(5000);
    });
  });
});

// Note: Tests import the actual implementation from './jsonImporter'
// The placeholder has been removed as part of Devon's implementation
