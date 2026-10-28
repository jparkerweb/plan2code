#!/usr/bin/env node
'use strict';

/**
 * `plan2code`: open the Plan2Code dashboard skill in Claude Code, Devin or Codex, in the
 * current directory.
 *
 * Runs one of (the bracketed flags only when permission prompts are turned off):
 *   claude /plan2code [--permission-mode bypassPermissions] [extra args]
 *   devin [--permission-mode bypass] [extra args] -- /plan2code
 *   codex [--dangerously-bypass-approvals-and-sandbox] [extra args] $plan2code
 *
 * Codex starts a skill with `$name` rather than `/name`. When more than one CLI is installed
 * it asks which one, with the last pick as the default; with only one installed it uses that.
 * `--cli claude` / `--cli devin` / `--cli codex` skips the question. Before starting it asks
 * which model to run, from the curated list in models.json (shipped with every install) plus
 * any models the user added in User Preferences; Enter keeps the model the CLI last used, and
 * `--model` (or Codex's `-m`) skips the question. Right after the agent is chosen, when it has a
 * flag for skipping permission prompts (every built-in does; a custom agent only with bypassArgs),
 * it asks whether to turn them off, Yes by default; `--keep-permissions` answers no, and with no
 * terminal to ask on they are off. Any other arguments are forwarded to the CLI.
 * Self-contained, Node built-ins only: install.js copies this file to ~/.plan2code/bin/ and
 * points the global shims at it.
 *
 * Custom agents: the person's own agent CLIs in ~/.plan2code/agents.json (written by User
 * Preferences in the web console) are listed after the built-ins and started the same way, with
 * `--cli <id>` or from the menu. Their rules are copied from src/web-console/agents.mjs below.
 *
 * `--pick-folder` (passed by the desktop shortcut, never forwarded to the CLI) asks for the
 * project folder with a native folder picker first, starting on the folder picked last time.
 *
 * When the desktop app is installed (~/.plan2code/app/) and a display exists, `plan2code` opens
 * the app on the chosen folder, agent and model instead of running the agent in this terminal.
 * `--classic` (never forwarded to the CLI), no app, and no display on Linux keep the flow above.
 *
 * `plan2code update` starts no agent: it re-runs the npx install with `--update`, which
 * reinstalls whatever ~/.plan2code/install.json lists (the desktop app included). Before an agent starts, one line says
 * when a newer release is out (releaseNotice), read from the web console's cached release check
 * and never waiting on the network.
 *
 * On a terminal it opens with a Planny banner (renderBanner) and colors its headings, numbers,
 * defaults and errors (paint). Color is on only on a TTY (stdout and stderr each checked on
 * its own) with NO_COLOR unset; piped runs print plain text and no banner.
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const IS_WINDOWS = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const PICK_FOLDER_FLAG = '--pick-folder';
const CLI_FLAG = '--cli';
const CLASSIC_FLAG = '--classic';
const KEEP_PERMISSIONS_FLAG = '--keep-permissions';
// Where install.js puts the desktop app, and the one file in it the launcher starts.
// PLAN2CODE_APP names a different executable (the tests start a stand-in this way).
const APP_DIR = path.join(os.homedir(), '.plan2code', 'app');
const APP_FILE = IS_WINDOWS ? 'plan2code-app.exe' : 'plan2code-app';
// How long a freshly started app may take to fall over before the launcher calls it started.
const APP_START_GRACE_MS = 1200;
const STATE_FILE = path.join(os.homedir(), '.plan2code', 'launcher.json');
const USER_AGENTS_FILE = path.join(os.homedir(), '.plan2code', 'agents.json');
// Menus longer than this print compactly (id-only, two columns).
const MODELS_MENU_COMPACT_AT = 30;
const PICKER_PROMPT = 'Choose the project folder to open Plan2Code in';
const UPDATE_COMMAND = 'update';
// The same URL src/web-console/update-check.mjs exports as REPO_URL. This file may require
// nothing but Node built-ins (and update-check.mjs is ESM), so it keeps its own copy.
const REPO_URL = 'https://github.com/jparkerweb/plan2code.git';
// The web console's cached release check, and how long it counts as fresh (update-check.mjs
// CACHE_MS). PLAN2CODE_CONSOLE_HOME moves the console's files, as in files.mjs.
const CONSOLE_HOME = process.env.PLAN2CODE_CONSOLE_HOME || path.join(os.homedir(), '.plan2code', 'console');
const UPDATE_CACHE_FILE = path.join(CONSOLE_HOME, 'update-check.json');
const UPDATE_CACHE_MS = 60 * 60 * 1000;

// The escape values install.js's COLORS uses, copied: this file is installed alone and may
// require nothing but Node built-ins.
const ANSI = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

/** Wrappers that color text when `useColor` is true and return it plain otherwise. */
function paint(useColor) {
  const wrap = (code) => (text) => (useColor ? code + text + ANSI.reset : String(text));
  return {
    bright: wrap(ANSI.bright),
    dim: wrap(ANSI.dim),
    cyan: wrap(ANSI.cyan),
    green: wrap(ANSI.green),
    yellow: wrap(ANSI.yellow),
    red: wrap(ANSI.red),
    magenta: wrap(ANSI.magenta),
  };
}

// Color only on a real terminal, and never when NO_COLOR is set to anything. Each stream
// asks for itself: `plan2code 2> err.log` from a terminal still logs plain errors.
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const c = paint(useColor);
const ce = paint(Boolean(process.stderr.isTTY) && !process.env.NO_COLOR);

// Planny waving hello, as install.js's MASCOT.wave draws him.
const MASCOT = [
  '   ╭───╮   ',
  '   │ ★ │╱  ',
  '  ╱│ ◡ │   ',
  '   ╰┬─┬╯   ',
];

/** Planny with the name and tagline beside his face; colored only through `p`. No trailing newline. */
function renderBanner(p) {
  const beside = { 1: p.bright(p.cyan('Plan2Code')), 2: p.dim('Plan it, build it, ship it — with your AI agent.') };
  return MASCOT.map((row, i) => (beside[i] ? `${p.magenta(row)}  ${beside[i]}` : p.magenta(row))).join('\n');
}

