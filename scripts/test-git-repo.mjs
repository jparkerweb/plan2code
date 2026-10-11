// Tests for src/web-console/git-repo.mjs, the one read-only git reader.
//
// It ships inside the web console, not a skill's scripts/, so these import it
// directly and run it against throwaway repos in the OS temp dir. A bare repo
// stands in for origin, so pushes, [gone] branches and rebase conflicts all
// reproduce locally.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { tmp, write, gitInit, gitIn, copyFixture, slashed, fixtureCleanup } from "./skill-script-helpers.mjs";
import {
  countPending,
  gitFloor,
  parseRemoteUrl,
  parseStatusV2,
  prUrl,
  readChanges,
  snapshot,
} from "../src/web-console/git-repo.mjs";

// A repo with one commit on `branch`, and its git runner.
// Built once per branch and copied for each test (fixture-helpers.mjs).
test.after(fixtureCleanup);
const commitIn = (dir, branch) => {
  const g = gitInit(dir, branch);
  write(dir, "a.txt", "a\n");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
};
function repoWithCommit(name, branch = "main") {
  const repo = copyFixture(name, `commit:${branch}`, (dir) => commitIn(dir, branch));
  return { repo, g: gitIn(repo) };
}

function bareRemote(name = "origin") {
  return copyFixture(name, "bare", (dir) => execFileSync("git", ["init", "-q", "--bare", "-b", "main", dir], { stdio: "pipe" }));
}

// A second clone of `bare`, for pushing from somewhere else.
function cloneOf(bare, name) {
  const dir = path.join(tmp(name), "clone");
  execFileSync("git", ["clone", "-q", bare, dir], { stdio: "pipe" });
  const g = (...a) => execFileSync("git", a, { cwd: dir, stdio: "pipe", encoding: "utf8" });
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "Test");
  g("config", "commit.gpgsign", "false");
  return { dir, g };
}

// A repo whose main is pushed to a bare origin.
function repoWithOrigin(name) {
  const base = copyFixture(name, "origin", (dir) => {
    const repo = path.join(dir, "repo");
    const bare = path.join(dir, "origin.git");
    fs.mkdirSync(repo);
    commitIn(repo, "main");
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", bare], { stdio: "pipe" });
    const g = gitIn(repo);
    g("remote", "add", "origin", slashed(bare));
    g("push", "-q", "-u", "origin", "main");
  });
  const repo = path.join(base, "repo");
  return { repo, g: gitIn(repo), bare: path.join(base, "origin.git") };
}

const branch = (snap, name) => snap.branches.find((b) => b.name === name);

/* ======================================================== parseStatusV2 */

test("parseStatusV2: an initial commit has no oid and no commits", () => {
  const p = parseStatusV2("# branch.oid (initial)\0# branch.head main\0? new.txt\0");
  assert.equal(p.oid, null);
  assert.equal(p.hasCommits, false);
  assert.equal(p.branch, "main");
  assert.equal(p.upstream, null);
  assert.equal(p.ahead, null);
  assert.equal(p.behind, null);
  assert.deepEqual(p.files, [{ path: "new.txt", index: " ", worktree: "?", state: "new" }]);
});

test("parseStatusV2: a detached HEAD has no branch", () => {
  const p = parseStatusV2("# branch.oid 0123456789abcdef0123456789abcdef01234567\0# branch.head (detached)\0");
  assert.equal(p.branch, null);
  assert.equal(p.hasCommits, true);
  assert.equal(p.oid, "0123456789abcdef0123456789abcdef01234567");
});

test("parseStatusV2: branch.ab gives ahead and behind against the upstream", () => {
  const p = parseStatusV2(
    "# branch.oid 0123456789abcdef0123456789abcdef01234567\0# branch.head feature/x\0# branch.upstream origin/feature/x\0# branch.ab +2 -1\0",
  );
  assert.equal(p.branch, "feature/x");
  assert.equal(p.upstream, "origin/feature/x");
  assert.equal(p.ahead, 2);
  assert.equal(p.behind, 1);
});

