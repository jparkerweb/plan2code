#!/usr/bin/env node
// deps.mjs: the Update Dependencies skill's mechanical steps.
//
// The repeatable steps live here so they behave the same on every run: finding
// manifests and lockfiles, reading each package manager's own JSON, the label
// rules, the batch planner, backups with a checked put-back, release-note
// slices and the hand-off brief. Judgment stays with the agent and its
// helpers: they read the notes, search for callers and return records; this
// script turns records into labels. It never commits, never installs a tool,
// never edits source code and never updates anything not picked.
//
// Sections, in order (each behind a banner comment, so a later phase adds its
// code in its own section):
//   1. dispatch and run folder
//   2. adapters (one object per ecosystem behind one interface)
//   3. version math
//   4. manifests
//   5. labels
//   6. batches
//   7. notes
//   8. hand-off
//
// PLAN2CODE_DEPS_HTTP_BASE exists for tests only: notes sends every request
// to <base>/<host><path> (a local server replaying saved responses) instead of
// the real host. Read only by fetchText and fetchJson; never set it in a run.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, fail, out, parseArgs, run, isDir, compactDate, readText } from "./common.mjs";
import { matchGlob } from "./glob.mjs";
import { readTestMap } from "./test-map.mjs";

const USAGE = `
deps.mjs: find, label and apply dependency updates. JSON on stdout.
It never commits, never installs a tool and never edits source code.

  node deps.mjs detect [--root <dir>]
  node deps.mjs scan --run <dir> [--folders a,b] [--no-audit] [--notes]
  node deps.mjs notes --run <dir> --id <row>
  node deps.mjs label --run <dir> --records <file>
  node deps.mjs batches --run <dir> --picks <id,id,...>
  node deps.mjs batches --run <dir> --split <batch>
  node deps.mjs backup --run <dir> --batch <batch>
  node deps.mjs apply --run <dir> --batch <batch>
  node deps.mjs restore --run <dir> --batch <batch> [--verify]
  node deps.mjs handoff --run <dir> --ids <id,id,...>
  node deps.mjs cleanup --run <dir>

--run is the run folder, <temp>/plan2code-deps-<YYYYMMDD>-<random>/. Any
other folder is refused (exit 3).

detect     Makes the run folder and finds every lockfile with its manifest,
           package manager and workspace members (npm, pnpm, Yarn; Cargo
           from cargo metadata; pip, where a requirements*.txt that pins
           every line with == is the lockfile; uv; Go, go.mod with go.sum;
           .NET, each *.csproj / *.fsproj with its packages.lock.json, or
           without one the project file itself, flagged noLockfile and still
           scanned), whether
           git tracks it and which of its files are already changed (dirty),
           a quick update count, the tools missing (missingTools), manifests
           with dependencies but no lockfile (noLockfile, list only), the
           manifests of ecosystems not covered yet (notCovered: pom.xml,
           build.gradle, build.gradle.kts, Gemfile, composer.json, each
           { folder, manifest, ecosystem }, never scanned) and the
           count of other changed files (unrelatedChanges). Writes
           detect.json and prints it with run. --root defaults to the
           current folder.
scan       Per lockfile (--folders limits it to lockfiles in those folders):
           rows { id <lockfile>#<package>, package, current, target (newest
           that fits the runtime), jump, inRange, range { from, to },
           pinned, via, security, fixes, newerNotFitting, repo (with
           --notes), declaredIn }, held (overrides, resolutions and runtime
           holds, never pickable), notScanned (a lookup that failed, with the
           reason), stillOpen (vulnerabilities no pick fixes), checks (test
           map rows covering its members; full when a Shared row hits) and
           audited (--no-audit skips the audit). A plugin that is not
           installed (cargo-outdated, cargo-audit, pip-audit, govulncheck) skips only its
           step and is listed in missingTools as { tool, step, install };
           rows it could not audit carry notAudited, rows from output it could
           not read carry couldNotRead. noChecks when no lockfile has
           a check. Writes scan.json, prints counts. Exit 3 with reason "no
           registry answered" when every lookup failed.
label      Reads scan.json from the run folder and the helpers' records from
           --records (a JSON array, or { records: [...] }), applies the label
           rules and writes labels.json. Prints { ok, labels: [{ id, label,
           reasons[] }] }; label is safe, check-first or warning. Saves the
           records as records.json in the run folder for handoff.
batches    --picks: one batch for every Safe pick of a lockfile, every Check
           first and Warning pick alone, pairs kept together. Writes
           batches.json. Prints { ok, batches: [{ id, lockfile, picks[] }] },
           Safe batches first, then by lockfile.
           --split <batch>: a failed batch over 6 picks is halved (pairs
           never split), 6 or fewer becomes one batch per pick (a pair as
           one), a batch that is a single pair is retried as the pair. New
           ids are <batch>.1, <batch>.2, ...; they replace the batch in
           batches.json. Prints { ok, split, batches }. A single pick cannot
           be split (exit 4).
backup     Copies the batch's lockfile and every manifest it resolves into
           the run folder (backups/<batch>/), as found, tracked or not; for pip
           also a pip freeze snapshot (pip-freeze.txt) restore reinstalls.
           Refuses a batch that already has one (exit 5). Prints { ok,
           batch, files[], missing[], snapshot } (snapshot is null, or for
           pip { ok, file, packages } / { ok: false, reason }).
apply      Needs the batch's backup (exit 5 without one, or when its
           snapshot failed: nothing could put the environment back). Raises the range
           of each out-of-range pick and each moved pin, one literal at a
           time, then runs the package manager's own update for the picks
           (never --force, never an override) and diffs the lockfile. Prints
           { ok, command, exit, failed, changed[], rangeRaised[], unpicked[]
           (moved without being picked: treat the batch as failed),
           offTarget[] (every pick not on its target, skipped ones too),
           overshot[] (an offTarget pick held below latest for the runtime
           that the tool carried past its target: failed is true, put the
           batch back), skipped[], undoFailed[] (a raise an undo could not put back:
           failed is true, put the batch back), needsNewerRuntime[] (the
           update raised the project's runtime floor, Go's go directive:
           { id, package, file, from, to } per pick moved, from null when
           go.mod had no directive (Go reads that as 1.16), failed is true,
           put the batch back) }. With every pick skipped
           nothing runs: command, cwd and exit are null.
restore    Puts the backed-up files back (and removes ones the batch made).
           --verify compares every byte: verified is true only on an exact
           match. A file it cannot copy, remove or read (locked, no access)
           goes to mismatched[] as { path, reason } and verified is false,
           never a crash. Prints { ok, restored[], deleted[], extra, verified,
           mismatched[], reinstall { command, cwd } } for the prompt to run
           through run-check.mjs. extra is null, or for pip { ok,
           uninstalled[], reason, command }: the snapshot reinstalled and
           what the batch added uninstalled. extra.ok false means stop the
           run and give the person its command to run by hand.
cleanup    Removes the run folder. Prints { ok, removed }.

notes      The release notes of one row (--id <lockfile>#<package>) between
           its current and target versions. The GitHub repo is the row's repo
           (scan --notes) or the registry's record (npm view, crates.io, PyPI,
           a github.com/ Go module path, NuGet's registration); the notes are
           its GitHub releases (gh api when gh is installed, else a fetch of
           the GitHub API) whose tag is after current and up to target, else
           CHANGELOG.md then CHANGES.md from the default branch, sliced to the
           headings between the two versions. Each request stops after 15 s
           and a failure never throws. Prints { ok, id, package, current,
           target, repo, source (gh, fetch, changelog or none), url, text,
           truncated (text capped at 32 KB) }.
handoff    For each ticked id (--ids, ids from labels.json; rows that pair
           share one brief) writes specs/<package>-upgrade/UPGRADE-<YYYYMMDD>.md
           under the project root (a scoped npm name as scope-name): title,
           Status Ready, Ecosystem, Folder, then Why it was held back, What
           the notes say changed, Where the code calls it, Checks that cover
           it and How to apply, from scan.json, labels.json and records.json.
           A brief of the same date is replaced. Prints { ok, written: [{
           file, folder, ids[], packages[] }] }. An id not in labels.json
           exits 3 and nothing is written; it never writes outside specs/.

PLAN2CODE_NOW pins the clock. PLAN2CODE_DEPS_HTTP_BASE is for tests only: it
sends every notes request to <base>/<host><path> instead of the real host.

Exit: 0 ok · 1 crash · 2 bad arguments · 3 not found (a run folder that is
not there or not a deps run, a missing scan.json or batches.json, an unknown
pick, batch or id) · 4 invalid input (an unreadable
records file, a batch that cannot be split) · 5 refused.
`;

/* ======================================================================
 * 1. Dispatch and run folder
 * ==================================================================== */

const RUN_PREFIX = "plan2code-deps-";

