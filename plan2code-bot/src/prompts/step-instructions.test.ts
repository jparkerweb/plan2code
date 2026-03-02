import { describe, it, expect } from 'vitest';
import { buildStepPrompt } from './step-instructions.js';
import type { BotConfig } from '../types.js';

const config: BotConfig = {
  workDir: '/tmp/work',
  projectDir: '/tmp/work/my-app',
  ideaDescription: 'A todo app with drag-and-drop',
  ideaName: 'drag-todo',
  mode: 'new-project',
};

describe('buildStepPrompt', () => {
  it('each step includes the autonomous preamble', () => {
    const steps = ['init', 'plan', 'document', 'implement', 'finalize'] as const;
    for (const step of steps) {
      const prompt = buildStepPrompt(step, config);
      expect(prompt).toContain('running autonomously');
    }
  });

  it('init prompt includes /plan2code-init skill invocation', () => {
    const prompt = buildStepPrompt('init', config);
    expect(prompt).toContain('/plan2code-init');
  });

  it('plan prompt includes /plan2code-1-plan skill invocation', () => {
    const prompt = buildStepPrompt('plan', config);
    expect(prompt).toContain('/plan2code-1-plan');
  });

  it('document prompt includes /plan2code-2-document skill invocation', () => {
    const prompt = buildStepPrompt('document', config);
    expect(prompt).toContain('/plan2code-2-document');
  });

  it('implement prompt includes /plan2code-3-implement skill invocation', () => {
    const prompt = buildStepPrompt('implement', config);
    expect(prompt).toContain('/plan2code-3-implement');
  });

  it('finalize prompt includes /plan2code-4-finalize skill invocation', () => {
    const prompt = buildStepPrompt('finalize', config);
    expect(prompt).toContain('/plan2code-4-finalize');
  });

  it('plan prompt includes project name and description', () => {
    const prompt = buildStepPrompt('plan', config);
    expect(prompt).toContain('drag-todo');
    expect(prompt).toContain('A todo app with drag-and-drop');
  });

  it('init prompt includes project name and description', () => {
    const prompt = buildStepPrompt('init', config);
    expect(prompt).toContain('drag-todo');
    expect(prompt).toContain('A todo app with drag-and-drop');
  });
});
