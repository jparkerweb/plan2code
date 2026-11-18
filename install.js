#!/usr/bin/env node

/**
 * ██████╗ ██╗      █████╗ ███╗   ██╗██████╗  ██████╗ ██████╗ ██████╗ ███████╗
 * ██╔══██╗██║     ██╔══██╗████╗  ██║╚════██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝
 * ██████╔╝██║     ███████║██╔██╗ ██║ █████╔╝██║     ██║   ██║██║  ██║█████╗
 * ██╔═══╝ ██║     ██╔══██║██║╚██╗██║██╔═══╝ ██║     ██║   ██║██║  ██║██╔══╝
 * ██║     ███████╗██║  ██║██║ ╚████║███████╗╚██████╗╚██████╔╝██████╔╝███████╗
 * ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
 *
 * GLOBAL INSTALLATION SYSTEM
 *
 * DESCRIPTION:
 * Install Plan2Code skills globally or into the current project via skills.sh.
 * Builds the (gitignored) skills/ artifact from source prompts in src/.
 * Supports non-interactive --build-skills and --verify-skills maintenance hooks.
 */

/**
 * The sentence for a Node.js older than 18, or null when `version` (`process.versions.node`) is
 * new enough. Kept free of anything newer than old Node can parse, since it runs before the rest.
 */
function nodeVersionProblem(version) {
  var major = parseInt(String(version).split('.')[0], 10);
  if (major >= 18) return null;
  return 'Plan2Code needs Node.js 18 or newer; you have v' + version + '. Get it from nodejs.org';
}
var NODE_PROBLEM = nodeVersionProblem(process.versions.node);
if (NODE_PROBLEM) {
  console.error(NODE_PROBLEM);
  process.exit(1);
}

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const crypto = require('crypto');
const { execSync, execFileSync, spawn } = require('child_process');
const { pathToFileURL } = require('url');

// Load project version metadata
let projectVersion = { name: 'Plan2Code', version: 'unknown' };
try {
  const versionPath = path.join(__dirname, 'version.json');
  if (fs.existsSync(versionPath)) {
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    projectVersion = { name: versionData.name, version: versionData.version };
  }
} catch (err) {
  // Silently continue with default version if file is not found or invalid
}

// Color codes for display (ANSI escape sequences). Color only on a real terminal, and never when
// NO_COLOR is set to anything: piped output and NO_COLOR runs get empty strings, so every
// `${COLORS.X}` use prints plain text. Each stream asks for itself, as the launcher does:
// COLORS is for stdout, ERR_COLORS for console.error.
const ANSI = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',

  // Colors
  GREEN: '\x1b[32m',      // Success
  YELLOW: '\x1b[33m',     // Warning
  RED: '\x1b[31m',        // Error
  CYAN: '\x1b[36m',       // Info/Headers
  BLUE: '\x1b[34m',       // Data/Paths
  MAGENTA: '\x1b[35m',    // Special/Highlight

  // Background colors
  BG_BLACK: '\x1b[40m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_RED: '\x1b[41m',
};

/** The ANSI codes when `on`, or the same keys as empty strings. */
function colorSet(on) {
  return Object.fromEntries(Object.entries(ANSI).map(([key, code]) => [key, on ? code : '']));
}

