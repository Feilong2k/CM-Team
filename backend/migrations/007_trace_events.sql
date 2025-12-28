-- ============================================================================
-- Trace Events Schema Migration
-- Subtask P1-F3-T1-S1: Create trace_events table for Trace Service
--
-- This migration creates the trace_events table to store all trace events
-- for the Orion system, including phase-aware events for the two-stage protocol.
--
-- Schema:
--   id          SERIAL PRIMARY KEY
--   timestamp   TIMESTAMPTZ NOT NULL (ISO 8601 UTC)
--   project_id  VARCHAR(255) NOT NULL (e.g., 'P1')
--   source      VARCHAR(50) NOT NULL (enum: 'user', 'orion', 'tool', 'system')
--   type        VARCHAR(50) NOT NULL (enum: see below)
--   direction   VARCHAR(20) (optional: 'inbound', 'outbound', 'internal')
--   tool_name   VARCHAR(255) (optional, for tool events)
--   request_id  VARCHAR(255) (optional, for grouping events by request)
--   summary     TEXT NOT NULL
--   details     JSONB NOT NULL DEFAULT '{}'::jsonb
--   error       JSONB (optional, for error events)
--   metadata    JSONB (optional, additional metadata)
--   phase_index INTEGER (optional, for phase-aware events)
--   cycle_index INTEGER (optional, for phase-aware events)
--
-- Indexes for typical query patterns: project_id, request_id, timestamp, type.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Core table definition
-- ----------------------------------------------------------------------------

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
);

COMMENT ON TABLE trace_events IS 'Stores trace events for Orion system debugging and monitoring.';
COMMENT ON COLUMN trace_events.project_id IS 'Project identifier (e.g., P1).';
COMMENT ON COLUMN trace_events.source IS 'Source of the event: user, orion, tool, system.';
COMMENT ON COLUMN trace_events.type IS 'Event type (user_message, orion_response, tool_call, tool_result, duplicate_tool_call, llm_call, system_error, orchestration_phase_start, orchestration_phase_end, phase_transition).';
COMMENT ON COLUMN trace_events.direction IS 'Direction: inbound, outbound, or internal.';
COMMENT ON COLUMN trace_events.tool_name IS 'Name of the tool (for tool events).';
COMMENT ON COLUMN trace_events.request_id IS 'Request identifier for grouping events by a single request.';
COMMENT ON COLUMN trace_events.summary IS 'Human-readable summary of the event.';
COMMENT ON COLUMN trace_events.details IS 'Detailed event data in JSON format.';
COMMENT ON COLUMN trace_events.error IS 'Error information (if applicable).';
COMMENT ON COLUMN trace_events.metadata IS 'Additional metadata (e.g., model, token counts).';
COMMENT ON COLUMN trace_events.phase_index IS 'Phase index for orchestration events (e.g., 1 for first tool phase).';
COMMENT ON COLUMN trace_events.cycle_index IS 'Cycle index for orchestration events (e.g., 1 for first cycle).';

-- ----------------------------------------------------------------------------
-- 2. Indexes (for typical access patterns)
-- ----------------------------------------------------------------------------

-- Index for querying by project and time (most common)
CREATE INDEX IF NOT EXISTS idx_trace_events_project_id_timestamp
    ON trace_events (project_id, timestamp);

-- Index for querying by request_id (for request grouping)
CREATE INDEX IF NOT EXISTS idx_trace_events_request_id
    ON trace_events (request_id);

-- Index for querying by type (for filtering)
CREATE INDEX IF NOT EXISTS idx_trace_events_type
    ON trace_events (type);

-- Index for querying by source (for filtering)
CREATE INDEX IF NOT EXISTS idx_trace_events_source
    ON trace_events (source);

-- ----------------------------------------------------------------------------
-- 3. Migration Complete
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE 'Trace events schema migration (007_trace_events.sql) applied successfully';
END $$;
