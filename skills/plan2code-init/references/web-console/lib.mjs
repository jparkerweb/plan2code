// Plan2Code Web Console - shared helpers.
//
// Two directories with deliberately different durability:
//
//   runtime handle  os.tmpdir()/plan2code-console/<cwd-hash>/<sid>.json
//                   port, pid, token, url. Losing it on reboot is correct,
//                   because the server is gone too. (Jupyter's jpserver-<pid>.json pattern.)
//
//   session state   ~/.plan2code/console/sessions/<sid>/
//                   the request, the human's draft, the result, the event log.
//                   Deliberately NOT under specs/: that keeps the console clear of
//                   the metrics confidence scraper and the loop's completion-marker
//                   parser, and it survives a `git clean`.
//
// Node built-ins only. No build step.

import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { CHAT_LIMIT } from "./public/chat.js";
import { DOC_TYPES } from "./public/answers.js";
import { defaultName } from "./public/workspace.js";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.join(HERE, "public");

export const HOME_DIR =
  process.env.PLAN2CODE_CONSOLE_HOME ||
  path.join(os.homedir(), ".plan2code", "console");
export const SESSIONS_DIR = path.join(HOME_DIR, "sessions");

// The person's own settings (colors, theme), shared by every session. Lives in
// HOME_DIR rather than beside a session precisely because it is NOT session
// state: a browser ties localStorage to the origin, and the origin carries the
// ephemeral port, so the file under this dir is the only copy of a preference
// that survives the next session's new port.
export const LOOKS_FILE = path.join(HOME_DIR, "looks.json");

// The runtime dir has to follow PLAN2CODE_CONSOLE_HOME too. Without that, a
// test run (or a second sandboxed instance) shares one handle directory with
// the real thing, and `stop --all` reaches outside its own world and kills a
// session someone is actually using.
export const RUNTIME_DIR = process.env.PLAN2CODE_CONSOLE_HOME
  ? path.join(process.env.PLAN2CODE_CONSOLE_HOME, "runtime")
  : path.join(os.tmpdir(), "plan2code-console");

export const SCHEMA = 1;

/* ------------------------------------------------------------------ args */

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > -1) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

export function print(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

export function die(msg, code = 1) {
  process.stderr.write("console: " + msg + "\n");
  process.exit(code);
}

/* ------------------------------------------------------------------- fs */

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Atomic replace. The waiter polls result.json and WILL land mid-write eventually.
//
// The retry loop is not paranoia: on Windows, antivirus and the search indexer
// hold transient locks that surface as EPERM/EBUSY from rename. It is intermittent,
// unreproducible on demand, and looks exactly like a logic bug. Retry from day one.
export function writeJsonAtomic(file, data) {
  const tmp = file + "." + process.pid + ".tmp";
  const body = JSON.stringify(data, null, 2);
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const fd = fs.openSync(tmp, "w");
      try {
        fs.writeFileSync(fd, body);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmp, file);
      return body;
    } catch (err) {
      lastErr = err;
      if (err.code !== "EPERM" && err.code !== "EBUSY" && err.code !== "EACCES") break;
      sleepSync(40 * (attempt + 1));
    }
  }
  try {
    fs.rmSync(tmp, { force: true });
  } catch {}
  throw lastErr;
}

// A cheap "has this file changed?" fingerprint: one stat instead of a read and
// a parse. An atomic write replaces the file, so a new write always moves at
// least one of these. "" for a file that is not there.
export function fileStamp(file) {
  try {
    const st = fs.statSync(file, { throwIfNoEntry: false });
    return st ? `${st.mtimeMs}:${st.size}:${st.ino}` : "";
  } catch {
    return "";
  }
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function appendEvent(dir, event) {
  const line = JSON.stringify({ at: nowIso(), ...event });
  fs.appendFileSync(path.join(dir, "events.ndjson"), line + "\n");
  return line;
}

export function sleepSync(ms) {
  // Node built-ins only, and this runs in short one-shot CLI commands.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function nowIso() {
  return new Date().toISOString();
}

/* -------------------------------------------------------------- sessions */

// Both roots a session needs, found the way git discovers a repository: walk
// up to the first `.git`, follow a `gitdir:` file (a linked worktree or a
// submodule) and its `commondir`. Read off the filesystem rather than asked of
// `git rev-parse`, because on Windows each git process costs 150ms or more
// and `open` sits between the person and their first look at the page.
//
//   project   the COMMON dir's parent, so every worktree shares a project key
//   worktree  the checkout's own top level, where its specs/ lives
//   branch    the checkout's current branch, read from its own git dir's HEAD
//             (so a linked worktree reports its own branch, not the main
//             checkout's); "" on a detached HEAD or outside a repository
//
// The environment variables that relocate a repository are git's business,
// so when one is set this asks git, exactly as it used to.
const rootsCache = new Map();

export function repoRoots(cwd = process.cwd()) {
  const key = path.resolve(cwd);
  if (!rootsCache.has(key)) rootsCache.set(key, findRoots(key));
  return rootsCache.get(key);
}

function findRoots(cwd) {
  // The native realpath, like git, spells the path out in full: an 8.3 short
  // name in the cwd (C:\Users\JUSTIN~1.PAR) must key the same project as the
  // long one, or two spellings of one checkout get separate handle spaces.
  const real = (p) => {
    for (const fn of [fs.realpathSync.native, fs.realpathSync]) {
      try {
        return fn(p);
      } catch {}
    }
    return p;
  };
  if (process.env.GIT_DIR || process.env.GIT_WORK_TREE || process.env.GIT_COMMON_DIR) {
    try {
      // The branch comes off the git dir's HEAD, as in the walk below, not
      // from `--abbrev-ref HEAD`: that fails the whole call on a repository
      // with no commits yet, and cannot name an unborn branch anyway.
      const [common, top, gitDir] = execFileSync(
        "git",
        ["rev-parse", "--path-format=absolute", "--git-common-dir", "--show-toplevel", "--absolute-git-dir"],
        { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }
      )
        .trim()
        .split(/\r?\n/);
      if (common) {
        return {
          project: real(path.dirname(common)),
          worktree: real(top || cwd),
          branch: gitDir ? branchAt(gitDir) : "",
        };
      }
    } catch {}
    return { project: real(cwd), worktree: real(cwd), branch: "" };
  }
  for (let dir = cwd; ; ) {
    const git = gitDirAt(dir);
    if (git) {
      const common = readText(path.join(git, "commondir")).trim();
      const commonDir = common ? path.resolve(git, common) : git;
      return { project: real(path.dirname(commonDir)), worktree: real(dir), branch: branchAt(git) };
    }
    const up = path.dirname(dir);
    if (up === dir) return { project: real(cwd), worktree: real(cwd), branch: "" };
    dir = up;
  }
}

// The branch a git dir's HEAD names: `ref: refs/heads/<name>` gives <name>.
// A bare hash (a detached HEAD) or an unreadable file gives "".
function branchAt(gitDir) {
  const m = /^ref:\s*refs\/heads\/(.+?)\s*$/m.exec(readText(path.join(gitDir, "HEAD")));
  return m ? m[1] : "";
}

// The git dir that `<dir>/.git` names, or null when there is no usable one.
// A directory without HEAD is not a repository, and git keeps walking past it.
function gitDirAt(dir) {
  const dotGit = path.join(dir, ".git");
  let st;
  try {
    st = fs.statSync(dotGit);
  } catch {
    return null;
  }
  let git = dotGit;
  if (st.isFile()) {
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(readText(dotGit));
    if (!m) return null;
    git = path.resolve(dir, m[1]);
  }
  return fs.existsSync(path.join(git, "HEAD")) ? git : null;
}

export function projectRoot(cwd = process.cwd()) {
  return repoRoots(cwd).project;
}

// The worktree's own top level. projectRoot() keys sessions on the COMMON git
// dir so every worktree shares one handle space -- but the specs a dashboard
// shows are the ones on disk under the caller, so the scan roots here instead.
export function worktreeRoot(cwd = process.cwd()) {
  return repoRoots(cwd).worktree;
}

export function cwdHash(dir) {
  return crypto.createHash("sha1").update(dir.toLowerCase()).digest("hex").slice(0, 8);
}

export function newSessionId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
  return `${stamp}-${crypto.randomBytes(3).toString("hex")}`;
}

