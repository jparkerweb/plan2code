import fs from 'fs-extra';
import path from 'path';
import type { BotState } from './types.js';

const STATE_FILE = '.plan2code-bot-state.json';

export function saveState(state: BotState): void {
  const filePath = path.join(state.config.projectDir, STATE_FILE);
  fs.writeJsonSync(filePath, state, { spaces: 2 });
}

export function loadState(projectDir: string): BotState | null {
  const filePath = path.join(projectDir, STATE_FILE);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readJsonSync(filePath) as BotState;
}

export function deleteState(projectDir: string): void {
  const filePath = path.join(projectDir, STATE_FILE);
  if (fs.existsSync(filePath)) {
    fs.removeSync(filePath);
  }
}

/**
 * Search for an existing state file in workDir (enhancement mode)
 * or in immediate subdirectories (new-project mode).
 */
export function findExistingState(workDir: string): BotState | null {
  // Enhancement mode: state is in workDir directly
  const direct = loadState(workDir);
  if (direct) return direct;

  // New-project mode: state is in a subdirectory
  try {
    for (const entry of fs.readdirSync(workDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const sub = loadState(path.join(workDir, entry.name));
        if (sub) return sub;
      }
    }
  } catch {
    // workDir not readable — ignore
  }
  return null;
}
