/**
 * cli.ts
 * 100% interactive menu-driven CLI for plan2code-metrics.
 * No flags — all inputs collected via @inquirer/prompts.
 */

import fs from 'fs';
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

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_METRICS_DIR = '.plan2code-metrics';
const DEFAULT_RUNS_SUBDIR = 'runs';
const DEFAULT_AGGREGATED_FILE = 'aggregated.json';
const DEFAULT_PROPOSALS_SUBDIR = 'proposals';

function getMetricsDirs(baseDir = process.cwd()) {
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

  const agentDef = AGENTS[agentChoice];
  const model = await select({
    message: 'AI model:',
    choices: agentDef.models.map(m => ({ name: m.label, value: m.value })),
  });

  return { agent: agentChoice, model };
}

// ── Flow: Collect metrics ─────────────────────────────────────────────────────

async function flowCollect(): Promise<void> {
  console.log();
  console.log(chalk.bold.cyan('── Collect Metrics ──'));

  const sourceChoice = await select({
    message: 'Where is the completed project spec?',
    choices: [
      { name: 'Active spec directory (specs/<feature-name>/)', value: 'active' },
      { name: 'Archived spec (specs--completed/<feature-name>/)', value: 'archived' },
      { name: 'Custom path', value: 'custom' },
    ],
  });

  let specDir: string;
  let projectName: string;

  if (sourceChoice === 'active' || sourceChoice === 'archived') {
    const baseSubdir = sourceChoice === 'active' ? 'specs' : 'specs--completed';
    const baseDir = path.join(process.cwd(), baseSubdir);

    if (!fs.existsSync(baseDir)) {
      console.log(chalk.red(`No ${baseSubdir}/ directory found in ${process.cwd()}`));
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
  const plan2codeRoot = detectPlan2CodeRoot() ?? process.cwd();
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
    console.log(`  Step 3 (Implement):  ${metrics.step3_implement.present ? (metrics.step3_implement.used_loop_mode ? chalk.green('✓ (loop)') : chalk.yellow('✓ (manual)')) : chalk.gray('—')}`);
    console.log(`  Step 4 (Finalize):   ${metrics.step4_finalize.present ? chalk.green('✓') : chalk.gray('—')}`);
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

    // Step 3 metrics (loop only)
    if (cohort.loop_run_count > 0) {
      console.log(chalk.bold(`  Step 3 (Implement) — ${cohort.loop_run_count} loop run(s):`));
      if (cohort.avg_task_completion_rate != null)
        console.log(`    avg_task_completion_rate: ${metricStatus('avg_task_completion_rate', cohort.avg_task_completion_rate)}`);
      if (cohort.avg_blocker_count != null)
        console.log(`    avg_blocker_count:        ${metricStatus('avg_blocker_count', cohort.avg_blocker_count)}`);
      if (cohort.avg_completion_marker_success_rate != null)
        console.log(`    avg_marker_success_rate:  ${metricStatus('avg_completion_marker_success_rate', cohort.avg_completion_marker_success_rate)}`);
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
  const plan2codeRoot = detectPlan2CodeRoot() ?? process.cwd();

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
  const plan2codeRoot = detectPlan2CodeRoot() ?? process.cwd();

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
  const plan2codeRoot = detectPlan2CodeRoot() ?? process.cwd();

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

// ── Main menu ─────────────────────────────────────────────────────────────────

export async function runCLI(): Promise<void> {
  console.log();
  console.log(chalk.bold.white('plan2code-metrics'));
  console.log(chalk.gray('Recursive self-improvement toolchain for plan2code contributors'));
  console.log();

  // Check if we're in (or near) a plan2code repo
  const plan2codeRoot = detectPlan2CodeRoot();
  if (!plan2codeRoot) {
    console.log(chalk.yellow('⚠ Could not detect plan2code repository (src/plan2code-*.md not found nearby).'));
    console.log(chalk.gray('  Prompt version hashing and analysis will be limited.'));
    console.log();
  } else {
    const version = detectPlan2CodeVersion(plan2codeRoot);
    console.log(chalk.gray(`plan2code root: ${plan2codeRoot}  (v${version})`));
    console.log();
  }

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