test("parseStatusV2: a rename consumes its NUL-separated original path, and letters map . to a space", () => {
  const h = "0123456789abcdef0123456789abcdef01234567";
  const text = [
    "# branch.oid " + h,
    "# branch.head main",
    `1 .M N... 100644 100644 100644 ${h} ${h} src/a file.js`,
    `2 R. N... 100644 100644 100644 ${h} ${h} R100 new name.txt`,
    "old name.txt",
    `1 D. N... 100644 000000 000000 ${h} ${h} gone.txt`,
    `1 A. N... 000000 100644 100644 ${h} ${h} added.txt`,
    "! ignored.log",
    "",
  ].join("\0");
  const p = parseStatusV2(text);
  assert.deepEqual(p.files, [
    { path: "src/a file.js", index: " ", worktree: "M", state: "modified" },
    { path: "new name.txt", index: "R", worktree: " ", state: "renamed", origPath: "old name.txt" },
    { path: "gone.txt", index: "D", worktree: " ", state: "deleted" },
    { path: "added.txt", index: "A", worktree: " ", state: "new" },
  ]);
});

test("parseStatusV2: an unmerged entry goes only into conflicted", () => {
  const h = "0123456789abcdef0123456789abcdef01234567";
  const p = parseStatusV2(`# branch.oid ${h}\0# branch.head main\0u UU N... 100644 100644 100644 100644 ${h} ${h} ${h} both.txt\0`);
  assert.deepEqual(p.conflicted, [{ path: "both.txt", status: "UU" }]);
  assert.deepEqual(p.files, []);
});

test("parseStatusV2: an untracked folder keeps its trailing slash", () => {
  const p = parseStatusV2("# branch.oid (initial)\0# branch.head main\0? dist/\0");
  assert.equal(p.files[0].path, "dist/");
  assert.equal(p.files[0].worktree, "?");
});

/* ========================================================== readChanges */

test("readChanges: staged after git add, unstaged otherwise", () => {
  const { repo, g } = repoWithCommit("gr-staged");
  write(repo, "b.txt", "b\n");
  g("add", "-A");
  g("commit", "-q", "-m", "b");
  write(repo, "a.txt", "changed\n");
  write(repo, "b.txt", "changed\n");
  g("add", "a.txt");
  const status = execFileSync("git", ["status", "--porcelain=v2", "-z", "--branch"], { cwd: repo, encoding: "utf8" });
  const changes = readChanges(repo, parseStatusV2(status));
  const byPath = Object.fromEntries(changes.files.map((f) => [f.path, f]));
  assert.equal(byPath["a.txt"].staged, true);
  assert.equal(byPath["b.txt"].staged, false);
  assert.equal(changes.count, 2);
  assert.equal(changes.heldBack, 0);
});

/* ======================================================= snapshot: repos */

test("snapshot: ahead after a local commit, behind after a push from a second clone", () => {
  const { repo, g, bare } = repoWithOrigin("gr-ab");
  write(repo, "a.txt", "local\n");
  g("commit", "-q", "-am", "local");
  let s = snapshot(repo);
  assert.equal(s.repo, true);
  assert.equal(s.head.branch, "main");
  assert.equal(s.head.upstream, "origin/main");
  assert.equal(s.head.ahead, 1);
  assert.equal(s.head.behind, 0);
  assert.equal(branch(s, "main").ahead, 1);

  const other = cloneOf(bare, "gr-ab-other");
  write(other.dir, "c.txt", "c\n");
  other.g("add", "-A");
  other.g("commit", "-q", "-m", "remote");
  other.g("push", "-q", "origin", "main");
  g("fetch", "-q");
  s = snapshot(repo);
  assert.equal(s.head.ahead, 1);
  assert.equal(s.head.behind, 1);
  const main = branch(s, "main");
  assert.deepEqual([main.ahead, main.behind, main.gone], [1, 1, false]);
  assert.equal(main.default, true);
  assert.equal(main.upstreamRemote, "origin");
  assert.equal(main.last.subject, "local");
  assert.equal(main.last.author, "Test");
  assert.equal(typeof s.lastFetch, "string", "a fetch leaves FETCH_HEAD");
});

