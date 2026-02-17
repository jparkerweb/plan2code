export { logger, MASCOT, type Logger } from './logger.js';
export {
  checkForCompletion,
  type CompletionMarker,
  type CompletionCheckResult
} from './completion.js';
export {
  executeCommand,
  type ExecuteOptions,
  type ExecuteResult
} from './process.js';
export {
  createTaskCommit,
  isGitRepo,
  ensureGitRepo,
  ensureGitignore,
  type GitCommitOptions
} from './git.js';
