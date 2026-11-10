// Plan2Code Web Console - Bounce Road's road: the jump math every hole is sized by, the stages' numbers, the road built a stage at a time from a seed, what lies under any spot (the timed parts included: drawbridges, swaying bridges, crumbling road), and where each moving hazard is at a moment.
//
// Rules only, no drawing and no state of its own: bounce.js keeps the round
// and drives it, bounce-rivals.js steers the rivals over this road, and
// bounce-scenery.js draws it. Everything that moves on the road (a train, a
// ball, a sprinkler's spray, a gust, a drawbridge) is a plain function of
// the round's clock, so a paused round holds still and a test can ask where
// anything will be.

import { FIELD_H, FIELD_W, LAP_FROM, MAX_HOLE, ROW, STAGES } from "./bounce-roads.js";

export { FIELD_H, FIELD_W, LAP_FROM, MAX_HOLE, ROW, STAGES };

const TAU = Math.PI * 2;

// A car, in units: CAR_W across, CAR_L long. Each rival kind has its own.
export const CAR_W = 4.2;
export const CAR_L = 7;

// The speeds a hole is sized by (bounce.js drives with them): TOP_SPEED with
// the throttle held, NITRO_TOP of it with a Nitro or a boost strip, never
// past MAX_SPEED.
export const TOP_SPEED = 64;
export const NITRO_TOP = 1.25;
export const MAX_SPEED = 80;
export const SLICE_MS = 4;
export const MIN_HOLE = 8;

// Jumps. A jump needs JUMP_MIN of speed and lasts airMs(v): JUMP_BASE_MS
// plus JUMP_PER_MS a unit of speed, so it covers reach(v). A Spring makes
// the next jump SPRING_AIR longer, a ramp RAMP_AIR.
export const JUMP_MIN = 22;
export const JUMP_BASE_MS = 420;
export const JUMP_PER_MS = 7.5;
export const SPRING_AIR = 1.5;
export const RAMP_AIR = 1.4;
// Every hole is jumpable at JUMP_FAIR of the top speed: its length and a
// car's together are no more than a jump's reach at that speed.
export const JUMP_FAIR = 0.8;

export const airMs = (v) => JUMP_BASE_MS + JUMP_PER_MS * v;
export const reach = (v) => (v * airMs(v)) / 1000;
// The furthest any jump of yours goes: a Spring's at MAX_SPEED (a ramp's is
// shorter).
export const LONGEST_JUMP = reach(MAX_SPEED) * Math.max(SPRING_AIR, RAMP_AIR);

// At most this many rivals on the road at once, however far you get.
export const MAX_RIVALS = 7;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);

// A small seeded random (mulberry32), so a seed always builds the same road.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- stages */

// A stage's numbers, built once each: the first ten from bounce-roads.js,
// and past the last, the road goes round again from LAP_FROM, the rivals
// quicker, keener and more of them each lap, the holes a little longer
// (never past MAX_HOLE), the Monster truck back at every Monster Mash.
const BUILT_STAGES = new Map();

export function stageFor(n) {
  const k = Math.max(1, Math.floor(n) || 1);
  if (BUILT_STAGES.has(k)) return BUILT_STAGES.get(k);
  let spec;
  if (k <= STAGES.length) spec = { ...STAGES[k - 1], n: k, lap: 1, name: STAGES[k - 1].title };
  else {
    const loop = STAGES.length - LAP_FROM + 1;
    const past = k - STAGES.length - 1;
    const base = STAGES[LAP_FROM - 1 + (past % loop)];
    const lap = 2 + Math.floor(past / loop);
    const longer = (r) => (r ? Object.freeze([r[0], Math.min(MAX_HOLE, r[1] + 3 * (lap - 1))]) : r);
    spec = {
      ...base,
      n: k,
      lap,
      name: `${base.title} ${lap}`,
      rivals: Math.min(MAX_RIVALS, base.rivals + lap - 1),
      pace: Math.min(1.45, base.pace + 0.07 * (lap - 1)),
      sharp: 1,
      crack: longer(base.crack),
      gap: longer(base.gap),
    };
  }
  const frozen = Object.freeze(spec);
  BUILT_STAGES.set(k, frozen);
  return frozen;
}

