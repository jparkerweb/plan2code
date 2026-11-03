// Plan2Code Web Console - Ghoul Rush's Holy Roller, its course: the fixed, seeded run down the Chapel's nave, laid out by TIME and turned into distance. No imports, no random numbers.
//
// The ride speeds up with the distance it has covered (speedAt: V0 at the start, climbing by ACC every
// second), so a second of ride time is a place (xAt). The course is written in seconds, a row of up to three
// things across the three lanes at a time, and every gap between two rows is long enough for a player to
// answer the first and get to the second (the tests walk the whole course to prove a safe path exists
// at every moment). Nothing here draws a random number: the same course every time.
//
// Output (all frozen), x being distance down the aisle and `lane` 0 (left), 1 (middle) or 2 (right):
// - `items`: [x, lane, kind, len] for every thing in the way, sorted by x. `x` is the thing's near
//   edge and `len` how deep it runs (0 for the kind's own depth, see KINDS in ghoul-pew.js). Kinds:
//   "pillar", "confessional", "pewx" (SWITCH), "kneeler", "stand", "cracks", "hatch" (JUMP), "censer",
//   "banner", "beam" (SLIDE), "garg" (SHOOT or switch) and "bell" (a rope: SHOOT, harmless).
// - `souls`: [x, lane, h, type] wax souls (type 0) and halos (type 1, a magnet) with their height.
// - `checks`: the checkpoints' x; `finish`: where the ride ends; `rows`: [x, [kinds...]] for the art/tests.

export const PEW_START = 8;
export const V0 = 34;
export const ACC = 0.7;
export const V_MAX = 84;
export const RIDE_S = 66;

// Where the ride is `t` seconds in, and how fast it rolls at distance `x`.
export const xAt = (t) => PEW_START + V0 * t + (ACC * t * t) / 2;
export const speedAt = (x) => Math.min(V_MAX, Math.sqrt(V0 * V0 + 2 * ACC * Math.max(0, x - PEW_START)));

const r1 = (n) => Math.round(n * 10) / 10;
const SOUL_STEP = 0.14;

function build() {
  const items = [];
  const souls = [];
  const rows = [];
  const it = (t, lane, kind, len = 0) => items.push([r1(xAt(t)), lane, kind, len]);
  const row = (t, kinds) => {
    kinds.forEach((kind, lane) => kind && it(t, lane, kind, kind === "cracks" ? 7 : 0));
    rows.push([r1(xAt(t)), kinds]);
  };
  const line = (t0, t1, lane, h = 1.5) => {
    for (let t = t0; t <= t1 + 1e-9; t += SOUL_STEP) souls.push([r1(xAt(t)), lane, h, 0]);
  };
  // Souls rising over a jump and coming down again, centered at time t.
  const arc = (t, lane, peak = 4.4, half = 0.42) => {
    for (let u = -half; u <= half + 1e-9; u += SOUL_STEP) souls.push([r1(xAt(t + u + 0.1)), lane, 1.4 + peak * (1 - (u / half) ** 2), 0]);
  };
  const halo = (t, lane) => souls.push([r1(xAt(t)), lane, 2.4, 1]);
  const [K, X, P, C, B, I, M, S, H, G, R, CR] = ["kneeler", "pewx", "pillar", "confessional", "banner", "censer", "beam", "stand", "hatch", "garg", "bell", "cracks"];
  const _ = null;

  // Act one: each answer on its own. JUMP, SWITCH, SLIDE, SWITCH again, a row that asks for all three, SHOOT.
  row(3.4, [K, K, K]);
  arc(3.4, 1);
  row(6, [X, X, _]);
  line(5.5, 6.6, 2);
  row(8.5, [B, B, B]);
  line(8.1, 8.9, 0, 0.9);
  line(8.1, 8.9, 2, 0.9);
  row(11, [_, C, C]);
  line(10.4, 11.8, 0);
  row(13.4, [P, K, I]);
  arc(13.4, 1);
  line(13, 13.8, 2, 0.9);
  row(15.8, [_, G, _]);
  line(15.2, 16.2, 0);
  line(15.2, 16.2, 2);
  // Act two: a bell rope that clears the gargoyles after it, staggered switching, jump-then-slide.
  it(18.2, 0, R);
  row(20.8, [G, G, _]);
  line(20.2, 21.4, 2);
  halo(22.2, 2);
  row(23, [X, _, X]);
  line(22.6, 23.4, 1);
  row(24.6, [_, X, X]);
  line(24.3, 24.9, 0);
  row(26.2, [X, X, _]);
  line(25.9, 26.5, 2);
  row(28.2, [K, K, K]);
  arc(28.2, 0);
  arc(28.2, 1);
  arc(28.2, 2);
  row(29.6, [B, B, B]);
  line(29.3, 29.9, 1, 0.9);
  row(31.4, [H, CR, H]);
  arc(31.4, 0);
  arc(31.4, 2);
  row(33.4, [I, P, I]);
  line(33, 33.8, 0, 0.9);
  line(33, 33.8, 2, 0.9);
  halo(34.6, 0);
  line(35, 36, 0);
  line(35, 36, 1);
  line(35, 36, 2);
  row(37, [M, M, M]);
  line(36.7, 37.5, 1, 0.9);
  row(38.8, [C, _, C]);
  line(38.4, 39.4, 1);
  row(40.4, [S, K, S]);
  arc(40.4, 1);
  // Act three: faster and closer. Mixed rows, a second bell, gargoyles on both flanks.
  it(42, 1, R);
  row(44, [_, G, G]);
  line(43.6, 44.6, 0);
  row(45.6, [P, _, B]);
  line(45.2, 46, 1);
  row(47, [K, B, K]);
  arc(47, 0);
  arc(47, 2);
  row(48.4, [_, C, _]);
  line(48, 48.8, 0);
  line(48, 48.8, 2);
  row(49.8, [X, _, _]);
  line(49.4, 50.2, 2);
  row(51.2, [H, H, H]);
  arc(51.2, 1);
  row(52.6, [B, B, B]);
  line(52.3, 52.9, 0, 0.9);
  halo(53.8, 2);
  row(54.6, [P, P, _]);
  line(54.2, 55, 2);
  row(56, [_, P, P]);
  line(55.6, 56.4, 0);
  row(57.4, [G, _, G]);
  line(57, 57.8, 1);
  row(59, [I, K, I]);
  arc(59, 1);
  row(60.6, [P, _, P]);
  line(60.2, 61, 1);
  row(62, [M, M, M]);
  line(61.7, 62.5, 1, 0.9);
  row(63.5, [_, P, _]);
  line(63.1, 63.9, 0);
  line(63.1, 63.9, 2);
  line(64.4, 65.4, 1, 2);
  items.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  souls.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { items, souls, rows, checks: [16.5, 31, 46, 58].map((t) => r1(xAt(t))), finish: r1(xAt(RIDE_S)) };
}

const deep = (v) => (Array.isArray(v) ? Object.freeze(v.map(deep)) : v);
export const COURSE = Object.freeze(Object.fromEntries(Object.entries(build()).map(([k, v]) => [k, deep(v)])));
