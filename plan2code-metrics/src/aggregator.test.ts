import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { avg, rate, buildCohortKey, backfillPromptVersions, cohortKeyForRun, aggregate } from './aggregator.js';
import type { PromptVersions, RunMetrics } from './types.js';

// ── avg() ─────────────────────────────────────────────────────────────────────

describe('avg', () => {
  it('returns null for empty array', () => {
    expect(avg([])).toBeNull();
  });

  it('returns null for all-null/undefined values', () => {
    expect(avg([null, undefined, null])).toBeNull();
  });

  it('computes correct average for valid numbers', () => {
    expect(avg([10, 20, 30])).toBe(20);
  });

  it('filters out null/undefined/NaN from mixed arrays', () => {
    expect(avg([10, null, 20, undefined, NaN, 30])).toBe(20);
  });
});

// ── rate() ────────────────────────────────────────────────────────────────────

describe('rate', () => {
  it('returns null for empty array', () => {
    expect(rate([])).toBeNull();
  });

  it('returns null for all-null values', () => {
    expect(rate([null, null])).toBeNull();
  });

  it('returns 1.0 for all-true', () => {
    expect(rate([true, true, true])).toBe(1.0);
  });

  it('returns 0.0 for all-false', () => {
    expect(rate([false, false, false])).toBe(0.0);
  });

  it('computes correct rate for mixed true/false', () => {
    expect(rate([true, false, true, false])).toBe(0.5);
  });

  it('filters out null/undefined from mixed arrays', () => {
    expect(rate([true, null, false, undefined])).toBe(0.5);
  });
});

// ── backfillPromptVersions() ──────────────────────────────────────────────────

const FULL_VERSIONS: PromptVersions = {
  plan: 'sha256:aaa',
  revise_plan: 'sha256:bbb',
  document: 'sha256:ccc',
  implement: 'sha256:ddd',
  finalize: 'sha256:eee',
  init: 'sha256:fff',
  init_update: 'sha256:ggg',
  quick_task: 'sha256:hhh',
};

describe('backfillPromptVersions', () => {
  it('returns all 8 fields with sentinels when given empty-ish object', () => {
    const result = backfillPromptVersions({} as PromptVersions);
    expect(Object.keys(result)).toHaveLength(8);
    for (const val of Object.values(result)) {
      expect(val).toBe('sha256:missing');
    }
  });

  it('preserves existing values, fills missing with sha256:missing', () => {
    const partial = { plan: 'sha256:aaa', implement: 'sha256:ddd' } as PromptVersions;
    const result = backfillPromptVersions(partial);
    expect(result.plan).toBe('sha256:aaa');
    expect(result.implement).toBe('sha256:ddd');
    expect(result.revise_plan).toBe('sha256:missing');
    expect(result.document).toBe('sha256:missing');
    expect(result.finalize).toBe('sha256:missing');
    expect(result.init).toBe('sha256:missing');
    expect(result.init_update).toBe('sha256:missing');
    expect(result.quick_task).toBe('sha256:missing');
  });

  it('returns unchanged object when all 8 fields present', () => {
    const result = backfillPromptVersions(FULL_VERSIONS);
    expect(result).toEqual(FULL_VERSIONS);
  });
});

// ── buildCohortKey() ──────────────────────────────────────────────────────────

describe('buildCohortKey', () => {
  it('returns 12-char hex string', () => {
    const key = buildCohortKey(FULL_VERSIONS);
    expect(key).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic (same input → same output)', () => {
    const key1 = buildCohortKey(FULL_VERSIONS);
    const key2 = buildCohortKey(FULL_VERSIONS);
    expect(key1).toBe(key2);
  });

  it('old 4-field run with backfill sentinels produces same key as raw 4-field object', () => {
    // Simulate an old run that only had 4 fields
    const oldRun = {
      plan: 'sha256:aaa',
      implement: 'sha256:ddd',
      document: 'sha256:ccc',
      finalize: 'sha256:eee',
    } as PromptVersions;

    // After backfill, the missing fields get 'sha256:missing'
    const backfilled = backfillPromptVersions(oldRun);

    // buildCohortKey filters out 'sha256:missing', so both should match
    const keyDirect = buildCohortKey(oldRun);
    const keyBackfilled = buildCohortKey(backfilled);
    expect(keyDirect).toBe(keyBackfilled);
  });

  it('different prompt versions → different keys', () => {
    const altered = { ...FULL_VERSIONS, plan: 'sha256:zzz' };
    expect(buildCohortKey(FULL_VERSIONS)).not.toBe(buildCohortKey(altered));
  });

  it('key is independent of field insertion order', () => {
    const ordered: PromptVersions = {
      plan: 'sha256:aaa',
      revise_plan: 'sha256:bbb',
      document: 'sha256:ccc',
      implement: 'sha256:ddd',
      finalize: 'sha256:eee',
      init: 'sha256:fff',
      init_update: 'sha256:ggg',
      quick_task: 'sha256:hhh',
    };
    const reversed: PromptVersions = {
      quick_task: 'sha256:hhh',
      init_update: 'sha256:ggg',
      init: 'sha256:fff',
      finalize: 'sha256:eee',
      implement: 'sha256:ddd',
      document: 'sha256:ccc',
      revise_plan: 'sha256:bbb',
      plan: 'sha256:aaa',
    };
    expect(buildCohortKey(ordered)).toBe(buildCohortKey(reversed));
  });
});

