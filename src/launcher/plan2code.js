#!/usr/bin/env node
'use strict';

/**
 * `plan2code` — open the Plan2Code dashboard skill in Claude Code, Devin or Codex, in the
 * current directory.
 *
 * Runs one of:
 *   claude /plan2code --permission-mode bypassPermissions [extra args]
 *   devin --permission-mode bypass [extra args] -- /plan2code
 *   codex --dangerously-bypass-approvals-and-sandbox [extra args] $plan2code
 *
 * Codex starts a skill with `$name` rather than `/name`. When more than one CLI is installed it asks which one, with the last pick as the default; with only
 * one installed it uses that. `--cli claude` / `--cli devin` skips the question. Before starting
 * it asks which model to run, from the curated list in models.json (shipped with every
 * install) plus any models the user added in User Preferences; Enter keeps the model the CLI
 * last used, and `--model` skips the question. Any other arguments are forwarded to the CLI. Self-contained, Node
 * built-ins only: install.js copies this file to ~/.plan2code/bin/ and points the global
 * shims at it.
 *
 * `--pick-folder` (passed by the desktop shortcut, never forwarded to the CLI) asks for the
 * project folder with a native folder picker first, starting on the folder picked last time.
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
const STATE_FILE = path.join(os.homedir(), '.plan2code', 'launcher.json');
// Menus longer than this print compactly (id-only, two columns).
const MODELS_MENU_COMPACT_AT = 30;
const PICKER_PROMPT = 'Choose the project folder to open Plan2Code in';

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

/** The CLIs that can open the dashboard, in menu order. `args` builds the full argument list. */
const CLIS = [
  {
    id: 'claude',
    label: 'Claude Code',
    args: (extra) => ['/plan2code', '--permission-mode', 'bypassPermissions', ...extra],
  },
  {
    id: 'devin',
    label: 'Devin',
    args: (extra) => ['--permission-mode', 'bypass', ...extra, '--', '/plan2code'],
  },
  {
    id: 'codex',
    label: 'Codex',
    // Codex mentions a skill with `$name`; the prompt is its one positional argument.
    args: (extra) => ['--dangerously-bypass-approvals-and-sandbox', ...extra, '$plan2code'],
  },
];

/** What to do when no agent is installed: how to get one and how to run the skill from it. */
const SKILL_STEPS = [
  'Plan2Code runs inside an AI coding agent. To use it:',
  '  1. Install one: Claude Code (npm i -g @anthropic-ai/claude-code), Codex (npm i -g @openai/codex) or Devin (https://devin.ai).',
  '  2. Open a new terminal and cd into the project you want to work on.',
  '  3. Start your agent there, then type /plan2code (Claude Code, Devin) or $plan2code (Codex).',
];

