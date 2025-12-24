# Feature 2: Orion Chat & Context — CAP & PCC Level 3 Findings

## 1. Overview

This document presents the results of a Constraint-Aware Planning (CAP) and Preflight Constraint Check (PCC Level 3) analysis for Feature 2: Orion Chat & Context. The goal is to identify missing elements, ambiguities, resource constraints, and mitigation strategies before implementation.

---

## 2. CAP (Constraint-Aware Planning) Analysis

### 2.1. Actions (What needs to happen)

- User opens Chat UI and sends a message.
- Frontend sends POST /api/chat with user message.
- Backend receives, validates, and persists the message (linked to project/session).
- Backend triggers context gathering (ContextBuilder) for the message.
- ContextBuilder uses search_files and list_files tools to collect relevant file data.
- Orion (LLM) receives message + context, generates a response or plan draft.
- Backend saves Orion's response to DB.
- Frontend displays Orion's response in chat log.
- (Optional) User can trigger "Plan This" intent, which creates a draft plan entry in DB.

### 2.2. Resources

- PostgreSQL database (chat history, context artifacts, plan drafts)
- Node.js/Express backend (API endpoints, services)
- Vue 3 frontend (Chat UI, context display)
- ContextBuilder service (backend)
- search_files and list_files tools (backend utilities)
- LLM API (DeepSeek or equivalent)
- Environment variables (API keys, DB connection)
- File system (project files for context gathering)

### 2.3. Data Flow

User → Chat UI → POST /api/chat → Backend → DB (save message)  
→ ContextBuilder (gather context) → search_files/list_files → File system  
→ LLM API (Orion) → DB (save response/plan) → Frontend (display)

### 2.4. Dependencies

- Feature 1 DB schema (planning_docs, tasks, etc.) must exist.
- DeepSeek API key and connectivity.
- search_files/list_files tools implemented and accessible.
- ContextBuilder logic defined and testable.
- Frontend Chat UI and backend API contract alignment.

### 2.5. Test Seams

- API endpoints testable with mock requests.
- ContextBuilder can be tested with controlled file sets.
- LLM API can be stubbed/mocked for integration tests.
- DB writes/reads can be validated independently.
- UI can be tested for message display and error handling.

---

## 3. PCC Level 3 (Preflight Constraint Check) — Gap & Constraint Analysis

### 3.1. Atomic Actions

- frontend_send_message: User sends message via UI.
- backend_receive_message: API receives and validates.
- db_store_message: Persist message in DB.
- context_gathering: ContextBuilder runs search_files/list_files.
- context_aggregation: Collects and formats file data.
- llm_invoke: Sends message + context to LLM API.
- db_store_response: Saves LLM/Orion response.
- frontend_display_response: UI updates with new message/plan.
- plan_draft_creation: (Optional) "Plan This" triggers plan entry.

### 3.2. Resources Touched

| Resource                | Action         | Notes                                 |
|-------------------------|---------------|---------------------------------------|
| PostgreSQL (chat, plan) | Read/Write    | Must have tables, handle schema drift |
| File System             | Read          | Permissions, large file sets          |
| LLM API (DeepSeek)      | Read/Write    | API key, rate limits, error handling  |
| Node.js/Express         | Execute       | Service availability                  |
| Vue 3 Frontend          | Display/Send  | UI/UX consistency                     |
| Env Vars                | Read          | Key presence, .env sync               |

### 3.3. Physical Constraints & Mitigations

| Resource      | Constraint                | Risk                        | Mitigation                        |
|---------------|---------------------------|-----------------------------|------------------------------------|
| PostgreSQL    | Table must exist          | 500 error on write          | Migration check before start       |
| File System   | Large project, slow scan  | Timeout, memory pressure    | Limit search scope, async ops      |
| LLM API       | Rate limits, downtime     | No response, user blocked   | Retry logic, error messaging       |
| Env Vars      | Missing keys              | Feature fails silently      | Startup validation, error logs     |
| Context Tools | Not implemented/unstable  | Context missing, bad plans  | Unit tests, fallback messaging     |

