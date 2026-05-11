import { query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs-extra';
import path from 'path';
import type { EvaluationResult, ExecutionObservation, StepName } from './types.js';
import { getCriteriaForStep } from './prompts/evaluation-criteria.js';

/**
 * Evaluates a completed step using LLM-as-judge.
 * Returns honest quality assessment based on observations and artifacts.
 */
export async function evaluateStep(
  step: StepName,
  observations: ExecutionObservation,
  projectDir: string
): Promise<EvaluationResult> {
  const criteria = getCriteriaForStep(step);
  const prompt = buildEvaluationPrompt(step, observations, criteria, projectDir);

  try {
    // Query LLM with ability to inspect artifacts
    const session = query({
      prompt,
      options: {
        maxTurns: 30,
        cwd: projectDir,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        allowedTools: ['Read', 'Glob', 'Grep'],
        systemPrompt:
          'You are a QA engineer evaluating completed work. Be thorough, honest, and constructive.',
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

    const evaluation = parseEvaluationOutput(output, step);

    // Write evaluation files
    await writeEvaluationFiles(evaluation, observations, projectDir);

    return evaluation;
  } catch (error) {
    console.warn('Evaluation failed, using fallback:', error);
    return createFallbackEvaluation(step, observations);
  }
}

function buildEvaluationPrompt(
  step: StepName,
  observations: ExecutionObservation,
  criteria: ReturnType<typeof getCriteriaForStep>,
  projectDir: string
): string {
  const duration = observations.endTime - observations.startTime;
  const durationSec = Math.floor(duration / 1000);

  const toolsSummary = observations.tools
    .map((t) => `- ${t.toolName} (${new Date(t.timestamp).toISOString()})`)
    .join('\n');

  const filesSummary = [
    ...observations.filesCreated.map((f) => `CREATED: ${f}`),
    ...observations.filesModified.map((f) => `MODIFIED: ${f}`),
  ].join('\n');

  const questionsSummary = observations.questionsAsked
    .map(
      (q) =>
        `Q: ${q.question}\nA: ${q.selectedAnswer}\nReasoning: ${q.llmReasoning}`
    )
    .join('\n\n');

  return `You are a QA engineer evaluating the quality of a completed workflow step.

## Step Information
- Step: ${step}
- Duration: ${durationSec}s
- Tools used: ${observations.tools.length}
- Files created: ${observations.filesCreated.length}
- Files modified: ${observations.filesModified.length}
- Errors: ${observations.errors.length}

## Execution Details

### Tools Used
${toolsSummary || '(none)'}

### Files Changed
${filesSummary || '(none)'}

${observations.questionsAsked.length > 0 ? `### Questions & Decisions\n${questionsSummary}` : ''}

${observations.errors.length > 0 ? `### Errors Encountered\n${observations.errors.join('\n')}` : ''}

## Evaluation Criteria

**Key Artifacts Expected:**
${criteria.keyArtifacts.map((a) => `- ${a}`).join('\n')}

**Quality Checks:**
${criteria.qualityChecks.map((c) => `- ${c}`).join('\n')}

**Common Pitfalls to Watch For:**
${criteria.commonPitfalls.map((p) => `- ${p}`).join('\n')}

**Scoring Guidance:**
${criteria.scoringGuidance}

## Your Task

Evaluate this step honestly and thoroughly:

1. **Inspect the artifacts** using Read, Glob, and Grep tools
2. **Check against quality criteria** listed above
3. **Identify strengths and weaknesses** based on actual evidence
4. **Provide constructive suggestions** for improvement
5. **Assign an honest score** (0-100) following the guidance

Be critical but fair. Most work scores 70-85. Don't inflate scores.

## Response Format

SCORE: <number 0-100>

STRENGTHS:
- <strength 1>
- <strength 2>
- <strength 3>

WEAKNESSES:
- <weakness 1>
- <weakness 2>

SUGGESTIONS:
- <suggestion 1>
- <suggestion 2>

CRITICAL_ISSUES:
- <critical issue 1 (or "None")>

REASONING:
<1-2 paragraphs explaining your evaluation, referencing specific files/evidence>

Provide honest, evidence-based evaluation.`;
}

function parseEvaluationOutput(
  output: string,
  step: StepName
): EvaluationResult {
  // Extract score
  const scoreMatch = output.match(/SCORE:\s*(\d+)/i);
  if (!scoreMatch) {
    console.warn(`Evaluation parser: no SCORE found in output (${output.length} chars). Defaulting to 50.`);
  }
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;

  // Extract sections
  const strengthsMatch = output.match(
    /STRENGTHS:\s*((?:- .+\n?)+)/i
  );
  const weaknessesMatch = output.match(
    /WEAKNESSES:\s*((?:- .+\n?)+)/i
  );
  const suggestionsMatch = output.match(
    /SUGGESTIONS:\s*((?:- .+\n?)+)/i
  );
  const criticalMatch = output.match(
    /CRITICAL_ISSUES:\s*((?:- .+\n?)+)/i
  );
  const reasoningMatch = output.match(/REASONING:\s*(.+?)(?=\n\n|$)/is);

  const parseList = (text: string | undefined): string[] => {
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter((line) => line.length > 0 && !line.toLowerCase().includes('none'));
  };

  return {
    step,
    score: Math.max(0, Math.min(100, score)),
    strengths: parseList(strengthsMatch?.[1]),
    weaknesses: parseList(weaknessesMatch?.[1]),
    suggestions: parseList(suggestionsMatch?.[1]),
    criticalIssues: parseList(criticalMatch?.[1]),
    timestamp: Date.now(),
    evaluatorModel: 'claude-sonnet-4-5',
    reasoning: reasoningMatch?.[1]?.trim() || 'No reasoning provided',
  };
}

function createFallbackEvaluation(
  step: StepName,
  observations: ExecutionObservation
): EvaluationResult {
  return {
    step,
    score: 50,
    strengths: ['Step completed'],
    weaknesses: ['Evaluation failed - using fallback'],
    suggestions: ['Re-run with evaluation enabled'],
    criticalIssues: ['Evaluation system unavailable'],
    timestamp: Date.now(),
    evaluatorModel: 'fallback',
    reasoning: 'Evaluation failed, using fallback. Cannot provide detailed assessment.',
  };
}

/**
 * Resolves the active spec subdirectory (e.g. specs/<feature>/).
 * Falls back to projectDir if no spec folder exists yet (e.g. during init).
 */
function resolveOutputDir(projectDir: string): string {
  const specsDir = path.join(projectDir, 'specs');
  if (fs.existsSync(specsDir)) {
    const entries = fs.readdirSync(specsDir, { withFileTypes: true });
    const firstSpec = entries.find((e) => e.isDirectory());
    if (firstSpec) {
      return path.join(specsDir, firstSpec.name);
    }
  }
  return projectDir;
}

async function writeEvaluationFiles(
  evaluation: EvaluationResult,
  observations: ExecutionObservation,
  projectDir: string
): Promise<void> {
  const outputDir = resolveOutputDir(projectDir);

  // Write BOT-EVALUATION.md
  const evalContent = formatEvaluationMarkdown(evaluation);
  const evalPath = path.join(outputDir, 'BOT-EVALUATION.md');

  if (fs.existsSync(evalPath)) {
    // Append to existing file
    const existing = fs.readFileSync(evalPath, 'utf-8');
    fs.writeFileSync(evalPath, existing + '\n\n---\n\n' + evalContent);
  } else {
    fs.writeFileSync(evalPath, evalContent);
  }

  // Write BOT-NOTES.md
  const notesContent = formatObservationsMarkdown(observations);
  const notesPath = path.join(outputDir, 'BOT-NOTES.md');

  if (fs.existsSync(notesPath)) {
    const existing = fs.readFileSync(notesPath, 'utf-8');
    fs.writeFileSync(notesPath, existing + '\n\n---\n\n' + notesContent);
  } else {
    fs.writeFileSync(notesPath, notesContent);
  }
}

function formatEvaluationMarkdown(evaluation: EvaluationResult): string {
  return `# Evaluation: ${evaluation.step} Step

**Score:** ${evaluation.score}/100
**Timestamp:** ${new Date(evaluation.timestamp).toISOString()}
**Evaluator:** ${evaluation.evaluatorModel}

## Strengths
${evaluation.strengths.map((s) => `- ${s}`).join('\n') || '(none)'}

## Weaknesses
${evaluation.weaknesses.map((w) => `- ${w}`).join('\n') || '(none)'}

## Suggestions for Improvement
${evaluation.suggestions.map((s) => `- ${s}`).join('\n') || '(none)'}

${evaluation.criticalIssues.length > 0 ? `## Critical Issues\n${evaluation.criticalIssues.map((i) => `- ${i}`).join('\n')}\n` : ''}

## Reasoning
${evaluation.reasoning}`;
}

function formatObservationsMarkdown(observations: ExecutionObservation): string {
  const duration = observations.endTime - observations.startTime;
  const durationSec = Math.floor(duration / 1000);

  return `# Observations: ${observations.step} Step

**Duration:** ${durationSec}s
**Tools Used:** ${observations.tools.length}
**Files Created:** ${observations.filesCreated.length}
**Files Modified:** ${observations.filesModified.length}
**Errors:** ${observations.errors.length}

${observations.questionsAsked.length > 0 ? `## Questions Asked & Answers\n\n${observations.questionsAsked.map((q) => `### Question: "${q.question}"\n**Selected:** "${q.selectedAnswer}"\n**Reasoning:** ${q.llmReasoning}`).join('\n\n')}\n` : ''}

## Tool Usage
${observations.tools.map((t) => `- ${t.toolName}`).join('\n')}

## Files Created
${observations.filesCreated.map((f) => `- ${f}`).join('\n') || '(none)'}

## Files Modified
${observations.filesModified.map((f) => `- ${f}`).join('\n') || '(none)'}

${observations.assistantMessages.length > 0 ? `## Assistant Output Summary\n${observations.assistantMessages.slice(0, 3).map((m) => `> ${m.substring(0, 100)}...`).join('\n')}\n` : ''}`;
}