test("snapshot: a branch whose remote copy was deleted and pruned is gone", () => {
  const { repo, g, bare } = repoWithOrigin("gr-gone");
  g("switch", "-q", "-c", "feature/x");
  write(repo, "x.txt", "x\n");
  g("add", "-A");
  g("commit", "-q", "-m", "x");
  g("push", "-q", "-u", "origin", "feature/x");
  const other = cloneOf(bare, "gr-gone-other");
  other.g("push", "-q", "origin", "--delete", "feature/x");
  g("fetch", "-q", "--prune");
  const s = snapshot(repo);
  const x = branch(s, "feature/x");
  assert.equal(x.gone, true);
  assert.equal(x.upstream, "origin/feature/x");
  assert.equal(x.current, true);
  assert.equal(s.prUrl, null, "no link for a gone upstream");
});

test("snapshot: merged branches against the default, and remote-only rows", () => {
  const { repo, g, bare } = repoWithOrigin("gr-merged");
  g("branch", "done");
  g("switch", "-q", "-c", "wip");
  write(repo, "w.txt", "w\n");
  g("add", "-A");
  g("commit", "-q", "-m", "wip");
  g("switch", "-q", "main");
  const other = cloneOf(bare, "gr-merged-other");
  other.g("switch", "-q", "-c", "theirs");
  other.g("push", "-q", "origin", "theirs");
  g("fetch", "-q");
  const s = snapshot(repo);
  assert.equal(branch(s, "done").merged, true);
  assert.equal(branch(s, "wip").merged, false);
  assert.equal(branch(s, "main").merged, false, "the default branch is never merged");
  const theirs = branch(s, "theirs");
  assert.equal(theirs.remote, "origin");
  assert.equal(theirs.upstream, null);
  assert.equal(s.branches.filter((b) => b.name === "main").length, 1, "origin/main is tracked, so no remote-only row");
  assert.ok(!s.branches.some((b) => b.name === "HEAD"), "origin/HEAD is skipped");
});

test("snapshot: a detached HEAD gives a 7-character short oid", () => {
  const { repo, g } = repoWithCommit("gr-detached");
  g("checkout", "-q", "--detach");
  const s = snapshot(repo);
  assert.equal(s.head.branch, null);
  assert.equal(s.head.detached.length, 7);
});

test("snapshot: no commits, no remote and never fetched", () => {
  const repo = tmp("gr-empty");
  gitInit(repo);
  const s = snapshot(repo);
  assert.equal(s.repo, true);
  assert.equal(s.hasCommits, false);
  assert.deepEqual(s.branches, []);
  assert.deepEqual(s.remotes, []);
  assert.equal(s.prUrl, null);
  assert.equal(s.lastFetch, null, "no FETCH_HEAD reads as never refreshed");
  assert.equal(s.defaultBranch, "main", "an unborn main is the default");
  assert.equal(s.inProgress, null);
});

test("snapshot: two remotes with a different upstream per branch", () => {
  const { repo, g } = repoWithOrigin("gr-two");
  const up = bareRemote("upstream");
  g("remote", "add", "upstream", up);
  g("switch", "-q", "-c", "side");
  g("push", "-q", "-u", "upstream", "side");
  const s = snapshot(repo);
  assert.equal(branch(s, "main").upstreamRemote, "origin");
  assert.equal(branch(s, "side").upstreamRemote, "upstream");
  assert.deepEqual(s.remotes.map((r) => r.name).sort(), ["origin", "upstream"]);
});

test("snapshot: mid-rebase with a conflict, then the markers removed", () => {
  const { repo, g } = repoWithCommit("gr-rebase");
  g("switch", "-q", "-c", "feature");
  write(repo, "a.txt", "feature\n");
  g("commit", "-q", "-am", "feature");
  g("switch", "-q", "main");
  write(repo, "a.txt", "main\n");
  g("commit", "-q", "-am", "main");
  g("switch", "-q", "feature");
  assert.throws(() => g("rebase", "main"), "the rebase stops on the conflict");
  let s = snapshot(repo);
  assert.equal(s.inProgress, "rebase");
  assert.deepEqual(s.conflicted, [{ path: "a.txt", status: "UU", markers: true }]);
  write(repo, "a.txt", "resolved\n");
  s = snapshot(repo);
  assert.equal(s.conflicted[0].markers, false, "Continue can be offered once no markers remain");
  g("rebase", "--abort");
});

