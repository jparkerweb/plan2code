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
 *
 * OPTIONS:
 *   (no options)    INTERACTIVE - Select platforms from menu
 *   --dry-run       PREVIEW - Show what would be installed without changes
 *   --platform X    TARGETED - Install to specific platform only
 *   --local         LOCAL - Show instructions for project-level installation
 *   --uninstall     REMOVE - Remove installed files
 *   --help          HELP - Display usage information
 *
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
    '   │ ● │   ',
    '   │ ◡ │   ',
    '   ╰───╯   ',
  ],
  // Mini mascot for inline use
  mini: '(◉‿◉)',
  // Waving mascot for greetings
  wave: [
    '   ╭───╮   ',
    '   │ ● │   ',
    '   │ ◡ │   ',
    '   ╰───╯   ',
  ],
  // Thinking mascot for prompts
  thinking: [
    '   ╭───╮   ',
    '   │ ● │  ?',
    '   │ ~ │   ',
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

// Installation targets
const INSTALL_TARGETS = [
  {
    name: 'Claude Code',
    id: 'claude',
    dir: '.claude/commands',
    filePattern: /^plan2code-.*\.md$/,
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
  }
];

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const uninstall = args.includes('--uninstall');
const localInstall = args.includes('--local');
const platformIndex = args.indexOf('--platform');
const selectedPlatform = platformIndex !== -1 ? args[platformIndex + 1] : null;
const hasArgs = args.length > 0;

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
  console.log(`${COLORS.GREEN}${COLORS.BRIGHT}`);
  console.log('╔═════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         ╭───╮                                                   ║');
  console.log('║                         │ ● │   Hi!                                             ║');
  console.log('║                         │ ◡ │   Nice to meet you                                ║');
  console.log('║                         ╰───╯                                                   ║');
  console.log('║                                                                                 ║');
  console.log('║ ██████╗ ██╗      █████╗ ███╗   ██╗  ██████╗    ██████╗ ██████╗ ██████╗ ███████╗ ║');
  console.log('║ ██╔══██╗██║     ██╔══██╗████╗  ██║  ╚════██╗  ██╔════╝██╔═══██╗██╔══██╗██╔════╝ ║');
  console.log('║ ██████╔╝██║     ███████║██╔██╗ ██║   █████╔╝  ██║     ██║   ██║██║  ██║█████╗   ║');
  console.log('║ ██╔═══╝ ██║     ██╔══██║██║╚██╗██║  ██╔═══╝   ██║     ██║   ██║██║  ██║██╔══╝   ║');
  console.log('║ ██║     ███████╗██║  ██║██║ ╚████║  ███████╗  ╚██████╗╚██████╔╝██████╔╝███████╗ ║');
  console.log('║ ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝ ║');
  console.log('║                                                                                 ║');
  console.log('║               G L O B A L   I N S T A L L A T I O N   S Y S T E M               ║');
  console.log('║                         https://plan2code.jparkerweb.com                        ║');
  console.log('║                                                                                 ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════════════╝');
  console.log(COLORS.RESET);
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
 * Display help information
 */
function displayHelp() {
  displayHeader();

  console.log(`${COLORS.GREEN}${SYMBOLS.ACTIVE} USAGE GUIDE${COLORS.RESET}\n`);

  displayStatusBox('OPTIONS', [
    `${COLORS.CYAN}◆${COLORS.RESET} ${COLORS.BRIGHT}node install.js${COLORS.RESET}`,
    `  ${COLORS.DIM}Interactive mode - Select platforms from menu${COLORS.RESET}`,
    '',
    `${COLORS.CYAN}◆${COLORS.RESET} ${COLORS.BRIGHT}node install.js --dry-run${COLORS.RESET}`,
    `  ${COLORS.DIM}Preview mode - Show what would be installed without changes${COLORS.RESET}`,
    '',
    `${COLORS.CYAN}◆${COLORS.RESET} ${COLORS.BRIGHT}node install.js --platform <ID>${COLORS.RESET}`,
    `  ${COLORS.DIM}Install to specific platform only${COLORS.RESET}`,
    `  ${COLORS.DIM}Valid IDs: claude, copilot, cursor, continue, windsurf, codeium, vscode-copilot${COLORS.RESET}`,
    '',
    `${COLORS.CYAN}◆${COLORS.RESET} ${COLORS.BRIGHT}node install.js --local${COLORS.RESET}`,
    `  ${COLORS.DIM}Show local (project-level) installation instructions${COLORS.RESET}`,
    '',
    `${COLORS.CYAN}◆${COLORS.RESET} ${COLORS.BRIGHT}node install.js --uninstall${COLORS.RESET}`,
    `  ${COLORS.DIM}Remove all installed Plan2Code files${COLORS.RESET}`,
    '',
    `${COLORS.CYAN}◆${COLORS.RESET} ${COLORS.BRIGHT}node install.js --loop${COLORS.RESET}`,
    `  ${COLORS.DIM}Build and install plan2code-loop CLI tool${COLORS.RESET}`,
    '',
    `${COLORS.CYAN}◆${COLORS.RESET} ${COLORS.BRIGHT}node install.js --uninstall-loop${COLORS.RESET}`,
    `  ${COLORS.DIM}Remove plan2code-loop global symlink${COLORS.RESET}`,
    '',
    `${COLORS.CYAN}◆${COLORS.RESET} ${COLORS.BRIGHT}node install.js --help${COLORS.RESET}`,
    `  ${COLORS.DIM}Display this help information${COLORS.RESET}`,
  ]);

  console.log('');
  displayStatusBox('INSTALLATION PATHS', [
    `${COLORS.YELLOW}[1]${COLORS.RESET} Claude Code      ${COLORS.DIM}→ ~/.claude/commands/${COLORS.RESET}`,
    `${COLORS.YELLOW}[2]${COLORS.RESET} Copilot CLI      ${COLORS.DIM}→ ~/.copilot/agents/${COLORS.RESET}`,
    `${COLORS.YELLOW}[3]${COLORS.RESET} Cursor           ${COLORS.DIM}→ ~/.cursor/commands/${COLORS.RESET}`,
    `${COLORS.YELLOW}[4]${COLORS.RESET} Continue         ${COLORS.DIM}→ ~/.continue/prompts/${COLORS.RESET}`,
    `${COLORS.YELLOW}[5]${COLORS.RESET} Windsurf         ${COLORS.DIM}→ ~/.codeium/windsurf/global_workflows/${COLORS.RESET}`,
    `${COLORS.YELLOW}[6]${COLORS.RESET} Codeium (IJ)     ${COLORS.DIM}→ ~/.codeium/global_workflows/${COLORS.RESET}`,
    `${COLORS.YELLOW}[7]${COLORS.RESET} VS Code Copilot  ${COLORS.DIM}→ <platform-specific>/Code/User/prompts/${COLORS.RESET}`,
  ]);

  console.log('');
  displayStatusBox('EXAMPLES', [
    `${COLORS.GREEN}$${COLORS.RESET} node install.js`,
    `  ${COLORS.DIM}Open interactive menu to select platforms${COLORS.RESET}`,
    '',
    `${COLORS.GREEN}$${COLORS.RESET} node install.js --platform copilot`,
    `  ${COLORS.DIM}Install to Copilot CLI only${COLORS.RESET}`,
    '',
    `${COLORS.GREEN}$${COLORS.RESET} node install.js --dry-run`,
    `  ${COLORS.DIM}Preview installation for all platforms${COLORS.RESET}`,
    '',
    `${COLORS.GREEN}$${COLORS.RESET} node install.js --uninstall`,
    `  ${COLORS.DIM}Remove files from all platforms${COLORS.RESET}`,
  ]);

  console.log('');
  console.log(`${COLORS.DIM}This utility installs Plan2Code prompts from dist/global-commands/ to your`);
  console.log(`home directory for global access across all projects.${COLORS.RESET}`);
  console.log('');
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
// COMMAND LINE ARGUMENT PROCESSING
// ============================================================================

if (args.includes('--help') || args.includes('-h')) {
  displayHelp();
  process.exit(0);
}

// Validate platform argument
if (selectedPlatform) {
  const validPlatforms = INSTALL_TARGETS.map(t => t.id);
  if (!validPlatforms.includes(selectedPlatform)) {
    console.log(`${COLORS.RED}${SYMBOLS.ERROR} ERROR${COLORS.RESET}`);
    console.log(`${COLORS.RED}Unknown platform: '${selectedPlatform}'${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}Valid platforms: ${validPlatforms.join(', ')}${COLORS.RESET}\n`);
    process.exit(1);
  }
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
  if (!dryRun && !fs.existsSync(destDir)) {
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
    if (!dryRun) {
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
  if (!dryRun) {
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
      writeToDestination(projectRoot, 'dist/local-commands', dest, prompt, sourceContent, stats, quiet);
    }

    // Write to dist/global-commands/
    for (const dest of GLOBAL_DESTINATIONS) {
      writeToDestination(projectRoot, 'dist/global-commands', dest, prompt, sourceContent, stats, quiet);
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
  if (selectedPlatform) {
    return INSTALL_TARGETS.filter(t => t.id === selectedPlatform);
  }
  return INSTALL_TARGETS;
}

// ============================================================================
// INSTALLATION
// ============================================================================

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

  displaySectionHeader(
    'INSTALLATION',
    dryRun ? '[ PREVIEW MODE - NO CHANGES WILL BE MADE ]' : '[ INSTALLING FILES ]'
  );

  // Generate distribution files first
  if (!syncPrompts(true)) {
    console.log(`${COLORS.RED}${SYMBOLS.ERROR} Failed to generate distribution files${COLORS.RESET}`);
    return 1;
  }
  console.log(`${COLORS.GREEN}${SYMBOLS.SUCCESS} Distribution files generated${COLORS.RESET}\n`);

  console.log('');
  displayStatusBox('PARAMETERS', [
    `${COLORS.CYAN}Source:${COLORS.RESET}           ${SOURCE_BASE}/`,
    `${COLORS.CYAN}Home Directory:${COLORS.RESET}   ${homeDir}`,
    `${COLORS.CYAN}Platforms:${COLORS.RESET}        ${targetList.length}`,
    `${COLORS.CYAN}Mode:${COLORS.RESET}             ${dryRun ? 'PREVIEW' : 'INSTALL'}`,
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

    // Get files to install
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
    if (!dryRun && !fs.existsSync(destPath)) {
      try {
        fs.mkdirSync(destPath, { recursive: true });
        console.log(`  ${COLORS.GREEN}${SYMBOLS.SUCCESS} CREATED${COLORS.RESET} Directory: ${displayPathStr}`);
      } catch (err) {
        console.log(`  ${COLORS.RED}${SYMBOLS.ERROR} ERROR${COLORS.RESET} Cannot create directory: ${err.message}\n`);
        totalErrors++;
        continue;
      }
    }

    // Clean up old files before copying new ones
    try {
      const existingFiles = fs.readdirSync(destPath).filter(f => target.filePattern.test(f));
      if (existingFiles.length > 0) {
        console.log(`  ${COLORS.YELLOW}${SYMBOLS.ACTIVE} CLEANING${COLORS.RESET} ${existingFiles.length} existing file(s)...`);
        for (const oldFile of existingFiles) {
          const oldFilePath = path.join(destPath, oldFile);
          try {
            if (!dryRun) {
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

    // Copy files
    console.log(`  ${COLORS.CYAN}${SYMBOLS.ACTIVE} COPYING${COLORS.RESET} ${files.length} file(s)...`);
    for (const file of files) {
      const srcFile = path.join(sourcePath, file);
      const destFile = path.join(destPath, file);

      try {
        if (!dryRun) {
          fs.copyFileSync(srcFile, destFile);
        }
        console.log(`    ${COLORS.GREEN}▰▰▰${COLORS.RESET} ${file}`);
        totalInstalled++;
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

  if (dryRun) {
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.YELLOW}Mode:${COLORS.RESET}              PREVIEW - No files were copied`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  } else {
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.GREEN}Mode:${COLORS.RESET}              INSTALL`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  }

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
  if (totalErrors === 0 && !dryRun) {
    console.log(`${COLORS.GREEN}    ╭───╮${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    │ ${COLORS.CYAN}★${COLORS.GREEN} │${COLORS.RESET}   ${COLORS.BRIGHT}All done! Happy coding!${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    │ ${COLORS.BRIGHT}◡${COLORS.GREEN} │${COLORS.RESET}   ${COLORS.BRIGHT}If this is your first time using Plan2Code, read the docs here:${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    ╰───╯${COLORS.RESET}   ${COLORS.BRIGHT}https://github.com/jparkerweb/plan2code${COLORS.RESET}`);
  } else if (dryRun) {
    console.log(`${COLORS.YELLOW}    ╭───╮${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}    │ ${COLORS.CYAN}●${COLORS.YELLOW} │${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}    │ ○ │${COLORS.RESET}   ${COLORS.DIM}That was just a preview!${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}    ╰───╯${COLORS.RESET}`);
    console.log('');
    console.log(`${COLORS.YELLOW}${SYMBOLS.INFO} Run without --dry-run to install files${COLORS.RESET}`);
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

  displaySectionHeader(
    'UNINSTALLATION',
    dryRun ? '[ PREVIEW MODE - NO CHANGES WILL BE MADE ]' : '[ REMOVING FILES ]'
  );

  console.log('');
  displayStatusBox('PARAMETERS', [
    `${COLORS.CYAN}Home Directory:${COLORS.RESET}   ${homeDir}`,
    `${COLORS.CYAN}Platforms:${COLORS.RESET}        ${targetList.length}`,
    `${COLORS.CYAN}Mode:${COLORS.RESET}             ${dryRun ? 'PREVIEW' : 'UNINSTALL'}`,
  ]);
  console.log('');

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

    // Get files to remove
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

    // Remove files
    console.log(`  ${COLORS.CYAN}${SYMBOLS.ACTIVE} REMOVING${COLORS.RESET} ${files.length} file(s)...`);
    for (const file of files) {
      const destFile = path.join(destPath, file);

      try {
        if (!dryRun) {
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

  if (dryRun) {
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.YELLOW}Mode:${COLORS.RESET}              PREVIEW - No files were removed`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  } else {
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.GREEN}Mode:${COLORS.RESET}              UNINSTALL`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  }

  const statusColor = totalErrors > 0 ? COLORS.RED : COLORS.GREEN;
  const statusText = totalErrors > 0 ? 'COMPLETED WITH ERRORS' : 'SUCCESS';

  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${statusColor}Status:${COLORS.RESET}            ${statusColor}${statusText}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Files Removed:     ${COLORS.GREEN}${totalRemoved}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);

  if (totalErrors > 0) {
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  Errors:            ${COLORS.RED}${totalErrors}${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
  }

  console.log(`${COLORS.CYAN}║${COLORS.RESET}${' '.repeat(75)}${COLORS.CYAN}║${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);

  if (dryRun) {
    console.log('');
    console.log(`${COLORS.YELLOW}${SYMBOLS.INFO} Run without --dry-run to remove files${COLORS.RESET}`);
  }

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
    displayHeader();

    console.log(`${COLORS.BLUE}${COLORS.BRIGHT}Version Info:${COLORS.RESET} ${projectVersion.name} ${projectVersion.version}`);
    console.log(`${COLORS.GREEN}${SYMBOLS.ACTIVE} SELECT PLATFORMS${COLORS.RESET}\n`);

    console.log(`${COLORS.CYAN}╔════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}AVAILABLE PLATFORMS${COLORS.RESET}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}╠════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);

    INSTALL_TARGETS.forEach((target, i) => {
      const num = `${COLORS.BRIGHT}${i + 1}.${COLORS.RESET}`;
      const icon = `${COLORS.GREEN}${target.icon}${COLORS.RESET}`;
      const name = `${COLORS.BRIGHT}${target.name.padEnd(14)}${COLORS.RESET}`;
      const targetPath = `${COLORS.DIM}${getDisplayPath(target)}${COLORS.RESET}`;

      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${num} ${icon} ${name} ${targetPath}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
    });

    console.log(`${COLORS.CYAN}╠════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}A.${COLORS.RESET} ${COLORS.MAGENTA}◉  ALL${COLORS.RESET}         ${COLORS.BRIGHT}Install to ALL platforms + loop CLI${COLORS.RESET}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}L.${COLORS.RESET} ${COLORS.BLUE}◉  LOCAL${COLORS.RESET}       ${COLORS.BRIGHT}Show local (project) install instructions${COLORS.RESET}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}O.${COLORS.RESET} ${COLORS.GREEN}◉  LOOP${COLORS.RESET}        ${COLORS.BRIGHT}Install plan2code-loop CLI only${COLORS.RESET}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}U.${COLORS.RESET} ${COLORS.RED}◉  UNINSTALL${COLORS.RESET}   ${COLORS.BRIGHT}Remove Plan2Code files + loop CLI${COLORS.RESET}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}Q.${COLORS.RESET} ${COLORS.DIM}◉  QUIT${COLORS.RESET}        ${COLORS.BRIGHT}Exit${COLORS.RESET}`, 65) + `${COLORS.CYAN}║${COLORS.RESET}`);
    console.log(`${COLORS.CYAN}╚════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);
    console.log('');

    // Show thinking mascot for input prompt
    console.log(`${COLORS.MAGENTA}    ╭───╮${COLORS.RESET}`);
    console.log(`${COLORS.MAGENTA}    │ ${COLORS.CYAN}●${COLORS.MAGENTA} │${COLORS.RESET}   ${COLORS.DIM}What would you like to do?${COLORS.RESET}`);
    console.log(`${COLORS.MAGENTA}    │ ${COLORS.YELLOW}~${COLORS.MAGENTA} │${COLORS.RESET}   ${COLORS.GREEN}I suggest A: 'Install to ALL platforms + loop CLI'${COLORS.RESET}`);
    console.log(`${COLORS.MAGENTA}    ╰───╯${COLORS.RESET}`);
    console.log('');
    const answer = await question(`${COLORS.CYAN}${SYMBOLS.SELECT} SELECT OPTION${COLORS.RESET} (1-7, A, L, O, U, Q, or 1,3,5): `);
    const input = answer.trim().toUpperCase();

    if (input === 'Q' || input === '') {
      console.log(`\n${COLORS.YELLOW}${SYMBOLS.WARNING} CANCELLED${COLORS.RESET}\n`);
      rl.close();
      process.exit(0);
    }

    if (input === 'L') {
      // Local installation instructions
      rl.close();
      process.exit(displayLocalInstructions());
    }

    if (input === 'O') {
      // Install plan2code-loop
      rl.close();
      process.exit(installPlan2CodeLoop());
    }

    if (input === 'U') {
      // Uninstall flow
      console.log('');
      console.log(`${COLORS.CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET} ${COLORS.BRIGHT}${COLORS.RED}UNINSTALL FROM PLATFORMS${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(`${COLORS.CYAN}╠═══════════════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);

      INSTALL_TARGETS.forEach((target, i) => {
        const num = `${COLORS.BRIGHT}${i + 1}.${COLORS.RESET}`;
        const icon = `${COLORS.RED}${target.icon}${COLORS.RESET}`;
        const name = `${COLORS.BRIGHT}${target.name.padEnd(14)}${COLORS.RESET}`;
        const targetPath = `${COLORS.DIM}${getDisplayPath(target)}${COLORS.RESET}`;

        console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${num} ${icon} ${name} ${targetPath}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
      });

      console.log(`${COLORS.CYAN}╠═══════════════════════════════════════════════════════════════════════════╣${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}A.${COLORS.RESET} ${COLORS.RED}◉  ALL${COLORS.RESET}         ${COLORS.BRIGHT}Uninstall from ALL platforms + loop CLI${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(padEndVisible(`${COLORS.CYAN}║${COLORS.RESET}  ${COLORS.BRIGHT}Q.${COLORS.RESET} ${COLORS.DIM}◉  CANCEL${COLORS.RESET}      ${COLORS.BRIGHT}Cancel${COLORS.RESET}`, 76) + `${COLORS.CYAN}║${COLORS.RESET}`);
      console.log(`${COLORS.CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${COLORS.RESET}`);
      console.log('');

      // Show worried mascot for uninstall prompt
      console.log(`${COLORS.RED}    ╭───╮${COLORS.RESET}`);
      console.log(`${COLORS.RED}    │ ${COLORS.YELLOW}○${COLORS.RED} │${COLORS.RESET}`);
      console.log(`${COLORS.RED}    │ ${COLORS.YELLOW}~${COLORS.RED} │${COLORS.RESET}   ${COLORS.DIM}Are you sure about this?${COLORS.RESET}`);
      console.log(`${COLORS.RED}    ╰───╯${COLORS.RESET}`);
      console.log('');
      const uninstallAnswer = await question(`${COLORS.RED}${SYMBOLS.SELECT} SELECT PLATFORMS TO UNINSTALL${COLORS.RESET} (1-7, A, Q, or 1,3,5): `);
      const uninstallInput = uninstallAnswer.trim().toUpperCase();

      if (uninstallInput === 'Q' || uninstallInput === '') {
        console.log(`\n${COLORS.YELLOW}${SYMBOLS.WARNING} CANCELLED${COLORS.RESET}\n`);
        rl.close();
        process.exit(0);
      }

      let targets;
      if (uninstallInput === 'A') {
        targets = INSTALL_TARGETS;
      } else {
        const indices = uninstallInput.split(',').map(s => parseInt(s.trim()) - 1);
        const validIndices = indices.filter(i => i >= 0 && i < INSTALL_TARGETS.length);

        if (validIndices.length === 0) {
          console.log(`${COLORS.RED}${SYMBOLS.ERROR} Invalid selection${COLORS.RESET}\n`);
          rl.close();
          process.exit(1);
        }

        targets = validIndices.map(i => INSTALL_TARGETS[i]);
      }

      const platformNames = targets.map(t => `${COLORS.YELLOW}${t.name}${COLORS.RESET}`).join(', ');
      const confirm = await question(`\n${COLORS.RED}${SYMBOLS.WARNING} CONFIRM UNINSTALL${COLORS.RESET} from ${targets.length} platform(s): ${platformNames}? (y/N): `);

      if (confirm.trim().toLowerCase() !== 'y') {
        console.log(`\n${COLORS.YELLOW}${SYMBOLS.WARNING} CANCELLED${COLORS.RESET}\n`);
        rl.close();
        process.exit(0);
      }

      rl.close();
      const uninstallResult = uninstallFiles(targets);

      // If uninstalling from ALL platforms, also unlink plan2code-loop
      if (uninstallInput === 'A') {
        console.log('');
        uninstallPlan2CodeLoop();
      }

      process.exit(uninstallResult);
    }

    // Install flow
    let targets;
    if (input === 'A') {
      targets = INSTALL_TARGETS;
    } else {
      const indices = input.split(',').map(s => parseInt(s.trim()) - 1);
      const validIndices = indices.filter(i => i >= 0 && i < INSTALL_TARGETS.length);

      if (validIndices.length === 0) {
        console.log(`${COLORS.RED}${SYMBOLS.ERROR} Invalid selection${COLORS.RESET}\n`);
        rl.close();
        process.exit(1);
      }

      targets = validIndices.map(i => INSTALL_TARGETS[i]);
    }

    const platformNames = targets.map(t => `${COLORS.YELLOW}${t.name}${COLORS.RESET}`).join(', ');
    // Show happy mascot for install confirmation
    console.log('');
    console.log(`${COLORS.GREEN}    ╭───╮${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    │ ${COLORS.CYAN}●${COLORS.GREEN} │${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    │ ${COLORS.BRIGHT}◡${COLORS.GREEN} │${COLORS.RESET}   ${COLORS.DIM}Ready to install!${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}    ╰───╯${COLORS.RESET}`);
    const confirm = await question(`\n${COLORS.GREEN}${SYMBOLS.SELECT} CONFIRM INSTALL${COLORS.RESET}? (Y/n): `);

    if (confirm.trim().toLowerCase() === 'n') {
      console.log(`\n${COLORS.YELLOW}${SYMBOLS.WARNING} CANCELLED${COLORS.RESET}\n`);
      rl.close();
      process.exit(0);
    }

    rl.close();

    // If installing ALL platforms, install plan2code-loop first
    let loopResult = 0;
    if (input === 'A') {
      loopResult = installPlan2CodeLoop();
      console.log('');
    }

    const installResult = install(targets);

    if (input === 'A') {
      process.exit(installResult === 0 && loopResult === 0 ? 0 : 1);
    }

    process.exit(installResult);
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
// MAIN
// ============================================================================

// Additional CLI arguments for plan2code-loop
const installLoop = args.includes('--loop');
const uninstallLoop = args.includes('--uninstall-loop');

// Run the appropriate function
if (installLoop) {
  process.exit(installPlan2CodeLoop());
} else if (uninstallLoop) {
  process.exit(uninstallPlan2CodeLoop());
} else if (!hasArgs) {
  // No arguments - run interactive menu
  runInteractive();
} else if (localInstall) {
  process.exit(displayLocalInstructions());
} else if (uninstall) {
  process.exit(uninstallFiles());
} else {
  process.exit(install());
}
