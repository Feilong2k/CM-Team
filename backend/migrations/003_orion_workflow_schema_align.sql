-- ============================================================================
-- Orion Workflow Schema Alignment Migration
-- Subtask 1-1-1 Follow-up: Align schema with clarified domain rules
-- 
-- Changes:
-- 1. Rename cdp_analysis to pcc (Preflight Constraint Check) in all tables
-- 2. Add missing columns: pvp_analysis (CAP), fap_analysis (RED) to features
-- 3. Add pvp_analysis (CAP) to tasks
-- 4. Remove unwanted columns from features and tasks
-- 5. Ensure subtasks only has PCC (no CAP/RED)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rename cdp_analysis to pcc in all tables
-- ----------------------------------------------------------------------------

-- features table
ALTER TABLE IF EXISTS features RENAME COLUMN cdp_analysis TO pcc;

-- tasks table
ALTER TABLE IF EXISTS tasks RENAME COLUMN cdp_analysis TO pcc;

-- subtasks table
ALTER TABLE IF EXISTS subtasks RENAME COLUMN cdp_analysis TO pcc;

-- ----------------------------------------------------------------------------
-- 2. Add missing columns to features table
-- ----------------------------------------------------------------------------

-- Add pvp_analysis (Constraint-Aware Planning - CAP)
ALTER TABLE IF EXISTS features ADD COLUMN IF NOT EXISTS pvp_analysis JSONB;

-- Add fap_analysis (Recursive Execution Decomposition - RED)
ALTER TABLE IF EXISTS features ADD COLUMN IF NOT EXISTS fap_analysis JSONB;

-- ----------------------------------------------------------------------------
-- 3. Add missing column to tasks table
-- ----------------------------------------------------------------------------

-- Add pvp_analysis (Constraint-Aware Planning - CAP)
ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS pvp_analysis JSONB;

-- ----------------------------------------------------------------------------
-- 4. Remove unwanted columns from features table
-- ----------------------------------------------------------------------------

-- Remove instruction, tests, implementations, review from features
ALTER TABLE IF EXISTS features DROP COLUMN IF EXISTS instruction;
ALTER TABLE IF EXISTS features DROP COLUMN IF EXISTS tests;
ALTER TABLE IF EXISTS features DROP COLUMN IF EXISTS implementations;
ALTER TABLE IF EXISTS features DROP COLUMN IF EXISTS review;

-- ----------------------------------------------------------------------------
-- 5. Remove unwanted columns from tasks table
-- ----------------------------------------------------------------------------

-- Remove instruction, tests, implementations, review from tasks
ALTER TABLE IF EXISTS tasks DROP COLUMN IF EXISTS instruction;
ALTER TABLE IF EXISTS tasks DROP COLUMN IF EXISTS tests;
ALTER TABLE IF EXISTS tasks DROP COLUMN IF EXISTS implementations;
ALTER TABLE IF EXISTS tasks DROP COLUMN IF EXISTS review;

-- ----------------------------------------------------------------------------
-- 6. Ensure subtasks doesn't have CAP/RED columns
-- ----------------------------------------------------------------------------

-- Remove pvp_analysis (CAP) from subtasks if it exists
ALTER TABLE IF EXISTS subtasks DROP COLUMN IF EXISTS pvp_analysis;

-- Remove fap_analysis (RED) from subtasks if it exists
ALTER TABLE IF EXISTS subtasks DROP COLUMN IF EXISTS fap_analysis;

-- ----------------------------------------------------------------------------
-- 7. Update column comments to reflect new names
-- ----------------------------------------------------------------------------

-- Update features column comments
COMMENT ON COLUMN features.pcc IS 'Preflight Constraint Check analysis results';
COMMENT ON COLUMN features.pvp_analysis IS 'Constraint-Aware Planning analysis';
COMMENT ON COLUMN features.fap_analysis IS 'Recursive Execution Decomposition analysis';

-- Update tasks column comments
COMMENT ON COLUMN tasks.pcc IS 'Preflight Constraint Check analysis results';
COMMENT ON COLUMN tasks.pvp_analysis IS 'Constraint-Aware Planning analysis';

-- Update subtasks column comments
COMMENT ON COLUMN subtasks.pcc IS 'Preflight Constraint Check analysis results';

-- ----------------------------------------------------------------------------
-- 8. Update table comments to reflect new structure
-- ----------------------------------------------------------------------------

COMMENT ON TABLE features IS 'Top-level features with CAP, PCC, and RED analysis sections';
COMMENT ON TABLE tasks IS 'Work items within a feature with CAP and PCC analysis sections';
COMMENT ON TABLE subtasks IS 'Breakdown of tasks with full workflow payload (instruction, tests, implementations, review)';

-- ----------------------------------------------------------------------------
-- 9. Migration Complete
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE 'Orion workflow schema alignment completed successfully';
    RAISE NOTICE 'Features: basic_info, activity_log, pcc, pvp_analysis (CAP), fap_analysis (RED)';
    RAISE NOTICE 'Tasks: basic_info, activity_log, pcc, pvp_analysis (CAP)';
    RAISE NOTICE 'Subtasks: basic_info, instruction, pcc, activity_log, tests, implementations, review';
END $$;
