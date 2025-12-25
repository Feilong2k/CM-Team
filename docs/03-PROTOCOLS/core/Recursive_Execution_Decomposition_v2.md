# RED PROTOCOL v2 (Recursive Execution Decomposition)

## Overview

Recursive Execution Decomposition (RED) is a "Deep Dive" technique used to uncover **Unknown Unknowns** and **Hidden Assumptions** in a system design. It works by recursively breaking actions down until you reach **Atomic Primitives**, and then auditing each primitive for:

- Tools used (Resources Touched)
- Inputs required (Resources Required)
- Outputs produced (Artifacts/State)
- Verification status (Design vs Current Reality)

RED v2 extends the original Fractal Analysis / Recursive CDP by making a **hard separation between design-level assumptions and current-state truth**, and by requiring explicit verification methods and checkmarks.

---

## When to Use

- **Phase:** Feature Definition & Implementation Requirements (Adam), and Plan Verification (Orion).
- **Target:** Complex, novel, or high-risk components (e.g., "AI Autonomous Agent Loop", "Orion Chat & Context").
- **Trigger:**
  - Steps that rely on "magic" or vague assumptions (e.g., "Orion finds the file").
  - Any time a plan claims "Table exists", "Tool is available", or "Config is set" without explicit verification.

---

## Layers (Same Concept, Stricter Checks)

0. **Layer 0: Source of Truth Audit (Pre-Flight)** – *The Scope*
   - Question: **Does the proposed Solution match the existing Reality?**
   - Actions:
     - Explicitly name the **Reference Systems** (UI model, DB schema, config files, env, etc.).
     - Compare **High-Level Objects** (Entities/Modules) against the Plan.
     - Compare **Detailed Attributes** (Fields/Props/Columns) against the Plan.

0.5 **Layer 0.5: Operationalization Audit (Execution Ownership)** – *The Who/When/Where*
   - Question: **Who uses each deliverable, when, and in which environment?**
   - For each deliverable/output (script, file, API, UI component), answer:
     - **Output:** What artifact is produced?
     - **Consumer:** Who/what uses it (Orion / Tara / Devon / CI / operator / user)?
     - **When:** At what stage (dev setup / CI / deploy / runtime)?
     - **Where:** Which environment (dev/test/prod/local)?
     - **Trigger:** Manual vs CI vs startup hook vs scheduler.
     - **Safety:** How do we prevent wrong-environment execution?
   - Document gaps in operational workflow as **Missing Fundamentals**.

1. **Layer 1: System (Feature/Goal)** – *The What*
   - Example: "Implement Orion Chat & Context".

2. **Layer 2: Operation (Task)** – *The How*
   - Example: "Store chat messages", "Gather context from repo".

3. **Layer 3: Mechanism (Step)** – *The Implementation*
   - Example: "Run ContextBuilder", "Call list_files tool".

4. **Layer 4: Atomic Op (Micro-Step)** – *The Execution*
   - Example: "Execute fs.readdir", "Insert row into messages table".

5. **Layer 5+: Fundamental (The Root)** – *The Prerequisite*
   - Example: "pg lib installed?", "DB table actually exists?", "Prompt template file present?".

---

## The RED v2 Loop (Recursive Queue Algorithm)

To perform a **Full RED v2 Analysis**, follow this algorithm:

1. **Initialize Queue:** `Q = [Top Level Task]`.

2. **While Q is not empty:**
   - `Action = Q.pop()`.
   - Ask: **"How is `Action` physically performed?"** → produce **Mechanisms M**.
   - For each Mechanism:
     - Run a **PCC-style breakdown** at that level:
       - Identify **Sub-Actions**.
       - Identify **Resources Touched** (Tools used).
       - Identify **Resources Required** (Inputs).
       - Identify **Outputs** (Artifacts/State) produced.
   - **Evaluation:**
     - **For every Sub-Action (regardless of current status):**
       - Continue decomposition until Sub-Action is **listed in the Primitive Registry** AND all its sub-actions are also primitives.
       - Only then: Run the **Dependency & Assumption Audit**.
     - **Stop Condition:** Queue is empty **OR** Safety Gates Triggered.

3. **Stop Condition:** Queue is empty **OR** Safety Gates Triggered:
   - Max Depth (e.g., >5) → Architecture Smell.
   - Max Fan-Out (e.g., >10 per layer) → Scope Creep.
   - Valid Stop: Action is a **Primitive** and all dependencies are audited.

