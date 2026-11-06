// Tests for scripts/fix-line-endings.mjs: CRLF in the working tree goes back to LF.
// Run with: node --test scripts/test-line-endings.mjs
//
// Each test builds a throwaway git repo with this repo's .gitattributes and
// runs the script against it with --root, so the real tree is never touched.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "fix-line-endings.mjs");
const ATTRS = fs.readFileSync(path.join(HERE, "..", ".gitattributes"));

// A repo holding `files` (path to Buffer or string), none of them committed,
// and a .gitignore that ignores `ignored/`.
function repo(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-eol-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", dir]);
  fs.writeFileSync(path.join(dir, ".gitattributes"), ATTRS);
  fs.writeFileSync(path.join(dir, ".gitignore"), "ignored/\n");
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

const run = (dir, args, input) => spawnSync(process.execPath, [SCRIPT, "--root", dir, ...args], { input, encoding: "utf8" });
const bytes = (dir, rel) => fs.readFileSync(path.join(dir, rel));

// Bytes that look like CRLF text but belong to a picture.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x0d, 0x0a]);

test("--check lists every CRLF text file and changes nothing; a plain run fixes them", (t) => {
  const dir = repo(t, {
    "a.js": "one\r\ntwo\r\n",
    "src/b.md": "# Title\r\n\r\nBody\r\n",
    "ok.js": "fine\n",
    "pic.png": PNG,
    "ignored/c.js": "skip\r\n",
  });
  const check = run(dir, ["--check"]);
  assert.equal(check.status, 1);
  assert.match(check.stderr, /a\.js/);
  assert.match(check.stderr, /src\/b\.md/);
  assert.doesNotMatch(check.stderr, /ok\.js|pic\.png|ignored/);
  assert.equal(bytes(dir, "a.js").toString(), "one\r\ntwo\r\n", "check only looks");

  const fix = run(dir, []);
  assert.equal(fix.status, 0);
  assert.equal(bytes(dir, "a.js").toString(), "one\ntwo\n");
  assert.equal(bytes(dir, "src/b.md").toString(), "# Title\n\nBody\n");
  assert.deepEqual(bytes(dir, "pic.png"), PNG, "a binary file is never touched");
  assert.equal(bytes(dir, "ignored/c.js").toString(), "skip\r\n", "an ignored file is left alone");
  assert.equal(run(dir, ["--check"]).status, 0, "clean afterwards");
});

test("non-ASCII text survives the rewrite byte for byte", (t) => {
  const dir = repo(t, { "u.md": "café ★ ✨\r\n" });
  run(dir, []);
  assert.equal(bytes(dir, "u.md").toString("utf8"), "café ★ ✨\n");
});

test("--hook fixes the file a Write or Edit names, and nothing outside the repo", (t) => {
  const dir = repo(t, { "a.js": "x\r\n", "b.js": "y\r\n", "pic.png": PNG });
  const out = run(dir, ["--hook"], JSON.stringify({ tool_name: "Write", tool_input: { file_path: path.join(dir, "a.js") } }));
  assert.equal(out.status, 0);
  assert.match(out.stdout, /a\.js/);
  assert.equal(bytes(dir, "a.js").toString(), "x\n");
  assert.equal(bytes(dir, "b.js").toString(), "y\r\n", "only the named file");

  run(dir, ["--hook"], JSON.stringify({ tool_name: "Edit", tool_input: { file_path: path.join(dir, "pic.png") } }));
  assert.deepEqual(bytes(dir, "pic.png"), PNG);

  const outside = repo(t, { "z.js": "z\r\n" });
  run(dir, ["--hook"], JSON.stringify({ tool_input: { file_path: path.join(outside, "z.js") } }));
  assert.equal(bytes(outside, "z.js").toString(), "z\r\n", "a file in another folder is not ours");

  for (const input of ["", "not json", "{}"]) assert.equal(run(dir, ["--hook"], input).status, 0, `never fails the tool call (${JSON.stringify(input)})`);
});
