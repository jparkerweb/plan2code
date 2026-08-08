import { agentRegistry, type Agent, type AgentExecutionResult } from './agents/index.js';
import { StateManager, type SessionConfig, type IterationLogEntry } from './state/index.js';
import { buildLoopPrompt } from './prompt/index.js';
import { checkForCompletion, checkForAllCompletions, logger, ensureGitRepo, ensureGitignore, type CompletionCheckResult } from './utils/index.js';

export interface TaskCompleteInfo {
  marker: string;
  taskId?: string;
  taskName?: string;
}

export interface ControllerOptions {
  config: SessionConfig;
  stateManager: StateManager;
  onIteration?: (iteration: number, max: number) => void;
  onTaskComplete?: (info: TaskCompleteInfo) => void | Promise<void>;
  onLoopComplete?: () => void;
}

export interface LoopResult {
  completed: boolean;
  iterations: number;
  finalMarker?: string;
  exitReason: 'all_complete' | 'max_iterations' | 'interrupted' | 'error';
  tasksCompleted: number;
  prereqsCompleted: number;
  error?: Error;
}

export class Controller {
  private readonly config: SessionConfig;
  private readonly stateManager: StateManager;
  private readonly agent: Agent;
  private readonly onIteration?: (iteration: number, max: number) => void;
  private readonly onTaskComplete?: (info: TaskCompleteInfo) => void | Promise<void>;
  private readonly onLoopComplete?: () => void;
  private interrupted = false;
  private abortController: AbortController | null = null;
  private tasksCompleted = 0;
  private prereqsCompleted = 0;

  constructor(options: ControllerOptions) {
    this.config = options.config;
    this.stateManager = options.stateManager;
    this.onIteration = options.onIteration;
    this.onTaskComplete = options.onTaskComplete;
    this.onLoopComplete = options.onLoopComplete;

    const agent = agentRegistry.get(this.config.agent);
    if (!agent) {
      throw new Error(`Agent not found: ${this.config.agent}`);
    }
    this.agent = agent;
  }

  private async buildPrompt(): Promise<string> {
    return buildLoopPrompt({
      specPath: this.config.specPath,
      iteration: this.config.currentIteration + 1,
      maxIterations: this.config.maxIterations,
      stateManager: this.stateManager,
      loopMode: this.config.loopMode || 'task',
      jiraTicketId: this.config.jiraTicketId,
    });
  }

  private computeTimeoutMs(attempt: number): number {
    const baseMs = this.config.timeout * 60 * 1000;
    return baseMs + (attempt * 30 * 1000);
  }

