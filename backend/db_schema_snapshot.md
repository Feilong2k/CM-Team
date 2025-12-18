# Current Database Schema Snapshot

_Last updated: 2025-12-17_

---

## features

- id (integer, PK)
- project_id (varchar)
- title (varchar, NOT NULL)
- status (varchar, NOT NULL, default 'draft')
- created_at (timestamp with time zone, default now)
- updated_at (timestamp with time zone, default now)
- basic_info (jsonb)
- pcc (jsonb)
- activity_log (jsonb)
- pvp_analysis (jsonb)
- fap_analysis (jsonb)
- external_id (varchar, UNIQUE)

---

## planning_docs

- id (integer, PK)
- project_id (varchar)
- title (varchar)
- type (varchar)
- content_md (text)
- status (varchar)
- external_id (varchar, UNIQUE)
- revision (integer, default 1)
- created_at (timestamp with time zone, default now)
- updated_at (timestamp with time zone, default now)

---

## tasks

- id (integer, PK)
- feature_id (integer, NOT NULL)
- title (varchar, NOT NULL)
- status (varchar, NOT NULL, default 'pending')
- linked_plan_id (integer)
- created_at (timestamp with time zone, default now)
- updated_at (timestamp with time zone, default now)
- basic_info (jsonb)
- pcc (jsonb)
- activity_log (jsonb)
- pvp_analysis (jsonb)

---

## subtasks

- id (integer, PK)
- task_id (integer, NOT NULL)
- title (varchar, NOT NULL)
- status (varchar, NOT NULL, default 'pending')
- parent_id (integer)
- created_at (timestamp with time zone, default now)
- updated_at (timestamp with time zone, default now)
- basic_info (jsonb)
- instruction (jsonb)
- pcc (jsonb)
- activity_log (jsonb)
- tests (jsonb)
- implementations (jsonb)
- review (jsonb)

---

## task_steps

- id (integer, PK)
- subtask_id (integer, NOT NULL)
- agent_role (varchar, NOT NULL)
- prompt (text, NOT NULL)
- status (varchar, NOT NULL, default 'pending')
- created_at (timestamp with time zone, default now)
- updated_at (timestamp with time zone, default now)

---

## migration_test

- id (integer, PK)
- name (varchar, NOT NULL)
- created_at (timestamp, default now)

---

_Edit this file to indicate what columns you want to add/remove/rename, and I will apply the changes for you._