/** The banner, on a terminal only: piped runs print exactly what they always have. */
function printIntro() {
  if (!process.stdout.isTTY) return;
  console.log('');
  console.log(renderBanner(c));
  console.log('');
}

/**
 * The CLIs that can open the dashboard, in menu order. `args(extra, { bypass })` builds the full
 * argument list, with `bypassArgs` in it only when permission prompts are off.
 */
const CLIS = [
  {
    id: 'claude',
    label: 'Claude Code',
    install: 'npm i -g @anthropic-ai/claude-code',
    installUrl: 'https://code.claude.com/docs/en/setup',
    prompt: '/plan2code',
    bypassArgs: ['--permission-mode', 'bypassPermissions'],
    args(extra, { bypass } = {}) {
      return ['/plan2code', ...(bypass ? this.bypassArgs : []), ...extra];
    },
  },
  {
    id: 'devin',
    label: 'Devin',
    install: 'https://devin.ai',
    installUrl: 'https://docs.devin.ai/work-with-devin/devin-cli',
    prompt: '/plan2code',
    bypassArgs: ['--permission-mode', 'bypass'],
    args(extra, { bypass } = {}) {
      return [...(bypass ? this.bypassArgs : []), ...extra, '--', '/plan2code'];
    },
  },
  {
    id: 'codex',
    label: 'Codex',
    install: 'npm i -g @openai/codex',
    installUrl: 'https://github.com/openai/codex',
    prompt: '$plan2code',
    bypassArgs: ['--dangerously-bypass-approvals-and-sandbox'],
    // Codex mentions a skill with `$name`; the prompt is its one positional argument.
    args(extra, { bypass } = {}) {
      return [...(bypass ? this.bypassArgs : []), ...extra, '$plan2code'];
    },
  },
];

/** The CLI ids as prose: "`claude`, `devin` or `codex`", or without the backticks for `quote` ''. */
function cliIdList(quote = '`', clis = CLIS) {
  const ids = clis.map((cli) => quote + cli.id + quote);
  return `${ids.slice(0, -1).join(', ')} or ${ids[ids.length - 1]}`;
}

/** An install command with its official page after it, unless the command is the page. */
function installLine(cli) {
  return cli.installUrl && cli.installUrl !== cli.install ? `${cli.install} (${cli.installUrl})` : cli.install;
}

/**
 * What to do when no agent can run: what an agent CLI is, how to get each built-in, where to add
 * another, and how to run the skill from an agent. `missing` names custom agents whose command
 * was not found. Printed to stderr; the caller exits 127.
 */
function printNoAgentGuidance(missing = []) {
  console.error(`${ce.red('plan2code:')} Plan2Code runs inside an AI coding agent CLI, and none was found on your PATH.`);
  console.error('');
  console.error(ce.bright('Install one:'));
  for (const cli of CLIS) console.error(`  ${ce.cyan(cli.label)}: ${installLine(cli)}`);
  console.error('');
  console.error('Already use another agent CLI? Add it in User Preferences (web console) under Agents, then run `plan2code` again.');
  for (const cli of missing) console.error(ce.yellow(`Custom agent ${cli.label}: ${cli.entry.command} not found`));
  console.error('');
  console.error('After installing, open a new terminal, cd into the project you want to work on and run `plan2code`.');
  console.error('Or open your agent in your project and type /plan2code ($plan2code in Codex).');
}

// ---------------------------------------------------------------------------------------------
// Custom agents. normalizeAgents and buildArgs are copies of the rules in
// src/web-console/agents.mjs (this file is installed alone and cannot import it). The shared
// cases in scripts/fixtures/agents-cases.json are the contract: change a rule there first.

const AGENTS_SCHEMA = 1;
const MAX_AGENTS = 50;
const BUILTIN_AGENT_IDS = ['claude', 'devin', 'codex'];
const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_NAME = 60;
const DEFAULT_PROMPT = '/plan2code';
const DEFAULT_MODEL_ARGS = ['--model', '{model}'];
const LIST_FIELDS = ['args', 'bypassArgs', 'modelArgs'];

/**
 * The file as the launcher uses it: `raw` is its text (or the parsed value; undefined or null
 * when there is no file). Bad entries are skipped and named in `warnings`, and a bad file means
 * no agents. Never throws.
 */
function normalizeAgents(raw) {
  const warnings = [];
  if (raw === undefined || raw === null) return { agents: [], warnings };
  let file = raw;
  if (typeof raw === 'string') {
    try {
      file = JSON.parse(raw);
    } catch {
      return { agents: [], warnings: ['agents.json is not valid JSON, so no custom agents are used'] };
    }
  }
  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    return { agents: [], warnings: ['agents.json is not an object, so no custom agents are used'] };
  }
  if (file.schema !== AGENTS_SCHEMA) {
    return { agents: [], warnings: [`agents.json has schema ${JSON.stringify(file.schema)}, not ${AGENTS_SCHEMA}, so no custom agents are used`] };
  }
  if (file.agents === undefined || file.agents === null) return { agents: [], warnings };
  if (!Array.isArray(file.agents)) return { agents: [], warnings: ['agents.json: agents is not a list, so no custom agents are used'] };

  let list = file.agents;
  if (list.length > MAX_AGENTS) {
    warnings.push(`agents.json lists ${list.length} agents; only the first ${MAX_AGENTS} are used`);
    list = list.slice(0, MAX_AGENTS);
  }
  const agents = [];
  const ids = new Set();
  const names = new Set();
  list.forEach((entry, index) => {
    const out = checkAgentEntry(entry, ids, names);
    if (out.error) return warnings.push(`agents[${index}] skipped: ${out.error}`);
    ids.add(out.agent.id);
    names.add(out.agent.name.toLowerCase());
    agents.push(out.agent);
  });
  return { agents, warnings };
}

