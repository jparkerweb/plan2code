/**
 * aggregator.ts
 * Merges all run JSON files into aggregated.json, grouped by prompt generation (SHA fingerprint).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { RunMetrics, AggregatedMetrics, CohortMetrics, PromptVersions } from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function rate(values: (boolean | null | undefined)[]): number | null {
  const valid = values.filter((v): v is boolean => v != null);
  if (valid.length === 0) return null;
  return valid.filter(v => v).length / valid.length;
}

/**
 * Build a stable cohort key from the sorted prompt_versions object.
 * Two runs with identical prompt files get the same cohort key.
 */
export function buildCohortKey(promptVersions: PromptVersions): string {
  // Filter out missing sentinels so old runs (4 fields) keep their original key
  const entries = Object.entries(promptVersions)
    .filter(([, v]) => v !== 'sha256:missing')
    .sort(([a], [b]) => a.localeCompare(b));
  const str = JSON.stringify(Object.fromEntries(entries));
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 12);
}

/**
 * Backfill missing PromptVersions fields for old run files (pre-v1.1).
 */
export function backfillPromptVersions(pv: PromptVersions): PromptVersions {
  return {
    plan:        pv.plan        ?? 'sha256:missing',
    revise_plan: pv.revise_plan ?? 'sha256:missing',
    document:    pv.document    ?? 'sha256:missing',
    implement:   pv.implement   ?? 'sha256:missing',
    finalize:    pv.finalize    ?? 'sha256:missing',
    init:        pv.init        ?? 'sha256:missing',
    init_update: pv.init_update ?? 'sha256:missing',
    quick_task:  pv.quick_task  ?? 'sha256:missing',
  };
}

// ── Load run files ────────────────────────────────────────────────────────────

export function loadRunFiles(runsDir: string): RunMetrics[] {
  if (!fs.existsSync(runsDir)) return [];

  const files = fs.readdirSync(runsDir)
    .filter(f => f.endsWith('.json') && f.startsWith('run-'))
    .sort();

  const runs: RunMetrics[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(runsDir, file), 'utf8');
      const data = JSON.parse(content) as RunMetrics;
      data.prompt_versions = backfillPromptVersions(data.prompt_versions);
      runs.push(data);
    } catch (err) {
      console.warn(`Warning: could not parse ${file}: ${err}`);
    }
  }
  return runs;
}

// ── Build cohort metrics ──────────────────────────────────────────────────────

