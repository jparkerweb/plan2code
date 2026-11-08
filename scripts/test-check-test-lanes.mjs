import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-test-lanes.mjs");

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function fixture(files, lanes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanes-"));
  made.push(dir);
  for (const f of files) fs.writeFileSync(path.join(dir, f), "");
  fs.writeFileSync(path.join(dir, "test-lanes.json"), JSON.stringify(lanes));
  return dir;
}
const run = (dir) => spawnSync(process.execPath, [script, dir], { encoding: "utf8" });

test("a complete fixture passes", () => {
  const dir = fixture(["test-a.mjs", "test-b.mjs"], { fast: ["test-a.mjs"], skipFast: ["test-b.mjs"] });
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
});

test("an unlisted file fails and is named", () => {
  const dir = fixture(["test-a.mjs", "test-b.mjs"], { fast: ["test-a.mjs"], skipFast: [] });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /test-b\.mjs/);
});

test("a doubly listed file fails and is named", () => {
  const dir = fixture(["test-a.mjs"], { fast: ["test-a.mjs"], skipFast: ["test-a.mjs"] });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /In both lists: test-a\.mjs/);
});

test("a dangling name fails and is named", () => {
  const dir = fixture(["test-a.mjs"], { fast: ["test-a.mjs"], skipFast: ["test-gone.mjs"] });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not on disk: test-gone\.mjs/);
});

test("a name repeated inside one list fails and is named", () => {
  const dir = fixture(["test-a.mjs"], { fast: ["test-a.mjs", "test-a.mjs"], skipFast: [] });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Listed twice in one list: test-a.mjs/);
});
