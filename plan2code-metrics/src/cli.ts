/**
 * cli.ts
 * 100% interactive menu-driven CLI for plan2code-metrics.
 * No flags — all inputs collected via @inquirer/prompts.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { collectRun } from './collector.js';
import { aggregate, loadAggregated, importRun, loadRunFiles } from './aggregator.js';
import { runAnalysis } from './analyzer.js';
import { generateImprovement } from './improver.js';
import { reviewAndApply } from './applier.js';
import type { AggregatedMetrics, CohortMetrics } from './types.js';
import { METRIC_TARGETS } from './types.js';
import { AGENTS, type AgentType } from './invoke-llm.js';

// ── Session state (set at startup via interactive prompts) ───────────────────

let resolvedPlan2CodeRoot = '';
let resolvedProjectRoot = '';

// ── Persisted user config (~/.plan2code-metrics.json) ──────────────────────

const USER_CONFIG_PATH = path.join(os.homedir(), '.plan2code-metrics.json');

interface UserConfig {
  plan2codeRepoPath?: string;
}

function loadUserConfig(): UserConfig {
  try {
    return JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveUserConfig(config: UserConfig): void {
  try {
    fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch { /* best-effort */ }
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_METRICS_DIR = '.plan2code-metrics';
const DEFAULT_RUNS_SUBDIR = 'runs';
const DEFAULT_AGGREGATED_FILE = 'aggregated.json';
const DEFAULT_PROPOSALS_SUBDIR = 'proposals';

function getMetricsDirs(baseDir = resolvedProjectRoot) {
  const metricsDir = path.join(baseDir, DEFAULT_METRICS_DIR);
  return {
    metricsDir,
    runsDir: path.join(metricsDir, DEFAULT_RUNS_SUBDIR),
    aggregatedPath: path.join(metricsDir, DEFAULT_AGGREGATED_FILE),
    proposalsDir: path.join(metricsDir, DEFAULT_PROPOSALS_SUBDIR),
  };
}