export function sessionDir(sid) {
  return path.join(SESSIONS_DIR, sid);
}

export const UPLOAD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_ID = /^\d{8}-\d{6}-[0-9a-f]{6}$/;

/**
 * Remove the attachments uploaded in sessions nobody has touched for a month.
 *
 * "Touched" is state.json's mtime: every agent post and every page send writes
 * it. Only the `uploads` child of a directory shaped like a session id is ever
 * removed -- session text (state, drafts, results, events) is never touched --
 * and the path is built from `sessionsDir` plus that validated name, never from
 * anything a client sent. Resolves to the sids swept.
 */
export async function sweepUploads(sessionsDir, now, maxAgeMs, skipSid) {
  let entries;
  try {
    entries = await fs.promises.readdir(sessionsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const swept = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === skipSid || !SESSION_ID.test(entry.name)) continue;
    const dir = path.join(sessionsDir, entry.name);
    try {
      const { mtimeMs } = await fs.promises.stat(path.join(dir, "state.json"));
      if (now - mtimeMs <= maxAgeMs) continue;
      await fs.promises.rm(path.join(dir, "uploads"), { recursive: true, force: true });
      swept.push(entry.name);
    } catch {}
  }
  return swept;
}

// The name a kept attachment gets under specs/<idea>/attachments/: the same upload always yields the same name.
export function attachmentName({ upload, name }) {
  const label = typeof name === "string" ? name : "";
  const slug =
    label
      .slice(0, label.length - path.extname(label).length)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "attachment";
  const base = path.basename(String(upload || ""));
  return `${slug}-${base.slice(0, 8)}${path.extname(base).toLowerCase()}`;
}

// Sessions and their uploads age out on the same clock: a month untouched.
export const SESSION_MAX_AGE_MS = UPLOAD_MAX_AGE_MS;

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");

/**
 * Whether an uploaded document is what its extension says: null when it is,
 * "type" when it is not. The browser's MIME type and the file name are both
 * claims the client makes; only the bytes are evidence. A PDF must open with
 * `%PDF-`; a text file must be strict UTF-8 with no NUL byte, which is what
 * keeps a renamed binary out. An empty text file is fine.
 */
export function checkDocument(buf, ext) {
  const type = Object.prototype.hasOwnProperty.call(DOC_TYPES, ext) ? DOC_TYPES[ext] : null;
  if (!type) return "type";
  if (type.kind === "pdf") {
    return buf.length >= PDF_MAGIC.length && buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC) ? null : "type";
  }
  if (buf.includes(0)) return "type";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return "type";
  }
  return null;
}

/**
 * The sessions nobody has touched for `maxAgeMs`: names of directories shaped
 * like a session id (never `skipSid`) whose state.json mtime is that old.
 * A directory with no readable state.json is skipped, never guessed at.
 *
 * Synchronous, because `open` reports the list before it prints and deletes
 * after. No exceptions for paused sessions or unread sends: a month-old
 * session is gone whole (a locked decision).
 */
export function staleSessions(sessionsDir, now, maxAgeMs, skipSid) {
  let entries;
  try {
    entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const stale = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === skipSid || !SESSION_ID.test(entry.name)) continue;
    try {
      const { mtimeMs } = fs.statSync(path.join(sessionsDir, entry.name, "state.json"));
      if (now - mtimeMs > maxAgeMs) stale.push(entry.name);
    } catch {}
  }
  return stale;
}

/**
 * Remove whole session directories. Every name is re-checked against the
 * session-id pattern, and the path is built only from `sessionsDir` plus that
 * validated name. Resolves to the sids actually removed.
 */
export async function removeSessions(sessionsDir, sids) {
  const removed = [];
  for (const sid of sids) {
    if (typeof sid !== "string" || !SESSION_ID.test(sid)) continue;
    try {
      await fs.promises.rm(path.join(sessionsDir, sid), { recursive: true, force: true });
      removed.push(sid);
    } catch {}
  }
  return removed;
}

// The console folder's own files that no sweep may ever remove: the person's
// looks and the pointer to this console's directory.
export const PROTECTED_CONSOLE_FILES = new Set(["looks.json", "console-dir"]);

function isScratchName(name) {
  return (
    typeof name === "string" &&
    name === path.basename(name) &&
    /\.(json|mjs)$/.test(name) &&
    !PROTECTED_CONSOLE_FILES.has(name)
  );
}

/**
 * Leftover scratch files (agent patches, helper scripts) at the top of the
 * console folder: regular files ending in .json or .mjs, never a protected
 * name, a directory or a symlink, whose mtime is older than `maxAgeMs`.
 */
