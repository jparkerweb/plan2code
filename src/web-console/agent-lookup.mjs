// Plan2Code - the one agent list (agents.json) and the one rule for where an
// agent's command is found: the shipped list the launcher, the console and
// (mirrored in Rust) the desktop app read; defines only.
//
// install.js copies this file to ~/.plan2code/bin/ beside plan2code.js and
// agents.json, so `loadAgentList()` reads its sibling by default. The shared
// cases in scripts/fixtures/agent-lookup-cases.json pin the Node and Rust
// lookups to the same answers.
//
// Node built-ins only. No build step.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AGENT_LIST_SCHEMA = 1;
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

const isFile = (file) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

/**
 * The shipped agent list: `agents.json` in `dir` (default: the folder holding
 * this module, so the installed copy in ~/.plan2code/bin/ reads its sibling).
 * Returns `{ builtins, templates, warnings }`; a missing or bad file means
 * empty lists and one warning, never a throw, so callers fall back. With
 * `optional` an absent file warns nothing: the shipped list simply is not
 * there, while a malformed one is still named.
 */
export function loadAgentList({ dir = MODULE_DIR, optional = false } = {}) {
  const warnings = [];
  let file;
  try {
    file = JSON.parse(fs.readFileSync(path.join(dir, "agents.json"), "utf8"));
  } catch (error) {
    if (optional && error && error.code === "ENOENT") return { builtins: [], templates: [], warnings };
    const why = error && error.code === "ENOENT" ? "is missing" : "is not valid JSON";
    return { builtins: [], templates: [], warnings: [`agents.json ${why}`] };
  }
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    return { builtins: [], templates: [], warnings: ["agents.json is not an object"] };
  }
  if (file.schema !== AGENT_LIST_SCHEMA) {
    return { builtins: [], templates: [], warnings: [`agents.json has schema ${JSON.stringify(file.schema)}, not ${AGENT_LIST_SCHEMA}`] };
  }
  const list = Array.isArray(file.agents) ? file.agents : [];
  const builtins = [];
  const templates = [];
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      warnings.push(`agents[${index}] skipped: not an object`);
      return;
    }
    if (entry.kind === "builtin") builtins.push(entry);
    else if (entry.kind === "template") templates.push(entry);
    else warnings.push(`agents[${index}] skipped: unknown kind ${JSON.stringify(entry.kind)}`);
  });
  return { builtins, templates, warnings };
}

/** `%NAME%` replaced from `env` (case-insensitive, as Windows reads it); an unknown name stays as written. */
function expandPercentVars(text, env) {
  const lookup = (name) => {
    const key = Object.keys(env).find((k) => k.toUpperCase() === name.toUpperCase());
    return key === undefined ? undefined : env[key];
  };
  return text.replace(/%([^%]+)%/g, (whole, name) => lookup(name) ?? whole);
}

/** `~` at the start (alone or before a separator) replaced with `home`. */
function expandHome(text, home) {
  return text.replace(/^~(?=$|[\\/])/, home);
}

