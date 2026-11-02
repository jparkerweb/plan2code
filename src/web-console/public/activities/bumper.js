// Plan2Code Web Console - Bumper Ring, the seventh activity: the ring's physics, the rivals, the arenas and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, newHeat, push,
// collide, dash, advance, aim), exported so the unit suite can drive them
// without a canvas; the drawing lives in bumper-draw.js, and the default
// export is the contract every listed game answers.
//
// Sumo bumper cars on a platform over the void. The held arrows push your
// car that way, momentum carries it, and cars bounce off each other: whoever
// rams harder wins the exchange. Space dashes. A car whose center leaves the
// edge falls, and the last car still on the ring wins the heat. A round is a
// string of heats in arenas: a win moves on to the next arena, a fall costs
// one of three lives and runs the heat again. After a while the ring shrinks
// a band at a time, so stalling never wins. Each arena brings a rival more
// or something new (power pads, bumpers, ice, a turntable, holes, a magnet,
// a ring that turns square), and past the ninth the Grand Final repeats,
// sharper each time. The memo keeps the furthest arena ever reached.

import { DANGER, GOLD, arenaColor, drawScene, readColors, themeFor } from "./bumper-draw.js";

// The board, in arena units: the ring sits a little low, so the pills along
// the top never cover it. The canvas scales a unit in quarter-pixel steps.
export const W = 128;
export const H = 96;
export const CX = 64;
export const CY = 50;

// Below this many pixels a unit, the board is too small to play: resize()
// says so and the window shows its bigger-window note.
export const MIN_CELL = 3;

// The ring's radius at the start of a heat, and the floor the shrink stops
// at. A heat still going SUDDEN_MS after the floor is reached goes to sudden
// death: the ring shrinks on a unit at a time to LAST_RING, where two cars
// no longer fit.
export const RING_R = 45;
export const MIN_RING = 12;
export const SUDDEN_MS = 6000;
export const LAST_RING = 3;

// Every car is a circle this big, mass 1 unless its personality says more.
export const CAR_R = 4;

// The push: ACCEL toward the held direction, never past MAX_SPEED that way,
// and DRAG always easing a car back to the floor's own speed, so a car let go
// coasts and settles. Cars meet with restitution BOUNCE, and the faster one
// gives SHOVE_BONUS more of the impulse (and takes that much less back), so
// the one who rams wins the exchange. These and the dash below were tuned by
// hand from the brief's starting numbers (game-ideas/bumper-ring.md, "As
// built"), aiming for a full-speed dash that carries a car that pushes back
// about a third of the ring and heats from arena 2 on of 20 to 60 seconds.
export const ACCEL = 200;
export const MAX_SPEED = 52;
export const DRAG = 2.6;
export const BOUNCE = 0.9;
export const SHOVE_BONUS = 0.35;
// Cars meeting slower than IMPACT_SPEED are leaning on each other, not
// hitting: no bounce and no shove, so a pushing match goes to the stronger
// push rather than to whoever happens to be moving.
export const IMPACT_SPEED = 12;

// A dash adds DASH_SPEED the way you push (never past DASH_CAP that way) and
// makes the car DASH_MASS times heavier for DASH_MS, so a dash beats a car
// that stands. Every heat starts with START_CHARGES; one comes back every
// RECHARGE_MS, up to MAX_CHARGES.
export const DASH_SPEED = 52;
export const DASH_CAP = 84;
export const DASH_MS = 250;
export const DASH_MASS = 1.5;
export const START_CHARGES = 2;
export const MAX_CHARGES = 3;
export const RECHARGE_MS = 6000;

// The last TEETER units before the edge hold a car back: its speed outward
// drains at TEETER_DRAG, so a push back in can still save it.
export const TEETER = 3;
const TEETER_DRAG = 5;

// The ring shrinks SHRINK_STEP at a time: the first SHRINK_START_MS into a
// heat, then every arena's `shrinkMs`, each band flashing SHRINK_WARN_MS first.
export const SHRINK_START_MS = 12000;
export const SHRINK_STEP = 3;
export const SHRINK_WARN_MS = 1200;

// A heat holds still for READY_MS so everyone can see the field (the first
// one only briefly: the window has just counted 3, 2, 1), and shows how it
// went for DONE_MS before the next one. A car falls for FALL_MS.
export const READY_MS = 1200;
const FIRST_READY_MS = 300;
export const DONE_MS = 1800;
export const FALL_MS = 500;

export const START_LIVES = 3;
export const MAX_ARENA = 9;

// Points, each times the arena: a knockout for the last car to touch the one
// that fell within CREDIT_MS, the heat itself (more without a teeter), a
// point a second alive, and a rival that falls chasing you untouched. KOs
// within COMBO_MS of each other step a combo up to MAX_COMBO, and two of
// yours within DOUBLE_MS of each other both count twice.
export const KO_POINTS = 10;
export const WIN_POINTS = 25;
export const FLAWLESS_POINTS = 15;
export const SURVIVE_POINTS = 1;
export const BAIT_POINTS = 5;
export const CREDIT_MS = 2000;
export const COMBO_MS = 3500;
export const MAX_COMBO = 5;
export const DOUBLE_MS = 1000;
// A rival you hit that hits another within CAROM_MS passes your credit on.
const CAROM_MS = 600;

// A rival thinks every THINK_MS at sharpness 0, THINK_FAST_MS at 1. One
// within PANIC of the edge pushes for the middle first, unless it misjudges:
// a sloppy one, up to MISJUDGE of its thinks, stops minding the edge for
// BLIND_MS. One knocked about thinks again within REACT_MS (sooner when
// sharp). A rival's dash is wound up first, for WINDUP_MS at sharpness 0
// down to WINDUP_FAST_MS at 1: it lets go of the push and revs, which is
// your moment to get out of the way.
export const THINK_MS = 250;
const THINK_FAST_MS = 80;
export const PANIC = 9;
const MISJUDGE = 0.12;
const REACT_MS = 160;
const BLIND_MS = 600;
export const WINDUP_MS = 420;
const WINDUP_FAST_MS = 200;

// The power pads: the first FIRST_PAD_MS into a heat, then every PAD_MS give
// or take PAD_SPREAD_MS, MAX_PADS at once, each gone after PAD_TTL_MS.
const FIRST_PAD_MS = 4000;
const PAD_MS = 6000;
const PAD_SPREAD_MS = 3000;
const MAX_PADS = 2;
export const PAD_TTL_MS = 9000;
export const PAD_R = 3;

// Heavy doubles a car's mass, Grow its size; Spring sends the next car it
// meets flying (its impulse SPRING_KICK times); a Slick car leaves oil, ice
// for everyone else, for SLICK_TTL_MS a drop.
const HEAVY_MASS = 2;
const GROW_SIZE = 1.4;
export const SPRING_KICK = 2.2;
const SLICK_DROP_MS = 110;
const SLICK_TTL_MS = 5000;
const SLICK_R = 3.4;

// The floor: ice divides the drag by ICE_DRAG and gives ICE_GRIP of the push.
const ICE_DRAG = 4;
const ICE_GRIP = 0.55;

// Bumpers kick a car off at BUMPER_KICK times its speed, never under
// BUMPER_MIN; the Turntable turns SPIN radians a second; holes open for
// HOLE_OPEN_MS after HOLE_SHUT_MS shut and HOLE_WARN_MS flashing; the magnet
// pulls for MAGNET_PULL_MS, then pushes for MAGNET_PUSH_MS, at MAGNET_ACCEL
// at the edge; the Hall of Mirrors swaps round and square every SHAPE_MS,
// flashing SHAPE_WARN_MS before the square's corners go.
export const BUMPER_R = 3.2;
const BUMPER_KICK = 1.25;
const BUMPER_MIN = 42;
export const SPIN = 0.32;
export const HOLE_R = 5.5;
const HOLE_SHUT_MS = 4000;
export const HOLE_WARN_MS = 1200;
const HOLE_OPEN_MS = 3500;
const MAGNET_PULL_MS = 5000;
const MAGNET_PUSH_MS = 3000;
export const MAGNET_WARN_MS = 1000;
const MAGNET_ACCEL = 46;
const SHAPE_MS = 7000;
export const SHAPE_WARN_MS = 1500;

// The Mirror copies your push and your dash MIRROR_MS later.
export const MIRROR_MS = 320;

// Time is handed to the cars in slices this long: short enough that a fast
// car never passes through another between two of them.
const SLICE_MS = 4;

const PADS_LEVEL = 2;
const BUMPERS_LEVEL = 3;
const ICE_LEVEL = 4;
const SPIN_LEVEL = 5;
const HOLES_LEVEL = 6;
const MAGNET_LEVEL = 7;
const SHAPES_LEVEL = 8;

const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

// The pads. A timed one lasts `ms`; Spring and Shield wait for their moment;
// Charge acts at once. `weight` is how often each turns up against the others.
export const POWERS = deepFreeze({
  heavy: { name: "Heavy", blurb: "Twice the mass: hit like a truck", color: "#7a5cff", ms: 5000, weight: 3 },
  spring: { name: "Spring", blurb: "The next car you hit goes flying", color: "#ff4fa3", weight: 3 },
  charge: { name: "Charge", blurb: "One more dash", color: "#ff8a1f", weight: 3 },
  shield: { name: "Shield", blurb: "Bounce back once instead of falling", color: "#1fb6d9", weight: 2 },
  grow: { name: "Grow", blurb: "Bigger and harder to miss", color: "#57b54a", ms: 5000, weight: 2 },
  ghost: { name: "Ghost", blurb: "Pass through cars", color: "#b7bccb", ms: 3000, weight: 1 },
  slick: { name: "Slick", blurb: "Leave oil behind you", color: "#3fd0c9", ms: 4000, weight: 2 },
});