export function staleScratch(consoleDir, now, maxAgeMs) {
  let entries;
  try {
    entries = fs.readdirSync(consoleDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const stale = [];
  for (const entry of entries) {
    if (!entry.isFile() || !isScratchName(entry.name)) continue;
    try {
      const st = fs.lstatSync(path.join(consoleDir, entry.name));
      if (st.isFile() && now - st.mtimeMs > maxAgeMs) stale.push(entry.name);
    } catch {}
  }
  return stale;
}

// Every name re-checked against the same rule before anything is removed.
export async function removeScratch(consoleDir, names) {
  const removed = [];
  for (const name of names) {
    if (!isScratchName(name)) continue;
    try {
      await fs.promises.rm(path.join(consoleDir, name), { force: true });
      removed.push(name);
    } catch {}
  }
  return removed;
}

/**
 * A spec's overview.md, read-only, or null. `specDir` is relative to `root`;
 * the file's realpath must sit inside the root's, so `../`, an absolute path
 * and a symlink pointing outside all come back null.
 */
export async function readOverview(root, specDir) {
  if (!root || !specDir || typeof specDir !== "string" || path.isAbsolute(specDir)) return null;
  try {
    const file = path.resolve(root, specDir, "overview.md");
    const [realFile, realRoot] = await Promise.all([fs.promises.realpath(file), fs.promises.realpath(root)]);
    // path.relative, not a prefix test: a root of `C:\` or `/` already ends
    // in the separator, and `root + sep` would then match nothing at all.
    const rel = path.relative(realRoot, realFile);
    if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) return null;
    return await fs.promises.readFile(realFile, "utf8");
  } catch {
    return null;
  }
}

// The line every CLI command hands the agent to end its terminal messages with.
export function terminalLine(url) {
  return `→ Look at the web console: ${url}`;
}

export function runtimeDirFor(project) {
  return path.join(RUNTIME_DIR, cwdHash(project));
}

export function handleFile(project, sid) {
  return path.join(runtimeDirFor(project), sid + ".json");
}

export function newToken() {
  return crypto.randomBytes(16).toString("base64url");
}

/* ---------------------------------------------------------- project scan */

// What the dashboard needs to know about the repo it was opened in: whether
// AGENTS.md exists, and where every spec under specs/ sits in the pipeline.
// These are filesystem facts, not agent judgment, so the console computes
// them itself on every `open` (and every resume back to the dashboard) and
// puts them on the session state. The page lights the right cards straight
// from it; the agent keeps only the opinion (note / recommend / details).

// Where a spec folder stands, named after the step its files are ready for.
// "unrecognized" is a folder with files but no pipeline shape: it launches
// Pathfinder or Plan (the files may be reference docs) but unlocks nothing
// else, exactly like picking no spec at all.
export const SPEC_STATES = new Set([
  "exploring",
  "mapped",
  "planned",
  "documented",
  "building",
  "built",
  "unrecognized",
]);

function maxMtime(dir, depth = 4, budget = { n: 400 }) {
  let best = 0;
  if (depth < 0 || budget.n <= 0) return best;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return best;
  }
  for (const e of entries) {
    if (budget.n-- <= 0) break;
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    try {
      if (e.isDirectory()) best = Math.max(best, maxMtime(p, depth - 1, budget));
      else best = Math.max(best, fs.statSync(p).mtimeMs);
    } catch {}
  }
  return best;
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

// A spec folder's pipeline position, from its files alone. Furthest artifact
// wins: an overview beats a draft beats a map, so a spec mid-way through two
// stages reports the later one.
function classifySpec(dir, names) {
  const has = (re) => names.some((n) => re.test(n));
  const pfDir = path.join(dir, "pathfinder");
  const overview = names.includes("overview.md");
  const phases = names.filter((n) => /^phase-.*\.md$/i.test(n));
  const drafts = names.filter((n) => /^PLAN-DRAFT.*\.md$/i.test(n));
  const planDraft = drafts.length > 0;
  const planConv = has(/^PLAN-CONVERSATION.*\.md$/i);
  const liveDraft = drafts.filter((n) => !/-prev\.md$/i.test(n)).sort().reverse()[0] || drafts[0];
  const draftStatus = liveDraft
    ? (readText(path.join(dir, liveDraft)).match(/\*\*Status:\*\*\s*([^\n]+)/) || [])[1] || ""
    : "";
  const resumeAt = draftStatus.match(/Resume at Phase\s*(\d+)/i);

  if (phases.length) {
    let done = 0;
    let open = 0;
    for (const f of phases) {
      const text = readText(path.join(dir, f));
      done += (text.match(/^- \[[xX]\]/gm) || []).length;
      open += (text.match(/^- \[[ /!]\]/gm) || []).length;
    }
    const total = done + open;
    if (open === 0 && done > 0) return { state: "built", detail: "all tasks done" };
    if (done > 0) return { state: "building", detail: `${done} of ${total} tasks done` };
    return {
      state: "documented",
      detail: `${phases.length} phase${phases.length === 1 ? "" : "s"}, ${total || "?"} tasks ready`,
    };
  }
  // An overview with no phase files means Document was interrupted mid-write;
  // its next step is the same as a finished plan's.
  if (overview) return { state: "planned", detail: "plan drafted" };
  // A draft Pathfinder (or an interrupted Plan) left mid-way says so in its
  // Status line: Plan still has phases to run before Document can start.
  if (resumeAt) return { state: "mapped", detail: `plan draft, resume at Phase ${resumeAt[1]}` };
  if (planDraft) return { state: "planned", detail: "plan drafted" };
  if (isDir(pfDir)) {
    const mapText = readText(path.join(pfDir, "map.md"));
    const m = mapText.match(/\*\*Status:\*\*\s*([^\n]+)/);
    const status = m ? m[1].replace(/\*+/g, "").trim() : "";
    if (/^cleared/i.test(status)) return { state: "mapped", detail: "all decisions made" };
    let qTotal = 0;
    let qDone = 0;
    const qDir = path.join(pfDir, "questions");
    try {
      for (const q of fs.readdirSync(qDir)) {
        if (!q.endsWith(".md")) continue;
        qTotal++;
        if (/^State:\s*resolved/m.test(readText(path.join(qDir, q)))) qDone++;
      }
    } catch {}
    return {
      state: "exploring",
      detail: qTotal ? `${qDone} of ${qTotal} decisions made` : "getting started",
    };
  }
  // A conversation log with no draft is a plan session interrupted before it
  // wrote anything: Plan resumes it, same as a cleared map.
  if (planConv) return { state: "mapped", detail: "planning in progress" };
  return { state: "unrecognized", detail: "files on disk" };
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Scan <root>/specs into picker entries, most recently touched first.
 * `touched` is the newest file mtime inside the folder — last write wins,
 * which is the honest reading of "the one you were working on".
 */
export function scanProject(root) {
  const specsDir = path.join(root, "specs");
  const specs = [];
  let names = [];
  try {
    names = fs.readdirSync(specsDir);
  } catch {}
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const dir = path.join(specsDir, name);
    if (!isDir(dir)) continue;
    // A spec deleted mid-scan (or unreadable) must not kill `open`: the
    // picker just never shows it.
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    specs.push({
      dir: `specs/${name}`,
      name,
      ...classifySpec(dir, files),
      touched: maxMtime(dir),
    });
  }
  specs.sort((a, b) => b.touched - a.touched || a.name.localeCompare(b.name));
  return {
    at: nowIso(),
    hasAgents: fs.existsSync(path.join(root, "AGENTS.md")),
    specs,
  };
}

/* -------------------------------------------------------------- liveness */

// PID reuse is real, so process.kill(pid, 0) is necessary but not sufficient.
// The /health check whose sid matches the handle is the authoritative test:
// it is what distinguishes "our server" from "some process that inherited the PID".
export function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

export async function healthOk(handle, timeoutMs = 1500) {
  if (!handle || !handle.url) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // No explicit Host header: it is a forbidden header name, so fetch drops it
    // silently. Requesting 127.0.0.1 directly sets the right one anyway, which
    // is what the server's allow-list checks.
    const res = await fetch(`http://127.0.0.1:${handle.port}/health`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const body = await res.json();
    return body && body.sid === handle.sid;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function listHandles(project) {
  const dir = runtimeDirFor(project);
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  return names
    .map((n) => readJson(path.join(dir, n)))
    .filter(Boolean)
    .map((h) => ({ ...h, handlePath: path.join(dir, h.sid + ".json") }));
}

// Delete handle files whose process is gone. Runs on every `open`, so stale
// entries never accumulate. Windows gives us no reliable shutdown signal, so
// sweeping on startup is how the tmp dir stays clean.
export function reapHandles(project) {
  let reaped = 0;
  for (const h of listHandles(project)) {
    if (!pidAlive(h.pid)) {
      try {
        fs.rmSync(h.handlePath, { force: true });
        reaped++;
      } catch {}
    }
  }
  return reaped;
}

/* -------------------------------------------------------------- handover */

// A loopback socket, bound and listening, for `open` to hand to the server it
// spawns (see startServer in console.mjs). Null if the bind fails.
export function bindLoopback() {
  return new Promise((resolve) => {
    // pauseOnConnect: a connection that lands here before the handover is
    // passed on untouched, not read from. Collected from the first moment,
    // so none can arrive before anybody is listening for it.
    const srv = net.createServer({ pauseOnConnect: true });
    srv.early = [];
    srv.on("connection", (sock) => srv.early.push(sock));
    srv.once("error", () => resolve(null));
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// Give the bound socket to the server, pass on anything that connected in the
// meantime, then let go of both the socket and the channel. With no socket
// (`pre` null) the server is told to bind its own. Settles either way; a
// server that never takes the socket is caught by whoever waits on its handle.
export function handOff(child, pre) {
  const early = pre ? pre.early : [];
  return new Promise((resolve) => {
    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      try {
        pre?.close();
      } catch {}
      // Each passed-on socket is acknowledged by the server once it holds it.
      // Letting go of the channel before that drops the socket in transit,
      // and with it the browser's first request.
      let owed = 0;
      let settle = null;
      const held = new Promise((r) => (settle = r));
      const onAck = (m) => m && m.type === "conn-held" && --owed <= 0 && settle();
      child.on("message", onAck);
      for (const sock of early) {
        try {
          child.send({ type: "conn" }, sock);
          owed++;
        } catch {}
      }
      if (owed > 0 && !child.exitCode) {
        await Promise.race([held, new Promise((r) => setTimeout(r, 2000).unref())]);
      }
      child.off("message", onAck);
      try {
        child.disconnect();
      } catch {}
      child.unref();
      resolve();
    };
    child.on("message", (m) => m && m.type === "listening" && finish());
    child.on("exit", finish);
    child.on("error", finish);
    try {
      if (pre) child.send({ type: "listen", port: pre.address().port }, pre, (err) => err && finish());
      else child.send({ type: "own" });
    } catch {
      finish();
    }
  });
}

/* ----------------------------------------------------------- patch merge */

const APPEND_KEYS = new Set(["thread", "comments"]);

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Reject prototype-pollution attempts before they reach the merge.
function guard(obj, where) {
  if (isPlainObject(obj) && Object.prototype.hasOwnProperty.call(obj, "__proto__")) {
    throw new Error(`"__proto__" is not a valid key (in ${where})`);
  }
  return obj;
}

function mergeOne(target, patch, where) {
  const out = { ...(target || {}) };
  for (const [k, v] of Object.entries(guard(patch, where))) {
    if (v === null) delete out[k];
    else if (APPEND_KEYS.has(k) && Array.isArray(v)) out[k] = [...(out[k] || []), ...v];
    else out[k] = v;
  }
  return out;
}

// Merge a keyed collection: a known id merges one level, an unknown id appends.
// Named fields are replaced whole; thread/comments append.
function mergeKeyed(current, patchList, idKey, defaults, where) {
  const out = Array.isArray(current) ? current.map((x) => ({ ...x })) : [];
  for (const entry of patchList) {
    guard(entry, where);
    const id = entry[idKey];
    if (!id) throw new Error(`every ${where} entry needs "${idKey}"`);
    const i = out.findIndex((x) => x[idKey] === id);
    if (entry._delete) {
      if (i !== -1) out.splice(i, 1);
    } else if (i === -1) out.push(mergeOne({ ...defaults, [idKey]: id }, entry, where));
    else out[i] = mergeOne(out[i], entry, where);
  }
  return out;
}

const ITEM_DEFAULTS = {
  status: "open",
  required: true,
  allowOther: true,
  options: [],
  thread: [],
};

const DOC_DEFAULTS = { version: 1, stale: false, blocks: [] };

// Blocks merge by id like docs do, so a patch that only settles a block's
// state keeps its text. Blocks left out of the patch stay as they are.
function mergeDocs(current, patchList) {
  const merged = mergeKeyed(current, patchList, "id", DOC_DEFAULTS, "docs");
  for (const entry of patchList) {
    if (!Array.isArray(entry.blocks)) continue;
    const doc = merged.find((d) => d.id === entry.id);
    if (!doc) continue;
    const prev = (current || []).find((d) => d.id === entry.id);
    doc.blocks = mergeKeyed(prev?.blocks, entry.blocks, "id", {}, "blocks");
  }
  return merged;
}

/**
 * Apply an agent patch to the session state.
 *
 * Scalars replace, `null` deletes, `agent`/`headline` merge one level,
 * `items`/`topics`/`docs` merge by id, and so do a doc's `blocks`. The agent
 * sends only what changed: a whole-file rewrite would put the entire state
 * back into the agent's context on every turn, and the state grows with the
 * session.
 */
export function applyPatch(state, patch) {
  guard(patch, "patch");
  patch = liftActivity(patch);
  const next = { ...state };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) {
      delete next[k];
      continue;
    }
    switch (k) {
      case "agent":
      case "headline":
        next[k] = mergeOne(next[k], v, k);
        break;
      case "items":
        if (!Array.isArray(v)) throw new Error('"items" must be an array');
        next.items = mergeKeyed(next.items, v, "id", ITEM_DEFAULTS, "items");
        break;
      case "topics":
        if (!Array.isArray(v)) throw new Error('"topics" must be an array');
        next.topics = mergeKeyed(next.topics, v, "id", {}, "topics");
        break;
      case "docs":
        if (!Array.isArray(v)) throw new Error('"docs" must be an array');
        next.docs = mergeDocs(next.docs, v);
        break;
      case "chat": {
        // The agent's side of the Quick question chat. The person's side is
        // the inbox, which only the server writes; nothing else lives here.
        if (!isPlainObject(v)) throw new Error('"chat" must be an object');
        guard(v, "chat");
        const extra = Object.keys(v).filter((key) => key !== "replies");
        if (extra.length) throw new Error(`"chat" only takes "replies" (not ${extra.map((key) => `"${key}"`).join(", ")})`);
        const chat = { ...(next.chat || {}) };
        if (v.replies != null) {
          if (!Array.isArray(v.replies)) throw new Error('"chat.replies" must be an array');
          chat.replies = mergeKeyed(chat.replies, v.replies, "id", {}, "chat.replies");
        }
        next.chat = chat;
        break;
      }
      default:
        next[k] = v;
    }
  }
  return stampTimes(state, next);
}

// `activity` belongs under `agent`, which is the only place the page reads it.
// Sent at the top level it would be stored where nothing looks, and the page
// would sit on its starting screen while the skill works.
function liftActivity(patch) {
  if (!Object.prototype.hasOwnProperty.call(patch, "activity")) return patch;
  const { activity, ...rest } = patch;
  if (rest.agent === null) return rest;
  const agent = isPlainObject(rest.agent) ? rest.agent : {};
  return { ...rest, agent: "activity" in agent ? agent : { ...agent, activity } };
}

// The agent never writes a timestamp. Models do not reliably know the time,
// and a wrong `since` makes the page's elapsed counters nonsense.
function stampTimes(before, next) {
  const now = nowIso();
  if (next.agent) {
    const changed = !before.agent || before.agent.status !== next.agent.status;
    if (changed && !next.agent.since) next.agent = { ...next.agent, since: now };
    else if (!next.agent.since) next.agent = { ...next.agent, since: before.agent?.since || now };
  }
  for (const list of [next.items, next.docs]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (Array.isArray(entry.thread)) {
        for (const m of entry.thread) if (!m.at) m.at = now;
      }
      if (Array.isArray(entry.comments)) {
        for (const m of entry.comments) if (!m.at) m.at = now;
      }
    }
  }
  if (Array.isArray(next.docs)) {
    for (const d of next.docs) {
      const prev = (before.docs || []).find((x) => x.id === d.id);
      if (!prev || prev.version !== d.version) d.at = d.at || now;
    }
  }
  next.updatedAt = now;
  return next;
}

/* --------------------------------------------------------- house rules */

export const ITEM_KINDS = new Set([
  "choice",
  "multi",
  "text",
  "confirm",
  "recap",
  "review",
  "checklist",
  "menu",
  "list",
  "notice",
]);

// grilling.md keeps an explicit do-not-say list: this bookkeeping vocabulary is
// internal and must never reach the human. In the terminal that is a prompt rule
// the model can drift from. Routing through a server makes it mechanical.
const JARGON = [
  /\bgrill(ing|ed)?\b/i,
  /\bfrontier\b/i,
  /\bfog\b/i,
  /\bHITL\b/,
  /\bAFK\b/,
  /\bdurable\b/i,
  /Locked:/,
  /Blocked by:/,
  /\bState:\s/,
];

// The loop parses these out of agent output; pathfinder forbids them under specs/.
const FORBIDDEN_TOKENS =
  /\b(TASK_COMPLETE|PHASE_COMPLETE|ALL_TASKS_COMPLETE|IMPLEMENTATION_COMPLETE|SPEC_COMPLETE|WORK_COMPLETE)\b/;

// plan2code-metrics scrapes confidence with patterns that do NOT require a
// percent sign, so a bare "Requirements 22" in a rendered doc can poison a run's
// metrics. Keep those four words away from bare numbers.
const METRICS_BAIT = /\b(Requirements?|Feasibility|Integration|Risk)[:\s|]+\d{1,2}\b/;

// The marker and metrics-bait scan on its own, for agent text that never
// reaches state.json (a post's `run` / `folderIssue`). Problems as sentences.
export function proseProblems(prose, subject = "text") {
  const problems = [];
  if (FORBIDDEN_TOKENS.test(prose)) {
    problems.push(`${subject} contains a loop completion marker (${prose.match(FORBIDDEN_TOKENS)[0]}); the loop scans for these`);
  }
  if (METRICS_BAIT.test(prose)) {
    problems.push(
      `${subject} contains "${prose.match(METRICS_BAIT)[0]}" — the metrics collector scrapes that pattern. ` +
        `Hyphenate it (Requirements-clarity 22/25) or reword.`
    );
  }
  return problems;
}

export const MAX_OPEN_REQUIRED = 3;

/**
 * Validate a merged state before it is written.
 *
 * Returns an array of human-readable problems. An empty array means the patch
 * is good. These checks turn four prose rules into mechanical ones.
 */
export function validate(state) {
  const problems = [];

  if (!Array.isArray(state.items)) return ['"items" must be an array'];

  const ids = new Set();
  for (const item of state.items) {
    if (!item.id) problems.push("every item needs an id");
    if (ids.has(item.id)) problems.push(`duplicate item id "${item.id}"`);
    ids.add(item.id);

    if (!ITEM_KINDS.has(item.kind)) {
      problems.push(`item "${item.id}" has unknown kind "${item.kind}" (one of: ${[...ITEM_KINDS].join(", ")})`);
    }
    if (typeof item.title !== "string" || !item.title.trim()) {
      problems.push(`item "${item.id}" needs a plain-English title`);
    } else {
      for (const re of JARGON) {
        if (re.test(item.title)) {
          problems.push(
            `item "${item.id}" title contains internal vocabulary (${re.source}). Titles are read by people who have never seen this workflow.`
          );
          break;
        }
      }
    }
    if ((item.kind === "choice" || item.kind === "multi") && !Array.isArray(item.options)) {
      problems.push(`item "${item.id}" is a ${item.kind} and needs "options"`);
    }
    if (item.verdicts != null) {
      if (!Array.isArray(item.verdicts) || !item.verdicts.length) {
        problems.push(`item "${item.id}" "verdicts" must be a non-empty array of { id, label }`);
      } else {
        for (const v of item.verdicts) {
          if (!v || typeof v.id !== "string" || !v.id.trim()) {
            problems.push(`item "${item.id}" has a verdict with no "id"`);
          } else if (typeof v.label !== "string" || !v.label.trim()) {
            problems.push(
              `item "${item.id}" verdict "${v.id}" needs a "label" (the button text). Verdicts use "label", not "text".`
            );
          }
        }
      }
    }
    if (item.templates != null && (item.kind !== "text" || item.templates !== "idea")) {
      problems.push(`item "${item.id}" has "templates": only a text item can carry it, and its only value is "idea".`);
    }
    // The page compiles this to check the answer. One that will not compile
    // is dropped there, so the check the agent asked for would silently not run.
    if (item.pattern != null) {
      let compiles = typeof item.pattern === "string";
      try {
        if (compiles) new RegExp(item.pattern);
      } catch {
        compiles = false;
      }
      if (!compiles) problems.push(`item "${item.id}" "pattern" must be a string holding a valid JavaScript regular expression`);
    }
    const recs = (item.options || []).filter((o) => o.recommended);
    if (recs.length > 1) problems.push(`item "${item.id}" marks ${recs.length} options recommended; at most one`);
  }

  const openRequired = state.items.filter((i) => i.required !== false && isOpen(i));
  if (openRequired.length > MAX_OPEN_REQUIRED) {
    problems.push(
      `${openRequired.length} questions are open at once. The cap is ${MAX_OPEN_REQUIRED} ` +
        `(the ceiling is the person's attention, not the screen's). ` +
        `Send the rest after these are answered, or mark some "required": false.`
    );
  }

  // The session's own ending. Absent for every session that is still running,
  // so only its shape is checked, never its presence. The command is optional:
  // a finish with no command is a finished session with nothing left to run,
  // and the page points at the dashboard instead of a next step.
  const fin = state.finish;
  if (fin != null) {
    if (typeof fin !== "object" || Array.isArray(fin)) {
      problems.push('"finish" must be an object');
    } else {
      if (typeof fin.headline !== "string" || !fin.headline.trim()) {
        problems.push('"finish" needs a plain-English "headline" saying what just happened');
      }
      if (fin.command != null && (typeof fin.command !== "string" || !fin.command.trim())) {
        problems.push('"finish.command" must be a non-empty string, or left out when there is nothing to run');
      } else if (fin.command != null && (fin.command.includes("<") || fin.command.includes(">"))) {
        // A rendered command is copied and run verbatim. A leftover
        // placeholder reaches someone who has no way to know what fills it.
        problems.push(`"finish.command" still has a placeholder in it ("${fin.command}"). Fill it in.`);
      }
      if (fin.console != null && typeof fin.console !== "boolean") {
        problems.push('"finish.console" must be true or false (or left out, to follow the command)');
      }
      if (fin.dashboard != null && typeof fin.dashboard !== "boolean") {
        problems.push('"finish.dashboard" must be true or false (or left out: no dashboard button)');
      }
      // The review offer on a finished build: true, or an object carrying the
      // button's heading. The heading is read by the person, so it faces the
      // same vocabulary check as a title.
      if (fin.review != null && typeof fin.review !== "boolean") {
        if (typeof fin.review !== "object" || Array.isArray(fin.review)) {
          problems.push('"finish.review" must be true, false, or { "label": "..." }');
        } else if (fin.review.label != null) {
          if (typeof fin.review.label !== "string") {
            problems.push('"finish.review.label" must be a string');
          } else {
            const hit = JARGON.find((re) => re.test(fin.review.label));
            if (hit) problems.push(`"finish.review.label" contains internal vocabulary (${hit.source})`);
          }
        }
      }
      for (const re of JARGON) {
        if (typeof fin.headline === "string" && re.test(fin.headline)) {
          problems.push(`"finish.headline" contains internal vocabulary (${re.source})`);
          break;
        }
      }
    }
  }

  // How long a silence is normal while the agent works (a build task). Bounded,
  // because the page stops calling a quiet agent stuck for this long, and a
  // huge number would hide a session that really has died.
  const quiet = state.agent && state.agent.quietMinutes;
  if (quiet != null && (typeof quiet !== "number" || !(quiet > 0) || quiet > 60)) {
    problems.push('"agent.quietMinutes" must be a number of minutes between 1 and 60 (or null to clear it)');
  }
  if (state.agent && state.agent.activity != null && typeof state.agent.activity !== "string") {
    problems.push('"agent.activity" must be a short sentence saying what you are doing');
  }

  const gates = state.items.filter((i) => i.gate && i.gate.authoritative);
  if (gates.length > 1) {
    problems.push(
      `${gates.length} authoritative approval gates are open (${gates
        .map((g) => g.id)
        .join(", ")}). Only one workflow may own sign-off at a time.`
    );
  }

  // Scan what the AGENT wrote, never what the person typed. `submitted` is the
  // server's record of an answer someone pressed Send on; if their own words
  // happened to contain "TASK_COMPLETE" or "Risk 3", every later agent patch
  // would be rejected and the session would wedge with no way out.
  const authored = state.items.map(({ submitted, ...rest }) => rest);
  const prose =
    JSON.stringify(authored) +
    JSON.stringify(state.docs || []) +
    JSON.stringify(state.finish || {}) +
    JSON.stringify(state.menu || {});
  problems.push(...proseProblems(prose));

  return problems;
}

export function isOpen(item) {
  return item.status === "open" || item.status === "reopened";
}

export function blankState({ sid, workflow, title, project, specDir }) {
  return {
    schema: SCHEMA,
    sid,
    workflow: workflow || "pathfinder",
    title: title || "Session",
    project,
    specDir: specDir || "",
    created: nowIso(),
    phase: "collecting",
    agent: { status: "working", since: nowIso(), handled: 0 },
    headline: { stage: "", cleared: 0, total: 0, confidence: "", note: "" },
    topics: [],
    items: [],
    docs: [],
  };
}

/**
 * A resume that passes through the dashboard (a finished skill going back to
 * it, or a launch from its menu) is a new skill taking the page over, so it
 * starts from a blank page: the last skill's questions, sections, docs,
 * headline and ending are its record on disk, not the next skill's opening.
 * Only the session's identity carries across. `workspace.json`,
 * `ledger.ndjson` and the cursors live beside `state.json`, so the workspace
 * and the meter outlive every hop.
 */
export function switchWorkflow(state, { workflow, title, specDir }) {
  return { ...blankState({ sid: state.sid, project: state.project, workflow, title, specDir }), created: state.created };
}

/* ------------------------------------------------------- the chat inbox */

// The Quick question chat rides its own channel beside the card slot, so the
// two never contend: a chat message never waits on an uncollected card send,
// and a card send never waits on chat. Every file has exactly one writer:
//
//   chat.ndjson       the server. One JSON line per entry: message / decision / reset.
//   chat-cursor.json  console.mjs. The last seq the agent was handed.
//   state.json        console.mjs `post`. The agent's replies, under chat.replies.
//
// The Workspace and the session meter follow the same rule, in files that
// switchWorkflow() never touches, so they carry across dashboard hops:
//
//   workspace.json         the server. Folders, version, change log, missing, remote.
//   ledger.ndjson          console.mjs. Append-only meter events and folder issues.
//   workspace-cursor.json  console.mjs. The last workspace version handed to the agent.
export const CHAT_FILE = "chat.ndjson";
export const CHAT_CURSOR_FILE = "chat-cursor.json";
export const WORKSPACE_FILE = "workspace.json";

/**
 * The inbox's entries with `seq > afterSeq`. A final segment with no newline
 * is a line still being written: it is left for the next read, never parsed
 * half-way. A line that will not parse is skipped rather than thrown on.
 */
export function readChat(dir, afterSeq = 0) {
  return readJsonLines(path.join(dir, CHAT_FILE)).filter((e) => Number.isInteger(e.seq) && e.seq > afterSeq);
}

// Every whole, parsable object line of an ndjson file, in order.
function readJsonLines(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const lines = text.split("\n");
  lines.pop(); // "" after a complete last line, or the half-written one
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry === "object") out.push(entry);
    } catch {}
  }
  return out;
}

