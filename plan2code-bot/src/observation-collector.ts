import type { ExecutionObservation, StepName } from './types.js';

/**
 * Collects detailed observations during step execution.
 * Tracks tool usage, messages, errors, file changes, and questions asked.
 */
export class ObservationCollector {
  private observations: ExecutionObservation;
  private recentToolKeys: Set<string> = new Set();

  constructor(step: StepName) {
    this.observations = {
      step,
      startTime: Date.now(),
      endTime: 0,
      tools: [],
      assistantMessages: [],
      errors: [],
      filesCreated: [],
      filesModified: [],
      questionsAsked: [],
    };
  }

  /**
   * Records a tool invocation with its input and output.
   * Deduplicates if the same tool+input is recorded from both canUseTool and the message stream.
   */
  recordToolUse(
    toolName: string,
    input: Record<string, unknown>,
    output: unknown,
    allowed: boolean
  ): void {
    // Deduplicate based on tool name + serialized input (within a short time window)
    const key = `${toolName}:${JSON.stringify(input)}`;
    if (this.recentToolKeys.has(key)) {
      return;
    }
    this.recentToolKeys.add(key);
    // Clean up old keys periodically to avoid unbounded growth
    if (this.recentToolKeys.size > 500) {
      const entries = [...this.recentToolKeys];
      this.recentToolKeys = new Set(entries.slice(entries.length - 250));
    }

    this.observations.tools.push({
      toolName,
      input,
      output,
      timestamp: Date.now(),
      allowed,
      autoAnswered: toolName === 'AskUserQuestion',
    });

    // Extract file paths from common tools
    if (toolName === 'Write' && input.file_path) {
      this.observations.filesCreated.push(input.file_path as string);
    }
    if (toolName === 'Edit' && input.file_path) {
      this.observations.filesModified.push(input.file_path as string);
    }
  }

  /**
   * Records messages from the session (assistant text, errors).
   */
  recordMessage(message: any): void {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          this.observations.assistantMessages.push(block.text);
        }
      }
    }
    if (message.type === 'error') {
      this.observations.errors.push(message.error?.message ?? 'Unknown error');
    }
  }

  /**
   * Records a question that was asked and the LLM-generated answer.
   */
  recordQuestion(
    question: string,
    options: Array<{ label: string; description: string }>,
    selectedAnswer: string,
    llmReasoning: string
  ): void {
    this.observations.questionsAsked.push({
      question,
      options,
      llmReasoning,
      selectedAnswer,
      timestamp: Date.now(),
    });
  }

  /**
   * Gets a snapshot of current observations (for real-time decision making).
   */
  getSnapshot(): ExecutionObservation {
    return { ...this.observations, endTime: Date.now() };
  }

  /**
   * Finalizes observations and returns the complete record.
   */
  finalize(): ExecutionObservation {
    this.observations.endTime = Date.now();
    return { ...this.observations };
  }
}
