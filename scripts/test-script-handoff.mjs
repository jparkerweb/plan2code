// Tests for plan2code-handoff's scripts/handoff-path.mjs.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, SKILLS, NOW, runScript, tmp, write, read, gitInit, phase } from "./skill-script-helpers.mjs";

/* =========================================================== handoff-path.mjs */

test("handoff-path: timestamped name, no overwrite, git ignore check", () => {
  const repo = tmp("handoff");
  gitInit(repo);
  const H = (...a) => runScript("plan2code-handoff", "handoff-path.mjs", a, { cwd: repo });
  const first = H("--dir", "handoffs");
  assert.equal(first.code, 0, first.stderr);
  assert.equal(path.basename(first.json.path), "2026-08-03-1405-handoff.md");
  assert.equal(first.json.created, true);
  assert.equal(first.json.git.inRepo, true);
  assert.equal(first.json.git.ignored, false);
  assert.match(first.json.warning, /handoffs\//);
  fs.writeFileSync(first.json.path, "x");
  assert.equal(path.basename(H("--dir", "handoffs").json.path), "2026-08-03-1405-2-handoff.md");
  write(repo, ".gitignore", "handoffs/\n");
  assert.equal(H("--dir", "handoffs").json.git.ignored, true);
  const temp = H();
  assert.equal(temp.json.git.inRepo, false);
  assert.equal(temp.json.git.ignored, null);
  const dry = runScript("plan2code-handoff", "handoff-path.mjs", ["--dir", "later", "--dry-run"], { cwd: repo });
  assert.equal(dry.json.created, false);
  assert.ok(!fs.existsSync(path.join(repo, "later")));
});

/* ================================================= verification regressions */

test("handoff-path: the repo root itself is never the line to ignore", () => {
  const repo = tmp("handoff2");
  gitInit(repo);
  const j = runScript("plan2code-handoff", "handoff-path.mjs", ["--dir", "."], { cwd: repo }).json;
  assert.equal(j.git.inRepo, true);
  assert.equal(j.git.ignoreLine, "*-handoff.md");
});

test("handoff-path: --dir naming an existing file is refused", () => {
  const repo = tmp("handoff3");
  write(repo, "notes.txt", "x");
  const r = runScript("plan2code-handoff", "handoff-path.mjs", ["--dir", "notes.txt"], { cwd: repo });
  assert.equal(r.code, 5);
  assert.equal(r.json.ok, false);
  assert.equal(r.json.error, "not-a-folder");
  assert.match(r.json.next, /--dir temp/);
  assert.equal(runScript("plan2code-handoff", "handoff-path.mjs", ["--dir", "notes.txt", "--dry-run"], { cwd: repo }).code, 5, "dry-run refuses it too");
});
