/**
 * invoke-llm.ts
 * Unified LLM invocation for plan2code-metrics.
 * Supports Claude Code (temp file → stdin) and Copilot CLI (stdin string).
 * Mirrors the agent pattern from plan2code-loop.
 */

import { execa } from 'execa';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ── Agent definitions ────────────────────────────────────────────────────────

export type AgentType = 'claude-code' | 'copilot-cli';

export interface AgentDef {
  name: AgentType;
  displayName: string;
  command: string;
  models: Array<{ value: string; label: string }>;
}

export const AGENTS: Record<AgentType, AgentDef> = {
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    command: 'claude',
    models: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Recommended)' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (faster)' },
    ],
  },
  'copilot-cli': {
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
  },
};

// ── Invocation ───────────────────────────────────────────────────────────────

export interface InvokeLLMOptions {
  prompt: string;
  model: string;
  agent: AgentType;
  timeout?: number;
}

export async function invokeLLM(opts: InvokeLLMOptions): Promise<string> {
  const { prompt, model, agent, timeout = 300_000 } = opts;
  const def = AGENTS[agent];

  if (agent === 'claude-code') {
    // Write prompt to temp file — more reliable than stdin on Windows
    const tempFile = join(tmpdir(), `plan2code-metrics-prompt-${Date.now()}.txt`);
    writeFileSync(tempFile, prompt, 'utf-8');

    try {
      const args: string[] = [
        '--print',
        '--dangerously-skip-permissions',
      ];
      if (model) {
        args.push('--model', model);
      }

      const result = await execa(def.command, args, {
        inputFile: tempFile,
        timeout,
      });
      return result.stdout;
    } finally {
      try { unlinkSync(tempFile); } catch { /* ignore cleanup errors */ }
    }
  } else {
    // Copilot CLI: pipe prompt via stdin string
    const args: string[] = [];
    if (model) {
      args.push('--model', model);
    }
    args.push('--allow-all-tools', '-s');

    const result = await execa(def.command, args, {
      input: prompt,
      timeout,
    });
    return result.stdout;
  }
}