test("snapshot: an untracked folder is one row, and a .env inside a new folder is held back", () => {
  const { repo } = repoWithCommit("gr-untracked");
  for (let i = 0; i < 250; i++) write(repo, `big/f${i}.txt`, "x");
  write(repo, "cfg/.env", "SECRET=1\n");
  write(repo, "loose.txt", "x");
  const s = snapshot(repo);
  const dirs = Object.fromEntries(s.changes.untrackedDirs.map((d) => [d.path, d.files]));
  assert.equal(dirs["big/"], 250);
  assert.equal(dirs["cfg/"], 1);
  assert.equal(s.changes.count, 3, "two folders and one file");
  assert.equal(s.changes.heldBack, 1);
  assert.deepEqual(s.changes.files, [{ path: "loose.txt", state: "new", risky: false, staged: false }]);
  assert.equal(countPending(repo), 3, "the dashboard count agrees");
});

test("snapshot: the pull-request link for a pushed feature branch", () => {
  const { repo, g } = repoWithOrigin("gr-pr");
  g("switch", "-q", "-c", "feature/ABC-1-x");
  g("push", "-q", "-u", "origin", "feature/ABC-1-x");
  g("remote", "set-url", "origin", "git@github.com:acme/demo.git");
  let s = snapshot(repo);
  assert.equal(s.prUrl, "https://github.com/acme/demo/compare/main...feature/ABC-1-x?quick_pull=1");
  g("switch", "-q", "main");
  s = snapshot(repo);
  assert.equal(s.prUrl, null, "no link from the default branch");
});

test("snapshot: not a repository", () => {
  const dir = tmp("gr-plain");
  const s = snapshot(dir);
  assert.equal(s.repo, false);
  assert.equal(typeof s.at, "string");
  assert.equal(countPending(dir), null);
});

/* ================================================ remotes and PR links */

const HEAD = "feature/ABC-1-x";
const BASE = "main";

test("parseRemoteUrl + prUrl: GitHub, GitLab and Bitbucket in SSH and HTTPS form", () => {
  const cases = [
    ["git@github.com:jparkerweb/plan2code.git", "https://github.com/jparkerweb/plan2code", "github"],
    ["https://github.com/jparkerweb/plan2code.git", "https://github.com/jparkerweb/plan2code", "github"],
    ["ssh://git@github.com/jparkerweb/plan2code.git", "https://github.com/jparkerweb/plan2code", "github"],
    ["git@gitlab.com:group/sub/proj.git", "https://gitlab.com/group/sub/proj", "gitlab"],
    ["https://user:token@gitlab.com/group/sub/proj.git", "https://gitlab.com/group/sub/proj", "gitlab"],
    ["git@bitbucket.org:ws/repo.git", "https://bitbucket.org/ws/repo", "bitbucket"],
    ["https://someone@bitbucket.org/ws/repo.git", "https://bitbucket.org/ws/repo", "bitbucket"],
  ];
  for (const [url, web, kind] of cases) {
    const r = parseRemoteUrl(url);
    assert.equal(r.web, web, url);
    assert.equal(r.kind, kind, url);
  }
  const gh = parseRemoteUrl(cases[0][0]);
  assert.equal(prUrl(gh, { base: BASE, head: HEAD }), "https://github.com/jparkerweb/plan2code/compare/main...feature/ABC-1-x?quick_pull=1");
  assert.equal(
    prUrl(parseRemoteUrl(cases[3][0]), { base: BASE, head: HEAD }),
    "https://gitlab.com/group/sub/proj/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature%2FABC-1-x&merge_request%5Btarget_branch%5D=main",
  );
  assert.equal(
    prUrl(parseRemoteUrl(cases[5][0]), { base: BASE, head: HEAD }),
    "https://bitbucket.org/ws/repo/pull-requests/new?source=feature%2FABC-1-x&dest=main",
  );
});