// One entry against the rules: { agent } with the defaults filled and any unknown keys kept,
// or { error } naming the first thing wrong.
function checkAgentEntry(entry, ids, names) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { error: 'not an object' };
  const { id } = entry;
  if (typeof id !== 'string' || !id) return { error: 'id is missing' };
  if (BUILTIN_AGENT_IDS.includes(id)) return { error: `id "${id}" belongs to a built-in agent` };
  if (!AGENT_ID.test(id)) return { error: `id "${id}" must be 1 to 32 lowercase letters, digits or dashes, starting with a letter or digit` };
  if (ids.has(id)) return { error: `id "${id}" is already used` };

  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!name) return { error: 'name is missing' };
  if (name.length > MAX_NAME) return { error: `name is longer than ${MAX_NAME} characters` };
  if (names.has(name.toLowerCase())) return { error: `name "${name}" is already used` };

  const command = typeof entry.command === 'string' ? entry.command.trim() : '';
  if (!command) return { error: 'command is missing' };

  const agent = { ...entry, id, name, command };
  for (const field of LIST_FIELDS) {
    const value = entry[field];
    if (value === undefined || value === null) {
      agent[field] = field === 'modelArgs' ? [...DEFAULT_MODEL_ARGS] : [];
    } else if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
      return { error: `${field} must be a list of text` };
    } else agent[field] = [...value];
  }

  if (entry.prompt === undefined || entry.prompt === null) agent.prompt = DEFAULT_PROMPT;
  else if (typeof entry.prompt !== 'string') return { error: 'prompt must be text' };

  if (entry.models === undefined || entry.models === null) agent.models = [];
  else if (!Array.isArray(entry.models)) return { error: 'models must be a list' };
  else {
    agent.models = [];
    const seen = new Set();
    for (const model of entry.models) {
      if (!model || typeof model !== 'object' || typeof model.id !== 'string') return { error: 'every model in models needs an id' };
      const modelId = model.id.trim();
      if (!modelId || seen.has(modelId)) continue;
      seen.add(modelId);
      const label = typeof model.label === 'string' ? model.label.trim() : '';
      agent.models.push(label ? { id: modelId, label } : { id: modelId });
    }
  }
  return { agent };
}

/**
 * The arguments that start an entry, in order: `args` with {prompt} filled (the prompt appended
 * when no argument holds it), then `modelArgs` when a model is chosen, then `bypassArgs` when
 * checks are off. `prompt` defaults to the entry's own; a blank one drops an argument that is
 * exactly {prompt}. Plain text in, plain text out: no quoting for any shell.
 */
function buildArgs(entry, { prompt, model, bypass } = {}) {
  const text = prompt === undefined ? (typeof entry.prompt === 'string' ? entry.prompt : DEFAULT_PROMPT) : String(prompt ?? '');
  const blank = !text.trim();
  const out = [];
  let placed = false;
  for (const arg of entry.args || []) {
    if (!arg.includes('{prompt}')) {
      out.push(arg);
      continue;
    }
    placed = true;
    if (arg === '{prompt}' && blank) continue;
    out.push(arg.split('{prompt}').join(text));
  }
  if (!placed && !blank) out.push(text);
  if (model) {
    for (const arg of entry.modelArgs || DEFAULT_MODEL_ARGS) out.push(arg.split('{model}').join(model));
  }
  if (bypass) out.push(...(entry.bypassArgs || []));
  return out;
}

/** `args` without `--model <x>` / `--model=<x>`: a custom agent gets its model through modelArgs. */
function withoutModelFlag(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model') i++;
    else if (!args[i].startsWith('--model=')) out.push(args[i]);
  }
  return out;
}

/**
 * The custom agents in agents.json as CLIS-shaped entries, none resolved yet. A missing or
 * malformed file gives an empty list (and, with `print` on, which is a terminal only, one stderr
 * line per warning), never an error. chooseCli() asks once, so each warning shows once per run.
 */
function customClis(file = USER_AGENTS_FILE, print = Boolean(process.stderr.isTTY)) {
  let raw = null;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {}
  const { agents, warnings } = normalizeAgents(raw);
  if (print) for (const warning of warnings) console.error(`${ce.yellow('plan2code:')} agents.json: ${warning}`);
  return agents.map((entry) => ({
    id: entry.id,
    label: entry.name,
    install: null,
    prompt: entry.prompt,
    custom: true,
    entry,
    bypassArgs: entry.bypassArgs,
    args: (extra, { bypass } = {}) => [...buildArgs(entry, { bypass, model: modelFrom(extra, entry.id) }), ...withoutModelFlag(extra)],
  }));
}

/**
 * Where a custom agent's command runs from, as { path, fullPath }, or null. A command with a
 * path separator is checked as a file (PATHEXT tried on Windows when it has no extension); a
 * bare name is looked for on PATH. Never runs anything.
 */
function resolveCustomCommand(command) {
  const name = String(command ?? '').trim().replace(/^"(.*)"$/, '$1');
  if (!name) return null;
  const isFile = (file) => {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  };
  const extensions = IS_WINDOWS ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean) : [];
  if (name.includes('/') || (IS_WINDOWS && name.includes('\\'))) {
    const full = path.resolve(name);
    const found = (IS_WINDOWS && !path.extname(full) ? extensions.map((ext) => full + ext) : [full]).find(isFile);
    return found ? { path: found, fullPath: true } : null;
  }
  let found = findOnPath(name);
  // A bare name that already has an extension (goose.cmd) is not found by findOnPath, which adds one.
  if (!found && IS_WINDOWS && path.extname(name)) {
    for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
      const candidate = path.join(dir.replace(/^"|"$/g, ''), name);
      if (isFile(candidate)) {
        found = candidate;
        break;
      }
    }
  }
  return found ? { path: found, fullPath: false } : null;
}

// The curated menu ships beside this file (models.json, overwritten by every install); models
// the user adds in User Preferences live in ~/.plan2code/models.json and are merged in.
const SHIPPED_MODELS_FILE = path.join(__dirname, 'models.json');
const USER_MODELS_FILE = path.join(os.homedir(), '.plan2code', 'models.json');

/**
 * The Explorer-style folder picker (IFileOpenDialog with FOS_PICKFOLDERS): address bar, paste a
 * path, Quick Access, search. Windows PowerShell's FolderBrowserDialog is the old tree-only
 * dialog, and Windows ships no other way to reach this one from a script, so it is compiled
 * with Add-Type. Only the IFileOpenDialog methods up to GetResult are declared: the vtable
 * slots after the last one called don't need to be.
 */
