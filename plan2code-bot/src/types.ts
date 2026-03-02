export type BotMode = 'new-project' | 'enhancement';

export interface BotConfig {
  workDir: string;
  projectDir: string;
  ideaDescription: string;
  ideaName: string;
  mode: BotMode;
}

export type StepName = 'init' | 'plan' | 'document' | 'implement' | 'finalize';

export interface StepResult {
  step: StepName;
  success: boolean;
  sessionId: string | null;
  duration: number;
  error: string | null;
}

export interface BotState {
  config: BotConfig;
  steps: StepResult[];
  currentStep: StepName | null;
  implementPasses: number;
  allPhasesComplete: boolean;
}
