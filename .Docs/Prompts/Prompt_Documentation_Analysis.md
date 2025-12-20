# Prompt Documentation Analysis

## Overview
This document summarizes the contents of the `.Docs/Prompts` folder, which contains system prompts for the CodeMaestro TDD team agents. Each file defines the role, responsibilities, and operational protocols for a specific agent.

## Files

### 1. AdamPrompts.md
**Role**: Adam (Architect)

**Purpose**: Defines the system prompt for Adam, the architect who designs systems, breaks down features into tasks, and ensures technical vision.

**Key Sections**:
- **Identity**: Architect for CodeMaestro
- **Tech Stack**: Node.js, Express, PostgreSQL, Vue 3, Pinia, Vite, Jest, Vitest
- **Role Boundaries**: Designs systems, creates task breakdowns, writes specs; does NOT write implementation code or tests
- **Operating Protocol**: How to create tasks (atomic, with acceptance criteria, dependencies)
- **Implementation Requirements Format**: Overview, technical details, acceptance criteria, edge cases, dependencies, decisions locked
- **TDD Awareness**: Every task should be testable
- **Architectural Guardrails**: Separation of concerns, avoid shortcuts, follow conventions
- **Pre-Validation Protocol**: Trace data flow end-to-end before outputting tasks
- **Key Principles**: Minimalism first, follow existing stack, design for testability, justify choices, avoid overengineering
- **Definition of Done**: Clear task breakdown, implementation requirements documented, acceptance criteria defined, architecture decisions explained

**Notes**: Comprehensive and well-structured. Includes post-refactor review checklist.

### 2. DevonPrompts.md
**Role**: Devon (Implementation Agent)

**Purpose**: Defines the system prompt for Devon, the senior software engineer who implements production-grade software following TDD.

**Key Sections**:
- **Identity**: Senior software engineer with 15+ years experience
- **Core Philosophy**: "First, make the tests pass with minimal code. Then refactor to improve design while keeping tests green."
- **TDD Rules (Strict)**: Work only from failing tests, write minimum code, refactor after GREEN, NEVER touch test files
- **Role Boundaries**: Can implement production code, refactor, fix bugs; cannot write/modify tests, change test expectations, introduce shortcuts
- **Architecture & Best Practices**: Frontend (Vue 3 Composition API, layered structure), Backend (routes → controllers → services → models)
- **Placeholder & Stub Policy (Critical)**: Placeholders are forbidden; must throw runtime errors if integration incomplete
- **Mandatory Integration Traceability**: Trace UI → API → controller → service → business logic → response
- **Mandatory Design-First Workflow**: Identify affected layers, propose folder structure, define file responsibilities before coding
- **Constraint Discovery Protocol (CDP)**: Analyze architectural constraints, integration risks, E2E visibility
- **Implementation Rules**: Clarity over cleverness, no monolithic files, no hidden behavior
- **Self-Review Checklist**: Tests pass, no placeholders, full execution path reaches real logic, separation of concerns respected, etc.

**Notes**: Emphasizes real logic over placeholders; includes strict TDD discipline.

### 3. OrionPrompts.md
**Role**: Orion (Orchestrator)

**Purpose**: Defines the system prompt for Orion, the orchestrator who coordinates agents (Devon, Tara) to deliver subtasks safely.

**Key Sections**:
- **Identity**: Orion, the Orchestrator for the CodeMaestro TDD team
- **Core Philosophy**: Single Source of Truth (SSOT) in database, TDD workflow (Red → Green → Refactor → Review), CDP
- **Role Boundaries**: Sequences tasks, assigns subtasks, performs CDP, logs workflow events; does NOT implement code or write tests
- **Request Handling Strategy**: Decompose, tool mapping, execute sequence
- **Critical Protocol: ZERO SIMULATION**: Never hallucinate or simulate tool outputs; execute actual tools
- **Failure & Recovery Protocol**: Tool failures, unresolvable constraints, test writing failure, human escape hatch
- **Workflow & Responsibilities**: 11-step workflow from Adam decomposition to Orion log updates
- **CDP Requirements**: Validate atomicity, ensure traceability, identify gaps and risks
- **Git Integration**: Task IDs, feature branches, base branch
- **Definition of Done (Orchestration)**: All tests pass, branch merged to main, status updated, completion logged

**Notes**: Focuses on orchestration and tool execution; emphasizes real tool usage.

### 4. TaraPrompts.md
**Role**: Tara (Testing Agent)

**Purpose**: Defines the system prompt for Tara, the senior software tester who writes failing tests and performs constraint discovery.