/** A new run folder under the system temp folder; returns its path. */
export function newRun() {
  const dir = path.join(os.tmpdir(), `${RUN_PREFIX}${compactDate()}-${crypto.randomBytes(4).toString("hex")}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Compare two real paths, ignoring case on Windows. */
const samePath = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);

/**
 * The --run folder, resolved: it must exist, be named plan2code-deps-... and
 * sit directly in the system temp folder (real paths on both sides, so a link
 * or an 8.3 name cannot slip past), else exit 3. cleanup deletes this folder,
 * so a project folder that happens to share the prefix must never pass.
 */
function runDir(value) {
  if (!value) fail(EXIT.USAGE, "missing-run", "--run is required.", "Pass the run folder detect printed.");
  const dir = path.resolve(value);
  const notARun = () => fail(EXIT.NOT_FOUND, "not-a-run", `${value} is not a deps run folder.`, `Pass the run folder detect printed (a ${RUN_PREFIX}... folder in the system temp folder).`);
  if (!path.basename(dir).startsWith(RUN_PREFIX)) notARun();
  if (!isDir(dir)) fail(EXIT.NOT_FOUND, "run-missing", `The run folder ${value} does not exist.`, "Run detect again for a new run folder.");
  let real;
  let temp;
  try {
    real = fs.realpathSync.native(dir);
    temp = fs.realpathSync.native(os.tmpdir());
  } catch {
    notARun();
  }
  if (!path.basename(real).startsWith(RUN_PREFIX) || !samePath(path.dirname(real), temp)) notARun();
  return dir;
}

/** Read a JSON file inside a run folder; null when it is not there. Exit 4 when it is not JSON. */
export function readRun(dir, name) {
  const file = path.join(dir, name);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(EXIT.INVALID, "run-file-invalid", `${name} in the run folder is not valid JSON.`, "Run the step that writes it again.");
  }
}

/** Write a JSON file inside a run folder. */
export function writeRun(dir, name, obj) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(obj, null, 2) + "\n");
}

function cmdCleanup(argv) {
  const args = parseArgs(argv, { values: ["run"] });
  const dir = runDir(args.run);
  fs.rmSync(dir, { recursive: true, force: true });
  out({ ok: true, removed: dir.split(path.sep).join("/") });
}

/* ======================================================================
 * 2. Adapters
 * ==================================================================== */

// One plain object per ecosystem, all with this shape:
//
//   id                  the adapter's name ("npm" for the npm family)
//   ecosystem           the version-math ecosystem its versions follow
//   lockfiles           the lockfile names it owns
//   detect(root)        -> [{ lockfile, manifest, manager, members[] }], paths
//                          relative to root with forward slashes; members are
//                          the folders that lockfile resolves (its own first)
//   unlocked(root, entries)  -> [{ manifest, reason }]: manifests with
//                          dependencies that no lockfile resolves (list only)
//   quickCount(entry, root)  -> the number of outdated packages, or null
//   scan(entry, opts)   -> { rows, held, notScanned, missingTools, stillOpen,
//                          audited, lookups, answered }; opts { root, audit, notes }
//   applyCommand(batch, entry, root) -> { cmd, args, cwd }: the package
//                          manager's own command moving the picks (batch.rows)
//   installCommand(entry, root)      -> { cmd, args, cwd }: a frozen install
//                          that fails rather than rewrite the lockfile
//   snapshot(entry, dir, root) / restoreExtra(entry, dir, root): optional,
//                          for what lives outside the files (pip's environment)
//   afterApply(entry, root, store, moved) -> { needsNewerRuntime[] }: optional,
//                          a check of the files after the update against the
//                          backup in store (Go's go directive)
//   runtime(entry, root) -> { declared, source, machine }
//   lockVersions(entry, text) -> Map of a lockfile key to its resolved version
//
// spawnTool runs every tool. It never passes --force: an update that needs it
// is the person's call, never a pick's.

/** A tool may run this long (an install, an update) before it is stopped. */
export const TOOL_TIMEOUT_MS = 10 * 60 * 1000;
/** A registry lookup (npm view) may run this long. */
const LOOKUP_TIMEOUT_MS = 60 * 1000;

// Build output and virtual environments hold copies of manifests that are not the project's own.
const SKIP_DIRS = new Set(["node_modules", ".git", "specs", "specs--completed", "target", ".venv", "venv", "__pycache__"]);

const posix = (p) => p.split(path.sep).join("/");
const relTo = (root, p) => posix(path.relative(root, p)) || ".";
const dirOf = (rel) => path.posix.dirname(rel);
const inDir = (dir, rel) => (dir === "." ? rel : `${dir}/${rel}`);

/** Files under root whose base name is in `names` (a Set, or a test on the name), relative with forward slashes; skips SKIP_DIRS and linked folders. */
function walk(root, names) {
  const wanted = typeof names === "function" ? names : (n) => names.has(n);
  const found = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(path.join(dir, e.name));
      } else if (e.isFile() && wanted(e.name)) {
        found.push(relTo(root, path.join(dir, e.name)));
      }
    }
  }
  return found.sort();
}

/**
 * A binary on PATH, by name. On Windows each PATHEXT extension is tried (as
 * Dead Code's onPath does), so npm resolves to npm.cmd and a test can fake a
 * tool with a stub on a temp PATH. Returns the full path, or null.
 */
export function findTool(name, env = process.env) {
  const dirs = (env.PATH || env.Path || "").split(path.delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? (env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean) : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (process.platform !== "win32") fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {}
    }
  }
  return null;
}

/**
 * One argument for cmd.exe: bare when plain, else quoted (^, <, >, & and spaces are literal inside
 * quotes). A ", %, ! or line break cannot be quoted safely there, so spawnTool refuses those first.
 */
const winArg = (a) => (/^[\w@./:=,+-]+$/.test(a) ? a : `"${a}"`);
const SHELL_UNSAFE = /["%!\r\n]/;

/**
 * Runs one cmd.exe line in a child node and prints { code, stdout, stderr, timedOut } as JSON. On a
 * timeout it ends the whole process tree with taskkill /T /F (as run-check.mjs does): spawnSync's own
 * timeout ends only cmd.exe, and the npm under it would keep writing the lockfile after a put-back.
 */
const WIN_RUNNER = `
const { spawn, spawnSync } = require("node:child_process");
const o = JSON.parse(process.argv[1]);
const c = spawn(o.line, { cwd: o.cwd, shell: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
const out = [], err = [];
let timedOut = false, done = false;
c.stdout.on("data", (d) => out.push(d));
c.stderr.on("data", (d) => err.push(d));
const t = setTimeout(() => { timedOut = true; spawnSync(o.taskkill, ["/pid", String(c.pid), "/T", "/F"], { windowsHide: true }); }, o.timeoutMs);
const end = (r) => { if (done) return; done = true; clearTimeout(t); process.stdout.write(JSON.stringify(r)); };
c.on("error", (e) => end({ code: null, stdout: "", stderr: e.message, timedOut: false }));
c.on("close", (code) => end({ code: timedOut ? null : code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8"), timedOut }));
`;

/**
 * Run a tool found on PATH, without a shell except for a Windows .cmd/.bat
 * (npm.cmd, pnpm.cmd), which only cmd.exe can start. Returns { code, stdout,
 * stderr, timedOut, notFound }; code is null when it did not start or was
 * stopped. Refuses --force outright.
 */
export function spawnTool(cmd, args = [], { cwd, timeoutMs = TOOL_TIMEOUT_MS } = {}) {
  if (args.some((a) => /^--force(=|$)/.test(a) || a === "-f")) throw new Error(`refusing to run ${cmd} with --force`);
  const bin = findTool(cmd);
  if (!bin) return { code: null, stdout: "", stderr: `${cmd} is not on PATH`, timedOut: false, notFound: true };
  const opts = { cwd, encoding: "utf8", windowsHide: true, timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 };
  const viaShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(bin);
  if (viaShell) {
    const bad = args.find((a) => SHELL_UNSAFE.test(String(a)));
    if (bad !== undefined) return { code: null, stdout: "", stderr: `refusing to pass ${JSON.stringify(bad)} through cmd.exe: it cannot be quoted safely`, timedOut: false, notFound: false };
    const taskkill = path.join(process.env.SystemRoot || process.env.windir || "C:\\Windows", "System32", "taskkill.exe");
    const job = JSON.stringify({ line: [`"${bin}"`, ...args.map(winArg)].join(" "), cwd, timeoutMs, taskkill });
    // The outer limit is a backstop only: the runner stops the tree at timeoutMs and reports it.
    const w = spawnSync(process.execPath, ["-e", WIN_RUNNER, job], { ...opts, timeout: timeoutMs + 30000 });
    const r = parseJson(w.stdout || "");
    if (r && typeof r === "object") return { ...r, notFound: false };
    const timedOut = Boolean(w.error && w.error.code === "ETIMEDOUT");
    return { code: null, stdout: "", stderr: w.stderr || (w.error ? w.error.message : `${cmd} gave no result`), timedOut, notFound: false };
  }
  const r = spawnSync(bin, args, opts);
  const timedOut = Boolean(r.error && r.error.code === "ETIMEDOUT") || (r.status === null && r.signal === "SIGTERM");
  return {
    code: r.error || timedOut ? null : r.status,
    stdout: r.stdout || "",
    stderr: r.stderr || (r.error && !timedOut ? r.error.message : ""),
    timedOut,
    notFound: false,
  };
}

/** The last lines of a tool's output, for a report. */
const tail = (text, n = 20) => String(text || "").trim().split(/\r?\n/).slice(-n).join("\n");

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Parse a tool's JSON stdout; undefined when it is not JSON. */
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Every JSON object of a JSON-lines stdout (Yarn 1), skipping lines that are not JSON. */
function parseJsonLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => parseJson(l.trim()))
    .filter((o) => o && typeof o === "object");
}

/**
 * Every top-level JSON object of a stream of concatenated objects, pretty
 * printed or not (go list -m -json, govulncheck -json), skipping any that is
 * not JSON.
 */
function parseJsonStream(text) {
  const s = String(text || "");
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth++ === 0) start = i;
    } else if (c === "}" && depth > 0 && --depth === 0) {
      const o = parseJson(s.slice(start, i + 1));
      if (o && typeof o === "object") objects.push(o);
    }
  }
  return objects;
}

/* ---------------------------------------------------------- npm family */

const NPM_LOCKS = { "package-lock.json": "npm", "npm-shrinkwrap.json": "npm", "pnpm-lock.yaml": "pnpm", "yarn.lock": "yarn" };
const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];
const NO_LOCKFILE = "no lockfile: updating one package would re-resolve all of them";

/** pnpm-workspace.yaml's packages: list, read line by line. */
function pnpmWorkspacePackages(text) {
  const globs = [];
  let inList = false;
  for (const line of String(text || "").split(/\r?\n/)) {
    if (/^packages\s*:\s*(?:#.*)?$/.test(line)) {
      inList = true;
      continue;
    }
    if (!inList) continue;
    const m = line.match(/^\s+-\s*(['"]?)([^'"#]+?)\1\s*(?:#.*)?$/);
    if (m) globs.push(m[2]);
    else if (/^\S/.test(line)) inList = false;
  }
  return globs;
}

/** A workspace glob (packages/*, apps/**, a plain folder; ! excludes) as a RegExp over folder paths. */
function folderGlob(glob) {
  const g = glob.replace(/^\.\//, "").replace(/\/+$/, "");
  let src = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") {
      src += ".*";
      i++;
    } else if (c === "*") src += "[^/]*";
    else if (c === "?") src += "[^/]";
    else src += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${src}$`);
}

/** The workspace member folders under dir (relative to root), from package.json workspaces or pnpm-workspace.yaml. */
function workspaceMembers(root, dir, manifests) {
  const pkg = readJsonFile(path.join(root, dir, "package.json")) || {};
  const ws = pkg.workspaces;
  const globs = [...(Array.isArray(ws) ? ws : ws && Array.isArray(ws.packages) ? ws.packages : [])];
  const yaml = readText(path.join(root, dir, "pnpm-workspace.yaml"));
  if (yaml) globs.push(...pnpmWorkspacePackages(yaml));
  const include = globs.filter((g) => typeof g === "string" && !g.startsWith("!")).map(folderGlob);
  const exclude = globs.filter((g) => typeof g === "string" && g.startsWith("!")).map((g) => folderGlob(g.slice(1)));
  if (!include.length) return [];
  const members = [];
  for (const m of manifests) {
    const folder = dirOf(m);
    if (folder === dir) continue;
    const inside = dir === "." ? folder : folder.startsWith(`${dir}/`) ? folder.slice(dir.length + 1) : null;
    if (inside === null) continue;
    if (include.some((re) => re.test(inside)) && !exclude.some((re) => re.test(inside))) members.push(folder);
  }
  return members.sort();
}

/** An exact version (a pin), not a range. */
const pinnedRange = (range) => typeof range === "string" && /^=?v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(range.trim());

/**
 * An exact pin in an ecosystem's own range syntax: npm 1.2.3 or =1.2.3, Cargo
 * =1.2.3 (a bare Cargo version is a caret range), PEP 440 == or === with no
 * wildcard, NuGet [1.2.3]. Go versions are minimums, never pins.
 */
function isPin(ecosystem, range) {
  if (typeof range !== "string") return false;
  const t = range.trim();
  if (ecosystem === "npm") return pinnedRange(t);
  if (ecosystem === "cargo") return /^=\s*\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(t);
  if (ecosystem === "python") return /^===?\s*[^\s,*]+$/.test(t);
  if (ecosystem === "nuget") return /^\[\s*[^,\]]+\s*\]$/.test(t);
  return false;
}

const hasDeps = (pkg) => Boolean(pkg) && DEP_FIELDS.some((f) => pkg[f] && typeof pkg[f] === "object" && Object.keys(pkg[f]).length);

/** The range a manifest declares for a package, and the field it sits in; null when it does not list it. */
function declaredRange(pkg, name) {
  for (const field of DEP_FIELDS) {
    const r = pkg && pkg[field] && pkg[field][name];
    if (typeof r === "string") return { range: r, field };
  }
  return null;
}

/** Package names an overrides / resolutions / pnpm.overrides object holds (nested npm overrides included). */
function overrideKeyName(key) {
  // The last package a key names: "foo", "foo@1", "@scope/foo@^2", "parent>foo",
  // "parent>@scope/foo", and Yarn paths "**/foo", "a/@scope/foo".
  const last = String(key).split(">").pop().trim();
  const segs = last.split("/");
  const tail = (segs.length >= 2 && segs[segs.length - 2].startsWith("@") ? segs.slice(-2) : segs.slice(-1)).join("/");
  const name = tail.startsWith("@") ? `@${tail.slice(1).split("@")[0]}` : tail.split("@")[0];
  return name && name !== "." && name !== "**" && name !== "*" ? name : null;
}

/**
 * Package names an overrides / resolutions / pnpm.overrides object holds. A
 * nested npm override ({ "baz": { "bar": "1" } }) holds bar under baz, and holds
 * baz itself only when the object has a "." entry.
 */
export function overrideNames(obj, names = new Set()) {
  if (!obj || typeof obj !== "object") return names;
  for (const [key, value] of Object.entries(obj)) {
    if (key === ".") continue;
    const name = overrideKeyName(key);
    if (value && typeof value === "object") {
      if (name && Object.prototype.hasOwnProperty.call(value, ".")) names.add(name);
      overrideNames(value, names);
    } else if (name) names.add(name);
  }
  return names;
}

/** Each held package name -> where it is held, from the lockfile's own package.json. */
function npmHolds(root, entry) {
  const pkg = readJsonFile(path.join(root, entry.manifest)) || {};
  const holds = new Map();
  const add = (obj, kind) => {
    for (const name of overrideNames(obj)) if (!holds.has(name)) holds.set(name, { kind, file: entry.manifest });
  };
  add(pkg.overrides, "overrides");
  add(pkg.resolutions, "resolutions");
  add(pkg.pnpm && pkg.pnpm.overrides, "pnpm.overrides");
  return holds;
}

/** The lowest version a declared runtime range allows (">=18" -> 18.0.0); null when it cannot be read. */
function floorOf(range) {
  const sets = typeof range === "string" ? npmSets(range) : null;
  if (!sets || !sets.length) return null;
  let floor = null;
  for (const set of sets) {
    let lo = sv([0, 0, 0]);
    for (const c of set) if ((c.op === ">=" || c.op === ">" || c.op === "=") && compareParsed(c.v, lo) > 0) lo = c.v;
    if (!floor || compareParsed(lo, floor) < 0) floor = lo;
  }
  return floor.release.join(".");
}

/** Does a package's engines.node accept the runtime? Missing or unreadable engines count as fitting. */
function fitsRuntime(engines, runtimeVersion) {
  if (!engines || typeof engines !== "string" || !runtimeVersion) return true;
  return inRange("npm", engines, runtimeVersion) !== false;
}

/** A repository URL from npm view, as https://host/owner/repo; null when it is not one. */
function repoUrl(value) {
  const raw = typeof value === "string" ? value : value && typeof value.url === "string" ? value.url : null;
  if (!raw) return null;
  const m = raw.match(/^(?:git\+)?(?:https?:\/\/|git:\/\/|ssh:\/\/git@|git@)([^/:]+)[/:](.+?)(?:\.git)?\/?$/);
  if (m) return `https://${m[1]}/${m[2]}`;
  const short = raw.match(/^(?:github:)?([\w.-]+\/[\w.-]+)$/);
  return short ? `https://github.com/${short[1]}` : null;
}

/** The registry's reason from a failed npm lookup: its JSON error summary, else the last stderr line. */
function lookupReason(r, parsed) {
  if (r.timedOut) return "the registry did not answer in time";
  if (parsed && parsed.error) return String(parsed.error.summary || parsed.error.code || "lookup failed").trim();
  const line = String(r.stderr || "").trim().split(/\r?\n/).filter((l) => !/A complete log of this run/.test(l)).pop();
  return line ? line.replace(/^npm (?:error|ERR!)\s*/, "") : "lookup failed";
}

/**
 * The versions newer than current, from `npm view <pkg>@">current" version
 * engines repository.url --json` (an object for one version, an array for
 * several). { ok, versions: [{ version, engines, repo }] } or { ok: false, reason, unreadable }.
 */
function npmView(name, spec, cwd) {
  const r = spawnTool("npm", ["view", `${name}@${spec}`, "version", "engines", "repository.url", "--json"], { cwd, timeoutMs: LOOKUP_TIMEOUT_MS });
  const parsed = parseJson(r.stdout);
  if (r.code !== 0 || (parsed && parsed.error)) return { ok: false, reason: lookupReason(r, parsed) };
  if (r.stdout.trim() === "") return { ok: true, versions: [] };
  if (parsed === undefined || typeof parsed !== "object" || parsed === null) return { ok: false, unreadable: true, reason: "could not read npm view output" };
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return {
    ok: true,
    versions: list
      .filter((v) => v && typeof v.version === "string")
      .map((v) => ({ version: v.version, engines: v.engines && typeof v.engines.node === "string" ? v.engines.node : null, repo: repoUrl(v["repository.url"] ?? v.repository) })),
  };
}

/** The outdated list for one lockfile, per manager: { ok, list: [{ package, current, wanted, latest, member, type }] } or { ok: false, reason }. */
function npmOutdated(entry, root) {
  const cwd = path.join(root, dirOf(entry.lockfile));
  const lockDir = dirOf(entry.lockfile);
  const memberOf = (loc) => (loc ? (path.isAbsolute(loc) ? relTo(root, loc) : inDir(lockDir, posix(loc))) : lockDir);
  if (entry.manager === "npm") {
    const r = spawnTool("npm", ["outdated", "--json", "--long"], { cwd });
    // npm outdated exits 1 when it finds updates: read the JSON, never the exit code alone.
    const json = parseJson(r.stdout || "{}");
    if (r.code !== 0 && r.code !== 1) return { ok: false, reason: lookupReason(r, json) };
    if (json && json.error) return { ok: false, reason: lookupReason(r, json) };
    if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, unreadable: true, reason: "could not read npm outdated output" };
    const list = [];
    for (const [name, value] of Object.entries(json)) {
      for (const v of Array.isArray(value) ? value : [value]) {
        if (!v || typeof v !== "object") continue;
        list.push({ package: name, current: v.current ?? null, wanted: v.wanted ?? null, latest: v.latest ?? null, member: memberOf(v.dependedByLocation), type: v.type || null });
      }
    }
    return { ok: true, list };
  }
  if (entry.manager === "pnpm") {
    const args = ["outdated", "--format", "json"];
    if (entry.members.length > 1) args.push("--recursive");
    const r = spawnTool("pnpm", args, { cwd });
    const json = parseJson(r.stdout || "{}");
    if (r.code !== 0 && r.code !== 1) return { ok: false, reason: lookupReason(r, json) };
    if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, unreadable: true, reason: "could not read pnpm outdated output" };
    const list = [];
    for (const [name, v] of Object.entries(json)) {
      if (!v || typeof v !== "object") continue;
      const dependents = Array.isArray(v.dependentPackages) && v.dependentPackages.length ? v.dependentPackages : [{ location: null }];
      for (const d of dependents) list.push({ package: name, current: v.current ?? null, wanted: v.wanted ?? null, latest: v.latest ?? null, member: memberOf(d.location), type: v.dependencyType || null });
    }
    return { ok: true, list };
  }
  // Yarn: 1.x has a JSON-lines outdated table; 2+ has no outdated list at all.
  if (entry.berry) return { ok: false, reason: "Yarn 2+ has no outdated list; check one package with yarn npm info <package>", berry: true };
  const r = spawnTool("yarn", ["outdated", "--json"], { cwd });
  const lines = parseJsonLines(r.stdout);
  const err = lines.find((l) => l.type === "error");
  if (err) return { ok: false, reason: String(err.data || "yarn outdated failed") };
  const table = lines.find((l) => l.type === "table" && l.data && Array.isArray(l.data.head));
  if (!table) {
    if (r.code === 0 && !String(r.stdout).trim()) return { ok: true, list: [] };
    return { ok: false, unreadable: true, reason: "could not read yarn outdated output" };
  }
  const col = (n) => table.data.head.findIndex((h) => String(h).toLowerCase() === n);
  const [iName, iCur, iWant, iLatest, iType, iWs] = ["package", "current", "wanted", "latest", "package type", "workspace"].map(col);
  const list = (table.data.body || []).map((row) => ({
    package: row[iName],
    current: row[iCur] ?? null,
    wanted: row[iWant] ?? null,
    latest: row[iLatest] ?? null,
    member: iWs >= 0 && row[iWs] ? memberByName(root, entry, row[iWs]) : lockDir,
    type: iType >= 0 ? row[iType] : null,
  }));
  return { ok: true, list };
}

/** A workspace member folder by its package name (Yarn names the workspace, not the folder). */
function memberByName(root, entry, name) {
  for (const m of entry.members) {
    const pkg = readJsonFile(path.join(root, m, "package.json"));
    if (pkg && pkg.name === name) return m;
  }
  return dirOf(entry.lockfile);
}

/** The npm lockfile's resolved versions by node path (node_modules/a/node_modules/b), v1 to v3. */
function npmLockVersions(text) {
  const json = parseJson(text);
  const map = new Map();
  if (!json || typeof json !== "object") return map;
  if (json.packages && typeof json.packages === "object") {
    for (const [key, v] of Object.entries(json.packages)) if (key && v && typeof v.version === "string" && !v.link) map.set(key, v.version);
    return map;
  }
  const walkDeps = (deps, prefix) => {
    for (const [name, v] of Object.entries(deps || {})) {
      const key = `${prefix}node_modules/${name}`;
      if (v && typeof v.version === "string") map.set(key, v.version);
      if (v && v.dependencies) walkDeps(v.dependencies, `${key}/`);
    }
  };
  walkDeps(json.dependencies, "");
  return map;
}

/** pnpm-lock.yaml and yarn.lock: each package name -> its resolved versions, sorted and joined. */
function textLockVersions(manager, text) {
  const byName = new Map();
  const add = (name, version) => {
    if (!name || !version) return;
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add(version);
  };
  const lines = String(text || "").split(/\r?\n/);
  if (manager === "pnpm") {
    let section = "";
    for (const line of lines) {
      const top = line.match(/^(\w[\w-]*):/);
      if (top) {
        section = top[1];
        continue;
      }
      if (section !== "packages" && section !== "snapshots") continue;
      // v5/v6 "  /name/1.2.3:" or "  /name@1.2.3:"; v9 "  name@1.2.3:" and "  '@scope/name@1.2.3(peer@1)':".
      const m = line.match(/^ {2}['"]?\/?((?:@[^/@\s'"]+\/)?[^/@\s'"(]+)[@/](\d[^:(\s'"]*)/);
      if (m) add(m[1], m[2]);
    }
  } else {
    let names = [];
    for (const line of lines) {
      if (/^\S/.test(line) && !line.startsWith("#") && line.trim().endsWith(":")) {
        names = line
          .slice(0, -1)
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""))
          .map((s) => (s.startsWith("@") ? `@${s.slice(1).split("@")[0]}` : s.split("@")[0]))
          .filter((n) => n && n !== "__metadata");
        continue;
      }
      const v = line.match(/^ {2}version:?\s+"?([^"\s]+)"?\s*$/);
      if (v) for (const n of new Set(names)) add(n, v[1]);
    }
  }
  const map = new Map();
  for (const [name, set] of byName) map.set(name, [...set].sort().join(","));
  return map;
}

/** The package name of a lockfile key: the last node_modules segment for npm, the key itself otherwise. */
const lockKeyName = (key) => {
  const at = key.lastIndexOf("node_modules/");
  return at === -1 ? key : key.slice(at + "node_modules/".length);
};

/** The audit's advisories, normalized: npm's v2 report, or the v1 advisories pnpm and Yarn 1 print. */
function npmAudit(entry, root) {
  const cwd = path.join(root, dirOf(entry.lockfile));
  const tool = entry.manager;
  if (tool === "yarn" && entry.berry) {
    const r = spawnTool("yarn", ["npm", "audit", "--json", "--all", "--recursive"], { cwd });
    const lines = parseJsonLines(r.stdout);
    if (!lines.length && r.code !== 0) return { ok: false, reason: tail(r.stderr, 1) || "yarn npm audit failed" };
    return { ok: true, findings: lines.flatMap(v1Findings) };
  }
  const r = spawnTool(tool, ["audit", "--json"], { cwd });
  if (r.code === null) return { ok: false, reason: r.timedOut ? "the audit did not answer in time" : tail(r.stderr, 1) || `${tool} audit did not start` };
  if (tool === "yarn") {
    // Yarn 1 exits with a severity bitmask: read the lines, not the code.
    const lines = parseJsonLines(r.stdout);
    const err = lines.find((l) => l.type === "error");
    if (err) return { ok: false, reason: String(err.data || "yarn audit failed") };
    return { ok: true, findings: lines.filter((l) => l.type === "auditAdvisory").flatMap((l) => v1Findings(l.data)) };
  }
  const json = parseJson(r.stdout);
  if (!json || typeof json !== "object") return { ok: false, reason: `could not read ${tool} audit output` };
  if (json.error) return { ok: false, reason: String(json.error.summary || json.error.code || "audit failed") };
  if (json.vulnerabilities && typeof json.vulnerabilities === "object") return { ok: true, findings: v2Findings(json.vulnerabilities) };
  if (json.advisories && typeof json.advisories === "object") return { ok: true, findings: Object.values(json.advisories).flatMap((a) => v1Findings({ advisory: a })) };
  return { ok: true, findings: [] };
}

const advisoryId = (a) => {
  const url = a && typeof a.url === "string" ? a.url : "";
  const ghsa = url.match(/GHSA-[\w-]+/i) || String((a && a.github_advisory_id) || "").match(/GHSA-[\w-]+/i);
  return ghsa ? ghsa[0] : a && (a.source ?? a.id) !== undefined ? String(a.source ?? a.id) : null;
};

/** npm 7+ audit: entries with at least one advisory object in via are the vulnerable packages. */
function v2Findings(vulns) {
  const findings = [];
  for (const [name, v] of Object.entries(vulns)) {
    const advisories = (v && Array.isArray(v.via) ? v.via : []).filter((a) => a && typeof a === "object");
    if (!advisories.length) continue;
    findings.push({
      package: v.name || name,
      severity: v.severity || null,
      ids: [...new Set(advisories.map(advisoryId).filter(Boolean))],
      ranges: advisories.map((a) => a.range).filter((r) => typeof r === "string"),
      advisories: advisories.map((a) => ({ id: advisoryId(a), range: typeof a.range === "string" ? a.range : null, severity: a.severity || v.severity || null })),
      direct: Boolean(v.isDirect),
      nodes: Array.isArray(v.nodes) ? v.nodes : [],
      fix: v.fixAvailable === true ? "in-range" : v.fixAvailable && typeof v.fixAvailable === "object" ? { name: v.fixAvailable.name, version: v.fixAvailable.version, major: Boolean(v.fixAvailable.isSemVerMajor) } : "none",
      shape: "v2",
    });
  }
  return findings;
}

/** v1 advisories (pnpm audit, Yarn 1 auditAdvisory, Yarn 2+ npm audit lines). */
function v1Findings(data) {
  const a = data && (data.advisory || data);
  if (!a || typeof a !== "object" || !a.module_name) return [];
  const paths = [];
  // "mkdirp>minimist" (Yarn 1) or ". > mkdirp > minimist" (pnpm): the chain from the project down.
  const chain = (p) => String(p).split(">").map((s) => s.trim()).filter((s) => s && s !== ".");
  for (const f of Array.isArray(a.findings) ? a.findings : []) for (const p of f.paths || []) paths.push(chain(p));
  if (data.resolution && data.resolution.path) paths.push(chain(data.resolution.path));
  return [
    {
      package: a.module_name,
      severity: a.severity || null,
      ids: [advisoryId(a)].filter(Boolean),
      ranges: typeof a.vulnerable_versions === "string" ? [a.vulnerable_versions] : [],
      advisories: [{ id: advisoryId(a), range: typeof a.vulnerable_versions === "string" ? a.vulnerable_versions : null, severity: a.severity || null }],
      patched: typeof a.patched_versions === "string" ? a.patched_versions : null,
      direct: paths.some((p) => p.length === 1),
      paths,
      fix: a.patched_versions === "<0.0.0" ? "none" : "unknown",
      shape: "v1",
    },
  ];
}

const SEVERITY_RANK = ["info", "low", "moderate", "high", "critical"];

/** The most severe of a list of severities; null when none is known. */
function worstSeverity(list) {
  return list.filter((sev) => SEVERITY_RANK.includes(sev)).sort((a, b) => SEVERITY_RANK.indexOf(b) - SEVERITY_RANK.indexOf(a))[0] || null;
}

/** Rows, holds and still-open findings from an audit (decisions 06 and 08). Mutates rows and held. */
function applyAudit(findings, { rows, held, stillOpen, entry, root, runtime, lockText }) {
  const byPackage = (list) => new Map(list.map((r) => [r.package, r]));
  const rowOf = byPackage(rows);
  const heldOf = byPackage(held);
  const merged = new Map();
  for (const f of findings) {
    const prev = merged.get(f.package);
    if (!prev) merged.set(f.package, { ...f });
    else {
      prev.ids = [...new Set([...prev.ids, ...f.ids])];
      prev.ranges = [...prev.ranges, ...f.ranges];
      prev.advisories = [...(prev.advisories || []), ...(f.advisories || [])];
      prev.direct = prev.direct || f.direct;
      if (f.paths) prev.paths = [...(prev.paths || []), ...f.paths];
    }
  }
  const lock = entry.manager === "npm" ? parseJson(lockText) : null;
  const viaRows = [];
  for (const f of merged.values()) {
    const security = { severity: f.severity, ids: f.ids };
    const open = (reason) => stillOpen.push({ package: f.package, severity: f.severity, ids: f.ids, reason });
    if (heldOf.has(f.package)) {
      const h = heldOf.get(f.package);
      h.security = security;
      open(h.reason);
      continue;
    }
    if (f.direct || rowOf.has(f.package)) {
      const row = rowOf.get(f.package);
      if (!row) {
        open(f.fix === "none" ? "no fixed version published yet" : "no upgrade on the list pulls it in");
        continue;
      }
      // Each advisory on its own: the ones the target clears badge the row, the ones it does not stay open.
      const advisories = f.advisories && f.advisories.length ? f.advisories : [{ id: null, range: null, severity: f.severity }];
      const still = advisories.filter((a) => a.range && inRange("npm", a.range, row.target) === true);
      const cleared = advisories.filter((a) => !still.includes(a));
      const group = (list) => ({ severity: worstSeverity(list.map((a) => a.severity)) || f.severity, ids: [...new Set(list.map((a) => a.id).filter(Boolean))] });
      if (cleared.length) row.security = group(cleared);
      if (still.length) stillOpen.push({ package: f.package, ...group(still), reason: `${row.target} is still affected` });
      continue;
    }
    if (f.shape === "v1") {
      // pnpm and Yarn audits do not say whether the parent's range takes the fix.
      open(f.fix === "none" ? "no fixed version published yet" : `${entry.manager} does not say whether the parent's range allows the fix`);
      continue;
    }
    if (f.fix === "none") {
      open("no fixed version published yet");
      continue;
    }
    if (typeof f.fix === "object") {
      const parentRow = rowOf.get(f.fix.name);
      if (parentRow && compareVersions("npm", parentRow.target, f.fix.version) !== -1) {
        parentRow.security = parentRow.security || security;
        parentRow.fixes = [...new Set([...(parentRow.fixes || []), f.package])];
      } else open("no upgrade on the list pulls it in");
      continue;
    }
    // Fixable inside its parent's range: its own lockfile-only row, via the parent.
    const viaRow = transitiveRow(f, { entry, root, runtime, lock });
    if (viaRow.row) viaRows.push({ ...viaRow.row, security });
    else open(viaRow.reason);
  }
  return viaRows;
}

/** Where Node resolves `name` from the lockfile node `key`: the nearest node_modules/<name> walking up; null when none. */
function resolveNode(pkgs, key, name) {
  let base = key;
  for (;;) {
    const candidate = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
    if (pkgs[candidate]) return candidate;
    if (!base) return null;
    const cut = base.lastIndexOf("/node_modules/");
    base = cut === -1 ? "" : base.slice(0, cut);
  }
}

/** The lockfile-only row for a transitive finding npm can fix in range, or the reason it cannot be built. */
function transitiveRow(f, { entry, root, runtime, lock }) {
  const pkgs = (lock && lock.packages) || {};
  const node = f.nodes.find((n) => pkgs[n]) || `node_modules/${f.package}`;
  const current = pkgs[node] && pkgs[node].version;
  if (!current) return { reason: "not found in the lockfile" };
  // The immediate parent: the lockfile node that depends on it and resolves to this copy.
  let parent = null;
  for (const [key, v] of Object.entries(pkgs)) {
    const range = v && v.dependencies && v.dependencies[f.package];
    if (typeof range !== "string" || !key) continue;
    if (resolveNode(pkgs, key, f.package) === node) {
      parent = { name: lockKeyName(key), range };
      break;
    }
  }
  if (!parent) return { reason: "no upgrade on the list pulls it in" };
  const cwd = path.join(root, dirOf(entry.lockfile));
  const view = npmView(f.package, parent.range, cwd);
  if (!view.ok) return { reason: view.reason };
  const safe = view.versions
    .filter((v) => compareVersions("npm", v.version, current) === 1 && !f.ranges.some((r) => inRange("npm", r, v.version) === true) && fitsRuntime(v.engines, runtime.floor))
    .sort((a, b) => compareVersions("npm", b.version, a.version));
  if (!safe.length) return { reason: `no fixed version fits ${parent.name}'s range ${parent.range}` };
  const target = safe[0].version;
  return {
    row: {
      id: `${entry.lockfile}#${f.package}`,
      package: f.package,
      current,
      target,
      jump: jumpOf("npm", current, target),
      inRange: true,
      range: null,
      pinned: false,
      via: parent.name,
      lockfileOnly: true,
      security: null,
      newerNotFitting: null,
      repo: null,
      pair: null,
      declaredIn: [],
      type: null,
    },
  };
}

const npmAdapter = {
  id: "npm",
  ecosystem: "npm",
  lockfiles: Object.keys(NPM_LOCKS),

  detect(root) {
    const manifests = walk(root, new Set(["package.json"]));
    const locks = walk(root, new Set(Object.keys(NPM_LOCKS)));
    const entries = [];
    const seenDirs = new Set();
    for (const lockfile of locks) {
      const dir = dirOf(lockfile);
      const manifest = inDir(dir, "package.json");
      if (seenDirs.has(dir) || !manifests.includes(manifest)) continue;
      seenDirs.add(dir);
      const manager = NPM_LOCKS[path.posix.basename(lockfile)];
      const entry = { adapter: "npm", ecosystem: "npm", lockfile, manifest, manager, members: [dir, ...workspaceMembers(root, dir, manifests)] };
      if (manager === "yarn" && /^__metadata:/m.test(readText(path.join(root, lockfile)) || "")) entry.berry = true;
      entries.push(entry);
    }
    return entries;
  },

  unlocked(root, entries) {
    const covered = new Set(entries.flatMap((e) => e.members));
    return walk(root, new Set(["package.json"]))
      .filter((m) => !covered.has(dirOf(m)) && hasDeps(readJsonFile(path.join(root, m))))
      .map((manifest) => ({ manifest, ecosystem: "npm", reason: NO_LOCKFILE }));
  },

  quickCount(entry, root) {
    if (!findTool(entry.manager)) return null;
    const r = npmOutdated(entry, root);
    return r.ok ? new Set(r.list.map((l) => l.package)).size : null;
  },

  scan(entry, { root, audit = true, notes = false } = {}) {
    const result = { rows: [], held: [], notScanned: [], missingTools: [], stillOpen: [], audited: false, lookups: 0, answered: 0 };
    if (!findTool(entry.manager)) {
      result.missingTools.push(entry.manager);
      return result;
    }
    const cwd = path.join(root, dirOf(entry.lockfile));
    const runtime = this.runtime(entry, root);
    result.runtime = { declared: runtime.declared, source: runtime.source, machine: runtime.machine };
    result.lookups++;
    const outdated = npmOutdated(entry, root);
    if (!outdated.ok) {
      result.notScanned.push({ package: "*", reason: outdated.reason });
      if (outdated.unreadable) result.couldNotRead = `${entry.manager} outdated`;
      if (outdated.unreadable || outdated.berry) result.answered++;
      return result;
    }
    result.answered++;
    const holds = npmHolds(root, entry);
    const canView = Boolean(findTool("npm"));
    // One row per package; a package several members declare names each manifest.
    const byName = new Map();
    for (const item of outdated.list) {
      if (!item.package) continue;
      const manifest = inDir(item.member, "package.json");
      const declared = declaredRange(readJsonFile(path.join(root, manifest)), item.package);
      const prev = byName.get(item.package);
      if (prev) {
        if (declared && !prev.declaredIn.some((d) => d.file === manifest)) prev.declaredIn.push({ file: manifest, range: declared.range });
        continue;
      }
      byName.set(item.package, { ...item, declaredIn: declared ? [{ file: manifest, range: declared.range }] : [], type: item.type || (declared && declared.field) || null });
    }
    // Without node_modules (a fresh clone) outdated leaves `current` out: the lockfile still says what is locked.
    let lockedVersion = null;
    if ([...byName.values()].some((item) => !item.current)) {
      const text = readText(path.join(root, entry.lockfile)) || "";
      const lockDir = dirOf(entry.lockfile);
      if (entry.manager === "npm") {
        const versions = npmLockVersions(text);
        lockedVersion = (item) => {
          const member = path.posix.relative(lockDir, item.member || lockDir);
          return versions.get(`node_modules/${item.package}`) || (member ? versions.get(`${member}/node_modules/${item.package}`) : null) || null;
        };
      } else {
        const versions = textLockVersions(entry.manager, text);
        // Several locked versions of one package give no single current version.
        lockedVersion = (item) => {
          const v = versions.get(item.package);
          return v && !v.includes(",") ? v : null;
        };
      }
    }
    for (const item of byName.values()) {
      const name = item.package;
      const id = `${entry.lockfile}#${name}`;
      const current = item.current || (lockedVersion && lockedVersion(item)) || null;
      if (!current && !holds.has(name)) {
        result.notScanned.push({ id, package: name, reason: "not installed and not readable from the lockfile: run the install, then scan again" });
        continue;
      }
      if (holds.has(name)) {
        const h = holds.get(name);
        result.held.push({ id, package: name, current, latest: item.latest, reason: `held by ${h.kind} in ${h.file}`, file: h.file, security: null });
        continue;
      }
      const range = item.declaredIn.length ? item.declaredIn[0].range : null;
      let target = item.latest || item.wanted;
      let newerNotFitting = null;
      let repo = null;
      let couldNotRead = null;
      if (canView && current) {
        result.lookups++;
        const view = npmView(name, `>${current}`, cwd);
        if (!view.ok && !view.unreadable) {
          result.notScanned.push({ id, package: name, reason: view.reason });
          continue;
        }
        result.answered++;
        if (view.unreadable) couldNotRead = "npm view";
        else {
          const capped = view.versions
            .filter((v) => parseVersion("npm", v.version) && compareVersions("npm", v.version, current) === 1)
            .filter((v) => !item.latest || !parseVersion("npm", item.latest) || compareVersions("npm", v.version, item.latest) !== 1)
            .sort((a, b) => compareVersions("npm", b.version, a.version));
          const fitting = capped.find((v) => fitsRuntime(v.engines, runtime.floor));
          if (capped.length && !fitting) {
            result.held.push({ id, package: name, current, latest: item.latest, reason: `every newer version needs Node ${capped[0].engines} (${runtime.declared ? `the project declares ${runtime.declared}` : `this machine runs ${runtime.machine}`})`, file: null, security: null });
            continue;
          }
          if (fitting) {
            target = fitting.version;
            const newer = capped.filter((v) => compareVersions("npm", v.version, target) === 1).map((v) => v.version);
            newerNotFitting = newer.length ? newer : null;
            if (notes) repo = fitting.repo || (capped[0] && capped[0].repo) || null;
          }
        }
      }
      // Only an update: a target at or below current (a prerelease ahead of latest) is no row.
      const order = current && target ? compareVersions("npm", target, current) : 1;
      if (!target || (order !== null && order <= 0)) continue;
      // A package several members declare: pinned when any declaration is a pin, in range only when every one takes the target.
      const pinned = item.declaredIn.some((d) => pinnedRange(d.range));
      const several = item.declaredIn.length > 1;
      // The tool's own in-range answer first: wanted equal to the target.
      const fits = several
        ? !pinned && item.declaredIn.every((d) => inRange("npm", d.range, target) === true)
        : Boolean(item.wanted && item.wanted === target) || (range ? inRange("npm", range, target) === true : false);
      // In range the manifest stays as it is and only the lockfile moves; a pin or an out-of-range target raises the range.
      const raised = range && (pinned || !fits) ? raiseRange("npm", range, target) : null;
      const row = {
        id,
        package: name,
        current,
        target,
        jump: jumpOf("npm", current, target),
        inRange: fits,
        range: !range ? null : raised && raised.rewritten ? { from: raised.from, to: raised.to } : { from: range.trim(), to: fits || (raised && raised.fits) ? range.trim() : null },
        pinned,
        via: null,
        lockfileOnly: false,
        security: null,
        newerNotFitting,
        repo,
        pair: null,
        declaredIn: item.declaredIn,
        type: item.type,
      };
      if (couldNotRead) row.couldNotRead = couldNotRead;
      result.rows.push(row);
    }
    if (audit) {
      const report = npmAudit(entry, root);
      if (report.ok) {
        result.audited = true;
        const lockText = readText(path.join(root, entry.lockfile)) || "";
        const viaRows = applyAudit(report.findings, { rows: result.rows, held: result.held, stillOpen: result.stillOpen, entry, root, runtime, lockText });
        result.rows.push(...viaRows);
      } else {
        // As every other adapter: a failed audit is never a clean result, so no row stays Safe.
        notAudited(result, report.reason);
      }
    }
    // Vulnerability fixes lead the list, then by package name.
    result.rows.sort((a, b) => Number(Boolean(b.security)) - Number(Boolean(a.security)) || a.package.localeCompare(b.package));
    return result;
  },

  applyCommand(batch, entry, root) {
    const cwd = path.join(root, dirOf(entry.lockfile));
    const names = [...new Set(batch.rows.map((r) => r.package))];
    if (entry.manager === "pnpm") {
      // In a workspace, pnpm update moves only the root project without --recursive (as the scan's outdated does).
      const args = ["update", ...batch.rows.map((r) => `${r.package}@${r.target}`), "--lockfile-only", "--no-save"];
      if (entry.members.length > 1) args.push("--recursive");
      return { cmd: "pnpm", args, cwd };
    }
    if (entry.manager === "yarn") return entry.berry ? { cmd: "yarn", args: ["up", "-R", ...names], cwd } : { cmd: "yarn", args: ["upgrade", ...names, "--ignore-scripts"], cwd };
    // The manifest ranges are already raised where a pick needed it, so npm update lands every pick in range.
    return { cmd: "npm", args: ["update", ...names, "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], cwd };
  },

  // A frozen install: it installs what the lockfile says and fails rather than rewrite it, so a
  // verified put-back stays byte for byte and a batch cannot move packages outside apply's diff.
  installCommand(entry, root) {
    const cwd = path.join(root, dirOf(entry.lockfile));
    if (entry.manager === "pnpm") return { cmd: "pnpm", args: ["install", "--frozen-lockfile"], cwd };
    if (entry.manager === "yarn") return { cmd: "yarn", args: ["install", entry.berry ? "--immutable" : "--frozen-lockfile"], cwd };
    return { cmd: "npm", args: ["ci"], cwd };
  },

  runtime(entry, root) {
    const keys = readKeys(path.join(root, entry.manifest));
    const declared = keys && keys.enginesNode ? keys.enginesNode : null;
    const machine = process.version.replace(/^v/, "");
    // A declared range with no lower bound ("*", "<20") floors at 0.0.0, which says nothing: use this machine's.
    const declaredFloor = declared ? floorOf(declared) : null;
    const floor = declaredFloor && declaredFloor !== "0.0.0" ? declaredFloor : machine;
    return { declared, source: declared ? "engines" : "machine", machine, floor };
  },

  lockVersions(entry, text) {
    return entry.manager === "npm" ? npmLockVersions(text) : textLockVersions(entry.manager, text);
  },

  files(entry) {
    return [entry.lockfile, ...entry.members.map((m) => inDir(m, "package.json"))];
  },
};

/* ---------------------------------------------------------- shared by Cargo, pip and uv */

/** Forward slashes, no trailing slash: tool paths compare the same on every OS. */
const slashed = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "");

/** p relative to base when it sits inside it ("." for base itself), ignoring case; null when outside. */
function relInside(base, p) {
  const b = slashed(base);
  const q = slashed(p);
  if (q.toLowerCase() === b.toLowerCase()) return ".";
  return q.toLowerCase().startsWith(`${b.toLowerCase()}/`) ? q.slice(b.length + 1) : null;
}

/** A plugin the person has not installed: named with its install line, never installed (NFR-1). */
const missingPlugin = (tool, step, install) => ({ tool, step, install });

/** A version from `<tool> --version` text ("rustc 1.99.1 (...)", "Python 3.13.17"); null when there is none. */
function toolVersion(cmd, args, cwd) {
  const r = spawnTool(cmd, args, { cwd, timeoutMs: LOOKUP_TIMEOUT_MS });
  const m = `${r.stdout}\n${r.stderr}`.match(/\b(\d+\.\d+(?:\.\d+)?)\b/);
  return r.code === 0 && m ? m[1] : null;
}

/** The runtime a lockfile is judged against: the declared field, else this machine's (decision 07). */
function declaredRuntime(declared, source, machine) {
  const floorText = declared ? String(declared).match(/(\d+(?:\.\d+){0,2})/) : null;
  return { declared: declared || null, source: declared ? source : "machine", machine, floor: floorText ? floorText[1] : machine };
}

/**
 * A row the way the npm adapter builds one, for an ecosystem's declarations:
 * pinned when any declaration pins, in range only when every one takes the
 * target (or the tool said so), and the range raised keeping its operator when
 * a pin or an out-of-range target needs it. A declaration with an empty range
 * takes any version.
 */
function buildRow(ecosystem, { id, name, current, target, declaredIn = [], toolFits = false, type = null }) {
  const range = declaredIn.length ? declaredIn[0].range : null;
  const pinned = declaredIn.some((d) => isPin(ecosystem, d.range));
  const takes = (r) => r.trim() === "" || inRange(ecosystem, r, target) === true;
  const fits = declaredIn.length > 1 ? !pinned && declaredIn.every((d) => takes(d.range)) : (toolFits && !pinned) || (range !== null ? takes(range) : false);
  const raised = range && range.trim() && (pinned || !fits) ? raiseRange(ecosystem, range, target) : null;
  return {
    id,
    package: name,
    current,
    target,
    jump: jumpOf(ecosystem, current, target),
    inRange: fits,
    range: !range || !range.trim() ? null : raised && raised.rewritten ? { from: raised.from, to: raised.to } : { from: range.trim(), to: fits || (raised && raised.fits) ? range.trim() : null },
    pinned,
    via: null,
    lockfileOnly: false,
    security: null,
    newerNotFitting: null,
    repo: null,
    pair: null,
    declaredIn,
    type,
  };
}

/**
 * Badge rows from an audit whose findings say which versions fix them: per
 * package, the advisories the row's target clears badge it, the rest stay open
 * beside it; a held package carries its findings and stays open; a package with
 * no row stays open with the reason. findings: [{ package, id, severity,
 * fixedBy(version) -> bool, fixable }]. key normalizes a package name.
 */
function badgeRows(findings, { rows, held, stillOpen, key = (s) => s }) {
  const rowOf = new Map(rows.map((r) => [key(r.package), r]));
  const heldOf = new Map(held.map((h) => [key(h.package), h]));
  const byPackage = new Map();
  for (const f of findings) {
    const k = key(f.package);
    if (!byPackage.has(k)) byPackage.set(k, []);
    byPackage.get(k).push(f);
  }
  const group = (list) => ({ severity: worstSeverity(list.map((f) => f.severity)), ids: [...new Set(list.map((f) => f.id).filter(Boolean))] });
  for (const [k, list] of byPackage) {
    const name = list[0].package;
    if (heldOf.has(k)) {
      const h = heldOf.get(k);
      h.security = group(list);
      stillOpen.push({ package: name, ...group(list), reason: h.reason });
      continue;
    }
    const row = rowOf.get(k);
    if (!row) {
      stillOpen.push({ package: name, ...group(list), reason: list.some((f) => f.fixable) ? "no upgrade on the list pulls it in" : "no fixed version published yet" });
      continue;
    }
    const cleared = list.filter((f) => f.fixedBy(row.target));
    const still = list.filter((f) => !cleared.includes(f));
    if (cleared.length) row.security = group(cleared);
    if (still.length) stillOpen.push({ package: name, ...group(still), reason: `${row.target} is still affected` });
  }
}

/** Mark every row as not checked for vulnerabilities, with the reason on the lockfile. */
function notAudited(result, reason) {
  for (const row of result.rows) row.notAudited = true;
  result.auditNote = `not checked for vulnerabilities: ${reason}`;
}

/**
 * Rows whose target was not cut by the project's declared runtime (FR-5 is only partly met there):
 * flagged with the declaration so label keeps them out of Safe and says why.
 */
function runtimeNotChecked(result, runtime) {
  if (!runtime || !runtime.declared) return;
  for (const row of result.rows) row.runtimeNotChecked = runtime.declared;
}

/**
 * Lines a tool printed that could not be read flag rows as couldNotRead:
 * the row the line names, or every row when it names none. Returns the count.
 */
function flagUnread(rows, lines, tool) {
  for (const line of lines) {
    const named = rows.filter((r) => new RegExp(`(?<![\\w.-])${escapeRe(r.package)}(?![\\w.-])`, "i").test(line));
    for (const row of named.length ? named : rows) row.couldNotRead = tool;
  }
  return lines.length;
}

/** [[package]] name and version pairs of a Cargo.lock or uv.lock: each name -> its versions, sorted and joined. */
function tomlLockVersions(text) {
  const byName = new Map();
  let name = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    if (/^\s*\[\[package\]\]\s*$/.test(line)) {
      name = null;
      continue;
    }
    if (/^\s*\[/.test(line)) {
      name = undefined;
      continue;
    }
    if (name === undefined) continue;
    const n = tomlString(line, "name");
    if (n) {
      name = n;
      continue;
    }
    const v = tomlString(line, "version");
    if (v && name) {
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name).add(v);
    }
  }
  const map = new Map();
  for (const [n, set] of byName) map.set(n, [...set].sort().join(","));
  return map;
}

/** The newest version of a list (by ecosystem order), skipping ones it cannot read. */
const newestOf = (ecosystem, list) => list.filter((v) => parseVersion(ecosystem, v)).sort((a, b) => compareVersions(ecosystem, b, a))[0] || null;

/* ---------------------------------------------------------- Cargo */

const CARGO_DEP_SECTION = /^(?:target\.(?:"[^"]*"|'[^']*'|[^.]+)\.)?(?:dev-|build-)?dependencies$/;

/**
 * Each dependency a Cargo.toml declares, read line by line: [dependencies]
 * (dev-, build-, target.*), [workspace.dependencies] and [dependencies.<name>]
 * tables. { name, range, kind, workspace } where name is the crate (a
 * `package = "..."` rename followed), range the version requirement (null for
 * git or path dependencies) and workspace true for `workspace = true`.
 */
export function cargoDeclared(text) {
  const deps = [];
  let section = "";
  let table = null;
  const kindOf = (s) => (/build-dependencies$/.test(s) ? "build" : /dev-dependencies$/.test(s) ? "dev" : "normal");
  const isDeps = (s) => CARGO_DEP_SECTION.test(s) || s === "workspace.dependencies";
  for (const line of String(text || "").split(/\r?\n/)) {
    const header = line.match(/^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/);
    if (header) {
      section = header[1];
      table = null;
      const sub = section.match(/^(.*)\.(?:"([^"]+)"|'([^']+)'|([\w-]+))$/);
      if (sub && isDeps(sub[1])) {
        table = { name: sub[2] ?? sub[3] ?? sub[4], range: null, kind: kindOf(sub[1]), workspace: false, section: sub[1] };
        deps.push(table);
      }
      continue;
    }
    if (table) {
      const v = tomlString(line, "version");
      if (v) table.range = v;
      const p = tomlString(line, "package");
      if (p) table.name = p;
      if (/^\s*workspace\s*=\s*true\b/.test(line)) table.workspace = true;
      continue;
    }
    if (!isDeps(section)) continue;
    const m = line.match(/^\s*(?:"([^"]+)"|'([^']+)'|([\w-]+))\s*(\.\s*workspace\s*)?=\s*(.*)$/);
    if (!m) continue;
    const key = m[1] ?? m[2] ?? m[3];
    const value = m[5].trim();
    if (m[4]) {
      deps.push({ name: key, range: null, kind: kindOf(section), workspace: true, section });
      continue;
    }
    const plain = value.match(/^"([^"]*)"|^'([^']*)'/);
    if (plain) {
      deps.push({ name: key, range: plain[1] ?? plain[2], kind: kindOf(section), workspace: false, section });
      continue;
    }
    if (value.startsWith("{")) {
      const ver = value.match(/\bversion\s*=\s*"([^"]*)"/);
      const pkg = value.match(/\bpackage\s*=\s*"([^"]*)"/);
      deps.push({ name: pkg ? pkg[1] : key, range: ver ? ver[1] : null, kind: kindOf(section), workspace: /\bworkspace\s*=\s*true\b/.test(value), section });
    }
  }
  return deps;
}

/** Crates a Cargo.toml's [patch.*] sections replace: `name = ...` lines and [patch.<registry>.<name>] tables. */
export function cargoPatched(text) {
  const names = new Set();
  let inPatch = false;
  for (const line of String(text || "").split(/\r?\n/)) {
    const header = line.match(/^\s*\[\s*([^\]]+?)\s*\]\s*(?:#.*)?$/);
    if (header) {
      const sub = header[1].match(/^patch\.(?:"[^"]+"|'[^']+'|[^."']+)(?:\.(?:"([^"]+)"|([\w-]+)))?$/);
      inPatch = Boolean(sub) && !(sub[1] ?? sub[2]);
      if (sub && (sub[1] ?? sub[2])) names.add(sub[1] ?? sub[2]);
      continue;
    }
    if (!inPatch) continue;
    const m = line.match(/^\s*(?:"([^"]+)"|([\w-]+))\s*=/);
    if (m) names.add(m[1] ?? m[2]);
  }
  return [...names].sort();
}

/** Each crate's declarations across a Cargo lockfile's members: name -> [{ file, range }], workspace = true resolved to the root. */
function cargoDeclarations(root, entry) {
  const rootFile = entry.manifest;
  const rootDeps = cargoDeclared(readText(path.join(root, rootFile)) || "");
  const workspaceRange = new Map(rootDeps.filter((d) => d.section === "workspace.dependencies" && d.range).map((d) => [d.name, d.range]));
  const byName = new Map();
  for (const member of entry.members) {
    const file = inDir(member, "Cargo.toml");
    const list = member === dirOf(entry.lockfile) ? rootDeps : cargoDeclared(readText(path.join(root, file)) || "");
    for (const d of list) {
      if (d.section === "workspace.dependencies") continue;
      const at = d.workspace ? { file: rootFile, range: workspaceRange.get(d.name) ?? null } : { file, range: d.range };
      if (!byName.has(d.name)) byName.set(d.name, { kind: d.kind, declaredIn: [] });
      const seen = byName.get(d.name).declaredIn;
      if (at.range !== null && !seen.some((s) => s.file === at.file)) seen.push(at);
    }
  }
  return byName;
}

/** `cargo outdated --format json` output: one object per crate (several with --workspace, a line each, or one pretty object). */
function cargoOutdatedRows(stdout) {
  const whole = parseJson(stdout);
  const objects = whole && typeof whole === "object" ? (Array.isArray(whole) ? whole : [whole]) : parseJsonLines(stdout);
  const deps = objects.flatMap((o) => (o && Array.isArray(o.dependencies) ? o.dependencies : []));
  if (!objects.length || objects.some((o) => !o || !Array.isArray(o.dependencies))) return null;
  return deps;
}

/**
 * `cargo update --dry-run --verbose` (stderr text, no stability promise):
 * `Updating <crate> vA -> vB`, `Unchanged <crate> vA (available: vB)`, each
 * with an optional `(available: vC[, requires Rust X])`. Known status lines
 * are skipped; any other line is returned in unread.
 */
export function cargoDryRun(text) {
  const moves = new Map();
  const unread = [];
  const avail = /(?:\s+\(available: v(\S+?)(?:, requires Rust ([\d.]+))?\))?$/;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m = line.match(new RegExp(`^Updating ([\\w-]+) v(\\S+) -> v(\\S+?)${avail.source}`));
    if (m) {
      moves.set(m[1], { name: m[1], current: m[2], inRange: m[3], available: m[4] || null, requiresRust: m[5] || null });
      continue;
    }
    m = line.match(new RegExp(`^Unchanged ([\\w-]+) v(\\S+?)${avail.source}`));
    if (m) {
      if (m[3]) moves.set(m[1], { name: m[1], current: m[2], inRange: null, available: m[3], requiresRust: m[4] || null });
      continue;
    }
    if (/^(?:Updating|Locking|Adding|Removing|Downgrading|Upgrading|Unchanged)\s/.test(line) && /\sv\d/.test(line)) {
      // A status word naming a crate version: a move this reader does not know, or a crate line in a new shape.
      if (/^(?:Adding|Removing|Downgrading)\s[\w-]+\sv\S+(?:\s->\sv\S+)?(?:\s+\(.*\))?$/.test(line)) continue;
      if (/^Locking \d+ packages? to /.test(line)) continue;
      unread.push(line);
      continue;
    }
    if (/^Updating (?:crates\.io index|git repository|registry|`)/.test(line) || /^Locking \d+ packages?\b/.test(line)) continue;
    if (/^(?:note|warning|help):/.test(line) || /^(?:Fetching|Downloading|Downloaded|Blocking)\b/.test(line)) continue;
    unread.push(line);
  }
  return { moves: [...moves.values()], unread };
}

const cargoAdapter = {
  id: "cargo",
  ecosystem: "cargo",
  lockfiles: ["Cargo.lock"],

  detect(root) {
    const manifests = walk(root, new Set(["Cargo.toml"]));
    const entries = [];
    for (const lockfile of walk(root, new Set(["Cargo.lock"]))) {
      const dir = dirOf(lockfile);
      const manifest = inDir(dir, "Cargo.toml");
      if (!manifests.includes(manifest)) continue;
      const members = new Set([dir]);
      if (findTool("cargo")) {
        const r = spawnTool("cargo", ["metadata", "--format-version", "1", "--no-deps"], { cwd: path.join(root, dir), timeoutMs: LOOKUP_TIMEOUT_MS });
        const meta = r.code === 0 ? parseJson(r.stdout) : null;
        if (meta && Array.isArray(meta.packages) && Array.isArray(meta.workspace_members)) {
          const ids = new Set(meta.workspace_members);
          for (const pkg of meta.packages) {
            if (!ids.has(pkg.id) || typeof pkg.manifest_path !== "string") continue;
            const rel = relInside(meta.workspace_root || path.join(root, dir), slashed(pkg.manifest_path).replace(/\/[^/]*$/, ""));
            if (rel !== null) members.add(rel === "." ? dir : inDir(dir, rel));
          }
        }
      }
      entries.push({ adapter: "cargo", ecosystem: "cargo", lockfile, manifest, manager: "cargo", members: [dir, ...[...members].filter((m) => m !== dir).sort()] });
    }
    return entries;
  },

  quickCount(entry, root) {
    if (!findTool("cargo-outdated")) return null;
    const r = spawnTool("cargo", cargoOutdatedArgs(entry), { cwd: path.join(root, dirOf(entry.lockfile)) });
    const rows = r.code === 0 ? cargoOutdatedRows(r.stdout) : null;
    return rows ? new Set(rows.filter((d) => parseVersion("cargo", d.latest) || parseVersion("cargo", d.compat)).map((d) => d.name)).size : null;
  },

  scan(entry, { root, audit = true } = {}) {
    const result = { rows: [], held: [], notScanned: [], missingTools: [], stillOpen: [], audited: false, lookups: 0, answered: 0 };
    if (!findTool("cargo")) {
      result.missingTools.push("cargo");
      return result;
    }
    const cwd = path.join(root, dirOf(entry.lockfile));
    const runtime = this.runtime(entry, root);
    result.runtime = { declared: runtime.declared, source: runtime.source, machine: runtime.machine };
    const declared = cargoDeclarations(root, entry);
    const patched = new Set(cargoPatched(readText(path.join(root, entry.manifest)) || ""));
    // Candidates: { name, current, target, toolFits, newer (versions that need a newer Rust) }.
    const candidates = [];
    let unread = [];
    let tool = null;
    result.lookups++;
    if (findTool("cargo-outdated")) {
      tool = "cargo outdated";
      const r = spawnTool("cargo", cargoOutdatedArgs(entry), { cwd });
      const deps = r.code === 0 ? cargoOutdatedRows(r.stdout) : null;
      if (r.code !== 0) {
        result.notScanned.push({ package: "*", reason: r.timedOut ? "cargo outdated did not answer in time" : tail(r.stderr, 1) || "cargo outdated failed" });
        return result;
      }
      result.answered++;
      if (!deps) {
        result.notScanned.push({ package: "*", reason: "could not read cargo outdated output" });
        result.couldNotRead = tool;
        return result;
      }
      // --workspace prints each member's list: a crate several members use is one row (cargoDeclarations names every declaration).
      const seen = new Set();
      for (const d of deps) {
        const target = [d.latest, d.compat].find((v) => parseVersion("cargo", v)) || null;
        if (!d.name || !parseVersion("cargo", d.project)) {
          unread.push(JSON.stringify(d));
          continue;
        }
        if (seen.has(d.name)) continue;
        seen.add(d.name);
        if (target) candidates.push({ name: d.name, current: d.project, target, toolFits: d.compat === target, type: d.kind ? String(d.kind).toLowerCase() : null, newer: null });
      }
    } else {
      // No cargo-outdated: the outdated step falls back to the dry run, named once with its install line.
      result.missingTools.push(missingPlugin("cargo-outdated", "outdated", "cargo install cargo-outdated"));
      tool = "cargo update --dry-run";
      const r = spawnTool("cargo", ["update", "--dry-run", "--verbose"], { cwd });
      if (r.code !== 0) {
        result.notScanned.push({ package: "*", reason: r.timedOut ? "cargo update did not answer in time" : tail(r.stderr, 1) || "cargo update --dry-run failed" });
        return result;
      }
      result.answered++;
      const dry = cargoDryRun(`${r.stderr}\n${r.stdout}`);
      unread = dry.unread;
      for (const move of dry.moves) {
        // Root dependencies only, as cargo outdated --root-deps-only lists them.
        if (!declared.has(move.name)) continue;
        const tooNew = move.requiresRust && compareVersions("cargo", `${move.requiresRust}${move.requiresRust.split(".").length < 3 ? ".0".repeat(3 - move.requiresRust.split(".").length) : ""}`, normalRust(runtime.floor)) === 1;
        const target = (!tooNew && move.available) || move.inRange;
        if (!target) {
          result.held.push({ id: `${entry.lockfile}#${move.name}`, package: move.name, current: move.current, latest: move.available, reason: `every newer version needs Rust ${move.requiresRust} (${runtime.declared ? `the project declares ${runtime.declared}` : `this machine runs ${runtime.machine}`})`, file: null, security: null });
          continue;
        }
        candidates.push({ name: move.name, current: move.current, target, toolFits: target === move.inRange, type: null, newer: tooNew ? [move.available] : null });
      }
    }
    for (const c of candidates) {
      const id = `${entry.lockfile}#${c.name}`;
      if (compareVersions("cargo", c.target, c.current) !== 1) continue;
      if (patched.has(c.name)) {
        result.held.push({ id, package: c.name, current: c.current, latest: c.target, reason: `held by [patch] in ${entry.manifest}`, file: entry.manifest, security: null });
        continue;
      }
      const d = declared.get(c.name);
      const row = buildRow("cargo", { id, name: c.name, current: c.current, target: c.target, declaredIn: d ? d.declaredIn : [], toolFits: c.toolFits, type: c.type || (d && d.kind) || null });
      row.newerNotFitting = c.newer;
      result.rows.push(row);
    }
    if (unread.length) flagUnread(result.rows, unread, tool);
    if (tool === "cargo outdated") runtimeNotChecked(result, runtime);
    if (audit) {
      if (findTool("cargo-audit")) {
        const r = spawnTool("cargo", ["audit", "--json"], { cwd });
        const json = parseJson(r.stdout);
        // cargo audit exits 1 when it finds something: read the JSON, never the exit code alone.
        const list = json && json.vulnerabilities && Array.isArray(json.vulnerabilities.list) ? json.vulnerabilities.list : null;
        if ((r.code === 0 || r.code === 1) && list) {
          result.audited = true;
          const findings = list
            .filter((v) => v && v.package && v.package.name)
            .map((v) => {
              const versions = v.versions || {};
              const reqs = [...(Array.isArray(versions.patched) ? versions.patched : []), ...(Array.isArray(versions.unaffected) ? versions.unaffected : [])];
              const a = v.advisory || {};
              return {
                package: v.package.name,
                id: a.id || null,
                severity: typeof a.severity === "string" ? a.severity.toLowerCase() : null,
                fixable: Array.isArray(versions.patched) && versions.patched.length > 0,
                fixedBy: (target) => reqs.some((req) => inRange("cargo", req, target) === true),
              };
            });
          badgeRows(findings, result);
        } else {
          notAudited(result, r.timedOut ? "cargo audit did not answer in time" : list === null && r.code !== null && (r.code === 0 || r.code === 1) ? "could not read cargo audit output" : tail(r.stderr, 1) || "cargo audit failed");
        }
      } else {
        result.missingTools.push(missingPlugin("cargo-audit", "audit", "cargo install cargo-audit"));
        notAudited(result, "cargo-audit is not installed");
      }
    }
    result.rows.sort((a, b) => Number(Boolean(b.security)) - Number(Boolean(a.security)) || a.package.localeCompare(b.package));
    return result;
  },

  // --precise takes one package, so each pick is its own command. Out-of-range picks already had their
  // range raised in Cargo.toml by apply, so the same command lands them. The spec names the locked
  // version (name@current): a bare name is ambiguous when the lockfile holds two versions (syn 1 and 2).
  applyCommand(batch, entry, root) {
    const cwd = path.join(root, dirOf(entry.lockfile));
    return batch.rows.map((r) => ({ cmd: "cargo", args: ["update", "-p", r.current ? `${r.package}@${r.current}` : r.package, "--precise", r.target], cwd }));
  },

  // --locked: fetch what Cargo.lock says and fail rather than rewrite it.
  installCommand(entry, root) {
    return { cmd: "cargo", args: ["fetch", "--locked"], cwd: path.join(root, dirOf(entry.lockfile)) };
  },

  runtime(entry, root) {
    const keys = readKeys(path.join(root, entry.manifest));
    const declared = keys && keys.rustVersion ? keys.rustVersion : null;
    const machine = declared ? null : toolVersion("rustc", ["--version"], path.join(root, dirOf(entry.lockfile)));
    return declaredRuntime(declared, "rust-version", machine);
  },

  lockVersions(entry, text) {
    return tomlLockVersions(text);
  },

  files(entry) {
    return [entry.lockfile, ...entry.members.map((m) => inDir(m, "Cargo.toml"))];
  },
};

function cargoOutdatedArgs(entry) {
  const args = ["outdated", "--format", "json", "--root-deps-only"];
  if (entry.members.length > 1) args.push("--workspace");
  return args;
}

/** A Rust version as three parts ("1.75" -> "1.75.0"), for comparing; null stays null. */
function normalRust(v) {
  if (!v) return null;
  const parts = String(v).split(".");
  while (parts.length < 3) parts.push("0");
  return parts.slice(0, 3).join(".");
}

/* ---------------------------------------------------------- pip */

/** PEP 503 name: lower case, runs of - _ . as one -. */
const pyName = (s) => String(s).toLowerCase().replace(/[-_.]+/g, "-");

const REQUIREMENTS = /^requirements.*\.txt$/i;
const CONSTRAINTS = /^constraints.*\.txt$/i;

/**
 * The requirement lines of a requirements or constraints file: { name, spec,
 * line }, spec the version part with any marker or extras dropped; plus the
 * files its -c / --constraint lines name. Options, URLs and editables are skipped.
 */
export function requirementLines(text) {
  const reqs = [];
  const constraints = [];
  // A line ending in \ continues on the next (pip-compile --generate-hashes writes one --hash per line).
  const logical = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const prev = logical[logical.length - 1];
      if (prev && prev.open) {
        prev.text += ` ${raw}`;
        prev.open = /\\\s*$/.test(raw);
        if (!prev.open) prev.text = prev.text.replace(/\\\s*$/, "");
      } else logical.push({ text: raw, line: i + 1, open: /\\\s*$/.test(raw) });
    });
  for (const { text: joined, line: at } of logical) {
    const line = joined.replace(/\\(\s|$)/g, " ").replace(/(^|\s)#.*$/, "").trim();
    if (!line) continue;
    const c = line.match(/^(?:-c|--constraint)(?:\s+|=)(\S+)$/);
    if (c) {
      constraints.push(c[1]);
      continue;
    }
    if (line.startsWith("-")) continue;
    // Per-requirement options (--hash=..., --config-settings ...) follow the specifier.
    const hashed = /\s--hash[=\s]/.test(` ${line}`);
    const bare = line.replace(/\s+--[\w-]+(?:[=\s]+(?!--)\S+)?/g, "").trim();
    const m = bare.match(/^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\s*(?:\[[^\]]*\])?\s*([^;@]*?)\s*(?:;.*)?$/);
    if (m) reqs.push({ name: m[1], spec: m[2].trim(), line: at, ...(hashed ? { hashed: true } : {}) });
  }
  return { reqs, constraints };
}

