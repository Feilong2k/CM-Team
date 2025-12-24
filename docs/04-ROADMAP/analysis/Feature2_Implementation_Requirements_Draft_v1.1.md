# Feature 2 — Orion Chat & Context (Implementation Requirements Draft v1.1)

## 1. Vision & Scope

**Goal:**
We can talk to Orion through the Chat UI, and he has sufficient, accurate context about the project to:
- Answer questions about the codebase.
- Propose plans ("Plan This" intent) that are grounded in real files and project structure.

**UI Checkpoint (from MVP v1.2):**
- Open **"Chat"** tab → Ask **"What is in src/?"** → Orion lists files based on the actual project structure.

**Out of Scope (for Feature 2):**
- Running tests (Tara) or editing code (Devon).
- AI-controlled filesystem writes (see separate AI FS Tools RED analysis).

---

## 2. High-Level Architecture

**Data Flow (from CAP findings):**

User → Chat UI → `POST /api/chat` → Backend (Chat Controller/Service) →
- Persist message (DB)
- Trigger ContextBuilder (search_files/list_files)
- Build prompt with message + context
→ LLM API (DeepSeek) → Backend (store response/plan) → Frontend (display)
→ (Optional) "Plan This" → Create draft plan entry in DB.

**Key Components:**
- **Frontend:**
  - `ChatPanel.vue`: chat history display + context hints.
  - `MessageInput.vue`: user input + send action.
- **Backend:**
  - Chat route/controller/service for `/api/chat`.
  - ContextBuilder service (`search_files`, `list_files`, file reads, context aggregation).
  - LLM client/service (DeepSeek or equivalent).
  - Persistence layer for chat messages and Orion responses/plan drafts.

**Dependencies on Feature 1:**
- DB infrastructure and base schema for planning docs/tasks already exist.
- We may **extend** schema for:
  - Chat messages
  - Orion responses
  - Plan drafts linked to chat.

---

## 3. Detailed Tasks

### Task F2-T0: Resolve Missing Fundamentals from RED & CAP/PCC Analysis

**Overview:**  
Address all identified gaps, constraints, and missing fundamentals from RED v1.1 and CAP/PCC findings before implementation begins. Each subtask corresponds to a specific category of missing items/tools/knowledge.

#### Subtasks:

##### F2-T0-S1: Create Chat & Plan Persistence Schema (Data Model)
- **Overview:** Design and implement database schema for chat messages, Orion responses, and plan drafts.
- **Instructions for Tara:**  
  - Write migration tests verifying the `chat_messages` table exists with correct columns.  
  - Test foreign key constraints and ensure joinability with planning_docs.  
  - Verify migration rollback works without data loss.  
- **Instructions for Devon:**  
  - Create migration file `004_chat_messages.sql` with the specified schema.  
  - Ensure compatibility with existing migration tooling.  
  - Test migration up/down locally.  
- **Acceptance Criteria:**  
  - Migration runs without errors.  
  - Table structure matches schema.  
  - Basic CRUD operations succeed.  
- **Dependencies:** Feature 1 migration infrastructure and planning_docs table.

##### F2-T0-S2: Validate DB & LLM API Connectivity (Infrastructure & Access)
- **Overview:** Ensure PostgreSQL is running and reachable; validate DeepSeek API key and endpoint.
- **Instructions for Tara:**  
  - Write tests for DB connectivity and DeepSeek API key format.  
  - Create health check endpoint tests for DB and LLM connectivity.  
- **Instructions for Devon:**  
  - Implement health check service verifying DB and LLM connectivity.  
  - Add startup validation for required environment variables.  
- **Acceptance Criteria:**  
  - Health endpoint returns correct status.  
  - Missing env vars cause clear startup errors.  
- **Dependencies:** PostgreSQL running; DeepSeek API key configured.

##### F2-T0-S3: Implement Filesystem Context Tools (Tooling)
- **Overview:** Build `search_files` and `list_files` utilities for ContextBuilder.
- **Instructions for Tara:**  
  - Write unit and integration tests for file listing and searching, including error handling.  