// "Kitchen Floor (stage 3)".
export const stageName = (n) => `${stageFor(n).name} (stage ${n})`;

/* --------------------------------------------------------------- road */

// What lies under a spot: the road, the verge, water, a hole or a flowerbed.
export const GROUND = Object.freeze({ road: 0, verge: 1, water: 2, hole: 3, bed: 4 });
// A row's mark, for what the chunk drawing adds: rails across it, or the
// cracked look of road that will crumble.
export const MARK = Object.freeze({ none: 0, rails: 1, crumble: 2 });

const PLAIN = Object.freeze({});

export const rowOf = (d) => Math.floor(d / ROW);

// A new road from a seed: the first stage built at once, the rest as you
// near them (ensureRoad). Each row keeps the road's edges (L, R), a
// flowerbed's (ML, MR; none when ML > MR), what lies off the road (`under`:
// verge, water or a hole), whether the road is there (`deck`: 0 none, 1
// road, 2 a swaying bridge, where it is depends on the clock), the timed
// section it is part of (`dynOf`, an index into `dyn` plus one), a `mark`
// and its stage. Holes, rivers, beds, signs, power-ups, stars, pads (boost
// strips, ramps, slicks), barriers, timed sections and hazards are listed in
// order along the road as they are laid; the hazards keep their own state
// (a drop's aim), so a road belongs to one round.
let roadSerial = 0;

export function newRoad(seed = 1) {
  const spec = STAGES[0];
  const road = {
    id: ++roadSerial,
    seed: seed >>> 0,
    rows: 0,
    L: [],
    R: [],
    ML: [],
    MR: [],
    under: [],
    deck: [],
    dynOf: [],
    mark: [],
    stageOf: [],
    stageAt: [],
    built: 0,
    building: 1,
    holes: [],
    rivers: [],
    beds: [],
    signs: [],
    items: [],
    stars: [],
    pads: [],
    blocks: [],
    dyn: [],
    hazards: [],
    c: FIELD_W / 2,
    w: spec.width[1],
    nextItem: 0,
  };
  buildStage(road, 1);
  return road;
}

// Rows of road `len` units long, the middle easing from where the road is
// to `c1` and the width to `w1`. `o` may set a flowerbed's width (`mw`),
// what lies off the road (`under`), the deck (0 none, 2 swaying), the timed
// section (`dyn`, its index plus one) and a `mark`.
function lay(road, len, c1, w1, o = PLAIN) {
  const n = Math.max(1, Math.round(len / ROW));
  const c0 = road.c;
  const w0 = road.w;
  for (let k = 1; k <= n; k++) {
    const s = smooth(k / n);
    const c = c0 + (c1 - c0) * s;
    const w = w0 + (w1 - w0) * s;
    road.L.push(c - w / 2);
    road.R.push(c + w / 2);
    road.ML.push(o.mw ? c - o.mw / 2 : 1);
    road.MR.push(o.mw ? c + o.mw / 2 : 0);
    road.under.push(o.under || GROUND.verge);
    road.deck.push(o.deck === undefined ? 1 : o.deck);
    road.dynOf.push(o.dyn || 0);
    road.mark.push(o.mark || 0);
    road.stageOf.push(road.building);
    road.rows++;
  }
  road.c = c1;
  road.w = w1;
}

export const roadEnd = (road) => road.rows * ROW;
const between = (random, [lo, hi]) => lo + random() * (hi - lo);
// A hole's length, a whole number of rows.
const holeLen = (random, range, more = 0) => ROW * Math.round(clamp(between(random, range) + more, MIN_HOLE, MAX_HOLE) / ROW);
// The power-ups, and how often each turns up.
const POWER_ROLL = Object.freeze([
  ["spring", 0.3],
  ["bubble", 0.25],
  ["nitro", 0.25],
  ["mega", 0.2],
]);

// Plain road, with a power-up on it when one is due.
function plain(road, spec, random, len, c1, w1) {
  const from = road.rows;
  lay(road, len, c1, w1);
  if (!spec.pickups || roadEnd(road) < road.nextItem) return;
  const j = from + Math.floor((road.rows - from) / 2);
  const half = (road.R[j] - road.L[j]) / 2 - 4;
  let roll = random();
  let kind = "spring";
  for (const [k, share] of POWER_ROLL) {
    kind = k;
    if ((roll -= share) < 0) break;
  }
  road.items.push({ d: j * ROW + ROW / 2, x: (road.L[j] + road.R[j]) / 2 + (random() * 2 - 1) * Math.max(0, half), kind, taken: false });
  road.nextItem = roadEnd(road) + ITEM_GAP + random() * ITEM_SPREAD;
}

