// git-repo.mjs: the one read-only reader of a git repository.
//
// Everything the git board and the dashboard need to know about a repository
// comes from here: the worktree status, the branch table, the default branch,
// a merge or rebase in progress, the remotes and their web addresses, when it
// was last fetched, and the pull-request link. This module only reads: it
// never changes the repository, the index or the working tree, and every git
// call carries GIT_OPTIONAL_LOCKS=0 so a background look cannot take the index
// lock out from under a commit. The console imports it directly; the git
// skill's scripts reach it through common.mjs. Node built-ins only.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { prUrl } from "./public/pr-url.js";

export { prUrl };

/* ----------------------------------------------------------- running git */

/** Run git with an args array (never a shell). { ok, out, err }. */
export function git(args, cwd, { raw = false, timeout } = {}) {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      timeout,
      // Without this, git status refreshes the index on disk: a write.
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    return { ok: true, out: raw ? stdout : stdout.trim(), err: "" };
  } catch (e) {
    return { ok: false, out: "", err: String(e?.stderr || e?.message || "").trim() };
  }
}

// git switch and git switch -c arrived in 2.23 (August 2019).
const FLOOR = [2, 23, 0];
let floorResult = null;

/** Is git on PATH and at least 2.23? Checked once per process. */
export function gitFloor() {
  if (floorResult) return floorResult;
  const res = git(["--version"]);
  const version = res.ok ? res.out.replace(/^git version\s+/, "") || null : null;
  const m = version && version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!version) {
    floorResult = { ok: false, version: null, message: "git is not installed or not on PATH." };
  } else {
    const parts = m ? m.slice(1, 4).map(Number) : [0, 0, 0];
    const cmp = parts.map((n, i) => n - FLOOR[i]).find((d) => d !== 0) || 0;
    floorResult = m && cmp >= 0
      ? { ok: true, version }
      : { ok: false, version, message: `The git board needs git 2.23 or newer (found ${version}). Update git, then try again.` };
  }
  return floorResult;
}

/* ------------------------------------------------------- worktree status */

// The fields before the path in each porcelain v2 entry kind.
const PATH_AFTER = { 1: 8, 2: 9, u: 10 };

function pathField(record, fields) {
  let at = 0;
  for (let k = 0; k < fields; k++) {
    const next = record.indexOf(" ", at);
    if (next < 0) return "";
    at = next + 1;
  }
  return record.slice(at);
}

const letter = (c) => (c === "." ? " " : c);

function fileState(x, y) {
  if (x === "A" || x === "?" || y === "A" || y === "?") return "new";
  if (x === "D" || y === "D") return "deleted";
  if (x === "R" || x === "C" || y === "R" || y === "C") return "renamed";
  return "modified";
}

/**
 * Parse `git status --porcelain=v2 -z --branch --untracked-files=normal`.
 * Untracked entries come back as files with index " " and worktree "?";
 * unmerged entries go only into `conflicted`. ahead/behind are null without
 * an upstream; hasCommits is false for "(initial)" or without branch headers.
 */
export function parseStatusV2(text) {
  const result = { oid: null, hasCommits: false, branch: null, upstream: null, ahead: null, behind: null, files: [], conflicted: [] };
  const fields = String(text || "").split("\0");
  for (let i = 0; i < fields.length; i++) {
    const rec = fields[i];
    if (!rec) continue;
    if (rec.startsWith("# ")) {
      const [key, ...rest] = rec.slice(2).split(" ");
      const value = rest.join(" ");
      if (key === "branch.oid") {
        result.oid = value === "(initial)" ? null : value;
        result.hasCommits = value !== "(initial)";
      } else if (key === "branch.head") result.branch = value === "(detached)" ? null : value;
      else if (key === "branch.upstream") result.upstream = value;
      else if (key === "branch.ab") {
        const m = value.match(/^\+(\d+) -(\d+)$/);
        if (m) [result.ahead, result.behind] = [Number(m[1]), Number(m[2])];
      }
      continue;
    }
    const kind = rec[0];
    if (kind === "?") {
      result.files.push({ path: rec.slice(2), index: " ", worktree: "?", state: "new" });
      continue;
    }
    if (!(kind in PATH_AFTER)) continue; // "!" ignored, anything unknown too
    const x = letter(rec[2]);
    const y = letter(rec[3]);
    const p = pathField(rec, PATH_AFTER[kind]);
    if (kind === "u") {
      result.conflicted.push({ path: p, status: rec.slice(2, 4) });
      continue;
    }
    const entry = { path: p, index: x, worktree: y, state: fileState(x, y) };
    // A rename or copy carries its original path as one more NUL field.
    if (kind === "2") entry.origPath = fields[++i] || "";
    result.files.push(entry);
  }
  if (!result.upstream) [result.ahead, result.behind] = [null, null];
  return result;
}

