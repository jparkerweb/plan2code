// Plan2Code Web Console - Flock Dash, the thirteenth activity: the lead bird's flight through the sunset sky, the strays it gathers, the flock that follows its exact path, and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, steer,
// recordPath, placeFlock, screenX, collect, spawnStrays, applyPower, powerPills,
// teaser, advance), exported so
// the unit suite can drive them without a canvas; the drawing lives in
// flock-draw.js, and the default export is the contract every listed game
// answers.
//
// Planny leads, flying right through a sky that scrolls past him. The arrows
// climb, dive and ease him forward and back inside a band on the left of the
// field. Strays drift in from the right, and each one he touches joins the
// flock. The tail is a recorded path with a running arc length, not a list of
// cells: follower k sits k * SPACING behind the leader along that path, so it
// copies every turn exactly, at any speed.

import { DANGER, drawScene, GOLD, HAZARD_COLORS, POWER_COLORS, readColors, STAGE_COLOR } from "./flock-draw.js";

// The board: the strip of pills along the top, then the field, which runs to
// the canvas's edges with no frame. The canvas scales a unit in quarter-pixel
// steps.
export const FIELD_W = 96;
export const FIELD_H = 54;
export const HUD_H = 4.5;
export const PAD = 0;
export const W = PAD * 2 + FIELD_W;
export const H = HUD_H + FIELD_H + PAD;

// Below this many pixels a unit, the board is too small to play.
export const MIN_CELL = 3;

// Time is handed out in slices this long, so a long frame never carries the
// leader past a stray without touching it.
export const SLICE_MS = 4;

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Freezes a table all the way down (the stage, hazard and power tables).
export const deepFreeze = (o) => {
  Object.values(o).forEach((v) => {
    if (v && typeof v === "object") deepFreeze(v);
  });
  return Object.freeze(o);
};

// A small seeded random (mulberry32), so a seed always builds the same sky.
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

/* -------------------------------------------------------------- the round */

// The leader's flight: the screen x range it may ease across, how fast it
// climbs at full input and how quickly it gets there, how fast it eases
// forward and back, how far it stays off the field's top and bottom, and the
// sky's speed in world units a second at stage 1.
export const BAND_MIN = 10;
export const BAND_MAX = 38;
export const CLIMB = 34;
export const CLIMB_EASE = 14;
export const NUDGE = 16;
export const EDGE = 2.5;
export const BASE_SPEED = 20;
export const START_LIVES = 3;
const START_SX = 18;

export function newRound(seed = Math.floor(Math.random() * 2 ** 32)) {
  const round = {
    seed,
    random: seeded(seed),
    stage: 1,
    scroll: 0,
    speed: BASE_SPEED,
    leader: { sx: START_SX, x: START_SX, y: FIELD_H / 2, vy: 0, alive: true, grace: 0 },
    path: [],
    flock: [],
    strays: [],
    scattered: [],
    base: 0,
    length: 0,
    hazards: [],
    crates: [],
    active: { tailwind: 0, magnet: 0, shields: 0 },
    lives: START_LIVES,
    infinite: false,
    score: 0,
    combo: 1,
    comboAt: -Infinity,
    flown: 0,
    input: { up: false, down: false, left: false, right: false },
    over: false,
    won: false,
    nextId: 1,
    nextStray: null,
    now: 0,
    crashAt: 0,
    banner: null,
    bannerQueue: [],
    events: [],
    warned: { gust: -Infinity, storm: -Infinity },
  };
  beginStage(round, 1);
  return round;
}

// A stage's hazards and crates in the world, starting from the stage's first
// distance.
function placeLayout(round) {
  const { hazards, crates } = buildStage(round.seed, round.stage);
  return {
    hazards: hazards.map((h) => ({ ...h, x: h.x + round.base, ...(h.tipX === undefined ? {} : { tipX: h.tipX + round.base }), ...(h.col === undefined ? {} : { col: h.col + round.base }) })),
    crates: crates.map((c) => ({ ...c, x: c.x + round.base })),
  };
}

// Starts stage `n` from where the sky is now: the flock and the score are kept.
function beginStage(round, n) {
  const stage = stageFor(n);
  round.stage = n;
  round.speed = stage.speed;
  round.length = stage.length;
  round.base = round.scroll;
  const layout = placeLayout(round);
  round.hazards = layout.hazards;
  round.crates = layout.crates;
  round.portal = newPortal(round, stage);
  round.snaps = 0;
  round.lost = 0;
  round.events.push({ type: "stage" });
}

// One slice of steering: the leader's climb eases toward the held input (up
// is negative), its screen x moves inside the band, and its height stays off
// the edges. A leader pressed against an edge stops there, with no climb
// saved up to carry it away.
export function steer(round, ms) {
  const { leader, input } = round;
  const dt = ms / 1000;
  const climb = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  leader.vy += (CLIMB * climb - leader.vy) * Math.min(1, CLIMB_EASE * dt);
  const y = leader.y + leader.vy * dt;
  leader.y = clamp(y, EDGE, FIELD_H - EDGE);
  if (leader.y !== y) leader.vy = 0;
  const nudge = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  leader.sx = clamp(leader.sx + NUDGE * nudge * dt, BAND_MIN, BAND_MAX);
  leader.x = round.scroll + leader.sx;
}

/* ------------------------------------------------------ the path and flock */

// How far apart the birds fly along the path, and how close two path points
// may sit.
export const SPACING = 2.6;
const MIN_STEP = 0.2;
const PATH_MARGIN = 4;

// Adds the leader's world position to the path with its running arc length,
// and trims what the flock can no longer reach from the front.
export function recordPath(round) {
  const { path, leader } = round;
  const last = path[path.length - 1];
  if (!last) {
    path.push({ x: leader.x, y: leader.y, s: 0 });
    return;
  }
  const step = Math.hypot(leader.x - last.x, leader.y - last.y);
  if (step < MIN_STEP) return;
  const s = last.s + step;
  path.push({ x: leader.x, y: leader.y, s });
  const oldest = s - (round.flock.length + 2) * SPACING - PATH_MARGIN;
  let drop = 0;
  while (drop < path.length - 1 && path[drop].s < oldest) drop++;
  if (drop) path.splice(0, drop);
}

