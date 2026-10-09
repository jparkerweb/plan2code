#!/usr/bin/env node
// git-state.mjs: what the Git commit skill needs to know about the repository.
//
// The skill's questions about git have one correct answer each: which branch is
// the default, what is staged, which files are risky, what a push would be. They
// live here so no prompt works them out by eye or per shell. This script only
// reads: it never changes the repository, the index or the working tree. The
// agent runs git init, switch, add, commit and push itself, each behind a yes.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EXIT, fail, out, parseArgs, run } from "./common.mjs";

const USAGE = `
git-state.mjs: read-only facts about the git repository. JSON on stdout. It never
changes the repository.

  node git-state.mjs state
  node git-state.mjs branch-check --name <branch>
  node git-state.mjs init-check

state         Run from inside a repository. Prints { ok, root, branch, detached,
              hasCommits, defaultBranch, defaultFrom, onDefault, inProgress,
              conflicted, staged, unstaged, untracked, nothingToCommit,
              sensitive, large, remotes, upstream, ahead, behind, unpublished,
              push }.
                branch        null when HEAD is detached.
                defaultBranch origin/HEAD, else local main, else master, else
                              (no commits yet, on main or master) that branch,
                              else null. defaultFrom says which: origin/HEAD,
                              local-main, local-master, unborn, null.
                inProgress    merge, rebase, cherry-pick, revert or null.
                staged, unstaged, untracked, conflicted
                              [{ path, status }]; a conflicted file is listed
                              only under conflicted.
                sensitive     paths that look like secrets (.env, keys,
                              credentials); left out unless the person insists.
                large         [{ path, bytes }] for files over 5 MB.
                ahead, behind commits against the upstream; null without one.
                unpublished   commits exist and the branch has no upstream.
                push          null when there is nothing to push, no remote, no
                              commits or HEAD is detached; otherwise
                              { command, setsUpstream, remote, needsRemoteChoice }.
branch-check  Is --name a usable new branch name here? Prints { ok, name, valid,
              exists }. Exit 4 when the name is invalid or already taken.
init-check    Run anywhere. Can git init be offered in this folder? Prints { ok,
              path, safe, reason?, insideRepo, repoRoot?, hasGitignore,
              suggestedIgnore }. safe is false (reason: inside-repo, home or
              root) for a folder that is already in a repository, the home
              folder and a drive root. suggestedIgnore lists .gitignore lines
              for what is in the folder (node_modules/, .env, build output).

Exit: 0 ok · 1 crash · 2 bad arguments · 3 not a git repository · 4 invalid or
taken branch name.
`;

const LARGE_BYTES = 5 * 1024 * 1024;
// An untracked folder is one entry in the status; its files are listed
// separately so a .env inside a new folder is still caught. Every name is
// checked, but only the first STAT_LIMIT files are sized, so a forgotten
// node_modules cannot make this slow.
const STAT_LIMIT = 2000;
const CONFLICT = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

function git(args, cwd, { raw = false } = {}) {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      // Without this, git status refreshes the index on disk: a write.
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    return { ok: true, out: raw ? stdout : stdout.trim() };
  } catch {
    return { ok: false, out: "" };
  }
}

function requireRepo() {
  const top = git(["rev-parse", "--show-toplevel"], process.cwd());
  if (!top.ok || !top.out) {
    fail(EXIT.NOT_FOUND, "not-a-repo", "This directory is not inside a git repository.", "Run git-state.mjs init-check to see whether this folder can start one.");
  }
  return top.out;
}

// Basename tests for files that probably hold secrets.
const ENV_OK = new Set([".env.example", ".env.sample", ".env.template"]);
function isSensitive(file) {
  const b = file.split("/").pop();
  if (b === ".env" || (b.startsWith(".env.") && !ENV_OK.has(b))) return true;
  if (/\.(pem|key|p12|pfx|keystore|jks)$/.test(b)) return true;
  if (/^id_(rsa|dsa|ecdsa|ed25519)/.test(b)) return true;
  if (/^credentials.*\.json$/.test(b) || b.endsWith(".credentials")) return true;
  if (b === ".npmrc" || b === ".pypirc" || b === ".netrc") return true;
  return b.startsWith("secrets.");
}

function inProgress(root) {
  const dir = git(["rev-parse", "--absolute-git-dir"], root).out;
  if (!dir) return null;
  const has = (n) => fs.existsSync(path.join(dir, n));
  if (has("MERGE_HEAD")) return "merge";
  if (has("rebase-merge") || has("rebase-apply")) return "rebase";
  if (has("CHERRY_PICK_HEAD")) return "cherry-pick";
  if (has("REVERT_HEAD")) return "revert";
  return null;
}

