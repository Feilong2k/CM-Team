# PVP — Feature 0 (MVP Home Shell) v1.0

Source SSOT:
- `.Docs/Roadmap/Feature0_Implementation_Requirements_v1.0.md`

Scope under review:
- Split-screen UI shell (left chat, right workflow tree)
- Terminal-like presentation
- Markdown rendering for AI messages
- Input behavior (Enter vs Shift+Enter; max 3 lines)
- Subtask modal with tabs + bottom input
- **No DB required yet** (static/in-memory data allowed)

---

## 1) LIST ACTIONS (what needs to happen)
1. Render a 2-column split-screen layout: chat left, workflow right.
2. Ensure both panels are scrollable internally (avoid full-page scroll).
3. Render chat transcript with:
   - user and AI rows
   - no bubbles/avatars/timestamps
4. Render AI messages with markdown.
5. Implement chat input:
   - Enter = send
   - Shift+Enter = newline
   - auto-expand to max 3 lines
6. Render workflow right panel header with:
   - heading
   - project selector
   - project id + description
7. Render collapsible tree: Feature → Task → Subtask
   - show IDs (F-000, 0-1, 0-1-1) before titles
   - auto-collapse unless “in progress”
8. Add status dropdowns per row and update in-memory state.
9. Open a subtask modal on subtask click.
10. Render modal tabs (Basic Info, Instructions, Activity Log, CDP Analysis, Test, Implementations, Reviews).
11. Provide a modal message input with same keyboard behavior as chat.
12. Provide stable selectors (`data-testid`) for structure/behavior tests.

---

## 2) FIND RESOURCES (what enables each action)
Frontend resources:
- Vue 3 app scaffold (already present)
- Tailwind + global CSS for dark theme
- Vue Router (optional for Feature 0; not required in SSOT but may be used)
- Pinia (optional for Feature 0; not required yet)
- Markdown renderer library: `marked` or `markdown-it`
- Testing tools: Vitest + @vue/test-utils

Backend resources:
- Not required for Feature 0 MVP UI shell.

---

## 3) IDENTIFY GAPS (what’s missing / ambiguous)
### Gap A — Where does the project selector get its list?
- SSOT allows static data, but doesn’t specify:
  - list shape
  - default selection rule
  - whether selection affects anything in Feature 0
**Recommendation:** Define an in-memory `projects` array and a default active project selection (first item).

### Gap B — Status dropdown values vs roadmap status enums
- Feature 0 uses a simplified list (pending/in progress/done).
- Roadmap later has richer statuses (draft|active|done, etc.).
**Recommendation:** Document mapping or keep Feature 0 as “UI-only demo statuses”.

### Gap C — Collapse/expand rules edge cases
- What happens when:
  - a feature is expanded but task is collapsed?
  - a user manually expands a collapsed section?
  - status changes from “in progress” to “done” while expanded?
**Recommendation:** Define priority:
1) user manual toggle overrides auto-collapse, OR
2) status always wins.

### Gap D — Markdown security / HTML sanitization
- Rendering markdown as HTML can introduce XSS risks if any untrusted content enters.
**Recommendation:** For MVP, use a markdown renderer with sanitization options or sanitize output; document this constraint.

### Gap E — Textarea auto-resize measurement in tests
- Unit tests in jsdom don’t perfectly compute heights.
**Recommendation:** Test behavior by asserting:
- textarea has a `rows` cap OR
- a `data-max-lines=3` logic clamp
and rely on manual verification for exact pixel height.

### Gap F — Modal focus / ESC handling
- SSOT mentions ESC close, but doesn’t define focus trap.
**Recommendation:** Clarify MVP: ESC close required; focus trap nice-to-have.

### Gap G — Component boundaries / naming
- SSOT references `ChatPanel.vue`, `WorkflowPanel.vue`, modal, but doesn’t define a reusable input component.
**Recommendation:** Create a shared `MessageInput.vue` to avoid duplicating Enter/Shift+Enter logic.

---

## 4) MAP DEPENDENCIES (what builds first)
1. App shell layout + stable selectors
2. Chat transcript (static messages)
3. Markdown rendering
4. Message input behavior
5. Workflow panel header
6. Collapsible tree + status dropdown behavior
7. Modal open/close + tabs
8. Modal message input reuse

---

## 5) CHECK INTEGRATION (how pieces connect)
- Chat input appends to transcript; transcript scroll behavior should remain correct.
- Status dropdown drives collapse rule; ensure state updates do not break toggles.
- Clicking subtask opens modal; modal uses selected subtask context.

Integration risks:
- Collapse state and status state fighting each other.
- Duplicate logic between chat input and modal input.

---

## 6) VALIDATE COMPLETENESS
**Conditionally complete** for Feature 0.
- All visible UI behaviors are identified.
- Main missing pieces are **decision clarifications** (collapse precedence) and **safety constraints** (markdown sanitization).

---

## 7) VERIFICATION TESTS (Option A: structure/behavior)
Recommended test coverage:
1. App renders chat + workflow containers.
2. Chat panel renders 1 user + 1 AI message row.
3. Markdown renders expected tags.
4. Enter sends; Shift+Enter inserts newline.
5. Workflow panel renders header + selector.
6. Tree renders IDs and hides children when not “in progress”.
7. Changing status to “in progress” expands.
8. Clicking subtask opens modal.
9. Tabs render and switch.
10. Modal input has same Enter/Shift+Enter behavior.
