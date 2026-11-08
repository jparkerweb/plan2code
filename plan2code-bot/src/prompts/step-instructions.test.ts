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

  it('plan prompt says to open the skill file and follow it', () => {
    const prompt = buildStepPrompt('plan', config);
    expect(prompt).toContain('Open the skill file .claude/skills/plan2code-1-plan/SKILL.md and follow it');
    expect(prompt).not.toContain('Run the /plan2code');
  });

  it('document prompt says to open the skill file and follow it', () => {
    const prompt = buildStepPrompt('document', config);
    expect(prompt).toContain('Open the skill file .claude/skills/plan2code-2-document/SKILL.md and follow it');
    expect(prompt).not.toContain('Run the /plan2code');
  });

  it('implement prompt instructs direct tool usage without skill invocation', () => {
    const prompt = buildStepPrompt('implement', config);
    expect(prompt).toContain('Do NOT use the Skill tool');
  });

  it('finalize prompt says to open the skill file and follow it', () => {
    const prompt = buildStepPrompt('finalize', config);
    expect(prompt).toContain('Open the skill file .claude/skills/plan2code-4-finalize/SKILL.md and follow it');
    expect(prompt).not.toContain('Run the /plan2code');
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
