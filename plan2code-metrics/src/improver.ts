/**
 * improver.ts
 * Reads diagnosis + prompt files, invokes AI, parses PromptEdit[] from response.
 * Validates: old_text verbatim match, char count limits.
 */

import fs from 'fs';
import path from 'path';
import type { PromptEdit, PromptProposal } from './types.js';
import { invokeLLM, type AgentType } from './invoke-llm.js';

const CHAR_LIMIT = 20_000;
const IMPROVE_PROMPT_PATH = new URL('../src/prompts/improve.md', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1'); // Fix Windows path

// ── Helpers ───────────────────────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

function generateProposalId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `prop-${ts}`;
}

function readPromptFiles(plan2codeRoot: string): Record<string, string> {
  const srcDir = path.join(plan2codeRoot, 'src');
  const promptFiles = [
    'plan2code-1-plan.md',
    'plan2code-1b-revise-plan.md',
    'plan2code-2-document.md',
    'plan2code-3-implement.md',
    'plan2code-4-finalize.md',
    'plan2code-init.md',
    'plan2code-init-update.md',
    'plan2code-quick-task.md',
  ];

  const contents: Record<string, string> = {};
  for (const file of promptFiles) {
    try {
      contents[file] = fs.readFileSync(path.join(srcDir, file), 'utf8');
    } catch {
      contents[file] = '';
    }
  }
  return contents;
}

