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

Run the /plan2code-init skill to generate an AGENTS.md file for this project.

The project idea is: ${config.ideaDescription}
The project name is: ${config.ideaName}

When asked questions:
- For the project description, use the idea above
- Accept all defaults and approve all gates
- Complete the init process fully`;
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

Run the /plan2code-3-implement skill to implement the next available phase.

When making decisions:
- Pick the first available/unchecked phase
- Write working code that fulfills the spec tasks
- Mark tasks as complete as you finish them
- Approve and sign off when the phase is done
- Skip running tests if asked (or select the simplest test option)`;
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