/** The CLI ids as prose: "`claude`, `devin` or `codex`". */
function cliIdList() {
  const ids = CLIS.map((cli) => '`' + cli.id + '`');
  return `${ids.slice(0, -1).join(', ')} or ${ids[ids.length - 1]}`;
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

  private const uint FOS_PICKFOLDERS = 0x20;
  private const uint FOS_FORCEFILESYSTEM = 0x40;
  private const uint FOS_PATHMUSTEXIST = 0x800;
  private const uint SIGDN_FILESYSPATH = 0x80058000;
  private const int ERROR_CANCELLED = unchecked((int)0x800704C7);

  private static void Raise(string title) {
    for (int i = 0; i < 100; i++) {
      IntPtr hwnd = FindWindow(null, title);
      if (hwnd != IntPtr.Zero) {
        int w = Math.Min(1100, GetSystemMetrics(0) - 80);
        int h = Math.Min(750, GetSystemMetrics(1) - 80);
        int x = (GetSystemMetrics(0) - w) / 2 + 40;
        int y = (GetSystemMetrics(1) - h) / 2 + 40;
        SetWindowPos(hwnd, new IntPtr(-1), x, y, w, h, 0x40);
        SetForegroundWindow(hwnd);
        return;
      }
      Thread.Sleep(50);
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
 * Choose the CLI from those installed: the `--cli` pick, the only one installed, or a numbered
 * menu defaulting to the last pick. Returns `{ cli }` with its resolved `path`, or `{ code }` (the
 * exit code) after printing why none can be used.
 */
async function chooseCli(requested) {
  const installed = CLIS.map((cli) => ({ ...cli, path: findOnPath(cli.id) })).filter((cli) => cli.path);

  if (requested !== undefined) {
    const known = CLIS.find((cli) => cli.id === requested);
    if (!known) {
      console.error(`${ce.red('plan2code:')} --cli takes ${CLIS.map((cli) => cli.id).join(', ')}${requested ? `, not "${requested}"` : ''}.`);
      return { code: 2 };
    }
    const found = installed.find((cli) => cli.id === requested);
    if (!found) {
      console.error(`${ce.red('plan2code:')} the \`${known.id}\` CLI was not found on your PATH.`);
      console.error(`Install ${known.label}, open a new terminal, and run \`plan2code\` again.`);
      for (const step of SKILL_STEPS) console.error(step);
    }
    if (found) announceCli(found);
    return found ? { cli: found } : { code: 127 };
  }

  if (installed.length === 0) {
    console.error(`${ce.red('plan2code:')} none of ${cliIdList()} was found on your PATH.`);
    console.error('');
    for (const step of SKILL_STEPS) console.error(step);
    console.error('');
    console.error('Already have an agent? Open it in your project and type /plan2code ($plan2code in Codex), or install it and run `plan2code` again.');
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
  console.log(c.dim('You can also skip this launcher and run `/plan2code` straight from your agent.'));
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

/** True when the forwarded arguments already pick a model (`--model <name>` / `--model=<name>`). */
function hasModelFlag(args) {
  return args.some((arg) => arg === '--model' || arg.startsWith('--model='));
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
  return mergeModels(
    modelEntries(readJsonFile(SHIPPED_MODELS_FILE), cli.id),
    modelEntries(readJsonFile(USER_MODELS_FILE), cli.id)
  );
}

/**
 * Ask which model to run: a numbered list with Enter keeping the model the CLI last used.
 * A pick appends `--model <id>` to `extraArgs`. Without an interactive terminal there is
 * nobody to ask, so it just says which model will be used, as it always has.
 */
async function chooseModel(cli, extraArgs) {
  if (!process.stdin.isTTY) {
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
    models.forEach((model, i) => console.log(`  ${c.cyan(`${i + 1})`)} ${model.id} — ${model.label}`));
  }
  for (;;) {
    const answer = (await ask(`Choice ${c.green('[keep last used]')}: `)).trim().toLowerCase();
    if (!answer) return;
    const byNumber = models[Number(answer) - 1];
    const byName = models.find((model) => model.id === answer || model.label.toLowerCase() === answer);
    const model = (/^\d+$/.test(answer) && byNumber) || byName;
    if (model) {
      extraArgs.push('--model', model.id);
      return;
    }
    console.log(c.yellow(`Type a number from 1 to ${models.length}, a model name, or press Enter to keep the last-used model.`));
  }
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

  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return null;
  if (findOnPath('zenity')) {
    return { command: 'zenity', args: ['--file-selection', '--directory', `--title=${PICKER_PROMPT}`, `--filename=${start}${path.sep}`] };
  }
  if (findOnPath('kdialog')) {
    return { command: 'kdialog', args: ['--title', PICKER_PROMPT, '--getexistingdirectory', start] };
  }
  return null;
}

/**
 * Ask for the project folder: the native picker when there is one, a typed path otherwise.
 * Returns the folder, or null when the person cancelled.
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
    // Pickers exit 0 or 1 with nothing printed when cancelled; anything else means the picker
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

async function launch() {
  const argv = process.argv.slice(2);
  const fromShortcut = argv.includes(PICK_FOLDER_FLAG);
  const { cli: requestedCli, rest: extraArgs } = takeCliFlag(argv.filter((arg) => arg !== PICK_FOLDER_FLAG));

  printIntro();
  const { cli, code } = await chooseCli(requestedCli);
  if (!cli) return exitWith(code, fromShortcut);
  saveState({ lastCli: cli.id });

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

  if (!hasModelFlag(extraArgs)) await chooseModel(cli, extraArgs);

  const args = cli.args(extraArgs);
  const options = { cwd, stdio: 'inherit' };

  const child =
    IS_WINDOWS && /\.(cmd|bat)$/i.test(cli.path)
      ? spawn(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', `"${[cli.path, ...args].map(quoteForCmd).join(' ')}"`],
          { ...options, windowsVerbatimArguments: true }
        )
      : spawn(cli.path, args, options);

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

module.exports = { mergeModels, modelEntries, renderBanner, paint };
