// Tests for src/web-console/strengths.mjs against the shared cases in
// scripts/fixtures/strength-cases.json (the Rust twin in models.rs loads the
// same file). Run with: node --test scripts/test-web-console-strengths.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STRENGTH_ORDER, nextStrength, resolveStrengths } from "../src/web-console/strengths.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "strength-cases.json"), "utf8"));

test("the fixture is schema 1 and covers every kind of case", () => {
  assert.equal(FIXTURE.schema, 1);
  assert.ok(FIXTURE.cases.length >= 10);
  const names = FIXTURE.cases.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, "case names are unique");
});

for (const c of FIXTURE.cases) {
  test(`resolveStrengths: ${c.name}`, () => {
    const resolved = resolveStrengths({ shipped: c.shipped, user: c.user, models: c.models, hasEffort: c.hasEffort });
    assert.deepEqual(resolved, c.expect.resolved);
  });

  test(`nextStrength: ${c.name}`, () => {
    for (const word of STRENGTH_ORDER) {
      assert.equal(nextStrength(c.expect.resolved, word), c.expect.next[word], `next after ${word}`);
    }
  });
}

test("nextStrength: an unknown word or a missing mapping has no next", () => {
  assert.equal(nextStrength({ best: { model: "x" } }, "cheap"), null);
  assert.equal(nextStrength(null, "thrifty"), null);
  assert.equal(nextStrength(undefined, "balanced"), null);
});

test("resolveStrengths: called with nothing at all resolves nothing", () => {
  assert.deepEqual(resolveStrengths(), {});
  assert.deepEqual(resolveStrengths({}), {});
});
