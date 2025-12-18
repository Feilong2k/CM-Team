# Test Failure Summary: Subtask 1-2-1 — JSON Plan Schema & Import Logic

**Date:** 2025-12-17  
**Tester:** Tara  
**Status:** RED Phase Complete — Tests FAILING as required

## Test Results Summary

**Total Tests:** 13  
**Passing:** 2 (15%)  
**Failing:** 11 (85%) ✅ **CORRECT FOR RED PHASE**

### Passing Tests (Should be reviewed):
1. **H1**: Hierarchical Relationships - Should parse externalId to determine feature_id for tasks
2. **M1**: Recursive Subtasks - Should handle recursive subtasks with parent_id relationships

### Failing Tests (Expected - Implementation Required):

#### CRITICAL FAILURES (C1-C5):
1. **C1**: Schema Validation - Valid JSON passes
   - **Failure**: `db.query` not called with INSERT statement
   - **Issue**: Placeholder doesn't validate or insert data
   - **Required**: Zod schema validation + DB insertion

2. **C2**: Schema Validation - Invalid externalId format fails
   - **Failure**: Promise resolves instead of rejecting
   - **Issue**: Placeholder accepts invalid externalId format
   - **Required**: Reject invalid P1-F1-T1-S1 patterns

3. **C3**: Database Insertion - Creates correct rows with JSONB data
   - **Failure**: No INSERT queries executed
   - **Issue**: Placeholder doesn't touch database
   - **Required**: Full hierarchical insertion with JSONB preservation

4. **C4**: Idempotency - Second import updates existing rows
   - **Failure**: No ON CONFLICT clause used
   - **Issue**: Placeholder doesn't implement upsert
   - **Required**: UPSERT logic with external_id uniqueness

5. **C5**: Transaction Safety - Rollback on validation error
   - **Failure**: Promise resolves instead of rejecting
   - **Issue**: Placeholder doesn't validate or rollback
   - **Required**: Transaction rollback on validation errors

#### HIGH PRIORITY FAILURES (H2-H4):
6. **H2**: JSONB Field Preservation - All fields stored correctly
   - **Failure**: Captured PCC is null
   - **Issue**: Placeholder doesn't capture or store JSONB data
   - **Required**: Exact JSONB structure preservation

7. **H3**: Workflow Stage Default - Subtasks default to planning
   - **Failure**: Captured workflow_stage is null
   - **Issue**: Placeholder doesn't set default values
   - **Required**: Default 'planning' for missing workflow_stage

8. **H4**: Status Normalization - in_progress in DB
   - **Failure**: Captured status is null
   - **Issue**: Placeholder doesn't normalize status
   - **Required**: Convert "in progress" to "in_progress"

#### MEDIUM PRIORITY FAILURES (M2-M3):
9. **M2**: Missing Optional Fields - Handle gracefully
   - **Failure**: No INSERT queries executed
   - **Issue**: Placeholder doesn't handle missing fields
   - **Required**: Default values for optional JSONB fields

10. **M3**: Large Import - Handle many items
    - **Failure**: Insert count is 0 (should be >200)
    - **Issue**: Placeholder doesn't process large imports
    - **Required**: Efficient batch processing

## Implementation Requirements for Devon

### 1. Zod Schema Validation (v1.1)
- Must validate `schemaVersion: "1.1"`
- Must validate externalId pattern: `/^P\d+(-F\d+(-T\d+(-S\d+)?)?)?$/`
- Must validate status enum: `pending | in_progress | done`
- Must validate workflow_stage enum for subtasks
- Must reject invalid data with descriptive errors

### 2. Database Operations
- **Transactions**: Use BEGIN/COMMIT/ROLLBACK
- **UPSERT**: Use `ON CONFLICT (external_id) DO UPDATE`
- **JSONB Storage**: Preserve exact nested structures
- **Hierarchy**: Parse externalId to determine parent-child relationships
- **Defaults**: Set workflow_stage='planning' when missing
- **Normalization**: Convert "in progress" → "in_progress"

### 3. Performance Requirements
- Handle 100+ items within 5 seconds
- Use parameterized queries to prevent SQL injection
- Implement efficient batch processing

### 4. Error Handling
- Rollback transaction on any error
- Provide clear error messages for validation failures
- Handle database constraint violations gracefully

## Next Steps for Devon

1. **Install Dependencies**: `npm install zod`
2. **Create Zod Schemas**: Based on JSON Plan Schema v1.1
3. **Implement Import Logic**: 
   - Validate input with Zod
   - Begin transaction
   - Recursive insertion with upsert
   - Commit on success, rollback on error
4. **Test**: Run tests to verify they pass (GREEN phase)
5. **Refactor**: Clean up code while keeping tests green

## Files to Implement

1. `backend/src/schemas/planSchema.js` - Zod schema definitions
2. `backend/src/utils/jsonImporter.js` - Actual implementation (replace placeholder)
3. Update `backend/config/db.js` with proper database configuration

## Success Criteria
- All 13 tests pass (GREEN phase)
- No placeholder logic remains
- Implementation follows JSON Plan Schema v1.1 exactly
- Performance requirements met

---
**Tara's Signature**: ✅ RED Phase Complete  
**Ready for**: Devon's Implementation (GREEN Phase)
