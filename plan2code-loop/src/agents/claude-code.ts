import type { Agent, AgentConfig, AgentExecutionOptions, AgentExecutionResult } from './types.js';
import { executeCommand } from '../utils/process.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const claudeCodeConfig: AgentConfig = {
  name: 'claude-code',
  displayName: 'Claude Code',
  command: 'claude',
  models: [
    { value: 'default', label: 'Default (use Claude config)' },
  ],
  defaultModel: 'default',
  flags: {
    prompt: '--print',
    model: '--model',
    skipPermissions: '--dangerously-skip-permissions',
  },
};

class ClaudeCodeAgent implements Agent {
  readonly config = claudeCodeConfig;

  async execute(options: AgentExecutionOptions): Promise<AgentExecutionResult> {
    // Write prompt to temp file - more reliable than stdin on Windows
    const tempFile = join(tmpdir(), `plan2code-prompt-${Date.now()}.txt`);
    writeFileSync(tempFile, options.prompt, 'utf-8');

    try {
      // Build args: flags first, then read prompt from temp file via shell
      const args: string[] = [
        this.config.flags.prompt,  // --print for non-interactive mode
        this.config.flags.skipPermissions,
      ];

      // Only add --model if not using default
      if (options.model && options.model !== 'default') {
        args.push(this.config.flags.model, options.model);
      }

      // Use stdin from the temp file
      const result = await executeCommand({
        command: this.config.command,
        args,
        cwd: options.cwd,
        timeout: options.timeout,
        signal: options.signal,
        stdinFile: tempFile,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        cancelled: result.cancelled,
        duration: result.duration,
      };
    } finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    // Run claude --version to verify it's actually installed and working
    const result = await executeCommand({
      command: this.config.command,
      args: ['--version'],
      cwd: process.cwd(),
      timeout: 5000,
    });
    return result.exitCode === 0;
  }
}

export const claudeCodeAgent = new ClaudeCodeAgent();