**Key Sections**:
- **Identity**: Tara, senior software tester with 15 years experience
- **Core Philosophy**: "If a test can pass with a placeholder, the test is invalid."
- **TDD Principle**: Test-first development, specification by example, Red–Green–Refactor discipline
- **Role Boundaries**: Writes failing tests, performs security/performance analysis, reviews implementation; does NOT write/modify production code
- **Task Context**: Working at RED stage of TDD; tests must fail before implementation
- **Subtask Context System**: Access to subtask context in `.Docs\Roadmap\Feature0_Implementation_Requirements_v1.0.md`
- **CDP Basic — Testing Focus**: Analyze atomic actions, resources touched, system physics
- **Mandatory Anti-Placeholder Rules**: Tests invalid if they pass with hardcoded responses, mocked data, empty functions
- **Test-Seam Validation**: Verify clear test seams exist (API ↔ Service ↔ Persistence, etc.)
- **Valid Failing Test Definition**: Must fail due to missing real logic, assert observable outcomes
- **CDP Analysis Framework**: Atomic actions, resources touched, system physics
- **Test Scenario Derivation**: Map CDP findings to test scenarios
- **Clarification Protocol**: Ask questions only if security boundary ambiguous, behavior ambiguous, missing seam
- **Failure & Blocking Rules**: Block task if tests cannot detect placeholders, behavior unobservable, architecture prevents isolation

**Notes**: Strong emphasis on detecting placeholders; includes detailed CDP framework.

### 5. Orion_Database_Tools.md
**Role**: Database Tools Reference (for Orion)

**Purpose**: Documents the database tools available to Orion in TDD_TEAM. Follows hybrid semantic + safe-SQL approach.

**Key Sections**:
- **Overview**: Tools follow OpenAI function calling format; pattern `DatabaseTool_{action}`
- **Tool Calling Convention**: Example JSON format
- **Semantic Tools (Focused Operations)**:
  - `DatabaseTool_get_subtask_by_id` (supports both numeric id and external_id like `P1-F2-T0-S3`)
  - `DatabaseTool_list_subtasks_by_status`
  - `DatabaseTool_update_subtask_status`
  - `DatabaseTool_append_subtask_log`
  - `DatabaseTool_search_subtasks_by_keyword`
  - `DatabaseTool_store_cdp_analysis` (not fully implemented)
  - `DatabaseTool_store_test_results` (not fully implemented)
  - `DatabaseTool_store_implementation_details` (not fully implemented)
  - `DatabaseTool_store_review` (not fully implemented)
  - `DatabaseTool_update_instructions`
  - `DatabaseTool_get_subtask_analyses`
- **Safe-SQL Tools (Controlled Schema Evolution)**:
  - `DatabaseTool_add_column_to_table`
  - `DatabaseTool_create_table_from_migration`
- **General Database Tools**:
  - `DatabaseTool_list_tables`
  - `DatabaseTool_safe_query` (SELECT only)
- **Tool Usage Patterns**: Common workflows (starting a subtask, completing a subtask, finding context, schema evolution)
- **Safety Features**: Blocked operations (DROP, TRUNCATE, DELETE without WHERE), protected tables, plan mode locking
- **Error Handling**: Common errors and solutions
- **Best Practices**: Prefer semantic tools, log actions, search before guessing IDs, respect status flow

**Notes**: Comprehensive reference; some tools marked as not fully implemented in current schema.

## Cross-References and Dependencies

- **Adam** → Creates tasks for **Orion** → Orchestrates **Tara** (tests) and **Devon** (implementation)
- **Orion** uses **DatabaseTool** for state management
- **Tara** and **Devon** follow strict TDD workflow defined in their prompts
- All agents share common tech stack (Node.js, PostgreSQL, Vue 3)

## Identified Gaps and Issues

1. **Missing FileSystemTool Implementation**: 
   - `backend/tools/registry.js` references `FileSystemTool` but the file does not exist.
   - `backend/tools/functionDefinitions.js` defines `FileSystemTool_read`, `FileSystemTool_write`, `FileSystemTool_list`, `FileSystemTool_mkdir`, `FileSystemTool_delete` but no implementation.
   - This prevents Orion from using filesystem tools directly.

2. **ContextBuilder Utilities Not Integrated**:
   - `backend/tools/list_files.js` and `backend/tools/search_files.js` are standalone CLI utilities for ContextBuilder.
   - They are not exposed as tools in the registry, so Orion cannot call them directly.
   - They now support `.gitignore` filtering (added in subtask P1-F2-T0-S3).

3. **Unimplemented Database Tools**:
   - `store_cdp_analysis`, `store_test_results`, `store_implementation_details`, `store_review` are documented but not implemented in `DatabaseTool.js`.

4. **Tool Registry Role-Based Access**:
   - Registry provides tools based on role (Devon, Tara, Orion) and mode (plan/act).
   - In Plan mode, no tools are allowed (empty object).

## Recommendations

1. **Implement FileSystemTool.js** to provide filesystem operations as defined in function definitions.
2. **Integrate list_files and search_files** into the tool system (either as part of FileSystemTool or as separate ContextTools).
3. **Complete unimplemented DatabaseTool methods** or remove them from documentation.
4. **Ensure Orion can use ContextBuilder utilities** either via ShellTool_execute or direct tool integration.

## Conclusion

The prompt files provide a robust framework for the TDD team, with clear role definitions and workflows. The main gap is the missing FileSystemTool implementation, which limits Orion's ability to perform filesystem operations directly. The recently added `.gitignore` support in list_files and search_files is a valuable enhancement for codebase analysis.

---
*Document generated on 2025-12-19 based on analysis of `.Docs/Prompts` folder.*
