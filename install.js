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
 * Install Plan2Code prompts to user's home directory for global use.
 * Generates distribution files on-the-fly from source prompts in src/.
 * Always runs interactively — any CLI arguments are silently ignored.
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
    '  o     o  ',
    '   ╲   ╱   ',
    '   ╭───╮   ',
    '   │ ● │   ',
    '   │ ◡ │   ',
    '   ├───┤   ',
    '   │ · │   ',
    '   ╰───╯   ',
  ],
  // Mini mascot for inline use
  mini: '(◉‿◉)',
  // Waving mascot for greetings
  wave: [
    '  o     o  ',
    '   ╲   ╱ /',
    '   ╭───╮   ',
    '   │ ● │   ',
    '   │ ◡ │   ',
    '   ├───┤   ',
    '   │ · │   ',
    '   ╰───╯   ',
  ],
  // Thinking mascot for prompts
  thinking: [
    '  o     o  ',
    '   ╲   ╱  ?',
    '   ╭───╮   ',
    '   │ ● │   ',
    '   │ ~ │   ',
    '   ├───┤   ',
    '   │ · │   ',
    '   ╰───╯   ',
  ],
};

// Source directory containing pre-formatted global installation files
const SOURCE_BASE = 'dist/global-commands';

// Source prompts directory
const SRC_DIR = path.join(__dirname, 'src');

// ============================================================================
// SYNC PROMPTS CONFIGURATION (merged from sync-prompts.js)
// ============================================================================

