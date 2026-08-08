import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { parseSubmissionPayload, ingestCommunityIssues } from './community.js';
import { writeRunFile } from './aggregator.js';
import type { RunMetrics } from './types.js';

function issueBody(payload: Record<string, unknown>): string {
  return `Some issue text.\n\n<!-- METRICS_JSON ${JSON.stringify(payload)} -->\n`;
}

const VALID_PAYLOAD = {
  schema_version: '1.0',
  run_id: 'run-20260715-143000-a1b2',
  plan2code_version: '1.15.3',
  prompt_versions_short: {
    plan: 'abc123def456', revise_plan: 'a', document: 'b', implement: 'c',
    finalize: 'd', init: 'e', init_update: 'f', quick_task: 'g',
  },
  step1: {
    final_confidence: 95,
    confidence_breakdown: { requirements: 24, feasibility: 23, integration: 24, risk: 22 },
    clarification_rounds: 0,
    tech_stack_revision_rounds: 0,
    verification_gaps_found: 0,
    functional_requirements_count: 8,
    non_functional_requirements_count: 6,
    risk_count: 7,
    phase_count: 4,
  },
  step2: {
    total_tasks: 28,
    phase_count: 4,
    parallel_groups_identified: 1,
    requirement_coverage_percent: 100,
    verification_items_added: 3,
  },
  step3: {
    task_completion_rate: 0.96,
    tasks_completed: 27,
    tasks_total: 28,
    blocker_count: 1,
  },
  step4: {
    completion_rate_at_audit: 0.96,
    verification_failures_found: 1,
    documentation_updates_needed: 2,
  },
  user_feedback: {
    overall_rating: 8,
    rating_reason: 'good stuff',
    what_went_well: 'well',
    what_went_poorly: 'poorly',
  },
};

// ── parseSubmissionPayload() ─────────────────────────────────────────────────

describe('parseSubmissionPayload', () => {
  it('parses a fully valid payload into a correctly-shaped RunMetrics', () => {
    const result = parseSubmissionPayload(issueBody(VALID_PAYLOAD));
    expect(result).not.toBeNull();
    expect(result!.run_id).toBe('run-20260715-143000-a1b2');
    expect(result!.schema_version).toBe('1.0');
    expect(result!.plan2code_version).toBe('1.15.3');
    expect(result!.source).toBe('community');
    expect(result!.step1_plan.present).toBe(true);
    expect(result!.step1_plan.final_confidence).toBe(95);
    expect(result!.step2_document.present).toBe(true);
    expect(result!.step2_document.total_tasks).toBe(28);
    expect(result!.step3_implement.present).toBe(true);
    expect(result!.step3_implement.tasks_completed).toBe(27);
    expect(result!.step4_finalize.present).toBe(true);
    expect(result!.step4_finalize.completion_rate_at_audit).toBe(0.96);
    expect(result!.user_feedback).toEqual({
      overall_rating: 8,
      rating_reason: 'good stuff',
      what_went_well: 'well',
      what_went_poorly: 'poorly',
    });
  });

  it('returns null when run_id is missing', () => {
    const { run_id, ...withoutRunId } = VALID_PAYLOAD;
    const result = parseSubmissionPayload(issueBody(withoutRunId));
    expect(result).toBeNull();
  });

  it('returns null when user_feedback.overall_rating is a string instead of a number', () => {
    const badPayload = {
      ...VALID_PAYLOAD,
      user_feedback: { ...VALID_PAYLOAD.user_feedback, overall_rating: 'eight' },
    };
    const result = parseSubmissionPayload(issueBody(badPayload));
    expect(result).toBeNull();
  });

  it('returns null when schema_version is not exactly "1.0"', () => {
    const badPayload = { ...VALID_PAYLOAD, schema_version: '2.0' };
    const result = parseSubmissionPayload(issueBody(badPayload));
    expect(result).toBeNull();
  });

  it('sets all four steps present:false when only user_feedback is included', () => {
    const minimalPayload = {
      schema_version: '1.0',
      run_id: 'run-20260715-150000-c3d4',
      plan2code_version: '1.15.3',
      user_feedback: VALID_PAYLOAD.user_feedback,
    };
    const result = parseSubmissionPayload(issueBody(minimalPayload));
    expect(result).not.toBeNull();
    expect(result!.step1_plan.present).toBe(false);
    expect(result!.step2_document.present).toBe(false);
    expect(result!.step3_implement.present).toBe(false);
    expect(result!.step4_finalize.present).toBe(false);
  });

  it('backfills missing prompt_versions_short keys with the sha256:missing sentinel', () => {
    const partialPayload = {
      ...VALID_PAYLOAD,
      prompt_versions_short: { plan: 'abc123def456' },
    };
    const result = parseSubmissionPayload(issueBody(partialPayload));
    expect(result).not.toBeNull();
    expect(result!.prompt_versions.plan).toBe('abc123def456');
    expect(result!.prompt_versions.revise_plan).toBe('sha256:missing');
    expect(result!.prompt_versions.document).toBe('sha256:missing');
    expect(result!.prompt_versions.implement).toBe('sha256:missing');
    expect(result!.prompt_versions.finalize).toBe('sha256:missing');
    expect(result!.prompt_versions.init).toBe('sha256:missing');
    expect(result!.prompt_versions.init_update).toBe('sha256:missing');
    expect(result!.prompt_versions.quick_task).toBe('sha256:missing');
  });
});

