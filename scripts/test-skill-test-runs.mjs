// Skill text for targeted test runs: the wording that tells Plan, Pathfinder,
// Document and the build skills which tests to run and who asks about them.
// Run with: node --test scripts/test-skill-test-runs.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (...p) => fs.readFileSync(path.join(ROOT, "src", ...p), "utf8");

test("Plan offers the cadence and full-suite answers and checks old drafts for them", () => {
  const plan = src("plan2code-1-plan.md");
  assert.match(plan, /Phase testing\*\*: Targeted per phase.*Dedicated phase only.*None/);
  assert.match(plan, /Full suite\*\*: Offered at Finalize.*At Phase N.*Never/);
  assert.match(plan, /Before going on with any existing draft.*Deferred to Plan.*Not discussed.*Full Suite/, "the progress check names a deferred, empty or undiscussed 2.4");
  assert.match(plan, /skip testing' writes `None` and `Never`/);
  assert.match(plan, /Full Suite/, "2.4 carries a Full Suite row");
});

test("Pathfinder hands testing to Plan and no longer gates on it", () => {
  const dir = path.join(ROOT, "src");
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.startsWith("plan2code-0-pathfinder")) continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      for (const f of fs.readdirSync(full)) if (f.endsWith(".md")) files.push(path.join(full, f));
    } else if (entry.endsWith(".md")) files.push(full);
  }
  assert.ok(files.length > 3, "found the Pathfinder prompts");
  assert.ok(src("plan2code-0-pathfinder-references", "handoff.md").includes("Deferred to Plan"), "the handoff writes Deferred to Plan");
  for (const f of files) {
    if (path.basename(f) === "handoff.md") continue;
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /testing posture|Run after each phase/i, `${path.basename(f)} asks no testing question`);
  }
  assert.ok(!src("plan2code-0-pathfinder-scripts", "pathfinder.mjs").includes("CADENCE_RE"), "the gate has no testing cap");
});

test("Document writes Targeted, Quick checks and Full suite lines and reads test-runs.md", () => {
  const doc = src("plan2code-2-document.md");
  for (const line of ["Targeted:", "Quick checks:", "Full suite:", "test-runs.md"]) assert.ok(doc.includes(line), `Document names ${line}`);
  assert.match(doc, /only to the phase named by "At Phase N"/);
  assert.match(doc, /no Full Suite row: ask/);
});

test("test-runs.md ships in the seven skills that run, write or offer tests, and in no other", () => {
  // npm test has just built skills/; a direct run builds it so the check never reads a stale tree.
  if (process.env.npm_lifecycle_event !== "test") {
    execFileSync(process.execPath, [path.join(ROOT, "install.js"), "--build-skills"], { stdio: "ignore" });
  }
  const built = path.join(ROOT, "skills");
  const having = fs.readdirSync(built).filter((dir) => fs.existsSync(path.join(built, dir, "references", "test-runs.md")));
  assert.deepEqual(having.sort(), [
    "plan2code-2-document",
    "plan2code-3-implement",
    "plan2code-3-implement-review",
    "plan2code-4-finalize",
    "plan2code-pr-prep",
    "plan2code-quick-task",
    "plan2code-review",
  ]);
});

test("test-runs.md names no runner as the default and asks when unsure", () => {
  const rule = src("shared-references", "test-runs.md");
  assert.match(rule, /Ask when unsure/);
  assert.doesNotMatch(rule.replace(/`npm test`/g, ""), /\b(jest|vitest|pytest|mocha|cargo test)\b/i);
  assert.ok(rule.length < 3200, "the shared rule stays short");
});

