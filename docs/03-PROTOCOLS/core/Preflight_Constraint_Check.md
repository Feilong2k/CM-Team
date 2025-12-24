# CONSTRAINT DISCOVERY PROTOCOL (CDP) - Level 1

## Overview
The Constraint Discovery Protocol (CDP) is a systematic method for identifying constraints, gaps, and risks in a technical plan. It examines atomic actions, resources touched, and physical constraints to ensure thoroughness in planning. CDP is designed to be used as part of the Plan Verification Protocol (PVP) in step 3 (IDENTIFY GAPS).

## Protocol Format

### 1. ATOMIC ACTIONS
**What actions will be performed?**
List each discrete action in the system, using a consistent naming convention.

```yaml
atomic_actions:
  - action: "Action Name"
    description: "What it does"
  - action: "Another Action"
    description: "What it does"
```

### 2. RESOURCES TOUCHED
**What resources will be touched?**
For each atomic action, identify the resources involved and how they are accessed.

```yaml
resources_touched:
  - resource: "Resource Name"    # e.g., "PostgreSQL", "File System", "External API"
    action: "Read/Write/Lock"    # Type of access
    notes: "Risk or concern"     # Any specific risks or concerns
```

### 3. PHYSICAL CONSTRAINTS AND MITIGATIONS
**What physical limitations exist for each resource?**
Identify the inherent constraints of each resource and how to mitigate associated risks.

```yaml
resource_physics:
  - resource: "Resource Name"
    constraint: "Physical Limitation"  # e.g., "Race Conditions", "Network Latency", "Rate Limits"
    risk: "What could go wrong"
    mitigation: "How to prevent it"
```

## Usage Guidelines

- **When to use**:
  - **Subtasks (Tara/Devon):** Use **CDP Level 1** (Atomic Actions + Resources). Focus on immediate constraints.
  - **Features/Architecture (Adam):** Use **CDP Level 3** (Full Gap Analysis). Focus on systemic risk.
- **Focus**: Accuracy and thoroughness. Ignore security considerations unless they are inherent to the resource constraints.
- **Output**: A clear list of gaps, constraints, and risks that must be addressed in the plan.

## Example (Orion UI Chat)

### Atomic Actions
```yaml
atomic_actions:
  - action: "frontend_send_message"
    description: "Frontend POST to /api/chat with user message"
  - action: "backend_process_chat"
    description: "Backend validates, creates OrionAgent, calls DeepSeek API"
  - action: "database_store_message"
    description: "OrionAgent stores message in chat_messages table"
  - action: "database_retrieve_history"
    description: "OrionAgent retrieves last 20 messages from chat_messages"
  - action: "frontend_poll_updates"
    description: "Frontend GET /api/poll reads from JSON files"
  - action: "frontend_display_response"
    description: "Frontend renders response (JSON stringified)"
```

### Resources Touched
```yaml
resources_touched:
  - resource: "PostgreSQL (chat_messages table)"
    action: "Write"
    notes: "Chat endpoint writes messages"
  - resource: "PostgreSQL (chat_messages table)"
    action: "Read"
    notes: "Context building reads message history"
  - resource: "File System (JSON files)"
    action: "Read"
    notes: "Polling endpoint reads from JSON files (different data source)"
  - resource: "DeepSeek API"
    action: "Write/Read"
    notes: "Sends prompt, receives response"
  - resource: "Memory (context)"
    action: "Read/Write"
    notes: "OrionAgent builds context in memory"
```

### Resource Physics
```yaml
resource_physics:
  - resource: "PostgreSQL"
    constraint: "Table must exist before writes"
    risk: "Missing table causes OrionAgent failure"
    mitigation: "Run migration 004 (create_chat_messages.sql)"
  - resource: "File System (JSON)"
    constraint: "Different data source than database"
    risk: "Polling shows stale/incorrect data"
    mitigation: "Align data sources (remove polling or update to use database)"
  - resource: "DeepSeek API"
    constraint: "Requires API key"
    risk: "Missing key prevents chat"
    mitigation: "Validate DEEPSEEK_API_KEY environment variable"
  - resource: "Memory"
    constraint: "Context limited to 20 messages"
    risk: "Missing conversation history"
    mitigation: "Database retrieval error handling"
```