/** Names `pip freeze` lists (name==version, name @ url). */
function freezeNames(text) {
  const names = new Map();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const m = raw.trim().match(/^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\s*(?:\[[^\]]*\])?\s*(?:===?|@)/);
    if (m) names.set(pyName(m[1]), m[1]);
  }
  return names;
}

/**
 * A requirements file pins every requirement with == (a lockfile), pins them
 * with hashes (hashed: editing a pin would fail pip's hash check, so list only),
 * or has requirements that are loose.
 */
function requirementsKind(text) {
  const { reqs } = requirementLines(text);
  if (!reqs.length) return "empty";
  if (!reqs.every((r) => isPin("python", r.spec))) return "loose";
  return reqs.some((r) => r.hashed) ? "hashed" : "pinned";
}

const HASHED = "pinned with hashes: regenerate the file to update it";

/** The machine's Python, or the declared requires-python of the folder's pyproject.toml. */
function pythonRuntime(root, dir) {
  const keys = readKeys(path.join(root, dir, "pyproject.toml"));
  const declared = keys && keys.requiresPython ? keys.requiresPython : null;
  const machine = declared ? null : toolVersion("python", ["--version"], path.join(root, dir));
  return declaredRuntime(declared, "requires-python", machine);
}

/**
 * pip-audit -f json and uv audit JSON both list fix_versions, one per release
 * line (1.26.19 and 2.2.2): a target is fixed by the fix on its own major line
 * when there is one (2.0.0 is not fixed by 1.26.19), else when it is at or
 * above the newest fix.
 */
