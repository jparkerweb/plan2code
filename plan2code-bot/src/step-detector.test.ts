import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { checkAllPhasesComplete, detectStepCompletion } from './step-detector.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2c-test-'));
});

afterEach(() => {
  fs.removeSync(tmpDir);
});

// ── checkAllPhasesComplete ──────────────────────────────────────────

describe('checkAllPhasesComplete', () => {
  it('returns false when no specs/ directory exists', () => {
    expect(checkAllPhasesComplete(tmpDir)).toBe(false);
  });

  it('returns false when specs/ has no subdirectories', () => {
    fs.ensureDirSync(path.join(tmpDir, 'specs'));
    expect(checkAllPhasesComplete(tmpDir)).toBe(false);
  });

  it('returns false when spec dir exists but has no overview.md and no phase files', () => {
    // This is the false-positive bug we fixed — an empty spec dir should NOT be "complete"
    fs.ensureDirSync(path.join(tmpDir, 'specs', 'my-feature'));
    expect(checkAllPhasesComplete(tmpDir)).toBe(false);
  });

  it('returns true when overview.md has all phases checked [x]', () => {
    const specDir = path.join(tmpDir, 'specs', 'my-feature');
    fs.ensureDirSync(specDir);
    fs.writeFileSync(
      path.join(specDir, 'overview.md'),
      `# Overview\n- [x] Phase 1: Setup\n- [x] Phase 2: Core\n- [x] Phase 3: Polish\n`,
    );
    expect(checkAllPhasesComplete(tmpDir)).toBe(true);
  });

  it('returns false when overview.md has unchecked [ ] phases', () => {
    const specDir = path.join(tmpDir, 'specs', 'my-feature');
    fs.ensureDirSync(specDir);
    fs.writeFileSync(
      path.join(specDir, 'overview.md'),
      `# Overview\n- [x] Phase 1: Setup\n- [ ] Phase 2: Core\n- [ ] Phase 3: Polish\n`,
    );
    expect(checkAllPhasesComplete(tmpDir)).toBe(false);
  });

  it('returns true via fallback: phase-*.md files with all checked, no overview.md', () => {
    const specDir = path.join(tmpDir, 'specs', 'my-feature');
    fs.ensureDirSync(specDir);
    fs.writeFileSync(
      path.join(specDir, 'phase-1.md'),
      `# Phase 1\n- [x] Task A\n- [x] Task B\n`,
    );
    fs.writeFileSync(
      path.join(specDir, 'phase-2.md'),
      `# Phase 2\n- [x] Task C\n`,
    );
    expect(checkAllPhasesComplete(tmpDir)).toBe(true);
  });

  it('returns false via fallback: phase-*.md with unchecked items', () => {
    const specDir = path.join(tmpDir, 'specs', 'my-feature');
    fs.ensureDirSync(specDir);
    fs.writeFileSync(
      path.join(specDir, 'phase-1.md'),
      `# Phase 1\n- [x] Task A\n- [ ] Task B\n`,
    );
    expect(checkAllPhasesComplete(tmpDir)).toBe(false);
  });

  it('returns true via nested phases/ subdirectory fallback with all checked', () => {
    const specDir = path.join(tmpDir, 'specs', 'my-feature');
    const phasesDir = path.join(specDir, 'phases');
    fs.ensureDirSync(phasesDir);
    fs.writeFileSync(
      path.join(phasesDir, 'phase-1.md'),
      `# Phase 1\n- [x] Task A\n- [x] Task B\n`,
    );
    expect(checkAllPhasesComplete(tmpDir)).toBe(true);
  });

  it('returns false via nested phases/ with unchecked items', () => {
    const specDir = path.join(tmpDir, 'specs', 'my-feature');
    const phasesDir = path.join(specDir, 'phases');
    fs.ensureDirSync(phasesDir);
    fs.writeFileSync(
      path.join(phasesDir, 'phase-1.md'),
      `# Phase 1\n- [x] Task A\n- [ ] Task B\n`,
    );
    expect(checkAllPhasesComplete(tmpDir)).toBe(false);
  });
});

// ── detectStepCompletion ────────────────────────────────────────────

describe('detectStepCompletion', () => {
  it('init: completed when output mentions agents.md created', () => {
    const result = detectStepCompletion('AGENTS.md has been created successfully', 'init');
    expect(result.completed).toBe(true);
    expect(result.nextStep).toBe('plan');
  });

  it('init: not completed for unrelated output', () => {
    const result = detectStepCompletion('Hello world, nothing happened', 'init');
    expect(result.completed).toBe(false);
    expect(result.nextStep).toBeNull();
  });

  it('plan: completed when plan is saved', () => {
    const result = detectStepCompletion('The plan has been saved and finalized', 'plan');
    expect(result.completed).toBe(true);
    expect(result.nextStep).toBe('document');
  });

  it('plan: not completed for unrelated output', () => {
    const result = detectStepCompletion('Reading the codebase...', 'plan');
    expect(result.completed).toBe(false);
    expect(result.nextStep).toBeNull();
  });

  it('document: completed when overview.md is mentioned', () => {
    const result = detectStepCompletion('Created overview.md with all phases', 'document');
    expect(result.completed).toBe(true);
    expect(result.nextStep).toBe('implement');
  });

  it('document: not completed for unrelated output', () => {
    const result = detectStepCompletion('Thinking about the design...', 'document');
    expect(result.completed).toBe(false);
    expect(result.nextStep).toBeNull();
  });

  it('implement: completed when phase is done', () => {
    const result = detectStepCompletion('Phase 1 is now complete!', 'implement');
    expect(result.completed).toBe(true);
    expect(result.nextStep).toBe('finalize');
  });

  it('implement: not completed for unrelated output', () => {
    const result = detectStepCompletion('Working on some files', 'implement');
    expect(result.completed).toBe(false);
    expect(result.nextStep).toBeNull();
  });

  it('finalize: completed when finalize is done', () => {
    const result = detectStepCompletion('Finalize step is complete and archived', 'finalize');
    expect(result.completed).toBe(true);
    expect(result.nextStep).toBeNull(); // last step
  });

  it('finalize: not completed for unrelated output', () => {
    const result = detectStepCompletion('Just starting...', 'finalize');
    expect(result.completed).toBe(false);
    expect(result.nextStep).toBeNull();
  });
});
