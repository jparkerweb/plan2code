// Plan2Code Web Console - the native folder picker behind Workspace's Browse…
//
// A port of the launcher's picker (src/launcher/plan2code.js). The launcher
// is self-contained CommonJS copied alone to ~/.plan2code/bin/, and this
// console is ESM bundled into every skill, so the two cannot share a module:
// this is a copy, and a drift test in scripts/test-web-console.mjs fails the
// moment the launcher's picker changes without it. The prompt is a parameter
// here rather than the launcher's constant.
//
// Always spawned asynchronously: spawnSync would freeze the server's polling,
// chat and wait for as long as the dialog stayed open.
//
// Node built-ins only.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const IS_WINDOWS = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

export const WORKSPACE_PICKER_PROMPT = "Choose a folder to add to the workspace";

// Copied verbatim from src/launcher/plan2code.js; see the drift test.
export const WINDOWS_PICKER_SOURCE = `
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

// Resolve a command on PATH the way the shell would, including PATHEXT on Windows.
function findOnPath(command) {
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const extensions = IS_WINDOWS ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean) : [""];
  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir.replace(/^"|"$/g, ""), command + ext);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {}
    }
  }
  return null;
}

/**
 * The native folder picker for this OS, as a command to run: it prints the
 * chosen folder, or nothing when the person cancels. Null when this OS has no
 * picker we can drive.
 */
export function pickerCommand(start, prompt) {
  if (IS_WINDOWS) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "try {",
      "  [Console]::OutputEncoding = [Text.Encoding]::UTF8",
      "  Add-Type -AssemblyName System.Windows.Forms",
      "  [System.Windows.Forms.Application]::EnableVisualStyles()",
      // A TopMost owner keeps the dialog in front of the console window that launched it.
      "  $owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }",
      "  try {",
      "    Add-Type -TypeDefinition $env:PLAN2CODE_PICKER_SOURCE",
      "    $picked = [Plan2CodeFolderPicker]::Pick($owner.Handle, $env:PLAN2CODE_PICKER_PROMPT, $env:PLAN2CODE_PICKER_START)",
      "  } catch {",
      // Add-Type is blocked under Constrained Language Mode and some AppLocker policies; the
      // old tree dialog still works there.
      "    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "    $dialog.Description = $env:PLAN2CODE_PICKER_PROMPT",
      "    $dialog.SelectedPath = $env:PLAN2CODE_PICKER_START",
      "    $picked = if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.SelectedPath } else { $null }",
      "  }",
      "  if ($picked) { $picked }",
      "} catch { exit 3 }",
    ].join("\n");
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64"),
      ],
      env: {
        PLAN2CODE_PICKER_PROMPT: prompt,
        PLAN2CODE_PICKER_START: start,
        PLAN2CODE_PICKER_SOURCE: WINDOWS_PICKER_SOURCE,
      },
    };
  }

  if (IS_MAC) {
    return {
      command: "osascript",
      args: [
        "-e",
        "on run argv",
        "-e",
        `POSIX path of (choose folder with prompt "${prompt}" default location (POSIX file (item 1 of argv)))`,
        "-e",
        "end run",
        start,
      ],
    };
  }

  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return null;
  if (findOnPath("zenity")) {
    return {
      command: "zenity",
      args: ["--file-selection", "--directory", `--title=${prompt}`, `--filename=${start}${path.sep}`],
    };
  }
  if (findOnPath("kdialog")) {
    return { command: "kdialog", args: ["--title", prompt, "--getexistingdirectory", start] };
  }
  return null;
}

/**
 * Show the picker and settle on what the person did: `{ path }` for a pick,
 * `{ cancelled: true }` when they closed it, `{ error }` when the picker
 * itself failed or this OS has none. Pickers exit 0 or 1 with nothing printed
 * when cancelled.
 */
export function pickFolder(start, prompt, { spawnImpl = spawn } = {}) {
  const picker = pickerCommand(start, prompt);
  if (!picker) return Promise.resolve({ error: "picker-failed" });
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let child;
    try {
      child = spawnImpl(picker.command, picker.args, {
        env: { ...process.env, ...(picker.env || {}) },
        // stderr is ignored, not piped: a pipe nobody reads fills up and
        // blocks a chatty picker (GTK warnings) before it can exit.
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
    } catch {
      return settle({ error: "picker-failed" });
    }
    let stdout = "";
    if (child.stdout) {
      child.stdout.setEncoding?.("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
    }
    child.on("error", () => settle({ error: "picker-failed" }));
    child.on("close", (code) => {
      const folder = stdout.trim();
      if (code === 0 && folder) return settle({ path: path.resolve(folder) });
      if (!folder && (code === 0 || code === 1)) return settle({ cancelled: true });
      settle({ error: "picker-failed" });
    });
  });
}