const fixedByVersions = (versions) => (target) => {
  const t = parseVersion("python", target);
  const fixes = versions.filter((v) => parseVersion("python", v));
  if (!t || !fixes.length) return false;
  const line = fixes.filter((v) => parseVersion("python", v).release[0] === t.release[0]);
  const bar = line.length ? line.sort((a, b) => compareVersions("python", a, b))[0] : newestOf("python", fixes);
  return compareVersions("python", target, bar) >= 0;
};

const pipAdapter = {
  id: "pip",
  ecosystem: "python",
  lockfiles: ["requirements*.txt"],

  detect(root) {
    const entries = [];
    for (const lockfile of walk(root, (n) => REQUIREMENTS.test(n))) {
      const text = readText(path.join(root, lockfile)) || "";
      if (requirementsKind(text) !== "pinned") continue;
      const dir = dirOf(lockfile);
      const named = requirementLines(text).constraints.map((c) => posix(path.posix.normalize(inDir(dir, c.replace(/\\/g, "/")))));
      let beside = [];
      try {
        beside = fs
          .readdirSync(path.join(root, dir), { withFileTypes: true })
          .filter((e) => e.isFile() && CONSTRAINTS.test(e.name))
          .map((e) => inDir(dir, e.name));
      } catch {}
      entries.push({ adapter: "pip", ecosystem: "python", lockfile, manifest: lockfile, manager: "pip", members: [dir], constraints: [...new Set([...named, ...beside])].sort() });
    }
    return entries;
  },

  // A requirements file whose ranges nothing pins: updating one package would re-resolve the rest (decision 12).
  // One pinned with hashes is list only too, for its own reason.
  unlocked(root) {
    const reasons = { loose: NO_LOCKFILE, hashed: HASHED };
    return walk(root, (n) => REQUIREMENTS.test(n))
      .map((manifest) => ({ manifest, kind: requirementsKind(readText(path.join(root, manifest)) || "") }))
      .filter((f) => reasons[f.kind])
      .map((f) => ({ manifest: f.manifest, ecosystem: "python", reason: reasons[f.kind] }));
  },

  quickCount(entry, root) {
    const r = spawnTool("pip", ["list", "--outdated", "--format", "json"], { cwd: path.join(root, dirOf(entry.lockfile)) });
    const list = r.code === 0 ? parseJson(r.stdout) : null;
    if (!Array.isArray(list)) return null;
    const declared = new Set(requirementLines(readText(path.join(root, entry.lockfile)) || "").reqs.map((q) => pyName(q.name)));
    return new Set(list.filter((p) => p && declared.has(pyName(p.name))).map((p) => pyName(p.name))).size;
  },

  scan(entry, { root, audit = true } = {}) {
    const result = { rows: [], held: [], notScanned: [], missingTools: [], stillOpen: [], audited: false, lookups: 0, answered: 0 };
    if (!findTool("pip")) {
      result.missingTools.push("pip");
      return result;
    }
    const cwd = path.join(root, dirOf(entry.lockfile));
    const runtime = this.runtime(entry, root);
    result.runtime = { declared: runtime.declared, source: runtime.source, machine: runtime.machine };
    const { reqs } = requirementLines(readText(path.join(root, entry.lockfile)) || "");
    const declared = new Map(reqs.map((q) => [pyName(q.name), q]));
    const holds = new Map();
    for (const file of entry.constraints || []) {
      for (const q of requirementLines(readText(path.join(root, file)) || "").reqs) if (!holds.has(pyName(q.name))) holds.set(pyName(q.name), file);
    }
    result.lookups++;
    const r = spawnTool("pip", ["list", "--outdated", "--format", "json"], { cwd });
    if (r.code !== 0) {
      result.notScanned.push({ package: "*", reason: r.timedOut ? "pip did not answer in time" : tail(r.stderr, 1) || "pip list failed" });
      return result;
    }
    result.answered++;
    const list = parseJson(r.stdout);
    if (!Array.isArray(list)) {
      result.notScanned.push({ package: "*", reason: "could not read pip list output" });
      result.couldNotRead = "pip list";
      return result;
    }
    const unread = [];
    for (const item of list) {
      if (!item || typeof item.name !== "string") {
        unread.push(JSON.stringify(item));
        continue;
      }
      const q = declared.get(pyName(item.name));
      // pip lists the whole environment: only the packages this file pins are its rows.
      if (!q) continue;
      const pin = q.spec.replace(/^===?\s*/, "");
      const current = parseVersion("python", pin) ? pin : item.version;
      const target = item.latest_version;
      if (!parseVersion("python", target) || !parseVersion("python", current)) {
        unread.push(JSON.stringify(item));
        continue;
      }
      if (compareVersions("python", target, current) !== 1) continue;
      const id = `${entry.lockfile}#${q.name}`;
      if (holds.has(pyName(q.name))) {
        result.held.push({ id, package: q.name, current, latest: target, reason: `held by constraints in ${holds.get(pyName(q.name))}`, file: holds.get(pyName(q.name)), security: null });
        continue;
      }
      result.rows.push(buildRow("python", { id, name: q.name, current, target, declaredIn: [{ file: entry.lockfile, range: q.spec }] }));
    }
    if (unread.length) flagUnread(result.rows, unread, "pip list");
    if (audit) {
      if (findTool("pip-audit")) {
        // --format, the long form of -f: spawnTool refuses a bare -f as a force flag.
        const a = spawnTool("pip-audit", ["--format", "json"], { cwd });
        const json = parseJson(a.stdout);
        // pip-audit exits 1 when it finds something; older versions print a bare list.
        const deps = Array.isArray(json) ? json : json && Array.isArray(json.dependencies) ? json.dependencies : null;
        if ((a.code === 0 || a.code === 1) && deps) {
          result.audited = true;
          const findings = [];
          for (const d of deps) {
            if (!d || typeof d.name !== "string" || !declared.has(pyName(d.name))) continue;
            for (const v of Array.isArray(d.vulns) ? d.vulns : []) {
              const fixes = Array.isArray(v.fix_versions) ? v.fix_versions : [];
              findings.push({ package: declared.get(pyName(d.name)).name, id: v.id || null, severity: null, fixable: fixes.length > 0, fixedBy: fixedByVersions(fixes) });
            }
          }
          badgeRows(findings, { ...result, key: pyName });
        } else {
          notAudited(result, a.timedOut ? "pip-audit did not answer in time" : deps === null && (a.code === 0 || a.code === 1) ? "could not read pip-audit output" : tail(a.stderr, 1) || "pip-audit failed");
        }
      } else {
        result.missingTools.push(missingPlugin("pip-audit", "audit", "pip install pip-audit"));
        notAudited(result, "pip-audit is not installed");
      }
    }
    runtimeNotChecked(result, runtime);
    result.rows.sort((a, b) => Number(Boolean(b.security)) - Number(Boolean(a.security)) || a.package.localeCompare(b.package));
    return result;
  },

  // apply has already moved each pick's == pin with editVersion; pip installs the file as it now reads.
  applyCommand(batch, entry, root) {
    return { cmd: "pip", args: ["install", "-r", path.posix.basename(entry.lockfile)], cwd: path.join(root, dirOf(entry.lockfile)) };
  },

  installCommand(entry, root) {
    return { cmd: "pip", args: ["install", "-r", path.posix.basename(entry.lockfile)], cwd: path.join(root, dirOf(entry.lockfile)) };
  },

  // pip records nothing in a file, so the environment itself is snapshotted before the batch (decision 12).
  snapshot(entry, store, root) {
    const r = spawnTool("pip", ["freeze"], { cwd: path.join(root, dirOf(entry.lockfile)) });
    if (r.code !== 0) return { ok: false, file: null, reason: r.timedOut ? "pip freeze did not answer in time" : tail(r.stderr, 1) || "pip freeze failed" };
    fs.writeFileSync(path.join(store, "pip-freeze.txt"), r.stdout);
    return { ok: true, file: "pip-freeze.txt", packages: freezeNames(r.stdout).size };
  },

  // Reinstall the snapshot's exact versions, then uninstall what the batch added, so pip freeze matches it again.
  restoreExtra(entry, store, root) {
    const cwd = path.join(root, dirOf(entry.lockfile));
    const file = path.join(store, "pip-freeze.txt");
    if (!fs.existsSync(file)) return { ok: false, reason: "no pip freeze snapshot for this batch", uninstalled: [] };
    const snap = freezeNames(fs.readFileSync(file, "utf8"));
    const install = spawnTool("pip", ["install", "-r", file], { cwd });
    if (install.code !== 0) return { ok: false, reason: install.timedOut ? "pip install did not answer in time" : tail(install.stderr, 1) || "pip install -r pip-freeze.txt failed", uninstalled: [], command: `pip install -r ${posix(file)}` };
    const now = spawnTool("pip", ["freeze"], { cwd });
    if (now.code !== 0) return { ok: false, reason: tail(now.stderr, 1) || "pip freeze failed", uninstalled: [], command: "pip freeze" };
    const added = [...freezeNames(now.stdout)].filter(([k]) => !snap.has(k)).map(([, name]) => name);
    if (added.length) {
      const un = spawnTool("pip", ["uninstall", "-y", ...added], { cwd });
      if (un.code !== 0) return { ok: false, reason: tail(un.stderr, 1) || "pip uninstall failed", uninstalled: [], added, command: `pip uninstall -y ${added.join(" ")}` };
    }
    return { ok: true, uninstalled: added };
  },

  runtime(entry, root) {
    return pythonRuntime(root, dirOf(entry.lockfile));
  },

  lockVersions(entry, text) {
    const map = new Map();
    for (const q of requirementLines(text).reqs) if (isPin("python", q.spec)) map.set(q.name, q.spec.replace(/^===?\s*/, ""));
    return map;
  },

  files(entry) {
    return [entry.lockfile];
  },
};

/* ---------------------------------------------------------- uv */

/**
 * The requirement strings a pyproject.toml declares, read line by line:
 * [project] dependencies, [project.optional-dependencies] and
 * [dependency-groups] arrays, one string or several per line. { name, spec, group }.
 */
