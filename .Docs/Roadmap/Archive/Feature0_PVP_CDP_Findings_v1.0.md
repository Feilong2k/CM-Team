# Feature 0 — PVP + CDP Level 3 Findings v1.0

This file summarizes what the protocols found when run against:
- `.Docs/Roadmap/Feature0_Implementation_Requirements_v1.0.md`

Protocol reports:
- PVP: `.Docs/Roadmap/PVP_Feature0_MVP_HomeShell_v1.0.md`
- CDP L3: `.Docs/Roadmap/CDP_Level3_Feature0_MVP_HomeShell_v1.0.md`

---

## 1) Overall verdict
- **PVP:** Conditionally complete (UI behaviors covered; some decisions missing)
- **CDP Level 3:** Conditionally safe (low risk, but a few ambiguities/security items)

This means Feature 0 is implementable, but a few decisions should be locked in to avoid wasted iterations.

---

## 2) Key missing / ambiguous items

### A) Collapse precedence rule (needs an explicit decision)
**Problem:** “Auto-collapsed unless in progress” conflicts with “user manually expands/collapses”.

**Recommendation (CDP):** Use **user override wins**.
- Default state is derived from status.
- After user toggles, that section stays in user-chosen state until refresh.

**Why it matters:** Without this, tests and UX will fight each other (status changes can collapse content unexpectedly).

---

### B) Markdown sanitization policy (security decision)
**Problem:** Markdown rendering to HTML is an XSS surface, even if content is “AI-generated”.

**Recommendation (CDP):** For MVP, **disallow raw HTML** in markdown (preferred) OR sanitize output.

**Why it matters:** Prevents future security surprises when content sources expand.

---

### C) Textarea “max 3 lines” implementation strategy
**Problem:** JSDOM unit tests can’t reliably verify pixel heights.

**Recommendation (PVP/CDP):** Use a **rows-based clamp** or a deterministic “line count” clamp so tests can assert behavior without pixel measurements.

---

### D) Project selector data source (Feature 0 only)
**Problem:** Feature 0 is pre-DB, but the SSOT doesn’t explicitly define the static projects list and default selection rule.

**Recommendation (PVP):** Define:
- `projects = [{ id: 'P-000', name: 'Default Project', description: '...' }]`
- default active project = first item

---

## 3) Non-missing but high-value improvement
### Shared MessageInput component
**Why:** chat input and modal input share identical rules. A shared component reduces bug duplication.

---

## 4) Proposed SSOT patch list (optional)
If you want, I can update `Feature0_Implementation_Requirements_v1.0.md` with a new section:
- “Decisions locked for Feature 0”
  - collapse precedence
  - markdown sanitization
  - textarea cap strategy
  - default in-memory project list

---

## 5) Resulting confidence
With those decisions locked in, Feature 0 becomes:
- **High confidence** to implement cleanly in 1–2 iterations,
- with low risk of rework from ambiguous behavior.
