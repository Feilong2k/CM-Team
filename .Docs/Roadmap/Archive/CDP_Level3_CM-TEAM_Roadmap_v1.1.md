t # CDP Level 3 — CM-TEAM Feature-Based Roadmap v1.1 (Updated to Address Key Gaps)

Source plan:
- `.Docs/Roadmap/CM-TEAM_Roadmap_FeatureBased_v1.1.md`

---

## PART 1: RESOURCE ANALYSIS
| Resource | Current State | Who Uses It | Exclusive/Shared |
|---|---|---|---|
| PostgreSQL (VM) | Running; reachable via DATABASE_URL | backend + Orion + UI | Shared |
| DeepSeek API | Key in env | OrionAgent | Shared (rate limited) |
| TARGET_REPO_PATH | Configurable (MVP) | Tara/Devon/Aider, git, test runner | Shared (high contention) |
| Git repo at TARGET_REPO_PATH | Must exist and be valid | git service | Shared |
| Aider CLI | Installed, needs config | Tara/Devon runners | Exclusive per run |
| Test runner command | Configurable per target repo | backend test runner | Exclusive per run |
| runtime_locks table | Will store busy state | backend | Shared |
| system_config table | Stores TARGET_REPO_PATH + optional TEST_COMMAND | backend + UI | Shared |
| Network ports | backend + frontend | all | Shared |

---

## PART 2: OPERATION ANALYSIS (CRITICAL)
| Operation | Physical Change? | Locks? | 2 Actors Simultaneously? |
|---|---:|---|---|
| Save TARGET_REPO_PATH | Yes (DB write) | row lock | Yes |
| Validate repo path | No/Yes (FS read) | N/A | Yes |
| Run Aider (tests/impl) | Yes (FS changes) | needs lock | **HIGH RISK** if parallel |
| Git branch/commit | Yes (git + FS) | needs lock | **HIGH RISK** if parallel |
| Run tests | Yes (process; reads FS) | needs lock | High risk if parallel |
| Write chat_messages | Yes (DB write) | row lock | Yes |
| Create plan objects | Yes (DB write) | row lock | Yes |

---

## PART 3: ACTOR ANALYSIS
| Actor | Resources They Touch | Same Resource Same Time? |
|---|---|---|
| User (you) | UI actions, config edits | Yes |
| OrionAgent | DB + DeepSeek | Yes |
| TaraAgent | TARGET_REPO_PATH + Aider + git | Collides with Devon without lock |
| DevonAgent | TARGET_REPO_PATH + Aider + git | Collides with Tara without lock |
| Backend | DB + processes + FS | Central |

---

## PART 4: ASSUMPTION AUDIT (>=10)
| # | Assumption | Explicit/Implicit | Breaks if FALSE | Risk |
|---:|---|---|---|---|
| 1 | DATABASE_URL reachable | Explicit | DB ops fail | High |
| 2 | TARGET_REPO_PATH is set before agent runs | Explicit (via Config feature) | Aider/git/test cannot run | High |
| 3 | Repo validation is correct | Implicit | Wrong repo modified | High |
| 4 | Aider available on PATH | Explicit check | Tara/Devon fails | High |
| 5 | Lock prevents concurrent runs | Explicit feature | Repo corruption | High |
| 6 | Lock survives restart (DB-backed) | Explicit | stale busy state or double runs | Medium |
| 7 | Test command is correct for repo | Implicit/configurable | false failures | Medium |
| 8 | Agent report schema is sufficient for UI | Implicit | unreadable results | Medium |
| 9 | DeepSeek key valid | Explicit | chat/planning fails | High |
|10 | Project scoping is enforced | Explicit | cross-project data leakage | Medium |
|11 | User handles merges | Explicit | not blocked | Low |
|12 | Windows subprocess env works for git/aider | Implicit | run failures | Medium |

---

## PART 5: PHYSICAL VS LOGICAL CHECK (WORKTREE TRAP)
| Claimed Separation | Mechanism | Physical/Logical | If Mechanism Fails? |
|---|---|---|---|
| Tara vs Devon separation | roles | Logical | same TARGET_REPO_PATH ⇒ collisions |
| Different subtasks separate | different IDs | Logical | same working tree ⇒ collisions |
| Lock ensures safety | DB row | Physical-ish | if lock code buggy ⇒ corruption |

---

## PART 6: FINAL VERDICT
1. Physical constraints discovered:
   - TARGET_REPO_PATH is a single shared physical resource.
   - git index + working directory are contention points.
2. Logical separations sharing physical resources: still present, but mitigated by lock.
3. VERDICT: **CONDITIONALLY SAFE (Improved)**
4. REQUIRED MITIGATIONS (now explicitly in roadmap):
   - DB-backed single-run lock wraps Aider/git/test runs.
   - TARGET_REPO_PATH required + validated.
   - Optional configurable TEST_COMMAND.

---

## PART 6: GAP ANALYSIS (CRITICAL)
| Gap | Possible Interpretations | Answer Under Each |
|---|---|---|
| Test command storage | A: hardcoded / B: env var / C: DB config | A: brittle / B: ok / C: best UX |
| Aider provider/model | A: user sets globally / B: per-project config later | A: MVP ok / B: future feature |
| Lock ownership semantics | A: lock by agent name / B: lock by request id | A: readable / B: more robust |
| Repo registry (future) | A: 1 repo only / B: many repos per project | A: MVP ok / B: future feature |

---

## PART 7: CONDITIONAL VERDICT
- IF lock is correctly enforced around all repo-mutating operations THEN system is SAFE for MVP.
- IF lock is bypassed (bug or missing wrapper) THEN system becomes UNSAFE.
- IF TARGET_REPO_PATH is misconfigured THEN system is SAFE but non-functional (should show clear status errors).
