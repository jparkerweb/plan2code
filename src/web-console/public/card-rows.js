/* card-rows.js: How many cards a dashboard group draws per row, so no card sits
   alone on a row. Pure: the dashboard measures, this decides. */

// The card sizes the grid used before: as many 240px cards as fit, 12px apart.
// One more column is allowed while the cards stay at least 200px wide.
const CARD = 240;
const TIGHT = 200;
const GAP = 12;

// The empty spots the last row leaves at `cols` across.
const gapsAt = (count, cols) => (cols - (count % cols)) % cols;

// How bad a column count is: 0 is fine. One empty corner is fine from three
// across; at two across it is a lone card, so it counts.
function badness(count, cols) {
  const gaps = gapsAt(count, cols);
  if (gaps === 0 || (gaps === 1 && cols >= 3)) return 0;
  return gaps;
}

// `{ cols, center }` for `count` cards in a grid `width` px wide. Every card
// keeps one width. The count is what fits, one more (while cards stay 200px
// wide) or one fewer (never below two), whichever leaves the fewest gaps; a
// tie keeps what fits, then takes one more. A last row still short is
// centered, but a group that fits in one row is drawn as it is.
export function steadyColumns(count, width) {
  const fit = Math.max(1, Math.floor((Number(width) + GAP) / (CARD + GAP)) || 1);
  if (count <= fit) return { cols: fit, center: false };
  const candidates = [fit];
  if ((width + GAP) / (fit + 1) - GAP >= TIGHT) candidates.push(fit + 1);
  if (fit - 1 >= 2) candidates.push(fit - 1);
  let cols = fit;
  for (const c of candidates) if (badness(count, c) < badness(count, cols)) cols = c;
  return { cols, center: badness(count, cols) > 0 };
}