// ── Edit validation ───────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEdit(
  edit: PromptEdit,
  promptContents: Record<string, string>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Reject path traversal attempts
  if (edit.file.includes('..') || path.isAbsolute(edit.file)) {
    errors.push(`Rejected: "${edit.file}" contains path traversal or absolute path.`);
    return { valid: false, errors, warnings };
  }

  // Check target file exists
  const fileContent = promptContents[edit.file];
  if (fileContent === undefined) {
    errors.push(`Target file "${edit.file}" not found. Valid files: ${Object.keys(promptContents).join(', ')}`);
    return { valid: false, errors, warnings };
  }

  // Check old_text exists verbatim in the file
  if (!fileContent.includes(edit.old_text)) {
    errors.push(`old_text not found verbatim in "${edit.file}". The AI may have hallucinated text.`);
  } else {
    // Warn if old_text appears more than once (ambiguous match)
    const occurrences = fileContent.split(edit.old_text).length - 1;
    if (occurrences > 1) {
      warnings.push(`old_text appears ${occurrences} times in "${edit.file}". Only the first occurrence will be replaced.`);
    }
  }

  // Check char count after edit
  const afterContent = fileContent.replace(edit.old_text, edit.new_text);
  if (afterContent.length > CHAR_LIMIT) {
    errors.push(`Edit would cause "${edit.file}" to exceed ${CHAR_LIMIT} char limit (would be ${afterContent.length} chars).`);
  }

  // Verify reported char counts match reality
  const actualBefore = fileContent.length;
  const actualAfter = afterContent.length;
  if (Math.abs(edit.char_count_before - actualBefore) > 10) {
    warnings.push(`Reported char_count_before (${edit.char_count_before}) differs from actual (${actualBefore}).`);
  }
  if (Math.abs(edit.char_count_after - actualAfter) > 10) {
    warnings.push(`Reported char_count_after (${edit.char_count_after}) differs from actual (${actualAfter}).`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── AI response parsing ───────────────────────────────────────────────────────

export function parseProposalFromResponse(response: string): PromptEdit[] | null {
  // Look for JSON code block containing PromptEdit[]
  const jsonBlockMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (!jsonBlockMatch) {
    // Try bare JSON array
    const bareMatch = response.match(/(\[[\s\S]*"old_text"[\s\S]*\])/);
    if (!bareMatch) return null;
    try {
      return JSON.parse(bareMatch[1]) as PromptEdit[];
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(jsonBlockMatch[1]) as PromptEdit[];
  } catch {
    return null;
  }
}

// ── Main improver ─────────────────────────────────────────────────────────────

export interface ImproverOptions {
  diagnosisPath: string;     // Path to diagnosis markdown file
  plan2codeRoot: string;     // Path to plan2code repo root
  proposalsDir: string;      // Where to save proposal JSON
  runsDir: string;           // For tracking which runs this is based on
  model?: string;
  agent?: AgentType;         // Agent to use (default: claude-code)
}

export interface ImproverResult {
  proposalPath: string;
  proposal: PromptProposal;
  validationResults: Array<{ edit: PromptEdit; result: ValidationResult }>;
  validEditCount: number;
  invalidEditCount: number;
}

export async function generateImprovement(opts: ImproverOptions): Promise<ImproverResult> {
  const { diagnosisPath, plan2codeRoot, proposalsDir, runsDir, model = 'default', agent = 'claude-code' } = opts;

  // Load diagnosis
  let diagnosisContent: string;
  try {
    diagnosisContent = fs.readFileSync(diagnosisPath, 'utf8');
  } catch {
    throw new Error(`Could not read diagnosis file at ${diagnosisPath}`);
  }

  // Read prompt files
  const promptContents = readPromptFiles(plan2codeRoot);
  const srcDir = path.join(plan2codeRoot, 'src');

  // Build char counts for each file
  const charCounts = Object.entries(promptContents)
    .map(([file, content]) => `| ${file} | ${content.length} | ${CHAR_LIMIT} | ${CHAR_LIMIT - content.length} headroom |`)
    .join('\n');

  const promptContentsStr = Object.entries(promptContents)
    .map(([file, content]) => `## ${file} (${content.length} chars)\n\n${content}`)
    .join('\n\n---\n\n');

  // Load improve prompt template
  let improveTemplate: string;
  try {
    improveTemplate = fs.readFileSync(IMPROVE_PROMPT_PATH, 'utf8');
  } catch {
    const altPath = path.join(process.cwd(), 'src', 'prompts', 'improve.md');
    improveTemplate = fs.readFileSync(altPath, 'utf8');
  }

  const fullPrompt = interpolate(improveTemplate, {
    diagnosisContent,
    promptContents: promptContentsStr,
    charCounts: `| File | Current Chars | Limit | Headroom |\n|------|--------------|-------|----------|\n${charCounts}`,
  });

  // Invoke Claude
  console.log(`\nInvoking AI improvement proposal (agent: ${agent}, model: ${model === 'default' ? 'user default' : model})...`);
  console.log('This may take a minute...\n');

  let aiResponse: string;
  try {
    aiResponse = await invokeLLM({
      prompt: fullPrompt,
      model,
      agent,
      timeout: 300_000,
    });
  } catch (err) {
    throw new Error(`AI invocation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse edits
  const rawEdits = parseProposalFromResponse(aiResponse);
  if (!rawEdits || rawEdits.length === 0) {
    throw new Error('Could not parse PromptEdit[] from AI response. The AI may not have produced a valid JSON block.');
  }

  // Enforce max edits per cycle
  const MAX_EDITS = 5;
  if (rawEdits.length > MAX_EDITS) {
    console.warn(`\n⚠ AI generated ${rawEdits.length} edits (max is ${MAX_EDITS}). Truncating to first ${MAX_EDITS}.`);
    rawEdits.length = MAX_EDITS;
  }

  // Validate each edit
  const validationResults: ImproverResult['validationResults'] = [];
  const validEdits: PromptEdit[] = [];

  for (const edit of rawEdits) {
    const result = validateEdit(edit, promptContents);
    validationResults.push({ edit, result });

    if (result.valid) {
      // Compute accurate char counts
      const fileContent = promptContents[edit.file] ?? '';
      const afterContent = fileContent.replace(edit.old_text, edit.new_text);
      edit.char_count_before = fileContent.length;
      edit.char_count_after = afterContent.length;
      edit.char_count_delta = afterContent.length - fileContent.length;
      validEdits.push(edit);
    } else {
      console.warn(`\n⚠ Edit rejected for "${edit.file}":`);
      for (const err of result.errors) {
        console.warn(`  - ${err}`);
      }
    }

    for (const warn of result.warnings) {
      console.warn(`  Warning: ${warn}`);
    }
  }

  // Get run IDs that contributed to this analysis
  const runIds: string[] = [];
  try {
    const files = fs.readdirSync(runsDir)
      .filter(f => f.startsWith('run-') && f.endsWith('.json'));
    runIds.push(...files.map(f => f.replace('.json', '')));
  } catch { /* no runs dir */ }

  // Build proposal
  const proposalId = generateProposalId();
  const proposal: PromptProposal = {
    proposal_id: proposalId,
    created_at: new Date().toISOString(),
    based_on_runs: runIds,
    analyst_model: model,
    proposals: validEdits,
    status: 'pending',
    diagnosis_file: path.basename(diagnosisPath),
  };

  // Save proposal JSON
  fs.mkdirSync(proposalsDir, { recursive: true });
  const proposalPath = path.join(proposalsDir, `${proposalId}.json`);
  fs.writeFileSync(proposalPath, JSON.stringify(proposal, null, 2), 'utf8');

  // Also save raw AI response alongside
  const rawPath = path.join(proposalsDir, `${proposalId}-raw.md`);
  fs.writeFileSync(rawPath, aiResponse, 'utf8');

  return {
    proposalPath,
    proposal,
    validationResults,
    validEditCount: validEdits.length,
    invalidEditCount: rawEdits.length - validEdits.length,
  };
}
