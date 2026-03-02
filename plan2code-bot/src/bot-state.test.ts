import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { saveState, loadState, deleteState, findExistingState } from './bot-state.js';
import type { BotState } from './types.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bot-state-test-'));
}

function makeState(projectDir: string): BotState {
  return {
    config: {
      workDir: path.dirname(projectDir),
      projectDir,
      ideaName: 'test-idea',
      ideaDescription: 'A test idea',
      mode: 'new-project',
    },
    steps: [],
    currentStep: null,
    implementPasses: 0,
    allPhasesComplete: false,
  };
}

describe('bot-state', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  describe('saveState', () => {
    it('writes valid JSON', () => {
      const projectDir = path.join(tmpDir, 'project');
      fs.ensureDirSync(projectDir);
      const state = makeState(projectDir);

      saveState(state);

      const filePath = path.join(projectDir, '.plan2code-bot-state.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const parsed = fs.readJsonSync(filePath);
      expect(parsed.config.ideaName).toBe('test-idea');
    });
  });

  describe('loadState', () => {
    it('returns state from file', () => {
      const projectDir = path.join(tmpDir, 'project');
      fs.ensureDirSync(projectDir);
      const state = makeState(projectDir);
      saveState(state);

      const loaded = loadState(projectDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.config.ideaName).toBe('test-idea');
      expect(loaded!.implementPasses).toBe(0);
    });

    it('returns null when file does not exist', () => {
      const result = loadState(path.join(tmpDir, 'nonexistent'));
      expect(result).toBeNull();
    });
  });

  describe('deleteState', () => {
    it('removes the file', () => {
      const projectDir = path.join(tmpDir, 'project');
      fs.ensureDirSync(projectDir);
      const state = makeState(projectDir);
      saveState(state);

      const filePath = path.join(projectDir, '.plan2code-bot-state.json');
      expect(fs.existsSync(filePath)).toBe(true);

      deleteState(projectDir);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('is a no-op when file does not exist', () => {
      // Should not throw
      deleteState(path.join(tmpDir, 'nonexistent'));
    });
  });

  describe('findExistingState', () => {
    it('finds state in workDir (enhancement mode)', () => {
      const state = makeState(tmpDir);
      state.config.projectDir = tmpDir;
      state.config.mode = 'enhancement';
      saveState(state);

      const found = findExistingState(tmpDir);
      expect(found).not.toBeNull();
      expect(found!.config.ideaName).toBe('test-idea');
    });

    it('finds state in a subdirectory (new-project mode)', () => {
      const projectDir = path.join(tmpDir, 'my-app');
      fs.ensureDirSync(projectDir);
      const state = makeState(projectDir);
      saveState(state);

      const found = findExistingState(tmpDir);
      expect(found).not.toBeNull();
      expect(found!.config.projectDir).toBe(projectDir);
    });

    it('returns null when no state exists', () => {
      const found = findExistingState(tmpDir);
      expect(found).toBeNull();
    });
  });
});
