// Plan2Code Web Console - Rapids Run, the eighth activity: the river built a stretch at a time, the skimmer's steering, speed, battery and guns, the river's foes, the dams and the mini-bosses, and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, newRiver,
// buildStretch, ensureRiver, riverAt, isWater, channelsAt, channelAt,
// onLand, placeAt, advance, lose, hurtFoe, hurtBoss, applyPower, stretchFor,
// underBanner), exported so
// the unit suite can drive them without a canvas; the drawing lives in
// rapids-draw.js, and the default export is the contract every listed game
// answers.
//
// Planny pilots a little jet-skimmer up a river that scrolls down the
// board, its banks winding, narrowing and splitting around islands. The
// arrows steer, held up speeds up (more points, less time to react), held
// down slows, and held space fires. The battery drains all the while, faster
// the faster you go: run over a charge buoy to top it up, or shoot it for a
// few points. A bank, an island, a foe or a flat battery costs one of three
// lives and starts the stretch again from the last dam. Each stretch ends at
// a dam across the river: blast it open to pass. Every BOSS_EVERY dams a
// mini-boss holds the basin before the dam. The memo keeps the furthest dam
// ever blasted.

import { DANGER, GOLD, drawScene, readColors, lookColor } from "./rapids-draw.js";

// The board: the strip of pills along the top, then the field with the
// battery gauge beside it. The canvas scales a unit in quarter-pixel steps.
export const FIELD_W = 64;
export const FIELD_H = 84;
// The strip is one row of pills tall (the draw file's hudLayout shrinks the
// pills to keep them in one row), and the field runs to the canvas's edges
// with no frame, so the play gets the room.
export const HUD_H = 4.5;
export const PAD = 0;
// The gap between the field and the bar beside it.
export const GAP = 1;
export const BAR_W = 5;
export const W = PAD * 2 + FIELD_W + GAP + BAR_W;
export const H = HUD_H + FIELD_H + PAD;

// Below this many pixels a unit, the board is too small to play.
export const MIN_CELL = 3;

// The river is laid in rows ROW units long. The skimmer rides BEHIND units
// above the field's bottom edge, so AHEAD units of river show in front.
export const ROW = 2;
export const BEHIND = 14;
export const AHEAD = FIELD_H - BEHIND;

// The skimmer: its size, how fast it slides sideways (eased in over a
// fraction of a second), and its three forward speeds, each scaled by the
// stretch's pace. Speed eases toward the one held at ACCEL.
export const SHIP_W = 3.4;
export const SHIP_L = 4.6;
export const SHIP_R = 1.6;
export const STEER = 30;
const STEER_EASE = 16;
export const CRUISE = 26;
export const FAST = 42;
export const SLOW = 12;
export const ACCEL = 45;

// The battery, out of BATTERY. It drains DRAIN a second at cruising speed,
// a share more or less as you go faster or slower; a buoy run over adds
// BUOY_CHARGE. Under LOW_BATTERY the gauge blinks and beeps.
export const BATTERY = 100;
export const DRAIN = 3.6;
export const BUOY_CHARGE = 40;
export const LOW_BATTERY = 25;
export const PICK_R = 2.6;
export const MAGNET_REACH = 24;
const MAGNET_PULL = 34;

// The guns: a shot every FIRE_MS while fire is held, at SHOT_SPEED past the
// skimmer's own speed. Spread shot fans out three.
export const FIRE_MS = 140;
export const SHOT_SPEED = 80;
const SPREAD_VX = 14;

// Lives, and what happens around losing one: the wreck shows for CRASH_MS,
// then the skimmer waits READY_MS at the start of the stretch, and cannot be
// hit for GRACE_MS. A shield taken gives SHIELD_GRACE.
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const CRASH_MS = 1200;
export const READY_MS = 900;
export const GRACE_MS = 1600;
export const SHIELD_GRACE = 1200;
export const MAX_SHIELDS = 2;

// A kill within COMBO_MS of the last raises the combo, which multiplies the
// kill's points, up to MAX_COMBO.
export const COMBO_MS = 1600;
export const MAX_COMBO = 5;

// Points: DIST_POINTS for every DIST_STEP units of river (twice that at full
// speed), SKIM_POINTS for every SKIM_MS skimming a bank closer than
// SKIM_GAP at speed, BUOY_POINTS for a buoy shot, DAM_POINTS times the
// stretch for a dam blasted, FLAWLESS_POINTS times it more for a stretch with
// no life lost, and BOSS_POINTS for each mini-boss, more each time around.
export const DIST_STEP = 5;
export const DIST_POINTS = 1;
export const SKIM_GAP = 1.4;
export const SKIM_MS = 250;
export const SKIM_POINTS = 5;
export const BUOY_POINTS = 10;
export const DAM_POINTS = 100;
export const FLAWLESS_POINTS = 50;
export const BOSS_POINTS = 400;
export const BOSS_EVERY = 4;

// The river's shape: a bank never slants more than SLOPE units across for a
// unit up, keeps EDGE units off the field's sides, and every channel is at
// least MIN_CHANNEL wide (an island at least ISLAND_MIN). A stretch opens
// with START_ROWS of calm water and ends at the dam, DAM_W wide, with a
// basin BASIN_W wide before it on a boss stretch.
export const SLOPE = 0.3;
export const EDGE = 3;
export const MIN_CHANNEL = 11;
export const ISLAND_MIN = 6;
export const DAM_W = 24;
export const DAM_T = 3;
const START_ROWS = 20;
const DAM_HOLD = 10;
const DAM_IN = 4;
const DAM_PAST = 6;
export const BASIN_W = 54;
const BASIN_ROWS = 46;
const BASIN_LOCK = 16;
export const RESPAWN_AT = 14;
const SAFE_START = 60;
const SAFE_DAM = 26;
const BUILD_AHEAD = 260;

// The foes' numbers.
const GULL_TRIGGER = 58;
const GULL_SWOOP = 9;
const DART_RANGE = 34;
const DART_SPEED = 13;
export const WHIRL_R = 6.5;
export const TUG = 13;
const SENTRY_NEAR = 10;
const SENTRY_FAR = 64;
export const BOSS_R = 4.5;
const BOSS_AHEAD = 46;
const BOSS_ENTER_MS = 1100;
const BOSS_SWAY = 17;

// Time is handed out in slices this long, so a long frame never moves a shot
// through a foe or the skimmer through a bank without touching it.
export const SLICE_MS = 4;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.d - b.d) ** 2;
const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

// A small seeded random (mulberry32), so a seed always builds the same river.
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

/* -------------------------------------------------------------- the cast */

// The river's foes, each from the stretch it first turns up in. A whirlpool
// cannot be shot; it only tugs.
export const FOES = deepFreeze({
  skiff: { name: "Patrol skiff", blurb: "Drifts from bank to bank", hp: 1, points: 30, r: 1.8, from: 1, weight: 4, color: "#e2553f" },
  mine: { name: "Bob mine", blurb: "Sits still. Do not touch", hp: 2, points: 20, r: 1.3, from: 1, weight: 3, color: "#5b6170" },
  gull: { name: "Gull drone", blurb: "Swoops across, over land and all", hp: 1, points: 40, r: 1.5, from: 2, weight: 2, color: "#f4f1ea" },
  sentry: { name: "Bank sentry", blurb: "Shoots back from the shore", hp: 3, points: 60, r: 1.9, from: 3, weight: 2, color: "#ff8a1f" },
  whirl: { name: "Whirlpool", blurb: "Tugs you toward its eye", hp: 0, points: 0, r: WHIRL_R, from: 5, weight: 1, color: "#1fb6d9" },
  darter: { name: "Darter", blurb: "Swerves into your lane", hp: 2, points: 50, r: 1.7, from: 6, weight: 2, color: "#a466ff" },
});
export const FOE_KINDS = Object.freeze(Object.keys(FOES));

// The mini-bosses, in the order they come around. Each time around they take more.
export const BOSSES = deepFreeze({
  dredger: { name: "The Dredger", sub: "It sprays a fan of bolts", color: "#c98b4a", hp: 36 },
  ironclad: { name: "Ironclad", sub: "Rings of bolts, then one at you", color: "#8a8f99", hp: 44 },
  leviathan: { name: "Old Leviathan", sub: "A stream of bolts that sweeps", color: "#2fbf71", hp: 52 },
});
const BOSS_ORDER = Object.freeze(Object.keys(BOSSES));

// The crates' power-ups. A timed one lasts `ms`; the rest act at once.
export const POWERS = deepFreeze({
  spread: { name: "Spread shot", blurb: "Three shots at once", color: "#ff8a1f", ms: 9000, weight: 3 },
  shield: { name: "Shield", blurb: "Shrug off one crash", color: "#1fb6d9", weight: 3 },
  magnet: { name: "Magnet", blurb: "Charge buoys come to you", color: "#a466ff", ms: 10000, weight: 2 },
  surge: { name: "Surge", blurb: "A full battery", color: "#2fbf71", weight: 2 },
});
export const POWER_KINDS = Object.freeze(Object.keys(POWERS));

export const active = (round, kind) => Boolean(round.effects && round.effects[kind] > 0);

/* ------------------------------------------------------------ stretches */