// Detect plan2code root (either this directory or parent directories)
function detectPlan2CodeRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const srcDir = path.join(dir, 'src');
    if (
      fs.existsSync(path.join(srcDir, 'plan2code-1--plan.md')) &&
      fs.existsSync(path.join(srcDir, 'plan2code-2--document.md'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Detect plan2code version
function detectPlan2CodeVersion(plan2codeRoot: string): string {
  try {
    const versionPath = path.join(plan2codeRoot, 'version.json');
    const content = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    return content.version ?? '0.0.0';
  } catch {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(plan2codeRoot, 'package.json'), 'utf8'));
      return pkg.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}

// ── Metric health helpers ─────────────────────────────────────────────────────

function metricStatus(key: string, value: number | null): string {
  if (value == null) return chalk.gray('N/A');
  const target = METRIC_TARGETS[key as keyof typeof METRIC_TARGETS];
  if (!target) return chalk.white(String(Math.round(value * 100) / 100));

  const ok = target.direction === 'gte' ? value >= target.target : value <= target.target;
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return ok ? chalk.green(`✓ ${formatted}`) : chalk.red(`✗ ${formatted} (target: ${target.direction === 'gte' ? '≥' : '≤'}${target.target})`);
}

// ── Agent + model selection ───────────────────────────────────────────────────

async function selectAgentAndModel(): Promise<{ agent: AgentType; model: string }> {
  const agentChoice = await select({
    message: 'Which AI agent?',
    choices: Object.values(AGENTS).map(a => ({ name: a.displayName, value: a.name })),
  });

  return { agent: agentChoice, model: AGENTS[agentChoice].defaultModel };
}

// ── Flow: Collect metrics ─────────────────────────────────────────────────────

async function flowCollect(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan('── Collect Metrics ──'));

  const sourceChoice = await select({
    message: 'Where is the completed project spec?',
    choices: [
      { name: 'Archived spec (specs--completed/<feature-name>/)', value: 'archived' },
      { name: 'Active spec directory (specs/<feature-name>/)', value: 'active' },
      { name: 'Custom path', value: 'custom' },
    ],
  });

  let specDir: string;
  let projectName: string;

  if (sourceChoice === 'active' || sourceChoice === 'archived') {
    const baseSubdir = sourceChoice === 'active' ? 'specs' : 'specs--completed';
    const baseDir = path.join(resolvedProjectRoot, baseSubdir);

    if (!fs.existsSync(baseDir)) {
      console.log(chalk.red(`No ${baseSubdir}/ directory found in ${resolvedProjectRoot}`));
      return;
    }

    const entries = fs.readdirSync(baseDir)
      .filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());

    if (entries.length === 0) {
      console.log(chalk.red(`No spec directories found in ${baseSubdir}/`));
      return;
    }

    const chosen = await select({
      message: 'Select spec directory:',
      choices: entries.map(e => ({ name: e, value: e })),
    });

    specDir = path.join(baseDir, chosen);
    projectName = chosen;
  } else {
    specDir = await input({
      message: 'Enter full path to spec directory:',
      validate: (v) => fs.existsSync(v) ? true : 'Directory not found',
    });
    projectName = await input({
      message: 'Project name (for metrics label):',
      default: path.basename(specDir),
    });
  }

  // Detect plan2code root
  const plan2codeRoot = resolvedPlan2CodeRoot;
  const plan2codeVersion = detectPlan2CodeVersion(plan2codeRoot);

  const { runsDir, aggregatedPath } = getMetricsDirs();

  const spinner = ora('Collecting metrics from project artifacts...').start();
  try {
    const metrics = await collectRun({
      specDir,
      projectName,
      plan2codeRoot,
      plan2codeVersion,
      outputDir: runsDir,
    });

    spinner.succeed(`Metrics collected: ${metrics.run_id}`);
    console.log(chalk.gray(`  Saved to: ${runsDir}/${metrics.run_id}.json`));

    // Re-aggregate
    aggregate(runsDir, aggregatedPath);
    console.log(chalk.gray('  Aggregated metrics updated.'));

    // Show summary
    console.log();
    console.log(chalk.bold('Collected:'));
    console.log(`  Step 1 (Plan):       ${metrics.step1_plan.present ? chalk.green('✓') : chalk.gray('—')}`);
    console.log(`  Step 2 (Document):   ${metrics.step2_document.present ? chalk.green('✓') : chalk.gray('—')}`);
    console.log(`  Step 3 (Implement):  ${metrics.step3_implement.present ? chalk.green('✓') : chalk.gray('—')}`);
    console.log(`  Step 4 (Finalize):   ${metrics.step4_finalize.present ? chalk.green('✓') : chalk.gray('—')}`);
    console.log(`  User Feedback:       ${metrics.user_feedback ? chalk.green(`✓ (${metrics.user_feedback.overall_rating}/10)`) : chalk.gray('—')}`);

    // Offer to collect feedback interactively if not present
    if (!metrics.user_feedback) {
      console.log();
      const wantFeedback = await confirm({
        message: 'No user feedback found in overview.md. Would you like to provide feedback now?',
        default: false,
      });

      if (wantFeedback) {
        const rating = await input({
          message: 'Overall rating (1-10):',
          validate: (v) => {
            const n = parseInt(v, 10);
            return (n >= 1 && n <= 10) ? true : 'Must be a number between 1 and 10';
          },
        });
        const reason = await input({ message: 'Rating reason:' });
        const wentWell = await input({ message: 'What went well?' });
        const wentPoorly = await input({ message: 'What went poorly?' });

        // Write the feedback table into overview.md
        const overviewPath = path.join(specDir, 'overview.md');
        let overviewContent = '';
        try {
          overviewContent = fs.readFileSync(overviewPath, 'utf8');
        } catch { /* empty */ }

        // Escape pipe characters in user text to prevent table parsing issues
        const esc = (s: string) => s.replace(/\|/g, '\\|');

        const feedbackTable = [
          '',
          '## User Feedback',
          '| Field | Value |',
          '|-------|-------|',
          `| Rating | ${rating} |`,
          `| Reason | ${esc(reason)} |`,
          `| Went Well | ${esc(wentWell)} |`,
          `| Went Poorly | ${esc(wentPoorly)} |`,
          '',
        ].join('\n');

        fs.writeFileSync(overviewPath, overviewContent + feedbackTable, 'utf8');
        console.log(chalk.green('✓ Feedback written to overview.md'));

        // Delete the original run (without feedback) before re-collecting
        const originalRunPath = path.join(runsDir, `${metrics.run_id}.json`);
        try { fs.unlinkSync(originalRunPath); } catch { /* ignore */ }

        // Re-collect and re-aggregate
        const reSpinner = ora('Re-collecting metrics with feedback...').start();
        const updatedMetrics = await collectRun({
          specDir,
          projectName,
          plan2codeRoot,
          plan2codeVersion,
          outputDir: runsDir,
        });
        aggregate(runsDir, aggregatedPath);
        reSpinner.succeed(`Updated: ${updatedMetrics.run_id} (rating: ${updatedMetrics.user_feedback?.overall_rating}/10)`);
      }
    }
  } catch (err) {
    spinner.fail(`Collection failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Flow: Import run data ─────────────────────────────────────────────────────

async function flowImport(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan('── Import Run Data ──'));
  console.log(chalk.gray('Copy a run JSON from another project into this repo for aggregation.'));
  console.log();

  const sourcePath = await input({
    message: 'Path to run JSON file (e.g., /path/to/project/.plan2code-metrics/runs/run-xxx.json):',
    validate: (v) => {
      if (!fs.existsSync(v)) return 'File not found';
      if (!v.endsWith('.json')) return 'Must be a .json file';
      return true;
    },
  });

  const { runsDir, aggregatedPath } = getMetricsDirs();

  try {
    const imported = importRun(sourcePath, runsDir);
    if (!imported) {
      console.log(chalk.yellow('Run already imported (same run_id exists).'));
    } else {
      console.log(chalk.green(`✓ Imported ${path.basename(sourcePath)}`));
    }

    const spinner = ora('Re-aggregating...').start();
    const aggregated = aggregate(runsDir, aggregatedPath);
    spinner.succeed(`Aggregated metrics updated (${aggregated.total_runs} total runs)`);
  } catch (err) {
    console.error(chalk.red(`Import failed: ${err instanceof Error ? err.message : String(err)}`));
  }
}

// ── Flow: View metrics status ─────────────────────────────────────────────────

async function flowViewStatus(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan('── Metrics Status & History ──'));

  const { runsDir, aggregatedPath } = getMetricsDirs();
  const aggregated = loadAggregated(aggregatedPath);

  if (!aggregated || aggregated.total_runs === 0) {
    console.log(chalk.yellow('No metrics collected yet. Use "Collect metrics" to get started.'));
    return;
  }

  console.log();
  console.log(chalk.bold(`Total runs: ${aggregated.total_runs}  |  Generations: ${aggregated.cohorts.length}`));
  console.log(chalk.gray(`Last updated: ${aggregated.last_updated}`));

  for (let i = 0; i < aggregated.cohorts.length; i++) {
    const cohort = aggregated.cohorts[i];
    const isCurrent = cohort.cohort_key === aggregated.current_cohort_key;
    const label = isCurrent ? chalk.bold.green('[CURRENT]') : '';

    console.log();
    console.log(chalk.bold(`Generation ${i + 1} (sha:${cohort.cohort_key}) — ${cohort.run_count} run(s) ${label}`));
    console.log(chalk.gray(`  Period: ${cohort.first_seen?.slice(0, 10)} → ${cohort.last_seen?.slice(0, 10)}`));

    // Step 1 metrics
    if (cohort.avg_confidence != null || cohort.avg_clarification_rounds != null) {
      console.log(chalk.bold('  Step 1 (Plan):'));
      if (cohort.avg_confidence != null)
        console.log(`    avg_confidence:           ${metricStatus('avg_confidence', cohort.avg_confidence)}`);
      if (cohort.avg_clarification_rounds != null)
        console.log(`    avg_clarification_rounds: ${metricStatus('avg_clarification_rounds', cohort.avg_clarification_rounds)}`);
      if (cohort.avg_verification_gaps_found != null)
        console.log(`    avg_verification_gaps:    ${metricStatus('avg_verification_gaps_found', cohort.avg_verification_gaps_found)}`);
    }

    // Step 2 metrics
    if (cohort.avg_total_tasks != null || cohort.avg_parallel_groups != null) {
      console.log(chalk.bold('  Step 2 (Document):'));
      if (cohort.avg_total_tasks != null)
        console.log(`    avg_total_tasks:          ${chalk.white(cohort.avg_total_tasks.toFixed(1))}`);
      if (cohort.avg_parallel_groups != null)
        console.log(`    avg_parallel_groups:      ${metricStatus('avg_parallel_groups', cohort.avg_parallel_groups)}`);
      if (cohort.avg_verification_items_added != null)
        console.log(`    avg_verification_items:   ${metricStatus('avg_verification_items_added', cohort.avg_verification_items_added)}`);
    }

    // Step 3 metrics
    if (cohort.avg_task_completion_rate != null || cohort.avg_blocker_count != null) {
      console.log(chalk.bold('  Step 3 (Implement):'));
      if (cohort.avg_task_completion_rate != null)
        console.log(`    avg_task_completion_rate: ${metricStatus('avg_task_completion_rate', cohort.avg_task_completion_rate)}`);
      if (cohort.avg_blocker_count != null)
        console.log(`    avg_blocker_count:        ${metricStatus('avg_blocker_count', cohort.avg_blocker_count)}`);
    }

    // Step 4 metrics
    if (cohort.avg_completion_rate_at_audit != null || cohort.archival_success_rate != null) {
      console.log(chalk.bold('  Step 4 (Finalize):'));
      if (cohort.avg_completion_rate_at_audit != null)
        console.log(`    avg_completion_at_audit:  ${chalk.white(cohort.avg_completion_rate_at_audit.toFixed(2))}`);
      if (cohort.avg_verification_failures_found != null)
        console.log(`    avg_verif_failures:       ${metricStatus('avg_verification_failures_found', cohort.avg_verification_failures_found)}`);
      if (cohort.archival_success_rate != null)
        console.log(`    archival_success_rate:    ${metricStatus('archival_success_rate', cohort.archival_success_rate)}`);
    }

    // User feedback
    if (cohort.feedback_count > 0) {
      console.log(chalk.bold('  User Feedback:'));
      console.log(`    avg_user_rating:          ${metricStatus('avg_user_rating', cohort.avg_user_rating)}`);
      console.log(`    feedback_count:           ${chalk.white(String(cohort.feedback_count))}`);
    }

    // Compare with previous generation
    if (i > 0) {
      const prev = aggregated.cohorts[i - 1];
      const deltas: string[] = [];
      if (cohort.avg_confidence != null && prev.avg_confidence != null) {
        const d = cohort.avg_confidence - prev.avg_confidence;
        deltas.push(`confidence ${d >= 0 ? chalk.green(`▲${d.toFixed(1)}`) : chalk.red(`▼${Math.abs(d).toFixed(1)}`)}`);
      }
      if (cohort.avg_task_completion_rate != null && prev.avg_task_completion_rate != null) {
        const d = cohort.avg_task_completion_rate - prev.avg_task_completion_rate;
        deltas.push(`completion ${d >= 0 ? chalk.green(`▲${(d * 100).toFixed(1)}%`) : chalk.red(`▼${(Math.abs(d) * 100).toFixed(1)}%`)}`);
      }
      if (deltas.length > 0) {
        console.log(chalk.gray(`  vs Gen ${i}: ${deltas.join('  ')}`));
      }
    }
  }

  // Run list
  const runs = loadRunFiles(runsDir);
  if (runs.length > 0) {
    console.log();
    console.log(chalk.bold(`Run files (${runs.length}):`));
    for (const run of runs.slice(-10)) {
      console.log(chalk.gray(`  ${run.run_id}  ${run.project.name}  v${run.plan2code_version}`));
    }
    if (runs.length > 10) {
      console.log(chalk.gray(`  ... and ${runs.length - 10} more`));
    }
  }
}

// ── Flow: Run analysis ────────────────────────────────────────────────────────

async function flowRunAnalysis(): Promise<string | null> {
  console.log();
  console.log(chalk.bold.cyan('── Run Analysis (Diagnose Weak Steps) ──'));

  const { aggregatedPath, proposalsDir } = getMetricsDirs();
  const plan2codeRoot = resolvedPlan2CodeRoot;

  const aggregated = loadAggregated(aggregatedPath);
  if (!aggregated || aggregated.total_runs === 0) {
    console.log(chalk.yellow('No aggregated metrics found. Collect and import runs first.'));
    return null;
  }

  if (aggregated.total_runs < 3) {
    const proceed = await confirm({
      message: `Only ${aggregated.total_runs} run(s) available (≥3 recommended for reliable analysis). Proceed anyway?`,
      default: false,
    });
    if (!proceed) return null;
  }

  const { agent, model } = await selectAgentAndModel();

  try {
    const diagPath = await runAnalysis({
      aggregatedPath,
      plan2codeRoot,
      proposalsDir,
      model,
      agent,
    });

    console.log();
    console.log(chalk.green('✓ Analysis complete'));
    console.log(chalk.gray(`Diagnosis: ${diagPath}`));

    const viewNow = await confirm({
      message: 'Open diagnosis in console?',
      default: true,
    });

    if (viewNow) {
      const content = fs.readFileSync(diagPath, 'utf8');
      console.log();
      console.log(chalk.dim('─'.repeat(60)));
      console.log(content);
      console.log(chalk.dim('─'.repeat(60)));
    }

    return diagPath;
  } catch (err) {
    console.error(chalk.red(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`));
    return null;
  }
}

