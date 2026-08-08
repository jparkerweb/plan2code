/**
 * community.ts
 * Ingestion side of the community feedback flow: list/parse/close
 * `community-feedback`-labeled GitHub issues on jparkerweb/plan2code.
 */

import { execa } from 'execa';
import type {
  RunMetrics,
  PromptVersions,
  UserFeedback,
  Step1PlanMetrics,
  Step2DocumentMetrics,
  Step3ImplementMetrics,
  Step4FinalizeMetrics,
} from './types.js';
import { extractMetricsJson } from './collector.js';
import { backfillPromptVersions } from './aggregator.js';

// ── GitHub interaction (via gh CLI) ──────────────────────────────────────────

export interface CommunityIssue {
  number: number;
  body: string;
}

interface RawIssue {
  number: number;
  title: string;
  body: string;
  labels: { name: string }[];
}

const COMMUNITY_LABEL = 'community-feedback';
const FEEDBACK_TITLE_PREFIX = '[Feedback]';
const METRICS_JSON_MARKER = /<!--\s*METRICS_JSON\s+\{/;

export async function listCommunityIssues(repo: string): Promise<CommunityIssue[]> {
  // Fetch open issues broadly rather than by label alone. Browser/print-tier
  // submissions from outside contributors can lose the `community-feedback`
  // label: GitHub only honors the `labels=` query param on issues/new for
  // users with triage/push access, so the label is silently dropped for
  // community members without `gh`. We therefore also match by the `[Feedback]`
  // title prefix and the METRICS_JSON marker. Only OPEN issues are considered
  // (closed/done submissions are already processed); parseSubmissionPayload is
  // the final gate that rejects anything without a valid payload.
  const result = await execa('gh', [
    'issue', 'list',
    '--repo', repo,
    '--state', 'open',
    '--limit', '1000',
    '--json', 'number,title,body,labels',
  ]);
  const raw = JSON.parse(result.stdout) as RawIssue[];
  return raw
    .filter((issue) =>
      issue.labels.some((l) => l.name === COMMUNITY_LABEL) ||
      issue.title.startsWith(FEEDBACK_TITLE_PREFIX) ||
      METRICS_JSON_MARKER.test(issue.body)
    )
    .map((issue) => ({ number: issue.number, body: issue.body }));
}

export async function closeIssue(repo: string, issueNumber: number): Promise<void> {
  await execa('gh', ['issue', 'close', String(issueNumber), '--repo', repo]);
}

// ── Ingestion control flow (I/O injected so it is unit-testable) ──────────────

export interface IngestionDeps {
  writeRunFile: (run: RunMetrics, runsDir: string) => boolean;
  closeIssue: (repo: string, issueNumber: number) => Promise<void>;
}

export interface IngestionTally {
  imported: number;
  skippedDuplicate: number;
  skippedMalformed: number;
  closed: number;
  closeFailed: number;
  malformedIssues: number[];
  closeFailedIssues: number[];
}

/**
 * Process a batch of community issues: parse each payload, write new runs
 * (deduped by run_id), and close every open issue idempotently.
 *
 * The close is attempted on the duplicate path too: a submission that imported
 * on an earlier run but failed to close would otherwise be seen as a duplicate
 * forever and never closed again, leaving the issue open and reprocessed on
 * every fetch. Malformed issues are reported (not fixed up) and left open.
 *
 * I/O (writeRunFile/closeIssue) is injected so the control flow can be unit
 * tested without a live `gh`. Returns a tally; the caller owns all logging.
 */
export async function ingestCommunityIssues(
  issues: CommunityIssue[],
  repo: string,
  runsDir: string,
  deps: IngestionDeps,
): Promise<IngestionTally> {
  const tally: IngestionTally = {
    imported: 0, skippedDuplicate: 0, skippedMalformed: 0,
    closed: 0, closeFailed: 0, malformedIssues: [], closeFailedIssues: [],
  };

  for (const issue of issues) {
    const run = parseSubmissionPayload(issue.body);
    if (!run) {
      tally.skippedMalformed++;
      tally.malformedIssues.push(issue.number);
      continue;
    }

    if (deps.writeRunFile(run, runsDir)) {
      tally.imported++;
    } else {
      tally.skippedDuplicate++;
    }

    try {
      await deps.closeIssue(repo, issue.number);
      tally.closed++;
    } catch {
      tally.closeFailed++;
      tally.closeFailedIssues.push(issue.number);
    }
  }

  return tally;
}

// ── Payload parsing (type-only validation, per NFR-5) ────────────────────────

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

function numOrNull(v: unknown): number | null {
  return isNumber(v) ? v : null;
}

/** Type-check `keys` off `raw` (object or not) into a { [key]: number | null } map. */
function pickNumbers<K extends string>(raw: Record<string, unknown>, keys: readonly K[]): Record<K, number | null> {
  const result = {} as Record<K, number | null>;
  for (const key of keys) result[key] = numOrNull(raw[key]);
  return result;
}

const STEP1_ABSENT: Step1PlanMetrics = {
  present: false, final_confidence: null, confidence_breakdown: null,
  clarification_rounds: null, tech_stack_revision_rounds: null,
  verification_gaps_found: null, functional_requirements_count: null,
  non_functional_requirements_count: null, risk_count: null, phase_count: null,
};

function parseStep1(raw: unknown): Step1PlanMetrics {
  if (raw == null || typeof raw !== 'object') return STEP1_ABSENT;
  const step1 = raw as Record<string, unknown>;
  const bdRaw = step1['confidence_breakdown'];
  const breakdown = bdRaw != null && typeof bdRaw === 'object'
    ? pickNumbers(bdRaw as Record<string, unknown>, ['requirements', 'feasibility', 'integration', 'risk'])
    : null;
  return {
    present: true,
    confidence_breakdown: breakdown,
    ...pickNumbers(step1, [
      'final_confidence', 'clarification_rounds', 'tech_stack_revision_rounds',
      'verification_gaps_found', 'functional_requirements_count',
      'non_functional_requirements_count', 'risk_count', 'phase_count',
    ]),
  };
}

const STEP2_ABSENT: Step2DocumentMetrics = {
  present: false, total_tasks: null, tasks_per_phase: null,
  phase_count: null, parallel_groups_identified: null,
  requirement_coverage_percent: null, verification_items_added: null,
};

function parseStep2(raw: unknown): Step2DocumentMetrics {
  if (raw == null || typeof raw !== 'object') return STEP2_ABSENT;
  const step2 = raw as Record<string, unknown>;
  return {
    present: true,
    tasks_per_phase: null,
    ...pickNumbers(step2, [
      'total_tasks', 'phase_count', 'parallel_groups_identified',
      'requirement_coverage_percent', 'verification_items_added',
    ]),
  };
}

const STEP3_ABSENT: Step3ImplementMetrics = {
  present: false, task_completion_rate: null, tasks_completed: null, tasks_total: null, blocker_count: null,
};

function parseStep3(raw: unknown): Step3ImplementMetrics {
  if (raw == null || typeof raw !== 'object') return STEP3_ABSENT;
  const step3 = raw as Record<string, unknown>;
  return {
    present: true,
    ...pickNumbers(step3, ['task_completion_rate', 'tasks_completed', 'tasks_total', 'blocker_count']),
  };
}

const STEP4_ABSENT: Step4FinalizeMetrics = {
  present: false, completion_rate_at_audit: null, verification_failures_found: null,
  documentation_updates_needed: null, archival_succeeded: null,
};

function parseStep4(raw: unknown): Step4FinalizeMetrics {
  if (raw == null || typeof raw !== 'object') return STEP4_ABSENT;
  const step4 = raw as Record<string, unknown>;
  const archivalRaw = step4['archival_succeeded'];
  return {
    present: true,
    archival_succeeded: typeof archivalRaw === 'boolean' ? archivalRaw : null,
    ...pickNumbers(step4, ['completion_rate_at_audit', 'verification_failures_found', 'documentation_updates_needed']),
  };
}

function parsePromptVersionsShort(raw: unknown): PromptVersions {
  const partial: Partial<PromptVersions> = {};
  if (raw != null && typeof raw === 'object') {
    const pv = raw as Record<string, unknown>;
    for (const key of ['plan', 'revise_plan', 'document', 'implement', 'finalize', 'init', 'init_update', 'quick_task'] as const) {
      const v = pv[key];
      if (isString(v)) partial[key] = v;
    }
  }
  return backfillPromptVersions(partial as PromptVersions);
}

export function parseSubmissionPayload(body: string): RunMetrics | null {
  const parsed = extractMetricsJson(body);
  if (!parsed) return null;

  if (parsed['schema_version'] !== '1.0') return null;
  if (!isString(parsed['run_id'])) return null;
  if (!isString(parsed['plan2code_version'])) return null;

  const feedbackRaw = parsed['user_feedback'];
  if (feedbackRaw == null || typeof feedbackRaw !== 'object') return null;
  const feedback = feedbackRaw as Record<string, unknown>;
  if (!isNumber(feedback['overall_rating'])) return null;
  if (!isString(feedback['rating_reason'])) return null;
  if (!isString(feedback['what_went_well'])) return null;
  if (!isString(feedback['what_went_poorly'])) return null;

  const userFeedback: UserFeedback = {
    overall_rating: feedback['overall_rating'],
    rating_reason: feedback['rating_reason'],
    what_went_well: feedback['what_went_well'],
    what_went_poorly: feedback['what_went_poorly'],
  };

  return {
    schema_version: '1.0',
    run_id: parsed['run_id'],
    plan2code_version: parsed['plan2code_version'],
    source: 'community',
    prompt_versions: parsePromptVersionsShort(parsed['prompt_versions_short']),
    project: { name: '', started_at: null, completed_at: null },
    step1_plan: parseStep1(parsed['step1']),
    step2_document: parseStep2(parsed['step2']),
    step3_implement: parseStep3(parsed['step3']),
    step4_finalize: parseStep4(parsed['step4']),
    user_feedback: userFeedback,
  };
}
