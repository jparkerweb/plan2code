import path from 'path';
import fs from 'fs-extra';

/**
 * Auto-detect spec directories in the project
 * Looks for directories containing overview.md
 */
export async function detectSpecDirectories(cwd: string = process.cwd()): Promise<string[]> {
  const specsDir = path.join(cwd, 'specs');
  const specsDirs: string[] = [];

  if (await fs.pathExists(specsDir)) {
    // Look for overview.md files in subdirectories
    const entries = await fs.readdir(specsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const overviewPath = path.join(specsDir, entry.name, 'overview.md');
        if (await fs.pathExists(overviewPath)) {
          specsDirs.push(path.join(specsDir, entry.name));
        }
      }
    }

    // Also check if specs/ itself contains overview.md
    const rootOverview = path.join(specsDir, 'overview.md');
    if (await fs.pathExists(rootOverview)) {
      specsDirs.push(specsDir);
    }
  }

  return specsDirs;
}

/**
 * Simple progress stats by counting phase-*.md files
 * Used for CLI display only - LLM handles actual task discovery
 */
export async function getSpecProgress(specPath: string): Promise<{
  featureName: string;
  totalPhases: number;
}> {
  const overviewPath = path.join(specPath, 'overview.md');

  // Extract feature name from overview.md
  let featureName = path.basename(specPath);
  try {
    const overviewContent = await fs.readFile(overviewPath, 'utf8');
    const h1Match = overviewContent.match(/^#\s+(.+)$/m);
    if (h1Match) {
      featureName = h1Match[1].trim();
    }
  } catch {
    // Use directory name as fallback
  }

  // Count phase-*.md files
  let totalPhases = 0;
  try {
    const entries = await fs.readdir(specPath);
    totalPhases = entries.filter(name => /^phase-\d+\.md$/i.test(name)).length;
  } catch {
    // Directory read failed
  }

  return {
    featureName,
    totalPhases,
  };
}
