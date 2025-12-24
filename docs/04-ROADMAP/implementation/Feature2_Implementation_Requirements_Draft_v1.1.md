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

(Existing task details restructured into subtasks with IDs F2-T1-S1, F2-T1-S2, etc., following the same pattern as above.)

---

### Task F2-T2: Context System (The \"Eyes\")

(Existing task details restructured into subtasks.)

---

### Task F2-T3: \"Plan This\" Intent

(Existing task details restructured into subtasks.)

---

## 4. Cross-Cutting Concerns

(As in v1.0, including error handling, performance, concurrency.)

---

## 5. Open Questions

(As in v1.0, to be clarified before final spec.)

---

## 6. Summary

This Implementation Requirements Draft v1.1 for **Feature 2: Orion Chat & Context** includes a new Task 2-0 to address all missing fundamentals upfront, and restructures all tasks into atomic subtasks with clear instructions for Tara and Devon, acceptance criteria, and dependencies.

Once open questions are answered and subtasks are refined, this draft can be promoted to a Final Implementation Requirements document and fed into CAP/PCC + RED for final verification.