// ── Flow: Generate improvement proposal ──────────────────────────────────────

async function flowGenerateProposal(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan('── Generate Improvement Proposal ──'));

  const { aggregatedPath, proposalsDir, runsDir } = getMetricsDirs();
  const plan2codeRoot = resolvedPlan2CodeRoot;

  // Find diagnosis files
  let diagFiles: string[] = [];
  if (fs.existsSync(proposalsDir)) {
    diagFiles = fs.readdirSync(proposalsDir)
      .filter(f => f.endsWith('-diagnosis.md'))
      .sort()
      .reverse(); // most recent first
  }

  let diagnosisPath: string;

  if (diagFiles.length === 0) {
    console.log(chalk.yellow('No diagnosis files found. Running analysis first...'));
    const diagPath = await flowRunAnalysis();
    if (!diagPath) return;
    diagnosisPath = diagPath;
  } else {
    const choice = await select({
      message: 'Select diagnosis to base proposal on:',
      choices: [
        ...diagFiles.map(f => ({ name: f, value: path.join(proposalsDir, f) })),
        { name: '(run new analysis first)', value: '__new__' },
      ],
    });

    if (choice === '__new__') {
      const diagPath = await flowRunAnalysis();
      if (!diagPath) return;
      diagnosisPath = diagPath;
    } else {
      diagnosisPath = choice;
    }
  }

  const { agent, model } = await selectAgentAndModel();

  try {
    const result = await generateImprovement({
      diagnosisPath,
      plan2codeRoot,
      proposalsDir,
      runsDir,
      model,
      agent,
    });

    console.log();
    console.log(chalk.green(`✓ Proposal generated: ${result.proposal.proposal_id}`));
    console.log(chalk.gray(`  Valid edits:   ${result.validEditCount}`));
    console.log(chalk.gray(`  Invalid edits: ${result.invalidEditCount} (rejected)`));
    console.log(chalk.gray(`  Saved to: ${result.proposalPath}`));

    if (result.validEditCount > 0) {
      const reviewNow = await confirm({
        message: 'Review and apply edits now?',
        default: true,
      });

      if (reviewNow) {
        await reviewAndApply({
          proposalPath: result.proposalPath,
          plan2codeRoot,
          proposalsDir,
        });
      }
    }
  } catch (err) {
    console.error(chalk.red(`Proposal generation failed: ${err instanceof Error ? err.message : String(err)}`));
  }
}

