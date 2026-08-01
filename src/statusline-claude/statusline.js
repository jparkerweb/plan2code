#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_BAR_LEN = 12;
const CONTEXT_THRESHOLDS = { green: 50, yellow: 70 };
const RATE_LIMIT_THRESHOLDS = { green: 60, yellow: 80 };
const GIT_TIMEOUT_MS = 1500;
const DEFAULT_WINDOW_SIZE = 200000;
const SEPARATOR_WIDTH = 55;

// ============================================================================
// Config
// ============================================================================

const DEFAULTS = {
  autocompactBuffer: 33000,
  color: true,
  compact: false,
  items: {
    model: true,
    effort: true,
    project: true,
    worktree: true,
    branch: true,
    contextBar: true,
    contextTokens: true,
    planUsage: true,
    linesChanged: true,
    duration: true,
    sessionCost: true,
  },
};

function loadConfig() {
  const configPath = path.join(os.homedir(), '.claude', 'statusline-config.json');
  let merged = { ...DEFAULTS, items: { ...DEFAULTS.items } };

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const user = JSON.parse(raw);
    merged = {
      ...DEFAULTS,
      ...user,
      items: { ...DEFAULTS.items, ...(user.items || {}) },
    };
  } catch {
    // Fall through to defaults
  }

  // Type validation with fallback
  if (!Number.isInteger(merged.autocompactBuffer) || merged.autocompactBuffer < 0 || merged.autocompactBuffer >= 1_000_000) {
    merged.autocompactBuffer = DEFAULTS.autocompactBuffer;
  }
  if (typeof merged.color !== 'boolean') merged.color = DEFAULTS.color;
  if (typeof merged.compact !== 'boolean') merged.compact = DEFAULTS.compact;
  for (const key of Object.keys(DEFAULTS.items)) {
    if (typeof merged.items[key] !== 'boolean') merged.items[key] = DEFAULTS.items[key];
  }

  // NO_COLOR convention (https://no-color.org) — env trumps config
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    merged.color = false;
  }

  return merged;
}

// ============================================================================
// Colors
// ============================================================================

const rgb = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  // Plan2Code brand
  teal: rgb(190, 192, 200),     // Silver — repo
  sky: rgb(120, 195, 255),      // Light sky blue — branch
  amber: rgb(235, 170, 95),     // Amber — linked worktree marker
  muted: rgb(40, 120, 200),     // Mid blue — model
  label: rgb(130, 135, 150),    // Mid gray — field labels (5h, 7d)
  // Bar & quota thresholds
  barGreen: rgb(50, 220, 100),
  barYellow: rgb(220, 180, 50),
  barRed: rgb(220, 80, 70),
  // Planny mascot
  sGreen: rgb(60, 200, 120),
  sBlue: rgb(50, 100, 200),
  sEye: rgb(255, 255, 255),
};

const SEP = (config) => config.color ? `${C.gray} │ ${C.reset}` : ' │ ';
const DOT = (config) => config.color ? `${C.gray} · ${C.reset}` : ' · ';

// ============================================================================
// Git helpers
// ============================================================================

