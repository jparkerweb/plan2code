export type BotMode = 'new-project' | 'enhancement';

export interface BotConfig {
  workDir: string;
  projectDir: string;
  ideaDescription: string;
  ideaName: string;
  mode: BotMode;
}

export type StepName = 'init' | 'plan' | 'document' | 'implement' | 'finalize';

export interface ToolObservation {
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  timestamp: number;
  allowed: boolean;
  autoAnswered?: boolean;
}

export interface QuestionContext {
  question: string;
  options: Array<{ label: string; description: string }>;
  llmReasoning: string;
  selectedAnswer: string;
  timestamp: number;
}

export interface ExecutionObservation {
  step: StepName;
  startTime: number;
  endTime: number;
  tools: ToolObservation[];
  assistantMessages: string[];
  errors: string[];
  filesCreated: string[];
  filesModified: string[];
  questionsAsked: QuestionContext[];
}

export interface EvaluationResult {
  step: StepName;
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  criticalIssues: string[];
  timestamp: number;
  evaluatorModel: string;
  reasoning: string;
}

export interface StepResult {
  step: StepName;
  success: boolean;
  sessionId: string | null;
  duration: number;
  error: string | null;
  evaluation?: EvaluationResult;
  observations?: ExecutionObservation;
}

export interface BotState {
  config: BotConfig;
  steps: StepResult[];
  currentStep: StepName | null;
  implementPasses: number;
  allPhasesComplete: boolean;
}