## How CDP Reveals Gaps

In the example above, CDP reveals a critical gap:
- **Action**: `frontend_poll_updates` reads from JSON files.
- **Resource**: File System (JSON files) for reading.
- **Constraint**: Different data source than the database used by `database_store_message`.
- **Risk**: Polling shows stale/incorrect data because chat writes to database, not JSON files.
- **Mitigation**: Align data sources by removing polling or updating polling to read from the database.

## Integration with PVP

CDP is designed to be used within PVP step 3 (IDENTIFY GAPS). The structured format ensures that:
1. Every action is accounted for.
2. Every resource is identified.
3. Every constraint is analyzed.
4. Gaps are explicitly documented with mitigation strategies.

## Benefits

- **Systematic**: Ensures no action or resource is overlooked.
- **Clear Documentation**: Creates a record of constraints and mitigations.
- **Actionable Output**: Provides specific issues that must be addressed in the plan.
- **Testable**: The identified constraints and mitigations can be turned into verification tests.

## Related Protocols

- **PVP (Plan Verification Protocol)**: Uses CDP in step 3 to identify gaps.
- **Tara's Testing Protocol**: Can use the constraints and risks identified by CDP to create targeted tests.


# Constraint Discovery Protocol - Level 2:

PART 1: RESOURCE ANALYSIS
| Resource | Current State | Who Uses It | Exclusive/Shared |
|----------|--------------|-------------|------------------|

PART 2: OPERATION ANALYSIS (CRITICAL)
| Operation | Physical Change? | Locks? | 2 Actors Simultaneously? |
|-----------|-----------------|--------|--------------------------|

PART 3: ACTOR ANALYSIS
| Actor | Resources They Touch | Same Resource Same Time? |
|-------|---------------------|-------------------------|

PART 4: ASSUMPTION AUDIT (minimum 10)
| # | Assumption | Explicit/Implicit | Breaks if FALSE | Risk |
|---|------------|-------------------|-----------------|------|

PART 5: PHYSICAL VS LOGICAL CHECK (CRITICAL - Catches Worktree Trap)
For each "separation" claimed:
| Claimed Separation | Mechanism | Physical/Logical | If Mechanism Fails? |
|-------------------|-----------|------------------|---------------------|
| "Different files" | File paths | Logical          | Same disk/locks      |
| "Different branches" | Git refs | Logical        | SAME WORKING DIR!    |

KEY: If two actors work "separately," do they share PHYSICAL resources?
(disk, ports, memory, working directory)

PART 6: FINAL VERDICT
1. Physical constraints discovered: [list]
2. Logical separations sharing physical resources: [HIGH RISK]
3. VERDICT: SAFE / CONDITIONALLY SAFE / UNSAFE
4. RECOMMENDED MITIGATIONS: [if any]


# Constraint Discovery Protocol Level 3 (Gap Analysis + Conditional)

```
Run this plan through Constraint Discovery Protocol v4:

PART 1-5: Same as Full v3 (above)

PART 6: GAP ANALYSIS (CRITICAL)
What is NOT SPECIFIED in this plan?
| Gap | Possible Interpretations | Answer Under Each |
|-----|-------------------------|-------------------|
| ... | A: ... / B: ... / C: ... | A→X, B→Y, C→Z    |

List ALL ambiguities. Do NOT assume intent.

PART 7: CONDITIONAL VERDICT
- IF [condition A] THEN [conclusion A]
- IF [condition B] THEN [conclusion B]

Gaps MUST Be Clarified:
