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
 * Builds the committed skills/ artifact from source prompts in src/.
 * Supports non-interactive --build-skills and --verify-skills maintenance hooks.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

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

// Color codes for display (ANSI escape sequences)
// Use these in console.log() for colored output
const COLORS = {
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

// Symbols for status reporting
const SYMBOLS = {
  SUCCESS: '▰▰▰',        // Success
  ACTIVE: '►►►',         // Active/In Progress
  WARNING: '⚠ ⚠ ⚠',     // Warning
  ERROR: '✖✖✖',          // Error
  INFO: '◆',             // Info
  SELECT: '◉',           // Selection marker
  COMPLETE: '█',         // Complete
  PENDING: '░',          // Pending
  DIVIDER: '═',          // Divider
  CORNER_TL: '╔',        // Box corners
  CORNER_TR: '╗',
  CORNER_BL: '╚',
  CORNER_BR: '╝',
  HORIZONTAL: '═',
  VERTICAL: '║',
  TEE_RIGHT: '╠',
  TEE_LEFT: '╣',
};

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

// Generated skills directory: the committed, canonical Agent Skills build of src/.
// `npm run build:skills` regenerates it and `npm test` (`--verify-skills`) fails on drift.
// `skills add` consumes this directory; nothing else is platform-specific any more.
const SKILLS_DIR_NAME = 'skills';
const SKILLS_DIR = path.join(__dirname, SKILLS_DIR_NAME);

// Source prompts directory
const SRC_DIR = path.join(__dirname, 'src');

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
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-init.md',
    stepNumber: 'init',
    name: 'init',
    displayName: 'Init Mode',
    description: 'Generate AGENTS.md file for project-specific guidance',
    isUtility: true,
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-init-update.md',
    stepNumber: 'update',
    name: 'init-update',
    displayName: 'Init Update Mode',
    description: 'Update existing AGENTS.md with new learnings',
    isUtility: true,
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-0-pathfinder.md',
    stepNumber: '0',
    name: 'pathfinder',
    displayName: 'Pathfinder Mode',
    description: 'charting of a foggy idea as a map of decision questions, cleared one at a time',
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
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
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'plan2code-review.md', target: 'review.md' },
      { source: 'plan2code-review-references' }
    ]
  },
  {
    source: 'plan2code-1-plan.md',
    stepNumber: 1,
    name: 'plan',
    displayName: 'Planning Mode',
    description: 'Requirements analysis and architecture design',
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-1b-revise-plan.md',
    stepNumber: '1b',
    name: 'revise-plan',
    displayName: 'Revision Mode',
    description: 'Modify specs mid-implementation when requirements change',
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-2-document.md',
    stepNumber: 2,
    name: 'document',
    displayName: 'Documentation Mode',
    description: 'Transform planning output into structured implementation docs',
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-3-implement.md',
    stepNumber: 3,
    name: 'implement',
    displayName: 'Implementation Mode',
    description: 'Execute implementation phase by phase',
    // review.md rides along for the web console's review offer on the sign-off
    // card, which runs the review in the same session before the phase is approved.
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'plan2code-review.md', target: 'review.md' },
      { source: 'plan2code-review-references' }
    ]
  },
  {
    source: 'plan2code-3-implement-review.md',
    stepNumber: 3,
    name: 'implement-review',
    displayName: 'Implementation + Review Mode',
    description: 'Implement one phase, review it, then request sign-off',
    additionalReferences: [
      { source: 'web-console', target: 'web-console' },
      { source: 'plan2code-3-implement.md', target: 'implement.md' },
      { source: 'plan2code-review.md', target: 'review.md' },
      { source: 'plan2code-review-references' }
    ]
  },
  {
    source: 'plan2code-review.md',
    stepNumber: 'review',
    name: 'review',
    displayName: 'Review Mode',
    description: 'Comprehensive post-implementation review with spec compliance checking',
    isUtility: true,
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-4-finalize.md',
    stepNumber: 4,
    name: 'finalize',
    displayName: 'Finalization Mode',
    description: 'Validate, summarize, and archive completed work',
    additionalReferences: [{ source: 'web-console', target: 'web-console' }]
  },
  {
    source: 'plan2code-handoff.md',
    stepNumber: 'handoff',
    name: 'handoff',
    displayName: 'Handoff Mode',
    description: 'Compact the conversation into a self-contained handoff document for a fresh session',
    isUtility: true,
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
  if (prompt.stepNumber === 'quick') return 'Quick Task';
  return `Step ${prompt.stepNumber}`;
}

// Helper function to generate YAML frontmatter for SKILL.md files
function generateSkillHeader(prompt, disableModelInvocation = false) {
  const lines = [
    '---',
    `name: ${generateSkillName(prompt)}`,
    `description: "Plan2Code ${generateStepLabel(prompt)}: ${prompt.displayName} - user-initiated workflow step. Do not invoke autonomously."`,
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

/**
 * Display header
 */
function displayHeader() {
  console.log('');
  console.log(`${COLORS.CYAN}${COLORS.BRIGHT}`);
  console.log('╔═════════════════════════════════════════════════════════╗');
  console.log('║              ╭───╮                                      ║');
  console.log('║              │ ★ │╱  Hi! I\'m Planny!                    ║');
  console.log('║             ╱│ ◡ │   Nice to meet you                   ║');
  console.log('║              ╰┬─┬╯   Welcome to Plan2Code!              ║');
  console.log('║                                                         ║');
  console.log('║   G L O B A L   I N S T A L L A T I O N   S Y S T E M   ║');
  console.log('║          https://github.com/jparkerweb/plan2code        ║');
  console.log('║                                                         ║');
  console.log('╚═════════════════════════════════════════════════════════╝');
  console.log(COLORS.RESET);
  console.log('');
}

/**
 * Display section header with border
 */
function displaySectionHeader(title, mode = '') {
  const innerWidth = 75;

  // Center the title with ═ padding
  const titleContent = `[ ${title} ]`;
  const titlePadTotal = innerWidth - titleContent.length;
  const titlePadLeft = Math.floor(titlePadTotal / 2);
  const titlePadRight = titlePadTotal - titlePadLeft;
  const titleLine = '═'.repeat(titlePadLeft) + titleContent + '═'.repeat(titlePadRight);

  console.log(`${COLORS.CYAN}${COLORS.BRIGHT}`);
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log(`║${' '.repeat(innerWidth)}║`);
  console.log(`║${titleLine}║`);
  if (mode) {
    // Center the mode text with space padding
    const modePadTotal = innerWidth - mode.length;
    const modePadLeft = Math.floor(modePadTotal / 2);
    const modePadRight = modePadTotal - modePadLeft;
    console.log(`║${' '.repeat(modePadLeft)}${mode}${' '.repeat(modePadRight)}║`);
  }
  console.log(`║${' '.repeat(75)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log(COLORS.RESET);
}

/**
 * Display operation status box
 */
function displayStatusBox(title, lines) {
  console.log(`${COLORS.BLUE}`);
  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log(`│ ${COLORS.BRIGHT}${title}${COLORS.RESET}${COLORS.BLUE}${' '.repeat(72 - title.length)}│`);
  console.log('├─────────────────────────────────────────────────────────────────────────┤');

  lines.forEach(line => {
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, ''); // Remove color codes for length calc
    const padding = ' '.repeat(Math.max(0, 72 - cleanLine.length));
    console.log(`│ ${line}${padding}│`);
  });

  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log(COLORS.RESET);
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

/**
 * Animated spinner that works with synchronous operations
 * Shows visible progress indicator
 */
function createSpinner() {
  return {
    start: function() {
      process.stdout.write('\n  ⏳ ');
    },
    tick: function() {
      process.stdout.write('█');
    },
    stop: function() {
      process.stdout.write(' ✓\n');
    }
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
    console.error(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Could not delete directory ${dirPath}: ${err.message}`);
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

function computeExpectedSkills() {
  const expected = new Map();
  const errors = [];

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
      if (reference.source === 'web-console') {
        expected.set(
          `${SKILLS_DIR_NAME}/${skillName}/references/${reference.target}/version.json`,
          fs.readFileSync(path.join(__dirname, 'version.json'))
        );
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
  }

  return { expected, errors };
}

function buildSkills(quiet = false) {
  const { expected, errors } = computeExpectedSkills();
  const stats = { written: 0, unchanged: 0, pruned: 0, errors: errors.length };
  for (const message of errors) console.error(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} ${message}`);
  if (!quiet) console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} BUILDING SKILLS${COLORS.RESET} ${COLORS.DIM}src/ -> ${SKILLS_DIR_NAME}/${COLORS.RESET}\n`);

  const expectedSkillNames = new Set(SOURCE_PROMPTS.map(generateSkillName));
  if (fs.existsSync(SKILLS_DIR)) {
    for (const entry of fs.readdirSync(SKILLS_DIR)) {
      const entryPath = path.join(SKILLS_DIR, entry);
      if (!fs.statSync(entryPath).isDirectory() || expectedSkillNames.has(entry)) continue;
      deleteDirectory(entryPath);
      stats.pruned++;
      if (!quiet) console.log(`  ${COLORS.YELLOW}░░░${COLORS.RESET} Pruned: ${entry}/`);
    }
  }

  for (const skillName of expectedSkillNames) {
    const skillDir = path.join(SKILLS_DIR, skillName);
    if (!fs.existsSync(skillDir)) continue;
    for (const relPath of listFilesRecursive(skillDir)) {
      const key = `${SKILLS_DIR_NAME}/${skillName}/${relPath.split(path.sep).join('/')}`;
      if (expected.has(key)) continue;
      fs.rmSync(path.join(skillDir, relPath), { force: true });
      stats.pruned++;
      if (!quiet) console.log(`  ${COLORS.YELLOW}░░░${COLORS.RESET} Pruned: ${key}`);
    }
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
      if (!quiet) console.log(`  ${COLORS.GREEN}▰▰▰${COLORS.RESET} ${relPath}`);
    } catch (err) {
      console.error(`  ${COLORS.RED}✖✖✖${COLORS.RESET} ${relPath}: ${err.message}`);
      stats.errors++;
    }
  }

  if (!quiet) {
    console.log(`\n  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} ${SOURCE_PROMPTS.length} skill(s): ${stats.written} written, ${stats.unchanged} unchanged, ${stats.pruned} pruned`);
    if (stats.errors > 0) console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} ${stats.errors} error(s)`);
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
    console.error(`\n${problems.length} problem(s). Run 'npm run build:skills' and commit the result.`);
    return false;
  }
  console.log(`${SKILLS_DIR_NAME}/ matches src/ — ${expected.size} file(s) across ${SOURCE_PROMPTS.length} skill(s) ✓`);
  return true;
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
        if (!quiet) console.log(`  ${COLORS.YELLOW}░░░${COLORS.RESET} ${legacy.name}: removed ${entry}`);
      } catch (err) {
        stats.errors++;
        if (!quiet) console.log(`  ${COLORS.RED}✖✖✖${COLORS.RESET} ${legacy.name}: could not remove ${entry} — ${err.message}`);
      }
    }
  }
  return stats;
}

// ============================================================================
// SKILLS CLI DELEGATION
// ============================================================================

const SKILLS_CLI = 'npx --yes skills';
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
    console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} ${failure}`);
  }
}

function ensureSkillsCli() {
  const version = runSkillsCli('--version');
  if (version !== null) {
    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} skills CLI ${COLORS.DIM}${version.split('\n').pop()}${COLORS.RESET}`);
    return true;
  }
  console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Could not run the ${COLORS.BRIGHT}skills${COLORS.RESET} CLI.`);
  console.log(`\n  ${COLORS.DIM}Plan2Code installs through skills.sh, which needs Node 18+ and network access.${COLORS.RESET}`);
  console.log(`  ${COLORS.DIM}Check that this works, then re-run the installer:${COLORS.RESET}`);
  console.log(`    ${COLORS.CYAN}npx --yes skills --version${COLORS.RESET}\n`);
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
    if (!quiet) console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} No Plan2Code skills currently installed${COLORS.RESET}`);
    return 0;
  }

  // `skills remove` is variadic and silently skips names that aren't installed, so one call
  // clears the store and unlinks every agent. Passing the full build list alongside what was
  // found also sweeps stray copies an earlier version left outside the store.
  const names = [...new Set([...installed, ...SOURCE_PROMPTS.map(generateSkillName)])];
  const scopeFlag = scope === 'global' ? '-g ' : '';
  if (runSkillsCli(`remove ${names.join(' ')} ${scopeFlag}-y`) === null) {
    if (!quiet) console.log(`  ${COLORS.RED}✖✖✖${COLORS.RESET} Could not remove installed skills`);
    return -1;
  }
  for (const name of installed) {
    if (!quiet) console.log(`  ${COLORS.YELLOW}░░░${COLORS.RESET} Removed: ${name}`);
  }
  return installed.length;
}

// ============================================================================
// INSTALLATION
// ============================================================================

/**
 * Execute installation
 */
async function install() {
  displaySectionHeader('  INSTALLING SKILLS  ');
  if (!buildSkills(true)) {
    console.log(`${COLORS.RED}${SYMBOLS.ERROR} Failed to build ${SKILLS_DIR_NAME}/ from src/${COLORS.RESET}`);
    return 1;
  }
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} Built ${SOURCE_PROMPTS.length} skills from src/${COLORS.RESET}`);
  if (!ensureSkillsCli()) return 1;

  console.log('');
  displayStatusBox('PARAMETERS', [
    `${COLORS.CYAN}Source:${COLORS.RESET}           ${SKILLS_DIR_NAME}/`,
    `${COLORS.CYAN}Skills:${COLORS.RESET}           ${SOURCE_PROMPTS.length}`,
    `${COLORS.CYAN}Scope:${COLORS.RESET}            GLOBAL ${COLORS.DIM}(skills.sh default agent set)${COLORS.RESET}`,
    `${COLORS.CYAN}Store:${COLORS.RESET}            ${path.join(os.homedir(), '.agents', 'skills')}`,
    `${COLORS.CYAN}Mode:${COLORS.RESET}             INSTALL`,
  ]);
  console.log('');

  // Clear previous installs before writing anything new. The CLI goes first so it can unwind
  // its own store and links properly; the legacy sweep then picks up pre-2.2 remnants.
  console.log(`${COLORS.YELLOW}${SYMBOLS.ACTIVE} CLEANING PREVIOUS INSTALLS ${COLORS.GREEN}[please wait...]${COLORS.RESET}`);
  const spinner1 = createSpinner();
  spinner1.start();
  removeInstalledSkills('global', { quiet: true });
  spinner1.tick();
  const legacy = cleanLegacyPaths(true);
  spinner1.tick();
  spinner1.stop();
  if (legacy.removed > 0) {
    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Cleaned ${legacy.removed} legacy file(s) from pre-2.2 installs`);
  }
  console.log('');

  console.log(`${COLORS.YELLOW}${SYMBOLS.ACTIVE} INSTALLING VIA SKILLS.SH ${COLORS.GREEN}[please wait...]${COLORS.RESET}`);
  console.log(`  ${COLORS.DIM}Installing ${SOURCE_PROMPTS.length} skills...${COLORS.RESET}`);
  const spinner2 = createSpinner();
  spinner2.start();
  const result = execSkillsCli(`add "${SKILLS_DIR}" -g ${skillNameArgs()} -y`);
  spinner2.tick();
  spinner2.stop();
  console.log('');
  reportSkillsOutput(result);
  const failed = !result.ok;

  // The `plan2code` command opens the dashboard skill, so it's only worth adding once the
  // skills themselves are in place.
  const launcherFailed = failed ? false : (await installLauncher({ quiet: true })) !== 0;

  // Summary
  console.log(`${COLORS.CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(31)}${COLORS.BRIGHT}S U M M A R Y${COLORS.RESET}${' '.repeat(31)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╠═══════════════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.GREEN}Mode:${COLORS.RESET}              INSTALL`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  const statusColor = failed ? COLORS.RED : COLORS.GREEN;
  const statusText = failed ? 'FAILED' : 'SUCCESS';
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${statusColor}Status:${COLORS.RESET}            ${statusColor}${statusText}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  const installedNames = failed ? [] : listInstalledSkills('global');
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Skills Installed:  ${COLORS.GREEN}${installedNames.length}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  if (!failed) {
    const commandStatus = launcherFailed ? `${COLORS.RED}FAILED (see above)` : `${COLORS.GREEN}${LAUNCHER_COMMAND}`;
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Global Command:    ${commandStatus}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  }
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}\n`);

  if (failed) {
    console.log(`${COLORS.RED}${SYMBOLS.ERROR} skills add failed. Re-run, or install by hand:${COLORS.RESET}`);
    console.log(`    ${COLORS.CYAN}npx --yes skills add "${SKILLS_DIR}" -g ${skillNameArgs()} -y${COLORS.RESET}\n`);
    return 1;
  }

  // Point at the dashboard first: the `plan2code` command when it installed, the skill otherwise.
  const dashboardWhere = launcherFailed ? 'Open the dashboard in your agent:' : 'Open the dashboard from any project:';
  const dashboardCommand = launcherFailed ? '/plan2code' : LAUNCHER_COMMAND;
  console.log(`${COLORS.GREEN}    ╭───╮${COLORS.RESET}   ${COLORS.BRIGHT}All done! Happy coding!${COLORS.RESET}`);
  console.log(`${COLORS.GREEN}   ╲│ ${COLORS.CYAN}★${COLORS.GREEN} │╱${COLORS.RESET}  ${COLORS.BRIGHT}${dashboardWhere}${COLORS.RESET}`);
  console.log(`${COLORS.GREEN}    │ ${COLORS.BRIGHT}◡${COLORS.GREEN} │${COLORS.RESET}   ${COLORS.BRIGHT}${COLORS.CYAN}${dashboardCommand}${COLORS.RESET}`);
  console.log(`${COLORS.GREEN}    ╰┬─┬╯${COLORS.RESET}   ${COLORS.DIM}Docs:${COLORS.RESET} ${COLORS.BRIGHT}https://github.com/jparkerweb/plan2code${COLORS.RESET}`);
  console.log('');
  console.log(`${COLORS.DIM}  Update later with:${COLORS.RESET} ${COLORS.CYAN}npx skills update -g${COLORS.RESET}`);
  console.log('');

  return launcherFailed ? 1 : 0;
}

// ============================================================================
// UNINSTALLATION
// ============================================================================

/**
 * Execute uninstallation
 */
function uninstallSkills() {
  displaySectionHeader('UNINSTALLATION', '[ REMOVING SKILLS ]');
  console.log('');
  displayStatusBox('PARAMETERS', [
    `${COLORS.CYAN}Home Directory:${COLORS.RESET}   ${os.homedir()}`,
    `${COLORS.CYAN}Scope:${COLORS.RESET}            GLOBAL`,
    `${COLORS.CYAN}Mode:${COLORS.RESET}             UNINSTALL`,
  ]);

  let removed = 0;
  let errors = 0;
  if (ensureSkillsCli()) {
    console.log(`\n${COLORS.YELLOW}${SYMBOLS.ACTIVE} REMOVING SKILLS${COLORS.RESET}\n`);
    const skillsRemoved = removeInstalledSkills('global');
    if (skillsRemoved < 0) errors++;
    else removed += skillsRemoved;
  } else {
    errors++;
  }

  console.log(`\n${COLORS.YELLOW}${SYMBOLS.ACTIVE} CLEANING LEGACY PATHS${COLORS.RESET}\n`);
  const legacy = cleanLegacyPaths();
  if (legacy.removed === 0) console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} Nothing left over from earlier versions${COLORS.RESET}`);
  removed += legacy.removed;
  errors += legacy.errors;

  console.log(`\n${COLORS.CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(31)}${COLORS.BRIGHT}S U M M A R Y${COLORS.RESET}${' '.repeat(31)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╠═══════════════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.GREEN}Mode:${COLORS.RESET}              UNINSTALL`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  const statusColor = errors > 0 ? COLORS.RED : COLORS.GREEN;
  const statusText = errors > 0 ? 'COMPLETED WITH ERRORS' : 'SUCCESS';
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${statusColor}Status:${COLORS.RESET}            ${statusColor}${statusText}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Items Removed:     ${COLORS.GREEN}${removed}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  if (errors > 0) console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Errors:            ${COLORS.RED}${errors}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}\n`);
  return errors > 0 ? 1 : 0;
}

// ============================================================================
// PROJECT INSTALLATION
// ============================================================================

/**
 * Install skills into the current project instead of globally.
 */