export const LARGE_BYTES = 5 * 1024 * 1024;
// Every name is checked for secrets, but only the first STAT_LIMIT files are
// sized, so a forgotten node_modules cannot make this slow.
export const STAT_LIMIT = 2000;

// Basename tests for files that probably hold secrets.
export const ENV_OK = new Set([".env.example", ".env.sample", ".env.template"]);
export function isSensitive(file) {
  const b = file.split("/").pop();
  if (b === ".env" || (b.startsWith(".env.") && !ENV_OK.has(b))) return true;
  if (/\.(pem|key|p12|pfx|keystore|jks)$/.test(b)) return true;
  if (/^id_(rsa|dsa|ecdsa|ed25519)/.test(b)) return true;
  if (/^credentials.*\.json$/.test(b) || b.endsWith(".credentials")) return true;
  if (b === ".npmrc" || b === ".pypirc" || b === ".netrc") return true;
  return b.startsWith("secrets.");
}

/** Sensitive paths and files over 5 MB among `names` (paths from `root`). */
export function riskyFiles(root, names) {
  const sensitive = [];
  const large = [];
  let statted = 0;
  for (const p of new Set(names)) {
    if (isSensitive(p)) sensitive.push(p);
    if (statted >= STAT_LIMIT) continue;
    statted++;
    try {
      const st = fs.statSync(path.join(root, p));
      if (st.isFile() && st.size > LARGE_BYTES) large.push({ path: p, bytes: st.size });
    } catch {
      // a deletion, or a file that vanished
    }
  }
  return { sensitive: sensitive.sort(), large: large.sort((a, b) => a.path.localeCompare(b.path)) };
}

/**
 * What a commit would take, from a parseStatusV2() result. An untracked
 * folder is one row (its files counted with one ls-files) and counts once;
 * risky files inside it still count towards heldBack.
 */
export function readChanges(root, parsed) {
  const listed = [];
  const untrackedDirs = [];
  const inside = [];
  for (const f of parsed?.files || []) {
    if (f.worktree === "?" && f.path.endsWith("/")) {
      const res = git(["ls-files", "-o", "--exclude-standard", "-z", "--", f.path], root, { raw: true });
      const names = res.out.split("\0").filter(Boolean);
      untrackedDirs.push({ path: f.path, files: names.length });
      inside.push(...names);
    } else listed.push(f);
  }
  const { sensitive, large } = riskyFiles(root, [...listed.map((f) => f.path), ...inside]);
  const risky = new Set([...sensitive, ...large.map((l) => l.path)]);
  const files = listed.map((f) => ({ path: f.path, state: f.state, risky: risky.has(f.path), staged: f.index !== " " }));
  return { count: files.length + untrackedDirs.length, heldBack: risky.size, files, untrackedDirs, sensitive, large };
}

/* ------------------------------------------- branches and repository state */