4. **Dependency & Assumption Audit (Mandatory at Stop):**
   - For every Primitive reached, perform a **Current State vs Design** audit using the tables below.

---

## Output Format (RED v2)

RED v2 outputs **three core tables** per analysis, plus a unified Missing Fundamentals list.

### 1. Tools Audit (Resources Touched)

Purpose: List all **unique tools/resources used** by atomic actions and confirm they truly exist.

| Tool / Resource Touched | Where Used (Action) | VERIFIED_HAVE / MISSING | Verification Method | ✓ Verified |
|-------------------------|---------------------|-------------------------|---------------------|-----------:|
| `pg` lib                | DB inserts          | VERIFIED_HAVE           | `npm list pg`       | ✓          |
| `fs` (file system)      | ContextBuilder      | VERIFIED_HAVE           | Code review         | ✓          |
| `DeepSeek API`          | LLM calls           | VERIFIED_HAVE           | .env + code review  | ✓          |
| `search_files` tool     | ContextBuilder      | MISSING                 | Code search         |            |

> **Rule:** Only mark `VERIFIED_HAVE` with a ✓ when there is a **concrete, reproducible check** (command, file, config) performed or clearly performable. Otherwise it is MISSING.

---

### 2. Inputs Audit (Resources Required)

Purpose: Separate **Design Requirements** from **Current Reality**, and expose hidden assumptions.

Key columns:
- **Design Required?** – Does the plan rely on this input existing to succeed?
- **Present Now?** – Does it exist in the current codebase/environment (verified)?
- **VERIFIED_HAVE / MISSING** – Current state truth, not wishful thinking.
- **Verification Method** – How you checked (code search, command, file presence).
- **✓ Verified** – Only tick when the check was actually done.

Example:

| Input / Resource Required   | Where Used          | Design Required? | Present Now? | VERIFIED_HAVE / MISSING | 👤 Architect Decision Needed | Verification Method             | ✓ Verified |
|-----------------------------|---------------------|------------------|--------------|-------------------------|-----------------------------|----------------------------------|-----------:|
| Messages table exists       | Store chat history  | Yes              | No           | MISSING                 |                             | Migrations + user confirmation  | ✓          |
| Prompt template/config      | LLM prompt prep     | Yes              | No           | MISSING                 | 👤                           | Code search (not found)         | ✓          |
| Max context size for LLM    | LLM API calls       | Yes              | No           | MISSING                 | 👤                           | Not specified in code/docs      |            |
| DeepSeek API key            | LLM API calls       | Yes              | Unknown      | MISSING                 |                             | Not runtime-tested in analysis  |            |

> **Critical Principle:** If something is **design-required** but **not verified present**, it must be treated as **MISSING**, not assumed. RED’s job is to turn those into explicit tasks, not let them hide.

---

### 3. Outputs Audit (Artifacts/State)

Purpose: List outputs from atomic actions, and clarify **who depends on them** and whether consumption is **automatic or scheduled/manual**.

- Verification is **optional** here – focus is on **data flow and dependencies**.

Example:

| Output / Artifact Produced  | Produced by (Action)     | Depended on by (Action)             | Auto / Scheduled |
|----------------------------|--------------------------|--------------------------------------|------------------|
| Chat message (DB row)      | Insert into `messages`   | ContextBuilder, Chat UI              | Auto             |
| Context bundle (files)     | ContextBuilder           | LLM prompt builder                   | Auto             |
| LLM response               | LLM API call             | Response persistence, UI display     | Auto             |
| Plan draft entry (DB row)  | "Plan This" backend     | Plan viewer, further planning        | Scheduled (user) |

> **Use:** Outputs audit helps ensure no produced artifact is orphaned, and that every consumer has its prerequisites in place.

---

### 3.5 Knowledge Audit (Optional but Recommended)

Purpose: Make **knowledge and skill requirements** explicit, so we don’t assume “someone knows how to do X” when in fact it’s missing.

Key columns:
- **Knowledge Required?** – Does this action require a specific skill/understanding?
- **Present Now?** – Do we have that knowledge available (people, docs, SOPs, examples)?
- **VERIFIED_HAVE / MISSING** – Based on concrete evidence (docs, prior work), not wishful thinking.
- **Verification Method** – How you checked (e.g., existing examples in repo, documented SOP).
- **✓ Verified** – Only tick when the check was actually done.

Example:

