import type { StepName } from '../types.js';

export interface StepEvaluationCriteria {
  step: StepName;
  keyArtifacts: string[];
  qualityChecks: string[];
  commonPitfalls: string[];
  scoringGuidance: string;
}

export const EVALUATION_CRITERIA: Record<StepName, StepEvaluationCriteria> = {
  init: {
    step: 'init',
    keyArtifacts: ['AGENTS.md', 'IDEA.md'],
    qualityChecks: [
      'AGENTS.md exists with project name and description',
      'AGENTS.md includes a brief intro line and a Status section indicating the project is in planning phase',
      'AGENTS.md does NOT contain hallucinated architecture, commands, file structures, or tech stack details',
      'No .agents-docs/ directory was created (too early for detail files)',
      'No project scaffolding (package.json, dependencies, src/) was created',
      'IDEA.md exists with the project idea',
    ],
    commonPitfalls: [
      'Hallucinating architecture or tech stack details before the plan step',
      'Creating .agents-docs/ detail files with invented content',
      'Scaffolding project files or installing dependencies prematurely',
    ],
    scoringGuidance: `
      100 = Perfect: AGENTS.md stub with intro line, project name/description, and status section. IDEA.md present. Nothing else created.
      85-95 = Good but minor extra content beyond the expected stub format (e.g., an extra placeholder heading)
      70-84 = AGENTS.md exists but includes some hallucinated details (e.g., assumed tech stack or commands)
      50-69 = Significant hallucination (e.g., .agents-docs/ created with invented content, project scaffolded)
      <50 = Major problems (e.g., AGENTS.md missing, full project structure hallucinated)

      The expected AGENTS.md format is: intro line, Project Overview (name + description), and a Status section. This is the target for a 100 score.
    `,
  },

  plan: {
    step: 'plan',
    keyArtifacts: ['specs/*/PLAN-DRAFT-*.md', 'IDEA.md'],
    qualityChecks: [
      'Plan breaks work into clear, achievable phases',
      'Each phase has specific goals and deliverables',
      'Technical approach is appropriate',
      'Scope is realistic for the idea',
      'Dependencies between phases are identified',
    ],
    commonPitfalls: [
      'Phases too vague ("polish the app")',
      'Missing specific tasks within phases',
      'No testing strategy mentioned',
      'Overly ambitious scope',
      'Missing file paths or specific actions',
    ],
    scoringGuidance: `
      100 = Exceptional plan: detailed phases, realistic scope, clear tasks, testing included
      85-95 = Good plan with minor improvements possible (e.g., one phase could be more specific)
      70-84 = Acceptable but has vague sections or missing testing strategy
      50-69 = Significant issues (e.g., multiple vague phases, unrealistic scope)
      <50 = Major problems (e.g., no clear phases, plan doesn't match idea)

      Most plans should score 70-85. Be critical of vague language.
    `,
  },

  document: {
    step: 'document',
    keyArtifacts: ['specs/*/overview.md', 'specs/*/phase-*.md files'],
    qualityChecks: [
      'overview.md provides clear project summary',
      'Each phase file has specific tasks with checkboxes',
      'File paths are explicit (not generic)',
      'Dependencies between tasks are identified',
      'Technical details are specific',
      'Acceptance criteria are clear',
    ],
    commonPitfalls: [
      'Tasks too generic ("implement feature X")',
      'Missing file paths',
      'No checkboxes or unclear task structure',
      'Missing dependencies',
      'Overly verbose or lacking specifics',
    ],
    scoringGuidance: `
      100 = Exceptional documentation: specific tasks, explicit file paths, clear dependencies
      85-95 = Good documentation with minor vagueness in one or two tasks
      70-84 = Acceptable but multiple tasks lack specifics or file paths
      50-69 = Significant issues (e.g., many generic tasks, missing file paths)
      <50 = Major problems (e.g., tasks don't match plan, fundamentally vague)

      Most documentation should score 70-85. Penalize generic language heavily.
    `,
  },

  implement: {
    step: 'implement',
    keyArtifacts: ['actual code files', 'checked-off tasks in phase files'],
    qualityChecks: [
      'Phase tasks are being completed',
      'Code files are actually created/modified',
      'Implementation follows the documented plan',
      'No major errors blocking progress',
      'Tests are written (if applicable)',
    ],
    commonPitfalls: [
      'Tasks marked complete but files not actually changed',
      'Implementation deviates significantly from plan',
      'Errors not addressed',
      'Skipping tests without justification',
      'Working on wrong phase',
    ],
    scoringGuidance: `
      100 = Exceptional implementation: all tasks complete, code works, tests pass
      85-95 = Good implementation with minor issues or incomplete tests
      70-84 = Acceptable but some tasks incomplete or code has issues
      50-69 = Significant issues (e.g., many tasks incomplete, code doesn't work)
      <50 = Major problems (e.g., wrong phase, no actual work done)

      Implementation scoring depends heavily on actual progress. Be realistic.
    `,
  },

  finalize: {
    step: 'finalize',
    keyArtifacts: ['specs--completed/', 'README or docs', 'final code state'],
    qualityChecks: [
      'All phases are marked complete',
      'Spec moved to specs--completed/',
      'Documentation is updated',
      'Code is in working state',
      'No obvious loose ends',
    ],
    commonPitfalls: [
      'Incomplete phases',
      'Missing specs--completed/ move',
      'Documentation not updated',
      'Code broken or incomplete',
      'Unrealistic self-assessment',
    ],
    scoringGuidance: `
      100 = Exceptional finalization: everything complete, polished, documented
      85-95 = Good finalization with minor issues
      70-84 = Acceptable but some loose ends or documentation gaps
      50-69 = Significant issues (e.g., incomplete phases, broken code)
      <50 = Major problems (e.g., work not actually done, fundamentally incomplete)

      Finalize scores should reflect overall project quality. Be honest.
    `,
  },
};

/**
 * Gets evaluation criteria for a specific step.
 */
export function getCriteriaForStep(step: StepName): StepEvaluationCriteria {
  return EVALUATION_CRITERIA[step];
}