- **Instructions for Devon:**  
  - Implement `list_files` and `search_files` utilities with proper API and documentation.  
- **Acceptance Criteria:**  
  - Tools return correct file lists and handle exclusions/errors properly.  
- **Dependencies:** Node.js `fs` and `path` modules; optional `fast-glob` package.

##### F2-T0-S4: Define Prompt Templates & Context Policies (Knowledge & Configuration)
- **Overview:** Create prompt templates for chat and context gathering; define context scope policies.
- **Instructions for Tara:**  
  - Review prompt templates for completeness and clarity.  
  - Test context scope enforcement in ContextBuilder.  
- **Instructions for Devon:**  
  - Develop prompt templates with examples for LLM usage.  
  - Implement context scope configuration and enforcement.  
- **Acceptance Criteria:**  
  - Prompts guide LLM effectively.  
  - Context scope respects configured directories and exclusions.  
- **Dependencies:** LLM API integration; configuration management.

##### F2-T0-S5: Design UI/UX for Context & Error Display (UX/UI)
- **Overview:** Define how context artifacts and errors are displayed in the Chat UI.
- **Instructions for Tara:**  
  - Test UI for discoverability and non-intrusiveness of context display.  
  - Verify error messages are clear and consistent.  
- **Instructions for Devon:**  
  - Implement UI components or enhancements for context and error display.  
- **Acceptance Criteria:**  
  - Context is accessible but not intrusive.  
  - Errors are clearly shown to users.  
- **Dependencies:** Frontend Chat UI components.

##### F2-T0-S6: Establish Operational Policies (Operational)
- **Overview:** Define concurrency, session handling, rollback strategies, and operational ownership.
- **Instructions for Tara:**  
  - Write tests for concurrency and session management.  
  - Verify rollback mechanisms function correctly.  
- **Instructions for Devon:**  
  - Implement concurrency controls and session scoping.  
  - Develop rollback and backup strategies.  
  - Define operational ownership and approval workflows.  
- **Acceptance Criteria:**  
  - Concurrency conflicts are prevented.  
  - Rollback restores system state reliably.  
  - Operational roles and responsibilities are documented.  
- **Dependencies:** Backend session management; version control integration.

---

### Task F2-T1: Chat API & Persistence

#### Subtasks:

##### F2-T1-S1: Design Chat Message Database Schema
- **Overview:** Create the `chat_messages` table and supporting schema.
- **Instructions for Tara:**  
  - Verify migration creates the table with correct columns and constraints.  
  - Test CRUD operations and rollback.  
- **Instructions for Devon:**  
  - Write migration file for `chat_messages`.  
  - Test migration up/down.  
- **Acceptance Criteria:**  
  - Migration runs without errors.  
  - Table structure matches design.  
- **Dependencies:** Feature 1 migration infrastructure.

##### F2-T1-S2: Implement Chat API Endpoint
- **Overview:** Build `POST /api/chat` endpoint with validation and persistence.
- **Instructions for Tara:**  
  - Write integration tests for success, validation, and error cases.  
- **Instructions for Devon:**  
  - Implement route, controller, and service logic.  
  - Handle errors gracefully.  
- **Acceptance Criteria:**  
  - Endpoint returns 400 for invalid input.  
  - Stores user and Orion messages.  
- **Dependencies:** F2-T1-S1.

##### F2-T1-S3: Integrate Frontend Chat UI
- **Overview:** Connect frontend chat UI to backend API.
- **Instructions for Tara:**  
  - Test frontend-backend integration and error display.  
- **Instructions for Devon:**  
  - Update `ChatPanel.vue` to use new API.  
  - Handle loading and errors.  
- **Acceptance Criteria:**  
  - User can send messages and receive responses.  
- **Dependencies:** F2-T1-S2.

---

### Task F2-T2: Context System (The \"Eyes\")

#### Subtasks:

##### F2-T2-S1: Implement `list_files` Utility
- **Overview:** Return directory tree or flat list under sandboxed root.
- **Instructions for Tara:**  
  - Write unit tests for file listing and exclusions.  
- **Instructions for Devon:**  
  - Implement `list_files` with options for scope and exclusions.  