// ── writeRunFile() ────────────────────────────────────────────────────────────

describe('writeRunFile', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const RUN: RunMetrics = {
    schema_version: '1.0',
    run_id: 'run-20260715-160000-e5f6',
    plan2code_version: '1.15.3',
    prompt_versions: {
      plan: 'sha256:missing', revise_plan: 'sha256:missing', document: 'sha256:missing',
      implement: 'sha256:missing', finalize: 'sha256:missing', init: 'sha256:missing',
      init_update: 'sha256:missing', quick_task: 'sha256:missing',
    },
    project: { name: '', started_at: null, completed_at: null },
    step1_plan: { present: false, final_confidence: null, confidence_breakdown: null, clarification_rounds: null, tech_stack_revision_rounds: null, verification_gaps_found: null, functional_requirements_count: null, non_functional_requirements_count: null, risk_count: null, phase_count: null },
    step2_document: { present: false, total_tasks: null, tasks_per_phase: null, phase_count: null, parallel_groups_identified: null, requirement_coverage_percent: null, verification_items_added: null },
    step3_implement: { present: false, task_completion_rate: null, tasks_completed: null, tasks_total: null, blocker_count: null },
    step4_finalize: { present: false, completion_rate_at_audit: null, verification_failures_found: null, documentation_updates_needed: null, archival_succeeded: null },
    user_feedback: null,
  };

  it('writes a new run_id to an empty runsDir and returns true', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan2code-metrics-test-'));
    const result = writeRunFile(RUN, tmpDir);
    expect(result).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, `${RUN.run_id}.json`))).toBe(true);
  });

  it('returns false and does not overwrite when the same run_id already exists', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan2code-metrics-test-'));
    writeRunFile(RUN, tmpDir);
    const modified = { ...RUN, plan2code_version: '9.9.9' };
    const result = writeRunFile(modified, tmpDir);
    expect(result).toBe(false);
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, `${RUN.run_id}.json`), 'utf8'));
    expect(onDisk.plan2code_version).toBe('1.15.3');
  });
});

// ── ingestCommunityIssues() ───────────────────────────────────────────────────

describe('ingestCommunityIssues', () => {
  const goodBody = issueBody(VALID_PAYLOAD);
  const badBody = 'an issue with no METRICS_JSON payload';

  it('imports a new run and closes its issue', async () => {
    const closed: number[] = [];
    const tally = await ingestCommunityIssues(
      [{ number: 1, body: goodBody }],
      'owner/repo',
      '/runs',
      { writeRunFile: () => true, closeIssue: async (_r, n) => { closed.push(n); } },
    );
    expect(tally.imported).toBe(1);
    expect(tally.skippedDuplicate).toBe(0);
    expect(tally.closed).toBe(1);
    expect(closed).toEqual([1]);
  });

  it('closes an already-imported (duplicate) issue instead of skipping the close', async () => {
    const closed: number[] = [];
    const tally = await ingestCommunityIssues(
      [{ number: 7, body: goodBody }],
      'owner/repo',
      '/runs',
      { writeRunFile: () => false, closeIssue: async (_r, n) => { closed.push(n); } },
    );
    expect(tally.imported).toBe(0);
    expect(tally.skippedDuplicate).toBe(1);
    expect(tally.closed).toBe(1); // the close-retry: duplicates are still closed
    expect(closed).toEqual([7]);
  });

  it('records a close failure without throwing and leaves the issue for a later retry', async () => {
    const tally = await ingestCommunityIssues(
      [{ number: 9, body: goodBody }],
      'owner/repo',
      '/runs',
      { writeRunFile: () => true, closeIssue: async () => { throw new Error('network'); } },
    );
    expect(tally.imported).toBe(1);
    expect(tally.closed).toBe(0);
    expect(tally.closeFailed).toBe(1);
    expect(tally.closeFailedIssues).toEqual([9]);
  });

  it('skips and reports a malformed issue without writing or closing it', async () => {
    let wrote = false;
    let closeCalled = false;
    const tally = await ingestCommunityIssues(
      [{ number: 3, body: badBody }],
      'owner/repo',
      '/runs',
      { writeRunFile: () => { wrote = true; return true; }, closeIssue: async () => { closeCalled = true; } },
    );
    expect(tally.skippedMalformed).toBe(1);
    expect(tally.malformedIssues).toEqual([3]);
    expect(wrote).toBe(false);
    expect(closeCalled).toBe(false);
  });
});