// ── Flow: Review and apply proposal ──────────────────────────────────────────

async function flowReviewAndApply(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan('── Review and Apply a Proposal ──'));

  const { proposalsDir } = getMetricsDirs();
  const plan2codeRoot = resolvedPlan2CodeRoot;

  if (!fs.existsSync(proposalsDir)) {
    console.log(chalk.yellow('No proposals directory found. Generate a proposal first.'));
    return;
  }

  const proposalFiles = fs.readdirSync(proposalsDir)
    .filter(f => /^prop-\d+\.json$/.test(f))
    .sort()
    .reverse(); // most recent first

  if (proposalFiles.length === 0) {
    console.log(chalk.yellow('No proposal files found. Generate a proposal first.'));
    return;
  }

  const chosen = await select({
    message: 'Select proposal to review:',
    choices: proposalFiles.map(f => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(proposalsDir, f), 'utf8'));
        const label = `${f}  [${p.status}]  ${p.proposals?.length ?? 0} edits`;
        return { name: label, value: path.join(proposalsDir, f) };
      } catch {
        return { name: f, value: path.join(proposalsDir, f) };
      }
    }),
  });

  await reviewAndApply({
    proposalPath: chosen,
    plan2codeRoot,
    proposalsDir,
  });
}

// ── Flow: Delete metrics data ─────────────────────────────────────────────────

