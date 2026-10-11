// Tests for plan2code-git's scripts/git.mjs.
//
// See skill-script-helpers.mjs for how these run. Every command a plan prints
// is run here exactly as printed, against a throwaway repo and a bare origin.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT, SKILLS, runScript, scrubbedEnv, tmp, write, gitInit, gitIn, copyFixture, fixtureCleanup } from "./skill-script-helpers.mjs";

// The console home holds pr-hosts.json; keep the real one out of every run.
const HOME = tmp("git-console-home");
const G = (cwd, ...a) => runScript("plan2code-git", "git.mjs", a, { cwd, env: { PLAN2CODE_CONSOLE_HOME: HOME } });

// A repo with one commit on `branch`, and its git runner.
// Built once per branch and copied for each test (fixture-helpers.mjs).
test.after(fixtureCleanup);
function repoWithCommit(name, branch = "main") {
  const repo = copyFixture(name, `commit:${branch}`, (dir) => {
    const g = gitInit(dir, branch);
    write(dir, "a.txt", "a\n");
    g("add", "-A");
    g("commit", "-q", "-m", "init");
  });
  return { repo, g: gitIn(repo) };
}

function bareRemote() {
  return copyFixture("origin", "bare", (dir) => execFileSync("git", ["init", "-q", "--bare", "-b", "main", dir], { stdio: "pipe" }));
}

/** A repo on main pushed to its own bare origin, origin/HEAD set. */
function published(name) {
  const { repo, g } = repoWithCommit(name);
  const origin = bareRemote();
  g("remote", "add", "origin", origin);
  g("push", "-q", "-u", "origin", "main");
  g("remote", "set-head", "origin", "-a");
  return { repo, g, origin };
}

/** Commit `file` = `content` to `branch` on `origin` from a second clone, the way a teammate would. */
function pushFromElsewhere(origin, file, content, branch = "main") {
  const other = tmp("elsewhere");
  execFileSync("git", ["clone", "-q", origin, other], { stdio: "pipe" });
  const o = gitIn(other);
  o("config", "user.email", "o@example.com");
  o("config", "user.name", "Other");
  o("config", "commit.gpgsign", "false");
  if (branch !== "main") o("switch", "-q", "-c", branch);
  write(other, file, content);
  o("add", "--", file);
  o("commit", "-q", "-m", `elsewhere ${file}`);
  o("push", "-q", "origin", branch);
}

/** Run a printed command exactly as the agent would, minus the ambient config. */
function runPrinted(cwd, command, env = {}) {
  return spawnSync(command[0], command.slice(1), { cwd, encoding: "utf8", env: scrubbedEnv({ GIT_TERMINAL_PROMPT: "0", ...env }) });
}

const commit = (g, repo, file, content, message) => {
  write(repo, file, content);
  g("add", "--", file);
  g("commit", "-q", "-m", message);
};

/* ============================================================ the git-state ports */

test("git state: a clean repo with one commit and no remote", () => {
  const { repo } = repoWithCommit("g-clean");
  const r = G(repo, "state");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.branch, "main");
  assert.equal("ticket" in r.json, false, "state reports no ticket");
  assert.equal(r.json.detached, false);
  assert.equal(r.json.hasCommits, true);
  assert.equal(r.json.nothingToCommit, true);
  assert.deepEqual([r.json.staged, r.json.unstaged, r.json.untracked, r.json.conflicted], [[], [], [], []]);
  assert.deepEqual(r.json.remotes, []);
  assert.equal(r.json.upstream, null);
  assert.equal(r.json.push, null, "no remote, nothing to push");
  assert.equal(r.json.inProgress, null);
  assert.equal(r.json.git.head.branch, "main", "the board's snapshot rides along");
  assert.equal(r.json.next, null);
});

test("git state: staged, unstaged, untracked and renamed files land in the right lists", () => {
  const { repo, g } = repoWithCommit("g-files");
  write(repo, "b.txt", "b\n");
  write(repo, "c.txt", "c\n");
  g("add", "-A");
  g("commit", "-q", "-m", "more");
  write(repo, "a.txt", "changed\n"); // unstaged
  write(repo, "b.txt", "changed\n"); // staged...
  g("add", "b.txt");
  write(repo, "b.txt", "changed again\n"); // ...and unstaged too
  g("mv", "c.txt", "d.txt"); // staged rename
  write(repo, "u.txt", "new\n"); // untracked
  const r = G(repo, "state");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.staged, [
    { path: "b.txt", status: "M" },
    { path: "d.txt", status: "R" },
  ]);
  assert.deepEqual(r.json.unstaged, [
    { path: "a.txt", status: "M" },
    { path: "b.txt", status: "M" },
  ]);
  assert.deepEqual(r.json.untracked, [{ path: "u.txt", status: "?" }]);
  assert.ok(![...r.json.staged, ...r.json.unstaged].some((f) => f.path === "c.txt"), "a rename's old path is skipped");
  assert.equal(r.json.nothingToCommit, false);
  assert.equal(r.json.next, "commit");
});

test("git state: the default branch from origin/HEAD, local main, local master, unborn, or none", () => {
  const { repo } = published("g-def-origin");
  const fromOrigin = G(repo, "state").json;
  assert.equal(fromOrigin.defaultFrom, "origin/HEAD");
  assert.equal(fromOrigin.defaultBranch, "main");
  assert.equal(fromOrigin.onDefault, true);

  const main = repoWithCommit("g-def-main");
  assert.equal(G(main.repo, "state").json.defaultFrom, "local-main");
  main.g("checkout", "-q", "-b", "feature/x");
  const off = G(main.repo, "state").json;
  assert.equal(off.defaultBranch, "main");
  assert.equal(off.onDefault, false);

  const master = G(repoWithCommit("g-def-master", "master").repo, "state").json;
  assert.equal(master.defaultFrom, "local-master");
  assert.equal(master.defaultBranch, "master");
  assert.equal(master.onDefault, true);

  const fresh = tmp("g-def-unborn");
  gitInit(fresh, "main");
  const unborn = G(fresh, "state").json;
  assert.equal(unborn.hasCommits, false);
  assert.equal(unborn.branch, "main");
  assert.equal(unborn.defaultFrom, "unborn");
  assert.equal(unborn.defaultBranch, "main");
  assert.equal(unborn.onDefault, true);
  assert.equal(unborn.push, null, "no commits, nothing to push");

  const dev = G(repoWithCommit("g-def-none", "develop").repo, "state").json;
  assert.equal(dev.defaultBranch, null);
  assert.equal(dev.defaultFrom, null);
  assert.equal(dev.onDefault, false);
  const devFresh = tmp("g-def-none2");
  gitInit(devFresh, "develop");
  assert.equal(G(devFresh, "state").json.defaultBranch, null);
});