function gitExec(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

function isGitRepo(cwd) {
  try {
    // Walk up parent dirs (bounded) — monorepos open Claude Code in a subdir
    // where .git lives at the repo root. .git can be a directory or a file.
    let dir = cwd;
    for (let i = 0; i < 10; i++) {
      if (fs.existsSync(path.join(dir, '.git'))) return true;
      const parent = path.dirname(dir);
      if (parent === dir) return false;
      dir = parent;
    }
    return false;
  } catch {
    return false;
  }
}

function getGitBranch(stdinData) {
  const cwd = stdinData?.workspace?.project_dir || process.cwd();
  if (!isGitRepo(cwd)) return '';
  const branch = gitExec(['symbolic-ref', '--short', 'HEAD'], cwd);
  if (branch) return branch;
  // Detached HEAD fallback — show short SHA so branch segment isn't empty
  const sha = gitExec(['rev-parse', '--short', 'HEAD'], cwd);
  return sha || '';
}

// Linked worktrees have their own .git dir under the main repo's
// .git/worktrees/<name>, while --git-common-dir still points at the main repo's
// .git. Equal paths mean we're in the primary checkout.
function getWorktreeInfo(cwd) {
  const raw = gitExec(['rev-parse', '--git-dir', '--git-common-dir'], cwd);
  if (!raw) return null;

  const [gitDir, commonDir] = raw.split('\n').map((p) => path.resolve(cwd, p.trim()));
  if (!gitDir || !commonDir) return null;

  const samePath = process.platform === 'win32'
    ? gitDir.toLowerCase() === commonDir.toLowerCase()
    : gitDir === commonDir;
  if (samePath) return null;

  // commonDir is normally <repo>/.git; bare repos use <name>.git directly
  const commonBase = path.basename(commonDir);
  const repoName = commonBase === '.git'
    ? path.basename(path.dirname(commonDir))
    : commonBase.replace(/\.git$/i, '');

  const toplevel = gitExec(['rev-parse', '--show-toplevel'], cwd);
  const worktreeName = path.basename(toplevel || cwd);
  if (!repoName || !worktreeName) return null;

  return { repoName, worktreeName };
}

// "plan2code-user-auth" in repo "plan2code" reads as just "user-auth"
function stripRepoPrefix(worktreeName, repoName) {
  const lowerWt = worktreeName.toLowerCase();
  const lowerRepo = repoName.toLowerCase();
  if (!lowerWt.startsWith(lowerRepo) || lowerWt === lowerRepo) return worktreeName;
  const rest = worktreeName.slice(repoName.length);
  return /^[-_.]/.test(rest) ? rest.slice(1) : worktreeName;
}

const normalizeName = (s) => s.toLowerCase().replace(/[/_.\s-]+/g, '-').replace(/^-|-$/g, '');

// Worktree dirs usually mirror their branch (plan2code-user-auth / feature/user-auth).
// Compare against both the full branch and its trailing segment so the common
// type prefixes (feature/, bugfix/, ...) don't defeat the match.
function isRedundantWithBranch(worktreeName, branch) {
  if (!branch) return false;
  const candidates = new Set([normalizeName(branch), normalizeName(branch.split('/').pop())]);
  return candidates.has(normalizeName(worktreeName));
}

// ============================================================================
// Formatters
// ============================================================================

function getModelName(stdinData) {
  const raw = stdinData?.model;
  if (!raw) return '';

  if (typeof raw === 'object' && raw.display_name) {
    return raw.display_name.replace(/ context\)/gi, ')');
  }

  const model = typeof raw === 'object' ? raw.id : raw;
  if (!model || typeof model !== 'string') return '';

  const claudeMatch = model.match(/^claude-(\w+)-/);
  if (claudeMatch) {
    return claudeMatch[1].charAt(0).toUpperCase() + claudeMatch[1].slice(1);
  }

  const gptMatch = model.match(/^(gpt-[\w.]+)/i);
  if (gptMatch) {
    return gptMatch[1].toUpperCase();
  }

  return model;
}

const EFFORT_LABELS = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max' };

function getEffortLevel(stdinData) {
  const level = stdinData?.effort?.level;
  if (!level || typeof level !== 'string') return '';
  return EFFORT_LABELS[level] || (level.charAt(0).toUpperCase() + level.slice(1));
}

function getProjectName(stdinData) {
  const projectDir = stdinData?.workspace?.project_dir;
  if (!projectDir || typeof projectDir !== 'string') return '';
  return path.basename(projectDir);
}

// Returns the project segment: "plan2code" normally, "plan2code ⑂ spike" in a
// linked worktree — the name collapsing to a bare ⑂ when the branch says it already.
function formatProject(stdinData, config, branch) {
  const project = getProjectName(stdinData);
  if (!project) return null;
  const plain = (text) => (config.color ? `${C.bold}${C.teal}${text}${C.reset}` : text);

  if (!config.items.worktree) return plain(project);

  const cwd = stdinData?.workspace?.project_dir || process.cwd();
  if (!isGitRepo(cwd)) return plain(project);

  const info = getWorktreeInfo(cwd);
  if (!info) return plain(project);

  const shortName = stripRepoPrefix(info.worktreeName, info.repoName);
  // Only dedupe against a branch the user can actually see — otherwise the
  // worktree identity would vanish entirely.
  const visibleBranch = config.items.branch ? branch : '';
  const redundant = isRedundantWithBranch(shortName, visibleBranch)
    || isRedundantWithBranch(info.worktreeName, visibleBranch)
    || normalizeName(shortName) === normalizeName(info.repoName);
  const marker = redundant ? '⑂' : `⑂ ${shortName}`;

  if (!config.color) return `${info.repoName} ${marker}`;
  return `${C.bold}${C.teal}${info.repoName}${C.reset} ${C.amber}${marker}${C.reset}`;
}

