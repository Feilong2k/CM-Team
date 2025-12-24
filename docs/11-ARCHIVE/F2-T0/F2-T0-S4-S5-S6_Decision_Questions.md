# F2-T0 Decision Questions for Subtasks S4, S5, S6

## Purpose
This document collects open questions from PCC/CAP/RED analysis for Feature 2 Task 0 subtasks S4, S5, and S6. The goal is to gather user input and lock decisions before implementation begins in later tasks.

---

## **F2-T0-S4: Define Prompt Templates & Context Policies**

### 1. Prompt Templates
**Question 1.1:** What structure should the chat prompt templates follow?
- **Options:**
  - A: System prompt + User message + Context block
  - B: Multi-turn conversation format with history
  - C: Single message with embedded context
  - D: Other (please specify)

NOTE: I think it should be A, but either system prompt or context block should have a history of chat messages, maybe past 20 messagse. Does this make sense?


**Question 1.2:** What examples are needed for LLM context?
- Should we include:
  - System prompt examples for different intents (chat, planning, analysis)?
  - Example user messages with expected Orion responses?
  - Template variables (e.g., `{{context}}`, `{{user_message}}`)?
NOTE: I don't think we need to strucutre Orion's response, what I was thinking is that we have a toggle like Cline Plan/Act, in planning mode, LLM would only have access to read tools so it can do research and answer questions and chat. In act mode, he has access to all the tools and has the ability to direct other agents to perform work.


**Question 1.3:** Should there be different templates for different intents?
- **Options:**
  - A: Single template for all chat interactions
  - B: Separate templates for: chat vs. "Plan This" vs. code analysis
  - C: Template selection based on message content/type
Note: I think we will just stick with single tempalte now


### 2. Context Policies
**Question 2.1:** Which folders should be included/excluded by default?
- Default inclusions: `src/`, `backend/`, `frontend/`, `.Docs/`?
- Default exclusions: `node_modules/`, `.git/`, `dist/`, `build/`, `*.log`?
- Should `.gitignore` filtering be enabled by default? (We already implemented this, but need to lock the decision)
NOTE: default exlusion is good and we should enable .gitignore


**Question 2.2:** Should users be able to configure included folders per project?
- **Options:**
  - A: Yes, via configuration file (e.g., `.orioncontext`)
  - B: Yes, via UI settings
  - C: No, fixed defaults only
  - D: Not for MVP, but design for future extensibility
NOTE: No, fiexed defaults only

**Question 2.3:** What is the maximum context size (tokens/characters) for LLM API calls?
- **Considerations:**
  - DeepSeek API limits (e.g., 32K tokens)
  - Performance vs. completeness trade-off
  - Should we implement automatic truncation?
NOTE: Let's do API limits, but how much is actually 32K tokens?

**Question 2.4:** How should context scope be enforced?
- **Options:**
  - A: Hard-coded directory whitelist
  - B: Configurable via environment variables
  - C: Dynamic based on project type detection
---
NOTE: not sure what this means.



## **F2-T0-S5: Design UI/UX for Context & Error Display**

### 1. Context Display
**Question 1.1:** How should context artifacts (files, snippets) be displayed in the Chat UI?
- **Options:**
  - A: Inline within the chat message (collapsible section)
  - B: Side panel/collapsible section
  - C: Tooltip/hover preview
  - D: Separate "Context" tab
  - E: Not shown to user (only used internally)
NOTE: I am leaning towards B: side panel/collapisble section, with the ability to edit like what I am doing now. Let me know your thoughts.

**Question 1.2:** Should context be shown automatically or only on demand?
- **Options:**
  - A: Automatically for all messages with context
  - B: Only when user clicks "Show context" button
  - C: Only for "Plan This" messages
  - D: Configurable user preference
  NOTE: maybe with a button? I am not 100% sure, what do you recommend?

**Question 1.3:** What level of context detail should be shown?
- **Options:**
  - A: Just file names
  - B: File names + line counts
  - C: Relevant snippets (matching search)
  - D: Full file content (truncated)