test("parseRemoteUrl + prUrl: Azure DevOps over HTTPS with userinfo, ssh.dev.azure.com v3 and visualstudio.com", () => {
  const web = "https://dev.azure.com/org/project/_git/repo";
  for (const url of ["https://org@dev.azure.com/org/project/_git/repo", "git@ssh.dev.azure.com:v3/org/project/repo", "ssh://git@ssh.dev.azure.com/v3/org/project/repo"]) {
    const r = parseRemoteUrl(url);
    assert.equal(r.web, web, url);
    assert.equal(r.kind, "azure", url);
  }
  const vs = parseRemoteUrl("https://org.visualstudio.com/project/_git/repo");
  assert.equal(vs.web, "https://org.visualstudio.com/project/_git/repo");
  assert.equal(vs.kind, "azure");
  const vsSsh = parseRemoteUrl("org@vs-ssh.visualstudio.com:v3/org/project/repo");
  assert.equal(vsSsh.web, "https://org.visualstudio.com/project/_git/repo");
  assert.equal(vsSsh.kind, "azure");
  assert.equal(
    prUrl(parseRemoteUrl("git@ssh.dev.azure.com:v3/org/project/repo"), { base: BASE, head: HEAD }),
    "https://dev.azure.com/org/project/_git/repo/pullrequestcreate?sourceRef=feature%2FABC-1-x&targetRef=main",
  );
});

test("parseRemoteUrl + prUrl: an unknown host has no link until prHosts names it", () => {
  const r = parseRemoteUrl("git@git.example.com:team/repo.git");
  assert.equal(r.host, "git.example.com");
  assert.equal(r.kind, null);
  assert.equal(prUrl(r, { base: BASE, head: HEAD }), null);
  assert.equal(prUrl({ ...r, kind: "none" }, { base: BASE, head: HEAD }), null);

  const { repo, g } = repoWithCommit("gr-prhost");
  g("remote", "add", "origin", "git@git.example.com:team/repo.git");
  const s = snapshot(repo, { prHosts: { "git.example.com": "gitlab" } });
  assert.equal(s.remotes[0].kind, "gitlab");
  assert.equal(
    prUrl(s.remotes[0], { base: BASE, head: HEAD }),
    "https://git.example.com/team/repo/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature%2FABC-1-x&merge_request%5Btarget_branch%5D=main",
  );
  assert.equal(snapshot(repo, { prHosts: { "git.example.com": "none" } }).remotes[0].kind, "none");
  assert.equal(
    parseRemoteUrl("https://dev.azure.com/org/My%20Project/_git/repo").web,
    "https://dev.azure.com/org/My%20Project/_git/repo",
    "an encoded path stays encoded",
  );
  assert.equal(parseRemoteUrl("https://git.example.com/a%zz/b.git").web, "https://git.example.com/a%zz/b", "a bad escape does not throw");
  assert.equal(parseRemoteUrl("C:/repos/origin.git"), null, "a Windows path is not scp-style");
  assert.equal(parseRemoteUrl("/srv/git/origin.git"), null);
});

/* ================================================== floor and timing */

test("gitFloor: this machine's git is new enough", () => {
  const f = gitFloor();
  assert.equal(f.ok, true, f.message);
  assert.match(f.version, /^\d+\.\d+\.\d+/);
});

test("snapshot: a 300-branch repo reads in under 5 seconds", () => {
  const { repo, g } = repoWithCommit("gr-300");
  const sha = g("rev-parse", "HEAD").trim();
  const lines = Array.from({ length: 300 }, (_, i) => `create refs/heads/b-${String(i).padStart(3, "0")} ${sha}\n`).join("");
  execFileSync("git", ["update-ref", "--stdin"], { cwd: repo, input: lines, stdio: ["pipe", "pipe", "pipe"] });
  const started = Date.now();
  const s = snapshot(repo);
  const took = Date.now() - started;
  assert.equal(s.branches.length, 301);
  assert.ok(took < 5000, `took ${took} ms`);
});