// The road is built a stage at a time, at least BUILD_AHEAD units ahead of
// you. Every hole and river gets RUNUP units of plain road before it (with a
// sign SIGN_AHEAD before the water or the hole), a crack LANDING after it. A
// stage opens with LINE_RUN of plain road, the first with START_RUN.
export const BUILD_AHEAD = 420;
export const RUNUP = 70;
const LANDING = 24;
// Between two broken spans, at least MIN_ISLAND of bridge, and ISLAND_SPARE
// more than the longest jump any car can make from the first brink needs
// (LONGEST_JUMP), so no jump off the first break ever comes down in the
// second.
const MIN_ISLAND = 24;
const ISLAND_SPARE = 6;
const TAPER = 20;
const SIGN_AHEAD = 50;
const LINE_RUN = 60;
const START_RUN = 90;
// The road's middle drifts no more than SLOPE units across a unit along.
const SLOPE = 0.28;
// A field edge no road comes nearer than.
const EDGE = 3;
// Power-ups lie ITEM_GAP to ITEM_GAP + ITEM_SPREAD units apart.
const ITEM_GAP = 300;
const ITEM_SPREAD = 120;
// Stars over a hole, STAR_STEP apart.
const STAR_STEP = 4;

const sign = (road, d, kind = "hole") => {
  const i = rowOf(d);
  road.signs.push({ d, kind, x: road.L[i] - 4 < 4 ? road.R[i] + 4 : road.L[i] - 4 });
};

// A line of stars from `d0` to `d1` at `x` (the middle of the road when
// none), over a hole, so only a car in the air takes those over the gap
// itself, and any car on the road takes the rest.
function starLine(road, x, d0, d1) {
  for (let d = d0; d <= d1; d += STAR_STEP) road.stars.push({ x: x ?? road.c, d, taken: false });
}

function straight(road, spec, random, len = 50 + random() * 80) {
  const w1 = between(random, spec.width);
  const half = w1 / 2 + EDGE;
  const c1 = clamp(road.c + (random() * 2 - 1) * len * SLOPE, half, FIELD_W - half);
  plain(road, spec, random, len, c1, w1);
}

function crack(road, spec, random) {
  plain(road, spec, random, RUNUP, road.c, road.w);
  const d0 = roadEnd(road);
  sign(road, d0 - SIGN_AHEAD);
  lay(road, holeLen(random, spec.crack), road.c, road.w, { under: GROUND.hole, deck: 0 });
  road.holes.push({ d0, d1: roadEnd(road), kind: "crack" });
  if (random() < (spec.stars || 0)) starLine(road, road.c + (random() * 2 - 1) * (road.w / 2 - 5), d0 + 2, roadEnd(road) - 2);
  lay(road, LANDING, road.c, road.w);
}

// A ramp in one lane of the run-up, a crack after it and stars in a line
// from the ramp's lip on past the far edge, as far as a ramp's jump goes at
// a fair speed: the long way over, and the points, for the car that takes it.
function ramp(road, spec, random) {
  plain(road, spec, random, RUNUP, road.c, road.w);
  const d0 = roadEnd(road);
  sign(road, d0 - SIGN_AHEAD);
  const x = road.c + (random() * 2 - 1) * Math.max(0, road.w / 2 - 6);
  road.pads.push({ kind: "ramp", x, d: d0 - 5, w: 7, l: 6 });
  lay(road, holeLen(random, spec.crack, 4), road.c, road.w, { under: GROUND.hole, deck: 0 });
  road.holes.push({ d0, d1: roadEnd(road), kind: "crack" });
  starLine(road, x, d0 + 2, d0 + Math.min(reach(JUMP_FAIR * TOP_SPEED) * RAMP_AIR - 10, roadEnd(road) - d0 + 40));
  lay(road, LANDING + 30, road.c, road.w);
}