Note: file name + relevant snippets? Is this something we need to implement now? it seems a bit much. but we do need someway for the user and LLM to interact outside of the chat, especially during planning phase or locking down decisions.


### 2. Error Display
**Question 2.1:** How should errors (LLM API failures, context gathering failures) be displayed?
- **Options:**
  - A: Red error message in chat
  - B: Toast notification
  - C: Dedicated error panel
  - D: Combination of above
NOTE: red error message in chat is fine

**Question 2.2:** What level of detail should error messages show to users?
- **Options:**
  - A: Simple user-friendly message (e.g., "Service unavailable")
  - B: Technical details (error codes, stack traces)
  - C: User-friendly with "Show details" expandable section
  - D: Different levels based on user role (admin vs. regular)
NOTE: Option A is good for now, but retry should be allowed, say LLM timeout 3 times show a button or link for retries

**Question 2.3:** Should errors be logged separately for debugging?
- **Options:**
  - A: Yes, to server logs only
  - B: Yes, to database for later analysis
  - C: Yes, with user-accessible error history
  - D: No, transient only

NOTE: to database for later anlaysis Option B

---

## **F2-T0-S6: Establish Operational Policies**

### 1. Concurrency & Sessions
**Question 1.1:** How should concurrent chat sessions be handled?
- **Options:**
  - A: Global chat history (single session for all users)
  - B: Per-user sessions (separate history per user)
  - C: Per-project sessions (separate history per project)
  - D: Ephemeral sessions (no persistence)
NOTE: right single seesion for all users

**Question 1.2:** Should chat history persist across app restarts?
- **Options:**
  - A: Yes, always persist to database
  - B: Yes, but with configurable retention period
  - C: No, ephemeral only (in-memory)
  - D: Configurable per project/user
NOTE: Opetion A, maybe pull in last 3 messages? if user scrolls up, then more messages are pulled. maybe a feature for the future, not something right now


**Question 1.3:** How should session timeouts be handled?
- **Options:**
  - A: No timeout (sessions persist indefinitely)
  - B: Automatic timeout after inactivity (e.g., 24 hours)
  - C: Manual session management (user can clear/start new)
  NOTE: No timeout for now, we don't even have a login.

### 2. Rollback Strategies
**Question 2.1:** What rollback mechanisms are needed for failed LLM API calls?
- **Options:**
  - A: Automatic retry with exponential backoff
  - B: User notification with "Retry" button
  - C: Fallback to cached response (if available)
  - D: Graceful degradation (simplified response)
  NOTE: use A, and after 3 retires put up a user notification with Retry button

**Question 2.2:** What rollback for failed database operations?
- **Options:**
  - A: Transaction rollback (already implemented)
  - B: Compensating transactions
  - C: Manual intervention required
  - D: Queue for later retry
  NOTE: Stick with A

**Question 2.3:** What rollback for failed file system operations?
- **Options:**
  - A: No rollback (read-only operations)
  - B: Operation cancellation with cleanup
  - C: Manual cleanup required
  - D: Not applicable (ContextBuilder is read-only)
    NOTE: right now no rollback necessary, but in the future, option B

### 3. Operational Ownership
**Question 3.1:** Who approves prompt template changes?
- **Options:**
  - A: Project maintainers only
  - B: Any team member with review
  - C: Automated validation only
  - D: No approval required (self-service)
  Note: Option A, but all these are not for MVP, which doesn't have any login

**Question 3.2:** Who manages context policy configurations?
- **Options:**
  - A: System administrators
  - B: Project owners
  - C: All users (self-configure)
  - D: Fixed system defaults only
NOTE: same as above

**Question 3.3:** What are the escalation paths for failures?
- **Options:**
  - A: Log monitoring with alerts
  - B: User-reported issues
  - C: Automated health checks
  - D: Combination of above
    NOTE: option D

---

## **Next Steps**
1. User provides answers/comments on each question
2. Decisions are locked and documented in respective subtask instructions
3. Implementation proceeds in F2-T1, F2-T2, etc. based on locked decisions

---
*Document created for F2-T0 decision gathering on 2025-12-19*
