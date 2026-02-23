/**
 * collector.ts
 * Reads finished project artifacts and writes a RunMetrics JSON file.
 * Zero dependency on plan2code-loop internals — reads files directly.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  RunMetrics,
  PromptVersions,
  Step1PlanMetrics,
  Step2DocumentMetrics,
  Step3ImplementMetrics,
  Step4FinalizeMetrics,
} from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256File(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return 'sha256:missing';
  }
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function generateRunId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(2).toString('hex');
  return `run-${ts.slice(0, 8)}-${ts.slice(8, 14)}-${rand}`;
}

// ── Prompt version hashing ────────────────────────────────────────────────────

export function collectPromptVersions(plan2codeRoot: string): PromptVersions {
  const srcDir = path.join(plan2codeRoot, 'src');
  return {
    plan:        sha256File(path.join(srcDir, 'plan2code-1--plan.md')),
    revise_plan: sha256File(path.join(srcDir, 'plan2code-1b--revise-plan.md')),
    document:    sha256File(path.join(srcDir, 'plan2code-2--document.md')),
    implement:   sha256File(path.join(srcDir, 'plan2code-3--implement.md')),
    finalize:    sha256File(path.join(srcDir, 'plan2code-4--finalize.md')),
    init:        sha256File(path.join(srcDir, 'plan2code---init.md')),
    init_update: sha256File(path.join(srcDir, 'plan2code---init-update.md')),
    quick_task:  sha256File(path.join(srcDir, 'plan2code---quick-task.md')),
  };
}

// ── Step 1: Plan ──────────────────────────────────────────────────────────────

export function collectStep1(specDir: string): Step1PlanMetrics {
  // Find PLAN-DRAFT-*.md files
  let draftFiles: string[] = [];
  let convFiles: string[] = [];
  try {
    const files = fs.readdirSync(specDir);
    draftFiles = files
      .filter(f => f.startsWith('PLAN-DRAFT-') && f.endsWith('.md'))
      .map(f => path.join(specDir, f));
    convFiles = files
      .filter(f => f.startsWith('PLAN-CONVERSATION-') && f.endsWith('.md'))
      .map(f => path.join(specDir, f));
  } catch {
    return { present: false, final_confidence: null, confidence_breakdown: null,
      clarification_rounds: null, tech_stack_revision_rounds: null,
      verification_gaps_found: null, functional_requirements_count: null,
      non_functional_requirements_count: null, risk_count: null, phase_count: null };
  }

  if (draftFiles.length === 0) {
    return { present: false, final_confidence: null, confidence_breakdown: null,
      clarification_rounds: null, tech_stack_revision_rounds: null,
      verification_gaps_found: null, functional_requirements_count: null,
      non_functional_requirements_count: null, risk_count: null, phase_count: null };
  }

  // Use the latest draft file
  draftFiles.sort();
  const latestDraft = readFileSafe(draftFiles[draftFiles.length - 1]) ?? '';

  // Parse "Confidence: XX%" — look for overall or total confidence
  let finalConfidence: number | null = null;
  const confMatch = latestDraft.match(/(?:Overall|Final|Total)?\s*[Cc]onfidence[:\s]+(\d{1,3})%/);
  if (confMatch) {
    finalConfidence = parseInt(confMatch[1], 10);
  } else {
    // Try table format: | Confidence | 92 |
    const tableMatch = latestDraft.match(/[|]\s*[Cc]onfidence\s*[|]\s*(\d{1,3})/);
    if (tableMatch) finalConfidence = parseInt(tableMatch[1], 10);
  }

  // Confidence breakdown (requirements, feasibility, integration, risk)
  let confidenceBreakdown: Step1PlanMetrics['confidence_breakdown'] = null;
  const reqMatch = latestDraft.match(/[Rr]equirements?[:\s|]+(\d{1,2})/);
  const feasMatch = latestDraft.match(/[Ff]easibility[:\s|]+(\d{1,2})/);
  const intMatch = latestDraft.match(/[Ii]ntegration[:\s|]+(\d{1,2})/);
  const riskMatch = latestDraft.match(/[Rr]isk[:\s|]+(\d{1,2})/);
  if (reqMatch || feasMatch || intMatch || riskMatch) {
    confidenceBreakdown = {
      requirements: reqMatch ? parseInt(reqMatch[1], 10) : null,
      feasibility:  feasMatch ? parseInt(feasMatch[1], 10) : null,
      integration:  intMatch ? parseInt(intMatch[1], 10) : null,
      risk:         riskMatch ? parseInt(riskMatch[1], 10) : null,
    };
  }

  // Count ### FR- / ### NFR- headings
  const frCount = (latestDraft.match(/###\s+FR-/g) ?? []).length;
  const nfrCount = (latestDraft.match(/###\s+NFR-/g) ?? []).length;

  // Count risk table rows (lines starting with | that contain risk-level keywords)
  const riskRows = latestDraft.match(/^\s*[|][^|]*(?:High|Medium|Low|Critical)[^|]*[|]/gm) ?? [];
  const riskCount = riskRows.length || null;

  // Count ## Phase headings
  const phaseCount = (latestDraft.match(/^##\s+Phase\s+\d/gm) ?? []).length || null;

  // Clarification rounds from conversation file
  let clarificationRounds: number | null = null;
  let techStackRevisions: number | null = null;
  let verificationGaps: number | null = null;

  if (convFiles.length > 0) {
    convFiles.sort();
    const latestConv = readFileSafe(convFiles[convFiles.length - 1]) ?? '';
    // Count heading repetitions as clarification rounds (## Clarification or ## Round)
    const clarRounds = (latestConv.match(/^##\s+(?:Clarification|Round)\s+\d/gm) ?? []).length;
    clarificationRounds = clarRounds || null;
    // Tech stack revision rounds
    const techRounds = (latestConv.match(/^##\s+(?:Tech\s+Stack|Technology)\s+Revision/gmi) ?? []).length;
    techStackRevisions = techRounds || null;
    // Verification gaps found
    const gapMatches = latestConv.match(/(?:verification\s+gap|gap\s+found|missing\s+requirement)/gi) ?? [];
    verificationGaps = gapMatches.length || null;
  }

  return {
    present: true,
    final_confidence: finalConfidence,
    confidence_breakdown: confidenceBreakdown,
    clarification_rounds: clarificationRounds,
    tech_stack_revision_rounds: techStackRevisions,
    verification_gaps_found: verificationGaps,
    functional_requirements_count: frCount || null,
    non_functional_requirements_count: nfrCount || null,
    risk_count: riskCount,
    phase_count: phaseCount,
  };
}

// ── Step 2: Document ──────────────────────────────────────────────────────────

export function collectStep2(specDir: string): Step2DocumentMetrics {
  const overviewPath = path.join(specDir, 'overview.md');
  const overview = readFileSafe(overviewPath);

  if (!overview) {
    return { present: false, total_tasks: null, tasks_per_phase: null,
      phase_count: null, parallel_groups_identified: null,
      requirement_coverage_percent: null, verification_items_added: null };
  }

  // Count all checkbox tasks: - [ ], - [x], - [!], - [/]
  const allTasks = (overview.match(/^\s*-\s+\[[ x!/?]\]/gm) ?? []).length;

  // Detect Parallel Execution Groups table
  const parallelGroups = (overview.match(/Parallel\s+Execution\s+Group/gi) ?? []).length;

  // Count phase files
  let phaseCount = 0;
  let tasksPerPhase: number[] = [];
  try {
    const files = fs.readdirSync(specDir);
    const phaseFiles = files
      .filter(f => /^phase-\d+\.md$/i.test(f))
      .sort();
    phaseCount = phaseFiles.length;
    for (const pf of phaseFiles) {
      const content = readFileSafe(path.join(specDir, pf)) ?? '';
      const count = (content.match(/^\s*-\s+\[[ x!/?]\]/gm) ?? []).length;
      tasksPerPhase.push(count);
    }
  } catch {
    // leave empty
  }

  // Requirement coverage: look for coverage percentage in overview
  let reqCoverage: number | null = null;
  const covMatch = overview.match(/[Cc]overage[:\s]+(\d{1,3})%/);
  if (covMatch) reqCoverage = parseInt(covMatch[1], 10);

  // Verification items added (look for verification checklist items)
  const verifItems = (overview.match(/(?:verify|verification|test|check):\s*\[[ x]\]/gi) ?? []).length;

  return {
    present: true,
    total_tasks: allTasks || null,
    tasks_per_phase: tasksPerPhase.length > 0 ? tasksPerPhase : null,
    phase_count: phaseCount || null,
    parallel_groups_identified: parallelGroups || 0,
    requirement_coverage_percent: reqCoverage,
    verification_items_added: verifItems || null,
  };
}

// ── Step 3: Implement (loop data) ─────────────────────────────────────────────

export function collectStep3(specDir: string): Step3ImplementMetrics {
  const loopDir = path.join(specDir, '.plan2code-loop');
  const iterLogPath = path.join(loopDir, 'iteration.log');
  const configPath = path.join(loopDir, 'config.json');

  if (!fs.existsSync(loopDir)) {
    return { present: true, used_loop_mode: false, loop_mode: null,
      task_completion_rate: null, tasks_completed: null, tasks_total: null,
      blocker_count: null, blocker_categories: null, total_iterations: null,
      avg_iteration_duration_ms: null, exit_code_distribution: null,
      completion_marker_success_rate: null };
  }

  // Parse config.json for loop mode
  let loopMode: 'task' | 'phase' | null = null;
  const configContent = readFileSafe(configPath);
  if (configContent) {
    try {
      const config = JSON.parse(configContent);
      loopMode = config.loopMode ?? null;
    } catch {
      // ignore
    }
  }

  // Parse NDJSON iteration.log
  const iterLogContent = readFileSafe(iterLogPath);
  if (!iterLogContent) {
    return { present: true, used_loop_mode: true, loop_mode: loopMode,
      task_completion_rate: null, tasks_completed: null, tasks_total: null,
      blocker_count: null, blocker_categories: null, total_iterations: null,
      avg_iteration_duration_ms: null, exit_code_distribution: null,
      completion_marker_success_rate: null };
  }

  interface IterEntry {
    iteration: number;
    timestamp: string;
    duration: number;
    exitCode: number;
    status: string;
    completionMarker?: string;
  }

  const entries: IterEntry[] = [];
  for (const line of iterLogContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // skip malformed lines
    }
  }

  const totalIterations = entries.length;
  if (totalIterations === 0) {
    return { present: true, used_loop_mode: true, loop_mode: loopMode,
      task_completion_rate: null, tasks_completed: null, tasks_total: null,
      blocker_count: null, blocker_categories: null, total_iterations: 0,
      avg_iteration_duration_ms: null, exit_code_distribution: null,
      completion_marker_success_rate: null };
  }

  // Exit code distribution
  const exitCodes: Record<string, number> = {};
  for (const e of entries) {
    const key = String(e.exitCode ?? 'other');
    exitCodes[key] = (exitCodes[key] ?? 0) + 1;
  }

  // Average duration
  const durations = entries.map(e => e.duration).filter(d => d != null && d > 0);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  // Completion markers
  const markerEntries = entries.filter(e => e.completionMarker && e.completionMarker.trim() !== '');
  const taskCompleteEntries = markerEntries.filter(e =>
    e.completionMarker?.startsWith('TASK_COMPLETE')
  );
  const blockedEntries = markerEntries.filter(e =>
    e.completionMarker?.startsWith('TASK_BLOCKED')
  );

  // Completion marker success rate: entries where a valid marker was detected vs total
  const validMarkerCount = markerEntries.length;
  const markerSuccessRate = totalIterations > 0
    ? validMarkerCount / totalIterations
    : null;

  // Task counts from markers (used for completion_marker_success_rate)
  const blockerCount = blockedEntries.length;

  // Blocker categories (parse from "TASK_BLOCKED: X.Y - reason")
  const blockerCategories: string[] = [];
  for (const e of blockedEntries) {
    const match = e.completionMarker?.match(/TASK_BLOCKED:\s*[\d.]+\s*-\s*(.+)/);
    if (match) {
      // Normalize to snake_case category
      const reason = match[1].toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (!blockerCategories.includes(reason)) {
        blockerCategories.push(reason);
      }
    }
  }

  // Count tasks from overview.md checkboxes (consistent numerator and denominator)
  const overviewPath = path.join(specDir, 'overview.md');
  const overview = readFileSafe(overviewPath);
  let tasksTotal: number | null = null;
  let tasksCompleted: number | null = null;
  if (overview) {
    tasksTotal = (overview.match(/^\s*-\s+\[[ x!/?]\]/gm) ?? []).length || null;
    tasksCompleted = (overview.match(/^\s*-\s+\[x\]/gm) ?? []).length || null;
  }

  const taskCompletionRate = tasksTotal && tasksTotal > 0 && tasksCompleted != null
    ? tasksCompleted / tasksTotal
    : null;

  return {
    present: true,
    used_loop_mode: true,
    loop_mode: loopMode,
    task_completion_rate: taskCompletionRate,
    tasks_completed: tasksCompleted || null,
    tasks_total: tasksTotal,
    blocker_count: blockerCount,
    blocker_categories: blockerCategories.length > 0 ? blockerCategories : null,
    total_iterations: totalIterations,
    avg_iteration_duration_ms: avgDuration,
    exit_code_distribution: exitCodes,
    completion_marker_success_rate: markerSuccessRate,
  };
}

// ── Step 4: Finalize ──────────────────────────────────────────────────────────

export function collectStep4(specDir: string): Step4FinalizeMetrics {
  // Check if spec was archived (specs--completed exists at parent level)
  const specDirName = path.basename(specDir);
  const parentDir = path.dirname(specDir);
  const completedPath = path.join(parentDir, '..', 'specs--completed', specDirName);
  const archivalSucceeded = fs.existsSync(completedPath);

  // Read overview for completion metrics
  const overviewPath = path.join(specDir, 'overview.md');

  // If archived, try from archived location
  const effectiveOverviewPath = archivalSucceeded
    ? path.join(completedPath, 'overview.md')
    : overviewPath;

  const overview = readFileSafe(effectiveOverviewPath) ?? readFileSafe(overviewPath);
  if (!overview) {
    return { present: false, completion_rate_at_audit: null,
      verification_failures_found: null, documentation_updates_needed: null,
      archival_succeeded: archivalSucceeded };
  }

  // Completion rate: completed tasks / total tasks
  const totalTasks = (overview.match(/^\s*-\s+\[[ x!/?]\]/gm) ?? []).length;
  const completedTasks = (overview.match(/^\s*-\s+\[x\]/gm) ?? []).length;
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : null;

  // Verification failures: look for [!] tasks or "verification failed" text
  const blockedTasks = (overview.match(/^\s*-\s+\[!\]/gm) ?? []).length;

  // Documentation updates needed (look for TODO or "update" markers)
  const docUpdates = (overview.match(/(?:TODO|FIXME|update\s+(?:README|CHANGELOG|docs))/gi) ?? []).length;

  return {
    present: true,
    completion_rate_at_audit: completionRate,
    verification_failures_found: blockedTasks || 0,
    documentation_updates_needed: docUpdates || null,
    archival_succeeded: archivalSucceeded,
  };
}

// ── Main collector ────────────────────────────────────────────────────────────

export interface CollectorOptions {
  specDir: string;           // Path to the spec directory (specs/<feature-name>)
  projectName: string;       // Human-readable project name
  plan2codeRoot: string;     // Path to the plan2code repo (for prompt hashing)
  plan2codeVersion: string;  // e.g. "1.7.0"
  outputDir: string;         // Where to write <run-id>.json
}

export async function collectRun(opts: CollectorOptions): Promise<RunMetrics> {
  const {
    specDir,
    projectName,
    plan2codeRoot,
    plan2codeVersion,
    outputDir,
  } = opts;

  const runId = generateRunId();

  // Get started_at / completed_at from spec directory mtime / iteration.log
  let startedAt: string | null = null;
  let completedAt: string | null = null;
  try {
    const stat = fs.statSync(specDir);
    startedAt = stat.birthtime.toISOString();
    completedAt = stat.mtime.toISOString();
  } catch {
    // leave null
  }

  // Try to get started_at from earliest iteration log entry
  const loopDir = path.join(specDir, '.plan2code-loop');
  const iterLogPath = path.join(loopDir, 'iteration.log');
  const iterLogContent = readFileSafe(iterLogPath);
  if (iterLogContent) {
    const lines = iterLogContent.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      try {
        const first = JSON.parse(lines[0]);
        if (first.timestamp) startedAt = first.timestamp;
      } catch { /* ignore */ }
      try {
        const last = JSON.parse(lines[lines.length - 1]);
        if (last.timestamp) completedAt = last.timestamp;
      } catch { /* ignore */ }
    }
  }

  const metrics: RunMetrics = {
    schema_version: '1.0',
    run_id: runId,
    plan2code_version: plan2codeVersion,
    prompt_versions: collectPromptVersions(plan2codeRoot),
    project: {
      name: projectName,
      started_at: startedAt,
      completed_at: completedAt,
    },
    step1_plan: collectStep1(specDir),
    step2_document: collectStep2(specDir),
    step3_implement: collectStep3(specDir),
    step4_finalize: collectStep4(specDir),
  };

  // Write to output dir
  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2), 'utf8');

  return metrics;
}
