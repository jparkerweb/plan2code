import path from 'path';
import { StateManager } from './state/index.js';
import { Controller, type LoopResult, type TaskCompleteInfo } from './controller.js';
import { setupSession } from './cli.js';
import { logger, createTaskCommit } from './utils/index.js';

export async function run(): Promise<LoopResult | null> {
  // Ensure agents are registered
  await import('./agents/index.js');

  const stateManager = new StateManager();

  const result = await setupSession(stateManager);
  if (!result) {
    return null;
  }

  const { config, isResume } = result;

  if (isResume) {
    logger.info(`Resuming from iteration ${config.currentIteration}`);
  }

  const controller = new Controller({
    config,
    stateManager,
    onIteration: (iter, max) => {
      // Could add git checkpoint logic here if needed
    },
    onTaskComplete: async (info: TaskCompleteInfo) => {
      // Create git commit for completed task
      const taskName = info.taskName || info.taskId || 'Task completed';
      await createTaskCommit({
        taskName,
        jiraTicketId: config.jiraTicketId,
        cwd: process.cwd(),
      });
    },
    onLoopComplete: () => {
      // All tasks completed callback
    },
  });

  // Setup interrupt handler
  const handleInterrupt = () => {
    logger.warning('\nInterrupt received, saving state...');
    controller.interrupt();
  };

  process.on('SIGINT', handleInterrupt);
  process.on('SIGTERM', handleInterrupt);

  try {
    const loopResult = await controller.run();

    // Display summary
    console.log();
    logger.header('Session Summary');
    logger.info(`Total iterations: ${loopResult.iterations}`);
    logger.info(`Tasks completed: ${loopResult.tasksCompleted}`);
    if (loopResult.prereqsCompleted > 0) {
      logger.info(`Prerequisites verified: ${loopResult.prereqsCompleted}`);
    }
    logger.info(`Exit reason: ${loopResult.exitReason}`);
    if (loopResult.finalMarker) {
      logger.info(`Completion marker: ${loopResult.finalMarker}`);
    }
    if (loopResult.error) {
      logger.error(`Error: ${loopResult.error.message}`);
    }

    // Show completion celebration and finalize reminder when all phases complete
    if (loopResult.exitReason === 'all_complete') {
      logger.allPhasesComplete();
    }

    // Show state file locations (now per-spec)
    console.log();
    logger.dim(`Session files saved to ${path.relative(process.cwd(), stateManager.getStateDir())}:`);
    logger.dim('  - config.json (session configuration)');
    logger.dim('  - scratchpad.md (LLM-managed notes)');
    logger.dim('  - iteration.log (history)');
    logger.dim('Tip: run `plan2code-metrics` to capture run data for prompt improvement.');

    return loopResult;
  } finally {
    process.off('SIGINT', handleInterrupt);
    process.off('SIGTERM', handleInterrupt);
  }
}

// Re-export types and classes
export { Controller, type ControllerOptions, type LoopResult, type TaskCompleteInfo } from './controller.js';
export { StateManager } from './state/index.js';
export { setupSession } from './cli.js';
export { agentRegistry, type Agent, type AgentConfig } from './agents/index.js';
export { detectSpecDirectories, getSpecProgress } from './spec/index.js';