// Where the path is at arc length `s`, between the two points around it; a
// point before the path's start sits on its first point.
function pointAt(path, s) {
  if (s <= path[0].s) return path[0];
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = path[lo];
  const b = path[hi];
  const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Puts each follower k (1-based) k * SPACING behind the path's end.
export function placeFlock(round) {
  const { path, flock } = round;
  if (!path.length) return;
  const end = path[path.length - 1].s;
  flock.forEach((bird, i) => {
    const at = pointAt(path, end - (i + 1) * SPACING);
    bird.x = at.x;
    bird.y = at.y;
  });
  if (round.portal.v) blendV(round);
}

export const screenX = (round, worldX) => worldX - round.scroll;

/* ---------------------------------------------------------------- strays */

// How close the leader must come to a stray, what one is worth, how far apart
// they come along the sky at stage 1 (the stage table has the rest), and how
// far behind the left edge a missed one is dropped.
export const PICK_R = 2.4;
export const STRAY_POINTS = 10;
export const STRAY_GAP_MIN = 9;
export const STRAY_GAP_MAX = 14;
export const STRAY_AHEAD_MIN = 4;
export const STRAY_AHEAD_MAX = 30;
export const STRAY_BEHIND = 6;

// A stray within COMBO_MS of the last raises the combo, which multiplies its
// points, up to MAX_COMBO.
export const COMBO_MS = 1400;
export const MAX_COMBO = 5;

// A bird joins the flock from wherever it was loose; returns the flock's new
// length. A stray pays by the combo; a scattered bird won back pays half its
// plain points and leaves the combo alone.
export function collect(round, bird) {
  const back = round.scattered.includes(bird);
  for (const list of [round.strays, round.scattered]) {
    const i = list.indexOf(bird);
    if (i >= 0) list.splice(i, 1);
  }
  round.flock.push({ id: bird.id });
  if (back) {
    round.score += Math.floor(STRAY_POINTS / 2);
    round.events.push({ type: "rejoin" });
  } else {
    round.combo = round.now - round.comboAt <= COMBO_MS ? Math.min(MAX_COMBO, round.combo + 1) : 1;
    round.comboAt = round.now;
    round.score += STRAY_POINTS * round.combo;
    round.events.push({ type: "chirp", combo: round.combo });
  }
  return round.flock.length;
}

// Keeps strays coming: one per gap along the sky, placed ahead of the right
// edge at a random height inside the edges, with a phase for its bob.
export function spawnStrays(round, random) {
  const right = round.scroll + FIELD_W;
  if (round.nextStray === null) round.nextStray = right + STRAY_AHEAD_MIN;
  while (round.nextStray <= right + STRAY_AHEAD_MAX) {
    round.strays.push({
      id: round.nextId++,
      x: round.nextStray,
      y: EDGE + random() * (FIELD_H - EDGE * 2),
      bob: random() * Math.PI * 2,
    });
    const [near, far] = stageFor(round.stage).strayGap;
    round.nextStray += near + random() * (far - near);
  }
}

/* -------------------------------------------------------- the stage table */

export const MAX_STAGE = 8;

// Every stage's numbers, the place to tune the difficulty: its speed in world
// units a second, its length to the portal, how far apart its strays and its
// hazards come, the flock its portal asks for, and the hazards it deals (by
// weight). Each stage adds one new kind; the last two deal all of them.
export const STAGES = deepFreeze({
  1: { title: "Golden Hour", sub: "Gather the strays, mind the balloons", speed: BASE_SPEED, length: 900, strayGap: [STRAY_GAP_MIN, STRAY_GAP_MAX], min: 6, hazards: { balloon: 1 }, gap: [30, 44] },
  2: { title: "Head-winds", sub: "A gust snaps any bird it catches", speed: 22.5, length: 1000, strayGap: [STRAY_GAP_MIN, STRAY_GAP_MAX], min: 9, hazards: { balloon: 3, gust: 1 }, gap: [28, 42] },
  3: { title: "Slipstream Alley", sub: "Ride the fast lanes with the whole line", speed: 25, length: 1100, strayGap: [8.5, 13], min: 12, hazards: { balloon: 3, gust: 1, stream: 1 }, gap: [26, 38] },
  4: { title: "Balloon Fiesta", sub: "They come in bunches now", speed: 28, length: 1200, strayGap: [8.5, 13], min: 15, hazards: { balloon: 2, gust: 1, stream: 1, cluster: 2 }, gap: [24, 36] },
  5: { title: "Thunderheads", sub: "A flash, then the lightning", speed: 31.5, length: 1300, strayGap: [8, 12], min: 18, hazards: { balloon: 2, gust: 1, stream: 1, cluster: 2, storm: 1 }, gap: [22, 34] },
  6: { title: "Kite Festival", sub: "Mind the strings", speed: 35, length: 1400, strayGap: [8, 12], min: 22, hazards: { balloon: 2, gust: 1, stream: 1, cluster: 2, storm: 1, kite: 2 }, gap: [20, 30] },
  7: { title: "Dusk Rush", sub: "Everything, and faster", speed: 39.5, length: 1500, strayGap: [7.5, 11], min: 26, hazards: { balloon: 2, gust: 2, stream: 1, cluster: 2, storm: 2, kite: 2 }, gap: [16, 26] },
  8: { title: "The Jet Stream", sub: "The last portal will not hold still", speed: 44, length: 1700, strayGap: [7, 10], min: 30, hazards: { balloon: 2, gust: 2, stream: 1, cluster: 2, storm: 2, kite: 2 }, gap: [15, 24] },
});

export const stageFor = (n) => STAGES[clamp(Math.round(n) || 1, 1, MAX_STAGE)];

// The six hazards: what each is called, what it does, the stage it first turns
// up in, and its color (flock-draw.js keeps the colors).
export const HAZARDS = deepFreeze({
  balloon: { name: "Balloon", plural: "Balloons", blurb: "Drifts up and down in your way", from: 1, color: HAZARD_COLORS.balloon },
  gust: { name: "Head-wind", plural: "Head-winds", blurb: "Shoves you back and snaps any bird it catches", from: 2, color: HAZARD_COLORS.gust },
  stream: { name: "Slipstream", plural: "Slipstreams", blurb: "A fast lane: ride it end to end, never out the side", from: 3, color: HAZARD_COLORS.stream },
  cluster: { name: "Balloon bunch", plural: "Balloon bunches", blurb: "Several small balloons moving together", from: 4, color: HAZARD_COLORS.cluster },
  storm: { name: "Thunderhead", plural: "Thunderheads", blurb: "A flash, then lightning down the same column", from: 5, color: HAZARD_COLORS.storm },
  kite: { name: "Kite", plural: "Kite strings", blurb: "A swaying kite on a string you cannot cross", from: 6, color: HAZARD_COLORS.kite },
});

/* ------------------------------------------------------------- the crates */

// The crates' power-ups. A timed one lasts `ms`; a shield is a count, up to
// MAX_SHIELDS. A crate comes every CRATE_EVERY world units along a stage.
export const POWERS = deepFreeze({
  tailwind: { name: "Tailwind", blurb: "A burst of speed through the gusts", color: POWER_COLORS.tailwind, ms: 6000, weight: 3 },
  shield: { name: "Shield", blurb: "Shrug off one hit or snap", color: POWER_COLORS.shield, weight: 3 },
  magnet: { name: "Magnet", blurb: "Strays come to you", color: POWER_COLORS.magnet, ms: 8000, weight: 2 },
});
export const POWER_KINDS = Object.freeze(Object.keys(POWERS));
export const MAX_SHIELDS = 2;
export const CRATE_EVERY = Object.freeze([220, 320]);

// While a tailwind runs the sky speeds up by this share of the stage's speed.
// While a magnet runs, loose birds within reach drift to the leader at this
// many units a second. A shield spent gives this much grace.
export const TAILWIND_BOOST = 0.5;
export const MAGNET_REACH = 20;
export const MAGNET_PULL = 30;
export const SHIELD_GRACE = 1200;

/* -------------------------------------------------------------- the score */

// DIST_POINTS for every DIST_STEP world units flown, and the flawless stage's
// bonus, times the stage.
export const DIST_STEP = 10;
export const DIST_POINTS = 1;
export const FLAWLESS_POINTS = 50;

// Distance flown pays as it adds up, double while a tailwind runs.
function scoreDistance(round, step, tailwind) {
  round.flown += step;
  while (round.flown >= DIST_STEP) {
    round.flown -= DIST_STEP;
    round.score += DIST_POINTS * (tailwind ? 2 : 1);
  }
}

/* ------------------------------------------------------------- the layout */

// A stage opens calm, ends calm before its portal, and holds a calm stretch at
// its halfway marker, where a lost life restarts. At every distance the flock
// keeps a clear gap at least GAP_MIN tall. A hazard that would close it is
// dealt again, and after PLACE_TRIES it is left out.
export const SAFE_START = 60;
export const SAFE_END = 40;
export const GAP_MIN = 9;
const PLACE_TRIES = 12;

// The shapes, in field units.
export const BALLOON_R_MIN = 3;
export const BALLOON_R_MAX = 4.5;
const BALLOON_DRIFT_MIN = 1.5;
const BALLOON_DRIFT_MAX = 3.5;
export const CLUSTER_SWAY = 4;
const CLUSTER_SPREAD = 4.5;
const CLUSTER_R_MIN = 1.8;
const CLUSTER_R_MAX = 2.4;
export const KITE_R = 2.2;
export const KITE_SWAY = 3;
export const GUST_H_MIN = 6;
export const GUST_H_MAX = 9;
export const GUST_W = 16;
export const STREAM_H_MIN = 8;
export const STREAM_H_MAX = 12;
export const STREAM_W_MIN = 40;
export const STREAM_W_MAX = 80;
export const STORM_W = 12;
export const STORM_H = 5;
const STORM_DRIFT = 12;
const STORM_BEAT_MIN = 2000;
const STORM_BEAT_MAX = 3000;

const between = (random, lo, hi) => lo + random() * (hi - lo);

// One hazard of a kind at distance `x`, in its resting place. A balloon, bunch,
// kite and thundercloud are centered on x; a gust and a slipstream start there.
function dealHazard(kind, x, random) {
  const flip = random() < 0.5;
  if (kind === "balloon") {
    const r = between(random, BALLOON_R_MIN, BALLOON_R_MAX);
    const drift = between(random, BALLOON_DRIFT_MIN, BALLOON_DRIFT_MAX);
    return { kind, x, y: between(random, EDGE + r, FIELD_H - EDGE - r), w: r * 2, h: r * 2, r, vx: 0, vy: flip ? drift : -drift };
  }
  if (kind === "cluster") {
    const count = 3 + Math.floor(random() * 3);
    const parts = [];
    for (let i = 0; i < count; i++) {
      parts.push({ dx: between(random, -CLUSTER_SPREAD, CLUSTER_SPREAD), dy: between(random, -CLUSTER_SPREAD, CLUSTER_SPREAD), r: between(random, CLUSTER_R_MIN, CLUSTER_R_MAX) });
    }
    const reach = CLUSTER_SPREAD + CLUSTER_R_MAX + CLUSTER_SWAY;
    const home = between(random, EDGE + reach, FIELD_H - EDGE - reach);
    return { kind, x, y: home, home, w: (CLUSTER_SPREAD + CLUSTER_R_MAX) * 2, h: (CLUSTER_SPREAD + CLUSTER_R_MAX) * 2, vx: 0, vy: 0, parts, phase: random() * TAU, t: 0 };
  }
  if (kind === "kite") {
    const top = flip;
    const y = top ? between(random, 14, 30) : between(random, 24, 40);
    return { kind, x, y, w: (KITE_SWAY + KITE_R) * 2, h: KITE_R * 2, vx: 0, vy: 0, top, tipX: x, phase: random() * TAU, t: 0 };
  }
  if (kind === "gust") {
    const h = between(random, GUST_H_MIN, GUST_H_MAX);
    return { kind, x, y: between(random, EDGE + h / 2, FIELD_H - EDGE - h / 2), w: GUST_W, h, vx: 0, vy: 0, live: false };
  }
  if (kind === "stream") {
    const h = between(random, STREAM_H_MIN, STREAM_H_MAX);
    return { kind, x, y: between(random, EDGE + h / 2, FIELD_H - EDGE - h / 2), w: between(random, STREAM_W_MIN, STREAM_W_MAX), h, vx: 0, vy: 0 };
  }
  const beat = between(random, STORM_BEAT_MIN, STORM_BEAT_MAX);
  return { kind, x, y: flip ? STORM_H : FIELD_H - STORM_H, w: STORM_W, h: STORM_H, vx: -STORM_DRIFT, vy: 0, top: flip, beat, timer: beat, phase: "idle", col: x };
}

// How far along a hazard reaches, from and to.
export function spanOf(h) {
  if (h.kind === "gust" || h.kind === "stream") return [h.x, h.x + h.w];
  return [h.x - h.w / 2, h.x + h.w / 2];
}

// The heights a hazard blocks at rest, for the ones that stand in the way: a
// gust and a slipstream never block, and lightning passes.
function bandOf(h) {
  if (h.kind === "balloon") return [h.y - h.r, h.y + h.r];
  if (h.kind === "cluster") return [h.home - h.h / 2 - CLUSTER_SWAY, h.home + h.h / 2 + CLUSTER_SWAY];
  if (h.kind === "kite") return h.top ? [0, h.y + KITE_R] : [h.y - KITE_R, FIELD_H];
  return null;
}

// The tallest clear stretch of height, [lo, hi], across the distances `from` to
// `to`, between the edges the leader may fly.
function clearBand(hazards, from, to) {
  const bands = [];
  for (const h of hazards) {
    const band = bandOf(h);
    if (!band) continue;
    const [start, end] = spanOf(h);
    if (to >= start && from <= end) bands.push(band);
  }
  bands.sort((a, b) => a[0] - b[0]);
  let best = [EDGE, EDGE];
  let y = EDGE;
  for (const [lo, hi] of bands) {
    const top = Math.min(lo, FIELD_H - EDGE);
    if (top - y > best[1] - best[0]) best = [y, top];
    y = Math.max(y, hi);
  }
  if (FIELD_H - EDGE - y > best[1] - best[0]) best = [y, FIELD_H - EDGE];
  return best;
}

// The tallest clear gap at distance `x`.
export function clearGap(hazards, x) {
  const [lo, hi] = clearBand(hazards, x, x);
  return hi - lo;
}

// Whether a new hazard leaves the gap open everywhere it reaches: the gap only
// changes where a hazard starts or stops, so those distances are enough.
function leavesGap(hazards, h) {
  const list = [...hazards, h];
  const [from, to] = spanOf(h);
  const marks = [from, to];
  for (const other of hazards) {
    for (const x of spanOf(other)) if (x >= from && x <= to) marks.push(x);
  }
  return marks.every((x) => clearGap(list, x) >= GAP_MIN);
}

function pickKind(weights, random) {
  const kinds = Object.keys(weights);
  let roll = random() * kinds.reduce((sum, k) => sum + weights[k], 0);
  for (const k of kinds) {
    roll -= weights[k];
    if (roll < 0) return k;
  }
  return kinds[kinds.length - 1];
}

// The stage's layout, by distance from its start. The same seed and stage always
// give the same list. The kind this stage introduces comes first, so it always
// turns up.
export function buildStage(seed, n) {
  const stage = stageFor(n);
  const { length } = stage;
  const random = seeded(seed + n * 7919);
  const midFrom = length / 2;
  const midTo = midFrom + SAFE_START;
  const fits = (h) => {
    const [from, to] = spanOf(h);
    return from >= SAFE_START && to <= length - SAFE_END && (to <= midFrom || from >= midTo);
  };
  const hazards = [];
  let fresh = Object.keys(HAZARDS).find((k) => HAZARDS[k].from === n && stage.hazards[k]) || null;
  let at = SAFE_START + STORM_W;
  while (at < length - SAFE_END) {
    for (let tries = 0; tries < PLACE_TRIES; tries++) {
      const h = dealHazard(fresh || pickKind(stage.hazards, random), at, random);
      if (!fits(h) || !leavesGap(hazards, h)) continue;
      hazards.push(h);
      fresh = null;
      break;
    }
    at += between(random, stage.gap[0], stage.gap[1]);
  }
  return { hazards, length, crates: placeCrates(hazards, length, random) };
}

// How close the leader must come to a crate, and how far along a crate looks for
// a better spot when hazards crowd the height where it would sit.
export const CRATE_R = PICK_R + 0.8;
const CRATE_SLIDE = 6;
const CRATE_WEIGHTS = Object.freeze(Object.fromEntries(POWER_KINDS.map((k) => [k, POWERS[k].weight])));

// A crate every CRATE_EVERY units, in the tallest clear height all along its
// reach, so it can always be flown to. Dealt after the hazards, so crates never
// change a stage's layout.
function placeCrates(hazards, length, random) {
  const crates = [];
  let at = between(random, CRATE_EVERY[0], CRATE_EVERY[1]);
  while (at < length - SAFE_END) {
    let x = at;
    for (let tries = 0; tries < PLACE_TRIES && x < length - SAFE_END; tries++, x += CRATE_SLIDE) {
      const [lo, hi] = clearBand(hazards, x - CRATE_R, x + CRATE_R);
      if (hi - lo < GAP_MIN) continue;
      crates.push({ kind: pickKind(CRATE_WEIGHTS, random), x, y: between(random, lo + CRATE_R, hi - CRATE_R) });
      break;
    }
    at += between(random, CRATE_EVERY[0], CRATE_EVERY[1]);
  }
  return crates;
}

/* ---------------------------------------------------------------- hazards */

// A bird's size for every hit, how thick a kite's string counts, how far ahead
// of the right edge a hazard starts to move, and how far behind the left edge
// it is dropped, so nothing off the board can snap a bird you cannot see.
export const BIRD_R = 0.9;
const STRING_R = 0.4;
const WAKE_AHEAD = 10;
const HAZARD_BEHIND = 6;
// A gust shows at the right edge first, then sweeps right to left at this many
// times the stage's speed, shoving the leader back as it goes.
export const GUST_WARN_MS = 1000;
export const GUST_SPEED = 3;
export const GUST_SHOVE = 30;
// A slipstream's lane speeds the sky while the leader rides it. Its ends are
// safe, so a line can fly in at the front and out at the back, but a line
// straddling either long edge snaps at once. Its streaks flow toward the player
// at twice the stage's speed (the drawing's).
export const STREAM_BOOST = 10;
// A thunderhead rides with the sky, slipping back slowly enough to stay for a
// few beats. It flashes a warning column that holds still on the board, then
// strikes down it, reaching this far from the cloud, so the far part of the
// field stays clear and a strike can be dodged by height.
export const STORM_WARN_MS = 700;
export const STORM_STRIKE_MS = 250;
export const STORM_COL = 3.5;
export const STORM_REACH = 30;
const CLUSTER_RATE = 0.0012;
const KITE_RATE = 0.0016;

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// One warning sound for a kind of hazard at a time, however many warn together.
function warnOnce(round, kind, ms) {
  if (round.now < round.warned[kind]) return;
  round.warned[kind] = round.now + ms;
  round.events.push({ type: kind });
}

// A gust whose distance has reached the right edge warns there, its arrows at
// its height, then goes live. The sky scrolls too, so its own world speed is
// the rest of GUST_SPEED.
function moveGust(round, h, dt) {
  const edge = round.scroll + FIELD_W;
  if (h.warnAt === undefined) {
    if (h.x > edge) return;
    h.warnAt = round.now;
    h.liveAt = round.now + GUST_WARN_MS;
    h.vx = -(GUST_SPEED - 1) * round.speed;
    warnOnce(round, "gust", GUST_WARN_MS);
  }
  if (round.now < h.liveAt) {
    h.x = edge;
    return;
  }
  h.live = true;
  h.x += h.vx * dt;
}

// The cloud keeps up with the sky, less its drift, and its column keeps up
// whole, so what flashes is where the bolt lands. Once over the board it beats:
// idle, a warning column at where the cloud is then, a strike down it, idle.
function moveStorm(round, h, dt) {
  const pace = round.pace ?? round.speed;
  h.x += (pace + h.vx) * dt;
  h.col += pace * dt;
  const sx = h.x - round.scroll;
  if (h.phase === "idle" && (sx < 0 || sx > FIELD_W)) return;
  h.timer -= dt * 1000;
  if (h.timer > 0) return;
  if (h.phase === "idle") {
    h.phase = "warn";
    h.col = h.x;
    h.timer = STORM_WARN_MS;
    warnOnce(round, "storm", STORM_WARN_MS);
  } else if (h.phase === "warn") {
    h.phase = "strike";
    h.timer = STORM_STRIKE_MS;
    round.events.push({ type: "strike" });
  } else {
    h.phase = "idle";
    h.timer = h.beat;
  }
}

// The heights a strike reaches, from the cloud toward the far edge.
export const strikeBand = (h) => (h.top ? [h.y, h.y + STORM_REACH] : [h.y - STORM_REACH, h.y]);

// Whether a point is inside a gust's or a lane's rectangle.
const inRect = (h, x, y) => x >= h.x && x <= h.x + h.w && Math.abs(y - h.y) <= h.h / 2;

// Moves what is near the board by `dt` seconds, and drops what has gone past
// it. A balloon drifts and bounces off the edges, a bunch rides a slow sine, a
// kite sways on its string.
export function moveHazards(round, dt) {
  const ms = dt * 1000;
  const right = round.scroll + FIELD_W + WAKE_AHEAD;
  for (const h of round.hazards) {
    if (h.kind === "gust") {
      moveGust(round, h, dt);
    } else if (h.x > right) {
      continue;
    } else if (h.kind === "balloon") {
      h.y += h.vy * dt;
      if (h.y < h.r || h.y > FIELD_H - h.r) {
        h.y = clamp(h.y, h.r, FIELD_H - h.r);
        h.vy = -h.vy;
      }
    } else if (h.kind === "cluster") {
      h.t += ms;
      h.y = h.home + Math.sin(h.phase + h.t * CLUSTER_RATE) * CLUSTER_SWAY;
    } else if (h.kind === "kite") {
      h.t += ms;
      h.tipX = h.x + Math.sin(h.phase + h.t * KITE_RATE) * KITE_SWAY;
    } else if (h.kind === "storm") {
      moveStorm(round, h, dt);
    }
  }
  round.hazards = round.hazards.filter((h) => spanOf(h)[1] - round.scroll >= -HAZARD_BEHIND);
}

// Whether a hazard hits a point with radius `r`.
export function hazardHits(h, x, y, r) {
  if (h.kind === "balloon") return Math.hypot(x - h.x, y - h.y) <= h.r + r;
  if (h.kind === "cluster") return h.parts.some((p) => Math.hypot(x - (h.x + p.dx), y - (h.y + p.dy)) <= p.r + r);
  if (h.kind === "kite") {
    if (Math.hypot(x - h.tipX, y - h.y) <= KITE_R + r) return true;
    return distToSegment(x, y, h.x, h.top ? 0 : FIELD_H, h.tipX, h.y) <= STRING_R + r;
  }
  // A gust's warning never counts.
  if (h.kind === "gust") return h.live && inRect(h, x, y);
  // A warning column never counts either, and a cloud on its own is harmless.
  if (h.kind === "storm") {
    if (h.phase !== "strike") return false;
    const [lo, hi] = strikeBand(h);
    return Math.abs(x - h.col) <= STORM_COL / 2 + r && y >= lo - r && y <= hi + r;
  }
  return false;
}

/* ---------------------------------------------------------------- banners */

// A banner is a strip across the field, placed on its first frame on the part
// away from the leader. While the leader, a follower, a hazard or the portal
// is in its strip it fades to BANNER_SEE_THROUGH, so it never hides what is
// coming. One shows at a time; a queued one waits for the one showing.
export const BANNER_HALF = 6;
const BANNER_MARGIN = 1;
export const BANNER_SEE_THROUGH = 0.12;
export const BANNER_FADE_MS = 140;

export function banner(round, text, sub, color, ms = 1800) {
  round.banner = { text, sub, color, until: round.now + ms, ms, row: null, see: 1 };
  return round.banner;
}

function queueBanner(round, text, sub, color, ms) {
  if (round.banner) round.bannerQueue.push([text, sub, color, ms]);
  else banner(round, text, sub, color, ms);
}

// The upper or lower part of the field, whichever is away from the leader.
export const bannerRow = (round) => (round.leader.y < FIELD_H / 2 ? FIELD_H * 0.74 : FIELD_H * 0.3);

// The heights a hazard takes up right now: a lightning warning its whole column.
function heightsNow(h) {
  if (h.kind === "kite") return h.top ? [0, h.y + KITE_R] : [h.y - KITE_R, FIELD_H];
  if (h.kind === "storm" && h.phase !== "idle") return strikeBand(h);
  return [h.y - h.h / 2, h.y + h.h / 2];
}

// Whether anything the player must watch is in a banner's strip.
export function underBanner(round, shown = round.banner) {
  const row = shown.row === null ? bannerRow(round) : shown.row;
  const reach = BANNER_HALF + BANNER_MARGIN;
  const inStrip = (lo, hi = lo) => hi > row - reach && lo < row + reach;
  const onBoard = (from, to = from) => to - round.scroll >= 0 && from - round.scroll <= FIELD_W;
  const { leader, portal } = round;
  if (inStrip(leader.y)) return true;
  if (round.flock.some((b) => onBoard(b.x) && inStrip(b.y))) return true;
  if (onBoard(portal.x) && inStrip(portal.y - portal.h / 2, portal.y + portal.h / 2)) return true;
  return round.hazards.some((h) => {
    const [from, to] = spanOf(h);
    if (!onBoard(from, to)) return false;
    const [lo, hi] = heightsNow(h);
    return inStrip(lo, hi);
  });
}

function easeBanner(round, ms) {
  const shown = round.banner;
  if (!shown) return;
  if (shown.row === null) shown.row = bannerRow(round);
  const target = underBanner(round, shown) ? BANNER_SEE_THROUGH : 1;
  shown.see += (target - shown.see) * Math.min(1, ms / BANNER_FADE_MS);
  if (round.now < shown.until) return;
  round.banner = null;
  const next = round.bannerQueue.shift();
  if (next) banner(round, ...next);
}

const stageBanner = (round) => {
  const stage = stageFor(round.stage);
  return [`Stage ${round.stage}: ${stage.title}`, stage.sub, STAGE_COLOR, 2200];
};

export const showStageBanner = (round) => banner(round, ...stageBanner(round));

/* ------------------------------------------------------------------ snaps */

// A snap leaves the birds behind it loose for SCATTER_MS, when the leader can
// gather them again. They keep up with the sky, spread out from the line and
// slip a little backward, so the leader can ease back to them; once their time
// is up they fly off the top or bottom.
export const SCATTER_MS = 3000;
const SCATTER_OUT_MIN = 6;
const SCATTER_OUT_MAX = 12;
const SCATTER_BACK_MIN = 1;
const SCATTER_BACK_MAX = 3;
const SCATTER_SLOW = 0.8;
const SCATTER_FLEE = 30;

// Cuts the flock at follower k (1-based): that bird and every one behind it go
// loose. Returns how many.
export function snapAt(round, k, now = round.now) {
  const lost = round.flock.splice(k - 1);
  if (!lost.length) return 0;
  lost.forEach((bird, i) => {
    const out = between(round.random, SCATTER_OUT_MIN, SCATTER_OUT_MAX);
    round.scattered.push({
      id: bird.id,
      x: bird.x,
      y: bird.y,
      vx: -between(round.random, SCATTER_BACK_MIN, SCATTER_BACK_MAX),
      vy: i % 2 ? out : -out,
      until: now + SCATTER_MS,
    });
  });
  round.snaps += 1;
  banner(round, "Line broken!", `${lost.length} loose. Grab them back!`, DANGER, 1400);
  return lost.length;
}

// Loose birds drift with the sky at `pace`. A bird still in time bounces off
// the edges and slows its spread; a late one flies off and is dropped.
function moveScattered(round, dt, pace) {
  round.scattered = round.scattered.filter((b) => {
    b.x += (pace + b.vx) * dt;
    if (round.now >= b.until) {
      b.y += (b.vy < 0 ? -SCATTER_FLEE : SCATTER_FLEE) * dt;
      return b.y >= -BIRD_R * 2 && b.y <= FIELD_H + BIRD_R * 2;
    }
    b.vy *= 1 - SCATTER_SLOW * dt;
    b.y += b.vy * dt;
    if (b.y < EDGE || b.y > FIELD_H - EDGE) {
      b.y = clamp(b.y, EDGE, FIELD_H - EDGE);
      b.vy = -b.vy;
    }
    return true;
  });
}

// From the front of the flock, so the first bird hit is the snap point.
// A tailwind carries the line through gusts, and grace protects it too, so a
// shield just spent is not spent again on the same hazard.
function snapFlock(round) {
  const { flock, leader } = round;
  if (!flock.length || leader.grace > 0) return;
  const right = round.scroll + FIELD_W + WAKE_AHEAD;
  const through = round.active.tailwind > 0;
  const near = round.hazards.filter((h) => h.kind !== "stream" && !(through && h.kind === "gust") && h.x <= right);
  const i = flock.findIndex((bird) => near.some((h) => hazardHits(h, bird.x, bird.y, BIRD_R)));
  if (i >= 0) breakLine(round, i + 1);
}

// A shield keeps the flock whole; without one the line snaps at follower k.
function breakLine(round, k) {
  if (soak(round)) return;
  snapAt(round, k);
  round.events.push({ type: "snap" });
}

// Whether two neighbors sit on opposite sides of one of a lane's long edges:
// both alongside the lane, one inside its height and one not.
function straddles(h, a, b) {
  const alongside = (p) => p.x >= h.x && p.x <= h.x + h.w;
  const within = (p) => Math.abs(p.y - h.y) <= h.h / 2;
  return alongside(a) && alongside(b) && within(a) !== within(b);
}

// The line snaps at the first bird straddling a long edge with the one ahead of
// it. A line all in, all out, or crossing an end has no such pair.
function snapAtStream(round) {
  const { flock, leader } = round;
  const lanes = round.hazards.filter((h) => h.kind === "stream");
  if (!flock.length || !lanes.length || leader.grace > 0) return;
  let ahead = leader;
  for (let i = 0; i < flock.length; i++) {
    if (lanes.some((h) => straddles(h, ahead, flock[i]))) {
      breakLine(round, i + 1);
      return;
    }
    ahead = flock[i];
  }
}

/* ------------------------------------------------------- lives and grace */

// A hit stops the flight for CRASH_MS, then the stretch plays again with
// GRACE_MS when nothing can hit the leader.
export const GRACE_MS = 1600;
export const CRASH_MS = 1000;

// A life gone (none while endless), the whole flock loose, the flight stopped.
function crash(round) {
  const { leader } = round;
  if (!round.infinite) round.lives -= 1;
  round.lost += 1;
  round.events.push({ type: "hit" });
  round.active.tailwind = 0;
  round.active.magnet = 0;
  snapAt(round, 1);
  leader.alive = false;
  leader.vy = 0;
  round.crashAt = round.now + CRASH_MS;
  round.bannerQueue = [];
  if (round.lives <= 0) {
    round.over = true;
    round.banner = null;
    return;
  }
  const left = round.infinite ? "Endless lives" : round.lives === 1 ? "Last life!" : `${round.lives} lives left`;
  banner(round, "Hit!", left, DANGER, CRASH_MS + 400);
}

// Spends a shield if there is one, with a moment's grace.
function soak(round) {
  if (round.active.shields <= 0) return false;
  round.active.shields -= 1;
  round.leader.grace = SHIELD_GRACE;
  round.events.push({ type: "shield" });
  return true;
}

// A hazard on the leader: nothing during grace or a crash already under way,
// and a shield takes it in place of a life.
export function hitLeader(round) {
  const { leader } = round;
  if (leader.grace > 0 || !leader.alive) return false;
  if (soak(round)) return false;
  crash(round);
  return true;
}

// Back to the last calm point passed, the stage's start or its halfway marker,
// with the layout from there on as it first was, so a replay meets the same sky.
function restartStretch(round) {
  const { leader } = round;
  const mid = round.base + round.length / 2;
  round.scroll = round.scroll >= mid ? mid : round.base;
  const layout = placeLayout(round);
  round.hazards = layout.hazards.filter((h) => spanOf(h)[1] - round.scroll >= -HAZARD_BEHIND);
  round.crates = layout.crates.filter((c) => c.x >= round.scroll);
  round.path = [];
  round.strays = [];
  round.scattered = [];
  round.nextStray = null;
  leader.alive = true;
  leader.grace = GRACE_MS;
  leader.sx = START_SX;
  leader.x = round.scroll + START_SX;
  leader.y = FIELD_H / 2;
  leader.vy = 0;
}

/* ------------------------------------------------------------- the portal */

// The jet stream portal ends a stage. A big enough flock forms a V there, which
// pays by its size and the stage, while hazards stop; a smaller one flies on
// with nothing. The last stage's ring is small and sways, and it must be flown
// through: a miss costs a life and replays the stretch.
export const V_POINTS = 20;
export const PORTAL_H = 30;
export const PORTAL_H_FINAL = 14;
export const FINAL_SWAY = 14;
export const FINAL_PERIOD_MS = 2400;
export const V_MS = 1600;
export const V_GAP = 2.2;
const V_SLANT = 0.55;
const V_BLEND_MS = 400;

const newPortal = (round, stage) => ({
  x: round.base + stage.length,
  y: FIELD_H / 2,
  h: round.stage === MAX_STAGE ? PORTAL_H_FINAL : PORTAL_H,
  vy: 0,
  min: stage.min,
  passed: false,
  v: null,
  t: 0,
  flawless: 0,
});

const win = (round) => {
  round.won = true;
  round.over = true;
  round.bannerQueue = [];
  banner(round, "You made it!", "Through the jet stream", GOLD, 4000);
};

// A stage with no snap and no life lost pays by its number, once through the
// ring; the banner to show after whatever the portal shows first, or null.
function payFlawless(round) {
  if (round.snaps !== 0 || round.lost !== 0) return null;
  const points = FLAWLESS_POINTS * round.stage;
  round.score += points;
  round.portal.flawless = points;
  round.events.push({ type: "flawless" });
  return ["Flawless!", `+${points}`, GOLD, 1400];
}

// Marks the portal passed once the leader's world x reaches it, and says how:
// "v", "short", "missed", "won", or null while it is still ahead.
export function reachPortal(round) {
  const { portal, leader, flock } = round;
  if (portal.passed || leader.x < portal.x) return null;
  const inside = Math.abs(leader.y - portal.y) <= portal.h / 2;
  const final = round.stage === MAX_STAGE;
  if (final && !inside) {
    crash(round);
    if (!round.over) banner(round, "Missed the portal!", round.banner.sub, DANGER, CRASH_MS + 400);
    return "missed";
  }
  portal.passed = true;
  if (!inside) {
    banner(round, "Missed the portal", "No V this time", STAGE_COLOR, 1200);
    beginStage(round, round.stage + 1);
    queueBanner(round, ...stageBanner(round));
    return "missed";
  }
  round.events.push({ type: "portal" });
  const flawless = payFlawless(round);
  if (flock.length >= portal.min) {
    portal.v = { t: 0 };
    round.events.push({ type: "v" });
    const points = flock.length * round.stage * V_POINTS;
    round.score += points;
    banner(round, `V formation! +${points}`, `${flock.length} birds`, GOLD, V_MS);
    if (flawless) queueBanner(round, ...flawless);
    return "v";
  }
  if (final) {
    win(round);
    return "won";
  }
  banner(round, `Need ${portal.min} birds for the V`, `You had ${flock.length}`, STAGE_COLOR, 1200);
  if (flawless) queueBanner(round, ...flawless);
  beginStage(round, round.stage + 1);
  queueBanner(round, ...stageBanner(round));
  return "short";
}

// The V's clock: when it is done, the next stage begins, or the last one wins.
function playV(round, ms) {
  const { v } = round.portal;
  v.t += ms;
  if (v.t < V_MS) return;
  if (round.stage === MAX_STAGE) {
    round.portal.v = null;
    win(round);
  } else {
    beginStage(round, round.stage + 1);
    queueBanner(round, ...stageBanner(round));
  }
}

// The last portal sways on a sine.
function swayPortal(round, ms) {
  const { portal } = round;
  if (round.stage !== MAX_STAGE || portal.passed) return;
  portal.t += ms;
  const y = FIELD_H / 2 + Math.sin((portal.t / FINAL_PERIOD_MS) * TAU) * FINAL_SWAY;
  portal.vy = (y - portal.y) / (ms / 1000);
  portal.y = y;
}

// During a V each follower blends from the path to its slot: alternating arms
// behind the leader, V_GAP apart, kept inside the field.
function blendV(round) {
  const { flock, leader, portal } = round;
  const { t } = portal.v;
  const blend = clamp(Math.min(t, V_MS - t) / V_BLEND_MS, 0, 1);
  flock.forEach((bird, i) => {
    const arm = (i >> 1) + 1;
    const side = i % 2 ? 1 : -1;
    const x = leader.x - arm * V_GAP;
    const y = clamp(leader.y + side * arm * V_GAP * V_SLANT, EDGE, FIELD_H - EDGE);
    bird.x += (x - bird.x) * blend;
    bird.y += (y - bird.y) * blend;
  });
}

/* ----------------------------------------------------------- the power-ups */

export function applyPower(round, kind) {
  const spec = POWERS[kind];
  if (!spec) return;
  if (kind === "shield") round.active.shields = Math.min(MAX_SHIELDS, round.active.shields + 1);
  else round.active[kind] = spec.ms;
}

// Crates the leader touches open; ones left behind are dropped.
function openCrates(round) {
  const { leader } = round;
  round.crates = round.crates.filter((c) => {
    if (c.x - round.scroll < -STRAY_BEHIND) return false;
    if (Math.hypot(c.x - leader.x, c.y - leader.y) > CRATE_R) return true;
    const spec = POWERS[c.kind];
    applyPower(round, c.kind);
    round.events.push({ type: "power" });
    banner(round, spec.name, spec.blurb, spec.color, 1400);
    return false;
  });
}

// A magnet draws in the strays within reach, and the scattered birds still in
// time.
function pullLoose(round, dt) {
  if (round.active.magnet <= 0) return;
  const { leader } = round;
  const pull = (bird) => {
    const d = Math.hypot(leader.x - bird.x, leader.y - bird.y);
    if (!d || d > MAGNET_REACH) return;
    const step = Math.min(d, MAGNET_PULL * dt);
    bird.x += ((leader.x - bird.x) / d) * step;
    bird.y += ((leader.y - bird.y) / d) * step;
  };
  round.strays.forEach(pull);
  round.scattered.filter((b) => round.now < b.until).forEach(pull);
}

// What the strip shows for the power-ups running: seconds left, or the count.
export function powerPills(round) {
  const { active } = round;
  const timed = (kind) => (active[kind] > 0 ? [{ text: `${POWERS[kind].name} ${Math.ceil(active[kind] / 1000)}s`, color: POWERS[kind].color, fill: active[kind] / POWERS[kind].ms }] : []);
  const shield = active.shields > 0 ? [{ text: `${POWERS.shield.name} x${active.shields}`, color: POWERS.shield.color, fill: 1 }] : [];
  return [...timed("tailwind"), ...shield, ...timed("magnet")];
}

/* --------------------------------------------------------- advancing time */

// A live gust costs no life: it pushes the leader back toward the band's start.
// A tailwind flies straight through.
function shoveLeader(round, dt) {
  const { leader } = round;
  if (round.active.tailwind > 0) return;
  if (!round.hazards.some((h) => h.kind === "gust" && h.live && inRect(h, leader.x, leader.y))) return;
  leader.sx = clamp(leader.sx - GUST_SHOVE * dt, BAND_MIN, BAND_MAX);
  leader.x = round.scroll + leader.sx;
}

// Whether a point is inside any slipstream's lane.
const inStream = (round, x, y) => round.hazards.some((h) => h.kind === "stream" && inRect(h, x, y));

function update(round, ms) {
  const dt = ms / 1000;
  round.now += ms;
  if (round.combo > 1 && round.now - round.comboAt > COMBO_MS) round.combo = 1;
  const { leader, active } = round;
  if (!leader.alive) {
    moveScattered(round, dt, 0);
    if (round.now >= round.crashAt) restartStretch(round);
    return;
  }
  leader.grace = Math.max(0, leader.grace - ms);
  const tailwind = active.tailwind > 0;
  active.tailwind = Math.max(0, active.tailwind - ms);
  active.magnet = Math.max(0, active.magnet - ms);
  const pace = round.speed * (tailwind ? 1 + TAILWIND_BOOST : 1) + (inStream(round, leader.x, leader.y) ? STREAM_BOOST : 0);
  round.pace = pace;
  round.scroll += pace * dt;
  scoreDistance(round, pace * dt, tailwind);
  steer(round, ms);
  shoveLeader(round, dt);
  recordPath(round);
  placeFlock(round);
  openCrates(round);
  pullLoose(round, dt);
  const near = (s) => Math.hypot(s.x - leader.x, s.y - leader.y) <= PICK_R;
  const caught = [...round.strays.filter(near), ...round.scattered.filter((s) => round.now < s.until && near(s))];
  for (const bird of caught) collect(round, bird);
  // A bird that just joined needs its place before anything draws it.
  if (caught.length) placeFlock(round);
  round.strays = round.strays.filter((s) => s.x - round.scroll >= -STRAY_BEHIND);
  spawnStrays(round, round.random);
  moveScattered(round, dt, pace);
  // Hazards stop for a V.
  if (round.portal.v) {
    playV(round, ms);
    return;
  }
  moveHazards(round, dt);
  const right = round.scroll + FIELD_W + WAKE_AHEAD;
  if (round.hazards.some((h) => h.kind !== "gust" && h.x <= right && hazardHits(h, leader.x, leader.y, BIRD_R)) && hitLeader(round)) return;
  snapFlock(round);
  snapAtStream(round);
  swayPortal(round, ms);
  reachPortal(round);
}

// Moves the round on by `ms`, in small slices.
export function advance(round, ms) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    update(round, slice);
  }
  easeBanner(round, ms);
  return round.over ? "over" : "running";
}