// A river crossed on a bridge narrower than the road: the run-up, the road
// narrowing to the bridge, the water with the bridge over it (and its broken
// spans, with a stretch of bridge before, between and after them, or a
// drawbridge span lifting on a timer), then the road widening again.
function river(road, spec, random) {
  const bw = between(random, spec.bridge);
  const w = road.w;
  const c = clamp(road.c, w / 2 + EDGE, FIELD_W - w / 2 - EDGE);
  lay(road, RUNUP - TAPER, c, w);
  lay(road, TAPER, c, bw);
  const d0 = roadEnd(road);
  sign(road, d0 - SIGN_AHEAD);
  const water = { under: GROUND.water };
  const broken = random() < (spec.broken || 0);
  if (!broken && random() < (spec.drawbridge || 0)) {
    lay(road, 14 + random() * 8, c, bw, water);
    const g0 = roadEnd(road);
    const dyn = { kind: "draw", d0: g0, d1: 0, period: 2600 + random() * 900, openMs: 1100 + random() * 300, phase: random() * 4000 };
    road.dyn.push(dyn);
    lay(road, holeLen(random, spec.gap), c, bw, { under: GROUND.water, dyn: road.dyn.length });
    dyn.d1 = roadEnd(road);
    road.holes.push({ d0: g0, d1: dyn.d1, kind: "draw" });
    lay(road, 14 + random() * 8, c, bw, water);
  } else if (!broken) lay(road, between(random, spec.river), c, bw, water);
  else {
    const two = random() < (spec.double || 0);
    lay(road, 12 + random() * 8, c, bw, water);
    let first = 0;
    for (let k = 0; k < (two ? 2 : 1); k++) {
      // The bridge between two breaks: long enough that the longest jump
      // from the first one's brink still comes down on it, with room to
      // jump again.
      if (k) lay(road, Math.max(MIN_ISLAND, LONGEST_JUMP - first + ISLAND_SPARE), c, bw, water);
      const g0 = roadEnd(road);
      lay(road, holeLen(random, spec.gap), c, bw, { under: GROUND.water, deck: 0 });
      road.holes.push({ d0: g0, d1: roadEnd(road), kind: "span" });
      if (random() < (spec.stars || 0) * 0.6) starLine(road, c, g0 + 2, roadEnd(road) - 2);
      first = roadEnd(road) - g0;
    }
    lay(road, 12 + random() * 8, c, bw, water);
  }
  road.rivers.push({ d0, d1: roadEnd(road) });
  lay(road, TAPER, c, w);
}

// A river crossed on a bridge that sways from side to side on the clock:
// never so far that its middle line leaves the bridge, so a car that keeps
// to the middle is always safe and one at an edge goes in.
function sway(road, spec, random) {
  const bw = between(random, spec.bridge) + 2;
  const w = road.w;
  const c = clamp(road.c, w / 2 + EDGE + 8, FIELD_W - w / 2 - EDGE - 8);
  lay(road, RUNUP - TAPER, c, w);
  lay(road, TAPER, c, bw);
  const d0 = roadEnd(road);
  sign(road, d0 - SIGN_AHEAD, "sway");
  const dyn = { kind: "sway", d0, d1: 0, c, bw, amp: Math.min(9, (bw - CAR_W) / 2 - 1.5), period: 2600 + random() * 800, phase: random() * TAU };
  road.dyn.push(dyn);
  lay(road, between(random, spec.river), c, bw, { under: GROUND.water, deck: 2, dyn: road.dyn.length });
  dyn.d1 = roadEnd(road);
  road.rivers.push({ d0, d1: dyn.d1 });
  lay(road, TAPER, c, w);
}

// The road widening round a flowerbed down its middle, then narrowing again.
function split(road, spec, random) {
  const sw = between(random, spec.splitWidth);
  const mw = between(random, spec.medianWidth);
  const c = clamp(road.c, sw / 2 + EDGE, FIELD_W - sw / 2 - EDGE);
  lay(road, 30, c, sw);
  const d0 = roadEnd(road);
  lay(road, between(random, spec.median), c, sw, { mw });
  road.beds.push({ d0, d1: roadEnd(road) });
  // Stars down the narrower side: the risky line pays.
  if (random() < (spec.stars || 0)) {
    const i = rowOf(d0 + 4);
    const left = road.ML[i] - road.L[i] < road.R[i] - road.MR[i];
    const x = left ? (road.L[i] + road.ML[i]) / 2 : (road.MR[i] + road.R[i]) / 2;
    for (let d = d0 + 10; d < roadEnd(road) - 10; d += 9) road.stars.push({ x, d, taken: false });
  }
  const w1 = between(random, spec.width);
  lay(road, 30, clamp(c, w1 / 2 + EDGE, FIELD_W - w1 / 2 - EDGE), w1);
}

