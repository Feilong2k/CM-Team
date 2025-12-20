-- ============================================================================
-- Migration 006: Relax external_id uniqueness for chat_messages
--
-- Goal:
--   Allow multiple messages to share the same external_id so it can be used
--   as a true conversation / project grouping key (e.g., 'P1', 'P2').
--
-- Previous state (004_chat_messages.sql):
--   external_id VARCHAR(255) UNIQUE
--   plus an index: idx_chat_messages_external_id
--
-- New state:
--   external_id is no longer UNIQUE, but remains indexed for fast lookup.
--
-- This aligns with the intended behavior where deleting or querying by
--   external_id affects all messages in that conversation/project, and
--   allows many messages per external_id.
-- ============================================================================

DO $$
BEGIN
    -- Drop the UNIQUE constraint on external_id if it exists.
    -- PostgreSQL's default name for this is chat_messages_external_id_key.
    IF EXISTS (
        SELECT 1
        FROM   information_schema.table_constraints
        WHERE  table_name = 'chat_messages'
        AND    constraint_type = 'UNIQUE'
        AND    constraint_name = 'chat_messages_external_id_key'
    ) THEN
        ALTER TABLE chat_messages
        DROP CONSTRAINT chat_messages_external_id_key;
    END IF;

    -- Ensure the index on external_id still exists for lookup performance.
    -- If it somehow does not exist, (re)create it.
    CREATE INDEX IF NOT EXISTS idx_chat_messages_external_id
        ON chat_messages (external_id);

    RAISE NOTICE 'Migration 006: chat_messages.external_id is no longer UNIQUE.';
END $$;
