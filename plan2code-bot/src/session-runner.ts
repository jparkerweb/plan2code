import { query } from '@anthropic-ai/claude-agent-sdk';
import { createIntelligentResponder } from './intelligent-responder.js';
import type { BotConfig, ExecutionObservation, StepName } from './types.js';
import type { ObservationCollector } from './observation-collector.js';

export interface SessionOptions {
  prompt: string;
  config: BotConfig;
  step: StepName;
  maxTurns?: number;
  collector: ObservationCollector;
}

export interface SessionResult {
  sessionId: string | null;
  output: string;
  success: boolean;
  duration: number;
  observations: ExecutionObservation;
}

export async function runSession(options: SessionOptions): Promise<SessionResult> {
  const { prompt, config, step, maxTurns = 50, collector } = options;
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
        canUseTool: createIntelligentResponder(config, step, collector),
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        settingSources: ['project'],
      },
    });

    for await (const message of session) {
      // Record all messages for observations
      collector.recordMessage(message);

      if (message.type === 'assistant') {
        sessionId = message.session_id ?? sessionId;
        for (const block of message.message.content) {
          if (block.type === 'text') {
            output += block.text + '\n';
          } else if (block.type === 'tool_use') {
            // Capture tool invocations from the message stream as a fallback
            // in case canUseTool doesn't fire (e.g., Skill sub-sessions)
            collector.recordToolUse(
              block.name,
              block.input as Record<string, unknown>,
              undefined,
              true
            );
          }
        }
      } else if (message.type === 'result') {
        sessionId = message.session_id ?? sessionId;
      }
    }

    const duration = Date.now() - startTime;
    const hasOutput = output.trim().length > 0;
    const observations = collector.finalize();
    return { sessionId, output, success: hasOutput, duration, observations };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    const observations = collector.finalize();
    return { sessionId, output, success: false, duration, observations };
  }
}
