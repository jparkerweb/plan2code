import { describe, it, expect, vi } from 'vitest';

// Mock the SDK before importing session-runner
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
import { runSession } from './session-runner.js';
import type { BotConfig } from './types.js';

const config: BotConfig = {
  workDir: '/tmp/work',
  projectDir: '/tmp/work/my-app',
  ideaDescription: 'test app',
  ideaName: 'test-app',
  mode: 'new-project',
};

describe('runSession', () => {
  it('returns success: false when output is empty', async () => {
    // Simulate a session that yields an assistant message with empty text
    const mockQuery = vi.mocked(query);
    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'assistant' as const,
          session_id: 'sess-1',
          message: { content: [{ type: 'text' as const, text: '' }] },
        };
        yield {
          type: 'result' as const,
          session_id: 'sess-1',
        };
      })() as any,
    );

    const result = await runSession({
      prompt: 'do something',
      config,
      step: 'init',
    });

    expect(result.success).toBe(false);
    expect(result.output.trim()).toBe('');
  });

  it('returns success: true when output has content', async () => {
    const mockQuery = vi.mocked(query);
    mockQuery.mockReturnValue(
      (async function* () {
        yield {
          type: 'assistant' as const,
          session_id: 'sess-2',
          message: { content: [{ type: 'text' as const, text: 'AGENTS.md has been created successfully' }] },
        };
        yield {
          type: 'result' as const,
          session_id: 'sess-2',
        };
      })() as any,
    );

    const result = await runSession({
      prompt: 'do something',
      config,
      step: 'init',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('AGENTS.md');
    expect(result.sessionId).toBe('sess-2');
  });
});