export function pyprojectDeps(text) {
  const deps = [];
  let section = "";
  let open = null;
  const take = (chunk, group) => {
    for (const m of chunk.matchAll(/"([^"]*)"|'([^']*)'/g)) {
      const parsed = requirementLines(m[1] ?? m[2]).reqs[0];
      if (parsed) deps.push({ name: parsed.name, spec: parsed.spec, group });
    }
  };
  // The array's closing ], looked for outside the quoted strings ("uvicorn[standard]>=0.30" has one inside).
  const closeAt = (chunk) => {
    const m = chunk.match(/^(?:"[^"]*"|'[^']*'|[^"'\]])*\]/);
    return m ? m[0].length - 1 : -1;
  };
  for (const line of String(text || "").split(/\r?\n/)) {
    const header = line.match(/^\s*\[\s*([^\]]+?)\s*\]\s*(?:#.*)?$/);
    if (header && open === null) {
      section = header[1];
      continue;
    }
    if (open !== null) {
      const end = closeAt(line);
      take(end === -1 ? line : line.slice(0, end), open);
      if (end !== -1) open = null;
      continue;
    }
    const key = line.match(/^\s*([\w.-]+)\s*=\s*\[(.*)$/);
    if (!key) continue;
    const group = section === "project" && key[1] === "dependencies" ? "project" : section === "project.optional-dependencies" || section === "dependency-groups" ? key[1] : null;
    if (!group) continue;
    const rest = key[2];
    const end = closeAt(rest);
    take(end === -1 ? rest : rest.slice(0, end), group);
    if (end === -1) open = group;
  }
  return deps;
}

/**
 * `uv tree --outdated --depth 1` (text only): the first line is the project,
 * then `├── name vX (latest: vY)` per direct dependency, with optional
 * (extra: ...) / (group: ...) notes and a (*) mark. Lines it cannot read are
 * returned in unread.
 */
export function uvTreeOutdated(text) {
  const rows = [];
  const unread = [];
  const lines = String(text || "").split(/\r?\n/);
  let first = true;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const line = raw.replace(/^[\s│├└─|`\\+-]+/, "").trim();
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])? v(\S+)((?:\s+\([^)]*\))*)(?:\s+\(\*\))?$/);
    if (first) {
      first = false;
      if (m && raw === raw.trimStart()) continue;
    }
    if (!m) {
      unread.push(raw.trim());
      continue;
    }
    const latest = m[3].match(/\(latest: v(\S+?)\)/);
    if (latest) rows.push({ name: m[1], current: m[2], latest: latest[1] });
  }
  return { rows, unread };
}

// --frozen: uv's project commands lock first by default, so without it a scan could rewrite uv.lock before any backup.
const UV_TREE = ["tree", "--outdated", "--depth", "1", "--frozen"];

const uvAdapter = {
  id: "uv",
  ecosystem: "python",
  lockfiles: ["uv.lock"],

  detect(root) {
    const manifests = walk(root, new Set(["pyproject.toml"]));
    return walk(root, new Set(["uv.lock"]))
      .filter((lockfile) => manifests.includes(inDir(dirOf(lockfile), "pyproject.toml")))
      .map((lockfile) => ({ adapter: "uv", ecosystem: "python", lockfile, manifest: inDir(dirOf(lockfile), "pyproject.toml"), manager: "uv", members: [dirOf(lockfile)] }));
  },

  quickCount(entry, root) {
    const r = spawnTool("uv", UV_TREE, { cwd: path.join(root, dirOf(entry.lockfile)) });
    return r.code === 0 ? uvTreeOutdated(r.stdout).rows.length : null;
  },

  scan(entry, { root, audit = true } = {}) {
    const result = { rows: [], held: [], notScanned: [], missingTools: [], stillOpen: [], audited: false, lookups: 0, answered: 0 };
    if (!findTool("uv")) {
      result.missingTools.push("uv");
      return result;
    }
    const cwd = path.join(root, dirOf(entry.lockfile));
    const runtime = this.runtime(entry, root);
    result.runtime = { declared: runtime.declared, source: runtime.source, machine: runtime.machine };
    const declared = new Map();
    for (const member of entry.members) {
      const file = inDir(member, "pyproject.toml");
      for (const d of pyprojectDeps(readText(path.join(root, file)) || "")) {
        const k = pyName(d.name);
        if (!declared.has(k)) declared.set(k, []);
        // name: the spelling the file uses (PyYAML), for apply's one-literal edit; the row keeps uv's normalized name, as uv.lock does.
        if (!declared.get(k).some((x) => x.file === file)) declared.get(k).push({ file, range: d.spec, name: d.name });
      }
    }
    result.lookups++;
    const r = spawnTool("uv", UV_TREE, { cwd });
    if (r.code !== 0) {
      result.notScanned.push({ package: "*", reason: r.timedOut ? "uv did not answer in time" : tail(r.stderr, 1) || "uv tree failed" });
      return result;
    }
    result.answered++;
    const tree = uvTreeOutdated(r.stdout);
    for (const t of tree.rows) {
      if (compareVersions("python", t.latest, t.current) !== 1) continue;
      const id = `${entry.lockfile}#${t.name}`;
      result.rows.push(buildRow("python", { id, name: t.name, current: t.current, target: t.latest, declaredIn: declared.get(pyName(t.name)) || [] }));
    }
    if (tree.unread.length) flagUnread(result.rows, tree.unread, "uv tree");
    runtimeNotChecked(result, runtime);
    if (audit) this.audit(result, cwd);
    result.rows.sort((a, b) => Number(Boolean(b.security)) - Number(Boolean(a.security)) || a.package.localeCompare(b.package));
    return result;
  },

  // uv audit is experimental: a uv without it, or JSON in a shape this does not know, leaves the rows
  // not checked for vulnerabilities (couldNotRead on the audit only, never on the rows' versions).
  audit(result, cwd) {
    const r = spawnTool("uv", ["audit", "--output-format", "json", "--frozen"], { cwd });
    if (r.code === 2 && /unrecognized subcommand|unexpected argument/i.test(r.stderr)) {
      notAudited(result, "this uv has no audit command");
      return;
    }
    if (r.code !== 0 && r.code !== 1) {
      notAudited(result, r.timedOut ? "uv audit did not answer in time" : tail(r.stderr, 1) || "uv audit failed");
      return;
    }
    const json = parseJson(r.stdout);
    const list = json && typeof json === "object" && Array.isArray(json.vulnerabilities) ? json.vulnerabilities : null;
    const known = list && list.every((v) => v && v.dependency && typeof v.dependency.name === "string" && Array.isArray(v.fix_versions));
    if (!known) {
      result.auditCouldNotRead = "uv audit";
      notAudited(result, "could not read uv audit output");
      return;
    }
    result.audited = true;
    badgeRows(
      list.map((v) => ({ package: v.dependency.name, id: v.display_id || v.id || null, severity: null, fixable: v.fix_versions.length > 0, fixedBy: fixedByVersions(v.fix_versions) })),
      { ...result, key: pyName },
    );
  },

  applyCommand(batch, entry, root) {
    return { cmd: "uv", args: ["lock", ...batch.rows.flatMap((r) => ["--upgrade-package", `${r.package}==${r.target}`])], cwd: path.join(root, dirOf(entry.lockfile)) };
  },

  installCommand(entry, root) {
    return { cmd: "uv", args: ["sync", "--frozen"], cwd: path.join(root, dirOf(entry.lockfile)) };
  },

  runtime(entry, root) {
    return pythonRuntime(root, dirOf(entry.lockfile));
  },

  lockVersions(entry, text) {
    return tomlLockVersions(text);
  },

  files(entry) {
    return [entry.lockfile, ...entry.members.map((m) => inDir(m, "pyproject.toml"))];
  },
};

/* ---------------------------------------------------------- Go */

/** A go directive or toolchain version ("1.22", "1.26.0", "go1.27.3") as three parts for comparing; null when it is not one. */
function goLang(v) {
  const m = String(v || "").match(/^(?:go)?(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? `${m[1]}.${m[2]}.${m[3] || 0}` : null;
}

/** Module zip lines of a go.sum (not the /go.mod hash lines): each module -> its versions, sorted and joined. */
function goSumVersions(text) {
  const byName = new Map();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const m = raw.trim().match(/^(\S+)\s+(v[^\s/]+)\s+h1:/);
    if (!m) continue;
    if (!byName.has(m[1])) byName.set(m[1], new Set());
    byName.get(m[1]).add(m[2]);
  }
  const map = new Map();
  for (const [n, set] of byName) map.set(n, [...set].sort().join(","));
  return map;
}

/** The language version the go command assumes for a go.mod with no go directive. */
const GO_DEFAULT_DIRECTIVE = "1.16";

/** The go directive of a go.mod file on disk; null when it has none. */
const goDirective = (file) => {
  const keys = readKeys(file);
  return keys && keys.go ? keys.go : null;
};

const goAdapter = {
  id: "go",
  ecosystem: "go",
  lockfiles: ["go.sum"],

  detect(root) {
    const sums = walk(root, new Set(["go.sum"]));
    return walk(root, new Set(["go.mod"]))
      .filter((manifest) => sums.includes(inDir(dirOf(manifest), "go.sum")))
      .map((manifest) => ({ adapter: "go", ecosystem: "go", lockfile: inDir(dirOf(manifest), "go.sum"), manifest, manager: "go", members: [dirOf(manifest)] }));
  },

  quickCount(entry, root) {
    const r = spawnTool("go", ["list", "-m", "-u", "-json", "all"], { cwd: path.join(root, dirOf(entry.lockfile)) });
    return r.code === 0 ? goDirect(parseJsonStream(r.stdout)).filter((m) => m.Update).length : null;
  },

  scan(entry, { root, audit = true } = {}) {
    const result = { rows: [], held: [], notScanned: [], missingTools: [], stillOpen: [], audited: false, lookups: 0, answered: 0 };
    if (!findTool("go")) {
      result.missingTools.push("go");
      return result;
    }
    const cwd = path.join(root, dirOf(entry.lockfile));
    const runtime = this.runtime(entry, root);
    result.runtime = { declared: runtime.declared, source: runtime.source, machine: runtime.machine };
    result.lookups++;
    // go list exits 1 when go.sum lacks an entry; the person fills it with go mod download, never this script.
    const r = spawnTool("go", ["list", "-m", "-u", "-json", "all"], { cwd });
    if (r.code !== 0) {
      result.notScanned.push({ package: "*", reason: r.timedOut ? "go list did not answer in time" : tail(r.stderr, 1) || "go list failed" });
      return result;
    }
    result.answered++;
    const modules = parseJsonStream(r.stdout);
    if (!modules.length) {
      result.notScanned.push({ package: "*", reason: "could not read go list output" });
      result.couldNotRead = "go list";
      return result;
    }
    const unread = [];
    for (const m of goDirect(modules)) {
      if (!m.Update) continue;
      const current = m.Version;
      const target = m.Update.Version;
      if (!parseVersion("go", current) || !parseVersion("go", target)) {
        unread.push(JSON.stringify({ Path: m.Path, Version: current, Update: m.Update }));
        continue;
      }
      if (compareVersions("go", target, current) !== 1) continue;
      // go.mod holds minimum versions: any newer version satisfies it, and go get rewrites the require line itself.
      const row = buildRow("go", { id: `${entry.lockfile}#${m.Path}`, name: m.Path, current, target, declaredIn: [{ file: entry.manifest, range: current }], toolFits: true });
      Object.assign(row, { inRange: true, lockfileOnly: true, range: { from: current, to: target } });
      result.rows.push(row);
    }
    if (unread.length) flagUnread(result.rows, unread, "go list");
    if (audit) {
      if (findTool("govulncheck")) this.audit(result, cwd);
      else {
        result.missingTools.push(missingPlugin("govulncheck", "audit", "go install golang.org/x/vuln/cmd/govulncheck@latest"));
        notAudited(result, "govulncheck is not installed");
      }
    }
    result.rows.sort((a, b) => Number(Boolean(b.security)) - Number(Boolean(a.security)) || a.package.localeCompare(b.package));
    return result;
  },

  // govulncheck -json exits 0 whether or not it finds anything: read the stream (unordered, a finding may repeat).
  audit(result, cwd) {
    const r = spawnTool("govulncheck", ["-json", "./..."], { cwd });
    if (r.code !== 0) {
      notAudited(result, r.timedOut ? "govulncheck did not answer in time" : tail(r.stderr, 1) || "govulncheck failed");
      return;
    }
    const messages = parseJsonStream(r.stdout);
    if (!messages.some((m) => m.config)) {
      notAudited(result, "could not read govulncheck output");
      return;
    }
    result.audited = true;
    const findings = [];
    for (const { finding: f } of messages) {
      const frame = f && Array.isArray(f.trace) ? f.trace[0] : null;
      if (!frame || typeof frame.module !== "string" || typeof f.osv !== "string") continue;
      const fixed = typeof f.fixed_version === "string" && parseVersion("go", f.fixed_version) ? f.fixed_version : null;
      findings.push({ package: frame.module, id: f.osv, severity: null, fixable: Boolean(fixed), fixedBy: (target) => Boolean(fixed) && compareVersions("go", target, fixed) >= 0 });
    }
    badgeRows(findings, result);
  },

  // One go get for every pick, then tidy so go.sum holds only what the build needs.
  applyCommand(batch, entry, root) {
    const cwd = path.join(root, dirOf(entry.lockfile));
    return [
      { cmd: "go", args: ["get", ...batch.rows.map((r) => `${r.package}@${r.target}`)], cwd },
      { cmd: "go", args: ["mod", "tidy"], cwd },
    ];
  },

  installCommand(entry, root) {
    return { cmd: "go", args: ["mod", "download"], cwd: path.join(root, dirOf(entry.lockfile)) };
  },

  // The tool never raises a runtime floor (decision 07): a go get that rewrote the go directive needs a newer Go.
  afterApply(entry, root, store, moved) {
    const backedUp = path.join(store, "files", entry.manifest);
    if (!fs.existsSync(backedUp)) return { needsNewerRuntime: [] };
    // A go.mod with no go directive means go 1.16 to the go command (go.dev/ref/mod), so a directive written into it raises the floor too.
    const from = goDirective(backedUp);
    const to = goDirective(path.join(root, entry.manifest));
    const before = goLang(from || GO_DEFAULT_DIRECTIVE);
    const after = goLang(to);
    if (!before || !after || compareVersions("go", after, before) !== 1) return { needsNewerRuntime: [] };
    return { needsNewerRuntime: moved.map((r) => ({ id: r.id, package: r.package, file: entry.manifest, from, to })) };
  },

  runtime(entry, root) {
    const declared = goDirective(path.join(root, entry.manifest));
    let machine = null;
    if (!declared) {
      const r = spawnTool("go", ["version"], { cwd: path.join(root, dirOf(entry.lockfile)), timeoutMs: LOOKUP_TIMEOUT_MS });
      const m = r.code === 0 ? r.stdout.match(/\bgo(\d+\.\d+(?:\.\d+)?)\b/) : null;
      machine = m ? m[1] : null;
    }
    return declaredRuntime(declared, "go", machine);
  },

  lockVersions(entry, text) {
    return goSumVersions(text);
  },

  files(entry) {
    return [entry.lockfile, entry.manifest];
  },
};

/** The modules go list printed that the main module requires directly (no Main, no Indirect). */
const goDirect = (modules) => modules.filter((m) => m && typeof m.Path === "string" && typeof m.Version === "string" && !m.Main && !m.Indirect).map((m) => ({ ...m, Update: m.Update && typeof m.Update.Version === "string" ? m.Update : null }));

/* ---------------------------------------------------------- .NET */

const PROJECT_FILE = /\.(?:cs|fs)proj$/i;

/** packages.lock.json beside a project, or packages.<project>.lock.json when several projects share the folder; null when there is none. */
function nugetLockfile(root, project) {
  const dir = dirOf(project);
  const named = inDir(dir, `packages.${path.posix.basename(project).replace(PROJECT_FILE, "")}.lock.json`);
  if (fs.existsSync(path.join(root, named))) return named;
  const plain = inDir(dir, "packages.lock.json");
  return fs.existsSync(path.join(root, plain)) ? plain : null;
}

/** Directory.Packages.props in the project's folder or the nearest one above it inside root (Central Package Management); null when there is none. */
function nugetProps(root, project) {
  let dir = dirOf(project);
  for (;;) {
    const file = inDir(dir, "Directory.Packages.props");
    if (fs.existsSync(path.join(root, file))) return file;
    if (dir === ".") return null;
    dir = dirOf(dir);
  }
}

/** The PackageReference Include and Version pairs of a project file, attributes on one line. */
function packageReferences(text) {
  const refs = new Map();
  for (const m of String(text || "").matchAll(/<PackageReference\b([^>]*)>/g)) {
    const id = m[1].match(/\bInclude\s*=\s*"([^"]+)"/);
    const ver = m[1].match(/\bVersion\s*=\s*"([^"]+)"/);
    if (id && ver) refs.set(id[1], ver[1]);
  }
  return refs;
}

/** The packages of a dotnet list --format json report, one per id across the project's frameworks. null when it is not that shape. */
function dotnetPackages(json, field = "topLevelPackages") {
  if (!json || typeof json !== "object" || !Array.isArray(json.projects)) return null;
  const byId = new Map();
  for (const project of json.projects) {
    for (const fw of Array.isArray(project && project.frameworks) ? project.frameworks : []) {
      for (const p of Array.isArray(fw && fw[field]) ? fw[field] : []) {
        if (p && typeof p.id === "string" && !byId.has(p.id)) byId.set(p.id, p);
      }
    }
  }
  return [...byId.values()];
}

/** The error a dotnet list report carries (problems at level error), or null. */
const dotnetProblem = (json) => {
  const p = json && Array.isArray(json.problems) ? json.problems.find((x) => x && x.level === "error") : null;
  return p ? String(p.text || "dotnet list reported an error") : null;
};

const dotnetAdapter = {
  id: "dotnet",
  ecosystem: "nuget",
  lockfiles: ["packages.lock.json"],

  // Each project is its own entry. Without a packages.lock.json (opt-in) the project file is the record a scan and a
  // put-back work from, flagged noLockfile and listed in detect's noLockfile too.
  detect(root) {
    return walk(root, (n) => PROJECT_FILE.test(n)).map((project) => {
      const lock = nugetLockfile(root, project);
      const props = nugetProps(root, project);
      return {
        adapter: "dotnet",
        ecosystem: "nuget",
        lockfile: lock || project,
        manifest: project,
        manager: "dotnet",
        members: [dirOf(project)],
        ...(lock ? {} : { noLockfile: true }),
        ...(props ? { props } : {}),
      };
    });
  },

  unlocked(root, entries) {
    return entries.filter((e) => e.noLockfile).map((e) => ({ manifest: e.manifest, ecosystem: "nuget", reason: "no packages.lock.json: the project file is the only record (still scanned)" }));
  },

  quickCount(entry, root) {
    const r = spawnTool("dotnet", ["list", path.posix.basename(entry.manifest), "package", "--outdated", "--format", "json"], { cwd: path.join(root, dirOf(entry.manifest)) });
    const list = r.code === 0 ? dotnetPackages(parseJson(r.stdout)) : null;
    return list ? list.filter((p) => p.autoReferenced !== "true" && p.autoReferenced !== true && typeof p.latestVersion === "string").length : null;
  },

  scan(entry, { root, audit = true } = {}) {
    const result = { rows: [], held: [], notScanned: [], missingTools: [], stillOpen: [], audited: false, lookups: 0, answered: 0 };
    if (!findTool("dotnet")) {
      result.missingTools.push("dotnet");
      return result;
    }
    if (entry.noLockfile) result.noLockfile = true;
    const cwd = path.join(root, dirOf(entry.manifest));
    const project = path.posix.basename(entry.manifest);
    const runtime = this.runtime(entry, root);
    result.runtime = { declared: runtime.declared, source: runtime.source, machine: runtime.machine };
    result.lookups++;
    const r = spawnTool("dotnet", ["list", project, "package", "--outdated", "--format", "json"], { cwd });
    const json = parseJson(r.stdout);
    const list = dotnetPackages(json);
    if (r.code !== 0 || !list) {
      if (r.code === 0) {
        result.answered++;
        result.couldNotRead = "dotnet list";
        result.notScanned.push({ package: "*", reason: "could not read dotnet list output" });
      } else result.notScanned.push({ package: "*", reason: r.timedOut ? "dotnet did not answer in time" : dotnetProblem(json) || tail(r.stderr, 1) || tail(r.stdout, 1) || "dotnet list failed" });
      return result;
    }
    result.answered++;
    const declared = packageReferences(readText(path.join(root, entry.manifest)) || "");
    const unread = [];
    for (const p of list) {
      // An implicit package (autoReferenced) comes with the SDK, not a PackageReference the person can move.
      if (p.autoReferenced === "true" || p.autoReferenced === true) continue;
      const current = p.resolvedVersion;
      const target = p.latestVersion;
      if (!parseVersion("nuget", current) || !parseVersion("nuget", target)) {
        if (target !== undefined) unread.push(JSON.stringify(p));
        continue;
      }
      if (compareVersions("nuget", target, current) !== 1) continue;
      const requested = typeof p.requestedVersion === "string" ? p.requestedVersion : declared.get(p.id) || null;
      const row = buildRow("nuget", { id: `${entry.lockfile}#${p.id}`, name: p.id, current, target, declaredIn: requested ? [{ file: entry.props && !declared.has(p.id) ? entry.props : entry.manifest, range: requested }] : [] });
      // A bare version is a minimum NuGet resolves exactly: dotnet add package writes the new one itself.
      const raised = requested ? raiseRange("nuget", requested, target) : null;
      if (raised && raised.rewritten) Object.assign(row, { lockfileOnly: true, range: { from: raised.from, to: raised.to } });
      result.rows.push(row);
    }
    if (unread.length) flagUnread(result.rows, unread, "dotnet list");
    runtimeNotChecked(result, runtime);
    if (audit) this.audit(result, cwd, project);
    result.rows.sort((a, b) => Number(Boolean(b.security)) - Number(Boolean(a.security)) || a.package.localeCompare(b.package));
    return result;
  },

  // --vulnerable cannot share a run with --outdated. Its entries carry only a severity and an advisory link, never
  // the version that fixes them, so each one badges its row and also stays open (nothing proves the target clears it).
  audit(result, cwd, project) {
    const r = spawnTool("dotnet", ["list", project, "package", "--vulnerable", "--include-transitive", "--format", "json"], { cwd });
    const json = parseJson(r.stdout);
    const top = dotnetPackages(json);
    const transitive = dotnetPackages(json, "transitivePackages");
    if (r.code !== 0 || !top) {
      notAudited(result, r.timedOut ? "dotnet did not answer in time" : r.code === 0 ? "could not read dotnet list --vulnerable output" : dotnetProblem(json) || tail(r.stderr, 1) || "dotnet list --vulnerable failed");
      return;
    }
    result.audited = true;
    const rowOf = new Map(result.rows.map((row) => [row.package.toLowerCase(), row]));
    for (const p of [...top, ...transitive]) {
      const vulns = Array.isArray(p.vulnerabilities) ? p.vulnerabilities.filter((v) => v && typeof v === "object") : [];
      if (!vulns.length) continue;
      const group = { severity: worstSeverity(vulns.map((v) => String(v.severity || "").toLowerCase())), ids: [...new Set(vulns.map((v) => v.advisoryurl).filter((u) => typeof u === "string"))] };
      const row = rowOf.get(p.id.toLowerCase());
      if (row) row.security = group;
      result.stillOpen.push({ package: p.id, ...group, reason: row ? `dotnet does not say which version fixes it, so ${row.target} may still be affected` : "dotnet does not say which version fixes it" });
    }
  },

  // dotnet add package takes one package, so each pick is its own command; it rewrites the PackageReference
  // (or Directory.Packages.props) and restores, which updates packages.lock.json.
  applyCommand(batch, entry, root) {
    const cwd = path.join(root, dirOf(entry.manifest));
    const project = path.posix.basename(entry.manifest);
    return batch.rows.map((r) => ({ cmd: "dotnet", args: ["add", project, "package", r.package, "--version", r.target], cwd }));
  },

  // --locked-mode: restore what packages.lock.json says and fail rather than rewrite it.
  installCommand(entry, root) {
    const args = ["restore", path.posix.basename(entry.manifest)];
    if (!entry.noLockfile) args.push("--locked-mode");
    return { cmd: "dotnet", args, cwd: path.join(root, dirOf(entry.manifest)) };
  },

  runtime(entry, root) {
    const keys = readKeys(path.join(root, entry.manifest));
    const declared = keys ? keys.targetFramework || (keys.targetFrameworks && keys.targetFrameworks.join(";")) || null : null;
    const machine = declared ? null : toolVersion("dotnet", ["--version"], path.join(root, dirOf(entry.manifest)));
    return declaredRuntime(declared, "TargetFramework", machine);
  },

  // packages.lock.json's resolved versions per framework, or, without one, the project file's PackageReference versions.
  lockVersions(entry, text) {
    const map = new Map();
    const json = parseJson(text);
    if (json && typeof json === "object" && json.dependencies && typeof json.dependencies === "object") {
      const byName = new Map();
      for (const fw of Object.values(json.dependencies)) {
        for (const [id, dep] of Object.entries(fw || {})) {
          if (!dep || typeof dep.resolved !== "string") continue;
          if (!byName.has(id)) byName.set(id, new Set());
          byName.get(id).add(dep.resolved);
        }
      }
      for (const [id, set] of byName) map.set(id, [...set].sort().join(","));
      return map;
    }
    for (const [id, version] of packageReferences(text)) map.set(id, version.replace(/^\[\s*([^,\]]+?)\s*\]$/, "$1"));
    return map;
  },

  files(entry) {
    return [entry.lockfile, entry.manifest, ...(entry.props ? [entry.props] : [])];
  },
};

export const ADAPTERS = [npmAdapter, cargoAdapter, pipAdapter, uvAdapter, goAdapter, dotnetAdapter];

/* ---------------------------------------------------------- not covered */

/** Manifests of ecosystems with no adapter yet: listed by detect, never scanned. */
const NOT_COVERED = { "pom.xml": "Maven", "build.gradle": "Gradle", "build.gradle.kts": "Gradle", Gemfile: "Ruby (Bundler)", "composer.json": "PHP (Composer)" };

// Composer and Bundler install each dependency under vendor/ with its own manifest: copies, not the project's.
const NOT_COVERED_SKIP = /(?:^|\/)vendor\//;

function notCovered(root) {
  return walk(root, new Set(Object.keys(NOT_COVERED))).filter((manifest) => !NOT_COVERED_SKIP.test(manifest)).map((manifest) => ({ folder: dirOf(manifest), manifest, ecosystem: NOT_COVERED[path.posix.basename(manifest)] }));
}
const adapterOf = (id) => ADAPTERS.find((a) => a.id === id);

/* ---------------------------------------------------------- git (read only) */

/** git in root, read only: { ok, code, stdout }; ok false when git is missing or root is not a repository. */
function git(root, args) {
  const r = spawnTool("git", args, { cwd: root, timeoutMs: LOOKUP_TIMEOUT_MS });
  return { ok: !r.notFound && r.code !== null, code: r.code, stdout: r.stdout };
}