  private formatDuration(ms: number): string {
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min === 0) return `${sec}s`;
    if (sec === 0) return `${min}m`;
    return `${min}m ${sec}s`;
  }

  private async executeWithRetry(prompt: string, iterNum: number): Promise<AgentExecutionResult | 'fatal_timeout'> {
    const maxAttempts = (this.config.maxRetries ?? 5) + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const timeoutMs = this.computeTimeoutMs(attempt);

      if (attempt > 0) {
        const prevTimeoutMs = this.computeTimeoutMs(attempt - 1);
        logger.warning(
          `Timed out after ${this.formatDuration(prevTimeoutMs)}, retrying (${attempt}/${maxAttempts - 1})...`
        );
      }

      const spinnerBase = attempt > 0
        ? `Waiting for AI Agent response (retry ${attempt}/${maxAttempts - 1})`
        : 'Waiting for AI Agent response (please be patient)';
      const spinner = logger.spinner(spinnerBase);
      const startTime = Date.now();

      const elapsedInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        spinner.text = `${spinnerBase} ... (${elapsed}s)`;
      }, 1000);

      const result = await this.executeIteration(prompt, timeoutMs);
      clearInterval(elapsedInterval);
      spinner.stop();

      // Cancelled or interrupted — return immediately, don't retry
      if (result.cancelled || this.interrupted) {
        return result;
      }

      // Completed (success or error exit code) — return to caller
      if (!result.timedOut) {
        return result;
      }

      // Timed out — retry if attempts remain, otherwise fatal
      if (attempt < maxAttempts - 1) {
        continue;
      }

      // All attempts exhausted
      logger.error(
        `Iteration ${iterNum} timed out on all ${maxAttempts} attempt${maxAttempts === 1 ? '' : 's'}. Stopping loop.`
      );
      const entry: IterationLogEntry = {
        iteration: iterNum,
        timestamp: new Date().toISOString(),
        duration: result.duration,
        exitCode: -1,
        status: 'timeout',
      };
      await this.stateManager.appendIterationLog(entry);
      return 'fatal_timeout';
    }

    return 'fatal_timeout'; // unreachable, satisfies TS
  }

  private async executeIteration(prompt: string, timeoutMs: number): Promise<AgentExecutionResult> {
    // Create new AbortController for this iteration
    this.abortController = new AbortController();

    const result = await this.agent.execute({
      prompt,
      model: this.config.model,
      timeout: timeoutMs,
      verbose: this.config.verbose,
      cwd: process.cwd(),
      signal: this.abortController.signal,
    });

    this.abortController = null;
    return result;
  }

  private createLogEntry(
    result: AgentExecutionResult,
    status: IterationLogEntry['status'],
    marker?: string
  ): IterationLogEntry {
    return {
      iteration: this.config.currentIteration + 1,
      timestamp: new Date().toISOString(),
      duration: result.duration,
      exitCode: result.exitCode,
      status,
      completionMarker: marker,
    };
  }

  private formatTaskDisplay(completion: CompletionCheckResult): string {
    if (completion.taskId && completion.taskName) {
      return `Task ${completion.taskId}: ${completion.taskName}`;
    } else if (completion.taskId) {
      return `Task ${completion.taskId}`;
    }
    return '';
  }

  private displayIterationResult(result: AgentExecutionResult, iterNum: number, completion: CompletionCheckResult): void {
    const duration = Math.round(result.duration / 1000);
    const taskDisplay = this.formatTaskDisplay(completion);

    // Show iteration completion with task info if available
    if (taskDisplay) {
      logger.iteration(iterNum, this.config.maxIterations, `${taskDisplay} (${duration}s)`);
    } else {
      logger.iteration(iterNum, this.config.maxIterations, `completed in ${duration}s`);
    }

    // Verbose mode: show full output
    if (this.config.verbose) {
      console.log();
      logger.dim('--- Agent Output ---');
      console.log(result.stdout);
      if (result.stderr) {
        logger.dim('--- Agent Stderr ---');
        console.log(result.stderr);
      }
      logger.dim('--- End Output ---');
      console.log();
    } else if (result.exitCode !== 0 && result.stderr.trim()) {
      logger.error(`  ${result.stderr.trim().split('\n')[0]}`);
    }
  }

  async run(): Promise<LoopResult> {
    // Pre-flight: verify agent CLI is available
    const isAvailable = await this.agent.isAvailable();
    if (!isAvailable) {
      logger.error(`"${this.agent.config.displayName}" is not available!`);
      logger.info(`Please ensure the "${this.agent.config.command}" command is installed and available in your PATH.`);
      throw new Error(`Agent "${this.agent.config.displayName}" is not available. Please install it and try again.`);
    }

    // Ensure git repo and .gitignore are set up before any iterations
    const gitReady = await ensureGitRepo(process.cwd());
    if (!gitReady) {
      throw new Error('Failed to initialize a git repository in the current working directory. Cannot start Plan2Code Loop.');
    }
    ensureGitignore(process.cwd());

    const loopModeLabel = (this.config.loopMode || 'task') === 'phase' ? 'One phase per loop' : 'One task per loop';
    logger.header('Starting Plan2Code Loop');
    logger.info(`Agent: ${this.agent.config.displayName}`);
    logger.info(`Model: ${this.config.model}`);
    logger.info(`Spec: ${this.config.specPath}`);
    logger.info(`Loop mode: ${loopModeLabel}`);
    logger.info(`Max iterations: ${this.config.maxIterations}`);
    console.log();

    while (this.config.currentIteration < this.config.maxIterations) {
      if (this.interrupted) {
        return {
          completed: false,
          iterations: this.config.currentIteration,
          exitReason: 'interrupted',
          tasksCompleted: this.tasksCompleted,
          prereqsCompleted: this.prereqsCompleted,
        };
      }

      const iterNum = this.config.currentIteration + 1;
      this.onIteration?.(iterNum, this.config.maxIterations);

      console.log();
      logger.info(`Iteration ${iterNum}/${this.config.maxIterations}`);

      // Build prompt - simple, just spec path and iteration info
      const prompt = await this.buildPrompt();

      try {
        const retryResult = await this.executeWithRetry(prompt, iterNum);

        if (retryResult === 'fatal_timeout') {
          return {
            completed: false,
            iterations: this.config.currentIteration,
            exitReason: 'error',
            tasksCompleted: this.tasksCompleted,
            prereqsCompleted: this.prereqsCompleted,
            error: new Error(`Iteration ${iterNum} failed after all retry attempts`),
          };
        }

        const result = retryResult;

        // Check if cancelled
        if (result.cancelled || this.interrupted) {
          logger.info('Agent process cancelled');

          const entry: IterationLogEntry = {
            iteration: iterNum,
            timestamp: new Date().toISOString(),
            duration: result.duration,
            exitCode: -1,
            status: 'interrupted',
          };
          await this.stateManager.appendIterationLog(entry);

          return {
            completed: false,
            iterations: this.config.currentIteration,
            exitReason: 'interrupted',
            tasksCompleted: this.tasksCompleted,
            prereqsCompleted: this.prereqsCompleted,
          };
        }

        // Branch completion handling based on loop mode
        const isPhaseMode = (this.config.loopMode || 'task') === 'phase';

        if (isPhaseMode) {
          // Phase mode: parse ALL completion markers from output
          const allCompletions = checkForAllCompletions(result.stdout + result.stderr);

          // Determine status
          let status: IterationLogEntry['status'] = 'running';
          if (allCompletions.tasks.length > 0 || allCompletions.loopComplete || allCompletions.phaseComplete) {
            const hasBlocked = allCompletions.tasks.some(t => t.marker === 'TASK_BLOCKED');
            const hasCompleted = allCompletions.tasks.some(t => t.marker === 'TASK_COMPLETE' || t.marker === 'PREREQ_COMPLETE' || t.marker === 'PREREQ_ASSUMED');
            status = hasCompleted || allCompletions.phaseComplete || allCompletions.loopComplete ? 'completed' : hasBlocked ? 'blocked' : 'running';
          } else if (result.timedOut) {
            status = 'timeout';
          } else if (result.exitCode !== 0) {
            status = 'error';
          }

          // Log iteration with count of tasks
          const markerSummary = allCompletions.tasks.map(t => `${t.marker}: ${t.taskId}`).join(', ');
          const logEntry = this.createLogEntry(result, status, markerSummary || undefined);
          await this.stateManager.appendIterationLog(logEntry);

          // Display each completed task
          const duration = Math.round(result.duration / 1000);
          for (const task of allCompletions.tasks) {
            if (task.marker === 'TASK_COMPLETE') {
              this.tasksCompleted++;
              const taskDisplay = this.formatTaskDisplay(task);
              logger.success(taskDisplay ? `Completed: ${taskDisplay}` : 'Task completed!');
            } else if (task.marker === 'PREREQ_COMPLETE') {
              this.prereqsCompleted++;
              const prereqDisplay = task.taskId && task.taskName
                ? `Prereq ${task.taskId}: ${task.taskName}`
                : task.taskId ? `Prereq ${task.taskId}` : 'Prerequisite';
              logger.success(`Verified: ${prereqDisplay}`);
            } else if (task.marker === 'PREREQ_ASSUMED') {
              this.prereqsCompleted++;
              const prereqDisplay = task.taskId && task.taskName
                ? `Prereq ${task.taskId}: ${task.taskName}`
                : task.taskId ? `Prereq ${task.taskId}` : 'Prerequisite';
              logger.success(`Assumed: ${prereqDisplay}`);
            } else if (task.marker === 'TASK_BLOCKED') {
              const blockInfo = task.taskId
                ? `Task ${task.taskId} blocked: ${task.reason || 'Unknown reason'}`
                : `Task blocked: ${task.reason || 'Unknown reason'}`;
              logger.warning(blockInfo);
            }
          }

          // Show phase-level summary
          if (allCompletions.tasks.length > 0) {
            const completedCount = allCompletions.tasks.filter(t => t.marker === 'TASK_COMPLETE').length;
            const prereqCount = allCompletions.tasks.filter(t => t.marker === 'PREREQ_COMPLETE' || t.marker === 'PREREQ_ASSUMED').length;
            const blockedCount = allCompletions.tasks.filter(t => t.marker === 'TASK_BLOCKED').length;
            const parts: string[] = [];
            if (completedCount > 0) parts.push(`${completedCount} task(s) completed`);
            if (prereqCount > 0) parts.push(`${prereqCount} prereq(s) verified`);
            if (blockedCount > 0) parts.push(`${blockedCount} blocked`);
            logger.iteration(iterNum, this.config.maxIterations,
              `Phase done: ${parts.join(', ')} (${duration}s)`);
          } else {
            logger.iteration(iterNum, this.config.maxIterations, `completed in ${duration}s`);
          }

          // Verbose output
          if (this.config.verbose) {
            console.log();
            logger.dim('--- Agent Output ---');
            console.log(result.stdout);
            if (result.stderr) {
              logger.dim('--- Agent Stderr ---');
              console.log(result.stderr);
            }
            logger.dim('--- End Output ---');
            console.log();
          } else if (result.exitCode !== 0 && result.stderr.trim()) {
            logger.error(`  ${result.stderr.trim().split('\n')[0]}`);
          }

          // Handle LOOP_COMPLETE
          if (allCompletions.loopComplete) {
            this.onLoopComplete?.();
            logger.success('All tasks complete!');
            return {
              completed: true,
              iterations: iterNum,
              finalMarker: 'LOOP_COMPLETE',
              exitReason: 'all_complete',
              tasksCompleted: this.tasksCompleted,
              prereqsCompleted: this.prereqsCompleted,
            };
          }
        } else {
          // Task mode (default): existing single-marker logic
          const completion = checkForCompletion(result.stdout + result.stderr);

          // Determine status
          let status: IterationLogEntry['status'] = 'running';
          if (completion.completed) {
            if (completion.marker === 'TASK_BLOCKED') {
              status = 'blocked';
            } else {
              status = 'completed';
            }
          } else if (result.timedOut) {
            status = 'timeout';
          } else if (result.exitCode !== 0) {
            status = 'error';
          }

          // Log iteration
          const logEntry = this.createLogEntry(result, status, completion.marker);
          await this.stateManager.appendIterationLog(logEntry);

          // Display iteration result with task info from completion marker
          this.displayIterationResult(result, iterNum, completion);

          // Handle completion markers
          if (completion.completed) {
            const taskDisplay = this.formatTaskDisplay(completion);

            if (completion.marker === 'TASK_COMPLETE') {
              this.tasksCompleted++;
              await this.onTaskComplete?.({
                marker: completion.marker,
                taskId: completion.taskId,
                taskName: completion.taskName,
              });
              logger.success(taskDisplay ? `Completed: ${taskDisplay}` : 'Task completed!');
            } else if (completion.marker === 'PREREQ_COMPLETE' || completion.marker === 'PREREQ_ASSUMED') {
              this.prereqsCompleted++;
              await this.onTaskComplete?.({
                marker: completion.marker,
                taskId: completion.taskId,
                taskName: completion.taskName,
              });
              const prereqDisplay = completion.taskId && completion.taskName
                ? `Prereq ${completion.taskId}: ${completion.taskName}`
                : completion.taskId ? `Prereq ${completion.taskId}` : 'Prerequisite';
              const verb = completion.marker === 'PREREQ_COMPLETE' ? 'Verified' : 'Assumed';
              logger.success(`${verb}: ${prereqDisplay}`);
            } else if (completion.marker === 'TASK_BLOCKED') {
              const blockInfo = completion.taskId
                ? `Task ${completion.taskId} blocked: ${completion.reason || 'Unknown reason'}`
                : `Task blocked: ${completion.reason || 'Unknown reason'}`;
              logger.warning(blockInfo);
            } else if (completion.marker === 'LOOP_COMPLETE') {
              // Commit any final changes before completing
              this.tasksCompleted++;
              await this.onTaskComplete?.({
                marker: completion.marker,
                taskId: completion.taskId,
                taskName: completion.taskName || 'Final implementation complete',
              });
              this.onLoopComplete?.();
              logger.success('All tasks complete!');
              return {
                completed: true,
                iterations: iterNum,
                finalMarker: 'LOOP_COMPLETE',
                exitReason: 'all_complete',
                tasksCompleted: this.tasksCompleted,
                prereqsCompleted: this.prereqsCompleted,
              };
            }
          }
        }

        // Increment iteration and update spec hash (so resume doesn't see false changes)
        await this.stateManager.incrementIteration();
        await this.stateManager.updateSpecHash(this.config.specPath);
        this.config.currentIteration++;

        // Handle error (but continue - LLM might recover)
        if (result.exitCode !== 0) {
          // In phase mode, check if any tasks completed despite error exit code
          const hasCompletions = isPhaseMode
            ? checkForAllCompletions(result.stdout + result.stderr).tasks.length > 0
            : checkForCompletion(result.stdout + result.stderr).completed;
          if (!hasCompletions) {
            logger.warning(`Iteration ${iterNum} exited with code ${result.exitCode}, continuing...`);
          }
        }

      } catch (error) {
        clearInterval(elapsedInterval);
        spinner.stop();
        logger.error(`Iteration ${iterNum} failed: ${error}`);

        // Log the error
        const entry: IterationLogEntry = {
          iteration: iterNum,
          timestamp: new Date().toISOString(),
          duration: 0,
          exitCode: -1,
          status: 'error',
        };
        await this.stateManager.appendIterationLog(entry);

        return {
          completed: false,
          iterations: this.config.currentIteration,
          exitReason: 'error',
          tasksCompleted: this.tasksCompleted,
          prereqsCompleted: this.prereqsCompleted,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }

    // Max iterations reached
    logger.warning('Max iterations reached');
    return {
      completed: false,
      iterations: this.config.currentIteration,
      exitReason: 'max_iterations',
      tasksCompleted: this.tasksCompleted,
      prereqsCompleted: this.prereqsCompleted,
    };
  }

  interrupt(): void {
    this.interrupted = true;
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