function calculateContextPercent(stdinData, config) {
  const cw = stdinData?.context_window;
  if (!cw) return null;
  const windowSize = cw.context_window_size || DEFAULT_WINDOW_SIZE;
  const buffer = config?.autocompactBuffer ?? DEFAULTS.autocompactBuffer;
  const usableTokens = windowSize - buffer;
  if (usableTokens <= 0) return 100;
  const rawUsedPct = cw.used_percentage ?? 0;
  const rawUsedTokens = (rawUsedPct / 100) * windowSize;
  return Math.round(Math.min(100, (rawUsedTokens / usableTokens) * 100));
}

function formatContextBar(percent, tokens, config) {
  if (percent == null) return null;

  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * CONTEXT_BAR_LEN);
  const filledStr = '▰'.repeat(filled);
  const emptyStr = '▱'.repeat(CONTEXT_BAR_LEN - filled);

  const tokenStr = config.items.contextTokens && tokens != null ? ` (${formatTokenCount(tokens)})` : '';

  if (!config.color) return `${filledStr}${emptyStr} ${clamped}%${tokenStr}`;

  const barColor = clamped >= CONTEXT_THRESHOLDS.yellow ? C.barRed
    : clamped >= CONTEXT_THRESHOLDS.green ? C.barYellow
    : C.barGreen;
  const tokenPart = tokenStr ? `${C.label}${tokenStr}${C.reset}` : '';
  return `${barColor}${filledStr}${C.gray}${emptyStr}${C.reset} ${barColor}${clamped}%${C.reset}${tokenPart}`;
}

function formatLinesChanged(stdinData, config) {
  const cwd = stdinData?.workspace?.project_dir || process.cwd();
  if (!isGitRepo(cwd)) return null;
  const raw = gitExec(['diff', 'HEAD', '--numstat'], cwd);
  if (raw == null) return null;

  let added = 0, removed = 0;
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const [a, r] = line.split('\t');
    if (a !== '-') added += parseInt(a, 10) || 0;
    if (r !== '-') removed += parseInt(r, 10) || 0;
  }
  if (added === 0 && removed === 0) return null;
  if (!config.color) return `+${added} -${removed}`;
  return `${C.green}+${added}${C.reset} ${C.red}-${removed}${C.reset}`;
}