/* ---------------------------------------------------------- the contract */

const MOVES = Object.freeze({ up: true, down: true, left: true, right: true });

// The music: the person's songs, under `songs` in flock-sfx.js. A run deals them
// in a random order and plays each in full, one after another, from the top of
// the first; once the last has played they are dealt again, never opening on the
// song that just ended, and a new run never opens on the song the last was playing.
export const MUSIC_TRACKS = Object.freeze(["flockSong1", "flockSong2", "flockSong3", "flockSong4", "flockSong5"]);

// Every song in a new order, shuffled with the given random, the first never `last`.
export function dealMusic(random = Math.random, last = null) {
  const deck = [...MUSIC_TRACKS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (deck[0] === last) [deck[0], deck[1]] = [deck[1], deck[0]];
  return deck;
}

// How much louder than made the game's sounds play (tones.js's `louder`), so they
// carry over the songs. The wind's hums stay as they are, low under them.
export const SFX_LOUDER = 1.4;

// Which sound each of the round's events plays, and how loud.
const EVENT_SOUNDS = Object.freeze({
  rejoin: Object.freeze(["flockRejoin", 0.7]),
  snap: Object.freeze(["flockSnap", 0.8]),
  hit: Object.freeze(["flockHit", 1]),
  shield: Object.freeze(["flockShield", 0.8]),
  power: Object.freeze(["flockPower", 0.8]),
  gust: Object.freeze(["flockGust", 0.7]),
  storm: Object.freeze(["flockThunder", 0.7]),
  strike: Object.freeze(["flockStrike", 0.8]),
  portal: Object.freeze(["flockPortal", 0.8]),
  v: Object.freeze(["flockV", 0.9]),
  flawless: Object.freeze(["flockFlawless", 0.9]),
  stage: Object.freeze(["flockStage", 0.7]),
});
const CHIRP_STEP = 0.08;

function create({ canvas, tone: playTone = () => {}, hum = () => {}, music = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const tone = (name, level = 1, pitch = 1) => playTone(name, level, pitch, SFX_LOUDER);
  // A little pitch wobble so a repeated sound never plays twice the same.
  const vary = (k = 0.06) => 1 + (Math.random() - 0.5) * 2 * k;
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  // Drives what moves on its own (wings, a stray's bob), so a paused frame
  // stays still.
  let clock = 0;
  // The furthest stage kept, on each new stage reached and at the round's end.
  let lastStage = 1;
  const keepFurthest = () => {
    if (!memo) return;
    try {
      if (round.stage > (Number(memo.get()) | 0)) memo.set(round.stage);
    } catch {}
  };
  const furthestNow = () => {
    try {
      return memo ? Math.max(round.stage, Number(memo.get()) | 0) : round.stage;
    } catch {
      return round.stage;
    }
  };
  // The best this round began with, and whether the round has announced passing
  // it. The news waits for a clear banner rather than the queue, which a crash
  // empties.
  let bestAtStart = 0;
  let beaten = false;
  const checkBest = () => {
    if (beaten || round.banner || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("flockBest");
    banner(round, "New best!", "Every point from here is a record", GOLD, 1800);
  };
  // The round's news as sounds; sounds never change the round.
  const drainSounds = () => {
    for (const e of round.events) {
      if (e.type === "chirp") tone("flockChirp", 0.7, (1 + CHIRP_STEP * (e.combo - 1)) * vary(0.03));
      else if (EVENT_SOUNDS[e.type]) tone(EVENT_SOUNDS[e.type][0], EVENT_SOUNDS[e.type][1], vary());
    }
    round.events.length = 0;
  };
  // The wind follows the speed; the rush only while the leader rides a lane.
  const holdHums = () => {
    const { leader } = round;
    if (!leader.alive) return;
    const speed = (round.pace ?? round.speed) / STAGES[MAX_STAGE].speed;
    hum("flock:wind", "flockWind", 0.7, 0.75 + 0.55 * speed);
    if (inStream(round, leader.x, leader.y)) hum("flock:stream", "flockStream", 0.8, 0.85 + 0.4 * speed);
  };
  // The run's deal of songs, the one playing in it, and whether that one starts
  // from its top.
  let deck = [];
  let songAt = 0;
  let fresh = true;
  // Keeps the song going; once it has played through, the next in the deal, and
  // after the last a fresh deal.
  const playMusic = () => {
    const heard = music(deck[songAt], 1, fresh ? { restart: true } : undefined);
    if (heard) fresh = false;
    if (heard !== "ended") return;
    songAt += 1;
    if (songAt >= deck.length) {
      deck = dealMusic(Math.random, deck.at(-1));
      songAt = 0;
    }
    fresh = true;
  };
  const view = {
    g: { FIELD_W, FIELD_H, HUD_H, PAD, W, H, STORM_COL, STORM_REACH, KITE_R, BANNER_HALF, MAGNET_REACH, MAX_STAGE, CLIMB, V_MS },
    round,
    state,
    u,
    clock,
    colors,
    pillH: 2.4,
    hud: null,
    end: null,
  };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    view.round = round;
    view.state = state;
    view.u = u;
    view.clock = clock;
    view.colors = colors;
    // A pill stays at least 12 pixels tall on a small board.
    view.pillH = Math.max(12 / u, 2.4);
    view.hud = { stage: `Stage ${round.stage}: ${stageFor(round.stage).title}`, score: round.score, flock: round.flock.length, min: round.portal.min, combo: round.combo, powers: powerPills(round) };
    // A banner takes its place on its first frame.
    if (round.banner && round.banner.row === null) round.banner.row = bannerRow(round);
    drawScene(ctx, view);
  };

  // Nothing held carries over a pause or a new round: a release may never arrive.
  const letGo = () => Object.keys(round.input).forEach((k) => (round.input[k] = false));

  const start = () => {
    colors = readColors(canvas);
    round = newRound();
    deck = dealMusic(Math.random, deck[songAt] ?? null);
    songAt = 0;
    fresh = true;
    showStageBanner(round);
    lastStage = round.stage;
    state = "running";
    clock = 0;
    view.end = null;
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    paint();
  };

  return {
    get score() {
      return round.score;
    },
    get state() {
      return state;
    },
    // For the tests only: the window never reads it.
    get round() {
      return round;
    },
    // Endless lives for this round (the Activities window's code), or not.
    cheat(on) {
      round.infinite = Boolean(on);
    },
    start,
    pause() {
      if (state === "running") state = "paused";
      letGo();
      paint();
    },
    resume() {
      if (state === "paused") state = "running";
    },
    // Held arrows climb, dive and ease forward and back until let go. Space
    // (or Enter) starts a round. Playing on from a pause is the window's.
    key(name) {
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        return true;
      }
      if (!MOVES[name]) return false;
      if (state === "running") round.input[name] = true;
      return true;
    },
    release(name) {
      if (MOVES[name]) round.input[name] = false;
    },
    tick(ms) {
      if (state !== "running") return;
      clock += ms;
      advance(round, ms);
      drainSounds();
      if (round.stage !== lastStage) {
        lastStage = round.stage;
        keepFurthest();
      }
      if (round.over) {
        keepFurthest();
        letGo();
        state = "over";
        tone(round.won ? "flockWin" : "flockOver");
        view.end = { score: round.score, best: Math.max(bestAtStart, round.score), fresh: bestAtStart > 0 && round.score > bestAtStart, won: round.won, flawless: round.won ? round.portal.flawless : 0, teaser: teaser(round, furthestNow()) };
        onScore(round.score);
      } else {
        checkBest();
        holdHums();
        playMusic();
      }
      paint();
    },
    resize(w, h) {
      const next = Math.floor(Math.min(w / W, h / H) * 4) / 4;
      if (!(next >= MIN_CELL)) return false;
      u = next;
      colors = null;
      const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
      canvas.width = Math.round(W * u * ratio);
      canvas.height = Math.round(H * u * ratio);
      if (canvas.style) {
        canvas.style.width = `${Math.round(W * u)}px`;
        canvas.style.height = `${Math.round(H * u)}px`;
      }
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
      return true;
    },
  };
}

// The end screen's nudge to play again: the next hazard not yet met on any run,
// else the bigger flock after a win, else the jet stream or the next stage.
export function teaser(round, furthest) {
  const reached = Math.max(round.stage, furthest);
  const next = Object.values(HAZARDS).find((h) => h.from > reached);
  if (next) return `${next.plural} wait at stage ${next.from}...`;
  if (round.won) return "Can you bring a bigger flock?";
  if (furthest >= MAX_STAGE) return "The jet stream is waiting. One more go?";
  return `Can you reach stage ${furthest + 1}?`;
}

export default Object.freeze({ id: "flock", title: "Flock Dash", create });
