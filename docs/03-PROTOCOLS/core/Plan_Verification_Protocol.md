# PLAN VERIFICATION PROTOCOL (PVP)

## Overview
The Plan Verification Protocol (PVP) is a systematic approach to validating that a technical plan will achieve its intended goal. It ensures thoroughness by examining actions, resources, gaps, dependencies, integration, and verification.

## Protocol Steps

### 1. LIST ACTIONS
**What needs to happen?**
- Enumerate every discrete step required to reach the goal.
- Use clear, concise action statements (one line per action).
- Focus on *what* needs to be done, not *how*.

### 2. FIND RESOURCES
**What enables each action?**
- Identify all resources (tools, APIs, databases, files, environment variables, etc.) needed for each action.
- Include both existing resources and those that must be created/configured.

### 3. IDENTIFY GAPS & MAP DATA FLOW
**What's missing and how does data move?**
- **Run CDP (Constraint Discovery Protocol):** Use CDP to map Atomic Actions to Resources. This generates the *detailed* flow.
- **Create PVP Data Flow Map:** Explicitly map the *high-level* flow (Source -> Transform -> Destination) based on CDP findings.
- **Identify Gaps:** Check for broken links, missing storage steps, or format mismatches between the steps.
- Focus on accuracy and thoroughness (ignore security at this stage).


### 4. MAP DEPENDENCIES
**What builds first?**
- Determine the order in which actions must be performed.
- Identify blocking dependencies (e.g., database tables must exist before code can write to them).
- Create a dependency graph or ordered list.

### 5. CHECK INTEGRATION
**How do pieces connect?**
- Verify that each component's inputs and outputs align.
- Ensure communication protocols (APIs, function calls, data formats) are compatible.
- Confirm that error handling and edge cases are considered.

### 5.1 VALIDATE TEST SEAMS (CRITICAL)
**Is it testable without mocks?**
- Identify **Injection Seams**: Can dependencies be injected (e.g., as arguments) rather than hard-coded?
- Identify **Observation Seams**: Can side effects (state changes, events) be observed directly?
- **Rule:** If Tara cannot intercept input/output without launching the full backend, the plan is invalid.

### 6. VALIDATE COMPLETENESS
**Will this plan reach the goal?**
- Review the entire plan against the original goal statement.
- Ensure no steps are missing and all resources are accounted for.
- Confirm that the plan, if executed, will produce the desired outcome.

### 7. DEFINE VERIFICATION TESTS
**Specify how each action will be tested.**
- For each action, define a test that validates its success.
- Include component tests (individual pieces) and integration tests (how pieces work together).
- This step provides clear test requirements for implementation validation.
- Design tests for all points on the data flow map

## Usage Guidelines
- Perform PVP early in the planning phase, before implementation begins.
- Update the plan as new information emerges.
- The output of PVP is a verified plan ready for execution, along with test specifications.

## Example (Orion UI Chat)
1. **LIST ACTIONS**: User types message → frontend sends POST → backend processes with OrionAgent → OrionAgent calls DeepSeek API → response stored in database → frontend displays response.
2. **FIND RESOURCES**: Frontend (ChatPanel.vue), backend (Express server), OrionAgent, DeepSeek API, database (chat_messages table), prompt file, environment variables.
3. **IDENTIFY GAPS**: Using CDP, discover that polling reads from JSON files while chat writes to database → data source mismatch.
4. **MAP DEPENDENCIES**: Database migration must run before OrionAgent can store messages; backend server must be running before frontend can connect.
5. **CHECK INTEGRATION**: Frontend expects `{response_type, message, metadata}` but backend returns `{content, metadata}` → format mismatch.
6. **VALIDATE COMPLETENESS**: The plan covers the essential flow but must address the polling/data source gap.
7. **DEFINE VERIFICATION TESTS**: 
   - Test `/api/chat` endpoint with POST request, verify response format.
   - Test frontend displays message content, not raw JSON.
   - Test database migration creates required tables.

## Related Protocols
- **CDP (Constraint Discovery Protocol)**: Used in step 3 to systematically identify gaps and constraints.
- **Tara's Testing Protocol**: Uses the test specifications from step 7 to create comprehensive tests.
