import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { check, normalize, workflowOf } from "./check-console-openings.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(path.dirname(HERE), "src");

// A copy of the real prompts and notes names, small enough to edit per test.
function copySrc() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-openings-"));
  for (const f of fs.readdirSync(SRC)) if (/^plan2code.*\.md$/.test(f)) fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, "web-console", "notes"), { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, "web-console", "notes"))) fs.writeFileSync(path.join(dir, "web-console", "notes", f), "");
  return dir;
}

function edit(dir, file, from, to) {
  const p = path.join(dir, file);
  const t = fs.readFileSync(p, "utf8");
  assert.ok(t.includes(from), `fixture text missing in ${file}: ${from}`);
  fs.writeFileSync(p, t.replace(from, to));
}

test("the real prompts pass", () => {
  assert.deepEqual(check(SRC), []);
});

test("a drifted shared sentence is named with its skill", () => {
  const dir = copySrc();
  edit(dir, "plan2code-review.md", "Switchable anytime.", "You can switch whenever.");
  const problems = check(dir);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /plan2code-review\.md: shared sentence "switch"/);
});

test("punctuation and case alone do not count as drift", () => {
  const dir = copySrc();
  edit(dir, "plan2code-test.md", "Switchable anytime.", "switchable anytime.");
  edit(dir, "plan2code-test.md", "Its session is already open: resume it", "Its session is already open \u2014 resume it");
  assert.deepEqual(check(dir), []);
});

test("a wrong workflow name or a missing notes file is reported", () => {
  const dir = copySrc();
  edit(dir, "plan2code-xray.md", "--workflow xray", "--workflow diagnose");
  edit(dir, "plan2code-changelog.md", "<D>/notes/changelog.md", "<D>/notes/nope.md");
  const problems = check(dir).join("\n");
  assert.match(problems, /plan2code-xray\.md.*shared sentence "run"/);
  assert.match(problems, /plan2code-xray\.md: opens --workflow diagnose instead of xray/);
  assert.match(problems, /plan2code-changelog\.md: notes file nope\.md is not in src\/web-console\/notes/);
});

test("a skill that loses its opening is caught by the count", () => {
  const dir = copySrc();
  fs.rmSync(path.join(dir, "plan2code-pr-prep.md"));
  assert.match(check(dir).join("\n"), /expected 19 skills with a console opening, found 18/);
});

test("helpers", () => {
  assert.equal(normalize("A \u2014 B: (C), D"), "a b c d");
  assert.equal(workflowOf("plan2code-1b-revise-plan"), "revise-plan");
  assert.equal(workflowOf("plan2code-3-implement-review"), "implement-review");
  assert.equal(workflowOf("plan2code-pr-prep"), "pr-prep");
  assert.equal(workflowOf("plan2code-dead-code"), "dead-code");
});

test("the CLI exits 1 on drift", () => {
  const dir = copySrc();
  edit(dir, "plan2code-git.md", "Switchable anytime.", "Whenever.");
  const r = spawnSync(process.execPath, [path.join(HERE, "check-console-openings.mjs"), dir], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /plan2code-git\.md/);
});
