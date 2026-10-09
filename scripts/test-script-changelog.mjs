// Tests for plan2code-changelog's scripts/changelog-state.mjs.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { runScript, tmp, write, read, gitInit } from "./skill-script-helpers.mjs";

const S = (cwd, ...a) => runScript("plan2code-changelog", "changelog-state.mjs", a, { cwd });

const V = (version, body = "### ✨ Added\n\n- **x**: a thing.\n") => `## v${version}\n\n${body}\n`;
const LOG = (...entries) => `# Changelog\n\nAll notable changes.\n\n${entries.join("")}`;

// A repo whose main has CHANGELOG at `top`, plus the runner.
function repo(name, { changelog = LOG(V("1.0.0")), pkg = true } = {}) {
  const dir = tmp(name);
  const g = gitInit(dir, "main");
  write(dir, "CHANGELOG.md", changelog);
  if (pkg) write(dir, "package.json", `{\n  "name": "x",\n  "version": "1.0.0",\n  "private": true\n}\n`);
  write(dir, "a.txt", "a\n");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  return { dir, g };
}

const commitAll = (g, msg) => {
  g("add", "-A");
  g("commit", "-q", "-m", msg);
};

test("changelog-state: not a repository and no CHANGELOG are exit 3", () => {
  const plain = tmp("cl-plain");
  const a = S(plain, "state");
  assert.equal(a.code, 3);
  assert.equal(a.json.error, "not-a-repo");
  const { dir } = repo("cl-nolog", { changelog: "x" });
  execFileSync("git", ["rm", "-q", "CHANGELOG.md"], { cwd: dir });
  const b = S(dir, "state");
  assert.equal(b.code, 3);
  assert.equal(b.json.error, "no-changelog");
});

test("changelog-state: on the default branch there is no new entry and the version is the base's", () => {
  const { dir } = repo("cl-main");
  const r = S(dir, "state");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.branch, "main");
  assert.equal(r.json.onDefault, true);
  assert.deepEqual([r.json.base.ref, r.json.base.version], ["main", "1.0.0"], "no origin: the local default branch is the base");
  assert.equal(r.json.topIsNew, false);
});

test("changelog-state: a branch with no entry above main needs a new version, not an extension", () => {
  const { dir, g } = repo("cl-noentry");
  g("switch", "-q", "-c", "feature/x");
  write(dir, "b.txt", "b\n");
  commitAll(g, "add b");
  const r = S(dir, "state");
  assert.equal(r.json.base.version, "1.0.0");
  assert.equal(r.json.topIsNew, false);
  assert.equal(r.json.canExtend, false);
  assert.equal(r.json.entryBump, "none");
  assert.deepEqual(r.json.commits.map((c) => c.subject), ["add b"]);
  assert.deepEqual(r.json.files, ["b.txt"]);
  assert.equal(r.json.entry, "", "main's released entry is not this branch's to compare against");
});

