import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { oversize, DEFAULT_LIMIT } from "./check-doc-size.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "check-doc-size.mjs");

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function fixture(sizes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docsize-"));
  made.push(dir);
  for (const [name, n] of Object.entries(sizes)) fs.writeFileSync(path.join(dir, name), "x".repeat(n));
  return dir;
}
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

test("files within the limit pass, and a file exactly at it passes", () => {
  const dir = fixture({ "a.md": 10, "b.md": 100 });
  const r = run(dir, "100");
  assert.equal(r.status, 0, r.stderr);
});

test("a file over the limit fails and is named with its size", () => {
  const dir = fixture({ "a.md": 10, "big.md": 101 });
  const r = run(dir, "100");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /big\.md: 101 bytes/);
  assert.doesNotMatch(r.stderr, /a\.md/);
});

test("only .md files count", () => {
  const dir = fixture({ "a.md": 10, "notes.txt": 5000 });
  assert.deepEqual(oversize(dir, 100), []);
});

test("a bad limit is refused", () => {
  const dir = fixture({ "a.md": 1 });
  assert.equal(run(dir, "nope").status, 2);
});

test("every file in .agents-docs/ is within the default limit", () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(DEFAULT_LIMIT, 60000);
});
