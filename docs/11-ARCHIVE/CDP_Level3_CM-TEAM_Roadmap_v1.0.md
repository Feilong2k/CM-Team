# CDP Level 3 — CM-TEAM Feature-Based Roadmap v1.0

Source plan:
- `.Docs/Roadmap/CM-TEAM_Roadmap_FeatureBased_v1.0.md`

---

## PART 1: RESOURCE ANALYSIS
| Resource | Current State | Who Uses It | Exclusive/Shared |
|---|---|---|---|
| PostgreSQL (VM) | Running; reachable via DATABASE_URL | Orion (chat, planning), backend APIs | Shared |
| DeepSeek API | Key in backend env | OrionAgent | Shared (rate limited) |
| File system (CM-TEAM repo) | Local working directory | backend, Aider, git | Shared (high contention) |
| Target code repo (UNKNOWN) | Not specified | Tara/Devon/Aider, git | Shared (high contention) |
| Git CLI / repo | Installed; repo path not specified | backend git service | Exclusive per operation, shared overall |
| Network ports | 3500 backend, 6700-6799 frontend | backend + frontend | Shared |
| Aider CLI | Installed, not configured | Tara/Devon runners | Exclusive per run, shared install |
| OS process execution | child_process | backend runners | Shared |

---

## PART 2: OPERATION ANALYSIS (CRITICAL)
| Operation | Physical Change? | Locks? | 2 Actors Simultaneously? |
|---|---:|---|---|
| Write chat_messages | Yes (DB write) | DB row locks | Yes (multiple chats) |
| Create plan (features/tasks/subtasks) | Yes (DB write) | DB row locks | Yes |
| Trigger status change | Yes (DB write) | DB row locks | Yes |
| Run Aider (tests/impl) | Yes (FS changes) | Implicit FS contention | **HIGH RISK** if parallel |
| Run git branch/commit | Yes (git + FS) | git index/working tree | **HIGH RISK** if parallel |
| Orion SQL edits schema | Yes (DB DDL) | table locks | **HIGH RISK** if concurrent app writes |

---

## PART 3: ACTOR ANALYSIS
| Actor | Resources They Touch | Same Resource Same Time? |
|---|---|---|
| User (you) | UI, triggers workflow steps | Yes, with backend |
| OrionAgent | DB, DeepSeek | DB shared; DeepSeek rate limits |
| TaraAgent (Aider) | FS + target repo, git | Potential collision with Devon |
| DevonAgent (Aider) | FS + target repo, git | Potential collision with Tara |
| Backend server | DB, FS, OS processes, git | Yes, central mediator |

---

## PART 4: ASSUMPTION AUDIT (>=10)
| # | Assumption | Explicit/Implicit | Breaks if FALSE | Risk |
|---:|---|---|---|---|
| 1 | DATABASE_URL is reachable from backend host | Explicit | DB operations fail | High |
| 2 | DeepSeek API key valid | Explicit | chat/planning fails | High |
| 3 | Aider can be invoked from backend user account | Implicit | Tara/Devon steps fail | High |
| 4 | Target code repo path is known to backend | Implicit | git/aider run wrong location | High |
| 5 | Only one agent run at a time | Implicit | FS/git corruption | High |
| 6 | Schema changes won’t occur mid-run | Implicit | runtime failures | Medium |
| 7 | Chat belongs to a project or default thread works | Implicit | context mismatch | Medium |
| 8 | Agents can output structured reports reliably | Implicit | DB storage/UI display breaks | Medium |
| 9 | Git is initialized and clean before operations | Implicit | commits fail/conflicts | Medium |
|10 | User will handle merges manually | Explicit | workflow completeness depends on user | Low |
|11 | Windows environment supports subprocess calls consistently | Implicit | aider/git invocation issues | Medium |
|12 | Frontend port range 6700-6799 is acceptable | Explicit | CORS blocks if different | Low |

---

## PART 5: PHYSICAL VS LOGICAL CHECK (WORKTREE TRAP)
| Claimed Separation | Mechanism | Physical/Logical | If Mechanism Fails? |
|---|---|---|---|
| “Tara and Devon work separately” | Different prompts/roles | Logical | Same disk + same repo ⇒ collisions |
| “Different branches per subtask” | Git refs | Logical | Same working tree ⇒ race conditions |
| “Manual control prevents concurrency” | User clicks | Logical | Double-click/retry can still overlap |

**Key finding:** Tara/Devon/Aider + git share the same physical working directory unless we enforce isolation.

---

## PART 6: FINAL VERDICT
1. Physical constraints discovered:
   - Shared working directory + git index are single points of contention.
   - DB DDL operations can lock tables.
   - DeepSeek has rate limits / latency.
2. Logical separations sharing physical resources: **HIGH RISK**
   - Tara vs Devon “separation” is logical only.
3. VERDICT: **CONDITIONALLY SAFE**
4. RECOMMENDED MITIGATIONS:
   - Enforce a **single active agent run** globally (mutex/DB lock).
   - Store and validate a single configured **TARGET_REPO_PATH**.
   - Consider per-run isolated worktrees later (git worktree) for scale.
   - Restrict schema changes to a maintenance window or gated confirmation.

---

## PART 6: GAP ANALYSIS (CRITICAL)
| Gap | Possible Interpretations | Answer Under Each |
|---|---|---|
| Target repo location | A: CM-TEAM repo / B: Separate app repo / C: multiple repos | A: agents modify orchestrator code (bad) / B: clean separation / C: requires repo registry |
| Aider configuration | A: uses .env / B: uses aider config file / C: per-run flags | A: easiest / B: standard / C: flexible but complex |
| Agent report schema | A: freeform text / B: JSON structured / C: hybrid | A: hard to parse / B: best for UI / C: MVP-friendly |
| Test runner | A: backend runs tests / B: Aider runs tests / C: user runs tests | A: automatable / B: opaque / C: manual bottleneck |
| Project-chat binding | A: 1 global thread / B: thread per project / C: thread per feature | A: simplest / B: clearer / C: heavy |
| SQL limitations | A: regex allowlist / B: role-based DB user / C: manual approval UI | A: partial / B: stronger / C: safest for non-programmer |

---

## PART 7: CONDITIONAL VERDICT
- IF **target repo is clearly defined** AND **single-run lock is enforced** THEN plan is **SAFE for MVP**.
- IF **agents can run concurrently in same repo** THEN plan becomes **UNSAFE** (risk of corruption).
- IF **Orion can run unrestricted SQL including destructive DDL** THEN plan is **UNSAFE** without user approval gates.