test("git state: a detached HEAD has no branch and nothing to push", () => {
  const { repo, g } = repoWithCommit("g-detached");
  g("remote", "add", "origin", bareRemote());
  g("checkout", "-q", "--detach");
  const r = G(repo, "state").json;
  assert.equal(r.detached, true);
  assert.equal(r.branch, null);
  assert.equal(r.onDefault, false);
  assert.equal(r.unpublished, false);
  assert.equal(r.push, null);
});

test("git state: the push command for an unpublished branch, one remote or several", () => {
  const { repo, g } = repoWithCommit("g-unpub", "feature/x");
  g("remote", "add", "origin", bareRemote());
  const one = G(repo, "state").json;
  assert.equal(one.unpublished, true);
  assert.equal(one.upstream, null);
  assert.equal(one.ahead, null);
  assert.deepEqual(one.push, { command: "git push -u origin feature/x", setsUpstream: true, remote: "origin", needsRemoteChoice: false });
  assert.equal(one.next, "publish");

  g("remote", "add", "backup", bareRemote());
  const two = G(repo, "state").json;
  assert.equal(two.push.remote, "origin", "origin wins when there are several");
  assert.equal(two.push.needsRemoteChoice, true);
  assert.equal(two.push.command, "git push -u origin feature/x");

  g("remote", "remove", "origin");
  g("remote", "add", "zeta", bareRemote());
  const noOrigin = G(repo, "state").json;
  assert.equal(noOrigin.push.remote, "backup", "no origin: the first remote");
  assert.equal(noOrigin.push.needsRemoteChoice, true);
});

test("git state: ahead of an upstream is a plain git push, pushed is null", () => {
  const { repo, g } = repoWithCommit("g-ahead");
  g("remote", "add", "origin", bareRemote());
  g("push", "-q", "-u", "origin", "main");
  const synced = G(repo, "state").json;
  assert.equal(synced.upstream, "origin/main");
  assert.equal(synced.ahead, 0);
  assert.equal(synced.behind, 0);
  assert.equal(synced.unpublished, false);
  assert.equal(synced.push, null);
  assert.equal(synced.next, null);

  commit(g, repo, "n.txt", "n\n", "next");
  const ahead = G(repo, "state").json;
  assert.equal(ahead.ahead, 1);
  assert.equal(ahead.behind, 0);
  assert.deepEqual(ahead.push, { command: "git push", setsUpstream: false, remote: "origin", needsRemoteChoice: false });
  assert.equal(ahead.next, "push");
});

test("git state: a merge in progress and its conflicted files", () => {
  const repo = tmp("g-merge");
  const g = gitInit(repo, "main");
  write(repo, "f.txt", "a\n");
  g("add", "-A");
  g("commit", "-q", "-m", "base");
  g("checkout", "-q", "-b", "x");
  write(repo, "f.txt", "b\n");
  g("commit", "-q", "-am", "x side");
  g("checkout", "-q", "main");
  write(repo, "f.txt", "c\n");
  g("commit", "-q", "-am", "main side");
  assert.throws(() => g("merge", "x"));
  const r = G(repo, "state").json;
  assert.equal(r.inProgress, "merge");
  assert.deepEqual(r.conflicted, [{ path: "f.txt", status: "UU" }]);
  assert.ok(!r.staged.some((f) => f.path === "f.txt") && !r.unstaged.some((f) => f.path === "f.txt"), "listed only under conflicted");
  assert.equal(r.nothingToCommit, false);
  assert.equal(r.next, "abort", "markers still in the file");
  write(repo, "f.txt", "resolved\n");
  assert.equal(G(repo, "state").json.next, "continue", "markers gone");
});

test("git state: secrets are flagged, examples are not, and large files are listed", () => {
  const { repo } = repoWithCommit("g-risky");
  for (const f of [".env", ".env.local", "id_rsa", "id_ed25519.pub", "server.pem", "secrets.json", "credentials.json", ".npmrc", "config/.env"]) write(repo, f, "x\n");
  for (const f of [".env.example", ".env.sample", "key.txt", "notes.md"]) write(repo, f, "x\n");
  write(repo, "video.bin", Buffer.alloc(6 * 1024 * 1024, 1));
  write(repo, "small.bin", Buffer.alloc(1024 * 1024, 1));
  const r = G(repo, "state").json;
  assert.deepEqual(r.sensitive, [".env", ".env.local", ".npmrc", "config/.env", "credentials.json", "id_ed25519.pub", "id_rsa", "secrets.json", "server.pem"]);
  assert.deepEqual(r.large, [{ path: "video.bin", bytes: 6 * 1024 * 1024 }]);
});

test("git state: reading leaves the index untouched", () => {
  const { repo } = repoWithCommit("g-readonly");
  const index = path.join(repo, ".git", "index");
  // Same content, new mtime: a plain git status would refresh and rewrite the index.
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(repo, "a.txt"), later, later);
  const before = fs.readFileSync(index);
  assert.equal(G(repo, "state").code, 0);
  assert.ok(before.equals(fs.readFileSync(index)), "the index file is byte-for-byte the same");
});

test("git: outside a repository, a bad subcommand, and --help", () => {
  const plain = tmp("g-norepo");
  const r = G(plain, "state");
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "not-a-repo");
  assert.equal(r.json.next, "Run git.mjs init-check to see whether this folder can start one.");
  for (const cmd of ["plan", "branch-check", "delete-check", "cleanup-list", "conflicts", "pr-url"]) assert.equal(G(plain, cmd).code, 3, cmd);
  assert.equal(G(plain).code, 2);
  const unknown = G(plain, "commit");
  assert.equal(unknown.code, 2);
  assert.equal(unknown.json.error, "unknown-command");
  assert.equal(G(plain, "state", "extra").code, 2);
  const { repo } = repoWithCommit("g-badop");
  assert.equal(G(repo, "plan").code, 2);
  assert.equal(G(repo, "plan", "rebase").code, 2, "an unknown op");
  const help = G(plain, "--help");
  assert.equal(help.code, 0);
  for (const word of ["state", "plan <op>", "branch-check", "init-check", "delete-check", "cleanup-list", "conflicts", "pr-url", "classify-error"]) {
    assert.ok(help.stdout.includes(word), word);
  }
  assert.match(help.stdout, /0 ok · 1 crash · 2 bad arguments · 3 not a git repository · 4 invalid\s+input, or nothing to do · 5 refused by a rule/);
});

/* ======================================================================= branch-check */

