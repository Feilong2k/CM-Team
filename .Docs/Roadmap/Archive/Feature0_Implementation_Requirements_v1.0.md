# Feature 0 — Implementation Requirements (SSOT pre-DB) v1.0

Owner: **Adam (Architect)**  
Scope: **Feature 0 — “MVP Home Shell” (Split-screen + Project dropdown + Terminal-like panels)**  
Source: `.Docs/Roadmap/CM-TEAM_Roadmap_FeatureBased_v1.1.md`

> This document is the **Single Source of Truth** until DB-backed task tracking exists.

---

## 0) Feature Definition

### Outcome
A dark-themed, split-screen UI:
- **Left panel:** Chat (terminal style), minimal spacing, markdown rendering, no avatars/bubbles/timestamps.
- **Right panel:** Console-like workflow view showing Project header + Features/Tasks/Subtasks tree.
- **Neon blue accent** applied consistently to headings, project selector, AI text, and “Send” button label.

### Non-goals (Feature 0)
- No real AI integration required.
- No real features/tasks/subtasks fetched from DB required.
- Status dropdown changes can be in-memory only.
- Modal contents can be placeholder text as long as layout/tabs/input exist.

### UI Design Rules (must-follow)
- Theme: dark background; accent color is **light neon blue**.
- No message bubbles. Messages are plain rows.
- **User messages**: grey background.
- **AI messages**: neon-blue text.
- Markdown: AI responses render markdown correctly.
- Chat input:
  - Enter = send
  - Shift+Enter = newline
  - Expands up to **3 lines** maximum

---

## 1) Delivery Method: TDD Required
For every subtask below:
- **Tara must write failing tests first (Red)**
- **Devon implements to pass tests (Green)**
- **Devon may refactor while tests remain green (Refactor)**

This doc reflects that ordering by listing **Tara instructions first** inside each subtask.

---

## 2) Task Breakdown (nomenclature)
**Naming rules:**
- Task IDs: `0-1`, `0-2`, … meaning **Feature 0, Task N**
- Subtask IDs: `0-1-1`, `0-1-2`, … meaning **Feature 0, Task N, Subtask M**

---

## Task 0-1 — Global Layout + Styling Tokens
Purpose: Establish the two-column layout and shared theme tokens.

### Subtask 0-1-1 — Split-screen layout scaffold
**Overview:** Create a full-height two-column app shell.

**Tara (Tests first):**
- Frontend component test (Vitest + @vue/test-utils):
  1. Mount App.
  2. Assert there are exactly **two primary panel containers**.
  3. Assert panels exist with stable selectors (require `data-testid="chat-panel"` and `data-testid="workflow-panel"`).

**Devon (Implementation after tests):**
- Create a top-level layout in `frontend/src/App.vue` (or an `AppShell` component) that:
  1. Uses CSS Grid or Flex with **two equal columns**.
  2. Fills viewport height.
  3. Prevents whole-page scrolling; allow internal panels to scroll.
- Place placeholders for `ChatPanel` (left) and `WorkflowPanel` (right) containers matching the test selectors.

**Acceptance criteria:**
- App renders two equal-width panels on desktop.
- Both panels remain visible without overlap.

---

### Subtask 0-1-2 — Theme tokens and neon-blue styling
**Overview:** Validate and refine consistent theme application across all UI elements.

**Note:** Due to the implementation of Subtask 0-1-1, theme styling has been partially implemented. This subtask focuses on validation, refinement, and ensuring completeness.

**Tara (Tests first):**
- Create structure tests that verify neon-blue styling is applied to required elements:
  1. Verify headings have appropriate CSS class or data attribute indicating theme application
  2. Verify project selector text has neon-blue styling
  3. Verify AI message text has neon-blue styling  
  4. Verify Send button text has neon-blue styling
  5. Verify user messages have grey background class

**Testing Approach (Option A - structure only):**
- DO NOT test exact color values or pixel measurements
- DO test for presence of appropriate CSS classes or data attributes
- Example: Check that elements have class containing "neon-blue" or similar theme indicator