const WINDOWS_PICKER_SOURCE = `
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class Plan2CodeFolderPicker {
  [ComImport, Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
  private class FileOpenDialog {}

  [ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IFileOpenDialog {
    [PreserveSig] int Show(IntPtr owner);
    void SetFileTypes(uint count, IntPtr specs);
    void SetFileTypeIndex(uint index);
    void GetFileTypeIndex(out uint index);
    void Advise(IntPtr events, out uint cookie);
    void Unadvise(uint cookie);
    void SetOptions(uint options);
    void GetOptions(out uint options);
    void SetDefaultFolder(IShellItem item);
    void SetFolder(IShellItem item);
    void GetFolder(out IShellItem item);
    void GetCurrentSelection(out IShellItem item);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
    void GetResult(out IShellItem item);
  }

  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IShellItem {
    void BindToHandler(IntPtr bindContext, ref Guid handler, ref Guid iid, out IntPtr result);
    void GetParent(out IShellItem parent);
    void GetDisplayName(uint form, [MarshalAs(UnmanagedType.LPWStr)] out string name);
  }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  private static extern void SHCreateItemFromParsingName(string path, IntPtr bindContext, ref Guid iid, out IShellItem item);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr FindWindow(string className, string title);

  [DllImport("user32.dll")]
  private static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int w, int h, uint flags);

  [DllImport("user32.dll")]
  private static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  private static extern int GetSystemMetrics(int index);

  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  private static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  private static extern void SwitchToThisWindow(IntPtr hWnd, bool altTab);

  [DllImport("user32.dll")]
  private static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

  private const uint FOS_PICKFOLDERS = 0x20;
  private const uint FOS_FORCEFILESYSTEM = 0x40;
  private const uint FOS_PATHMUSTEXIST = 0x800;
  private const uint SIGDN_FILESYSPATH = 0x80058000;
  private const int ERROR_CANCELLED = unchecked((int)0x800704C7);

  // Windows refuses SetForegroundWindow from a background process (this one is spawned
  // by the detached console server), so the dialog opened behind the browser. A tap of
  // Alt counts as input from this process and lifts the lock for the call after it. The
  // topmost flag below is ignored by this dialog (SetWindowPos succeeds, the bit stays
  // off), so taking the foreground is what puts it in front.
  private static void Raise(string title) {
    IntPtr hwnd = IntPtr.Zero;
    for (int i = 0; i < 200; i++) {
      hwnd = FindWindow(null, title);
      if (hwnd != IntPtr.Zero && IsWindowVisible(hwnd)) break;
      hwnd = IntPtr.Zero;
      Thread.Sleep(50);
    }
    if (hwnd == IntPtr.Zero) return;
    int w = Math.Min(1100, GetSystemMetrics(0) - 80);
    int h = Math.Min(750, GetSystemMetrics(1) - 80);
    int x = (GetSystemMetrics(0) - w) / 2 + 40;
    int y = (GetSystemMetrics(1) - h) / 2 + 40;
    SetWindowPos(hwnd, new IntPtr(-1), x, y, w, h, 0x40);
    for (int i = 0; i < 20 && GetForegroundWindow() != hwnd; i++) {
      keybd_event(0x12, 0, 0, UIntPtr.Zero);
      keybd_event(0x12, 0, 2, UIntPtr.Zero);
      SetForegroundWindow(hwnd);
      SwitchToThisWindow(hwnd, true);
      Thread.Sleep(100);
    }
  }

  public static string Pick(IntPtr owner, string title, string start) {
    IFileOpenDialog dialog = (IFileOpenDialog)new FileOpenDialog();
    try {
      uint options;
      dialog.GetOptions(out options);
      dialog.SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
      dialog.SetTitle(title);
      if (!string.IsNullOrEmpty(start)) {
        try {
          Guid iid = typeof(IShellItem).GUID;
          IShellItem folder;
          SHCreateItemFromParsingName(start, IntPtr.Zero, ref iid, out folder);
          dialog.SetFolder(folder);
        } catch (Exception) {}
      }
      Thread raiser = new Thread(delegate() { Raise(title); });
      raiser.IsBackground = true;
      raiser.Start();
      int hr = dialog.Show(owner);
      if (hr == ERROR_CANCELLED) return null;
      Marshal.ThrowExceptionForHR(hr);
      IShellItem result;
      dialog.GetResult(out result);
      string path;
      result.GetDisplayName(SIGDN_FILESYSPATH, out path);
      return path;
    } finally {
      Marshal.ReleaseComObject(dialog);
    }
  }
}
`;

/**
 * Resolve a command on PATH the way the shell would, including PATHEXT on Windows.
 * Returns the full path, or null when it is not installed.
 */
function findOnPath(command) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extensions = IS_WINDOWS
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : [''];

  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir.replace(/^"|"$/g, ''), command + ext);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {}
    }
  }
  return null;
}

/**
 * Quote one argument for cmd.exe. Only needed when the CLI is a .cmd/.bat wrapper, which Node
 * refuses to spawn without a shell.
 */
function quoteForCmd(arg) {
  if (arg && !/[\s"&|<>^%!()]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** `~/.plan2code/launcher.json`: `{ lastFolder, lastCli }`, either key possibly missing. */
function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (state && typeof state === 'object') return state;
  } catch {}
  return {};
}

/** Merge `changes` into the state file, keeping the keys it does not name. */
function saveState(changes) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...changes }, null, 2) + '\n');
  } catch {}
}

function readLastFolder() {
  const { lastFolder } = readState();
  return lastFolder && isDirectory(lastFolder) ? lastFolder : os.homedir();
}

function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // readline swallows Ctrl+C while it owns the terminal; treat it as leaving.
  rl.on('SIGINT', () => {
    rl.close();
    process.stdout.write('\n');
    process.exit(130);
  });
  return new Promise((resolve) =>
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

/**
 * Split `--cli <name>` / `--cli=<name>` out of the arguments. Returns `{ cli, rest }`; `cli` is
 * undefined when the flag is absent and '' when it has no value.
 */
function takeCliFlag(argv) {
  const rest = [];
  let cli;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === CLI_FLAG) {
      cli = (argv[++i] || '').toLowerCase();
    } else if (arg.startsWith(`${CLI_FLAG}=`)) {
      cli = arg.slice(CLI_FLAG.length + 1).toLowerCase();
    } else {
      rest.push(arg);
    }
  }
  return { cli, rest };
}