// Barriers from alternate edges, each about half the road across, far
// enough apart to weave between at a fair speed: cones knock flying and
// slow you, blocks are solid.
function chicane(road, spec, random) {
  const w = clamp(road.w, spec.width[0], spec.width[1]);
  const c = clamp(road.c, w / 2 + EDGE, FIELD_W - w / 2 - EDGE);
  plain(road, spec, random, 40, c, w);
  const d0 = roadEnd(road);
  sign(road, d0 - 20, "chicane");
  const n = 3 + Math.floor(random() * 3);
  const gap = 32 + random() * 8;
  const first = random() < 0.5 ? -1 : 1;
  lay(road, n * gap + 10, c, w);
  const kind = spec.barrier || "cone";
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? -first : first;
    const bw = Math.min(w * (0.44 + random() * 0.1), w - CAR_W - 7);
    const d = d0 + 12 + k * gap;
    const i = rowOf(d);
    const x = side < 0 ? road.L[i] + bw / 2 : road.R[i] - bw / 2;
    road.blocks.push({ kind, x, d, w: bw, l: 3, side, hit: 0 });
  }
  plain(road, spec, random, 20, c, w);
}

// Road over a pit that falls away a row at a time once you are on it, the
// collapse coming on behind you at CRUMBLE_SPEED: keep your foot down.
function crumble(road, spec, random) {
  plain(road, spec, random, 40, road.c, road.w);
  const d0 = roadEnd(road);
  sign(road, d0 - 30, "crumble");
  const dyn = { kind: "crumble", d0, d1: 0, start: null };
  road.dyn.push(dyn);
  const len = 80 + random() * 60;
  const w1 = between(random, spec.width);
  const half = w1 / 2 + EDGE;
  lay(road, len, clamp(road.c + (random() * 2 - 1) * len * SLOPE * 0.6, half, FIELD_W - half), w1, { under: GROUND.hole, dyn: road.dyn.length, mark: MARK.crumble });
  dyn.d1 = roadEnd(road);
  plain(road, spec, random, LANDING, road.c, road.w);
}

// A toy train's track across the road: the train runs across on its own
// timer, the crossing's lights flashing first. Jump it, or wait for it.
function train(road, spec, random) {
  plain(road, spec, random, 56, road.c, road.w);
  const d0 = roadEnd(road);
  sign(road, d0 - 40, "train");
  lay(road, 6, road.c, road.w, { mark: MARK.rails });
  const speed = 70 + random() * 16;
  const len = 46 + random() * 20;
  road.hazards.push({ kind: "train", d: d0 + 3, half: 3, dir: random() < 0.5 ? -1 : 1, len, speed, period: ((FIELD_W + len) / speed) * 1000 + 1900 + random() * 900, phase: random() * 5000 });
  plain(road, spec, random, 34, road.c, road.w);
}

// Straights with something on them: speed strips, slicks, a ball rolling
// across, a sprinkler, something falling and gusts of wind.
function boost(road, spec, random) {
  const len = 70 + random() * 30;
  const d0 = roadEnd(road);
  straight(road, spec, random, len);
  const n = random() < 0.5 ? 1 : 2;
  for (let k = 0; k < n; k++) {
    const d = d0 + 18 + k * (len - 36);
    const i = rowOf(d);
    const x = (road.L[i] + road.R[i]) / 2 + (random() * 2 - 1) * Math.max(0, (road.R[i] - road.L[i]) / 2 - 5);
    road.pads.push({ kind: "boost", x, d, w: 5, l: 8 });
    for (let s = 1; s <= 4; s++) road.stars.push({ x, d: d + 4 + s * 4, taken: false });
  }
}