function installProjectSkills() {
  const projectDir = process.cwd();
  displaySectionHeader('PROJECT INSTALLATION', '[ CURRENT DIRECTORY ]');
  if (!buildSkills(true)) {
    console.log(`${COLORS.RED}${SYMBOLS.ERROR} Failed to build ${SKILLS_DIR_NAME}/ from src/${COLORS.RESET}`);
    return 1;
  }
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} Built ${SOURCE_PROMPTS.length} skills from src/${COLORS.RESET}`);
  if (!ensureSkillsCli()) return 1;

  console.log('');
  displayStatusBox('OVERVIEW', [
    `Installs into ${COLORS.BRIGHT}this project${COLORS.RESET} rather than your home directory, so the`,
    `skills travel with the repo and are visible to everyone who clones it.`,
    '',
    `${COLORS.CYAN}Project:${COLORS.RESET} ${projectDir}`,
    `${COLORS.CYAN}Skills:${COLORS.RESET}  ${SOURCE_PROMPTS.length}`,
  ]);
  console.log('');
  if (projectDir === __dirname) {
    console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} This is the Plan2Code repo itself — installing here is rarely what you want.\n`);
  }

  console.log(`${COLORS.YELLOW}${SYMBOLS.ACTIVE} INSTALLING VIA SKILLS.SH${COLORS.RESET}\n`);
  console.log(`  ${COLORS.DIM}Installing ${SOURCE_PROMPTS.length} skills...${COLORS.RESET}`);
  const result = execSkillsCli(`add "${SKILLS_DIR}" ${skillNameArgs()} -y`);
  reportSkillsOutput(result);
  console.log('');
  if (!result.ok) {
    console.log(`${COLORS.RED}${SYMBOLS.ERROR} skills add failed. Run it by hand from your project root:${COLORS.RESET}`);
    console.log(`    ${COLORS.CYAN}npx --yes skills add "${SKILLS_DIR}" ${skillNameArgs()} -y${COLORS.RESET}\n`);
    return 1;
  }
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} Installed into ${projectDir}${COLORS.RESET}\n`);
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
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  async function main() {
    // Main menu display
    displayHeader();

    console.log(`${COLORS.BLUE}${COLORS.BRIGHT}Version Info:${COLORS.RESET} ${projectVersion.name} ${projectVersion.version}`);
    console.log('');

    console.log(`${COLORS.CYAN}╔═════════════════════════════════════════════════════════╗${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}INSTALL PLAN2CODE${COLORS.RESET}`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}╠═════════════════════════════════════════════════════════╣${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}I.${COLORS.RESET}  ${COLORS.GREEN}INSTALL${COLORS.RESET}    Install Plan2Code skills everywhere`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}A.${COLORS.RESET}  ${COLORS.MAGENTA}ALL${COLORS.RESET}        Install Plan2Code + dev tools`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}U.${COLORS.RESET}  ${COLORS.RED}UNINSTALL${COLORS.RESET}  Remove Plan2Code skills and dev tools`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}C.${COLORS.RESET}  ${COLORS.BLUE}CUSTOM${COLORS.RESET}     Advanced options`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}Q.${COLORS.RESET}  ${COLORS.DIM}QUIT${COLORS.RESET}       Exit`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}╚═════════════════════════════════════════════════════════╝${COLORS.RESET}`);
    console.log('');

    // Input prompt
    console.log('');
    const answer = await question(`${COLORS.CYAN}${SYMBOLS.SELECT} SELECT OPTION${COLORS.RESET} (I, A, U, C, Q) [I]: `);
    const input = answer.trim().toUpperCase() || 'I';

    // I path — skills only. The loop remains optional via A or Custom → O.
    if (input === 'I') {
      rl.close();
      process.exit(await install());
    }

    // A path — Install Everything (skills + loop + bot + metrics + Claude status line)
    if (input === 'A') {
      rl.close();
      const loopResult = installPlan2CodeLoop();
      console.log('');
      const botResult = installPlan2CodeBot();
      console.log('');
      const metricsResult = installPlan2CodeMetrics();
      console.log('');
      const statusLineResult = await installStatusLine();
      console.log('');
      const installResult = await install();
      const exitCode = loopResult !== 0 ? loopResult : botResult !== 0 ? botResult : metricsResult !== 0 ? metricsResult : statusLineResult !== 0 ? statusLineResult : installResult;
      process.exit(exitCode);
    }

    // U path — Uninstall All
    if (input === 'U') {
      console.log('');
      console.log(`${COLORS.RED}    ╭───╮${COLORS.RESET}`);
      console.log(`${COLORS.RED}   ╲│ ${COLORS.YELLOW}★${COLORS.RED} │╱${COLORS.RESET}  ${COLORS.YELLOW}!${COLORS.RESET}`);
      console.log(`${COLORS.RED}    │ ${COLORS.YELLOW}~${COLORS.RED} │${COLORS.RESET}   ${COLORS.DIM}Are you sure? This will remove Plan2Code from all platforms.${COLORS.RESET}`);
      console.log(`${COLORS.RED}    ╰┬─┬╯${COLORS.RESET}`);
      console.log('');
      const confirmAnswer = await question(`${COLORS.RED}${SYMBOLS.SELECT} CONFIRM UNINSTALL${COLORS.RESET} (Y/N) [N]: `);
      const confirmInput = confirmAnswer.trim().toUpperCase() || 'N';

      if (confirmInput === 'Y') {
        rl.close();
        const uninstallResult = uninstallSkills();
        const loopResult = uninstallPlan2CodeLoop();
        const metricsResult = uninstallPlan2CodeMetrics();
        const botResult = uninstallPlan2CodeBot();
        const statusLineResult = uninstallStatusLine();
        const launcherResult = uninstallLauncher();
        const exitCode = uninstallResult !== 0 ? uninstallResult : loopResult !== 0 ? loopResult : metricsResult !== 0 ? metricsResult : botResult !== 0 ? botResult : statusLineResult !== 0 ? statusLineResult : launcherResult;
        process.exit(exitCode);
      } else {
        console.log(`\n${COLORS.YELLOW}${SYMBOLS.WARNING} CANCELLED${COLORS.RESET}\n`);
        rl.close();
        process.exit(0);
      }
    }

    // C path — CUSTOM sub-menu
    if (input === 'C') {
      console.log('');
      console.log(`${COLORS.CYAN}╔════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}CUSTOM OPTIONS${COLORS.RESET}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(`${COLORS.CYAN}╠════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}L.${COLORS.RESET}  ${COLORS.BLUE}LOCAL${COLORS.RESET}      Install skills into the current project only`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}O.${COLORS.RESET}  ${COLORS.GREEN}LOOP CLI${COLORS.RESET}   Install plan2code-loop CLI only`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}M.${COLORS.RESET}  ${COLORS.GREEN}METRICS${COLORS.RESET}    Install plan2code-metrics CLI only`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}S.${COLORS.RESET}  ${COLORS.GREEN}STATUS${COLORS.RESET}     Install Claude Code status line`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}B.${COLORS.RESET}  ${COLORS.GREEN}BOT${COLORS.RESET}        Install plan2code-bot CLI only`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}D.${COLORS.RESET}  ${COLORS.GREEN}P2C CMD${COLORS.RESET}    Install the plan2code command only`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}Q.${COLORS.RESET}  ${COLORS.DIM}BACK${COLORS.RESET}       Return to main menu`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(`${COLORS.CYAN}╚════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);
      console.log('');
      const customAnswer = await question(`${COLORS.CYAN}${SYMBOLS.SELECT} SELECT OPTION${COLORS.RESET} (L, O, M, S, B, D, Q) [Q]: `);
      const customInput = customAnswer.trim().toUpperCase() || 'Q';

      // C > L — install skills into the current project
      if (customInput === 'L') {
        rl.close();
        process.exit(installProjectSkills());
      }

      // C > O — install loop CLI only
      if (customInput === 'O') {
        rl.close();
        const result = installPlan2CodeLoop();
        process.exit(result);
      }

      // C > M — install metrics CLI only
      if (customInput === 'M') {
        rl.close();
        const result = installPlan2CodeMetrics();
        process.exit(result);
      }

      // C > S — install status line
      if (customInput === 'S') {
        rl.close();
        const result = await installStatusLine();
        process.exit(result);
      }

      // C > B — install bot CLI only
      if (customInput === 'B') {
        rl.close();
        const result = installPlan2CodeBot();
        process.exit(result);
      }

      // C > D — install the global `plan2code` command (opens the dashboard in Claude Code or Devin)
      if (customInput === 'D') {
        rl.close();
        process.exit(await installLauncher());
      }

      // C > Q — back to main menu
      return main();
    }

    // Q — exit
    if (input === 'Q') {
      console.log(`\n${COLORS.YELLOW}${SYMBOLS.WARNING} CANCELLED${COLORS.RESET}\n`);
      rl.close();
      process.exit(0);
    }

    // Invalid input — loop back
    console.log(`\n${COLORS.RED}${SYMBOLS.ERROR} Invalid option. Please choose I, A, U, C, or Q.${COLORS.RESET}\n`);
    return main();
  }

  main().catch(err => {
    console.error(`${COLORS.RED}${SYMBOLS.ERROR} ERROR:${COLORS.RESET}`, err.message);
    rl.close();
    process.exit(1);
  });
}

// ============================================================================
// PLAN2CODE-LOOP INSTALLATION
// ============================================================================

const { execSync, execFileSync } = require('child_process');

/**
 * Build plan2code-loop package
 */
function buildPlan2CodeLoop() {
  const loopDir = path.join(__dirname, 'plan2code-loop');

  // Check if directory exists
  if (!fs.existsSync(loopDir)) {
    console.log(`${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} plan2code-loop directory not found`);
    return false;
  }

  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Building plan2code-loop...${COLORS.RESET}`);

  try {
    // Install dependencies
    console.log(`  ${COLORS.DIM}Installing dependencies...${COLORS.RESET}`);
    execSync('npm install', { cwd: loopDir, stdio: 'pipe' });

    // Build
    console.log(`  ${COLORS.DIM}Running build...${COLORS.RESET}`);
    execSync('npm run build', { cwd: loopDir, stdio: 'pipe' });

    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Build complete`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Build failed: ${error.message}`);
    return false;
  }
}
/**
 * Clean up existing plan2code-loop symlinks/files before creating new ones
 * This prevents the Windows lstat error with stale symlinks
 */
