# Feature 2 — Orion Chat & Context (Implementation Requirements Draft v1.0)

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

### Task 2.1 — Chat API & Persistence

#### 3.1.1 Overview
Implement a backend Chat API and persistence model so that:
- The frontend can POST user messages to `/api/chat`.
- The backend can store messages and Orion responses.
- Messages are linked to a project/context (even if project scoping is minimal for MVP).

#### 3.1.2 Technical Details

**Backend API:**
- **Endpoint:** `POST /api/chat`
  - **Request Body (MVP):**
    ```json
    {
      "message": "string",
      "projectId": "string or null" // optional for now
    }
    ```
  - **Response:**
    ```json
    {
      "messageId": "string",        // DB id for user message
      "orionMessageId": "string",   // DB id for Orion response
      "orionResponse": "string",    // human-readable reply
      "metadata": {
        "contextSummary": "string", // optional summary of context used
        "planDraftId": "string|null"// if Plan This was auto-triggered (optional)
      }
    }
    ```

**Backend Components:**
- `chatRoutes.js` (or extend existing routes file):
  - Register `POST /api/chat`.
- `chatController.js`:
  - Validate incoming request (non-empty `message`).
  - Call `chatService.handleChatMessage(payload)`.
- `chatService.js`:
  - Persist user message.
  - Invoke ContextBuilder (Task 2.2) to get context bundle.
  - Call LLM client with prompt (Task 2.2 / 2.3).
  - Persist Orion response.
  - Return response payload to controller.

**DB Schema (from RED & CAP):**
- **New tables (Data Model Missing Fundamentals):**
  - `chat_messages`:
    - `id` (PK)
    - `project_id` (nullable FK to projects/planning_docs)
    - `role` (`user` | `orion`)
    - `message` (text)
    - `created_at` (timestamp)
  - (Optional for MVP) `chat_sessions` or session linkage:
    - For now, we can model chat history by project only.

**Migrations:**
- Add migration file(s) to create `chat_messages`.
- Align naming and versioning with existing `002_`/`003_` migrations.

#### 3.1.3 Acceptance Criteria
- `POST /api/chat`:
  - Returns `400` when `message` is missing/empty.
  - Returns `200` with:
    - Persisted user message row.
    - Persisted Orion response row.
  - Stores both user + Orion messages in `chat_messages` table.
- Chat messages are linked to a project or a default context.
- Errors from DB or LLM are handled with appropriate HTTP codes and user-friendly messages.

#### 3.1.4 Edge Cases & Error Handling
- DB unavailable / connection failure → return `503` with clear error.
- LLM API failure (timeout, 4xx/5xx):
  - Implement retry/backoff logic (configurable).
  - If still failing, return `503` plus clear user-facing error and log details.
- Oversized messages → optional 413 or truncation strategy.

#### 3.1.5 Dependencies
- DB migrations infrastructure (Feature 1 Task 1.0).
- Base DB availability.
- LLM API key & endpoint configured.

#### 3.1.6 Decisions Locked (from CAP/PCC/RED)
- Messages **must** be persisted in DB (not just memory) for context continuity.
- Error handling cannot be silent; LLM & DB failures must surface clearly to the user.

---

### Task 2.2 — Context System (The "Eyes")

#### 3.2.1 Overview
Implement a Context System that can:
- Use `search_files` and `list_files` to discover relevant files.
- Read and aggregate content into a prompt-friendly context bundle.
- Respect performance constraints and scope decisions.

#### 3.2.2 Technical Details

**Context Tools:**
- Implement backend utilities:
  - `list_files(root, options)`:
    - Returns directory tree or flat list under a sandboxed root.
  - `search_files(pattern, root, options)`:
    - Returns list of files and/or snippets matching pattern.
- Both must:
  - Respect a **default context scope** (e.g., `frontend/src`, `backend/src`, `backend/migrations`).
  - Exclude `node_modules`, build artifacts, and other noise.

**ContextBuilder Service:**
- Input:
  - User message.
  - Optional `projectId`.
- Responsibilities:
  - Decide which directories/files to inspect:
    - Initial heuristic based on user message (e.g., mentions `frontend`, `backend`, file names).
    - Default scope if ambiguous.
  - Call `list_files` / `search_files` to:
    - Enumerate candidate files.
    - Gather relevant snippets.
  - Limit context bundle size:
    - Token/char-based budget for LLM prompt.
    - Truncation/selection strategy (most relevant files first).
  - Produce structured context bundle:
    ```json
    {
      "files": [
        {
          "path": "frontend/src/ChatPanel.vue",
          "summary": "string",
          "snippets": ["...code..."]
        }
      ],
      "summary": "High-level description of what was found"
    }
    ```

