import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { collectPromptVersions, collectStep1, extractMetricsJson, promptKey } from './collector.js';
import { backfillPromptVersions, buildCohortKey } from './aggregator.js';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'p2c-collector-'));
  fs.mkdirSync(path.join(root, 'src'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function prompt(name: string, body: string) {
  fs.writeFileSync(path.join(root, 'src', name), body);
}

describe('collectPromptVersions', () => {
  it('fingerprints every src/plan2code-*.md prompt in the folder', () => {
    prompt('plan2code-1-plan.md', 'plan');
    prompt('plan2code-3-implement-review.md', 'implement review');
    prompt('plan2code-git.md', 'git');
    const versions = collectPromptVersions(root);
    expect(Object.keys(versions).sort()).toEqual(['3_implement_review', 'git', 'plan']);
    for (const v of Object.values(versions)) expect(v).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('covers a newly added prompt without a code change', () => {
    prompt('plan2code-1-plan.md', 'plan');
    const before = collectPromptVersions(root);
    prompt('plan2code-brand-new.md', 'a new skill');
    const after = collectPromptVersions(root);
    expect(before).not.toHaveProperty('brand_new');
    expect(after).toHaveProperty('brand_new');
    expect(buildCohortKey(after)).not.toBe(buildCohortKey(before));
  });

  it('ignores files and folders that are not top-level plan2code-*.md prompts', () => {
    prompt('plan2code-1-plan.md', 'plan');
    prompt('README.md', 'not a prompt');
    prompt('plan2code-notes.txt', 'not markdown');
    fs.mkdirSync(path.join(root, 'src', 'plan2code-0-pathfinder-references.md'));
    expect(Object.keys(collectPromptVersions(root))).toEqual(['plan']);
  });

  it('keeps the old keys for the eight prompts recorded before, so their hashes stay comparable', () => {
    expect(promptKey('plan2code-1-plan.md')).toBe('plan');
    expect(promptKey('plan2code-1b-revise-plan.md')).toBe('revise_plan');
    expect(promptKey('plan2code-2-document.md')).toBe('document');
    expect(promptKey('plan2code-3-implement.md')).toBe('implement');
    expect(promptKey('plan2code-4-finalize.md')).toBe('finalize');
    expect(promptKey('plan2code-init.md')).toBe('init');
    expect(promptKey('plan2code-init-update.md')).toBe('init_update');
    expect(promptKey('plan2code-quick-task.md')).toBe('quick_task');
  });

  it('returns nothing when there is no src folder', () => {
    expect(collectPromptVersions(path.join(root, 'nowhere'))).toEqual({});
  });

  it('groups a run recorded before this change as the previous prompt generation', () => {
    prompt('plan2code-1-plan.md', 'plan');
    prompt('plan2code-git.md', 'git');
    const now = collectPromptVersions(root);
    const old = backfillPromptVersions({ plan: now.plan });
    expect(buildCohortKey(old)).not.toBe(buildCohortKey(now));
  });
});

describe('the shared scrape pattern', () => {
  function draft(body: string) {
    const specDir = path.join(root, 'spec');
    fs.mkdirSync(specDir);
    fs.writeFileSync(path.join(specDir, 'PLAN-DRAFT-1.md'), body);
    return collectStep1(specDir);
  }

  it('reads the METRICS_JSON comment', () => {
    expect(extractMetricsJson('x <!-- METRICS_JSON {"confidence": 95} --> y')).toEqual({ confidence: 95 });
  });

  it('reads a breakdown written as label, colon, score', () => {
    const m = draft('Requirements: 24\nFeasibility: 23\nIntegration: 22\nRisk: 21\n');
    expect(m.confidence_breakdown).toEqual({ requirements: 24, feasibility: 23, integration: 22, risk: 21 });
  });

  it('reads a breakdown table whose score ends the row', () => {
    const m = draft('| Requirements | 24 |\n| Risk | 21/25 |\n');
    expect(m.confidence_breakdown).toEqual({ requirements: 24, feasibility: null, integration: null, risk: 21 });
  });

  it('leaves an ordinary risk-register row alone', () => {
    const m = draft('| Risk | 3 | High | Mitigation |\n');
    expect(m.confidence_breakdown).toBeNull();
  });
});
