// Plan2Code Web Console - finding a session's roots, and keeping the console folder tidy.

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

import { countPending } from "./git-repo.mjs";
import { DOC_TYPES } from "./public/answers.js";
import { appendJsonLine, HOME_DIR, newestMtime, nowIso, PLAN2CODE_DIR, readJson, readJsonLines, readText, RUNTIME_DIR, SESSIONS_DIR } from "./files.mjs";

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

// Whether `dir` is inside a git repository, found without a git process: the
// same walk findRoots() does. A set GIT_DIR / GIT_WORK_TREE / GIT_COMMON_DIR
// means git decides, so it counts as a repository. A `gitdir:` file (a linked
// worktree or a submodule) counts like a `.git` folder.
export function insideGitRepo(dir) {
  if (process.env.GIT_DIR || process.env.GIT_WORK_TREE || process.env.GIT_COMMON_DIR) return true;
  for (let d = path.resolve(dir); ; ) {
    if (gitDirAt(d)) return true;
    const up = path.dirname(d);
    if (up === d) return false;
    d = up;
  }
}

// How many paths git would commit from `dir`: modified, staged, deleted and
// untracked (an untracked folder counts once), from one bounded `git status`.
// null when git cannot say (not installed, not a repository, too slow), which
// the page reads as "unknown", never as a clean tree. GIT_OPTIONAL_LOCKS=0 (set
// by git-repo.mjs) keeps this background look from taking the index lock out
// from under a commit.
export function pendingFiles(dir) {
  return countPending(dir);
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
// looks, the folders remembered per project and spec, the Subagents switch
// saved per project and workflow, what each unknown git host is, the pointer
// to this console's directory, and the cached release check.
export const PROTECTED_CONSOLE_FILES = new Set([
  "looks.json",
  "workspaces.json",
  "subagents.json",
  "pr-hosts.json",
  "console-dir",
  "update-check.json",
]);

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

/* ------------------------------------------------------------- cleanup */

// What User Preferences -> Cleanup never removes. The console folder keeps its
// protected files, its sessions dir (old sessions go one by one, by age) and,
// under PLAN2CODE_CONSOLE_HOME, its runtime dir; ~/.plan2code keeps the
// console, the launcher (bin/, launcher.json), the install record that
// `plan2code update` reads (install.json), the models the person added and
// the handoffs (old ones go one by one, by age, on open: handoffs.mjs) and
// the notepads, removed only one at a time through Cleanup (notepads.mjs), and
// the desktop app (app/, which install.js fills, and app.json, its settings).
const KEPT_CONSOLE_ENTRIES = new Set([...PROTECTED_CONSOLE_FILES, "sessions", "runtime"]);
export const KEPT_PLAN2CODE_ENTRIES = new Set(["console", "bin", "launcher.json", "install.json", "models.json", "handoffs", "notepads", "app", "app.json"]);
// A stray must sit untouched this long before Cleanup lists it. The same
// folders hold files that live for milliseconds -- a held
// `workspaces.json.lock`, a `<file>.<pid>.tmp` between its write and its
// rename -- and removing one mid-write loses another session's change.
export const STRAY_GRACE_MS = 60 * 60 * 1000;

// Bytes under `p`, never following a symlink: a link counts as itself.
async function diskBytes(p) {
  let st;
  try {
    st = await fs.promises.lstat(p);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.size;
  let entries;
  try {
    entries = await fs.promises.readdir(p);
  } catch {
    return 0;
  }
  let total = 0;
  for (const name of entries) total += await diskBytes(path.join(p, name));
  return total;
}


function entryKind(entry) {
  if (entry.isSymbolicLink()) return "link";
  return entry.isDirectory() ? "folder" : "file";
}

function strayEntries(dir, kept, where, now) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const settled = (p) => now - newestMtime(p) >= STRAY_GRACE_MS;
  return entries
    .filter((e) => !kept.has(e.name))
    .map((e) => ({ id: where + ":" + e.name, where, name: e.name, kind: entryKind(e), path: path.join(dir, e.name) }))
    .filter((e) => settled(e.path));
}

// Finalize's archive, `<project>/specs--completed/<feature>/`: each feature
// folder (or link) nobody has touched for `maxAgeMs`, judged by its newest
// file. Loose files at the top are not specs and stay.
function completedSpecs(project, now, maxAgeMs) {
  const dir = path.join(project, "specs--completed");
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => ({ id: "completed:" + e.name, where: "completed", name: e.name, kind: entryKind(e), path: path.join(dir, e.name) }))
    .filter((e) => now - newestMtime(e.path) > maxAgeMs);
}

