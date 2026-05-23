export const LOOP_PROMPT_TEMPLATE = `# PLAN2CODE-LOOP: Autonomous Task Implementation

## CRITICAL CONSTRAINT
**IMPLEMENT EXACTLY ONE TASK PER ITERATION.**
Do NOT implement multiple tasks. Do NOT complete an entire phase.
Find the FIRST unchecked task, implement ONLY that task, then STOP and report.

## Project Information
- **Project Root:** \`{{projectRoot}}\`
- **Spec Location:** \`{{specPath}}\`
- Read \`AGENTS.md\` for project-specific guidance if available

## IMPORTANT: File Locations
- Write ALL code files relative to the **project root** (\`{{projectRoot}}\`)
- The spec directory (\`{{specPath}}\`) is for documentation ONLY - never write code there
- Example: Create \`{{projectRoot}}/src/index.ts\`, NOT \`{{specPath}}/src/index.ts\`

## Iteration
{{iteration}} of {{maxIterations}}

## Task Discovery Process
1. Read \`{{specPath}}/overview.md\` to see all phases
2. Find the FIRST phase with an unchecked checkbox (\`- [ ]\` or \`- [/]\`)
3. Read that phase's file (e.g., \`phase-1.md\`)
4. Check the \`## Prerequisites\` section FIRST
5. Find the FIRST unverified prerequisite (no "VERIFIED" or "ASSUMED" annotation)
   - If found, verify/complete it, then annotate "VERIFIED" or "ASSUMED: [reason]" inline
6. Only if ALL prerequisites are verified or assumed, find the FIRST unchecked task (\`- [ ]\`)
7. That is your ONE task - implement ONLY that task

## Checkbox States (Task items only)
- \`[ ]\` = incomplete/pending (do the FIRST one you find)
- \`[x]\` = complete (skip)
- \`[?]\` = assumed complete, couldn't verify (skip)
- \`[!]\` = blocked (skip)

Prerequisites use plain bullets with inline annotations, not checkboxes.

## Implementation Steps
1. Read and understand the single task
2. Implement it completely
3. Validate it works (run tests if applicable and double-check code)
4. Mark ONLY that task's checkbox as \`[x]\` in the phase file
5. If that was the LAST task in the phase, also mark the phase \`[x]\` in overview.md
6. Output your completion marker and STOP

## Git Policy
**DO NOT create git commits.** The orchestration system handles commits automatically after each task completion. Just implement the code and leave changes uncommitted.

## Completion Markers (REQUIRED FORMAT)
Output exactly ONE of these at the end, including the task ID and description:

**PREREQ_COMPLETE: [prereq_id] - [description]**
Example: \`PREREQ_COMPLETE: P1.1 - Verified Phase 1 complete\`

**PREREQ_ASSUMED: [prereq_id] - [description]**
Example: \`PREREQ_ASSUMED: P2.1 - Design approval (cannot verify)\`

**TASK_COMPLETE: [task_id] - [task_description]**
Example: \`TASK_COMPLETE: 1.1 - Initialize project structure\`

**TASK_BLOCKED: [task_id] - [reason]**
Example: \`TASK_BLOCKED: 2.3 - Missing API credentials\`

**LOOP_COMPLETE**
Use only when ALL phases in overview.md are marked complete.

## Scratchpad Management

After completing each task, add a new entry at the **bottom** of \`{{specPath}}/.plan2code-loop/scratchpad.md\`.
Never edit, reorganize, or insert into existing content — only append new entries to the end of the file.

Each entry should include:
- Task completed and Phase item reference
- Key decisions made and reasoning
- Files changed
- Any blockers or notes for next iteration

Keep entries concise. Sacrifice grammar for concision. This file helps future iterations skip exploration.

If key patterns or learnings were discovered, update \`./AGENTS.md\` if it exists.

## Previous Session Context
{{scratchpadContent}}

---

Remember: ONE TASK ONLY. Find it, implement it, mark it done, output TASK_COMPLETE with the task ID and description, then stop.
`;