// The rivals: a personality each, with its own weight, push and top speed
// (as parts of yours).
export const RIVALS = deepFreeze({
  bully: { name: "Bully", color: "#e2553f", mass: 1, accel: 1, top: 1.06, blurb: "Charges straight in" },
  turtle: { name: "Turtle", color: "#2fbf71", mass: 1.6, accel: 0.9, top: 0.72, blurb: "Heavy, and holds the middle" },
  sniper: { name: "Sniper", color: "#a466ff", mass: 0.95, accel: 1.05, top: 1.04, blurb: "Waits for you to be near the edge" },
  scrapper: { name: "Scrapper", color: "#ff8a1f", mass: 1, accel: 1, top: 1, blurb: "Hunts whoever is nearest the edge" },
  mirror: { name: "Mirror", color: "#8f97ab", mass: 1, accel: 1, top: 1, blurb: "Copies your every move" },
});

// Each arena: its rivals, how sharp they drive (0 to 1), how often the ring
// shrinks, and what it adds. Every arena from a feature's own on keeps it.
export const ARENAS = deepFreeze({
  1: { title: "Training Mat", sub: "Push the Bully off the ring", rivals: ["bully"], smart: 0.3, shrinkMs: 3500 },
  2: { title: "The Ring", sub: "A Turtle, and power pads", rivals: ["bully", "turtle"], smart: 0.38, shrinkMs: 3000 },
  3: { title: "Bumper Alley", sub: "A Sniper, and bumpers by the edge", rivals: ["bully", "turtle", "sniper"], smart: 0.46, shrinkMs: 3000 },
  4: { title: "Ice Rink", sub: "Ice on the floor: mind the slide", rivals: ["bully", "turtle", "sniper"], smart: 0.54, shrinkMs: 3000 },
  5: { title: "Turntable", sub: "The ring turns, and a Scrapper", rivals: ["bully", "turtle", "sniper", "scrapper"], smart: 0.62, shrinkMs: 3000 },
  6: { title: "Swiss Cheese", sub: "Holes open in the floor", rivals: ["bully", "turtle", "sniper", "scrapper"], smart: 0.7, shrinkMs: 3000 },
  7: { title: "Magnet Rink", sub: "The middle pulls, then pushes", rivals: ["bully", "turtle", "sniper", "scrapper"], smart: 0.78, shrinkMs: 3000 },
  8: { title: "Hall of Mirrors", sub: "A Mirror, and a ring that turns square", rivals: ["bully", "turtle", "sniper", "scrapper", "mirror"], smart: 0.86, shrinkMs: 3000 },
  9: { title: "Grand Final", sub: "Everything, and a faster shrink", rivals: ["bully", "turtle", "sniper", "scrapper", "mirror"], smart: 1, shrinkMs: 2200 },
});

// Arenas past the ninth are the Grand Final again, named Final 2, Final 3
// and on, its rivals a little quicker and its ring shrinking a little sooner.
// The rules ask for it many times a slice, so each Final is built once.
const FINALS = new Map();
export function arenaFor(level) {
  const n = Math.max(1, Math.floor(level) || 1);
  if (n <= MAX_ARENA) return ARENAS[n];
  if (!FINALS.has(n)) {
    const extra = n - MAX_ARENA;
    FINALS.set(n, Object.freeze({ ...ARENAS[MAX_ARENA], title: `Final ${extra + 1}`, sub: "Sharper rivals, faster shrink", shrinkMs: Math.max(1400, ARENAS[MAX_ARENA].shrinkMs - extra * 120), pace: 1 + Math.min(0.25, extra * 0.03) }));
  }
  return FINALS.get(n);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const len = (x, y) => Math.hypot(x, y);
const unit = (x, y) => {
  const d = Math.hypot(x, y);
  return d > 1e-9 ? { x: x / d, y: y / d } : { x: 0, y: 0 };
};
const pickOf = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

export const has = (car, kind) => Boolean(car.fx && car.fx[kind] > 0);

// How hard a rival drives at the round's arena, as parts of you: a sloppy
// rival pushes, tops out and dashes a little short of you; a sharp one
// matches you, and past the Grand Final outdoes you. Asked for every car
// every slice, so each arena's is built once.
const POWER_AT = new Map();
export function rivalPower(level) {
  const spec = arenaFor(level);
  if (!POWER_AT.has(spec)) {
    const pace = spec.pace || 1;
    POWER_AT.set(spec, Object.freeze({ push: (0.8 + 0.2 * spec.smart) * pace, top: (0.86 + 0.14 * spec.smart) * pace, dash: 0.62 + 0.38 * spec.smart }));
  }
  return POWER_AT.get(spec);
}

/* ---------------------------------------------------------------- cars */

function makeCar(id, kind, angle, spawnR) {
  const spec = kind === "planny" ? { mass: 1, accel: 1, top: 1 } : RIVALS[kind];
  return {
    id,
    kind,
    x: CX + Math.cos(angle) * spawnR,
    y: CY + Math.sin(angle) * spawnR,
    vx: 0,
    vy: 0,
    face: angle + Math.PI,
    r: CAR_R,
    mass: spec.mass,
    accel: spec.accel,
    top: spec.top,
    alive: true,
    fall: 0,
    spin: 0,
    charges: id === 0 ? START_CHARGES : 1,
    recharge: 0,
    dashMs: 0,
    fx: {},
    spring: false,
    shield: false,
    push: { x: 0, y: 0 },
    think: 0,
    target: null,
    touch: null,
    slickMs: 0,
    blind: 0,
    windup: 0,
    windDir: null,
  };
}

// A car's mass right now: Heavy doubles it, a dash makes it DASH_MASS times.
export const massOf = (car) => car.mass * (has(car, "heavy") ? HEAVY_MASS : 1) * (car.dashMs > 0 ? DASH_MASS : 1);

const sizeOf = (car) => CAR_R * (has(car, "grow") ? GROW_SIZE : 1);

/* --------------------------------------------------------------- the ring */

// How far inside the ring's edge a point is (negative past it): a circle,
// or in the Hall of Mirrors' square turns a square of the same half-width.
export function edgeGap(round, x, y) {
  const dx = x - CX;
  const dy = y - CY;
  if (round.shape === "square") return round.R - Math.max(Math.abs(dx), Math.abs(dy));
  return round.R - len(dx, dy);
}

// The way out of the ring at a point: away from the middle, or for the
// square, straight out through its nearest side.
function outward(round, x, y) {
  const dx = x - CX;
  const dy = y - CY;
  if (round.shape === "square") return Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx) || 1, y: 0 } : { x: 0, y: Math.sign(dy) || 1 };
  return unit(dx, dy);
}

const holeOpen = (h) => h.ms >= HOLE_SHUT_MS + HOLE_WARN_MS;

// A hole's state for the drawing: shut, flashing its warning, or open.
export const holeState = (h) => (h.ms < HOLE_SHUT_MS ? "shut" : h.ms < HOLE_SHUT_MS + HOLE_WARN_MS ? "warn" : "open");
const holeAt = (round, x, y) => round.holes.find((h) => holeOpen(h) && len(x - h.x, y - h.y) < h.r) || null;

// True when a car's center is past the edge or over an open hole.
export function outOfRing(round, car) {
  return edgeGap(round, car.x, car.y) < 0 || Boolean(holeAt(round, car.x, car.y));
}

// The steps down to the floor, and when the floor is reached.
const FLOOR_STEPS = Math.ceil((RING_R - MIN_RING) / SHRINK_STEP);
const floorAtMs = (every) => SHRINK_START_MS + (FLOOR_STEPS - 1) * every;

// The ring's radius the clock says, at `clock` ms into the heat: whole until
// SHRINK_START_MS, then SHRINK_STEP less at each of the arena's steps down to
// MIN_RING, and in sudden death a unit less a step down to LAST_RING.
export function shrinkAt(round, clock = round.clock) {
  if (clock < SHRINK_START_MS) return RING_R;
  const every = arenaFor(round.level).shrinkMs;
  const steps = 1 + Math.floor((clock - SHRINK_START_MS) / every);
  if (steps < FLOOR_STEPS) return RING_R - steps * SHRINK_STEP;
  const sudden = clock - floorAtMs(every) - SUDDEN_MS;
  if (sudden < 0) return MIN_RING;
  return Math.max(LAST_RING, MIN_RING - 1 - Math.floor(sudden / every));
}

// The ms to the ring's next step, or Infinity once it is as small as it goes.
export function nextShrinkIn(round, clock = round.clock) {
  if (shrinkAt(round, clock) <= LAST_RING) return Infinity;
  if (clock < SHRINK_START_MS) return SHRINK_START_MS - clock;
  const every = arenaFor(round.level).shrinkMs;
  const floor = floorAtMs(every);
  if (clock < floor) return every - ((clock - SHRINK_START_MS) % every);
  if (clock < floor + SUDDEN_MS) return floor + SUDDEN_MS - clock;
  return every - ((clock - floor - SUDDEN_MS) % every);
}

// True once the ring has gone past its floor into sudden death.
export const suddenDeath = (round, clock = round.clock) => shrinkAt(round, clock) < MIN_RING;

// The floor under a point, for a given car: its drag and grip, and the speed
// the floor itself moves at there (the Turntable carries cars round).
function floorAt(round, car) {
  let drag = DRAG;
  let grip = 1;
  const iced = round.ice.some((p) => len(car.x - p.x, car.y - p.y) < p.r) || round.slicks.some((p) => p.owner !== car.id && len(car.x - p.x, car.y - p.y) < p.r);
  if (iced) {
    drag /= ICE_DRAG;
    grip = ICE_GRIP;
  }
  const fx = -(car.y - CY) * round.spin;
  const fy = (car.x - CX) * round.spin;
  return { drag, grip, fx, fy, iced };
}

// Spawn spots evenly round the ring, you at the bottom, everyone facing in.
const SPAWN_R = 19;

function placeBumpers(round) {
  round.bumpers = [0, 1, 2, 3].map((k) => {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    return { x: CX + Math.cos(a) * 34, y: CY + Math.sin(a) * 34, r: BUMPER_R };
  });
}

// Ice in a few patches clear of the spawns, a different scatter each heat.
function placeIce(round, random) {
  round.ice = [];
  for (let tries = 0; tries < 80 && round.ice.length < 3; tries++) {
    const a = random() * Math.PI * 2;
    const d = 8 + random() * 24;
    const r = 8 + random() * 4;
    const x = CX + Math.cos(a) * d;
    const y = CY + Math.sin(a) * d;
    if (round.ice.some((p) => len(p.x - x, p.y - y) < p.r + r - 2)) continue;
    round.ice.push({ x, y, r });
  }
}

function placeHoles(round, random) {
  const turn = random() * Math.PI * 2;
  round.holes = [0, 1, 2].map((k) => {
    const a = turn + (k * Math.PI * 2) / 3;
    return { x: CX + Math.cos(a) * 18, y: CY + Math.sin(a) * 18, r: HOLE_R, ms: -k * 1500 };
  });
}

// A fresh heat at the round's level: the cars on their spawns, the arena's
// floor, and nothing moving yet.
export function newHeat(round, random = Math.random, readyMs = READY_MS) {
  const spec = arenaFor(round.level);
  const kinds = ["planny", ...spec.rivals];
  const step = (Math.PI * 2) / kinds.length;
  round.cars = kinds.map((kind, i) => makeCar(i, kind, Math.PI / 2 + i * step, SPAWN_R));
  const power = rivalPower(round.level);
  for (const car of round.cars) if (car.id !== 0) car.top *= power.top;
  round.R = RING_R;
  round.shape = "round";
  round.shapeMs = 0;
  round.spin = round.level >= SPIN_LEVEL ? SPIN : 0;
  round.turn = 0;
  round.bumpers = [];
  if (round.level >= BUMPERS_LEVEL) placeBumpers(round);
  round.ice = [];
  if (round.level >= ICE_LEVEL) placeIce(round, random);
  round.holes = [];
  if (round.level >= HOLES_LEVEL) placeHoles(round, random);
  round.magnet = round.level >= MAGNET_LEVEL ? { pull: 1, ms: 0 } : null;
  round.slicks = [];
  round.pads = [];
  round.nextPad = FIRST_PAD_MS;
  round.echoes = [];
  round.lastDir = { x: 0, y: 0 };
  round.phase = "ready";
  round.phaseMs = readyMs;
  round.clock = 0;
  round.aliveMs = 0;
  round.close = false;
  round.combo = 0;
  round.lastKo = -Infinity;
  round.lastKoPoints = 0;
  round.lastKoDoubled = false;
  round.result = null;
  return round;
}

export function newRound(random = Math.random) {
  const round = { level: 1, lives: START_LIVES, score: 0, heatsWon: 0, kos: 0, bestCombo: 0, over: false, events: [], input: { up: false, down: false, left: false, right: false } };
  return newHeat(round, random, FIRST_READY_MS);
}

/* ------------------------------------------------------------- physics */

// The way your held arrows push, as a unit vector (zero with none held, or
// two that cancel).
export function inputDir(round) {
  const { up, down, left, right } = round.input;
  return unit(Number(right) - Number(left), Number(down) - Number(up));
}

// Pushes a car along `dir` (a unit vector) for `ms`: ACCEL times its own
// push and the floor's grip, never past its top speed that way. Speed across
// `dir` is left alone, which is where the drift comes from.
export function push(car, dir, ms, grip = 1) {
  if (!dir || (!dir.x && !dir.y)) return;
  const cap = MAX_SPEED * car.top;
  const along = car.vx * dir.x + car.vy * dir.y;
  if (along >= cap) return;
  const dv = Math.min(ACCEL * car.accel * grip * (ms / 1000), cap - along);
  car.vx += dir.x * dv;
  car.vy += dir.y * dv;
}

// Two cars that touch: pushed apart by mass, and bounced off each other with
// restitution BOUNCE. The car closing faster rams: the other takes
// SHOVE_BONUS more of the impulse, the rammer that much less, and a Spring
// car's victim SPRING_KICK times as much. Returns the closing speed and who
// rammed, or null when they do not touch (or one is a Ghost).
export function collide(a, b) {
  if (!a.alive || !b.alive || has(a, "ghost") || has(b, "ghost")) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = len(dx, dy);
  const reach = a.r + b.r;
  if (d >= reach) return null;
  const n = d > 1e-9 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
  const ma = massOf(a);
  const mb = massOf(b);
  const overlap = reach - d;
  a.x -= n.x * overlap * (mb / (ma + mb));
  a.y -= n.y * overlap * (mb / (ma + mb));
  b.x += n.x * overlap * (ma / (ma + mb));
  b.y += n.y * overlap * (ma / (ma + mb));
  const sa = a.vx * n.x + a.vy * n.y;
  const sb = -(b.vx * n.x + b.vy * n.y);
  const closing = sa + sb;
  if (closing <= 0) return { speed: 0, rammer: null, n };
  const impact = closing >= IMPACT_SPEED;
  const j = ((1 + (impact ? BOUNCE : 0)) * closing) / (1 / ma + 1 / mb);
  const rammer = !impact || Math.abs(sa - sb) < 1e-6 ? null : sa > sb ? a : b;
  let ka = 1;
  let kb = 1;
  if (rammer === a) {
    ka = 1 - SHOVE_BONUS;
    kb = 1 + SHOVE_BONUS;
  } else if (rammer === b) {
    ka = 1 + SHOVE_BONUS;
    kb = 1 - SHOVE_BONUS;
  }
  let sprung = null;
  if (impact && a.spring) {
    kb *= SPRING_KICK;
    a.spring = false;
    sprung = a;
  }
  if (impact && b.spring) {
    ka *= SPRING_KICK;
    b.spring = false;
    sprung = b;
  }
  a.vx -= (n.x * j * ka) / ma;
  a.vy -= (n.y * j * ka) / ma;
  b.vx += (n.x * j * kb) / mb;
  b.vy += (n.y * j * kb) / mb;
  return { speed: closing, rammer, n, sprung };
}

// Spends a dash charge: DASH_SPEED more along `dir` (your arrows, or the way
// you face with none held), anything going the other way dropped first, and
// DASH_MS of DASH_MASS. One dash at a time.
export function dash(round, car, dir = null) {
  if (round.phase !== "fight" || !car.alive || car.charges <= 0 || car.dashMs > 0) return false;
  let d = dir || (car.id === 0 ? inputDir(round) : car.push);
  if (!d || (!d.x && !d.y)) d = { x: Math.cos(car.face), y: Math.sin(car.face) };
  d = unit(d.x, d.y);
  let along = car.vx * d.x + car.vy * d.y;
  if (along < 0) {
    car.vx -= d.x * along;
    car.vy -= d.y * along;
    along = 0;
  }
  const k = car.id === 0 ? 1 : rivalPower(round.level).dash;
  const add = Math.max(0, Math.min(DASH_SPEED * k, DASH_CAP * k - along));
  car.vx += d.x * add;
  car.vy += d.y * add;
  car.charges -= 1;
  car.dashMs = DASH_MS;
  car.face = Math.atan2(d.y, d.x);
  round.events.push({ type: "dash", id: car.id, x: car.x, y: car.y, dx: d.x, dy: d.y });
  if (car.id === 0 && round.cars.some((c) => c.kind === "mirror" && c.alive)) round.echoes.push({ at: round.clock + MIRROR_MS, dash: true, x: d.x, y: d.y });
  return true;
}

/* -------------------------------------------------------------- powers */

export function applyPower(round, car, kind) {
  const spec = POWERS[kind];
  if (!spec) return false;
  if (kind === "charge") car.charges = Math.min(MAX_CHARGES, car.charges + 1);
  else if (kind === "spring") car.spring = true;
  else if (kind === "shield") car.shield = true;
  else car.fx[kind] = spec.ms;
  round.events.push({ type: "power", id: car.id, kind, x: car.x, y: car.y });
  return true;
}

function pickPower(random) {
  const kinds = Object.keys(POWERS);
  const total = kinds.reduce((sum, k) => sum + POWERS[k].weight, 0);
  let roll = random() * total;
  for (const k of kinds) {
    roll -= POWERS[k].weight;
    if (roll < 0) return k;
  }
  return kinds[kinds.length - 1];
}

// A pad somewhere on the floor clear of the edge, the cars, the holes and
// the other pads.
export function spawnPad(round, kind, random = Math.random) {
  for (let tries = 0; tries < 60; tries++) {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * Math.max(0, round.R - 8);
    const x = CX + Math.cos(a) * d;
    const y = CY + Math.sin(a) * d;
    if (edgeGap(round, x, y) < 6) continue;
    if (round.cars.some((c) => c.alive && len(c.x - x, c.y - y) < 10)) continue;
    if (round.holes.some((h) => len(h.x - x, h.y - y) < h.r + 3)) continue;
    if (round.pads.some((p) => len(p.x - x, p.y - y) < 8)) continue;
    const pad = { x, y, kind, ttl: PAD_TTL_MS };
    round.pads.push(pad);
    return pad;
  }
  return null;
}

/* -------------------------------------------------------------- rivals */

const thinkMs = (smart) => THINK_MS - (THINK_MS - THINK_FAST_MS) * smart;