/** Changed paths from `git status --porcelain -z`, relative to root; null outside a repository. */
function gitChanges(root) {
  const top = git(root, ["rev-parse", "--show-toplevel"]);
  if (!top.ok || top.code !== 0 || !top.stdout.trim()) return null;
  const st = git(root, ["status", "--porcelain", "-z", "--untracked-files=all"]);
  if (!st.ok || st.code !== 0) return null;
  const topDir = top.stdout.trim();
  // git reports physical paths: compare against the root's real path, so a root reached through a link or junction still matches.
  let realRoot = root;
  try {
    realRoot = fs.realpathSync.native(root);
  } catch {}
  const parts = st.stdout.split("\0");
  const paths = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.length < 4) continue;
    paths.push(relTo(realRoot, path.resolve(topDir, p.slice(3))));
    if (p[0] === "R" || p[0] === "C") i++; // the rename's old path follows
  }
  return paths;
}

const isTracked = (root, rel) => {
  const r = git(root, ["ls-files", "--error-unmatch", "--", rel]);
  return r.ok ? r.code === 0 : null;
};

/** A { cmd, args } call as one command line, for the report and run-check.mjs. */
const commandLine = (c) => [c.cmd, ...c.args].join(" ");

/* ---------------------------------------------------------- run files */

/** detect.json (with its root), or exit 3. */
function needDetect(dir) {
  const d = readRun(dir, "detect.json");
  if (!d || !d.root) fail(EXIT.NOT_FOUND, "detect-missing", "The run folder has no detect.json.", "Run detect first.");
  return d;
}

/** The batch from batches.json and its lockfile's entry from scan.json, or exit 3. */
function needBatch(dir, id) {
  if (!id) fail(EXIT.USAGE, "missing-batch", "--batch is required.", "Pass a batch id from batches.json.");
  const scan = needScan(dir);
  const saved = readRun(dir, "batches.json");
  if (!saved || !Array.isArray(saved.batches)) fail(EXIT.NOT_FOUND, "batches-missing", "The run folder has no batches.json.", "Run batches --picks first.");
  const batch = saved.batches.find((b) => b.id === id);
  if (!batch) fail(EXIT.NOT_FOUND, "unknown-batch", `No batch ${id} in batches.json.`, `One of: ${saved.batches.map((b) => b.id).join(", ") || "none"}.`);
  const entry = (scan.lockfiles || []).find((l) => l.lockfile === batch.lockfile);
  if (!entry) fail(EXIT.NOT_FOUND, "unknown-lockfile", `scan.json has no lockfile ${batch.lockfile}.`, "Scan again, then plan the batches again.");
  const adapter = adapterOf(entry.adapter);
  if (!adapter) fail(EXIT.INVALID, "unknown-adapter", `No adapter ${entry.adapter} for ${entry.lockfile}.`, "Scan again with this version of deps.mjs.");
  return { scan, batch, entry, adapter, root: scan.root };
}

/* ---------------------------------------------------------- commands */

function cmdDetect(argv) {
  const args = parseArgs(argv, { values: ["root"] });
  const root = path.resolve(args.root || process.cwd());
  if (!isDir(root)) fail(EXIT.NOT_FOUND, "root-missing", `${args.root} is not a folder.`, "Pass the project folder.");
  const dir = newRun();
  const changes = gitChanges(root);
  const lockfiles = [];
  const missing = new Map();
  const noLockfile = [];
  const touched = new Set();
  for (const adapter of ADAPTERS) {
    const entries = adapter.detect(root);
    noLockfile.push(...(adapter.unlocked ? adapter.unlocked(root, entries) : []));
    for (const entry of entries) {
      const files = adapter.files(entry);
      files.forEach((f) => touched.add(f));
      const tool = entry.manager;
      const present = Boolean(findTool(tool));
      if (!present) missing.set(tool, [...(missing.get(tool) || []), entry.lockfile]);
      lockfiles.push({
        ...entry,
        tracked: changes === null ? null : isTracked(root, entry.lockfile),
        dirty: changes === null ? null : files.filter((f) => changes.includes(f)),
        updates: present ? adapter.quickCount(entry, root) : null,
        install: commandLine(adapter.installCommand(entry, root)),
      });
    }
  }
  const result = {
    ok: true,
    run: dir.split(path.sep).join("/"),
    root,
    git: changes !== null,
    lockfiles,
    notCovered: notCovered(root),
    missingTools: [...missing].map(([tool, files]) => ({ tool, lockfiles: files })),
    noLockfile,
    unrelatedChanges: changes === null ? null : changes.filter((p) => !p.startsWith("../") && !touched.has(p)).length,
  };
  writeRun(dir, "detect.json", result);
  out(result);
}

/** The test map rows whose paths fall in any member folder; a Shared row hit means the full suite. */
function checksFor(members, testMap) {
  const rows = [];
  const commands = [];
  let full = false;
  for (const row of testMap) {
    const hit = (row.paths || []).some((glob) => {
      const prefix = [];
      for (const seg of String(glob).split("/")) {
        if (/[*?{]/.test(seg)) break;
        prefix.push(seg);
      }
      const head = prefix.join("/");
      return members.some((m) => m === "." || head === m || head.startsWith(`${m}/`) || m.startsWith(`${head}/`) || head === "" || matchGlob(glob, `${m}/package.json`));
    });
    if (!hit) continue;
    rows.push(row.area);
    if (row.run) commands.push(row.run);
    if (row.shared) full = true;
  }
  return { rows, commands, discovered: [], full };
}

function cmdScan(argv) {
  const args = parseArgs(argv, { values: ["run", "folders"], booleans: ["no-audit", "notes"] });
  const dir = runDir(args.run);
  const detect = needDetect(dir);
  const root = detect.root;
  let entries = detect.lockfiles || [];
  if (args.folders) {
    const wanted = args.folders.split(",").map((s) => s.trim().replace(/\\/g, "/").replace(/\/+$/, "") || ".").filter(Boolean);
    const unknown = wanted.filter((f) => !entries.some((e) => dirOf(e.lockfile) === f));
    if (unknown.length) fail(EXIT.NOT_FOUND, "unknown-folder", `No lockfile in ${unknown.join(", ")}.`, `One of: ${entries.map((e) => dirOf(e.lockfile)).join(", ") || "none"}.`, { unknown });
    entries = entries.filter((e) => wanted.includes(dirOf(e.lockfile)));
  }
  let testMap = [];
  try {
    testMap = readTestMap(root).rows || [];
  } catch {}
  let lookups = 0;
  let answered = 0;
  const lockfiles = [];
  const missingTools = new Set();
  for (const entry of entries) {
    const adapter = adapterOf(entry.adapter);
    const scanned = adapter.scan(entry, { root, audit: !args["no-audit"], notes: Boolean(args.notes) });
    lookups += scanned.lookups;
    answered += scanned.answered;
    // A missing tool is a name (the package manager) or { tool, step, install } (a plugin); each is listed once.
    for (const t of scanned.missingTools) {
      const key = typeof t === "string" ? t : t.tool;
      if (![...missingTools].some((m) => (typeof m === "string" ? m : m.tool) === key)) missingTools.add(t);
    }
    const { lookups: _l, answered: _a, ...rest } = scanned;
    lockfiles.push({
      lockfile: entry.lockfile,
      manifest: entry.manifest,
      adapter: entry.adapter,
      ecosystem: entry.ecosystem,
      manager: entry.manager,
      ...(entry.berry ? { berry: true } : {}),
      members: entry.members,
      tracked: entry.tracked ?? null,
      install: entry.install,
      checks: checksFor(entry.members, testMap),
      ...rest,
    });
  }
  if (lookups > 0 && answered === 0) fail(EXIT.NOT_FOUND, "no-registry", "No registry answered.", "Check the network and scan again.", { reason: "no registry answered" });
  const scan = {
    ok: true,
    root,
    lockfiles,
    noChecks: lockfiles.length > 0 && lockfiles.every((l) => !l.checks.rows.length),
    notCovered: detect.notCovered || [],
    missingTools: [...missingTools],
  };
  writeRun(dir, "scan.json", scan);
  out({
    ok: true,
    run: dir.split(path.sep).join("/"),
    lockfiles: lockfiles.map((l) => ({ lockfile: l.lockfile, rows: l.rows.length, held: l.held.length, notScanned: l.notScanned.length, stillOpen: l.stillOpen.length, audited: l.audited, checks: l.checks.rows.length })),
    noChecks: scan.noChecks,
    missingTools: scan.missingTools,
  });
}

/** The files a batch may touch: the lockfile and every manifest that lockfile resolves. */
const batchFiles = (adapter, entry) => adapter.files(entry).filter((rel, i, all) => all.indexOf(rel) === i);

function cmdBackup(argv) {
  const args = parseArgs(argv, { values: ["run", "batch"] });
  const dir = runDir(args.run);
  const { batch, entry, adapter, root } = needBatch(dir, args.batch);
  const store = path.join(dir, "backups", batch.id);
  // The backup is the only as-found copy: a second one (after apply) would put back the changed files.
  if (fs.existsSync(path.join(store, "backup.json"))) fail(EXIT.REFUSED, "backup-exists", `Batch ${batch.id} already has a backup.`, "Restore it, or plan the batches again for new ids.");
  fs.rmSync(store, { recursive: true, force: true });
  fs.mkdirSync(path.join(store, "files"), { recursive: true });
  const files = [];
  for (const rel of batchFiles(adapter, entry)) {
    const src = path.join(root, rel);
    const existed = fs.existsSync(src);
    if (existed) {
      const dest = path.join(store, "files", rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    files.push({ path: rel, existed });
  }
  const snapshot = adapter.snapshot ? adapter.snapshot(entry, store, root) : null;
  fs.writeFileSync(path.join(store, "backup.json"), JSON.stringify({ batch: batch.id, lockfile: entry.lockfile, files, snapshot }, null, 2) + "\n");
  out({ ok: true, batch: batch.id, files: files.filter((f) => f.existed).map((f) => f.path), missing: files.filter((f) => !f.existed).map((f) => f.path), snapshot });
}

function cmdApply(argv) {
  const args = parseArgs(argv, { values: ["run", "batch"] });
  const dir = runDir(args.run);
  const { batch, entry, adapter, root } = needBatch(dir, args.batch);
  if (!fs.existsSync(path.join(dir, "backups", batch.id, "backup.json"))) fail(EXIT.REFUSED, "no-backup", `Batch ${batch.id} has no backup.`, `Run backup --batch ${batch.id} first.`);
  // Without its snapshot (pip freeze) the environment could not be put back, so nothing moves.
  const backup = readJsonFile(path.join(dir, "backups", batch.id, "backup.json"));
  if (backup && backup.snapshot && backup.snapshot.ok === false) fail(EXIT.REFUSED, "no-snapshot", `Batch ${batch.id}'s backup has no environment snapshot: ${backup.snapshot.reason}.`, "Fix the reason, then plan the batches again for a fresh backup.");
  const rowsById = new Map((entry.rows || []).map((r) => [r.id, r]));
  const missing = batch.picks.filter((id) => !rowsById.has(id));
  if (missing.length) fail(EXIT.NOT_FOUND, "unknown-pick", `No row ${missing.join(", ")} in ${entry.lockfile}.`, "Scan again, then plan the batches again.", { unknown: missing });
  const picks = batch.picks.map((id) => rowsById.get(id));
  const lockPath = path.join(root, entry.lockfile);
  const before = adapter.lockVersions(entry, readText(lockPath) || "");

  // Out-of-range picks and moved pins: raise the range in each manifest that declares it, one literal at a time.
  // Every declaration of a pick is decided before any file is edited, and a failed edit undoes the pick's
  // earlier ones, so a skipped pick never leaves a manifest raised over a lockfile that did not move.
  const rangeRaised = [];
  const skipped = [];
  const undoFailed = [];
  for (const row of picks) {
    if (row.lockfileOnly) continue;
    const raises = [];
    const blocked = [];
    for (const d of row.declaredIn || []) {
      // Each declaration on its own: one that already takes the target stays as it is; a pin or one that does not is raised.
      const takes = inRange(adapter.ecosystem, d.range, row.target);
      if (!isPin(adapter.ecosystem, d.range) && (takes === true || (takes === null && row.inRange))) continue;
      const raised = raiseRange(adapter.ecosystem, d.range, row.target);
      if (raised.rewritten) raises.push({ file: d.file, from: d.range, to: raised.to, ...(d.name ? { name: d.name } : {}) });
      else if (!raised.fits) blocked.push({ id: row.id, file: d.file, reason: raised.reason || "range not rewritten" });
    }
    if (blocked.length) {
      skipped.push(...blocked);
      continue;
    }
    const done = [];
    for (const x of raises) {
      const edit = editVersion(path.join(root, x.file), { name: x.name || row.package, from: x.from, to: x.to });
      if (edit.ok) {
        done.push(x);
        continue;
      }
      for (const back of done) {
        const undo = editVersion(path.join(root, back.file), { name: back.name || row.package, from: back.to, to: back.from });
        if (!undo.ok) undoFailed.push({ id: row.id, file: back.file, range: back.to, reason: undo.reason });
      }
      done.length = 0;
      skipped.push({ id: row.id, file: x.file, reason: edit.reason });
      break;
    }
    for (const x of done) rangeRaised.push({ id: row.id, package: row.package, ...x });
  }
  const moving = picks.filter((r) => !skipped.some((s) => s.id === r.id));
  // An adapter may need several commands (Cargo's --precise takes one package): they run in order, stopping at the first failure.
  const calls = [].concat(adapter.applyCommand({ ...batch, rows: moving }, entry, root));
  const call = calls[0];
  // With every pick skipped nothing runs (a bare update would move everything in range), so no command is reported.
  const command = moving.length ? calls.map(commandLine).join(" && ") : null;
  let r = { code: null, stdout: "", stderr: "", timedOut: false };
  if (moving.length) {
    const outText = [];
    const errText = [];
    for (const c of calls) {
      r = spawnTool(c.cmd, c.args, { cwd: c.cwd });
      outText.push(r.stdout);
      errText.push(r.stderr);
      if (r.code !== 0) break;
    }
    r = { ...r, stdout: outText.join("\n"), stderr: errText.join("\n") };
  }

  const after = adapter.lockVersions(entry, readText(lockPath) || "");
  const changed = [];
  const added = [];
  const removed = [];
  for (const [key, to] of after) {
    if (!before.has(key)) added.push({ package: lockKeyName(key), version: to });
    else if (before.get(key) !== to) changed.push({ package: lockKeyName(key), from: before.get(key), to, key });
  }
  for (const [key, from] of before) if (!after.has(key)) removed.push({ package: lockKeyName(key), version: from });
  const picked = new Set(picks.map((p) => p.package));
  const unpicked = changed.filter((c) => !picked.has(c.package));
  // A pick that did not land on its target (a range that let the tool go further, not at all, or skipped).
  const offTarget = picks
    .filter((row) => !changed.some((c) => c.package === row.package && c.to.split(",").includes(row.target)))
    .map((row) => ({ id: row.id, package: row.package, target: row.target, now: changed.filter((c) => c.package === row.package).map((c) => c.to) }));
  // A pick held below latest for the runtime (newerNotFitting) that the tool carried past its target
  // (npm and Yarn update to the newest in range) would keep a version the project's runtime cannot run.
  const overshot = offTarget
    .filter((o) => {
      const row = picks.find((p) => p.id === o.id);
      return row && row.newerNotFitting && o.now.some((v) => v.split(",").some((x) => compareVersions(adapter.ecosystem, x, row.target) === 1));
    })
    .map((o) => ({ ...o, reason: "went past the newest version that fits the project's runtime" }));
  // A manifest an undo could not put back is left raised: the batch must be put back from its backup.
  const toolFailed = moving.length > 0 && r.code !== 0;
  // An update that raised the project's runtime floor (Go's go directive) is never kept: the batch fails and is put back.
  const { needsNewerRuntime = [] } = moving.length && adapter.afterApply ? adapter.afterApply(entry, root, path.join(dir, "backups", batch.id), moving) : {};
  const failed = toolFailed || undoFailed.length > 0 || needsNewerRuntime.length > 0 || overshot.length > 0;
  out({
    ok: true,
    batch: batch.id,
    command,
    cwd: command ? relTo(root, call.cwd) : null,
    exit: r.code,
    timedOut: r.timedOut,
    failed,
    tail: toolFailed ? tail(`${r.stdout}\n${r.stderr}`) : "",
    changed,
    added,
    removed,
    rangeRaised,
    unpicked,
    offTarget,
    overshot,
    skipped,
    undoFailed,
    needsNewerRuntime,
  });
}

function cmdRestore(argv) {
  const args = parseArgs(argv, { values: ["run", "batch"], booleans: ["verify"] });
  const dir = runDir(args.run);
  const { batch, entry, adapter, root } = needBatch(dir, args.batch);
  const store = path.join(dir, "backups", batch.id);
  const saved = readJsonFile(path.join(store, "backup.json"));
  if (!saved) fail(EXIT.NOT_FOUND, "backup-missing", `Batch ${batch.id} has no backup.`, "Nothing to put back: backup was never run for this batch.");
  const restored = [];
  const deleted = [];
  // A file the OS will not let go of (EBUSY or EPERM from an editor or antivirus on Windows) is named,
  // never a crash: the put-back is then unfinished and the run folder keeps the as-found copy.
  const failedFiles = new Map();
  for (const f of saved.files) {
    const dest = path.join(root, f.path);
    try {
      if (f.existed) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(store, "files", f.path), dest);
        restored.push(f.path);
      } else if (fs.existsSync(dest)) {
        fs.rmSync(dest, { force: true });
        deleted.push(f.path);
      }
    } catch (err) {
      failedFiles.set(f.path, err.code || err.message);
    }
  }
  const extra = adapter.restoreExtra ? adapter.restoreExtra(entry, store, root) : null;
  let verified = null;
  const mismatched = [];
  if (args.verify || failedFiles.size) {
    for (const f of saved.files) {
      if (failedFiles.has(f.path)) {
        mismatched.push({ path: f.path, reason: failedFiles.get(f.path) });
        continue;
      }
      if (!args.verify) continue;
      const dest = path.join(root, f.path);
      try {
        const same = f.existed ? fs.existsSync(dest) && fs.readFileSync(dest).equals(fs.readFileSync(path.join(store, "files", f.path))) : !fs.existsSync(dest);
        if (!same) mismatched.push({ path: f.path, reason: "differs from the backup" });
      } catch (err) {
        mismatched.push({ path: f.path, reason: err.code || err.message });
      }
    }
    verified = mismatched.length === 0;
  }
  const install = adapter.installCommand(entry, root);
  out({
    ok: true,
    batch: batch.id,
    restored,
    deleted,
    extra,
    verified,
    mismatched,
    reinstall: { cmd: install.cmd, args: install.args, cwd: relTo(root, install.cwd), command: [install.cmd, ...install.args].join(" ") },
  });
}

/* ======================================================================
 * 3. Version math
 * ==================================================================== */

const SEMVER_ECOSYSTEMS = new Set(["npm", "cargo", "go", "nuget"]);

/**
 * Parse a version for an ecosystem. Semver (npm, cargo, go, nuget) gives
 * { kind: "semver", release: [major, minor, patch(, revision)], pre: [...] };
 * Go drops a leading v and +incompatible, NuGet takes one to four parts.
 * Python gives a PEP 440 subset { kind: "pep440", epoch, release, pre, post, dev }.
 * Anything else, or text it cannot read, is null. Never throws.
 */
export function parseVersion(ecosystem, text) {
  if (typeof text !== "string") return null;
  let t = text.trim();
  if (SEMVER_ECOSYSTEMS.has(ecosystem)) {
    if (ecosystem === "go") t = t.replace(/^v/, "").replace(/\+incompatible$/, "");
    const parts = ecosystem === "nuget" ? "\\d+(?:\\.\\d+){0,3}" : "\\d+\\.\\d+\\.\\d+";
    const m = t.match(new RegExp(`^(${parts})(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`));
    if (!m) return null;
    const release = m[1].split(".").map(Number);
    if (ecosystem === "nuget") while (release.length < 3) release.push(0);
    const pre = m[2] ? m[2].split(".").map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [];
    return { kind: "semver", release, pre };
  }
  if (ecosystem === "python") {
    const m = t
      .toLowerCase()
      .match(/^v?(?:(\d+)!)?(\d+(?:\.\d+)*)(?:[-_.]?(a|b|rc|alpha|beta|c)[-_.]?(\d+)?)?(?:[-_.]?(post)[-_.]?(\d+)?)?(?:[-_.]?(dev)[-_.]?(\d+)?)?(?:\+[a-z0-9]+(?:[-_.][a-z0-9]+)*)?$/);
    if (!m) return null;
    const letter = { alpha: "a", beta: "b", c: "rc" }[m[3]] || m[3];
    return {
      kind: "pep440",
      epoch: m[1] ? Number(m[1]) : 0,
      release: m[2].split(".").map(Number),
      pre: letter ? [letter, m[4] ? Number(m[4]) : 0] : null,
      post: m[5] ? Number(m[6] || 0) : null,
      dev: m[7] ? Number(m[8] || 0) : null,
    };
  }
  return null;
}

const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);

function compareRelease(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return sign(d);
  }
  return 0;
}

