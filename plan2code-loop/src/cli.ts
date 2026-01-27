import path from 'path';
import { confirm, input, select } from '@inquirer/prompts';
import { agentRegistry } from './agents/index.js';
import { StateManager, type SessionConfig } from './state/index.js';
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
    logger.info('1. Create a spec directory: mkdir -p specs/my-feature');
    logger.info('2. Create overview.md with phases listed as checkboxes');
    logger.info('3. Create phase-1.md, phase-2.md, etc. with task checkboxes');
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
  const availableAgents = await agentRegistry.getAvailable();

  if (availableAgents.length === 0) {
    logger.error('No AI agents detected on your system!');
    console.log();
    logger.info('Please install at least one of the following:');
    console.log();
    logger.bold('Claude Code:');
    logger.dim('  npm install -g @anthropic-ai/claude-code');
    console.log();
    logger.bold('GitHub Copilot CLI:');
    logger.dim('  gh extension install github/gh-copilot');
    console.log();
    throw new Error('No agents available. Please install an AI agent and try again.');
  }

  if (availableAgents.length === 1) {
    const agent = availableAgents[0];
    logger.info(`Using ${agent.config.displayName} (only available agent)`);
    return agent.config.name;
  }

  const agentName = await select({
    message: 'Select AI agent:',
    choices: availableAgents.map((agent) => ({
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
  // Show welcome
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
  const maxIterations = await selectMaxIterations();

  const config: SessionConfig = {
    agent,
    model: 'default',
    maxIterations,
    specPath,
    timeout: 30,
    verbose: false,
    startedAt: new Date().toISOString(),
    currentIteration: 0,
    jiraTicketId,
  };

  // Initialize session
  await stateManager.initializeNewSession(config);

  return { config, isResume: false };
}