async function flowDelete(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan('── Delete Metrics Data ──'));

  const { metricsDir, runsDir, aggregatedPath, proposalsDir } = getMetricsDirs();

  if (!fs.existsSync(metricsDir)) {
    console.log(chalk.yellow('No metrics data found (.plan2code-metrics/ does not exist).'));
    return;
  }

  const scope = await select({
    message: 'What do you want to delete?',
    choices: [
      { name: 'Delete specific run(s)', value: 'select' },
      { name: 'Delete all runs and aggregated data', value: 'runs' },
      { name: 'Delete everything (runs, aggregated data, proposals)', value: 'all' },
      { name: 'Cancel', value: 'cancel' },
    ],
  });

  if (scope === 'cancel') return;

  if (scope === 'select') {
    const runs = loadRunFiles(runsDir);
    if (runs.length === 0) {
      console.log(chalk.yellow('No run files found.'));
      return;
    }

    const choices = runs.map(r => ({
      name: `${r.run_id}  ${r.project.name}  v${r.plan2code_version}`,
      value: r.run_id,
    }));

    // Select runs one at a time since @inquirer/prompts select is single-choice
    const toDelete: string[] = [];
    let selecting = true;
    while (selecting) {
      const remaining = choices.filter(c => !toDelete.includes(c.value));
      if (remaining.length === 0) break;

      const chosen = await select({
        message: `Select a run to delete (${toDelete.length} selected so far):`,
        choices: [
          ...remaining,
          { name: toDelete.length > 0 ? `Done selecting (delete ${toDelete.length})` : 'Cancel', value: '__done__' },
        ],
      });

      if (chosen === '__done__') {
        selecting = false;
      } else {
        toDelete.push(chosen);
        console.log(chalk.gray(`  + ${chosen}`));
      }
    }

    if (toDelete.length === 0) return;

    const confirmed = await confirm({
      message: `Delete ${toDelete.length} run(s)? This cannot be undone.`,
      default: false,
    });
    if (!confirmed) return;

    let deleted = 0;
    for (const runId of toDelete) {
      const filePath = path.join(runsDir, `${runId}.json`);
      try {
        fs.unlinkSync(filePath);
        deleted++;
      } catch {
        console.log(chalk.yellow(`  Could not delete ${runId}.json`));
      }
    }

    console.log(chalk.green(`✓ Deleted ${deleted} run(s).`));

    // Re-aggregate with remaining runs
    const remainingRuns = loadRunFiles(runsDir);
    if (remainingRuns.length > 0) {
      aggregate(runsDir, aggregatedPath);
      console.log(chalk.gray(`  Aggregated metrics updated (${remainingRuns.length} runs remaining).`));
    } else {
      try { fs.unlinkSync(aggregatedPath); } catch { /* ignore */ }
      console.log(chalk.gray('  No runs remaining — aggregated data removed.'));
    }
    return;
  }

  // scope === 'runs' or 'all'
  const label = scope === 'all'
    ? 'ALL metrics data (runs, aggregated data, and proposals)'
    : 'all runs and aggregated data';

  const confirmed = await confirm({
    message: `Delete ${label}? This cannot be undone.`,
    default: false,
  });
  if (!confirmed) return;

  // Delete run files
  let runCount = 0;
  if (fs.existsSync(runsDir)) {
    const files = fs.readdirSync(runsDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try { fs.unlinkSync(path.join(runsDir, f)); runCount++; } catch { /* ignore */ }
    }
  }

  // Delete aggregated file
  try { fs.unlinkSync(aggregatedPath); } catch { /* ignore */ }

  console.log(chalk.green(`✓ Deleted ${runCount} run(s) and aggregated data.`));

  if (scope === 'all') {
    // Delete proposals
    let proposalCount = 0;
    if (fs.existsSync(proposalsDir)) {
      const files = fs.readdirSync(proposalsDir);
      for (const f of files) {
        try { fs.unlinkSync(path.join(proposalsDir, f)); proposalCount++; } catch { /* ignore */ }
      }
      try { fs.rmdirSync(proposalsDir); } catch { /* ignore */ }
    }
    console.log(chalk.green(`✓ Deleted ${proposalCount} proposal file(s).`));
  }
}