const COLORS = colorSet(Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
const ERR_COLORS = colorSet(Boolean(process.stderr.isTTY) && !process.env.NO_COLOR);

// What a run with no terminal prints before it exits 1 (the menu needs someone to answer it).
const NO_TERMINAL_MESSAGE = 'Run this in a terminal, or use `--update` for an unattended install.';

// One mark each for done, warning and failed, the launcher's plain look. Anything else is a
// plain or dim line, and a step's name is a sentence-case heading, not a marked line.
const MARKS = {
  DONE: '✓',
  WARN: '!',
  FAIL: '✗',
};

// Every box is this wide (borders included), and a box is only drawn on a terminal at least
// BOX_MIN_COLUMNS wide; anything narrower, or piped, gets plain heading lines instead.
const BOX_WIDTH = 66;
const BOX_MIN_COLUMNS = 80;

// Plan2Code Mascot - appears during user interactions
const MASCOT = {
  // Full mascot for headers
  full: [
    '   ╭───╮   ',
    '  ╱│ ★ │╲  ',
    '   │ ◡ │   ',
    '   ╰┬─┬╯   ',
  ],
  // Mini mascot for inline use
  mini: '╱[★]╲',
  // Waving mascot for greetings
  wave: [
    '   ╭───╮   ',
    '   │ ★ │╱  ',
    '  ╱│ ◡ │   ',
    '   ╰┬─┬╯   ',
  ],
  // Thinking mascot for prompts
  thinking: [
    '   ╭───╮  ?',
    '   │ ★ │╱  ',
    '  ╱│ ~ │   ',
    '   ╰┬─┬╯   ',
  ],
};

// Generated skills directory: the gitignored Agent Skills build of src/.
// The installer and `npm run build:skills` regenerate it; `--verify-skills` diffs a stale tree.
// `skills add` consumes this directory; nothing else is platform-specific any more.
const SKILLS_DIR_NAME = 'skills';
const SKILLS_DIR = path.join(__dirname, SKILLS_DIR_NAME);

// Source prompts directory
const SRC_DIR = path.join(__dirname, 'src');

// Shared skill scripts (src/skill-scripts/). A skill lists the ones it runs in its
// `scripts` field; SHARED_SCRIPTS_ALWAYS ride along with any skill that has scripts.
const SHARED_SCRIPTS_DIR = 'skill-scripts';
const SHARED_SCRIPTS_ALWAYS = ['common.mjs'];

// The web console is built once, into skills/_console/<version>/, and installed once, into
// ~/.plan2code/console/<version>/. Each skill carries only a forwarding stub
// (src/web-console-stub/) and the markdown the agent reads by path (the card, its topic files
// and notes/).
const CONSOLE_SOURCE = 'web-console';
const CONSOLE_SHARED_DIR = '_console';
const CONSOLE_STUB_SRC = path.join(SRC_DIR, 'web-console-stub', 'console.mjs');
const CONSOLE_STUB_VERSION_TOKEN = '__PLAN2CODE_VERSION__';
// The same pattern as CONSOLE_VERSION_DIR in src/web-console/sessions.mjs, which keeps these
// folders out of Cleanup.
const CONSOLE_VERSION_DIR = /^\d+\.\d+\.\d+$/;

// ============================================================================
// SYNC PROMPTS CONFIGURATION (merged from sync-prompts.js)
// ============================================================================

// Configuration for source prompts
const SOURCE_PROMPTS = [
  {
    source: 'plan2code.md',
    stepNumber: 'dashboard',
    name: 'dashboard',
    // `bare` builds the skill name without a suffix: this one installs as
    // `plan2code`, the hub that opens the console menu for every other skill.
    bare: true,
    displayName: 'Dashboard Mode',
    description: 'Open the web console dashboard and launch any Plan2Code skill from the menu',
    scripts: ['lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-init.md',
    stepNumber: 'init',
    name: 'init',
    displayName: 'Init Mode',
    description: 'Generate AGENTS.md file for project-specific guidance',
    isUtility: true,
    scripts: ['agents-md.mjs', 'agent-files.mjs', 'test-map.mjs', 'glob.mjs', 'test-commands.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' }
    ]
  },
  {
    source: 'plan2code-init-update.md',
    stepNumber: 'update',
    name: 'init-update',
    displayName: 'Init Update Mode',
    description: 'Update existing AGENTS.md with new learnings',
    isUtility: true,
    scripts: ['agents-md.mjs', 'agent-files.mjs', 'commit-msg.mjs', 'test-map.mjs', 'glob.mjs', 'test-commands.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' }
    ]
  },
  {
    source: 'plan2code-0-pathfinder.md',
    stepNumber: '0',
    name: 'pathfinder',
    displayName: 'Pathfinder Mode',
    description: 'charting of a foggy idea as a map of decision questions, cleared one at a time',
    // ui-prototype.md rides along (with its references, shell and scripts) for the
    // offer of a UI prototype, which runs in the same conversation; every carried
    // name starts with ui-prototype so none collides with this skill's own files.
    scripts: ['ui-prototype.mjs', 'ui-prototype-round.mjs', 'ui-prototype-page.mjs', 'ui-prototype-drafts.mjs', 'ui-prototype-block.mjs', 'lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'plan2code-ui-prototype.md', target: 'ui-prototype.md' },
      { source: 'plan2code-ui-prototype-references' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-quick-task.md',
    stepNumber: 'quick',
    name: 'quick-task',
    displayName: 'Quick Task Mode',
    description: 'Lightweight planning for small tasks',
    isUtility: true,
    // review.md rides along for the web console's "Review it now" button, which
    // runs the review in the same session once the quick task is built.
    // ui-prototype.md rides along (with its references, shell and scripts) for the
    // offer of a UI prototype, which runs in the same conversation; every carried
    // name starts with ui-prototype so none collides with this skill's own files.
    scripts: ['specs.mjs', 'commit-msg.mjs', 'review-scope.mjs', 'glob.mjs', 'test-map.mjs', 'test-match.mjs', 'run-check.mjs', 'lessons.mjs', 'changes.mjs', 'ui-prototype.mjs', 'ui-prototype-round.mjs', 'ui-prototype-page.mjs', 'ui-prototype-drafts.mjs', 'ui-prototype-block.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/building-habits.md', target: 'building-habits.md' },
      { source: 'shared-references/review-in-build.md', target: 'review-in-build.md' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'plan2code-review.md', target: 'review.md' },
      { source: 'plan2code-review-references' },
      { source: 'plan2code-ui-prototype.md', target: 'ui-prototype.md' },
      { source: 'plan2code-ui-prototype-references' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-1-plan.md',
    stepNumber: 1,
    name: 'plan',
    displayName: 'Planning Mode',
    description: 'Requirements analysis and architecture design',
    // ui-prototype.md rides along (with its references, shell and scripts) for the
    // offer of a UI prototype, which runs in the same conversation; every carried
    // name starts with ui-prototype so none collides with this skill's own files.
    scripts: ['specs.mjs', 'ui-prototype.mjs', 'ui-prototype-round.mjs', 'ui-prototype-page.mjs', 'ui-prototype-drafts.mjs', 'ui-prototype-block.mjs', 'lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'plan2code-ui-prototype.md', target: 'ui-prototype.md' },
      { source: 'plan2code-ui-prototype-references' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-1b-revise-plan.md',
    stepNumber: '1b',
    name: 'revise-plan',
    displayName: 'Revision Mode',
    description: 'Modify specs mid-implementation when requirements change',
    // ui-prototype.md rides along (with its references, shell and scripts) for the
    // offer of a UI prototype, which runs in the same conversation; every carried
    // name starts with ui-prototype so none collides with this skill's own files.
    scripts: ['specs.mjs', 'ui-prototype.mjs', 'ui-prototype-round.mjs', 'ui-prototype-page.mjs', 'ui-prototype-drafts.mjs', 'ui-prototype-block.mjs', 'lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'plan2code-ui-prototype.md', target: 'ui-prototype.md' },
      { source: 'plan2code-ui-prototype-references' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-2-document.md',
    stepNumber: 2,
    name: 'document',
    displayName: 'Documentation Mode',
    description: 'Transform planning output into structured implementation docs',
    scripts: ['specs.mjs', 'lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-3-implement.md',
    stepNumber: 3,
    name: 'implement',
    displayName: 'Implementation Mode',
    description: 'Execute implementation phase by phase',
    // review.md rides along for the web console's review offer on the sign-off
    // card, which runs the review in the same session before the phase is approved.
    scripts: ['specs.mjs', 'commit-msg.mjs', 'review-scope.mjs', 'glob.mjs', 'test-map.mjs', 'test-match.mjs', 'run-check.mjs', 'lessons.mjs', 'changes.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/building-habits.md', target: 'building-habits.md' },
      { source: 'shared-references/review-in-build.md', target: 'review-in-build.md' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'plan2code-review.md', target: 'review.md' },
      { source: 'plan2code-review-references' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-3-implement-review.md',
    stepNumber: 3,
    name: 'implement-review',
    displayName: 'Implementation + Review Mode',
    description: 'Implement one phase, review it, then request sign-off',
    scripts: ['specs.mjs', 'commit-msg.mjs', 'review-scope.mjs', 'glob.mjs', 'test-map.mjs', 'test-match.mjs', 'run-check.mjs', 'lessons.mjs', 'changes.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'plan2code-3-implement.md', target: 'implement.md' },
      { source: 'shared-references/building-habits.md', target: 'building-habits.md' },
      { source: 'shared-references/review-in-build.md', target: 'review-in-build.md' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'plan2code-review.md', target: 'review.md' },
      { source: 'plan2code-review-references' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-review.md',
    stepNumber: 'review',
    name: 'review',
    displayName: 'Review Mode',
    description: 'Comprehensive post-implementation review with spec compliance checking',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use when a change, branch or spec needs an independent review for bugs, spec drift and gaps, before a commit or pull request. Run it as /plan2code-review.",
    isUtility: true,
    scripts: ['specs.mjs', 'commit-msg.mjs', 'review-scope.mjs', 'lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/review-in-build.md', target: 'review-in-build.md' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-4-finalize.md',
    stepNumber: 4,
    name: 'finalize',
    displayName: 'Finalization Mode',
    description: 'Validate, summarize, and archive completed work',
    // review.md rides along for Step 2.5's final review, which runs in the
    // same session before the summary is written and the spec is archived.
    scripts: ['specs.mjs', 'commit-msg.mjs', 'review-scope.mjs', 'glob.mjs', 'test-map.mjs', 'test-match.mjs', 'run-check.mjs', 'lessons.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'shared-references/review-in-build.md', target: 'review-in-build.md' },
      { source: 'plan2code-review.md', target: 'review.md' },
      { source: 'plan2code-review-references' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-handoff.md',
    stepNumber: 'handoff',
    name: 'handoff',
    displayName: 'Handoff Mode',
    description: 'Compact the conversation into a self-contained handoff document for a fresh session',
    isUtility: true,
    scripts: ['specs.mjs'],
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-xray.md',
    stepNumber: 'xray',
    name: 'xray',
    displayName: 'X-ray Mode',
    description: 'Explain how and why an area of the code works, or find the rough spots worth fixing',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use when you want to understand how and why an area of the code works, or find its rough spots worth fixing. Run it as /plan2code-xray.",
    isUtility: true,
    scripts: ['lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-diagnose.md',
    stepNumber: 'diagnose',
    name: 'diagnose',
    displayName: 'Diagnose Mode',
    description: 'Find and write up a bug\'s cause without fixing it',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use when a bug's cause is unknown and you want it found and written up without a fix. Run it as /plan2code-diagnose.",
    isUtility: true,
    scripts: ['specs.mjs', 'lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/building-habits.md', target: 'building-habits.md' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-pr-prep.md',
    stepNumber: 'pr-prep',
    name: 'pr-prep',
    displayName: 'PR Prep Mode',
    description: 'Pick and run the checks a branch needs, give a readiness verdict and write the PR description',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use when a branch is nearly done and you want its checks run, a readiness verdict and a pull-request description. Run it as /plan2code-pr-prep.",
    isUtility: true,
    scripts: ['review-scope.mjs', 'glob.mjs', 'test-map.mjs', 'test-match.mjs', 'test-commands.mjs', 'run-check.mjs', 'lessons.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-test.md',
    stepNumber: 'test',
    name: 'test',
    displayName: 'Test Mode',
    description: 'Find untested code and write unit and integration tests in the project\'s own style',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use when code has no tests or weak ones and you want unit and integration tests written in the project's own style. Run it as /plan2code-test.",
    isUtility: true,
    scripts: ['review-scope.mjs', 'glob.mjs', 'test-map.mjs', 'test-match.mjs', 'test-commands.mjs', 'run-check.mjs', 'lessons.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'shared-references/building-habits.md', target: 'building-habits.md' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-dead-code.md',
    stepNumber: 'dead-code',
    name: 'dead-code',
    displayName: 'Dead Code Mode',
    description: 'Find unused code and dead code, show how safe each is to remove, and remove only what you pick',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use when you want unused code paths and dead code in your project found, labeled by how safe each is to remove, and removed only where you pick. Run it as /plan2code-dead-code.",
    isUtility: true,
    // review.md rides along for Step 7.5's final review of the removals, which
    // runs in the same session, as Finalize's Step 2.5 does, with the scripts
    // review.md names.
    scripts: ['test-map.mjs', 'glob.mjs', 'test-commands.mjs', 'run-check.mjs', 'specs.mjs', 'commit-msg.mjs', 'review-scope.mjs', 'lessons.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'plan2code-dead-code-references/caller-search.md', target: 'caller-search.md' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' },
      { source: 'shared-references/test-runs.md', target: 'test-runs.md' },
      { source: 'shared-references/review-in-build.md', target: 'review-in-build.md' },
      { source: 'plan2code-review.md', target: 'review.md' },
      { source: 'plan2code-review-references' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-deps.md',
    stepNumber: 'deps',
    name: 'deps',
    displayName: 'Update Dependencies Mode',
    description: 'Find outdated dependencies, label how safe each update is, and apply only what you pick with your checks run after each batch',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use when you want your project's outdated dependencies found, labeled by how safe each update is, and applied only where you pick, with your checks run and anything that breaks put back. Run it as /plan2code-deps.",
    isUtility: true,
    // deps.mjs comes from src/plan2code-deps-scripts/; these are the shared ones it runs.
    scripts: ['test-map.mjs', 'glob.mjs', 'test-commands.mjs', 'run-check.mjs'],
    // helper-strength.md for the assess step's helpers (light, medium).
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/helper-strength.md', target: 'helper-strength.md' }
    ]
  },
  {
    source: 'plan2code-ui-prototype.md',
    stepNumber: 'ui-prototype',
    name: 'ui-prototype',
    displayName: 'UI Prototype Mode',
    description: 'Draw several versions of a screen or flow on one page, tune them with live dials, and bring the choice back',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use when you want to see several versions of a screen or flow, tune them with live dials and bring your choice back. Run it as /plan2code-ui-prototype.",
    isUtility: true,
    scripts: ['ui-prototype.mjs', 'ui-prototype-round.mjs', 'ui-prototype-page.mjs', 'ui-prototype-drafts.mjs', 'ui-prototype-block.mjs', 'lessons.mjs', 'glob.mjs', 'test-map.mjs'],
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'shared-references/lessons.md', target: 'lessons.md' }
    ]
  },
  {
    source: 'plan2code-changelog.md',
    stepNumber: 'changelog',
    name: 'changelog',
    displayName: 'Changelog Mode',
    description: 'Check the CHANGELOG version against the default branch, suggest entries for new work, keep package.json aligned',
    // Shown to the agent in place of the generic header text: when the skill fits and its command.
    skillDescription: "Use before a pull request when CHANGELOG.md needs its version checked against the default branch and entries for the new work. Run it as /plan2code-changelog.",
    isUtility: true,
    scripts: [],
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-git.md',
    stepNumber: 'git',
    name: 'git',
    displayName: 'Git Mode',
    description: 'Branches, pull, push and commits on one board that stays open while you work',
    isUtility: true,
    scripts: ['commit-msg.mjs'],
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  }
];

// Helper function to generate destination filename based on stepNumber
function generateFilename(prompt, extension = '.md') {
  // `bare` is for the dashboard: `plan2code`, no suffix — it is the hub the
  // numbered and utility skills hang off, not a step among them.
  if (prompt.bare) return `plan2code${extension}`;
  if (prompt.isUtility || prompt.stepNumber === 0 || prompt.stepNumber === 'init') {
    return `plan2code-${prompt.name}${extension}`;
  }
  return `plan2code-${prompt.stepNumber}-${prompt.name}${extension}`;
}

// Helper function to generate skill name (normalizes double hyphens to single)
function generateSkillName(prompt) {
  return generateFilename(prompt, '').replace(/--+/g, '-');
}

// Helper function to generate step label for descriptions
function generateStepLabel(prompt) {
  if (prompt.bare) return 'Dashboard';
  if (prompt.stepNumber === 'init') return 'Init';
  if (prompt.stepNumber === 'update') return 'Update';
  if (prompt.stepNumber === 'review') return 'Review';
  if (prompt.stepNumber === 'handoff') return 'Handoff';
  if (prompt.stepNumber === 'git') return 'Git';
  if (prompt.stepNumber === 'xray') return 'X-ray';
  if (prompt.stepNumber === 'diagnose') return 'Diagnose';
  if (prompt.stepNumber === 'pr-prep') return 'PR Prep';
  if (prompt.stepNumber === 'test') return 'Test';
  if (prompt.stepNumber === 'dead-code') return 'Dead Code';
  if (prompt.stepNumber === 'deps') return 'Update Dependencies';
  if (prompt.stepNumber === 'ui-prototype') return 'UI Prototype';
  if (prompt.stepNumber === 'changelog') return 'Changelog';
  if (prompt.stepNumber === 'quick') return 'Quick Task';
  return `Step ${prompt.stepNumber}`;
}

// Helper function to generate YAML frontmatter for SKILL.md files
function generateSkillHeader(prompt, disableModelInvocation = false) {
  const lines = [
    '---',
    `name: ${generateSkillName(prompt)}`,
    `description: "Plan2Code ${generateStepLabel(prompt)}: ${prompt.skillDescription ? `${prompt.skillDescription} User-initiated only; do not invoke autonomously.` : `${prompt.displayName} - user-initiated workflow step. Do not invoke autonomously.`}"`,
  ];
  if (disableModelInvocation) lines.push('disable-model-invocation: true');
  lines.push('---');
  return lines.join('\n');
}


// Helper function to get VS Code Copilot prompts directory based on platform
function getVSCodeCopilotDir() {
  const platform = process.platform;
  if (platform === 'win32') {
    // Windows: %APPDATA%\Code\User\prompts
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Code', 'User', 'prompts');
  } else if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/Code/User/prompts
    return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'prompts');
  } else {
    // Linux: ~/.config/Code/User/prompts
    return path.join(os.homedir(), '.config', 'Code', 'User', 'prompts');
  }
}

// Helper function to get Crush skills directory based on platform
function getCrushSkillsDir() {
  const homedir = os.homedir();
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    return path.join(localAppData, 'crush', 'skills');
  }
  return path.join(homedir, '.config', 'crush', 'skills');
}

// Helper function to pad strings with ANSI codes correctly
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function padEndVisible(str, length, char = ' ') {
  const visibleLength = stripAnsi(str).length;
  const paddingNeeded = Math.max(0, length - visibleLength);
  return str + char.repeat(paddingNeeded);
}

// Legacy install paths — directories that pre-2.2 installs wrote Plan2Code files into.
// 2.2.0 delegates all distribution to the `skills` CLI, so these are cleanup-only: install and
// uninstall both sweep them so files from earlier versions don't linger and shadow the new
// skills. Do NOT add entries here as install targets; the `skills` CLI owns installation.
//
// `dir` is either a path relative to the home directory or a function returning an absolute path.
// `type: 'skill'` entries are directories (removed recursively); the rest are flat files.
const LEGACY_PATHS = [
  // Claude Code — pre-v2 slash commands
  { name: 'Claude Code commands', dir: '.claude/commands', filePattern: /^plan2code-.*\.md$/ },
  // Copilot CLI agents
  { name: 'Copilot CLI agents', dir: '.copilot/agents', filePattern: /^plan2code-.*\.md$/ },
  // Cursor slash commands
  { name: 'Cursor commands', dir: '.cursor/commands', filePattern: /^plan2code-.*\.md$/ },
  // Continue prompts
  { name: 'Continue prompts', dir: '.continue/prompts', filePattern: /^plan2code-.*\.prompt\.md$/ },
  // Windsurf global workflows
  { name: 'Windsurf workflows', dir: '.codeium/windsurf/global_workflows', filePattern: /^plan2code-.*\.md$/ },
  // Codeium (IntelliJ) global workflows
  { name: 'Codeium workflows', dir: '.codeium/global_workflows', filePattern: /^plan2code-.*\.md$/ },
  // Pi prompts
  { name: 'Pi prompts', dir: '.pi/agent/prompts', filePattern: /^plan2code-.*\.md$/ },
  // Gemini CLI — removed as a target in v2.0.0, still cleaned up
  { name: 'Gemini CLI commands', dir: '.gemini/commands', filePattern: /^plan2code-.*\.toml$/ },
  // VS Code Copilot prompts (platform-specific location)
  { name: 'VS Code Copilot prompts', dir: getVSCodeCopilotDir, filePattern: /^plan2code-.*\.prompt\.md$/ },
  // Skill directories that pre-2.2 installs wrote as real copies. The skills CLI owns these
  // paths now (~/.agents/skills is its store; the rest are links into it), but it won't
  // recognize hand-copied directories from an earlier version, so sweep them too. Safe to run
  // before `skills add`, which recreates whatever it needs.
  { name: 'Crush skills', dir: getCrushSkillsDir, filePattern: /^plan2code-/, type: 'skill' },
  { name: 'Claude Code skills', dir: '.claude/skills', filePattern: /^plan2code-/, type: 'skill' },
  { name: 'Agent skills store', dir: '.agents/skills', filePattern: /^plan2code-/, type: 'skill' },
];

// Reference directories that flat-file targets received as siblings (e.g. plan2code-review-references/).
const LEGACY_REFERENCE_DIR = /^plan2code-.*-references$/;

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

/**
 * Display mascot with optional message
 */
function displayMascot(variant = 'full', message = '') {
  const mascotLines = MASCOT[variant] || MASCOT.full;
  console.log('');
  mascotLines.forEach(line => {
    console.log(`${COLORS.MAGENTA}${line}${COLORS.RESET}`);
  });
  if (message) {
    console.log(`${COLORS.CYAN}${message}${COLORS.RESET}`);
  }
  console.log('');
}

/** Whether boxes fit: a terminal at least BOX_MIN_COLUMNS wide. Piped output never gets one. */
function boxesFit(stream = process.stdout) {
  return Boolean(stream.isTTY) && (stream.columns || 0) >= BOX_MIN_COLUMNS;
}

/**
 * The one box printer. `lines` are the rows inside it (they may carry colors); on a terminal at
 * least BOX_MIN_COLUMNS wide they are drawn in a BOX_WIDTH box, and anywhere else printed as
 * plain lines, so a narrow terminal or a piped run never shows a broken border.
 */
function printBox(lines, { color = COLORS.CYAN, fit = boxesFit() } = {}) {
  if (!fit) {
    for (const line of lines) console.log(line);
    return;
  }
  const inner = BOX_WIDTH - 4;
  console.log(`${color}╭${'─'.repeat(BOX_WIDTH - 2)}╮${COLORS.RESET}`);
  for (const line of lines) {
    console.log(`${color}│${COLORS.RESET} ${padEndVisible(line, inner)} ${color}│${COLORS.RESET}`);
  }
  console.log(`${color}╰${'─'.repeat(BOX_WIDTH - 2)}╯${COLORS.RESET}`);
}

/**
 * The welcome header: Planny waving, as MASCOT.wave draws him, with the greeting beside him.
 */
function displayHeader() {
  const beside = {
    1: `${COLORS.BRIGHT}Hi! I'm Planny.${COLORS.RESET}`,
    2: 'Welcome to Plan2Code.',
    3: `${COLORS.DIM}https://github.com/jparkerweb/plan2code${COLORS.RESET}`,
  };
  console.log('');
  printBox(MASCOT.wave.map((row, i) => `${COLORS.MAGENTA}${row}${COLORS.RESET}${beside[i] ? ` ${beside[i]}` : ''}`));
  console.log('');
}

/**
 * A section heading in sentence case: boxed when boxes fit, one bright line otherwise.
 * `subtitle` is an optional dim line under it.
 */
function displaySectionHeader(title, subtitle = '') {
  console.log('');
  if (boxesFit()) {
    printBox([`${COLORS.BRIGHT}${title}${COLORS.RESET}`, ...(subtitle ? [`${COLORS.DIM}${subtitle}${COLORS.RESET}`] : [])]);
  } else {
    console.log(`${COLORS.CYAN}${COLORS.BRIGHT}${title}${COLORS.RESET}`);
    if (subtitle) console.log(`${COLORS.DIM}${subtitle}${COLORS.RESET}`);
  }
  console.log('');
}

/**
 * A titled list of lines: a bright title, then the lines indented. Never boxed, so a long path
 * in a line cannot break a border.
 */
function displayStatusBox(title, lines) {
  console.log(`${COLORS.BRIGHT}${title}${COLORS.RESET}`);
  for (const line of lines) console.log(line ? `  ${line}` : '');
}

/**
 * Display progress indicator
 */
function displayProgress(current, total, label) {
  const barLength = 30;
  const filled = Math.floor((current / total) * barLength);
  const empty = barLength - filled;
  const percent = Math.floor((current / total) * 100);

  const bar = `${COLORS.GREEN}${'█'.repeat(filled)}${COLORS.DIM}${'░'.repeat(empty)}${COLORS.RESET}`;
  process.stdout.write(`\r${COLORS.CYAN}[${bar}${COLORS.CYAN}]${COLORS.RESET} ${percent}% ${label}`);
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * A spinner with an elapsed-seconds count for a step that runs asynchronously. On a terminal it
 * redraws one line on a timer until `stop()`; anywhere else it prints `label` once, as a plain
 * line, and stays silent. `stop()` clears the line it drew.
 */
function createSpinner(label, { stream = process.stdout, intervalMs = 100 } = {}) {
  const started = Date.now();
  let timer = null;
  let frame = 0;
  const draw = () => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    stream.write(`\r  ${COLORS.CYAN}${SPINNER_FRAMES[frame++ % SPINNER_FRAMES.length]}${COLORS.RESET} ${label} ${COLORS.DIM}${seconds}s${COLORS.RESET}\x1b[K`);
  };
  return {
    start() {
      if (!stream.isTTY) {
        console.log(`  ${label}`);
        return this;
      }
      draw();
      timer = setInterval(draw, intervalMs);
      return this;
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      stream.write('\r\x1b[K');
    },
  };
}

// ============================================================================
// SYNC PROMPTS FUNCTIONS
// ============================================================================

/**
 * Helper function to recursively delete directories
 */
function deleteDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.error(`  ${ERR_COLORS.RED}${MARKS.FAIL}${ERR_COLORS.RESET} Could not delete directory ${dirPath}: ${err.message}`);
  }
}

// ============================================================================
// SKILLS BUILD (src/ -> skills/)
// ============================================================================

function listFilesRecursive(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const rel = prefix ? path.join(prefix, entry) : entry;
    if (fs.statSync(abs).isDirectory()) out.push(...listFilesRecursive(abs, rel));
    else out.push(rel);
  }
  return out;
}

/**
 * The web console's files, split two ways. `local` is what each skill carries: the forwarding
 * stub (with the version baked in) and the markdown the agent reads by path. `shared` is the
 * whole console plus its version.txt and version.json, built once under
 * skills/_console/<version>/. Both map a path (relative to its folder) to a Buffer.
 */
function loadConsoleFiles(errors) {
  const local = new Map();
  const shared = new Map();
  const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8')).version;
  const source = path.join(SRC_DIR, CONSOLE_SOURCE);
  try {
    for (const relPath of listFilesRecursive(source)) {
      const key = relPath.split(path.sep).join('/');
      const bytes = fs.readFileSync(path.join(source, relPath));
      shared.set(key, bytes);
      if (key.endsWith('.md') && !key.startsWith('public/')) local.set(key, bytes);
    }
    const stub = fs.readFileSync(CONSOLE_STUB_SRC, 'utf8');
    if (!stub.includes(CONSOLE_STUB_VERSION_TOKEN)) throw new Error(`no ${CONSOLE_STUB_VERSION_TOKEN} to bake the version into`);
    local.set('console.mjs', Buffer.from(stub.replace(CONSOLE_STUB_VERSION_TOKEN, version)));
  } catch (err) {
    errors.push(`Could not read the web console sources: ${err.message}`);
  }
  shared.set('version.txt', Buffer.from(`${version}\n`));
  shared.set('version.json', fs.readFileSync(path.join(__dirname, 'version.json')));
  return { local, shared, version };
}

function computeExpectedSkills() {
  const expected = new Map();
  const errors = [];
  const consoleFiles = loadConsoleFiles(errors);

  for (const prompt of SOURCE_PROMPTS) {
    const sourcePath = path.join(SRC_DIR, prompt.source);
    let sourceContent;
    try {
      sourceContent = fs.readFileSync(sourcePath, 'utf8');
    } catch (err) {
      errors.push(`Could not read src/${prompt.source}: ${err.message}`);
      continue;
    }

    const skillName = generateSkillName(prompt);
    // disable-model-invocation is always set: these are user-initiated workflow steps, and
    // one SKILL.md now serves every agent, so the strictest setting is the correct one.
    const skillContent = generateSkillHeader(prompt, true) + '\n\n' + sourceContent;
    // Buffers, not utf8 strings: reference dirs can hold binary files (the
    // console's chime mp3s), and a utf8 round-trip would mangle them.
    expected.set(`${SKILLS_DIR_NAME}/${skillName}/SKILL.md`, Buffer.from(skillContent));

    const srcRefDir = path.join(SRC_DIR, prompt.source.replace(/\.md$/, '-references'));
    if (fs.existsSync(srcRefDir)) {
      for (const relPath of listFilesRecursive(srcRefDir)) {
        const absPath = path.join(srcRefDir, relPath);
        expected.set(
          `${SKILLS_DIR_NAME}/${skillName}/references/${relPath.split(path.sep).join('/')}`,
          fs.readFileSync(absPath)
        );
      }
    }

    for (const reference of prompt.additionalReferences || []) {
      const absSource = path.join(SRC_DIR, reference.source);
      if (reference.source === CONSOLE_SOURCE) {
        for (const [relPath, bytes] of consoleFiles.local) {
          expected.set(`${SKILLS_DIR_NAME}/${skillName}/references/${reference.target}/${relPath}`, bytes);
        }
        continue;
      }
      try {
        if (fs.statSync(absSource).isDirectory()) {
          for (const relPath of listFilesRecursive(absSource)) {
            const targetPath = reference.target ? path.join(reference.target, relPath) : relPath;
            expected.set(
              `${SKILLS_DIR_NAME}/${skillName}/references/${targetPath.split(path.sep).join('/')}`,
              fs.readFileSync(path.join(absSource, relPath))
            );
          }
        } else {
          expected.set(
            `${SKILLS_DIR_NAME}/${skillName}/references/${reference.target}`,
            fs.readFileSync(absSource)
          );
        }
      } catch (err) {
        errors.push(`Could not include src/${reference.source} for ${skillName}: ${err.message}`);
      }
    }

    // Scripts land flat in skills/<skill>/scripts/, beside the SKILL.md that runs them:
    // the skill's own src/<source>-scripts/ plus the shared ones it names in `scripts`
    // from src/skill-scripts/. Skills install independently, so shared code is copied
    // into each skill rather than referenced across skill directories.
    const scripts = new Map();
    const ownScriptsDir = path.join(SRC_DIR, prompt.source.replace(/\.md$/, '-scripts'));
    const sharedNames = prompt.scripts || [];
    if (sharedNames.length || fs.existsSync(ownScriptsDir)) {
      for (const name of [...SHARED_SCRIPTS_ALWAYS, ...sharedNames]) {
        const abs = path.join(SRC_DIR, SHARED_SCRIPTS_DIR, name);
        if (!fs.existsSync(abs)) {
          errors.push(`src/${SHARED_SCRIPTS_DIR}/${name} (named by ${skillName}) does not exist`);
          continue;
        }
        scripts.set(name, fs.readFileSync(abs));
      }
      if (fs.existsSync(ownScriptsDir)) {
        for (const relPath of listFilesRecursive(ownScriptsDir)) {
          const name = relPath.split(path.sep).join('/');
          if (scripts.has(name) || name === 'version.json') {
            errors.push(`src/${path.basename(ownScriptsDir)}/${name} collides with a ${name === 'version.json' ? 'generated file' : 'shared script'} of the same name`);
            continue;
          }
          scripts.set(name, fs.readFileSync(path.join(ownScriptsDir, relPath)));
        }
      }
      // The version the scripts report (the finalize feedback payload needs it, and an
      // installed skill has no repo version.json to read).
      scripts.set('version.json', fs.readFileSync(path.join(__dirname, 'version.json')));
    }
    for (const [name, content] of scripts) {
      expected.set(`${SKILLS_DIR_NAME}/${skillName}/scripts/${name}`, content);
    }
  }

  for (const [relPath, bytes] of consoleFiles.shared) {
    expected.set(`${SKILLS_DIR_NAME}/${CONSOLE_SHARED_DIR}/${consoleFiles.version}/${relPath}`, bytes);
  }

  return { expected, errors };
}

/**
 * Remove empty directories below `dir` (never `dir` itself), deepest first.
 */
function removeEmptyDirs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = path.join(dir, entry.name);
    removeEmptyDirs(sub);
    if (fs.readdirSync(sub).length === 0) fs.rmdirSync(sub);
  }
}

function buildSkills(quiet = false) {
  const { expected, errors } = computeExpectedSkills();
  const stats = { written: 0, unchanged: 0, pruned: 0, errors: errors.length };
  for (const message of errors) console.error(`  ${ERR_COLORS.RED}${MARKS.FAIL}${ERR_COLORS.RESET} ${message}`);
  if (!quiet) console.log(`${COLORS.BRIGHT}Building skills${COLORS.RESET} ${COLORS.DIM}src/ -> ${SKILLS_DIR_NAME}/${COLORS.RESET}\n`);

  const expectedSkillNames = new Set(SOURCE_PROMPTS.map(generateSkillName));
  if (fs.existsSync(SKILLS_DIR)) {
    for (const entry of fs.readdirSync(SKILLS_DIR)) {
      const entryPath = path.join(SKILLS_DIR, entry);
      if (!fs.statSync(entryPath).isDirectory() || expectedSkillNames.has(entry) || entry === CONSOLE_SHARED_DIR) continue;
      deleteDirectory(entryPath);
      stats.pruned++;
      if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Pruned: ${entry}/`);
    }
  }

  // The shared console is swept like a skill folder: an older version's files are not expected.
  for (const skillName of [...expectedSkillNames, CONSOLE_SHARED_DIR]) {
    const skillDir = path.join(SKILLS_DIR, skillName);
    if (!fs.existsSync(skillDir)) continue;
    for (const relPath of listFilesRecursive(skillDir)) {
      const key = `${SKILLS_DIR_NAME}/${skillName}/${relPath.split(path.sep).join('/')}`;
      if (expected.has(key)) continue;
      fs.rmSync(path.join(skillDir, relPath), { force: true });
      stats.pruned++;
      if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Pruned: ${key}`);
    }
    // A folder the build no longer fills (a skill that lost all its scripts) goes too.
    removeEmptyDirs(skillDir);
  }

  for (const [relPath, content] of expected) {
    const absPath = path.join(__dirname, relPath.split('/').join(path.sep));
    let current = null;
    if (fs.existsSync(absPath)) {
      try {
        current = fs.readFileSync(absPath);
      } catch (err) {
        // Unreadable — fall through and overwrite
      }
    }

    if (current && current.equals(content)) {
      stats.unchanged++;
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content);
      stats.written++;
      if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} ${relPath}`);
    } catch (err) {
      console.error(`  ${ERR_COLORS.RED}${MARKS.FAIL}${ERR_COLORS.RESET} ${relPath}: ${err.message}`);
      stats.errors++;
    }
  }

  if (!quiet) {
    console.log(`\n  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} ${SOURCE_PROMPTS.length} skill(s): ${stats.written} written, ${stats.unchanged} unchanged, ${stats.pruned} pruned`);
    if (stats.errors > 0) console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} ${stats.errors} error(s)`);
    console.log('');
  }
  return stats.errors === 0;
}

function verifySkillsSync() {
  const { expected, errors } = computeExpectedSkills();
  const problems = [...errors];
  for (const [relPath, content] of expected) {
    const absPath = path.join(__dirname, relPath.split('/').join(path.sep));
    if (!fs.existsSync(absPath)) {
      problems.push(`missing: ${relPath}`);
      continue;
    }
    if (!fs.readFileSync(absPath).equals(content)) {
      problems.push(`out of date: ${relPath}`);
    }
  }
  if (fs.existsSync(SKILLS_DIR)) {
    for (const relPath of listFilesRecursive(SKILLS_DIR)) {
      const key = `${SKILLS_DIR_NAME}/${relPath.split(path.sep).join('/')}`;
      if (!expected.has(key)) problems.push(`unexpected: ${key}`);
    }
  }
  if (problems.length > 0) {
    console.error(`${SKILLS_DIR_NAME}/ is out of sync with src/:\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`\n${problems.length} problem(s). Run 'npm run build:skills' to regenerate it.`);
    return false;
  }
  console.log(`${SKILLS_DIR_NAME}/ matches src/ — ${expected.size} file(s) across ${SOURCE_PROMPTS.length} skill(s) ✓`);
  return true;
}

/**
 * The folder the shared console lives in: ~/.plan2code/console, or PLAN2CODE_CONSOLE_HOME (the
 * console's own override, which the tests use). Read when called, never at load.
 */
function consoleHomeDir() {
  return process.env.PLAN2CODE_CONSOLE_HOME || path.join(os.homedir(), '.plan2code', 'console');
}

/**
 * Put the console built under skills/_console/<version>/ at <console home>/<version>/, point
 * console-dir at it, and remove every other version folder. Nothing else in the console home is
 * touched: sessions/, looks.json, console-dir's siblings and any other kept entry stay as they
 * are. Returns true on success, false after saying why not. `sweep: false` keeps the old version
 * folders for now: an install calls sweepOldConsoles() once `skills add` has worked, so a failed
 * update leaves the old stubs, which name the old version, still able to find their console.
 */
function installSharedConsole({ quiet = false, source: builtFrom, sweep = true } = {}) {
  const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8')).version;
  const source = builtFrom || path.join(SKILLS_DIR, CONSOLE_SHARED_DIR, version);
  const home = consoleHomeDir();
  const dest = path.join(home, version);
  try {
    if (!fs.existsSync(path.join(source, 'console.mjs'))) throw new Error(`${source} is not built`);
    fs.mkdirSync(home, { recursive: true });
    // A server still running from this folder holds files open on Windows: the copy below
    // overwrites them in place when the removal cannot.
    try { fs.rmSync(dest, { recursive: true, force: true }); } catch (err) { /* overwritten below */ }
    fs.cpSync(source, dest, { recursive: true, force: true });
    fs.writeFileSync(path.join(home, 'console-dir'), `${dest}\n`);
  } catch (err) {
    console.error(`  ${ERR_COLORS.RED}${MARKS.FAIL}${ERR_COLORS.RESET} Could not install the shared console into ${home}: ${err.message}`);
    return false;
  }
  if (sweep) sweepOldConsoles({ quiet, version });
  if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Shared console ${version} installed in ${dest}`);
  return true;
}

/** Remove every console version folder but the current one. */
function sweepOldConsoles({ quiet = false, version } = {}) {
  version = version || JSON.parse(fs.readFileSync(path.join(__dirname, "version.json"), "utf8")).version;
  const home = consoleHomeDir();
  let entries = [];
  try { entries = fs.readdirSync(home, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === version || !CONSOLE_VERSION_DIR.test(entry.name)) continue;
    try {
      fs.rmSync(path.join(home, entry.name), { recursive: true, force: true });
      if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed old console ${entry.name}`);
    } catch (err) {
      // An old console still running keeps its folder; the next update removes it.
      if (!quiet) console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} Kept old console ${entry.name}: ${err.message}`);
    }
  }
}

function cleanLegacyPaths(quiet = false) {
  const stats = { removed: 0, errors: 0 };
  for (const legacy of LEGACY_PATHS) {
    const dir = typeof legacy.dir === 'function' ? legacy.dir() : path.join(os.homedir(), legacy.dir);
    if (!fs.existsSync(dir)) continue;
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      const isMatch = legacy.filePattern.test(entry);
      const isReferenceDir = LEGACY_REFERENCE_DIR.test(entry);
      if (!isMatch && !isReferenceDir) continue;
      try {
        const entryPath = path.join(dir, entry);
        if (isReferenceDir || legacy.type === 'skill' || fs.statSync(entryPath).isDirectory()) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(entryPath);
        }
        stats.removed++;
        if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} ${legacy.name}: removed ${entry}`);
      } catch (err) {
        stats.errors++;
        if (!quiet) console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} ${legacy.name}: could not remove ${entry} — ${err.message}`);
      }
    }
  }
  return stats;
}