// The named stretches, each with its scenery (a look in rapids-draw.js).
// Past the last, Night Water again and again, a little quicker each time.
export const STRETCHES = Object.freeze([
  { name: "Willow Run", sub: "Shoot the dam to pass", look: "meadow" },
  { name: "Reed Bend", sub: "Islands split the river", look: "meadow" },
  { name: "Stone Gate", sub: "The banks close in", look: "canyon" },
  { name: "Mill Basin", sub: "Something guards the dam", look: "autumn" },
  { name: "Fog Narrows", sub: "Slow down for the dam", look: "marsh" },
  { name: "Heron Forks", sub: "Pick a side, fast", look: "autumn" },
  { name: "Copper Gorge", sub: "Tight, fast and busy", look: "canyon" },
  { name: "Old Lock", sub: "Something bigger guards it", look: "dusk" },
].map((s) => Object.freeze(s)));
const NIGHT = Object.freeze({ name: "Night Water", sub: "Faster every time", look: "night" });

const BUILT_STRETCHES = new Map();

// A stretch's numbers, built once each: its name and look, whether a boss
// guards its dam, its length, how wide the river runs, how often islands
// split it, how many foes, how far apart the buoys, how many crates, how
// much the dam takes and how fast everything goes.
export function stretchFor(n) {
  const k = Math.max(1, Math.floor(n) || 1);
  if (BUILT_STRETCHES.has(k)) return BUILT_STRETCHES.get(k);
  const past = k - STRETCHES.length;
  const base = past > 0 ? NIGHT : STRETCHES[k - 1];
  const boss = k % BOSS_EVERY === 0;
  const spec = Object.freeze({
    n: k,
    name: past > 1 ? `${base.name} ${past}` : base.name,
    sub: base.sub,
    look: base.look,
    boss,
    len: 480 + 30 * Math.min(k, 12),
    maxW: clamp(47 - k, 32, 46),
    minW: clamp(24 - k, 14, 22),
    islands: k === 1 ? 0.6 : 1.2 + Math.min(1.5, k * 0.15),
    foes: Math.round(Math.min(30, 6 + 3 * k) * (boss ? 0.7 : 1)),
    buoyGap: Math.min(210, 110 + 10 * k),
    crates: k === 1 ? 1 : 2,
    damHp: Math.min(16, 6 + k),
    pace: 1 + Math.min(0.3, (k - 1) * 0.035),
  });
  BUILT_STRETCHES.set(k, spec);
  return spec;
}

export const stretchName = (n) => `${stretchFor(n).name} (dam ${n})`;

/* ---------------------------------------------------------------- river */

// The river, row by row: each row's center, width and island width (an
// island narrower than 1 is no island), plus where each stretch starts, its
// dam, its boss's spot and its plan of foes, buoys and crates.
export function newRiver(seed = 1) {
  const river = { seed: seed >>> 0, rows: 0, C: [], Wd: [], IW: [], startAt: [0, 0], damAt: [0], bossAt: [0], plans: [null], built: 0 };
  river.C.push(FIELD_W / 2);
  river.Wd.push(stretchFor(1).maxW);
  river.IW.push(0);
  river.rows = 1;
  return river;
}

// Eases the river from its last row to center `c1`, width `w1` and island
// `iw1` over at least `minRows`, more if a bank would slant past SLOPE.
// Smoothstep is at most 1.5 times as steep as a straight line.
function ease(river, minRows, c1, w1, iw1) {
  const i = river.rows - 1;
  const c0 = river.C[i];
  const w0 = river.Wd[i];
  const iw0 = river.IW[i];
  const shift = Math.abs(c1 - c0) + Math.abs(w1 - w0) / 2 + Math.abs(iw1 - iw0) / 2;
  const rows = Math.max(minRows, Math.ceil((1.5 * shift) / (SLOPE * ROW)));
  for (let k = 1; k <= rows; k++) {
    const t = smooth(k / rows);
    river.C.push(c0 + (c1 - c0) * t);
    river.Wd.push(w0 + (w1 - w0) * t);
    river.IW.push(iw0 + (iw1 - iw0) * t);
  }
  river.rows += rows;
}

const between = (random, lo, hi) => lo + random() * (hi - lo);
const centerFor = (random, w) => between(random, EDGE + w / 2, FIELD_W - EDGE - w / 2);

// The pieces a stretch is laid from: a drift to a new place and width, a
// narrows, and an island that splits the river in two channels and closes
// again.
function drift(river, spec, random) {
  const w = between(random, spec.minW + 4, spec.maxW);
  ease(river, Math.round(between(random, 22, 46)), centerFor(random, w), w, 0);
}

function narrows(river, spec, random) {
  const w = spec.minW;
  ease(river, Math.round(between(random, 16, 28)), centerFor(random, w), w, 0);
  ease(river, Math.round(between(random, 10, 22)), river.C[river.rows - 1], w, 0);
}

function island(river, spec, random) {
  const w = Math.min(FIELD_W - 2 * EDGE, Math.max(2 * MIN_CHANNEL + ISLAND_MIN + 2, between(random, spec.maxW - 2, spec.maxW + 8)));
  const iw = clamp(w - 2 * MIN_CHANNEL - between(random, 0, 6), ISLAND_MIN, 18);
  const c = centerFor(random, w);
  ease(river, 14, c, w, 0);
  ease(river, 12, c, w, iw);
  ease(river, Math.round(between(random, 18, 40)), centerFor(random, w), w, iw);
  ease(river, 12, river.C[river.rows - 1], w, 0);
}

const PIECES = Object.freeze({ drift, narrows, island });

function pickPiece(spec, random) {
  const weights = { drift: 3, narrows: 0.8 + spec.n * 0.15, island: spec.islands };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = random() * total;
  for (const [name, w] of Object.entries(weights)) {
    roll -= w;
    if (roll < 0) return name;
  }
  return "drift";
}

// Lays stretch `n`'s rows from its own seed: the calm opening, pieces until
// its length, the basin on a boss stretch, then the narrowing to the dam,
// and plans its foes, buoys and crates.
export function buildStretch(river, n, random = seeded(river.seed + n * 7919)) {
  const spec = stretchFor(n);
  if (n > 1) river.startAt[n] = river.damAt[n - 1] + DAM_PAST;
  const s0 = river.rows;
  ease(river, START_ROWS, FIELD_W / 2, spec.maxW, 0);
  while (river.rows < s0 + spec.len / ROW) PIECES[pickPiece(spec, random)](river, spec, random);
  river.bossAt[n] = 0;
  if (spec.boss) {
    ease(river, 16, FIELD_W / 2, BASIN_W, 0);
    river.bossAt[n] = river.rows * ROW + BASIN_LOCK;
    ease(river, BASIN_ROWS, FIELD_W / 2, BASIN_W, 0);
  }
  ease(river, 18, FIELD_W / 2, DAM_W, 0);
  river.damAt[n] = (river.rows + DAM_IN) * ROW;
  ease(river, DAM_HOLD, FIELD_W / 2, DAM_W, 0);
  river.plans[n] = planStretch(river, n, spec, random);
  river.built = Math.max(river.built, n);
  return river;
}

// Builds stretches until the river runs BUILD_AHEAD past `d`.
export function ensureRiver(river, d) {
  while (river.rows * ROW < d + BUILD_AHEAD) buildStretch(river, river.built + 1);
  return river;
}

// The row values at distance `d`, eased between rows, so the banks slant as
// they are drawn: { c, w, iw, L, R, IL, IR, island }.
export function riverAt(river, d) {
  const f = d / ROW;
  const i = clamp(Math.floor(f), 0, river.rows - 1);
  const j = Math.min(river.rows - 1, i + 1);
  const t = clamp(f - i, 0, 1);
  const c = river.C[i] + (river.C[j] - river.C[i]) * t;
  const w = river.Wd[i] + (river.Wd[j] - river.Wd[i]) * t;
  const iw = river.IW[i] + (river.IW[j] - river.IW[i]) * t;
  const island = iw >= 1;
  return { c, w, iw, L: c - w / 2, R: c + w / 2, IL: island ? c - iw / 2 : c, IR: island ? c + iw / 2 : c, island };
}

// The channels of open water across the river at `d`: one, or two either
// side of an island.
export function channelsAt(river, d) {
  const r = riverAt(river, d);
  return r.island ? [{ lo: r.L, hi: r.IL }, { lo: r.IR, hi: r.R }] : [{ lo: r.L, hi: r.R }];
}

// The channel at `d` that holds `x`, or the nearest one when `x` is on land.
export function channelAt(river, x, d) {
  const list = channelsAt(river, d);
  let best = list[0];
  let gap = Infinity;
  for (const ch of list) {
    const g = x < ch.lo ? ch.lo - x : x > ch.hi ? x - ch.hi : 0;
    if (g < gap) {
      gap = g;
      best = ch;
    }
  }
  return best;
}

export function isWater(river, x, d) {
  const r = riverAt(river, d);
  return x > r.L && x < r.R && !(r.island && x > r.IL && x < r.IR);
}

/* ----------------------------------------------------------------- plan */