/** With no menu to show, say which CLI is opening, on a terminal only. */
function announceCli(cli) {
  if (process.stdout.isTTY) console.log(c.dim(`Opening with ${cli.label}…`));
}

/**
 * The CLIs that can run, in menu order (the built-ins found on PATH, then the custom agents whose
 * command resolves), and the custom agents left out because theirs does not.
 */
function runnableClis(customs) {
  const installed = CLIS.map((cli) => ({ ...cli, path: findOnPath(cli.id) })).filter((cli) => cli.path);
  // A custom agent whose command does not resolve is left out of the menu and named when nothing can run.
  const missing = [];
  for (const cli of customs) {
    const found = resolveCustomCommand(cli.entry.command);
    if (found) installed.push({ ...cli, ...found });
    else missing.push(cli);
  }
  return { installed, missing };
}

/**
 * Choose the CLI from those installed: the `--cli` pick, the only one installed, or a numbered
 * menu defaulting to the last pick. Returns `{ cli }` with its resolved `path`, or `{ code }` (the
 * exit code) after printing why none can be used.
 */
async function chooseCli(requested) {
  const customs = customClis();
  const all = [...CLIS, ...customs];
  const { installed, missing } = runnableClis(customs);

  if (requested !== undefined) {
    const known = all.find((cli) => cli.id === requested);
    if (!known) {
      console.error(`${ce.red('plan2code:')} --cli takes ${cliIdList('', all)}${requested ? `, not "${requested}"` : ''}.`);
      return { code: 2 };
    }
    const found = installed.find((cli) => cli.id === requested);
    if (!found && known.custom) {
      console.error(`${ce.red('plan2code:')} Custom agent ${known.label}: ${known.entry.command} not found`);
    } else if (!found) {
      console.error(`${ce.red('plan2code:')} the \`${known.id}\` CLI was not found on your PATH.`);
      console.error('');
      console.error(`To use ${known.label}:`);
      console.error(`  1. Install it: ${installLine(known)}`);
      console.error('  2. Open a new terminal and cd into the project you want to work on.');
      console.error(`  3. Run \`plan2code --cli ${known.id}\` there, or start ${known.label} and type ${known.prompt}.`);
    }
    if (found) announceCli(found);
    return found ? { cli: found } : { code: 127 };
  }

  if (installed.length === 0) {
    printNoAgentGuidance(missing);
    return { code: 127 };
  }
  if (installed.length === 1 || !process.stdin.isTTY) {
    const { lastCli } = readState();
    const cli = installed.find((cli) => cli.id === lastCli) || installed[0];
    if (installed.length === 1) announceCli(cli);
    return { cli };
  }

  const { lastCli } = readState();
  const defaultIndex = Math.max(0, installed.findIndex((cli) => cli.id === lastCli));
  console.log(c.bright('Plan2Code opens inside an AI coding agent. Pick which one to use:'));
  console.log('');
  installed.forEach((cli, i) =>
    console.log(`  ${c.cyan(`${i + 1})`)} ${cli.label}${cli.id === lastCli ? ` ${c.dim('(last used)')}` : ''}`)
  );
  console.log(c.dim('You can also skip this launcher and run `/plan2code` (`$plan2code` in Codex) straight from your agent.'));
  for (;;) {
    const answer = (await ask(`Choice ${c.green(`[${defaultIndex + 1}]`)}: `)).trim().toLowerCase();
    if (!answer) return { cli: installed[defaultIndex] };
    const byNumber = installed[Number(answer) - 1];
    const byName = installed.find((cli) => cli.id === answer || cli.label.toLowerCase() === answer);
    if (/^\d+$/.test(answer) && byNumber) return { cli: byNumber };
    if (byName) return { cli: byName };
    console.log(c.yellow(`Type a number from 1 to ${installed.length}, or press Enter for ${installed[defaultIndex].label}.`));
  }
}

/**
 * Whether to start the agent with permission prompts off. Asked only for an agent that has a flag
 * for it (a custom agent may have none), with Yes as the default; `--keep-permissions` answers no
 * without asking, and with no terminal to ask on the prompts are off.
 */
async function chooseBypass(cli, keep) {
  if (!cli.bypassArgs || !cli.bypassArgs.length || keep) return false;
  if (!process.stdin.isTTY) return true;
  console.log('');
  console.log(c.bright(`Turn ${cli.label}'s permission prompts off?`));
  console.log(c.dim(`It would read, edit and run commands in this project without asking (${cli.bypassArgs.join(' ')}).`));
  for (;;) {
    const answer = (await ask(`Prompts off? ${c.green('[Y/n]')}: `)).trim().toLowerCase();
    if (!answer || answer === 'y' || answer === 'yes') return true;
    if (answer === 'n' || answer === 'no') return false;
    console.log(c.yellow('Type n to keep the prompts, or press Enter to turn them off.'));
  }
}

/**
 * True when the forwarded arguments already pick a model: `--model <name>` / `--model=<name>`,
 * and for Codex also its short form, `-m <name>` / `-m=<name>` / `-m<name>`.
 */
function hasModelFlag(args, cliId) {
  return args.some(
    (arg) =>
      arg === '--model' ||
      arg.startsWith('--model=') ||
      (cliId === 'codex' && arg.startsWith('-m'))
  );
}

/** `[{ id, label }]` from a parsed models file for one CLI; anything malformed is skipped. */
function modelEntries(file, cliId) {
  const list = file && Array.isArray(file[cliId]) ? file[cliId] : [];
  return list.filter((m) => m && typeof m.id === 'string' && m.id.trim() && typeof m.label === 'string');
}

