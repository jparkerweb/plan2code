#!/usr/bin/env node

/**
 * Plan2Code Prompt Sync Utility
 *
 * Syncs the source prompts (plan2code-*.md) to all destination formats
 * with appropriate file names and YAML headers for each tool/IDE.
 *
 * Usage: node sync-prompts.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

// Configuration for source prompts
const SOURCE_PROMPTS = [
  {
    source: 'plan2code-1--plan.md',
    stepNumber: 1,
    name: 'plan',
    displayName: 'Planning Mode',
    description: 'Requirements analysis and architecture design'
  },
  {
    source: 'plan2code-2--document.md',
    stepNumber: 2,
    name: 'document',
    displayName: 'Documentation Mode',
    description: 'Transform planning output into structured implementation docs'
  },
  {
    source: 'plan2code-3--implement.md',
    stepNumber: 3,
    name: 'implement',
    displayName: 'Implementation Mode',
    description: 'Execute implementation phase by phase'
  },
  {
    source: 'plan2code-4--finalize.md',
    stepNumber: 4,
    name: 'finalize',
    displayName: 'Finalization Mode',
    description: 'Validate, summarize, and archive completed work'
  }
];

// Destination configurations
const DESTINATIONS = [
  {
    name: 'Claude Code Commands',
    dir: '.claude/commands',
    filePattern: (prompt) => `plan2code-${prompt.stepNumber}--${prompt.name}.md`,
    header: null // No YAML header
  },
  {
    name: 'Cursor Rules',
    dir: '.cursor/rules',
    filePattern: (prompt) => `plan2code-${prompt.stepNumber}--${prompt.name}.mdc`,
    header: (prompt) => [
      '---',
      `description: "Plan2Code Step ${prompt.stepNumber}: ${prompt.displayName} - ${prompt.description}"`,
      'alwaysApply: false',
      '---'
    ].join('\n')
  },
  {
    name: 'GitHub Copilot Prompts',
    dir: '.github/prompts',
    filePattern: (prompt) => `plan2code-${prompt.stepNumber}--${prompt.name}.prompt.md`,
    header: (prompt) => [
      '---',
      'mode: agent',
      `description: "Plan2Code Step ${prompt.stepNumber}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'GitHub Copilot Agents',
    dir: '.github/agents',
    filePattern: (prompt) => `plan2code-${prompt.stepNumber}--${prompt.name}.agent.md`,
    header: (prompt) => [
      '---',
      `description: "Plan2Code Step ${prompt.stepNumber}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Continue Prompts',
    dir: '.continue/prompts',
    filePattern: (prompt) => `plan2code-${prompt.stepNumber}--${prompt.name}.prompt.md`,
    header: (prompt) => [
      '---',
      `name: ${prompt.name}`,
      `description: "Plan2Code Step ${prompt.stepNumber}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Windsurf Workflows',
    dir: '.windsurf/workflows',
    filePattern: (prompt) => `plan2code-${prompt.stepNumber}--${prompt.name}.md`,
    header: (prompt) => [
      '---',
      `description: "Plan2Code Step ${prompt.stepNumber}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Agent Workflows',
    dir: '.agent/workflows',
    filePattern: (prompt) => `plan2code-${prompt.stepNumber}--${prompt.name}.md`,
    header: (prompt) => [
      '---',
      `description: "Plan2Code Step ${prompt.stepNumber}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  }
];

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose') || args.includes('-v');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Plan2Code Prompt Sync Utility

Usage: node sync-prompts.js [options]

Options:
  --dry-run    Show what would be changed without making changes
  --verbose    Show detailed output
  --help       Show this help message

This script syncs the source prompts from the root directory to all
destination folders with appropriate formatting for each tool/IDE.
`);
  process.exit(0);
}

// Main sync function
function syncPrompts() {
  const rootDir = __dirname;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  console.log('Plan2Code Prompt Sync Utility');
  console.log('=============================');
  if (dryRun) {
    console.log('(DRY RUN - no files will be modified)\n');
  }
  console.log('');

  // Process each source prompt
  for (const prompt of SOURCE_PROMPTS) {
    const sourcePath = path.join(rootDir, prompt.source);

    // Read source content
    let sourceContent;
    try {
      sourceContent = fs.readFileSync(sourcePath, 'utf8');
    } catch (err) {
      console.error(`ERROR: Could not read source file: ${prompt.source}`);
      console.error(`       ${err.message}`);
      totalErrors++;
      continue;
    }

    console.log(`Source: ${prompt.source}`);

    // Process each destination
    for (const dest of DESTINATIONS) {
      const destDir = path.join(rootDir, dest.dir);
      const destFile = dest.filePattern(prompt);
      const destPath = path.join(destDir, destFile);

      // Build the output content
      let outputContent;
      if (dest.header) {
        const header = dest.header(prompt);
        outputContent = header + '\n\n' + sourceContent;
      } else {
        outputContent = sourceContent;
      }

      // Ensure destination directory exists
      if (!dryRun && !fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        if (verbose) {
          console.log(`  Created directory: ${dest.dir}`);
        }
      }

      // Check if file needs updating
      let needsUpdate = true;
      let existingContent = null;

      if (fs.existsSync(destPath)) {
        try {
          existingContent = fs.readFileSync(destPath, 'utf8');
          needsUpdate = existingContent !== outputContent;
        } catch (err) {
          // File exists but can't be read, will try to write
        }
      }

      if (needsUpdate) {
        if (!dryRun) {
          try {
            fs.writeFileSync(destPath, outputContent, 'utf8');
            console.log(`  ✓ Updated: ${dest.dir}/${destFile}`);
          } catch (err) {
            console.error(`  ✗ ERROR writing: ${dest.dir}/${destFile}`);
            console.error(`    ${err.message}`);
            totalErrors++;
            continue;
          }
        } else {
          console.log(`  → Would update: ${dest.dir}/${destFile}`);
        }
        totalUpdated++;
      } else {
        if (verbose) {
          console.log(`  - Unchanged: ${dest.dir}/${destFile}`);
        }
        totalSkipped++;
      }
    }
    console.log('');
  }

  // Summary
  console.log('=============================');
  console.log('Summary:');
  console.log(`  Updated: ${totalUpdated} files`);
  console.log(`  Unchanged: ${totalSkipped} files`);
  if (totalErrors > 0) {
    console.log(`  Errors: ${totalErrors}`);
  }

  if (dryRun && totalUpdated > 0) {
    console.log('\nRun without --dry-run to apply changes.');
  }

  return totalErrors === 0 ? 0 : 1;
}

// Run the sync
process.exit(syncPrompts());