// Configuration for source prompts
const SOURCE_PROMPTS = [
  {
    source: 'plan2code---init.md',
    stepNumber: 'init',
    name: 'init',
    displayName: 'Init Mode',
    description: 'Generate AGENTS.md file for project-specific guidance',
    isUtility: true
  },
  {
    source: 'plan2code---init-update.md',
    stepNumber: 'update',
    name: 'init-update',
    displayName: 'Init Update Mode',
    description: 'Update existing AGENTS.md with new learnings',
    isUtility: true
  },
  {
    source: 'plan2code---quick-task.md',
    stepNumber: 0,
    name: 'quick-task',
    displayName: 'Quick Task Mode',
    description: 'Lightweight planning for small tasks'
  },
  {
    source: 'plan2code-1--plan.md',
    stepNumber: 1,
    name: 'plan',
    displayName: 'Planning Mode',
    description: 'Requirements analysis and architecture design'
  },
  {
    source: 'plan2code-1b--revise-plan.md',
    stepNumber: '1b',
    name: 'revise-plan',
    displayName: 'Revision Mode',
    description: 'Modify specs mid-implementation when requirements change'
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

// Helper function to generate destination filename based on stepNumber
function generateFilename(prompt, extension = '.md') {
  if (prompt.isUtility || prompt.stepNumber === 0 || prompt.stepNumber === 'init') {
    return `plan2code---${prompt.name}${extension}`;
  }
  return `plan2code-${prompt.stepNumber}--${prompt.name}${extension}`;
}

// Helper function to generate skill name (normalizes double hyphens to single)
function generateSkillName(prompt) {
  return generateFilename(prompt, '').replace(/--+/g, '-');
}

// Helper function to generate YAML frontmatter for SKILL.md files
function generateSkillHeader(prompt, disableModelInvocation = false) {
  const lines = [
    '---',
    `name: ${generateSkillName(prompt)}`,
    `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - user-initiated workflow step. Do not invoke autonomously."`,
  ];
  if (disableModelInvocation) lines.push('disable-model-invocation: true');
  lines.push('---');
  return lines.join('\n');
}

// Helper function to generate complete .toml file content for Gemini CLI
function generateTomlContent(prompt, sourceContent) {
  const stepLabel = prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`;
  const desc = `Plan2Code ${stepLabel}: ${prompt.displayName} - user-initiated ${prompt.description || 'workflow step'}`;
  return `description = "${desc}"\nprompt = '''\n${sourceContent}\n'''\n`;
}

// Destination configurations for project-level installation (local)
const LOCAL_DESTINATIONS = [
  {
    name: 'Claude Code Commands',
    dir: '.claude/commands',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: null
  },
  {
    name: 'Cursor Commands',
    dir: '.cursor/commands',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: null
  },
  {
    name: 'GitHub Copilot Prompts',
    dir: '.github/prompts',
    filePattern: (prompt) => generateFilename(prompt, '.prompt.md'),
    header: (prompt) => [
      '---',
      'mode: agent',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'GitHub Copilot Agents',
    dir: '.github/agents',
    filePattern: (prompt) => generateFilename(prompt, '.agent.md'),
    header: (prompt) => [
      '---',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Continue Prompts',
    dir: '.continue/prompts',
    filePattern: (prompt) => generateFilename(prompt, '.prompt.md'),
    header: (prompt) => [
      '---',
      `name: ${prompt.name}`,
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Windsurf Workflows',
    dir: '.windsurf/workflows',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: (prompt) => [
      '---',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Windsurf Global Workflows',
    dir: '.codeium/windsurf/global_workflows',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: (prompt) => [
      '---',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Agent Workflows',
    dir: '.agent/workflows',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: (prompt) => [
      '---',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Codeium Global Workflows',
    dir: '.codeium/global_workflows',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: (prompt) => [
      '---',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Claude Code Skills',
    dir: '.claude/skills',
    type: 'skill',
    header: (prompt) => generateSkillHeader(prompt, true),
  },
  {
    name: 'Agent Skills (Amp · Gemini CLI · OpenCode)',
    dir: '.agents/skills',
    type: 'skill',
    header: (prompt) => generateSkillHeader(prompt, false),
  },
  {
    name: 'Gemini CLI',
    dir: '.gemini/commands',
    type: 'toml',
    filePattern: (prompt) => `${generateFilename(prompt, '')}.toml`,
  }
];

// Destination configurations for global (home directory) installation
const GLOBAL_DESTINATIONS = [
  {
    name: 'Claude Code (Global)',
    dir: '.claude/commands',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: null
  },
  {
    name: 'Copilot CLI (Global)',
    dir: '.copilot/agents',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: (prompt) => [
      '---',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Cursor (Global)',
    dir: '.cursor/commands',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: null
  },
  {
    name: 'Continue (Global)',
    dir: '.continue/prompts',
    filePattern: (prompt) => generateFilename(prompt, '.prompt.md'),
    header: (prompt) => [
      '---',
      `name: ${prompt.name}`,
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Windsurf (Global)',
    dir: '.codeium/windsurf/global_workflows',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: (prompt) => [
      '---',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'VS Code Copilot (Global)',
    dir: 'vscode-copilot-prompts',
    filePattern: (prompt) => generateFilename(prompt, '.prompt.md'),
    header: (prompt) => [
      '---',
      'agent: agent',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Codeium (Global)',
    dir: '.codeium/global_workflows',
    filePattern: (prompt) => generateFilename(prompt, '.md'),
    header: (prompt) => [
      '---',
      `description: "Plan2Code ${prompt.stepNumber === 'init' ? 'Init' : `Step ${prompt.stepNumber}`}: ${prompt.displayName} - ${prompt.description}"`,
      '---'
    ].join('\n')
  },
  {
    name: 'Claude Code Skills',
    dir: '.claude/skills',
    type: 'skill',
    header: (prompt) => generateSkillHeader(prompt, true),
  },
  {
    name: 'Agent Skills (Amp · Gemini CLI · OpenCode)',
    dir: '.agents/skills',
    type: 'skill',
    header: (prompt) => generateSkillHeader(prompt, false),
  },
  {
    name: 'Crush',
    dir: 'crush-skills',
    type: 'skill',
    header: (prompt) => generateSkillHeader(prompt, false),
  },
  {
    name: 'Gemini CLI',
    dir: '.gemini/commands',
    type: 'toml',
    filePattern: (prompt) => `${generateFilename(prompt, '')}.toml`,
  }
];

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

// Helper function to get Agent Skills global directory based on platform
function getAgentSkillsDir() {
  const homedir = os.homedir();
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    return path.join(localAppData, 'agents', 'skills');
  }
  return path.join(homedir, '.agents', 'skills');
}

// Helper function to resolve target directory (handles both static and dynamic paths)
function resolveTargetDir(target) {
  if (typeof target.dir === 'function') {
    return target.dir();
  }
  return path.join(os.homedir(), target.dir);
}

// Helper function to get display path for a target
function getDisplayPath(target) {
  if (target.displayPath) {
    return target.displayPath;
  }
  return `~/${target.dir}/`;
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

// Legacy targets — paths that were previously installed but are no longer active install targets
const LEGACY_TARGETS = [
  {
    dir: '.claude/commands',
    filePattern: /^plan2code-.*\.md$/,
    type: 'flat',
  },
];

// Installation targets
const INSTALL_TARGETS = [
  {
    name: 'Claude Code',
    id: 'claude',
    dir: '.claude/skills',
    type: 'skill',
    filePattern: /^plan2code-/,
    icon: '◉ '
  },
  {
    name: 'Copilot CLI',
    id: 'copilot',
    dir: '.copilot/agents',
    filePattern: /^plan2code-.*\.md$/,
    icon: '◉ '
  },
  {
    name: 'Cursor',
    id: 'cursor',
    dir: '.cursor/commands',
    filePattern: /^plan2code-.*\.md$/,
    icon: '◉ '
  },
  {
    name: 'Continue',
    id: 'continue',
    dir: '.continue/prompts',
    filePattern: /^plan2code-.*\.prompt\.md$/,
    icon: '◉ '
  },
  {
    name: 'Windsurf',
    id: 'windsurf',
    dir: '.codeium/windsurf/global_workflows',
    filePattern: /^plan2code-.*\.md$/,
    icon: '◉ '
  },
  {
    name: 'Codeium (IntelliJ)',
    id: 'codeium',
    dir: '.codeium/global_workflows',
    filePattern: /^plan2code-.*\.md$/,
    icon: '◉ '
  },
  {
    name: 'VS Code Copilot',
    id: 'vscode-copilot',
    dir: getVSCodeCopilotDir,
    sourceDir: 'vscode-copilot-prompts',
    displayPath: process.platform === 'win32'
      ? '%APPDATA%\\Code\\User\\prompts\\'
      : process.platform === 'darwin'
        ? '~/Library/Application Support/Code/User/prompts/'
        : '~/.config/Code/User/prompts/',
    filePattern: /^plan2code-.*\.prompt\.md$/,
    icon: '◉ '
  },
  {
    name: 'Agent Skills (Amp · Gemini CLI · OpenCode)',
    id: 'agent-skills',
    dir: getAgentSkillsDir,
    sourceDir: '.agents/skills',
    type: 'skill',
    filePattern: /^plan2code-/,
    displayPath: process.platform === 'win32'
      ? '%LOCALAPPDATA%\\agents\\skills'
      : '~/.agents/skills',
    icon: '◉ '
  },
  {
    name: 'Crush',
    id: 'crush',
    dir: getCrushSkillsDir,
    sourceDir: 'crush-skills',
    type: 'skill',
    filePattern: /^plan2code-/,
    displayPath: process.platform === 'win32'
      ? '%LOCALAPPDATA%\\crush\\skills'
      : '~/.config/crush/skills',
    icon: '◉ '
  },
  {
    name: 'Gemini CLI',
    id: 'gemini',
    dir: '.gemini/commands',
    type: 'toml',
    filePattern: /^plan2code-.*\.toml$/,
    icon: '◉ '
  }
];

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
  console.log('║              │ ● │   Hi! I\'m Planny!                    ║');
  console.log('║              │ ◡ │   Nice to meet you                   ║');
  console.log('║              ╰───╯   Welcome to Plan2Code!              ║');
  console.log('║                                                         ║');
  console.log('║   G L O B A L   I N S T A L L A T I O N   S Y S T E M   ║');
  console.log('║          https://jparkerweb.github.io/plan2code         ║');
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
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        deleteDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
    fs.rmdirSync(dirPath);
  } catch (err) {
    console.error(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Could not delete directory ${dirPath}: ${err.message}`);
  }
}

/**
 * Write a file to a destination with optional YAML header
 */
function writeToDestination(rootDir, baseDir, dest, prompt, sourceContent, stats, quiet = false) {
  const destDir = path.join(rootDir, baseDir, dest.dir);
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
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Check if file needs updating
  let needsUpdate = true;
  if (fs.existsSync(destPath)) {
    try {
      const existingContent = fs.readFileSync(destPath, 'utf8');
      needsUpdate = existingContent !== outputContent;
    } catch (err) {
      // File exists but can't be read, will try to write
    }
  }

  if (needsUpdate) {
    try {
      fs.writeFileSync(destPath, outputContent, 'utf8');
      if (!quiet) {
        console.log(`    ${COLORS.GREEN}▰▰▰${COLORS.RESET} ${destFile}`);
      }
    } catch (err) {
      console.error(`    ${COLORS.RED}✖✖✖${COLORS.RESET} ${destFile}: ${err.message}`);
      stats.errors++;
      return;
    }
    stats.updated++;
  } else {
    stats.skipped++;
  }
}

/**
 * Write a skill file to a destination as <skill-name>/SKILL.md
 */
function writeSkillToDestination(rootDir, baseDir, dest, prompt, sourceContent, stats, quiet = false) {
  const skillName = generateSkillName(prompt);
  const destDir = path.join(rootDir, baseDir, dest.dir, skillName);
  const filePath = path.join(destDir, 'SKILL.md');

  // Build the output content
  let outputContent;
  if (dest.header) {
    outputContent = dest.header(prompt) + '\n\n' + sourceContent;
  } else {
    outputContent = sourceContent;
  }

  // Ensure destination directory exists
  fs.mkdirSync(destDir, { recursive: true });

  // Check if file needs updating
  let needsUpdate = true;
  if (fs.existsSync(filePath)) {
    try {
      const existingContent = fs.readFileSync(filePath, 'utf8');
      needsUpdate = existingContent !== outputContent;
    } catch (err) {
      // File exists but can't be read, will try to write
    }
  }

  if (needsUpdate) {
    try {
      fs.writeFileSync(filePath, outputContent, 'utf8');
      if (!quiet) {
        console.log(`    ${COLORS.GREEN}▰▰▰${COLORS.RESET} ${skillName}/SKILL.md`);
      }
    } catch (err) {
      console.error(`    ${COLORS.RED}✖✖✖${COLORS.RESET} ${skillName}/SKILL.md: ${err.message}`);
      stats.errors++;
      return;
    }
    stats.updated++;
  } else {
    stats.skipped++;
  }
}

/**
 * Write a TOML file to a destination for Gemini CLI
 */
function writeTomlToDestination(rootDir, baseDir, dest, prompt, sourceContent, stats, quiet = false) {
  const filename = dest.filePattern(prompt);
  const destDir = path.join(rootDir, baseDir, dest.dir);
  const filePath = path.join(destDir, filename);

  // Build TOML content
  const tomlContent = generateTomlContent(prompt, sourceContent);

  // Ensure destination directory exists
  fs.mkdirSync(destDir, { recursive: true });

  // Check if file needs updating
  let needsUpdate = true;
  if (fs.existsSync(filePath)) {
    try {
      const existingContent = fs.readFileSync(filePath, 'utf8');
      needsUpdate = existingContent !== tomlContent;
    } catch (err) {
      // File exists but can't be read, will try to write
    }
  }

  if (needsUpdate) {
    try {
      fs.writeFileSync(filePath, tomlContent, 'utf8');
      if (!quiet) {
        console.log(`    ${COLORS.GREEN}▰▰▰${COLORS.RESET} ${filename}`);
      }
    } catch (err) {
      console.error(`    ${COLORS.RED}✖✖✖${COLORS.RESET} ${filename}: ${err.message}`);
      stats.errors++;
      return;
    }
    stats.updated++;
  } else {
    stats.skipped++;
  }
}

/**
 * Sync prompts from src/ to dist/ directories
 * This generates the distribution files before installation
 */
function syncPrompts(quiet = false) {
  const stats = { updated: 0, skipped: 0, errors: 0 };
  const projectRoot = __dirname;

  if (!quiet) {
    console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} GENERATING DISTRIBUTION FILES${COLORS.RESET}\n`);
  }

  // Clean up old dist directories
  const localDistPath = path.join(projectRoot, 'dist/local-commands');
  const globalDistPath = path.join(projectRoot, 'dist/global-commands');

  if (fs.existsSync(localDistPath)) {
    if (!quiet) console.log(`  ${COLORS.YELLOW}░░░${COLORS.RESET} Cleaning: dist/local-commands/`);
    deleteDirectory(localDistPath);
  }

  if (fs.existsSync(globalDistPath)) {
    if (!quiet) console.log(`  ${COLORS.YELLOW}░░░${COLORS.RESET} Cleaning: dist/global-commands/`);
    deleteDirectory(globalDistPath);
  }

  // Process each source prompt
  for (const prompt of SOURCE_PROMPTS) {
    const sourcePath = path.join(SRC_DIR, prompt.source);

    // Read source content
    let sourceContent;
    try {
      sourceContent = fs.readFileSync(sourcePath, 'utf8');
    } catch (err) {
      console.error(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} Could not read: src/${prompt.source}`);
      stats.errors++;
      continue;
    }

    // Write to dist/local-commands/
    for (const dest of LOCAL_DESTINATIONS) {
      if (dest.type === 'skill') {
        writeSkillToDestination(projectRoot, 'dist/local-commands', dest, prompt, sourceContent, stats, quiet);
      } else if (dest.type === 'toml') {
        writeTomlToDestination(projectRoot, 'dist/local-commands', dest, prompt, sourceContent, stats, quiet);
      } else {
        writeToDestination(projectRoot, 'dist/local-commands', dest, prompt, sourceContent, stats, quiet);
      }
    }

    // Write to dist/global-commands/
    for (const dest of GLOBAL_DESTINATIONS) {
      if (dest.type === 'skill') {
        writeSkillToDestination(projectRoot, 'dist/global-commands', dest, prompt, sourceContent, stats, quiet);
      } else if (dest.type === 'toml') {
        writeTomlToDestination(projectRoot, 'dist/global-commands', dest, prompt, sourceContent, stats, quiet);
      } else {
        writeToDestination(projectRoot, 'dist/global-commands', dest, prompt, sourceContent, stats, quiet);
      }
    }
  }

  if (!quiet) {
    console.log('');
    console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Generated ${stats.updated} files (${stats.skipped} unchanged)`);
    if (stats.errors > 0) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR}${COLORS.RESET} ${stats.errors} errors`);
    }
    console.log('');
  }

  return stats.errors === 0;
}

// ============================================================================
// TARGET SELECTION
// ============================================================================

/**
 * Get targets to process based on selected platforms
 */
function getTargets(platformIds = null) {
  if (platformIds && platformIds.length > 0) {
    return INSTALL_TARGETS.filter(t => platformIds.includes(t.id));
  }
  return INSTALL_TARGETS;
}

// ============================================================================
// INSTALLATION
// ============================================================================

/**
 * Recursively copy skill subdirectories matching /^plan2code-/ from source to dest
 */
function copySkillDirectory(sourcePath, destPath, stats) {
  fs.mkdirSync(destPath, { recursive: true });
  const entries = fs.readdirSync(sourcePath);
  for (const entry of entries) {
    if (!/^plan2code-/.test(entry)) continue;
    const srcSubdir = path.join(sourcePath, entry);
    if (!fs.statSync(srcSubdir).isDirectory()) continue;
    const destSubdir = path.join(destPath, entry);
    fs.mkdirSync(destSubdir, { recursive: true });
    const files = fs.readdirSync(srcSubdir);
    for (const file of files) {
      fs.copyFileSync(path.join(srcSubdir, file), path.join(destSubdir, file));
      stats.copied++;
    }
  }
}

/**
 * Remove files/dirs matching LEGACY_TARGETS patterns (silent cleanup)
 */
function cleanLegacyTargets() {
  const homedir = os.homedir();
  for (const target of LEGACY_TARGETS) {
    const targetDir = path.join(homedir, target.dir);
    if (!fs.existsSync(targetDir)) continue;
    const entries = fs.readdirSync(targetDir);
    for (const entry of entries) {
      if (!target.filePattern.test(entry)) continue;
      const entryPath = path.join(targetDir, entry);
      if (target.type === 'skill') {
        fs.rmSync(entryPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(entryPath);
      }
    }
  }
}

/**
 * Execute installation
 */
function install(targets = null) {
  const projectRoot = __dirname;
  const homeDir = os.homedir();
  const targetList = targets || getTargets();

  let totalInstalled = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  displaySectionHeader('  INSTALLING FILES  ');

  // Generate distribution files first
  if (!syncPrompts(true)) {
    console.log(`${COLORS.RED}${SYMBOLS.ERROR} Failed to generate distribution files${COLORS.RESET}`);
    return 1;
  }
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} Distribution files generated${COLORS.RESET}\n`);

  // Clean up legacy install targets before installing new ones
  cleanLegacyTargets();

  console.log('');
  displayStatusBox('PARAMETERS', [
    `${COLORS.CYAN}Source:${COLORS.RESET}           ${SOURCE_BASE}/`,
    `${COLORS.CYAN}Home Directory:${COLORS.RESET}   ${homeDir}`,
    `${COLORS.CYAN}Platforms:${COLORS.RESET}        ${targetList.length}`,
    `${COLORS.CYAN}Mode:${COLORS.RESET}             INSTALL`,
  ]);
  console.log('');

  console.log(`${COLORS.YELLOW}${SYMBOLS.ACTIVE} STARTING INSTALLATION${COLORS.RESET}\n`);

  for (const target of targetList) {
    // Handle both static dir strings and dynamic dir functions
    const sourceSubDir = target.sourceDir || target.dir;
    const sourcePath = path.join(projectRoot, SOURCE_BASE, typeof sourceSubDir === 'function' ? sourceSubDir() : sourceSubDir);
    const destPath = resolveTargetDir(target);
    const displayPathStr = getDisplayPath(target);

    console.log(`${COLORS.CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}${target.icon} ${target.name}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.DIM}Path: ${displayPathStr}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);

    // Check if source directory exists
    if (!fs.existsSync(sourcePath)) {
      const sourceDisplayDir = target.sourceDir || (typeof target.dir === 'string' ? target.dir : 'vscode-copilot-prompts');
      console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING} WARNING${COLORS.RESET} Source not found: ${SOURCE_BASE}/${sourceDisplayDir}`);
      console.log(`  ${COLORS.YELLOW}${SYMBOLS.INFO}${COLORS.RESET} Distribution files may be missing. Check src/ directory for source prompts.\n`);
      totalErrors++;
      continue;
    }

    // Get files/entries to install
    let files;
    try {
      files = fs.readdirSync(sourcePath).filter(f => target.filePattern.test(f));
    } catch (err) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR} ERROR${COLORS.RESET} Failed to read source directory: ${err.message}\n`);
      totalErrors++;
      continue;
    }

    if (files.length === 0) {
      const sourceDisplayDir = target.sourceDir || (typeof target.dir === 'string' ? target.dir : 'vscode-copilot-prompts');
      console.log(`  ${COLORS.YELLOW}${SYMBOLS.WARNING} WARNING${COLORS.RESET} No Plan2Code files found in ${SOURCE_BASE}/${sourceDisplayDir}\n`);
      continue;
    }

    // Create destination directory if needed
    if (!fs.existsSync(destPath)) {
      try {
        fs.mkdirSync(destPath, { recursive: true });
        console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS} CREATED${COLORS.RESET} Directory: ${displayPathStr}`);
      } catch (err) {
        console.log(`  ${COLORS.RED}${SYMBOLS.ERROR} ERROR${COLORS.RESET} Cannot create directory: ${err.message}\n`);
        totalErrors++;
        continue;
      }
    }

    // Clean up old files/dirs before copying new ones
    try {
      const existingFiles = fs.readdirSync(destPath).filter(f => target.filePattern.test(f));
      if (existingFiles.length > 0) {
        console.log(`  ${COLORS.YELLOW}${SYMBOLS.ACTIVE} CLEANING${COLORS.RESET} ${existingFiles.length} existing file(s)...`);
        for (const oldFile of existingFiles) {
          const oldFilePath = path.join(destPath, oldFile);
          try {
            if (target.type === 'skill') {
              fs.rmSync(oldFilePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(oldFilePath);
            }
            console.log(`    ${COLORS.YELLOW}░░░${COLORS.RESET} Removed: ${oldFile}`);
          } catch (err) {
            console.log(`    ${COLORS.RED}✖✖✖${COLORS.RESET} Failed to remove ${oldFile}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      // Directory might be newly created, ignore read errors
    }

    // Copy files/skill directories
    if (target.type === 'skill') {
      const copyStats = { copied: 0 };
      console.log(`  ${COLORS.CYAN}${SYMBOLS.ACTIVE} COPYING${COLORS.RESET} skill directories...`);
      try {
        copySkillDirectory(sourcePath, destPath, copyStats);
        console.log(`    ${COLORS.GREEN}▰▰▰${COLORS.RESET} ${copyStats.copied} file(s) across ${files.length} skill(s)`);
        totalInstalled += copyStats.copied;
      } catch (err) {
        console.log(`    ${COLORS.RED}✖✖✖${COLORS.RESET} Copy failed: ${err.message}`);
        totalErrors++;
      }
    } else {
      console.log(`  ${COLORS.CYAN}${SYMBOLS.ACTIVE} COPYING${COLORS.RESET} ${files.length} file(s)...`);
      for (const file of files) {
        const srcFile = path.join(sourcePath, file);
        const destFile = path.join(destPath, file);

        try {
          fs.copyFileSync(srcFile, destFile);
          console.log(`    ${COLORS.GREEN}▰▰▰${COLORS.RESET} ${file}`);
          totalInstalled++;
        } catch (err) {
          console.log(`    ${COLORS.RED}✖✖✖${COLORS.RESET} ${file}: ${err.message}`);
          totalErrors++;
        }
      }
    }
    console.log('');
  }

  // Summary
  console.log(`${COLORS.CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(31)}${COLORS.BRIGHT}S U M M A R Y${COLORS.RESET}${' '.repeat(31)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╠═══════════════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);

  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.GREEN}Mode:${COLORS.RESET}              INSTALL`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);

  const statusColor = totalErrors > 0 ? COLORS.RED : COLORS.GREEN;
  const statusText = totalErrors > 0 ? 'COMPLETED WITH ERRORS' : 'SUCCESS';

  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${statusColor}Status:${COLORS.RESET}            ${statusColor}${statusText}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Files Installed:   ${COLORS.GREEN}${totalInstalled}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);

  if (totalSkipped > 0) {
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Files Skipped:     ${COLORS.YELLOW}${totalSkipped}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  }
  if (totalErrors > 0) {
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Errors:            ${COLORS.RED}${totalErrors}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  }

  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);

  // Show celebratory or sad mascot based on result
  console.log('');
  if (totalErrors === 0) {
    console.log(`${COLORS.GREEN}    ╭───╮${COLORS.RESET}   ${COLORS.BRIGHT}All done! Happy coding!${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    │ ${COLORS.CYAN}★${COLORS.GREEN} │${COLORS.RESET}   ${COLORS.BRIGHT}If this is your first time using Plan2Code, read the docs here:${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    │ ${COLORS.BRIGHT}◡${COLORS.GREEN} │${COLORS.RESET}   ${COLORS.BRIGHT}https://github.com/jparkerweb/plan2code${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    ╰───╯${COLORS.RESET}`);
  }

  console.log('');

  return totalErrors === 0 ? 0 : 1;
}

