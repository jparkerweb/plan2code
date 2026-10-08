// Tests for plan2code-git-commit's scripts/git-state.mjs.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runScript, tmp, write, gitInit } from "./skill-script-helpers.mjs";

const S = (cwd, ...a) => runScript("plan2code-git-commit", "git-state.mjs", a, { cwd });

// A repo with one commit on `branch`, and its git runner.
function repoWithCommit(name, branch = "main") {
  const repo = tmp(name);
  const g = gitInit(repo, branch);
  write(repo, "a.txt", "a\n");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  return { repo, g };
}

function bareRemote() {
  const bare = tmp("origin");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", bare], { stdio: "pipe" });
  return bare;
}

/* ============================================================ git-state.mjs state */

test("git-state state: a clean repo with one commit and no remote", () => {
  const { repo } = repoWithCommit("gs-clean");
  const r = S(repo, "state");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.branch, "main");
  assert.equal(r.json.detached, false);
  assert.equal(r.json.hasCommits, true);
  assert.equal(r.json.nothingToCommit, true);
  assert.deepEqual([r.json.staged, r.json.unstaged, r.json.untracked, r.json.conflicted], [[], [], [], []]);
  assert.deepEqual(r.json.remotes, []);
  assert.equal(r.json.upstream, null);
  assert.equal(r.json.push, null, "no remote, nothing to push");
  assert.equal(r.json.inProgress, null);
});

test("git-state state: staged, unstaged, untracked and renamed files land in the right lists", () => {
  const { repo, g } = repoWithCommit("gs-files");
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
  const r = S(repo, "state");
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
});

test("git-state state: the default branch from origin/HEAD, local main, local master, unborn, or none", () => {
  // origin/HEAD
  const bare = bareRemote();
  const { repo, g } = repoWithCommit("gs-def-origin");
  g("remote", "add", "origin", bare);
  g("push", "-q", "-u", "origin", "main");
  g("remote", "set-head", "origin", "-a");
  const fromOrigin = S(repo, "state").json;
  assert.equal(fromOrigin.defaultFrom, "origin/HEAD");
  assert.equal(fromOrigin.defaultBranch, "main");
  assert.equal(fromOrigin.onDefault, true);

  // local main, and off the default
  const main = repoWithCommit("gs-def-main");
  assert.equal(S(main.repo, "state").json.defaultFrom, "local-main");
  main.g("checkout", "-q", "-b", "feature/x");
  const off = S(main.repo, "state").json;
  assert.equal(off.defaultBranch, "main");
  assert.equal(off.onDefault, false);

  // local master
  const master = S(repoWithCommit("gs-def-master", "master").repo, "state").json;
  assert.equal(master.defaultFrom, "local-master");
  assert.equal(master.defaultBranch, "master");
  assert.equal(master.onDefault, true);

  // no commits yet, on main
  const fresh = tmp("gs-def-unborn");
  gitInit(fresh, "main");
  const unborn = S(fresh, "state").json;
  assert.equal(unborn.hasCommits, false);
  assert.equal(unborn.branch, "main");
  assert.equal(unborn.defaultFrom, "unborn");
  assert.equal(unborn.defaultBranch, "main");
  assert.equal(unborn.onDefault, true);
  assert.equal(unborn.push, null, "no commits, nothing to push");

  // neither main nor master: no default, so no branch offer
  const dev = S(repoWithCommit("gs-def-none", "develop").repo, "state").json;
  assert.equal(dev.defaultBranch, null);
  assert.equal(dev.defaultFrom, null);
  assert.equal(dev.onDefault, false);
  const devFresh = tmp("gs-def-none2");
  gitInit(devFresh, "develop");
  assert.equal(S(devFresh, "state").json.defaultBranch, null);
});

test("git-state state: a detached HEAD has no branch and nothing to push", () => {
  const { repo, g } = repoWithCommit("gs-detached");
  g("remote", "add", "origin", bareRemote());
  g("checkout", "-q", "--detach");
  const r = S(repo, "state").json;
  assert.equal(r.detached, true);
  assert.equal(r.branch, null);
  assert.equal(r.onDefault, false);
  assert.equal(r.unpublished, false);
  assert.equal(r.push, null);
});