test("git branch-check: valid, invalid, taken and clashing names", () => {
  const { repo, g } = repoWithCommit("g-branch");
  g("branch", "feat");
  const ok = G(repo, "branch-check", "--name", "feature/export-csv");
  assert.equal(ok.code, 0, ok.stderr);
  assert.deepEqual(ok.json, { ok: true, name: "feature/export-csv", valid: true, exists: false });
  for (const bad of ["bad..name", "has space", "-leading", "@{-1}", "ends/"]) {
    const r = G(repo, "branch-check", "--name", bad);
    assert.equal(r.code, 4, bad);
    assert.equal(r.json.error, "invalid-name", bad);
  }
  const bad = G(repo, "branch-check", "--name", "bad..name").json;
  assert.match(bad.next, /feature\//);
  assert.match(bad.stderr, /not a valid branch name/, "git's own words come along");
  const taken = G(repo, "branch-check", "--name", "main");
  assert.equal(taken.code, 4);
  assert.equal(taken.json.error, "branch-exists");
  assert.match(taken.json.next, /main-2/);
  assert.deepEqual(taken.json.switchTo, { branch: "main" });
  const clash = G(repo, "branch-check", "--name", "feat/x");
  assert.equal(clash.code, 4);
  assert.equal(clash.json.error, "branch-conflict");
  assert.equal(clash.json.branch, "feat");
  assert.equal(G(repo, "branch-check").code, 2);
});

test("git branch-check: a name that only exists on a remote offers to switch to it", () => {
  const { repo, g, origin } = published("g-branch-remote");
  pushFromElsewhere(origin, "s.txt", "s\n", "shared");
  g("fetch", "-q");
  const r = G(repo, "branch-check", "--name", "shared");
  assert.equal(r.code, 4);
  assert.equal(r.json.error, "exists-on-remote");
  assert.equal(r.json.message, '"shared" exists on origin.');
  assert.equal(r.json.remote, "origin");
  assert.deepEqual(r.json.switchTo, { branch: "origin/shared" });
});

/* ========================================================================= init-check */

test("git init-check: a plain folder is safe and suggests what to ignore", () => {
  const dir = tmp("g-init");
  for (const f of ["node_modules/x/index.js", "dist/out.js", ".env", ".env.example", "app.log", "src/a.js"]) write(dir, f, "x\n");
  const r = G(dir, "init-check");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.safe, true);
  assert.equal(r.json.reason, undefined);
  assert.equal(r.json.insideRepo, false);
  assert.equal(r.json.hasGitignore, false);
  assert.deepEqual(r.json.suggestedIgnore, ["node_modules/", "dist/", ".env", ".env.*", "!.env.example", "*.log"]);
  write(dir, ".gitignore", "x\n");
  assert.equal(G(dir, "init-check").json.hasGitignore, true);
  assert.deepEqual(G(tmp("g-init-empty"), "init-check").json.suggestedIgnore, []);
});

test("git init-check: a new repository starts on main, unless init.defaultBranch says otherwise", () => {
  const dir = tmp("g-init-main");
  write(dir, "a.txt", "x\n");
  const r = G(dir, "init-check");
  assert.equal(r.json.branch, "main");
  assert.deepEqual(r.json.commands, [["git", "init"], ["git", "symbolic-ref", "HEAD", "refs/heads/main"]]);
  // Run them for real: the unborn branch is main, never git's legacy master.
  for (const [cmd, ...args] of r.json.commands) assert.equal(spawnSync(cmd, ["-c", "init.defaultBranch=master", ...args], { cwd: dir }).status, 0);
  assert.equal(spawnSync("git", ["symbolic-ref", "--short", "HEAD"], { cwd: dir, encoding: "utf8" }).stdout.trim(), "main");

  // Set the way git reads a config from the environment (git 2.31+), so the
  // test never touches the machine's own ~/.gitconfig.
  const trunk = { PLAN2CODE_CONSOLE_HOME: HOME, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "init.defaultBranch", GIT_CONFIG_VALUE_0: "trunk" };
  const configured = runScript("plan2code-git", "git.mjs", ["init-check"], { cwd: tmp("g-init-trunk"), env: trunk });
  assert.equal(configured.json.branch, "trunk", "the person's own default is kept");
});

test("git init-check: inside a repository, the home folder, and a drive root are not safe", () => {
  const { repo } = repoWithCommit("g-init-repo");
  write(repo, "sub/x.txt", "x\n");
  const inside = G(path.join(repo, "sub"), "init-check").json;
  assert.equal(inside.safe, false);
  assert.equal(inside.reason, "inside-repo");
  assert.equal(inside.insideRepo, true);
  assert.equal(path.resolve(inside.repoRoot).toLowerCase(), repo.toLowerCase());

  const home = tmp("g-init-home");
  const asHome = runScript("plan2code-git", "git.mjs", ["init-check"], { cwd: home, env: { HOME: home, USERPROFILE: home } });
  assert.equal(asHome.json.safe, false);
  assert.equal(asHome.json.reason, "home");

  const root = path.parse(process.cwd()).root;
  const atRoot = G(root, "init-check").json;
  if (!atRoot.insideRepo) {
    assert.equal(atRoot.safe, false);
    assert.equal(atRoot.reason, "root");
  }
});

/* ========================================================================= plan refresh */

test("git plan refresh: fetch --prune, --all with several remotes, and no remote", () => {
  const { repo, g } = repoWithCommit("g-refresh");
  // No remote: a look at the folder again, nothing to run (the reread does it).
  const none = G(repo, "plan", "refresh");
  assert.equal(none.code, 0);
  assert.deepEqual(none.json, { ok: true, op: "refresh", ask: false, commands: [], network: false });
  g("remote", "add", "origin", bareRemote());
  assert.deepEqual(G(repo, "plan", "refresh").json, { ok: true, op: "refresh", ask: false, command: ["git", "fetch", "--prune"], network: true, timeoutMs: 30000 });
  g("remote", "add", "backup", bareRemote());
  assert.deepEqual(G(repo, "plan", "refresh").json.command, ["git", "fetch", "--all", "--prune"]);
});

/* =================================================================== push and publish */

test("git plan push: the exact confirm, and the warning when the remote is ahead", () => {
  const { repo, g, origin } = published("g-push");
  const nothing = G(repo, "plan", "push");
  assert.equal(nothing.code, 4);
  assert.equal(nothing.json.error, "nothing-to-push");
  commit(g, repo, "b.txt", "b\n", "two");
  commit(g, repo, "c.txt", "c\n", "three");
  const lines = g("log", "--oneline", "-n", "20", "@{u}..HEAD").trim().split(/\r?\n/);
  const r = G(repo, "plan", "push");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, {
    ok: true,
    op: "push",
    ask: true,
    confirm: {
      title: "Push 2 commits to origin/main?",
      body: lines.map((l) => `- ${l}`).join("\n"),
      danger: false,
      consequences: "```\ngit push origin main\n```",
    },
    command: ["git", "push", "origin", "main"],
    network: true,
  });
  assert.match(r.json.confirm.body, /three[\s\S]*two/);

  g("switch", "-q", "-c", "renamed", "--track", "origin/main");
  commit(g, repo, "r.txt", "r\n", "renamed work");
  const renamed = G(repo, "plan", "push").json;
  assert.deepEqual(renamed.command, ["git", "push", "origin", "renamed"]);
  assert.ok(renamed.confirm.body.endsWith("\n\nYour upstream is origin/main; this push goes to origin/renamed instead."), renamed.confirm.body);
  g("switch", "-q", "main");

  pushFromElsewhere(origin, "z.txt", "z\n");
  g("fetch", "-q");
  const behind = G(repo, "plan", "push").json;
  assert.ok(
    behind.confirm.body.endsWith("\n\nThe remote has 1 commit you don't have, so this push will likely be rejected: Pull first."),
    behind.confirm.body
  );
});

