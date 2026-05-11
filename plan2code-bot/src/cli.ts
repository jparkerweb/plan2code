import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { generateNewAppIdea, generateEnhancementIdea } from './idea-generator.js';
import { runSession } from './session-runner.js';
import { buildStepPrompt } from './prompts/step-instructions.js';
import { checkAllPhasesComplete } from './step-detector.js';
import { saveState, loadState, deleteState, findExistingState } from './bot-state.js';
import { ObservationCollector } from './observation-collector.js';
import { evaluateStep } from './evaluator.js';
import type { BotConfig, BotMode, BotState, StepName, StepResult } from './types.js';

const BANNER = `
  ╔══════════════════════════════════════╗
  ║         plan2code-bot  v1.1.0        ║
  ║   Autonomous Workflow Test Runner    ║
  ╚══════════════════════════════════════╝
`;

const MAX_IMPLEMENT_PASSES = 10;

/** Skill name mapping: bot step name → installed skill directory name */
const SKILL_MAP: Record<StepName, string> = {
  init: 'plan2code-init',
  plan: 'plan2code-1-plan',
  document: 'plan2code-2-document',
  implement: 'plan2code-3-implement',
  finalize: 'plan2code-4-finalize',
};

/**
 * Install bot-friendly copies of plan2code skills into the project's .claude/skills/.
 * The global skills have `disable-model-invocation: true` which prevents the autonomous
 * session from invoking them via the Skill tool. We copy them with that flag removed
 * so the session can invoke the real workflow prompts instead of guessing.
 */
export function installSkillsForBot(projectDir: string): void {
  const userSkillsDir = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.claude',
    'skills',
  );
  const projectSkillsDir = path.join(projectDir, '.claude', 'skills');

  for (const skillName of Object.values(SKILL_MAP)) {
    const srcFile = path.join(userSkillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(srcFile)) continue;

    const content = fs.readFileSync(srcFile, 'utf-8');
    // Remove the disable-model-invocation line so the bot session can invoke the skill
    const patched = content.replace(/^disable-model-invocation:\s*true\n?/m, '');

    const destDir = path.join(projectSkillsDir, skillName);
    fs.ensureDirSync(destDir);
    fs.writeFileSync(path.join(destDir, 'SKILL.md'), patched);
  }
}

export function validateStepArtifacts(step: StepName, projectDir: string): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  switch (step) {
    case 'init': {
      const agentsPath = path.join(projectDir, 'AGENTS.md');
      if (!fs.existsSync(agentsPath)) missing.push('AGENTS.md');
      break;
    }
    case 'plan': {
      const specsDir = path.join(projectDir, 'specs');
      if (!fs.existsSync(specsDir)) {
        missing.push('specs/ directory');
      } else {
        const entries = fs.readdirSync(specsDir, { withFileTypes: true });
        const specDirs = entries.filter((e) => e.isDirectory());
        const hasPlanDraft = specDirs.some((d) => {
          const files = fs.readdirSync(path.join(specsDir, d.name));
          return files.some((f) => /plan[-_]?draft/i.test(f));
        });
        if (!hasPlanDraft) missing.push('specs/*/PLAN-DRAFT-*.md');
      }
      break;
    }
    case 'document': {
      const specsDir = path.join(projectDir, 'specs');
      if (!fs.existsSync(specsDir)) {
        missing.push('specs/ directory');
      } else {
        const entries = fs.readdirSync(specsDir, { withFileTypes: true });
        const specDirs = entries.filter((e) => e.isDirectory());
        let foundOverview = false;
        let foundPhaseFile = false;
        for (const d of specDirs) {
          const specPath = path.join(specsDir, d.name);
          const files = fs.readdirSync(specPath);
          if (files.some((f) => f === 'overview.md')) foundOverview = true;
          if (files.some((f) => /^phase[-_]?\d+.*\.md$/i.test(f))) foundPhaseFile = true;
          // Also check phases/ subdirectory
          const phasesSubdir = path.join(specPath, 'phases');
          if (fs.existsSync(phasesSubdir)) {
            const subFiles = fs.readdirSync(phasesSubdir);
            if (subFiles.some((f) => /phase/i.test(f))) foundPhaseFile = true;
          }
        }
        if (!foundOverview) missing.push('specs/*/overview.md');
        if (!foundPhaseFile) missing.push('specs/*/phase-*.md files');
      }
      break;
    }
    case 'finalize': {
      const completedDir = path.join(projectDir, 'specs--completed');
      if (!fs.existsSync(completedDir)) {
        missing.push('specs--completed/ directory');
      } else {
        const entries = fs.readdirSync(completedDir, { withFileTypes: true });
        const specDirs = entries.filter((e) => e.isDirectory());
        if (specDirs.length === 0) missing.push('archived spec in specs--completed/');
      }
      break;
    }
  }

  return { valid: missing.length === 0, missing };
}

