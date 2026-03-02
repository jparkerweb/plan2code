import type { BotConfig, StepName } from './types.js';

interface AskUserQuestionInput {
  questions: Array<{
    question: string;
    options: Array<{
      label: string;
      description: string;
    }>;
    multiSelect?: boolean;
  }>;
}

function findOption(
  options: AskUserQuestionInput['questions'][0]['options'],
  ...keywords: string[]
): string | null {
  for (const keyword of keywords) {
    const match = options.find((o) =>
      o.label.toLowerCase().includes(keyword.toLowerCase())
    );
    if (match) return match.label;
  }
  return null;
}

function buildAnswers(input: AskUserQuestionInput, config: BotConfig, step: StepName): Record<string, string> {
  const answers: Record<string, string> = {};

  for (const q of input.questions) {
    const questionText = q.question.toLowerCase();
    const options = q.options;

    // Approval gates — find yes/approve/confirm option or pick first
    if (
      questionText.includes('approve') ||
      questionText.includes('confirm') ||
      questionText.includes('proceed') ||
      questionText.includes('ready') ||
      questionText.includes('look good') ||
      questionText.includes('sign off') ||
      questionText.includes('sign-off')
    ) {
      const opt = findOption(options, 'approve', 'yes', 'confirm', 'proceed', 'ready');
      answers[q.question] = opt ?? options[0].label;
      continue;
    }

    // Testing questions — skip or none
    if (
      questionText.includes('test') ||
      questionText.includes('testing')
    ) {
      const opt = findOption(options, 'skip', 'none', 'no');
      answers[q.question] = opt ?? options[0].label;
      continue;
    }

    // Plan step: additional files/references
    if (step === 'plan' && (questionText.includes('additional') || questionText.includes('reference'))) {
      const opt = findOption(options, 'no', 'none', 'skip');
      answers[q.question] = opt ?? options[0].label;
      continue;
    }

    // Plan step: feature name question
    if (step === 'plan' && questionText.includes('name')) {
      answers[q.question] = config.ideaName;
      continue;
    }

    // Implement step: pick first phase or approve
    if (step === 'implement') {
      const opt = findOption(options, 'approve', 'yes', 'continue', 'proceed');
      answers[q.question] = opt ?? options[0].label;
      continue;
    }

    // Finalize step: approve docs and give feedback
    if (step === 'finalize') {
      if (questionText.includes('rating') || questionText.includes('feedback')) {
        const opt = findOption(options, '8', '9', '10');
        answers[q.question] = opt ?? options[0].label;
        continue;
      }
      const opt = findOption(options, 'approve', 'yes', 'confirm');
      answers[q.question] = opt ?? options[0].label;
      continue;
    }

    // Default: pick first option
    answers[q.question] = options[0].label;
  }

  return answers;
}

export function createAutoResponder(config: BotConfig, step: StepName) {
  return async (
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<{ behavior: 'allow'; updatedInput?: Record<string, unknown> } | { behavior: 'deny'; message: string }> => {
    // Auto-respond to AskUserQuestion
    if (toolName === 'AskUserQuestion') {
      const askInput = input as unknown as AskUserQuestionInput;
      const answers = buildAnswers(askInput, config, step);

      return {
        behavior: 'allow',
        updatedInput: { ...input, answers },
      };
    }

    // Allow all other tools
    return { behavior: 'allow' };
  };
}