// Single-writer rule: only server.mjs may call this.
export function appendChat(dir, entry) {
  const last = readChat(dir).reduce((max, e) => Math.max(max, e.seq), 0);
  return appendJsonLine(path.join(dir, CHAT_FILE), { ...entry, seq: last + 1, at: nowIso() });
}

// Append one JSON line to an ndjson file, returning what was stored.
function appendJsonLine(file, stored) {
  let lead = "";
  try {
    const st = fs.statSync(file);
    // A fragment left by a crash mid-append must not swallow this line too.
    if (st.size > 0) {
      const fd = fs.openSync(file, "r");
      try {
        const b = Buffer.alloc(1);
        fs.readSync(fd, b, 0, 1, st.size - 1);
        if (b[0] !== 0x0a) lead = "\n";
      } finally {
        fs.closeSync(fd);
      }
    }
  } catch {}
  const line = lead + JSON.stringify(stored) + "\n";
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.appendFileSync(file, line);
      return stored;
    } catch (err) {
      lastErr = err;
      if (err.code !== "EPERM" && err.code !== "EBUSY" && err.code !== "EACCES") break;
      sleepSync(40 * (attempt + 1));
    }
  }
  throw lastErr;
}

export function readCursor(dir) {
  const saved = readJson(path.join(dir, CHAT_CURSOR_FILE), { seq: 0 });
  const n = Number(saved && saved.seq);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Never backwards: a slow collector finishing after a faster one must not
// hand the faster one's entries over again.
export function writeCursor(dir, seq) {
  writeJsonAtomic(path.join(dir, CHAT_CURSOR_FILE), { seq: Math.max(readCursor(dir), seq) });
}

// The conversation the inbox is on: the one its last reset opened.
export function currentConversation(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === "reset") return { conversation: e.conversation, workflow: e.workflow || "", sinceSeq: e.seq };
  }
  return { conversation: 0, workflow: "", sinceSeq: 0 };
}