function cleanupExistingSymlinks() {
  console.log(`  ${COLORS.DIM}Cleaning up existing symlinks...${COLORS.RESET}`);

  try {
    // Get npm global prefix - more reliable than npm bin -g on Windows
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();

    // On Windows, bin files are directly in prefix; on Unix they're in prefix/bin
    const npmBinGlobal = process.platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
    const npmRootGlobal = path.join(npmPrefix, 'node_modules');

    // Files/symlinks to clean up in npm bin directory
    const binFiles = [
      path.join(npmBinGlobal, 'plan2code-loop'),
      path.join(npmBinGlobal, 'plan2code-loop.cmd'),
      path.join(npmBinGlobal, 'plan2code-loop.ps1')
    ];

    // Symlink in node_modules - this is the main culprit for the lstat error
    const nodeModulesLink = path.join(npmRootGlobal, 'plan2code-loop');

    // Remove bin files first
    for (const file of binFiles) {
      try {
        const stats = fs.lstatSync(file);
        if (stats) {
          fs.unlinkSync(file);
          console.log(`    ${COLORS.DIM}Removed: ${path.basename(file)}${COLORS.RESET}`);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          // File exists but can't be removed normally, try rmSync
          try {
            fs.rmSync(file, { force: true, recursive: true });
            console.log(`    ${COLORS.DIM}Removed: ${path.basename(file)}${COLORS.RESET}`);
          } catch (rmErr) {
            console.log(`    ${COLORS.DIM}Could not remove: ${path.basename(file)}${COLORS.RESET}`);
          }
        }
      }
    }

    // Remove node_modules symlink - this is critical for fixing the lstat error
    try {
      const stats = fs.lstatSync(nodeModulesLink);
      if (stats) {
        // On Windows, junction points need special handling
        if (process.platform === 'win32') {
          // Try using rmdir for junction points
          try {
            fs.rmdirSync(nodeModulesLink);
            console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-loop (junction)${COLORS.RESET}`);
          } catch (rmdirErr) {
            // Fall back to rmSync
            fs.rmSync(nodeModulesLink, { force: true, recursive: true });
            console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-loop${COLORS.RESET}`);
          }
        } else {
          fs.rmSync(nodeModulesLink, { force: true, recursive: true });
          console.log(`    ${COLORS.DIM}Removed: node_modules/plan2code-loop${COLORS.RESET}`);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log(`    ${COLORS.DIM}Could not remove node_modules symlink: ${err.message}${COLORS.RESET}`);
      }
    }

    return true;
  } catch (error) {
    // Non-fatal - npm link might still work
    console.log(`    ${COLORS.DIM}Cleanup skipped: ${error.message}${COLORS.RESET}`);
    return true;
  }
}

/**
 * Create global symlink for plan2code-loop
 */
function createGlobalSymlink() {
  const loopDir = path.join(__dirname, 'plan2code-loop');
  const distBin = path.join(loopDir, 'dist', 'bin', 'plan2code-loop.js');
  // Check if built binary exists
  if (!fs.existsSync(distBin)) {
    console.log(`${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} plan2code-loop binary not found. Run build first.`);
    return false;
  }
  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Creating global symlink...${COLORS.RESET}`);

  // Clean up existing symlinks first to prevent Windows lstat errors
  cleanupExistingSymlinks();

  // On Windows, skip npm link entirely and create batch file directly
  // npm link has persistent issues with junctions and lstat errors on Windows
  if (process.platform === 'win32') {
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const symlinkCmd = path.join(npmPrefix, 'plan2code-loop.cmd');
      const symlinkPs1 = path.join(npmPrefix, 'plan2code-loop.ps1');

      // Create batch file wrapper for cmd.exe
      const batchContent = `@echo off\r\nnode "${distBin}" %*\r\n`;
      fs.writeFileSync(symlinkCmd, batchContent);
      console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: plan2code-loop.cmd`);

      // Create PowerShell wrapper for better shell support
      const ps1Content = `#!/usr/bin/env pwsh\r\nnode "${distBin}" $args\r\n`;
      fs.writeFileSync(symlinkPs1, ps1Content);
      console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: plan2code-loop.ps1`);

      console.log(`  ${COLORS.DIM}Run 'plan2code-loop --help' from any directory${COLORS.RESET}`);
      return true;
    } catch (error) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to create wrappers: ${error.message}`);
      return false;
    }
  }

  // On Unix systems, use npm link as it works reliably
  try {
    execSync('npm link', { cwd: loopDir, stdio: 'pipe' });
    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Global symlink created`);
    console.log(`  ${COLORS.DIM}Run 'plan2code-loop --help' from any directory${COLORS.RESET}`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Symlink failed: ${error.message}`);
    return false;
  }
}
/**
 * Remove global symlink for plan2code-loop
 */