// The car a rival goes after: the nearest by `cost`, with a car another
// rival already goes after counted further off, so you are not always the
// only target.
function pickTarget(round, car, cost) {
  let best = null;
  for (const c of round.cars) {
    if (c === car || !c.alive) continue;
    let v = cost(c);
    for (const o of round.cars) if (o !== car && o.alive && o.id !== 0 && o.target === c.id) v += 22;
    if (!best || v < best.v) best = { c, v };
  }
  return best ? best.c : null;
}

// True when a dash from `car` along `dir` would still leave it on the ring
// should it miss: the point it would coast to, looked at as far as the
// rival's sharpness lets it see.
function dashSafe(round, car, dir, smart) {
  const reach = ((DASH_SPEED + MAX_SPEED) / DRAG) * (0.25 + 0.55 * smart);
  return edgeGap(round, car.x + dir.x * reach, car.y + dir.y * reach) > 2;
}

// A rival's choice, made every think: the way it pushes ({ x, y }, a unit
// vector or zero), whether it winds up a dash, the car it is after (null for
// none), and whether it misjudged the edge this time. Each personality picks a goal; every one of them first pulls back
// from the edge when it is near it or heading off it (unless it misjudges,
// which a sloppy rival does now and then), and never dashes where a miss
// would carry it off.
export function aim(round, car, random = Math.random) {
  const spec = arenaFor(round.level);
  const smart = spec.smart;
  const misjudge = car.blind > 0 || random() < (1 - smart) * MISJUDGE;
  const gap = edgeGap(round, car.x, car.y);
  const look = 0.08 + 0.42 * smart;
  const ahead = edgeGap(round, car.x + car.vx * look, car.y + car.vy * look);
  const home = unit(CX - car.x, CY - car.y);
  const hole = round.holes.find((h) => h.ms >= HOLE_SHUT_MS && len(car.x + car.vx * look - h.x, car.y + car.vy * look - h.y) < h.r + 3);
  if (!misjudge && hole) {
    const away = unit(car.x - hole.x, car.y - hole.y);
    return { x: away.x, y: away.y, dash: false, target: car.target, misjudge };
  }
  const panic = PANIC * (0.6 + 0.4 * smart);
  if (!misjudge && (gap < panic || ahead < panic * 0.5)) return { x: home.x, y: home.y, dash: false, target: car.target, misjudge };
  const you = round.cars[0];
  let goal = null;
  let target = null;
  let dashing = false;
  const near = (c) => len(c.x - car.x, c.y - car.y);
  if (car.kind === "bully") {
    target = pickTarget(round, car, (c) => near(c) - (c.id === 0 ? 4 : 0));
    if (target) {
      const lead = 0.25 * smart;
      goal = { x: target.x + target.vx * lead, y: target.y + target.vy * lead };
      const toward = car.vx * (target.x - car.x) + car.vy * (target.y - car.y);
      dashing = near(target) < 18 && toward > 18 * near(target) && random() < 0.15 + 0.7 * smart;
    }
  } else if (car.kind === "turtle") {
    target = pickTarget(round, car, near);
    if (target && near(target) < 15) {
      goal = { x: target.x, y: target.y };
      dashing = near(target) < 10 && random() < 0.2 + 0.4 * smart;
    } else {
      target = null;
      const off = len(car.x - CX, car.y - CY);
      if (off < 3) return { x: 0, y: 0, dash: false, target: null, misjudge };
      goal = { x: CX, y: CY };
    }
  } else if (car.kind === "sniper") {
    target = pickTarget(round, car, (c) => near(c) + edgeGap(round, c.x, c.y) - (c.id === 0 ? 6 : 0));
    if (target) {
      // The spot inside the target, so the target sits between it and the edge.
      const inward = unit(CX - target.x, CY - target.y);
      const spot = { x: target.x + inward.x * 20, y: target.y + inward.y * 20 };
      const lined = (target.x - car.x) * -inward.x + (target.y - car.y) * -inward.y > near(target) * 0.85;
      if (len(spot.x - car.x, spot.y - car.y) < 7 || (lined && near(target) < 26)) {
        goal = { x: target.x, y: target.y };
        dashing = near(target) < 24 && edgeGap(round, target.x, target.y) < round.R * 0.55;
      } else goal = spot;
    }
  } else if (car.kind === "scrapper") {
    target = pickTarget(round, car, (c) => edgeGap(round, c.x, c.y) * 2 + near(c) * 0.5);
    if (target) {
      const inside = len(car.x - CX, car.y - CY) < len(target.x - CX, target.y - CY);
      const inward = unit(CX - target.x, CY - target.y);
      goal = inside ? { x: target.x, y: target.y } : { x: target.x + inward.x * 10, y: target.y + inward.y * 10 };
      dashing = inside && near(target) < 16;
    }
  } else if (car.kind === "mirror") {
    // Pushes the way you pushed a beat ago (advance() hands it the echo).
    target = you.alive ? you : null;
    const d = car.echo || { x: 0, y: 0 };
    goal = { x: car.x + d.x * 10, y: car.y + d.y * 10 };
  }
  if (!goal) return { x: home.x, y: home.y, dash: false, target: null, misjudge };
  // A goal that is a spot, not a car, is kept to the safe part of the ring.
  if (!misjudge && !(target && goal.x === target.x && goal.y === target.y) && edgeGap(round, goal.x, goal.y) < PANIC) {
    const g = edgeGap(round, goal.x, goal.y);
    const o = unit(goal.x - CX, goal.y - CY);
    goal = { x: goal.x - o.x * (PANIC - g), y: goal.y - o.y * (PANIC - g) };
  }
  const dir = unit(goal.x - car.x, goal.y - car.y);
  if (dashing && (car.charges <= 0 || (!misjudge && !dashSafe(round, car, dir, smart)))) dashing = false;
  return { x: dir.x, y: dir.y, dash: dashing, target: target ? target.id : null, misjudge };
}

/* ------------------------------------------------------------- scoring */

// Who knocked `fallen` out: the last car to touch it within CREDIT_MS (yours
// when your hit carried through another car, the touch's `via` then holding
// when your hit was), or nobody. Scores your KO with
// the combo and a double, or the bait bonus for a rival that fell chasing you
// untouched. Returns { by, points }.
export function creditKo(round, fallen) {
  const t = fallen.touch;
  const fresh = t && round.clock - t.at <= CREDIT_MS;
  const by = fresh ? (t.via !== null && t.via !== undefined ? 0 : t.by) : null;
  const you = round.cars[0];
  const scoring = round.phase === "fight" && you.alive && fallen.id !== 0;
  let points = 0;
  let combo = 0;
  let double = false;
  let bait = false;
  if (scoring && by === 0) {
    const quick = round.clock - round.lastKo <= COMBO_MS;
    round.combo = quick ? Math.min(MAX_COMBO, round.combo + 1) : 1;
    combo = round.combo;
    points = KO_POINTS * round.level * combo;
    // The one before counts twice too, unless it already did as half of an
    // earlier double: a chain of three pays each KO twice, never more.
    if (round.clock - round.lastKo <= DOUBLE_MS) {
      double = true;
      if (!round.lastKoDoubled) round.score += round.lastKoPoints;
      round.lastKoPoints = points;
      points *= 2;
    } else round.lastKoPoints = points;
    round.lastKoDoubled = double;
    round.lastKo = round.clock;
    round.kos += 1;
    round.bestCombo = Math.max(round.bestCombo, combo);
  } else if (scoring && by === null && fallen.target === 0) {
    bait = true;
    points = BAIT_POINTS * round.level;
  }
  round.score += points;
  return { by, points, combo, double, bait };
}

/* -------------------------------------------------------------- moving */

function fall(round, car, hole, random) {
  car.alive = false;
  car.fall = FALL_MS;
  car.hole = Boolean(hole);
  car.spin = (random() < 0.5 ? -1 : 1) * (6 + random() * 4);
  car.dashMs = 0;
  const credit = creditKo(round, car);
  round.events.push({ type: "fall", id: car.id, x: car.x, y: car.y, hole: Boolean(hole), ...credit });
}

// The edge, or an open hole: a Shield bounces the car back in once, anyone
// else falls.
function checkEdge(round, car, random) {
  const hole = holeAt(round, car.x, car.y);
  if (!hole && edgeGap(round, car.x, car.y) >= 0) return;
  if (car.shield) {
    car.shield = false;
    // Out of a hole the way it came in; a car dead on a hole's middle (one
    // opened under it) goes back toward the ring's middle.
    let o = hole ? unit(hole.x - car.x, hole.y - car.y) : outward(round, car.x, car.y);
    if (!o.x && !o.y) {
      o = hole ? unit(hole.x - CX, hole.y - CY) : o;
      if (!o.x && !o.y) o = { x: 1, y: 0 };
    }
    const out = car.vx * o.x + car.vy * o.y;
    const back = Math.max(out, 30) * 1.1;
    car.vx -= o.x * (out + back);
    car.vy -= o.y * (out + back);
    if (hole) {
      car.x = hole.x - o.x * (hole.r + 0.5);
      car.y = hole.y - o.y * (hole.r + 0.5);
    } else {
      const g = edgeGap(round, car.x, car.y);
      car.x += o.x * (g - 0.5);
      car.y += o.y * (g - 0.5);
    }
    round.events.push({ type: "saved", id: car.id, x: car.x, y: car.y });
    return;
  }
  fall(round, car, hole, random);
}

// When your hit last reached a car, straight from you or carried on through
// a rival (a touch's `via`), or null.
const yoursAt = (c) => (!c.touch ? null : c.touch.by === 0 ? c.touch.at : c.touch.via ?? null);

