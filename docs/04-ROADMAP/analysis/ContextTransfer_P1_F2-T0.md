__Date:__ 2025-12-19\
__Author:__ Cline (Devon)\
__Project:__ CM-TEAM (Feature 2 – Orion DB Surface & Tool Integration)\
__Previous Task:__ 2-0 (Orion DB Surface v1.1) – __Completed__\
__Next Task:__ 2-1 (DeepSeek API Integration with Tool-Calling Prompt Templates)

---

## 1. Current State of the System

### 1.1 Database Schema (Post‑2‑0)

- __Features__, __Tasks__, __Subtasks__ tables with JSONB columns (`basic_info`, `instruction`, `pcc`, `tests`, `implementations`, `review`, `activity_log`).
- __New relational table__ `subtask_activity_logs` (migration 005) – normalized activity logging.
- __External IDs__ (`external_id`) used for human‑readable references (e.g., `P1-F2-T0-S7`).
- __Dual‑ID system__: numeric `id` (PK) + `external_id` (unique, project‑scoped).
- __Database connection__ is stable (`backend/tools/db.js` loads `.env` correctly, cleans `DATABASE_URL`).

### 1.2 Backend API (`/api/features`)

- Returns nested features → tasks → subtasks.

- __Activity logs__ are now served from `subtask_activity_logs` and mapped to the UI‑expected shape:

  ```js
  subtask.activity_log = rawLogs.map(log => ({
    sender: log.agent || 'Devon',
    message: log.content,
    timestamp: log.timestamp,
    _raw: log,
  }));
  ```

- Legacy JSONB `activity_log` column is still present but no longer the source of truth for subtasks (still used for features/tasks).

### 1.3 Frontend UI

- __SubtaskModal.vue__ renders `subtask.activity_log` as chat‑style entries.
- __FeatureTree.vue__ and __EntityModal.vue__ also display activity logs for features/tasks (still using JSONB columns).
- UI expects `{ sender, message, timestamp }` objects.

### 1.4 Testing Status

- All tests pass after fixing `.env` loading and using test‑only data.

- __Test coverage__ includes:

  - Orion DB Surface v1.1 (`orion_db_surface_v1_1.spec.js`)
  - Schema validation (`schema_v2.spec.js`)
  - API endpoints (`api_chat_messages.spec.js`, `context_tools.spec.js`)
  - Migration workflow (`migration‑workflow.spec.js`)

---

## 2. Task 2‑1 Overview

__Goal:__ Integrate DeepSeek API with tool‑calling prompt templates, implement conversation management, and log API calls to the database.

__Subtasks (from plan):__

- __2‑1‑1__ – Set up DeepSeek API credentials and environment.
- __2‑1‑2__ – Create prompt templates for plan/act modes.
- __2‑1‑3__ – Implement DeepSeek adapter with retry logic and error handling.
- __2‑1‑4__ – Integrate adapter with Orion wrapper and log API calls.
- __2‑1‑5__ – Write tests for API integration and tool‑calling.

__Key Deliverables:__

1. `backend/src/adapters/DeepSeekAdapter.js`
2. `backend/src/prompts/deepseek‑plan.mustache`
3. `backend/src/prompts/deepseek‑act.mustache`
4. `backend/src/middleware/tokenCounter.js`
5. Updated `backend/src/agents/OrionAgent.js`
6. Database logging for every API call (new table `api_call_logs`? or extend `subtask_activity_logs`).
7. Comprehensive test suite.

---

## 3. How to Use the Database Tool (`DatabaseTool.js`)

The DatabaseTool provides a unified, type‑safe interface for all DB operations. It’s the __single source of truth__ for database mutations in the Orion workflow.

### 3.1 Location & Import

```js
const DatabaseTool = require('../../tools/DatabaseTool');
// or from a script:
const { DatabaseTool } = require('../tools/DatabaseTool');
```

### 3.2 Core Methods