function buildCohort(runs: RunMetrics[], cohortKey: string): CohortMetrics {
  const runIds = runs.map(r => r.run_id);
  const timestamps = runs
    .flatMap(r => [r.project.started_at, r.project.completed_at])
    .filter((t): t is string => t != null)
    .sort();

  // Step 1 averages
  const avgConfidence = avg(runs.map(r => r.step1_plan.final_confidence));
  const avgClarification = avg(runs.map(r => r.step1_plan.clarification_rounds));
  const avgVerifGaps = avg(runs.map(r => r.step1_plan.verification_gaps_found));
  const avgFRCount = avg(runs.map(r => r.step1_plan.functional_requirements_count));
  const avgNFRCount = avg(runs.map(r => r.step1_plan.non_functional_requirements_count));
  const avgRiskCount = avg(runs.map(r => r.step1_plan.risk_count));
  const avgPhaseStep1 = avg(runs.map(r => r.step1_plan.phase_count));

  // Step 2 averages
  const avgTotalTasks = avg(runs.map(r => r.step2_document.total_tasks));
  const avgPhaseStep2 = avg(runs.map(r => r.step2_document.phase_count));
  const avgParallelGroups = avg(runs.map(r => r.step2_document.parallel_groups_identified));
  const avgReqCoverage = avg(runs.map(r => r.step2_document.requirement_coverage_percent));
  const avgVerifItems = avg(runs.map(r => r.step2_document.verification_items_added));

  // Step 3 averages
  const avgCompletionRate = avg(runs.map(r => r.step3_implement.task_completion_rate));
  const avgBlockerCount = avg(runs.map(r => r.step3_implement.blocker_count));

  // Step 4 averages
  const avgCompletionAtAudit = avg(runs.map(r => r.step4_finalize.completion_rate_at_audit));
  const avgVerifFailures = avg(runs.map(r => r.step4_finalize.verification_failures_found));
  const avgDocUpdates = avg(runs.map(r => r.step4_finalize.documentation_updates_needed));
  const archivalRate = rate(runs.map(r => r.step4_finalize.archival_succeeded));

  // User feedback
  const feedbackRuns = runs.filter(r => r.user_feedback != null);
  const avgUserRating = avg(feedbackRuns.map(r => r.user_feedback!.overall_rating));
  const feedbackCount = feedbackRuns.length;

  return {
    cohort_key: cohortKey,
    prompt_versions: runs[0].prompt_versions,
    run_count: runs.length,
    run_ids: runIds,
    first_seen: timestamps[0] ?? runs[0].run_id,
    last_seen: timestamps[timestamps.length - 1] ?? runs[runs.length - 1].run_id,

    avg_confidence: avgConfidence,
    avg_clarification_rounds: avgClarification,
    avg_verification_gaps_found: avgVerifGaps,
    avg_functional_requirements_count: avgFRCount,
    avg_non_functional_requirements_count: avgNFRCount,
    avg_risk_count: avgRiskCount,
    avg_phase_count_step1: avgPhaseStep1,

    avg_total_tasks: avgTotalTasks,
    avg_phase_count_step2: avgPhaseStep2,
    avg_parallel_groups: avgParallelGroups,
    avg_requirement_coverage_percent: avgReqCoverage,
    avg_verification_items_added: avgVerifItems,

    avg_task_completion_rate: avgCompletionRate,
    avg_blocker_count: avgBlockerCount,

    avg_completion_rate_at_audit: avgCompletionAtAudit,
    avg_verification_failures_found: avgVerifFailures,
    avg_documentation_updates_needed: avgDocUpdates,
    archival_success_rate: archivalRate,

    avg_user_rating: avgUserRating,
    feedback_count: feedbackCount,
  };
}

// ── Main aggregator ───────────────────────────────────────────────────────────

export function aggregate(runsDir: string, outputPath: string): AggregatedMetrics {
  const runs = loadRunFiles(runsDir);

  // Group by cohort key
  const cohortMap = new Map<string, RunMetrics[]>();
  for (const run of runs) {
    const key = buildCohortKey(run.prompt_versions);
    if (!cohortMap.has(key)) cohortMap.set(key, []);
    cohortMap.get(key)!.push(run);
  }

  // Sort cohorts by first seen
  const cohorts: CohortMetrics[] = [];
  for (const [key, cohortRuns] of cohortMap) {
    cohorts.push(buildCohort(cohortRuns, key));
  }
  cohorts.sort((a, b) => a.first_seen.localeCompare(b.first_seen));

  // Determine current cohort (most recent)
  const currentCohortKey = cohorts.length > 0
    ? cohorts[cohorts.length - 1].cohort_key
    : null;

  const aggregated: AggregatedMetrics = {
    schema_version: '1.0',
    last_updated: new Date().toISOString(),
    total_runs: runs.length,
    cohorts,
    current_cohort_key: currentCohortKey,
  };

  // Write to output path
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(aggregated, null, 2), 'utf8');

  return aggregated;
}

export function loadAggregated(outputPath: string): AggregatedMetrics | null {
  try {
    const content = fs.readFileSync(outputPath, 'utf8');
    return JSON.parse(content) as AggregatedMetrics;
  } catch {
    return null;
  }
}

/**
 * Import a single run JSON from another project into the local runs dir.
 * Returns true if imported, false if already present.
 */
export function importRun(runJsonPath: string, runsDir: string): boolean {
  const content = fs.readFileSync(runJsonPath, 'utf8');
  const run = JSON.parse(content) as RunMetrics;
  run.prompt_versions = backfillPromptVersions(run.prompt_versions);
  const destPath = path.join(runsDir, `${run.run_id}.json`);

  if (fs.existsSync(destPath)) {
    return false; // Already imported
  }

  fs.mkdirSync(runsDir, { recursive: true });
  fs.writeFileSync(destPath, JSON.stringify(run, null, 2), 'utf8');
  return true;
}
