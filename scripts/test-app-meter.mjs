// Tests for plan2code-app/ui/meter.js. Run with: node --test scripts/test-app-meter.mjs
//
// app.js itself cannot be imported here (it touches `document` and
// `window.__TAURI__` at module scope), which is why the nudge decision lives
// in its own pure module.

import test from "node:test";
import assert from "node:assert/strict";
import { nudgeDue } from "../plan2code-app/ui/meter.js";

test("meter: a real reading at or past the threshold nudges", () => {
  assert.equal(nudgeDue({ kind: "real", percent: 70 }, 70), true);
  assert.equal(nudgeDue({ kind: "real", percent: 69 }, 70), false);
});

test("meter: a best-effort reading nudges the same as a real one", () => {
  assert.equal(nudgeDue({ kind: "besteffort", percent: 80 }, 70), true);
});

test("meter: an estimate never nudges, however high its percent", () => {
  assert.equal(nudgeDue({ kind: "estimate", percent: 99 }, 70), false);
});

test("meter: unknown never nudges", () => {
  assert.equal(nudgeDue({ kind: "unknown" }, 70), false);
});