function defaultBranch(root, branch, hasCommits) {
  const head = git(["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"], root);
  if (head.ok && head.out) return { name: head.out.replace(/^origin\//, ""), from: "origin/HEAD" };
  if (git(["show-ref", "--verify", "-q", "refs/heads/main"], root).ok) return { name: "main", from: "local-main" };
  if (git(["show-ref", "--verify", "-q", "refs/heads/master"], root).ok) return { name: "master", from: "local-master" };
  if (!hasCommits && (branch === "main" || branch === "master")) return { name: branch, from: "unborn" };
  return { name: null, from: null };
}

// git status --porcelain=v1 -z: "XY path" entries; a rename or copy is followed
// by one more field holding the original path.
function parseStatus(root) {
  const res = git(["status", "--porcelain=v1", "-z", "--untracked-files=normal"], root, { raw: true });
  const files = { staged: [], unstaged: [], untracked: [], conflicted: [] };
  const fields = res.out.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.length < 4) continue;
    const x = f[0];
    const y = f[1];
    const p = f.slice(3);
    if (x === "R" || x === "C" || y === "R" || y === "C") i++;
    if (x === "?" && y === "?") files.untracked.push({ path: p, status: "?" });
    else if (CONFLICT.has(x + y)) files.conflicted.push({ path: p, status: x + y });
    else {
      if (x !== " " && x !== "?") files.staged.push({ path: p, status: x });
      if (y !== " " && y !== "?") files.unstaged.push({ path: p, status: y });
    }
  }
  return files;
}

function riskyFiles(root, files) {
  const names = new Set();
  for (const list of [files.staged, files.unstaged, files.untracked, files.conflicted]) {
    for (const f of list) if (!f.path.endsWith("/")) names.add(f.path);
  }
  if (files.untracked.some((f) => f.path.endsWith("/"))) {
    const all = git(["ls-files", "-o", "--exclude-standard", "-z"], root, { raw: true });
    for (const n of all.out.split("\0")) if (n) names.add(n);
  }
  const sensitive = [];
  const large = [];
  let statted = 0;
  for (const p of names) {
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

function pushPlan(root, { branch, hasCommits, remotes, upstream, ahead }) {
  if (!branch || !hasCommits || !remotes.length) return null;
  if (upstream) {
    const configured = git(["config", "--get", `branch.${branch}.remote`], root).out;
    const remote = configured || upstream.split("/")[0];
    if (remote === "." || !ahead) return null;
    return { command: "git push", setsUpstream: false, remote, needsRemoteChoice: false };
  }
  const remote = remotes.length === 1 ? remotes[0] : remotes.includes("origin") ? "origin" : remotes[0];
  return { command: `git push -u ${remote} ${branch}`, setsUpstream: true, remote, needsRemoteChoice: remotes.length > 1 };
}

function state() {
  const root = requireRepo();
  const branchRef = git(["symbolic-ref", "--short", "-q", "HEAD"], root);
  const branch = branchRef.ok && branchRef.out ? branchRef.out : null;
  const hasCommits = git(["rev-parse", "-q", "--verify", "HEAD"], root).ok;
  const def = defaultBranch(root, branch, hasCommits);
  const files = parseStatus(root);
  const { sensitive, large } = riskyFiles(root, files);
  const remotes = git(["remote"], root).out.split(/\r?\n/).filter(Boolean);

  const up = branch ? git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], root) : { ok: false };
  const upstream = up.ok && up.out ? up.out : null;
  let ahead = null;
  let behind = null;
  if (upstream) {
    const counts = git(["rev-list", "--left-right", "--count", "@{u}...HEAD"], root).out.split(/\s+/).map(Number);
    if (counts.length === 2 && counts.every(Number.isFinite)) [behind, ahead] = counts;
  }
  const unpublished = hasCommits && !!branch && !upstream;

  out({
    ok: true,
    root,
    branch,
    detached: branch === null,
    hasCommits,
    defaultBranch: def.name,
    defaultFrom: def.from,
    onDefault: !!branch && !!def.name && branch === def.name,
    inProgress: inProgress(root),
    conflicted: files.conflicted,
    staged: files.staged,
    unstaged: files.unstaged,
    untracked: files.untracked,
    nothingToCommit: !files.staged.length && !files.unstaged.length && !files.untracked.length && !files.conflicted.length,
    sensitive,
    large,
    remotes,
    upstream,
    ahead,
    behind,
    unpublished,
    push: pushPlan(root, { branch, hasCommits, remotes, upstream, ahead }),
  });
}

