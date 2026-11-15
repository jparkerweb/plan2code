// Tests for the skills' scripts/changes.mjs: `start` snapshots the working tree
// through a temporary index and `diff` writes what changed since.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SKILLS, runScript, tmp, write, read, gitInit } from "./skill-script-helpers.mjs";

const SKILL = "plan2code-3-implement";
const run = (root, session, ...a) => runScript(SKILL, "changes.mjs", [...a, "--session", session, "--root", root]);

// A repository with a few committed files and a session folder beside it.
function fixture(name) {
  const root = tmp(name);
  const session = tmp(`${name}-session`);
  const g = gitInit(root);
  write(root, "a.txt", "one\ntwo\nthree\n");
  write(root, "gone.txt", "bye\nbye\n");
  write(root, "old-name.txt", "keep this\nand this\nand more of it\nand a fourth line\n");
  write(root, "src/b.js", "export const b = 1;\n");
  write(root, ".gitignore", "ignored/\n");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  return { root, session, g };
}

const state = (g) => ({ status: g("status", "--porcelain"), head: g("rev-parse", "HEAD"), branch: g("branch", "--show-current"), staged: g("diff", "--cached", "--name-only") });
const names = (diff) => [...diff.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map((m) => m[2]);

test("changes: start then diff lists exactly what changed since, and leaves the repository alone", () => {
  const { root, session, g } = fixture("changes-basic");
  // Work done before start must never show up.
  write(root, "before.txt", "earlier work\n");
  fs.appendFileSync(path.join(root, "a.txt"), "before\n");
  const before = state(g);
  const s = run(root, session, "start");
  assert.equal(s.code, 0, s.stderr);
  assert.match(s.json.tree, /^[0-9a-f]{40,64}$/);
  const startFile = JSON.parse(read(session, "changes-start.json"));
  assert.equal(startFile.tree, s.json.tree);
  assert.ok(!Number.isNaN(Date.parse(startFile.at)));
  assert.deepEqual(state(g), before, "start leaves status, HEAD, branch and the real index as they were");

  // The run's own work: modify, add, delete, rename, ignored file.
  fs.appendFileSync(path.join(root, "a.txt"), "four\n");
  write(root, "new.txt", "fresh\nfile\n");
  fs.rmSync(path.join(root, "gone.txt"));
  fs.renameSync(path.join(root, "old-name.txt"), path.join(root, "new-name.txt"));
  write(root, "ignored/x.txt", "never shown\n");
  const mid = state(g);
  const d = run(root, session, "diff");
  assert.equal(d.code, 0, d.stderr);
  assert.deepEqual(state(g), mid, "diff leaves the repository alone too");
  assert.equal(d.json.file, "changes.diff");
  assert.equal(d.json.files, 4);
  assert.equal(d.json.added, 3, "four, two new lines");
  assert.equal(d.json.removed, 2, "the two lines of gone.txt");
  assert.equal(d.json.truncated, false);
  assert.deepEqual(d.json.hidden, []);
  const diff = read(session, "changes.diff");
  assert.deepEqual(names(diff).sort(), ["a.txt", "gone.txt", "new-name.txt", "new.txt"]);
  assert.ok(!diff.includes("before.txt") && !/^[+-]before$/m.test(diff), "work done before start never appears as a change");
  assert.ok(!diff.includes("ignored"), ".gitignore'd files never appear");
  assert.match(diff, /^rename from old-name\.txt$/m);
  assert.match(diff, /^rename to new-name\.txt$/m);
  assert.match(diff, /^similarity index 100%$/m);
});

test("changes: a pure rename counts as one file, a binary file is listed with no lines", () => {
  const { root, session } = fixture("changes-binary");
  run(root, session, "start");
  fs.renameSync(path.join(root, "src", "b.js"), path.join(root, "src", "c.js"));
  fs.writeFileSync(path.join(root, "pic.bin"), Buffer.from([0, 1, 2, 3, 0, 255, 254, 0]));
  const d = run(root, session, "diff");
  assert.equal(d.code, 0, d.stderr);
  assert.equal(d.json.files, 2);
  assert.equal(d.json.added, 0, "binary adds nothing and a pure rename adds nothing");
  assert.equal(d.json.removed, 0);
  assert.ok(Number.isFinite(d.json.added) && Number.isFinite(d.json.removed), "never NaN");
  const diff = read(session, "changes.diff");
  assert.match(diff, /^Binary files .*pic\.bin differ$/m);
  assert.ok(!/^@@/m.test(diff), "no hunks at all");
  assert.match(diff, /^rename from src\/b\.js$/m);
});

test("changes: no changes is an empty file, not an error", () => {
  const { root, session } = fixture("changes-empty");
  run(root, session, "start");
  const d = run(root, session, "diff");
  assert.equal(d.code, 0, d.stderr);
  assert.deepEqual({ files: d.json.files, added: d.json.added, removed: d.json.removed, truncated: d.json.truncated }, { files: 0, added: 0, removed: 0, truncated: false });
  assert.equal(read(session, "changes.diff"), "");
});

test("changes: a patch over the cap is cut at a file boundary, every file still named", () => {
  const { root, session } = fixture("changes-cap");
  run(root, session, "start");
  for (const n of ["f1", "f2", "f3"]) write(root, `${n}.txt`, `${n} line\n`.repeat(200));
  const d = run(root, session, "diff", "--cap", "1000");
  assert.equal(d.code, 0, d.stderr);
  assert.equal(d.json.truncated, true);
  assert.equal(d.json.files, 3);
  assert.equal(d.json.added, 600, "counts cover the whole change, not the cut patch");
  const diff = read(session, "changes.diff");
  assert.deepEqual(names(diff).sort(), ["f1.txt", "f2.txt", "f3.txt"]);
  assert.match(diff, /^\\ No more lines shown: this change is too large to show in full\.$/m);
  assert.match(diff, /^# truncated: true$/m);
  assert.ok(diff.length < 1500, "the big first file shows no lines of itself");
  assert.ok(!diff.includes("f1 line"));
  const bad = run(root, session, "diff", "--cap", "0");
  assert.equal(bad.code, 2);
});

test("changes: capPatch keeps whole files that fit and cuts the rest to their headers", async () => {
  const { capPatch } = await import(pathToFileURL(path.join(SKILLS, SKILL, "scripts", "changes.mjs")).href);
  const small = "diff --git a/s b/s\n--- a/s\n+++ b/s\n@@ -1 +1 @@\n-a\n+b\n";
  const big = "diff --git a/big b/big\nrename from x\nrename to big\n--- a/x\n+++ b/big\n@@ -1 +1 @@\n" + "+line\n".repeat(500);
  const patch = small + big;
  const fit = capPatch(patch, patch.length);
  assert.deepEqual(fit, { patch, truncated: false });
  const cut = capPatch(patch, 600);
  assert.equal(cut.truncated, true);
  assert.ok(cut.patch.startsWith(small), "the first file stays whole");
  assert.ok(cut.patch.endsWith("diff --git a/big b/big\nrename from x\nrename to big\n"), "the cut file keeps its name and rename lines");
  assert.ok(!cut.patch.includes("+line"));
  assert.ok(cut.patch.includes("No more lines shown"));
  const first = capPatch(patch, 100);
  assert.ok(!first.patch.includes("@@"), "a first file over the cap shows no lines");
  assert.ok(first.patch.includes("diff --git a/s b/s") && first.patch.includes("diff --git a/big b/big"));
});

test("changes: a sensitive file shows its name and counts but no lines", () => {
  const { root, session } = fixture("changes-secret");
  run(root, session, "start");
  write(root, ".env", "API_KEY=hunter2\nOTHER=1\n");
  write(root, "ok.txt", "fine\n");
  const d = run(root, session, "diff");
  assert.equal(d.code, 0, d.stderr);
  assert.equal(d.json.files, 2);
  assert.equal(d.json.added, 3, "the hidden file's lines still count");
  assert.deepEqual(d.json.hidden, [".env"]);
  const diff = read(session, "changes.diff");
  assert.ok(!diff.includes("hunter2") && !diff.includes("OTHER=1"));
  assert.match(diff, /^diff --git a\/\.env b\/\.env$/m);
  assert.match(diff, /^Lines hidden: this file may hold a secret\.$/m);
  assert.match(diff, /^# hidden: \.env$/m);
  assert.match(diff, /^# counts: 2\t0\t\.env$/m, "a hidden file's counts travel in the trailer");
  assert.match(diff, /^\+fine$/m, "other files keep their lines");
});

test("changes: failures are plain exit 3s, bad arguments exit 2", () => {
  const { root, session } = fixture("changes-fail");
  const noStart = run(root, session, "diff");
  assert.equal(noStart.code, 3);
  assert.equal(noStart.json.error, "no-start");
  assert.ok(noStart.json.message && noStart.json.next);

  const notRepo = tmp("changes-norepo");
  const sess2 = tmp("changes-norepo-session");
  for (const cmd of ["start", "diff"]) {
    if (cmd === "diff") write(sess2, "changes-start.json", JSON.stringify({ tree: "a".repeat(40), at: "x" }));
    const r = run(notRepo, sess2, cmd);
    assert.equal(r.code, 3, `${cmd}: ${r.stderr}`);
    assert.equal(r.json.error, "not-a-repo");
    assert.ok(r.json.next);
  }

  write(session, "changes-start.json", JSON.stringify({ tree: "b".repeat(40), at: "x" }));
  const gone = run(root, session, "diff");
  assert.equal(gone.code, 3);
  assert.equal(gone.json.error, "start-missing");

  const usage = runScript(SKILL, "changes.mjs", ["start", "--root", root]);
  assert.equal(usage.code, 2, "--session is required");
  assert.equal(runScript(SKILL, "changes.mjs", ["nope", "--session", session]).code, 2);
});

test("changes: start twice overwrites the snapshot", () => {
  const { root, session } = fixture("changes-twice");
  const a = run(root, session, "start");
  fs.appendFileSync(path.join(root, "a.txt"), "first run work\n");
  const b = run(root, session, "start");
  assert.notEqual(a.json.tree, b.json.tree);
  assert.equal(JSON.parse(read(session, "changes-start.json")).tree, b.json.tree);
  fs.appendFileSync(path.join(root, "a.txt"), "second run work\n");
  const d = run(root, session, "diff");
  const diff = read(session, "changes.diff");
  assert.equal(d.json.files, 1);
  assert.match(diff, /^[+]second run work$/m);
  assert.ok(!/^[+-]first run work$/m.test(diff), "work before the second start is context at most, never a change");
});

test("changes: hiding holds for a spaced name, a sensitive rename, diff.noprefix and a cap", () => {
  const { root, session, g } = fixture("changes-secret-hard");
  write(root, "old.pem", "OLDSECRET1\nOLDSECRET2\nOLDSECRET3\nOLDSECRET4\n");
  g("add", "-A");
  g("commit", "-q", "-m", "pem");
  g("config", "diff.noprefix", "true");
  run(root, session, "start");
  write(root, "my cert.pem", "SPACEDSECRET\n");
  fs.renameSync(path.join(root, "old.pem"), path.join(root, "renamed.txt"));
  write(root, "plain.txt", "visible\n".repeat(800));
  const d = run(root, session, "diff", "--cap", "3000");
  assert.equal(d.code, 0, d.stderr);
  const diff = read(session, "changes.diff");
  for (const secret of ["SPACEDSECRET", "OLDSECRET"]) assert.ok(!diff.includes(secret), `${secret} must not appear`);
  assert.ok(d.json.hidden.includes("my cert.pem"), JSON.stringify(d.json.hidden));
  assert.ok(d.json.hidden.includes("old.pem"), "a rename out of a sensitive name is hidden");
  assert.equal(d.json.files, 3);
  assert.equal(d.json.truncated, true, "the visible file is cut by the cap");
  assert.match(diff, /^# hidden: my cert\.pem$/m);
});