**Devon (Implementation after tests):**
- Ensure consistent theme application across all UI elements:
  1. Refine any missing theme applications from 0-1-1 implementation
  2. Extract theme colors to Tailwind configuration if not already done
  3. Verify all four required elements have neon-blue styling:
     - Main headings
     - Project selector text
     - AI message text
     - Send button text
  4. Ensure user messages have consistent grey background
  5. Define theme variables in `frontend/src/style.css` or Tailwind config for maintainability:
     - Background: near-black
     - Panel backgrounds: slightly lighter dark
     - Accent: neon blue (#00f3ff)
     - User message background: grey
  6. Change the all the font to equal those of F-000 Feature Title. set that to be the default font fo rthis web app. 
  7. Message box and Send button is still not on the same plane. This should be it's own component for reuse in subtask Modal. Make the boarder for Message box to be light blue as well

**Acceptance criteria:**
- All four specified element types (headings, project selector, AI text, Send button) have neon-blue styling
- User messages have consistent grey background
- Theme colors are defined in a maintainable location (CSS variables or Tailwind config)
- No visual regressions from 0-1-1 layout (manual verification acceptable for MVP)

---

## Task 0-2 — Left Panel (Chat Terminal UI)
Purpose: Deliver the chat panel visuals and input behaviors.

### Subtask 0-2-1 — Chat message list rendering (no bubbles)
**Overview:** Render messages as simple rows; user messages have grey background.

**Tara (Tests first):**
1. Mount `ChatPanel`.
2. Assert (structure, not visuals):
   - a user message row exists (recommend `data-testid="chat-msg-user"`)
   - an AI message row exists (recommend `data-testid="chat-msg-ai"`)
   - no avatar/icon elements are present
   - no timestamp text nodes are present

**Devon (Implementation after tests):**
- Create `ChatPanel.vue`:
  1. A scrollable message list.
  2. Render a local array of messages (static for Feature 0), including at least:
     - 1 user message
     - 1 AI message
  3. Tag user/AI rows with stable selectors for testing (`data-testid` or `data-role`).
  4. Apply styling per UI rules (manual verification acceptable for MVP).
  5. No icons, no timestamps, no bubbles.

**Acceptance criteria:**
- Messages render as simple rows (no bubbles/icons/timestamps) and follow styling rules (manual verification acceptable).

---

### Subtask 0-2-2 — Markdown rendering for AI messages
**Overview:** AI messages render markdown correctly.

**Tara (Tests first):**
1. Provide an AI message string containing markdown.
2. Mount `ChatPanel` (or the message renderer component).
3. Assert rendered output contains expected HTML (e.g., `<h1>`, `<pre><code>`, `<ul>`).

**Devon (Implementation after tests):**
- Use a markdown renderer (e.g., `marked` or `markdown-it`).
- Render AI message content as HTML within a safe container.
- Ensure basic markdown works:
  - headings
  - code blocks
  - lists

**Acceptance criteria:**
- Markdown is displayed correctly in the chat transcript.

---

### Subtask 0-2-3 — Chat input behavior (Enter vs Shift+Enter, max 3 lines)
**Overview:** Text entry supports multiline with Shift+Enter and expands to max 3 lines.

**Tara (Tests first):**
1. Simulate typing in textarea.
2. Simulate keydown:
   - Enter → triggers send handler (message appended)
   - Shift+Enter → inserts newline and does NOT send
3. Verify textarea height does not exceed 3 lines.

**Devon (Implementation after tests):**
- Implement a `<textarea>` input:
  1. On `keydown`:
     - Enter without Shift triggers send
     - Shift+Enter inserts newline
  2. Auto-resize up to 3 lines (cap height).
- Add a Send button:
  - Text “Send” in neon blue.

**Acceptance criteria:**
- Enter sends; Shift+Enter adds newline.
- Input grows but caps at 3 lines.

---

## Task 0-3 — Right Panel (Workflow Console Tree)
Purpose: Provide the terminal-like project header + collapsible hierarchy view.

### Subtask 0-3-1 — Project header + selector placement
**Overview:** Right panel contains a heading, then project selector top-left, plus project id/description.

**Tara (Tests first):**
1. Mount `WorkflowPanel`.
2. Assert (structure, not visuals):
   - dropdown exists (recommend `data-testid="project-selector"`)
   - heading exists
   - project id and description text nodes exist

**Devon (Implementation after tests):**
- Create `WorkflowPanel.vue`:
  1. Heading (styling verified manually for MVP).
  2. Project selector at top-left of this panel (not in chat).
  3. Below heading: show project id and small description (static data for Feature 0).

**Acceptance criteria:**
- The selector is on the right panel and visually conforms to the design.

---

### Subtask 0-3-2 — Collapsible tree for Features → Tasks → Subtasks with IDs
**Overview:** Display features, tasks, and subtasks; show IDs as `F-000`, `0-1`, `0-1-1` before titles.

**Tara (Tests first):**
1. Assert ID prefixes are rendered in the correct positions.
2. Assert collapsed-by-default behavior:
   - when status != in progress, children are hidden
   - when status == in progress, children are visible

**Devon (Implementation after tests):**
- Render a static hierarchy object for Feature 0:
  1. 1 project
  2. 2 features
  3. each feature has tasks and each task has subtasks
- Display each row like:
  - `F-000 Feature Title`
  - `0-1 Task Title`
  - `0-1-1 Subtask Title`
- Implement collapsible sections:
  - Project section collapsible.
  - Feature section collapsible.
  - Auto-collapsed unless status is “in progress”.

**Acceptance criteria:**
- Tree renders with correct IDs and collapsible behavior.

---

### Subtask 0-3-3 — Status dropdown per item (feature/task/subtask)
**Overview:** Each row has a status dropdown on the right that can change status.

**Tara (Tests first):**
1. Change dropdown value in test.
2. Assert:
   - state updates
   - auto-collapse rule responds accordingly (switching to in progress expands)

**Devon (Implementation after tests):**
- Add a status dropdown aligned right for each feature/task/subtask.
- Status values (MVP):
  - pending
  - in progress
  - done
- Changing status updates in-memory state (no persistence required for Feature 0).

**Acceptance criteria:**
- Status changes reflect in UI and collapse behavior updates.

---

## Task 0-4 — Subtask Modal (Tabs + Message Entry)
Purpose: Clicking a subtask opens a modal with tabbed content and a message input.

### Subtask 0-4-1 — Modal open/close on subtask click
**Overview:** Clicking a subtask row opens a modal.

**Tara (Tests first):**
1. Simulate clicking a subtask row.
2. Assert modal appears.
3. Simulate close → modal disappears.

**Devon (Implementation after tests):**
- Clicking a subtask emits event to open modal.
- Modal overlays the screen.
- Provide close button and ESC close.

**Acceptance criteria:**
- Modal reliably opens and closes.

---

### Subtask 0-4-2 — Modal tabs layout (placeholders acceptable)
**Overview:** Modal contains tabs: Basic Info, Instructions, Activity Log, CDP Analysis, Test, Implementations, Reviews.

**Tara (Tests first):**
1. Assert all tab labels exist.
2. Click each tab and assert active tab changes.

**Devon (Implementation after tests):**
- Implement a tab bar with these labels.
- Default tab: Basic Info.
- Switching tabs changes visible content area (placeholder text ok).

**Acceptance criteria:**
- Tabs render and switch content.

---

### Subtask 0-4-3 — Modal message entry (same rules as chat)
**Overview:** Bottom of modal contains a message entry matching chat input behavior.

**Tara (Tests first):**
1. Repeat chat input tests:
   - Enter sends
   - Shift+Enter inserts newline
   - max 3 lines

**Devon (Implementation after tests):**
- Reuse the chat input component or share logic.
- Same behavior: Enter sends, Shift+Enter newline, max 3 lines.

**Acceptance criteria:**
- Modal input behaves identically to chat input.

---

## 3) Cross-cutting Requirements

### Testing scope (Option A)
- Tests should validate **structure and behavior**, not visuals.
- Avoid assertions on:
  - exact colors
  - CSS class names that may change during styling iterations
  - pixel measurements / panel widths

### Accessibility / UX
- Modal should trap focus (nice-to-have for MVP; at least ensure close is easy).
- Ensure text contrast is readable in dark theme.

### Naming / Selectors
Add `data-testid` attributes to:
- chat panel
- workflow panel
- project selector
- send button
- subtask row
- modal
- modal tabs

### Recommended Status Values (Feature 0 only)
- pending
- in progress
- done

---

## 4) Definition of Done (Feature 0)
- Split-screen UI renders consistently.
- **Manual visual check**: neon blue styling matches requirements.
- Chat panel renders messages and markdown.
- Chat input behavior correct (Enter vs Shift+Enter; max 3 lines).
- Workflow panel renders tree with collapsible behavior and IDs.
- Status dropdown works and affects collapse behavior.
- Clicking a subtask opens modal with tabs and message entry.

---

## 5) Open Decisions (do NOT block Feature 0)
- Exact neon blue hex code: can be finalized later, but must be visually “light neon blue”.

## 6) Decisions Locked for Feature 0 (from PVP/CDP findings)
These decisions are now part of the SSOT to ensure consistent implementation and testing.

### 6.1 Collapse precedence rule
- **Rule:** User manual toggle overrides auto-collapse.
- **Default:** Sections are auto-collapsed unless status = “in progress”.
- **Once toggled:** The section stays in the user-chosen state (expanded/collapsed) until the page is refreshed.

### 6.2 Markdown sanitization policy
- **Rule:** Disallow raw HTML in markdown rendering.
- **Implementation:** Use a markdown renderer that strips HTML tags or escapes them (e.g., `marked` with `sanitize: true`).
- **Rationale:** Prevents XSS even if AI content later includes untrusted input.

### 6.3 Textarea “max 3 lines” implementation strategy
- **Rule:** Use a **rows-based clamp** (e.g., `rows="1"` with dynamic `maxRows=3`) rather than pixel‑height detection.
- **Testing:** Tests can assert that the `rows` attribute never exceeds 3, or that a `data-max-lines` attribute is respected.

### 6.4 Project selector data source (pre‑DB)
- **Static list for Feature 0:**
  ```javascript
  const projects = [
    { id: 'P-000', name: 'Default Project', description: 'Initial project for MVP' }
  ];
  ```
- **Default selection:** First project in the list.
