# FRACTAL ANALYSIS PROTOCOL (Recursive CDP)

## Overview
Fractal Analysis (or Recursive CDP) is a "Deep Dive" technique used to uncover **Unknown Unknowns** in a system design. It works by recursively applying the Constraint Discovery Protocol (CDP) to increasingly granular layers of a problem until "Atomic Constraints" (Fundamental Tools or Knowledge) are reached.

## When to Use
*   **Phase:** Feature Definition (Implementation Requirements).
*   **Target:** Complex, novel, or high-risk components (e.g., "AI Autonomous Agent Loop").
*   **Trigger:** When a step relies on "Magic" or vague assumptions (e.g., "Orion finds the file").

## The Layers

0.  **Layer 0: Source of Truth Audit (Pre-Flight)** - *The Scope*
    *   "Does the proposed Solution match the existing Reality?"
    *   *Action:* **Explicitly name the Reference System(s)** (e.g., UI model, data fixtures, legacy DB, config files).
    *   *Action:* Compare **High-Level Objects** (Entities/Modules) against the Plan.
    *   *Action:* Compare **Detailed Attributes** (Fields/Props) against the Plan.

0.5. **Layer 0.5: Operationalization Audit (Execution Ownership)** - *The "Who/When/Where"*
    *   "Who uses each deliverable, when, and in which environment?"
    *   *Action:* For each deliverable/output (script, file, API, UI component), answer:
        - **Output:** what artifact is produced?
        - **Consumer:** who/what uses it (Orion / Tara / Devon / CI / operator)?
        - **When:** at what stage (dev setup / CI / deploy / runtime)?
        - **Where:** which environment (dev/test/prod)?
        - **Trigger:** manual vs CI vs startup hook?
        - **Safety:** how do we prevent wrong environment execution?
    *   *Action:* Document gaps in operational workflow as Missing Fundamentals.

## Safety Gates (The Circuit Breaker)
*   **Max Depth:** 5 Layers. If exceeded, stop and flag as "Architecture Smell".
*   **Max Fan-Out:** 10 Nodes per layer. If exceeded, stop and flag as "Scope Creep".
*   **Primitive Registry:** Consult `.Docs/Protocols/Primitive_Registry.md` to validate "Known Primitives".
1.  **Layer 1: System (Feature/Goal)** - *The "What"*
    *   Example: "Implement Context Gathering."
2.  **Layer 2: Operation (Task)** - *The "How"*
    *   Example: "Identify relevant files."
3.  **Layer 3: Mechanism (Step)** - *The Implementation*
    *   Example: "Search the file system."
4.  **Layer 4: Atomic Op (Micro-Step)** - *The Execution*
    *   Example: "Execute CLI command."
5.  **Layer 5+: Fundamental (The Root)** - *The Prerequisite*
    *   Example: "Does the tool exist? Is the syntax known?"

## The Protocol Loop (Recursive Queue Algorithm)

To perform a "Full FAP Analysis", follow this algorithm:

1.  **Initialize Queue:** `Q = [Top Level Task]`
2.  **While Q is not empty:**
    *   `Action = Q.pop()`
    *   **Ask:** "How is `Action` physically performed?" -> `Mechanisms M`
    *   **Run CDP (Level 1) on `M`:**
        *   Identify *Sub-Actions*, *Resources*, *Constraints*.
    *   **Evaluation:**
        *   **IF** `Sub-Action` is a **Known Primitive** (e.g., "Node.js FS"):
            *   **STOP & AUDIT:** Run Step 5 (Dependency Audit). Log Findings.
        *   **ELSE** (Complex/Unknown):
            *   **FAN OUT:** Add `Sub-Action` to `Q`.
            *   **Drill Down:** Continue recursion.

3.  **Stop Condition:** Queue is empty OR Gates Triggered.
    *   **Valid Stop:** Action is a **Primitive** (Tool Exists AND Knowledge Exists AND Access Exists).

4.  **Dependency & Assumption Audit (Mandatory at Stop):**
    *   For every Primitive reached, perform a Dependency Audit.

## Output Format

### Dependency Audit Table (Per Leaf Node)
Must be generated when a Stop Condition is reached.

| Category | Status | Detail | Verification Method | Resolution Task |
| :--- | :--- | :--- | :--- | :--- |
| **Tool** | VERIFIED_HAVE | `pg` lib | `npm list pg` | — |
| **Knowledge** | VERIFIED_HAVE | Syntax known | Review Docs | — |
| **Access** | VERIFIED_HAVE | DB Creds | Test DB connection | — |
| **Physics** | VERIFIED_HAVE | Atomic, single-user | Review Architecture | — |
| **Ops/Ownership** | VERIFIED_HAVE | "Orion runs migrate in CI before schema tests" | Review SSOT workflow section | — |
| **Tool** | MISSING | `zod` lib | `npm list zod` | `npm install zod` |
| **Access** | MISSING | DB Creds | Test DB connection | Add DATABASE_URL to .env |
| **Ops/Ownership** | MISSING | "Migration execution workflow undefined" | Check SSOT for explicit owner/trigger/env | Add Subtask 1-0-2 to define workflow |

*No row may be marked as ASSUMED. If a dependency cannot be verified, it must be marked as MISSING and a resolution task must be specified.*

### Missing Fundamentals List
A unified list of blocking requirements found at the bottom of the fractal.

| Category | Missing Fundamental | Impact | Resolution Task |
| :--- | :--- | :--- | :--- |
| **Tooling** | `search_files` tool | Orion is blind | Implement `search_files.js` |
| **Knowledge** | Project Structure Map | Search times out | Add `structure.md` to System Prompt |
| **Infra** | DB Write Permission | Handover fails | Update PG User Roles |

## Example Trace

*   **L1:** "Orion Plans a Task."
*   **L2:** "Orion reads code to understand context."
*   **L3:** "Orion calls `read_file`."
*   **L4 (Gap):** "Orion doesn't know *which* file to read."
*   **L5 (Drill):** "Orion must Search." -> **Gap:** "No Search Tool."
*   **Verdict:** Add **Task 0.1: Implement Search Tooling.**