/** The shipped list first, then the user's additions the shipped list does not already have. */
function mergeModels(shipped, user) {
  const seen = new Set(shipped.map((m) => m.id));
  return [...shipped, ...user.filter((m) => !seen.has(m.id) && seen.add(m.id))];
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** The model menu for one CLI: the curated list plus the user's additions from User Preferences. */
function listModels(cli) {
  // A custom agent's menu is its own models: no shipped list and no User Preferences additions.
  if (cli.custom) return cli.entry.models.map((m) => ({ id: m.id, label: m.label || '' }));
  return mergeModels(
    modelEntries(readJsonFile(SHIPPED_MODELS_FILE), cli.id),
    modelEntries(readJsonFile(USER_MODELS_FILE), cli.id)
  );
}

/**
 * Ask which model to run: a numbered list with Enter keeping the model the CLI last used (a
 * custom agent: its own default).
 * A pick appends `--model <id>` to `extraArgs`. Without an interactive terminal there is
 * nobody to ask, so it just says which model will be used, as it always has.
 */
async function chooseModel(cli, extraArgs) {
  if (cli.custom && !listModels(cli).length) return;
  // A custom agent has no last-used model to keep: left alone it starts on its own default.
  const keep = cli.custom ? 'its own default model' : 'the last-used model';
  if (!process.stdin.isTTY) {
    if (cli.custom) {
      console.log(`${cli.label} will start with its own default model. To pick one, run \`plan2code --model <id>\`.`);
      return;
    }
    console.log(`${cli.label} will use the model you last used in it. To use a different model, open`);
    console.log(`\`${cli.id}\` on its own and switch model there, or run \`plan2code --model <name>\`.`);
    return;
  }
  const models = listModels(cli);
  if (!models.length) return;

  console.log('');
  console.log(c.bright(`Which model should ${cli.label} use?`));
  if (models.length > MODELS_MENU_COMPACT_AT) {
    // Labels off, ids in two columns: a long menu of full rows would bury
    // the prompt above the fold.
    const half = Math.ceil(models.length / 2);
    for (let i = 0; i < half; i++) {
      // Padded before coloring, so the escape codes never count toward the column width.
      const left = `  ${i + 1}) ${models[i].id}`.padEnd(48);
      const right = models[i + half] ? `  ${c.cyan(`${i + half + 1})`)} ${models[i + half].id}` : '';
      console.log(left.replace(`${i + 1})`, c.cyan(`${i + 1})`)) + right);
    }
  } else {
    models.forEach((model, i) => console.log(!model.label ? `  ${c.cyan(`${i + 1})`)} ${model.id}` : `  ${c.cyan(`${i + 1})`)} ${model.id} — ${model.label}`));
  }
  for (;;) {
    const answer = (await ask(`Choice ${c.green(cli.custom ? '[default]' : '[keep last used]')}: `)).trim().toLowerCase();
    if (!answer) return;
    const byNumber = models[Number(answer) - 1];
    const byName = models.find((model) => model.id === answer || model.label.toLowerCase() === answer);
    const model = (/^\d+$/.test(answer) && byNumber) || byName;
    if (model) {
      extraArgs.push('--model', model.id);
      return;
    }
    console.log(c.yellow(`Type a number from 1 to ${models.length}, a model name, or press Enter to keep ${keep}.`));
  }
}

/** A window can open: assumed on Windows and macOS, and on Linux only with an X11 or Wayland display. */
function hasDisplay() {
  // sshd sets one of these for an SSH login on both platforms, and there is no window to open
  // there. A plain background/service context (no SSH, no desktop) cannot be told apart from an
  // ordinary desktop login on Windows or macOS without a new dependency, so SSH is as far as this goes.
  if ((IS_WINDOWS || IS_MAC) && (process.env.SSH_CONNECTION || process.env.SSH_TTY)) return false;
  return IS_WINDOWS || IS_MAC || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

/** The installed desktop app's executable, or null when it is not installed. */
function findApp() {
  const file = process.env.PLAN2CODE_APP || path.join(APP_DIR, APP_FILE);
  try {
    return fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

/** The model the forwarded arguments pick (`--model x`, `--model=x`, Codex's `-m x`), or null. */
function modelFrom(args, cliId) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--model' || (cliId === 'codex' && arg === '-m')) return args[i + 1] || null;
    if (arg.startsWith('--model=')) return arg.slice('--model='.length) || null;
    if (cliId === 'codex' && arg.startsWith('-m=')) return arg.slice(3) || null;
  }
  return null;
}

/**
 * Start the desktop app on the folder, agent and model and let it run on its own. Resolves true
 * once it has started, false (after one line saying why) when it could not, so the caller can
 * carry on with today's terminal flow.
 */
function startApp(app, { cwd, cliId, model }) {
  const args = ['--project', cwd, '--agent', cliId, ...(model ? ['--model', model] : [])];
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnCommand(app, args, { cwd, detached: true, stdio: 'ignore' });
    } catch (error) {
      console.error(`${ce.yellow('plan2code:')} could not start the app (${error.message}); opening in this terminal instead.`);
      return resolve(false);
    }
    child.once('error', (error) => {
      console.error(`${ce.yellow('plan2code:')} could not start the app (${error.message}); opening in this terminal instead.`);
      resolve(false);
    });
    child.once('spawn', () => {
      // A program that starts and then dies (a missing system library is reported after the
      // exec, not as a spawn error) must not strand the person with a closed terminal: an exit
      // with a failure inside the grace period falls back to the terminal flow.
      const timer = setTimeout(() => {
        child.removeAllListeners('exit');
        child.unref();
        resolve(true);
      }, APP_START_GRACE_MS);
      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        if (code === 0) return resolve(true);
        console.error(`${ce.yellow('plan2code:')} the app exited at once (${signal ? `signal ${signal}` : `code ${code}`}); opening in this terminal instead.`);
        resolve(false);
      });
    });
  });
}

/**
 * The native folder picker for this OS, as a command to run: it prints the chosen folder, or
 * nothing when the person cancels. Null when this OS has no picker we can drive.
 */
