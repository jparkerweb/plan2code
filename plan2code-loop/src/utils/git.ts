import { execa } from 'execa';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

export interface GitCommitOptions {
  taskName: string;
  jiraTicketId?: string;
  cwd?: string;
}

/**
 * Check if directory is a git repository
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await execa('git', ['rev-parse', '--git-dir'], { cwd, reject: false });
  return result.exitCode === 0;
}

/**
 * Initialize a git repository if one doesn't exist
 */
export async function ensureGitRepo(cwd: string): Promise<boolean> {
  if (await isGitRepo(cwd)) {
    return true;
  }

  logger.info('Initializing git repository...');
  const result = await execa('git', ['init'], { cwd, reject: false });

  if (result.exitCode !== 0) {
    logger.error(`Failed to initialize git repo: ${result.stderr}`);
    return false;
  }

  logger.success('Git repository initialized');
  return true;
}

/**
 * Required entries for the .gitignore file
 */
const REQUIRED_GITIGNORE_ENTRIES = ['specs/', 'specs--completed/', 'nul', 'node_modules/'];

/**
 * Ensure .gitignore exists with required entries
 */
export function ensureGitignore(cwd: string): void {
  const gitignorePath = join(cwd, '.gitignore');
  let content = '';

  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, 'utf-8');
  }

  const lines = content.split('\n').map(line => line.trim());
  const missingEntries = REQUIRED_GITIGNORE_ENTRIES.filter(entry => !lines.includes(entry));

  if (missingEntries.length > 0) {
    const needsNewline = content.length > 0 && !content.endsWith('\n');
    const newContent = content + (needsNewline ? '\n' : '') + missingEntries.join('\n') + '\n';
    writeFileSync(gitignorePath, newContent);
    logger.dim(`Added to .gitignore: ${missingEntries.join(', ')}`);
  }
}

/**
 * Create a local git commit for a completed task
 */
export async function createTaskCommit(options: GitCommitOptions): Promise<boolean> {
  const { taskName, jiraTicketId, cwd = process.cwd() } = options;

  logger.dim(`Git commit check in: ${cwd}`);

  try {
    // Ensure we have a git repo
    if (!await ensureGitRepo(cwd)) {
      return false;
    }

    // Ensure .gitignore exists with required entries
    ensureGitignore(cwd);

    // Check if there are any changes to commit
    const statusResult = await execa('git', ['status', '--porcelain'], { cwd, reject: false });

    // Debug: show what git status returned
    if (statusResult.stdout?.trim()) {
      logger.dim(`Git status found changes:\n${statusResult.stdout.slice(0, 500)}`);
    }

    if (statusResult.exitCode !== 0) {
      logger.error(`Git status failed: ${statusResult.stderr}`);
      return false;
    }

    if (!statusResult.stdout?.trim()) {
      logger.dim('No changes to commit');
      return false;
    }

    // Stage all changes
    const addResult = await execa('git', ['add', '-A'], { cwd, reject: false });
    if (addResult.exitCode !== 0) {
      logger.error(`Git add failed: ${addResult.stderr}`);
      return false;
    }

    // Build commit message
    let commitMessage = taskName;
    if (jiraTicketId) {
      commitMessage = `${taskName}\n\n${jiraTicketId}`;
    }

    // Create the commit
    const commitResult = await execa('git', ['commit', '-m', commitMessage], { cwd, reject: false });

    if (commitResult.exitCode !== 0) {
      // Check if it's just "nothing to commit" vs actual error
      if (commitResult.stdout?.includes('nothing to commit') || commitResult.stderr?.includes('nothing to commit')) {
        logger.dim('No changes to commit');
        return false;
      }
      logger.error(`Git commit failed: ${commitResult.stderr || commitResult.stdout}`);
      return false;
    }

    logger.success(`Created commit: ${taskName}${jiraTicketId ? ` (${jiraTicketId})` : ''}`);
    return true;
  } catch (error) {
    logger.error(`Failed to create commit: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
