import { describe, it, expect } from 'vitest';
import { createAutoResponder } from './auto-responder.js';
import type { BotConfig } from './types.js';

const config: BotConfig = {
  workDir: '/tmp/work',
  projectDir: '/tmp/work/my-app',
  ideaDescription: 'A test app',
  ideaName: 'test-app',
  mode: 'new-project',
};

describe('createAutoResponder', () => {
  it('returns allow for non-AskUserQuestion tools', async () => {
    const responder = createAutoResponder(config, 'plan');
    const result = await responder('Bash', { command: 'ls' });
    expect(result.behavior).toBe('allow');
    expect((result as any).updatedInput).toBeUndefined();
  });

  it('injects answers for AskUserQuestion with approval keywords', async () => {
    const responder = createAutoResponder(config, 'plan');
    const result = await responder('AskUserQuestion', {
      questions: [
        {
          question: 'Do you approve this plan?',
          options: [
            { label: 'Yes', description: 'Approve' },
            { label: 'No', description: 'Reject' },
          ],
        },
      ],
    });

    expect(result.behavior).toBe('allow');
    const updated = (result as any).updatedInput;
    expect(updated.answers['Do you approve this plan?']).toBe('Yes');
  });

  it('selects skip/none for testing questions', async () => {
    const responder = createAutoResponder(config, 'implement');
    const result = await responder('AskUserQuestion', {
      questions: [
        {
          question: 'How should we run tests?',
          options: [
            { label: 'Full suite', description: 'Run all tests' },
            { label: 'Skip', description: 'Skip testing' },
          ],
        },
      ],
    });

    expect(result.behavior).toBe('allow');
    const updated = (result as any).updatedInput;
    expect(updated.answers['How should we run tests?']).toBe('Skip');
  });

  it('uses project name for plan step name questions', async () => {
    const responder = createAutoResponder(config, 'plan');
    const result = await responder('AskUserQuestion', {
      questions: [
        {
          question: 'What is the name of this feature?',
          options: [
            { label: 'Feature A', description: 'First' },
            { label: 'Feature B', description: 'Second' },
          ],
        },
      ],
    });

    expect(result.behavior).toBe('allow');
    const updated = (result as any).updatedInput;
    // Plan step + "name" keyword → uses config.ideaName
    expect(updated.answers['What is the name of this feature?']).toBe('test-app');
  });

  it('falls back to first option for unknown questions', async () => {
    const responder = createAutoResponder(config, 'init');
    const result = await responder('AskUserQuestion', {
      questions: [
        {
          question: 'What color is the sky?',
          options: [
            { label: 'Blue', description: 'The usual' },
            { label: 'Red', description: 'Sunset' },
          ],
        },
      ],
    });

    expect(result.behavior).toBe('allow');
    const updated = (result as any).updatedInput;
    expect(updated.answers['What color is the sky?']).toBe('Blue');
  });
});
