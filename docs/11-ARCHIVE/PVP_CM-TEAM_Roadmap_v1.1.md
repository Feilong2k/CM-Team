# PVP — Verification of CM-TEAM Feature-Based Roadmap v1.1 (Updated to Address Key Gaps)

Source plan:
- `.Docs/Roadmap/CM-TEAM_Roadmap_FeatureBased_v1.1.md`

---

## 1) LIST ACTIONS (what needs to happen)
1. Create UI navigation shell (Chat/Projects/Workflow/Config).
2. Add header Project dropdown + persist activeProjectId.
3. Create Projects list/create/select UI.
4. Create backend projects endpoints and persist projects.
5. Ensure an MVP default project exists (first-run).
6. Implement chat UI send/receive scoped to active project.
7. Implement backend chat endpoints (project-scoped) that store messages.
8. Implement planning endpoint that stores features/tasks/subtasks under project.
9. Build Workflow UI scoped to active project.
10. Implement manual trigger endpoints for CDP/tests/implement/review.
11. Implement **Config UI** to set TARGET_REPO_PATH.
12. Implement backend config endpoints to save/load TARGET_REPO_PATH.
13. Implement backend **repo validation** (path exists + git repo).
14. Implement backend **Aider availability check**.
15. Implement backend Aider runner.
16. Define and persist **agent report schema** (output_json + output_text).
17. Implement backend git service for branch + commit against TARGET_REPO_PATH.
18. Implement **single-run concurrency lock** that wraps Aider + git + test runs.
19. Implement UI disabling + “Agent busy” messaging when lock active.
20. Implement backend test runner command execution in TARGET_REPO_PATH.
21. Store test run results as agent_runs (action=test_run).
22. Implement project-scoped activity logging.
23. Implement system status endpoint and status UI.

---

## 2) FIND RESOURCES (what enables each action)
- Frontend:
  - router/navigation
  - global store for activeProjectId
  - dropdown UI
  - config form for TARGET_REPO_PATH
  - workflow buttons disablement when locked
- Backend:
  - Express routes/controllers
  - PostgreSQL client (DATABASE_URL)
  - OrionAgent (DeepSeek client)
  - Aider subprocess runner
  - Git subprocess runner
  - Test subprocess runner
  - DB-backed lock (runtime_locks)
  - DB-backed config storage (system_config)
- Database:
  - projects, features, tasks, subtasks
  - chat_messages (project_id)
  - agent_runs (output_json)
  - activity_log (project_id)
  - system_config (TARGET_REPO_PATH)
  - runtime_locks
- External:
  - DeepSeek API
  - Aider installation/config
  - Git + target repo

---

## 3) IDENTIFY GAPS (CDP-lite inside PVP)
Gaps remaining (reduced vs prior v1.1):
1. **Exact test command** per target repo (npm test vs pnpm vs custom). MVP can store a configurable test command.
2. **Agent JSON schema exact fields** (we listed minimums; may need expansion for richer UI).
3. **Aider config specifics** (provider/model) depends on the user’s Aider setup.

---

## 4) MAP DEPENDENCIES (what builds first)
1. DB schema for projects + config + locks + chat_messages
2. Projects endpoints + default project
3. Project dropdown UI
4. Chat endpoints + chat UI
5. Planning endpoint + UI integration
6. Workflow UI + trigger endpoints
7. Config endpoints + Config UI (TARGET_REPO_PATH)
8. Repo validation + git service
9. Lock implementation + UI disablement
10. Aider runner + agent_runs
11. Test runner + stored results
12. System status endpoint + status UI

---

## 5) CHECK INTEGRATION (how pieces connect)
- activeProjectId must be included on all project-scoped requests.
- TARGET_REPO_PATH must be set before Aider/git/test endpoints are usable.
- Lock must cover all repo-mutating operations.
- Agent outputs must map to UI panels and DB storage.

---

## 6) VALIDATE COMPLETENESS (will plan reach goal)
Much closer to complete.
- The roadmap now includes explicit features to cover the previously identified key gaps.
- Remaining unknowns are now mostly **configurable inputs** (test command) rather than architectural holes.

---

## 7) DEFINE VERIFICATION TESTS
Component checks:
1. Default project created once; no duplicates.
2. Dropdown lists projects; selecting changes activeProjectId.
3. Chat POST stores 2 messages with correct project_id.
4. Chat history returns only selected project’s messages.
5. Plan creation stores objects under correct project.
6. Config: saving TARGET_REPO_PATH persists and can be read back.
7. Repo validation fails cleanly for invalid paths.
8. Lock: starting a run blocks a second run.
9. Aider runner stores output_text + output_json.
10. Git commit stores commit hash and branch name.
11. Test runner stores output and status.
12. Activity log entries are project-scoped.