function removeGlobalSymlink() {
  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Removing global symlink...${COLORS.RESET}`);

  let removedCount = 0;

  try {
    // Get npm global prefix
    const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();

    // On Windows, bin files are directly in prefix; on Unix they're in prefix/bin
    const npmBinGlobal = process.platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
    const npmRootGlobal = path.join(npmPrefix, 'node_modules');

    // Files to remove
    const filesToRemove = [
      { path: path.join(npmBinGlobal, 'plan2code-loop'), name: 'plan2code-loop' },
      { path: path.join(npmBinGlobal, 'plan2code-loop.cmd'), name: 'plan2code-loop.cmd' },
      { path: path.join(npmBinGlobal, 'plan2code-loop.ps1'), name: 'plan2code-loop.ps1' },
      { path: path.join(npmRootGlobal, 'plan2code-loop'), name: 'node_modules/plan2code-loop' }
    ];

    for (const file of filesToRemove) {
      try {
        fs.lstatSync(file.path);
        fs.rmSync(file.path, { force: true, recursive: true });
        console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
        removedCount++;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to remove ${file.name}: ${err.message}`);
        }
      }
    }

    if (removedCount === 0) {
      console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} No files found to remove${COLORS.RESET}`);
    }

    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Uninstall failed: ${error.message}`);
    return false;
  }
}

/**
 * Install plan2code-loop (build + symlink)
 */
function installPlan2CodeLoop() {
  displaySectionHeader('PLAN2CODE-LOOP', '[ BUILD & INSTALL ]');

  const buildSuccess = buildPlan2CodeLoop();
  if (!buildSuccess) {
    return 1;
  }

  const symlinkSuccess = createGlobalSymlink();
  if (!symlinkSuccess) {
    return 1;
  }

  console.log('');
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} plan2code-loop installed successfully!${COLORS.RESET}`);
  console.log('');
  console.log(`${COLORS.CYAN}Usage:${COLORS.RESET}`);
  console.log(`  ${COLORS.BRIGHT}plan2code-loop${COLORS.RESET}          Start the autonomous loop`);
  console.log(`  ${COLORS.BRIGHT}plan2code-loop -c${COLORS.RESET}       Resume previous session`);
  console.log(`  ${COLORS.BRIGHT}plan2code-loop -v${COLORS.RESET}       Verbose mode`);
  console.log(`  ${COLORS.BRIGHT}plan2code-loop --help${COLORS.RESET}   Show all options`);
  console.log('');

  return 0;
}

/**
 * Uninstall plan2code-loop
 */
function uninstallPlan2CodeLoop() {
  displaySectionHeader('PLAN2CODE-LOOP', '[ UNINSTALL ]');

  removeGlobalSymlink();

  console.log('');
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} plan2code-loop uninstalled${COLORS.RESET}`);
  console.log('');

  return 0;
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
    console.log(`${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} plan2code-metrics directory not found`);
    return false;
  }

  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Building plan2code-metrics...${COLORS.RESET}`);

  try {
    console.log(`  ${COLORS.DIM}Installing dependencies...${COLORS.RESET}`);
    execSync('npm install', { cwd: metricsDir, stdio: 'pipe' });

    console.log(`  ${COLORS.DIM}Running build...${COLORS.RESET}`);
    execSync('npm run build', { cwd: metricsDir, stdio: 'pipe' });

    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Build complete`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Build failed: ${error.message}`);
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
    console.log(`${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} plan2code-metrics binary not found. Run build first.`);
    return false;
  }

  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Creating global symlink...${COLORS.RESET}`);

  cleanupExistingMetricsSymlinks();

  if (process.platform === 'win32') {
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const symlinkCmd = path.join(npmPrefix, 'plan2code-metrics.cmd');
      const symlinkPs1 = path.join(npmPrefix, 'plan2code-metrics.ps1');

      const batchContent = `@echo off\r\nnode "${distBin}" %*\r\n`;
      fs.writeFileSync(symlinkCmd, batchContent);
      console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: plan2code-metrics.cmd`);

      const ps1Content = `#!/usr/bin/env pwsh\r\nnode "${distBin}" $args\r\n`;
      fs.writeFileSync(symlinkPs1, ps1Content);
      console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: plan2code-metrics.ps1`);

      console.log(`  ${COLORS.DIM}Run 'plan2code-metrics' from any directory${COLORS.RESET}`);
      return true;
    } catch (error) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to create wrappers: ${error.message}`);
      return false;
    }
  }

  try {
    execSync('npm link', { cwd: metricsDir, stdio: 'pipe' });
    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Global symlink created`);
    console.log(`  ${COLORS.DIM}Run 'plan2code-metrics' from any directory${COLORS.RESET}`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Symlink failed: ${error.message}`);
    return false;
  }
}

/**
 * Remove global symlink for plan2code-metrics
 */
function removeMetricsGlobalSymlink() {
  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Removing global symlink...${COLORS.RESET}`);

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
        console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
        removedCount++;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to remove ${file.name}: ${err.message}`);
        }
      }
    }

    if (removedCount === 0) {
      console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} No files found to remove${COLORS.RESET}`);
    }

    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Uninstall failed: ${error.message}`);
    return false;
  }
}

/**
 * Install plan2code-metrics (build + symlink)
 */
function installPlan2CodeMetrics() {
  displaySectionHeader('PLAN2CODE-METRICS', '[ BUILD & INSTALL ]');

  const buildSuccess = buildPlan2CodeMetrics();
  if (!buildSuccess) {
    return 1;
  }

  const symlinkSuccess = createMetricsGlobalSymlink();
  if (!symlinkSuccess) {
    return 1;
  }

  console.log('');
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} plan2code-metrics installed successfully!${COLORS.RESET}`);
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
  displaySectionHeader('PLAN2CODE-METRICS', '[ UNINSTALL ]');

  removeMetricsGlobalSymlink();

  console.log('');
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} plan2code-metrics uninstalled${COLORS.RESET}`);
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
 * Async because it may prompt when a custom (non-plan2code) statusLine exists.
 */
