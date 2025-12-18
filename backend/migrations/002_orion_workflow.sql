-- ============================================================================
-- Orion Workflow Schema Migration (Refactored)
-- Subtask 1-1-1: Create Orion Workflow SQL
-- 
-- Creates the core tables for the Orion System with improved structure
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Common column definitions for consistency
-- ----------------------------------------------------------------------------

-- JSONB columns that appear in multiple tables (features, tasks, subtasks)
-- These represent the structured data for each entity in the Orion system
-- Note: Using COMMENT to document purpose for future maintainers

-- ----------------------------------------------------------------------------
-- 2. Core Tables (ordered by dependency hierarchy)
-- ----------------------------------------------------------------------------

-- planning_docs: Root planning documents (markdown content)
CREATE TABLE IF NOT EXISTS planning_docs (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255),
    title VARCHAR(255),
    type VARCHAR(50),
    content_md TEXT,
    status VARCHAR(50)
);

COMMENT ON TABLE planning_docs IS 'Root planning documents containing markdown content';
COMMENT ON COLUMN planning_docs.project_id IS 'Optional project identifier for grouping';
COMMENT ON COLUMN planning_docs.content_md IS 'Markdown content of the planning document';

-- features: Top-level features derived from planning docs
CREATE TABLE IF NOT EXISTS features (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- JSONB columns for structured data
    basic_info JSONB,
    instruction JSONB,
    cdp_analysis JSONB,
    activity_log JSONB,
    tests JSONB,
    implementations JSONB,
    review JSONB
);

COMMENT ON TABLE features IS 'Top-level features containing structured workflow data';
COMMENT ON COLUMN features.status IS 'Feature lifecycle: draft, active, completed, archived';
COMMENT ON COLUMN features.basic_info IS 'Basic feature metadata (description, scope, etc.)';
COMMENT ON COLUMN features.cdp_analysis IS 'Constraint Discovery Protocol analysis results';

-- tasks: Work items within a feature
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    feature_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    linked_plan_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- JSONB columns (same structure as features for consistency)
    basic_info JSONB,
    instruction JSONB,
    cdp_analysis JSONB,
    activity_log JSONB,
    tests JSONB,
    implementations JSONB,
    review JSONB,
    -- Foreign key to parent feature
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
);

COMMENT ON TABLE tasks IS 'Work items within a feature, following same JSONB structure';
COMMENT ON COLUMN tasks.status IS 'Task status: pending, in_progress, completed, blocked';
COMMENT ON COLUMN tasks.linked_plan_id IS 'Optional link back to planning document section';

-- subtasks: Breakdown of tasks (supports recursive hierarchy)
CREATE TABLE IF NOT EXISTS subtasks (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    parent_id INTEGER,  -- For recursive hierarchy (fractal tasks)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- JSONB columns (same structure for consistency)
    basic_info JSONB,
    instruction JSONB,
    cdp_analysis JSONB,
    activity_log JSONB,
    tests JSONB,
    implementations JSONB,
    review JSONB,
    -- Foreign keys
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES subtasks(id) ON DELETE CASCADE
);

COMMENT ON TABLE subtasks IS 'Breakdown of tasks with recursive hierarchy support';
COMMENT ON COLUMN subtasks.parent_id IS 'Recursive parent reference for nested subtasks';
COMMENT ON COLUMN subtasks.status IS 'Subtask status: pending, in_progress, completed';

-- task_steps: Individual steps within a subtask (agent execution units)
CREATE TABLE IF NOT EXISTS task_steps (
    id SERIAL PRIMARY KEY,
    subtask_id INTEGER NOT NULL,
    agent_role VARCHAR(50) NOT NULL,
    prompt TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
);

COMMENT ON TABLE task_steps IS 'Individual execution steps for agent workflows';
COMMENT ON COLUMN task_steps.agent_role IS 'Agent role: tara, devon, adam, orion';
COMMENT ON COLUMN task_steps.prompt IS 'Execution prompt for the agent';
COMMENT ON COLUMN task_steps.status IS 'Step status: pending, executing, completed, failed';

-- ----------------------------------------------------------------------------
-- 3. Performance Indexes
-- ----------------------------------------------------------------------------

-- Features table indexes
CREATE INDEX IF NOT EXISTS idx_features_project_id ON features(project_id);
CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);

-- Tasks table indexes (foreign keys and frequently queried columns)
CREATE INDEX IF NOT EXISTS idx_tasks_feature_id ON tasks(feature_id);
CREATE INDEX IF NOT EXISTS idx_tasks_linked_plan_id ON tasks(linked_plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Subtasks table indexes
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_parent_id ON subtasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);

-- Task steps table indexes
CREATE INDEX IF NOT EXISTS idx_task_steps_subtask_id ON task_steps(subtask_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_agent_role ON task_steps(agent_role);
CREATE INDEX IF NOT EXISTS idx_task_steps_status ON task_steps(status);

-- ----------------------------------------------------------------------------
-- 4. Automated Timestamp Management
-- ----------------------------------------------------------------------------

-- Updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp on row update';

-- Helper function to create triggers safely
CREATE OR REPLACE FUNCTION create_trigger_if_not_exists(
    trigger_name TEXT,
    table_name TEXT,
    function_name TEXT
) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = trigger_name
    ) THEN
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION %I()',
            trigger_name, table_name, function_name
        );
    END IF;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at columns
SELECT create_trigger_if_not_exists('update_features_updated_at', 'features', 'update_updated_at_column');
SELECT create_trigger_if_not_exists('update_tasks_updated_at', 'tasks', 'update_updated_at_column');
SELECT create_trigger_if_not_exists('update_subtasks_updated_at', 'subtasks', 'update_updated_at_column');
SELECT create_trigger_if_not_exists('update_task_steps_updated_at', 'task_steps', 'update_updated_at_column');

-- Clean up helper function (not needed after migration)
DROP FUNCTION IF EXISTS create_trigger_if_not_exists(TEXT, TEXT, TEXT);

-- ----------------------------------------------------------------------------
-- 5. Data Integrity Constraints (beyond foreign keys)
-- ----------------------------------------------------------------------------

-- Add check constraints for status values (optional but recommended)
-- Note: These are commented out as they may evolve during development
/*
ALTER TABLE features ADD CONSTRAINT valid_feature_status 
    CHECK (status IN ('draft', 'active', 'completed', 'archived'));
    
ALTER TABLE tasks ADD CONSTRAINT valid_task_status 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked'));
    
ALTER TABLE subtasks ADD CONSTRAINT valid_subtask_status 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked'));
    
ALTER TABLE task_steps ADD CONSTRAINT valid_step_status 
    CHECK (status IN ('pending', 'executing', 'completed', 'failed'));
    
ALTER TABLE task_steps ADD CONSTRAINT valid_agent_role 
    CHECK (agent_role IN ('tara', 'devon', 'adam', 'orion'));
*/

-- ----------------------------------------------------------------------------
-- 6. Migration Complete
-- ----------------------------------------------------------------------------

-- Log successful migration (visible in migration runner output)
DO $$
BEGIN
    RAISE NOTICE 'Orion workflow schema migration completed successfully';
END $$;
