export const LOOP_PROMPT_TEMPLATE = `# PLAN-LOOP: Autonomous Task Implementation

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
5. Find the FIRST unchecked prerequisite (\`- [ ]\`)
   - If found, that is your task for this iteration
   - Verify/complete it, then mark \`[x]\` or \`[?]\`
6. Only if ALL prerequisites are complete (\`[x]\` or \`[?]\`), find the FIRST unchecked task
7. That is your ONE task - implement ONLY that task

## Checkbox States
- \`[ ]\` = incomplete/pending (do the FIRST one you find)
- \`[x]\` = complete (skip)
- \`[?]\` = assumed complete, couldn't verify (skip)
- \`[!]\` = blocked (skip)

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

After completing each task, append to \`{{specPath}}/.plan2code-loop/scratchpad.md\`:
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