/** The folders a PATH-like string names, quotes stripped. */
function pathDirs(pathValue) {
  return String(pathValue || "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((dir) => dir.replace(/^"|"$/g, ""));
}

/** `command` in `dirs`, each extension tried on Windows. The first file hit, or null. */
function findInDirs(command, dirs, extensions) {
  for (const dir of dirs) {
    const hit = findInDir(command, dir, extensions);
    if (hit) return hit;
  }
  return null;
}

/**
 * `command` (a bare name) in `dir`, PATHEXT tried on Windows. Extensions come
 * in uppercase there while files are usually lowercase: both cases are tried
 * so the path returned names the file as written. The first hit, or null.
 */
function findInDir(command, dir, extensions) {
  // A name that already carries an extension (goose.cmd) is tried as written first.
  const exts = path.extname(command) ? ["", ...extensions] : extensions;
  for (const ext of exts) {
    for (const name of new Set([command + ext.toLowerCase(), command + ext])) {
      const candidate = path.join(dir, name);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * The saved user and system PATH from the Windows registry (what a newly
 * opened terminal gets), as one PATH string, or "" elsewhere / on failure.
 * PLAN2CODE_NO_SAVED_PATH keeps it out of test runs, as the launcher's
 * addSavedWindowsPath() honors it.
 */
function savedWindowsPath(windows) {
  if (!windows || process.env.PLAN2CODE_NO_SAVED_PATH) return "";
  const reg = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "reg.exe");
  const parts = [];
  for (const key of ["HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment", "HKCU\\Environment"]) {
    let out;
    try {
      out = spawnSync(reg, ["query", key, "/v", "Path"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    } catch {
      continue;
    }
    const value = parseRegQueryValue(out && out.stdout);
    if (value) parts.push(expandPercentVars(value, process.env));
  }
  return parts.join(path.delimiter);
}

/** The value after the REG_SZ / REG_EXPAND_SZ column in `reg query` output, or null. */
function parseRegQueryValue(output) {
  for (const line of String(output || "").split(/\r?\n/)) {
    const match = /\sREG_(?:EXPAND_)?SZ\s+(.*)$/.exec(line);
    if (match && match[1].trim()) return match[1].trim();
  }
  return null;
}

let cachedNpmBin; // undefined: not worked out yet; null: no npm folder found.

/**
 * npm's global bin folder, worked out once per process: derived without
 * spawning where possible (npm_config_prefix, %APPDATA%\npm on Windows),
 * `npm config get prefix` with a short timeout only as the fallback, and a
 * failure means "no npm folder", never an error.
 */
function npmGlobalBin(windows, env) {
  if (cachedNpmBin !== undefined) return cachedNpmBin;
  cachedNpmBin = null;
  const prefix = env.npm_config_prefix;
  if (prefix) {
    cachedNpmBin = windows ? prefix : path.join(prefix, "bin");
  } else if (windows && env.APPDATA) {
    cachedNpmBin = path.join(env.APPDATA, "npm");
  } else {
    try {
      const out = spawnSync("npm", ["config", "get", "prefix"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 3000,
      });
      const got = (out && out.stdout ? out.stdout.trim() : "") || "";
      if (got) cachedNpmBin = windows ? got : path.join(got, "bin");
    } catch {}
  }
  return cachedNpmBin;
}

/** Tests only: drop the cached npm folder so a later findAgent() derives it again. */
export function resetNpmBinCache() {
  cachedNpmBin = undefined;
}

/**
 * Where `entry.command` can run from: `{ state, path, where, folder }` with
 * `state` "found" (on the process PATH), "outside" (on the saved Windows PATH,
 * in npm's global folder or in one of the entry's installDirs) or "missing".
 * `where` is "path" | "saved-path" | "npm" | "install-dir" | null and `folder`
 * the directory it was found in. A command with a path separator is checked
 * as a file, PATHEXT tried on Windows when it has none.
 *
 * `env` overrides `path`, `pathext`, `savedPath`, `npmBin`, `platform` and
 * `home` for tests: pass strings ("" for none); `platform` is "win" | "mac" |
 * "linux" (default: this OS).
 */
export function findAgent(entry, env = {}) {
  const command = String(entry && entry.command ? entry.command : "").trim().replace(/^"(.*)"$/, "$1");
  if (!command) return { state: "missing", path: null, where: null, folder: null };

  const platform = env.platform || (process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux");
  const windows = platform === "win";
  const pathext = env.pathext !== undefined ? env.pathext : process.env.PATHEXT;
  const extensions = windows ? String(pathext || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean) : [""];

  // A command written as a path is checked as a file, never looked up.
  if (command.includes("/") || (windows && command.includes("\\"))) {
    const full = path.resolve(command);
    const tries = windows && !path.extname(full) ? extensions.map((ext) => full + ext) : [full];
    const hit = tries.find(isFile);
    return hit
      ? { state: "found", path: hit, where: "path", folder: path.dirname(hit) }
      : { state: "missing", path: null, where: null, folder: null };
  }

  const searchPath = env.path !== undefined ? env.path : process.env.PATH;
  const onPath = findInDirs(command, pathDirs(searchPath), extensions);
  if (onPath) return { state: "found", path: onPath, where: "path", folder: path.dirname(onPath) };

  const saved = env.savedPath !== undefined ? env.savedPath : savedWindowsPath(windows);
  const onSaved = findInDirs(command, pathDirs(saved), extensions);
  if (onSaved) return { state: "outside", path: onSaved, where: "saved-path", folder: path.dirname(onSaved) };

  const npmBin = env.npmBin !== undefined ? env.npmBin : npmGlobalBin(windows, process.env);
  const onNpm = npmBin ? findInDir(command, npmBin, extensions) : null;
  if (onNpm) return { state: "outside", path: onNpm, where: "npm", folder: path.dirname(onNpm) };

  const home = env.home !== undefined ? env.home : os.homedir();
  const dirs = (entry.installDirs && entry.installDirs[platform]) || [];
  for (const dir of dirs) {
    const expanded = expandPercentVars(expandHome(String(dir), home), env.vars || process.env);
    const hit = findInDir(command, expanded, extensions);
    if (hit) return { state: "outside", path: hit, where: "install-dir", folder: path.dirname(hit) };
  }

  return { state: "missing", path: null, where: null, folder: null };
}