function detectMode(workDir: string): BotMode {
  const agentsPath = path.join(workDir, 'AGENTS.md');
  return fs.existsSync(agentsPath) ? 'enhancement' : 'new-project';
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

async function runStep(
  step: StepName,
  config: BotConfig,
  state: BotState,
): Promise<StepResult> {
  const spinner = ora({
    text: chalk.cyan(`Running ${step} step...`),
    spinner: 'dots',
  }).start();

  const prompt = buildStepPrompt(step, config);

  try {
    // Create observation collector
    const collector = new ObservationCollector(step);

    const result = await runSession({
      prompt,
      config,
      step,
      maxTurns: step === 'implement' ? 80 : 50,
      collector,
    });

    if (result.success) {
      spinner.succeed(
        chalk.green(`${step} completed in ${formatDuration(result.duration)}`)
      );

      // Run evaluation
      spinner.text = chalk.cyan('Evaluating step quality...');
      spinner.start();

      const evaluation = await evaluateStep(step, result.observations, config.projectDir);

      spinner.succeed(
        chalk.cyan(`Evaluation complete: ${formatScore(evaluation.score)}`)
      );

      // Display evaluation summary
      console.log(chalk.dim(`  Score: ${formatScore(evaluation.score)}`));
      if (evaluation.strengths.length > 0) {
        console.log(chalk.green(`  ✓ ${evaluation.strengths[0]}`));
      }
      if (evaluation.weaknesses.length > 0) {
        console.log(chalk.yellow(`  ⚠ ${evaluation.weaknesses[0]}`));
      }

      const stepResult: StepResult = {
        step,
        success: result.success,
        sessionId: result.sessionId,
        duration: result.duration,
        error: null,
        evaluation,
        observations: result.observations,
      };

      return stepResult;
    } else {
      spinner.fail(chalk.red(`${step} failed after ${formatDuration(result.duration)}`));

      return {
        step,
        success: false,
        sessionId: result.sessionId,
        duration: result.duration,
        error: 'Session failed',
        observations: result.observations,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${step} error: ${errorMsg}`));
    return {
      step,
      success: false,
      sessionId: null,
      duration: 0,
      error: errorMsg,
    };
  }
}

function formatScore(score: number): string {
  if (score >= 85) return chalk.green(`${score}/100`);
  if (score >= 70) return chalk.yellow(`${score}/100`);
  return chalk.red(`${score}/100`);
}

export interface CLIOptions {
  idea?: string;
  resume?: boolean;
}

/** Check if a step completed successfully in a saved state */
function stepSucceeded(state: BotState, step: StepName): boolean {
  return state.steps.some((s) => s.step === step && s.success);
}

export async function runCLI(options: CLIOptions = {}): Promise<void> {
  console.log(chalk.cyan(BANNER));

  const workDir = process.cwd();

  // Check for resumable state
  let resuming = false;
  let savedState: BotState | null = null;

  if (options.resume) {
    savedState = findExistingState(workDir);
    if (savedState) {
      resuming = true;
      console.log(chalk.yellow('Resuming previous incomplete run...'));
    } else {
      console.log(chalk.dim('No previous state found, starting fresh.'));
    }
  }

  const mode = resuming ? savedState!.config.mode : detectMode(workDir);

  console.log(chalk.dim(`Working directory: ${workDir}`));
  console.log(chalk.dim(`Mode: ${mode === 'new-project' ? 'New Project' : 'Enhancement'}`));
  if (options.idea) {
    console.log(chalk.dim(`Idea seed: ${options.idea}`));
  }
  console.log('');

  let ideaName: string;
  let ideaDescription: string;
  let projectDir: string;

  if (resuming) {
    // Restore from saved state
    ideaName = savedState!.config.ideaName;
    ideaDescription = savedState!.config.ideaDescription;
    projectDir = savedState!.config.projectDir;
    console.log(chalk.green(`Restored idea: ${ideaName}`));
    console.log(chalk.dim(`  ${ideaDescription}`));
    console.log('');
  } else {
    // Step 1: Generate idea
    const ideaSpinner = ora({
      text: chalk.cyan('Generating idea...'),
      spinner: 'dots',
    }).start();

    try {
      if (mode === 'new-project') {
        const idea = await generateNewAppIdea(options.idea);
        ideaName = idea.name;
        ideaDescription = idea.description;
      } else {
        const idea = await generateEnhancementIdea(workDir, options.idea);
        ideaName = idea.name;
        ideaDescription = idea.description;
      }
      ideaSpinner.succeed(chalk.green(`Idea generated: ${ideaName}`));
    } catch (error) {
      ideaSpinner.fail(chalk.red('Failed to generate idea'));
      throw error;
    }

    console.log(chalk.dim(`  ${ideaDescription}`));
    console.log('');

    // Determine project directory
    projectDir = mode === 'new-project'
      ? path.join(workDir, ideaName)
      : workDir;

    // Create project directory for new projects
    if (mode === 'new-project') {
      fs.ensureDirSync(projectDir);
    }
  }

  // Install bot-friendly skills (without disable-model-invocation)
  installSkillsForBot(projectDir);
  console.log(chalk.dim('Installed plan2code skills for bot sessions'));

  // Write IDEA.md (only if not resuming past plan step, since it gets moved)
  if (!resuming || !stepSucceeded(savedState!, 'plan')) {
    const ideaContent = `# ${ideaName}\n\n${ideaDescription}\n`;
    fs.writeFileSync(path.join(projectDir, 'IDEA.md'), ideaContent);
    console.log(chalk.dim(`Wrote IDEA.md to ${projectDir}`));
  }
  console.log('');

  // Build config
  const config: BotConfig = {
    workDir,
    projectDir,
    ideaDescription,
    ideaName,
    mode,
  };

  // Initialize or restore state
  const state: BotState = resuming
    ? { ...savedState!, config }
    : {
        config,
        steps: [],
        currentStep: null,
        implementPasses: 0,
        allPhasesComplete: false,
      };

  // Step 2: Run init (new project only)
  if (mode === 'new-project') {
    if (resuming && stepSucceeded(savedState!, 'init')) {
      console.log(chalk.dim('--- Init (skipped — previously succeeded) ---'));
    } else {
      console.log(chalk.bold('--- Init ---'));
      state.currentStep = 'init';
      const initResult = await runStep('init', config, state);
      state.steps.push(initResult);
      saveState(state);

      if (!initResult.success) {
        console.log(chalk.red('\nInit failed. Aborting.'));
        printSummary(state, workDir, false);
        return;
      }
      const initValidation = validateStepArtifacts('init', projectDir);
      if (!initValidation.valid) {
        console.log(chalk.yellow(`  ⚠ Missing artifacts: ${initValidation.missing.join(', ')}`));
        initResult.success = false;
        initResult.error = `Missing artifacts: ${initValidation.missing.join(', ')}`;
        console.log(chalk.red('\nInit artifacts missing. Aborting.'));
        printSummary(state, workDir, false);
        return;
      }
    }
    console.log('');
  }

  // Step 3: Plan
  if (resuming && stepSucceeded(savedState!, 'plan')) {
    console.log(chalk.dim('--- Plan (skipped — previously succeeded) ---'));
  } else {
    console.log(chalk.bold('--- Plan ---'));
    state.currentStep = 'plan';
    const planResult = await runStep('plan', config, state);
    state.steps.push(planResult);
    saveState(state);

    if (!planResult.success) {
      console.log(chalk.red('\nPlan step failed. Aborting.'));
      printSummary(state, workDir, false);
      return;
    }
    const planValidation = validateStepArtifacts('plan', projectDir);
    if (!planValidation.valid) {
      console.log(chalk.yellow(`  ⚠ Missing artifacts: ${planValidation.missing.join(', ')}`));
      planResult.success = false;
      planResult.error = `Missing artifacts: ${planValidation.missing.join(', ')}`;
      console.log(chalk.red('\nPlan artifacts missing. Aborting.'));
      printSummary(state, workDir, false);
      return;
    }

    // Move IDEA.md into the spec directory so it stays with its feature
    const ideaPath = path.join(projectDir, 'IDEA.md');
    if (fs.existsSync(ideaPath)) {
      const specEntries = fs.readdirSync(path.join(projectDir, 'specs'), { withFileTypes: true });
      const firstSpecDir = specEntries.find((e) => e.isDirectory());
      if (firstSpecDir) {
        const dest = path.join(projectDir, 'specs', firstSpecDir.name, 'IDEA.md');
        fs.moveSync(ideaPath, dest, { overwrite: true });
        console.log(chalk.dim(`Moved IDEA.md → specs/${firstSpecDir.name}/IDEA.md`));
      }
    }
  }
  console.log('');

  // Step 4: Document
  if (resuming && stepSucceeded(savedState!, 'document')) {
    console.log(chalk.dim('--- Document (skipped — previously succeeded) ---'));
  } else {
    console.log(chalk.bold('--- Document ---'));
    state.currentStep = 'document';
    const docResult = await runStep('document', config, state);
    state.steps.push(docResult);
    saveState(state);

    if (!docResult.success) {
      console.log(chalk.red('\nDocument step failed. Aborting.'));
      printSummary(state, workDir, false);
      return;
    }
    const docValidation = validateStepArtifacts('document', projectDir);
    if (!docValidation.valid) {
      console.log(chalk.yellow(`  ⚠ Missing artifacts: ${docValidation.missing.join(', ')}`));
      docResult.success = false;
      docResult.error = `Missing artifacts: ${docValidation.missing.join(', ')}`;
      console.log(chalk.red('\nDocument artifacts missing. Aborting.'));
      printSummary(state, workDir, false);
      return;
    }
  }
  console.log('');

  // Step 5: Implement (loop until all phases complete)
  if (resuming && savedState!.allPhasesComplete) {
    console.log(chalk.dim('--- Implement (skipped — all phases already complete) ---'));
  } else {
    console.log(chalk.bold('--- Implement ---'));
    while (state.implementPasses < MAX_IMPLEMENT_PASSES) {
      state.implementPasses++;
      state.currentStep = 'implement';

      console.log(chalk.dim(`  Pass ${state.implementPasses}/${MAX_IMPLEMENT_PASSES}`));
      const implResult = await runStep('implement', config, state);
      state.steps.push(implResult);
      saveState(state);

      if (!implResult.success) {
        console.log(chalk.yellow(`\nImplement pass ${state.implementPasses} failed. Continuing...`));
      }

      // Check if all phases are complete
      if (checkAllPhasesComplete(projectDir)) {
        state.allPhasesComplete = true;
        saveState(state);
        console.log(chalk.green('  All phases complete!'));
        break;
      }
    }

    if (!state.allPhasesComplete && state.implementPasses >= MAX_IMPLEMENT_PASSES) {
      console.log(chalk.yellow(`\nMax implement passes (${MAX_IMPLEMENT_PASSES}) reached.`));
    }
  }
  console.log('');

  // Step 6: Finalize
  if (resuming && stepSucceeded(savedState!, 'finalize')) {
    console.log(chalk.dim('--- Finalize (skipped — previously succeeded) ---'));
  } else {
    console.log(chalk.bold('--- Finalize ---'));

    // Check quality gate: average score must be >= 60
    const evaluatedSteps = state.steps.filter((s) => s.evaluation);
    if (evaluatedSteps.length > 0) {
      const avgScore =
        evaluatedSteps.reduce((sum, s) => sum + (s.evaluation?.score ?? 0), 0) /
        evaluatedSteps.length;

      console.log(chalk.dim(`  Average quality score: ${formatScore(Math.round(avgScore))}`));

      if (avgScore < 60) {
        console.log(
          chalk.red(
            '\n⚠ Quality gate failed: Average score is below 60. Please review and fix issues before finalizing.'
          )
        );
        console.log(chalk.dim('  Check specs/<feature>/BOT-EVALUATION.md for detailed feedback.'));
        printSummary(state, workDir, false);
        return;
      }
    }

    state.currentStep = 'finalize';
    const finalizeResult = await runStep('finalize', config, state);
    state.steps.push(finalizeResult);
    saveState(state);

    if (finalizeResult.success) {
      const finalValidation = validateStepArtifacts('finalize', projectDir);
      if (!finalValidation.valid) {
        console.log(chalk.yellow(`  ⚠ Missing artifacts: ${finalValidation.missing.join(', ')}`));
        finalizeResult.success = false;
        finalizeResult.error = `Missing artifacts: ${finalValidation.missing.join(', ')}`;
        saveState(state);
      }
    }
  }
  console.log('');

  // Determine overall success
  const allSucceeded = state.steps.length > 0 && state.steps.every((s) => s.success);
  printSummary(state, workDir, allSucceeded);

  // Clean up state file on full success
  if (allSucceeded) {
    deleteState(projectDir);
    console.log(chalk.dim('Cleaned up state file (run succeeded)'));
  } else {
    console.log(chalk.dim('State file preserved for resume (run incomplete)'));
  }
  console.log('');
}

function printSummary(state: BotState, workDir: string, allSucceeded: boolean): void {
  const { ideaName, mode, projectDir } = state.config;

  console.log(chalk.cyan('═══════════════════════════════════════'));
  console.log(chalk.bold('  Bot Run Summary'));
  console.log(chalk.cyan('═══════════════════════════════════════'));
  console.log(chalk.dim(`  Project: ${ideaName}`));
  console.log(chalk.dim(`  Mode: ${mode}`));
  console.log(chalk.dim(`  Directory: ${projectDir}`));
  console.log('');

  const totalDuration = state.steps.reduce((sum, s) => sum + s.duration, 0);
  const successCount = state.steps.filter((s) => s.success).length;

  for (const step of state.steps) {
    const icon = step.success ? chalk.green('✓') : chalk.red('✗');
    const scoreText = step.evaluation
      ? ` [${formatScore(step.evaluation.score)}]`
      : '';
    console.log(
      `  ${icon} ${step.step.padEnd(12)} ${formatDuration(step.duration)}${scoreText}`
    );
  }

  console.log('');

  // Display average quality score if available
  const evaluatedSteps = state.steps.filter((s) => s.evaluation);
  if (evaluatedSteps.length > 0) {
    const avgScore =
      evaluatedSteps.reduce((sum, s) => sum + (s.evaluation?.score ?? 0), 0) /
      evaluatedSteps.length;
    console.log(
      chalk.dim(`  Average quality: ${formatScore(Math.round(avgScore))}`)
    );
  }

  console.log(
    chalk.dim(
      `  Total: ${successCount}/${state.steps.length} steps succeeded in ${formatDuration(totalDuration)}`
    )
  );
  console.log(chalk.dim(`  Implement passes: ${state.implementPasses}`));
  if (!allSucceeded) {
    console.log(
      chalk.dim(
        `  State saved to: ${path.relative(workDir, projectDir)}/.plan2code-bot-state.json`
      )
    );
  }
  console.log('');
}
