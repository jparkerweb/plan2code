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
  UserFeedback,
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

/**
 * Extract METRICS_JSON HTML comment blocks from a file.
 * Format: <!-- METRICS_JSON {"key": value, ...} -->
 * A file may contain multiple blocks (e.g., overview.md has document + finalize).
 * If `stepFilter` is provided, returns only the block with matching "step" field.
 * Returns parsed object or null if not found / invalid.
 */
function extractMetricsJson(content: string, stepFilter?: string): Record<string, unknown> | null {
  const re = /<!--\s*METRICS_JSON\s+(\{[\s\S]*?\})\s*-->/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      if (!stepFilter || parsed['step'] === stepFilter) {
        return parsed;
      }
    } catch {
      // try next match
    }
  }
  return null;
}

/** Strip the "## Success Criteria" section so its checkboxes aren't counted as tasks. */
function stripSuccessCriteriaSection(overview: string): string {
  return overview.replace(/^## Success Criteria\s*\n[\s\S]*?(?=\n## |\n*$)/m, '');
}

/**
 * Extract canonical task counts from the Completion Summary section.
 * Supports two formats found in real specs:
 *   - Bold text: "**Completion Rate:** 100% (5/5 tasks)"
 *   - Table row: "| Total Tasks | 28 (28/28 complete — 100%) |"
 * Returns null when no parseable counts are found.
 */
function parseCompletionSummaryTaskCount(overview: string): { completed: number; total: number } | null {
  const summaryMatch = overview.match(/## Completion Summary\s*\n([\s\S]*?)(?=\n## |\n*$)/);
  if (!summaryMatch) return null;
  const summary = summaryMatch[1];

  // "Completion Rate: X% (Y/Z tasks)" — handles bold markdown and various separators
  const rateMatch = summary.match(/\**Completion(?:\s+Rate)?\**[:\s*]+\d{1,3}%\s*\((\d+)\/(\d+)\s*tasks?\)/i);
  if (rateMatch) return { completed: parseInt(rateMatch[1], 10), total: parseInt(rateMatch[2], 10) };

  // "Total Tasks | 28 (28/28 complete"
  const tableMatch = summary.match(/Total Tasks\s*\|\s*(\d+)\s*\((\d+)\/(\d+)\s*complete/i);
  if (tableMatch) return { completed: parseInt(tableMatch[2], 10), total: parseInt(tableMatch[3], 10) };

  return null;
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
    plan:        sha256File(path.join(srcDir, 'plan2code-1-plan.md')),
    revise_plan: sha256File(path.join(srcDir, 'plan2code-1b-revise-plan.md')),
    document:    sha256File(path.join(srcDir, 'plan2code-2-document.md')),
    implement:   sha256File(path.join(srcDir, 'plan2code-3-implement.md')),
    finalize:    sha256File(path.join(srcDir, 'plan2code-4-finalize.md')),
    init:        sha256File(path.join(srcDir, 'plan2code-init.md')),
    init_update: sha256File(path.join(srcDir, 'plan2code-init-update.md')),
    quick_task:  sha256File(path.join(srcDir, 'plan2code-quick-task.md')),
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

  // ── Primary source: METRICS_JSON HTML comment ──
  // Format: <!-- METRICS_JSON {"confidence": 95, "clarification_rounds": 0, ...} -->
  const metricsJson = extractMetricsJson(latestDraft);
  if (metricsJson) {
    const num = (key: string): number | null => {
      const v = metricsJson[key];
      return typeof v === 'number' ? v : null;
    };
    const bd = metricsJson['confidence_breakdown'] as Record<string, number> | undefined;
    return {
      present: true,
      final_confidence: num('confidence'),
      confidence_breakdown: bd ? {
        requirements: bd.requirements ?? null,
        feasibility: bd.feasibility ?? null,
        integration: bd.integration ?? null,
        risk: bd.risk ?? null,
      } : null,
      clarification_rounds: num('clarification_rounds'),
      tech_stack_revision_rounds: num('tech_stack_revision_rounds'),
      verification_gaps_found: num('verification_gaps_found'),
      functional_requirements_count: num('functional_requirements_count'),
      non_functional_requirements_count: num('non_functional_requirements_count'),
      risk_count: num('risk_count'),
      phase_count: num('phase_count'),
    };
  }

  // ── Fallback: structured ## Planning Metrics appendix ──
  // Handles both plain (confidence: 95) and bold (**confidence:** 95) field formats
  // Planning Metrics is typically the last section, so we capture greedily to end,
  // but stop at the next ## heading or --- if present.
  const metricsSection = latestDraft.match(/^##\s+Planning\s+Metrics\s*\n([\s\S]+?)(?:\n##\s|\n---)/m)
    ?? latestDraft.match(/^##\s+Planning\s+Metrics\s*\n([\s\S]+)/m);
  const metricsBlock = metricsSection?.[1] ?? '';
  const parseMetricField = (field: string): number | null => {
    // Match plain "field: N" or bold "**field:** N"
    const m = metricsBlock.match(new RegExp(`^\\**${field}\\**[:\\s*]+?(\\d+)`, 'm'));
    return m ? parseInt(m[1], 10) : null;
  };

  // ── Confidence ──
  let finalConfidence = parseMetricField('confidence');
  if (finalConfidence === null) {
    // Fallback: prose scraping — handle bold markdown like **Confidence:** 95%
    const confMatch = latestDraft.match(/(?:Overall|Final|Total)?\s*\**[Cc]onfidence\**[:\s*]+(\d{1,3})%/);
    if (confMatch) {
      finalConfidence = parseInt(confMatch[1], 10);
    } else {
      const tableMatch = latestDraft.match(/[|]\s*[Cc]onfidence\s*[|]\s*(\d{1,3})/);
      if (tableMatch) finalConfidence = parseInt(tableMatch[1], 10);
    }
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

  // ── Clarification rounds ──
  let clarificationRounds = parseMetricField('clarification_rounds');

  // ── Verification gaps ──
  let verificationGaps = parseMetricField('verification_gaps_found');

  // ── Functional / non-functional requirements ──
  let frCount = parseMetricField('functional_requirements_count');
  if (frCount === null) {
    frCount = (latestDraft.match(/###\s+FR-/g) ?? []).length || null;
  }
  let nfrCount = parseMetricField('non_functional_requirements_count');
  if (nfrCount === null) {
    nfrCount = (latestDraft.match(/###\s+NFR-/g) ?? []).length || null;
  }

  // ── Risk count ──
  let riskCount = parseMetricField('risk_count');
  if (riskCount === null) {
    const riskRows = latestDraft.match(/^\s*[|][^|]*(?:High|Medium|Low|Critical)[^|]*[|]/gm) ?? [];
    riskCount = riskRows.length || null;
  }

  // ── Phase count ──
  let phaseCount = parseMetricField('phase_count');
  if (phaseCount === null) {
    phaseCount = (latestDraft.match(/^##\s+Phase\s+\d/gm) ?? []).length || null;
  }

  // ── Tech stack revision rounds (conversation file only) ──
  let techStackRevisions: number | null = null;

  // Fall back to conversation file scraping for fields not found in appendix
  if (convFiles.length > 0) {
    convFiles.sort();
    const latestConv = readFileSafe(convFiles[convFiles.length - 1]) ?? '';
    if (clarificationRounds === null) {
      const clarRounds = (latestConv.match(/^##\s+(?:Clarification|Round)\s+\d/gm) ?? []).length;
      clarificationRounds = clarRounds || null;
    }
    const techRounds = (latestConv.match(/^##\s+(?:Tech\s+Stack|Technology)\s+Revision/gmi) ?? []).length;
    techStackRevisions = techRounds || null;
    if (verificationGaps === null) {
      const gapMatches = latestConv.match(/(?:verification\s+gap|gap\s+found|missing\s+requirement)/gi) ?? [];
      verificationGaps = gapMatches.length || null;
    }
  }

  return {
    present: true,
    final_confidence: finalConfidence,
    confidence_breakdown: confidenceBreakdown,
    clarification_rounds: clarificationRounds,
    tech_stack_revision_rounds: techStackRevisions,
    verification_gaps_found: verificationGaps,
    functional_requirements_count: frCount,
    non_functional_requirements_count: nfrCount,
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

  // ── Primary source: METRICS_JSON in overview.md ──
  const step2Json = extractMetricsJson(overview, 'document');
  if (step2Json) {
    const num = (key: string): number | null => {
      const v = step2Json[key];
      return typeof v === 'number' ? v : null;
    };
    const tpp = step2Json['tasks_per_phase'];
    return {
      present: true,
      total_tasks: num('total_tasks'),
      tasks_per_phase: Array.isArray(tpp) ? tpp : null,
      phase_count: num('phase_count'),
      parallel_groups_identified: num('parallel_groups_identified') ?? 0,
      requirement_coverage_percent: num('requirement_coverage_percent'),
      verification_items_added: num('verification_items_added'),
    };
  }

  // ── Fallback: regex scraping ──

  // Detect Parallel Execution Groups table
  const parallelGroups = (overview.match(/Parallel\s+Execution\s+Group/gi) ?? []).length;

  // Count phase files (scanned first so we can use sum as a total_tasks fallback)
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
      const count = (content.match(/^\s*-\s+\[[ x!/?]\]\s+\*\*Task\s+\d/gm) ?? []).length;
      tasksPerPhase.push(count);
    }
  } catch {
    // leave empty
  }

  // total_tasks priority:
  //   1. Completion Summary canonical count
  //   2. Sum of phase file task counts
  //   3. Stripped overview checkboxes (excluding Success Criteria)
  const summaryCount = parseCompletionSummaryTaskCount(overview);
  const phaseSum = tasksPerPhase.length > 0 ? tasksPerPhase.reduce((a, b) => a + b, 0) : 0;
  const strippedOverview = stripSuccessCriteriaSection(overview);
  const strippedCheckboxCount = (strippedOverview.match(/^\s*-\s+\[[ x!/?]\]/gm) ?? []).length;

  let totalTasks: number;
  if (summaryCount) {
    totalTasks = summaryCount.total;
  } else if (phaseSum > 0) {
    totalTasks = phaseSum;
  } else {
    totalTasks = strippedCheckboxCount;
  }

  // Requirement coverage: look for coverage percentage in overview
  let reqCoverage: number | null = null;
  const covMatch = overview.match(/[Cc]overage[:\s]+(\d{1,3})%/);
  if (covMatch) reqCoverage = parseInt(covMatch[1], 10);

  // Verification items added (look for verification checklist items)
  const verifItems = (overview.match(/(?:verify|verification|test|check):\s*\[[ x]\]/gi) ?? []).length;

  return {
    present: true,
    total_tasks: totalTasks || null,
    tasks_per_phase: tasksPerPhase.length > 0 ? tasksPerPhase : null,
    phase_count: phaseCount || null,
    parallel_groups_identified: parallelGroups || 0,
    requirement_coverage_percent: reqCoverage,
    verification_items_added: verifItems || null,
  };
}

// ── Step 3: Implement ──────────────────────────────────────────────────────────

export function collectStep3(specDir: string): Step3ImplementMetrics {
  // Discover phase-*.md files
  let phaseFiles: string[] = [];
  try {
    const files = fs.readdirSync(specDir);
    phaseFiles = files
      .filter(f => /^phase-\d+\.md$/i.test(f))
      .sort();
  } catch {
    // leave empty
  }

  // Read overview.md for Completion Summary
  const overviewPath = path.join(specDir, 'overview.md');
  const overview = readFileSafe(overviewPath);
  const summaryCount = overview ? parseCompletionSummaryTaskCount(overview) : null;

  // ── Primary source: METRICS_JSON in overview.md (from finalize step) ──
  if (overview) {
    const step3Json = extractMetricsJson(overview, 'finalize');
    if (step3Json) {
      const num = (key: string): number | null => {
        const v = step3Json[key];
        return typeof v === 'number' ? v : null;
      };
      const total = num('tasks_total');
      const completed = num('tasks_completed');
      return {
        present: true,
        task_completion_rate: total && total > 0 && completed != null ? completed / total : null,
        tasks_completed: completed,
        tasks_total: total,
        blocker_count: num('blocker_count') ?? 0,
      };
    }
  }

  // ── Fallback: regex scraping ──

  // present = true if phase files exist OR overview has completion data
  const present = phaseFiles.length > 0 || summaryCount != null;
  if (!present) {
    return { present: false, task_completion_rate: null, tasks_completed: null,
      tasks_total: null, blocker_count: null };
  }

  // Count checkboxes in phase files
  let phaseTotal = 0;
  let phaseCompleted = 0;
  let blockerCount = 0;
  for (const pf of phaseFiles) {
    const content = readFileSafe(path.join(specDir, pf)) ?? '';
    phaseTotal += (content.match(/^\s*-\s+\[[ x!/?]\]\s+\*\*Task\s+\d/gm) ?? []).length;
    phaseCompleted += (content.match(/^\s*-\s+\[x\]\s+\*\*Task\s+\d/gm) ?? []).length;
    blockerCount += (content.match(/^\s*-\s+\[!\]\s+\*\*Task\s+\d/gm) ?? []).length;
  }

  // Count checkboxes in overview (stripped of Success Criteria)
  let overviewTotal = 0;
  let overviewCompleted = 0;
  if (overview) {
    const stripped = stripSuccessCriteriaSection(overview);
    overviewTotal = (stripped.match(/^\s*-\s+\[[ x!/?]\]/gm) ?? []).length;
    overviewCompleted = (stripped.match(/^\s*-\s+\[x\]/gm) ?? []).length;
  }

  // Task counts priority:
  //   1. Completion Summary in overview.md
  //   2. Checkbox counting in phase files
  //   3. Checkbox counting in overview.md (stripped of Success Criteria)
  let tasksTotal: number | null = null;
  let tasksCompleted: number | null = null;
  if (summaryCount) {
    tasksTotal = summaryCount.total;
    tasksCompleted = summaryCount.completed;
  } else if (phaseTotal > 0) {
    tasksTotal = phaseTotal;
    tasksCompleted = phaseCompleted;
  } else if (overviewTotal > 0) {
    tasksTotal = overviewTotal;
    tasksCompleted = overviewCompleted;
  }

  const taskCompletionRate = tasksTotal && tasksTotal > 0 && tasksCompleted != null
    ? tasksCompleted / tasksTotal
    : null;

  return {
    present: true,
    task_completion_rate: taskCompletionRate,
    tasks_completed: tasksCompleted,
    tasks_total: tasksTotal,
    blocker_count: blockerCount,
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

  // ── Primary source: METRICS_JSON in overview.md ──
  const step4Json = extractMetricsJson(overview, 'finalize');
  if (step4Json) {
    const num = (key: string): number | null => {
      const v = step4Json[key];
      return typeof v === 'number' ? v : null;
    };
    return {
      present: true,
      completion_rate_at_audit: num('completion_rate_at_audit'),
      verification_failures_found: num('verification_failures_found') ?? 0,
      documentation_updates_needed: num('documentation_updates_needed'),
      archival_succeeded: archivalSucceeded,
    };
  }

  // ── Fallback: regex scraping ──

  // Completion rate: prefer Completion Summary, fall back to stripped overview checkboxes
  let completionRate: number | null = null;
  const summaryCount = parseCompletionSummaryTaskCount(overview);
  if (summaryCount) {
    completionRate = summaryCount.total > 0 ? summaryCount.completed / summaryCount.total : null;
  } else {
    const stripped = stripSuccessCriteriaSection(overview);
    const totalTasks = (stripped.match(/^\s*-\s+\[[ x!/?]\]/gm) ?? []).length;
    const completedTasks = (stripped.match(/^\s*-\s+\[x\]/gm) ?? []).length;
    completionRate = totalTasks > 0 ? completedTasks / totalTasks : null;
  }

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

// ── User Feedback ─────────────────────────────────────────────────────────

export function collectUserFeedback(specDir: string): UserFeedback | null {
  // Try both active and archived locations for overview.md
  const overviewPath = path.join(specDir, 'overview.md');
  const specDirName = path.basename(specDir);
  const parentDir = path.dirname(specDir);
  const completedPath = path.join(parentDir, '..', 'specs--completed', specDirName, 'overview.md');

  const overview = readFileSafe(overviewPath) ?? readFileSafe(completedPath);
  if (!overview) return null;

  // Look for ## User Feedback section with a markdown table
  const feedbackMatch = overview.match(
    /## User Feedback\s*\n\s*\|[^\n]*\|\s*\n\s*\|[-| ]+\|\s*\n([\s\S]*?)(?=\n##\s|\n*$)/
  );
  if (!feedbackMatch) return null;

  const tableBody = feedbackMatch[1];

  // Parse table rows: | Field | Value |
  // Use regex to split only on unescaped pipes, preserving whitespace in values
  const rows = tableBody.split('\n').filter(l => l.trim().startsWith('|'));
  const fields: Record<string, string> = {};
  for (const row of rows) {
    // Split on unescaped pipes (not preceded by backslash)
    const cells = row.split(/(?<!\\)\|/).map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length >= 2) {
      const value = cells.slice(1).join('|').replace(/\\\|/g, '|');
      fields[cells[0].toLowerCase()] = value;
    }
  }

  const rating = parseInt(fields['rating'] ?? '', 10);
  if (isNaN(rating) || rating < 1 || rating > 10) return null;

  return {
    overall_rating: rating,
    rating_reason: fields['reason'] ?? '',
    what_went_well: fields['went well'] ?? '',
    what_went_poorly: fields['went poorly'] ?? '',
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
    user_feedback: collectUserFeedback(specDir),
  };

  // Write to output dir
  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2), 'utf8');

  return metrics;
}