| Knowledge Required           | Where Used          | Knowledge Required? | Present Now? | VERIFIED_HAVE / MISSING | Verification Method                     | ✓ Verified | 👤 Architect Decision Needed |
|-----------------------------|---------------------|---------------------|--------------|-------------------------|----------------------------------------|-----------:|------------------------------|
| LLM prompt engineering      | LLM prompt builder  | Yes                 | No           | MISSING                 | No prompt examples in repo             |            | 👤                            |
| DB schema migration design  | Messages tables     | Yes                 | Yes          | VERIFIED_HAVE           | Existing migrations & patterns in repo | ✓          |                              |
| FS safety & rollback SOP    | Filesystem tools    | Yes                 | No           | MISSING                 | No documented SOP                      |            | 👤                            |

> **Guideline:** Treat missing knowledge like any other missing resource. It should produce explicit “learn/research/document” tasks, not be hand-waved as “the team will figure it out during implementation.”

---

### 4. Dependency & Assumption Audit (Per Primitive)

This remains similar to the original Fractal Analysis Protocol, but with RED v2 rules:

| Category       | Status         | Detail                       | Verification Method          | ✓ Verified | Resolution Task                    |
|----------------|----------------|------------------------------|------------------------------|-----------:|------------------------------------|
| **Tool**       | VERIFIED_HAVE  | `pg` lib                     | `npm list pg`                | ✓          | —                                  |
| **Knowledge**  | VERIFIED_HAVE  | SQL syntax known             | Docs review                  | ✓          | —                                  |
| **Access**     | MISSING        | DB creds                     | Test connection (not run)    |            | Define .env + connection test      |
| **Physics**    | VERIFIED_HAVE  | Single-writer, no contention | Architecture review          | ✓          | —                                  |
| **Ops/Owner**  | MISSING        | Who runs migrations in CI?   | SSOT workflow (not explicit) |            | Add subtask: define migration owner|

> **No row may be marked ASSUMED.** If a dependency cannot be verified, it must be marked MISSING with a resolution task.

---

## Safety Gates (Unchanged, but Emphasized)

- **Max Depth:** 5 Layers – Beyond this, flag as Architecture Smell.
- **Max Fan-Out:** 10 Nodes per layer – Beyond this, flag as Scope Creep.
- **Primitive Registry:** Use `.Docs/Protocols/Primitive_Registry.md` to decide when to stop drilling: a primitive is valid only when **Tool Exists**, **Knowledge Exists**, and **Access Exists**.

---

## Example Trace (RED v2 with Design vs Current Reality)

Using Feature 2: Orion Chat & Context as an example:

- **L1:** "Store chat messages"
- **L2:** "Insert message into DB"
- **L3:** `pg` `INSERT` into `messages` table
- **L4:** Primitive: `pg` lib call

**Tools Audit:**
- `pg` lib → VERIFIED_HAVE via `npm list pg` (or code review) → ✓.

**Inputs Audit:**
- Messages table exists → Design Required = Yes, Present Now = No → MISSING, resolution: "Add messages table migration".
- DB connection → Design Required = Yes, Present Now = Unknown (no runtime test) → MISSING until an explicit connection test is done.

**Outputs Audit:**
- Chat message (DB row) → Produced by `INSERT`, depended on by ContextBuilder + Chat UI.

**Verdict:**
- Plan to "store chat messages" is **not executable yet** because a design-required input (messages table) is missing in current reality. RED correctly turns this into an explicit migration task.

---

## Usage Guidelines (Updated)

1. **Never mix Plan and Reality in one column.**
   - Always differentiate **Design Required?** from **Present Now?**.
2. **VERIFIED_HAVE means actually checked.**
   - There must be a reproducible verification method (command, search, file, config) behind every ✓.
3. **MISSING is not a failure – it's a task generator.**
   - Every MISSING item should produce a concrete **Resolution Task** in the roadmap or implementation requirements.
4. **Outputs must map to Consumers.**
   - For every output, list at least one consumer. If none exist, question whether the output is needed.
5. **RED feeds CAP/PCC.**
   - Use RED findings (Missing Fundamentals + verified tools/inputs) as inputs into CAP/PCC so plans are both logically sound and physically executable.
