import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { validateStepArtifacts, installSkillsForBot } from './cli.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2c-cli-test-'));
});

afterEach(() => {
  fs.removeSync(tmpDir);
});

// ── validateStepArtifacts ───────────────────────────────────────────

describe('validateStepArtifacts', () => {
  describe('init', () => {
    it('valid when AGENTS.md exists', () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Agents');
      const result = validateStepArtifacts('init', tmpDir);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('missing when AGENTS.md does not exist', () => {
      const result = validateStepArtifacts('init', tmpDir);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('AGENTS.md');
    });
  });

  describe('plan', () => {
    it('valid when specs/feature/PLAN-DRAFT-*.md exists', () => {
      const specDir = path.join(tmpDir, 'specs', 'my-feature');
      fs.ensureDirSync(specDir);
      fs.writeFileSync(path.join(specDir, 'PLAN-DRAFT-v1.md'), '# Plan');
      const result = validateStepArtifacts('plan', tmpDir);
      expect(result.valid).toBe(true);
    });

    it('missing when specs/ is absent', () => {
      const result = validateStepArtifacts('plan', tmpDir);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('specs/ directory');
    });

    it('missing when specs/ has dirs but no plan draft files', () => {
      const specDir = path.join(tmpDir, 'specs', 'my-feature');
      fs.ensureDirSync(specDir);
      fs.writeFileSync(path.join(specDir, 'notes.md'), '# Notes');
      const result = validateStepArtifacts('plan', tmpDir);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('specs/*/PLAN-DRAFT-*.md');
    });
  });

  describe('document', () => {
    it('valid when overview.md and phase-*.md exist', () => {
      const specDir = path.join(tmpDir, 'specs', 'my-feature');
      fs.ensureDirSync(specDir);
      fs.writeFileSync(path.join(specDir, 'overview.md'), '# Overview');
      fs.writeFileSync(path.join(specDir, 'phase-1.md'), '# Phase 1');
      const result = validateStepArtifacts('document', tmpDir);
      expect(result.valid).toBe(true);
    });

    it('missing overview.md when absent', () => {
      const specDir = path.join(tmpDir, 'specs', 'my-feature');
      fs.ensureDirSync(specDir);
      fs.writeFileSync(path.join(specDir, 'phase-1.md'), '# Phase 1');
      const result = validateStepArtifacts('document', tmpDir);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('specs/*/overview.md');
    });

    it('missing phase files when absent', () => {
      const specDir = path.join(tmpDir, 'specs', 'my-feature');
      fs.ensureDirSync(specDir);
      fs.writeFileSync(path.join(specDir, 'overview.md'), '# Overview');
      const result = validateStepArtifacts('document', tmpDir);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('specs/*/phase-*.md files');
    });

    it('accepts phase files inside phases/ subdirectory', () => {
      const specDir = path.join(tmpDir, 'specs', 'my-feature');
      const phasesDir = path.join(specDir, 'phases');
      fs.ensureDirSync(phasesDir);
      fs.writeFileSync(path.join(specDir, 'overview.md'), '# Overview');
      fs.writeFileSync(path.join(phasesDir, 'phase-1.md'), '# Phase 1');
      const result = validateStepArtifacts('document', tmpDir);
      expect(result.valid).toBe(true);
    });
  });

  describe('finalize', () => {
    it('valid when specs--completed/ has a subdirectory', () => {
      fs.ensureDirSync(path.join(tmpDir, 'specs--completed', 'my-feature'));
      const result = validateStepArtifacts('finalize', tmpDir);
      expect(result.valid).toBe(true);
    });

    it('missing when specs--completed/ is absent', () => {
      const result = validateStepArtifacts('finalize', tmpDir);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('specs--completed/ directory');
    });

    it('missing when specs--completed/ is empty', () => {
      fs.ensureDirSync(path.join(tmpDir, 'specs--completed'));
      const result = validateStepArtifacts('finalize', tmpDir);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('archived spec in specs--completed/');
    });
  });
});

// ── installSkillsForBot ─────────────────────────────────────────────

describe('installSkillsForBot', () => {
  let fakeHome: string;
  let projectDir: string;
  let origHome: string | undefined;
  let origUserProfile: string | undefined;

  beforeEach(() => {
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'p2c-home-'));
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2c-proj-'));
    origHome = process.env.HOME;
    origUserProfile = process.env.USERPROFILE;
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    process.env.USERPROFILE = origUserProfile;
    fs.removeSync(fakeHome);
    fs.removeSync(projectDir);
  });

  it('copies skills from user dir to project .claude/skills/', () => {
    const srcDir = path.join(fakeHome, '.claude', 'skills', 'plan2code-init');
    fs.ensureDirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'SKILL.md'), '---\nname: init\n---\nSome content');

    installSkillsForBot(projectDir);

    const dest = path.join(projectDir, '.claude', 'skills', 'plan2code-init', 'SKILL.md');
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, 'utf-8')).toContain('Some content');
  });

  it('strips disable-model-invocation: true from copied SKILL.md', () => {
    const srcDir = path.join(fakeHome, '.claude', 'skills', 'plan2code-1-plan');
    fs.ensureDirSync(srcDir);
    fs.writeFileSync(
      path.join(srcDir, 'SKILL.md'),
      'disable-model-invocation: true\n---\nname: plan\n---\nPlan content',
    );

    installSkillsForBot(projectDir);

    const dest = path.join(projectDir, '.claude', 'skills', 'plan2code-1-plan', 'SKILL.md');
    const content = fs.readFileSync(dest, 'utf-8');
    expect(content).not.toContain('disable-model-invocation');
    expect(content).toContain('Plan content');
  });

  it('preserves rest of skill content', () => {
    const srcDir = path.join(fakeHome, '.claude', 'skills', 'plan2code-2-document');
    fs.ensureDirSync(srcDir);
    const original = 'disable-model-invocation: true\n---\nname: doc\n---\nLine 1\nLine 2\nLine 3';
    fs.writeFileSync(path.join(srcDir, 'SKILL.md'), original);

    installSkillsForBot(projectDir);

    const dest = path.join(projectDir, '.claude', 'skills', 'plan2code-2-document', 'SKILL.md');
    const content = fs.readFileSync(dest, 'utf-8');
    expect(content).toContain('Line 1');
    expect(content).toContain('Line 2');
    expect(content).toContain('Line 3');
    expect(content).toContain('name: doc');
  });

  it('skips gracefully when source skill does not exist', () => {
    // No skills in fakeHome — should not throw
    expect(() => installSkillsForBot(projectDir)).not.toThrow();
    // No .claude/skills/ created in project
    expect(fs.existsSync(path.join(projectDir, '.claude', 'skills'))).toBe(false);
  });
});
