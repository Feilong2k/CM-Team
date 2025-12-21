# Designing Tools for AI: A Practical Guide

> **Core Philosophy:** Tools for AI should be designed as *interfaces for reasoning*, not just API endpoints. The best AI tools provide structure, context, and recoverability.

## 1. The Spectrum of Tool Complexity

AI tool performance degrades as complexity increases. Understanding where your tool fits is critical for design.

| Level | Type | Characteristics | Success Rate | Example |
|:---:|:---:|:---|:---:|:---|
| **1** | **Simple Functions** | Single purpose, no side effects, primitive args. | ~95% | `calculate_sum(a, b)` |
| **2** | **Domain Actions** | Named parameters, some validation, explicit context. | ~85% | `create_subtask({ id, title })` |
| **3** | **Workflows** | Multi-step state, complex dependencies, ordering matters. | ~70% | `deploy_app(config_object)` |
| **4** | **Expert Systems** | Deep domain knowledge, high risk, subtle edge cases. | ~50% | `optimize_database_schema()` |

**Goal:** Shift Level 3 & 4 operations down to Level 2 through smart design (Adapters, Questionnaires).

---

## 2. The "Thin Adapter" Pattern

**Problem:** LLMs struggle with:
*   Positional arguments (`func(a, b, c)`)
*   Implicit context (What is "current project"?)
*   Complex type coercion

**Solution:** Use an **Adapter Layer** to bridge the AI interface and the implementation.

### Before (Hard for AI)
```javascript
// Positional args are confusing; implicit 'true' is unclear
DatabaseTool.get_context(123, "P1", true, null);
```

### After (AI-Optimized)
```javascript
// Self-documenting, flexible object structure
DatabaseToolAdapter.get_context({
  subtask_id: "2-0-7",  // Explicit naming
  project_id: "P1",     // Optional (can default to current)
  include_logs: true    // Clarity > brevity
});
```

**Key Implementation Rules:**
1.  **Always use a single object argument** (`args`).
2.  **Validate inputs early** and return readable error messages.
3.  **Inject context** (like `projectId`) in the adapter, don't force the AI to guess it.
4.  **Normalize errors** into a standard format the AI can parse.

---

## 3. The Questionnaire Pattern (For Complex Ops)

**Problem:** For high-stakes or complex operations (like SQL generation or infrastructure changes), one-shot prompting is risky and error-prone.

**Solution:** Break the operation into a structured **Questionnaire**.

### Concept
Instead of: *"AI, migrate the database."* (High risk of hallucination/error)
Use: *"AI, fill out this migration questionnaire."*

### How it Works
1.  **Meta-Questionnaire:** Determine intent (e.g., "Schema Change" vs "Analytics Query").
2.  **Specialized Questionnaire:** A structured form with specific validation steps.
    *   *Step 1: Intent?* (Add column 'status')
    *   *Step 2: Type?* (VARCHAR(50))
    *   *Step 3: Constraints?* (NOT NULL, DEFAULT 'active')
    *   *Step 4: Rollback Plan?* (DROP COLUMN 'status')
3.  **Compilation:** A deterministic script compiles the approved answers into the final command (SQL).
4.  **Execution:** Run the command with safety gates (transactions, dry-runs).

### Benefits
*   **Safety:** Forces a "think before act" workflow.
*   **Audit Trail:** The completed questionnaire is a record of reasoning.
*   **Recoverability:** If Step 3 fails, you correct just Step 3, not the whole prompt.

---

## 4. The Self-Extension Loop (Orion as Tool Designer)

This is the path to self-improvement.

1.  **Gap Analysis:** Orion identifies a missing capability (e.g., "I need to analyze test coverage, but no tool exists").
2.  **Design:** Orion drafts a **Questionnaire** to capture the necessary inputs and logic for this new task.
3.  **Implementation:** Orion (via Devon/Tara) writes a parser script to translate questionnaire answers into executable actions (e.g., a specific SQL query pattern).
4.  **Registration:** The new tool is tested and added to the registry.

**Result:** The system evolves from *using* tools to *designing* tools that fit its specific needs.

---

## 5. Design Checklist for New Tools

*   [ ] **Object API:** Does the tool take a single structured object as input?
*   [ ] **Enums over Strings:** Are rigid options (e.g., `["low", "high"]`) used instead of free text?
*   [ ] **Idempotency:** Can this tool be safely retried if the network fails?
*   [ ] **Explicit Discovery:** Is there a separate step/tool to "list" options before "acting"?
*   [ ] **Examples:** Does the tool definition include 2-3 clear, realistic usage examples?
*   [ ] **Error Clarity:** Do error messages tell the AI *how* to fix the problem?

---

**Conclusion:**
Don't dumb down tools for AI. **Structure them.** Use adapters for consistency and questionnaires for complexity. This turns "prompt engineering" into reliable software engineering.
