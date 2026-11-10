// The spec an app's New Session carries to the fresh dashboard (spec-carry.mjs).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { takeSpecCarry, SPEC_CARRY_MAX_AGE_MS } from "../src/web-console/spec-carry.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-carry-"));
const file = path.join(dir, "spec-carry.json");
const put = (entry) => fs.writeFileSync(file, JSON.stringify(entry));
const NOW = 1_000_000_000;

test("a fresh hint for this folder is taken once", () => {
  put({ project: dir, spec: "specs/feature", at: NOW });
  assert.equal(takeSpecCarry(dir, NOW + 1000, file), "specs/feature");
  assert.equal(fs.existsSync(file), false);
  assert.equal(takeSpecCarry(dir, NOW + 1000, file), null);
});

test("a stale hint is dropped, not used", () => {
  put({ project: dir, spec: "specs/feature", at: NOW });
  assert.equal(takeSpecCarry(dir, NOW + SPEC_CARRY_MAX_AGE_MS + 1, file), null);
  assert.equal(fs.existsSync(file), false);
});

test("another folder's fresh hint stays for its own dashboard", () => {
  put({ project: path.join(dir, "elsewhere"), spec: "specs/feature", at: NOW });
  assert.equal(takeSpecCarry(dir, NOW, file), null);
  assert.equal(fs.existsSync(file), true);
});

test("a spec that is not directly under specs/ is refused", () => {
  for (const spec of ["../x", "specs/a/b", "specs/.hidden", "other", 5]) {
    put({ project: dir, spec, at: NOW });
    assert.equal(takeSpecCarry(dir, NOW, file), null, String(spec));
  }
});

test("no file, or a broken one, is no hint", () => {
  fs.rmSync(file, { force: true });
  assert.equal(takeSpecCarry(dir, NOW, file), null);
  fs.writeFileSync(file, "{nope");
  assert.equal(takeSpecCarry(dir, NOW, file), null);
});
