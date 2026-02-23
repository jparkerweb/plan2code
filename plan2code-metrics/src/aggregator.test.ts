import { describe, it, expect } from 'vitest';
import { avg, rate, buildCohortKey, backfillPromptVersions } from './aggregator.js';
import type { PromptVersions } from './types.js';

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