function pickWeighted(list, weightOf, random) {
  const total = list.reduce((sum, k) => sum + weightOf(k), 0);
  let roll = random() * total;
  for (const k of list) {
    roll -= weightOf(k);
    if (roll < 0) return k;
  }
  return list[list.length - 1];
}

// Where the foes, buoys and crates of stretch `n` go: none in the first
// SAFE_START of it (where you start again after a crash), none in the last
// SAFE_DAM before the dam or in a boss's basin, the foes spread evenly up
// it, the buoys about spec.buoyGap apart.
function planStretch(river, n, spec, random) {
  const plan = [];
  const from = river.startAt[n] + SAFE_START;
  const to = spec.boss ? river.bossAt[n] - BASIN_LOCK - 40 : river.damAt[n] - SAFE_DAM;
  const kinds = FOE_KINDS.filter((k) => FOES[k].from <= n);
  const span = Math.max(1, to - from);
  for (let k = 0; k < spec.foes; k++) {
    const d = from + ((k + 0.15 + random() * 0.7) * span) / spec.foes;
    let kind = pickWeighted(kinds, (x) => FOES[x].weight, random);
    const r = riverAt(river, d);
    const chans = channelsAt(river, d);
    const ch = chans[Math.floor(random() * chans.length)];
    const left = random() < 0.5;
    if (kind === "whirl" && (r.island || r.w < 18)) kind = "mine";
    if (kind === "sentry") {
      const x = left ? r.L - 3 : r.R + 3;
      const other = left ? r.R + 3 : r.L - 3;
      const spot = x > 1.5 && x < FIELD_W - 1.5 ? x : other > 1.5 && other < FIELD_W - 1.5 ? other : null;
      if (spot === null) kind = "skiff";
      else {
        plan.push({ kind, d, x: spot });
        continue;
      }
    }
    if (kind === "whirl") plan.push({ kind, d, x: r.c });
    else if (kind === "mine") plan.push({ kind, d, x: left ? ch.lo + 2.6 : ch.hi - 2.6 });
    else if (kind === "gull") plan.push({ kind, d, x: left ? -3 : FIELD_W + 3, vx: (left ? 1 : -1) * (16 + Math.min(10, n)) });
    else plan.push({ kind, d, x: between(random, ch.lo + 2.2, ch.hi - 2.2), vx: (left ? 1 : -1) * (5 + Math.min(6, n * 0.5) + random() * 3) });
  }
  for (let d = from - 30 + spec.buoyGap * (0.4 + random() * 0.3); d < to; d += spec.buoyGap * (0.75 + random() * 0.5)) {
    const chans = channelsAt(river, d);
    const ch = chans[Math.floor(random() * chans.length)];
    plan.push({ kind: "buoy", d, x: between(random, ch.lo + 2.4, ch.hi - 2.4) });
  }
  for (let k = 0; k < spec.crates; k++) {
    const d = from + span * (0.25 + 0.5 * random());
    const ch = channelAt(river, FIELD_W / 2, d);
    plan.push({ kind: "crate", power: pickWeighted(POWER_KINDS, (x) => POWERS[x].weight, random), d, x: between(random, ch.lo + 2.4, ch.hi - 2.4) });
  }
  return plan;
}

/* ---------------------------------------------------------------- round */

export function newRound(seed = (Math.random() * 2 ** 31) >>> 0) {
  const river = newRiver(seed);
  ensureRiver(river, 0);
  const round = {
    seed,
    river,
    stretch: 1,
    lives: START_LIVES,
    score: 0,
    combo: 1,
    comboMs: 0,
    bestCombo: 1,
    battery: BATTERY,
    phase: "run",
    phaseMs: 0,
    ship: { x: FIELD_W / 2, d: RESPAWN_AT, v: CRUISE, vx: 0, alive: true, invuln: 0 },
    input: { left: false, right: false, up: false, down: false, fire: false },
    fireMs: 0,
    shots: [],
    bolts: [],
    foes: [],
    buoys: [],
    crates: [],
    effects: {},
    shield: 0,
    boss: null,
    bossBeat: 0,
    bossReached: 0,
    damPaid: 0,
    dam: null,
    loaded: 0,
    cam: 0,
    clock: 0,
    distAcc: 0,
    skimMs: 0,
    skimming: false,
    stretchHit: false,
    stats: { kills: 0, charged: 0, popped: 0, dams: 0, skimmed: 0, bosses: 0 },
    over: false,
    events: [],
  };
  placeAt(round, 1);
  return round;
}

// Puts the skimmer at the start of stretch `n` (or at distance `at` in it)
// with its dam whole unless it was already blasted, and loads the stretch's
// foes, buoys and crates afresh. A life lost stays lost until the next dam.
export function placeAt(round, n, at = null) {
  const { river, ship } = round;
  while (river.built < n) buildStretch(river, river.built + 1);
  round.stretch = n;
  const spec = stretchFor(n);
  ship.d = at === null ? river.startAt[n] + RESPAWN_AT : at;
  ship.x = riverAt(river, ship.d).c;
  ship.v = CRUISE * spec.pace;
  ship.vx = 0;
  ship.alive = true;
  round.cam = ship.d - BEHIND;
  round.dam = { n, d: river.damAt[n], hp: round.damPaid >= n ? 0 : spec.damHp, max: spec.damHp, flash: 0 };
  round.foes = [];
  round.buoys = [];
  round.crates = [];
  round.shots = [];
  round.bolts = [];
  round.boss = null;
  round.loaded = n - 1;
  loadAhead(round);
}

function load(round, n) {
  const plan = round.river.plans[n] || [];
  for (const p of plan) {
    if (p.d < round.ship.d + 20) continue;
    if (p.kind === "buoy") round.buoys.push({ x: p.x, d: p.d, n, t: 0 });
    else if (p.kind === "crate") round.crates.push({ x: p.x, d: p.d, n, kind: p.power });
    else round.foes.push({ kind: p.kind, n, x: p.x, d: p.d, vx: p.vx || 0, hp: FOES[p.kind].hp, r: FOES[p.kind].r, t: 0, flash: 0, on: false, fireMs: 600 });
  }
}

// Loads the next stretch's plan once its start comes near the view.
function loadAhead(round) {
  const { river } = round;
  ensureRiver(river, round.ship.d);
  while (round.loaded < round.stretch + 1) {
    const next = round.loaded + 1;
    while (river.built < next) buildStretch(river, river.built + 1);
    if (next > round.stretch && river.startAt[next] > round.ship.d + AHEAD + 40) break;
    load(round, next);
    round.loaded = next;
  }
}

// Where a distance up the river sits on the field, top to bottom.
export const screenY = (round, d) => FIELD_H - (d - round.cam);

/* ------------------------------------------------------------- scoring */

function scoreKill(round, base) {
  round.combo = round.comboMs > 0 ? Math.min(MAX_COMBO, round.combo + 1) : 1;
  round.comboMs = COMBO_MS;
  round.bestCombo = Math.max(round.bestCombo, round.combo);
  const points = base * round.combo;
  round.score += points;
  return points;
}

// One point of damage to a foe; at none left it is sunk and scores.
export function hurtFoe(round, f, amount = 1) {
  if (!FOES[f.kind].hp) return false;
  f.hp -= amount;
  f.flash = 110;
  if (f.hp > 0) {
    round.events.push({ type: "hurt", x: f.x, d: f.d, kind: f.kind });
    return false;
  }
  round.foes = round.foes.filter((o) => o !== f);
  round.stats.kills += 1;
  const points = scoreKill(round, FOES[f.kind].points);
  round.events.push({ type: "kill", x: f.x, d: f.d, kind: f.kind, points, combo: round.combo });
  return true;
}

export function applyPower(round, kind) {
  const at = { x: round.ship.x, d: round.ship.d };
  const spec = POWERS[kind];
  if (!spec) return;
  if (kind === "shield") round.shield = Math.min(MAX_SHIELDS, round.shield + 1);
  else if (kind === "surge") round.battery = BATTERY;
  else round.effects[kind] = spec.ms;
  round.events.push({ type: "power", kind, ...at });
}

// A life lost to `cause` ("bank", "foe", "bolt", "dam" or "flat"): a shield
// takes anything but a flat battery, and the skimmer is safe while it
// blinks after a crash. Returns whether a life went.
export function lose(round, cause) {
  const ship = round.ship;
  if (round.phase === "crash" || round.over || !ship.alive) return false;
  if (cause !== "flat") {
    if (ship.invuln > 0) return false;
    if (round.shield > 0) {
      round.shield -= 1;
      ship.invuln = SHIELD_GRACE;
      round.events.push({ type: "shield", x: ship.x, d: ship.d, cause });
      return false;
    }
  }
  if (!round.infinite) round.lives -= 1;
  round.stretchHit = true;
  ship.alive = false;
  round.phase = "crash";
  round.phaseMs = CRASH_MS;
  round.effects = {};
  round.combo = 1;
  round.comboMs = 0;
  round.bolts = [];
  round.shots = [];
  round.skimming = false;
  round.events.push({ type: "lose", cause, x: ship.x, d: ship.d, lives: round.lives });
  return true;
}