// Notes a touch on both cars. A rival touched by another keeps your credit
// when your hit reached either of them within CAROM_MS: you rammed one into
// the other, and whichever falls is yours. `via` keeps the time of your hit,
// so a long lean never stretches it.
function touch(round, a, b) {
  const fresh = (t) => (t !== null && round.clock - t <= CAROM_MS ? t : null);
  const carried = (self, other) => {
    const mine = fresh(yoursAt(self));
    const theirs = fresh(yoursAt(other));
    return mine === null ? theirs : theirs === null ? mine : Math.max(mine, theirs);
  };
  const via = (self, other) => (self.id === 0 || other.id === 0 ? null : carried(self, other));
  const va = via(a, b);
  const vb = via(b, a);
  a.touch = { by: b.id, via: va, at: round.clock };
  b.touch = { by: a.id, via: vb, at: round.clock };
}

// One slice for one car: its push, the floor's drag, the teeter, the magnet,
// then the move.
function drive(round, car, ms) {
  const dt = ms / 1000;
  const floor = floorAt(round, car);
  const fight = round.phase === "fight";
  if (fight) push(car, car.id === 0 ? inputDir(round) : car.push, ms, floor.grip * (car.id === 0 ? 1 : rivalPower(round.level).push));
  if (round.magnet && fight) {
    const d = len(car.x - CX, car.y - CY);
    if (d > 0.5) {
      const k = (MAGNET_ACCEL * round.magnet.pull * Math.min(1, d / RING_R) * dt) / d;
      car.vx -= (car.x - CX) * k;
      car.vy -= (car.y - CY) * k;
    }
  }
  const k = Math.exp(-floor.drag * dt);
  car.vx = floor.fx + (car.vx - floor.fx) * k;
  car.vy = floor.fy + (car.vy - floor.fy) * k;
  const gap = edgeGap(round, car.x, car.y);
  if (gap < TEETER) {
    const o = outward(round, car.x, car.y);
    const out = car.vx * o.x + car.vy * o.y;
    if (out > 0) {
      const keep = Math.exp(-TEETER_DRAG * dt);
      car.vx -= o.x * out * (1 - keep);
      car.vy -= o.y * out * (1 - keep);
    }
    if (car.id === 0 && fight && !round.close) {
      round.close = true;
      round.events.push({ type: "teeter", x: car.x, y: car.y });
    }
  }
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const sp = len(car.vx, car.vy);
  if (sp > 4) car.face = Math.atan2(car.vy, car.vx);
  car.dashMs = Math.max(0, car.dashMs - ms);
  for (const kind of Object.keys(car.fx)) {
    car.fx[kind] -= ms;
    if (car.fx[kind] <= 0) delete car.fx[kind];
  }
  car.r = sizeOf(car);
  if (has(car, "slick")) {
    car.slickMs -= ms;
    if (car.slickMs <= 0) {
      car.slickMs = SLICK_DROP_MS;
      round.slicks.push({ x: car.x, y: car.y, r: SLICK_R, ttl: SLICK_TTL_MS, owner: car.id });
      if (round.slicks.length > 60) round.slicks.shift();
    }
  }
  // A full car banks nothing, so a charge spent after a Charge pad refills
  // from empty, not from what was banked before the pad.
  if (fight && car.charges < MAX_CHARGES) {
    car.recharge += ms;
    if (car.recharge >= RECHARGE_MS) {
      car.recharge = 0;
      car.charges += 1;
      if (car.id === 0) round.events.push({ type: "charge", charges: car.charges });
    }
  } else if (car.charges >= MAX_CHARGES) car.recharge = 0;
}

// Bumpers kick a car straight off them, at BUMPER_KICK times its speed in.
function bounceBumpers(round, car) {
  for (const b of round.bumpers) {
    const dx = car.x - b.x;
    const dy = car.y - b.y;
    const d = len(dx, dy);
    const reach = car.r + b.r;
    if (d >= reach) continue;
    const n = d > 1e-9 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
    car.x = b.x + n.x * reach;
    car.y = b.y + n.y * reach;
    const into = -(car.vx * n.x + car.vy * n.y);
    if (into <= 0) continue;
    const out = Math.max(BUMPER_MIN, into * BUMPER_KICK);
    car.vx += n.x * (into + out);
    car.vy += n.y * (into + out);
    round.events.push({ type: "bumper", id: car.id, x: b.x, y: b.y, power: out });
  }
}

const rotate = (p, a) => {
  const dx = p.x - CX;
  const dy = p.y - CY;
  const c = Math.cos(a);
  const s = Math.sin(a);
  p.x = CX + dx * c - dy * s;
  p.y = CY + dx * s + dy * c;
};

// The ring itself, a slice at a time: the shrink and its warning, the
// Turntable carrying its floor round, the holes, the magnet and the shape.
function runRing(round, ms) {
  const was = round.R;
  const warnBefore = nextShrinkIn(round, round.clock - ms);
  round.R = shrinkAt(round);
  if (warnBefore > SHRINK_WARN_MS && nextShrinkIn(round) <= SHRINK_WARN_MS) round.events.push({ type: "warn" });
  if (round.R < was) {
    round.events.push({ type: "shrink", R: round.R, from: was, sudden: round.R < MIN_RING && was >= MIN_RING });
    const keep = (p) => edgeGap(round, p.x, p.y) > (p.r || 0) * 0.5;
    round.bumpers = round.bumpers.filter(keep);
    round.ice = round.ice.filter((p) => edgeGap(round, p.x, p.y) > -p.r * 0.5);
    round.holes = round.holes.filter(keep);
    round.pads = round.pads.filter(keep);
  }
  if (round.spin) {
    const a = round.spin * (ms / 1000);
    round.turn += a;
    for (const list of [round.bumpers, round.ice, round.holes, round.pads, round.slicks]) for (const p of list) rotate(p, a);
  }
  for (const h of round.holes) {
    const was = h.ms;
    h.ms = (h.ms + ms) % (HOLE_SHUT_MS + HOLE_WARN_MS + HOLE_OPEN_MS);
    if (was < HOLE_SHUT_MS + HOLE_WARN_MS && h.ms >= HOLE_SHUT_MS + HOLE_WARN_MS) round.events.push({ type: "hole", x: h.x, y: h.y });
  }
  if (round.magnet) {
    const m = round.magnet;
    m.ms += ms;
    const span = m.pull > 0 ? MAGNET_PULL_MS : MAGNET_PUSH_MS;
    if (m.ms - ms < span - MAGNET_WARN_MS && m.ms >= span - MAGNET_WARN_MS) round.events.push({ type: "magnetWarn", pull: -m.pull });
    if (m.ms >= span) {
      m.ms = 0;
      m.pull = -m.pull;
      round.events.push({ type: "magnet", pull: m.pull });
    }
  }
  if (round.level >= SHAPES_LEVEL) {
    round.shapeMs += ms;
    if (round.shapeMs - ms < SHAPE_MS - SHAPE_WARN_MS && round.shapeMs >= SHAPE_MS - SHAPE_WARN_MS) round.events.push({ type: "shapeWarn", to: round.shape === "round" ? "square" : "round" });
    if (round.shapeMs >= SHAPE_MS) {
      round.shapeMs = 0;
      round.shape = round.shape === "round" ? "square" : "round";
      round.events.push({ type: "shape", shape: round.shape });
    }
  }
  round.slicks = round.slicks.filter((p) => (p.ttl -= ms) > 0);
}

function think(round, car, ms, random) {
  if (car.kind === "mirror") {
    while (round.echoes.length && round.echoes[0].at <= round.clock) {
      const e = round.echoes.shift();
      if (e.dash) dash(round, car, { x: e.x, y: e.y });
      else car.echo = { x: e.x, y: e.y };
    }
  }
  const smart = arenaFor(round.level).smart;
  car.blind = Math.max(0, car.blind - ms);
  if (car.windup > 0) {
    car.windup -= ms;
    const sloppy = car.blind > 0;
    // A sharp rival calls a wind-up off when it finds itself by the edge.
    if (!sloppy && edgeGap(round, car.x, car.y) < PANIC * 0.6) {
      car.windup = 0;
      car.think = 0;
      return;
    }
    if (car.windup > 0) return;
    // At the release a sharp rival bends its dash toward where the target
    // has got to; a sloppy one goes the way it wound up.
    let d = car.windDir;
    const t = round.cars.find((c) => c.id === car.target && c.alive);
    if (t) {
      const to = unit(t.x + t.vx * 0.1 - car.x, t.y + t.vy * 0.1 - car.y);
      d = unit(d.x + (to.x - d.x) * smart * 0.6, d.y + (to.y - d.y) * smart * 0.6);
    }
    car.push = d;
    dash(round, car, d);
    return;
  }
  car.think -= ms;
  if (car.think > 0) return;
  car.think = thinkMs(smart) * (0.8 + 0.4 * random());
  const choice = aim(round, car, random);
  if (choice.misjudge && car.blind <= 0) car.blind = BLIND_MS * (1 - smart * 0.5);
  car.push = { x: choice.x, y: choice.y };
  car.target = choice.target;
  if (choice.dash) {
    car.windup = WINDUP_MS - (WINDUP_MS - WINDUP_FAST_MS) * smart;
    car.windDir = car.push;
    car.push = { x: 0, y: 0 };
    round.events.push({ type: "windup", id: car.id, x: car.x, y: car.y });
  }
}

function endHeat(round, result) {
  round.phase = "done";
  round.phaseMs = DONE_MS;
  round.result = result;
  if (result === "win") {
    let points = WIN_POINTS * round.level;
    const flawless = !round.close;
    if (flawless) points += FLAWLESS_POINTS * round.level;
    round.score += points;
    round.heatsWon += 1;
    round.events.push({ type: "win", points, flawless, level: round.level });
  } else if (result === "lose") {
    if (!round.infinite) round.lives -= 1;
    round.events.push({ type: "lose", lives: round.lives });
  } else round.events.push({ type: "draw" });
}

