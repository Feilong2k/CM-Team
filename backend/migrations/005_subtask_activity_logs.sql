-- Migration: Create subtask_activity_logs table for subtask activity logging
-- Adds a relational log table with FK to subtasks, supporting rich metadata

CREATE TABLE IF NOT EXISTS subtask_activity_logs (
    id SERIAL PRIMARY KEY,
    subtask_id INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    agent VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    parent_id INTEGER,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtask_activity_logs_subtask_id
    ON subtask_activity_logs (subtask_id);

CREATE INDEX IF NOT EXISTS idx_subtask_activity_logs_type
    ON subtask_activity_logs (type);

COMMENT ON TABLE subtask_activity_logs IS 'Activity log entries for subtasks, normalized for analytics and audit.';
COMMENT ON COLUMN subtask_activity_logs.subtask_id IS 'FK to subtasks.id';
COMMENT ON COLUMN subtask_activity_logs.type IS 'Type of activity (e.g., implementation, status_update, review)';
COMMENT ON COLUMN subtask_activity_logs.agent IS 'Agent or user responsible for the log entry';
COMMENT ON COLUMN subtask_activity_logs.content IS 'Description or details of the activity';
COMMENT ON COLUMN subtask_activity_logs.status IS 'Status of the log entry (open, completed, etc.)';
COMMENT ON COLUMN subtask_activity_logs.parent_id IS 'Optional parent log entry for threading';
COMMENT ON COLUMN subtask_activity_logs.attachments IS 'Array of attachment metadata (files, links, etc.)';
COMMENT ON COLUMN subtask_activity_logs.metadata IS 'Arbitrary JSON metadata for extensibility';
COMMENT ON COLUMN subtask_activity_logs.timestamp IS 'Time the log entry was created';

DO $$
BEGIN
    RAISE NOTICE 'subtask_activity_logs table created (005_subtask_activity_logs.sql)';
END $$;