function slick(road, spec, random) {
  const len = 70 + random() * 40;
  const d0 = roadEnd(road);
  straight(road, spec, random, len);
  const n = 1 + Math.floor(random() * 3);
  for (let k = 0; k < n; k++) {
    const d = d0 + 14 + ((k + random() * 0.6) * (len - 28)) / n;
    const i = rowOf(d);
    const w = 7 + random() * 5;
    const x = road.L[i] + w / 2 + 1 + random() * Math.max(0, road.R[i] - road.L[i] - w - 2);
    road.pads.push({ kind: "slick", x, d, w, l: 8 + random() * 6 });
  }
}

function ball(road, spec, random) {
  const len = 80 + random() * 30;
  const d0 = roadEnd(road);
  sign(road, d0 - 10, "ball");
  plain(road, spec, random, len, road.c, road.w);
  const i = rowOf(d0 + len / 2);
  road.hazards.push({ kind: "ball", d: d0 + len / 2, c: (road.L[i] + road.R[i]) / 2, amp: (road.R[i] - road.L[i]) / 2 - 3, r: 3, period: (2300 + random() * 900) / (spec.pace || 1), phase: random() * TAU });
}

function sprinkler(road, spec, random) {
  const len = 80 + random() * 30;
  const d0 = roadEnd(road);
  straight(road, spec, random, len);
  const i = rowOf(d0 + len / 2);
  const side = random() < 0.5 ? -1 : 1;
  road.hazards.push({ kind: "sprinkler", d: d0 + len / 2, x: side < 0 ? road.L[i] - 1.5 : road.R[i] + 1.5, side, reach: (road.R[i] - road.L[i]) * 0.85, period: 2400 + random() * 800, phase: random() * TAU });
}

function drop(road, spec, random) {
  const len = 100 + random() * 30;
  const d0 = roadEnd(road);
  plain(road, spec, random, len, road.c, road.w);
  road.hazards.push({ kind: "drop", d: d0 + len * 0.7, what: spec.drops || "pot", x: null, at: 0, w: 5.5, l: 5.5 });
}

function wind(road, spec, random) {
  const len = 100 + random() * 50;
  const d0 = roadEnd(road);
  sign(road, d0 - 10, "wind");
  straight(road, spec, random, len);
  road.hazards.push({ kind: "wind", d: d0, d1: roadEnd(road), dir: random() < 0.5 ? -1 : 1, period: 2600 + random() * 600, onMs: 1300, phase: random() * 3000 });
}

const PIECES = Object.freeze({ straight, crack, river, split, ramp, chicane, crumble, train, sway, boost, slick, ball, sprinkler, drop, wind });
export const PIECE_NAMES = Object.freeze(Object.keys(PIECES));

// Lays stage `n` on the end of the road, from its own seeded random, so the
// same road seed always builds the same stage: its opening run (with the
// stage line on its first row), then pieces by the stage's weights until it
// is `len` long. stageAt[n - 1] is where it starts, stageAt[n] where the
// next one will.
export function buildStage(road, n, random = seeded(road.seed + n * 7919)) {
  const spec = stageFor(n);
  road.building = n;
  const start = roadEnd(road);
  road.stageAt[n - 1] = start;
  if (n === 1) road.nextItem = 0;
  plain(road, spec, random, n === 1 ? START_RUN : LINE_RUN, road.c, road.w);
  let last = "straight";
  while (roadEnd(road) - start < spec.len) {
    const far = (roadEnd(road) - start) / spec.len;
    let total = 0;
    for (const name of PIECE_NAMES) total += pieceWeight(spec, name, far, last);
    let roll = random() * total;
    let pick = "straight";
    for (const name of PIECE_NAMES) {
      roll -= pieceWeight(spec, name, far, last);
      if (roll < 0) {
        pick = name;
        break;
      }
    }
    PIECES[pick](road, spec, random);
    last = pick;
  }
  road.built = n;
  road.stageAt[n] = roadEnd(road);
}

// A piece's weight: no crack before `crackFrom` of the stage, and never the
// same piece but a straight twice in a row.
function pieceWeight(spec, name, far, last) {
  const w = spec.weights[name] || 0;
  if (name === "crack" && far < (spec.crackFrom || 0)) return 0;
  if (name !== "straight" && name === last) return 0;
  return w;
}

