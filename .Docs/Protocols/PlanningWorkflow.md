Here is the optimal workflow to go from __Request__ to __Success__:

#### Phase 1: Definition (Adam)

1. __User Request:__ "We need a new workflow..."

2. __Adam Actions:__

   - Drafts the __Technical Spec__.
   - Breaks the Feature into __Tasks__ (The "What").
   - Defines __Acceptance Criteria__.
   - *Output:* `Implementation_Requirements_Draft.md`

#### Phase 2: Audit (Orion)

3. __Orion Actions:__

   - Takes Adam's Draft.
   - __Runs PVP:__ Checks logical sequence (e.g., "Adam put the API call before the DB migration? That will fail.").
   - __Runs CDP:__ Checks resource constraints (e.g., "Adam assumes we have a vector DB, but we don't.").
   - *Output:* `PVP_CDP_Findings.md` (A list of Gaps & Risks). Propose a new roadmap file based on  `Implementation_Requirements_Draft.md` and user requirements


#### Phase 3: Consensus (Joint)

4. __Refinement Loop:__

   - Adam reviews Orion's findings.
   - Adam updates the Spec to address gaps (e.g., "Added DB migration task").
   - __Result:__ `Implementation_Requirements_Final.md` (The SSOT).

#### Phase 4: Logistics (Orion)

5. __Orion Actions:__

   - Breaks Adam's "Tasks" into __Atomic Steps__ (The Step Queue).

   - *Example:* Adam says "Create ChatPanel". Orion expands this to:

     1. "Check for existing `ChatPanel.vue`"
     2. "Write failing test `ChatPanel.spec.js`"
     3. "Implement template structure"

   - *Output:* populated `task_steps` table in DB.


# Example run
## Adam step
I was reviewing @/.Docs/Roadmap/CM-TEAM_Roadmap_v2.0.md I think
1. We missed a step where we setup the Aider agents Tara and Devon, I see it in Feature 6, but shouldn't that be schedule mut earlier in the Roadmap, and what about Devon?
2. Or is it considered done when we can autogenerate context and prompts for these Aider agents? 
3. The scope for Feature 1 is too large, while the other Features is relatively simple, it seems that feature1 is doing too much
4. Per the @/.Docs\Protocols\PlanningWorkflow.md you should generate the Implementation REquirements Draft then Orion do an Audit/analysis on it, why don't we do this, you generate the implementation requirements, rather than breaking it in features, you generate all the tasks that needs to be done, a description, their dependencies, Deliverable, and whatever you think is necessary, Be thorough, we will use this as a template. I wil then Orion do a PVP and CDP on the tasks you generated. He will provide the PVP CDP findings and re-arrange the tasks into different features 
5. We will review the new draft Roadmap and the PVP/CDP findings until we are satisfied with the plan and then lock it in. Generating the implementation requirements final
6. You are creating tasks, not subtasks

Let me know what you think

End Result: .Docs\Roadmap\Orion_System_Task_Inventory_Draft.md

## Orion Step
.Docs\Prompts\OrionPrompts.md You are Orion, we are currently trying to finalize the @/.Docs/Roadmap/Orion_System_Task_Inventory_Draft.md , review @/.Docs/Protocols/PlanningWorkflow.md , @/frontend/tailwind.config.cjs , @/.Docs\Protocols\Plan_Verification_Protocol.md . and I would like you to do the following
1. Perform PVP and CDP on the @/.Docs/Roadmap/Orion_System_Task_Inventory_Draft.md , and generate the findings file
2. I am a non-programmer, so I would like to have a UI first approach in programming, is it possible to organize the new roadmap to reflec that. After each task, I'd like something concrete I can check on to ensure that we got it right
3. You don't have to stick to the task or features that Adam created, just need to make sure that the plan is comprehensive, does not miss anything and have high probability of success

Let me know if you understand my instructions

