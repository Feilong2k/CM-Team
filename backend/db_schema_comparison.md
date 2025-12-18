# Import File vs. Database Schema Comparison

_Last updated: 2025-12-17_

---

## planning_docs

**Import file fields:**
- externalId
- projectId
- title
- type
- status
- revision

**DB columns:**
- id
- project_id
- title
- type
- content_md
- status
- external_id
- revision
- created_at
- updated_at

**Differences:**
- **In import but not in DB:** None (all import fields are present in DB, but note the field name mapping: externalId → external_id, projectId → project_id)
- **In DB but not in import:** id, content_md, created_at, updated_at
-

---

## features

**Import file fields:**
- externalId
- title
- status
- basic_info
- activity_log
- pcc
- cap
- red
- tasks

**DB columns:**
- id
- project_id
- title
- status
- created_at
- updated_at
- basic_info
- pcc
- activity_log
- pvp_analysis
- fap_analysis
- external_id
- cap *(added via script, should now exist)*
- red *(added via script, should now exist)*

**Differences:**
- **In import but not in DB:** None (cap and red were just added, so all import fields should now be present) 
NOTE: Is RED and CAP added as JSONB? if so leave them alone, if not make them JSONB
- **In DB but not in import:** id, project_id, created_at, updated_at, pvp_analysis, fap_analysis
NOTE: delete pvp_analysis, fap_analysis
---

## tasks

**Import file fields:**
- externalId
- title
- status
- basic_info
- activity_log
- pcc
- cap
- subtasks

**DB columns:**
- id
- feature_id
- title
- status
- linked_plan_id
- created_at
- updated_at
- basic_info
- pcc
- activity_log
- pvp_analysis

**Differences:**
- **In import but not in DB:** 
  - externalId (import expects external_id, DB does not have it)
  - cap (import expects cap, DB does not have it)
- **In DB but not in import:** 
  - id, feature_id, linked_plan_id, created_at, updated_at, pvp_analysis
  NOTE: Change pvp_analysis to cap

---

## subtasks

**Import file fields:**
- externalId
- title
- status
- basic_info
- activity_log
- pcc
- subtasks

**DB columns:**
- id
- task_id
- title
- status
- parent_id
- created_at
- updated_at
- basic_info
- instruction
- pcc
- activity_log
- tests
- implementations
- review

**Differences:**
- **In import but not in DB:** 
  - externalId (import expects external_id, DB does not have it)
- **In DB but not in import:** 
  - id, task_id, parent_id, created_at, updated_at, instruction, tests, implementations, review
---

## Notes

- The import file uses camelCase (e.g., externalId, projectId), while the DB uses snake_case (e.g., external_id, project_id). The importer should handle this mapping.
- **Missing in DB:** tasks table is missing external_id and cap columns; subtasks table is missing external_id column. These are required for import compatibility.
- **Extra in DB:** Some columns (e.g., pvp_analysis, fap_analysis, instruction, tests, implementations, review) are present in DB but not used in the current import file.

---

**Action Items:**
- [ ] Add external_id and cap columns to tasks.
- [ ] Add external_id column to subtasks.
- [ ] (Optional) Remove/ignore unused columns if not needed.

_Edit this file to confirm or adjust the changes you want, and I will apply them for you._