// ── Main menu ─────────────────────────────────────────────────────────────────

export async function runCLI(): Promise<void> {
  console.log();
  console.log(chalk.bold.white('plan2code-metrics'));
  console.log(chalk.gray('Recursive self-improvement toolchain for plan2code contributors'));
  console.log();

  // ── Prompt for paths ────────────────────────────────────────────────────────

  const userConfig = loadUserConfig();
  const savedRoot = userConfig.plan2codeRepoPath && fs.existsSync(userConfig.plan2codeRepoPath)
    ? userConfig.plan2codeRepoPath
    : null;
  const detectedRoot = savedRoot ?? detectPlan2CodeRoot();

  const s2cPath = await input({
    message: 'Path to plan2code repo:',
    default: detectedRoot ?? undefined,
    validate: (v) => {
      if (!v.trim()) return 'Path is required';
      const resolved = path.resolve(v.trim());
      if (!fs.existsSync(resolved)) return 'Directory not found';
      return true;
    },
  });
  resolvedPlan2CodeRoot = path.resolve(s2cPath.trim());

  // Persist the path for next run
  if (resolvedPlan2CodeRoot !== userConfig.plan2codeRepoPath) {
    saveUserConfig({ ...userConfig, plan2codeRepoPath: resolvedPlan2CodeRoot });
  }

  // Warn if the path doesn't look like a plan2code repo
  const hasSrcPrompts =
    fs.existsSync(path.join(resolvedPlan2CodeRoot, 'src', 'plan2code-1--plan.md')) &&
    fs.existsSync(path.join(resolvedPlan2CodeRoot, 'src', 'plan2code-2--document.md'));
  if (!hasSrcPrompts) {
    console.log(chalk.yellow('⚠ No src/plan2code-*.md prompts found at that path. Hashing and analysis may be limited.'));
  }

  const projPath = await input({
    message: 'Path to project repo (metrics source):',
    default: process.cwd(),
    validate: (v) => {
      if (!v.trim()) return 'Path is required';
      const resolved = path.resolve(v.trim());
      if (!fs.existsSync(resolved)) return 'Directory not found';
      return true;
    },
  });
  resolvedProjectRoot = path.resolve(projPath.trim());

  // Display resolved paths
  const version = detectPlan2CodeVersion(resolvedPlan2CodeRoot);
  console.log();
  console.log(chalk.gray(`plan2code repo: ${resolvedPlan2CodeRoot}  (v${version})`));
  console.log(chalk.gray(`project repo:     ${resolvedProjectRoot}`));
  console.log();

  let continueLoop = true;
  while (continueLoop) {
    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: 'Collect metrics for a completed project', value: 'collect' },
        { name: 'Import run data from another project', value: 'import' },
        { name: 'View metrics status and history', value: 'view' },
        { name: 'Run analysis (diagnose weak steps)', value: 'analyze' },
        { name: 'Generate improvement proposal', value: 'propose' },
        { name: 'Review and apply a proposal', value: 'apply' },
        { name: chalk.red('Delete metrics data'), value: 'delete' },
        { name: 'Exit', value: 'exit' },
      ],
    });

    switch (action) {
      case 'collect':
        await flowCollect();
        break;
      case 'import':
        await flowImport();
        break;
      case 'view':
        await flowViewStatus();
        break;
      case 'analyze':
        await flowRunAnalysis();
        break;
      case 'propose':
        await flowGenerateProposal();
        break;
      case 'apply':
        await flowReviewAndApply();
        break;
      case 'delete':
        await flowDelete();
        break;
      case 'exit':
        continueLoop = false;
        break;
    }

    if (continueLoop && action !== 'exit') {
      console.log();
    }
  }

  console.log(chalk.gray('Goodbye.'));
}