async function installStatusLine({ quiet = false } = {}) {
  if (!quiet) {
    displaySectionHeader('CLAUDE STATUS LINE', '[ INSTALL ]');
  } else {
    console.log(`  ${COLORS.CYAN}${SYMBOLS.ACTIVE} INSTALLING${COLORS.RESET} Claude Status Line...`);
  }

  const srcDir = getStatusLineSrcDir();
  if (!fs.existsSync(srcDir)) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} src/statusline-claude directory not found`);
    return 1;
  }

  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude');

  try {
    fs.mkdirSync(claudeDir, { recursive: true });
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Cannot create ~/.claude/: ${error.message}`);
    return 1;
  }

  // Copy script directly from src (no bundling — statusline.js is self-contained)
  const statuslineDest = path.join(claudeDir, 'plan2code-statusline.js');
  const configDest = path.join(claudeDir, 'statusline-config.json');

  try {
    fs.copyFileSync(path.join(srcDir, 'statusline.js'), statuslineDest);
    if (!quiet) console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Installed: ~/.claude/plan2code-statusline.js`);
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to copy script: ${error.message}`);
    return 1;
  }

  // Preserve existing user config
  if (!fs.existsSync(configDest)) {
    try {
      fs.copyFileSync(path.join(srcDir, 'statusline-config.json'), configDest);
      if (!quiet) console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: ~/.claude/statusline-config.json`);
    } catch (error) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to copy config: ${error.message}`);
      return 1;
    }
  } else {
    if (!quiet) console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} Preserved existing: ~/.claude/statusline-config.json${COLORS.RESET}`);
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
        console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} Existing statusLine detected in settings.json:`);
        console.log(`  ${COLORS.DIM}  ${existingCmd}${COLORS.RESET}`);

        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => {
          rl2.question(`  ${COLORS.CYAN}Replace with Plan2Code status line?${COLORS.RESET} (Y/n): `, resolve);
        });
        rl2.close();

        if (answer.trim().toLowerCase() === 'n') {
          console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} Skipped — scripts installed but settings.json unchanged${COLORS.RESET}`);
          console.log('');
          return 0;
        }

        // Backup existing config before replacing
        const backupPath = path.join(claudeDir, 'statusline-previous.json');
        fs.writeFileSync(backupPath, JSON.stringify({ statusLine: settings.statusLine }, null, 2));
        console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Backed up existing config: ~/.claude/statusline-previous.json`);
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
    if (!quiet) console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Configured: ~/.claude/settings.json (statusLine)`);
    settingsOk = true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to update settings.json: ${error.message}`);
  }

  // Clean up legacy filenames from previous installs
  for (const legacy of ['statusline.js', 'plan-usage.js', 'plan2code-plan-usage.js', 'statusline-cache.json']) {
    const legacyPath = path.join(claudeDir, legacy);
    try {
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
        if (!quiet) console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} Removed legacy: ${legacy}${COLORS.RESET}`);
      }
    } catch {}
  }

  if (settingsOk) {
    if (!quiet) {
      console.log('');
      console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} Claude Status Line installed successfully!${COLORS.RESET}`);
      console.log('');
      console.log(`${COLORS.CYAN}Usage:${COLORS.RESET}`);
      console.log(`  ${COLORS.DIM}Restart Claude Code to see the status bar${COLORS.RESET}`);
      console.log(`  ${COLORS.DIM}Config: ~/.claude/statusline-config.json${COLORS.RESET}`);
      console.log('');
    } else {
      console.log(`    ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Claude Status Line → ${COLORS.DIM}~/.claude/plan2code-statusline.js${COLORS.RESET}`);
    }
  } else {
    console.log('');
    console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} Scripts installed but settings.json not updated.`);
    console.log(`  ${COLORS.DIM}Add statusLine config to ~/.claude/settings.json manually.${COLORS.RESET}`);
    console.log('');
  }

  return settingsOk ? 0 : 1;
}

/**
 * Uninstall status line
 */
function uninstallStatusLine() {
  displaySectionHeader('CLAUDE STATUS LINE', '[ UNINSTALL ]');

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
          console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed statusLine from settings.json`);
        } else {
          console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} Preserved non-plan2code statusLine in settings.json${COLORS.RESET}`);
          console.log(`  ${COLORS.DIM}  ${existingCmd}${COLORS.RESET}`);
        }
      } else {
        console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} No statusLine config in settings.json${COLORS.RESET}`);
      }
    }
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to update settings.json: ${error.message}`);
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
        console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
        removedCount++;
      }
    } catch (error) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to remove ${file.name}: ${error.message}`);
    }
  }

  if (removedCount === 0) {
    console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} No status line files found${COLORS.RESET}`);
  }

  console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} Preserved: statusline-config.json${COLORS.RESET}`);
  console.log('');
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} Status line uninstalled${COLORS.RESET}`);
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
    console.log(`${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} plan2code-bot directory not found`);
    return false;
  }

  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Building plan2code-bot...${COLORS.RESET}`);

  try {
    console.log(`  ${COLORS.DIM}Installing dependencies...${COLORS.RESET}`);
    execSync('npm install', { cwd: botDir, stdio: 'pipe' });

    console.log(`  ${COLORS.DIM}Running build...${COLORS.RESET}`);
    execSync('npm run build', { cwd: botDir, stdio: 'pipe' });

    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Build complete`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Build failed: ${error.message}`);
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
    console.log(`${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} plan2code-bot binary not found. Run build first.`);
    return false;
  }

  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Creating global symlink...${COLORS.RESET}`);

  cleanupExistingBotSymlinks();

  if (process.platform === 'win32') {
    try {
      const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const symlinkCmd = path.join(npmPrefix, 'plan2code-bot.cmd');
      const symlinkPs1 = path.join(npmPrefix, 'plan2code-bot.ps1');

      const batchContent = `@echo off\r\nnode "${distBin}" %*\r\n`;
      fs.writeFileSync(symlinkCmd, batchContent);
      console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: plan2code-bot.cmd`);

      const ps1Content = `#!/usr/bin/env pwsh\r\nnode "${distBin}" $args\r\n`;
      fs.writeFileSync(symlinkPs1, ps1Content);
      console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: plan2code-bot.ps1`);

      console.log(`  ${COLORS.DIM}Run 'plan2code-bot' from any directory${COLORS.RESET}`);
      return true;
    } catch (error) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to create wrappers: ${error.message}`);
      return false;
    }
  }

  try {
    execSync('npm link', { cwd: botDir, stdio: 'pipe' });
    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Global symlink created`);
    console.log(`  ${COLORS.DIM}Run 'plan2code-bot' from any directory${COLORS.RESET}`);
    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Symlink failed: ${error.message}`);
    return false;
  }
}

/**
 * Remove global symlink for plan2code-bot
 */
function removeBotGlobalSymlink() {
  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} Removing global symlink...${COLORS.RESET}`);

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
        console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
        removedCount++;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to remove ${file.name}: ${err.message}`);
        }
      }
    }

    if (removedCount === 0) {
      console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} No files found to remove${COLORS.RESET}`);
    }

    return true;
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Uninstall failed: ${error.message}`);
    return false;
  }
}

/**
 * Install plan2code-bot (build + symlink)
 */
function installPlan2CodeBot() {
  displaySectionHeader('PLAN2CODE-BOT', '[ BUILD & INSTALL ]');

  const buildSuccess = buildPlan2CodeBot();
  if (!buildSuccess) {
    return 1;
  }

  const symlinkSuccess = createBotGlobalSymlink();
  if (!symlinkSuccess) {
    return 1;
  }

  console.log('');
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} plan2code-bot installed successfully!${COLORS.RESET}`);
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
  displaySectionHeader('PLAN2CODE-BOT', '[ UNINSTALL ]');

  removeBotGlobalSymlink();

  console.log('');
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} plan2code-bot uninstalled${COLORS.RESET}`);
  console.log('');

  return 0;
}

// ============================================================================
// PLAN2CODE COMMAND (global `plan2code` → dashboard in Claude Code or Devin)
// ============================================================================