// Typed messages only: Approve / Decline and resets never count to the limit.
export function typedCount(entries, conversation) {
  return entries.filter((e) => e.kind === "message" && e.conversation === conversation).length;
}

/**
 * The chat block of a page frame: the current conversation's person entries
 * from the inbox and the agent's replies from the state, as one list. A reply
 * sits straight after the entry it answers; one naming nothing here goes last.
 */
export function chatForFrame(entries, state) {
  const { conversation } = currentConversation(entries);
  const person = entries
    .filter((e) => (e.kind === "message" || e.kind === "decision") && e.conversation === conversation)
    .sort((a, b) => a.seq - b.seq);
  const replies = (state?.chat?.replies || []).filter((r) => r && r.conversation === conversation);
  const messages = [];
  const placed = new Set();
  for (const p of person) {
    messages.push({ from: "person", ...p });
    replies.forEach((r, i) => {
      if (r.re !== p.seq) return;
      messages.push({ from: "agent", ...r });
      placed.add(i);
    });
  }
  replies.forEach((r, i) => placed.has(i) || messages.push({ from: "agent", ...r }));
  return { conversation, messages, typed: typedCount(entries, conversation), limit: CHAT_LIMIT };
}

/**
 * What the agent has not been handed yet: entries past the cursor, minus any
 * message or decision that already has a reply. The second half is what keeps
 * a lost cursor from ever causing a second answer. Resets always go through.
 */