test("git plan publish: one remote, two remotes, and the rules", () => {
  const { repo, g } = repoWithCommit("g-publish", "feature/x");
  const noRemote = G(repo, "plan", "publish");
  assert.equal(noRemote.code, 5);
  assert.equal(noRemote.json.error, "no-remote");
  g("remote", "add", "origin", bareRemote());
  assert.deepEqual(G(repo, "plan", "publish").json, {
    ok: true,
    op: "publish",
    ask: true,
    confirm: {
      title: "Publish feature/x to origin?",
      body: "Creates feature/x on origin and pushes 1 commit.",
      danger: false,
      consequences: "```\ngit push -u origin feature/x\n```",
    },
    command: ["git", "push", "-u", "origin", "feature/x"],
    network: true,
  });

  g("remote", "add", "backup", bareRemote());
  const two = G(repo, "plan", "publish").json;
  assert.equal(two.ask, true);
  assert.equal(two.command, undefined, "no command until a remote is picked");
  assert.equal(two.confirm, undefined);
  assert.equal(two.card.kind, "remote");
  assert.deepEqual([...two.card.remotes].sort(), ["backup", "origin"]);
  assert.equal(two.card.preset, "origin");
  const picked = G(repo, "plan", "publish", "--remote", "backup").json;
  assert.deepEqual(picked.command, ["git", "push", "-u", "backup", "feature/x"]);
  assert.equal(picked.confirm.title, "Publish feature/x to backup?");
  assert.equal(G(repo, "plan", "publish", "--remote", "nope").json.error, "unknown-remote");

  g("checkout", "-q", "--detach");
  const detached = G(repo, "plan", "publish");
  assert.equal(detached.code, 5);
  assert.equal(detached.json.error, "detached");
});

/* =========================================================== the full round trip */

test("git round trip: create, commit, publish, switch back, delete", () => {
  const { repo } = published("g-trip");
  const st = () => G(repo, "state").json;
  const name = "feature/ABC-1-x";

  const create = G(repo, "plan", "create", "--name", name).json;
  assert.deepEqual(create, { ok: true, op: "create", ask: false, command: ["git", "switch", "--no-track", "-c", name, "origin/main"], network: false });
  assert.equal(runPrinted(repo, create.command).status, 0);
  let s = st();
  assert.equal(s.branch, name);
  assert.equal(s.upstream, null, "a new branch is never published, nor tracks origin/main");
  assert.equal(s.unpublished, true);

  write(repo, "b.txt", "b\n");
  const msg = runScript("plan2code-git", "commit-msg.mjs", ["--subject", "Add b", "--files", "b.txt"], { cwd: repo });
  assert.equal(msg.code, 0, msg.stderr);
  execSync(msg.json.command, { cwd: repo, stdio: "pipe", env: scrubbedEnv({ GIT_TERMINAL_PROMPT: "0" }) });
  s = st();
  assert.equal(s.nothingToCommit, true);
  assert.equal(s.next, "publish");

  const publish = G(repo, "plan", "publish").json;
  assert.equal(publish.confirm.body, `Creates ${name} on origin and pushes 1 commit.`);
  assert.equal(runPrinted(repo, publish.command).status, 0);
  s = st();
  assert.equal(s.upstream, `origin/${name}`);
  assert.equal(s.ahead, 0);
  assert.equal(s.behind, 0);

  const sw = G(repo, "plan", "switch", "--branch", "main").json;
  assert.deepEqual(sw, { ok: true, op: "switch", ask: false, command: ["git", "switch", "main"], network: false });
  assert.equal(runPrinted(repo, sw.command).status, 0);
  s = st();
  assert.equal(s.branch, "main");
  assert.equal(s.upstream, "origin/main");

  const del = G(repo, "plan", "delete", "--branch", name).json;
  assert.deepEqual(del.command, ["git", "branch", "-D", name]);
  assert.equal(del.confirm.danger, true);
  assert.equal(del.confirm.body, `1 commit exists only on ${name}, and origin/${name} still has it.`);
  assert.equal(runPrinted(repo, del.command).status, 0);
  assert.ok(!st().git.branches.some((b) => b.name === name && !b.remote), "the local branch is gone");
});

/* ================================================================ pull and conflicts */

test("git plan pull: a fast-forward lands with --ff-only", () => {
  const { repo, g, origin } = published("g-pull-ff");
  const upToDate = G(repo, "plan", "pull");
  assert.equal(upToDate.code, 4);
  assert.equal(upToDate.json.error, "up-to-date");
  pushFromElsewhere(origin, "z.txt", "z\n");
  g("fetch", "-q");
  assert.equal(G(repo, "state").json.next, "pull");
  const p = G(repo, "plan", "pull").json;
  assert.deepEqual(p, { ok: true, op: "pull", ask: false, command: ["git", "pull", "--ff-only"], network: true });
  assert.equal(runPrinted(repo, p.command).status, 0);
  const s = G(repo, "state").json;
  assert.equal(s.behind, 0);
  assert.ok(fs.existsSync(path.join(repo, "z.txt")));
});

test("git plan pull: no upstream, gone upstream and detached are refused", () => {
  const { repo, g, origin } = published("g-pull-rules");
  g("switch", "-q", "-c", "lonely");
  assert.equal(G(repo, "plan", "pull").json.error, "no-upstream");
  g("push", "-q", "-u", "origin", "lonely");
  execFileSync("git", ["--git-dir", origin, "branch", "-D", "lonely"], { stdio: "pipe" });
  g("fetch", "-q", "--prune");
  assert.equal(G(repo, "plan", "pull").json.error, "upstream-gone");
  g("checkout", "-q", "--detach");
  const detached = G(repo, "plan", "pull");
  assert.equal(detached.code, 5);
  assert.equal(detached.json.error, "detached");
});