/** origin/HEAD, else local main, else master, else (no commits, on main or master) that branch. */
export function defaultBranch(root, { branch, hasCommits } = {}) {
  const head = git(["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"], root);
  if (head.ok && head.out) return { name: head.out.replace(/^origin\//, ""), from: "origin/HEAD" };
  if (git(["show-ref", "--verify", "-q", "refs/heads/main"], root).ok) return { name: "main", from: "local-main" };
  if (git(["show-ref", "--verify", "-q", "refs/heads/master"], root).ok) return { name: "master", from: "local-master" };
  if (!hasCommits && (branch === "main" || branch === "master")) return { name: branch, from: "unborn" };
  return { name: null, from: null };
}

const REF_FIELDS = [
  "%(refname)",
  "%(refname:short)",
  "%(upstream:short)",
  "%(upstream:track)",
  "%(upstream:remotename)",
  "%(symref)",
  "%(committerdate:iso-strict)",
  "%(authorname)",
  "%(contents:subject)",
];

function track(text) {
  const ahead = text.match(/ahead (\d+)/);
  const behind = text.match(/behind (\d+)/);
  return { ahead: ahead ? Number(ahead[1]) : 0, behind: behind ? Number(behind[1]) : 0, gone: text === "[gone]" };
}

// Subjects and authors go into the board verbatim: drop control bytes, or a
// crafted subject (a \x01 is legal in a commit message) forges a table row.
const cleanText = (s) => (s || "").replace(/[\x00-\x1f\x7f]/g, " ");

/** Every ref under refs/heads and refs/remotes, from one for-each-ref. */
export function readRefs(root) {
  const res = git(["for-each-ref", `--format=${REF_FIELDS.join("%00")}%01`, "refs/heads", "refs/remotes"], root, { raw: true });
  return res.out
    .split("\x01")
    .map((r) => r.replace(/^\r?\n/, ""))
    .filter(Boolean)
    .map((r) => {
      const [ref, short, upstream, trackText, upstreamRemote, symref, at, author, subject] = r.split("\0");
      return { ref, short, upstream, trackText, upstreamRemote, symref, last: { subject: cleanText(subject), author: cleanText(author), at: at || "" } };
    });
}

/** The default branch read off refs already fetched: origin/HEAD's target, else main, else master, else the unborn branch. */
export function defaultBranchFromRefs(refs, { branch, hasCommits } = {}) {
  const head = refs.find((r) => r.ref === "refs/remotes/origin/HEAD");
  if (head && head.symref) {
    const m = head.symref.match(/^refs\/remotes\/[^/]+\/(.+)$/);
    if (m) return { name: m[1], from: "origin/HEAD" };
  }
  if (refs.some((r) => r.ref === "refs/heads/main")) return { name: "main", from: "local-main" };
  if (refs.some((r) => r.ref === "refs/heads/master")) return { name: "master", from: "local-master" };
  if (!hasCommits && (branch === "main" || branch === "master")) return { name: branch, from: "unborn" };
  return { name: null, from: null };
}

/**
 * Every local branch, plus a row for each remote branch no local branch
 * tracks or shares a name with, from the refs readRefs() already fetched
 * (and one --merged read against the default branch).
 */
export function branchesFromRefs(refs, root, { current, defaultName } = {}) {
  const refnames = new Set(refs.map((r) => r.ref));
  const local = [];
  const remote = [];
  for (const r of refs) {
    if (r.ref.startsWith("refs/heads/")) {
      const name = r.ref.slice("refs/heads/".length);
      const t = r.upstream ? track(r.trackText || "") : { ahead: null, behind: null, gone: false };
      local.push({
        name,
        current: name === current,
        default: name === defaultName,
        remote: null,
        upstream: r.upstream || null,
        upstreamRemote: r.upstreamRemote || null,
        ahead: t.ahead,
        behind: t.behind,
        gone: t.gone,
        merged: false,
        last: r.last,
      });
    } else if (r.ref.startsWith("refs/remotes/") && !r.ref.endsWith("/HEAD")) {
      const rest = r.ref.slice("refs/remotes/".length);
      const slash = rest.indexOf("/");
      if (slash < 0) continue;
      remote.push({ short: r.short, remote: rest.slice(0, slash), name: rest.slice(slash + 1), last: r.last });
    }
  }
  const tracked = new Set(local.map((b) => b.upstream).filter(Boolean));
  const names = new Set(local.map((b) => b.name));
  const remoteOnly = remote
    .filter((r) => !tracked.has(r.short) && !tracked.has(`${r.remote}/${r.name}`) && !names.has(r.name))
    .map((r) => ({
      name: r.name,
      current: false,
      default: r.name === defaultName,
      remote: r.remote,
      upstream: null,
      upstreamRemote: null,
      ahead: null,
      behind: null,
      gone: false,
      merged: false,
      last: r.last,
    }));

  if (defaultName) {
    const defaultRef = refnames.has(`refs/remotes/origin/${defaultName}`)
      ? `refs/remotes/origin/${defaultName}`
      : refnames.has(`refs/heads/${defaultName}`)
        ? `refs/heads/${defaultName}`
        : null;
    if (defaultRef) {
      const merged = new Set(
        git(["for-each-ref", "--merged", defaultRef, "--format=%(refname)", "refs/heads"], root).out.split(/\r?\n/).filter(Boolean),
      );
      for (const b of local) b.merged = b.name !== defaultName && merged.has(`refs/heads/${b.name}`);
    }
  }
  return [...local, ...remoteOnly];
}

/** Every local branch plus remote-only rows: readRefs() + branchesFromRefs() in one call. */
export function readBranches(root, { current, defaultName } = {}) {
  return branchesFromRefs(readRefs(root), root, { current, defaultName });
}

const GIT_PATHS = ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "FETCH_HEAD"];

/** Where git keeps its marker files for this worktree, resolved against `root`. {} on failure. */
export function gitPaths(root) {
  const res = git(["rev-parse", ...GIT_PATHS.flatMap((p) => ["--git-path", p])], root);
  const lines = res.ok ? res.out.split(/\r?\n/) : [];
  if (lines.length !== GIT_PATHS.length) return {};
  return Object.fromEntries(GIT_PATHS.map((name, i) => [name, path.resolve(root, lines[i])]));
}

const exists = (p) => !!p && fs.existsSync(p);

/**
 * rebase, am, merge, cherry-pick, revert or null, first match wins, in that
 * order. The rebase dirs come first: a conflicted `merge` entry in an
 * interactive rebase leaves MERGE_HEAD beside rebase-merge/, and the outer
 * operation is the rebase. rebase-apply/applying is git's own am marker
 * (the rule its shell prompt uses); without it the dir is a rebase.
 */
export function inProgressOp(paths = {}) {
  if (exists(paths["rebase-merge"])) return "rebase";
  if (exists(paths["rebase-apply"])) return exists(path.join(paths["rebase-apply"], "applying")) ? "am" : "rebase";
  if (exists(paths.MERGE_HEAD)) return "merge";
  if (exists(paths.CHERRY_PICK_HEAD)) return "cherry-pick";
  if (exists(paths.REVERT_HEAD)) return "revert";
  return null;
}

/**
 * The branch a rebase in progress is rewriting (rebase-merge/ or rebase-apply/
 * head-name), so the board can say "main, rebasing" rather than "not on a
 * branch": HEAD is detached while git replays, but the person is on main.
 */
export function rebasingBranch(paths = {}) {
  for (const dir of [paths["rebase-merge"], paths["rebase-apply"]]) {
    if (!dir) continue;
    try {
      const ref = fs.readFileSync(path.join(dir, "head-name"), "utf8").trim();
      if (ref.startsWith("refs/heads/")) return ref.slice("refs/heads/".length);
    } catch {}
  }
  return null;
}

/** FETCH_HEAD's mtime as an ISO string; null when it was never fetched. */
export function lastFetch(paths = {}) {
  try {
    return fs.statSync(paths.FETCH_HEAD).mtime.toISOString();
  } catch {
    return null;
  }
}

/* --------------------------------------------- remotes and pull requests */

function hostKind(host) {
  if (host === "github.com") return "github";
  if (host === "gitlab.com") return "gitlab";
  if (host === "bitbucket.org") return "bitbucket";
  if (host === "dev.azure.com" || host === "ssh.dev.azure.com" || host.endsWith(".visualstudio.com")) return "azure";
  return null;
}

// user@host:path, but not a Windows drive (C:/repo) and not a URL.
const SCP = /^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/;

/** A remote URL as { host, web, kind }; web is always https:. null when it cannot be read. */
export function parseRemoteUrl(url) {
  const raw = String(url || "").trim();
  let host;
  let port = "";
  let repoPath;
  let ssh = false;
  if (/^(https?|ssh):\/\//i.test(raw)) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      return null;
    }
    host = u.hostname.toLowerCase();
    ssh = u.protocol === "ssh:";
    if (!ssh && u.port) port = `:${u.port}`;
    // Already percent-encoded, which is what a web address needs.
    repoPath = u.pathname;
  } else {
    const m = raw.match(SCP);
    if (!m || /^[A-Za-z]$/.test(m[1])) return null;
    host = m[1].toLowerCase();
    ssh = true;
    repoPath = m[2];
  }
  repoPath = repoPath.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/, "");
  if (!host || !repoPath) return null;

  // Azure DevOps SSH remotes name the repo as v3/<org>/<project>/<repo>.
  const v3 = repoPath.match(/^v3\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (ssh && v3 && host === "ssh.dev.azure.com") {
    return { host: "dev.azure.com", web: `https://dev.azure.com/${v3[1]}/${v3[2]}/_git/${v3[3]}`, kind: "azure" };
  }
  if (ssh && v3 && host === "vs-ssh.visualstudio.com") {
    const web = `https://${v3[1]}.visualstudio.com/${v3[2]}/_git/${v3[3]}`;
    return { host: `${v3[1]}.visualstudio.com`, web, kind: "azure" };
  }
  return { host, web: `https://${host}${port}/${repoPath}`, kind: hostKind(host) };
}

