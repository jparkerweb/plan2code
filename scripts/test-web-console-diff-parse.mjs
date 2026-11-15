// Web console tests, the Changes tab's parser: public/diff-parse.js reads the
// unified diff changes.mjs writes into files, hunks and numbered lines, and
// never throws on text it cannot read. Run with:
// node --test scripts/test-web-console-diff-parse.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { parseDiff, HIDDEN_LINE, TOO_LARGE_LINE } from "../src/web-console/public/diff-parse.js";

const one = (text) => {
  const r = parseDiff(text);
  assert.equal(r.bad, undefined, "read as a diff");
  assert.equal(r.files.length, 1);
  return r.files[0];
};
const shape = (lines) => lines.map((l) => [l.kind, l.oldNo, l.newNo, l.text]);

test("a modified file with two hunks numbers every line from its hunk header", () => {
  const f = one(
    [
      "diff --git a/src/app.js b/src/app.js",
      "index 1111111..2222222 100644",
      "--- a/src/app.js",
      "+++ b/src/app.js",
      "@@ -3,3 +3,4 @@ function start() {",
      " one",
      "-two",
      "+TWO",
      "+two and a half",
      " three",
      "@@ -20,2 +21,1 @@",
      "-gone",
      " kept",
      "",
    ].join("\n")
  );
  assert.equal(f.path, "src/app.js");
  assert.equal(f.oldPath, null, "only a rename names an old path");
  assert.equal(f.status, "modified");
  assert.equal(f.added, 2);
  assert.equal(f.removed, 2);
  assert.equal(f.hunks.length, 2);
  assert.equal(f.hunks[0].header, "@@ -3,3 +3,4 @@ function start() {");
  assert.deepEqual(shape(f.hunks[0].lines), [
    ["ctx", 3, 3, "one"],
    ["del", 4, null, "two"],
    ["add", null, 4, "TWO"],
    ["add", null, 5, "two and a half"],
    ["ctx", 5, 6, "three"],
  ]);
  assert.deepEqual(shape(f.hunks[1].lines), [
    ["del", 20, null, "gone"],
    ["ctx", 21, 21, "kept"],
  ]);
});

test("an added file and a deleted file", () => {
  const r = parseDiff(
    [
      "diff --git a/new.txt b/new.txt",
      "new file mode 100644",
      "index 0000000..3333333",
      "--- /dev/null",
      "+++ b/new.txt",
      "@@ -0,0 +1,2 @@",
      "+hello",
      "+world",
      "diff --git a/old.txt b/old.txt",
      "deleted file mode 100644",
      "index 4444444..0000000",
      "--- a/old.txt",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-bye",
      "",
    ].join("\n")
  );
  assert.equal(r.files.length, 2);
  const [added, deleted] = r.files;
  assert.equal(added.status, "added");
  assert.equal(added.path, "new.txt");
  assert.deepEqual([added.added, added.removed], [2, 0]);
  assert.deepEqual(shape(added.hunks[0].lines), [
    ["add", null, 1, "hello"],
    ["add", null, 2, "world"],
  ]);
  assert.equal(deleted.status, "deleted");
  assert.equal(deleted.path, "old.txt", "a deleted file keeps its own name");
  assert.deepEqual([deleted.added, deleted.removed], [0, 1]);
  assert.deepEqual(shape(deleted.hunks[0].lines), [["del", 1, null, "bye"]]);
});

test("a pure rename and a rename with edits", () => {
  const r = parseDiff(
    [
      "diff --git a/a/old name.md b/b/new name.md",
      "similarity index 100%",
      "rename from a/old name.md",
      "rename to b/new name.md",
      "diff --git a/lib/x.js b/lib/y.js",
      "similarity index 80%",
      "rename from lib/x.js",
      "rename to lib/y.js",
      "index 5555555..6666666 100644",
      "--- a/lib/x.js",
      "+++ b/lib/y.js",
      "@@ -1,2 +1,2 @@",
      "-const x = 1;",
      "+const y = 1;",
      " export {};",
      "",
    ].join("\n")
  );
  assert.equal(r.files.length, 2);
  const [pure, edited] = r.files;
  assert.equal(pure.status, "renamed");
  assert.equal(pure.oldPath, "a/old name.md");
  assert.equal(pure.path, "b/new name.md");
  assert.equal(pure.hunks.length, 0);
  assert.deepEqual([pure.added, pure.removed], [0, 0]);
  assert.equal(edited.status, "renamed");
  assert.equal(edited.oldPath, "lib/x.js");
  assert.equal(edited.path, "lib/y.js");
  assert.deepEqual([edited.added, edited.removed], [1, 1]);
});

test("a binary file and a hidden file show no lines", () => {
  const r = parseDiff(
    [
      "diff --git a/logo.png b/logo.png",
      "index 7777777..8888888 100644",
      "Binary files a/logo.png and b/logo.png differ",
      "diff --git a/.env b/.env",
      "index 9999999..aaaaaaa 100644",
      HIDDEN_LINE,
      "# hidden: .env",
      "",
    ].join("\n")
  );
  assert.equal(r.files.length, 2);
  const [bin, secret] = r.files;
  assert.equal(bin.binary, true);
  assert.equal(bin.hunks.length, 0);
  assert.equal(secret.path, ".env");
  assert.equal(secret.hidden, true);
  assert.equal(secret.hunks.length, 0);
  assert.equal(secret.truncated, false);
});