/** Semver prerelease precedence: none sorts after any; numbers before words; shorter first when equal so far. */
function comparePre(a, b) {
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1;
  if (!b.length) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    if (a[i] === b[i]) continue;
    const an = typeof a[i] === "number";
    const bn = typeof b[i] === "number";
    if (an && bn) return sign(a[i] - b[i]);
    if (an) return -1;
    if (bn) return 1;
    return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** PEP 440 sort key pieces, after packaging's: a dev-only release sorts before its pre-releases. */
function pepKey(v) {
  const pre = v.pre === null && v.post === null && v.dev !== null ? [-Infinity] : v.pre === null ? [Infinity] : [{ a: 0, b: 1, rc: 2 }[v.pre[0]], v.pre[1]];
  const post = v.post === null ? -Infinity : v.post;
  const dev = v.dev === null ? Infinity : v.dev;
  return { pre, post, dev };
}

function compareParsed(a, b) {
  if (a.kind === "semver") return compareRelease(a.release, b.release) || comparePre(a.pre, b.pre);
  const d = sign(a.epoch - b.epoch) || compareRelease(a.release, b.release);
  if (d) return d;
  const ka = pepKey(a);
  const kb = pepKey(b);
  return compareRelease(ka.pre, kb.pre) || sign(ka.post - kb.post) || sign(ka.dev === kb.dev ? 0 : ka.dev - kb.dev);
}

/** -1, 0 or 1; null when either version cannot be read. */
export function compareVersions(ecosystem, a, b) {
  const pa = parseVersion(ecosystem, a);
  const pb = parseVersion(ecosystem, b);
  if (!pa || !pb) return null;
  return compareParsed(pa, pb);
}

/**
 * How big a move current -> target is: patch, minor, major or 0.x. Under 1.0
 * every move of the first non-zero part (0.8 -> 0.9, 0.0.3 -> 0.0.4) is 0.x,
 * which the labels treat as a major, as npm and Cargo caret ranges do. null
 * when either version cannot be read.
 */
export function jumpOf(ecosystem, current, target) {
  const a = parseVersion(ecosystem, current);
  const b = parseVersion(ecosystem, target);
  if (!a || !b) return null;
  const [a0 = 0, a1 = 0, a2 = 0] = a.release;
  const [b0 = 0, b1 = 0, b2 = 0] = b.release;
  if (a0 !== b0) return "major";
  if (a0 === 0) {
    if (a1 !== b1) return "0.x";
    if (a1 === 0 && a2 !== b2) return "0.x";
    return "patch";
  }
  if (a1 !== b1) return "minor";
  return "patch";
}

// A range is read into sets of comparators, { op, v } with v a parsed
// version; the sets are alternatives (npm ||), the comparators in a set all
// apply. A version fits when every comparator of some set accepts it.

const VERSION_TEXT = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** A possibly partial semver ("1", "1.2", "1.x", "*") as { parts: [numbers], pre } where parts stops at the first wildcard or missing part. */
function partial(text) {
  const m = String(text).trim().match(VERSION_TEXT);
  if (!m) return null;
  const parts = [];
  for (const p of [m[1], m[2], m[3]]) {
    if (p === undefined || /^[xX*]$/.test(p)) break;
    parts.push(Number(p));
  }
  if (m[4] && parts.length < 3) return null;
  return { parts, pre: m[4] ? m[4].split(".").map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [] };
}

const sv = (release, pre = []) => ({ kind: "semver", release, pre });

/** Comparators for one semver range token (npm and Cargo). null when it cannot be read. */
function semverComparators(token, bareOp) {
  const m = token.match(/^(\^|~>?|>=|<=|>|<|=)?\s*(.+)$/);
  if (!m) return null;
  const op = m[1] || bareOp;
  const p = partial(m[2]);
  if (!p) return null;
  const [M, m1, pt] = p.parts;
  const n = p.parts.length;
  const full = sv([M || 0, m1 || 0, pt || 0], p.pre);
  if (n === 0) return op === "<" || op === ">" ? [{ op: "<", v: sv([0, 0, 0], [0]) }] : [];
  switch (op) {
    case "^": {
      let upper;
      if (M > 0 || n === 1) upper = [M + 1, 0, 0];
      else if (m1 > 0 || n === 2) upper = [0, (m1 || 0) + 1, 0];
      else upper = [0, 0, pt + 1];
      return [{ op: ">=", v: full }, { op: "<", v: sv(upper, [0]) }];
    }
    case "~":
    case "~>": {
      const upper = n === 1 ? [M + 1, 0, 0] : [M, m1 + 1, 0];
      return [{ op: ">=", v: full }, { op: "<", v: sv(upper, [0]) }];
    }
    case "=":
    case "exact":
      if (n === 3) return [{ op: "=", v: full }];
      return [{ op: ">=", v: full }, { op: "<", v: sv(n === 1 ? [M + 1, 0, 0] : [M, m1 + 1, 0], [0]) }];
    case ">=":
      return [{ op: ">=", v: full }];
    case "<":
      return [{ op: "<", v: n === 3 ? full : sv([M || 0, m1 || 0, 0], [0]) }];
    case ">":
      return n === 3 ? [{ op: ">", v: full }] : [{ op: ">=", v: sv(n === 1 ? [M + 1, 0, 0] : [M, m1 + 1, 0], [0]) }];
    case "<=":
      return n === 3 ? [{ op: "<=", v: full }] : [{ op: "<", v: sv(n === 1 ? [M + 1, 0, 0] : [M, m1 + 1, 0], [0]) }];
    default:
      return null;
  }
}

/** npm range sets: ||-separated sets of space-separated comparators, hyphen ranges, x wildcards. */
function npmSets(range) {
  const sets = [];
  for (const alt of range.split("||")) {
    const text = alt.trim();
    if (text === "" || text === "*" || /^[xX]$/.test(text)) {
      sets.push([]);
      continue;
    }
    const hyphen = text.match(/^(\S+)\s+-\s+(\S+)$/);
    if (hyphen) {
      const lo = semverComparators(hyphen[1], ">=");
      const hi = semverComparators(hyphen[2], "<=");
      if (!lo || !hi) return null;
      sets.push([...lo, ...hi]);
      continue;
    }
    const tokens = text.replace(/(\^|~>?|>=|<=|>|<|=)\s+/g, "$1").split(/\s+/);
    const set = [];
    for (const tok of tokens) {
      const c = semverComparators(tok, "exact");
      if (!c) return null;
      set.push(...c);
    }
    sets.push(set);
  }
  return sets;
}

/** Cargo requirement: comma-separated comparators, a bare version meaning caret. */
function cargoSets(range) {
  const text = range.trim();
  if (text === "*" || text === "") return [[]];
  const set = [];
  for (const tok of text.split(",")) {
    // A bare version means caret; a bare wildcard (1.*, 1.2.*) is an x-range, as Cargo reads it.
    const c = semverComparators(tok.trim(), tok.includes("*") ? "exact" : "^");
    if (!c) return null;
    set.push(...c);
  }
  return [set];
}

/** NuGet: a bare version is a minimum; [a,b], (a,b), [a] and open ends as written. */
function nugetSets(range) {
  const text = range.trim();
  const v = (t) => parseVersion("nuget", t);
  if (!/^[[(]/.test(text)) {
    const min = v(text);
    return min ? [[{ op: ">=", v: min }]] : null;
  }
  const m = text.match(/^([[(])\s*([^,\])]*?)\s*(?:,\s*([^\])]*?)\s*)?([\])])$/);
  if (!m) return null;
  const [, open, lo, hi, close] = m;
  if (hi === undefined) {
    const exact = v(lo);
    return exact && open === "[" && close === "]" ? [[{ op: "=", v: exact }]] : null;
  }
  const set = [];
  if (lo) {
    const lv = v(lo);
    if (!lv) return null;
    set.push({ op: open === "[" ? ">=" : ">", v: lv });
  }
  if (hi) {
    const hv = v(hi);
    if (!hv) return null;
    set.push({ op: close === "]" ? "<=" : "<", v: hv });
  }
  return [set];
}

/** PEP 440 specifiers: comma-separated ==, ===, !=, ~=, >=, <=, >, <; == and != take a trailing .* */
function pythonSets(range) {
  const text = range.trim();
  if (text === "") return [[]];
  const set = [];
  for (const raw of text.split(",")) {
    const m = raw.trim().match(/^(===|==|!=|~=|>=|<=|>|<)\s*(.+)$/);
    if (!m) return null;
    const [, op, verText] = m;
    if (/\.\*$/.test(verText)) {
      if (op !== "==" && op !== "!=") return null;
      const prefix = parseVersion("python", verText.slice(0, -2));
      if (!prefix) return null;
      set.push({ op: op === "==" ? "prefix" : "!prefix", v: prefix });
      continue;
    }
    const v = parseVersion("python", verText);
    if (!v) return null;
    if (op === "~=") {
      if (v.release.length < 2) return null;
      const prefix = { ...v, release: v.release.slice(0, -1), pre: null, post: null, dev: null };
      set.push({ op: ">=", v }, { op: "prefix", v: prefix });
    } else {
      set.push({ op: op === "===" || op === "==" ? "=" : op, v });
    }
  }
  return [set];
}

function rangeSets(ecosystem, range) {
  if (typeof range !== "string") return null;
  if (ecosystem === "npm") return npmSets(range);
  if (ecosystem === "cargo") return cargoSets(range);
  if (ecosystem === "nuget") return nugetSets(range);
  if (ecosystem === "python") return pythonSets(range);
  if (ecosystem === "go") {
    const v = parseVersion("go", range);
    return v ? [[{ op: "=", v }]] : null;
  }
  return null;
}

function accepts(c, v) {
  if (c.op === "prefix" || c.op === "!prefix") {
    const head = c.v.release;
    const match = v.epoch === c.v.epoch && head.every((n, i) => (v.release[i] || 0) === n);
    return c.op === "prefix" ? match : !match;
  }
  const d = compareParsed(v, c.v);
  switch (c.op) {
    case "=":
      return d === 0;
    case "!=":
      return d !== 0;
    case ">=":
      return d >= 0;
    case ">":
      return d > 0;
    case "<=":
      return d <= 0;
    case "<":
      return d < 0;
    default:
      return false;
  }
}

/**
 * Does version fit range? npm (caret, tilde, exact, comparator pairs, x
 * wildcards, *, hyphen, ||), Cargo (bare = caret, =, ~, comparators), PEP 440
 * (==, ~=, >=, <, !=, ...), NuGet (bare minimum, brackets) and Go (the one
 * required version). Under npm and Cargo a prerelease fits only a set with a
 * prerelease comparator on the same major.minor.patch. null when the range or
 * version cannot be read: the caller treats the range as hand-written.
 */
export function inRange(ecosystem, range, version) {
  const sets = rangeSets(ecosystem, range);
  const v = parseVersion(ecosystem, version);
  if (!sets || !v) return null;
  return sets.some((set) => {
    if (!set.every((c) => accepts(c, v))) return false;
    if ((ecosystem === "npm" || ecosystem === "cargo") && v.pre.length) {
      return set.some((c) => c.v.pre.length && !(c.op === "<" && c.v.pre.length === 1 && c.v.pre[0] === 0) && compareRelease(c.v.release, v.release) === 0);
    }
    return true;
  });
}

/**
 * Raise a declared range to target, keeping its operator style: ^9.6.1 ->
 * ^10.2.1, ~1.2.3 -> ~1.4.0, an exact version stays exact, Cargo "1.2" ->
 * "2.0", PEP 440 >=1.2 -> >=2.0 (as many parts as the range had). A
 * hand-written range (>=2 <4, 1.x, *, any compound range, NuGet brackets) is
 * never rewritten: { rewritten: false, fits: true } when target already fits,
 * else { rewritten: false, reason: "range not rewritten" }.
 */
export function raiseRange(ecosystem, range, target) {
  const notRewritten = { rewritten: false, reason: "range not rewritten" };
  if (typeof range !== "string" || !parseVersion(ecosystem, target)) return notRewritten;
  const text = range.trim();
  const ops = {
    npm: /^(\^|~|=|v)?(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?)$/,
    cargo: /^(\^|~|=)?(\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?)$/,
    // The operator keeps any space after it ("== 2.31.0" stays spaced).
    python: /^((?:==|~=|>=)\s*)(\d+(?:\.\d+)*)$/,
    nuget: /^()(\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z.-]+)?)$/,
    go: /^(v)(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+incompatible)?)$/,
  }[ecosystem];
  const m = ops && text.match(ops);
  if (!m) {
    const fits = inRange(ecosystem, text, target);
    return fits ? { rewritten: false, fits: true } : notRewritten;
  }
  const [, op = "", old] = m;
  const clean = String(target).trim().replace(/^v/, "");
  const oldParts = old.split(/[-+]/)[0].split(".").length;
  const targetHead = clean.split(/[-+]/)[0].split(".");
  const hasTail = /[^0-9.]/.test(clean);
  // Keep the range's precision ("1.2" stays two parts) unless the target is a prerelease.
  // Python == names one version and a bare NuGet version is the one NuGet resolves (the lowest that fits), so both take the whole target.
  const whole = hasTail || (ecosystem === "python" && op.trim() === "==") || ecosystem === "nuget" || oldParts >= targetHead.length;
  const body = whole ? clean : targetHead.slice(0, oldParts).join(".");
  return { rewritten: true, from: text, to: `${op}${body}` };
}

/* ======================================================================
 * 4. Manifests
 * ==================================================================== */

/** The value of `key = "value"` on one line, or null when it is not a one-line string. */
function tomlString(line, key) {
  const m = line.match(new RegExp(`^\\s*${key.replace(/[-.]/g, "\\$&")}\\s*=\\s*(.*)$`));
  if (!m) return undefined;
  const v = m[1].trim().match(/^"([^"]*)"\s*(?:#.*)?$|^'([^']*)'\s*(?:#.*)?$/);
  return v ? (v[1] ?? v[2]) : null;
}

/**
 * The few runtime and hold keys the tools do not report, read line by line:
 * package.json engines.node; pyproject.toml requires-python ([project]);
 * Cargo.toml rust-version ([package] or [workspace.package]) and its
 * [patch.*] section names; go.mod's go directive; a .csproj's or .fsproj's
 * TargetFramework / TargetFrameworks. A key spread over several lines (or not
 * a plain string) reads as null. null for a file it does not know or cannot
 * read.
 */