/** A repo whose main and origin/main both changed a.txt: a split that conflicts. */
function splitConflict(name) {
  const { repo, g, origin } = published(name);
  commit(g, repo, "a.txt", "local\n", "local");
  pushFromElsewhere(origin, "a.txt", "remote\n");
  g("fetch", "-q");
  return { repo, g, origin };
}

test("git plan pull: a conflicted rebase pull is aborted back to the exact original HEAD", () => {
  const { repo, g } = splitConflict("g-pull-abort");
  const s = G(repo, "state").json;
  assert.equal([s.ahead, s.behind].join(), "1,1");
  const p = G(repo, "plan", "pull").json;
  assert.deepEqual(p, { ok: true, op: "pull", ask: false, command: ["git", "pull", "--rebase"], network: true, env: { GIT_EDITOR: "true" } });
  const before = g("rev-parse", "HEAD").trim();
  assert.notEqual(runPrinted(repo, p.command, p.env).status, 0, "the rebase stops on the conflict");

  const c = G(repo, "conflicts").json;
  assert.equal(c.op, "rebase");
  assert.equal(c.step, 1);
  assert.equal(c.total, 1);
  assert.equal(c.commit.subject, "local");
  assert.deepEqual(c.files, [{ path: "a.txt", status: "UU", markers: true }]);
  assert.equal(c.ready, false);
  const still = G(repo, "plan", "continue");
  assert.equal(still.code, 5);
  assert.equal(still.json.error, "still-conflicted");
  assert.deepEqual(still.json.files, ["a.txt"]);

  const abort = G(repo, "plan", "abort").json;
  assert.deepEqual(abort.command, ["git", "rebase", "--abort"]);
  assert.equal(abort.ask, false);
  assert.equal(runPrinted(repo, abort.command).status, 0);
  assert.equal(g("rev-parse", "HEAD").trim(), before);
  assert.equal(G(repo, "state").json.inProgress, null);
  assert.equal(G(repo, "conflicts").json.error, "nothing-in-progress");
  assert.equal(G(repo, "plan", "abort").code, 4);
});

test("git plan continue: stages only the resolved files, then finishes the rebase", () => {
  const { repo } = splitConflict("g-pull-continue");
  const p = G(repo, "plan", "pull").json;
  runPrinted(repo, p.command, p.env);
  write(repo, "a.txt", "both\n");
  assert.equal(G(repo, "conflicts").json.ready, true);
  const cont = G(repo, "plan", "continue").json;
  assert.deepEqual(cont.commands, [
    ["git", "add", "--", "a.txt"],
    ["git", "-c", "core.editor=true", "rebase", "--continue"],
  ]);
  for (const cmd of cont.commands) assert.equal(runPrinted(repo, cmd).status, 0, cmd.join(" "));
  const s = G(repo, "state").json;
  assert.equal(s.inProgress, null);
  assert.equal([s.ahead, s.behind].join(), "1,0");
});

test("git conflicts: a merge in progress reports op merge with its MERGE_HEAD, and abort undoes it", () => {
  const { repo, g } = repoWithCommit("g-merge-conflict", "main");
  g("checkout", "-q", "-b", "side");
  commit(g, repo, "a.txt", "side\n", "side change");
  g("checkout", "-q", "main");
  commit(g, repo, "a.txt", "main\n", "main change");
  const before = g("rev-parse", "HEAD").trim();
  const res = spawnSync("git", ["merge", "side"], { cwd: repo, encoding: "utf8" });
  assert.notEqual(res.status, 0, "the merge stops on the conflict");

  const c = G(repo, "conflicts").json;
  assert.equal(c.op, "merge");
  assert.equal(c.step, null, "a merge has no todo progress");
  assert.equal(c.total, null);
  assert.equal(c.commit.subject, "side change", "MERGE_HEAD is the incoming side's tip");
  assert.deepEqual(c.files, [{ path: "a.txt", status: "UU", markers: true }]);
  const abort = G(repo, "plan", "abort").json;
  assert.deepEqual(abort.command, ["git", "merge", "--abort"]);
  assert.equal(runPrinted(repo, abort.command).status, 0);
  assert.equal(g("rev-parse", "HEAD").trim(), before);
  assert.equal(G(repo, "state").json.inProgress, null);
});

test("git conflicts: a rebase-merge merge step still reports the rebase", () => {
  const { repo, g } = repoWithCommit("g-rebase-merge-op", "main");
  // A `merge` todo in an interactive rebase leaves rebase-merge/ beside
  // MERGE_HEAD when it conflicts: the outer operation is still the rebase.
  fs.mkdirSync(path.join(repo, ".git", "rebase-merge"));
  fs.writeFileSync(path.join(repo, ".git", "MERGE_HEAD"), `${g("rev-parse", "HEAD").trim()}\n`);
  fs.writeFileSync(path.join(repo, ".git", "rebase-merge", "head-name"), "refs/heads/main\n");
  fs.writeFileSync(path.join(repo, ".git", "rebase-merge", "onto"), `${g("rev-parse", "HEAD").trim()}\n`);
  fs.writeFileSync(path.join(repo, ".git", "rebase-merge", "msgnum"), "3");
  fs.writeFileSync(path.join(repo, ".git", "rebase-merge", "end"), "5");
  const c = G(repo, "conflicts").json;
  assert.equal(c.op, "rebase", "rebase-merge wins over MERGE_HEAD");
  assert.equal(c.step, 3);
  assert.equal(c.total, 5);
  const abort = G(repo, "plan", "abort").json;
  assert.deepEqual(abort.command, ["git", "rebase", "--abort"]);
});

test("git conflicts: a git am in progress reports op am", () => {
  const { repo, g } = repoWithCommit("g-am-op", "main");
  fs.mkdirSync(path.join(repo, ".git", "rebase-apply"));
  fs.writeFileSync(path.join(repo, ".git", "rebase-apply", "applying"), "");
  const c = G(repo, "conflicts").json;
  assert.equal(c.op, "am", "rebase-apply/applying is git's own am marker");
  assert.equal(c.step, null);
  const abort = G(repo, "plan", "abort").json;
  assert.deepEqual(abort.command, ["git", "am", "--abort"]);
  fs.rmSync(path.join(repo, ".git", "rebase-apply"), { recursive: true, force: true });
});

test("git plan pull: a split with tracked changes asks first, and never stashes", () => {
  const { repo, g, origin } = published("g-pull-dirty");
  commit(g, repo, "b.txt", "b\n", "local");
  pushFromElsewhere(origin, "z.txt", "z\n");
  g("fetch", "-q");
  write(repo, "a.txt", "edited\n");
  write(repo, "u.txt", "untracked\n");
  const p = G(repo, "plan", "pull").json;
  assert.equal(p.ask, true);
  assert.deepEqual(p.card, {
    kind: "dirty",
    files: ["a.txt"],
    reason: "git pull --rebase needs a clean tree: these files have changes.",
    options: ["commit-first", "cancel"],
  });
  assert.ok(!p.command.some((a) => a.includes("stash")));
});