- **Acceptance Criteria:**  
  - Returns correct file list.  
- **Dependencies:** Node.js `fs` module.

##### F2-T2-S2: Implement `search_files` Utility
- **Overview:** Return list of files/snippets matching pattern.
- **Instructions for Tara:**  
  - Write unit tests for search functionality and error handling.  
- **Instructions for Devon:**  
  - Implement `search_files` using glob or similar.  
- **Acceptance Criteria:**  
  - Returns matching files/snippets.  
- **Dependencies:** Node.js `fs` and `path` modules.

##### F2-T2-S3: Build ContextBuilder Service
- **Overview:** Aggregate file content into prompt-friendly context bundle.
- **Instructions for Tara:**  
  - Test context bundle correctness and size limits.  
- **Instructions for Devon:**  
  - Implement service to call `list_files` and `search_files`, aggregate results.  
- **Acceptance Criteria:**  
  - Returns structured context bundle.  
- **Dependencies:** F2-T2-S1, F2-T2-S2.

---

### Task F2-T3: \"Plan This\" Intent

#### Subtasks:

##### F2-T3-S1: Add \"Plan This\" UI Affordance
- **Overview:** Add button or UI element to trigger plan drafting.
- **Instructions for Tara:**  
  - Test UI element visibility and interaction.  
- **Instructions for Devon:**  
  - Update `ChatPanel.vue` to include \"Plan This\" button.  
- **Acceptance Criteria:**  
  - Button appears on relevant messages.  
- **Dependencies:** Frontend Chat UI.

##### F2-T3-S2: Implement `POST /api/plan-this` Endpoint
- **Overview:** Backend endpoint to create draft plan from chat context.
- **Instructions for Tara:**  
  - Write integration tests for endpoint success and failure.  
- **Instructions for Devon:**  
  - Implement route, controller, and service logic to generate and persist plan draft.  
- **Acceptance Criteria:**  
  - Endpoint creates valid plan draft in DB.  
- **Dependencies:** F2-T1, F2-T2.

##### F2-T3-S3: Map Plan Draft to Planning Schema
- **Overview:** Convert LLM output to DB schema entities.
- **Instructions for Tara:**  
  - Verify data mapping correctness and error handling.  
- **Instructions for Devon:**  
  - Implement mapping logic from LLM JSON to planning_docs and tasks tables.  
- **Acceptance Criteria:**  
  - Plan draft is correctly stored and queryable.  
- **Dependencies:** F2-T3-S2.

---

## 4. Cross-Cutting Concerns

### 4.1 Error Handling & UX (from CAP/PCC)

- LLM/API errors:
  - Must be visible to the user (no silent failures).
  - Standardized error messages.
- Context errors:
  - When context cannot be gathered, the response should:
    - Explain that context is limited or missing.
    - Avoid pretending to have seen files.

### 4.2 Performance & Scalability

- Define performance thresholds for context gathering.
- Implement safeguards (time budgets, file limits, directory scope).

### 4.3 Concurrency & Sessions

- Decide how chat history is scoped:
  - Per project, per user, or global.
- At minimum, decisions and schema must not preclude future extension to per-user/per-session chats.

---

## 5. Open Questions (To Be Clarified Before Final Spec)

From CAP/PCC/RED findings:
- Should users be able to configure which folders are included in context (per project)?
- What is the maximum context size (tokens/characters) for LLM API calls?
- How are concurrent chat sessions handled (per user vs global history)?
- Should "Plan This" be available on every message or only certain types (e.g., explicit problem statements)?
- How should context artifacts be displayed in the Chat UI (inline vs side panel)?

---

## 6. Summary

This Implementation Requirements Draft v1.1 for **Feature 2: Orion Chat & Context** includes a new Task 2-0 to address all missing fundamentals upfront, and restructures all tasks into atomic subtasks with clear instructions for Tara and Devon, acceptance criteria, and dependencies.

Once open questions are answered and subtasks are refined, this draft can be promoted to a Final Implementation Requirements document and fed into CAP/PCC + RED for final verification.
</final_file_content>
</write_to_file>
