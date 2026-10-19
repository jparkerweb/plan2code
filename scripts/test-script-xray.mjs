// Tests for plan2code-xray's scripts/xray.mjs.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runScript, tmp, write, gitInit } from "./skill-script-helpers.mjs";

const X = (cwd, args, env) => runScript("plan2code-xray", "xray.mjs", args, { cwd, env });

// One fixture for the file: a.js and b.js always change together, hot.js
// changes in most commits and has no test, the others are tested, and
// old1.js and old2.js changed together before they were deleted.
let fixture;
function repo() {
  if (fixture) return fixture;
  const dir = tmp("xray");
  const g = gitInit(dir);
  const commit = (msg, files) => {
    for (const [rel, content] of Object.entries(files)) write(dir, rel, content);
    g("add", "-A");
    g("commit", "-q", "-m", msg);
  };
  commit("Start", { "a.js": "a1\n", "b.js": "b1\n", "hot.js": "h1\n", "c.js": "c1\n", "tests/a.test.js": "t\n", "tests/b.test.js": "t\n", "tests/c.test.js": "t\n" });
  commit("Change a and b (#12)", { "a.js": "a2\n", "b.js": "b2\n", "hot.js": "h2\n", "package-lock.json": "{}\n" });
  commit("Change a and b again", { "a.js": "a3\n", "b.js": "b3\n", "hot.js": "h3\n", "package-lock.json": "{ }\n" });
  commit("Change hot and c", { "hot.js": "h4\nmore\n", "c.js": "c2\n" });
  commit("Change hot alone", { "hot.js": "h5\nmore\n", "dist/out.js": "x\n" });
  // Without hot.js, so a-b (support 1) outranks a-hot and b-hot on support, not on name.
  commit("Change a and b only", { "a.js": "a4\n", "b.js": "b4\n" });
  for (let i = 1; i <= 3; i++) commit(`Change the old pair ${i}`, { "old1.js": `o${i}\n`, "old2.js": `p${i}\n` });
  g("rm", "-q", "old1.js", "old2.js");
  g("commit", "-q", "-m", "Delete the old pair");
  fixture = dir;
  return dir;
}

// PATH with git (and node) but no gh: git's own exec dir holds a git binary
// on every platform, so the directory that also holds gh is never needed.
function pathWithoutGh() {
  const gitDir = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
  const dirs = [path.resolve(gitDir)];
  const nodeDir = path.dirname(process.execPath);
  const hasGh = ["gh", "gh.exe"].some((n) => fs.existsSync(path.join(nodeDir, n)));
  if (!hasGh) dirs.push(nodeDir);
  const value = dirs.join(path.delimiter);
  // Windows keys env case-insensitively but a child gets both spellings: set both.
  return { PATH: value, Path: value };
}

test("xray hotspots: the always-together pair ranks first, the hot file without a test is listed", () => {
  const r = X(repo(), ["hotspots"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.window, { commits: 10, capped: false });
  assert.deepEqual(r.json.churn[0], { file: "hot.js", commits: 5 });
  assert.ok(!r.json.churn.some((c) => c.file === "package-lock.json" || c.file.startsWith("dist/")), "lockfiles and dist/ are skipped");
  assert.deepEqual(r.json.pairs[0], { a: "a.js", b: "b.js", together: 4, support: 1 });
  assert.ok(r.json.pairs[1].support < 1, JSON.stringify(r.json.pairs));
  assert.ok(r.json.pairs.every((p) => p.together >= 3));
  const untested = r.json.untested.map((u) => u.file);
  assert.ok(untested.includes("hot.js"), JSON.stringify(r.json.untested));
  for (const tested of ["a.js", "b.js", "c.js"]) assert.ok(!untested.includes(tested), `${tested} has a test`);
});

test("xray hotspots: files deleted since drop out of churn and pairs", () => {
  const r = X(repo(), ["hotspots"]);
  assert.equal(r.code, 0, r.stderr);
  const named = [...r.json.churn.map((c) => c.file), ...r.json.pairs.flatMap((p) => [p.a, p.b])];
  assert.ok(!named.some((f) => f.startsWith("old")), JSON.stringify(named));
});

test("xray hotspots: --max-commits below the history sets capped", () => {
  const r = X(repo(), ["hotspots", "--max-commits", "2"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.window, { commits: 2, capped: true });
  assert.equal(X(repo(), ["hotspots", "--top", "1"]).json.churn.length, 1);
});

test("xray history: commits, blame and gh missing when gh is not on PATH", () => {
  const r = X(repo(), ["history", "hot.js"], pathWithoutGh());
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.path, "hot.js");
  assert.equal(r.json.commits.length, 5);
  assert.equal(r.json.commits[0].subject, "Change hot alone");
  assert.equal(r.json.commits[0].author, "Test");
  assert.match(r.json.commits[0].hash, /^[0-9a-f]{40}$/);
  assert.equal(r.json.blame.lines, 2);
  assert.deepEqual(r.json.blame.authors, [{ author: "Test", lines: 2, share: 1 }]);
  assert.match(r.json.blame.oldest, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(r.json.prs, [{ number: 12, subject: "Change a and b (#12)", title: null, summary: null }]);
  assert.deepEqual(r.json.sources, { git: true, blame: true, gh: "missing" });
});

test("xray: a folder outside any repository is exit 3 not-a-repo", () => {
  const plain = tmp("xray-plain");
  for (const args of [["hotspots"], ["history", "x.js"]]) {
    const r = X(plain, args);
    assert.equal(r.code, 3);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error, "not-a-repo");
    assert.match(r.json.next, /explain mode/);
  }
});

test("xray: --help documents the exit codes", () => {
  const r = X(repo(), ["--help"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Exit:/);
});