#### `getSubtaskByExternalId(externalId, projectContext = 'P1')`

- Returns a subtask with its relational activity logs and analyses.

- __Example:__

  ```js
  const subtask = await DatabaseTool.getSubtaskByExternalId('F2-T0-S7', 'P1');
  console.log(subtask.activity_logs); // array from subtask_activity_logs
  ```

#### `updateSubtask(subtaskId, changes)`

- Transactional update that validates change keys, normalizes IDs, and appends an activity log entry.

- __Example:__

  ```js
  await DatabaseTool.updateSubtask(19, {
    status: 'in progress',
    basic_info: { owner: 'Devon' },
  });
  ```

- Automatically logs the change in `subtask_activity_logs` with type `'status_update'`.

#### `appendActivityLog(subtaskId, logData)`

- Direct insert into `subtask_activity_logs`.

- __Example:__

  ```js
  await DatabaseTool.appendActivityLog(19, {
    type: 'implementation',
    agent: 'Devon',
    content: 'DeepSeek adapter implemented.',
    metadata: { ref: 'F2-T1-S3' },
  });
  ```

#### `normalizeId(input, entityType, projectContext)`

- Converts shorthand IDs (`2-1-3`) to full external IDs (`P1-F2-T1-S3`) and resolves to numeric PK.

- __Example:__

  ```js
  const { numericId, externalId } = await DatabaseTool.normalizeId('2-1-3', 'subtask', 'P1');
  ```

### 3.3 Error Handling & Validation

- Rejects unknown change keys (e.g., `foo: 'bar'`).
- Ensures project context is present for shorthand IDs.
- All mutations are wrapped in a transaction; partial updates are rolled back on error.

### 3.4 Using in Tests

- In test files, import `DatabaseTool` and mock only if necessary.
- Prefer using the real tool with test‑only data (IDs that exist in the test DB).

---

## 4. Starting Task 2‑1 – Immediate Steps

### 4.1 Environment Setup

1. Add `DEEPSEEK_API_KEY` to `.env` (and `.env.example`).
2. Create `backend/src/adapters/` directory if missing.
3. Install any needed packages (`axios`, `mustache`, `node‑fetch`).

### 4.2 Prompt Template Creation

- Use Mustache templates for plan/act modes.

- Store in `backend/src/prompts/`.

- Include placeholders for:

  - `tools` (array of tool schemas)
  - `conversation` (array of previous messages)
  - `system_prompt` (Orion’s current instructions)

### 4.3 DeepSeek Adapter

- Class `DeepSeekAdapter` with methods:

  - `call(prompt, tools, options)`
  - `parseToolCalls(response)`
  - `handleRateLimit(retryAfter)`

- Integrate token counting middleware.

### 4.4 Database Logging

- Decide whether to create `api_call_logs` table or reuse `subtask_activity_logs` with a `type='api_call'`.
- Log: timestamp, agent, token count, duration, success/failure, error message.

### 4.5 Integration with Orion

- Modify `OrionAgent.js` to use `DeepSeekAdapter` instead of direct fetch.
- Pass tool schemas from `DatabaseTool` / `list_files` / `search_files` tools.

---

## 5. Risks & Mitigations

| Risk | Mitigation | |------|------------| | API rate limiting | Implement exponential backoff, track usage in DB. | | Token overflow | Count tokens before sending, truncate conversation if needed. | | Schema drift | Keep prompt templates versioned; validate with tests. | | DB connection pool exhaustion | Monitor pool stats; adjust `max` in `db.js`. |

---

## 6. Handoff Notes for Next Agent

- __Database is stable__ – use `DatabaseTool` for all mutations.
- __Activity logs are relational__ – write to `subtask_activity_logs`, read via `subtask.activity_log` (auto‑mapped).
- __Test suite passes__ – keep it green by adding new tests for 2‑1.
- __UI expects__ `{ sender, message, timestamp }` – map accordingly.