// Userinfo out of a scheme URL: remotes like https://user:token@host/... are
// real (Azure DevOps PATs especially), and this string lands in state.json and
// every state frame. Scp-style user@host:path keeps its user.
const stripUserinfo = (url) => url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@\s]*@/i, "$1");

/** Every remote's fetch URL, web address and host kind; unknown hosts take their kind from prHosts. */
export function readRemotes(root, prHosts = {}) {
  const res = git(["remote", "-v"], root);
  const remotes = [];
  for (const line of res.out.split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+(.+?)\s+\(fetch\)$/);
    if (!m) continue;
    const parsed = parseRemoteUrl(m[2]);
    const host = parsed?.host || null;
    let kind = parsed?.kind || null;
    if (!kind && host && Object.hasOwn(prHosts || {}, host)) kind = prHosts[host];
    remotes.push({ name: m[1], url: stripUserinfo(m[2]), host, web: parsed?.web || null, kind });
  }
  return remotes;
}

/* ------------------------------------------------- snapshot and the count */

const MARKER = /^(<{7}|={7}|>{7})( |$)/m;

function hasMarkers(file) {
  try {
    return MARKER.test(fs.readFileSync(file, "utf8"));
  } catch {
    return false;
  }
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * The state.git snapshot of the worktree at `worktree` (its top level), from
 * about four git processes plus one ls-files per untracked folder. Never
 * throws: a git failure inside a section leaves that section empty.
 */
export function snapshot(worktree, { prHosts = {} } = {}) {
  const at = new Date().toISOString();
  const floor = gitFloor();
  if (!floor.ok) return { at, repo: true, error: floor.message };
  const status = git(["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=normal"], worktree, { raw: true });
  if (!status.ok && !git(["rev-parse", "--git-dir"], worktree).ok) return { at, repo: false };
  const parsed = safe(() => parseStatusV2(status.out), parseStatusV2(""));
  // The branch table's for-each-ref already reads every ref: the default
  // branch comes off it instead of three more probes. When it is empty the
  // standalone probes still answer (empty repo, odd ref state).
  const refs = safe(() => readRefs(worktree), []);
  const def = refs.length
    ? defaultBranchFromRefs(refs, parsed)
    : safe(() => defaultBranch(worktree, parsed), { name: null, from: null });
  const branches = safe(() => branchesFromRefs(refs, worktree, { current: parsed.branch, defaultName: def.name }), []);
  const paths = safe(() => gitPaths(worktree), {});
  const remotes = safe(() => readRemotes(worktree, prHosts), []);
  const changes = safe(() => readChanges(worktree, parsed), { count: 0, heldBack: 0, files: [], untrackedDirs: [], sensitive: [], large: [] });

  let pr = null;
  const cur = branches.find((b) => b.current && !b.remote);
  if (cur && cur.upstream && !cur.gone && !cur.default && def.name) {
    const remote = remotes.find((r) => r.name === cur.upstreamRemote);
    if (remote) pr = prUrl(remote, { base: def.name, head: cur.name });
  }

  return {
    at,
    repo: true,
    hasCommits: parsed.hasCommits,
    head: {
      branch: parsed.branch,
      detached: parsed.branch ? null : parsed.oid ? parsed.oid.slice(0, 7) : null,
      ...(parsed.branch ? {} : { rebasing: safe(() => rebasingBranch(paths), null) }),
      upstream: parsed.upstream,
      // Its remote copy was deleted (fetch --prune): the upstream name is
      // still configured, but there is nothing behind it to pull or push to.
      gone: Boolean(cur && cur.gone),
      ahead: parsed.ahead,
      behind: parsed.behind,
    },
    defaultBranch: def.name,
    inProgress: safe(() => inProgressOp(paths), null),
    conflicted: parsed.conflicted.map((c) => ({ ...c, markers: hasMarkers(path.join(worktree, c.path)) })),
    changes: { count: changes.count, heldBack: changes.heldBack, files: changes.files, untrackedDirs: changes.untrackedDirs },
    remotes,
    lastFetch: safe(() => lastFetch(paths), null),
    refreshFailed: false,
    branches,
    prUrl: pr,
  };
}

/** How many paths a commit would take from `dir` (an untracked folder counts once); null when git cannot say. */
export function countPending(dir) {
  const res = git(["status", "--porcelain=v2", "-z", "--untracked-files=normal"], dir, { raw: true, timeout: 3000 });
  if (!res.ok) return null;
  try {
    const parsed = parseStatusV2(res.out);
    return parsed.files.length + parsed.conflicted.length;
  } catch {
    return null;
  }
}
