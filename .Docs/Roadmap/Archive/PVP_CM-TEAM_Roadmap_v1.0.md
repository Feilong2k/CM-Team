# PVP — Verification of CM-TEAM Feature-Based Roadmap v1.0

Source plan:
- `.Docs/Roadmap/CM-TEAM_Roadmap_FeatureBased_v1.0.md`

---

## 1) LIST ACTIONS (what needs to happen)
1. Create UI navigation shell (Chat/Projects/Workflow/Config).
2. Implement chat UI send/receive.
3. Create backend chat endpoint.
4. Integrate OrionAgent with DeepSeek.
5. Store chat threads/messages in PostgreSQL.
6. Create Projects UI and backend endpoints.
7. Persist projects in PostgreSQL.
8. Add “Create plan from message” UI action.
9. Implement planning endpoint that converts goal text → features/tasks/subtasks.
10. Persist features/tasks/subtasks in PostgreSQL.
11. Build Workflow UI that lists features/tasks/subtasks.
12. Implement manual trigger endpoints for CDP/tests/implement/review.
13. Implement activity logging for each UI action + status change.
14. Implement Aider runner service for Tara/Devon.
15. Persist agent run outputs.
16. Implement git service: create branch, commit changes.
17. Persist git metadata per subtask/run.
18. Implement system status endpoint.
19. Implement config/status UI.
20. Provide user-facing error handling for:
    - DeepSeek failures
    - DB connectivity issues
    - Aider failures
    - git failures

---

## 2) FIND RESOURCES (what enables each action)
- Frontend:
  - Vue router (or simple navigation)
  - Chat components
  - Workflow components
- Backend:
  - Express routes/controllers
  - OrionAgent (DeepSeek client)
  - Tara/Devon runners (Aider subprocess)
  - Git runner (child process)
- Database:
  - PostgreSQL VM
  - DATABASE_URL env var
  - Tables: projects, features, tasks, subtasks, chat_messages, agent_runs, activity_log
- External:
  - DeepSeek API key
  - Aider installed & configured
  - Git installed and repo path known

---

## 3) IDENTIFY GAPS (CDP-lite inside PVP)
Gaps in the roadmap (must be clarified/added):
1. **Target codebase location**: which repo does Devon/Tara edit? The current CM-TEAM repo, or a separate “app under development” repo?
2. **Aider configuration**: model/provider + where config lives (env, config file), and which working directory it runs in.
3. **DB initialization mechanism**: who creates schema and how it is versioned (SQL migration files vs Orion-run SQL).
4. **Project context binding**:
   - Does chat belong to a project by default?
   - How is “active project” stored (server session, client local storage, DB)?
5. **Agent output format**: define the structured response schema for Tara/Devon reports (so backend can store and display results consistently).
6. **Concurrency rule**: roadmap mentions “single active run at a time”; needs explicit enforcement strategy + UI feedback.
7. **Test execution**: where/how tests are run (backend triggers `npm test`? or Aider does it?).

---

## 4) MAP DEPENDENCIES (what builds first)
Ordered dependencies:
1. DB connectivity + initial schema
2. Chat backend + chat UI
3. OrionAgent DeepSeek integration
4. Projects CRUD
5. Planning endpoint + persistence
6. Workflow UI + manual triggers
7. Activity logging
8. Aider runner + agent_runs persistence
9. Git service + metadata persistence
10. System status endpoint + status UI

---

## 5) CHECK INTEGRATION (how pieces connect)
- Chat UI must match backend response format.
- Planning endpoint must output objects that match DB tables.
- Workflow UI must read the same statuses backend writes.
- Agent run outputs must be stored in DB and linked to subtasks.
- Git commit metadata must be stored per subtask/run.

Potential integration risks:
- Aider modifies files outside intended repo.
- Git operations run against wrong working directory.
- Chat history stored but UI reads wrong thread.

---

## 6) VALIDATE COMPLETENESS (will plan reach goal)
Conditionally complete.
- The roadmap reaches the goal **if** the missing gaps are clarified:
  - target repo path
  - Aider config + run directory
  - agent report schema
  - DB migration/versioning approach

---

## 7) DEFINE VERIFICATION TESTS
Component checks:
1. Chat POST returns Orion response and writes 2 DB rows.
2. Chat history GET returns the last N messages.
3. Project create/list works and persists.
4. Plan creation stores features/tasks/subtasks.
5. Manual trigger endpoints create activity log entries and set subtask status.
6. Aider runner stores output and error when command fails.
7. Git service creates branch and commits; stores commit hash.
8. System status endpoint reports pass/fail states.

Integration checks:
- End-to-end: chat → create plan → select subtask → request tests → request implement → request review → all events stored and visible.