// Builds stages until the road reaches BUILD_AHEAD past `d`.
export function ensureRoad(road, d) {
  while (roadEnd(road) < d + BUILD_AHEAD) buildStage(road, road.built + 1);
}

// The row index for `d`, kept on the road.
export const rowIn = (road, d) => clamp(rowOf(d), 0, road.rows - 1);

/* ---------------------------------------------------- the timed parts */

// A swaying bridge's shift across at `t`.
export const swayOff = (s, t) => s.amp * Math.sin((t / s.period) * TAU + s.phase);

// How far a drawbridge's span is lifted at `t`, 0 to 1: up for `openMs` of
// each `period`, rising and falling over DRAW_MOVE_MS at either end. It is
// water to a car from the moment it starts to lift.
export const DRAW_MOVE_MS = 260;
export function drawLift(s, t) {
  const c = (t + s.phase) % s.period;
  if (c >= s.openMs) return 0;
  return Math.min(1, c / DRAW_MOVE_MS, (s.openMs - c) / DRAW_MOVE_MS);
}
export const drawOpen = (s, t) => drawLift(s, t) > 0.05;

// Crumbling road falls away CRUMBLE_DELAY after your nose reaches it, then
// a row at a time behind at CRUMBLE_SPEED units a second, under what a car
// at JUMP_FAIR of the top speed makes.
export const CRUMBLE_DELAY = 700;
export const CRUMBLE_SPEED = 40;
export const crumbleAt = (s, d) => s.start + CRUMBLE_DELAY + ((d - s.d0) / CRUMBLE_SPEED) * 1000;
export const crumbleGone = (s, d, t) => s.start !== null && t >= crumbleAt(s, d);

// Whether row `i` is a hole at `t`: no deck, a drawbridge lifted, or road
// that has crumbled.
export function rowGone(road, i, t) {
  if (!road.deck[i]) return true;
  const k = road.dynOf[i];
  if (!k) return false;
  const s = road.dyn[k - 1];
  if (s.kind === "draw") return drawOpen(s, t);
  if (s.kind === "crumble") return crumbleGone(s, i * ROW + ROW / 2, t);
  return false;
}

// A row's edges are where the road is at its far end; the road runs straight
// from the row before's, so the edges at `d` are eased between the two, the
// same slanted edge the drawing draws (never a step a row). `t` is the
// round's clock, for the timed parts.
export function groundAt(road, x, d, t = 0) {
  const i = rowIn(road, d);
  if (!road.deck[i]) return road.under[i];
  let shift = 0;
  const k = road.dynOf[i];
  if (k) {
    const s = road.dyn[k - 1];
    if (s.kind === "draw" && drawOpen(s, t)) return GROUND.water;
    if (s.kind === "crumble" && crumbleGone(s, d, t)) return GROUND.hole;
    if (s.kind === "sway") shift = swayOff(s, t);
  }
  if (road.ML[i] < road.MR[i] && x >= road.ML[i] && x <= road.MR[i]) return GROUND.bed;
  let L = road.L[i];
  let R = road.R[i];
  if (i > 0 && !shift) {
    const f = clamp(d / ROW - i, 0, 1);
    L = road.L[i - 1] + (L - road.L[i - 1]) * f;
    R = road.R[i - 1] + (R - road.R[i - 1]) * f;
  }
  if (x >= L + shift && x <= R + shift) return GROUND.road;
  return road.under[i];
}

// The stretch of road a car at `x` drives on at `d`: the whole road, or the
// side of a flowerbed it is on. Written into SPAN, never a new object.
export const SPAN = { lo: 0, hi: 0 };

export function spanAt(road, x, d, side = 0) {
  const i = rowIn(road, d);
  if (road.ML[i] < road.MR[i]) {
    const left = side ? side < 0 : x < (road.ML[i] + road.MR[i]) / 2;
    SPAN.lo = left ? road.L[i] : road.MR[i];
    SPAN.hi = left ? road.ML[i] : road.R[i];
  } else {
    SPAN.lo = road.L[i];
    SPAN.hi = road.R[i];
  }
  return SPAN;
}

