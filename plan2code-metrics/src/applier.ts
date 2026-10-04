/**
 * applier.ts
 * Interactive review of a PromptProposal: display colored diff per edit,
 * user approves/rejects each edit, apply approved edits to src files.
 */

import fs from 'fs';
import path from 'path';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import type { PromptEdit, PromptProposal } from './types.js';
import { validateEdit } from './improver.js';

const CHAR_LIMIT = 20_000;

// ── Diff display ──────────────────────────────────────────────────────────────

function displayEditDiff(edit: PromptEdit, index: number, total: number): void {
  console.log();
  console.log(chalk.bold(`─── Edit ${index + 1} of ${total} ───────────────────────────────────`));
  console.log(chalk.cyan(`File:     ${edit.file}`));
  console.log(chalk.gray(`Rationale: ${edit.rationale}`));
  console.log(chalk.gray(`Expected impact: ${edit.expected_metric_impact}`));
  console.log(chalk.gray(`Char impact: ${edit.char_count_before} → ${edit.char_count_after} (${edit.char_count_delta >= 0 ? '+' : ''}${edit.char_count_delta})`));

  // Show char count status
  if (edit.char_count_after > CHAR_LIMIT) {
    console.log(chalk.red(`⚠ WARNING: Would exceed ${CHAR_LIMIT} char limit!`));
  } else {
    const headroom = CHAR_LIMIT - edit.char_count_after;
    console.log(chalk.green(`✓ Char count OK (${headroom} chars headroom after edit)`));
  }

  console.log();
  console.log(chalk.bold('── REMOVED (old_text) ──'));

  // Show old text with line-level context
  const oldLines = edit.old_text.split('\n');
  for (const line of oldLines) {
    console.log(chalk.red('- ') + chalk.red(line));
  }

  console.log();
  console.log(chalk.bold('── ADDED (new_text) ──'));

  const newLines = edit.new_text.split('\n');
  for (const line of newLines) {
    console.log(chalk.green('+ ') + chalk.green(line));
  }

  console.log();
}

// ── Apply edit to file ────────────────────────────────────────────────────────

function applyEdit(edit: PromptEdit, plan2codeRoot: string): boolean {
  // Reject path traversal attempts
  if (edit.file.includes('..') || path.isAbsolute(edit.file)) {
    console.error(chalk.red(`✗ Rejected: "${edit.file}" contains path traversal or absolute path`));
    return false;
  }

  const filePath = path.join(plan2codeRoot, 'src', edit.file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(edit.old_text)) {
      console.error(chalk.red(`✗ Cannot apply: old_text not found in ${edit.file} (may have been modified by a previous edit)`));
      return false;
    }
    content = content.replace(edit.old_text, edit.new_text);

    // Post-apply char count check
    if (content.length > CHAR_LIMIT) {
      console.error(chalk.red(`✗ Cannot apply: would exceed ${CHAR_LIMIT} char limit (${content.length} chars)`));
      return false;
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(chalk.green(`✓ Applied edit to ${edit.file} (now ${content.length} chars)`));
    return true;
  } catch (err) {
    console.error(chalk.red(`✗ Failed to apply edit: ${err instanceof Error ? err.message : String(err)}`));
    return false;
  }
}

// ── Main applier ──────────────────────────────────────────────────────────────

export interface ApplierOptions {
  proposalPath: string;
  plan2codeRoot: string;
  proposalsDir: string;
}

export interface ApplierResult {
  approved: number;
  rejected: number;
  applied: number;
  failed: number;
}

export async function reviewAndApply(opts: ApplierOptions): Promise<ApplierResult> {
  const { proposalPath, plan2codeRoot, proposalsDir } = opts;

  // Load proposal
  let proposal: PromptProposal;
  try {
    proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8')) as PromptProposal;
  } catch {
    throw new Error(`Could not read proposal at ${proposalPath}`);
  }

  if (proposal.proposals.length === 0) {
    console.log(chalk.yellow('No edits in this proposal.'));
    return { approved: 0, rejected: 0, applied: 0, failed: 0 };
  }

  console.log();
  console.log(chalk.bold.cyan('=== Plan2Code Prompt Improvement Review ==='));
  console.log(chalk.gray(`Proposal: ${proposal.proposal_id}`));
  console.log(chalk.gray(`Created:  ${proposal.created_at}`));
  console.log(chalk.gray(`Based on: ${proposal.based_on_runs.length} run(s)`));
  console.log(chalk.gray(`Edits:    ${proposal.proposals.length}`));

  // Re-validate all edits against current file state
  const promptContents: Record<string, string> = {};
  const srcDir = path.join(plan2codeRoot, 'src');
  for (const edit of proposal.proposals) {
    if (!promptContents[edit.file]) {
      try {
        promptContents[edit.file] = fs.readFileSync(path.join(srcDir, edit.file), 'utf8');
      } catch {
        promptContents[edit.file] = '';
      }
    }
  }

  let approved = 0;
  let rejected = 0;
  let applied = 0;
  let failed = 0;

  for (let i = 0; i < proposal.proposals.length; i++) {
    const edit = proposal.proposals[i];

    // Re-validate
    const validation = validateEdit(edit, promptContents);
    if (!validation.valid) {
      console.log();
      console.log(chalk.red(`✗ Edit ${i + 1} is no longer valid (files may have changed):`));
      for (const err of validation.errors) {
        console.log(chalk.red(`  - ${err}`));
      }
      rejected++;
      continue;
    }

    displayEditDiff(edit, i, proposal.proposals.length);

    const approve = await confirm({
      message: `Apply this edit to ${edit.file}?`,
      default: true,
    });

    if (!approve) {
      console.log(chalk.gray('Skipped.'));
      rejected++;
      continue;
    }

    approved++;
    const success = applyEdit(edit, plan2codeRoot);
    if (success) {
      applied++;
      // Update in-memory content to reflect the edit
      promptContents[edit.file] = promptContents[edit.file].replace(edit.old_text, edit.new_text);
    } else {
      failed++;
    }
  }

  // Update proposal status
  proposal.status = applied > 0 ? 'applied' : 'rejected';
  fs.writeFileSync(proposalPath, JSON.stringify(proposal, null, 2), 'utf8');

  // Summary
  console.log();
  console.log(chalk.bold('─── Review Complete ──────────────────────────────────'));
  console.log(`Approved: ${chalk.green(String(approved))}  Rejected: ${chalk.red(String(rejected))}  Applied: ${chalk.green(String(applied))}  Failed: ${chalk.red(String(failed))}`);

  if (applied > 0) {
    console.log();
    console.log(chalk.bold.cyan('Next steps — create a PR with your changes:'));
    console.log(chalk.gray('  git add src/'));
    console.log(chalk.gray(`  git commit -m "metrics: apply prompt improvements (${proposal.proposal_id})"`));
    console.log(chalk.gray('  git push -u origin HEAD'));
    console.log(chalk.gray('  gh pr create --title "metrics: apply gen N improvements"'));
  }

  return { approved, rejected, applied, failed };
}