export function collectChat(dir, state) {
  const replied = new Set((state?.chat?.replies || []).map((r) => r && r.re));
  return readChat(dir, readCursor(dir)).filter((e) => e.kind === "reset" || !replied.has(e.seq));
}

// What is worth handing over: the collected entries once one of them is
// something the person said. A reset alone (every session opens with one)
// waits and rides along with the next message, or `wait` would return on the
// opening line of every session and every first card reply would carry it.
export function deliverableChat(entries) {
  return entries.some((e) => e.kind !== "reset") ? entries : [];
}

// How many things the person said are still waiting to be collected.
export function pendingChatCount(dir, state) {
  return collectChat(dir, state).filter((e) => e.kind !== "reset").length;
}

// The chat entries as the lines appended to `reply`, in the note's shape.
// Whatever the person typed is indented past its first line, so only a real
// entry ever starts a line: a typed "Approved: edit p1" must not read as one.
export function chatReplyLines(entries) {
  const indent = (s, pad) => String(s).replace(/\r?\n/g, "\n" + pad);
  const lines = [];
  for (const e of entries) {
    if (e.kind === "message") {
      lines.push(`Quick question: ${indent(e.text, "  ")}`);
      if (e.about && e.about.label) lines.push(`  About: ${indent(e.about.label, "    ")}`);
      for (const img of e.images || []) lines.push(`  Image: ${img.path} (${img.name})`);
      for (const f of e.files || []) lines.push(`  File: ${f.path} (${f.name})`);
    } else if (e.kind === "decision") {
      lines.push(`${e.decision === "approve" ? "Approved" : "Declined"}: edit ${e.re}`);
      if (e.text) lines.push(`  Note: ${indent(e.text, "    ")}`);
    } else if (e.kind === "reset") {
      lines.push("New conversation started. Treat earlier chat as closed.");
    }
  }
  return lines.join("\n");
}

