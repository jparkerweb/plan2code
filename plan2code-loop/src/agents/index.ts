export type {
  Agent,
  AgentConfig,
  AgentExecutionOptions,
  AgentExecutionResult,
  ModelOption,
} from './types.js';

export { agentRegistry } from './registry.js';
export { claudeCodeAgent } from './claude-code.js';
export { copilotCliAgent } from './copilot-cli.js';
export { devinCliAgent } from './devin-cli.js';

// Register all agents
import { agentRegistry } from './registry.js';
import { claudeCodeAgent } from './claude-code.js';
import { copilotCliAgent } from './copilot-cli.js';
import { devinCliAgent } from './devin-cli.js';

agentRegistry.register(claudeCodeAgent);
agentRegistry.register(copilotCliAgent);
agentRegistry.register(devinCliAgent);
