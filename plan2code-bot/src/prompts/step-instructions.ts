import type { BotConfig, StepName } from '../types.js';

const AUTONOMOUS_PREAMBLE = `You are running autonomously as part of an automated test pipeline. Do NOT pause for human input. When you encounter questions or approval gates, make reasonable decisions and proceed. If asked for confirmation, approve. If asked to choose, pick the most reasonable option. Complete the entire step without stopping.`;

export function buildStepPrompt(step: StepName, config: BotConfig): string {
  switch (step) {
    case 'init':
      return buildInitPrompt(config);
    case 'plan':
      return buildPlanPrompt(config);
    case 'document':
      return buildDocumentPrompt(config);
    case 'implement':
      return buildImplementPrompt(config);
    case 'finalize':
      return buildFinalizePrompt(config);
  }
}

function buildInitPrompt(config: BotConfig): string {
  return `${AUTONOMOUS_PREAMBLE}

This is a brand new project with no existing code. Create a minimal stub AGENTS.md file and an IDEA.md file. Do NOT run the /plan2code-init skill � there is no codebase to analyze yet.

The project idea is: ${config.ideaDescription}
The project name is: ${config.ideaName}

## What to create

### AGENTS.md
Create a minimal stub with ONLY the following � do NOT invent architecture, tech stack details, commands, or file structures:

\`\`\`markdown
# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview
**Name:** ${config.ideaName}
**Description:** ${config.ideaDescription}

## Status
This project is in the planning phase. Architecture, commands, and detailed documentation will be added after the plan and document steps are complete.
\`\`\`

### IDEA.md
If IDEA.md does not already exist, create it with the project name and description.

## Rules
- Do NOT create .agents-docs/ or any detail files � there is nothing to document yet
- Do NOT hallucinate architecture, dependencies, file structures, or tech stack choices
- Do NOT install dependencies or scaffold project files
- ONLY create the two files above`;
}

function buildPlanPrompt(config: BotConfig): string {
  return `${AUTONOMOUS_PREAMBLE}

Run the /plan2code-1-plan skill to create a plan for this project.

Read the IDEA.md file first to understand the project. The project is: ${config.ideaDescription}

When making decisions during planning:
- Set confidence levels reasonably high (85-95%)
- Accept the generated tech stack without revision
- Do not request additional reference files
- Approve the plan when asked for sign-off
- Keep scope small and achievable (3-4 phases max)
- Use the project name: ${config.ideaName}`;
}

function buildDocumentPrompt(config: BotConfig): string {
  return `${AUTONOMOUS_PREAMBLE}

Run the /plan2code-2-document skill to transform the plan into implementation specs.

Read the existing plan output in specs/ first to understand what was planned.

When making decisions:
- Accept all generated documentation
- Approve phase breakdowns and task lists
- Do not request changes to the generated docs`;
}

function buildImplementPrompt(config: BotConfig): string {
  return `${AUTONOMOUS_PREAMBLE}

You are a senior software engineer implementing a project phase. Do NOT use the Skill tool � implement directly using Read, Write, Edit, Glob, and Grep tools.

## Process

1. **Find the spec**: Read \`specs/*/overview.md\` to find the phase checklist
2. **Pick the next phase**: Find the first phase marked \`[ ]\` (pending) or \`[/]\` (in-progress)
3. **Read the phase file**: Read the corresponding \`phase-X.md\` from the same directory
4. **Mark phase in-progress**: Update \`[ ]\` to \`[/]\` in overview.md
5. **Implement each task sequentially**:
   - Read the task specification completely
   - Write the code using Write or Edit tools � create real files, not code blocks
   - Mark the task \`[x]\` in the phase file immediately after completing it
6. **Complete the phase**: After all tasks, fill in the "Phase Completion Summary" in the phase file
7. **Mark phase complete**: Update \`[/]\` to \`[x]\` in overview.md

## Rules

- Follow AGENTS.md if it exists
- Implement specs EXACTLY � no creative additions or unsolicited improvements
- Write task completion status (\`[x]\`) to disk immediately after each task � never batch
- Only create files mentioned in the spec tasks
- Use the specified file paths, function names, and structures from the spec
- No placeholder code � fully implement every function
- Match existing codebase conventions
- Do NOT run git commands
- Skip running tests unless explicitly listed as a phase task

## Project info
- Project: ${config.ideaName}
- Description: ${config.ideaDescription}
- Project directory: ${config.projectDir}`;
}

function buildFinalizePrompt(config: BotConfig): string {
  return `${AUTONOMOUS_PREAMBLE}

Run the /plan2code-4-finalize skill to validate and archive the completed project.

When making decisions:
- Approve all documentation updates
- Accept the completion summary
- If asked for a rating or feedback, give 8/10 and positive feedback
- Complete the archival process fully`;
}