function getPickerCommand(start) {
  if (IS_WINDOWS) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      'try {',
      '  [Console]::OutputEncoding = [Text.Encoding]::UTF8',
      '  Add-Type -AssemblyName System.Windows.Forms',
      '  [System.Windows.Forms.Application]::EnableVisualStyles()',
      // A TopMost owner keeps the dialog in front of the console window that launched it.
      '  $owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }',
      '  try {',
      '    Add-Type -TypeDefinition $env:PLAN2CODE_PICKER_SOURCE',
      '    $picked = [Plan2CodeFolderPicker]::Pick($owner.Handle, $env:PLAN2CODE_PICKER_PROMPT, $env:PLAN2CODE_PICKER_START)',
      '  } catch {',
      // Add-Type is blocked under Constrained Language Mode and some AppLocker policies; the
      // old tree dialog still works there.
      '    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
      '    $dialog.Description = $env:PLAN2CODE_PICKER_PROMPT',
      '    $dialog.SelectedPath = $env:PLAN2CODE_PICKER_START',
      '    $picked = if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.SelectedPath } else { $null }',
      '  }',
      '  if ($picked) { $picked }',
      '} catch { exit 3 }',
    ].join('\n');
    return {
      command: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      env: { PLAN2CODE_PICKER_PROMPT: PICKER_PROMPT, PLAN2CODE_PICKER_START: start, PLAN2CODE_PICKER_SOURCE: WINDOWS_PICKER_SOURCE },
    };
  }

  if (IS_MAC) {
    return {
      command: 'osascript',
      args: [
        '-e', 'on run argv',
        '-e', `POSIX path of (choose folder with prompt "${PICKER_PROMPT}" default location (POSIX file (item 1 of argv)))`,
        '-e', 'end run',
        start,
      ],
    };
  }

  if (!hasDisplay()) return null;
  if (findOnPath('zenity')) {
    return { command: 'zenity', args: ['--file-selection', '--directory', `--title=${PICKER_PROMPT}`, `--filename=${start}${path.sep}`] };
  }
  if (findOnPath('kdialog')) {
    return { command: 'kdialog', args: ['--title', PICKER_PROMPT, '--getexistingdirectory', start] };
  }
  return null;
}

/**
 * A git repo (a `.git` entry, file or directory since worktrees use a file), or has `AGENTS.md`
 * or a `specs/` folder: enough to call `dir` a project without asking first.
 */
function looksLikeProject(dir) {
  return (
    fs.existsSync(path.join(dir, '.git')) ||
    fs.existsSync(path.join(dir, 'AGENTS.md')) ||
    isDirectory(path.join(dir, 'specs'))
  );
}

/**
 * True to proceed with `cwd`: it already looks like a project, or the person confirmed it when
 * asked. Without a terminal to ask there is nobody to confirm, so it refuses rather than risk
 * opening the app (or the terminal flow) on the wrong folder.
 */
async function confirmProject(cwd) {
  if (looksLikeProject(cwd)) return true;
  if (!process.stdin.isTTY) {
    console.error(
      `${ce.yellow('plan2code:')} ${cwd} doesn't look like a project (no git repo, AGENTS.md or specs folder); run \`plan2code\` there from a terminal to confirm, or cd into a project first.`
    );
    return false;
  }
  const answer = (
    await ask(`${c.yellow(cwd)} doesn't look like a project (no git repo, AGENTS.md or specs folder). Open Plan2Code there anyway? [y/N]: `)
  )
    .trim()
    .toLowerCase();
  return answer === 'y' || answer === 'yes';
}

/**
 * Ask for the project folder: the native picker when there is one, a typed path otherwise.
 * Returns the folder, or null when the person canceled.
 */