test("git-state state: the push command for an unpublished branch, one remote or several", () => {
  const { repo, g } = repoWithCommit("gs-unpub", "feature/x");
  g("remote", "add", "origin", bareRemote());
  const one = S(repo, "state").json;
  assert.equal(one.unpublished, true);
  assert.equal(one.upstream, null);
  assert.equal(one.ahead, null);
  assert.deepEqual(one.push, { command: "git push -u origin feature/x", setsUpstream: true, remote: "origin", needsRemoteChoice: false });

  g("remote", "add", "backup", bareRemote());
  const two = S(repo, "state").json;
  assert.equal(two.push.remote, "origin", "origin wins when there are several");
  assert.equal(two.push.needsRemoteChoice, true);
  assert.equal(two.push.command, "git push -u origin feature/x");

  g("remote", "remove", "origin");
  g("remote", "add", "zeta", bareRemote());
  const noOrigin = S(repo, "state").json;
  assert.equal(noOrigin.push.remote, "backup", "no origin: the first remote");
  assert.equal(noOrigin.push.needsRemoteChoice, true);
});

test("git-state state: ahead of an upstream is a plain git push, pushed is null", () => {
  const { repo, g } = repoWithCommit("gs-ahead");
  g("remote", "add", "origin", bareRemote());
  g("push", "-q", "-u", "origin", "main");
  const synced = S(repo, "state").json;
  assert.equal(synced.upstream, "origin/main");
  assert.equal(synced.ahead, 0);
  assert.equal(synced.behind, 0);
  assert.equal(synced.unpublished, false);
  assert.equal(synced.push, null);

  write(repo, "n.txt", "n\n");
  g("add", "-A");
  g("commit", "-q", "-m", "next");
  const ahead = S(repo, "state").json;
  assert.equal(ahead.ahead, 1);
  assert.equal(ahead.behind, 0);
  assert.deepEqual(ahead.push, { command: "git push", setsUpstream: false, remote: "origin", needsRemoteChoice: false });
});

test("git-state state: a merge in progress and its conflicted files", () => {
  const repo = tmp("gs-merge");
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
  const r = S(repo, "state").json;
  assert.equal(r.inProgress, "merge");
  assert.deepEqual(r.conflicted, [{ path: "f.txt", status: "UU" }]);
  assert.ok(!r.staged.some((f) => f.path === "f.txt") && !r.unstaged.some((f) => f.path === "f.txt"), "listed only under conflicted");
  assert.equal(r.nothingToCommit, false);
});

test("git-state state: secrets are flagged, examples are not, and large files are listed", () => {
  const { repo } = repoWithCommit("gs-risky");
  for (const f of [".env", ".env.local", "id_rsa", "id_ed25519.pub", "server.pem", "secrets.json", "credentials.json", ".npmrc", "config/.env"]) write(repo, f, "x\n");
  for (const f of [".env.example", ".env.sample", "key.txt", "notes.md"]) write(repo, f, "x\n");
  write(repo, "video.bin", Buffer.alloc(6 * 1024 * 1024, 1));
  write(repo, "small.bin", Buffer.alloc(1024 * 1024, 1));
  const r = S(repo, "state").json;
  assert.deepEqual(r.sensitive, [".env", ".env.local", ".npmrc", "config/.env", "credentials.json", "id_ed25519.pub", "id_rsa", "secrets.json", "server.pem"]);
  assert.deepEqual(r.large, [{ path: "video.bin", bytes: 6 * 1024 * 1024 }]);
});

test("git-state state: reading leaves the index untouched", () => {
  const { repo } = repoWithCommit("gs-readonly");
  const index = path.join(repo, ".git", "index");
  // Same content, new mtime: a plain git status would refresh and rewrite the index.
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(repo, "a.txt"), later, later);
  const before = fs.readFileSync(index);
  assert.equal(S(repo, "state").code, 0);
  assert.ok(before.equals(fs.readFileSync(index)), "the index file is byte-for-byte the same");
});