function branchCheck(args) {
  const name = (args.name || "").trim();
  if (!name) fail(EXIT.USAGE, "missing-name", "--name is required.", "Example: branch-check --name feature/export-csv");
  const root = requireRepo();
  const suggestion = "Use lowercase words joined by '-' under a prefix such as feature/, fix/, chore/ or docs/ (feature/export-csv).";
  // check-ref-format --branch also expands @{-1}; a changed name is not a name.
  const checked = name.startsWith("-") ? { ok: false } : git(["check-ref-format", "--branch", name], root);
  if (!checked.ok || checked.out !== name) {
    fail(EXIT.INVALID, "invalid-name", `"${name}" is not a valid git branch name.`, suggestion);
  }
  const exists = git(["show-ref", "--verify", "-q", `refs/heads/${name}`], root).ok;
  if (exists) fail(EXIT.INVALID, "branch-exists", `A branch named "${name}" already exists.`, `Pick another name, for example "${name}-2".`);
  // git cannot hold both feature and feature/x: a branch is a file in refs/heads.
  const heads = git(["for-each-ref", "--format=%(refname:short)", "refs/heads"], root).out.split(/\r?\n/).filter(Boolean);
  const clash = heads.find((h) => name.startsWith(`${h}/`) || h.startsWith(`${name}/`));
  if (clash) fail(EXIT.INVALID, "branch-conflict", `"${name}" clashes with the existing branch "${clash}" (one is a folder of the other).`, "Pick a name that is not nested under an existing branch.");
  out({ ok: true, name, valid: true, exists: false });
}

// Top-level names that should not go into a first commit.
const IGNORE_DIRS = ["node_modules", "dist", "build", "out", ".next", "coverage", "target", "__pycache__", ".venv", "venv"];

function suggestedIgnore(dir) {
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const lines = [];
  for (const d of IGNORE_DIRS) if (names.includes(d)) lines.push(`${d}/`);
  const envs = names.filter((n) => n === ".env" || (n.startsWith(".env.") && !ENV_OK.has(n)));
  if (envs.length) {
    lines.push(".env", ".env.*");
    if (names.includes(".env.example")) lines.push("!.env.example");
  }
  if (names.includes(".DS_Store")) lines.push(".DS_Store");
  if (names.includes("Thumbs.db")) lines.push("Thumbs.db");
  if (names.some((n) => n.endsWith(".log"))) lines.push("*.log");
  return lines;
}

const sameFolder = (a, b) => (process.platform === "win32" || process.platform === "darwin" ? a.toLowerCase() === b.toLowerCase() : a === b);

function initCheck() {
  const cwd = fs.realpathSync.native(process.cwd());
  const top = git(["rev-parse", "--show-toplevel"], cwd);
  const insideRepo = top.ok && !!top.out;
  let home = os.homedir();
  try {
    home = fs.realpathSync.native(home);
  } catch {
    // a home folder that no longer exists cannot be the current folder
  }
  let safe = true;
  let reason;
  if (insideRepo) [safe, reason] = [false, "inside-repo"];
  else if (sameFolder(cwd, home)) [safe, reason] = [false, "home"];
  else if (cwd === path.parse(cwd).root) [safe, reason] = [false, "root"];
  const result = { ok: true, path: cwd, safe };
  if (reason) result.reason = reason;
  result.insideRepo = insideRepo;
  if (insideRepo) result.repoRoot = top.out;
  result.hasGitignore = fs.existsSync(path.join(cwd, ".gitignore"));
  result.suggestedIgnore = suggestedIgnore(cwd);
  out(result);
}

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { values: ["name"] });
  const [cmd, ...extra] = args._;
  if (!cmd) fail(EXIT.USAGE, "missing-command", "A subcommand is required: state, branch-check or init-check.", "Run with --help for usage.");
  if (extra.length) fail(EXIT.USAGE, "stray-argument", `Unexpected argument(s): ${extra.join(" ")}.`, "Run with --help for usage.");
  if (cmd === "state") return state();
  if (cmd === "branch-check") return branchCheck(args);
  if (cmd === "init-check") return initCheck();
  fail(EXIT.USAGE, "unknown-command", `Unknown subcommand "${cmd}".`, "Use state, branch-check or init-check.");
});
