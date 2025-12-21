# Context Transfer: Task 2-1-7

---

## 1. Current Work Context

- Recent work has focused on AI tool design best practices, adapters, and questionnaire patterns for complex tool orchestration in Orion.
- Documentation has been refactored for clarity and is up-to-date.
- The system supports thin adapters, structured tool calls, and questionnaire-driven workflows for complex operations.

## 2. Key Technical Concepts

- All tools use a single object argument (`args`), with explicit context injection and strong validation.
- Complex operations (like SQL generation, schema changes) are handled via multi-step questionnaires, not one-shot prompts.
- The system supports self-extension: Orion can propose new questionnaires and tool adapters to fill capability gaps.

## 3. Relevant Files and Code

- `.Docs/how_to_design_tools_for_AI_reformat.md`: Refactored, easy-to-read guide on AI tool design patterns and best practices.
- `.Docs/AI_Tool_Design_MVP_Best_Practices.md`: Actionable checklist for MVP tool development.
- `backend/tools/DatabaseToolAgentAdapter.js`: Example of a thin adapter for AI tool calls.
- `backend/template/F2-T1-S2_subtasks.json`: Contains subtask definitions, including 2-1-7 if present.
- `backend/src/agents/OrionAgent.js`: Orchestrates tool calls and questionnaire flows.

## 4. Problem Solving Approach

- For 2-1-7, follow the established patterns:
  - Use adapters for tool integration.
  - For complex or high-risk operations, design a questionnaire flow.
  - Ensure all new tools are discoverable, validated, and have clear error handling.
  - Document new patterns or lessons in the appropriate `.Docs/` file.

## 5. Pending Tasks and Next Steps

- [ ] Review the requirements for 2-1-7 in `F2-T1-S2_subtasks.json`.
- [ ] Identify if 2-1-7 requires a new tool, adapter, or questionnaire.
- [ ] Implement the solution using the best practices from the docs.
- [ ] Add or update documentation as needed.
- [ ] Test the new functionality and ensure it meets the 90%+ reliability standard.

---

**Use this context to resume work on 2-1-7 efficiently.**