export function readKeys(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const base = path.basename(file).toLowerCase();
  const lines = text.split(/\r?\n/);
  if (base === "package.json") {
    try {
      const json = JSON.parse(text);
      const node = json && json.engines && json.engines.node;
      return { ecosystem: "npm", enginesNode: typeof node === "string" ? node : null };
    } catch {
      return { ecosystem: "npm", enginesNode: null };
    }
  }
  if (base === "pyproject.toml" || base === "cargo.toml") {
    const cargo = base === "cargo.toml";
    const keys = cargo ? { ecosystem: "cargo", rustVersion: null, patch: [] } : { ecosystem: "python", requiresPython: null };
    let section = "";
    for (const line of lines) {
      const header = line.match(/^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/);
      if (header) {
        section = header[1];
        const patch = cargo && section.match(/^patch\.(?:"([^"]+)"|'([^']+)'|([^.\s]+))$/);
        if (patch) keys.patch.push(patch[1] ?? patch[2] ?? patch[3]);
        continue;
      }
      if (cargo && (section === "package" || section === "workspace.package")) {
        const v = tomlString(line, "rust-version");
        if (v !== undefined && keys.rustVersion === null) keys.rustVersion = v;
      }
      if (!cargo && section === "project") {
        const v = tomlString(line, "requires-python");
        if (v !== undefined) keys.requiresPython = v;
      }
    }
    return keys;
  }
  if (base === "go.mod") {
    let go = null;
    let block = false;
    for (const line of lines) {
      if (block) {
        if (/^\s*\)/.test(line)) block = false;
        continue;
      }
      if (/^\s*\w+\s*\(\s*$/.test(line)) {
        block = true;
        continue;
      }
      const m = line.match(/^\s*go\s+(\S+)\s*(?:\/\/.*)?$/);
      if (m) go = m[1];
    }
    return { ecosystem: "go", go };
  }
  if (base.endsWith(".csproj") || base.endsWith(".fsproj")) {
    const one = (tag) => {
      for (const line of lines) {
        if (!line.includes(`<${tag}>`) && !line.includes(`<${tag} `)) continue;
        const m = line.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`));
        return m ? m[1].trim() : null;
      }
      return null;
    };
    const many = one("TargetFrameworks");
    return {
      ecosystem: "nuget",
      targetFramework: one("TargetFramework"),
      targetFrameworks: many ? many.split(";").map((s) => s.trim()).filter(Boolean) : null,
    };
  }
  return null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Change one version literal in a manifest: the line naming the package with
 * the exact `from` literal after the name gets `to` in its place, and nothing
 * else changes (line endings kept). The file is re-read and must differ from
 * the original by exactly that one string; anything else puts the original
 * bytes back. Returns { ok: true, file, line, from, to } or { ok: false, reason }.
 */
export function editVersion(file, { name, from, to } = {}) {
  if (!name || !from || typeof to !== "string" || !to) return { ok: false, reason: "name, from and to are required" };
  if (from === to) return { ok: false, reason: "from and to are the same" };
  let original;
  try {
    original = fs.readFileSync(file);
  } catch {
    return { ok: false, reason: "file not found" };
  }
  const text = original.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(original)) return { ok: false, reason: "file is not UTF-8 text" };
  const nameRe = new RegExp(`(?<![\\w.@/-])${escapeRe(name)}(?![\\w.@/-])`);
  const fromRe = new RegExp(`(?<![\\w.+-])${escapeRe(from)}(?![\\w.+-])`);
  const hits = [];
  let offset = 0;
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const n = line.match(nameRe);
    if (n) {
      const after = line.slice(n.index + n[0].length);
      const f = after.match(fromRe);
      if (f) hits.push({ line: i + 1, index: offset + n.index + n[0].length + f.index });
    }
    offset += line.length + 1;
  });
  if (!hits.length) return { ok: false, reason: `no line names ${name} with ${from}` };
  if (hits.length > 1) return { ok: false, reason: `${hits.length} lines name ${name} with ${from} (lines ${hits.map((h) => h.line).join(", ")})` };
  const { line, index } = hits[0];
  const expected = text.slice(0, index) + to + text.slice(index + from.length);
  const restore = (reason) => {
    try {
      fs.writeFileSync(file, original);
    } catch {}
    return { ok: false, reason };
  };
  try {
    fs.writeFileSync(file, expected);
  } catch (err) {
    return restore(`could not write: ${err.message}`);
  }
  let written;
  try {
    written = fs.readFileSync(file);
  } catch {
    return restore("could not re-read the file");
  }
  if (!written.equals(Buffer.from(expected, "utf8"))) return restore("the file changed by more than the one literal");
  return { ok: true, file, line, from, to };
}

/* ======================================================================
 * 5. Labels
 * ==================================================================== */

// FR-6 to FR-9, in one tested place. Safe is checked, in range (or a pin that
// moves with it), a patch or minor, notes read with no breaking lines. Every
// major and 0.x move is Check first at best; one whose changed API the code
// calls, or whose notes were not read or could not be read while 5 or more
// files import it, is a Warning. A move whose size cannot be worked out is
// never Safe. No checks at all caps every row at Check first.

export const WIDE_USE_FILES = 5;

const LABEL = { safe: "safe", check: "check-first", warning: "warning" };

function securityReason(security) {
  if (!security) return null;
  if (Array.isArray(security)) return security.length ? "security" : null;
  if (typeof security === "object") {
    const ids = security.ids;
    if (Array.isArray(ids) && !ids.length && !security.severity) return null;
    return security.severity ? `security (${security.severity})` : "security";
  }
  return "security";
}

/**
 * Label every row of a scan from the helpers' records. Pure: no files, no
 * network. scan: { noChecks, lockfiles: [{ lockfile, ecosystem, checks: {
 * rows, discovered }, rows: [{ id, current, target, jump, inRange, range,
 * pinned, security, unreadable }] }] }. records: [{ id, notes ("read", "not
 * read", "could not read"), breaking: [], files, calls: [] }]. Returns
 * [{ id, label, reasons[] }] in scan order; a security reason always comes
 * first.
 */
export function label(scan, records) {
  const byId = new Map((Array.isArray(records) ? records : []).map((r) => [r && r.id, r]));
  const noChecks = Boolean(scan && scan.noChecks);
  const result = [];
  for (const lock of (scan && scan.lockfiles) || []) {
    const checks = lock.checks || {};
    const covered = Boolean((checks.rows && checks.rows.length) || (checks.discovered && checks.discovered.length));
    for (const row of lock.rows || []) {
      const reasons = [];
      const security = securityReason(row.security);
      if (security) reasons.push(security);
      const jump = row.jump || jumpOf(lock.ecosystem, row.current, row.target);
      const major = jump === "major" || jump === "0.x";
      if (major) reasons.push(jump === "0.x" ? "0.x" : "major");
      if (!jump) reasons.push("could not read the versions");
      // couldNotRead (a scan's own flag) and unreadable name the tool whose output could not be read.
      const unreadable = row.couldNotRead || row.unreadable;
      if (unreadable) reasons.push(`could not read ${unreadable} output`);
      // notAudited: the audit tool is missing or its output could not be read, so a known vulnerability could hide here.
      if (row.notAudited) reasons.push("not checked for vulnerabilities");
      if (row.runtimeNotChecked) reasons.push(`runtime fit not checked (${row.runtimeNotChecked})`);
      if (row.pinned) reasons.push(`pinned ${row.current} → ${row.target}`);
      const rangeTo = row.range && row.range.to;
      const rangeChange = Boolean(row.range && row.range.from && rangeTo && rangeTo !== row.range.from);
      const notRewritten = !row.pinned && row.inRange === false && !rangeChange;
      if (rangeChange && !row.pinned) reasons.push(`range ${row.range.from} → ${rangeTo}`);
      if (notRewritten) reasons.push("range not rewritten");
      const rec = byId.get(row.id);
      const notes = rec && rec.notes ? rec.notes : "not read";
      if (notes === "not read") reasons.push("notes not read");
      else if (notes !== "read") reasons.push("notes could not be read");
      const breaking = rec && Array.isArray(rec.breaking) && rec.breaking.length > 0;
      if (breaking) reasons.push("breaking notes");
      const calls = rec && Array.isArray(rec.calls) ? rec.calls : [];
      if (calls.length) reasons.push("calls a changed API");
      const files = rec && typeof rec.files === "number" ? rec.files : null;
      if (files) reasons.push(`used in ${files} file${files === 1 ? "" : "s"}`);
      if (noChecks) reasons.push("no checks to run");
      else if (!covered) reasons.push("no checks cover this lockfile");

      let verdict;
      if (major && (calls.length > 0 || (notes !== "read" && files !== null && files >= WIDE_USE_FILES))) {
        verdict = LABEL.warning;
      } else if ((jump === "patch" || jump === "minor") && !unreadable && !row.notAudited && !row.runtimeNotChecked && (row.inRange === true || row.pinned) && notes === "read" && !breaking && covered && !noChecks) {
        verdict = LABEL.safe;
      } else {
        verdict = LABEL.check;
      }
      result.push({ id: row.id, label: verdict, reasons });
    }
  }
  return result;
}

function readRecords(file) {
  if (!file) fail(EXIT.USAGE, "missing-records", "--records is required.", "Pass the JSON file of helper records.");
  let text;
  try {
    text = fs.readFileSync(path.resolve(file), "utf8");
  } catch {
    fail(EXIT.NOT_FOUND, "records-missing", `${file} does not exist.`, "Write the helpers' records to a file and pass it.");
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail(EXIT.INVALID, "records-invalid", `${file} is not valid JSON.`, "Pass a JSON array of records, or { records: [...] }.");
  }
  const records = Array.isArray(json) ? json : json && Array.isArray(json.records) ? json.records : null;
  if (!records) fail(EXIT.INVALID, "records-invalid", `${file} holds no records array.`, "Pass a JSON array of records, or { records: [...] }.");
  return records;
}

function needScan(dir) {
  const scan = readRun(dir, "scan.json");
  if (!scan) fail(EXIT.NOT_FOUND, "scan-missing", "The run folder has no scan.json.", "Run scan first.");
  return scan;
}

function cmdLabel(argv) {
  const args = parseArgs(argv, { values: ["run", "records"] });
  const dir = runDir(args.run);
  const scan = needScan(dir);
  const records = readRecords(args.records);
  const labels = label(scan, records);
  // handoff reads the records again (breaking lines, notes url, calls) from the run folder.
  writeRun(dir, "records.json", records);
  writeRun(dir, "labels.json", labels);
  out({ ok: true, labels });
}

/* ======================================================================
 * 6. Batches
 * ==================================================================== */

// Batches by label: every Safe pick of a lockfile in one batch, every Check
// first and Warning pick alone; picks that move together (a pair) stay in one
// batch, in the riskier one's place. Narrowing a failed batch: over 6 picks
// halve it, 6 or fewer one at a time.

export const SPLIT_ONE_AT_A_TIME = 6;

/** Rows by id with their lockfile, and a pair-group key per row (rows naming each other or sharing a pair value). */
function rowIndex(scan) {
  const rows = new Map();
  const order = [];
  for (const lock of (scan && scan.lockfiles) || []) {
    for (const row of lock.rows || []) {
      rows.set(row.id, { row, lockfile: lock.lockfile });
      order.push(row.id);
    }
  }
  // Union rows that pair: row.pair names another row's id, or two rows share a pair value.
  const parent = new Map(order.map((id) => [id, id]));
  const find = (id) => {
    while (parent.get(id) !== id) id = parent.get(id);
    return id;
  };
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const byPair = new Map();
  for (const id of order) {
    const pair = rows.get(id).row.pair;
    if (pair === null || pair === undefined || pair === "") continue;
    if (rows.has(pair)) join(id, pair);
    if (byPair.has(pair)) join(id, byPair.get(pair));
    else byPair.set(pair, id);
  }
  return { rows, order, group: (id) => find(id) };
}

/** Split picks into units: picks that pair stay one unit, in pick order. */
function units(index, picks) {
  const groups = new Map();
  for (const id of picks) {
    const key = index.rows.has(id) ? index.group(id) : id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  return [...groups.values()];
}

/**
 * Plan batches from picks. labels: [{ id, label }] (or a map of id to label).
 * Returns { batches: [{ id, lockfile, picks[] }], unknown[] }: Safe batches
 * first, then by lockfile, then in scan order.
 */
export function planBatches(scan, labels, picks) {
  const index = rowIndex(scan);
  const labelOf = new Map(Array.isArray(labels) ? labels.map((l) => [l.id, l.label]) : Object.entries(labels || {}));
  const unknown = picks.filter((id) => !index.rows.has(id));
  const known = [...new Set(picks.filter((id) => index.rows.has(id)))].sort((a, b) => index.order.indexOf(a) - index.order.indexOf(b));
  const lockOrder = [];
  for (const id of index.order) {
    const lf = index.rows.get(id).lockfile;
    if (!lockOrder.includes(lf)) lockOrder.push(lf);
  }
  const safe = new Map();
  const alone = [];
  for (const unit of units(index, known)) {
    const lockfile = index.rows.get(unit[0]).lockfile;
    if (unit.every((id) => labelOf.get(id) === LABEL.safe)) {
      if (!safe.has(lockfile)) safe.set(lockfile, []);
      safe.get(lockfile).push(...unit);
    } else {
      alone.push({ lockfile, picks: unit });
    }
  }
  const byLock = (a, b) => lockOrder.indexOf(a.lockfile) - lockOrder.indexOf(b.lockfile);
  const ordered = [
    ...[...safe.entries()].map(([lockfile, p]) => ({ lockfile, picks: p })).sort(byLock),
    ...alone.map((b, i) => ({ ...b, i })).sort((a, b) => byLock(a, b) || a.i - b.i).map(({ lockfile, picks: p }) => ({ lockfile, picks: p })),
  ];
  return { batches: ordered.map((b, i) => ({ id: `b${i + 1}`, lockfile: b.lockfile, picks: b.picks })), unknown };
}

/**
 * Narrow a failed batch. Over 6 picks: two halves, pairs never split. 6 or
 * fewer: one batch per pick, a pair as one. A batch that is a single pair is
 * retried as the pair. A single pick cannot be split: returns null.
 */
export function splitBatch(scan, batch) {
  const index = rowIndex(scan);
  const parts = units(index, batch.picks);
  let groups;
  if (batch.picks.length > SPLIT_ONE_AT_A_TIME && parts.length > 1) {
    const half = Math.ceil(batch.picks.length / 2);
    const first = [];
    let count = 0;
    let i = 0;
    while (i < parts.length - 1 && (count === 0 || count + parts[i].length <= half)) {
      first.push(...parts[i]);
      count += parts[i].length;
      i++;
    }
    groups = [first, parts.slice(i).flat()];
  } else if (parts.length > 1) {
    groups = parts;
  } else if (batch.picks.length > 1) {
    groups = [batch.picks.slice()];
  } else {
    return null;
  }
  return groups.map((picks, i) => ({ id: `${batch.id}.${i + 1}`, lockfile: batch.lockfile, picks }));
}

function cmdBatches(argv) {
  const args = parseArgs(argv, { values: ["run", "picks", "split"] });
  const dir = runDir(args.run);
  if (Boolean(args.picks) === Boolean(args.split)) fail(EXIT.USAGE, "picks-or-split", "Pass exactly one of --picks or --split.", "--picks a,b plans batches; --split <batch> narrows a failed one.");
  const scan = needScan(dir);
  if (args.picks) {
    const picks = args.picks.split(",").map((s) => s.trim()).filter(Boolean);
    if (!picks.length) fail(EXIT.USAGE, "no-picks", "--picks names no rows.", "Pass the picked row ids, comma-separated.");
    const labels = readRun(dir, "labels.json");
    if (!labels) fail(EXIT.NOT_FOUND, "labels-missing", "The run folder has no labels.json.", "Run label first.");
    const { batches, unknown } = planBatches(scan, labels, picks);
    if (unknown.length) fail(EXIT.NOT_FOUND, "unknown-pick", `No row ${unknown.join(", ")} in scan.json.`, "Pick ids from the scan.", { unknown });
    writeRun(dir, "batches.json", { batches });
    out({ ok: true, batches });
    return;
  }
  const saved = readRun(dir, "batches.json");
  if (!saved || !Array.isArray(saved.batches)) fail(EXIT.NOT_FOUND, "batches-missing", "The run folder has no batches.json.", "Run batches --picks first.");
  const at = saved.batches.findIndex((b) => b.id === args.split);
  if (at === -1) fail(EXIT.NOT_FOUND, "unknown-batch", `No batch ${args.split} in batches.json.`, `One of: ${saved.batches.map((b) => b.id).join(", ")}.`);
  const parts = splitBatch(scan, saved.batches[at]);
  if (!parts) fail(EXIT.INVALID, "cannot-split", `Batch ${args.split} holds one pick and cannot be split.`, "That pick is the one that breaks: put it back and mark it failed.");
  saved.batches.splice(at, 1, ...parts);
  writeRun(dir, "batches.json", saved);
  out({ ok: true, split: args.split, batches: parts });
}

/* ======================================================================
 * 7. Notes
 * ==================================================================== */

// Release-note slices for the assess step. The repo comes from the row (npm's
// scan --notes) or the registry; the notes from GitHub releases (gh when it is
// installed, else a plain fetch), else the repo's CHANGELOG.md or CHANGES.md.
// Only the text between the installed and the target version is printed.
// Every request stops after 15 s and a failure is never thrown: it ends as
// source "none", which the label rules read as notes that could not be read.

/** One notes request (a fetch or a gh call) may run this long. */
export const NOTES_TIMEOUT_MS = 15 * 1000;
/** The notes text printed is capped at this many bytes (truncated says so). */
export const NOTES_CAP_BYTES = 32 * 1024;
const USER_AGENT = "plan2code-deps";

/** A URL as fetched: under PLAN2CODE_DEPS_HTTP_BASE (tests only) as <base>/<host><path><query>. */
function httpUrl(url) {
  const base = process.env.PLAN2CODE_DEPS_HTTP_BASE;
  if (!base) return url;
  const u = new URL(url);
  return `${base.replace(/\/+$/, "")}/${u.host}${u.pathname}${u.search}`;
}

/** The body of a GET as text; null on any failure (a timeout, a refused connection, a non-2xx answer). Never throws. */
export async function fetchText(url, { timeoutMs = NOTES_TIMEOUT_MS } = {}) {
  try {
    const r = await fetch(httpUrl(url), { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/** The body of a GET as JSON; null on any failure or a body that is not JSON. Never throws. */
export async function fetchJson(url, opts) {
  const text = await fetchText(url, opts);
  if (text === null) return null;
  const json = parseJson(text);
  return json === undefined ? null : json;
}

/** `gh api <path>` as JSON when gh is on PATH; null when it is not there, fails or prints no JSON. */
export function ghApi(apiPath) {
  if (!findTool("gh")) return null;
  const r = spawnTool("gh", ["api", apiPath], { timeoutMs: NOTES_TIMEOUT_MS });
  if (r.code !== 0) return null;
  const json = parseJson(r.stdout);
  return json === undefined ? null : json;
}

/** owner/name for a GitHub repository URL, git remote, github:owner/name or owner/name shorthand; null otherwise. */
export function githubRepo(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim();
  const m = s.match(/^(?:github:)?([A-Za-z0-9-]+)\/([\w.-]+)$/) || s.match(/(?:^|\/\/|@)(?:www\.)?github\.com[/:]([A-Za-z0-9-]+)\/([\w.-]+)/i);
  if (!m) return null;
  const name = m[2].replace(/\.git$/i, "");
  return name && name !== "." && name !== ".." ? `${m[1]}/${name}` : null;
}

/** The first GitHub repo among PyPI's project_urls (source-like keys first) and home_page. */
function pypiRepo(info) {
  if (!info || typeof info !== "object") return null;
  const urls = info.project_urls && typeof info.project_urls === "object" ? Object.entries(info.project_urls) : [];
  const ranked = [...urls.filter(([k]) => /source|repo|code|github/i.test(k)), ...urls];
  for (const [, url] of ranked) {
    const repo = githubRepo(url);
    if (repo) return repo;
  }
  return githubRepo(info.home_page);
}

/** projectUrl from a NuGet registration index, newest entry first (pages that are not inlined are fetched). */
async function nugetRepo(id) {
  const index = await fetchJson(`https://api.nuget.org/v3/registration5-semver1/${id.toLowerCase()}/index.json`);
  if (!index || !Array.isArray(index.items)) return null;
  for (const page of [...index.items].reverse()) {
    const items = Array.isArray(page.items) ? page.items : page["@id"] ? ((await fetchJson(page["@id"])) || {}).items : null;
    for (const leaf of [...(items || [])].reverse()) {
      const repo = githubRepo(leaf && leaf.catalogEntry && leaf.catalogEntry.projectUrl);
      if (repo) return repo;
    }
  }
  return null;
}

/**
 * The GitHub repo of a row as owner/name: the row's repo when set, else the
 * registry's record (npm view, crates.io, PyPI, the Go module path, NuGet's
 * registration). null when none names a GitHub repo or the lookup fails.
 */
export async function repoOf(row, { ecosystem, adapter, cwd } = {}) {
  const own = githubRepo(row && row.repo);
  if (own || !row || !row.package) return own;
  const name = row.package;
  if (adapter === "npm" || (!adapter && ecosystem === "npm")) {
    if (!findTool("npm")) return null;
    const r = spawnTool("npm", ["view", name, "repository.url", "--json"], { cwd, timeoutMs: NOTES_TIMEOUT_MS });
    const parsed = r.code === 0 ? parseJson(r.stdout) : undefined;
    return githubRepo(typeof parsed === "string" ? parsed : Array.isArray(parsed) ? parsed[parsed.length - 1] : null);
  }
  if (ecosystem === "cargo") {
    const json = await fetchJson(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`);
    return githubRepo(json && json.crate && json.crate.repository);
  }
  if (ecosystem === "python") {
    const json = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
    return pypiRepo(json && json.info);
  }
  if (ecosystem === "go") return name.startsWith("github.com/") ? githubRepo(name) : null;
  if (ecosystem === "nuget") return nugetRepo(name);
  return null;
}

/** after < v <= upTo, by the ecosystem's version order; false when any version cannot be read. */
function between(ecosystem, v, after, upTo) {
  return compareVersions(ecosystem, v, after) === 1 && [-1, 0].includes(compareVersions(ecosystem, v, upTo));
}


/**
 * The version a release tag names, or null: "v1.2.3", "1.2.3", "release-1.2.3",
 * "<package>-v1.2.3" and "<package>@1.2.3". In a monorepo another package's
 * tag ("storage-v7.0.0", "chalk-template@1.0.0") is null.
 */
export function tagVersion(ecosystem, tag, pkg) {
  let t = String(tag || "").trim();
  const names = pkg ? [String(pkg), String(pkg).split("/").pop()] : [];
  const at = t.lastIndexOf("@");
  if (at > 0) {
    const prefix = t.slice(0, at);
    if (pkg && !names.includes(prefix)) return null;
    t = t.slice(at + 1);
  }
  const prefix = t.match(/^\D*/)[0];
  const plain = /^(?:version|release|rel)?[-_ ]?v?$/i.test(prefix);
  if (!plain && !names.some((n) => new RegExp(`^${escapeRe(String(n))}[-_ ]?v?$`, "i").test(prefix))) return null;
  const v = t.slice(prefix.length);
  return v && parseVersion(ecosystem, v) ? v : null;
}

/**
 * Releases whose tag version is after current and up to target, newest first,
 * as one markdown text ("" for none). A release with no body says nothing, so
 * it is left out: notes kept only in a changelog are then read from there.
 */
export function sliceReleases(releases, { ecosystem, package: pkg, current, target }) {
  const kept = (Array.isArray(releases) ? releases : [])
    .filter((r) => r && !r.draft && String(r.body || "").trim())
    .map((r) => ({ r, v: tagVersion(ecosystem, r.tag_name, pkg) }))
    .filter(({ v }) => v && between(ecosystem, v, current, target))
    .sort((a, b) => compareVersions(ecosystem, b.v, a.v));
  return kept
    .map(({ r }) => {
      const title = r.name && r.name !== r.tag_name ? `${r.tag_name} (${r.name})` : r.tag_name;
      return `## ${title}\n\n${String(r.body).trim()}`;
    })
    .join("\n\n");
}

/** The version a changelog heading names ("[1.2.3] - 2026-01-02", "v1.2.3", "Version 1.2.3"), or null. */
function headingVersion(ecosystem, text) {
  const m = String(text).match(/(?:^|[^\w.])v?(\d+\.\d+(?:\.\d+)*(?:-[0-9A-Za-z.]+)?)/);
  return m && parseVersion(ecosystem, m[1]) ? m[1] : null;
}

/**
 * A changelog's sections for versions after current and up to target. The
 * version headings are the ATX headings naming a version, at the level of the
 * first one; each section runs to the next heading at that level or above.
 * "" when no section falls between the two versions.
 */
export function sliceChangelog(text, { ecosystem, current, target }) {
  const lines = String(text || "").split(/\r?\n/);
  const heads = [];
  let fence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) return;
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) heads.push({ i, level: m[1].length, version: headingVersion(ecosystem, m[2]) });
  });
  const first = heads.find((h) => h.version);
  if (!first) return "";
  const parts = [];
  heads.forEach((h, n) => {
    if (h.level !== first.level || !h.version || !between(ecosystem, h.version, current, target)) return;
    const next = heads.slice(n + 1).find((x) => x.level <= h.level);
    parts.push(lines.slice(h.i, next ? next.i : lines.length).join("\n").trim());
  });
  return parts.join("\n\n");
}

/** text capped at NOTES_CAP_BYTES of UTF-8, never cutting a character in half. */
function capText(text) {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length <= NOTES_CAP_BYTES) return { text, truncated: false };
  return { text: bytes.subarray(0, NOTES_CAP_BYTES).toString("utf8").replace(/�+$/, ""), truncated: true };
}

/** A row and its lockfile from scan.json by id; null when there is none. */
function findRow(scan, id) {
  for (const lock of (scan && scan.lockfiles) || []) {
    const row = (lock.rows || []).find((r) => r.id === id);
    if (row) return { row, lock };
  }
  return null;
}

async function cmdNotes(argv) {
  const args = parseArgs(argv, { values: ["run", "id"] });
  const dir = runDir(args.run);
  if (!args.id) fail(EXIT.USAGE, "missing-id", "--id is required.", "Pass a row id from scan.json (<lockfile>#<package>).");
  const scan = needScan(dir);
  const found = findRow(scan, args.id);
  if (!found) fail(EXIT.NOT_FOUND, "unknown-row", `No row ${args.id} in scan.json.`, "Pass a row id from scan.json (<lockfile>#<package>).");
  const { row, lock } = found;
  const ecosystem = lock.ecosystem;
  const cwd = path.join(scan.root || process.cwd(), dirOf(lock.lockfile));
  const repo = await repoOf(row, { ecosystem, adapter: lock.adapter, cwd });
  const want = { ecosystem, package: row.package, current: row.current, target: row.target };
  let source = "none";
  let url = null;
  let text = "";
  if (repo) {
    const releasesPath = `repos/${repo}/releases?per_page=100`;
    let releases = ghApi(releasesPath);
    let via = "gh";
    if (!Array.isArray(releases)) {
      releases = await fetchJson(`https://api.github.com/${releasesPath}`);
      via = "fetch";
    }
    const sliced = sliceReleases(releases, want);
    if (sliced) {
      source = via;
      url = `https://github.com/${repo}/releases`;
      text = sliced;
    } else {
      for (const name of ["CHANGELOG.md", "CHANGES.md"]) {
        const file = await fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/${name}`);
        const slice = file ? sliceChangelog(file, want) : "";
        if (!slice) continue;
        source = "changelog";
        url = `https://github.com/${repo}/blob/HEAD/${name}`;
        text = slice;
        break;
      }
    }
  }
  const capped = capText(text);
  out({ ok: true, id: row.id, package: row.package, current: row.current, target: row.target, repo, source, url, text: capped.text, truncated: capped.truncated });
}

/* ======================================================================
 * 8. Hand-off
 * ==================================================================== */

// The UPGRADE-<date>.md brief, written only for the rows the person ticks on
// the end-of-run card: one per package, a pair sharing one. It is the only
// file this script writes outside manifests and lockfiles, always under
// specs/<package>-upgrade/, and it holds what Quick Task or Plan need to start
// without a second scan (PLAN-DRAFT section 4.5's format).

/** The brief's folder name: specs/<package>-upgrade, a scoped npm name as scope-name, any path separator as -. */
export function upgradeFolder(pkg) {
  const name = String(pkg || "")
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|-+$/g, "");
  return `${name || "package"}-upgrade`;
}

const LABEL_TEXT = { safe: "Safe", "check-first": "Check first", warning: "Warning" };

/**
 * The brief's markdown. parts: one per package, in order, each { row, lock,
 * label ({ label, reasons }), record (a helper record or null) }; the first
 * also carries apply ({ command, cwd }), the command apply would run. Pure.
 */
export function upgradeBrief(parts) {
  const many = parts.length > 1;
  const first = parts[0];
  const lock = first.lock;
  const eco = lock.manager && lock.manager !== lock.ecosystem ? `${lock.ecosystem} (${lock.manager})` : lock.ecosystem;
  const heading = (p) => (many ? [`### ${p.row.package}`, ""] : []);
  const lines = [`# Upgrade ${parts.map((p) => `${p.row.package} ${p.row.current} to ${p.row.target}`).join(" and ")}`, ""];
  lines.push("**Status:** Ready", `**Ecosystem:** ${eco}`, `**Folder:** ${dirOf(lock.lockfile)}`, "");

  lines.push("## Why it was held back", "");
  for (const p of parts) {
    const reasons = p.label && p.label.reasons && p.label.reasons.length ? ` (${p.label.reasons.join(", ")})` : "";
    lines.push(`- **${p.row.package}**: ${LABEL_TEXT[p.label && p.label.label] || (p.label && p.label.label) || "not labeled"}${reasons}`);
  }
  lines.push("");

  lines.push("## What the notes say changed", "");
  for (const p of parts) {
    lines.push(...heading(p));
    const rec = p.record || {};
    const breaking = Array.isArray(rec.breaking) ? rec.breaking.filter((l) => typeof l === "string" && l.trim()) : [];
    // Every line of a breaking note stays inside its quote.
    if (breaking.length) for (const l of breaking) lines.push(l.trim().split(/\r?\n/).map((x) => `> ${x}`.trimEnd()).join("\n"), "");
    else lines.push(rec.notes === "read" ? "The notes quote no breaking lines." : rec.notes === "could not read" ? "The notes could not be read." : "The notes were not read.", "");
    if (rec.url || rec.source) lines.push(`Source: ${[rec.source, rec.url].filter(Boolean).join(", ")}`, "");
  }

  lines.push("## Where the code calls it", "");
  for (const p of parts) {
    lines.push(...heading(p));
    const calls = p.record && Array.isArray(p.record.calls) ? p.record.calls.filter((c) => c && c.file) : [];
    if (calls.length) for (const c of calls) lines.push(`- \`${c.file}${c.line ? `:${c.line}` : ""}\`${c.api ? ` (${c.api})` : ""}`);
    else lines.push("No call sites were found.");
    lines.push("");
  }

  lines.push("## Checks that cover it", "");
  const seen = new Set();
  for (const p of parts) {
    if (seen.has(p.lock.lockfile)) continue;
    seen.add(p.lock.lockfile);
    const checks = p.lock.checks || {};
    const commands = [...(checks.commands || []), ...(checks.discovered || []).map((d) => (typeof d === "string" ? d : d && (d.command || d.run)))].filter(Boolean);
    if (checks.full) lines.push("- A shared test map row covers it: run the full suite.");
    for (const c of [...new Set(commands)]) lines.push(`- \`${c}\``);
    if (!checks.full && !commands.length) lines.push(`No checks cover ${p.lock.lockfile}.`);
  }
  lines.push("");

  lines.push("## How to apply", "");
  for (const p of parts) {
    const range = p.row.range;
    const files = (p.row.declaredIn || []).map((d) => d.file).filter(Boolean);
    const where = files.length ? ` in ${[...new Set(files)].join(", ")}` : "";
    if (range && range.from && range.to && range.to !== range.from) lines.push(`- Raise the ${p.row.package} range${where}: \`${range.from}\` to \`${range.to}\`.`);
    else if (range && range.from && !range.to) lines.push(`- The ${p.row.package} range \`${range.from}\`${where} does not take ${p.row.target}: rewrite it by hand first.`);
  }
  const apply = first.apply;
  if (apply && apply.command) lines.push(`- In \`${apply.cwd}\`, run:`, "", "```", apply.command, "```");
  else lines.push("- No update command could be built for this lockfile.");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function cmdHandoff(argv) {
  const args = parseArgs(argv, { values: ["run", "ids"] });
  const dir = runDir(args.run);
  const ids = [...new Set(String(args.ids || "").split(",").map((s) => s.trim()).filter(Boolean))];
  if (!ids.length) fail(EXIT.USAGE, "missing-ids", "--ids is required.", "Pass the ticked row ids, comma-separated.");
  const scan = needScan(dir);
  const labels = readRun(dir, "labels.json");
  if (!Array.isArray(labels)) fail(EXIT.NOT_FOUND, "labels-missing", "The run folder has no labels.json.", "Run label first.");
  const labelOf = new Map(labels.map((l) => [l && l.id, l]));
  const index = rowIndex(scan);
  const unknown = ids.filter((id) => !labelOf.has(id) || !index.rows.has(id));
  if (unknown.length) fail(EXIT.NOT_FOUND, "unknown-id", `No labeled row ${unknown.join(", ")}.`, "Pass ids from labels.json.", { unknown });
  const saved = readRun(dir, "records.json");
  const records = Array.isArray(saved) ? saved : saved && Array.isArray(saved.records) ? saved.records : [];
  const recordOf = new Map(records.map((r) => [r && r.id, r]));
  const root = scan.root;
  const specs = path.join(root, "specs");
  // Every brief is checked before any is written, so a refusal leaves specs/ as it was.
  // One package ticked in two lockfiles gets a brief each: a later one names its lockfile's folder.
  const claimed = new Set();
  const briefs = units(index, ids).map((group) => {
    const parts = group.map((id) => {
      const { row } = index.rows.get(id);
      const lock = scan.lockfiles.find((l) => (l.rows || []).includes(row));
      return { row, lock, label: labelOf.get(id), record: recordOf.get(id) || null };
    });
    const { lock } = parts[0];
    const adapter = adapterOf(lock.adapter);
    const calls = adapter ? [].concat(adapter.applyCommand({ id: "handoff", lockfile: lock.lockfile, picks: group, rows: parts.map((p) => p.row) }, lock, root)) : [];
    parts[0].apply = calls.length ? { command: calls.map(commandLine).join(" && "), cwd: relTo(root, calls[0].cwd) } : null;
    const pkg = parts[0].row.package;
    let folder = upgradeFolder(pkg);
    if (claimed.has(folder)) folder = upgradeFolder(`${pkg}-${dirOf(lock.lockfile) === "." ? "root" : dirOf(lock.lockfile)}`);
    claimed.add(folder);
    const file = path.join(specs, folder, `UPGRADE-${compactDate()}.md`);
    const rel = path.relative(specs, file);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) fail(EXIT.REFUSED, "outside-specs", `${folder} would be written outside specs/.`, "Nothing was written.");
    return { group, parts, folder, file };
  });
  const written = [];
  for (const { group, parts, folder, file } of briefs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, upgradeBrief(parts));
    written.push({ file: relTo(root, file), folder: `specs/${folder}`, ids: group, packages: parts.map((p) => p.row.package) });
  }
  out({ ok: true, written });
}

/* ======================================================================
 * Dispatch
 * ==================================================================== */

const COMMANDS = {
  detect: cmdDetect,
  scan: cmdScan,
  notes: cmdNotes,
  label: cmdLabel,
  batches: cmdBatches,
  backup: cmdBackup,
  apply: cmdApply,
  restore: cmdRestore,
  handoff: cmdHandoff,
  cleanup: cmdCleanup,
};

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command) fail(EXIT.USAGE, "missing-command", "Name a command.", `One of: ${Object.keys(COMMANDS).join(", ")}. Run with --help for usage.`);
  const handler = COMMANDS[command];
  if (!handler) fail(EXIT.USAGE, "unknown-command", `Unknown command "${command}".`, `One of: ${Object.keys(COMMANDS).join(", ")}. Run with --help for usage.`);
  await handler(rest);
}

// Run as a script; imported (the tests import the pure pieces), do nothing.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) run(USAGE, main);