// ── Run fixtures for cohort keying / aggregation ──────────────────────────────

function makeRun(overrides: Partial<RunMetrics> = {}): RunMetrics {
  return {
    schema_version: '1.0',
    run_id: 'run-20260101-000000-0000',
    plan2code_version: '1.17.0',
    prompt_versions: { ...FULL_VERSIONS },
    project: { name: 'proj', started_at: null, completed_at: null },
    step1_plan: { present: false, final_confidence: null, confidence_breakdown: null, clarification_rounds: null, tech_stack_revision_rounds: null, verification_gaps_found: null, functional_requirements_count: null, non_functional_requirements_count: null, risk_count: null, phase_count: null },
    step2_document: { present: false, total_tasks: null, tasks_per_phase: null, phase_count: null, parallel_groups_identified: null, requirement_coverage_percent: null, verification_items_added: null },
    step3_implement: { present: false, task_completion_rate: null, tasks_completed: null, tasks_total: null, blocker_count: null },
    step4_finalize: { present: false, completion_rate_at_audit: null, verification_failures_found: null, documentation_updates_needed: null, archival_succeeded: null },
    user_feedback: null,
    ...overrides,
  };
}

// ── cohortKeyForRun() ─────────────────────────────────────────────────────────

describe('cohortKeyForRun', () => {
  it('keys local runs by the prompt-version hash (unchanged from buildCohortKey)', () => {
    const run = makeRun({ source: 'local' });
    expect(cohortKeyForRun(run)).toBe(buildCohortKey(run.prompt_versions));
  });

  it('treats a run with no source as local', () => {
    const run = makeRun();
    delete run.source;
    expect(cohortKeyForRun(run)).toBe(buildCohortKey(run.prompt_versions));
  });

  it('keys community runs by plan2code_version, ignoring prompt fingerprints', () => {
    const run = makeRun({ source: 'community', plan2code_version: '1.17.0' });
    expect(cohortKeyForRun(run)).toBe('community:v1.17.0');
  });

  it('groups two community runs of the same version together regardless of prompt fingerprint', () => {
    const a = makeRun({ source: 'community', plan2code_version: '1.17.0', prompt_versions: { ...FULL_VERSIONS } });
    const b = makeRun({ source: 'community', plan2code_version: '1.17.0', prompt_versions: backfillPromptVersions({} as PromptVersions) });
    expect(cohortKeyForRun(a)).toBe(cohortKeyForRun(b));
  });

  it('separates community runs from different versions', () => {
    const a = makeRun({ source: 'community', plan2code_version: '1.17.0' });
    const b = makeRun({ source: 'community', plan2code_version: '1.18.0' });
    expect(cohortKeyForRun(a)).not.toBe(cohortKeyForRun(b));
  });
});

// ── aggregate() cohort separation ─────────────────────────────────────────────

describe('aggregate', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeRuns(runs: RunMetrics[]): { runsDir: string; outPath: string } {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan2code-agg-test-'));
    const runsDir = path.join(tmpDir, 'runs');
    fs.mkdirSync(runsDir, { recursive: true });
    for (const run of runs) {
      fs.writeFileSync(path.join(runsDir, `${run.run_id}.json`), JSON.stringify(run), 'utf8');
    }
    return { runsDir, outPath: path.join(tmpDir, 'aggregated.json') };
  }

  it('places local and community runs of the same version in separate cohorts', () => {
    const local = makeRun({ run_id: 'run-20260101-000001-0001', source: 'local' });
    const community = makeRun({ run_id: 'run-20260101-000002-0002', source: 'community' });
    const { runsDir, outPath } = writeRuns([local, community]);

    const result = aggregate(runsDir, outPath);

    expect(result.total_runs).toBe(2);
    expect(result.cohorts).toHaveLength(2);
    const communityCohort = result.cohorts.find(c => c.source === 'community');
    const localCohort = result.cohorts.find(c => c.source === 'local');
    expect(communityCohort?.cohort_key).toBe('community:v1.17.0');
    expect(localCohort?.cohort_key).toBe(buildCohortKey(local.prompt_versions));
  });

  it('never selects a community cohort as current when a local cohort exists', () => {
    // Community run sorts last by run_id, but current must stay on the local cohort.
    const local = makeRun({ run_id: 'run-20260101-000001-0001', source: 'local' });
    const community = makeRun({ run_id: 'run-29991231-235959-9999', source: 'community' });
    const { runsDir, outPath } = writeRuns([local, community]);

    const result = aggregate(runsDir, outPath);

    expect(result.current_cohort_key).toBe(buildCohortKey(local.prompt_versions));
  });
});
