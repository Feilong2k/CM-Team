# Decision Record: Prompt Templates, UI/UX, and Operational Policies for Feature 2 - Task 0 - Subtasks S4, S5, S6

## Context
During planning for Feature 2 (Orion Chat & Context), specifically Task 0 Subtasks S4, S5, and S6, we discussed and finalized decisions for:
- **F2-T0-S4:** Define Prompt Templates & Context Policies
- **F2-T0-S5:** Design UI/UX for Context & Error Display  
- **F2-T0-S6:** Establish Operational Policies

## Decisions

### **F2-T0-S4: Prompt Templates & Context Policies**

#### 1. Prompt Templates
- **Structure:** System prompt + Last 20 messages + Context block + Current user message
- **Mode Toggle:** Planning vs Act Mode approach
  - **Planning Mode:** Orion can only read/analyze (list_files, search_files, read_file tools)
  - **Act Mode:** Orion can orchestrate (call Tara/Devon, update database, etc.)
- **Template Variables:** `{{system_prompt}}`, `{{chat_history}}`, `{{context}}`, `{{user_message}}`, `{{mode}}`
- **Single Template:** One template for all interactions in MVP

#### 2. Context Policies
- **Default Inclusions:** `src/`, `backend/`, `frontend/`, `.Docs/`, `package.json`, `README.md`
- **Default Exclusions:** `node_modules/`, `.git/`, `dist/`, `build/`, `*.log`, `*.tmp`
- **.gitignore Filtering:** Enabled by default
- **Configuration:** Fixed defaults only (no per-project configuration for MVP)
- **Token Limit:** 32K tokens (DeepSeek API limit) with automatic truncation at 30K tokens
- **Scope Enforcement:** Hard-coded directory whitelist (ContextBuilder validates paths)

### **F2-T0-S5: UI/UX for Context & Error Display**

#### 1. Context Display
- **Panel Design:** Side panel/collapsible section (right side)
- **Display Logic:** 
  - Automatically shows for "Plan This" messages
  - "Show context" button for regular chat messages
- **Content Level:** File names only for MVP (snippets deferred to future)
- **Editability:** Not implemented in MVP (deferred)
- **File Tree:** Not implemented in MVP (deferred)

#### 2. Error Display
- **Error Messages:** Red error message in chat (distinct styling)
- **Error Detail:** Simple user-friendly messages (e.g., "Service unavailable")
- **Retry Mechanism:** 
  1. Automatic retry ×2 (exponential backoff)
  2. Show user-friendly error with "Retry" button
  3. After 3 total failures, show "Contact support" option
- **Error Logging:** To database (`error_logs` table) for later analysis

### **F2-T0-S6: Operational Policies**

#### 1. Concurrency & Sessions
- **Session Handling:** Global chat history (single session for all users)
- **Persistence:** Always persist to database
- **History Loading:** Initial load shows last 10 messages, infinite scroll for history
- **Timeout:** No timeout (sessions persist indefinitely)

#### 2. Rollback Strategies
- **LLM API Failures:** Automatic retry ×2 + user notification with "Retry" button
- **Database Operations:** Transaction rollback (already implemented)
- **File System Operations:** No rollback (read-only operations for MVP)

#### 3. Operational Ownership
- **All operational policies deferred post-MVP** (no login system in MVP)
- **MVP Approach:** Fixed defaults, no configuration UI
- **Logging:** All errors logged to database for manual review
- **Escalation:** Manual monitoring initially

## Technical Implementation Notes

### Token Counting
- Use recommended JavaScript token counting library (e.g., `gpt-tokenizer`)

### Context Panel
- No context panel implementation for MVP
- Placeholder UI may be created but non-functional

### Error Logging Schema
- `error_logs` table with: timestamp, error_type, context, user_id (nullable)

### History Limit
- 20 messages included in context (configurable in future)

## Rationale
- **MVP Focus:** Keep implementation simple and focused on core functionality
- **User Experience:** Provide basic visibility into Orion's context without over-engineering
- **Future Extensibility:** Design decisions allow for incremental enhancement
- **Technical Debt:** Defer complex features (editable context, file tree, configuration UI) to post-MVP

## Next Steps
1. Update subtask instructions in database with these locked decisions
2. Create implementation tickets for F2-T1 based on decisions
3. Design database schema for error logging
4. Plan UI components for future context panel implementation

## Instructions for Tara and Devon

### For Tara (Tester)
- **F2-T0-S4:** Test prompt template generation and context policy enforcement
- **F2-T0-S5:** Test error display and logging functionality
- **F2-T0-S6:** Test session persistence and rollback mechanisms

### For Devon (Implementer)
- **F2-T0-S4:** Implement prompt template system with mode toggle
- **F2-T0-S5:** Implement error handling and display system
- **F2-T0-S6:** Implement session management and operational policies

---
Document created by Adam (Architect) on 2025-12-19 based on finalized decisions.
