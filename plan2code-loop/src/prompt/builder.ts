import type { StateManager, LoopMode } from '../state/index.js';
import { LOOP_PROMPT_TEMPLATE, LOOP_PROMPT_TEMPLATE_PHASE } from './templates.js';

export interface PromptContext {
  specPath: string;
  iteration: number;
  maxIterations: number;
  stateManager: StateManager;
  loopMode: LoopMode;
  jiraTicketId?: string;
}

/**
 * Build the prompt for the AI agent
 * Selects template based on loop mode (task vs phase)
 */
export async function buildLoopPrompt(context: PromptContext): Promise<string> {
  const { specPath, iteration, maxIterations, stateManager, loopMode, jiraTicketId } = context;

  // Read scratchpad content for session continuity (LLM writes to this)
  const scratchpadContent = await stateManager.readScratchpad();

  // Project root is where plan2code-loop was invoked from
  const projectRoot = process.cwd();

  // Select template based on loop mode
  const template = loopMode === 'phase' ? LOOP_PROMPT_TEMPLATE_PHASE : LOOP_PROMPT_TEMPLATE;

  // Template substitution
  const prompt = template
    .replace(/{{projectRoot}}/g, projectRoot)
    .replace(/{{specPath}}/g, specPath)
    .replace(/{{iteration}}/g, iteration.toString())
    .replace(/{{maxIterations}}/g, maxIterations.toString())
    .replace(/{{scratchpadContent}}/g, scratchpadContent || '(First iteration - no previous progress)')
    .replace(/{{jiraTicketId}}/g, jiraTicketId || '');

  return prompt;
}