// A project-relative path: no root, no drive letter, no step outside.
function projectRelative(p) {
  if (typeof p !== "string" || !p.trim()) return false;
  if (/^[\\/]/.test(p) || /^[A-Za-z]:/.test(p)) return false;
  return !p.split(/[\\/]/).includes("..");
}

function underSpec(file, specDir) {
  const norm = (s) => {
    const t = s.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
    return process.platform === "win32" ? t.toLowerCase() : t;
  };
  const f = norm(file);
  const spec = norm(specDir);
  return Boolean(spec) && (f === spec || f.startsWith(spec + "/"));
}

/**
 * The house rules for the agent's chat replies, checked against the inbox
 * they answer. Same shape as validate(): problems as sentences, [] when fine.
 */
export function validateChat(state, entries) {
  const replies = state?.chat?.replies;
  if (replies == null) return [];
  if (!Array.isArray(replies)) return ['"chat.replies" must be an array'];
  const problems = [];
  const targets = new Set(
    entries.filter((e) => e.kind === "message" || e.kind === "decision").map((e) => e.seq)
  );
  const ids = new Set();
  for (const r of replies) {
    if (!isPlainObject(r)) {
      problems.push("every chat reply must be an object");
      continue;
    }
    const name = typeof r.id === "string" && r.id.trim() ? r.id : "(no id)";
    if (name === "(no id)") problems.push('every chat reply needs a non-empty string "id"');
    else if (ids.has(r.id)) problems.push(`duplicate chat reply id "${r.id}"`);
    ids.add(r.id);
    if (!Number.isInteger(r.re) || !targets.has(r.re)) {
      problems.push(`chat reply "${name}" needs "re": the seq of the message or decision it answers`);
    }
    if (!Number.isInteger(r.conversation)) problems.push(`chat reply "${name}" needs an integer "conversation"`);
    if (typeof r.md !== "string" || !r.md.trim()) problems.push(`chat reply "${name}" needs its answer in "md"`);

    const p = r.proposal;
    if (p != null) {
      if (!isPlainObject(p)) problems.push(`chat reply "${name}" "proposal" must be an object`);
      else {
        if (typeof p.summary !== "string" || !p.summary.trim()) {
          problems.push(`chat reply "${name}" proposal needs a plain-English "summary"`);
        }
        if (!Array.isArray(p.files) || !p.files.length) {
          problems.push(`chat reply "${name}" proposal needs "files": the project files it would change`);
        } else {
          for (const f of p.files) {
            if (!projectRelative(f)) {
              problems.push(`chat reply "${name}" proposal file "${f}" must be a project-relative path`);
            } else if (state.specDir && underSpec(f, state.specDir)) {
              problems.push(`a chat edit cannot touch the running skill's own files under ${state.specDir}/`);
            }
          }
        }
      }
    }

    if (r.changed != null) {
      const count = (n) => Number.isInteger(n) && n >= 0;
      if (!Array.isArray(r.changed) || !r.changed.every((c) => isPlainObject(c) && typeof c.file === "string" && count(c.added) && count(c.removed))) {
        problems.push(`chat reply "${name}" "changed" must be a list of { file, added, removed }`);
      }
    }
  }

  const prose = JSON.stringify(replies.map((r) => [r && r.md, r && r.proposal && r.proposal.summary]));
  problems.push(...proseProblems(prose, "a chat reply"));
  return problems;
}

