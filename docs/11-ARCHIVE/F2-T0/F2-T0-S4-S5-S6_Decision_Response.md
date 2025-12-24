# Response to F2-T0 Decision Questions

## **F2-T0-S4: Define Prompt Templates & Context Policies**

### 1. Prompt Templates
**Question 1.1:** **Agreed on Option A** with chat history inclusion. 
- **Recommendation:** System prompt + Last 20 messages (or configurable limit) + Context block + Current user message
- **Rationale:** This gives Orion conversational context while keeping token usage manageable.

**Question 1.2:** **Planning vs Act Mode toggle approach is excellent.**
- **Recommendation:** 
  - **Planning Mode:** Orion can only read/analyze (list_files, search_files, read_file tools)
  - **Act Mode:** Orion can orchestrate (call Tara/Devon, update database, etc.)
- **Template variables:** `{{system_prompt}}`, `{{chat_history}}`, `{{context}}`, `{{user_message}}`, `{{mode}}`

**Question 1.3:** **Agreed on single template** for MVP.
- **Rationale:** Simpler implementation; mode toggle handles different capabilities.

### 2. Context Policies
**Question 2.1:** **Agreed on default exclusions with .gitignore enabled.**
- **Recommendation:** 
  - Default inclusions: `src/`, `backend/`, `frontend/`, `.Docs/`, `package.json`, `README.md`
  - Default exclusions: `node_modules/`, `.git/`, `dist/`, `build/`, `*.log`, `*.tmp`
  - `.gitignore` filtering: **Enabled by default**

**Question 2.2:** **Agreed on fixed defaults only (Option C).**
- **Rationale:** MVP simplicity; can add configuration later if needed.

**Question 2.3:** **32K tokens is approximately:**
- 24,000 English words
- 128,000 characters
- 50-100 typical source code files (depending on size)
- **Recommendation:** Implement automatic truncation when context exceeds 30K tokens (leave room for prompt + response).

**Question 2.4:** **Context scope enforcement** means how we ensure Orion only accesses allowed directories.
- **Recommendation:** Option A (Hard-coded directory whitelist) for MVP
- **Implementation:** ContextBuilder validates all file paths against whitelist before returning content
---

## **F2-T0-S5: Design UI/UX for Context & Error Display**

### 1. Context Display
**Question 1.1:** **Agreed on Option B (Side panel/collapsible section).**
- **Recommendation:** 
  - Right-side panel that can be toggled open/closed
  - Shows files/snippets used for current response
  - Editable (users can add/remove context manually)
  - File tree view for navigation

**Question 1.2:** **Recommendation: Hybrid approach**
- **Default:** Context panel shows automatically for "Plan This" messages
- **Option:** "Show context" button for regular chat messages
- **Rationale:** Balances discoverability with UI cleanliness

**Question 1.3:** **Recommendation: File names + relevant snippets (Option C)**
- **MVP Implementation:** 
  - Phase 1: Just file names (simple)
  - Phase 2: Add snippets for search results
- **Rationale:** Users need to see what Orion is "seeing" to trust responses, especially during planning.

### 2. Error Display
**Question 2.1:** **Agreed on Option A (Red error message in chat).**
- **Implementation:** Style error messages distinctly from regular chat.

**Question 2.2:** **Agreed on Option A with retry mechanism.**
- **Flow:** 
  1. Automatic retry ×2 (exponential backoff)
  2. Show user-friendly error with "Retry" button
  3. After 3 total failures, show "Contact support" option

**Question 2.3:** **Agreed on Option B (Database for later analysis).**
- **Implementation:** `error_logs` table with timestamp, error type, context, user_id (if available)

---

## **F2-T0-S6: Establish Operational Policies**

### 1. Concurrency & Sessions
**Question 1.1:** **Agreed on Option A (Global chat history).**
- **Rationale:** MVP simplicity; no user authentication yet.

**Question 1.2:** **Agreed on Option A (Always persist to database).**
- **Recommendation:** Initial load shows last 10 messages, infinite scroll for history
- **Pagination:** Load more messages as user scrolls up

**Question 1.3:** **Agreed on Option A (No timeout).**
- **Rationale:** No login system; sessions are effectively permanent.

### 2. Rollback Strategies
**Question 2.1:** **Agreed on A + B hybrid.**
- **Implementation:** 
  - Automatic retry ×2 (1s, 3s delays)
  - If still failing, show error with "Retry" button
  - Button triggers one more attempt

**Question 2.2:** **Agreed on Option A (Transaction rollback).**
- **Already implemented** in database layer.

**Question 2.3:** **Agreed on Option A (No rollback for read-only).**
- **Future:** Option B (Operation cancellation with cleanup) when we add write operations.

### 3. Operational Ownership
**Questions 3.1-3.3:** **All deferred post-MVP.**
- **MVP Approach:** Fixed defaults, no configuration UI
- **Logging:** All errors logged to database for manual review
- **Escalation:** Manual monitoring initially

---

## **Open Questions Needing Clarification**

1. **Token Counting:** Need to decide on token counting library (e.g., `gpt-tokenizer` for JavaScript): NOTE:use your recommendations
2. **Context Panel Implementation:** Should it be a Vue component separate from ChatPanel? NOTE: no panel for now, 
3. **History Limit:** Exact number of messages to include in context (20? 10? Configurable?) NOTE: use 20
4. **Error Logging Schema:** Need to design `error_logs` table structure NOTE: use the structure you proposed.

---

## **Next Actions**

1. **Update subtask instructions** in database with these locked decisions
2. **Create implementation tickets** for F2-T1 based on decisions
3. **Design database schema** for error logging
4. **Plan UI components** for context panel and error display

---
*Response generated on 2025-12-19 based on user feedback*