// ============================================================================
// SKILLS CLI DELEGATION
// ============================================================================

// The skills CLI runs pinned to one exact version, so a new release of it can never change an install
// between two runs of the same Plan2Code. Checked against npm on 2026-11-08 (latest was 1.7.6); raise it
// on purpose, after trying an install, never by switching back to an unpinned `npx skills`.
const SKILLS_CLI_VERSION = '1.7.6';
const SKILLS_CLI = `npx --yes skills@${SKILLS_CLI_VERSION}`;
const BENIGN_SKILLS_FAILURE = /does not support (global|project) skill installation/i;

function execSkillsCli(args) {
  const options = {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_loglevel: 'error' },
  };
  try {
    return { ok: true, output: String(execSync(`${SKILLS_CLI} ${args}`, options)).trim() };
  } catch (err) {
    return { ok: false, output: `${err.stdout || ''}\n${err.stderr || ''}`.trim() };
  }
}

function runSkillsCli(args) {
  const result = execSkillsCli(args);
  return result.ok ? result.output : null;
}

/**
 * `execSkillsCli` without blocking: the CLI runs through `spawn`, so a spinner can tick while it
 * works. Resolves to the same `{ ok, output }` shape: the trimmed stdout on success, stdout and
 * stderr together on a failure.
 */
function execSkillsCliAsync(args) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(`${SKILLS_CLI} ${args}`, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, npm_config_loglevel: 'error' },
        windowsHide: true,
      });
    } catch (err) {
      resolve({ ok: false, output: err.message });
      return;
    }
    child.stdin.end();
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (err) => resolve({ ok: false, output: `${stdout}\n${stderr || err.message}`.trim() }));
    child.on('close', (code) => {
      resolve(code === 0 ? { ok: true, output: stdout.trim() } : { ok: false, output: `${stdout}\n${stderr}`.trim() });
    });
  });
}

/** Run `skills add` with a spinner and elapsed seconds while it works (one plain line when piped). */
async function addSkillsWithSpinner(args, label) {
  const spinner = createSpinner(label).start();
  try {
    return await execSkillsCliAsync(args);
  } finally {
    spinner.stop();
  }
}

function skillNameArgs() {
  return `-s ${SOURCE_PROMPTS.map(generateSkillName).join(' ')}`;
}

function extractSkillsFailures(output) {
  const failures = [];
  for (const rawLine of stripAnsi(output).split('\n')) {
    if (!rawLine.includes('✗')) continue;
    const message = rawLine.slice(rawLine.indexOf('✗') + 1).trim();
    if (message && !BENIGN_SKILLS_FAILURE.test(message)) failures.push(message);
  }
  return failures;
}

function reportSkillsOutput(result) {
  if (!result.ok) {
    console.log(`\n${stripAnsi(result.output)}`);
    return;
  }
  for (const failure of extractSkillsFailures(result.output)) {
    console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} ${failure}`);
  }
}

function ensureSkillsCli() {
  const version = runSkillsCli('--version');
  if (version !== null) {
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} skills CLI ${COLORS.DIM}${version.split('\n').pop()}${COLORS.RESET}`);
    return true;
  }
  console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Could not run the ${COLORS.BRIGHT}skills${COLORS.RESET} CLI.`);
  console.log(`\n  ${COLORS.DIM}Plan2Code installs through skills.sh, which needs Node 18+ and network access.${COLORS.RESET}`);
  console.log(`  ${COLORS.DIM}Check that this works, then re-run the installer:${COLORS.RESET}`);
  console.log(`    ${COLORS.CYAN}${SKILLS_CLI} --version${COLORS.RESET}\n`);
  return false;
}

/**
 * List installed Plan2Code skill names for a scope ('global' or 'project').
 *
 * Reads the skills CLI's canonical store directory directly instead of running `skills list`.
 * The list command cross-references every installed skill against every agent directory it
 * can find — an O(skills × agents) scan that takes over a minute on Windows. The store is
 * just a directory of skill folders, so a readdir answers the same question instantly.
 */
function listInstalledSkills(scope) {
  const store = path.join(scope === 'global' ? os.homedir() : process.cwd(), '.agents', 'skills');
  let entries;
  try {
    entries = fs.readdirSync(store);
  } catch (err) {
    return [];
  }
  return entries.filter(name =>
    (name === 'plan2code' || name.startsWith('plan2code-')) && fs.existsSync(path.join(store, name, 'SKILL.md'))
  );
}

/**
 * Remove every installed Plan2Code skill for a scope. Returns the number removed, or -1 when
 * the skills CLI call fails.
 */
function removeInstalledSkills(scope, { quiet = false } = {}) {
  const installed = listInstalledSkills(scope);
  if (installed.length === 0) {
    if (!quiet) console.log(`  ${COLORS.DIM}No Plan2Code skills currently installed${COLORS.RESET}`);
    return 0;
  }

  // `skills remove` is variadic and silently skips names that aren't installed, so one call
  // clears the store and unlinks every agent. Passing the full build list alongside what was
  // found also sweeps stray copies an earlier version left outside the store.
  const names = [...new Set([...installed, ...SOURCE_PROMPTS.map(generateSkillName)])];
  const scopeFlag = scope === 'global' ? '-g ' : '';
  if (runSkillsCli(`remove ${names.join(' ')} ${scopeFlag}-y`) === null) {
    if (!quiet) console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Could not remove installed skills`);
    return -1;
  }
  for (const name of installed) {
    if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${name}`);
  }
  return installed.length;
}

// ============================================================================
// INSTALLATION
// ============================================================================

/**
 * Execute installation. `unattended` (plan2code update) asks nothing and skips the getting-started
 * steps; `outcome` receives `skills` and `launcher` as true or false for update's per-piece report.
 */
async function install({ unattended = false, outcome = {} } = {}) {
  // An unattended install (plan2code update) is compact: no heading box, no summary table, no
  // mascot and no closing banner. update() prints the one summary, and shows what is printed
  // here only when a step goes wrong.
  if (!unattended) displaySectionHeader('Installing skills');
  if (!buildSkills(true)) {
    console.log(`${COLORS.RED}${MARKS.FAIL} Failed to build ${SKILLS_DIR_NAME}/ from src/${COLORS.RESET}`);
    return 1;
  }
  console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Built ${SOURCE_PROMPTS.length} skills from src/`);
  if (!ensureSkillsCli()) return 1;
  // The skills carry only a stub; the console they forward to goes in with them.
  if (!installSharedConsole({ quiet: true, sweep: false })) {
    outcome.skills = false;
    return 1;
  }

  // Clear previous installs before writing anything new. The CLI goes first so it can unwind
  // its own store and links properly; the legacy sweep then picks up pre-2.2 remnants.
  removeInstalledSkills('global', { quiet: true });
  const legacy = cleanLegacyPaths(true);
  console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Cleared the previous install`);
  if (legacy.removed > 0) {
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Cleaned ${legacy.removed} legacy file(s) from pre-2.2 installs`);
  }
  if (!unattended) console.log('');

  console.log(`${COLORS.BRIGHT}Installing ${SOURCE_PROMPTS.length} skills for all your agents${COLORS.RESET}`);
  const result = await addSkillsWithSpinner(`add "${SKILLS_DIR}" -g ${skillNameArgs()} -y`, 'Running skills add...');
  reportSkillsOutput(result);
  const failed = !result.ok;
  outcome.skills = !failed;
  if (!failed) {
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Skills installed`);
    recordInstalled('skills');
    sweepOldConsoles({ quiet: true });
  }
  console.log('');

  // The `plan2code` command opens the dashboard skill, so it's only worth adding once the
  // skills themselves are in place.
  const launcherOutcome = {};
  const launcherFailed = failed ? false : (await installLauncher({ quiet: true, unattended, outcome: launcherOutcome })) !== 0;
  outcome.launcher = !failed && !launcherFailed;

  // The desktop app comes last and is an extra: its failure leaves the install a success.
  if (!failed && !launcherFailed) await offerDesktopApp({ unattended, outcome });
  const appState = desktopAppState(outcome);

  // Summary
  if (!unattended) {
    displaySectionHeader('Summary');
    const row = (label, value) => console.log(`  ${padEndVisible(`${label}:`, 18)}${value}`);
    row('Status', failed ? `${COLORS.RED}${MARKS.FAIL} failed${COLORS.RESET}` : `${COLORS.GREEN}${MARKS.DONE} installed${COLORS.RESET}`);
    const installedNames = failed ? [] : listInstalledSkills('global');
    row('Skills', `${installedNames.length}`);
    if (!failed) {
      row('Command', launcherFailed ? `${COLORS.RED}failed (see above)${COLORS.RESET}` : `${LAUNCHER_COMMAND}${launcherOutcome.pathMissing ? ` ${COLORS.YELLOW}(not on PATH yet)${COLORS.RESET}` : ''}`);
      const appColor = { installed: COLORS.GREEN, skipped: COLORS.DIM, failed: COLORS.RED }[appState];
      row('Desktop App', `${appColor}${appState}${COLORS.RESET}`);
    }
    console.log('');
  }

  if (failed) {
    console.log(`${COLORS.RED}${MARKS.FAIL} skills add failed. Re-run, or install by hand:${COLORS.RESET}`);
    console.log(`    ${COLORS.CYAN}${SKILLS_CLI} add "${SKILLS_DIR}" -g ${skillNameArgs()} -y${COLORS.RESET}\n`);
    return 1;
  }

  // The steps come first: where to start, the ways in, and what to do without an agent.
  if (!unattended) {
    await printGettingStarted({
      commandInstalled: !launcherFailed,
      pathMissing: Boolean(launcherOutcome.pathMissing),
      binDir: launcherOutcome.binDir,
      appInstalled: appState === 'installed',
    });
  }
  if (!unattended) {
    console.log(`${COLORS.GREEN}    ╭───╮${COLORS.RESET}   ${COLORS.BRIGHT}All done! Happy coding!${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}   ╲│ ${COLORS.CYAN}★${COLORS.GREEN} │╱${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    │ ${COLORS.BRIGHT}◡${COLORS.GREEN} │${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    ╰┬─┬╯${COLORS.RESET}   ${COLORS.DIM}Docs:${COLORS.RESET} ${COLORS.BRIGHT}https://github.com/jparkerweb/plan2code${COLORS.RESET}`);
    console.log('');
  }

  return launcherFailed ? 1 : 0;
}

/**
 * The summary's Desktop App row from an install's `outcome`: installed, failed (an attempt that
 * did not work), or skipped (declined, not offered, no build for this system, or no file in the
 * release yet on an unattended run).
 */
function desktopAppState(outcome = {}) {
  if (outcome.app === true) return 'installed';
  if (outcome.app === false && !outcome.appMissing) return 'failed';
  return 'skipped';
}

/** The platform key agents.json uses for this OS: "win", "mac" or "linux". */
function agentPlatform(platform = process.platform) {
  return platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : 'linux';
}

/**
 * The line that puts `binDir` on PATH for the person's shell, and the file it goes in (null on
 * Windows, where PowerShell writes the user PATH itself). zsh gets ~/.zshrc, any other shell ~/.bashrc.
 */
function pathFixLine(binDir, { platform = process.platform, shell = process.env.SHELL || '', home = os.homedir() } = {}) {
  if (platform === 'win32') {
    const dir = binDir.replace(/'/g, "''");
    return {
      file: null,
      line: `[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';${dir}', 'User')`,
    };
  }
  const rel = path.posix.relative(home.replace(/\\/g, '/'), binDir.replace(/\\/g, '/'));
  const dir = rel && !rel.startsWith('..') && !path.posix.isAbsolute(rel) ? `$HOME/${rel}` : binDir;
  const file = /zsh$/.test(shell) ? '~/.zshrc' : '~/.bashrc';
  return { file, line: `echo 'export PATH="${dir}:$PATH"' >> ${file}` };
}

/** The command by its full path, for use before PATH picks it up. */
function fullCommandPath(binDir, platform = process.platform) {
  return platform === 'win32'
    ? `& "${path.win32.join(binDir, `${LAUNCHER_COMMAND}.cmd`)}"`
    : `"${path.posix.join(binDir.replace(/\\/g, '/'), LAUNCHER_COMMAND)}"`;
}

/**
 * The agents this computer has, by the same list and lookup rule the launcher uses: the shipped
 * agents.json and agent-lookup.mjs (the copies in ~/.plan2code/bin/, or the ones in src/ when the
 * command was not installed), plus the person's own agents in ~/.plan2code/agents.json.
 * Returns `{ found, builtins }`: the names found, and the built-ins for the install advice.
 */
async function detectAgents({ binDir = path.dirname(AGENT_LOOKUP_DEST), userAgentsFile = USER_AGENTS_FILE, env = {} } = {}) {
  const installed = fs.existsSync(path.join(binDir, 'agent-lookup.mjs')) && fs.existsSync(path.join(binDir, 'agents.json'));
  const lookupFile = installed ? path.join(binDir, 'agent-lookup.mjs') : AGENT_LOOKUP_SRC;
  const listDir = installed ? binDir : path.dirname(AGENTS_SRC);
  let lookup;
  try {
    lookup = await import(pathToFileURL(lookupFile).href);
  } catch {
    return { found: [], builtins: [] };
  }
  const { builtins } = lookup.loadAgentList({ dir: listDir });
  // The person's own agents, read by the launcher's own rule (a wrong schema drops the file).
  let custom = [];
  try {
    custom = require(LAUNCHER_SRC).customClis(userAgentsFile, false).map((cli) => cli.entry);
  } catch {}
  // Present means what the launcher can run: on PATH, or on the saved Windows PATH it adds
  // before looking. A command only in npm's folder or an install folder off PATH is not.
  const runnable = (entry) => {
    const hit = lookup.findAgent(entry, env);
    return hit.state === 'found' || hit.where === 'saved-path';
  };
  const found = [...builtins, ...custom].filter(runnable).map((entry) => entry.name || entry.command);
  return { found, builtins };
}

/** An agent's install line, as the launcher prints it: the lead command for this OS, then its page. */
function agentInstallLine(entry, platform = agentPlatform()) {
  const lead = entry.install && Array.isArray(entry.install[platform]) && entry.install[platform][0];
  const run = lead && typeof lead.run === 'string' ? lead.run : '';
  if (!run) return entry.installUrl || '';
  return entry.installUrl && entry.installUrl !== run ? `${run} (${entry.installUrl})` : run;
}

/**
 * Print what to do after installing: where to start, the ways in, and what to do when no AI
 * agent is installed. Used at the end of every install route so they all end the same way.
 * `pathMissing` (with `binDir`) prints the PATH line for this shell and the command's full path;
 * `appInstalled` words steps 2 and 3 for the desktop app. `agents` replaces the detection (tests).
 */
async function printGettingStarted({ commandInstalled, pathMissing = false, binDir = '', appInstalled = false, agents = null, platform = process.platform, shell = process.env.SHELL || '' } = {}) {
  const detected = agents || (await detectAgents());
  const line = (text = '') => console.log(`  ${text}`);
  displaySectionHeader('How to use Plan2Code');
  line(`${COLORS.BRIGHT}1. Open a terminal IN the project you want to work on${COLORS.RESET}`);
  line('   Plan2Code works on the folder you start it in.');
  line(`   ${COLORS.CYAN}cd path/to/your-project${COLORS.RESET}`);
  console.log('');
  line(`${COLORS.BRIGHT}2. Start Plan2Code${COLORS.RESET}`);
  const app = appInstalled && commandInstalled;
  if (commandInstalled) {
    const opens = app ? 'opens the Plan2Code app' : 'opens your AI agent on the Plan2Code dashboard';
    if (pathMissing && binDir) {
      const fix = pathFixLine(binDir, { platform, shell });
      line(`   ${binDir} is not on your PATH yet. Add it ${fix.file ? `to ${fix.file}` : 'in PowerShell'}:`);
      line(`   ${COLORS.CYAN}${fix.line}${COLORS.RESET}`);
      line(`   then ${COLORS.BRIGHT}open a new terminal${COLORS.RESET} and run ${COLORS.CYAN}${LAUNCHER_COMMAND}${COLORS.RESET}: it ${opens}.`);
      line(`   Until then, run it by its full path: ${COLORS.CYAN}${fullCommandPath(binDir, platform)}${COLORS.RESET}`);
    } else {
      line(`   ${COLORS.CYAN}${LAUNCHER_COMMAND}${COLORS.RESET}   ${opens}`);
    }
    line(`   or, inside the agent itself: ${COLORS.CYAN}/plan2code${COLORS.RESET} (Claude Code, Devin)  ${COLORS.CYAN}$plan2code${COLORS.RESET} (Codex)`);
  } else {
    line(`   Inside your AI agent, type ${COLORS.CYAN}/plan2code${COLORS.RESET} (Claude Code, Devin) or ${COLORS.CYAN}$plan2code${COLORS.RESET} (Codex)`);
  }
  console.log('');
  line(`${COLORS.BRIGHT}3. ${app ? 'Pick a card on the dashboard: plan2code opens the Plan2Code app' : 'Pick a card on the page that opens in your browser'}${COLORS.RESET}`);
  line('   Any AI agent that reads Agent Skills can run Plan2Code the same way.');
  console.log('');
  if (detected.found.length === 0) {
    if (commandInstalled) line(`${COLORS.YELLOW}No agent yet?${COLORS.RESET} Just run ${COLORS.CYAN}${LAUNCHER_COMMAND}${COLORS.RESET}: its setup page installs one with you.`);
    else line(`${COLORS.YELLOW}No agent yet?${COLORS.RESET} Plan2Code runs inside an AI coding agent. Install one, open a new terminal, then follow the steps above.`);
    if (detected.builtins.length) {
      line('Or install one yourself:');
      for (const entry of detected.builtins) line(`   ${padEndVisible(entry.name, 13)} ${COLORS.CYAN}${agentInstallLine(entry, agentPlatform(platform))}${COLORS.RESET}`);
    }
    if (commandInstalled) line(`Already use another agent CLI? Add it in User Preferences, Agents & models (the gear on the Plan2Code page), then run ${COLORS.CYAN}${LAUNCHER_COMMAND}${COLORS.RESET} again.`);
    else line('Already use another agent CLI? Open it in your project and type /plan2code ($plan2code in Codex).');
    console.log('');
  }
}

// ============================================================================
// UNINSTALLATION
// ============================================================================

/**
 * Execute uninstallation
 */
function uninstallSkills() {
  displaySectionHeader('Uninstalling skills', 'Removing the global Plan2Code skills');
  console.log(`  ${COLORS.DIM}Home folder: ${os.homedir()}${COLORS.RESET}`);

  let removed = 0;
  let errors = 0;
  if (ensureSkillsCli()) {
    console.log(`\n${COLORS.BRIGHT}Removing skills${COLORS.RESET}\n`);
    const skillsRemoved = removeInstalledSkills('global');
    if (skillsRemoved < 0) errors++;
    else removed += skillsRemoved;
  } else {
    errors++;
  }
  if (errors === 0) forgetInstalled('skills');

  console.log(`\n${COLORS.BRIGHT}Cleaning up earlier versions${COLORS.RESET}\n`);
  const legacy = cleanLegacyPaths();
  if (legacy.removed === 0) console.log(`  ${COLORS.DIM}Nothing left over from earlier versions${COLORS.RESET}`);
  removed += legacy.removed;
  errors += legacy.errors;

  displaySectionHeader('Summary');
  const row = (label, value) => console.log(`  ${padEndVisible(`${label}:`, 18)}${value}`);
  row('Status', errors > 0 ? `${COLORS.RED}${MARKS.FAIL} finished with errors${COLORS.RESET}` : `${COLORS.GREEN}${MARKS.DONE} uninstalled${COLORS.RESET}`);
  row('Items removed', `${removed}`);
  if (errors > 0) row('Errors', `${COLORS.RED}${errors}${COLORS.RESET}`);
  console.log('');
  return errors > 0 ? 1 : 0;
}

// ============================================================================
// PROJECT INSTALLATION
// ============================================================================

/**
 * Install skills into the current project instead of globally.
 */
async function installProjectSkills() {
  const projectDir = process.cwd();
  displaySectionHeader('Installing into this project');
  if (!buildSkills(true)) {
    console.log(`${COLORS.RED}${MARKS.FAIL} Failed to build ${SKILLS_DIR_NAME}/ from src/${COLORS.RESET}`);
    return 1;
  }
  console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Built ${SOURCE_PROMPTS.length} skills from src/`);
  if (!ensureSkillsCli()) return 1;
  // Project skills forward to the same shared console in the home folder.
  if (!installSharedConsole({ quiet: true, sweep: false })) return 1;

  console.log('');
  displayStatusBox('Overview', [
    `Installs into ${COLORS.BRIGHT}this project${COLORS.RESET} rather than your home directory, so the`,
    `skills travel with the repo and are visible to everyone who clones it.`,
    '',
    `${COLORS.CYAN}Project:${COLORS.RESET} ${projectDir}`,
    `${COLORS.CYAN}Skills:${COLORS.RESET}  ${SOURCE_PROMPTS.length}`,
  ]);
  console.log('');
  if (projectDir === __dirname) {
    console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} This is the Plan2Code repo itself — installing here is rarely what you want.\n`);
  }

  console.log(`${COLORS.BRIGHT}Installing ${SOURCE_PROMPTS.length} skills for all your agents${COLORS.RESET}`);
  const result = await addSkillsWithSpinner(`add "${SKILLS_DIR}" ${skillNameArgs()} -y`, 'Running skills add...');
  reportSkillsOutput(result);
  console.log('');
  if (!result.ok) {
    console.log(`${COLORS.RED}${MARKS.FAIL} skills add failed. Run it by hand from your project root:${COLORS.RESET}`);
    console.log(`    ${COLORS.CYAN}${SKILLS_CLI} add "${SKILLS_DIR}" ${skillNameArgs()} -y${COLORS.RESET}\n`);
    return 1;
  }
  sweepOldConsoles({ quiet: true });
  console.log(`${COLORS.GREEN}${MARKS.DONE} Installed into ${projectDir}${COLORS.RESET}\n`);
  console.log(`${COLORS.DIM}  Check the new directories aren't gitignored, or your agents won't see them.${COLORS.RESET}\n`);
  return 0;
}