6. **Always use Expanded Tables Format for AI-assisted analysis.**
   - When performing RED analysis with AI assistance (e.g., gpt4.1-mini), **mandatorily include Section 2 expanded breakdown tables** as shown in `RED_two_stage_protocol_plan_vFinal_EXPANDED.md`.
   - Format: Parent→child action mapping with columns: L1 Action (Parent), L2 Action (Child), Resources Touched, Resources Required, Output, Primitive?, Status.
   - This ensures systematic decomposition and prevents superficial analysis.
7. **Prefer gpt4.1-mini for complex RED analyses.**
   - For large, complex systems with many dependencies, use **gpt4.1-mini** due to its larger context window (128K+ tokens).
   - Benefits: Can hold entire codebase context, maintain consistency across deep recursive decomposition, and avoid truncation of expanded tables.
   - Trade-off: May be slower/more expensive than smaller models; reserve for high-risk, complex features.

---

## AI-Assisted RED Analysis Protocol

### Expanded Tables Requirement
When an AI (e.g., Adam, Orion, or any architect agent) performs RED analysis, it **must** produce the **Section 2 expanded breakdown tables** as exemplified in `docs/03-PROTOCOLS/two-stage/analysis/RED_two_stage_protocol_plan_vFinal_EXPANDED.md`.

**Required Table Structure:**
```
### 2. RED Breakdown — Expanded Tables

#### 2.1. Level 1 → Level 2

| L1 Action (Parent) | L2 Action (Child) | Resources Touched | Resources Required | Output | Primitive? | Status |
|---|---|---|---|---|---:|---|
| [Parent action] | [Child action] | [Tools/resources used] | [Inputs needed] | [Artifact produced] | ✓/✗ | VERIFIED_HAVE/MISSING/NEED_Verification |

#### 2.2. Level 2 → Level 3 (Selected Deep Dives)
[Continue recursion for complex actions]
```

**Why Mandatory:**
1. **Systematic decomposition:** Forces explicit parent→child mapping, preventing skipped layers.
2. **Audit trail:** Each primitive's status (VERIFIED_HAVE/MISSING) is documented with evidence.
3. **AI consistency:** Ensures all AI analysts follow the same rigorous format, regardless of model or context.
4. **Actionable output:** Directly maps to Missing Fundamentals and implementation tasks.

### Model Selection Guidance
- **For simple features:** Any capable model (DeepSeek, GPT-4, etc.) with sufficient context.
- **For complex, multi-layer systems:** **Prefer gpt4.1-mini** due to:
  - **128K+ token context:** Can hold entire codebase snippets, previous analyses, and expanded tables without truncation.
  - **Consistency maintenance:** Keeps track of deep recursion chains and cross-references.
  - **Cost-effectiveness:** Lower cost than GPT-4 Turbo for large context workloads.
  - **Availability:** Integrated into the existing adapter stack (`GPT41Adapter`).

**Implementation Note:** When Adam or Orion performs RED analysis, they should be configured to use gpt4.1-mini for features with >10 expected decomposition layers or when the codebase context exceeds 50K tokens.

### Verification Integration
AI-assisted RED must still adhere to **truthfulness rules**:
- No row may be marked `VERIFIED_HAVE` without concrete evidence (code search, command output, file presence).
- `NEED_Verification` is acceptable for items that require human or runtime verification.
- All `MISSING` items must generate explicit resolution tasks.

### Primitive Registry Integration
The `Primitive_Registry.md` defines atomic primitives that can stop RED decomposition. An action is only considered primitive when:

1. **Registry Entry Exists:** Action is listed in the Primitive Registry
2. **All Sub-Actions Are Primitives:** Every child action also maps to registry entries
3. **Verification Complete:** All three conditions are satisfied:
   - **Tool Exists:** Binary/library/function available
   - **Knowledge Exists:** Syntax/arguments known
   - **Access Exists:** Permissions/environment confirmed

**Critical Rule:** Do NOT stop decomposition simply because an action appears to be primitive. Verify it's in the registry and all its dependencies are also primitives. Continue decomposition for ALL items (VERIFIED_HAVE, MISSING, NEED_Verification) until reaching registry primitives.

## Summary

RED v2 formalizes the distinction between **what the design assumes** and **what the system actually has**. By:
- Recursively decomposing actions into primitives,
- Auditing tools, inputs, and outputs with explicit verification methods and checkmarks,
- Mandating expanded tables format for AI-assisted analysis, and
- Turning every unverified assumption into a **Missing Fundamental + Resolution Task**,

it reduces the risk of "we finished all the tasks but still missed the goal" and surfaces hidden bugs early in the planning phase.
