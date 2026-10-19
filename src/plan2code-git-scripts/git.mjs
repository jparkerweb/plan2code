#!/usr/bin/env node
// git.mjs: what the Git skill knows and says about the repository.
//
// One script for the terminal and the git board. It reports where the
// repository stands, and for every action it builds the exact git command plus
// the confirm text that names the branch, the remote, the commits or files and
// the command itself, so both channels show the same words. It also checks
// branch names, deletes and cleanups, reads a stopped rebase, sorts git's
// errors into kinds with a next step, and prints pull-request links. It only
// reads: the agent runs every command it prints, and guard() refuses the forms
// the skill's rules ban.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EXIT, consoleModule, fail, gitRepo, out, parseArgs, readText, run } from "./common.mjs";

const USAGE = `
git.mjs: read-only facts and exact commands for the Git skill. JSON on stdout.
It never changes the repository: the agent runs every command it prints.

  node git.mjs state
  node git.mjs plan <op> [flags]
  node git.mjs branch-check --name <branch>
  node git.mjs init-check
  node git.mjs delete-check --branch <branch>
  node git.mjs cleanup-list
  node git.mjs conflicts
  node git.mjs pr-url [--branch <branch>] [--base <branch>]
  node git.mjs classify-error --file <stderr.txt>

state           Prints { ok, root, branch, detached, hasCommits,
                defaultBranch, defaultFrom, onDefault, inProgress, conflicted,
                staged, unstaged, untracked, nothingToCommit, sensitive, large,
                remotes, upstream, ahead, behind, unpublished, push, git, next }.
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
                  remotes       remote names.
                  ahead, behind commits against the upstream; null without one.
                  unpublished   commits exist and the branch has no upstream.
                  push          null when there is nothing to push, no remote, no
                                commits or HEAD is detached; otherwise
                                { command, setsUpstream, remote, needsRemoteChoice }.
                  git           the board's snapshot (state.git).
                  next          the likely next action: continue or abort while
                                an operation is stopped, else commit with changes,
                                pull when behind, push when ahead, publish when
                                unpublished; null when there is nothing to do.
plan <op>       Prints { ok, op, ask, confirm?, command | commands, network,
                timeoutMs?, env?, card? }. When ask is true, post confirm as a
                card verbatim (or put card to the person); then run command, or
                each of commands in order, exactly as printed.
                  confirm   { title, body, danger, consequences }; consequences
                            ends with the exact command(s).
                  network   true: run with GIT_TERMINAL_PROMPT=0.
                  timeoutMs stop the command after this long.
                  env       other variables to set for the command.
                  card      a choice for the person before anything runs:
                            dirty  { files, reason, options: commit-first, cancel }
                            switch { files, options: bring?, commit-first,
                                     cancel, reason? } (no bring when git would
                                     refuse; reason names the files)
                            remote { remotes, preset } (no command: plan again
                                     with --remote)
                ops:
                  refresh                          git fetch --prune (--all with
                                                   several remotes), 30 s cap.
                  pull                             --ff-only, or --rebase when the
                                                   branch and its upstream split.
                  push                             new commits to the upstream.
                  publish [--remote <r>]           push -u to a remote.
                  switch --branch <b>              a local branch, or <remote>/<name>
                                                   for a remote-only one.
                  create --name <n> [--from <ref>] a new branch, never published.
                  delete --branch <b>              a local branch; never a remote one.
                  cleanup --select <b> [--select <b> ...]
                                                   branches from cleanup-list.
                  abort                            the stopped merge, rebase,
                                                   cherry-pick or revert.
                  continue                         stage the resolved files, then
                                                   continue it.
branch-check    Is --name a usable new branch name here? Prints { ok, name, valid,
                exists }. Exit 4: invalid-name (stderr), branch-exists (switchTo),
                exists-on-remote (remote, switchTo) or branch-conflict.
init-check      Run anywhere. Can git init be offered in this folder? Prints { ok,
                path, safe, reason?, insideRepo, repoRoot?, hasGitignore,
                suggestedIgnore, branch, commands }. commands start the
                repository on branch: main, unless init.defaultBranch is set.
                safe is false (reason: inside-repo, home or root) for a
                folder that is already in a repository, the home
                folder and a drive root. suggestedIgnore lists .gitignore lines
                for what is in the folder (node_modules/, .env, build output).
delete-check    What deleting --branch would lose. Prints { ok, branch, merged,
                gone, onlyHere: { count, commits: [{ sha, subject }] (first 10) },
                remoteCopy: { ref, hasAll } | null, flag: -d | -D, sentence }.
cleanup-list    Prints { ok, merged, gone }: local branches merged into the default
                branch, and branches whose remote copy was deleted. Never the
                current or the default branch.
conflicts       The stopped operation. Prints { ok, op, step, total, commit:
                { sha, subject } | null, files: [{ path, status, markers }],
                ready }. ready: no file still has conflict markers. Exit 4
                nothing-in-progress.
pr-url          Prints { ok, url, host, kind, needsKind } for --branch (the current
                branch) into --base (the default branch). needsKind: the host is
                unknown and has no saved answer, so url is null; ask its kind
                once. Exit 4 not-pushed without an upstream, is-base when the
                branch is --base itself (a push to the default branch).
classify-error  Run anywhere. Sorts git's stderr saved in --file. Prints { ok,
                kind, next, files? }: kind is rejected, auth, dirty (files),
                conflict, diverged, network or other.

Exit: 0 ok · 1 crash · 2 bad arguments · 3 not a git repository · 4 invalid
input, or nothing to do · 5 refused by a rule.
`;

