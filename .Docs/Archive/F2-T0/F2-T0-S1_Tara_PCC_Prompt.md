# Tara Prompt – PCC (CDP Basic) for F2-T0-S1 Chat Messages Schema

## Goal
Retrieve the F2‑T0‑S1 subtask from the database, verify its `chat_messages` schema matches the decision record, perform a PCC (CDP Basic) analysis, and save the PCC analysis back into the database under the `pcc` field for that subtask.

---

## Prompt to Tara

**ROLE:** Tara (Tester)

**GOAL:** Retrieve the F2‑T0‑S1 subtask from the database, verify its chat_messages schema matches the decision record, perform a PCC (CDP Basic) analysis, and save the PCC analysis back into the database under the PCC field for that subtask.

**CONTEXT FILES:**
- `.Docs/F2-T0/F2-T0-S1_Decision_ChatSchema.md` (decision record for chat_messages schema)
- `backend/src/db/connection.js` (DB connection + `query` helper)
- `backend/src/scripts/update_F2_T0_S1_basic_info.js` (example of querying subtask id=7 / external_id P1‑F2‑T0‑S1)

---

## Instructions

### 1. Retrieve subtask details from the database
- Use `backend/src/db/connection.js` to connect to the DB.
- Query the `subtasks` table for the record with `external_id = 'P1-F2-T0-S1'` (this is F2‑T0‑S1) or `id = 7`.
- Log the returned `basic_info` and `instruction` JSONB columns.

### 2. Extract and verify the schema definition
- From `basic_info`, locate the `schema` object with `columns` and `notes`.
- Compare this schema against `.Docs/F2-T0/F2-T0-S1_Decision_ChatSchema.md`.
- Confirm:
  - Columns match:
    - `id SERIAL PRIMARY KEY`
    - `external_id VARCHAR(255) UNIQUE (optional)`
    - `sender VARCHAR(50) NOT NULL` with allowed values `user | orion | system`
    - `content TEXT NOT NULL`
    - `metadata JSONB` (no context)
    - `created_at TIMESTAMPTZ DEFAULT NOW()`
    - `updated_at TIMESTAMPTZ DEFAULT NOW() with auto-update trigger`
  - There is **no** `planning_doc_id` foreign key.
  - There is **no** `message_type` column.
  - Context is **not** stored in the row; it’s generated dynamically.

### 3. Perform PCC (CDP Basic) analysis for this schema
Using CDP Basic, produce a structured analysis with these sections:

#### 3.1 Atomic Actions
- `chat_messages_insert` – insert a new chat message row (user/orion/system) into `chat_messages` with content and metadata. Risk level: medium.
- `chat_messages_query_by_conversation` – read `chat_messages` rows for a given conversation / `external_id` to reconstruct history. Risk level: medium.
- `chat_messages_update_metadata` – update JSONB metadata for an existing message (e.g., model, token counts). Risk level: low.
- `chat_messages_delete_for_cleanup` – delete `chat_messages` for cleanup or test isolation in non-production environments. Risk level: low.

#### 3.2 Resources Touched
- **PostgreSQL (chat_messages table)** – **Write**
  - INSERTs for user/orion/system messages. Sender must respect CHECK constraint; invalid values should be rejected.
- **PostgreSQL (chat_messages table)** – **Read**
  - SELECT queries to build chat history. Requires appropriate indexing on `external_id` (if used) and/or `created_at`.
- **PostgreSQL (chat_messages table)** – **Update**
  - UPDATE metadata and `updated_at` timestamp. Must not modify `created_at`.
- **PostgreSQL (chat_messages table)** – **Delete**
  - DELETE for test isolation and potential cleanup tasks. Must be scoped by `external_id` or time window to avoid mass deletion.

#### 3.3 Resource Physics
For each resource, identify constraints, risks, and mitigations:

- **PostgreSQL (chat_messages)**
  - Constraint: Sender column must be constrained to a small, fixed set of values (`user`, `orion`, `system`).
  - Risk: Without a CHECK constraint, invalid senders or typos can enter the system and break UI/logic assumptions.
  - Mitigation: Implement a CHECK constraint on sender and add tests that attempt invalid values (e.g., `"admin"`, `"orion "`).

- **PostgreSQL (chat_messages)**
  - Constraint: No foreign key to `planning_docs`; messages are not tied to a specific `planning_doc_id`.
  - Risk: Consumers might incorrectly assume a direct FK and write joins that fail or silently drop rows.
  - Mitigation: Document the absence of FK in schema and tests; ensure tests focus on `chat_messages` in isolation and on `external_id`/`created_at` patterns.

- **PostgreSQL (chat_messages.metadata JSONB)**
  - Constraint: JSONB can grow arbitrarily large and unstructured if not bounded by convention.
  - Risk: Unbounded metadata could cause bloat, slower queries, or difficult debugging if keys are inconsistent.
  - Mitigation: Keep metadata to compact, operationally useful fields (model, token counts, etc.). Add tests that assert basic shape and avoid storing full context.

- **PostgreSQL (chat_messages timestamps)**
  - Constraint: `created_at` and `updated_at` must reflect true write/update times.
  - Risk: If triggers are misconfigured, `updated_at` may not change on UPDATE, breaking ordering and recency logic.
  - Mitigation: Add tests that INSERT then UPDATE a row and assert `updated_at > created_at` while `created_at` remains stable.

- **Test database (chat_messages)**
  - Constraint: Tests must run against an isolated test DB, not production.
  - Risk: Accidental writes to production would corrupt real chat history and violate safety requirements.
  - Mitigation: Ensure `DATABASE_URL` for tests points to a dedicated test DB; add a guard in tests that checks DB name/schema before running destructive operations.

#### 3.4 Test Implications
Every PCC finding should map to explicit test scenarios.

**Critical tests:**
- Test that migration `004_chat_messages.sql` creates `chat_messages` with all specified columns and data types.
- Test that the CHECK constraint on `sender` rejects invalid values and allows only `user`, `orion`, `system`.
- Test that inserting a row populates `created_at` and `updated_at` with the same initial timestamp.
- Test that updating a row changes `updated_at` while leaving `created_at` unchanged.
- Test that deleting `chat_messages` for a given `external_id` only affects that conversation and does not touch others.

**Nice to have tests:**
- Test basic CRUD operations (insert, select, update metadata, delete) for `chat_messages`.
- Test simple indexing strategy (e.g., index on `external_id`, `created_at`) via EXPLAIN or query performance in larger data sets (non-blocking for MVP).

### 4. Update PCC field in subtasks
- Write the PCC analysis as a JSON object and update the `pcc` JSONB column in the `subtasks` table for this row (F2‑T0‑S1).
- Verify the update by re‑querying the row and logging `pcc`.

---

## Constraints
- Do **not** modify any production code or migrations.
- Work only through tests, scripts, and DB queries.
- Treat the **test DB** as the target; never write to production.

---

## Output Requirement (submit_step_completion)
You must call the tool `submit_step_completion` with:
- `task_id`: `"F2-T0-S1"`
- `step_index`: a number representing this PCC step
- `agent`: `"Tara"`
- `status`: `"success" | "failure" | "blocked"`
- `artifacts`: list any script or test files you created or modified
- `summary`: short description of what you did
- `context_for_next_step`: anything Devon or Orion should know next
- `blockers`: if you are blocked, list reasons