// Back at the start of the stretch; but once its basin was reached, at the
// basin's mouth, so a boss fight lost is not the whole stretch again.
function respawn(round) {
  const n = round.stretch;
  placeAt(round, n, round.bossReached === n ? round.river.bossAt[n] - BASIN_LOCK : null);
  round.battery = BATTERY;
  round.ship.invuln = GRACE_MS;
  round.phase = "ready";
  round.phaseMs = READY_MS;
  round.events.push({ type: "respawn", lives: round.lives, x: round.ship.x, d: round.ship.d });
}

/* -------------------------------------------------------------- moving */

// Steering, the whirlpools' tug and the walls of the field.
function steer(round, dt) {
  const { ship, input } = round;
  const dir = Number(input.right) - Number(input.left);
  ship.vx += (dir * STEER - ship.vx) * Math.min(1, STEER_EASE * dt);
  ship.x += ship.vx * dt;
  for (const f of round.foes) {
    if (f.kind !== "whirl" || !onScreen(round, f)) continue;
    const dx = f.x - ship.x;
    const dd = f.d - ship.d;
    const dist = Math.hypot(dx, dd);
    if (dist < WHIRL_R) ship.x += (dx / Math.max(0.5, dist)) * TUG * (1 - dist / WHIRL_R) * dt;
  }
  ship.x = clamp(ship.x, 1.5, FIELD_W - 1.5);
}

// The forward speed held: up, down or neither, eased toward at ACCEL.
function speedUp(round, dt) {
  const { ship, input } = round;
  const pace = stretchFor(round.stretch).pace;
  const target = round.phase === "boss" ? 0 : (input.up ? FAST : input.down ? SLOW : CRUISE) * pace;
  const step = ACCEL * dt;
  ship.v = ship.v < target ? Math.min(target, ship.v + step) : Math.max(target, ship.v - step);
}

const cruiseOf = (round) => CRUISE * stretchFor(round.stretch).pace;

// The skimmer's outline, sampled: whether any of it is over land.
const HULL = Object.freeze([[-1, 0], [1, 0], [-0.6, 1], [0.6, 1], [0, 1], [-0.85, -0.7], [0.85, -0.7]]);
export function onLand(river, x, d) {
  for (const [kx, kd] of HULL) if (!isWater(river, x + kx * (SHIP_W / 2), d + kd * (SHIP_L / 2))) return true;
  return false;
}

// While the skimmer blinks it slides along a bank instead of crashing.
function slideOff(round) {
  const { ship, river } = round;
  let lo = -Infinity;
  let hi = Infinity;
  for (const kd of [-0.7, 0, 1]) {
    const ch = channelAt(river, ship.x, ship.d + kd * (SHIP_L / 2));
    lo = Math.max(lo, ch.lo);
    hi = Math.min(hi, ch.hi);
  }
  ship.x = hi - lo > SHIP_W ? clamp(ship.x, lo + SHIP_W / 2 + 0.05, hi - SHIP_W / 2 - 0.05) : (lo + hi) / 2;
}

const onScreen = (round, o) => o.d < round.cam + FIELD_H + 6 && o.d > round.cam - 6;
// A foe acts once its stretch is the one you are in, or its dam is open.
const awake = (round, f) => f.n <= round.stretch || (f.n === round.stretch + 1 && round.dam.hp <= 0);

function aimed(from, to, speed, spread = 0) {
  const a = Math.atan2(to.d - from.d, to.x - from.x) + spread;
  return { x: from.x, d: from.d, vx: Math.cos(a) * speed, vd: Math.sin(a) * speed };
}
const boltSpeed = (n) => 18 + Math.min(10, n);
const sentryMs = (n) => Math.max(900, 2000 - 70 * n);

function fire(round, dt) {
  round.fireMs -= dt * 1000;
  const ship = round.ship;
  if (!round.input.fire || !ship.alive || round.fireMs > 0) return;
  round.fireMs = FIRE_MS;
  const fans = active(round, "spread") ? [-SPREAD_VX, 0, SPREAD_VX] : [0];
  for (const vx of fans) round.shots.push({ x: ship.x, d: ship.d + SHIP_L / 2, vx, vd: SHOT_SPEED + ship.v });
  round.events.push({ type: "shoot" });
}

function moveShots(round, dt) {
  const { river } = round;
  const dam = round.dam;
  const boss = round.boss;
  const kept = [];
  for (const s of round.shots) {
    s.x += s.vx * dt;
    s.d += s.vd * dt;
    if (s.d > round.cam + FIELD_H + 4 || s.x < -2 || s.x > FIELD_W + 2) continue;
    let used = false;
    for (const f of round.foes) {
      if (!FOES[f.kind].hp || !awake(round, f) || !onScreen(round, f)) continue;
      if (dist2(s, f) < (f.r + 0.5) ** 2) {
        hurtFoe(round, f);
        used = true;
        break;
      }
    }
    if (!used && boss && boss.enter <= 0 && dist2(s, boss) < (BOSS_R + 0.5) ** 2) {
      used = true;
      hurtBoss(round, 1);
    }
    if (!used && dam.hp > 0 && s.d >= dam.d - DAM_T / 2) {
      const r = riverAt(river, dam.d);
      if (s.x > r.L - 3 && s.x < r.R + 3) {
        used = true;
        hitDam(round, s.x);
      }
    }
    if (!used) {
      const b = round.buoys.find((o) => onScreen(round, o) && dist2(s, o) < 1.6 ** 2);
      if (b) {
        used = true;
        round.buoys = round.buoys.filter((o) => o !== b);
        round.score += BUOY_POINTS;
        round.stats.popped += 1;
        round.events.push({ type: "popbuoy", x: b.x, d: b.d, points: BUOY_POINTS });
      }
    }
    if (!used) kept.push(s);
  }
  round.shots = kept;
}

function hitDam(round, x) {
  const dam = round.dam;
  dam.hp -= 1;
  dam.flash = 100;
  if (dam.hp > 0) {
    round.events.push({ type: "damhit", x, d: dam.d, hp: dam.hp, max: dam.max });
    return;
  }
  // A dam is paid for once, and stays open after a crash before it.
  const points = round.damPaid < dam.n ? DAM_POINTS * dam.n : 0;
  round.damPaid = Math.max(round.damPaid, dam.n);
  round.score += points;
  round.stats.dams = Math.max(round.stats.dams, dam.n);
  round.events.push({ type: "dambreak", n: dam.n, x: FIELD_W / 2, d: dam.d, points });
  // The next stretch's foes may already sit past the dam: wake them.
  loadAhead(round);
}

function moveFoes(round, dt) {
  const { ship, river } = round;
  const ms = dt * 1000;
  const n = round.stretch;
  for (const f of round.foes) {
    if (!awake(round, f)) continue;
    if (f.kind === "gull") {
      if (!f.on && ship.alive && ship.d >= f.d - GULL_TRIGGER) {
        f.on = true;
        round.events.push({ type: "gull", x: f.x, d: f.d });
      }
      if (!f.on) continue;
      f.t += ms;
      f.x += f.vx * dt;
      f.d -= GULL_SWOOP * dt;
      continue;
    }
    if (!onScreen(round, f)) continue;
    f.t += ms;
    f.flash = Math.max(0, f.flash - ms);
    if (f.kind === "skiff" || f.kind === "darter") {
      let vx = f.vx;
      const ahead = f.d - ship.d;
      if (f.kind === "darter" && ship.alive && ahead > 0 && ahead < DART_RANGE) vx = clamp((ship.x - f.x) * 3, -DART_SPEED, DART_SPEED);
      f.x += vx * dt;
      const ch = channelAt(river, f.x, f.d);
      if (f.x < ch.lo + f.r) {
        f.x = ch.lo + f.r;
        f.vx = Math.abs(f.vx);
      } else if (f.x > ch.hi - f.r) {
        f.x = ch.hi - f.r;
        f.vx = -Math.abs(f.vx);
      }
    } else if (f.kind === "sentry") {
      const ahead = f.d - ship.d;
      if (ship.alive && round.phase === "run" && ahead > SENTRY_NEAR && ahead < SENTRY_FAR) {
        f.fireMs -= ms;
        if (f.fireMs <= 0) {
          f.fireMs = sentryMs(n);
          round.bolts.push(aimed(f, ship, boltSpeed(n)));
          round.events.push({ type: "bolt", x: f.x, d: f.d });
        }
      }
    }
  }
  // Foes well behind the view, or a gull flown off the side, are gone.
  round.foes = round.foes.filter((f) => f.d > round.cam - 10 && !(f.on && (f.x < -6 || f.x > FIELD_W + 6)));
  round.buoys = round.buoys.filter((b) => b.d > round.cam - 6);
  round.crates = round.crates.filter((c) => c.d > round.cam - 6);
}

/* ---------------------------------------------------------------- boss */

function spawnBoss(round) {
  const turn = round.stretch / BOSS_EVERY - 1;
  const kind = BOSS_ORDER[turn % BOSS_ORDER.length];
  const cycle = Math.floor(turn / BOSS_ORDER.length);
  const hp = Math.round(BOSSES[kind].hp * (1 + 0.5 * cycle));
  const home = round.ship.d + BOSS_AHEAD;
  round.boss = { kind, cycle, hp, max: hp, x: FIELD_W / 2, d: home + 30, home, t: 0, enter: BOSS_ENTER_MS, fireMs: 900, flash: 0, volley: 0 };
  round.phase = "boss";
  round.bossReached = round.stretch;
  round.events.push({ type: "bossin", kind, n: round.stretch });
}