let R; // git-repo.mjs, loaded once main() runs

const g = (args, cwd, opts) => R.git(args, cwd, opts);

function requireGit() {
  const floor = R.gitFloor();
  if (!floor.ok) fail(EXIT.REFUSED, "git-too-old", floor.message, "Install or update git (2.23 or newer), then try again.");
}

function requireRepo() {
  const top = g(["rev-parse", "--show-toplevel"], process.cwd());
  if (!top.ok || !top.out) {
    fail(EXIT.NOT_FOUND, "not-a-repo", "This directory is not inside a git repository.", "Run git.mjs init-check to see whether this folder can start one.");
  }
  return top.out;
}

/* ------------------------------------------------------- commands, guarded */

/** A command as one line for a person to read: args joined by spaces, quoted when they hold a space or quote. */
export function display(command) {
  return command.map((a) => (a === "" || /[\s"']/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(" ");
}

/**
 * The skill's banned forms, refused before any command is printed: no force
 * push, no hook skipping, no amend, no remote delete, no blanket add. A crash,
 * not a handled failure, because no rule-following caller ever builds one.
 */
export function guard(command) {
  if (!Array.isArray(command) || command[0] !== "git" || !command.every((a) => typeof a === "string")) {
    fail(EXIT.CRASH, "forbidden-command", 'A command must be an args array starting with "git".');
  }
  // The subcommand is the first word after git's own options (-c key=value, -C dir).
  let i = 1;
  while (i < command.length && command[i].startsWith("-")) i += command[i] === "-c" || command[i] === "-C" ? 2 : 1;
  const sub = command[i];
  const rest = command.slice(i + 1);
  // Paths after "--" are file names, never options: a file called -A is legal,
  // and one called --force must not trip the flag checks.
  const opts = rest.includes("--") ? rest.slice(0, rest.indexOf("--")) : rest;
  const banned =
    opts.some((a) => a === "--force" || a === "--force-with-lease" || a.startsWith("--force-with-lease=") || a === "--no-verify" || a === "--amend") ||
    (sub === "push" && opts.some((a) => a === "-f" || /^-[a-zA-Z]*f/.test(a) || a === "--delete" || a === "-d" || a === "--prune" || a === "--mirror" || a.startsWith(":") || a.startsWith("+"))) ||
    (sub === "commit" && opts.some((a) => a === "-n" || a === "-a" || a === "--all" || /^-[a-zA-Z]*a/.test(a))) ||
    (sub === "add" && (opts.some((a) => a === "-A" || a === "--all" || a === "-u" || a === "--update") || rest.includes(".")));
  if (banned) fail(EXIT.CRASH, "forbidden-command", `Refusing to print a forbidden command: ${display(command)}.`);
  return command;
}

/* ------------------------------------------------------ the repository */

const refExists = (root, ref) => g(["show-ref", "--verify", "-q", ref], root).ok;
const remoteNames = (root) => g(["remote"], root).out.split(/\r?\n/).filter(Boolean);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function prHosts() {
  return (await consoleModule("settings.mjs")).readPrHosts();
}

function readStatus(root) {
  return R.parseStatusV2(g(["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=normal"], root, { raw: true }).out);
}

// The commit flow's lists and letters: a conflicted file only under conflicted.
function fileLists(parsed) {
  const staged = [];
  const unstaged = [];
  const untracked = [];
  for (const f of parsed.files) {
    if (f.worktree === "?") {
      untracked.push({ path: f.path, status: "?" });
      continue;
    }
    if (f.index !== " ") staged.push({ path: f.path, status: f.index });
    if (f.worktree !== " ") unstaged.push({ path: f.path, status: f.worktree });
  }
  return { staged, unstaged, untracked, conflicted: parsed.conflicted.map((c) => ({ path: c.path, status: c.status })) };
}

/** Everything a plan or check reads, from one status and one ref pass. */
function repoState(root) {
  const parsed = readStatus(root);
  const refs = R.readRefs(root);
  const def = refs.length ? R.defaultBranchFromRefs(refs, parsed) : R.defaultBranch(root, parsed);
  const branches = R.branchesFromRefs(refs, root, { current: parsed.branch, defaultName: def.name });
  const lists = fileLists(parsed);
  // Tracked changes (staged, unstaged or conflicted); untracked files carry over a switch.
  const tracked = [...new Set([...lists.staged, ...lists.unstaged, ...lists.conflicted].map((f) => f.path))];
  return {
    root,
    parsed,
    def,
    branches,
    lists,
    tracked,
    branch: parsed.branch,
    current: branches.find((b) => b.current && !b.remote) || null,
    remotes: remoteNames(root),
    paths: R.gitPaths(root),
  };
}

const localBranch = (s, name) => s.branches.find((b) => !b.remote && b.name === name) || null;
const upstreamGone = (s) => !!s.parsed.upstream && (s.current?.gone || s.parsed.ahead === null);

function pushPlan(root, { branch, hasCommits, remotes, upstream, ahead }) {
  if (!branch || !hasCommits || !remotes.length) return null;
  if (upstream) {
    const configured = g(["config", "--get", `branch.${branch}.remote`], root).out;
    const remote = configured || upstream.split("/")[0];
    if (remote === "." || !ahead) return null;
    return { command: "git push", setsUpstream: false, remote, needsRemoteChoice: false };
  }
  const remote = remotes.length === 1 ? remotes[0] : remotes.includes("origin") ? "origin" : remotes[0];
  return { command: `git push -u ${remote} ${branch}`, setsUpstream: true, remote, needsRemoteChoice: remotes.length > 1 };
}

const MARKER = /^(<{7}|={7}|>{7})( |$)/m;
function hasMarkers(root, file) {
  const text = readText(path.join(root, file));
  return text !== null && MARKER.test(text);
}

async function state({ root }) {
  const snap = R.snapshot(root, { prHosts: await prHosts() });
  const parsed = readStatus(root);
  const { branch, hasCommits, ahead, behind } = parsed;
  // For the commit flow, an upstream deleted on the remote is no upstream.
  const upstream = parsed.upstream && ahead !== null ? parsed.upstream : null;
  const def = R.defaultBranch(root, parsed);
  const files = fileLists(parsed);
  const { sensitive, large } = R.readChanges(root, parsed);
  const remotes = remoteNames(root);
  const unpublished = hasCommits && !!branch && !upstream;
  const inProgress = snap.inProgress ?? null;

  let next = null;
  if (inProgress) next = (snap.conflicted || []).some((c) => c.markers) ? "abort" : "continue";
  else if (parsed.files.length || parsed.conflicted.length) next = "commit";
  else if (behind > 0) next = "pull";
  else if (ahead > 0) next = "push";
  else if (unpublished && remotes.length) next = "publish";

  out({
    ok: true,
    root,
    branch,
    detached: branch === null,
    hasCommits,
    defaultBranch: def.name,
    defaultFrom: def.from,
    onDefault: !!branch && !!def.name && branch === def.name,
    inProgress,
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
    git: snap,
    next,
  });
}

/* --------------------------------------------------------- name checks */

const NAME_HINT = "Use lowercase words joined by '-' under a prefix such as feature/, fix/, chore/ or docs/ (feature/export-csv).";

/** Fails (exit 4) unless `name` is a valid branch name no local or remote branch already holds. */
function checkName(root, name) {
  // check-ref-format --branch also expands @{-1}; a changed name is not a name.
  const checked = name.startsWith("-") ? { ok: false, err: "" } : g(["check-ref-format", "--branch", name], root);
  if (!checked.ok || checked.out !== name) {
    fail(EXIT.INVALID, "invalid-name", `"${name}" is not a valid git branch name.`, NAME_HINT, checked.err ? { stderr: checked.err } : undefined);
  }
  if (refExists(root, `refs/heads/${name}`)) {
    fail(EXIT.INVALID, "branch-exists", `A branch named "${name}" already exists.`, `Switch to it, or pick another name, for example "${name}-2".`, { switchTo: { branch: name } });
  }
  for (const remote of remoteNames(root)) {
    if (refExists(root, `refs/remotes/${remote}/${name}`)) {
      fail(EXIT.INVALID, "exists-on-remote", `"${name}" exists on ${remote}.`, `Switch to ${remote}/${name} to work on it, or pick another name.`, {
        remote,
        switchTo: { branch: `${remote}/${name}` },
      });
    }
  }
  // git cannot hold both feature and feature/x: a branch is a file in refs/heads.
  const heads = g(["for-each-ref", "--format=%(refname:short)", "refs/heads"], root).out.split(/\r?\n/).filter(Boolean);
  const clash = heads.find((h) => name.startsWith(`${h}/`) || h.startsWith(`${name}/`));
  if (clash) {
    fail(EXIT.INVALID, "branch-conflict", `"${name}" clashes with the existing branch "${clash}" (one is a folder of the other).`, "Pick a name that is not nested under an existing branch.", { branch: clash });
  }
}

function requireValue(value, flag, example) {
  const v = (value || "").trim();
  if (!v) fail(EXIT.USAGE, `missing-${flag}`, `--${flag} is required.`, `Example: ${example}`);
  return v;
}

function branchCheck({ root, name }) {
  const n = requireValue(name, "name", "branch-check --name feature/export-csv");
  checkName(root, n);
  out({ ok: true, name: n, valid: true, exists: false });
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
  const envs = names.filter((n) => n === ".env" || (n.startsWith(".env.") && !R.ENV_OK.has(n)));
  if (envs.length) {
    lines.push(".env", ".env.*");
    for (const n of R.ENV_OK) if (names.includes(n)) lines.push(`!${n}`);
  }
  if (names.includes(".DS_Store")) lines.push(".DS_Store");
  if (names.includes("Thumbs.db")) lines.push("Thumbs.db");
  if (names.some((n) => n.endsWith(".log"))) lines.push("*.log");
  return lines;
}

const sameFolder = (a, b) => (process.platform === "win32" || process.platform === "darwin" ? a.toLowerCase() === b.toLowerCase() : a === b);

function initCheck() {
  const cwd = fs.realpathSync.native(process.cwd());
  const top = g(["rev-parse", "--show-toplevel"], cwd);
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
  // A new repository starts on main, not git's legacy master, unless the
  // person set init.defaultBranch themselves. Two commands rather than
  // `git init -b`, which needs git 2.28 (the floor here is 2.23).
  const configured = g(["config", "--get", "init.defaultBranch"], cwd);
  const branch = (configured.ok && configured.out.trim()) || "main";
  result.branch = branch;
  result.commands = [["git", "init"], ["git", "symbolic-ref", "HEAD", `refs/heads/${branch}`]];
  out(result);
}

/* -------------------------------------------------------------- plan <op> */

const PLANS = {
  refresh: planRefresh,
  pull: planPull,
  push: planPush,
  publish: planPublish,
  switch: planSwitch,
  create: planCreate,
  delete: planDelete,
  cleanup: planCleanup,
  abort: planAbort,
  continue: planContinue,
};

/** The confirm's last lines: the exact command(s), one per line, as a person would type them. */
function consequences(commands) {
  return "```\n" + commands.map(display).join("\n") + "\n```";
}

function plan({ root, ...args }, [op]) {
  const ops = Object.keys(PLANS).join(", ");
  if (!op) fail(EXIT.USAGE, "missing-op", `plan needs an op: ${ops}.`, "Run with --help for usage.");
  if (!Object.hasOwn(PLANS, op)) fail(EXIT.USAGE, "unknown-op", `Unknown plan op "${op}".`, `Use one of: ${ops}.`);
  const p = PLANS[op](repoState(root), args);
  const list = p.command ? [p.command] : p.commands || [];
  list.forEach(guard);
  const result = { ok: true, op, ask: !!p.ask };
  if (p.confirm) result.confirm = { title: p.confirm.title, body: p.confirm.body, danger: !!p.confirm.danger, consequences: consequences(list) };
  if (p.command) result.command = p.command;
  if (p.commands) result.commands = p.commands;
  result.network = !!p.network;
  if (p.timeoutMs) result.timeoutMs = p.timeoutMs;
  if (p.env) result.env = p.env;
  if (p.card) result.card = p.card;
  out(result);
}

function requireBranch(s, what) {
  if (!s.branch) fail(EXIT.REFUSED, "detached", `HEAD is detached, so there is no branch to ${what}.`, "Switch to a branch first.");
}

function requireRemote(s, exit = EXIT.REFUSED) {
  if (!s.remotes.length) fail(exit, "no-remote", "This repository has no remote.", "Add one with git remote add <name> <url>, then try again.");
}

function planRefresh(s) {
  // No remote, nothing to fetch: a Refresh is the person asking the board to
  // look at the folder again (edits made in their editor), which the reread
  // that follows does. Nothing to run.
  if (!s.remotes.length) return { ask: false, commands: [] };
  const command = s.remotes.length > 1 ? ["git", "fetch", "--all", "--prune"] : ["git", "fetch", "--prune"];
  return { ask: false, command, network: true, timeoutMs: 30000 };
}

function planPull(s) {
  requireBranch(s, "pull into");
  const { upstream, ahead, behind } = s.parsed;
  if (!upstream) fail(EXIT.INVALID, "no-upstream", `${s.branch} has no upstream to pull from.`, "Publish the branch first (plan publish).");
  if (upstreamGone(s)) fail(EXIT.INVALID, "upstream-gone", `${s.branch}'s upstream ${upstream} no longer exists on the remote.`, "Publish it again, or switch to another branch.");
  if (behind === 0) fail(EXIT.INVALID, "up-to-date", `${s.branch} already has everything on ${upstream}.`, "Refresh first if you expect new commits.");
  if (ahead === 0) return { ask: false, command: ["git", "pull", "--ff-only"], network: true };
  // A split: replay the unpushed commits on top. Never stashed, never autostashed.
  const pull = { command: ["git", "pull", "--rebase"], network: true, env: { GIT_EDITOR: "true" } };
  const changed = [...new Set([...s.lists.staged, ...s.lists.unstaged].map((f) => f.path))];
  if (!changed.length) return { ...pull, ask: false };
  return {
    ...pull,
    ask: true,
    card: { kind: "dirty", files: changed, reason: "git pull --rebase needs a clean tree: these files have changes.", options: ["commit-first", "cancel"] },
  };
}

function planPush(s) {
  requireBranch(s, "push");
  requireRemote(s);
  const { upstream, ahead, behind } = s.parsed;
  const remote = s.current?.upstreamRemote || (upstream ? upstream.split("/")[0] : null);
  if (!upstream || upstreamGone(s) || !remote || remote === "." || !(ahead > 0)) {
    fail(EXIT.INVALID, "nothing-to-push", `${s.branch} has no new commits to push to an upstream.`, upstream && !upstreamGone(s) ? "Commit first." : "Publish the branch first (plan publish).");
  }
  const log = g(["log", "--oneline", "-n", "20", "@{u}..HEAD"], s.root).out.split(/\r?\n/).filter(Boolean);
  let body = log.map((line) => `- ${line}`).join("\n");
  // A branch tracking another name (feature/x on origin/main): the push still goes to its own name.
  if (upstream !== `${remote}/${s.branch}`) body += `\n\nYour upstream is ${upstream}; this push goes to ${remote}/${s.branch} instead.`;
  if (behind > 0) body += `\n\nThe remote has ${plural(behind, "commit")} you don't have, so this push will likely be rejected: Pull first.`;
  return {
    ask: true,
    command: ["git", "push", remote, s.branch],
    network: true,
    confirm: { title: `Push ${plural(ahead, "commit")} to ${remote}/${s.branch}?`, body, danger: false },
  };
}

function planPublish(s, { remote: chosen }) {
  requireBranch(s, "publish");
  requireRemote(s);
  if (!s.parsed.hasCommits) fail(EXIT.INVALID, "no-commits", `${s.branch} has no commits to publish yet.`, "Commit first.");
  // An upstream deleted on the remote can be published again.
  if (s.parsed.upstream && !upstreamGone(s)) fail(EXIT.INVALID, "already-published", `${s.branch} already tracks ${s.parsed.upstream}.`, "Use plan push to send new commits.");
  if (chosen && !s.remotes.includes(chosen)) fail(EXIT.INVALID, "unknown-remote", `There is no remote named "${chosen}".`, `Use one of: ${s.remotes.join(", ")}.`);
  if (!chosen && s.remotes.length > 1) {
    return { ask: true, network: true, card: { kind: "remote", remotes: s.remotes, preset: s.remotes.includes("origin") ? "origin" : s.remotes[0] } };
  }
  const remote = chosen || s.remotes[0];
  const n = Number(g(["rev-list", "--count", "HEAD", "--not", `--remotes=${remote}`], s.root).out) || 0;
  return {
    ask: true,
    command: ["git", "push", "-u", remote, s.branch],
    network: true,
    confirm: { title: `Publish ${s.branch} to ${remote}?`, body: n ? `Creates ${s.branch} on ${remote} and pushes ${plural(n, "commit")}.` : `Creates ${s.branch} on ${remote}; its commits are already there.`, danger: false },
  };
}

/**
 * Which of `paths` exist in `target`'s tree: one git cat-file --batch-check
 * for all of them. --batch-check reads one object name per line, so a path
 * holding a newline would split into two queries and shift every answer after
 * it; those few are asked one at a time with cat-file -e instead.
 */
function inTree(root, target, paths) {
  const opts = { cwd: root, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } };
  const plain = paths.filter((p) => !p.includes("\n"));
  const odd = paths.filter((p) => p.includes("\n"));
  const found = [];
  if (plain.length) {
    try {
      const res = execFileSync("git", ["cat-file", "--batch-check"], {
        ...opts,
        input: plain.map((p) => `${target}:${p}`).join("\n") + "\n",
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      const lines = res.split("\n");
      found.push(...plain.filter((_, i) => lines[i] && !lines[i].endsWith(" missing")));
    } catch {
      // An unreadable target means no path is known to be in it.
    }
  }
  for (const p of odd) {
    try {
      execFileSync("git", ["cat-file", "-e", `${target}:${p}`], opts);
      found.push(p);
    } catch {
      // Not in the target's tree.
    }
  }
  return found;
}

/**
 * The changed files git switch would refuse to carry to `target`: a changed
 * tracked path that differs between HEAD and the target, or an untracked path
 * the target has.
 */
function wouldRefuse(s, target) {
  const changed = new Set(s.tracked);
  for (const f of s.parsed.files) if (f.origPath) changed.add(f.origPath);
  const differ = s.parsed.hasCommits ? g(["diff", "--name-only", "-z", "HEAD", target, "--"], s.root, { raw: true }).out.split("\0").filter(Boolean) : [];
  const tracked = differ.filter((p) => changed.has(p));
  const untracked = [];
  for (const f of s.parsed.files) {
    if (f.worktree !== "?") continue;
    if (!f.path.endsWith("/")) untracked.push(f.path);
    else untracked.push(...g(["ls-files", "-o", "--exclude-standard", "-z", "--", f.path], s.root, { raw: true }).out.split("\0").filter(Boolean));
  }
  return [...new Set([...tracked, ...inTree(s.root, target, untracked)])];
}

/** The switch card, or null when nothing needs asking. `always`: ask about carried changes too. */
function switchCard(s, target, { always }) {
  const refused = wouldRefuse(s, target);
  if (!refused.length && !(always && s.tracked.length)) return null;
  const card = { kind: "switch", files: [...new Set([...s.tracked, ...refused])], options: ["bring", "commit-first", "cancel"] };
  if (refused.length) {
    card.options = ["commit-first", "cancel"];
    card.reason = `git switch would refuse: ${refused.join(", ")} ${refused.length === 1 ? "differs" : "differ"} on ${target}.`;
  }
  return card;
}

function planSwitch(s, { branch }) {
  const b = requireValue(branch, "branch", "plan switch --branch main");
  if (b === s.branch) fail(EXIT.INVALID, "already-on", `Already on ${b}.`, "Pick another branch.");
  let command;
  if (!b.startsWith("-") && localBranch(s, b)) command = ["git", "switch", b];
  else if (!b.startsWith("-") && s.remotes.some((r) => b.startsWith(`${r}/`)) && refExists(s.root, `refs/remotes/${b}`)) {
    // --track creates a local branch under the remote name: an existing one
    // (tracking something else) makes git refuse, so say so up front.
    const taken = localBranch(s, b.slice(b.indexOf("/") + 1));
    if (taken) {
      fail(EXIT.INVALID, "branch-exists", `A local branch named "${taken.name}" already exists (tracking ${taken.upstream || "nothing"}).`, `Switch to ${taken.name}, or delete it first.`, { switchTo: { branch: taken.name } });
    }
    command = ["git", "switch", "--track", b];
  }
  else fail(EXIT.INVALID, "unknown-branch", `There is no branch named "${b}".`, "Refresh, then pick a branch from the list.");
  const card = switchCard(s, b, { always: true });
  return card ? { ask: true, command, network: false, card } : { ask: false, command, network: false };
}

/** Where a new branch starts: origin/<default>, else the local default, else the current branch, else HEAD. */
function defaultStart(s) {
  const d = s.def.name;
  if (d && refExists(s.root, `refs/remotes/origin/${d}`)) return `origin/${d}`;
  if (d && refExists(s.root, `refs/heads/${d}`)) return d;
  if (s.branch && s.parsed.hasCommits) return s.branch;
  if (s.parsed.oid) return s.parsed.oid.slice(0, 7);
  fail(EXIT.INVALID, "no-commits", "There are no commits to start a branch from yet.", "Commit first.");
}

function planCreate(s, { name, from }) {
  const n = requireValue(name, "name", "plan create --name feature/export-csv");
  checkName(s.root, n);
  let start = (from || "").trim();
  if (start) {
    if (start.startsWith("-") || !g(["rev-parse", "--verify", "--quiet", `${start}^{commit}`], s.root).ok) {
      fail(EXIT.INVALID, "bad-from", `"${start}" is not a branch or commit here.`, "Pick a branch from the list, or leave --from out.");
    }
  } else start = defaultStart(s);
  // --no-track: a branch started from origin/main must not take origin/main as its upstream.
  const command = ["git", "switch", "--no-track", "-c", n, start];
  const card = switchCard(s, start, { always: false });
  return card ? { ask: true, command, network: false, card } : { ask: false, command, network: false };
}

function requireLocal(s, branch) {
  const b = requireValue(branch, "branch", "--branch feature/old-work");
  const row = localBranch(s, b);
  if (!row) fail(EXIT.INVALID, "unknown-branch", `There is no local branch named "${b}".`, "Pick a branch from the list.");
  return row;
}

function planDelete(s, { branch }) {
  const row = requireLocal(s, branch);
  const b = row.name;
  if (row.current) fail(EXIT.REFUSED, "refused", `${b} is the branch you are on.`, "Switch to another branch first.");
  if (b === s.def.name) fail(EXIT.REFUSED, "refused", `${b} is the default branch.`, "The default branch is never deleted here.");
  const check = deleteCheck(s, row);
  if (row.merged && !row.gone) {
    return { ask: true, command: ["git", "branch", check.flag, b], confirm: { title: `Delete ${b}?`, body: `It is merged into ${s.def.name}.`, danger: false } };
  }
  // Red only when commits would really be lost: a branch git calls unmerged
  // (merged elsewhere, say into origin/main but not main) with nothing of its
  // own still needs -D, but deleting it loses nothing.
  return { ask: true, command: ["git", "branch", "-D", b], confirm: { title: `Delete ${b}?`, body: check.sentence, danger: check.onlyHere.count > 0 } };
}

/**
 * The flag for deleting a branch merged into the default. git branch -d checks
 * the branch's upstream, or HEAD without one, not the default branch, so it
 * refuses a merged branch HEAD does not contain; -D is safe there, since the
 * merge into the default already shows nothing is lost.
 */
function mergedFlag(s, row) {
  const reference = row.upstream && !row.gone ? row.upstream : "HEAD";
  return g(["merge-base", "--is-ancestor", `refs/heads/${row.name}`, reference], s.root).ok ? "-d" : "-D";
}

function planCleanup(s, { select }) {
  const picked = [...new Set((select || []).map((b) => b.trim()).filter(Boolean))];
  if (!picked.length) fail(EXIT.USAGE, "missing-select", "plan cleanup needs at least one --select <branch>.", "Run cleanup-list for the branches that can go.");
  const { merged, gone } = cleanupList(s);
  for (const b of picked) {
    if (!merged.includes(b) && !gone.includes(b)) fail(EXIT.INVALID, "not-cleanable", `${b} is not in the cleanup list.`, "Run cleanup-list for the branches that can go.", { branch: b });
  }
  const commands = picked.map((b) => ["git", "branch", gone.includes(b) ? "-D" : mergedFlag(s, localBranch(s, b)), b]);
  const lines = [];
  const m = picked.filter((b) => merged.includes(b));
  const x = picked.filter((b) => gone.includes(b));
  if (m.length) lines.push(`Merged into ${s.def.name}: ${m.join(", ")}.`);
  if (x.length) lines.push(`Their remote copy was deleted: ${x.join(", ")}.`);
  return {
    ask: true,
    commands,
    confirm: { title: `Delete ${picked.length} ${picked.length === 1 ? "branch" : "branches"}?`, body: lines.join("\n\n"), danger: x.some((b) => deleteCheck(s, localBranch(s, b)).onlyHere.count > 0) },
  };
}

function requireInProgress(s) {
  const op = R.inProgressOp(s.paths);
  if (!op) fail(EXIT.INVALID, "nothing-in-progress", "No merge, rebase, cherry-pick or revert is in progress.", "Nothing to abort or continue.");
  return op;
}

function planAbort(s) {
  return { ask: false, command: ["git", requireInProgress(s), "--abort"] };
}

function planContinue(s) {
  const op = requireInProgress(s);
  const files = s.lists.conflicted.map((c) => ({ path: c.path, markers: hasMarkers(s.root, c.path) }));
  const still = files.filter((f) => f.markers).map((f) => f.path);
  if (still.length) {
    fail(EXIT.REFUSED, "still-conflicted", `${still.join(", ")} still ${still.length === 1 ? "has" : "have"} conflict markers.`, "Resolve them, then continue.", { files: still });
  }
  const resolved = files.map((f) => f.path);
  const commands = [...(resolved.length ? [["git", "add", "--", ...resolved]] : []), ["git", "-c", "core.editor=true", op, "--continue"]];
  return { ask: false, commands };
}

/* ----------------------------------------------------- delete and cleanup */

/** The remote copy of a local branch: its upstream, else <remote>/<name>; null when none exists. */
function remoteCopy(s, row) {
  const candidates = [];
  if (row.upstream && row.upstreamRemote && row.upstreamRemote !== ".") candidates.push(row.upstream);
  for (const r of s.remotes) candidates.push(`${r}/${row.name}`);
  const ref = candidates.find((c) => refExists(s.root, `refs/remotes/${c}`));
  if (!ref) return null;
  const left = g(["rev-list", "--count", `refs/heads/${row.name}`, "--not", `refs/remotes/${ref}`], s.root).out;
  return { ref, hasAll: left === "0" };
}

function deleteCheck(s, row) {
  const b = row.name;
  const copy = remoteCopy(s, row);
  // Commits on no other branch and no remote, the branch's own remote copy aside,
  // so the sentence can say whether that copy still has them. Before --branches
  // and --remotes, git matches --exclude without the refs/heads/ or refs/remotes/ prefix.
  const not = ["--not", `--exclude=${b}`, "--branches", ...(copy ? [`--exclude=${copy.ref}`] : []), "--remotes"];
  const count = Number(g(["rev-list", "--count", `refs/heads/${b}`, ...not], s.root).out) || 0;
  const commits = count
    ? g(["log", "-n", "10", "--format=%h%x00%s", `refs/heads/${b}`, ...not], s.root)
        .out.split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [sha, subject] = line.split("\0");
          return { sha, subject: subject || "" };
        })
    : [];
  let sentence;
  if (!count) sentence = `No commits exist only on ${b}.`;
  else {
    const lead = `${count} ${count === 1 ? "commit exists" : "commits exist"} only on ${b}`;
    sentence = copy?.hasAll ? `${lead}, and ${copy.ref} still has ${count === 1 ? "it" : "them"}.` : `${lead}, and no remote copy has ${count === 1 ? "it" : "them"}.`;
  }
  return {
    branch: b,
    merged: row.merged,
    gone: row.gone,
    onlyHere: { count, commits },
    remoteCopy: copy,
    flag: row.merged && !row.gone ? mergedFlag(s, row) : "-D",
    sentence,
  };
}

/** Local branches that can go: merged into the default, or their remote copy deleted (gone wins). */
function cleanupList(s) {
  const merged = [];
  const gone = [];
  for (const b of s.branches) {
    if (b.remote || b.current || b.name === s.def.name) continue;
    if (b.gone) gone.push(b.name);
    else if (b.merged) merged.push(b.name);
  }
  return { merged, gone };
}

function deleteCheckCmd({ root, branch }) {
  const s = repoState(root);
  out({ ok: true, ...deleteCheck(s, requireLocal(s, branch)) });
}

function cleanupListCmd({ root }) {
  out({ ok: true, ...cleanupList(repoState(root)) });
}

/* ------------------------------------------------- conflicts, errors, links */

const OP_HEAD = { merge: "MERGE_HEAD", "cherry-pick": "CHERRY_PICK_HEAD", revert: "REVERT_HEAD", rebase: "REBASE_HEAD" };

function readNumber(file) {
  const n = parseInt(readText(file) || "", 10);
  return Number.isFinite(n) ? n : null;
}

function headCommit(root, ref) {
  const res = g(["log", "-1", "--format=%h%x00%s", ref, "--"], root);
  if (!res.ok || !res.out) return null;
  const [sha, subject] = res.out.split("\0");
  return { sha, subject: subject || "" };
}

function conflicts({ root }) {
  const s = repoState(root);
  const op = requireInProgress(s);
  let step = null;
  let total = null;
  if (op === "rebase") {
    const merge = s.paths["rebase-merge"];
    const apply = s.paths["rebase-apply"];
    if (merge && fs.existsSync(merge)) [step, total] = [readNumber(path.join(merge, "msgnum")), readNumber(path.join(merge, "end"))];
    else if (apply) [step, total] = [readNumber(path.join(apply, "next")), readNumber(path.join(apply, "last"))];
  }
  const files = s.lists.conflicted.map((c) => ({ path: c.path, status: c.status, markers: hasMarkers(root, c.path) }));
  out({ ok: true, op, step, total, commit: headCommit(root, OP_HEAD[op]), files, ready: !files.some((f) => f.markers) });
}

// First match wins, in this order.
const ERROR_KINDS = [
  ["rejected", ["[rejected]", "non-fast-forward", "fetch first"], "Pull first, then push again."],
  [
    "auth",
    ["Authentication failed", "could not read Username", "terminal prompts disabled", "Permission denied (publickey)", "The requested URL returned error: 403"],
    "This tool never handles logins. Sign in from your terminal (ssh-add, or your git credential helper), then try again.",
  ],
  ["dirty", ["would be overwritten by", "You have unstaged changes", "Please commit your changes or stash them"], "Commit first, or cancel."],
  ["conflict", ["CONFLICT (", "could not apply", "Resolve all conflicts manually"], "Resolve the conflicts, or abort."],
  // A pull --ff-only the remote outran since the last look: the board plans a
  // rebase pull once it has seen the split.
  ["diverged", ["Not possible to fast-forward", "Diverging branches can't be fast-forwarded"], "Refresh, then Pull again: it rebases your commits onto the remote's."],
  [
    "network",
    ["Could not resolve host", "timed out", "Connection refused", "Couldn't connect to server", "Failed to connect", "unable to access", "Could not read from remote repository", "does not appear to be a git repository"],
    "Check your network or VPN, and the remote's address, then Refresh.",
  ],
];

function classifyError({ file }) {
  const f = requireValue(file, "file", "classify-error --file <session>/git-stderr.txt");
  const text = readText(f);
  if (text === null) fail(EXIT.INVALID, "unreadable-file", `Cannot read ${f}.`, "Save git's stderr to a file in the session folder and pass its path.");
  const found = ERROR_KINDS.find(([, needles]) => needles.some((n) => text.includes(n)));
  if (!found) return out({ ok: true, kind: "other", next: "Read git's message above." });
  const [kind, , next] = found;
  const result = { ok: true, kind, next };
  // git lists the files in the way, one per tab-indented line.
  if (kind === "dirty") result.files = text.split(/\r?\n/).filter((l) => l.startsWith("\t")).map((l) => l.trim()).filter(Boolean);
  out(result);
}

async function prUrlCmd({ root, branch, base }) {
  const s = repoState(root);
  const b = (branch || "").trim() || s.branch;
  if (!b) fail(EXIT.REFUSED, "detached", "HEAD is detached, so there is no branch to open a pull request for.", "Switch to a branch, or pass --branch.");
  const row = localBranch(s, b);
  if (!row) fail(EXIT.INVALID, "unknown-branch", `There is no local branch named "${b}".`, "Pick a branch from the list.");
  const into = (base || "").trim() || s.def.name;
  if (!into) fail(EXIT.INVALID, "no-base", "There is no default branch to open the pull request against.", "Pass --base <branch>.");
  // A pull request from a branch into itself is no pull request (a push to main).
  if (into === b) fail(EXIT.INVALID, "is-base", `${b} is the branch pull requests go into, so there is nothing to open.`, "Post no link for this push.");
  const remote = row.upstream && !row.gone ? R.readRemotes(root, await prHosts()).find((r) => r.name === row.upstreamRemote) : null;
  if (!remote) fail(EXIT.INVALID, "not-pushed", `${b} is not on a remote yet.`, "Publish it first (plan publish).");
  out({ ok: true, url: R.prUrl(remote, { base: into, head: b }), host: remote.host, kind: remote.kind, needsKind: !!remote.host && !remote.kind });
}

/* ------------------------------------------------------------------ main */

const COMMANDS = {
  state,
  plan,
  "branch-check": branchCheck,
  "init-check": initCheck,
  "delete-check": deleteCheckCmd,
  "cleanup-list": cleanupListCmd,
  conflicts,
  "pr-url": prUrlCmd,
  "classify-error": classifyError,
};
const NO_REPO = new Set(["init-check", "classify-error"]);

async function main(argv) {
  const args = parseArgs(argv, { values: ["name", "branch", "from", "remote", "base", "file"], lists: ["files", "select"] });
  const [cmd, ...extra] = args._;
  const names = Object.keys(COMMANDS).join(", ");
  if (!cmd) fail(EXIT.USAGE, "missing-command", `A subcommand is required: ${names}.`, "Run with --help for usage.");
  if (!Object.hasOwn(COMMANDS, cmd)) fail(EXIT.USAGE, "unknown-command", `Unknown subcommand "${cmd}".`, `Use one of: ${names}.`);
  if (extra.length > (cmd === "plan" ? 1 : 0)) fail(EXIT.USAGE, "stray-argument", `Unexpected argument(s): ${extra.join(" ")}.`, "Run with --help for usage.");
  R = await gitRepo();
  if (!NO_REPO.has(cmd)) {
    requireGit();
    args.root = requireRepo();
  }
  return COMMANDS[cmd](args, extra);
}

// Run as a script; imported (by the tests, for guard()), do nothing.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) run(USAGE, main);