// ============================================================================
// UNINSTALLATION
// ============================================================================

/**
 * Execute uninstallation
 */
function uninstallFiles(targets = null) {
  const homeDir = os.homedir();
  const targetList = targets || getTargets();

  let totalRemoved = 0;
  let totalErrors = 0;

  displaySectionHeader('UNINSTALLATION', '[ REMOVING FILES ]');

  console.log('');
  displayStatusBox('PARAMETERS', [
    `${COLORS.CYAN}Home Directory:${COLORS.RESET}   ${homeDir}`,
    `${COLORS.CYAN}Platforms:${COLORS.RESET}        ${targetList.length}`,
    `${COLORS.CYAN}Mode:${COLORS.RESET}             UNINSTALL`,
  ]);
  console.log('');

  // Clean up legacy install targets
  cleanLegacyTargets();

  console.log(`${COLORS.YELLOW}${SYMBOLS.ACTIVE} STARTING UNINSTALLATION${COLORS.RESET}\n`);

  for (const target of targetList) {
    const destPath = resolveTargetDir(target);
    const displayPathStr = getDisplayPath(target);

    console.log(`${COLORS.CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}${target.icon} ${target.name}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.DIM}Path: ${displayPathStr}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);

    // Check if destination directory exists
    if (!fs.existsSync(destPath)) {
      console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} Directory not found - nothing to remove\n${COLORS.RESET}`);
      continue;
    }

    // Get files/entries to remove
    let files;
    try {
      files = fs.readdirSync(destPath).filter(f => target.filePattern.test(f));
    } catch (err) {
      console.log(`  ${COLORS.RED}${SYMBOLS.ERROR} ERROR${COLORS.RESET} Failed to read directory: ${err.message}\n`);
      totalErrors++;
      continue;
    }

    if (files.length === 0) {
      console.log(`  ${COLORS.DIM}${SYMBOLS.INFO} No Plan2Code files found - nothing to remove\n${COLORS.RESET}`);
      continue;
    }

    // Remove files/skill directories
    console.log(`  ${COLORS.CYAN}${SYMBOLS.ACTIVE} REMOVING${COLORS.RESET} ${files.length} file(s)...`);
    for (const file of files) {
      const destFile = path.join(destPath, file);

      try {
        if (target.type === 'skill') {
          fs.rmSync(destFile, { recursive: true, force: true });
        } else {
          fs.unlinkSync(destFile);
        }
        console.log(`    ${COLORS.GREEN}▰▰▰${COLORS.RESET} Removed: ${file}`);
        totalRemoved++;
      } catch (err) {
        console.log(`    ${COLORS.RED}✖✖✖${COLORS.RESET} ${file}: ${err.message}`);
        totalErrors++;
      }
    }
    console.log('');
  }

  // Summary
  console.log(`${COLORS.CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(31)}${COLORS.BRIGHT}S U M M A R Y${COLORS.RESET}${' '.repeat(31)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╠═══════════════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);

  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.GREEN}Mode:${COLORS.RESET}              UNINSTALL`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);

  const statusColor = totalErrors > 0 ? COLORS.RED : COLORS.GREEN;
  const statusText = totalErrors > 0 ? 'COMPLETED WITH ERRORS' : 'SUCCESS';

  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${statusColor}Status:${COLORS.RESET}            ${statusColor}${statusText}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Files Removed:     ${COLORS.GREEN}${totalRemoved}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);

  if (totalErrors > 0) {
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Errors:            ${COLORS.RED}${totalErrors}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  }

  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);

  console.log('');

  return totalErrors === 0 ? 0 : 1;
}