### 3.4. Gap Analysis

| Gap/Question                                   | Possible Interpretations                | Impact / Mitigation                |
|------------------------------------------------|-----------------------------------------|------------------------------------|
| How is context scope determined?               | (A) All files, (B) Only src/, (C) User picks | (A) Slow, (B) Fast, (C) Needs UI   |
| What if LLM API fails?                         | (A) Retry, (B) Show error, (C) Silent fail | (A) Resilient, (B) User aware      |
| How are large files handled?                   | (A) Truncate, (B) Ignore, (C) Stream    | (A) Partial context, (B) Gaps      |
| How is chat history linked to project/session? | (A) Per user, (B) Per project, (C) Global | (A) Isolated, (B) Shared context   |
| Who can trigger \"Plan This\"?                 | (A) Any user, (B) Only admin, (C) Disabled | (A) Flexible, (B) Controlled       |
| How is context displayed in UI?                | (A) Inline, (B) Separate panel, (C) Not shown | (A) Clutter, (B) Discoverable      |

### 3.5. Conditional Verdicts

- IF context scope is not limited, THEN performance risk is HIGH.
- IF LLM API is unavailable, THEN user must see error, not silent fail.
- IF context tools are not robust, THEN plan quality will suffer.
- IF chat history is not linked to project, THEN context will be inconsistent.

---

## 4. Recommendations & Mitigations

Below, each recommendation is broken down into specific architect-level actions or decisions needed from you:

- **Define context scope**
  - Specify: What directories/files should be included by default in context gathering? (e.g., only `src/`, or all project files?)
  - Decide: Should users be able to configure or override the context scope? If so, how (UI, config, etc.)?
  - Document: Any exclusions (e.g., node_modules, build artifacts) and rationale.

- **Implement robust error handling for LLM API and context tools**
  - Specify: What should the system do if the LLM API or context tools fail? (e.g., retry, show error to user, fallback behavior)
  - Define: Error message standards and user-facing error flows.
  - Document: Logging/monitoring requirements for failures.

- **Validate all required environment variables at startup**
  - List: All required env vars (API keys, DB connection, etc.) for Feature 2.
  - Specify: What should happen if a required env var is missing? (e.g., fail fast, log error, show UI warning)
  - Document: Where these requirements are enforced (backend, frontend, both).

- **Test with large projects to ensure context gathering is performant**
  - Define: What constitutes a "large project" (e.g., >1000 files, >100MB)?
  - Specify: Performance acceptance criteria (e.g., context gathering must complete in <5s).
  - Recommend: Any architectural patterns (e.g., batching, async processing) to support scalability.

- **Clarify chat history linkage**
  - Decide: Should chat history be linked per user, per project, or globally?
  - Specify: Data model for chat history linkage (DB schema, foreign keys, etc.).
  - Document: Any privacy or isolation requirements.

- **UI: Display context artifacts in a discoverable, non-intrusive way**
  - Specify: Where and how should context artifacts be shown in the UI? (e.g., inline with chat, in a side panel, as downloadable files)
  - Define: UX requirements for discoverability and non-intrusiveness.
  - Document: Any accessibility or usability standards.

- **Document all API contracts and DB schema changes**
  - List: All new/modified API endpoints and their request/response shapes.
  - Specify: All DB schema changes (tables, columns, relationships) required for Feature 2.
  - Provide: Example payloads and migration notes.

**Action Required:**  
For each item above, provide the architectural decision, specification, or clarification requested. This will ensure implementation and testing can proceed without ambiguity.
---

## 5. Open Questions

- Should users be able to configure which folders are included in context?
- What is the maximum context size for LLM API calls?
- How are concurrent chat sessions handled?
- Should "Plan This" be available on every message or only certain types?

---

## 6. Summary

This CAP and PCC Level 3 analysis for Feature 2 surfaces several key gaps and risks, especially around context scope, error handling, and UI/UX clarity. Addressing these before implementation will reduce rework and improve system robustness.
