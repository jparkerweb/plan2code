import type { Agent, AgentConfig, AgentExecutionOptions, AgentExecutionResult } from './types.js';
import { executeCommand } from '../utils/process.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const devinCliConfig: AgentConfig = {
  name: 'devin-cli',
  displayName: 'Devin CLI',
  command: 'devin',
  models: [
    { value: 'default', label: 'Default (use Devin config)' },
  ],
  defaultModel: 'default',
  flags: {
    prompt: '--print',
    promptFile: '--prompt-file',
    model: '--model',
    skipPermissions: '--permission-mode',
  },
};

class DevinCliAgent implements Agent {
  readonly config = devinCliConfig;

  async execute(options: AgentExecutionOptions): Promise<AgentExecutionResult> {
    // Devin CLI takes the prompt via --prompt-file rather than stdin
    const tempFile = join(tmpdir(), `plan2code-prompt-${Date.now()}.txt`);
    writeFileSync(tempFile, options.prompt, 'utf-8');

    try {
      const args: string[] = [
        this.config.flags.prompt,                 // --print for non-interactive mode
        this.config.flags.promptFile!, tempFile,   // --prompt-file <path>
        this.config.flags.skipPermissions, 'dangerous', // --permission-mode dangerous (auto-approve all tools)
      ];

      // Only add --model if not using default
      if (options.model && options.model !== 'default') {
        args.push(this.config.flags.model, options.model);
      }

      const result = await executeCommand({
        command: this.config.command,
        args,
        cwd: options.cwd,
        timeout: options.timeout,
        signal: options.signal,
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
    // Run devin --version to verify it's actually installed and working
    const result = await executeCommand({
      command: this.config.command,
      args: ['--version'],
      cwd: process.cwd(),
      timeout: 5000,
    });
    return result.exitCode === 0;
  }
}

export const devinCliAgent = new DevinCliAgent();