// ============================================================================
// INTERACTIVE MENU
// ============================================================================

/**
 * Run interactive menu interface
 */
function runInteractive() {
  // With no terminal nothing can answer the menu, and the run used to end at exit 0 having
  // installed nothing. Say how to do it instead, and fail.
  if (!process.stdin.isTTY) {
    console.log(NO_TERMINAL_MESSAGE);
    process.exit(1);
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  async function main() {
    // Main menu display
    displayHeader();

    console.log(`${COLORS.DIM}${projectVersion.name} ${projectVersion.version}${COLORS.RESET}`);
    console.log('');

    printBox([
      `${COLORS.BRIGHT}Install Plan2Code${COLORS.RESET}`,
      '',
      `${COLORS.BRIGHT}I.${COLORS.RESET}  ${COLORS.GREEN}INSTALL${COLORS.RESET}    Install skills + the plan2code command`,
      `${COLORS.BRIGHT}U.${COLORS.RESET}  ${COLORS.RED}UNINSTALL${COLORS.RESET}  Remove everything Plan2Code installed`,
      `${COLORS.BRIGHT}A.${COLORS.RESET}  ${COLORS.BLUE}ADVANCED${COLORS.RESET}   Project install, dev tools, and more`,
      `${COLORS.BRIGHT}Q.${COLORS.RESET}  ${COLORS.DIM}QUIT${COLORS.RESET}       Exit`,
    ]);
    console.log('');

    const answer = await question(`${COLORS.CYAN}Choose an option${COLORS.RESET} (I, U, A, Q) [I]: `);
    const input = answer.trim().toUpperCase() || 'I';

    // I path: skills and the plan2code command. The dev tools stay optional under Advanced.
    if (input === 'I') {
      rl.close();
      process.exit(await install());
    }

    // U path — Uninstall All
    if (input === 'U') {
      console.log('');
      console.log(`${COLORS.RED}    ╭───╮${COLORS.RESET}`);
      console.log(`${COLORS.RED}   ╲│ ${COLORS.YELLOW}★${COLORS.RED} │╱${COLORS.RESET}  ${COLORS.YELLOW}!${COLORS.RESET}`);
      console.log(`${COLORS.RED}    │ ${COLORS.YELLOW}~${COLORS.RED} │${COLORS.RESET}`);
      console.log(`${COLORS.RED}    ╰┬─┬╯${COLORS.RESET}`);
      console.log('');
      console.log(`${COLORS.DIM}Are you sure? This removes everything Plan2Code installed: skills, the plan2code command and any dev tools.${COLORS.RESET}`);
      console.log('');
      const confirmAnswer = await question(`${COLORS.RED}Remove everything Plan2Code installed?${COLORS.RESET} (Y/N) [N]: `);
      const confirmInput = confirmAnswer.trim().toUpperCase() || 'N';

      if (confirmInput === 'Y') {
        rl.close();
        console.log(`${COLORS.BRIGHT}Removing Plan2Code${COLORS.RESET}`);
        const report = newUninstallReport();
        const code = uninstallAll({ report });
        console.log('');
        printKeptData();
        printUninstallReport(report);
        process.exit(code);
      } else {
        console.log(`\n${COLORS.YELLOW}${MARKS.WARN} CANCELED${COLORS.RESET}\n`);
        rl.close();
        process.exit(0);
      }
    }

    // A path: ADVANCED sub-menu
    if (input === 'A') {
      console.log('');
      printBox([
        `${COLORS.BRIGHT}Advanced options${COLORS.RESET}`,
        '',
        `${COLORS.BRIGHT}L.${COLORS.RESET}  ${COLORS.BLUE}LOCAL${COLORS.RESET}      Install skills into the current project only`,
        `${COLORS.BRIGHT}M.${COLORS.RESET}  ${COLORS.GREEN}METRICS${COLORS.RESET}    Install plan2code-metrics CLI only`,
        `${COLORS.BRIGHT}S.${COLORS.RESET}  ${COLORS.GREEN}STATUS${COLORS.RESET}     Install Claude Code status line`,
        `${COLORS.BRIGHT}B.${COLORS.RESET}  ${COLORS.GREEN}BOT${COLORS.RESET}        Install plan2code-bot CLI only`,
        `${COLORS.BRIGHT}D.${COLORS.RESET}  ${COLORS.GREEN}COMMAND${COLORS.RESET}    Install the plan2code command only`,
        `${COLORS.BRIGHT}E.${COLORS.RESET}  ${COLORS.MAGENTA}EVERYTHING${COLORS.RESET} Install Plan2Code + all dev tools`,
        `${COLORS.BRIGHT}Q.${COLORS.RESET}  ${COLORS.DIM}BACK${COLORS.RESET}       Return to main menu`,
      ]);
      console.log('');
      const customAnswer = await question(`${COLORS.CYAN}Choose an option${COLORS.RESET} (L, M, S, B, D, E, Q) [Q]: `);
      const customInput = customAnswer.trim().toUpperCase() || 'Q';

      // A > E: install everything (skills + bot + metrics + Claude status line)
      if (customInput === 'E') {
        rl.close();
        const botResult = installPlan2CodeBot();
        console.log('');
        const metricsResult = installPlan2CodeMetrics();
        console.log('');
        const statusLineResult = await installStatusLine();
        console.log('');
        const installResult = await install();
        const exitCode = botResult !== 0 ? botResult : metricsResult !== 0 ? metricsResult : statusLineResult !== 0 ? statusLineResult : installResult;
        process.exit(exitCode);
      }

      // A > L: install skills into the current project
      if (customInput === 'L') {
        rl.close();
        process.exit(await installProjectSkills());
      }

      // A > M: install metrics CLI only
      if (customInput === 'M') {
        rl.close();
        const result = installPlan2CodeMetrics();
        process.exit(result);
      }

      // A > S: install status line
      if (customInput === 'S') {
        rl.close();
        const result = await installStatusLine();
        process.exit(result);
      }

      // A > B: install bot CLI only
      if (customInput === 'B') {
        rl.close();
        const result = installPlan2CodeBot();
        process.exit(result);
      }

      // A > D: install the global `plan2code` command (opens the dashboard in Claude Code, Devin or Codex)
      if (customInput === 'D') {
        rl.close();
        process.exit(await installLauncher());
      }

      // A > Q: back to main menu
      return main();
    }

    // Q — exit
    if (input === 'Q') {
      console.log('\nNothing was changed.\n');
      rl.close();
      process.exit(0);
    }

    // Invalid input — loop back
    console.log(`\n${COLORS.RED}${MARKS.FAIL} Invalid option. Please choose I, U, A, or Q.${COLORS.RESET}\n`);
    return main();
  }

  main().catch(err => {
    console.error(`${ERR_COLORS.RED}${MARKS.FAIL} ERROR:${ERR_COLORS.RESET}`, err.message);
    rl.close();
    process.exit(1);
  });
}

// ============================================================================
// LEGACY PLAN2CODE-LOOP SHIMS
// ============================================================================

/**
 * Remove stale plan2code-loop artifacts left behind by the retired CLI package:
 * the shims under the npm bin/prefix dir and the link under the npm root.
 * Silently does nothing when none are present.
 */
function removeLegacyLoopShims() {
  let npmPrefix;
  try {
    npmPrefix = execSync('npm config get prefix', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return;
  }

  // On Windows, bin files are directly in prefix; on Unix they are in prefix/bin
  const npmBinGlobal = process.platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
  const npmRootGlobal = path.join(npmPrefix, 'node_modules');

  const artifacts = [
    { path: path.join(npmBinGlobal, 'plan2code-loop'), name: 'plan2code-loop' },
    { path: path.join(npmBinGlobal, 'plan2code-loop.cmd'), name: 'plan2code-loop.cmd' },
    { path: path.join(npmBinGlobal, 'plan2code-loop.ps1'), name: 'plan2code-loop.ps1' },
    { path: path.join(npmRootGlobal, 'plan2code-loop'), name: 'node_modules/plan2code-loop' }
  ];

  for (const artifact of artifacts) {
    try {
      fs.lstatSync(artifact.path);
      fs.rmSync(artifact.path, { force: true, recursive: true });
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${artifact.name}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to remove ${artifact.name}: ${err.message}`);
      }
    }
  }
}

// ============================================================================
// PLAN2CODE-METRICS INSTALLATION
// ============================================================================

/**
 * Build plan2code-metrics package
 */
function buildPlan2CodeMetrics() {
  const metricsDir = path.join(__dirname, 'plan2code-metrics');

  if (!fs.existsSync(metricsDir)) {
    console.log(`${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} plan2code-metrics directory not found`);
    return false;
  }

  console.log(`${COLORS.BRIGHT}Building plan2code-metrics${COLORS.RESET}`);

  try {
    console.log(`  ${COLORS.DIM}Installing dependencies...${COLORS.RESET}`);
    execSync('npm install', { cwd: metricsDir, stdio: 'pipe' });

    console.log(`  ${COLORS.DIM}Running build...${COLORS.RESET}`);
    execSync('npm run build', { cwd: metricsDir, stdio: 'pipe' });

    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Build complete`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Build failed: ${error.message}`);
    return false;
  }
}

/**
 * Clean up existing plan2code-metrics symlinks/files before creating new ones
 */
function cleanupExistingMetricsSymlinks() {
  console.log(`  ${COLORS.DIM}Cleaning up existing symlinks...${COLORS.RESET}`);

  try {
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    const npmBinGlobal = process.platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
    const npmRootGlobal = path.join(npmPrefix, 'node_modules');

    const binFiles = [
      path.join(npmBinGlobal, 'plan2code-metrics'),
      path.join(npmBinGlobal, 'plan2code-metrics.cmd'),
      path.join(npmBinGlobal, 'plan2code-metrics.ps1')
    ];

    const nodeModulesLink = path.join(npmRootGlobal, 'plan2code-metrics');

    for (const file of binFiles) {
      try {
        const stats = fs.lstatSync(file);
        if (stats) {
          fs.unlinkSync(file);
          console.log(`    ${COLORS.DIM}Removed: ${path.basename(file)}${COLORS.RESET}`);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          try {
            fs.rmSync(file, { force: true, recursive: true });
            console.log(`    ${COLORS.DIM}Removed: ${path.basename(file)}${COLORS.RESET}`);
          } catch (rmErr) {
            console.log(`    ${COLORS.DIM}Could not remove: ${path.basename(file)}${COLORS.RESET}`);
          }
        }
      }
    }

    try {
      const stats = fs.lstatSync(nodeModulesLink);
      if (stats) {
        if (process.platform === 'win32') {
          try {
            fs.rmdirSync(nodeModulesLink);
            console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-metrics (junction)${COLORS.RESET}`);
          } catch (rmdirErr) {
            fs.rmSync(nodeModulesLink, { force: true, recursive: true });
            console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-metrics${COLORS.RESET}`);
          }
        } else {
          fs.rmSync(nodeModulesLink, { force: true, recursive: true });
          console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-metrics${COLORS.RESET}`);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log(`    ${COLORS.DIM}Could not remove node_modules symlink: ${err.message}${COLORS.RESET}`);
      }
    }

    return true;
  } catch (error) {
    console.log(`    ${COLORS.DIM}Cleanup skipped: ${error.message}${COLORS.RESET}`);
    return true;
  }
}

