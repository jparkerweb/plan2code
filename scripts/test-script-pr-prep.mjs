// Tests for plan2code-pr-prep's scripts/pr-prep.mjs: the template lookup, the
// pull-request link and the branch's spec folder. See skill-script-helpers.mjs
// for how these run.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runScript, tmp, write, gitInit, gitIn, slashed, fixtureCleanup } from "./skill-script-helpers.mjs";

after(fixtureCleanup);

// The console home holds pr-hosts.json; keep the real one out of every run.
const HOME = tmp("pr-prep-console-home");
const P = (cwd, ...a) => runScript("plan2code-pr-prep", "pr-prep.mjs", a, { cwd, env: { PLAN2CODE_CONSOLE_HOME: HOME } });

/* --------------------------------------------------------------- template */

const LOOKUP = [
  ".github/pull_request_template.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "PULL_REQUEST_TEMPLATE.md",
  "docs/pull_request_template.md",
  ".github/PULL_REQUEST_TEMPLATE/feature.md",
  "docs/PULL_REQUEST_TEMPLATE/feature.md",
  ".gitlab/merge_request_templates/Default.md",
];

test("pr-prep template: each place in the lookup order is found on its own", () => {
  for (const rel of LOOKUP) {
    const dir = tmp("pr-tpl");
    write(dir, rel, "## Summary\n");
    const r = P(dir, "template");
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.json, { ok: true, found: true, path: rel, headings: ["Summary"], hasTesting: false, others: [] }, rel);
  }
});

test("pr-prep template: the first in order wins and the rest are others", () => {
  const dir = tmp("pr-tpl-order");
  write(dir, "PULL_REQUEST_TEMPLATE.md", "## Root\n");
  write(dir, "docs/pull_request_template.md", "## Docs\n");
  write(dir, ".github/PULL_REQUEST_TEMPLATE/feature.md", "## Feature\n");
  write(dir, ".github/PULL_REQUEST_TEMPLATE/bug.md", "## Bug\n");
  write(dir, ".github/PULL_REQUEST_TEMPLATE/notes.txt", "not a template\n");
  write(dir, ".gitlab/merge_request_templates/Default.md", "## GitLab\n");
  const r = P(dir, "template");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.path, "PULL_REQUEST_TEMPLATE.md");
  assert.deepEqual(r.json.headings, ["Root"]);
  assert.deepEqual(r.json.others, [
    "docs/pull_request_template.md",
    ".github/PULL_REQUEST_TEMPLATE/bug.md",
    ".github/PULL_REQUEST_TEMPLATE/feature.md",
    ".gitlab/merge_request_templates/Default.md",
  ]);
});

test("pr-prep template: names are compared case-insensitively", () => {
  const dir = tmp("pr-tpl-case");
  write(dir, ".GitHub/Pull_Request_Template.MD", "## What\n");
  const r = P(dir, "template");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.found, true);
  assert.equal(r.json.path, ".GitHub/Pull_Request_Template.MD");
});

test("pr-prep template: headings outside code fences only, # to ###, and hasTesting", () => {
  const dir = tmp("pr-tpl-headings");
  write(
    dir,
    ".github/pull_request_template.md",
    "# Title\n\n<!-- describe it -->\n## Summary ##\n\n```markdown\n## Not a heading\n```\n\n~~~\n# Also not\n~~~\n\n### How was this tested?\n#### Too deep\n    ## indented code\n#No space\n"
  );
  const r = P(dir, "template");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.headings, ["Title", "Summary", "How was this tested?"]);
  assert.equal(r.json.hasTesting, true);

  for (const [heading, expected] of [["## Verification", true], ["## QA notes", true], ["## How it was checked", true], ["## Summary\n## Risks", false]]) {
    write(dir, ".github/pull_request_template.md", `${heading}\n`);
    assert.equal(P(dir, "template").json.hasTesting, expected, heading);
  }
});

test("pr-prep template: none found", () => {
  const dir = tmp("pr-tpl-none");
  write(dir, "README.md", "# Project\n");
  write(dir, ".github/workflows/ci.yml", "on: push\n");
  const r = P(dir, "template");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true, found: false, path: null, headings: [], hasTesting: false, others: [] });
});