// ============================================================================
// LOCAL INSTALLATION INSTRUCTIONS
// ============================================================================

/**
 * Display local installation instructions for manual copy/paste
 */
function displayLocalInstructions() {
  const projectRoot = __dirname;

  displaySectionHeader('LOCAL INSTALLATION', '[ MANUAL COPY/PASTE INSTRUCTIONS ]');

  // Generate dist files first
  console.log(`${COLORS.CYAN}${SYMBOLS.ACTIVE} GENERATING DISTRIBUTION FILES${COLORS.RESET}\n`);
  if (!syncPrompts(true)) {
    console.log(`${COLORS.RED}${SYMBOLS.ERROR} Failed to generate distribution files${COLORS.RESET}`);
    return 1;
  }
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} Distribution files generated${COLORS.RESET}\n`);

  const localDistPath = path.join(projectRoot, 'dist', 'local-commands');

  console.log(`${COLORS.GREEN}${SYMBOLS.ACTIVE} LOCAL INSTALLATION INSTRUCTIONS${COLORS.RESET}\n`);

  displayStatusBox('OVERVIEW', [
    `Local installation copies prompts to your ${COLORS.BRIGHT}project directory${COLORS.RESET}`,
    `(not your home directory). This is useful for project-specific setups.`,
    '',
    `Files have been generated in:`,
    `${COLORS.CYAN}${localDistPath}${COLORS.RESET}`,
  ]);

  console.log('');
  console.log(`${COLORS.CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}COPY THE APPROPRIATE FOLDER TO YOUR PROJECT ROOT${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╠═══════════════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);

  // Show local destinations
  const localDirs = [
    { name: 'Claude Code', dir: '.claude/commands/', desc: 'Slash commands for Claude Code' },
    { name: 'Cursor', dir: '.cursor/commands/', desc: 'Slash commands for Cursor IDE' },
    { name: 'GitHub Copilot', dir: '.github/prompts/', desc: 'Prompts for GitHub Copilot' },
    { name: 'Continue', dir: '.continue/prompts/', desc: 'Prompts for Continue extension' },
    { name: 'Windsurf', dir: '.windsurf/workflows/', desc: 'Workflows for Windsurf' },
    { name: 'Codeium (IntelliJ)', dir: '.codeium/global_workflows/', desc: 'Codeium global workflows' },
  ];

  localDirs.forEach((item, i) => {
    const num = `${COLORS.BRIGHT}${i + 1}.${COLORS.RESET}`;
    const name = `${COLORS.GREEN}${item.name.padEnd(16)}${COLORS.RESET}`;
    const dir = `${COLORS.DIM}${item.dir}${COLORS.RESET}`;
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${num} ${name} ${dir}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  });

  console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);

  console.log('');
  displayStatusBox('EXAMPLE COMMANDS', [
    `${COLORS.BRIGHT}For Claude Code:${COLORS.RESET}`,
    `${COLORS.GREEN}cp -r dist/local-commands/.claude YOUR_PROJECT/${COLORS.RESET}`,
    '',
    `${COLORS.BRIGHT}For Cursor:${COLORS.RESET}`,
    `${COLORS.GREEN}cp -r dist/local-commands/.cursor YOUR_PROJECT/${COLORS.RESET}`,
    '',
    `${COLORS.BRIGHT}For GitHub Copilot:${COLORS.RESET}`,
    `${COLORS.GREEN}cp -r dist/local-commands/.github YOUR_PROJECT/${COLORS.RESET}`,
    '',
    `${COLORS.BRIGHT}For Continue:${COLORS.RESET}`,
    `${COLORS.GREEN}cp -r dist/local-commands/.continue YOUR_PROJECT/${COLORS.RESET}`,
  ]);

  console.log('');
  console.log(`${COLORS.DIM}The dist/local-commands/ folder contains all necessary files organized by tool.`);
  console.log(`Copy the appropriate subfolder(s) to your project root directory.${COLORS.RESET}`);
  console.log('');

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
    // Task 2.1: Main menu display
    displayHeader();

    console.log(`${COLORS.BLUE}${COLORS.BRIGHT}Version Info:${COLORS.RESET} ${projectVersion.name} ${projectVersion.version}`);
    console.log('');

    console.log(`${COLORS.CYAN}╔═════════════════════════════════════════════════════════╗${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}INSTALL PLAN2CODE${COLORS.RESET}`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}╠═════════════════════════════════════════════════════════╣${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}I.${COLORS.RESET}  ${COLORS.GREEN}INSTALL${COLORS.RESET}    Install Plan2Code for all platforms`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}U.${COLORS.RESET}  ${COLORS.RED}UNINSTALL${COLORS.RESET}  Remove Plan2Code files`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}C.${COLORS.RESET}  ${COLORS.BLUE}CUSTOM${COLORS.RESET}     Advanced options`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}Q.${COLORS.RESET}  ${COLORS.DIM}QUIT${COLORS.RESET}       Exit`, 58) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}╚═════════════════════════════════════════════════════════╝${COLORS.RESET}`);
    console.log('');

    // Task 2.2: Input prompt
    console.log('');
    const answer = await question(`${COLORS.CYAN}${SYMBOLS.SELECT} SELECT OPTION${COLORS.RESET} (I, U, C, Q) [I]: `);
    const input = answer.trim().toUpperCase() || 'I';

    // Task 2.3: I path — Install All
    if (input === 'I') {
      rl.close();
      const loopResult = installPlan2CodeLoop();
      console.log('');
      const metricsResult = installPlan2CodeMetrics();
      console.log('');
      const installResult = install();
      const exitCode = loopResult !== 0 ? loopResult : metricsResult !== 0 ? metricsResult : installResult;
      process.exit(exitCode);
    }

    // Task 2.4: U path — Uninstall All
    if (input === 'U') {
      console.log('');
      console.log(`${COLORS.RED}   o     o${COLORS.RESET}`);
      console.log(`${COLORS.RED}    ╲   ╱  ${COLORS.YELLOW}!${COLORS.RESET}`);
      console.log(`${COLORS.RED}    ╭───╮${COLORS.RESET}`);
      console.log(`${COLORS.RED}    │ ${COLORS.YELLOW}○${COLORS.RED} │${COLORS.RESET}`);
      console.log(`${COLORS.RED}    │ ${COLORS.YELLOW}~${COLORS.RED} │${COLORS.RESET}   ${COLORS.DIM}Are you sure? This will remove Plan2Code from all platforms.${COLORS.RESET}`);
      console.log(`${COLORS.RED}    ├───┤${COLORS.RESET}`);
      console.log(`${COLORS.RED}    │ · │${COLORS.RESET}`);
      console.log(`${COLORS.RED}    ╰───╯${COLORS.RESET}`);
      console.log('');
      const confirmAnswer = await question(`${COLORS.RED}${SYMBOLS.SELECT} CONFIRM UNINSTALL${COLORS.RESET} (Y/N) [N]: `);
      const confirmInput = confirmAnswer.trim().toUpperCase() || 'N';

      if (confirmInput === 'Y') {
        rl.close();
        const uninstallResult = uninstallFiles();
        const loopResult = uninstallPlan2CodeLoop();
        const metricsResult = uninstallPlan2CodeMetrics();
        const exitCode = uninstallResult !== 0 ? uninstallResult : loopResult !== 0 ? loopResult : metricsResult;
        process.exit(exitCode);
      } else {
        console.log(`\n${COLORS.YELLOW}${SYMBOLS.WARNING} CANCELLED${COLORS.RESET}\n`);
        rl.close();
        process.exit(0);
      }
    }

    // Task 2.5: C path — CUSTOM sub-menu
    if (input === 'C') {
      console.log('');
      console.log(`${COLORS.CYAN}╔════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}CUSTOM OPTIONS${COLORS.RESET}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(`${COLORS.CYAN}╠════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}L.${COLORS.RESET}  ${COLORS.BLUE}LOCAL${COLORS.RESET}      Show local (project) install instructions`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}O.${COLORS.RESET}  ${COLORS.GREEN}LOOP CLI${COLORS.RESET}   Install plan2code-loop CLI only`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}M.${COLORS.RESET}  ${COLORS.GREEN}METRICS${COLORS.RESET}    Install plan2code-metrics CLI only`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}Q.${COLORS.RESET}  ${COLORS.DIM}BACK${COLORS.RESET}       Return to main menu`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(`${COLORS.CYAN}╚════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);
      console.log('');
      const customAnswer = await question(`${COLORS.CYAN}${SYMBOLS.SELECT} SELECT OPTION${COLORS.RESET} (L, O, M, Q) [Q]: `);
      const customInput = customAnswer.trim().toUpperCase() || 'Q';

      // Task 2.6: C > L — show local install instructions
      if (customInput === 'L') {
        rl.close();
        process.exit(displayLocalInstructions());
      }

      // Task 2.7: C > O — install loop CLI only
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

      // Task 2.8: C > Q — back to main menu
      return main();
    }

    // Task 2.8: Q — exit
    if (input === 'Q') {
      console.log(`\n${COLORS.YELLOW}${SYMBOLS.WARNING} CANCELLED${COLORS.RESET}\n`);
      rl.close();
      process.exit(0);
    }

    // Task 2.8: Invalid input — loop back
    console.log(`\n${COLORS.RED}${SYMBOLS.ERROR} Invalid option. Please choose I, U, C, or Q.${COLORS.RESET}\n`);
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

const { execSync, spawn } = require('child_process');

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
        // File exists, try to remove it
        try {
          // Try rmdirSync first for junctions/symlinks
          fs.rmdirSync(file.path);
          console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
          removedCount++;
        } catch (rmdirErr) {
          // Fall back to unlinkSync for regular files
          try {
            fs.unlinkSync(file.path);
            console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
            removedCount++;
          } catch (unlinkErr) {
            // Last resort: rmSync
            fs.rmSync(file.path, { force: true, recursive: true });
            console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
            removedCount++;
          }
        }
      } catch (err) {
        // File doesn't exist, skip it
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
        try {
          fs.rmdirSync(file.path);
          console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
          removedCount++;
        } catch (rmdirErr) {
          try {
            fs.unlinkSync(file.path);
            console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
            removedCount++;
          } catch (unlinkErr) {
            fs.rmSync(file.path, { force: true, recursive: true });
            console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS}${COLORS.RESET} Removed: ${file.name}`);
            removedCount++;
          }
        }
      } catch (err) {
        // File doesn't exist, skip it
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
// MAIN
// ============================================================================

// Always run interactive menu
runInteractive();