export function hurtBoss(round, amount) {
  const boss = round.boss;
  if (!boss || boss.enter > 0) return false;
  boss.hp -= amount;
  boss.flash = 110;
  if (boss.hp > 0) return true;
  round.boss = null;
  round.bossBeat = round.stretch;
  round.phase = "run";
  round.bolts = [];
  const points = BOSS_POINTS * (boss.cycle + 1);
  round.score += points;
  round.stats.bosses += 1;
  const life = round.lives < MAX_LIVES;
  if (life) round.lives += 1;
  round.crates.push({ x: boss.x, d: boss.d - 8, n: round.stretch, kind: POWER_KINDS[(round.stretch / BOSS_EVERY) % POWER_KINDS.length] });
  round.events.push({ type: "bossdown", kind: boss.kind, x: boss.x, d: boss.d, points, life });
  return true;
}

function moveBoss(round, dt) {
  const boss = round.boss;
  if (!boss) return;
  const ms = dt * 1000;
  boss.t += ms;
  boss.flash = Math.max(0, boss.flash - ms);
  if (boss.enter > 0) {
    boss.enter = Math.max(0, boss.enter - ms);
    boss.d = boss.home + (boss.enter / BOSS_ENTER_MS) * 30;
    return;
  }
  boss.x = FIELD_W / 2 + Math.sin(boss.t / 1500) * BOSS_SWAY;
  boss.fireMs -= ms;
  if (boss.fireMs > 0 || !round.ship.alive) return;
  const sp = boltSpeed(round.stretch) * (1 + 0.1 * boss.cycle);
  const muzzle = { x: boss.x, d: boss.d - BOSS_R };
  if (boss.kind === "dredger") {
    boss.fireMs = 1250 - 150 * Math.min(3, boss.cycle);
    for (const s of [-0.32, 0, 0.32]) round.bolts.push(aimed(muzzle, round.ship, sp, s));
  } else if (boss.kind === "ironclad") {
    boss.volley += 1;
    boss.fireMs = boss.volley % 2 ? 900 : 1400;
    if (boss.volley % 2) {
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI + 0.35 + (k * (Math.PI - 0.7)) / 6;
        round.bolts.push({ x: muzzle.x, d: muzzle.d, vx: Math.cos(a) * sp, vd: Math.sin(a) * sp });
      }
    } else round.bolts.push(aimed(muzzle, round.ship, sp * 1.2));
  } else {
    boss.fireMs = 170;
    const a = -Math.PI / 2 + Math.sin(boss.t / 650) * 0.95;
    round.bolts.push({ x: muzzle.x, d: muzzle.d, vx: Math.cos(a) * sp, vd: Math.sin(a) * sp });
  }
  round.events.push({ type: "bolt", x: muzzle.x, d: muzzle.d, boss: true });
}

function moveBolts(round, dt) {
  const ship = round.ship;
  const kept = [];
  for (const b of round.bolts) {
    b.x += b.vx * dt;
    b.d += b.vd * dt;
    if (ship.alive && ship.invuln <= 0 && dist2(b, ship) < (SHIP_R + 0.4) ** 2) {
      if (lose(round, "bolt")) return;
      continue;
    }
    if (b.d > round.cam - 4 && b.d < round.cam + FIELD_H + 6 && b.x > -3 && b.x < FIELD_W + 3) kept.push(b);
  }
  round.bolts = kept;
}

/* ------------------------------------------------------------ pickups */

function pickups(round, dt) {
  const ship = round.ship;
  const magnet = active(round, "magnet");
  for (const b of round.buoys) {
    b.t += dt * 1000;
    if (!magnet || !onScreen(round, b)) continue;
    const dx = ship.x - b.x;
    const dd = ship.d - b.d;
    const dist = Math.hypot(dx, dd);
    if (dist < MAGNET_REACH && dist > 0.01) {
      b.x += (dx / dist) * MAGNET_PULL * dt;
      b.d += (dd / dist) * MAGNET_PULL * dt;
    }
  }
  const took = round.buoys.find((b) => dist2(b, ship) < PICK_R ** 2);
  if (took) {
    round.buoys = round.buoys.filter((b) => b !== took);
    round.battery = Math.min(BATTERY, round.battery + BUOY_CHARGE);
    round.stats.charged += 1;
    round.events.push({ type: "charge", x: took.x, d: took.d, battery: round.battery });
  }
  const crate = round.crates.find((c) => dist2(c, ship) < PICK_R ** 2);
  if (crate) {
    round.crates = round.crates.filter((c) => c !== crate);
    applyPower(round, crate.kind);
  }
}

/* ------------------------------------------------------------ crashes */

function collisions(round) {
  const { ship, river } = round;
  if (onLand(river, ship.x, ship.d)) {
    if (ship.invuln > 0) slideOff(round);
    else if (!lose(round, "bank")) slideOff(round);
    if (round.phase === "crash") return;
  }
  const dam = round.dam;
  if (dam.hp > 0 && ship.d + SHIP_L / 2 >= dam.d - DAM_T / 2) {
    if (!lose(round, "dam")) {
      ship.d = dam.d - DAM_T / 2 - SHIP_L / 2 - 6;
      ship.v = SLOW;
    }
    if (round.phase === "crash") return;
  }
  for (const f of round.foes) {
    if (f.kind === "whirl" || !awake(round, f) || !onScreen(round, f)) continue;
    if (dist2(f, ship) >= (f.r + SHIP_R) ** 2) continue;
    if (ship.invuln > 0) continue;
    const shielded = round.shield > 0;
    if (lose(round, "foe")) return;
    if (shielded) hurtFoe(round, f, f.hp);
    return;
  }
}

// Skimming a bank at speed: SKIM_POINTS each SKIM_MS closer than SKIM_GAP.
function skim(round, ms) {
  const { ship, river } = round;
  let gap = Infinity;
  for (const kd of [0, 1]) {
    const ch = channelAt(river, ship.x, ship.d + kd * (SHIP_L / 2));
    gap = Math.min(gap, ship.x - SHIP_W / 2 - ch.lo, ch.hi - ship.x - SHIP_W / 2);
  }
  round.skimming = gap < SKIM_GAP && gap >= 0 && ship.v >= cruiseOf(round) * 0.95;
  if (!round.skimming) {
    round.skimMs = Math.min(round.skimMs, SKIM_MS * 0.5);
    return;
  }
  round.skimMs += ms;
  while (round.skimMs >= SKIM_MS) {
    round.skimMs -= SKIM_MS;
    const points = SKIM_POINTS * (round.input.up ? 2 : 1);
    round.score += points;
    round.stats.skimmed += points;
    round.events.push({ type: "skim", x: ship.x, d: ship.d, points });
  }
}

/* -------------------------------------------------------------- update */

function update(round, dt) {
  const ms = dt * 1000;
  const ship = round.ship;
  round.clock += ms;
  for (const kind of Object.keys(round.effects)) {
    round.effects[kind] -= ms;
    if (round.effects[kind] <= 0) delete round.effects[kind];
  }
  round.comboMs = Math.max(0, round.comboMs - ms);
  if (round.comboMs === 0) round.combo = 1;
  if (round.dam) round.dam.flash = Math.max(0, round.dam.flash - ms);
  if (round.phase === "crash") {
    round.phaseMs -= ms;
    if (round.phaseMs > 0) return;
    if (round.lives <= 0) {
      round.over = true;
      round.events.push({ type: "over" });
      return;
    }
    respawn(round);
    return;
  }
  ship.invuln = Math.max(0, ship.invuln - ms);
  if (round.phase === "ready") {
    round.phaseMs -= ms;
    steer(round, dt);
    if (onLand(round.river, ship.x, ship.d)) slideOff(round);
    fire(round, dt);
    moveShots(round, dt);
    if (round.phaseMs <= 0) {
      round.phase = "run";
      round.events.push({ type: "go" });
    }
    return;
  }
  steer(round, dt);
  speedUp(round, dt);
  if (round.phase === "boss") ship.d = Math.min(ship.d, round.river.bossAt[round.stretch]);
  else ship.d += ship.v * dt;
  round.cam = ship.d - BEHIND;
  if (round.phase === "run") {
    // The battery: a share more at speed, a share less slowed down.
    round.battery -= DRAIN * (0.6 + (0.4 * ship.v) / cruiseOf(round)) * dt;
    round.distAcc += ship.v * dt;
    while (round.distAcc >= DIST_STEP) {
      round.distAcc -= DIST_STEP;
      round.score += DIST_POINTS * (ship.v > cruiseOf(round) * 1.1 ? 2 : 1);
    }
  }
  fire(round, dt);
  moveShots(round, dt);
  moveFoes(round, dt);
  moveBoss(round, dt);
  moveBolts(round, dt);
  if (round.phase === "crash") return;
  pickups(round, dt);
  collisions(round);
  if (round.phase === "crash") return;
  if (round.battery <= 0) {
    round.battery = 0;
    lose(round, "flat");
    return;
  }
  if (round.phase === "run") skim(round, ms);
  const spec = stretchFor(round.stretch);
  if (spec.boss && round.phase === "run" && !round.boss && round.bossBeat !== round.stretch && ship.d >= round.river.bossAt[round.stretch]) {
    ship.d = round.river.bossAt[round.stretch];
    spawnBoss(round);
  }
  const dam = round.dam;
  if (dam.hp <= 0 && ship.d - SHIP_L / 2 > dam.d + DAM_T / 2) {
    const bonus = round.stretchHit ? 0 : FLAWLESS_POINTS * dam.n;
    round.score += bonus;
    const n = dam.n + 1;
    round.stretch = n;
    round.stretchHit = false;
    const next = stretchFor(n);
    round.dam = { n, d: round.river.damAt[n], hp: next.damHp, max: next.damHp, flash: 0 };
    round.events.push({ type: "stretch", n, bonus, flawless: bonus > 0 });
  }
  loadAhead(round);
}