/* ----------------------------------------------------------------- pr-url */

function repoOnMain(name) {
  const repo = tmp(name);
  const g = gitInit(repo);
  write(repo, "a.txt", "a\n");
  g("add", "a.txt");
  g("commit", "-q", "-m", "init");
  return { repo, g };
}

test("pr-prep pr-url: a pushed branch gives the link, an unpushed one pushed: false with exit 0", () => {
  const { repo, g } = repoOnMain("pr-url");
  const bare = tmp("pr-url-origin");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", bare], { stdio: "pipe" });
  g("remote", "add", "origin", slashed(bare));
  g("push", "-q", "-u", "origin", "main");
  g("switch", "-q", "-c", "feature/x");
  write(repo, "b.txt", "b\n");
  g("add", "b.txt");
  g("commit", "-q", "-m", "b");

  const unpushed = P(repo, "pr-url");
  assert.equal(unpushed.code, 0, unpushed.stderr);
  assert.equal(unpushed.json.ok, true);
  assert.equal(unpushed.json.pushed, false);
  assert.equal(unpushed.json.branch, "feature/x");
  assert.match(unpushed.json.next, /plan2code-git/);

  g("push", "-q", "-u", "origin", "feature/x");
  // The pushed copy lives in the local bare repo; the link comes from the
  // remote's address, so point it at a forge host once the push is done.
  g("remote", "set-url", "origin", "git@github.com:owner/repo.git");
  write(repo, "c.txt", "c\n");
  g("add", "c.txt");
  g("commit", "-q", "-m", "c");
  const pushed = P(repo, "pr-url");
  assert.equal(pushed.code, 0, pushed.stderr);
  assert.deepEqual(pushed.json, {
    ok: true,
    pushed: true,
    url: "https://github.com/owner/repo/compare/main...feature/x?quick_pull=1",
    host: "github.com",
    kind: "github",
    needsKind: false,
    branch: "feature/x",
    base: "main",
    ahead: 1,
  });
});

test("pr-prep pr-url: a detached HEAD fails as git.mjs does; outside a repo is exit 3", () => {
  const { repo, g } = repoOnMain("pr-url-detached");
  g("checkout", "-q", "--detach");
  const mine = P(repo, "pr-url");
  const git = runScript("plan2code-git", "git.mjs", ["pr-url"], { cwd: repo, env: { PLAN2CODE_CONSOLE_HOME: HOME } });
  assert.equal(mine.code, 5);
  assert.equal(mine.code, git.code);
  assert.deepEqual(mine.json, git.json);
  assert.equal(mine.json.error, "detached");

  const plain = tmp("pr-url-plain");
  const r = P(plain, "pr-url");
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "not-a-repo");
});

/* ------------------------------------------------------------------- spec */

const EARLY = new Date("2026-06-01T12:00:00Z");
const LATE = new Date("2026-07-15T12:00:00Z");

/** Every file under `dir` stamped with `when`. */
function stamp(dir, when) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) stamp(p, when);
    else fs.utimesSync(p, when, when);
  }
}

/** A repo whose main commit is dated 2026-07-01, on `branch` from it, with the given spec folders (each stamped EARLY). */
function specRepo(name, branch, folders) {
  const repo = tmp(name);
  const g = gitInit(repo);
  write(repo, "a.txt", "a\n");
  g("add", "a.txt");
  const env = { ...process.env, GIT_AUTHOR_DATE: "2026-07-01T12:00:00Z", GIT_COMMITTER_DATE: "2026-07-01T12:00:00Z" };
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: repo, env, stdio: "pipe" });
  if (branch !== "main") g("switch", "-q", "-c", branch);
  for (const f of folders) write(repo, `${f}/overview.md`, "# Spec\n");
  for (const d of ["specs", "specs--completed"]) if (fs.existsSync(path.join(repo, d))) stamp(path.join(repo, d), EARLY);
  return repo;
}

