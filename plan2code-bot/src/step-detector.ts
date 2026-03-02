import fs from 'fs-extra';
import path from 'path';
import type { StepName } from './types.js';

export interface DetectionResult {
  completed: boolean;
  nextStep: StepName | null;
  needsAnotherImplementPass: boolean;
}

const STEP_ORDER: StepName[] = ['init', 'plan', 'document', 'implement', 'finalize'];

export function detectStepCompletion(output: string, step: StepName): DetectionResult {
  const lowerOutput = output.toLowerCase();

  let completed = false;

  switch (step) {
    case 'init':
      completed = lowerOutput.includes('agents.md') && (
        lowerOutput.includes('created') ||
        lowerOutput.includes('generated') ||
        lowerOutput.includes('written')
      );
      break;

    case 'plan':
      completed = lowerOutput.includes('plan') && (
        lowerOutput.includes('complete') ||
        lowerOutput.includes('approved') ||
        lowerOutput.includes('finalized') ||
        lowerOutput.includes('saved')
      );
      break;

    case 'document':
      completed = lowerOutput.includes('overview.md') || (
        lowerOutput.includes('document') && lowerOutput.includes('complete')
      );
      break;

    case 'implement':
      completed = lowerOutput.includes('phase') && (
        lowerOutput.includes('complete') ||
        lowerOutput.includes('done') ||
        lowerOutput.includes('finished')
      );
      break;

    case 'finalize':
      completed = lowerOutput.includes('finalize') && (
        lowerOutput.includes('complete') ||
        lowerOutput.includes('archived') ||
        lowerOutput.includes('done')
      );
      break;
  }

  // Determine next step
  const currentIdx = STEP_ORDER.indexOf(step);
  const nextStep = currentIdx < STEP_ORDER.length - 1 ? STEP_ORDER[currentIdx + 1] : null;

  return {
    completed,
    nextStep: completed ? nextStep : null,
    needsAnotherImplementPass: false,
  };
}

export function checkAllPhasesComplete(projectDir: string): boolean {
  const specsDir = path.join(projectDir, 'specs');

  if (!fs.existsSync(specsDir)) {
    return false;
  }

  const entries = fs.readdirSync(specsDir, { withFileTypes: true });
  const specDirs = entries.filter((e) => e.isDirectory());

  if (specDirs.length === 0) {
    return false;
  }

  let foundPhaseTracking = false;

  for (const dir of specDirs) {
    const specPath = path.join(specsDir, dir.name);

    // Try overview.md first
    const overviewPath = path.join(specPath, 'overview.md');
    if (fs.existsSync(overviewPath)) {
      foundPhaseTracking = true;
      if (hasUncheckedPhases(fs.readFileSync(overviewPath, 'utf-8'))) {
        return false;
      }
      continue;
    }

    // Fallback: look for phase-*.md or PHASE-*.md in the spec dir
    const phaseFiles = findPhaseFiles(specPath);
    if (phaseFiles.length > 0) {
      foundPhaseTracking = true;
      for (const pf of phaseFiles) {
        if (hasUncheckedPhases(fs.readFileSync(pf, 'utf-8'))) {
          return false;
        }
      }
      continue;
    }

    // Fallback: look inside a phases/ subdirectory
    const phasesSubdir = path.join(specPath, 'phases');
    if (fs.existsSync(phasesSubdir)) {
      const subPhaseFiles = findPhaseFiles(phasesSubdir);
      if (subPhaseFiles.length > 0) {
        foundPhaseTracking = true;
        for (const pf of subPhaseFiles) {
          if (hasUncheckedPhases(fs.readFileSync(pf, 'utf-8'))) {
            return false;
          }
        }
      }
    }
  }

  // Only return true if we positively confirmed all phases are checked off
  return foundPhaseTracking;
}

function hasUncheckedPhases(content: string): boolean {
  const lines = content.split('\n');

  const phaseLines = lines.filter((line) =>
    line.match(/^[-*]\s*\[[ x]\]/i) && line.toLowerCase().includes('phase')
  );

  if (phaseLines.length > 0) {
    return phaseLines.some((line) => line.includes('[ ]'));
  }

  // No phase-specific checkboxes — check for any unchecked boxes
  return lines.some((line) => /^[-*]\s*\[ \]/.test(line));
}

function findPhaseFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir);
  return entries
    .filter((name) => /^phase[-_]?\d+.*\.md$/i.test(name))
    .map((name) => path.join(dir, name));
}