/**
 * Create global symlink for plan2code-metrics
 */
function createMetricsGlobalSymlink() {
  const metricsDir = path.join(__dirname, 'plan2code-metrics');
  const distBin = path.join(metricsDir, 'dist', 'bin', 'plan2code-metrics.js');

  if (!fs.existsSync(distBin)) {
    console.log(`${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} plan2code-metrics binary not found. Run build first.`);
    return false;
  }

  console.log(`${COLORS.BRIGHT}Creating the global command${COLORS.RESET}`);

  cleanupExistingMetricsSymlinks();

  if (process.platform === 'win32') {
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const symlinkCmd = path.join(npmPrefix, 'plan2code-metrics.cmd');
      const symlinkPs1 = path.join(npmPrefix, 'plan2code-metrics.ps1');

      const batchContent = `@echo off\r\nnode "${distBin}" %*\r\n`;
      fs.writeFileSync(symlinkCmd, batchContent);
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Created: plan2code-metrics.cmd`);

      const ps1Content = `#!/usr/bin/env pwsh\r\nnode "${distBin}" $args\r\n`;
      fs.writeFileSync(symlinkPs1, ps1Content);
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Created: plan2code-metrics.ps1`);

      console.log(`  ${COLORS.DIM}Run 'plan2code-metrics' from any directory${COLORS.RESET}`);
      return true;
    } catch (error) {
      console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to create wrappers: ${error.message}`);
      return false;
    }
  }

  try {
    execSync('npm link', { cwd: metricsDir, stdio: 'pipe' });
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Global symlink created`);
    console.log(`  ${COLORS.DIM}Run 'plan2code-metrics' from any directory${COLORS.RESET}`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Symlink failed: ${error.message}`);
    return false;
  }
}

/**
 * Remove global symlink for plan2code-metrics
 */
function removeMetricsGlobalSymlink() {
  console.log(`${COLORS.BRIGHT}Removing the global command${COLORS.RESET}`);

  let removedCount = 0;

  try {
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    const npmBinGlobal = process.platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
    const npmRootGlobal = path.join(npmPrefix, 'node_modules');

    const filesToRemove = [
      { path: path.join(npmBinGlobal, 'plan2code-metrics'), name: 'plan2code-metrics' },
      { path: path.join(npmBinGlobal, 'plan2code-metrics.cmd'), name: 'plan2code-metrics.cmd' },
      { path: path.join(npmBinGlobal, 'plan2code-metrics.ps1'), name: 'plan2code-metrics.ps1' },
      { path: path.join(npmRootGlobal, 'plan2code-metrics'), name: 'node_modules/plan2code-metrics' }
    ];

    for (const file of filesToRemove) {
      try {
        fs.lstatSync(file.path);
        fs.rmSync(file.path, { force: true, recursive: true });
        console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${file.name}`);
        removedCount++;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to remove ${file.name}: ${err.message}`);
        }
      }
    }

    if (removedCount === 0) {
      console.log(`  ${COLORS.DIM}No files found to remove${COLORS.RESET}`);
    }

    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Uninstall failed: ${error.message}`);
    return false;
  }
}

/**
 * Install plan2code-metrics (build + symlink)
 */
function installPlan2CodeMetrics() {
  displaySectionHeader('Installing plan2code-metrics');

  const buildSuccess = buildPlan2CodeMetrics();
  if (!buildSuccess) {
    return 1;
  }

  const symlinkSuccess = createMetricsGlobalSymlink();
  if (!symlinkSuccess) {
    return 1;
  }

  console.log('');
  recordInstalled('metrics');
  console.log(`${COLORS.GREEN}${MARKS.DONE} plan2code-metrics installed successfully!${COLORS.RESET}`);
  console.log('');
  console.log(`${COLORS.CYAN}Usage:${COLORS.RESET}`);
  console.log(`  ${COLORS.BRIGHT}plan2code-metrics${COLORS.RESET}       Start the interactive metrics CLI`);
  console.log('');

  return 0;
}

/**
 * Uninstall plan2code-metrics
 */
function uninstallPlan2CodeMetrics() {
  displaySectionHeader('Uninstalling plan2code-metrics');

  removeMetricsGlobalSymlink();
  forgetInstalled('metrics');

  console.log('');
  console.log(`${COLORS.GREEN}${MARKS.DONE} plan2code-metrics uninstalled${COLORS.RESET}`);
  console.log('');

  return 0;
}

// ============================================================================
// STATUS LINE INSTALLATION
// ============================================================================

/**
 * Status line source layout — single-file design, no bundling step.
 * `statusline.js` is self-contained (config loader, formatters, entry point)
 * and copied verbatim to ~/.claude/plan2code-statusline.js on install.
 */
function getStatusLineSrcDir() {
  return path.join(__dirname, 'src', 'statusline-claude');
}

/**
 * Install status line (copy + configure settings).
 * Async because it may prompt when a custom (non-plan2code) statusLine exists. `unattended`
 * (plan2code update) never prompts: a custom statusLine is kept as it is.
 */
async function installStatusLine({ quiet = false, unattended = false } = {}) {
  if (!quiet) {
    displaySectionHeader('Installing the Claude status line');
  } else {
    console.log(`${COLORS.BRIGHT}Installing the Claude status line${COLORS.RESET}`);
  }

  const srcDir = getStatusLineSrcDir();
  if (!fs.existsSync(srcDir)) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} src/statusline-claude directory not found`);
    return 1;
  }

  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude');

  try {
    fs.mkdirSync(claudeDir, { recursive: true });
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Cannot create ~/.claude/: ${error.message}`);
    return 1;
  }

  // Copy script directly from src (no bundling — statusline.js is self-contained)
  const statuslineDest = path.join(claudeDir, 'plan2code-statusline.js');
  const configDest = path.join(claudeDir, 'statusline-config.json');

  try {
    fs.copyFileSync(path.join(srcDir, 'statusline.js'), statuslineDest);
    if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Installed: ~/.claude/plan2code-statusline.js`);
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to copy script: ${error.message}`);
    return 1;
  }

  // Preserve existing user config
  if (!fs.existsSync(configDest)) {
    try {
      fs.copyFileSync(path.join(srcDir, 'statusline-config.json'), configDest);
      if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Created: ~/.claude/statusline-config.json`);
    } catch (error) {
      console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to copy config: ${error.message}`);
      return 1;
    }
  } else {
    if (!quiet) console.log(`  ${COLORS.DIM}Preserved existing: ~/.claude/statusline-config.json${COLORS.RESET}`);
  }

  // Make executable on non-Windows
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(statuslineDest, 0o755);
    } catch {}
  }

  // Configure Claude Code settings.json
  let settingsOk = false;
  const settingsPath = path.join(claudeDir, 'settings.json');
  const expectedCommand = `node "${statuslineDest.replace(/\\/g, '/')}"`;

  try {
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }

    // Detect existing statusLine — skip prompt if ours or absent
    if (settings.statusLine && settings.statusLine.command) {
      const existingCmd = settings.statusLine.command;
      const isPlan2Code = existingCmd.includes('plan2code-statusline');

      if (!isPlan2Code) {
        // Custom statusLine detected — prompt before overwriting
        console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} Existing statusLine detected in settings.json:`);
        console.log(`  ${COLORS.DIM}  ${existingCmd}${COLORS.RESET}`);

        // The person chose that status line when they last installed; an update keeps it.
        if (unattended) {
          console.log(`  ${COLORS.DIM}Kept it: scripts updated, settings.json unchanged${COLORS.RESET}`);
          recordInstalled('statusline');
          return 0;
        }

        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => {
          rl2.question(`  ${COLORS.CYAN}Replace with Plan2Code status line?${COLORS.RESET} (Y/n): `, resolve);
        });
        rl2.close();

        if (answer.trim().toLowerCase() === 'n') {
          console.log(`  ${COLORS.DIM}Skipped — scripts installed but settings.json unchanged${COLORS.RESET}`);
          console.log('');
          recordInstalled('statusline');
          return 0;
        }

        // Backup existing config before replacing
        const backupPath = path.join(claudeDir, 'statusline-previous.json');
        fs.writeFileSync(backupPath, JSON.stringify({ statusLine: settings.statusLine }, null, 2));
        console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Backed up existing config: ~/.claude/statusline-previous.json`);
      }
    }

    settings.statusLine = {
      type: 'command',
      command: expectedCommand,
    };
    // Atomic write: temp file + rename so a crash/power-loss never leaves
    // settings.json truncated.
    const tmpSettings = settingsPath + '.tmp';
    fs.writeFileSync(tmpSettings, JSON.stringify(settings, null, 2));
    fs.renameSync(tmpSettings, settingsPath);
    if (!quiet) console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Configured: ~/.claude/settings.json (statusLine)`);
    settingsOk = true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to update settings.json: ${error.message}`);
  }

  // Clean up legacy filenames from previous installs
  for (const legacy of ['statusline.js', 'plan-usage.js', 'plan2code-plan-usage.js', 'statusline-cache.json']) {
    const legacyPath = path.join(claudeDir, legacy);
    try {
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
        if (!quiet) console.log(`  ${COLORS.DIM}Removed legacy: ${legacy}${COLORS.RESET}`);
      }
    } catch {}
  }

  if (settingsOk) {
    recordInstalled('statusline');
    if (!quiet) {
      console.log('');
      console.log(`${COLORS.GREEN}${MARKS.DONE} Claude Status Line installed successfully!${COLORS.RESET}`);
      console.log('');
      console.log(`${COLORS.CYAN}Usage:${COLORS.RESET}`);
      console.log(`  ${COLORS.DIM}Restart Claude Code to see the status bar${COLORS.RESET}`);
      console.log(`  ${COLORS.DIM}Config: ~/.claude/statusline-config.json${COLORS.RESET}`);
      console.log('');
    } else {
      console.log(`    ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Claude Status Line → ${COLORS.DIM}~/.claude/plan2code-statusline.js${COLORS.RESET}`);
    }
  } else {
    console.log('');
    console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} Scripts installed but settings.json not updated.`);
    console.log(`  ${COLORS.DIM}Add statusLine config to ~/.claude/settings.json manually.${COLORS.RESET}`);
    console.log('');
  }

  return settingsOk ? 0 : 1;
}

/**
 * Uninstall status line
 */
function uninstallStatusLine() {
  displaySectionHeader('Uninstalling the Claude status line');

  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  // Remove statusLine from settings.json (only if it points to our bundle)
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.statusLine) {
        const existingCmd = settings.statusLine.command || '';
        if (existingCmd.includes('plan2code-statusline')) {
          delete settings.statusLine;
          const tmpSettings = settingsPath + '.tmp';
          fs.writeFileSync(tmpSettings, JSON.stringify(settings, null, 2));
          fs.renameSync(tmpSettings, settingsPath);
          console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed statusLine from settings.json`);
        } else {
          console.log(`  ${COLORS.DIM}Preserved non-plan2code statusLine in settings.json${COLORS.RESET}`);
          console.log(`  ${COLORS.DIM}  ${existingCmd}${COLORS.RESET}`);
        }
      } else {
        console.log(`  ${COLORS.DIM}No statusLine config in settings.json${COLORS.RESET}`);
      }
    }
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to update settings.json: ${error.message}`);
  }

  // Remove script files (preserve config)
  const filesToRemove = [
    { path: path.join(claudeDir, 'plan2code-statusline.js'), name: 'plan2code-statusline.js' },
    { path: path.join(claudeDir, 'plan2code-plan-usage.js'), name: 'plan2code-plan-usage.js' },
    { path: path.join(claudeDir, 'statusline.js'), name: 'statusline.js (legacy)' },
    { path: path.join(claudeDir, 'plan-usage.js'), name: 'plan-usage.js (legacy)' },
    { path: path.join(claudeDir, 'statusline-cache.json'), name: 'statusline-cache.json' },
  ];

  let removedCount = 0;
  for (const file of filesToRemove) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${file.name}`);
        removedCount++;
      }
    } catch (error) {
      console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to remove ${file.name}: ${error.message}`);
    }
  }

  if (removedCount === 0) {
    console.log(`  ${COLORS.DIM}No status line files found${COLORS.RESET}`);
  }

  forgetInstalled('statusline');
  if (fs.existsSync(path.join(claudeDir, 'statusline-config.json'))) {
    console.log(`  ${COLORS.DIM}Preserved: statusline-config.json${COLORS.RESET}`);
  }
  console.log('');
  console.log(`${COLORS.GREEN}${MARKS.DONE} Status line uninstalled${COLORS.RESET}`);
  console.log('');

  return 0;
}

// ============================================================================
// PLAN2CODE-BOT INSTALLATION
// ============================================================================

/**
 * Build plan2code-bot package
 */
function buildPlan2CodeBot() {
  const botDir = path.join(__dirname, 'plan2code-bot');

  if (!fs.existsSync(botDir)) {
    console.log(`${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} plan2code-bot directory not found`);
    return false;
  }

  console.log(`${COLORS.BRIGHT}Building plan2code-bot${COLORS.RESET}`);

  try {
    console.log(`  ${COLORS.DIM}Installing dependencies...${COLORS.RESET}`);
    execSync('npm install', { cwd: botDir, stdio: 'pipe' });

    console.log(`  ${COLORS.DIM}Running build...${COLORS.RESET}`);
    execSync('npm run build', { cwd: botDir, stdio: 'pipe' });

    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Build complete`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Build failed: ${error.message}`);
    return false;
  }
}

/**
 * Clean up existing plan2code-bot symlinks/files before creating new ones
 */
function cleanupExistingBotSymlinks() {
  console.log(`  ${COLORS.DIM}Cleaning up existing symlinks...${COLORS.RESET}`);

  try {
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    const npmBinGlobal = process.platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
    const npmRootGlobal = path.join(npmPrefix, 'node_modules');

    const binFiles = [
      path.join(npmBinGlobal, 'plan2code-bot'),
      path.join(npmBinGlobal, 'plan2code-bot.cmd'),
      path.join(npmBinGlobal, 'plan2code-bot.ps1')
    ];

    const nodeModulesLink = path.join(npmRootGlobal, 'plan2code-bot');

    for (const file of binFiles) {
      try {
        const stats = fs.lstatSync(file);
        if (stats) {
          fs.unlinkSync(file);
          console.log(`    ${COLORS.DIM}Removed: ${path.basename(file)}${COLORS.RESET}`);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          try {
            fs.rmSync(file, { force: true, recursive: true });
            console.log(`    ${COLORS.DIM}Removed: ${path.basename(file)}${COLORS.RESET}`);
          } catch (rmErr) {
            console.log(`    ${COLORS.DIM}Could not remove: ${path.basename(file)}${COLORS.RESET}`);
          }
        }
      }
    }

    try {
      const stats = fs.lstatSync(nodeModulesLink);
      if (stats) {
        if (process.platform === 'win32') {
          try {
            fs.rmdirSync(nodeModulesLink);
            console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-bot (junction)${COLORS.RESET}`);
          } catch (rmdirErr) {
            fs.rmSync(nodeModulesLink, { force: true, recursive: true });
            console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-bot${COLORS.RESET}`);
          }
        } else {
          fs.rmSync(nodeModulesLink, { force: true, recursive: true });
          console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-bot${COLORS.RESET}`);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log(`    ${COLORS.DIM}Could not remove node_modules symlink: ${err.message}${COLORS.RESET}`);
      }
    }

    return true;
  } catch (error) {
    console.log(`    ${COLORS.DIM}Cleanup skipped: ${error.message}${COLORS.RESET}`);
    return true;
  }
}

/**
 * Create global symlink for plan2code-bot
 */
function createBotGlobalSymlink() {
  const botDir = path.join(__dirname, 'plan2code-bot');
  const distBin = path.join(botDir, 'dist', 'bin', 'plan2code-bot.js');

  if (!fs.existsSync(distBin)) {
    console.log(`${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} plan2code-bot binary not found. Run build first.`);
    return false;
  }

  console.log(`${COLORS.BRIGHT}Creating the global command${COLORS.RESET}`);

  cleanupExistingBotSymlinks();

  if (process.platform === 'win32') {
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const symlinkCmd = path.join(npmPrefix, 'plan2code-bot.cmd');
      const symlinkPs1 = path.join(npmPrefix, 'plan2code-bot.ps1');

      const batchContent = `@echo off\r\nnode "${distBin}" %*\r\n`;
      fs.writeFileSync(symlinkCmd, batchContent);
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Created: plan2code-bot.cmd`);

      const ps1Content = `#!/usr/bin/env pwsh\r\nnode "${distBin}" $args\r\n`;
      fs.writeFileSync(symlinkPs1, ps1Content);
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Created: plan2code-bot.ps1`);

      console.log(`  ${COLORS.DIM}Run 'plan2code-bot' from any directory${COLORS.RESET}`);
      return true;
    } catch (error) {
      console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to create wrappers: ${error.message}`);
      return false;
    }
  }

  try {
    execSync('npm link', { cwd: botDir, stdio: 'pipe' });
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Global symlink created`);
    console.log(`  ${COLORS.DIM}Run 'plan2code-bot' from any directory${COLORS.RESET}`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Symlink failed: ${error.message}`);
    return false;
  }
}

/**
 * Remove global symlink for plan2code-bot
 */
