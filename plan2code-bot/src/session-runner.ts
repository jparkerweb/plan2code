import { query } from '@anthropic-ai/claude-agent-sdk';
import { createAutoResponder } from './auto-responder.js';
import type { BotConfig, StepName } from './types.js';

export interface SessionOptions {
  prompt: string;
  config: BotConfig;
  step: StepName;
  maxTurns?: number;
}

export interface SessionResult {
  sessionId: string | null;
  output: string;
  success: boolean;
  duration: number;
}

export async function runSession(options: SessionOptions): Promise<SessionResult> {
  const { prompt, config, step, maxTurns = 50 } = options;
  const startTime = Date.now();
  let output = '';
  let sessionId: string | null = null;

  try {
    const session = query({
      prompt,
      options: {
        cwd: config.projectDir,
        maxTurns,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        canUseTool: createAutoResponder(config, step),
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        settingSources: ['user', 'project'],
      },
    });

    for await (const message of session) {
      if (message.type === 'assistant') {
        sessionId = message.session_id ?? sessionId;
        for (const block of message.message.content) {
          if (block.type === 'text') {
            output += block.text + '\n';
          }
        }
      } else if (message.type === 'result') {
        sessionId = message.session_id ?? sessionId;
      }
    }

    const duration = Date.now() - startTime;
    const hasOutput = output.trim().length > 0;
    return { sessionId, output, success: hasOutput, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { sessionId, output, success: false, duration };
  }
}
