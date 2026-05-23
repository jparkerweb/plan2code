import path from 'path';
import { confirm, input, select } from '@inquirer/prompts';
import { agentRegistry } from './agents/index.js';
import { StateManager, type SessionConfig, type LoopMode } from './state/index.js';
import { detectSpecDirectories, getSpecProgress } from './spec/utils.js';
import { logger } from './utils/index.js';

export interface SessionSetupResult {
  config: SessionConfig;
  isResume: boolean;
}

/**
 * Detect and select a spec directory
 */
async function selectSpec(cwd: string = process.cwd()): Promise<string | null> {
  // Auto-detect spec directories
  const specDirs = await detectSpecDirectories(cwd);

  if (specDirs.length === 0) {
    logger.error('No spec directories found!');
    logger.info('Expected: specs/<feature>/overview.md');
    logger.info('');
    logger.info('To get started:');
    logger.info('');
    logger.info('1. Create a spec using `plan2code-1-plan`');
    logger.info('   command in our AI Agent');
    logger.info('');
    logger.info('2. Come back here and run `plan2code-loop`');
    logger.info('   as an alternative to `plan2code-3-implement`');
    logger.info('');
    return null;
  }

  if (specDirs.length === 1) {
    const spec = specDirs[0];
    const progress = await getSpecProgress(spec);
    logger.info(`Found spec: ${path.relative(cwd, spec)}`);
    logger.dim(`  Feature: ${progress.featureName}`);
    logger.dim(`  Phases: ${progress.totalPhases}`);
    return spec;
  }

  // Multiple specs - let user choose
  const choices = await Promise.all(
    specDirs.map(async (spec) => {
      const progress = await getSpecProgress(spec);
      const relativePath = path.relative(cwd, spec);
      return {
        name: `${progress.featureName} (${progress.totalPhases} phases) - ${relativePath}`,
        value: spec,
      };
    })
  );

  const selectedSpec = await select({
    message: 'Select spec to implement:',
    choices,
  });

  return selectedSpec;
}

/**
 * Select AI agent
 */
async function selectAgent(): Promise<string> {
  const allAgents = agentRegistry.getAll();

  const agentName = await select({
    message: 'Select AI agent:',
    choices: allAgents.map((agent) => ({
      name: agent.config.displayName,
      value: agent.config.name,
    })),
  });

  return agentName;
}

/**
 * Prompt for JIRA ticket ID
 */
async function promptJiraTicketId(): Promise<string | undefined> {
  const ticketId = await input({
    message: 'JIRA Ticket ID (optional, for commit messages):',
  });

  return ticketId.trim() || undefined;
}

/**
 * Select maximum iterations
 */
async function selectMaxIterations(): Promise<number> {
  const choices = [15, 30, 50, 75, 100, 125, 150, 200];

  const max = await select({
    message: 'Maximum iterations:',
    choices: choices.map((n) => ({
      name: n.toString(),
      value: n,
    })),
    default: 100,
  });

  return max;
}

/**
 * Select loop mode: one task per loop or one phase per loop
 */
async function selectLoopMode(): Promise<LoopMode> {
  const mode = await select<LoopMode>({
    message: 'Tasks per loop iteration:',
    choices: [
      {
        name: 'One task per loop (default)',
        value: 'task' as LoopMode,
      },
      {
        name: 'One phase per loop (related tasks together)',
        value: 'phase' as LoopMode,
      },
    ],
    default: 'task',
  });

  return mode;
}

/**
 * Handle existing session - returns action to take
 */
async function handleExistingSession(
  stateManager: StateManager,
  specPath: string
): Promise<'continue' | 'fresh' | 'new'> {
  const state = await stateManager.detectSessionState(specPath);

  if (state === 'new') {
    return 'new';
  }

  if (state === 'continue') {
    const config = await stateManager.readConfig();
    const lastIter = config?.currentIteration ?? 0;

    logger.info(`Found existing session at iteration ${lastIter}`);

    const continueSession = await confirm({
      message: 'Continue previous session?',
      default: true,
    });

    return continueSession ? 'continue' : 'fresh';
  }

  if (state === 'changed') {
    logger.warning('Spec has changed since last session.');

    const startFresh = await confirm({
      message: 'Start fresh? (This will clear previous progress)',
      default: false,
    });

    return startFresh ? 'fresh' : 'continue';
  }

  return 'new';
}

/**
 * Setup session via interactive prompts
 */
export async function setupSession(
  stateManager: StateManager
): Promise<SessionSetupResult | null> {
  // Show Planny welcome
  logger.welcome();

  // Select spec
  const specPath = await selectSpec(process.cwd());
  if (!specPath) {
    return null;
  }

  // Set spec path on state manager for per-spec state directory
  stateManager.setSpecPath(specPath);

  // Show spec progress
  const progress = await getSpecProgress(specPath);
  console.log();
  logger.header(`Spec: ${progress.featureName}`);
  logger.info(`Phases: ${progress.totalPhases}`);
  console.log();

  // Check for existing session
  const sessionAction = await handleExistingSession(stateManager, specPath);

  if (sessionAction === 'continue') {
    const existingConfig = await stateManager.readConfig();
    if (existingConfig) {
      const agent = await selectAgent();
      existingConfig.agent = agent;
      await stateManager.writeConfig(existingConfig);
      logger.info('Resuming previous session...');
      return { config: existingConfig, isResume: true };
    }
  }

  if (sessionAction === 'fresh') {
    await stateManager.clearState();
  }

  // Collect new session configuration
  const jiraTicketId = await promptJiraTicketId();
  const agent = await selectAgent();
  const loopMode = await selectLoopMode();
  const maxIterations = await selectMaxIterations();

  const config: SessionConfig = {
    agent,
    model: 'default',
    maxIterations,
    specPath,
    timeout: 3,
    maxRetries: 5,
    verbose: false,
    startedAt: new Date().toISOString(),
    currentIteration: 0,
    jiraTicketId,
    loopMode,
  };

  // Initialize session
  await stateManager.initializeNewSession(config);

  return { config, isResume: false };
}