function removeBotGlobalSymlink() {
  console.log(`${COLORS.BRIGHT}Removing the global command${COLORS.RESET}`);

  let removedCount = 0;

  try {
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
    const npmBinGlobal = process.platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
    const npmRootGlobal = path.join(npmPrefix, 'node_modules');

    const filesToRemove = [
      { path: path.join(npmBinGlobal, 'plan2code-bot'), name: 'plan2code-bot' },
      { path: path.join(npmBinGlobal, 'plan2code-bot.cmd'), name: 'plan2code-bot.cmd' },
      { path: path.join(npmBinGlobal, 'plan2code-bot.ps1'), name: 'plan2code-bot.ps1' },
      { path: path.join(npmRootGlobal, 'plan2code-bot'), name: 'node_modules/plan2code-bot' }
    ];

    for (const file of filesToRemove) {
      try {
        fs.lstatSync(file.path);
        fs.rmSync(file.path, { force: true, recursive: true });
        console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${file.name}`);
        removedCount++;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to remove ${file.name}: ${err.message}`);
        }
      }
    }

    if (removedCount === 0) {
      console.log(`  ${COLORS.DIM}No files found to remove${COLORS.RESET}`);
    }

    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Uninstall failed: ${error.message}`);
    return false;
  }
}

/**
 * Install plan2code-bot (build + symlink)
 */
function installPlan2CodeBot() {
  displaySectionHeader('Installing plan2code-bot');

  const buildSuccess = buildPlan2CodeBot();
  if (!buildSuccess) {
    return 1;
  }

  const symlinkSuccess = createBotGlobalSymlink();
  if (!symlinkSuccess) {
    return 1;
  }

  console.log('');
  recordInstalled('bot');
  console.log(`${COLORS.GREEN}${MARKS.DONE} plan2code-bot installed successfully!${COLORS.RESET}`);
  console.log('');
  console.log(`${COLORS.CYAN}Usage:${COLORS.RESET}`);
  console.log(`  ${COLORS.BRIGHT}plan2code-bot${COLORS.RESET}           Run autonomous workflow test`);
  console.log('');

  return 0;
}

/**
 * Uninstall plan2code-bot
 */
function uninstallPlan2CodeBot() {
  displaySectionHeader('Uninstalling plan2code-bot');

  removeBotGlobalSymlink();
  forgetInstalled('bot');

  console.log('');
  console.log(`${COLORS.GREEN}${MARKS.DONE} plan2code-bot uninstalled${COLORS.RESET}`);
  console.log('');

  return 0;
}

// ============================================================================
// PLAN2CODE COMMAND (global `plan2code` → dashboard in Claude Code, Devin or Codex)
// ============================================================================

/**
 * `plan2code` typed in any directory opens the dashboard skill there in Claude Code
 * (`claude /plan2code`), Devin (`devin -- /plan2code`) or Codex (`codex $plan2code`), asking
 * which when more than one is installed, then whether to turn permission prompts off.
 * The launcher is copied out of the package into ~/.plan2code/bin/ because the installer
 * normally runs from an npx cache directory that npm is free to delete; the shims in the bin
 * directory point at that stable copy.
 */
const LAUNCHER_COMMAND = 'plan2code';
const LAUNCHER_MARKER = 'plan2code-launcher';
const LAUNCHER_SRC = path.join(__dirname, 'src', 'launcher', 'plan2code.js');
const MODELS_SRC = path.join(__dirname, 'src', 'launcher', 'models.json');
const MODELS_DEST = path.join(os.homedir(), '.plan2code', 'bin', 'models.json');
const LAUNCHER_DEST = path.join(os.homedir(), '.plan2code', 'bin', 'plan2code.js');
const LAUNCHER_STATE = path.join(os.homedir(), '.plan2code', 'launcher.json');
// The release notice: the launcher reads the console's cached check through this copy, and
// compares it with the version.json written beside it.
const UPDATE_CHECK_SRC = path.join(__dirname, 'src', 'web-console', 'update-check.mjs');
const UPDATE_CHECK_DEST = path.join(path.dirname(LAUNCHER_DEST), 'update-check.mjs');
// The shared agent list and lookup rule live beside the launcher so the command, the console
// and the app all read one copy; both are overwritten on every install.
const AGENTS_SRC = path.join(__dirname, 'src', 'launcher', 'agents.json');
const AGENTS_DEST = path.join(path.dirname(LAUNCHER_DEST), 'agents.json');
const AGENT_LOOKUP_SRC = path.join(__dirname, 'src', 'web-console', 'agent-lookup.mjs');
const AGENT_LOOKUP_DEST = path.join(path.dirname(LAUNCHER_DEST), 'agent-lookup.mjs');
// The person's own agent CLIs, written by User Preferences, Agents & models (read, never written, here).
const USER_AGENTS_FILE = path.join(os.homedir(), '.plan2code', 'agents.json');
const LAUNCHER_VERSION_DEST = path.join(path.dirname(LAUNCHER_DEST), 'version.json');
// What a global install put on this machine, so `plan2code update` reinstalls exactly that.
const INSTALL_RECORD = path.join(os.homedir(), '.plan2code', 'install.json');
const INSTALL_PIECES = ['skills', 'launcher', 'app', 'statusline', 'metrics', 'bot'];
const LAUNCHER_PICK_FOLDER_FLAG = '--pick-folder';

/**
 * `~/.plan2code/install.json` as `{ version, scope, pieces }`, or null when missing or unparsable.
 * `skipped` lists optional pieces (the desktop app) the person said no to, so an unattended
 * `plan2code update` does not install them; it is left out of the file while empty.
 */
function readInstallRecord() {
  try {
    const record = JSON.parse(fs.readFileSync(INSTALL_RECORD, 'utf8'));
    if (record && typeof record === 'object' && Array.isArray(record.pieces)) return record;
  } catch {}
  return null;
}

/** Temp file, then rename, so a crash never leaves a half-written record. A failure only skips the record. */
function writeInstallRecord(pieces, skipped = (readInstallRecord() || {}).skipped || [], version = projectVersion.version) {
  const record = {
    version,
    scope: 'global',
    pieces: [...new Set(pieces)].filter((piece) => INSTALL_PIECES.includes(piece)).sort(),
  };
  const declined = [...new Set(skipped)].filter((piece) => INSTALL_PIECES.includes(piece) && !record.pieces.includes(piece)).sort();
  if (declined.length > 0) record.skipped = declined;
  const tmp = `${INSTALL_RECORD}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(path.dirname(INSTALL_RECORD), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n');
    fs.renameSync(tmp, INSTALL_RECORD);
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {}
  }
}

/**
 * Put `version` back in the record (null when none was known) without touching its pieces: every
 * recordInstalled() stamps the version being installed, so an update that failed uses this to
 * stay behind, and the next `plan2code update` does not answer "Already on".
 */
function setRecordVersion(version) {
  const record = readInstallRecord();
  if (record) writeInstallRecord(record.pieces, record.skipped || [], version);
}

/** Add a piece after a successful global install. */
function recordInstalled(piece) {
  const record = readInstallRecord();
  writeInstallRecord([...(record ? record.pieces : []), piece]);
}

/** Remember that an optional piece was declined. Needs a record: one holding no pieces would make update do nothing. */
function recordSkipped(piece) {
  const record = readInstallRecord();
  if (record) writeInstallRecord(record.pieces, [...(record.skipped || []), piece]);
}

/** Drop a piece after its uninstall; no record means nothing to forget. */
function forgetInstalled(piece) {
  const record = readInstallRecord();
  if (record) writeInstallRecord(record.pieces.filter((p) => p !== piece));
}
const SHORTCUT_NAME = 'Plan2Code';
const SHORTCUT_ICON_SRC = path.join(__dirname, 'src', 'launcher', 'plan2code.ico');
const SHORTCUT_ICON_DEST = path.join(path.dirname(LAUNCHER_DEST), 'plan2code.ico');
const SHORTCUT_PNG_SRC = path.join(__dirname, 'src', 'web-console', 'public', 'favicon.png');
const SHORTCUT_PNG_DEST = path.join(path.dirname(LAUNCHER_DEST), 'plan2code.png');

function getNpmGlobalBinDir() {
  try {
    const prefix = execSync('npm config get prefix', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!prefix) return null;
    return process.platform === 'win32' ? prefix : path.join(prefix, 'bin');
  } catch {
    return null;
  }
}

function isDirOnPath(dir) {
  const normalize = (p) => {
    const resolved = path.resolve(p.replace(/^"|"$/g, '')).replace(/[\\/]+$/, '');
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  const target = normalize(dir);
  return (process.env.PATH || '').split(path.delimiter).filter(Boolean).some((entry) => normalize(entry) === target);
}

function isDirWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Where the command can live: npm's global bin first (on PATH wherever Node was installed
 * normally), then ~/.local/bin on macOS/Linux for a system Node whose prefix needs sudo.
 */
function getLauncherBinCandidates() {
  const dirs = [getNpmGlobalBinDir()];
  if (process.platform !== 'win32') dirs.push(path.join(os.homedir(), '.local', 'bin'));
  return [...new Set(dirs.filter(Boolean))];
}

/**
 * Shims written into the bin directory: the same trio npm creates for a global bin on
 * Windows (sh for Git Bash, .cmd for cmd.exe, .ps1 for PowerShell), just the sh one elsewhere.
 * Each runs the Node that ran the installer (`nodePath`, an absolute path) rather than `node`
 * from PATH, because a desktop entry starts without the shell profile that puts an nvm Node
 * on PATH, and `nvm use` can swap that Node later. If the path is gone (Node was upgraded or
 * removed), the shim falls back to `node` on PATH, as npm's own shims do.
 */
function getLauncherShims(binDir, nodePath = process.execPath) {
  const base = path.join(binDir, LAUNCHER_COMMAND);
  const shQuote = (value) => `'${value.replace(/'/g, "'\\''")}'`;
  const psQuote = (value) => `'${value.replace(/'/g, "''")}'`;
  const cmdEscape = (value) => value.replace(/%/g, '%%');
  const posixNode = shQuote(nodePath.replace(/\\/g, '/'));
  const posixDest = shQuote(LAUNCHER_DEST.replace(/\\/g, '/'));
  const shims = [
    {
      file: base,
      content: [
        '#!/bin/sh',
        `# ${LAUNCHER_MARKER}`,
        `NODE=${posixNode}`,
        `if [ -x "$NODE" ]; then exec "$NODE" ${posixDest} "$@"; else exec node ${posixDest} "$@"; fi`,
        '',
      ].join('\n'),
    },
  ];
  if (process.platform === 'win32') {
    const cmdNode = cmdEscape(nodePath);
    const cmdDest = cmdEscape(LAUNCHER_DEST);
    shims.push(
      {
        file: `${base}.cmd`,
        content: [
          '@echo off',
          `rem ${LAUNCHER_MARKER}`,
          `if not exist "${cmdNode}" goto p2c_path_node`,
          // Each command ends its own line with `& exit /b`: cmd.exe reads a running .cmd by byte
          // offset, and `plan2code update` rewrites this file while it runs, so nothing may be read
          // after the command returns. A bare `exit /b` keeps the command's exit code.
          `"${cmdNode}" "${cmdDest}" %* & exit /b`,
          ':p2c_path_node',
          `node "${cmdDest}" %* & exit /b`,
          '',
        ].join('\r\n'),
      },
      {
        file: `${base}.ps1`,
        content: [
          '#!/usr/bin/env pwsh',
          `# ${LAUNCHER_MARKER}`,
          `$node = ${psQuote(nodePath)}`,
          "if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { $node = 'node' }",
          `& $node ${psQuote(LAUNCHER_DEST)} $args`,
          'exit $LASTEXITCODE',
          '',
        ].join('\r\n'),
      }
    );
  }
  return shims;
}

/**
 * Write one launcher shim. A file already there that lacks the launcher marker is someone
 * else's `plan2code`: it is renamed to `<file>.bak` first (replacing an older .bak), never
 * deleted. Returns `{ backup }`, the .bak path when one was made, else null.
 */
function writeLauncherShim(shim) {
  let backup = null;
  if (fs.existsSync(shim.file) && !isOurLauncherShim(shim.file)) {
    backup = `${shim.file}.bak`;
    fs.rmSync(backup, { force: true });
    fs.renameSync(shim.file, backup);
  }
  fs.rmSync(shim.file, { force: true });
  fs.writeFileSync(shim.file, shim.content);
  if (!shim.file.endsWith('.cmd') && !shim.file.endsWith('.ps1')) fs.chmodSync(shim.file, 0o755);
  return { backup };
}

function isOurLauncherShim(file) {
  try {
    return fs.readFileSync(file, 'utf8').includes(LAUNCHER_MARKER);
  } catch {
    return false;
  }
}


function runPowerShell(script, env = {}) {
  return execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  ).trim();
}

/**
 * The person's desktop folder. Windows asks the shell, because OneDrive and group policy
 * often move it off ~/Desktop; Linux asks xdg-user-dir, which knows localized names.
 */
function getDesktopDir() {
  try {
    if (process.platform === 'win32') {
      const dir = runPowerShell("[Console]::OutputEncoding = [Text.Encoding]::UTF8\n[Environment]::GetFolderPath('Desktop')");
      if (dir) return dir;
    } else if (process.platform !== 'darwin') {
      const dir = execFileSync('xdg-user-dir', ['DESKTOP'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (dir && path.resolve(dir) !== os.homedir()) return dir;
    }
  } catch {}
  return path.join(os.homedir(), 'Desktop');
}

/**
 * Where the desktop shortcut lives: a .lnk on Windows, a .command Terminal opens on macOS,
 * a .desktop entry on Linux.
 */
function getShortcutFile(desktopDir = getDesktopDir()) {
  if (process.platform === 'win32') return path.join(desktopDir, `${SHORTCUT_NAME}.lnk`);
  if (process.platform === 'darwin') return path.join(desktopDir, `${SHORTCUT_NAME}.command`);
  return path.join(desktopDir, `${SHORTCUT_NAME.toLowerCase()}.desktop`);
}

/**
 * The macOS/Linux shortcuts carry the launcher marker as a comment. A .lnk has nowhere to hide
 * one (its Description is the hover tooltip), so it is recognized by what it runs: the
 * `plan2code.ps1` shim with `--pick-folder`, both stored in the .lnk as UTF-16. The
 * `plan2code.cmd` target of earlier shortcuts still counts, so a reinstall upgrades them.
 */
function isOurShortcut(file) {
  try {
    const content = fs.readFileSync(file);
    if (file.endsWith('.lnk')) {
      const has = (text) => content.includes(Buffer.from(text, 'utf16le'));
      return has(LAUNCHER_PICK_FOLDER_FLAG) && (has(`${LAUNCHER_COMMAND}.ps1`) || has(`${LAUNCHER_COMMAND}.cmd`));
    }
    return content.includes(LAUNCHER_MARKER);
  } catch {
    return false;
  }
}

/**
 * Put a shortcut on the desktop that runs `plan2code --pick-folder` through the shim in
 * `binDir`, so the person picks the project folder in a native dialog before the CLI opens.
 * It is the same `plan2code` command as a typed one, so it opens the desktop app instead
 * when the app is installed (the launcher decides; the shortcut never names the app).
 * On Windows it opens in PowerShell — PowerShell 7 (`pwsh`) when installed, Windows
 * PowerShell otherwise — running the `.ps1` shim, rather than cmd.exe running the `.cmd` one.
 */
function installDesktopShortcut(binDir, file) {
  const shim = path.join(binDir, LAUNCHER_COMMAND);

  try {
    if (!fs.statSync(path.dirname(file)).isDirectory()) throw new Error('not a folder');
  } catch {
    console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} No desktop folder found at ${path.dirname(file)} — skipped the shortcut`);
    return 1;
  }

  try {
    if (process.platform === 'win32') {
      let icon = '';
      try {
        fs.copyFileSync(SHORTCUT_ICON_SRC, SHORTCUT_ICON_DEST);
        icon = SHORTCUT_ICON_DEST;
      } catch {}
      runPowerShell(
        [
          '$pwsh = Get-Command pwsh.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1',
          "$target = if ($pwsh) { $pwsh.Source } else { Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe' }",
          '$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($env:P2C_FILE)',
          '$shortcut.TargetPath = $target',
          `$shortcut.Arguments = "-NoLogo -ExecutionPolicy Bypass -File \`"$($env:P2C_SCRIPT)\`" $($env:P2C_ARGS)"`,
          '$shortcut.WorkingDirectory = $env:USERPROFILE',
          '$shortcut.Description = $env:P2C_DESCRIPTION',
          'if ($env:P2C_ICON) { $shortcut.IconLocation = "$($env:P2C_ICON),0" }',
          '$shortcut.Save()',
        ].join('\n'),
        {
          P2C_FILE: file,
          P2C_SCRIPT: `${shim}.ps1`,
          P2C_ARGS: LAUNCHER_PICK_FOLDER_FLAG,
          P2C_DESCRIPTION: 'Open Plan2Code: the desktop app when it is installed, otherwise your agent in a terminal',
          P2C_ICON: icon,
        }
      );
    } else if (process.platform === 'darwin') {
      fs.writeFileSync(file, `#!/bin/sh\n# ${LAUNCHER_MARKER}\nexec "${shim}" ${LAUNCHER_PICK_FOLDER_FLAG}\n`);
      fs.chmodSync(file, 0o755);
    } else {
      let icon = '';
      try {
        fs.copyFileSync(SHORTCUT_PNG_SRC, SHORTCUT_PNG_DEST);
        icon = SHORTCUT_PNG_DEST;
      } catch {}
      fs.writeFileSync(
        file,
        [
          '[Desktop Entry]',
          `# ${LAUNCHER_MARKER}`,
          'Type=Application',
          `Name=${SHORTCUT_NAME}`,
          'Comment=Open Plan2Code: the desktop app when it is installed, otherwise your agent in a terminal',
          `Exec="${shim}" ${LAUNCHER_PICK_FOLDER_FLAG}`,
          ...(icon ? [`Icon=${icon}`] : []),
          'Terminal=true',
          'Categories=Development;',
          '',
        ].join('\n')
      );
      fs.chmodSync(file, 0o755);
      // GNOME only launches a desktop file once it is marked trusted; elsewhere this is a no-op.
      try {
        execFileSync('gio', ['set', file, 'metadata::trusted', 'true'], { stdio: 'ignore' });
      } catch {}
    }
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Created: ${file}`);
    return 0;
  } catch (error) {
    console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} Failed to create the desktop shortcut: ${error.message}`);
    return 1;
  }
}

/**
 * Offer the desktop shortcut after the command is in place. One that is already there is
 * refreshed without asking, since the shim it points at may have moved.
 */
async function offerDesktopShortcut(binDir) {
  const file = getShortcutFile();
  if (isOurShortcut(file)) return installDesktopShortcut(binDir, file);
  if (!process.stdin.isTTY) return 0;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(`  ${COLORS.CYAN}Also add a ${SHORTCUT_NAME} shortcut to your desktop?${COLORS.RESET} (y/N): `, resolve);
  });
  rl.close();

  return answer.trim().toLowerCase().startsWith('y') ? installDesktopShortcut(binDir, file) : 0;
}

/**
 * Install the global `plan2code` command, then offer the desktop shortcut. `quiet` prints
 * compact lines for use inside the skills install instead of a section of its own;
 * `unattended` (plan2code update) skips the shortcut offer and leaves any shortcut as it is.
 * `outcome` receives `binDir` and `pathMissing` (that folder is not on PATH) for the next steps.
 */
