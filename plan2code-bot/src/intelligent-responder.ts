import { query } from '@anthropic-ai/claude-agent-sdk';
import type { BotConfig, ExecutionObservation, StepName } from './types.js';
import type { ObservationCollector } from './observation-collector.js';

interface AskUserQuestionInput {
  questions: Array<{
    question: string;
    options: Array<{ label: string; description: string }>;
    multiSelect?: boolean;
  }>;
}

interface IntelligentAnswers {
  answers: Record<string, string>;
  reasoning: Record<string, string>;
}

/**
 * Creates an intelligent responder that uses LLM-as-judge for ALL decisions.
 * Replaces the old hardcoded auto-responder logic.
 */
export function createIntelligentResponder(
  config: BotConfig,
  step: StepName,
  collector: ObservationCollector
) {
  return async (
    toolName: string,
    input: Record<string, unknown>
  ): Promise<{ behavior: 'allow'; updatedInput?: Record<string, unknown> } | { behavior: 'deny'; message: string }> => {
    // Record every tool invocation for observations
    collector.recordToolUse(toolName, input, undefined, true);

    // Handle AskUserQuestion with LLM-generated answers
    if (toolName === 'AskUserQuestion') {
      const askInput = input as unknown as AskUserQuestionInput;

      // Get current observations to provide context to LLM
      const observations = collector.getSnapshot();

      // Generate answers using LLM-as-judge
      const answers = await generateIntelligentAnswers(
        askInput,
        observations,
        config,
        step
      );

      // Record each question/answer pair for metrics
      for (const q of askInput.questions) {
        const answer = answers.answers[q.question];
        const reasoning = answers.reasoning[q.question] || 'No reasoning provided';
        collector.recordQuestion(q.question, q.options, answer, reasoning);
      }

      return {
        behavior: 'allow',
        updatedInput: { ...input, answers: answers.answers },
      };
    }

    // Allow all other tools
    return { behavior: 'allow' };
  };
}

async function generateIntelligentAnswers(
  askInput: AskUserQuestionInput,
  observations: ExecutionObservation,
  config: BotConfig,
  step: StepName
): Promise<IntelligentAnswers> {
  const prompt = buildDecisionPrompt(askInput, observations, config, step);

  try {
    // Query LLM for decision (single turn, read-only tools)
    const session = query({
      prompt,
      options: {
        maxTurns: 1,
        cwd: config.projectDir,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        allowedTools: ['Read', 'Glob', 'Grep'],
        systemPrompt: 'You are a QA engineer reviewing work-in-progress. Be thoughtful and honest.',
      },
    });

    let output = '';
    for await (const message of session) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') output += block.text;
        }
      }
    }

    return parseDecisionOutput(output, askInput);
  } catch (error) {
    console.warn('LLM decision failed, using fallback logic:', error);
    // Fallback to reasonable defaults if LLM fails
    return generateFallbackAnswers(askInput, step);
  }
}

function buildDecisionPrompt(
  askInput: AskUserQuestionInput,
  observations: ExecutionObservation,
  config: BotConfig,
  step: StepName
): string {
  const duration = observations.endTime - observations.startTime;
  const toolSummary = observations.tools
    .map((t) => `- ${t.toolName}`)
    .join('\n');
  const filesSummary = [
    ...observations.filesCreated.map((f) => `CREATED: ${f}`),
    ...observations.filesModified.map((f) => `MODIFIED: ${f}`),
  ].join('\n');

  const questionsText = askInput.questions
    .map((q, i) => {
      const optionsText = q.options
        .map((o, j) => `    ${j + 1}. ${o.label} - ${o.description}`)
        .join('\n');
      return `QUESTION ${i + 1}: ${q.question}\nOptions:\n${optionsText}`;
    })
    .join('\n\n');

  return `You are a QA engineer reviewing a workflow step in progress.

## Context
- Step: ${step}
- Mode: ${config.mode}
- Duration so far: ${Math.floor(duration / 1000)}s
- Tools used: ${observations.tools.length}
- Errors encountered: ${observations.errors.length}

## What's Happened So Far

### Tools Used
${toolSummary || '(none yet)'}

### Files Changed
${filesSummary || '(none yet)'}

${observations.errors.length > 0 ? `### Errors\n${observations.errors.join('\n')}` : ''}

## Questions to Answer

${questionsText}

## Your Task

You need to answer these questions as a thoughtful QA engineer would:
1. Use Read, Glob, and Grep tools to inspect the current state of artifacts if needed
2. Consider what you've observed (tools used, files created, errors)
3. For each question, select the most appropriate answer
4. Provide brief reasoning for your choice

Respond in this format:

QUESTION 1:
ANSWER: <option label>
REASONING: <1-2 sentences explaining your choice>

QUESTION 2:
ANSWER: <option label>
REASONING: <1-2 sentences>

Be honest. If work looks incomplete or problematic, don't approve it.
If tests should be run but haven't been, don't skip them without good reason.
Act like a real developer who cares about quality.`;
}

function parseDecisionOutput(
  output: string,
  askInput: AskUserQuestionInput
): IntelligentAnswers {
  const answers: Record<string, string> = {};
  const reasoning: Record<string, string> = {};

  // Parse structured output
  const questionBlocks = output.split(/QUESTION \d+:/i).slice(1);

  askInput.questions.forEach((q, i) => {
    const block = questionBlocks[i] || '';

    const answerMatch = block.match(/ANSWER:\s*(.+?)(?=\n|$)/i);
    const reasoningMatch = block.match(/REASONING:\s*(.+?)(?=\n\n|$)/is);

    const selectedLabel = answerMatch?.[1]?.trim() || '';

    // Find matching option by label (case-insensitive partial match)
    const matchedOption = q.options.find(
      (opt) =>
        opt.label.toLowerCase().includes(selectedLabel.toLowerCase()) ||
        selectedLabel.toLowerCase().includes(opt.label.toLowerCase())
    );

    answers[q.question] = matchedOption?.label || q.options[0].label;
    reasoning[q.question] = reasoningMatch?.[1]?.trim() || 'No reasoning provided';
  });

  return { answers, reasoning };
}

function generateFallbackAnswers(
  askInput: AskUserQuestionInput,
  step: StepName
): IntelligentAnswers {
  // Simple fallback: pick first option for most questions
  // For approval questions, approve; for testing, skip
  const answers: Record<string, string> = {};
  const reasoning: Record<string, string> = {};

  for (const q of askInput.questions) {
    const questionLower = q.question.toLowerCase();

    if (questionLower.includes('approve') || questionLower.includes('proceed')) {
      const approveOption = q.options.find(
        (o) =>
          o.label.toLowerCase().includes('approve') ||
          o.label.toLowerCase().includes('yes')
      );
      answers[q.question] = approveOption?.label || q.options[0].label;
      reasoning[q.question] = 'Fallback approval (LLM unavailable)';
    } else if (questionLower.includes('test')) {
      const skipOption = q.options.find(
        (o) =>
          o.label.toLowerCase().includes('skip') ||
          o.label.toLowerCase().includes('none')
      );
      answers[q.question] = skipOption?.label || q.options[0].label;
      reasoning[q.question] = 'Fallback skip (LLM unavailable)';
    } else {
      answers[q.question] = q.options[0].label;
      reasoning[q.question] = 'Fallback first option (LLM unavailable)';
    }
  }

  return { answers, reasoning };
}
