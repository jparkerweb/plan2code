import type { StateManager } from '../state/index.js';
import { LOOP_PROMPT_TEMPLATE } from './templates.js';

export interface PromptContext {
  specPath: string;
  iteration: number;
  maxIterations: number;
  stateManager: StateManager;
}

/**
 * Build the prompt for the AI agent
 * Simple: just pass spec path and let the LLM discover the next task
 */
export async function buildLoopPrompt(context: PromptContext): Promise<string> {
  const { specPath, iteration, maxIterations, stateManager } = context;

  // Read scratchpad content for session continuity (LLM writes to this)
  const scratchpadContent = await stateManager.readScratchpad();

  // Project root is where plan2code-loop was invoked from
  const projectRoot = process.cwd();

  // Simple template substitution
  const prompt = LOOP_PROMPT_TEMPLATE
    .replace(/{{projectRoot}}/g, projectRoot)
    .replace(/{{specPath}}/g, specPath)
    .replace(/{{iteration}}/g, iteration.toString())
    .replace(/{{maxIterations}}/g, maxIterations.toString())
    .replace(/{{scratchpadContent}}/g, scratchpadContent || '(First iteration - no previous progress)');

  return prompt;
}