export const LOOP_PROMPT_TEMPLATE_PHASE = `# PLAN2CODE-LOOP: Autonomous Phase Implementation

## CRITICAL CONSTRAINT
**IMPLEMENT ALL REMAINING TASKS IN THE CURRENT PHASE.**
Find the first incomplete phase, then implement every remaining task in that phase before stopping.
Complete each task fully before moving to the next task within the phase.

## Project Information
- **Project Root:** \`{{projectRoot}}\`
- **Spec Location:** \`{{specPath}}\`
- Read \`AGENTS.md\` for project-specific guidance if available

## IMPORTANT: File Locations
- Write ALL code files relative to the **project root** (\`{{projectRoot}}\`)
- The spec directory (\`{{specPath}}\`) is for documentation ONLY - never write code there
- Example: Create \`{{projectRoot}}/src/index.ts\`, NOT \`{{specPath}}/src/index.ts\`

## Iteration
{{iteration}} of {{maxIterations}}

## Phase Discovery Process
1. Read \`{{specPath}}/overview.md\` to see all phases
2. Find the FIRST phase with an unchecked checkbox (\`- [ ]\` or \`- [/]\`)
3. Read that phase's file (e.g., \`phase-1.md\`)
4. Check the \`## Prerequisites\` section FIRST
5. Verify ALL unverified prerequisites first, in order
   - Annotate each "VERIFIED" or "ASSUMED: [reason]" inline
6. Once ALL prerequisites are verified, implement ALL unchecked tasks in order
7. Continue until every task in the phase is marked \`[x]\`

## Checkbox States (Task items only)
- \`[ ]\` = incomplete/pending
- \`[x]\` = complete (skip)
- \`[?]\` = assumed complete, couldn't verify (skip)
- \`[!]\` = blocked (skip, note in scratchpad)

Prerequisites use plain bullets with inline annotations, not checkboxes.

## Implementation Steps (repeat for EACH task in the phase)
1. Read and understand the task
2. Implement it completely
3. Validate it works (run tests if applicable and double-check code)
4. Mark that task's checkbox as \`[x]\` in the phase file
5. **Create a git commit** for this task (see Git Policy below)
6. Output a TASK_COMPLETE marker for this task
7. Move to the next unchecked task in the same phase
8. When ALL tasks in the phase are done, mark the phase \`[x]\` in overview.md

## Git Policy
**YOU are responsible for creating git commits after each task.** The orchestration system does NOT handle commits in phase mode.

After completing each task:
\`\`\`bash
git add -A
git commit -m "<commit message>"
\`\`\`

**Commit message format:**
\`\`\`
git add -A
git commit -m "Task X.Y: description" -m "{{jiraTicketId}}" -m "AI Assisted"
\`\`\`
- With JIRA ticket: three \`-m\` flags (description, ticket ID, AI Assisted)
- Without JIRA ticket: two \`-m\` flags (description, AI Assisted)
- ALWAYS include "AI Assisted" as the final \`-m\` flag

Replace X.Y with the actual task ID and description with a concise summary of what was implemented.

## Completion Markers (REQUIRED FORMAT)
Output one of these **after each task** you complete:

**PREREQ_COMPLETE: [prereq_id] - [description]**
Example: \`PREREQ_COMPLETE: P1.1 - Verified Phase 1 complete\`

**PREREQ_ASSUMED: [prereq_id] - [description]**
Example: \`PREREQ_ASSUMED: P2.1 - Design approval (cannot verify)\`

**TASK_COMPLETE: [task_id] - [task_description]**
Example: \`TASK_COMPLETE: 1.1 - Initialize project structure\`

**TASK_BLOCKED: [task_id] - [reason]**
Example: \`TASK_BLOCKED: 2.3 - Missing API credentials\`
If a task is blocked, skip it and continue to the next task.

After ALL tasks in the phase are complete (or blocked), output:
**PHASE_COMPLETE** - if only this phase is done
**LOOP_COMPLETE** - if ALL phases in overview.md are now marked complete

## Scratchpad Management

After completing each task, add a new entry at the **bottom** of \`{{specPath}}/.plan2code-loop/scratchpad.md\`.
Never edit, reorganize, or insert into existing content — only append new entries to the end of the file.

Each entry should include:
- Task completed and Phase item reference
- Key decisions made and reasoning
- Files changed
- Any blockers or notes for next iteration

Keep entries concise. Sacrifice grammar for concision. This file helps future iterations skip exploration.

If key patterns or learnings were discovered, update \`./AGENTS.md\` if it exists.

## Previous Session Context
{{scratchpadContent}}

---

Remember: Complete ALL tasks in the current phase. Implement each task, commit it, output TASK_COMPLETE, then continue to the next. Stop only when the phase is done.
`;
