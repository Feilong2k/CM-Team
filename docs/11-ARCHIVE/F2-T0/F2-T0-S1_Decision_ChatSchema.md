# Decision Record: Chat Messages Schema for Feature 2 - Task 0 - Subtask 1

## Context
During planning for Feature 2 (Orion Chat & Context), specifically Task 0 Subtask 1 (Create Chat & Plan Persistence Schema), we discussed the database schema requirements for storing chat messages.

## Decision
- The `chat_messages` table will be created with the following columns:
  - `id` SERIAL PRIMARY KEY
  - `external_id` VARCHAR(255) UNIQUE (optional)
  - `sender` VARCHAR(50) NOT NULL with allowed values: 'user', 'orion', 'system'
  - `content` TEXT NOT NULL
  - `metadata` JSONB for storing auxiliary data (e.g., LLM model info, token counts), **excluding any context data**
  - `created_at` TIMESTAMPTZ DEFAULT NOW()
  - `updated_at` TIMESTAMPTZ DEFAULT NOW() with auto-update trigger

- No `planning_doc_id` or foreign key to planning documents will be included.
- No `message_type` column is needed; all messages are stored uniformly.
- No context data will be stored with each message, as context is generated dynamically per message and storing it would be excessive.
- No plan draft messages or special message types are included at this time.

## Rationale
- Keeps the schema minimal and focused on essential chat data.
- Avoids unnecessary data bloat and complexity.
- Aligns with MVP goals and current system design.

## Next Steps
- Implement migration file `004_chat_messages.sql` with the above schema.
- Write migration tests to verify schema correctness.
- Run migration and verify table creation.

## Instructions for Tara and Devon

### For Tara (Tester)
- Write migration tests verifying the `chat_messages` table exists with the specified columns and constraints.
- Verify the `CHECK` constraint on `sender` rejects invalid values.
- Test migration rollback to ensure it removes the table cleanly.
- Optionally, test basic CRUD operations on the `chat_messages` table.

### For Devon (Implementer)
- Create the migration file `004_chat_messages.sql` implementing the schema as specified.
- Include indexes and the `updated_at` timestamp auto-update trigger.
- Ensure compatibility with existing migration tooling and idempotency.

---
Document created by Adam (Architect) on 2025-12-18.
