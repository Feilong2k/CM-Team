# CDP Level 3 — Feature 0 (MVP Home Shell) v1.0

Source SSOT:
- `.Docs/Roadmap/Feature0_Implementation_Requirements_v1.0.md`

---

## PART 1: RESOURCE ANALYSIS
| Resource | Current State | Who Uses It | Exclusive/Shared |
|---|---|---|---|
| Browser UI | User opens app | User | per-user |
| Frontend Vue runtime | Present | UI | shared |
| Tailwind/CSS theme | Present | UI | shared |
| Markdown renderer | Not yet chosen | Chat UI | shared |
| In-memory state | Required | UI | per-session |
| LocalStorage | Available | Persist selection optional | per-browser |
| Modal overlay | UI component | UI | shared |
| Test runner (Vitest) | Expected | Tara | shared |

**Notes:** Feature 0 is frontend-only; backend/DB are not required yet.

---

## PART 2: OPERATION ANALYSIS
| Operation | Physical Change? | Locks? | Concurrency Risk |
|---|---:|---|---|
| Render split layout | No | N/A | Low |
| Update in-memory tree status | No | N/A | Low |
| Toggle collapse state | No | N/A | Low |
| Append chat message | No | N/A | Low |
| Persist active project in localStorage (optional) | Yes (browser storage) | N/A | Low |
| Render markdown to HTML | No (but security risk) | N/A | Medium (XSS surface) |
| Open/close modal | No | N/A | Low |

---

## PART 3: ACTOR ANALYSIS
| Actor | Resources Touched | Notes |
|---|---|---|
| User | UI | Clicks, selects, types |
| Tara | tests | Writes failing tests |
| Devon | frontend code | Implements components |

---

## PART 4: ASSUMPTION AUDIT (>=10)
| # | Assumption | Explicit/Implicit | Breaks if FALSE | Risk |
|---:|---|---|---|---|
| 1 | Split panels are desktop-first | Implicit | mobile layout unclear | Low (MVP) |
| 2 | JSDOM tests are sufficient | Implicit | may not reflect browser rendering | Medium |
| 3 | Markdown renderer is safe | Implicit | XSS possible | Medium/High |
| 4 | Auto-resize can be tested reliably | Implicit | brittle tests | Medium |
| 5 | Collapse logic is deterministic | Implicit | UX confusing | Medium |
| 6 | Status changes drive expansion | Explicit | tree state inconsistencies | Medium |
| 7 | Manual toggle vs auto-collapse precedence is defined | Currently missing | inconsistent behavior | Medium |
| 8 | Subtask modal always has selected subtask context | Implicit | null selection crashes | Medium |
| 9 | Reusing message input avoids duplicate bugs | Recommended | divergence between inputs | Low/Medium |
|10 | Data-testid selectors remain stable | Explicit | tests become brittle | Medium |
|11 | Styling is verified manually for MVP | Explicit | visual regressions possible | Low (acceptable) |
|12 | No backend required for Feature 0 | Explicit | project selector list must be static | Low |

---

## PART 5: PHYSICAL VS LOGICAL CHECK
| Claimed Separation | Mechanism | Physical/Logical | Failure Mode |
|---|---|---|---|
| Chat and Workflow are separate concerns | 2 panels | Logical | shared state might bleed if not separated |
| Modal is separate UI state | selectedSubtaskId | Logical | null/undefined selection causes errors |

---

## PART 6: FINAL VERDICT
**VERDICT: CONDITIONALLY SAFE**

Feature 0 is low-risk technically, but CDP flags a few important *clarity and safety* issues:

### Critical/Important Findings
1. **Markdown sanitization** needs an explicit decision (renderer + sanitize policy). Even if content is “AI only”, it is still untrusted.
2. **Collapse precedence** (auto-collapse vs user toggles) is not explicitly specified; this will cause ambiguous behavior and brittle tests.
3. **Textarea auto-resize testing** can be unreliable in JSDOM. Prefer testing behavior rules rather than pixel heights.

### Recommended mitigations (add to SSOT)
- Add a short “Decisions” section specifying:
  - collapse precedence rule
  - markdown renderer + sanitization approach
  - textarea resize strategy (rows-based or height clamp)

---

## PART 7: GAP ANALYSIS
| Gap | Options | Recommendation |
|---|---|---|
| Collapse precedence | A) status wins always; B) user toggle overrides; C) hybrid | Pick B (user override) for UX; keep status as default only |
| Markdown sanitization | A) sanitize HTML; B) disallow raw HTML | Prefer B (disable raw HTML) for MVP |
| Textarea 3-line cap | A) rows-based; B) height-based | Prefer A (rows-based) for reliable tests |