/* ================================================================ delete and cleanup */

test("git delete-check: commits only on the branch, and the remote copy before and after publishing", () => {
  const { repo, g } = published("g-delcheck");
  g("switch", "-q", "-c", "wip");
  commit(g, repo, "w1.txt", "1\n", "w1");
  commit(g, repo, "w2.txt", "2\n", "w2");
  g("switch", "-q", "main");
  const before = G(repo, "delete-check", "--branch", "wip").json;
  assert.equal(before.merged, false);
  assert.equal(before.gone, false);
  assert.equal(before.onlyHere.count, 2);
  assert.deepEqual(before.onlyHere.commits.map((c) => c.subject), ["w2", "w1"]);
  assert.match(before.onlyHere.commits[0].sha, /^[0-9a-f]{7,}$/);
  assert.equal(before.remoteCopy, null);
  assert.equal(before.flag, "-D");
  assert.equal(before.sentence, "2 commits exist only on wip, and no remote copy has them.");

  g("push", "-q", "-u", "origin", "wip");
  const after = G(repo, "delete-check", "--branch", "wip").json;
  assert.deepEqual(after.remoteCopy, { ref: "origin/wip", hasAll: true });
  assert.equal(after.sentence, "2 commits exist only on wip, and origin/wip still has them.");

  g("switch", "-q", "wip");
  commit(g, repo, "w3.txt", "3\n", "w3");
  g("switch", "-q", "main");
  const ahead = G(repo, "delete-check", "--branch", "wip").json;
  assert.deepEqual(ahead.remoteCopy, { ref: "origin/wip", hasAll: false });
  assert.equal(ahead.sentence, "3 commits exist only on wip, and no remote copy has them.");
  assert.equal(G(repo, "delete-check", "--branch", "nope").json.error, "unknown-branch");
});

/** main on origin; done (merged), wip (2 unmerged commits), old (1 commit, remote copy deleted), both (merged, remote copy deleted). */
function branchZoo(name) {
  const { repo, g, origin } = published(name);
  g("branch", "done");
  g("switch", "-q", "-c", "wip");
  commit(g, repo, "w1.txt", "1\n", "w1");
  commit(g, repo, "w2.txt", "2\n", "w2");
  g("switch", "-q", "-c", "old", "main");
  commit(g, repo, "o.txt", "o\n", "o1");
  g("push", "-q", "-u", "origin", "old");
  g("switch", "-q", "-c", "both", "main");
  g("push", "-q", "-u", "origin", "both");
  g("switch", "-q", "main");
  for (const b of ["old", "both"]) execFileSync("git", ["--git-dir", origin, "branch", "-D", b], { stdio: "pipe" });
  g("fetch", "-q", "--prune");
  return { repo, g };
}

test("git plan delete: merged, unmerged and gone branches, and the ones never deleted", () => {
  const { repo, g } = branchZoo("g-delete");
  assert.deepEqual(G(repo, "plan", "delete", "--branch", "done").json, {
    ok: true,
    op: "delete",
    ask: true,
    confirm: { title: "Delete done?", body: "It is merged into main.", danger: false, consequences: "```\ngit branch -d done\n```" },
    command: ["git", "branch", "-d", "done"],
    network: false,
  });
  assert.deepEqual(G(repo, "plan", "delete", "--branch", "wip").json.confirm, {
    title: "Delete wip?",
    body: "2 commits exist only on wip, and no remote copy has them.",
    danger: true,
    consequences: "```\ngit branch -D wip\n```",
  });
  const gone = G(repo, "plan", "delete", "--branch", "old").json;
  assert.deepEqual(gone.command, ["git", "branch", "-D", "old"]);
  assert.equal(gone.confirm.body, "1 commit exists only on old, and no remote copy has it.");
  assert.equal(gone.confirm.danger, true);

  const current = G(repo, "plan", "delete", "--branch", "main");
  assert.equal(current.code, 5);
  assert.equal(current.json.error, "refused");
  g("switch", "-q", "done");
  const def = G(repo, "plan", "delete", "--branch", "main");
  assert.equal(def.code, 5);
  assert.match(def.json.message, /default branch/);
  assert.equal(G(repo, "plan", "delete", "--branch", "done").json.error, "refused", "the current branch");
});

test("git plan delete and cleanup: a merged branch HEAD does not contain gets -D, and it really deletes", () => {
  const { repo, g } = published("g-delete-elsewhere");
  g("switch", "-q", "-c", "older");
  g("switch", "-q", "main");
  commit(g, repo, "m2.txt", "m2\n", "m2");
  g("push", "-q", "origin", "main");
  g("branch", "fresh");
  g("branch", "fresh2");
  g("switch", "-q", "older");
  const del = G(repo, "plan", "delete", "--branch", "fresh").json;
  assert.deepEqual(del.command, ["git", "branch", "-D", "fresh"]);
  assert.deepEqual(del.confirm, { title: "Delete fresh?", body: "It is merged into main.", danger: false, consequences: "```\ngit branch -D fresh\n```" });
  assert.equal(G(repo, "delete-check", "--branch", "fresh").json.flag, "-D");
  assert.equal(runPrinted(repo, del.command).status, 0);
  const clean = G(repo, "plan", "cleanup", "--select", "fresh2").json;
  assert.deepEqual(clean.commands, [["git", "branch", "-D", "fresh2"]]);
  assert.equal(clean.confirm.danger, false);
  assert.equal(runPrinted(repo, clean.commands[0]).status, 0);
});

test("git cleanup-list and plan cleanup: merged and gone, gone wins, never current or default", () => {
  const { repo } = branchZoo("g-cleanup");
  assert.deepEqual(G(repo, "cleanup-list").json, { ok: true, merged: ["done"], gone: ["both", "old"] });
  const r = G(repo, "plan", "cleanup", "--select", "done", "--select", "old");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, {
    ok: true,
    op: "cleanup",
    ask: true,
    confirm: {
      title: "Delete 2 branches?",
      body: "Merged into main: done.\n\nTheir remote copy was deleted: old.",
      danger: true,
      consequences: "```\ngit branch -d done\ngit branch -D old\n```",
    },
    commands: [
      ["git", "branch", "-d", "done"],
      ["git", "branch", "-D", "old"],
    ],
    network: false,
  });
  const one = G(repo, "plan", "cleanup", "--select", "done").json.confirm;
  assert.equal(one.title, "Delete 1 branch?");
  assert.equal(one.danger, false);
  const bad = G(repo, "plan", "cleanup", "--select", "wip");
  assert.equal(bad.code, 4);
  assert.equal(bad.json.error, "not-cleanable");
  assert.equal(G(repo, "plan", "cleanup").code, 2);
  for (const cmd of r.json.commands) assert.equal(runPrinted(repo, cmd).status, 0, cmd.join(" "));
  assert.deepEqual(G(repo, "cleanup-list").json, { ok: true, merged: [], gone: ["both"] });
});