// After a heat's result has shown: the next arena on a win, the same one
// again otherwise, and the end of the round when the last life is gone.
function nextHeat(round, random) {
  if (round.result === "lose" && round.lives <= 0) {
    round.over = true;
    round.events.push({ type: "over" });
    return;
  }
  const won = round.result === "win";
  if (won) round.level += 1;
  newHeat(round, random);
  if (won) round.events.push({ type: "level", level: round.level });
  else round.events.push({ type: "retry", lives: round.lives });
}

function fight(round, ms, random) {
  round.clock += ms;
  runRing(round, ms);
  const you = round.cars[0];
  if (round.cars.some((c) => c.kind === "mirror" && c.alive)) {
    const d = inputDir(round);
    if (d.x !== round.lastDir.x || d.y !== round.lastDir.y) {
      round.lastDir = d;
      round.echoes.push({ at: round.clock + MIRROR_MS, dash: false, x: d.x, y: d.y });
    }
  }
  if (round.level >= PADS_LEVEL) {
    round.pads = round.pads.filter((p) => (p.ttl -= ms) > 0);
    round.nextPad -= ms;
    if (round.nextPad <= 0) {
      round.nextPad = PAD_MS + (random() - 0.5) * 2 * PAD_SPREAD_MS;
      if (round.pads.length < MAX_PADS) spawnPad(round, pickPower(random), random);
    }
  }
  for (const car of round.cars) if (car.alive && car.id !== 0) think(round, car, ms, random);
  for (const car of round.cars) if (car.alive) drive(round, car, ms);
  moveFallen(round, ms);
  collideAll(round);
  for (const car of round.cars) {
    if (!car.alive) continue;
    bounceBumpers(round, car);
    const pad = round.pads.findIndex((p) => len(p.x - car.x, p.y - car.y) < PAD_R + car.r * 0.7);
    if (pad >= 0) applyPower(round, car, round.pads.splice(pad, 1)[0].kind);
  }
  for (const car of round.cars) if (car.alive) checkEdge(round, car, random);
  if (you.alive) {
    round.aliveMs += ms;
    if (round.aliveMs >= 1000) {
      round.aliveMs -= 1000;
      round.score += SURVIVE_POINTS * round.level;
    }
  }
  const left = round.cars.filter((c) => c.id !== 0 && c.alive).length;
  // You and the last rival off together is a draw: nobody loses a life.
  if (!you.alive) endHeat(round, left ? "lose" : "draw");
  else if (!left) endHeat(round, "win");
}

// Every touching pair once, a hit loud enough noted for the sound and sparks.
function collideAll(round) {
  const cars = round.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const hit = collide(a, b);
      if (!hit) continue;
      touch(round, a, b);
      if (hit.speed < IMPACT_SPEED) continue;
      // A rival knocked about thinks again soon, the sharp ones sooner.
      for (const c of [a, b]) if (c.id !== 0) c.think = Math.min(c.think, REACT_MS * (1 - arenaFor(round.level).smart * 0.7));
      round.events.push({ type: "hit", a: a.id, b: b.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, power: hit.speed, rammer: hit.rammer ? hit.rammer.id : null, sprung: hit.sprung ? hit.sprung.id : null });
    }
  }
}

function moveFallen(round, ms) {
  const dt = ms / 1000;
  for (const car of round.cars) {
    if (car.alive || car.fall <= 0) continue;
    car.fall = Math.max(0, car.fall - ms);
    car.x += car.vx * dt * 0.4;
    car.y += car.vy * dt * 0.4;
    car.face += car.spin * dt;
  }
}

// After a heat ends, the cars coast to a stop while the result shows.
function settle(round, ms) {
  const dt = ms / 1000;
  const k = Math.exp(-DRAG * 1.5 * dt);
  for (const car of round.cars) {
    if (!car.alive) continue;
    car.vx *= k;
    car.vy *= k;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    const g = edgeGap(round, car.x, car.y);
    if (g < 0.5) {
      const o = outward(round, car.x, car.y);
      car.x -= o.x * (0.5 - g);
      car.y -= o.y * (0.5 - g);
    }
  }
  moveFallen(round, ms);
}

// Moves the round on by `ms`: the hold before a heat, the fight, and the
// pause after it, in small slices.
export function advance(round, ms, random = Math.random) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    if (round.phase === "ready") {
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) {
        round.phase = "fight";
        round.events.push({ type: "go" });
      }
    } else if (round.phase === "done") {
      round.phaseMs -= slice;
      settle(round, slice);
      if (round.phaseMs <= 0) nextHeat(round, random);
    } else fight(round, slice, random);
  }
  return round.over ? "over" : round.phase;
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 400;
// A hit this hard (closing speed, units a second) on you, or a knockout of
// yours, holds the action still for HIT_STOP_MS.
const BIG_HIT = 70;
const HIT_STOP_MS = 50;

// The arena's name for the pills and the screens: "ARENA 3", or "FINAL 2".
const arenaTag = (level) => (level > MAX_ARENA ? arenaFor(level).title.toUpperCase() : `ARENA ${level}`);

// "Ice Rink (arena 4 of 9)", or past the ninth "Final 3 (arena 11)".
export function arenaName(level) {
  const spec = arenaFor(level);
  return level > MAX_ARENA ? `${spec.title} (arena ${level})` : `${spec.title} (arena ${level} of ${MAX_ARENA})`;
}

// The over screen's nudge to play again: the next arena not yet reached.
function teaser(furthest) {
  if (furthest < MAX_ARENA) return `Next up, arena ${furthest + 1}: ${ARENAS[furthest + 1].title}.`;
  return "Every arena reached. How many Finals can you last?";
}

