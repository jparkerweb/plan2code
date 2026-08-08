import type { Agent, AgentConfig, AgentExecutionOptions, AgentExecutionResult } from './types.js';
import { executeCommand } from '../utils/process.js';

const copilotCliConfig: AgentConfig = {
  name: 'copilot-cli',
  displayName: 'GitHub Copilot CLI',
  command: 'copilot',
  models: [
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 (Default)' },
    { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-opus-4.5', label: 'Claude Opus 4.5' },
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
  ],
  defaultModel: 'claude-sonnet-4',
  flags: {
    prompt: '-p',
    model: '--model',
    skipPermissions: '--allow-all-tools',
    silent: '-s',
  },
};

class CopilotCliAgent implements Agent {
  readonly config = copilotCliConfig;

  async execute(options: AgentExecutionOptions): Promise<AgentExecutionResult> {
    // Use stdin for prompt to handle multi-line text properly
    const args: string[] = [];

    // Only add --model if not using default
    if (options.model && options.model !== 'default') {
      args.push(this.config.flags.model, options.model);
    }

    args.push(this.config.flags.skipPermissions, this.config.flags.silent!);

    const result = await executeCommand({
      command: this.config.command,
      args,
      cwd: options.cwd,
      timeout: options.timeout,
      signal: options.signal,
      stdin: options.prompt,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      cancelled: result.cancelled,
      duration: result.duration,
    };
  }

  async isAvailable(): Promise<boolean> {
    // Run copilot --version to verify it's installed
    const result = await executeCommand({
      command: this.config.command,
      args: ['--version'],
      cwd: process.cwd(),
      timeout: 5000,
    });
    return result.exitCode === 0;
  }
}

export const copilotCliAgent = new CopilotCliAgent();
