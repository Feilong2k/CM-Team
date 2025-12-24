# AI Tool Design: MVP Best Practices (90%+ Success Rate)

This guide distills our tool design philosophy into actionable rules for the MVP phase. Follow these practices to ensure reliability, safety, and high agent success rates.

---

## 1. Golden Rules for Tool Design

1.  **Single Object Argument**: Every tool function MUST accept exactly one argument: an object (`args`).
    *   ❌ `function(id, name, type)`
    *   ✅ `function({ id, name, type })`
2.  **No Implicit Context**: Never assume the AI knows the "current" project or user. Pass IDs explicitly in the `args` object (or inject them via the Adapter layer).
3.  **Fail Loudly**: If a tool fails, throw a clear Error with a message the AI can understand and act upon.
    *   ❌ `return false`
    *   ✅ `throw new Error("Task ID '123' not found. Please verify the ID using list_tasks.")`
4.  **Idempotency**: Whenever possible, make tools safe to retry.
    *   `create_user` should handle "user already exists" gracefully (e.g., return existing user or a specific error).

---

## 2. The "Thin Adapter" Architecture

Use the **Adapter Pattern** to keep your core logic clean while providing an AI-friendly interface.

**Layer 1: Core Logic (Backend)**
*   Standard JavaScript/TypeScript functions.
*   Can use positional arguments if internal conventions prefer it.
*   Focus on business logic and DB interactions.

**Layer 2: AI Adapter (The Bridge)**
*   **Input**: Receives the raw tool call from the agent ( `{ params, context }` ).
*   **Validation**: Checks types, required fields, and enums.
*   **Translation**: Maps the object params to the Core Logic function calls.
*   **Context Injection**: Injects `context.projectId` or `context.userId` if missing from params.
*   **Output**: formats the result into a clean JSON response.

---

## 3. High-Reliability Patterns

### A. The "Discovery First" Pattern
Don't make the AI guess IDs or names. Provide tools to list/search *before* acting.
*   **Pattern**: `list_X` -> `get_X` -> `update_X`
*   **Why**: 90% of AI errors come from hallucinating identifiers.

### B. Enum Enforcement
Use restricted string literals (Enums) instead of free text for status, types, or categories.
*   **Schema**: `status: { type: "string", enum: ["pending", "active", "completed"] }`
*   **Why**: Prevents typos and invalid state transitions.

### C. The "Dry Run" Flag
For destructive operations (delete, bulk update), add a `dryRun` boolean parameter.
*   **Default**: `false` (or `true` for very high risk).
*   **Why**: Allows the agent to verify the impact before committing.

---

## 4. Handling Complexity: The Questionnaire Approach

For operations that are too complex for a single tool call (e.g., "Generate a SQL report"), use a **Questionnaire**.

**When to use:**
*   More than 5-6 parameters.
*   Complex conditional logic (if X is true, then Y is required).
*   High risk of data loss.

**MVP Implementation:**
1.  **Orion** recognizes a complex task.
2.  **Orion** invokes a specific "Questionnaire Tool" (e.g., `start_sql_generation`).
3.  The tool returns the *first question* to the agent/user.
4.  The agent replies with the answer.
5.  This loop continues until the tool has all necessary data to construct the final command safely.

---

## 5. Testing & Verification

To achieve 90%+ success:

1.  **Happy Path**: Verify the tool works with perfect inputs.
2.  **Missing Optional Args**: Verify defaults are applied correctly.
3.  **Invalid Inputs**: Verify the tool returns helpful error messages (not just "Error").
    *   *Good Error:* "Field 'status' must be one of ['open', 'closed']."
    *   *Bad Error:* "Invalid input."
4.  **Context Isolation**: Ensure actions are scoped to the correct `projectId`.

---

**Summary Checklist for New Tools:**
*   [ ] Accepts single object arg?
*   [ ] Adapter handles context injection?
*   [ ] Inputs validated (Zod/Joi or manual)?
*   [ ] "Discovery" tools exist?
*   [ ] Error messages are instructional?