**Scope & Performance (from CAP/PCC):**
- Choose default context scope (e.g., only `src/` subtrees by default).
- Define what a "large project" is (files/size) and how to handle it:
  - Batching or partial scans.
  - Timeouts or resource limits.

#### 3.2.3 Acceptance Criteria
- Given a small project, ContextBuilder can:
  - List files under configured scope.
  - Search by simple patterns.
  - Return a non-empty context bundle for typical questions (e.g., "What is in src/?").
- For large projects, ContextBuilder:
  - Completes within agreed time budget.
  - Does not blow memory.
  - Degrades gracefully (partial context + explanation) if limits are hit.

#### 3.2.4 Edge Cases & Error Handling
- Missing or unreadable files:
  - Skip with logged warning; do not crash.
- No relevant files found:
  - Return empty-but-valid bundle with explanation for LLM/user.
- `search_files` / `list_files` failure:
  - Fail loudly with clear error; provide fallback messaging.

#### 3.2.5 Dependencies
- Filesystem access within project root.
- Configuration of context scope (dirs to include/exclude).

#### 3.2.6 Decisions Locked (from CAP/PCC/RED)
- Context scope **must be explicitly defined** (no "scan everything").
- Tools **must** be robust: failures are surfaced and logged, not ignored.

---

### Task 2.3 — "Plan This" Intent

#### 3.3.1 Overview
Allow users (via Chat UI) to trigger a **"Plan This"** action that:
- Takes the current user request + context bundle.
- Asks Orion (LLM) to propose a **draft plan**.
- Persists this draft as a new planning entity in the DB (aligned with Feature 1 schema).

#### 3.3.2 Technical Details

**Frontend:**
- In `ChatPanel.vue`:
  - Add a "Plan This" affordance on relevant messages (e.g., user’s latest message or taggable messages).
  - UX option: button per message or a global button that works on the last user message.
- Trigger API call:
  - `POST /api/plan-this` with:
    ```json
    {
      "messageId": "string",
      "projectId": "string or null"
    }
    ```

**Backend API:**
- **Endpoint:** `POST /api/plan-this`
  - Load:
    - The referenced chat message.
    - Recent chat history if needed.
    - Context bundle via ContextBuilder.
  - Build a **Plan Draft Prompt**:
    - Include problem statement (user message).
    - Include high-level context summary and key file snippets.
  - Call LLM to generate plan draft structured as:
    ```json
    {
      "title": "string",
      "description": "string",
      "tasks": [
        { "title": "string", "description": "string" }
      ]
    }
    ```
  - Map this structure onto existing planning schema (Feature 1):
    - Possibly as a new `planning_docs` row with associated `tasks`.
  - Persist plan draft and return identifiers to frontend.

#### 3.3.3 Acceptance Criteria
- From the Chat UI, user can click "Plan This" on a message and:
  - Backend creates a new draft plan entry in DB.
  - Frontend receives plan draft id and basic info.
- Draft plan is visible in whatever plan viewer exists (even if only at a basic level).
- If the LLM fails, user sees an error and no partial/invalid plan is persisted.

#### 3.3.4 Edge Cases & Error Handling
- Invalid `messageId` → `404`.
- LLM failure → clear error and no plan persisted.
- Mapping failures (e.g., schema mismatch) → logged and surfaced as `500` with safe message.

#### 3.3.5 Dependencies
- Fully working Task 2.1 and 2.2.
- Planning schema from Feature 1.
- Plan viewer UI to show drafts (at least minimally).

#### 3.3.6 Decisions Locked (from CAP/PCC/RED)
- Plan drafts must **align with existing planning schema**; no ad-hoc storage.
- Users should have a clear, reviewable artifact after "Plan This" (not just transient LLM text).

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

This Implementation Requirements Draft for **Feature 2: Orion Chat & Context** pulls together:
- High-level goals and UI checkpoints from `Orion_System_MVP_Implementation_Requirements_v1.2.md`.
- Action flows, dependencies, and test seams from the **CAP/PCC findings**.
- Constraints, missing fundamentals, and locked decisions from the **RED v1.1 analysis**.

Once open questions are answered and schema/API details are finalized, this draft can be promoted to a **Final Implementation Requirements** document and fed into CAP/PCC + RED for a last verification pass before implementation.
