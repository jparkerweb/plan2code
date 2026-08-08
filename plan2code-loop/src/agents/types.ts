export interface ModelOption {
  value: string;
  label: string;
}

export interface AgentConfig {
  name: string;
  displayName: string;
  command: string;
  models: ModelOption[];
  defaultModel: string;
  flags: {
    prompt: string;
    model: string;
    skipPermissions: string;
    silent?: string;
    promptFile?: string;
  };
}

export interface AgentExecutionOptions {
  prompt: string;
  model: string;
  timeout: number;       // milliseconds
  verbose: boolean;
  cwd: string;
  signal?: AbortSignal;  // For cancellation
}

export interface AgentExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  cancelled: boolean;
  duration: number;      // milliseconds
}

export interface Agent {
  config: AgentConfig;
  execute(options: AgentExecutionOptions): Promise<AgentExecutionResult>;
  isAvailable(): Promise<boolean>;
}