// Moves the round on by `ms`, in small slices.
export function advance(round, ms) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    update(round, slice / 1000);
  }
  return round.over ? "over" : "running";
}

/* -------------------------------------------------------------- banners */

// A banner sits in the top part of the field, well above the skimmer. While
// a foe, a bolt, the dam or the boss is in its strip it fades to
// BANNER_SEE_THROUGH, so it never hides what is coming at you.
export const BANNER_Y = FIELD_H * 0.3;
export const BOSS_BANNER_Y = FIELD_H * 0.55;
export const BANNER_HALF = 7;
const BANNER_SEE_THROUGH = 0.12;
const BANNER_FADE_MS = 140;

// Whether anything you must react to is in the banner's strip at field `y`.
export function underBanner(round, y = BANNER_Y) {
  const reach = BANNER_HALF + 2;
  const near = (d) => Math.abs(screenY(round, d) - y) < reach;
  if (round.foes.some((f) => awake(round, f) && (f.on || f.kind !== "gull") && near(f.d))) return true;
  if (round.bolts.some((b) => near(b.d))) return true;
  if (round.boss && near(round.boss.d)) return true;
  return Boolean(round.dam && round.dam.hp > 0 && near(round.dam.d));
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 500;
const LOW_BEEP_MS = 700;
const SKIM_TONE_MS = 240;
// The sound clocks: a sentry's or a boss's gun is heard at most every
// BOLT_TONE_MS (the Leviathan fires every 170 ms), a hit on a boss every
// BOSS_HIT_MS (Spread lands three at once), a carved turn every CARVE_MS.
const BOLT_TONE_MS = 320;
const BOSS_HIT_MS = 90;
const CARVE_MS = 260;
// A timed power-up ticks in its last POWER_WARN_MS, once a POWER_TICK_MS.
const POWER_WARN_MS = 2000;
const POWER_TICK_MS = 500;
// The hums: a whirlpool is heard within WHIRL_HEAR, a gull within GULL_HEAR.
const WHIRL_HEAR = 40;
const GULL_HEAR = 50;

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // The furthest dam ever blasted, and whether this round went past it.
  // Without a memo (the unit suite) it lasts as long as the game.
  let furthest = 0;
  let further = false;
  try {
    furthest = Math.max(0, memo ? Number(memo.get()) | 0 : 0);
  } catch {}
  // Sparks, floating words, rings, banners, the combo's big number, the
  // shake, the flash, and the sound's clocks and memory: the low battery's
  // beep, the skim's, the guns', a boss's hits and its half, the dam seen
  // and groaning, the timed powers last heard, tones queued for later.
  let fx = null;
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], rings: [], shake: 0, shakeMag: 0, flash: null, clock: 0, combo: null, cheer: 0, lowBeep: 0, lowWarned: false, skimTone: -1e9, boltTone: -1e9, bossHitTone: -1e9, carveTone: -1e9, bossHp: null, bossHalf: false, damSeen: 0, damGroan: 0, powers: {}, later: [], seen: new Set() });
  // A tone `ms` from now, played by runFx so a pause holds it too.
  const toneLater = (ms, name, level = 1, pitch = 1) => fx.later.push({ ms, name, level, pitch });
  // A little pitch wobble so a repeated sound never plays twice the same.
  const vary = (k = 0.06) => 1 + (Math.random() - 0.5) * 2 * k;
  resetFx();

  const burst = (x, d, color, n, speed = 14) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x, d, vx: Math.cos(a) * v, vd: Math.sin(a) * v, life: 300 + Math.random() * 350, max: 650, color, size: 0.45 + Math.random() * 0.6 });
    }
  };
  const float = (x, d, text, color, size = 2.6) => fx.floats.push({ x, d, rise: 0, text, color, size, life: 950, max: 950 });
  const ring = (x, d, color, r0, grow, ms = 420) => fx.rings.push({ x, d, color, r0, grow, life: ms, max: ms });
  const banner = (title, sub, color, ms = 1800) => {
    if (fx.banners.length >= 3 || fx.banners.some((b) => b.title === title)) return null;
    const b = { title, sub, color, life: ms, max: ms, tag: "", y: null, see: 1 };
    fx.banners.push(b);
    return b;
  };
  const shake = (ms, mag) => {
    fx.shakeMag = Math.max(fx.shake > 0 ? fx.shakeMag : 0, mag);
    fx.shake = Math.max(fx.shake, ms);
  };
  const flash = (color, ms = 260) => (fx.flash = { color, life: ms, max: ms });

  const markFurthest = (n, b) => {
    if (n <= furthest) return;
    furthest = n;
    further = true;
    try {
      if (memo) memo.set(furthest);
    } catch {}
    if (b) b.tag = `NEW FURTHEST: DAM ${n}`;
  };

  // A stretch's banner: its name, and the first foe of a new kind it brings.
  const stretchBanner = (n) => {
    const spec = stretchFor(n);
    const fresh = n > 1 ? FOE_KINDS.find((k) => FOES[k].from === n && !fx.seen.has(k)) : null;
    if (fresh) fx.seen.add(fresh);
    const sub = fresh ? `New: ${FOES[fresh].name}. ${FOES[fresh].blurb}` : spec.sub;
    return banner(`Stretch ${n}: ${spec.name}`, sub, lookColor(spec.look), 2200);
  };

  const handle = (e) => {
    const ship = round.ship;
    if (e.type === "shoot") tone("pew", 0.16);
    else if (e.type === "kill") {
      tone("eat", 0.8);
      // What it sounded like going: a mine goes up, a gull drone falls out
      // of the air, a sentry's gun is wrecked, a boat sinks.
      if (e.kind === "mine") {
        tone("blast", 0.55, vary());
        tone("rapidsGeyser", 0.6, vary());
      } else if (e.kind === "gull") tone("rapidsDroneDown", 0.6, vary());
      else if (e.kind === "sentry") {
        tone("smash", 0.5, vary());
        tone("clank", 0.35, 0.8);
      } else tone("rapidsSink", 0.6, (e.kind === "darter" ? 1.2 : 1) * vary());
      burst(e.x, e.d, FOES[e.kind].color, 16, 14);
      ring(e.x, e.d, GOLD, 1, 4, 320);
      float(e.x, e.d + 2, e.combo > 1 ? `+${e.points} x${e.combo}` : `+${e.points}`, e.combo > 1 ? GOLD : "#ffffff");
      if (e.combo > 1) {
        tone("combo", 0.6, 1 + 0.08 * e.combo);
        fx.combo = { n: e.combo, life: 1100, max: 1100 };
      }
      shake(90, 0.25);
    } else if (e.type === "hurt") {
      tone("bump", 0.35);
      // Steel rings on a sentry or a mine; a boat's hull just knocks.
      if (e.kind === "sentry" || e.kind === "mine") tone("clank", 0.3, vary(0.1));
      else tone("hit", 0.35, vary(0.1));
      burst(e.x, e.d, "#ffffff", 4, 8);
    } else if (e.type === "popbuoy") {
      tone("splash", 0.45, 1.4);
      tone("bubble", 0.4, vary(0.15));
      burst(e.x, e.d, "#7ff0c0", 10, 10);
      float(e.x, e.d + 2, `+${e.points}`, "#ffffff", 2.2);
    } else if (e.type === "charge") {
      tone("charge", 0.7);
      tone("rapidsChargeUp", 0.5, 0.85 + 0.3 * (e.battery / BATTERY));
      tone("slap", 0.3);
      ring(e.x, e.d, "#7ff0c0", 1.5, 6, 420);
      burst(e.x, e.d, "#7ff0c0", 10, 9);
      float(e.x, e.d + 3, "Charged!", "#7ff0c0", 2.4);
    } else if (e.type === "power") {
      const spec = POWERS[e.kind];
      tone("power");
      tone("powerUp", 0.55);
      // And each its own flourish.
      if (e.kind === "shield") tone("shieldUp", 0.5);
      else if (e.kind === "surge") tone("rapidsSurge", 0.55);
      else if (e.kind === "magnet") tone("warp", 0.4);
      else if (e.kind === "spread") tone("clank", 0.35, 1.2);
      burst(e.x, e.d, spec.color, 18, 12);
      ring(e.x, e.d, spec.color, 2, 6, 460);
      banner(spec.name, spec.blurb, spec.color, 1300);
    } else if (e.type === "shield") {
      tone("shield");
      tone("zapBig", 0.4);
      tone("splashBig", 0.35, 1.2);
      ring(e.x, e.d, POWERS.shield.color, 2, 7, 500);
      float(e.x, e.d + 4, "Saved!", POWERS.shield.color, 2.8);
      shake(150, 0.3);
    } else if (e.type === "lose") {
      if (e.cause === "flat") {
        tone("fall");
        tone("rapidsSputter", 0.8);
      } else {
        tone("crash");
        tone("boom", 0.7);
        // The wreck by its cause: a hull into a bank, a foe, a bolt or the dam.
        if (e.cause === "bank") {
          tone("smash", 0.8);
          tone("splashBig", 0.6);
        } else if (e.cause === "foe") {
          tone("explode", 0.6);
          tone("splashBig", 0.5);
        } else if (e.cause === "bolt") {
          tone("zapBig", 0.5);
          tone("blast", 0.6);
          tone("splashBig", 0.4);
        } else {
          tone("smash", 0.8);
          tone("thud", 0.8, 0.8);
        }
      }
      // The last life gone: the round is over once the wreck has shown.
      if (e.lives > 0) toneLater(350, "lifeLost", 0.5);
      burst(e.x, e.d, colors.you, 30, 18);
      burst(e.x, e.d, "#ff8a1f", 20, 14);
      ring(e.x, e.d, "#ffffff", 1, 8, 500);
      shake(e.cause === "flat" ? 200 : 380, e.cause === "flat" ? 0.4 : 1);
      flash(DANGER, 280);
      const words = { bank: "Ran aground!", foe: "Rammed!", bolt: "Hit!", dam: "Into the dam!", flat: "Out of charge!" };
      float(e.x, e.d + 5, words[e.cause] || "Crash!", DANGER, 2.8);
    } else if (e.type === "respawn") {
      // Whatever was showing is old news: the restart's banner goes first.
      fx.banners.length = 0;
      banner("Ready?", e.lives === 1 ? "Last life!" : `${e.lives} lives left`, e.lives === 1 ? DANGER : "#ffffff", READY_MS + 300);
      tone("rapidsPullStart", 0.6);
      if (e.lives === 1) tone("heartbeat", 0.6);
    } else if (e.type === "go") {
      tone("go", 0.6);
      tone("whoosh", 0.35);
    } else if (e.type === "over") {
      tone("gameOver", 0.8);
    } else if (e.type === "damhit") {
      tone("thunk", 0.35, 0.8 + 0.4 * (1 - e.hp / e.max));
      tone("crunch", 0.25, (0.8 + 0.4 * (1 - e.hp / e.max)) * vary());
      // Nearly through: it groans once.
      if (e.hp <= 2 && fx.damGroan !== round.dam.n) {
        fx.damGroan = round.dam.n;
        tone("rapidsDamGroan", 0.6);
      }
      burst(e.x, e.d, "#c9c3b8", 4, 9);
    } else if (e.type === "dambreak") {
      tone("dambreak");
      tone("ace", 0.7);
      tone("explode", 0.75);
      tone("crumble", 0.6);
      tone("rapidsFlood", 0.7);
      toneLater(450, "fanfare", 0.45);
      shake(420, 0.8);
      flash("#ffffff", 300);
      fx.cheer = 1200;
      burst(e.x - 8, e.d, "#c9c3b8", 30, 18);
      burst(e.x + 8, e.d, "#c9c3b8", 30, 18);
      burst(e.x, e.d, "#bfe6ff", 24, 16);
      float(e.x, e.d - 4, `Dam ${e.n} down! +${e.points}`, GOLD, 3);
      markFurthest(e.n, banner(`Dam ${e.n} down!`, `+${e.points} points`, GOLD, 1500));
    } else if (e.type === "stretch") {
      tone("levelup");
      tone("swoosh", 0.4);
      if (e.bonus) toneLater(250, "sparkle", 0.6);
      stretchBanner(e.n);
      if (e.bonus) float(ship.x, ship.d + 6, `Flawless! +${e.bonus}`, GOLD, 2.6);
    } else if (e.type === "skim") {
      if (fx.clock - fx.skimTone >= SKIM_TONE_MS) {
        fx.skimTone = fx.clock;
        tone("skim", 0.2, 1 + Math.min(0.5, round.stats.skimmed / 2000));
      }
      if (Math.random() < 0.35) burst(e.x, e.d - 1, "#e6f4ff", 2, 6);
    } else if (e.type === "gull") {
      tone("tunnel", 0.25, 1.6);
      tone("whoosh", 0.25, 1.3);
    } else if (e.type === "bolt") {
      // A sentry's cannon, or a boss's guns (the bigger, the lower).
      if (fx.clock - fx.boltTone >= BOLT_TONE_MS) {
        fx.boltTone = fx.clock;
        if (e.boss) tone("rapidsCannon", 0.45, 0.75 * vary());
        else tone("rapidsCannon", 0.35, vary());
      }
    } else if (e.type === "bossin") {
      const spec = BOSSES[e.kind];
      tone("mystery");
      tone("bossIntro", 0.8);
      tone("rapidsFoghorn", 0.6, 0.7);
      fx.bossHp = null;
      fx.bossHalf = false;
      shake(300, 0.35);
      banner(spec.name, `${spec.sub}. Sink it to reach the dam`, spec.color, 2200);
    } else if (e.type === "bossdown") {
      tone("levelup");
      tone("boom");
      tone("explode", 0.9);
      tone("rapidsBossSink", 0.7);
      toneLater(500, "victory", 0.7);
      if (e.life) toneLater(1000, "extraLife", 0.6);
      flash(GOLD, 420);
      fx.cheer = 1400;
      shake(600, 0.9);
      burst(e.x, e.d, BOSSES[e.kind].color, 70, 22);
      burst(e.x, e.d, GOLD, 40, 16);
      banner("Boss sunk!", `+${e.points} points${e.life ? ", and a life" : ""}`, GOLD, 2000);
    }
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    toneLater(220, "sparkle", 0.5);
    banner("New best!", "Every point from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  // The low battery's beep, quicker the lower it runs, with a warning the
  // moment it first drops under the mark.
  const lowSound = (ms) => {
    if (round.phase !== "run" || round.battery >= LOW_BATTERY) {
      fx.lowBeep = 0;
      if (round.battery >= LOW_BATTERY + 5) fx.lowWarned = false;
      return;
    }
    if (!fx.lowWarned) {
      fx.lowWarned = true;
      tone("warn", 0.4);
    }
    fx.lowBeep -= ms;
    if (fx.lowBeep > 0) return;
    fx.lowBeep = LOW_BEEP_MS * (0.5 + (0.5 * round.battery) / LOW_BATTERY);
    tone("lowcell", 0.5);
  };

  // The held sounds, asked for again every tick (they fade by themselves
  // once the game stops asking): the outboard, pitched with the speed and
  // sagging as the battery runs low; the river under it; spray while you
  // skim; the nearest whirlpool and gull drone, louder as they close; and a
  // mini-boss's engines.
  const runHums = () => {
    const ship = round.ship;
    const cruise = cruiseOf(round);
    const speed = ship.v / cruise;
    if (ship.alive) {
      const sag = round.battery < LOW_BATTERY ? 0.8 + (0.2 * round.battery) / LOW_BATTERY : 1;
      const idle = round.phase === "ready" ? 0.85 : 1;
      hum("rapids:motor", "outboard", 0.55 + 0.35 * clamp(speed - 0.4, 0, 1), (0.75 + 0.75 * speed) * sag * idle);
    }
    hum("rapids:river", "river", 0.45 + 0.25 * clamp(speed, 0, 1.6) / 1.6, 0.8 + 0.4 * clamp(speed, 0, 1.6));
    if (round.skimming && ship.alive) hum("rapids:spray", "rapidsSpray", 0.7, 0.8 + 0.3 * speed);
    let whirl = null;
    let gull = null;
    for (const f of round.foes) {
      if (f.kind === "whirl" && onScreen(round, f)) {
        const dist = Math.hypot(f.x - ship.x, f.d - ship.d);
        if (dist < WHIRL_HEAR && (!whirl || dist < whirl.dist)) whirl = { dist };
      } else if (f.kind === "gull" && f.on) {
        const dist = Math.hypot(f.x - ship.x, f.d - ship.d);
        if (dist < GULL_HEAR && (!gull || dist < gull.dist)) gull = { dist };
      }
    }
    if (whirl) hum("rapids:whirl", "rapidsWhirl", 1 - whirl.dist / WHIRL_HEAR, 0.8 + 0.5 * (1 - whirl.dist / WHIRL_HEAR));
    if (gull) hum("rapids:gull", "rapidsRotor", 1 - gull.dist / GULL_HEAR, 0.9 + 0.4 * (1 - gull.dist / GULL_HEAR));
    const boss = round.boss;
    if (boss) hum("rapids:boss", "rapidsBossEngine", boss.enter > 0 ? 1 - boss.enter / BOSS_ENTER_MS : 0.8, boss.kind === "leviathan" ? 0.8 : boss.kind === "ironclad" ? 1.15 : 1);
  };

  // The cues read from the round rather than its events: a timed power
  // ticking down and running out, a boss taking hits and roaring at its
  // half, and the horn for a dam coming into view.
  const watchSound = () => {
    for (const kind of ["spread", "magnet"]) {
      const left = round.effects[kind] || 0;
      const was = fx.powers[kind];
      if (left > 0 && left < POWER_WARN_MS) {
        const step = Math.ceil(left / POWER_TICK_MS);
        if (was && was.step !== step) tone("tickSoft", 0.5, 1 + 0.1 * (4 - step));
        fx.powers[kind] = { step };
      } else if (left > 0) fx.powers[kind] = { step: 0 };
      else {
        // Run out, not lost in a crash (which wipes them silently).
        if (was && round.phase !== "crash") tone("powerDown", 0.4);
        delete fx.powers[kind];
      }
    }
    const boss = round.boss;
    if (boss && boss.enter <= 0) {
      if (fx.bossHp !== null && boss.hp < fx.bossHp && fx.clock - fx.bossHitTone >= BOSS_HIT_MS) {
        fx.bossHitTone = fx.clock;
        tone("clank", 0.3, (0.6 + 0.5 * (1 - boss.hp / boss.max)) * vary());
      }
      if (!fx.bossHalf && boss.hp <= boss.max / 2) {
        fx.bossHalf = true;
        tone("rapidsBossRoar", 0.7, boss.kind === "leviathan" ? 0.8 : 1);
      }
      fx.bossHp = boss.hp;
    } else fx.bossHp = null;
    const dam = round.dam;
    if (dam && dam.hp > 0 && fx.damSeen !== dam.n && round.phase === "run" && dam.d < round.cam + FIELD_H) {
      fx.damSeen = dam.n;
      tone("rapidsFoghorn", 0.5);
    }
  };

  const runSound = (ms) => {
    lowSound(ms);
    runHums();
    watchSound();
  };

  // A banner sits up top, but one that first shows during a boss fight sits
  // lower, below the boss and still well above you.
  const bannerY = () => (round.phase === "boss" ? BOSS_BANNER_Y : BANNER_Y);

  const runFx = (ms) => {
    fx.clock += ms;
    if (fx.later.length) {
      for (const t of fx.later) if ((t.ms -= ms) <= 0) tone(t.name, t.level, t.pitch);
      fx.later = fx.later.filter((t) => t.ms > 0);
    }
    const s = ms / 1000;
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.d += p.vd * s;
      const damp = 0.9 ** (ms / 16);
      p.vx *= damp;
      p.vd *= damp;
      return p.life > 0;
    });
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.rise += 5 * s;
      return f.life > 0;
    });
    fx.rings = fx.rings.filter((r) => (r.life -= ms) > 0);
    if (fx.combo && (fx.combo.life -= ms) <= 0) fx.combo = null;
    fx.cheer = Math.max(0, fx.cheer - ms);
    if (fx.banners.length) {
      const b = fx.banners[0];
      if (b.y == null) b.y = bannerY();
      const target = underBanner(round, b.y) ? BANNER_SEE_THROUGH : 1;
      b.see += (target - b.see) * Math.min(1, ms / BANNER_FADE_MS);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
    }
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash && (fx.flash.life -= ms) <= 0) fx.flash = null;
  };

  // The pills' numbers: the stretch, lives, the shield and the timed powers
  // (emptying as they run out) and the combo while it lasts.
  const hudOf = () => {
    const effects = [];
    if (round.shield > 0) effects.push({ text: round.shield > 1 ? "SHIELD x2" : "SHIELD", color: POWERS.shield.color, fill: 1 });
    for (const kind of ["spread", "magnet"]) {
      if (active(round, kind)) effects.push({ text: kind.toUpperCase(), color: POWERS[kind].color, fill: round.effects[kind] / POWERS[kind].ms });
    }
    const spec = stretchFor(round.stretch);
    return { stretch: `STRETCH ${round.stretch}`, color: lookColor(spec.look), effects, combo: round.combo, comboFill: round.comboMs / COMBO_MS, battery: round.battery / BATTERY, low: round.battery < LOW_BATTERY };
  };

  // The view rapids-draw.js draws from: one object, refilled each frame.
  const view = { g: Object.freeze({ W, H, HUD_H, PAD, GAP, BAR_W, FIELD_W, FIELD_H, ROW, SHIP_W, SHIP_L, DAM_T, BOSS_R, WHIRL_R, CRASH_MS, LOW_BATTERY: LOW_BATTERY / BATTERY }), foes: FOES, powers: POWERS, bosses: BOSSES, riverAt, stretchFor, maxDots: STRETCHES.length };
  const shakeAt = { x: 0, y: 0 };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    // A banner takes its place on its first frame: a frame painted before the
    // next tick (the start's, held through the 3, 2, 1) would draw it at the top.
    const head = fx.banners[0] || null;
    if (head && head.y == null) head.y = bannerY();
    view.u = u;
    view.clock = fx.clock;
    view.state = state;
    view.colors = colors;
    view.round = round;
    view.river = round.river;
    view.fx = fx;
    view.cam = round.cam;
    view.yOf = (d) => FIELD_H - (d - round.cam);
    view.pillH = Math.max(12 / u, 2.4);
    view.hud = hudOf();
    view.look = stretchFor(round.stretch).look;
    view.combo = fx.combo;
    view.cheer = fx.cheer > 0;
    view.flash = fx.flash;
    view.banner = head;
    view.furthest = furthest;
    view.lost = state === "over";
    view.shake = null;
    if (fx.shake > 0 && state === "running") {
      shakeAt.x = (Math.random() - 0.5) * 2 * fx.shakeMag;
      shakeAt.y = (Math.random() - 0.5) * 2 * fx.shakeMag;
      view.shake = shakeAt;
    }
    view.tally = null;
    view.big = null;
    const reached = furthest > 0 ? `Furthest: ${stretchName(furthest)}` : "No dam blasted yet";
    view.tallyTop = state === "ready";
    if (state === "ready") view.tally = ["Blast up the river, smash every dam", "Grab charge before you run dry", "Arrows steer, up speeds, down slows", "Hold space to fire", reached];
    else if (state === "over") {
      const st = round.stats;
      view.big = String(round.score);
      const news = [further ? "New furthest!" : "", beaten ? "A new best!" : ""].filter(Boolean).join(" ");
      view.tally = [`Reached ${stretchName(round.stretch)}`, ...(news ? [news] : []), `${st.kills} sunk, ${st.charged} charge${st.charged === 1 ? "" : "s"}, best combo x${round.bestCombo}`, teaser(round, furthest)];
    }
    drawScene(ctx, view);
  };

  // Nothing held carries over a pause or a new round: a release may never arrive.
  const letGo = () => Object.keys(round.input).forEach((k) => (round.input[k] = false));

  const start = () => {
    colors = readColors(canvas);
    round = newRound();
    state = "running";
    further = false;
    resetFx();
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    stretchBanner(1);
    tone("rapidsPullStart", 0.6);
    paint();
  };

  const end = () => {
    state = "over";
    letGo();
    onScore(round.score);
  };

  const MOVES = Object.freeze({ left: true, right: true, up: true, down: true });

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
    // Held arrows steer, speed up and slow down until let go; held space
    // fires. Space (or Enter) also starts a round, without firing: Enter
    // has no release to stop it. Playing on from a pause is the window's.
    key(name) {
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        else if (state === "running") round.input.fire = true;
        return true;
      }
      if (!MOVES[name]) return false;
      if (state === "running") {
        // A fresh press (not a key's repeat) of the throttle revs the motor;
        // a fresh turn carves the water.
        if (!round.input[name] && round.ship.alive) {
          if (name === "up") tone("rapidsRevUp", 0.45);
          else if ((name === "left" || name === "right") && fx.clock - fx.carveTone >= CARVE_MS && round.ship.v >= cruiseOf(round) * 0.9) {
            fx.carveTone = fx.clock;
            tone("rapidsCarve", 0.3, vary(0.1));
          }
        }
        round.input[name] = true;
      }
      return true;
    },
    // A key let go: stop steering, speeding or slowing that way, or stop firing.
    release(name) {
      if (name === "action") round.input.fire = false;
      else if (MOVES[name]) round.input[name] = false;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      advance(round, ms);
      runSound(ms);
      drain();
      if (round.over) end();
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

// The end screen's nudge to play again: the next foe not yet met, else the
// next boss from the dam still standing, or the furthest dam to beat once
// past it.
export function teaser(round, furthest) {
  const next = FOE_KINDS.find((k) => FOES[k].from > round.stretch);
  if (next) return `A new foe waits at stretch ${FOES[next].from}...`;
  const standing = round.dam && round.dam.hp > 0 ? round.stretch : round.stretch + 1;
  const boss = Math.ceil(standing / BOSS_EVERY) * BOSS_EVERY;
  return furthest >= boss ? `Can you beat dam ${furthest + 1}?` : `A boss guards dam ${boss}. One more go?`;
}

export default Object.freeze({ id: "rapids", title: "Rapids Run", create });
