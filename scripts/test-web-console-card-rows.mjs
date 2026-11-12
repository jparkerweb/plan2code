// Web console tests, the dashboard's card rows: public/card-rows.js picks how
// many cards a dashboard group draws per row, so no card sits alone on a row.
// Every card in a group keeps one width; the count moves by one from what fits
// when that leaves fewer gaps; one empty corner is fine; a short last row is
// centered (at two across an empty corner is a lone card, so it counts as a
// gap there). Run with: node --test scripts/test-web-console-card-rows.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { steadyColumns } from "../src/web-console/public/card-rows.js";

// Widths are the grid's own, in px: 720, 880, 1080 and 1440 are the Card width
// presets, 358 a phone. At 240px cards and 12px gaps they fit 2, 3, 4, 5 and 1.
const CASES = [
  // count, width, cols, center, why
  [11, 880, 3, false, "3 + 3 + 3 + 2: one empty corner is fine"],
  [11, 1080, 4, false, "4 + 4 + 3: one empty corner is fine"],
  [11, 1440, 6, false, "five leave four gaps; six fit at 200px and leave one"],
  [10, 1080, 5, false, "four leave two gaps; five fit and leave none"],
  [10, 880, 2, false, "three and four both leave two gaps; two leave none"],
  [9, 1080, 5, false, "four leave three gaps; five leave one"],
  [8, 1080, 4, false, "two full rows"],
  [7, 880, 4, false, "three leave two gaps; four leave one"],
  [7, 720, 2, true, "at two across an empty corner is a lone card, so the last row is centered"],
  [6, 1440, 6, false, "five leave four gaps; six fill one row"],
  [5, 880, 3, false, "3 + 2"],
  [13, 1080, 5, true, "every count leaves two gaps or more: one more column, and the last row centered"],
  [2, 1440, 5, false, "a single short row stays as it is, never centered"],
  [2, 880, 3, false, "the Set up pair keeps today's width"],
  [5, 358, 1, false, "a phone stacks the cards"],
  [1, 880, 3, false, "one card stays one card wide"],
];

for (const [count, width, cols, center, why] of CASES) {
  test(`${count} cards at ${width}px: ${cols} across${center ? ", last row centered" : ""} (${why})`, () => {
    assert.deepEqual(steadyColumns(count, width), { cols, center });
  });
}

test("never fewer than two columns from a narrowing, and never wider than the cards allow", () => {
  // Three fit at 880; two is allowed (it fills), one never is.
  for (let count = 1; count <= 16; count++) {
    for (const width of [480, 720, 880, 1080, 1440]) {
      const { cols } = steadyColumns(count, width);
      const fit = Math.max(1, Math.floor((width + 12) / 252));
      assert.ok(cols >= Math.min(fit, 2), `${count} at ${width}: ${cols} is too few`);
      assert.ok((width + 12) / cols - 12 >= 200 || cols === 1, `${count} at ${width}: ${cols} makes cards under 200px`);
    }
  }
});

test("no layout leaves a lone card on a row unless the cards are stacked or centered", () => {
  for (let count = 2; count <= 16; count++) {
    for (const width of [720, 880, 1080, 1440]) {
      const { cols, center } = steadyColumns(count, width);
      if (count <= cols || cols === 1 || center) continue;
      assert.notEqual(count % cols, 1, `${count} at ${width}: ${cols} across leaves one card alone`);
    }
  }
});

test("a zero or missing width still answers one column", () => {
  assert.deepEqual(steadyColumns(4, 0), { cols: 1, center: false });
  assert.deepEqual(steadyColumns(0, 880), { cols: 3, center: false });
});
