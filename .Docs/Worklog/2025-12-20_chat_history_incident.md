# Work Log — 2025-12-20 — Chat History Deletion Incident

## Context
- This log captures the incident where **historical chat messages were deleted** when backend tests were run.
- The incident happened **before** we introduced `DATABASE_URL_TEST` and split app vs test databases (fixed on 2025‑12‑21 in subtask 2‑1‑8).

---

## 1. Symptoms
- After running the backend Jest test suite, previously visible chat history in the app **disappeared**.
- `chat_messages` table no longer contained the expected records for the active project(s).
- The application itself was still healthy (no startup errors), but historical context in the UI was gone.

---

## 2. Immediate Investigation

### 2.1 Suspected Areas
- Any tests referencing:
  - `chat_messages` table.
  - `/api/chat/messages` routes.
  - Migration / cleanup logic that might `DELETE` from tables.

### 2.2 Relevant Tests
- `backend/src/_test_/chat_messages_migration.spec.js`
- `backend/src/_test_/api_chat_messages.spec.js`
- Potentially other tests that assumed a clean slate and used destructive SQL.

**Observation:**
- Tests were running against the same database the app uses in dev (`appdb`), because the DB connection logic did **not** distinguish between prod/dev and test.
- Some tests explicitly deleted or reinserted rows into `chat_messages` as part of their setup/teardown.

---

## 3. Root Cause

**Single DB for both app and tests**
- `backend/src/db/connection.js` was using a single `DATABASE_URL` for all environments.
- Jest runs (`NODE_ENV=test`) still pointed to that same URL.
- Tests that reset or repopulated `chat_messages` (or other tables) were doing it in the **real app DB**.

**Result:**
- Running tests wiped or modified the `chat_messages` data that the app relies on to show historical conversation.

---

## 4. Fix (Implemented on 2025‑12‑21)

The fix itself was implemented the next day, but is logged here for completeness.

### 4.1 DB Connection Split
- `backend/src/db/connection.js` updated to:
  - Use `process.env.DATABASE_URL_TEST` when `NODE_ENV === 'test'`.
  - Otherwise use `process.env.DATABASE_URL`.

- `.env` now includes both:
  - `DATABASE_URL=postgresql://.../appdb`
  - `DATABASE_URL_TEST=postgresql://.../appdb_test`

### 4.2 Outcome
- Jest tests now run against **`appdb_test`**.
- Destructive test logic (`DELETE FROM chat_messages`, etc.) no longer touches real production/dev conversation history.
- The original symptom (losing history after tests) should no longer occur.

---

## 5. Lessons Learned

1. **Never run tests against the same DB as the app**
   - Integration tests often need destructive operations.
   - Always provision a separate test database (or schemas) and route tests there.

2. **Be explicit in connection logic**
   - Dont rely on a single `DATABASE_URL` and assume tests wont cause problems.
   - Make `NODE_ENV` and dedicated `*_TEST` URLs first-class citizens in the connection layer.

3. **Traceability helps**
   - Having a `TraceEvent`/`TraceService` stack (added on 2025‑12‑21) will help surface similar issues in the future (e.g., log when migrations or cleanup scripts run).

4. **Workflows should call this out**
   - Test docs and migration docs should warn that tests target the test DB, and how to reset it safely.

---

## 6. Status

- **Incident recorded:** Yes (this log).
- **Fix applied:** Yes (on 2025‑12‑21, see `2025-12-21_trace_tools_and_dashboard.md`).
- **Current behavior:**
  - Running backend Jest tests no longer deletes real chat history.
  - `chat_messages` in `appdb` is now isolated from test runs.

For a detailed description of the follow-up architecture and tools/tracing work, see:
- `.Docs/Worklog/2025-12-21_trace_tools_and_dashboard.md`
- `.Docs/Orion_Tool_Execution_Guide.md`