async function installLauncher({ quiet = false, unattended = false, outcome = {} } = {}) {
  if (quiet) {
    console.log(`${COLORS.BRIGHT}Installing the ${LAUNCHER_COMMAND} command${COLORS.RESET}`);
  } else {
    displaySectionHeader('Installing the plan2code command');
  }

  if (!fs.existsSync(LAUNCHER_SRC)) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} src/launcher/plan2code.js not found`);
    return 1;
  }

  try {
    fs.mkdirSync(path.dirname(LAUNCHER_DEST), { recursive: true });
    fs.copyFileSync(LAUNCHER_SRC, LAUNCHER_DEST);
    // The curated model menu is the authors' source of truth, so it is overwritten on every install.
    // Models the user added in User Preferences live in ~/.plan2code/models.json and are untouched.
    fs.copyFileSync(MODELS_SRC, MODELS_DEST);
    fs.copyFileSync(UPDATE_CHECK_SRC, UPDATE_CHECK_DEST);
    fs.copyFileSync(AGENTS_SRC, AGENTS_DEST);
    fs.copyFileSync(AGENT_LOOKUP_SRC, AGENT_LOOKUP_DEST);
    fs.writeFileSync(LAUNCHER_VERSION_DEST, JSON.stringify(projectVersion, null, 2) + '\n');
    if (process.platform !== 'win32') fs.chmodSync(LAUNCHER_DEST, 0o755);
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Installed: ${LAUNCHER_DEST}`);
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to copy launcher: ${error.message}`);
    return 1;
  }

  const candidates = getLauncherBinCandidates();
  const binDir =
    candidates.find((dir) => isDirWritable(dir) && isDirOnPath(dir)) || candidates.find((dir) => isDirWritable(dir));
  if (!binDir) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} No writable bin directory found (tried: ${candidates.join(', ') || 'none'})`);
    console.log(`  ${COLORS.DIM}Link it by hand:${COLORS.RESET} ${COLORS.CYAN}sudo ln -sf "${LAUNCHER_DEST}" /usr/local/bin/${LAUNCHER_COMMAND}${COLORS.RESET}`);
    return 1;
  }

  try {
    for (const shim of getLauncherShims(binDir)) {
      const { backup } = writeLauncherShim(shim);
      if (backup) console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} ${shim.file} was not Plan2Code's, so it was saved as ${backup}`);
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Created: ${shim.file}`);
    }
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to create the ${LAUNCHER_COMMAND} command: ${error.message}`);
    return 1;
  }

  outcome.binDir = binDir;
  outcome.pathMissing = !isDirOnPath(binDir);
  if (outcome.pathMissing && unattended) {
    // No next steps follow an unattended run, so the fix goes on this line.
    const fix = pathFixLine(binDir);
    console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} ${binDir} is not on your PATH. Add it ${fix.file ? `to ${fix.file}` : 'in PowerShell'}: ${fix.line}`);
  } else if (outcome.pathMissing) {
    console.log(`  ${COLORS.YELLOW}${MARKS.WARN}${COLORS.RESET} ${binDir} is not on your PATH yet: the steps below say how to add it`);
  }
  recordInstalled('launcher');
  // The shortcut is a convenience on top of the command, so a failure here only warns.
  if (!unattended) await offerDesktopShortcut(binDir);
  console.log('');
  // Inside install() the final summary prints the steps once, after everything else.
  if (!quiet) await printGettingStarted({ commandInstalled: true, pathMissing: outcome.pathMissing, binDir });

  return 0;
}

/**
 * Remove the global `plan2code` command. Only shims carrying the launcher marker are
 * touched, so a `plan2code` bin from anything else is left alone.
 */
function uninstallLauncher() {
  displaySectionHeader('Uninstalling the plan2code command');

  let removedCount = 0;
  const remove = (file) => {
    try {
      fs.rmSync(file, { force: true });
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${file}`);
      removedCount++;
    } catch (error) {
      console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to remove ${file}: ${error.message}`);
    }
  };

  for (const binDir of getLauncherBinCandidates()) {
    for (const { file } of getLauncherShims(binDir)) {
      if (isOurLauncherShim(file)) remove(file);
    }
  }
  const shortcut = getShortcutFile();
  if (isOurShortcut(shortcut)) remove(shortcut);
  forgetInstalled('launcher');
  for (const file of [LAUNCHER_DEST, MODELS_DEST, UPDATE_CHECK_DEST, LAUNCHER_VERSION_DEST, SHORTCUT_ICON_DEST, SHORTCUT_PNG_DEST, LAUNCHER_STATE, INSTALL_RECORD, AGENTS_DEST, AGENT_LOOKUP_DEST]) {
    if (fs.existsSync(file)) remove(file);
  }
  try {
    fs.rmdirSync(path.dirname(LAUNCHER_DEST));
  } catch {}

  if (removedCount === 0) {
    console.log(`  ${COLORS.DIM}No ${LAUNCHER_COMMAND} command found${COLORS.RESET}`);
  }
  console.log('');

  return 0;
}

// ============================================================================
// DESKTOP APP
// ============================================================================

/**
 * The desktop app is one plain executable per system, attached to each GitHub release by
 * .github/workflows/release-app.yml as `plan2code-app-<version>-<os>-<arch>[.exe]` beside
 * `plan2code-app-<version>-SHA256SUMS.txt`. Installing it downloads the file for this machine,
 * checks it against that list and puts it in ~/.plan2code/app/, where the launcher looks.
 * PLAN2CODE_RELEASE_BASE replaces the release download URL (the tests serve a stand-in).
 * The app is an extra on top of the skills and the command: when it cannot be installed they
 * stay installed, and `plan2code --classic` is today's flow.
 */
const APP_DIR = path.join(os.homedir(), '.plan2code', 'app');
const APP_DEST = path.join(APP_DIR, process.platform === 'win32' ? 'plan2code-app.exe' : 'plan2code-app');
const APP_DOWNLOAD_TIMEOUT_MS = 120000;

function releaseBase(version) {
  const base = process.env.PLAN2CODE_RELEASE_BASE || `https://github.com/jparkerweb/plan2code/releases/download/v${version}`;
  return base.replace(/\/+$/, '');
}

/** The release file for a system, or null when the app is not built for it. */
function appAssetName(version, platform = process.platform, arch = process.arch) {
  const system = { win32: 'windows', darwin: 'macos', linux: 'linux' }[platform];
  const cpu = { x64: 'x64', arm64: 'arm64' }[arch];
  if (!system || !cpu) return null;
  return `plan2code-app-${version}-${system}-${cpu}${platform === 'win32' ? '.exe' : ''}`;
}

/** The SHA-256 a checksum list (`<hex>  <name>` or `<hex> *<name>` lines) gives for `name`, or null. */
function checksumFor(list, name) {
  for (const line of list.split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (match && match[2] === name) return match[1].toLowerCase();
  }
  return null;
}

// The app guide's section on allowing the not code-signed app, and the one line for this OS.
const APP_GUIDE_URL = 'https://github.com/jparkerweb/plan2code/blob/main/docs/desktop-app.md#the-app-is-not-code-signed';

function appAllowLine(platform = process.platform) {
  if (platform === 'win32') return 'If SmartScreen stops it, press More info, then Run anyway.';
  if (platform === 'darwin') return 'If macOS stops it, open System Settings, Privacy & Security, and press Open Anyway.';
  return 'Nothing to allow on Linux.';
}

/** A byte count for people: "512 KB", "12.3 MB". */
function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The bytes at `url`; an HTTP error is thrown with its `status`. With `progress` (a label), the
 * body is streamed and shown: the size when the server sends it, a percentage redrawn on one
 * line on a terminal, or one plain line when piped.
 */
async function download(url, { progress = '', stream = process.stdout } = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(APP_DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} from ${url}`);
    error.status = response.status;
    throw error;
  }
  if (!progress || !response.body) return Buffer.from(await response.arrayBuffer());
  const total = Number(response.headers.get('content-length')) || 0;
  const size = total ? ` (${formatBytes(total)})` : '';
  const tty = Boolean(stream.isTTY);
  if (!tty) console.log(`  Downloading ${progress}${size}...`);
  const chunks = [];
  let received = 0;
  let shown = -1;
  const draw = () => {
    const percent = total ? Math.min(100, Math.floor((received / total) * 100)) : null;
    const now = percent === null ? Math.floor(received / (256 * 1024)) : percent;
    if (now === shown) return;
    shown = now;
    const where = percent === null ? formatBytes(received) : `${percent}%`;
    stream.write(`\r  Downloading ${progress}${size}... ${where}\x1b[K`);
  };
  try {
    for await (const chunk of response.body) {
      chunks.push(Buffer.from(chunk));
      received += chunk.length;
      if (tty) draw();
    }
  } finally {
    if (tty) stream.write('\r\x1b[K');
  }
  return Buffer.concat(chunks);
}

/**
 * Put the app at `dest`, replacing an older one. The new file is written beside it first, and
 * the old one is renamed aside rather than overwritten: Windows will not overwrite a running
 * program but will rename it, and the old file goes when the app next ends.
 */
function placeApp(bytes, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.tmp`;
  const aside = `${dest}.old`;
  fs.writeFileSync(tmp, bytes, { mode: 0o755 });
  try {
    fs.rmSync(aside, { force: true });
  } catch {}
  let movedAside = false;
  try {
    fs.renameSync(dest, aside);
    movedAside = true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      fs.rmSync(tmp, { force: true });
      throw error;
    }
  }
  try {
    fs.renameSync(tmp, dest);
  } catch (error) {
    if (movedAside) {
      try {
        fs.renameSync(aside, dest);
      } catch {}
    }
    fs.rmSync(tmp, { force: true });
    throw error;
  }
  try {
    fs.rmSync(aside, { force: true });
  } catch {}
  if (process.platform !== 'win32') fs.chmodSync(dest, 0o755);
}

/**
 * Download, verify and place the desktop app for this release. Returns 0, or 1 after saying
 * plainly why not (and that the skills and the command are fine); `outcome.app` is true or false.
 */
async function installDesktopApp({ quiet = false, unattended = false, outcome = {} } = {}) {
  if (quiet) {
    console.log(`${COLORS.BRIGHT}Installing the desktop app${COLORS.RESET}`);
  } else {
    displaySectionHeader('Installing the desktop app');
  }
  const version = projectVersion.version;
  const name = appAssetName(version);
  const base = releaseBase(version);
  const fail = (reason) => {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} The desktop app was not installed: ${reason}`);
    console.log(`  ${COLORS.DIM}The skills and the plan2code command are installed and work as before; run ${COLORS.CYAN}plan2code --classic${COLORS.DIM} to stay in your terminal, or install again later.${COLORS.RESET}`);
    console.log('');
    outcome.app = false;
    return 1;
  };
  // No build for this system or this release yet (the version is bumped on main before the
  // release's files are attached): not a failure when unattended, since an update must not fail
  // for it and an app that is installed stays as it is.
  const noBuild = (reason) => {
    if (!unattended) return fail(reason);
    outcome.app = false;
    outcome.appMissing = reason;
    console.log(`  ${COLORS.DIM}No desktop app update: ${reason}${COLORS.RESET}`);
    console.log('');
    return 0;
  };

  if (!name) return noBuild(`there is no desktop app build for ${process.platform}-${process.arch}.`);
  let bytes;
  try {
    const list = (await download(`${base}/plan2code-app-${version}-SHA256SUMS.txt`)).toString('utf8');
    const expected = checksumFor(list, name);
    if (!expected) return fail(`the release's checksum list has no entry for ${name}.`);
    bytes = await download(`${base}/${name}`, { progress: 'the desktop app' });
    const actual = crypto.createHash('sha256').update(bytes).digest('hex');
    if (actual !== expected) {
      return fail(`${name} does not match its checksum (expected ${expected.slice(0, 12)}..., got ${actual.slice(0, 12)}...), so it was thrown away.`);
    }
  } catch (error) {
    return error.status === 404
      ? noBuild(`release v${version} has no desktop app file for ${process.platform}-${process.arch} yet.`)
      : fail(`could not download it (${error.message}).`);
  }
  try {
    placeApp(bytes, APP_DEST);
  } catch (error) {
    return fail(`the file was verified but could not be put in ${APP_DIR} (${error.message}); close the app and try again.`);
  }
  recordInstalled('app');
  outcome.appSize = bytes.length;
  console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Installed: ${APP_DEST}`);
  console.log(`  The app is not code-signed. ${appAllowLine()}`);
  console.log(`  ${COLORS.DIM}App guide: ${APP_GUIDE_URL}${COLORS.RESET}`);
  console.log('');
  outcome.app = true;
  return 0;
}

/**
 * The app step of a skills install. Interactive: ask (default yes), and remember a no.
 * Unattended (`plan2code update`): yes, without asking, unless the app is already recorded (the
 * update loop updates it as its own piece) or was declined before.
 */
async function offerDesktopApp({ unattended = false, outcome = {} } = {}) {
  const record = readInstallRecord();
  // A system the app is not built for is never asked about, or retried on every update.
  if (!appAssetName(projectVersion.version)) {
    if (!unattended) console.log(`  ${COLORS.DIM}No desktop app is built for ${process.platform}-${process.arch}; skipping it.${COLORS.RESET}`);
    return;
  }
  if (unattended) {
    if (record && (record.pieces.includes('app') || (record.skipped || []).includes('app'))) return;
    await installDesktopApp({ quiet: true, unattended, outcome });
    return;
  }
  if (!process.stdin.isTTY) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(`  ${COLORS.CYAN}Also install the Plan2Code desktop app?${COLORS.RESET} (Y/n): `, resolve);
  });
  rl.close();
  if (answer.trim().toLowerCase().startsWith('n')) {
    recordSkipped('app');
    return;
  }
  await installDesktopApp({ quiet: true, outcome });
}

/** Remove the desktop app and what the installer left beside it. */
function uninstallDesktopApp() {
  displaySectionHeader('Uninstalling the desktop app');
  let removed = false;
  for (const file of [APP_DEST, `${APP_DEST}.old`]) {
    if (!fs.existsSync(file)) continue;
    try {
      fs.rmSync(file, { force: true });
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${file}`);
      removed = true;
    } catch (error) {
      console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to remove ${file}: ${error.message}`);
    }
  }
  forgetInstalled('app');
  try {
    fs.rmdirSync(APP_DIR);
  } catch {}
  if (!removed) console.log(`  ${COLORS.DIM}No desktop app found${COLORS.RESET}`);
  console.log('');
  return 0;
}

// ============================================================================
// UNINSTALL ALL (`plan2code uninstall` runs the npx install with --uninstall)
// ============================================================================

/** What an uninstall did, for the closing block: names removed, what could not go, and what is left to do. */
function newUninstallReport() {
  return { removed: [], failed: [], finish: [] };
}

/** `fn` run with console output held back, so a piece's own headings and file lines stay out of the summary. */
function captureSync(fn) {
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(stripAnsi(args.join(' ')));
  try {
    return { value: fn(), lines };
  } catch (error) {
    return { error, lines };
  } finally {
    console.log = log;
  }
}

/** `{ removed, failed }` from what captured uninstall steps printed: their "Removed" and failure lines. */
function tallyCaptured(...runs) {
  const tally = { removed: 0, failed: [] };
  for (const run of runs) {
    if (run.error) tally.failed.push(run.error.message);
    for (const line of run.lines) {
      const text = line.trim();
      if (text.startsWith(`${MARKS.DONE} Removed`)) tally.removed++;
      else if (text.startsWith(MARKS.FAIL)) tally.failed.push(text.slice(MARKS.FAIL.length).trim());
    }
  }
  return tally;
}

/**
 * Delete the plan2code skill folders under ~/.agents/skills directly, for when the skills CLI
 * cannot be reached. Returns `{ removed, failed }` (folder names; failures with the reason).
 */
function removeSkillsDirectly(store = path.join(os.homedir(), '.agents', 'skills')) {
  const result = { removed: [], failed: [] };
  let names = [];
  try {
    names = fs.readdirSync(store);
  } catch {
    return result;
  }
  for (const name of names) {
    if (name !== 'plan2code' && !name.startsWith('plan2code-')) continue;
    try {
      fs.rmSync(path.join(store, name), { recursive: true, force: true });
      result.removed.push(name);
    } catch (error) {
      result.failed.push(`${name}: ${error.message}`);
    }
  }
  return result;
}

/**
 * Remove the skills. The skills CLI goes first so it can unlink every agent; when it cannot be
 * reached (offline, no npx), the folders are deleted directly and the closing block says agent
 * links may remain. `cli` is replaceable in tests. Returns `{ removed, failed, detail }`.
 */
function uninstallSkillsPiece(report, { cli = { ensure: ensureSkillsCli, remove: removeInstalledSkills } } = {}) {
  const failed = [];
  let removed = 0;
  if (listInstalledSkills('global').length > 0) {
    const run = captureSync(() => (cli.ensure() ? cli.remove('global', { quiet: true }) : -1));
    if (run.error || run.value < 0) {
      const direct = removeSkillsDirectly();
      removed = direct.removed.length;
      failed.push(...direct.failed);
      report.finish.push('The skills CLI could not be reached, so the skill folders were removed directly. Links in your agents own skills folders (for example ~/.claude/skills) may remain: delete any plan2code entries there.');
    } else {
      removed = run.value;
    }
  }
  const legacy = cleanLegacyPaths(true);
  removed += legacy.removed;
  if (legacy.errors > 0) failed.push(`${legacy.errors} file(s) from earlier versions`);
  if (failed.length === 0) forgetInstalled('skills');
  return { removed, failed, detail: removed > 0 ? String(removed) : '' };
}

/** Stop the console servers this folder's project has running; the count stopped. Best effort, never throws. */
function stopConsoleServers(home) {
  try {
    const current = fs.readFileSync(path.join(home, 'console-dir'), 'utf8').trim();
    const script = current ? path.join(current, 'console.mjs') : '';
    if (!script || !fs.existsSync(script)) return 0;
    const run = require('child_process').spawnSync(process.execPath, [script, 'stop', '--all'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
    return Number(JSON.parse(String(run.stdout || '{}')).stopped) || 0;
  } catch {
    return 0;
  }
}

/**
 * Remove the versioned console folders under the console home and its console-dir pointer (the
 * sweepOldConsoles() pattern, for every version). Sessions, settings and notebooks stay. A
 * console server still running holds its files open, so it is stopped first and the line says so.
 */
function removeConsoleFolders(report, { stop = stopConsoleServers } = {}) {
  const home = consoleHomeDir();
  let entries = [];
  try {
    entries = fs.readdirSync(home, { withFileTypes: true });
  } catch {
    return;
  }
  const versions = entries.filter((entry) => entry.isDirectory() && CONSOLE_VERSION_DIR.test(entry.name));
  const pointer = path.join(home, 'console-dir');
  if (versions.length === 0 && !fs.existsSync(pointer)) return;
  const stopped = stop(home);
  if (stopped > 0) {
    console.log(`  ${COLORS.DIM}Stopped ${stopped} running Plan2Code console${stopped === 1 ? '' : 's'} first, so ${stopped === 1 ? 'its' : 'their'} files could be removed.${COLORS.RESET}`);
  }
  let removed = 0;
  for (const entry of versions) {
    try {
      fs.rmSync(path.join(home, entry.name), { recursive: true, force: true });
      removed++;
    } catch (error) {
      report.failed.push(`Console files ${entry.name}: ${error.message}`);
      const hint = 'Close any open Plan2Code console or app, then run plan2code uninstall again.';
      if (!report.finish.includes(hint)) report.finish.push(hint);
    }
  }
  try {
    fs.rmSync(pointer, { force: true });
  } catch {}
  if (removed > 0) {
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed Console files`);
    report.removed.push('Console files');
  }
}

/** Each piece's uninstall, quiet: it returns `{ removed, failed, detail? }` and the caller prints one line. */
const UNINSTALL_STEPS = {
  skills: (report) => uninstallSkillsPiece(report),
  launcher: () => tallyCaptured(captureSync(removeLegacyLoopShims), captureSync(uninstallLauncher)),
  app: () => tallyCaptured(captureSync(uninstallDesktopApp)),
  statusline: () => tallyCaptured(captureSync(uninstallStatusLine)),
  metrics: () => tallyCaptured(captureSync(uninstallPlan2CodeMetrics)),
  bot: () => tallyCaptured(captureSync(uninstallPlan2CodeBot)),
};

/**
 * A quiet look for a piece that install.json does not list but is on disk (a record lost or
 * written by an older install). The dev tools (metrics, bot) are only ever recorded.
 */
const UNINSTALL_PROBES = {
  skills: () => listInstalledSkills('global').length > 0,
  launcher: () =>
    fs.existsSync(LAUNCHER_DEST) ||
    getLauncherBinCandidates().some((dir) => getLauncherShims(dir).some(({ file }) => isOurLauncherShim(file))),
  app: () => fs.existsSync(APP_DEST) || fs.existsSync(`${APP_DEST}.old`),
  statusline: () => fs.existsSync(path.join(os.homedir(), '.claude', 'plan2code-statusline.js')),
};