async function pickFolder() {
  const start = readLastFolder();
  const picker = getPickerCommand(start);

  console.log('');
  if (picker) {
    console.log(c.dim('Pick a project folder in the window that just opened...'));
    const result = spawnSync(picker.command, picker.args, {
      encoding: 'utf8',
      env: { ...process.env, ...picker.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const folder = (result.stdout || '').trim();
    // Pickers exit 0 or 1 with nothing printed when canceled; anything else means the picker
    // itself failed, so fall through to the typed prompt rather than giving up.
    if (!result.error && folder && result.status === 0) return path.resolve(folder);
    if (!result.error && !folder && (result.status === 0 || result.status === 1)) return null;
  }

  const answer = (await ask(`Project folder ${c.green(`[${start}]`)}: `)).trim().replace(/^["']|["']$/g, '');
  if (!answer) return start;
  return path.resolve(answer.replace(/^~(?=$|[\\/])/, os.homedir()));
}

// Exit codes from Ctrl+C (130 on POSIX, STATUS_CONTROL_C_EXIT on Windows) are the person
// leaving on purpose, not a failure worth holding the window open for.
const INTERRUPT_EXIT_CODES = new Set([130, 0xc000013a]);
let exiting = false;

/**
 * Exit, but when launched from the desktop shortcut hold the window open on a failure first:
 * the console closes with the process, taking the error message with it. Only the first call
 * counts, since a failed spawn may report through both 'error' and 'exit'.
 */
async function exitWith(code, fromShortcut) {
  if (exiting) return;
  exiting = true;
  if (fromShortcut && code !== 0 && !INTERRUPT_EXIT_CODES.has(code) && process.stdin.isTTY) {
    await ask('Press Enter to close.');
  }
  process.exit(code);
}

/**
 * Spawn a resolved command with `args`. A .cmd/.bat wrapper on Windows goes through cmd.exe,
 * since Node refuses to spawn one without a shell. `options.fromFullPath` (never passed on to
 * spawn) marks a custom agent whose command was given as a full path: that wrapper runs as
 * `cmd /c <file name> ...args` with its folder first on the child's PATH, so a space in the
 * folder is never in the cmd line itself.
 */
function spawnCommand(file, args, options) {
  const { fromFullPath, ...spawnOptions } = options || {};
  if (!(IS_WINDOWS && /\.(cmd|bat)$/i.test(file))) return spawn(file, args, spawnOptions);
  const shell = process.env.ComSpec || 'cmd.exe';
  if (!fromFullPath) {
    return spawn(shell, ['/d', '/s', '/c', `"${[file, ...args].map(quoteForCmd).join(' ')}"`], {
      ...spawnOptions,
      windowsVerbatimArguments: true,
    });
  }
  const env = { ...(spawnOptions.env || process.env) };
  // Windows env names are case-insensitive and the copy keeps the original spelling (Path).
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') || 'PATH';
  env[pathKey] = path.dirname(file) + path.delimiter + (env[pathKey] || '');
  // cmd looks in the current folder (the project) before PATH: a same-named
  // file there must not run in the agent's place.
  env.NoDefaultCurrentDirectoryInExePath = '1';
  return spawn(shell, ['/d', '/s', '/c', `"${[path.basename(file), ...args].map(quoteForCmd).join(' ')}"`], {
    ...spawnOptions,
    env,
    windowsVerbatimArguments: true,
  });
}

/**
 * `plan2code update`: the npx install with --update, passing npx's exit code through. No agent
 * starts. That one install updates the skills, this launcher and the desktop app (when it is
 * installed) together, so the three never drift apart.
 */
/** `tag` pins the install to that release (the desktop app's own Update skills button, so it
 * never pulls in work a published release does not have yet); omitted, `plan2code update` keeps
 * pulling the latest off `main` as it always has. */
function runUpdate(tag) {
  console.log('Updating Plan2Code...');
  console.log(c.dim('One update covers the skills, the plan2code command and the desktop app (when installed).'));
  const npx = findOnPath('npx');
  if (!npx) {
    console.error(`${ce.red('plan2code:')} npx was not found on your PATH. It comes with Node.js 18+ (https://nodejs.org).`);
    return process.exit(127);
  }
  const spec = tag ? `git+${REPO_URL}#${tag}` : `git+${REPO_URL}`;
  const child = spawnCommand(npx, ['--yes', '--allow-git=all', spec, '--update'], { stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {});
  }
  child.on('error', (error) => {
    console.error(`${ce.red('plan2code:')} failed to start npx: ${error.message}`);
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code ?? 1));
}

/** -1, 0 or 1 comparing two plain X.Y.Z versions; null unless both are X.Y.Z (as update-check.mjs). */
function compareVersions(a, b) {
  const semver = /^\d+\.\d+\.\d+$/;
  if (typeof a !== 'string' || typeof b !== 'string' || !semver.test(a) || !semver.test(b)) return null;
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

/**
 * One line when a newer release is out, from the console's cached check only. A missing or
 * stale cache prints nothing and starts a detached refresh (the copied update-check.mjs) so
 * the next start knows; the start never waits on it. Any error is swallowed: the notice must
 * never stand between the person and their agent.
 */
async function releaseNotice() {
  try {
    const installed = (readJsonFile(path.join(__dirname, 'version.json')) || {}).version;
    if (typeof installed !== 'string') return;
    const cache = readJsonFile(UPDATE_CACHE_FILE);
    if (cache && typeof cache.checkedAt === 'number' && Date.now() - cache.checkedAt < UPDATE_CACHE_MS) {
      if (compareVersions(installed, cache.latest) === -1) {
        console.log(c.yellow(`Plan2Code v${cache.latest} is out (you have v${installed}). Run: plan2code update`));
      }
      return;
    }
    const checker = path.join(__dirname, 'update-check.mjs');
    if (!fs.existsSync(checker)) return;
    const refresh =
      'import(process.argv[1]).then((m) => m.checkForUpdate({ installed: process.argv[2], cacheFile: process.argv[3] })).catch(() => {});';
    const href = require('url').pathToFileURL(checker).href;
    spawn(process.execPath, ['-e', refresh, href, installed, UPDATE_CACHE_FILE], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  } catch {}
}

async function launch() {
  const argv = process.argv.slice(2);
  if (argv[0] === UPDATE_COMMAND) {
    const tagAt = argv.indexOf('--tag');
    return runUpdate(tagAt >= 0 ? argv[tagAt + 1] : undefined);
  }
  const fromShortcut = argv.includes(PICK_FOLDER_FLAG);
  const classic = argv.includes(CLASSIC_FLAG);
  const keepPermissions = argv.includes(KEEP_PERMISSIONS_FLAG);
  const { cli: requestedCli, rest: extraArgs } = takeCliFlag(
    argv.filter((arg) => arg !== PICK_FOLDER_FLAG && arg !== CLASSIC_FLAG && arg !== KEEP_PERMISSIONS_FLAG)
  );

  printIntro();
  await releaseNotice();
  const { cli, code } = await chooseCli(requestedCli);
  if (!cli) return exitWith(code, fromShortcut);
  saveState({ lastCli: cli.id });

  // The app has its own permission tick on its launch card, so the question is only for the
  // terminal flow (asked late if the app fails to start).
  const app = !classic && hasDisplay() ? findApp() : null;
  let bypass = app ? null : await chooseBypass(cli, keepPermissions);

  let cwd = process.cwd();
  if (fromShortcut) {
    const folder = await pickFolder();
    if (!folder) return process.exit(0);
    if (!isDirectory(folder)) {
      console.error(`${ce.red('plan2code:')} ${folder} is not a folder.`);
      return exitWith(1, fromShortcut);
    }
    saveState({ lastFolder: folder });
    cwd = folder;
    console.log(`Opening Plan2Code in ${c.cyan(folder)}`);
  }

  if (!(await confirmProject(cwd))) return process.exit(0);

  if (!hasModelFlag(extraArgs, cli.id)) await chooseModel(cli, extraArgs);

  // The app takes over from here when it is installed, a window can open and --classic is absent.
  if (app && (await startApp(app, { cwd, cliId: cli.id, model: modelFrom(extraArgs, cli.id) }))) {
    console.log(`Opened the Plan2Code app in ${c.cyan(cwd)} ${c.dim('(run `plan2code --classic` to stay in this terminal)')}`);
    return process.exit(0);
  }
  if (bypass === null) bypass = await chooseBypass(cli, keepPermissions);

  const args = cli.args(extraArgs, { bypass });
  const options = { cwd, stdio: 'inherit', ...(cli.fullPath ? { fromFullPath: true } : {}) };

  const child = spawnCommand(cli.path, args, options);

  // Ctrl+C reaches the CLI directly through the shared console; keep this wrapper alive so it
  // can hand back the CLI's exit status instead of dying first.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {});
  }

  child.on('error', (error) => {
    console.error(`${ce.red('plan2code:')} failed to start ${cli.id}: ${error.message}`);
    exitWith(1, fromShortcut);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.removeAllListeners(signal);
      process.kill(process.pid, signal);
      return;
    }
    exitWith(code ?? 0, fromShortcut);
  });
}

// Run only when invoked directly; requiring the file (the tests do) is load-only.
if (require.main === module) launch();

module.exports = { normalizeAgents, buildArgs, customClis, resolveCustomCommand, runnableClis, listModels, mergeModels, modelEntries, renderBanner, paint, hasModelFlag, compareVersions, modelFrom, hasDisplay, looksLikeProject };