/**
 * Everything Cleanup would remove, worked out on the server and never taken
 * from a client: sessions untouched for `maxAgeMs` (never `skipSid`; the rule
 * `open` sweeps by, plus every file in the folder that old, so a resumed
 * session or a saved draft keeps it), anything at the top of the console folder that is
 * not kept, and -- only when the console runs from its default home inside
 * `plan2codeDir` -- anything at the top of `plan2codeDir` that is not kept. Strays
 * touched within `STRAY_GRACE_MS` are left for a later scan. A
 * console running from another home (tests, dev) never reaches ~/.plan2code.
 * Given a `project`, also its completed specs untouched for `maxAgeMs`. Every
 * notepad whose newest file is `maxAgeMs` old is listed too, one item per
 * folder carrying the `folder` it belongs to (null when its meta.json is gone):
 * this is the only way a notepad is ever removed.
 * Resolves to `{ items: [{ id, where, name, kind, bytes, folder? }], bytes }`.
 */
export async function cleanupFindings({
  consoleDir = HOME_DIR,
  plan2codeDir = PLAN2CODE_DIR,
  now = Date.now(),
  maxAgeMs = SESSION_MAX_AGE_MS,
  skipSid,
  project,
} = {}) {
  const found = [];
  const sessionsDir = path.join(consoleDir, "sessions");
  for (const sid of staleSessions(sessionsDir, now, maxAgeMs, skipSid)) {
    if (now - newestMtime(path.join(sessionsDir, sid)) <= maxAgeMs) continue;
    found.push({ id: "session:" + sid, where: "session", name: sid, kind: "folder", path: path.join(sessionsDir, sid) });
  }
  found.push(...strayEntries(consoleDir, KEPT_CONSOLE_ENTRIES, "console", now));
  if (path.resolve(consoleDir) === path.resolve(plan2codeDir, "console")) {
    found.push(...strayEntries(plan2codeDir, KEPT_PLAN2CODE_ENTRIES, "root", now));
  }
  if (project) found.push(...completedSpecs(project, now, maxAgeMs));
  // Loaded here, not at the top: notepads.mjs reaches files.mjs through
  // workspace.mjs, and files.mjs imports this module, so a static import
  // would run workspace.mjs before files.mjs has defined HOME_DIR.
  const { staleNotepads } = await import("./notepads.mjs");
  for (const n of staleNotepads(now, maxAgeMs)) {
    found.push({ id: "notepad:" + n.key, where: "notepad", name: n.key, kind: "folder", path: n.path, folder: n.folder });
  }
  const items = [];
  let bytes = 0;
  for (const f of found) {
    const size = await diskBytes(f.path);
    bytes += size;
    const item = { id: f.id, where: f.where, name: f.name, kind: f.kind, bytes: size, path: f.path };
    if (f.where === "notepad") item.folder = f.folder;
    items.push(item);
  }
  return { items, bytes };
}

/**
 * Remove what Cleanup found, limited to `ids` the page was shown. The list is
 * worked out afresh first and only ids on it are touched, so a name from the
 * page is never a path, and anything that stopped qualifying since the scan
 * (a session touched again) stays. A link is unlinked, never followed.
 * Resolves to `{ removed: [id], bytes, failed: [id] }`.
 */
export async function removeCleanup(ids, opts = {}) {
  const wanted = new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string"));
  const { items } = await cleanupFindings(opts);
  const { removeNotepad } = await import("./notepads.mjs");
  const removed = [];
  const failed = [];
  let bytes = 0;
  for (const item of items) {
    if (!wanted.has(item.id)) continue;
    try {
      if (item.where === "notepad") removeNotepad(item.name);
      else if (item.kind === "link") await fs.promises.unlink(item.path);
      else await fs.promises.rm(item.path, { recursive: true, force: true });
      removed.push(item.id);
      bytes += item.bytes;
    } catch {
      failed.push(item.id);
    }
  }
  return { removed, bytes, failed };
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
// Under the desktop app the page is already in the window beside the terminal,
// so the address would only be noise there: the line points at the window.
export function terminalLine(url, env = process.env) {
  if (env.PLAN2CODE_IN_APP === "1") return "→ Look at the dashboard beside this terminal.";
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

export async function healthOk(handle, timeoutMs = 1500, signal) {
  if (!handle || !handle.url) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  // The caller's own abort ends the check at once (a wait that is done).
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
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