function formatSessionCost(stdinData) {
  const usd = stdinData?.cost?.total_cost_usd;
  if (usd == null || isNaN(usd) || usd <= 0) return null;
  if (usd < 0.01) return '<$0.01';
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${Math.round(usd)}`;
}

function formatDuration(stdinData, config) {
  const ms = stdinData?.cost?.total_duration_ms;
  if (!ms) return null;

  const totalSec = Math.round(ms / 1000);
  let text;
  if (totalSec < 60) text = `${totalSec}s`;
  else {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    text = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  // Append session cost in parens when enabled: "49m ($4.62)"
  if (config.items.sessionCost) {
    const cost = formatSessionCost(stdinData);
    if (cost) {
      text = config.color
        ? `${C.label}${text} (${cost})${C.reset}`
        : `${text} (${cost})`;
      return text;
    }
  }
  return config.color ? `${C.label}${text}${C.reset}` : text;
}

function colorize(text, percent, thresholds, config) {
  if (!config.color || percent == null) return text;
  let code;
  if (percent >= thresholds.yellow) code = C.barRed;
  else if (percent >= thresholds.green) code = C.barYellow;
  else code = C.barGreen;
  return `${code}${text}${C.reset}`;
}

function formatTokenCount(n) {
  if (n == null || isNaN(n) || n < 0) return '0';
  if (n < 1000) return String(Math.round(n));
  if (n < 999500) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1) + 'M';
}

function formatRateLimits(stdinData, config) {
  if (!config.items.planUsage) return null;
  const fiveHour = stdinData?.rate_limits?.five_hour?.used_percentage;
  const sevenDay = stdinData?.rate_limits?.seven_day?.used_percentage;
  if (fiveHour == null && sevenDay == null) return null;

  const parts = [];
  if (fiveHour != null) {
    const pct = Math.round(fiveHour);
    const val = colorize(`${pct}%`, pct, RATE_LIMIT_THRESHOLDS, config);
    parts.push(config.color ? `${C.label}5h:${C.reset} ${val}` : `5h: ${pct}%`);
  }
  if (sevenDay != null) {
    const pct = Math.round(sevenDay);
    const val = colorize(`${pct}%`, pct, RATE_LIMIT_THRESHOLDS, config);
    parts.push(config.color ? `${C.label}7d:${C.reset} ${val}` : `7d: ${pct}%`);
  }
  return parts.join(DOT(config));
}

function formatTokenUsage(stdinData, config) {
  if (!config.items.planUsage) return null;
  const inp = stdinData?.context_window?.total_input_tokens;
  const out = stdinData?.context_window?.total_output_tokens;
  if ((!inp || inp === 0) && (!out || out === 0)) return null;
  const inStr = formatTokenCount(inp || 0);
  const outStr = formatTokenCount(out || 0);
  if (!config.color) return `${inStr} in${DOT(config)}${outStr} out`;
  return `${C.white}${inStr}${C.reset} ${C.label}in${C.reset}${DOT(config)}${C.white}${outStr}${C.reset} ${C.label}out${C.reset}`;
}

function formatLine1(stdinData, config) {
  const segments = [];

  if (config.items.model) {
    const model = getModelName(stdinData);
    if (model) {
      const effort = config.items.effort ? getEffortLevel(stdinData) : '';
      if (!effort) {
        segments.push(config.color ? `${C.muted}${model}${C.reset}` : model);
      } else if (!config.color) {
        segments.push(`${model} | ${effort}`);
      } else {
        segments.push(`${C.muted}${model}${C.reset}${C.gray} | ${C.reset}${C.label}${effort}${C.reset}`);
      }
    }
  }

  // Branch is resolved first — the project segment dedupes the worktree name against it
  const branch = config.items.branch || config.items.worktree ? getGitBranch(stdinData) : '';

  if (config.items.project) {
    const project = formatProject(stdinData, config, branch);
    if (project) segments.push(project);
  }

  if (config.items.branch && branch) {
    segments.push(config.color ? `${C.sky}${branch}${C.reset}` : branch);
  }

  if (config.items.linesChanged) {
    const lines = formatLinesChanged(stdinData, config);
    if (lines) segments.push(lines);
  }

  return segments.join(SEP(config));
}

function formatLine2(stdinData, config) {
  const segments = [];

  if (config.items.duration) {
    const dur = formatDuration(stdinData, config);
    if (dur) segments.push(dur);
  }

  if (config.items.contextBar) {
    const percent = calculateContextPercent(stdinData, config);
    const tokens = stdinData?.context_window?.total_input_tokens;
    const bar = formatContextBar(percent, tokens, config);
    if (bar) segments.push(bar);
  }

  if (config.items.planUsage) {
    const usage = formatRateLimits(stdinData, config) || formatTokenUsage(stdinData, config);
    if (usage) segments.push(usage);
  }

  return segments.join(SEP(config));
}

// ============================================================================
// Main
// ============================================================================

function loadStdin() {
  // --fixture <path> for local diagnostics (bypasses stdin)
  const fixtureIdx = process.argv.indexOf('--fixture');
  if (fixtureIdx !== -1 && process.argv[fixtureIdx + 1]) {
    try {
      return JSON.parse(fs.readFileSync(process.argv[fixtureIdx + 1], 'utf8'));
    } catch (err) {
      process.stderr.write(`[statusline] fixture load failed: ${err.message}\n`);
      process.exit(1);
    }
  }
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const debug = process.argv.includes('--debug');
  const stdinData = loadStdin();
  if (!stdinData) process.exit(0);

  const config = loadConfig();

  if (debug) {
    process.stderr.write('[statusline debug] parsed stdin:\n');
    process.stderr.write(JSON.stringify(stdinData, null, 2) + '\n');
    process.stderr.write('[statusline debug] merged config:\n');
    process.stderr.write(JSON.stringify(config, null, 2) + '\n');
  }

  const line1 = formatLine1(stdinData, config);
  const line2 = formatLine2(stdinData, config);
  if (!line1 && !line2) return;

  if (config.compact) {
    if (line1) process.stdout.write(line1 + '\n');
    if (line2) process.stdout.write(line2 + '\n');
    return;
  }

  if (config.color) {
    const ico1 = `${C.sGreen}╭─╮${C.reset} `;
    const ico2 = `${C.sGreen}│${C.sEye}★${C.sGreen}│${C.reset} `;
    const ico3 = `${C.sGreen}╰─╯${C.reset} `;
    const pad = `${C.gray}${'┄'.repeat(SEPARATOR_WIDTH)}${C.reset}`;
    process.stdout.write(ico1 + line1 + '\n' + ico2 + pad + '\n' + ico3 + line2 + '\n');
  } else {
    const ico1 = '╭─╮ ';
    const ico2 = '│★│ ';
    const ico3 = '╰─╯ ';
    const pad = '┄'.repeat(SEPARATOR_WIDTH);
    process.stdout.write(ico1 + line1 + '\n' + ico2 + pad + '\n' + ico3 + line2 + '\n');
  }
}

try {
  main();
} catch {
  process.exit(0);
}