/* ========================================================================= switching */

test("git plan switch: changes that carry over offer bring; a conflicting change does not", () => {
  const { repo, g } = repoWithCommit("g-switch");
  commit(g, repo, "b.txt", "b\n", "b");
  g("switch", "-q", "-c", "other");
  commit(g, repo, "a.txt", "other\n", "other a");
  commit(g, repo, "c.txt", "c\n", "add c");
  g("switch", "-q", "main");

  assert.deepEqual(G(repo, "plan", "switch", "--branch", "other").json, { ok: true, op: "switch", ask: false, command: ["git", "switch", "other"], network: false });
  write(repo, "note.txt", "untracked\n");
  assert.equal(G(repo, "plan", "switch", "--branch", "other").json.ask, false, "an untracked file the target lacks is ignored");

  write(repo, "b.txt", "edited\n");
  const carry = G(repo, "plan", "switch", "--branch", "other").json;
  assert.equal(carry.ask, true);
  assert.deepEqual(carry.card, { kind: "switch", files: ["b.txt"], options: ["bring", "commit-first", "cancel"] });

  write(repo, "a.txt", "mine\n");
  const refused = G(repo, "plan", "switch", "--branch", "other").json;
  assert.deepEqual(refused.card.options, ["commit-first", "cancel"]);
  assert.deepEqual(refused.card.files, ["a.txt", "b.txt"]);
  assert.match(refused.card.reason, /a\.txt/);
  assert.doesNotMatch(refused.card.reason, /b\.txt/);

  g("checkout", "--", "a.txt", "b.txt");
  write(repo, "c.txt", "untracked here\n");
  const untracked = G(repo, "plan", "switch", "--branch", "other").json;
  assert.deepEqual(untracked.card.options, ["commit-first", "cancel"]);
  assert.match(untracked.card.reason, /c\.txt/);

  const same = G(repo, "plan", "switch", "--branch", "main");
  assert.equal(same.code, 4);
  assert.equal(same.json.error, "already-on");
  assert.equal(G(repo, "plan", "switch", "--branch", "nope").json.error, "unknown-branch");
});

test("git plan switch: a remote-only branch is tracked", () => {
  const { repo, g, origin } = published("g-switch-remote");
  pushFromElsewhere(origin, "s.txt", "s\n", "shared");
  g("fetch", "-q");
  const r = G(repo, "plan", "switch", "--branch", "origin/shared").json;
  assert.deepEqual(r.command, ["git", "switch", "--track", "origin/shared"]);
  assert.equal(runPrinted(repo, r.command).status, 0);
  const s = G(repo, "state").json;
  assert.equal(s.branch, "shared");
  assert.equal(s.upstream, "origin/shared");
});

test("git plan create: where it starts, a bad --from, a taken name, and changes git would refuse", () => {
  const local = repoWithCommit("g-create-local");
  assert.deepEqual(G(local.repo, "plan", "create", "--name", "feature/y").json.command, ["git", "switch", "--no-track", "-c", "feature/y", "main"]);
  const bad = G(local.repo, "plan", "create", "--name", "feature/y", "--from", "nope");
  assert.equal(bad.code, 4);
  assert.equal(bad.json.error, "bad-from");
  const taken = G(local.repo, "plan", "create", "--name", "main");
  assert.equal(taken.code, 4);
  assert.equal(taken.json.error, "branch-exists");
  assert.deepEqual(taken.json.switchTo, { branch: "main" });

  const { repo, g } = repoWithCommit("g-create-refuse");
  g("switch", "-q", "-c", "other");
  commit(g, repo, "a.txt", "other\n", "other a");
  write(repo, "x.txt", "x\n");
  g("add", "x.txt");
  g("commit", "-q", "-m", "x");
  write(repo, "x.txt", "changed\n");
  const carries = G(repo, "plan", "create", "--name", "feature/z", "--from", "other").json;
  assert.equal(carries.ask, false, "a change git carries over needs no question");
  write(repo, "a.txt", "mine\n");
  const refuse = G(repo, "plan", "create", "--name", "feature/z", "--from", "main").json;
  assert.equal(refuse.ask, true);
  assert.deepEqual(refuse.card.options, ["commit-first", "cancel"]);
  assert.match(refuse.card.reason, /a\.txt/);

  g("checkout", "--", "a.txt", "x.txt");
  g("checkout", "-q", "--detach");
  g("branch", "-D", "main");
  const sha = g("rev-parse", "--short=7", "HEAD").trim();
  const detached = G(repo, "plan", "create", "--name", "feature/d").json;
  assert.deepEqual(detached.command, ["git", "switch", "--no-track", "-c", "feature/d", sha], "detached: from HEAD");
});

/* ================================================================== errors and links */

test("git classify-error: every kind, from stored stderr", () => {
  const dir = tmp("g-classify");
  const fixtures = {
    rejected: " ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs to 'origin'\n",
    auth: "fatal: could not read Username for 'https://github.com': terminal prompts disabled\n",
    dirty:
      "error: Your local changes to the following files would be overwritten by checkout:\n\ta.txt\n\tsrc/b.js\nPlease commit your changes or stash them before you switch branches.\nAborting\n",
    conflict: "CONFLICT (content): Merge conflict in a.txt\nerror: could not apply 1a2b3c4... local\n",
    network: "fatal: unable to access 'https://git.example.com/x/': Could not resolve host: git.example.com\n",
    other: "fatal: something nobody expected\n",
  };
  const next = {
    rejected: "Pull first, then push again.",
    auth: "This tool never handles logins. Sign in from your terminal (ssh-add, or your git credential helper), then try again.",
    dirty: "Commit first, or cancel.",
    conflict: "Resolve the conflicts, or abort.",
    network: "Check your network or VPN, and the remote's address, then Refresh.",
    other: "Read git's message above.",
  };
  for (const [kind, text] of Object.entries(fixtures)) {
    const file = write(dir, `${kind}.txt`, text);
    const r = G(dir, "classify-error", "--file", file);
    assert.equal(r.code, 0, `${kind}: ${r.stderr}`);
    assert.equal(r.json.kind, kind);
    assert.equal(r.json.next, next[kind]);
    if (kind === "dirty") assert.deepEqual(r.json.files, ["a.txt", "src/b.js"]);
    else assert.equal(r.json.files, undefined);
  }
  assert.equal(G(dir, "classify-error").code, 2);
  assert.equal(G(dir, "classify-error", "--file", path.join(dir, "missing.txt")).code, 4);
});