// The index of the first entry of `list` (anything laid in order along the
// road) whose `key` is at or past `d`: a long run's lists grow, and nothing
// behind the view needs a look.
export function firstAt(list, key, d) {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid][key] < d) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// The holes (cracks, broken spans and drawbridge spans) that start after
// `from` and end by `to`.
export function holesIn(road, from, to) {
  const out = [];
  for (let k = firstAt(road.holes, "d0", from); k < road.holes.length && road.holes[k].d0 <= to; k++) {
    const h = road.holes[k];
    if (h.d0 > from && h.d1 <= to) out.push(h);
  }
  return out;
}

// A row with nothing to catch you out: road there, verge off it, no
// flowerbed, nothing timed and no rails.
export const plainRow = (road, i) => road.deck[i] === 1 && road.under[i] === GROUND.verge && !(road.ML[i] < road.MR[i]) && !road.dynOf[i] && !road.mark[i];

// Where to put a car back after a life lost: RESPAWN_BACK before `d`, then
// back to a row with plain road from 6 rows behind it to 16 ahead (no
// flowerbed to steer round at once), and no hole, water or crumbling road
// for RESPAWN_RUN ahead: room to reach JUMP_FAIR of the top speed from a
// roll, with a moment to spare, before the next one.
export const RESPAWN_BACK = 30;
export const RESPAWN_RUN = 52;

export function safeSpot(road, d) {
  let i = rowIn(road, d - RESPAWN_BACK);
  const ahead = Math.ceil(RESPAWN_RUN / ROW);
  const clear = (k) => {
    for (let j = Math.max(0, k - 6); j <= Math.min(road.rows - 1, k + ahead); j++) {
      if (j <= k + 16 ? !plainRow(road, j) : road.deck[j] !== 1 || road.under[j] !== GROUND.verge) return false;
    }
    return true;
  };
  while (i > 0 && !clear(i)) i--;
  return i * ROW + ROW / 2;
}

/* ------------------------------------------------- the moving hazards */

// A train's span across the field at `t`, into TRAIN (x0 to x1; `on` false
// while it is off the field), and `warn`, true for TRAIN_WARN_MS before it
// comes on and while it is on.
export const TRAIN_WARN_MS = 1300;
export const TRAIN = { on: false, warn: false, x0: 0, x1: 0, head: 0 };

export function trainAt(h, t) {
  const c = (t + h.phase) % h.period;
  const run = ((FIELD_W + h.len) / h.speed) * 1000;
  TRAIN.on = c < run;
  TRAIN.warn = TRAIN.on || c > h.period - TRAIN_WARN_MS;
  const head = (h.speed * c) / 1000;
  const x0 = head - h.len;
  TRAIN.head = h.dir > 0 ? head : FIELD_W - head;
  TRAIN.x0 = h.dir > 0 ? x0 : FIELD_W - head;
  TRAIN.x1 = h.dir > 0 ? head : FIELD_W - x0;
  return TRAIN;
}

// A ball's middle across the road at `t`, and its roll (for its stripes).
export const ballX = (h, t) => h.c + h.amp * Math.sin((t / h.period) * TAU + h.phase);

// A sprinkler's spray at `t`: the end of its jet, sweeping SPRAY_SWEEP each
// way of straight across the road. Into SPRAY.
export const SPRAY_SWEEP = 1.05;
export const SPRAY = { x0: 0, d0: 0, x1: 0, d1: 0 };

export function sprayAt(h, t) {
  const a = SPRAY_SWEEP * Math.sin((t / h.period) * TAU + h.phase);
  SPRAY.x0 = h.x;
  SPRAY.d0 = h.d;
  SPRAY.x1 = h.x - h.side * h.reach * Math.cos(a);
  SPRAY.d1 = h.d + h.reach * Math.sin(a);
  return SPRAY;
}

// Whether a gust is blowing at `t`, and how hard (0 to 1, easing in and out).
export function gustAt(h, t) {
  const c = (t + h.phase) % h.period;
  if (c >= h.onMs) return 0;
  return Math.min(1, c / 250, (h.onMs - c) / 250);
}

// A drop falls DROP_FALL_MS once you come within DROP_TRIGGER of its spot
// (under the AHEAD of the field the board shows, so the whole warning is in
// view), aimed at where you are heading, and lies there after.
export const DROP_TRIGGER = 66;
export const DROP_FALL_MS = 950;