test("a hidden file takes its counts from the trailer", () => {
  const r = parseDiff(
    ["diff --git a/.env b/.env", "new file mode 100644", HIDDEN_LINE, "# hidden: .env", "# counts: 40\t3\t.env", ""].join("\n")
  );
  assert.equal(r.files.length, 1);
  assert.equal(r.files[0].added, 40);
  assert.equal(r.files[0].removed, 3);
});

test("a truncated set: the files after the too-large line hold only a header", () => {
  const r = parseDiff(
    [
      "diff --git a/kept.txt b/kept.txt",
      "--- a/kept.txt",
      "+++ b/kept.txt",
      "@@ -1 +1 @@",
      "-a",
      "+b",
      TOO_LARGE_LINE,
      "diff --git a/big.txt b/big.txt",
      "diff --git a/moved.txt b/there.txt",
      "rename from moved.txt",
      "rename to there.txt",
      "# truncated: true",
      "",
    ].join("\n")
  );
  assert.equal(r.tooLarge, true);
  assert.equal(r.files.length, 3);
  assert.equal(r.files[0].truncated, false);
  assert.deepEqual(shape(r.files[0].hunks[0].lines), [
    ["del", 1, null, "a"],
    ["add", null, 1, "b"],
  ]);
  assert.equal(r.files[1].truncated, true);
  assert.equal(r.files[1].path, "big.txt");
  assert.equal(r.files[2].truncated, true);
  assert.equal(r.files[2].status, "renamed");
  assert.equal(r.files[2].path, "there.txt");
});

test("a change set too big to print: every name first, the too-large line last, each file listed only", () => {
  const r = parseDiff(
    [
      "diff --git a/a.txt b/a.txt",
      "diff --git a/old.txt b/new.txt",
      "rename from old.txt",
      "rename to new.txt",
      "diff --git a/.env b/.env",
      HIDDEN_LINE,
      TOO_LARGE_LINE,
      "# truncated: true",
      "# hidden: .env",
      "",
    ].join("\n")
  );
  assert.equal(r.tooLarge, true);
  assert.deepEqual(
    r.files.map((f) => [f.path, f.truncated, f.hidden]),
    [
      ["a.txt", true, false],
      ["new.txt", true, false],
      [".env", false, true],
    ]
  );
  assert.equal("afterCut" in r.files[0], false, "no working field leaks out");
});

test("a line starting +++ or --- inside a hunk stays a changed line", () => {
  const f = one(
    [
      "diff --git a/notes.md b/notes.md",
      "--- a/notes.md",
      "+++ b/notes.md",
      "@@ -1,2 +1,2 @@",
      "--- a rule",
      "+++ a plus rule",
      " same",
      "",
    ].join("\n")
  );
  assert.equal(f.path, "notes.md");
  assert.deepEqual(shape(f.hunks[0].lines), [
    ["del", 1, null, "-- a rule"],
    ["add", null, 1, "++ a plus rule"],
    ["ctx", 2, 2, "same"],
  ]);
});

test("a file with no newline at its end keeps the marker as a meta line", () => {
  const f = one(
    [
      "diff --git a/end.txt b/end.txt",
      "--- a/end.txt",
      "+++ b/end.txt",
      "@@ -1 +1 @@",
      "-old",
      "\\ No newline at end of file",
      "+new",
      "\\ No newline at end of file",
      "",
    ].join("\n")
  );
  assert.deepEqual(shape(f.hunks[0].lines), [
    ["del", 1, null, "old"],
    ["meta", null, null, "\\ No newline at end of file"],
    ["add", null, 1, "new"],
    ["meta", null, null, "\\ No newline at end of file"],
  ]);
  assert.deepEqual([f.added, f.removed], [1, 1], "the marker is not counted");
});

test("paths with spaces and quoted paths", () => {
  const r = parseDiff(
    [
      "diff --git a/with space.txt b/with space.txt",
      "--- a/with space.txt\t",
      "+++ b/with space.txt\t",
      "@@ -1 +1,2 @@",
      " a",
      "+b",
      'diff --git "a/say \\"hi\\".txt" "b/say \\"hi\\".txt"',
      '--- "a/say \\"hi\\".txt"',
      '+++ "b/say \\"hi\\".txt"',
      "@@ -1 +1 @@",
      "-x",
      "+y",
      'diff --git "a/caf\\303\\251 tab\\t.txt" "b/caf\\303\\251 tab\\t.txt"',
      "new file mode 100644",
      "",
    ].join("\n")
  );
  assert.deepEqual(
    r.files.map((f) => f.path),
    ["with space.txt", 'say "hi".txt', "café tab\t.txt"]
  );
  assert.equal(r.files[0].added, 1);
});

test("an empty string is no files, and garbage never throws", () => {
  assert.deepEqual(parseDiff(""), { files: [], tooLarge: false });
  for (const junk of ["hello there\nthis is not a diff\n", "@@ -1 +1 @@\n+x\n", "diff --git nonsense", "\u0000\u0001", "   \n"]) {
    const r = parseDiff(junk);
    assert.deepEqual(r.files, [], junk);
    assert.equal(r.tooLarge, false);
  }
  assert.equal(parseDiff("hello there\nthis is not a diff\n").bad, true);
  assert.equal(parseDiff("diff --git nonsense").bad, true);
  assert.equal(parseDiff("   \n").bad, undefined, "blank text is an empty diff");
  assert.equal(parseDiff(undefined).bad, true);
  assert.equal(parseDiff(null).bad, true);
});
