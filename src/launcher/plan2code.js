#!/usr/bin/env node
'use strict';

/**
 * `plan2code` — open the Plan2Code dashboard skill in Claude Code or Devin, in the current
 * directory.
 *
 * Runs one of:
 *   claude /plan2code --permission-mode bypassPermissions [extra args]
 *   devin --permission-mode bypass [extra args] -- /plan2code
 *
 * When both CLIs are installed it asks which one, with the last pick as the default; with only
 * one installed it uses that. `--cli claude` / `--cli devin` skips the question. Before starting
 * it says that the CLI keeps the model it last used and waits for Enter. Any other arguments are
 * forwarded to the CLI. Self-contained, Node built-ins only: install.js copies this file to
 * ~/.plan2code/bin/ and points the global shims at it.
 *
 * `--pick-folder` (passed by the desktop shortcut, never forwarded to the CLI) asks for the
 * project folder with a native folder picker first, starting on the folder picked last time.
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
const PICKER_PROMPT = 'Choose the project folder to open Plan2Code in';

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
];

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

  private const uint FOS_PICKFOLDERS = 0x20;
  private const uint FOS_FORCEFILESYSTEM = 0x40;
  private const uint FOS_PATHMUSTEXIST = 0x800;
  private const uint SIGDN_FILESYSPATH = 0x80058000;
  private const int ERROR_CANCELLED = unchecked((int)0x800704C7);

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
      console.error(`plan2code: --cli takes ${CLIS.map((cli) => cli.id).join(' or ')}${requested ? `, not "${requested}"` : ''}.`);
      return { code: 2 };
    }
    const found = installed.find((cli) => cli.id === requested);
    if (!found) {
      console.error(`plan2code: the \`${known.id}\` CLI was not found on your PATH.`);
      console.error(`Install ${known.label}, open a new terminal, and run \`plan2code\` again.`);
    }
    return found ? { cli: found } : { code: 127 };
  }

  if (installed.length === 0) {
    console.error(`plan2code: neither ${CLIS.map((cli) => `\`${cli.id}\``).join(' nor ')} was found on your PATH.`);
    console.error(`Install ${CLIS.map((cli) => cli.label).join(' or ')}, open a new terminal, and run \`plan2code\` again.`);
    return { code: 127 };
  }
  if (installed.length === 1 || !process.stdin.isTTY) {
    const { lastCli } = readState();
    return { cli: installed.find((cli) => cli.id === lastCli) || installed[0] };
  }

  const { lastCli } = readState();
  const defaultIndex = Math.max(0, installed.findIndex((cli) => cli.id === lastCli));
  console.log('Which CLI should open Plan2Code?');
  installed.forEach((cli, i) => console.log(`  ${i + 1}) ${cli.label}`));
  for (;;) {
    const answer = (await ask(`Choice [${defaultIndex + 1}]: `)).trim().toLowerCase();
    if (!answer) return { cli: installed[defaultIndex] };
    const byNumber = installed[Number(answer) - 1];
    const byName = installed.find((cli) => cli.id === answer || cli.label.toLowerCase() === answer);
    if (/^\d+$/.test(answer) && byNumber) return { cli: byNumber };
    if (byName) return { cli: byName };
    console.log(`Type a number from 1 to ${installed.length}, or press Enter for ${installed[defaultIndex].label}.`);
  }
}

/** True when the forwarded arguments already pick a model (`--model <name>` / `--model=<name>`). */
function hasModelFlag(args) {
  return args.some((arg) => arg === '--model' || arg.startsWith('--model='));
}

/**
 * Say that the CLI starts on the model it last used, and wait for Enter so the person can back
 * out and change it first. Without an interactive terminal there is nobody to wait for.
 */
async function confirmModel(cli) {
  console.log('');
  console.log(`${cli.label} will use the model you last used in it. To use a different model, open`);
  console.log(`\`${cli.id}\` on its own and switch model there, or run \`plan2code --model <name>\`.`);
  if (process.stdin.isTTY) await ask('Press Enter to continue, or Ctrl+C to cancel.');
  console.log('');
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

  if (picker) {
    console.log('Pick a project folder in the window that just opened...');
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

  const answer = (await ask(`Project folder [${start}]: `)).trim().replace(/^["']|["']$/g, '');
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

  const { cli, code } = await chooseCli(requestedCli);
  if (!cli) return exitWith(code, fromShortcut);
  saveState({ lastCli: cli.id });

  let cwd = process.cwd();
  if (fromShortcut) {
    const folder = await pickFolder();
    if (!folder) return process.exit(0);
    if (!isDirectory(folder)) {
      console.error(`plan2code: ${folder} is not a folder.`);
      return exitWith(1, fromShortcut);
    }
    saveState({ lastFolder: folder });
    cwd = folder;
    console.log(`Opening Plan2Code in ${folder}`);
  }

  if (!hasModelFlag(extraArgs)) await confirmModel(cli);

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
    console.error(`plan2code: failed to start ${cli.id}: ${error.message}`);
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

launch();