/**
 * Everything Plan2Code installed. Driven by the pieces ~/.plan2code/install.json records plus a
 * quiet probe for strays: one line per piece actually removed, and nothing for a piece that was
 * never installed. Your own data under ~/.plan2code (notebooks, handoffs, console settings) stays;
 * see purgeData(). `report` collects the closing block's lists. `steps`, `probes` and
 * `removeConsole` are replaceable in tests. Returns 0, or 1 when something could not be removed.
 */
function uninstallAll({ report = newUninstallReport(), steps = UNINSTALL_STEPS, probes = UNINSTALL_PROBES, removeConsole = removeConsoleFolders } = {}) {
  const recorded = (readInstallRecord() || {}).pieces || [];
  let code = 0;
  for (const piece of INSTALL_PIECES) {
    if (!recorded.includes(piece) && !(probes[piece] && probes[piece]())) continue;
    let result;
    try {
      result = steps[piece](report);
    } catch (error) {
      result = { removed: 0, failed: [error.message] };
    }
    const label = PIECE_LABELS[piece];
    if (result.removed > 0) {
      const named = result.detail ? `${label} (${result.detail})` : label;
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed ${named}`);
      report.removed.push(named);
    }
    for (const message of result.failed) {
      console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} ${label}: ${message}`);
      report.failed.push(`${label}: ${message}`);
      code = 1;
    }
  }
  removeConsole(report);
  return code || (report.failed.length > 0 ? 1 : 0);
}

/** What the uninstall leaves in the data folder: a name for each entry and its size. */
const DATA_LABELS = {
  notepads: 'Notebooks',
  handoffs: 'Handoffs',
  console: 'Console settings and sessions',
  learning: 'Learning pauses',
  prototypes: 'Prototypes',
  'models.json': 'Models you added',
  'agents.json': 'Agents you added',
  'app.json': 'Desktop app settings',
  'launcher.json': 'plan2code command settings',
};

/** Bytes under `target`, never following a link. */
function pathBytes(target) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  try {
    for (const name of fs.readdirSync(target)) total += pathBytes(path.join(target, name));
  } catch {}
  return total;
}

/** `[{ name, label, bytes }]` for what is left in the data folder, largest first. */
function listKeptData(home = PLAN2CODE_HOME) {
  let names = [];
  try {
    names = fs.readdirSync(home);
  } catch {
    return [];
  }
  return names
    .map((name) => ({ name, label: DATA_LABELS[name] || name, bytes: pathBytes(path.join(home, name)) }))
    .sort((x, y) => y.bytes - x.bytes || x.name.localeCompare(y.name));
}

/** What stays in the data folder after an uninstall, by name with its size. */
function printKeptData() {
  console.log(`${COLORS.DIM}Your data in ${PLAN2CODE_HOME} was kept. Delete the folder to remove it.${COLORS.RESET}`);
  for (const item of listKeptData()) console.log(`${COLORS.DIM}  ${item.label}: ${formatBytes(item.bytes)}${COLORS.RESET}`);
  console.log('');
}

/** The closing block, always printed: what was removed, what could not be, and what is left for the person to do. */
function printUninstallReport(report) {
  console.log(`${COLORS.BRIGHT}Removed:${COLORS.RESET} ${report.removed.length > 0 ? report.removed.join(', ') : 'nothing'}`);
  if (report.failed.length === 0) {
    console.log(`${COLORS.BRIGHT}Could not remove:${COLORS.RESET} nothing`);
  } else {
    console.log(`${COLORS.RED}${COLORS.BRIGHT}Could not remove:${COLORS.RESET}`);
    for (const item of report.failed) console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} ${item}`);
  }
  if (report.finish.length === 0) {
    console.log(`${COLORS.BRIGHT}To finish:${COLORS.RESET} nothing, you are done`);
  } else {
    console.log(`${COLORS.BRIGHT}To finish:${COLORS.RESET}`);
    for (const item of report.finish) console.log(`  ${item}`);
  }
  console.log('');
}

/** The folder purgeData() empties: Plan2Code's own home, which holds the data uninstallAll() keeps. */
const PLAN2CODE_HOME = path.join(os.homedir(), '.plan2code');

/**
 * Delete ~/.plan2code and everything left in it (notebooks, handoffs, console settings and
 * the installed console). Returns 0 when it is gone, 1 when something could not be removed.
 */
function purgeData(home = PLAN2CODE_HOME) {
  displaySectionHeader('Deleting your Plan2Code data');
  if (!fs.existsSync(home)) {
    console.log(`  ${COLORS.DIM}No ${home} folder found${COLORS.RESET}\n`);
    return 0;
  }
  try {
    fs.rmSync(home, { recursive: true, force: true });
    console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${home}\n`);
    return 0;
  } catch (error) {
    console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to remove ${home}: ${error.message}\n`);
    return 1;
  }
}

/** The desktop app's identifier (tauri.conf.json), which names its webview data folders. */
const APP_IDENTIFIER = 'com.plan2code.desktop';

/**
 * The folders the desktop app's webview keeps its data in, per OS. Windows and Linux: Tauri
 * points the webview at the app's local data folder (`app_local_data_dir()`, seen on a real
 * Windows run as %LOCALAPPDATA%\com.plan2code.desktop\EBWebView). macOS keeps WebKit's own
 * default store, under the bundle identifier or, for the unbundled binary install.js lays down,
 * the program's name; every candidate is listed and only those that exist are removed. Each OS
 * also lists the app's config folder (`app_config_dir()`), where the window-state plugin saves
 * the window's size and place.
 */
function appWebviewDirs({ platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  if (platform === 'win32') {
    return [
      path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), APP_IDENTIFIER),
      path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), APP_IDENTIFIER),
    ];
  }
  if (platform === 'darwin') {
    const names = [APP_IDENTIFIER, 'plan2code-app'];
    return [
      ...['WebKit', 'Caches'].flatMap((dir) => names.map((name) => path.join(home, 'Library', dir, name))),
      path.join(home, 'Library', 'Application Support', APP_IDENTIFIER),
    ];
  }
  return [
    path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), APP_IDENTIFIER),
    path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), APP_IDENTIFIER),
    path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), APP_IDENTIFIER),
  ];
}

/** Remove the app's webview data folders that exist. Returns 0, or 1 when one could not go. */
function purgeAppWebview(dirs = appWebviewDirs()) {
  let code = 0;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  ${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Removed: ${dir}\n`);
    } catch (error) {
      console.log(`  ${COLORS.RED}${MARKS.FAIL}${COLORS.RESET} Failed to remove ${dir}: ${error.message}\n`);
      code = 1;
    }
  }
  return code;
}

/**
 * Whether the desktop app is running, by its program name (`tasklist` on Windows, `pgrep`
 * elsewhere). `run` is spawnSync's shape, replaced in tests. Unknown counts as not running.
 */
function appRunning({ platform = process.platform, run = require('child_process').spawnSync } = {}) {
  try {
    if (platform === 'win32') {
      const r = run('tasklist', ['/FI', 'IMAGENAME eq plan2code-app.exe', '/NH'], { encoding: 'utf8', windowsHide: true });
      return r.status === 0 && /plan2code-app\.exe/i.test(String(r.stdout || ''));
    }
    const r = run('pgrep', ['-x', 'plan2code-app'], { encoding: 'utf8' });
    return r.status === 0;
  } catch {
    return false;
  }
}

/** One y/N question on the terminal; false without a terminal (nothing can answer it). */
async function askYesNo(prompt, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY) return false;
  const rl = readline.createInterface({ input, output });
  const answer = await new Promise((resolve) => rl.question(prompt, resolve));
  rl.close();
  return answer.trim().toLowerCase().startsWith('y');
}

/**
 * `plan2code uninstall`: confirm, remove everything, then ask whether your data goes too.
 * `yes` skips the confirmation (the data stays unless `purge` is set); `purge` deletes the
 * data without asking. `ask` is the y/N prompt, replaced in tests. Returns the exit code.
 */
async function uninstall({ yes = false, purge = false, ask = askYesNo, remove = (report) => uninstallAll({ report }), purgeIt = purgeData, purgeWebview = purgeAppWebview, running = appRunning } = {}) {
  displaySectionHeader('Uninstalling Plan2Code');
  console.log(`${COLORS.DIM}This removes the skills, the plan2code command, the desktop app and any dev tools.${COLORS.RESET}\n`);
  if (!yes && !process.stdin.isTTY && ask === askYesNo) {
    console.log(`${COLORS.YELLOW}${MARKS.WARN} Not a terminal, so nothing can answer the questions. Run plan2code uninstall --yes (add --purge to delete your data too).${COLORS.RESET}\n`);
    return 1;
  }
  if (running()) {
    console.log(`${COLORS.YELLOW}${MARKS.WARN} Plan2Code is running: close it first, or its program file may not be removed.${COLORS.RESET}\n`);
  }
  if (!yes && !(await ask(`${COLORS.RED}Remove everything Plan2Code installed?${COLORS.RESET} (y/N): `))) {
    console.log(`\n${COLORS.YELLOW}${MARKS.WARN} CANCELED${COLORS.RESET}\n`);
    return 0;
  }
  const report = newUninstallReport();
  let code = await remove(report);
  const wipe = purge || (!yes && (await ask(`${COLORS.CYAN}Also delete your Plan2Code data (notebooks, handoffs, settings) in ${PLAN2CODE_HOME}?${COLORS.RESET} (y/N): `)));
  console.log('');
  if (wipe) {
    // The data folder first, then the app's webview data outside it; both run even when the first fails.
    const dataFailed = purgeIt() !== 0;
    // The app's webview data sits outside ~/.plan2code, in the OS's own app data folders.
    const webviewFailed = purgeWebview() !== 0;
    if (dataFailed || webviewFailed) {
      code = 1;
      report.failed.push('Your Plan2Code data');
    } else {
      report.removed.push('Your Plan2Code data');
    }
  } else {
    printKeptData();
  }
  if (code !== 0 && report.failed.length === 0) report.failed.push('One or more pieces (see the messages above)');
  printUninstallReport(report);
  if (code === 0 && report.failed.length > 0) code = 1;
  if (code === 0) console.log(`${COLORS.GREEN}${MARKS.DONE} Plan2Code is uninstalled${COLORS.RESET}\n`);
  return code;
}

// ============================================================================
// UPDATE (`plan2code update` runs the npx install with --update)
// ============================================================================

/**
 * The install function for each recorded piece, in the order update runs them. Install
 * functions only: an update never uninstalls anything. install() covers the skills and the
 * plan2code command together.
 */
const UPDATE_STEPS = {
  skills: install,
  launcher: installLauncher,
  app: installDesktopApp,
  statusline: installStatusLine,
  metrics: installPlan2CodeMetrics,
  bot: installPlan2CodeBot,
};

/** The name of each installed piece as the update and uninstall summaries print it. */
const PIECE_LABELS = { skills: 'Skills', launcher: 'plan2code command', app: 'Desktop app', statusline: 'Status line', metrics: 'Metrics', bot: 'Bot' };

/**
 * Run `fn` (sync or async) with console.log captured, so a step that prints its own headings and
 * progress can run inside a compact summary. Resolves `{ value, lines }` (colors stripped), or
 * `{ error, lines }` when `fn` threw.
 */
async function captureOutput(fn) {
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(stripAnsi(args.join(' ')));
  try {
    return { value: await fn(), lines };
  } catch (error) {
    return { error, lines };
  } finally {
    console.log = log;
  }
}

/** Where a release's notes are. */
function releaseNotesUrl(version) {
  return `https://github.com/jparkerweb/plan2code/releases/tag/v${version}`;
}

/**
 * Reinstall whatever ~/.plan2code/install.json lists, without the menu or any prompt, and print
 * one compact summary: `Updating <old> -> <new>` (or `Already on <new>`, which stops early unless
 * `force`), one line per piece by its human name, then the release notes link and the restart
 * hint. Each piece's own output is held back and shown only when that piece warns or fails.
 * Returns the exit code: 0 when every piece updated, 1 naming the pieces that failed.
 */
async function update({ steps = UPDATE_STEPS, cleanShims = removeLegacyLoopShims, force = false } = {}) {
  const record = readInstallRecord();
  const version = projectVersion.version;
  const before = record && typeof record.version === 'string' ? record.version : null;
  if (before === version && !force) {
    console.log(`${COLORS.GREEN}${MARKS.DONE}${COLORS.RESET} Already on ${version}`);
    console.log(`${COLORS.DIM}Run plan2code update --force to install it again.${COLORS.RESET}`);
    return 0;
  }
  console.log(`${COLORS.BRIGHT}${before ? `Updating ${before} -> ${version}` : `Updating to ${version}`}${COLORS.RESET}`);
  const pieces = record ? record.pieces : ['skills', 'launcher'];
  if (!record) console.log(`${COLORS.DIM}No install record found; updating the skills and the plan2code command.${COLORS.RESET}`);

  await captureOutput(async () => cleanShims());

  const results = {};
  const details = {};
  // What a piece printed that the person should still see: everything when it failed, only the
  // warnings, failures (the desktop app is an extra, so its failure inside the skills step leaves
  // that step at 0) and the app's code-signing note when it worked.
  const surface = (lines, failed) => {
    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      if (failed || text.startsWith(MARKS.WARN) || text.startsWith(MARKS.FAIL) || text.includes('not code-signed')) console.log(`  ${text}`);
    }
  };
  for (const piece of INSTALL_PIECES) {
    if (!pieces.includes(piece) || piece in results) continue;
    // The metrics and bot commands run from this folder: from npx's cache (which the launcher
    // note above calls free to delete) they would break once it is cleared, so only a checkout updates them.
    if ((piece === 'metrics' || piece === 'bot') && !fs.existsSync(path.join(__dirname, '.git'))) {
      results[piece] = 'kept (update it from a git checkout: node install.js)';
      continue;
    }
    const outcome = {};
    const run = await captureOutput(() => steps[piece]({ quiet: true, unattended: true, outcome }));
    if (run.error) {
      results[piece] = `failed: ${run.error.message}`;
    } else {
      results[piece] = run.value === 0 ? 'updated' : 'failed: see the messages above';
      // The release has no app file yet: the installed one stays, and the update does not fail.
      if (piece === 'app' && run.value === 0 && outcome.appMissing) results[piece] = 'kept (no new desktop app file yet)';
    }
    if (outcome.appSize) details.app = formatBytes(outcome.appSize);
    // install() returns 1 when only the command failed, so its outcome says how the skills
    // themselves went; a command it put in place has updated the launcher too, and one it
    // could not is retried on its own as the next piece.
    if (piece === 'skills' && typeof outcome.skills === 'boolean') {
      results.skills = outcome.skills ? 'updated' : 'failed: see the messages above';
    }
    if (piece === 'skills' && outcome.launcher === true) results.launcher = 'updated';
    // The same for the app, when install() brought it in for the first time.
    if (piece === 'skills' && outcome.app === true) results.app = 'updated';
    surface(run.lines, Boolean(run.error) || run.value !== 0);
  }

  console.log('');
  console.log(`${COLORS.BRIGHT}Update summary${COLORS.RESET}`);
  const failed = [];
  for (const piece of INSTALL_PIECES.filter((p) => p in results)) {
    const ok = results[piece] === 'updated' || results[piece].startsWith('kept');
    if (!ok) failed.push(PIECE_LABELS[piece]);
    const more = ok && details[piece] ? ` (${details[piece]})` : '';
    console.log(`  ${ok ? COLORS.GREEN + MARKS.DONE : COLORS.RED + MARKS.FAIL}${COLORS.RESET} ${PIECE_LABELS[piece]}: ${results[piece]}${more}`);
  }
  console.log('');
  if (failed.length > 0) {
    console.log(`${COLORS.RED}${MARKS.FAIL} Update failed for: ${failed.join(', ')}${COLORS.RESET}`);
    // The pieces that did install stamped the new version on the record: take it back, so running
    // plan2code update again retries instead of stopping at "Already on".
    setRecordVersion(before);
    console.log(`To try again, run: ${COLORS.CYAN}plan2code update${COLORS.RESET}`);
    console.log(`To go back to a release, run: ${COLORS.CYAN}plan2code update --tag v${before || '<version>'}${COLORS.RESET}`);
    console.log('');
    return 1;
  }
  // The release had no desktop app file yet, so the installed app is still the old one: keep the
  // old version on the record, or the next update (the app's Update and restart among them) stops
  // at "Already on" and never fetches the app once the file is attached.
  if (before && typeof results.app === 'string' && results.app.startsWith('kept')) setRecordVersion(before);
  console.log(`${COLORS.GREEN}${MARKS.DONE} Plan2Code is up to date (v${version})${COLORS.RESET}`);
  console.log(`What's new: ${releaseNotesUrl(version)}`);
  console.log('Close any open Plan2Code console or app and start `plan2code` again.');
  console.log('');
  return 0;
}

// ============================================================================
// MAIN
// ============================================================================

// Run only when invoked directly; requiring the file (the update tests do) is load-only.
if (require.main === module) {
  // Non-interactive build hooks for the generated skills/ artifact.
  const argv = process.argv.slice(2);

  if (argv.includes('--build-skills')) {
    process.exit(buildSkills() ? 0 : 1);
  } else if (argv.includes('--verify-skills')) {
    process.exit(verifySkillsSync() ? 0 : 1);
  } else if (argv[0] === '--update' && argv.slice(1).every((a) => a === '--force')) {
    update({ force: argv.includes('--force') }).then((code) => process.exit(code));
  } else if (argv[0] === '--uninstall' && argv.slice(1).every((a) => a === '--yes' || a === '--purge')) {
    uninstall({ yes: argv.includes('--yes'), purge: argv.includes('--purge') }).then((code) => process.exit(code));
  } else if (argv.length > 0) {
    console.error(`Unknown option(s): ${argv.join(' ')}`);
    console.error('Usage: node install.js [--build-skills | --verify-skills | --update [--force] | --uninstall [--yes] [--purge]]');
    console.error('Run with no options for the interactive installer.');
    process.exit(1);
  } else {
    runInteractive();
  }
}

module.exports = { printKeptData, uninstallSkillsPiece, removeSkillsDirectly, removeConsoleFolders, uninstallStatusLine, listKeptData, newUninstallReport, printUninstallReport, UNINSTALL_STEPS, UNINSTALL_PROBES, PIECE_LABELS, createSpinner, printGettingStarted, pathFixLine, fullCommandPath, desktopAppState, detectAgents, agentInstallLine, writeLauncherShim, isOurLauncherShim, LAUNCHER_MARKER, NO_TERMINAL_MESSAGE, appAllowLine, APP_GUIDE_URL, formatBytes, nodeVersionProblem, appWebviewDirs, purgeAppWebview, appRunning, uninstall, uninstallAll, purgeData, installSharedConsole, sweepOldConsoles, consoleHomeDir, CONSOLE_SHARED_DIR, update, installDesktopApp, offerDesktopApp, recordSkipped, appAssetName, checksumFor, APP_DEST, UPDATE_STEPS, INSTALL_RECORD, INSTALL_PIECES, readInstallRecord, recordInstalled, forgetInstalled, SOURCE_PROMPTS, generateSkillName };