test("git-state: outside a repository, and a bad subcommand", () => {
  const plain = tmp("gs-norepo");
  const r = S(plain, "state");
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "not-a-repo");
  assert.match(r.json.next, /init-check/);
  assert.equal(S(plain, "branch-check", "--name", "x").code, 3);
  assert.equal(S(plain).code, 2);
  assert.equal(S(plain, "commit").code, 2);
  assert.equal(S(plain, "state", "extra").code, 2);
});

/* ======================================================= git-state.mjs branch-check */

test("git-state branch-check: valid, invalid, taken and clashing names", () => {
  const { repo, g } = repoWithCommit("gs-branch");
  g("branch", "feat");
  const ok = S(repo, "branch-check", "--name", "feature/export-csv");
  assert.equal(ok.code, 0, ok.stderr);
  assert.deepEqual(ok.json, { ok: true, name: "feature/export-csv", valid: true, exists: false });
  for (const bad of ["bad..name", "has space", "-leading", "@{-1}", "ends/"]) {
    const r = S(repo, "branch-check", "--name", bad);
    assert.equal(r.code, 4, bad);
    assert.equal(r.json.error, "invalid-name", bad);
  }
  assert.match(S(repo, "branch-check", "--name", "bad..name").json.next, /feature\//);
  const taken = S(repo, "branch-check", "--name", "main");
  assert.equal(taken.code, 4);
  assert.equal(taken.json.error, "branch-exists");
  assert.match(taken.json.next, /main-2/);
  const clash = S(repo, "branch-check", "--name", "feat/x");
  assert.equal(clash.code, 4);
  assert.equal(clash.json.error, "branch-conflict");
  assert.equal(S(repo, "branch-check").code, 2);
});

/* ========================================================= git-state.mjs init-check */

test("git-state init-check: a plain folder is safe and suggests what to ignore", () => {
  const dir = tmp("gs-init");
  for (const f of ["node_modules/x/index.js", "dist/out.js", ".env", ".env.example", "app.log", "src/a.js"]) write(dir, f, "x\n");
  const r = S(dir, "init-check");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.safe, true);
  assert.equal(r.json.reason, undefined);
  assert.equal(r.json.insideRepo, false);
  assert.equal(r.json.hasGitignore, false);
  assert.deepEqual(r.json.suggestedIgnore, ["node_modules/", "dist/", ".env", ".env.*", "!.env.example", "*.log"]);
  write(dir, ".gitignore", "x\n");
  assert.equal(S(dir, "init-check").json.hasGitignore, true);
  const empty = tmp("gs-init-empty");
  assert.deepEqual(S(empty, "init-check").json.suggestedIgnore, []);
});

test("git-state init-check: inside a repository, the home folder, and a drive root are not safe", () => {
  const { repo } = repoWithCommit("gs-init-repo");
  write(repo, "sub/x.txt", "x\n");
  const inside = S(path.join(repo, "sub"), "init-check").json;
  assert.equal(inside.safe, false);
  assert.equal(inside.reason, "inside-repo");
  assert.equal(inside.insideRepo, true);
  assert.equal(path.resolve(inside.repoRoot).toLowerCase(), repo.toLowerCase());

  const home = tmp("gs-init-home");
  const asHome = runScript("plan2code-git-commit", "git-state.mjs", ["init-check"], { cwd: home, env: { HOME: home, USERPROFILE: home } });
  assert.equal(asHome.json.safe, false);
  assert.equal(asHome.json.reason, "home");

  const root = path.parse(process.cwd()).root;
  const atRoot = S(root, "init-check").json;
  if (!atRoot.insideRepo) {
    assert.equal(atRoot.safe, false);
    assert.equal(atRoot.reason, "root");
  }
});

/* ============================================================ the skill's other script */

test("plan2code-git-commit ships commit-msg.mjs with the two -m flags", () => {
  const r = runScript("plan2code-git-commit", "commit-msg.mjs", ["--subject", "Add the export", "--files", "src/a.js"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.command, 'git add -- src/a.js && git commit -m "Add the export" -m "AI Assisted"');
});
