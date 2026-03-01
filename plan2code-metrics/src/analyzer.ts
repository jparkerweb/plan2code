/**
 * analyzer.ts
 * Reads aggregated.json + prompt file contents, builds analysis prompt, invokes AI.
 */

import fs from 'fs';
import path from 'path';
import type { AggregatedMetrics } from './types.js';
import { invokeLLM, type AgentType } from './invoke-llm.js';

const ANALYZE_PROMPT_PATH = new URL('../src/prompts/analyze.md', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1'); // Fix Windows path

// ── Helpers ───────────────────────────────────────────────────────────────────

function readPromptFiles(plan2codeRoot: string): Record<string, string> {
  const srcDir = path.join(plan2codeRoot, 'src');
  const promptFiles = [
    'plan2code-1--plan.md',
    'plan2code-1b--revise-plan.md',
    'plan2code-2--document.md',
    'plan2code-3--implement.md',
    'plan2code-4--finalize.md',
    'plan2code---init.md',
    'plan2code---init-update.md',
    'plan2code---quick-task.md',
  ];

  const contents: Record<string, string> = {};
  for (const file of promptFiles) {
    try {
      contents[file] = fs.readFileSync(path.join(srcDir, file), 'utf8');
    } catch {
      contents[file] = '(file not found)';
    }
  }
  return contents;
}

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

function generateDiagnosisId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `diag-${ts}`;
}

// ── Main analyzer ─────────────────────────────────────────────────────────────

export interface AnalyzerOptions {
  aggregatedPath: string;    // Path to aggregated.json
  plan2codeRoot: string;     // Path to plan2code repo root
  proposalsDir: string;      // Where to save diagnosis output
  model?: string;            // AI model to use (default: agent's default)
  agent?: AgentType;         // Agent to use (default: claude-code)
}

export async function runAnalysis(opts: AnalyzerOptions): Promise<string> {
  const { aggregatedPath, plan2codeRoot, proposalsDir, model = 'default', agent = 'claude-code' } = opts;

  // Load aggregated metrics
  let aggregated: AggregatedMetrics | null = null;
  try {
    aggregated = JSON.parse(fs.readFileSync(aggregatedPath, 'utf8')) as AggregatedMetrics;
  } catch {
    throw new Error(`Could not read aggregated metrics at ${aggregatedPath}. Run "Collect metrics" and "Import run data" first.`);
  }

  if (aggregated.total_runs === 0) {
    throw new Error('No runs in aggregated metrics. Collect and import some runs first.');
  }

  // Read prompt files
  const promptContents = readPromptFiles(plan2codeRoot);

  // Format for interpolation
  const promptContentsStr = Object.entries(promptContents)
    .map(([file, content]) => `## ${file}\n\n${content}`)
    .join('\n\n---\n\n');

  const aggregatedStr = JSON.stringify(aggregated, null, 2);

  // Load analyze prompt template
  let analyzeTemplate: string;
  try {
    analyzeTemplate = fs.readFileSync(ANALYZE_PROMPT_PATH, 'utf8');
  } catch {
    // Fallback: look relative to cwd
    const altPath = path.join(process.cwd(), 'src', 'prompts', 'analyze.md');
    analyzeTemplate = fs.readFileSync(altPath, 'utf8');
  }

  const fullPrompt = interpolate(analyzeTemplate, {
    aggregatedMetrics: aggregatedStr,
    promptContents: promptContentsStr,
  });

  // Invoke Claude
  console.log(`\nInvoking AI analysis (agent: ${agent}, model: ${model === 'default' ? 'user default' : model})...`);
  console.log('This may take a minute...\n');

  let diagnosisContent: string;
  try {
    diagnosisContent = await invokeLLM({
      prompt: fullPrompt,
      model,
      agent,
      timeout: 300_000,
    });
  } catch (err) {
    throw new Error(`AI invocation failed: ${err instanceof Error ? err.message : String(err)}\n\nMake sure the ${agent} CLI is installed and authenticated.`);
  }

  // Save diagnosis
  const diagId = generateDiagnosisId();
  fs.mkdirSync(proposalsDir, { recursive: true });
  const diagPath = path.join(proposalsDir, `${diagId}-diagnosis.md`);
  fs.writeFileSync(diagPath, diagnosisContent, 'utf8');

  console.log(`Diagnosis saved to: ${diagPath}`);
  return diagPath;
}