const POWER_LABELS = Object.freeze({ heavy: "HEAVY", grow: "GROW", ghost: "GHOST", slick: "SLICK" });

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // The furthest arena ever reached, and whether this round went past it.
  // Without a memo (the unit suite) it lasts as long as the game.
  let furthest = 1;
  let further = false;
  try {
    furthest = Math.max(1, memo ? Number(memo.get()) | 0 : 1);
  } catch {}
  // Sparks, floating words, rings, speed lines, falling floor, the banners,
  // the shake, the flash and the hit-stop, all in arena units and ms, so a
  // resize mid-heat keeps them in place.
  let fx = null;
  const resetFx = () => {
    fx = { parts: [], floats: [], banners: [], rings: [], streaks: [], drops: [], bumps: [], shake: 0, shakeMag: 0, flash: null, clock: 0, stop: 0, combo: null, cheer: 0 };
    ears = { at: {}, excite: 0, pads: new WeakSet(), holes: new WeakMap(), car: null, powers: [] };
  };
  // What the sounds remember, never read by the rules: when each throttled
  // sound last played, how worked up the crowd is (0 to 1, eased back down),
  // the pads and hole states already heard, and your timed powers last tick.
  let ears = null;
  resetFx();

  const carColor = (id) => {
    const car = round.cars.find((c) => c.id === id);
    if (!car || id === 0) return colors.you;
    return RIVALS[car.kind].color;
  };
  const burst = (p, color, n, speed = 22) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 350 + Math.random() * 350, max: 700, color, size: 0.5 + Math.random() * 0.6 });
    }
  };
  const float = (p, text, color, size = 2.8) => fx.floats.push({ x: p.x, y: p.y - 5, text, color, size, life: 1000, max: 1000 });
  const ring = (p, color, r0, grow, ms = 420) => fx.rings.push({ x: p.x, y: p.y, color, r0, grow, life: ms, max: ms });
  const banner = (title, sub, color, ms = 1800) => {
    if (fx.banners.length >= 3 || fx.banners.some((b) => b.title === title)) return null;
    const b = { title, sub, color, life: ms, max: ms, tag: "", row: null, see: 1 };
    fx.banners.push(b);
    return b;
  };
  // A shake still running keeps the stronger of the two; a new one starts
  // from its own strength, so one big hit never loudens every later shake.
  const shake = (ms, mag) => {
    fx.shakeMag = Math.max(fx.shake > 0 ? fx.shakeMag : 0, mag);
    fx.shake = Math.max(fx.shake, ms);
  };
  const flash = (color, ms = 260) => (fx.flash = { color, life: ms, max: ms });

  const reach = (level, b) => {
    if (level <= furthest) return;
    furthest = level;
    further = true;
    try {
      if (memo) memo.set(furthest);
    } catch {}
    if (b) b.tag = level > MAX_ARENA ? `NEW FURTHEST: ${arenaFor(level).title.toUpperCase()}` : `NEW ARENA ${level} / ${MAX_ARENA}`;
  };

  // A sound that may not repeat within `ms` (a pile-up of hits in one
  // frame plays its extras once); true when it may play now.
  const fresh = (key, ms) => {
    if (fx.clock - (ears.at[key] ?? -Infinity) < ms) return false;
    ears.at[key] = fx.clock;
    return true;
  };
  // How loud something happening at `p` is to you: full beside you, a third
  // across the ring.
  const near = (p) => {
    const you = round.cars[0];
    return clamp(1 - len(p.x - you.x, p.y - you.y) / 90, 0.35, 1);
  };
  // A little pitch wobble, so a repeated sound never plays twice the same.
  const vary = (spread = 0.08) => 1 + (Math.random() - 0.5) * 2 * spread;
  const rouse = (n) => (ears.excite = Math.min(1, ears.excite + n));
  // Each pad's own sound as it is taken, on top of `power`.
  const PAD_SOUNDS = { heavy: "bumperHeavy", grow: "bumperGrow", ghost: "warp", slick: "bumperSlick", spring: "boing", shield: "shieldUp", charge: "bumperCharge" };
  // A rival motor's pitch by personality: the Turtle a low growl, the Sniper a thin whine.
  const RIVAL_PITCH = { bully: 1, turtle: 0.78, sniper: 1.15, scrapper: 1.05, mirror: 1.1 };

  const handle = (e) => {
    const you = round.cars[0];
    if (e.type === "go") {
      tone("go");
      tone("bumperBuzzer", 0.6);
      tone("cheer", 0.3);
      rouse(0.4);
    } else if (e.type === "dash") {
      tone("tunnel", e.id === 0 ? 0.9 : 0.4, e.id === 0 ? 1 : 0.8);
      if (e.id === 0) {
        tone("boost", 0.5);
        burst({ x: e.x - e.dx * 3, y: e.y - e.dy * 3 }, colors.you, 10, 14);
      } else tone("zoom", 0.45 * near(e), vary());
    } else if (e.type === "windup") {
      tone("rev", 0.45);
      tone("bumperWindup", 0.55 * near(e), vary(0.05));
    } else if (e.type === "hit") {
      const mine = e.a === 0 || e.b === 0;
      const k = Math.min(1, e.power / 90);
      tone("ram", (mine ? 0.5 : 0.25) + 0.5 * k, 0.7 + Math.min(1, e.power / 120));
      // Layered over the thud, scaled by the impact: rubber always, the
      // chassis clanking on a solid hit, a smash on a big one.
      const at = mine ? 1 : near(e) * 0.7;
      if (fresh("bonk", 50)) tone("bumperBonk", (0.35 + 0.55 * k) * at, (1.25 - 0.45 * k) * vary());
      if (e.power > 40 && fresh("clank", 90)) tone("clank", (0.2 + 0.35 * k) * at, vary(0.12));
      if (e.power > BIG_HIT && fresh("smash", 120)) tone("smash", (mine ? 0.75 : 0.45) * at, vary(0.06));
      rouse(e.power / (mine ? 140 : 260));
      burst(e, e.power > BIG_HIT ? GOLD : "#ffffff", Math.round(4 + e.power / 6), 10 + e.power / 4);
      if (e.power > BIG_HIT && mine) {
        fx.stop = HIT_STOP_MS;
        shake(140, 0.6);
        ring(e, "#ffffff", 1, 6, 260);
      }
      if (e.sprung !== null) {
        tone("boom", 0.8);
        tone("boing", 0.7);
        float(e, "Boing!", POWERS.spring.color);
        ring(e, POWERS.spring.color, 2, 10, 400);
      }
    } else if (e.type === "bumper") {
      tone("bump", 0.6);
      if (fresh("ping", 70)) tone("bumperPing", 0.55 * near(e), vary(0.04));
      fx.bumps.push({ x: e.x, y: e.y, life: 160 });
      burst(e, "#ffffff", 6, 16);
    } else if (e.type === "fall") {
      tone("fall", e.id === 0 ? 1 : 0.7);
      tone(e.hole ? "bumperHoleDrop" : "bumperOffEdge", e.id === 0 ? 0.9 : 0.4 + 0.3 * near(e), vary(0.06));
      const color = carColor(e.id);
      burst(e, color, 26, 24);
      if (e.id === 0) {
        tone("crash");
        shake(420, 1.2);
        flash(DANGER, 320);
        return;
      }
      rouse(0.6);
      if (e.points && e.by === 0) {
        float(e, `KO! +${e.points}`, GOLD, 3.2);
        shake(200, 0.7);
        tone("cheer", Math.min(1, 0.45 + 0.12 * e.combo));
        if (e.combo > 1) {
          fx.combo = { n: e.combo, life: 1600, max: 1600 };
          tone("combo", 1, 1 + 0.12 * e.combo);
        } else tone("zap");
        if (e.double) {
          tone("max");
          tone("applause", 0.6);
          banner("Double KO!", "Both count twice", GOLD, 1400);
        }
        fx.stop = HIT_STOP_MS;
      } else if (e.bait) {
        tone("coin");
        tone("coinUp", 0.5);
        tone("cheer", 0.35);
        float(e, `Baited! +${e.points}`, GOLD, 3);
      } else {
        tone("bumperGasp", 0.4);
        float(e, "Out!", color);
      }
    } else if (e.type === "saved") {
      tone("shield");
      tone("shieldUp", e.id === 0 ? 0.6 : 0.3, 0.8);
      if (e.id === 0) tone("bumperGasp", 0.45, 1.1);
      ring(e, POWERS.shield.color, 3, 9, 500);
      float(e, "Saved!", POWERS.shield.color);
    } else if (e.type === "power") {
      const spec = POWERS[e.kind];
      burst(e, spec.color, e.id === 0 ? 24 : 10, 18);
      if (e.id === 0) {
        tone("power");
        if (PAD_SOUNDS[e.kind]) tone(PAD_SOUNDS[e.kind], 0.6);
        banner(spec.name, spec.blurb, spec.color, 1400);
      } else {
        tone("coin", 0.4, 0.8);
        if (PAD_SOUNDS[e.kind]) tone(PAD_SOUNDS[e.kind], 0.3 * near(e), 0.85);
        float(e, `${RIVALS[round.cars[e.id].kind].name}: ${spec.name}`, spec.color, 2.2);
      }
    } else if (e.type === "charge") {
      tone("eat", 0.5);
      tone("bumperCharge", 0.4, 0.9 + 0.1 * e.charges);
      float(you, "+1 dash", "#ff8a1f", 2.2);
    } else if (e.type === "warn") {
      tone("count");
      tone("warn", 0.35);
    } else if (e.type === "shrink") {
      tone("boom", 0.6);
      tone("crumble", 0.6, vary(0.05));
      shake(160, 0.4);
      fx.drops.push({ from: e.from, to: e.R, shape: round.shape, life: 600, max: 600 });
      if (e.sudden) {
        tone("sizzle");
        tone("bossIntro", 0.6);
        rouse(0.5);
        banner("Sudden death!", "The ring keeps shrinking", DANGER, 1600);
      }
    } else if (e.type === "hole") {
      tone("sizzle", 0.35);
      tone("bumperTrapdoor", 0.6 * near(e), vary(0.06));
    } else if (e.type === "magnetWarn") {
      tone("count", 0.6);
      tone("riser", 0.3, e.pull > 0 ? 0.8 : 1.2);
    } else if (e.type === "magnet") {
      tone("tunnel", 0.7, e.pull > 0 ? 0.7 : 1.4);
      tone("bumperMagnet", 0.6, e.pull > 0 ? 0.85 : 1.3);
      float({ x: CX, y: CY }, e.pull > 0 ? "PULL" : "PUSH", e.pull > 0 ? "#1fb6d9" : DANGER, 3);
    } else if (e.type === "shapeWarn") {
      tone("count", 0.6);
      tone("rattle", 0.5);
    } else if (e.type === "shape") {
      tone("mystery", 0.6);
      tone("shift", 0.7);
      tone("clank", 0.45, 0.8);
      float({ x: CX, y: CY }, e.shape === "square" ? "SQUARE!" : "ROUND!", "#ffffff", 3);
    } else if (e.type === "teeter") {
      tone("shank", 0.4);
      tone("brake", 0.45);
      tone("bumperGasp", 0.55);
      rouse(0.4);
      float(e, "Whoa!", "#ffffff", 2.2);
    } else if (e.type === "win") {
      tone(e.flawless ? "ace" : "levelup");
      tone(e.flawless ? "victory" : "fanfare", 0.7);
      tone("applause", 0.55);
      tone("cheer", 0.6);
      if (e.flawless) tone("sparkle", 0.5);
      rouse(1);
      flash(GOLD, 300);
      banner(e.flawless ? "Flawless!" : "Heat won!", `+${e.points} points`, GOLD, DONE_MS);
      fx.cheer = DONE_MS;
      burst(you, GOLD, 40, 26);
    } else if (e.type === "lose") {
      tone("lifeLost", 0.7);
      tone("aww", 0.5);
      banner("Ring out!", e.lives > 0 ? `${e.lives} ${e.lives === 1 ? "life" : "lives"} left` : "That was your last life", DANGER, DONE_MS);
    } else if (e.type === "draw") {
      tone("mystery");
      tone("aww", 0.4, 1.1);
      banner("Draw!", "Nobody loses a life", "#ffffff", DONE_MS);
    } else if (e.type === "level") {
      const spec = arenaFor(e.level);
      tone("levelup");
      tone("bumperArena", 0.6);
      // The Finals arrive with a low drum roll under the sting.
      if (e.level > MAX_ARENA) tone("bossIntro", 0.5);
      flash(arenaColor(e.level), 400);
      reach(e.level, banner(e.level > MAX_ARENA ? spec.title : `Arena ${e.level}`, `${spec.title}: ${spec.sub}`, arenaColor(e.level), 2200));
    } else if (e.type === "retry") {
      tone("whoosh", 0.4);
      banner(arenaFor(round.level).title, "Again! Last car on wins", arenaColor(round.level), 1400);
    } else if (e.type === "over") tone("gameOver", 0.8);
  };

  // The held sounds and the cues no event names, each tick of play: your
  // motor (pitched with your speed, louder while you push), the nearest
  // rival's (louder the closer, its whine climbing through a windup), your
  // tires squealing while you slide across the way you push (more on ice or
  // oil), the crowd (stirred by hits and knockouts, easing back), the
  // magnet's throb, a heartbeat through sudden death, a pad appearing, a
  // hole about to open or shutting, and a timed power of yours running out.
  // Sounds only: nothing here touches the round.
  const soundscape = (ms) => {
    const you = round.cars[0];
    const fight = round.phase === "fight";
    const speed = (c) => len(c.vx, c.vy);
    ears.excite *= Math.exp(-ms / 1800);
    if (you.alive) {
      const sp = speed(you);
      const k = Math.min(1.5, sp / MAX_SPEED);
      const dir = inputDir(round);
      const pushing = fight && Boolean(dir.x || dir.y);
      hum("bumper:you", "bumperMotor", fight ? clamp(0.3 + 0.5 * k + (pushing ? 0.2 : 0), 0, 1) : 0.2, 0.85 + 0.9 * k + (you.dashMs > 0 ? 0.3 : 0));
      if (fight) {
        const on = (p) => len(you.x - p.x, you.y - p.y) < p.r;
        const iced = round.ice.some(on) || round.slicks.some((p) => p.owner !== 0 && on(p));
        let slide = 0;
        if (sp > 14 && pushing) slide = clamp(0.65 - (you.vx * dir.x + you.vy * dir.y) / sp, 0, 1) * Math.min(1, sp / MAX_SPEED);
        if (iced && sp > 10) slide = Math.max(slide, Math.min(1, sp / MAX_SPEED) * (pushing ? 0.8 : 0.4));
        if (slide > 0.08) hum("bumper:squeal", "squeal", clamp(slide * 1.2, 0, 1), 0.9 + 0.3 * Math.min(1, sp / MAX_SPEED));
      }
    }
    let rival = null;
    let gap = Infinity;
    for (const c of round.cars) {
      if (c.id === 0 || !c.alive) continue;
      const d = len(c.x - you.x, c.y - you.y);
      if (d < gap) [rival, gap] = [c, d];
    }
    if (rival) {
      const k = Math.min(1.5, speed(rival) / MAX_SPEED);
      const strain = rival.windup > 0 ? clamp(1 - rival.windup / WINDUP_MS, 0, 1) : 0;
      const loud = clamp(1 - gap / 80, 0.1, 1) * (fight ? 0.6 + 0.4 * Math.min(1, k) : 0.3) + 0.3 * strain;
      hum("bumper:rival", "bumperRival", clamp(loud, 0, 1), (RIVAL_PITCH[rival.kind] || 1) * (0.85 + 0.8 * k + 0.9 * strain + (rival.dashMs > 0 ? 0.3 : 0)));
    }
    const sudden = fight && suddenDeath(round);
    hum("bumper:crowd", "crowd", clamp((sudden ? 0.5 : 0.3) + 0.7 * ears.excite, 0, 1), 1 + 0.35 * ears.excite);
    if (round.magnet && fight) hum("bumper:field", "bumperField", 0.7, round.magnet.pull > 0 ? 1 : 1.5);
    if (sudden && you.alive && fresh("heart", 650)) tone("heartbeat", 0.45);
    if (!fight) return;
    for (const p of round.pads) {
      if (ears.pads.has(p)) continue;
      ears.pads.add(p);
      tone("sparkle", 0.25 * near(p));
    }
    for (const h of round.holes) {
      const now = holeState(h);
      const was = ears.holes.get(h);
      ears.holes.set(h, now);
      if (was === undefined || was === now) continue;
      if (now === "warn") tone("rattle", 0.35 * near(h), 0.8);
      else if (now === "shut") tone("knock", 0.35 * near(h), 0.7);
    }
    // A timed power of yours running out: a short fall, once.
    if (ears.car !== you) [ears.car, ears.powers] = [you, []];
    const powers = Object.keys(you.fx).filter((kind) => has(you, kind));
    if (you.alive && ears.powers.some((kind) => !powers.includes(kind))) tone("powerDown", 0.35);
    ears.powers = powers;
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    tone("sparkle", 0.5);
    banner("New best!", "Every point from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  // A banner sits on the half of the board away from you, and fades almost
  // clear while you drive under it.
  const bannerRow = () => (round.cars[0].y < CY ? H * 0.72 : H * 0.3);
  const underBanner = (row) => Math.abs(round.cars[0].y - row) < 10;

  const runFx = (ms) => {
    fx.clock += ms;
    const s = ms / 1000;
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vx *= 0.92;
      p.vy *= 0.92;
      return p.life > 0;
    });
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.y -= 5 * s;
      return f.life > 0;
    });
    fx.rings = fx.rings.filter((r) => (r.life -= ms) > 0);
    fx.drops = fx.drops.filter((d) => (d.life -= ms) > 0);
    fx.bumps = fx.bumps.filter((b) => (b.life -= ms) > 0);
    fx.streaks = fx.streaks.filter((t) => (t.life -= ms) > 0);
    for (const car of round.cars) {
      if (car.alive && car.dashMs > 0) fx.streaks.push({ x: car.x, y: car.y, r: car.r * 0.8, color: car.id === 0 ? colors.you : RIVALS[car.kind].color, life: 220, max: 220 });
    }
    if (fx.combo && (fx.combo.life -= ms) <= 0) fx.combo = null;
    fx.cheer = Math.max(0, fx.cheer - ms);
    if (fx.banners.length) {
      const b = fx.banners[0];
      if (b.row == null) b.row = bannerRow();
      const target = underBanner(b.row) ? 0.15 : 1;
      b.see += (target - b.see) * Math.min(1, ms / 140);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
    }
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash && (fx.flash.life -= ms) <= 0) fx.flash = null;
  };

  // The pills' numbers: the arena, dash charges and the next one filling,
  // rivals left, your powers, and the ring's countdown once it is near.
  const hudOf = () => {
    const you = round.cars[0];
    const powers = [];
    for (const [kind, ms] of Object.entries(you.fx)) if (POWER_LABELS[kind]) powers.push({ text: POWER_LABELS[kind], color: POWERS[kind].color, fill: ms / POWERS[kind].ms });
    if (you.spring) powers.push({ text: "SPRING", color: POWERS.spring.color, fill: 1 });
    if (you.shield) powers.push({ text: "SHIELD", color: POWERS.shield.color, fill: 1 });
    let ring = null;
    const next = nextShrinkIn(round);
    if (round.phase === "fight" && suddenDeath(round)) ring = { text: "SUDDEN DEATH", color: DANGER };
    else if (round.phase === "fight" && next <= 5000) ring = { text: `RING ${Math.ceil(next / 1000)}`, color: next <= SHRINK_WARN_MS ? DANGER : "#ffffff" };
    return { arena: arenaTag(round.level), charges: you.charges, maxCharges: MAX_CHARGES, recharge: you.recharge / RECHARGE_MS, left: round.cars.filter((c) => c.id !== 0 && c.alive).length, powers, ring };
  };

  const view = () => {
    const cars = round.cars.map((c) => ({ ...c, color: c.id === 0 ? colors.you : RIVALS[c.kind].color, name: c.id === 0 ? "You" : RIVALS[c.kind].name, ghost: has(c, "ghost"), heavy: has(c, "heavy") }));
    const fight = round.phase === "fight";
    const magnet = round.magnet;
    const you = round.cars[0];
    let tally = null;
    const reached = `Furthest: ${arenaName(furthest)}`;
    if (state === "ready") tally = ["Last car on the ring wins the heat", `Arrows push, space dashes. ${reached}`];
    else if (state === "over") tally = [`Reached ${arenaName(round.level)}${further ? ". New furthest!" : ""}${beaten ? " A new best!" : ""}`, `${round.kos} KO${round.kos === 1 ? "" : "s"}, ${round.heatsWon} heat${round.heatsWon === 1 ? "" : "s"} won, best combo x${Math.max(1, round.bestCombo)}. ${teaser(furthest)}`];
    return {
      u,
      g: { W, H, CX, CY, RING_R },
      clock: fx.clock,
      state,
      colors,
      level: round.level,
      theme: themeFor(round.level),
      round: { ...round, cars },
      holes: round.holes.map((h) => ({ x: h.x, y: h.y, r: h.r, state: holeState(h) })),
      powers: POWERS,
      fx,
      fallMs: FALL_MS,
      pillH: Math.max(14 / u, 2.6),
      shrinkWarn: fight && nextShrinkIn(round) <= SHRINK_WARN_MS,
      nextR: shrinkAt(round, round.clock + SHRINK_WARN_MS + 1),
      shapeWarn: fight && round.level >= SHAPES_LEVEL && SHAPE_MS - round.shapeMs <= SHAPE_WARN_MS ? (round.shape === "round" ? "square" : "round") : null,
      magnetWarn: Boolean(magnet && fight && (magnet.pull > 0 ? MAGNET_PULL_MS : MAGNET_PUSH_MS) - magnet.ms <= MAGNET_WARN_MS),
      teeter: you.alive && fight && edgeGap(round, you.x, you.y) < TEETER,
      cheer: fx.cheer > 0,
      combo: fx.combo,
      flash: fx.flash,
      shake: fx.shake > 0 && state === "running" ? { x: (Math.random() - 0.5) * 2 * fx.shakeMag, y: (Math.random() - 0.5) * 2 * fx.shakeMag } : null,
      banner: fx.banners[0] || null,
      hud: hudOf(),
      tally,
      furthest,
      maxArena: MAX_ARENA,
    };
  };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    // A banner takes its place on its first frame: a frame painted before the
    // next tick (the start's, held through the 3, 2, 1) would draw it at the top.
    const head = fx.banners[0];
    if (head && head.row == null) head.row = bannerRow();
    drawScene(ctx, view());
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
    banner(ARENAS[1].title, ARENAS[1].sub, arenaColor(1), 1600);
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
    key(name) {
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        else if (state === "paused") state = "running";
        else if (dash(round, round.cars[0])) drain();
        return true;
      }
      if (!MOVES[name]) return false;
      if (state === "running") round.input[name] = true;
      return true;
    },
    // An arrow let go: stop pushing that way.
    release(name) {
      if (MOVES[name]) round.input[name] = false;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      // A big hit holds the action still a moment while the sparks fly on.
      const held = Math.min(fx.stop, ms);
      fx.stop -= held;
      if (ms > held) advance(round, ms - held);
      drain();
      if (!round.over) soundscape(ms);
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

export default Object.freeze({ id: "bumper", title: "Bumper Ring", create });
