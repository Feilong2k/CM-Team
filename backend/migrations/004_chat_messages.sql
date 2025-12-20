-- ============================================================================
-- Chat Messages Schema Migration
-- Subtask F2-T0-S1: Create chat_messages table for Feature 2 (Orion Chat & Context)
--
-- This migration implements the decision record in:
--   .Docs/F2-T0/F2-T0-S1_Decision_ChatSchema.md
-- and is designed to satisfy Tara's tests in:
--   backend/src/_test_/chat_messages_migration.spec.js
--
-- Schema:
--   id          SERIAL PRIMARY KEY
--   external_id VARCHAR(255) UNIQUE (optional)
--   sender      VARCHAR(50) NOT NULL, allowed values: 'user', 'orion', 'system'
--   content     TEXT NOT NULL
--   metadata    JSONB (auxiliary data only, no context)
--   created_at  TIMESTAMPTZ DEFAULT NOW()
--   updated_at  TIMESTAMPTZ DEFAULT NOW() with auto-update trigger
--
-- No foreign key to planning_docs.
-- No message_type column.
-- No stored context or plan-draft messages.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Core table definition
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE,
    sender VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chat_messages_sender_check
      CHECK (sender IN ('user', 'orion', 'system'))
);

COMMENT ON TABLE chat_messages IS 'Stores chat messages for Orion Chat (user/orion/system).';
COMMENT ON COLUMN chat_messages.external_id IS 'Optional external identifier for grouping messages by conversation.';
COMMENT ON COLUMN chat_messages.sender IS 'Sender of the message: user, orion, or system.';
COMMENT ON COLUMN chat_messages.metadata IS 'Auxiliary metadata (model, token counts, etc.), excluding context payload.';

-- ---------------------------------------------------------------------------
-- 2. Indexes (for typical access patterns)
-- ---------------------------------------------------------------------------

-- Index for grouping / querying by conversation
CREATE INDEX IF NOT EXISTS idx_chat_messages_external_id
    ON chat_messages (external_id);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
    ON chat_messages (created_at);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger (reuse global function from 002_orion_workflow.sql)
-- ---------------------------------------------------------------------------

-- We assume update_updated_at_column() already exists from migration 002.
-- To keep this migration idempotent, we use the same helper pattern to
-- create the trigger only if it does not already exist.

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
$$ LANGUAGE 'plpgsql';

-- Create updated_at trigger for chat_messages
SELECT create_trigger_if_not_exists('update_chat_messages_updated_at', 'chat_messages', 'update_updated_at_column');

-- Clean up helper function
DROP FUNCTION IF EXISTS create_trigger_if_not_exists(TEXT, TEXT, TEXT);

-- ---------------------------------------------------------------------------
-- 4. Migration Complete
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE 'Chat messages schema migration (004_chat_messages.sql) applied successfully';
END $$;