/* -------------------------------------------------------- the workspace */

// The session's workspace.json, or null when the server has not made it yet.
export function readWorkspace(dir) {
  return readJson(path.join(dir, WORKSPACE_FILE), null);
}

// A fresh workspace: just the original folder, named after itself.
export function initialWorkspace(worktree) {
  return {
    version: 0,
    folders: [{ id: "f0", path: worktree, name: defaultName(worktree), description: "", original: true }],
    missing: [],
    changes: [],
    remote: "",
  };
}

// Single-writer rule: only server.mjs may call this.
export function writeWorkspace(dir, ws) {
  return writeJsonAtomic(path.join(dir, WORKSPACE_FILE), ws);
}

// What `open` hands the agent: names, paths and descriptions, nothing
// internal. `missing` names the folders that are gone, by their @name.
export function workspaceForAgent(ws) {
  const all = (ws && ws.folders) || [];
  const folders = all.map((f) => {
    const out = { name: f.name, path: f.path };
    if (f.description) out.description = f.description;
    if (f.original) out.original = true;
    return out;
  });
  const missing = ((ws && ws.missing) || []).map((id) => (all.find((f) => f.id === id) || {}).name).filter(Boolean);
  return missing.length ? { folders, missing } : { folders };
}

/* ------------------------------------------------------ the meter ledger */

export const LEDGER_FILE = "ledger.ndjson";

/**
 * Every ledger entry, in order. As with readChat(), a final segment with no
 * newline is still being written and is left for the next read, and a line
 * that will not parse is skipped.
 */
export function readLedger(dir) {
  return readJsonLines(path.join(dir, LEDGER_FILE));
}

// Single-writer rule: only console.mjs may call this.
export function appendLedger(dir, entry) {
  return appendJsonLine(path.join(dir, LEDGER_FILE), { ...entry, at: nowIso() });
}

// The id of the skill run in progress: the last launch's, or "L0" before any.
export function lastLaunchId(entries) {
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i].kind === "launch") return entries[i].id;
  return "L0";
}

export function nextLaunchId(entries) {
  return "L" + (entries.filter((e) => e.kind === "launch").length + 1);
}

/* ---------------------------------------------------- the workspace cursor */

export const WORKSPACE_CURSOR_FILE = "workspace-cursor.json";

export function readWorkspaceCursor(dir) {
  const saved = readJson(path.join(dir, WORKSPACE_CURSOR_FILE), { version: 0 });
  const n = Number(saved && saved.version);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Never backwards, like writeCursor(): a killed `wait` may hand a change over
// twice, but never skips one.
export function writeWorkspaceCursor(dir, version) {
  writeJsonAtomic(path.join(dir, WORKSPACE_CURSOR_FILE), { version: Math.max(readWorkspaceCursor(dir), version) });
}

// The workspace changes the agent has not been handed yet.
export function pendingWorkspaceChanges(dir) {
  const cursor = readWorkspaceCursor(dir);
  return (readWorkspace(dir)?.changes || []).filter((c) => c.version > cursor);
}

/**
 * Flag the case where the link cannot be opened by the person it is for.
 *
 * The page is served on 127.0.0.1, which is only their machine if the agent is
 * ON their machine. An agent in a cloud VM, a remote sandbox or an SSH session
 * hands over a link to its own loopback, and the person sees nothing.
 *
 * Reported rather than refused, on purpose: a devcontainer or a Codespace
 * usually forwards the port automatically and works perfectly. What the agent
 * needs is to know that it might not, so it can ask instead of insisting.
 */
export function remoteWarning() {
  const signals = [
    ["SSH_CONNECTION", "an SSH session"],
    ["SSH_CLIENT", "an SSH session"],
    ["REMOTE_CONTAINERS", "a dev container"],
    ["CODESPACES", "a GitHub Codespace"],
    ["GITPOD_WORKSPACE_ID", "a Gitpod workspace"],
  ];
  const hit = signals.find(([key]) => process.env[key]);
  if (!hit) return {};
  return {
    remote: hit[0],
    note:
      `This looks like ${hit[1]}, so http://127.0.0.1 is this machine, not necessarily theirs. ` +
      `Give them the link, ask whether it opens, and go back to the terminal if it does not.`,
  };
}
