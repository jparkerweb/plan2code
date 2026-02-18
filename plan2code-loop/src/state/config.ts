export type LoopMode = 'task' | 'phase';

export interface SessionConfig {
  agent: string;              // "claude-code" | "copilot-cli"
  model: string;              // Selected model
  maxIterations: number;      // 5-50
  timeout: number;            // Minutes per iteration
  verbose: boolean;
  specPath: string;           // Path to the spec directory
  startedAt: string;          // ISO timestamp
  currentIteration: number;
  jiraTicketId?: string;      // JIRA ticket ID for commit messages
  loopMode: LoopMode;         // "task" = one task per loop, "phase" = one phase per loop
}

export interface IterationLogEntry {
  iteration: number;
  timestamp: string;          // ISO timestamp
  duration: number;           // milliseconds
  exitCode: number;
  status: 'running' | 'completed' | 'error' | 'timeout' | 'interrupted' | 'blocked';
  completionMarker?: string;
}

export type SessionState = 'new' | 'continue' | 'changed';

export const DEFAULT_CONFIG: Partial<SessionConfig> = {
  maxIterations: 100,
  timeout: 30,
  verbose: false,
  currentIteration: 0,
  loopMode: 'task',
};