test("pr-prep spec: the branch name matches a folder in specs/", () => {
  const repo = specRepo("spec-branch", "feature/pr-prep-and-test-skills", ["specs/pr-prep-and-test-skills", "specs/other-thing", "specs--completed/pr-prep-and-test-skills"]);
  const r = P(repo, "spec");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true, branch: "feature/pr-prep-and-test-skills", match: "specs/pr-prep-and-test-skills", candidates: [], how: "branch" });
});

test("pr-prep spec: a match only in specs--completed/, a user segment, and --branch", () => {
  const repo = specRepo("spec-completed", "jane/Lunch_Vote", ["specs--completed/lunch-vote", "specs/unrelated"]);
  const r = P(repo, "spec");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.match, "specs--completed/lunch-vote");
  assert.equal(r.json.how, "branch");
  assert.equal(P(repo, "spec", "--branch", "fix/unrelated-crash").json.match, "specs/unrelated");
});

test("pr-prep spec: two names in the branch is ask", () => {
  const repo = specRepo("spec-ask", "feature/auth-and-billing", ["specs/auth", "specs/billing", "specs/search"]);
  const r = P(repo, "spec");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true, branch: "feature/auth-and-billing", match: null, candidates: ["specs/auth", "specs/billing"], how: "ask" });
});

test("pr-prep spec: no name match, one folder touched since the branch began, is recent; several is ask", () => {
  const repo = specRepo("spec-recent", "feature/something-else", ["specs/old-work", "specs/new-work", "specs--completed/done-work"]);
  stamp(path.join(repo, "specs", "new-work"), LATE);
  const r = P(repo, "spec");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true, branch: "feature/something-else", match: "specs/new-work", candidates: [], how: "recent" });

  write(repo, "specs--completed/done-work/deep/a/b/c/notes.md", "x\n");
  stamp(path.join(repo, "specs--completed", "done-work"), EARLY);
  fs.utimesSync(path.join(repo, "specs--completed/done-work/deep/a/b/c/notes.md"), LATE, LATE);
  assert.equal(P(repo, "spec").json.how, "recent", "a file five levels down is past the walk");
  fs.utimesSync(path.join(repo, "specs--completed/done-work/overview.md"), LATE, LATE);
  const two = P(repo, "spec").json;
  assert.equal(two.how, "ask");
  assert.deepEqual(two.candidates, ["specs/new-work", "specs--completed/done-work"]);
});

test("pr-prep spec: --branch measures the recent rule from that branch's start, not HEAD's", () => {
  const repo = specRepo("spec-branch-start", "feature/side-work", ["specs/tracker"]);
  const g = gitIn(repo);
  g("switch", "-q", "main");
  write(repo, "b.txt", "b\n");
  g("add", "b.txt");
  const env = { ...process.env, GIT_AUTHOR_DATE: "2026-08-01T12:00:00Z", GIT_COMMITTER_DATE: "2026-08-01T12:00:00Z" };
  execFileSync("git", ["commit", "-q", "-m", "later on main"], { cwd: repo, env, stdio: "pipe" });
  stamp(path.join(repo, "specs", "tracker"), LATE);
  assert.equal(P(repo, "spec").json.how, "none", "on main the start is main's own tip, after the folder changed");
  const r = P(repo, "spec", "--branch", "feature/side-work");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true, branch: "feature/side-work", match: "specs/tracker", candidates: [], how: "recent" });
});

test("pr-prep spec: nothing fits is none; outside a repo is exit 3", () => {
  const repo = specRepo("spec-none", "feature/something-else", ["specs/old-work"]);
  const r = P(repo, "spec");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true, branch: "feature/something-else", match: null, candidates: [], how: "none" });
  const bare = specRepo("spec-empty", "main", []);
  assert.equal(P(bare, "spec").json.how, "none");

  const plain = tmp("spec-plain");
  const out = P(plain, "spec");
  assert.equal(out.code, 3);
  assert.equal(out.json.error, "not-a-repo");
});

test("pr-prep: bad arguments exit 2", () => {
  const dir = tmp("pr-args");
  assert.equal(P(dir).code, 2);
  assert.equal(P(dir, "nope").code, 2);
  assert.equal(P(dir, "template", "extra").code, 2);
  assert.equal(P(dir, "spec", "--bogus").code, 2);
});