test("Implement and Implement + Review say the same targeted rule", () => {
  const impl = src("plan2code-3-implement.md");
  const both = src("plan2code-3-implement-review.md");
  for (const text of [impl, both]) {
    assert.match(text, /after each task (run )?the tests covering what it touched/);
    assert.match(text, /the phase file's `## Phase Testing` lines plus tests for any other file the phase changed/);
    assert.match(text, /never the full suite unless the phase file lists a `Full suite:` line/);
    assert.match(text, /Read `references\/test-runs\.md` before the first test run of a phase/);
  }
  assert.doesNotMatch(impl, /Run tests ONLY if/);
  assert.doesNotMatch(both, /explicitly listed as a phase task/);
});

test("Implement's sign-off offers a wider run for shared ground and asks when unsure", () => {
  const impl = src("plan2code-3-implement.md");
  assert.match(impl, /changed shared ground the plan did not foresee/);
  assert.match(impl, /offer the full suite or a wider set as a choice beside approval/);
  assert.match(impl, /Unsure whether it is shared ground\? Ask\./);
  assert.match(src("web-console", "building.md"), /\| Shared ground touched \| `choice` \|/);
});

test("Quick Task and Review name the tests covering the changed files", () => {
  const quick = src("plan2code-quick-task.md");
  assert.match(quick, /\[Targeted: the command and the tests covering the changed files\]/);
  assert.ok(quick.includes("**Write the test first?**"), "the test-first question stays");
  assert.ok(quick.includes("references/test-runs.md"), "Quick Task reads the shared rule");
  assert.match(src("plan2code-review.md"), /\*\*Verify\*\* -- build and run the tests covering the fixed files \(per `references\/test-runs\.md`/);
});

test("Finalize offers the full suite, skips it for Never and records the four outcomes", () => {
  const fin = src("plan2code-4-finalize.md");
  assert.ok(fin.includes("Run the full suite now?"), "Finalize asks the question");
  assert.match(fin, /`Never`: skip the offer; record `not planned`/);
  assert.ok(fin.includes("references/test-runs.md"), "Finalize reads the shared rule");
  assert.match(fin, /Never forced/);
  for (const outcome of ["passed", "failed (N)", "skipped (your choice)", "not planned"]) {
    assert.ok(fin.includes(outcome), `Finalize records ${outcome}`);
  }
  assert.match(fin, /Full suite: \[passed \/ failed \(N\) \/ skipped \(your choice\) \/ not planned\]/, "the summary template carries the line");
  assert.doesNotMatch(fin, /Test Validation \(if defined\)/);
  const notes = src("web-console", "notes", "finalize.md");
  assert.match(notes, /`confirm` "Run the full suite" \(`yesLabel` "Run it", `noLabel` "Skip it"/);
  assert.match(notes, /a failure is the building notes' `choice`/);
});

test("test-runs.md says to ask when a check or its tests are unclear", () => {
  const rule = src("shared-references", "test-runs.md");
  assert.match(rule, /which tests cover a file, ask the person\. Never guess/);
});

test("Init and Init-update keep a test map beside the single-test command", () => {
  const init = src("plan2code-init.md");
  assert.match(init, /run single test \(and beside it a note of which checks are quick\)/);
  assert.ok(init.includes("## Test map"), "Init names the ## Test map section");
  assert.match(init, /test-commands\.mjs" discover/);
  assert.match(init, /write it only on a yes with `test-map\.mjs write --rows <file>`/);
  assert.doesNotMatch(init, /area -> tests or command/, "the old line format is gone");
  const upd = src("plan2code-init-update.md");
  assert.match(upd, /\*\*4\. Testing\*\* - .*the `## Test map` table and quick checks/);
  assert.match(upd, /\| Testing \| Commands\? Test map `Paths` still match real files and `Run` commands still exist \(`test-map\.mjs read` problems, `test-commands\.mjs discover`\)\?/);
  assert.match(upd, /written only on a yes through `test-map\.mjs write`/);
});

test("test-runs.md reads the ## Test map table and treats Shared rows as shared ground", () => {
  const rule = src("shared-references", "test-runs.md");
  assert.ok(rule.includes("`## Test map`"), "names the ## Test map table");
  assert.ok(rule.includes("`Shared: yes`"), "a Shared: yes row is shared ground");
});