/**
 * `plan2code` typed in any directory opens the dashboard skill there in Claude Code
 * (`claude /plan2code --permission-mode bypassPermissions`) or Devin
 * (`devin --permission-mode bypass -- /plan2code`), asking which when both are installed.
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
const LAUNCHER_PICK_FOLDER_FLAG = '--pick-folder';
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
          `"${cmdNode}" "${cmdDest}" %*`,
          'exit /b %ERRORLEVEL%',
          ':p2c_path_node',
          `node "${cmdDest}" %*`,
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

function isOurLauncherShim(file) {
  try {
    return fs.readFileSync(file, 'utf8').includes(LAUNCHER_MARKER);
  } catch {
    return false;
  }
}

function isCommandOnPath(command) {
  try {
    execSync(process.platform === 'win32' ? `where ${command}` : `command -v ${command}`, { stdio: 'ignore' });
    return true;
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
 * On Windows it opens in PowerShell — PowerShell 7 (`pwsh`) when installed, Windows
 * PowerShell otherwise — running the `.ps1` shim, rather than cmd.exe running the `.cmd` one.
 */
function installDesktopShortcut(binDir, file) {
  const shim = path.join(binDir, LAUNCHER_COMMAND);

  try {
    if (!fs.statSync(path.dirname(file)).isDirectory()) throw new Error('not a folder');
  } catch {
    console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} No desktop folder found at ${path.dirname(file)} — skipped the shortcut`);
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
          P2C_DESCRIPTION: 'Open the Plan2Code dashboard in Claude Code or Devin',
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
          'Comment=Open the Plan2Code dashboard in Claude Code or Devin',
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
    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: ${file}`);
    return 0;
  } catch (error) {
    console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} Failed to create the desktop shortcut: ${error.message}`);
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
 * compact lines for use inside the skills install instead of a section of its own.
 */
async function installLauncher({ quiet = false } = {}) {
  if (quiet) {
    console.log(`${COLORS.YELLOW}${SYMBOLS.ACTIVE} INSTALLING THE ${LAUNCHER_COMMAND.toUpperCase()} COMMAND${COLORS.RESET}`);
  } else {
    displaySectionHeader('PLAN2CODE COMMAND', '[ INSTALL ]');
  }

  if (!fs.existsSync(LAUNCHER_SRC)) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} src/launcher/plan2code.js not found`);
    return 1;
  }

  try {
    fs.mkdirSync(path.dirname(LAUNCHER_DEST), { recursive: true });
    fs.copyFileSync(LAUNCHER_SRC, LAUNCHER_DEST);
    // The curated model menu is the authors' source of truth, so it is overwritten on every install.
    // Models the user added in User Preferences live in ~/.plan2code/models.json and are untouched.
    fs.copyFileSync(MODELS_SRC, MODELS_DEST);
    if (process.platform !== 'win32') fs.chmodSync(LAUNCHER_DEST, 0o755);
    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Installed: ${LAUNCHER_DEST}`);
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to copy launcher: ${error.message}`);
    return 1;
  }

  const candidates = getLauncherBinCandidates();
  const binDir =
    candidates.find((dir) => isDirWritable(dir) && isDirOnPath(dir)) || candidates.find((dir) => isDirWritable(dir));
  if (!binDir) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} No writable bin directory found (tried: ${candidates.join(', ') || 'none'})`);
    console.log(`  ${COLORS.DIM}Link it by hand:${COLORS.RESET} ${COLORS.CYAN}sudo ln -sf "${LAUNCHER_DEST}" /usr/local/bin/${LAUNCHER_COMMAND}${COLORS.RESET}`);
    return 1;
  }

  try {
    for (const shim of getLauncherShims(binDir)) {
      const replacingForeign = fs.existsSync(shim.file) && !isOurLauncherShim(shim.file);
      fs.rmSync(shim.file, { force: true });
      fs.writeFileSync(shim.file, shim.content);
      if (!shim.file.endsWith('.cmd') && !shim.file.endsWith('.ps1')) fs.chmodSync(shim.file, 0o755);
      const note = replacingForeign ? ` ${COLORS.DIM}(replaced an existing command)${COLORS.RESET}` : '';
      console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Created: ${shim.file}${note}`);
    }
  } catch (error) {
    console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to create the ${LAUNCHER_COMMAND} command: ${error.message}`);
    return 1;
  }

  if (!isDirOnPath(binDir)) {
    console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} ${binDir} is not on your PATH — add it to use ${COLORS.BRIGHT}${LAUNCHER_COMMAND}${COLORS.RESET} from any directory`);
  }
  if (!isCommandOnPath('claude') && !isCommandOnPath('devin')) {
    console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} Neither the ${COLORS.BRIGHT}claude${COLORS.RESET} nor the ${COLORS.BRIGHT}devin${COLORS.RESET} CLI is on your PATH — install one before running ${COLORS.BRIGHT}${LAUNCHER_COMMAND}${COLORS.RESET}`);
  }
  // The shortcut is a convenience on top of the command, so a failure here only warns.
  await offerDesktopShortcut(binDir);
  console.log(`  ${COLORS.DIM}Run '${LAUNCHER_COMMAND}' in any project to open the Plan2Code dashboard in Claude Code or Devin${COLORS.RESET}`);
  console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING}${COLORS.RESET} It starts the agent with permission prompts off (${COLORS.CYAN}--permission-mode bypassPermissions${COLORS.RESET} in Claude Code, ${COLORS.CYAN}bypass${COLORS.RESET} in Devin). Run ${COLORS.CYAN}claude /plan2code${COLORS.RESET} yourself if you want prompts.`);
  console.log('');

  return 0;
}

/**
 * Remove the global `plan2code` command. Only shims carrying the launcher marker are
 * touched, so a `plan2code` bin from anything else is left alone.
 */
function uninstallLauncher() {
  displaySectionHeader('PLAN2CODE COMMAND', '[ UNINSTALL ]');

  let removedCount = 0;
  const remove = (file) => {
    try {
      fs.rmSync(file, { force: true });
      console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file}`);
      removedCount++;
    } catch (error) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Failed to remove ${file}: ${error.message}`);
    }
  };

  for (const binDir of getLauncherBinCandidates()) {
    for (const { file } of getLauncherShims(binDir)) {
      if (isOurLauncherShim(file)) remove(file);
    }
  }
  const shortcut = getShortcutFile();
  if (isOurShortcut(shortcut)) remove(shortcut);
  for (const file of [LAUNCHER_DEST, MODELS_DEST, SHORTCUT_ICON_DEST, SHORTCUT_PNG_DEST, LAUNCHER_STATE]) {
    if (fs.existsSync(file)) remove(file);
  }
  try {
    fs.rmdirSync(path.dirname(LAUNCHER_DEST));
  } catch {}

  if (removedCount === 0) {
    console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} No ${LAUNCHER_COMMAND} command found${COLORS.RESET}`);
  }
  console.log('');

  return 0;
}

// ============================================================================
// MAIN
// ============================================================================

// Non-interactive build hooks for the committed skills/ artifact.
const argv = process.argv.slice(2);

if (argv.includes('--build-skills')) {
  process.exit(buildSkills() ? 0 : 1);
}

if (argv.includes('--verify-skills')) {
  process.exit(verifySkillsSync() ? 0 : 1);
}

if (argv.length > 0) {
  console.error(`Unknown option(s): ${argv.join(' ')}`);
  console.error('Usage: node install.js [--build-skills | --verify-skills]');
  console.error('Run with no options for the interactive installer.');
  process.exit(1);
}

runInteractive();