test("git pr-url: a GitHub remote, an unknown host, a saved host kind, and not pushed yet", () => {
  const { repo, g } = repoWithCommit("g-pr");
  const branch = "feature/ABC-1-x";
  g("remote", "add", "origin", "git@github.com:jparkerweb/plan2code.git");
  g("switch", "-q", "-c", branch);
  const notPushed = G(repo, "pr-url");
  assert.equal(notPushed.code, 4);
  assert.equal(notPushed.json.error, "not-pushed");
  g("update-ref", `refs/remotes/origin/${branch}`, "HEAD");
  g("config", `branch.${branch}.remote`, "origin");
  g("config", `branch.${branch}.merge`, `refs/heads/${branch}`);
  assert.deepEqual(G(repo, "pr-url").json, {
    ok: true,
    url: "https://github.com/jparkerweb/plan2code/compare/main...feature/ABC-1-x?quick_pull=1",
    host: "github.com",
    kind: "github",
    needsKind: false,
  });
  assert.equal(G(repo, "pr-url", "--base", "release/1").json.url, "https://github.com/jparkerweb/plan2code/compare/release/1...feature/ABC-1-x?quick_pull=1");

  g("remote", "set-url", "origin", "https://git.example.com/team/repo.git");
  assert.deepEqual(G(repo, "pr-url").json, { ok: true, url: null, host: "git.example.com", kind: null, needsKind: true });

  const home = tmp("g-pr-home");
  fs.writeFileSync(path.join(home, "pr-hosts.json"), JSON.stringify({ "git.example.com": "gitlab" }));
  const saved = runScript("plan2code-git", "git.mjs", ["pr-url"], { cwd: repo, env: { PLAN2CODE_CONSOLE_HOME: home } }).json;
  assert.equal(saved.kind, "gitlab");
  assert.equal(saved.needsKind, false);
  assert.match(saved.url, /^https:\/\/git\.example\.com\/team\/repo\/-\/merge_requests\/new\?/);
});

/* ============================================================================ guard */

test("git guard: every forbidden form is refused, and the source builds none of them", async () => {
  const { guard, display } = await import(pathToFileURL(path.join(SKILLS, "plan2code-git", "scripts", "git.mjs")).href);
  const forbidden = [
    ["git", "push", "--force"],
    ["git", "push", "--force-with-lease"],
    ["git", "push", "--force-with-lease=main"],
    ["git", "push", "-f", "origin", "main"],
    ["git", "push", "-uf", "origin", "main"],
    ["git", "push", "--delete", "origin", "x"],
    ["git", "push", "origin", ":x"],
    ["git", "push", "origin", "+main"],
    ["git", "push", "--prune", "origin"],
    ["git", "push", "--mirror", "origin"],
    ["git", "commit", "--no-verify", "-m", "x"],
    ["git", "commit", "-n", "-m", "x"],
    ["git", "commit", "--amend"],
    ["git", "add", "-A"],
    ["git", "add", "--all"],
    ["git", "add", "."],
    ["git", "-c", "x=y", "add", "."],
    ["git", "add", "--", "."],
    "git push",
    ["push", "origin"],
  ];
  for (const cmd of forbidden) {
    assert.throws(() => guard(cmd), (e) => e.exit === 1 && e.error === "forbidden-command", JSON.stringify(cmd));
  }
  for (const cmd of [
    ["git", "push", "-u", "origin", "feature/x"],
    ["git", "add", "--", "a.txt"],
    ["git", "-c", "core.editor=true", "rebase", "--continue"],
    ["git", "commit", "-m", "-n is fine in a message"],
    ["git", "add", "--", "-A", "--all"],
    ["git", "commit", "-m", "x", "--", "-n"],
    ["git", "branch", "-D", "old"],
  ]) {
    assert.deepEqual(guard(cmd), cmd);
  }
  assert.equal(display(["git", "commit", "-m", 'say "hi" now']), 'git commit -m "say \\"hi\\" now"');

  const source = fs.readFileSync(path.join(ROOT, "src", "plan2code-git-scripts", "git.mjs"), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("export function guard(");
  const end = source.indexOf("\n}\n", start);
  assert.ok(start > 0 && end > start, "guard() is defined");
  const rest = source.slice(0, start) + source.slice(end);
  for (const banned of [/"--force"/, /"--force-with-lease"/, /"--no-verify"/, /"--amend"/, /"push",\s*"--delete"/, /"add",\s*"(-A|--all|\.)"/]) {
    assert.doesNotMatch(rest, banned);
  }
});

/* ===================================================================== migration */

// Words, not substrings: git-commits is Git's own meter event and stays.
const OLD_SKILL = /\bgit-commit(?!s)|git-state\.mjs/;
const SELF = path.join(ROOT, "scripts", "test-script-git.mjs");

function textFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : textFiles(full);
    return /\.(m?js|cjs|json|md|html|css|txt)$/.test(entry.name) ? [full] : [];
  });
}

// CHANGELOG.md is history and specs/ / specs--completed/ are working notes, so neither is checked.
test("no git-commit left: src/, scripts/, the docs, install.js and package.json never name the old skill", () => {
  const dirs = ["src", "scripts", ".agents-docs", ".readme", "docs"].map((d) => path.join(ROOT, d)).filter((d) => fs.existsSync(d));
  const tops = ["install.js", "package.json", "README.md", "QUICK-REFERENCE.md", "AGENTS.md"].map((f) => path.join(ROOT, f));
  const files = [...dirs.flatMap((d) => textFiles(d)), ...tops];
  const found = files.filter((f) => f !== SELF && OLD_SKILL.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f));
  assert.deepEqual(found, [], `still naming git-commit or git-state.mjs: ${found.join(", ")}`);
  assert.ok(!fs.existsSync(path.join(SKILLS, "plan2code-git-commit")), "skills/ holds no plan2code-git-commit");
});

test("the git prompt never instructs a forbidden command, stays under 20,000 characters and names its tools", () => {
  const prompt = fs.readFileSync(path.join(ROOT, "src", "plan2code-git.md"), "utf8");
  const forbidden = ["--force", "--force-with-lease", "--no-verify", "--amend", "git add -A", "git add ."];
  const bad = prompt.split(/\r?\n/).filter((line) => forbidden.some((f) => line.includes(f)) && !/never/i.test(line));
  assert.deepEqual(bad, [], "every line naming a forbidden form is a never-rule");
  assert.ok(prompt.length < 20000, `src/plan2code-git.md is ${prompt.length} characters`);
  for (const name of ["__git", "reread", "plan", "conflicts", "classify-error", "commit-msg.mjs"]) {
    assert.ok(prompt.includes(name), `the prompt names ${name}`);
  }
});