test("changelog-state: an entry above main that nobody else has can be extended", () => {
  const { dir, g } = repo("cl-extend");
  g("switch", "-q", "-c", "feature/x");
  write(dir, "CHANGELOG.md", LOG(V("1.1.0"), V("1.0.0")));
  commitAll(g, "changelog 1.1.0");
  write(dir, "b.txt", "b\n");
  commitAll(g, "later work");
  write(dir, "c.txt", "c\n");
  const r = S(dir, "state");
  assert.equal(r.json.branchTop.version, "1.1.0");
  assert.equal(r.json.topIsNew, true);
  assert.equal(r.json.entryBump, "minor");
  assert.equal(r.json.released, false);
  assert.deepEqual(r.json.takenBy, []);
  assert.equal(r.json.canExtend, true);
  // The gap is what came after the entry was last touched, plus the working tree.
  assert.deepEqual(r.json.commits.map((c) => c.subject), ["later work"]);
  assert.deepEqual(r.json.files, ["b.txt"]);
  assert.deepEqual(r.json.uncommitted, ["c.txt"]);
  assert.match(r.json.entry, /^## v1\.1\.0/);
  assert.deepEqual(r.json.sectionHeadings, ["### ✨ Added"]);
});

test("changelog-state: a tagged version is released, and one on another branch is taken", () => {
  const { dir, g } = repo("cl-spent");
  g("switch", "-q", "-c", "feature/x");
  write(dir, "CHANGELOG.md", LOG(V("1.1.0"), V("1.0.0")));
  commitAll(g, "changelog 1.1.0");
  g("switch", "-q", "-c", "feature/other");
  write(dir, "o.txt", "o\n");
  commitAll(g, "other work");
  g("switch", "-q", "feature/x");
  assert.deepEqual(S(dir, "state").json.takenBy, ["feature/other"], "a branch that already holds the version");
  assert.equal(S(dir, "state").json.canExtend, false);
  g("branch", "-D", "feature/other");
  g("tag", "v1.1.0");
  const r = S(dir, "state");
  assert.equal(r.json.released, true);
  assert.equal(r.json.canExtend, false);
});

test("changelog-state: a branch that is only part of this one's history is no claim", () => {
  const { dir, g } = repo("cl-history");
  g("switch", "-q", "-c", "feature/x");
  write(dir, "CHANGELOG.md", LOG(V("1.1.0"), V("1.0.0")));
  commitAll(g, "changelog 1.1.0");
  g("branch", "behind-me");
  write(dir, "b.txt", "b\n");
  commitAll(g, "more");
  assert.deepEqual(S(dir, "state").json.takenBy, []);
});

test("changelog-state: reads the heading style and package.json alignment", () => {
  const log = `# Changelog\n\n## [2.0.0] - 2026-01-02\n\n### Fixed\n\n- y\n\n## [1.0.0] - 2025-12-01\n\n### Added\n\n- x\n`;
  const { dir } = repo("cl-style", { changelog: log });
  const r = S(dir, "state");
  assert.equal(r.json.heading.style, "bracketed");
  assert.equal(r.json.heading.dated, true);
  assert.equal(r.json.heading.separator, "-");
  assert.equal(r.json.package.version, "1.0.0");
  assert.equal(r.json.package.matches, false, "package.json lags the CHANGELOG's 2.0.0");
  const b = S(dir, "bump", "--from", "2.0.0", "--kind", "patch");
  assert.equal(b.json.version, "2.0.1");
  assert.equal(b.json.heading, "## [2.0.1] - 2026-08-03");
});

test("changelog-state: an Unreleased heading is not a version and package.json is not aligned to it", () => {
  const log = `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- soon\n\n## [1.0.0] - 2025-12-01\n\n- x\n`;
  const { dir } = repo("cl-unreleased", { changelog: log });
  const r = S(dir, "state");
  assert.equal(r.json.branchTop.unreleased, true);
  assert.equal(r.json.branchTop.version, null);
  assert.equal(r.json.topIsNew, false);
  assert.equal(r.json.package.matches, false);
  assert.match(r.json.entry, /^## \[Unreleased\]/);
});

test("changelog-state bump: kinds and bad input", () => {
  const { dir } = repo("cl-bump");
  assert.equal(S(dir, "bump", "--from", "1.2.3", "--kind", "major").json.version, "2.0.0");
  assert.equal(S(dir, "bump", "--from", "1.2.3", "--kind", "minor").json.version, "1.3.0");
  assert.equal(S(dir, "bump", "--from", "v1.2.3", "--kind", "patch").json.version, "1.2.4");
  assert.equal(S(dir, "bump", "--from", "1.2.3", "--kind", "huge").code, 2);
  const bad = S(dir, "bump", "--from", "one", "--kind", "patch");
  assert.equal(bad.code, 4);
  assert.equal(bad.json.error, "bad-version");
});

test("changelog-state set-package-version: changes the version field and nothing else", () => {
  const { dir } = repo("cl-pkg");
  const before = read(dir, "package.json");
  const r = S(dir, "set-package-version", "--version", "1.1.0");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual([r.json.from, r.json.to, r.json.changed], ["1.0.0", "1.1.0", true]);
  assert.equal(read(dir, "package.json"), before.replace('"1.0.0"', '"1.1.0"'));
  assert.equal(S(dir, "set-package-version", "--version", "1.1.0").json.changed, false);
  write(dir, "package.json", `{ "name": "x" }\n`);
  assert.equal(S(dir, "set-package-version", "--version", "1.1.0").code, 4);
  write(dir, "package.json", `{
  "config": {
    "version": "9.9.9"
  },
  "version": "1.0.0"
}
`);
  const nested = S(dir, "set-package-version", "--version", "1.1.0");
  assert.equal(nested.code, 5);
  assert.equal(nested.json.error, "ambiguous-version");
  assert.equal(read(dir, "package.json").includes("9.9.9"), true, "nothing was written");
});

test("changelog-state: new SKILL.md files are reported", () => {
  const { dir, g } = repo("cl-skill");
  g("switch", "-q", "-c", "feature/skill");
  write(dir, "skills/new-thing/SKILL.md", "---\nname: new-thing\n---\n");
  commitAll(g, "add a skill");
  assert.deepEqual(S(dir, "state").json.addedSkills, ["skills/new-thing/SKILL.md"]);
});
