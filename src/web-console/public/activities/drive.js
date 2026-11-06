// Plan2Code Web Console - Sunset Drive, the fifth activity: the road, traffic, forks, drawing and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, buildStage,
// advance, boost), exported so the unit suite can drive them without a
// canvas; the default export is the contract every listed game answers.
//
// Planny drives a convertible down an endless road, seen from behind and
// drawn a segment at a time, against the clock. Each stage ends at a
// checkpoint that adds time, and just before it the road splits around a
// median: the side you keep to picks the next road, the harder one worth more
// points; as the fork is called, a postcard of each road shows on its side.
// Traffic, roadside props and the median slow you down; coins, clocks, nitro
// cans and power-up boxes line the road. Power-ups queue up, and while one is
// held space fires the oldest instead of nitro. Every road a player has ever
// reached is one bit of a saved tally (the host's memo), so the start and end
// screens can say how many are still out there.

import { PILL, drawPill } from "./pills.js";

// The screen, in units. The canvas is a whole number of pixels a unit.
export const W = 64;
export const H = 36;

// Below this many pixels a unit, the board is too small to play.
export const MIN_CELL = 8;

// The road, in world units: one segment's length, half the road's width, the
// camera's height and depth (from a 100 degree field of view), and how many
// segments ahead are drawn. The player sits PLAYER_Z ahead of the camera.
export const SEG = 200;
const ROAD_W = 1500;
const CAM_H = 1000;
const DEPTH = 1 / Math.tan((50 * Math.PI) / 180);
export const PLAYER_Z = CAM_H * DEPTH;
export const DRAW = 160;

// Speeds, in world units a second. Top speed is 60 segments a second, shown
// as TOP_MPH. Off the road you slow to a quarter of it.
export const MAX_SPEED = SEG * 60;
const ACCEL = MAX_SPEED / 5;
const BRAKE = -MAX_SPEED;
const DECEL = -MAX_SPEED / 5;
const OFFROAD_DECEL = -MAX_SPEED / 2;
export const OFFROAD_LIMIT = MAX_SPEED / 4;
const TOP_MPH = 150;

// Steering, in road half-widths a second at top speed, and how hard a curve
// pushes the car to its outside.
const STEER = 2.4;
const CENTRIFUGAL = 0.25;
// The sharpest bend: at top speed it pushes a little less than you can steer.
const MAX_CURVE = 3.6;

// Nitro: a press burns a can for NITRO_MS of a higher top speed.
export const NITRO_MS = 2500;
export const NITRO_BOOST = 1.3;
export const START_NITRO = 2;
export const MAX_NITRO = 3;

// The clock: what a round starts with, what a checkpoint adds (a second and
// a half less each stage, never under CHECK_MIN_MS), and how long the car
// coasts once it runs out. A clean stage takes about 28 seconds, so the
// spare time a good start builds up is slowly eaten away.
export const START_TIME_MS = 40000;
const CHECK_BASE_MS = 31500;
const CHECK_MIN_MS = 18000;
export const checkTime = (stage) => Math.max(CHECK_MIN_MS, CHECK_BASE_MS - (stage - 1) * 1500);
export const COAST_MS = 2500;
export const CLOCK_MS = 5000;

// A stage: at least STAGE_LEN segments of road, a straight lead of FORK_LEAD,
// then the split of FORK_LEN (never shorter than what is drawn, so the next
// road is always built before it comes into view) and the checkpoint. The
// fork is announced FORK_WARN segments ahead.
export const STAGE_LEN = 1100;
const RUN_IN = 30;
const FORK_LEAD = 120;
export const FORK_LEN = 170;
const FORK_WARN = 150;
const MEDIAN = 0.32;
const WIDE = 1.45;

// Points: for every segment driven (times the road's bonus and the stage),
// a coin, a close call past a car, and each checkpoint reached.
const SEG_POINTS = 1;
export const COIN_POINTS = 100;
export const CLOSE_POINTS = 50;
export const CHECK_POINTS = 1000;

// The cars, in world units and road half-widths. Lanes sit at their centers.
const CAR_W = 640;
const CAR_HALF = CAR_W / 2 / ROAD_W;
const CAR_LEN = SEG;
const LANES = Object.freeze([-2 / 3, 0, 2 / 3]);
const MAX_CARS = 30;
const CLOSE_REACH = 0.75;
const CLOSE_SPEED = MAX_SPEED * 0.6;
const PICKUP_REACH = 0.3;

// Time is handed out in slices this long, so a long frame never drives
// through a car without touching it.
const SLICE_MS = 8;

const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

const GOLD = "#f5b301";
const DANGER = "#e2553f";
const NITRO = "#1fb6d9";
const CLOCK = "#57b54a";

// Power-ups: a "?" box on the road holds one at random, queued up to
// MAX_POWERS (a box past that pays POWER_SPARE points instead). While one is
// queued space fires the oldest instead of a nitro can. Timed ones run side
// by side for `ms`, and one fired while it still runs adds its time:
// Rocket Hop leaps over traffic and the shoulder, Ghost Car drives through
// cars and props, Coin Magnet pulls in every item across the road, Monster
// Truck flings the cars it hits into the sky (FLING_POINTS each) and flattens
// props, and Coin Storm turns the traffic ahead into coins at once.
export const MAX_POWERS = 3;
export const POWER_SPARE = 250;
export const FLING_POINTS = 150;
const STORM_COINS = 3;
export const POWERS = deepFreeze({
  hop: { name: "Rocket Hop", short: "HOP", ms: 1600, color: "#ff8a1f", line: "Up and over everything" },
  ghost: { name: "Ghost Car", short: "GHOST", ms: 5000, color: "#b9a6ff", line: "Drive right through the traffic" },
  magnet: { name: "Coin Magnet", short: "MAGNET", ms: 6000, color: "#ff4fa3", line: "Every coin on the road comes to you" },
  monster: { name: "Monster Truck", short: "MONSTER", ms: 5000, color: "#2fbf71", line: "Smash the cars out of your way" },
  storm: { name: "Coin Storm", short: "STORM", ms: 0, color: "#f5b301", line: "The traffic ahead turns to coins" },
});
export const POWER_ORDER = Object.freeze(Object.keys(POWERS));
// How many segments apart the boxes come, at the least and the most.
const POWER_GAP = Object.freeze([220, 380]);

// The roads, in tally-bit order. The order is saved, so new roads only ever
// go on the end. `bonus` multiplies the points, `curve`, `hill` and `traffic`
// set how hard it drives, and `props` are what lines it.
export const REGIONS = deepFreeze({
  coast: {
    name: "Sunset Coast", sub: "Palm trees and a sun that never sets", bonus: 1, curve: 0.8, hill: 0.5, traffic: 1,
    sky: ["#3b1e5e", "#ff5f6d", "#ffc371"], sun: "#ffd36b", far: "#8a4a7e", near: "#5a2f63", night: false,
    ground: ["#e7cd92", "#dcc083"], road: ["#5d5a68", "#585563"], rumble: ["#ffffff", "#e2553f"], line: "#ffffff",
    props: ["palm", "palm", "palm", "umbrella", "billboard"], dot: "#ff5f6d",
  },
  desert: {
    name: "Canyon Road", sub: "Cacti, red rock and long sweeping bends", bonus: 1.2, curve: 1.1, hill: 1.2, traffic: 0.8,
    sky: ["#3f86c6", "#f0b27a", "#ffdca8"], sun: "#fff1c9", far: "#c0703f", near: "#94502f", night: false,
    ground: ["#e0a25c", "#d6964f"], road: ["#66605a", "#615b55"], rumble: ["#ffffff", "#b5523a"], line: "#ffe08a",
    props: ["cactus", "cactus", "rock", "rock", "billboard"], dot: "#e0a25c",
  },
  forest: {
    name: "Maple Valley", sub: "Autumn woods and rolling hills", bonus: 1.2, curve: 1, hill: 1, traffic: 1.1,
    sky: ["#4a90d9", "#a9d4f0", "#eaf5ff"], sun: null, far: "#7b9cbc", near: "#456f3c", night: false,
    ground: ["#5d8a3a", "#56803a"], road: ["#5a5a62", "#55555d"], rumble: ["#ffffff", "#c9502f"], line: "#ffffff",
    props: ["maple", "maple", "pine", "billboard"], dot: "#ff8a1f",
  },
  alpine: {
    name: "Snowcap Pass", sub: "Steep climbs between the pines", bonus: 1.4, curve: 1.25, hill: 1.7, traffic: 0.9,
    sky: ["#5d9be6", "#bcd9f5", "#f4f9ff"], sun: null, far: "#a8bcd6", near: "#7590ae", night: false,
    ground: ["#f4f7fb", "#e6edf5"], road: ["#5e6470", "#59606b"], rumble: ["#ffffff", "#d8283b"], line: "#ffd34d",
    props: ["snowpine", "snowpine", "snowpine", "snowman", "rock"], dot: "#bcd9f5",
  },
  city: {
    name: "Neon City", sub: "Heavy traffic under the lights", bonus: 1.5, curve: 0.9, hill: 0.4, traffic: 1.6,
    sky: ["#07051a", "#2a1150", "#a1307a"], sun: null, far: "#1d1440", near: "#140d2c", night: true,
    ground: ["#1d1a2c", "#221e33"], road: ["#2e2b3c", "#2a2738"], rumble: ["#ff4fa3", "#1fb6d9"], line: "#f5d76e",
    props: ["building", "building", "lamp", "billboard"], dot: "#ff4fa3",
  },
  stars: {
    name: "Starlight Highway", sub: "Twisting road under the aurora", bonus: 1.8, curve: 1.4, hill: 1.3, traffic: 1.3,
    sky: ["#020414", "#0c1a40", "#2b4a8a"], sun: null, far: "#16244a", near: "#0d1733", night: true,
    ground: ["#0e1a32", "#111f3a"], road: ["#23273b", "#202437"], rumble: ["#a466ff", "#ffffff"], line: "#9ad8ff",
    props: ["crystal", "crystal", "lamp", "rock"], dot: "#a466ff",
  },
});
export const REGION_ORDER = Object.freeze(Object.keys(REGIONS));

// Each road's song, from drive-sfx.js.
export const ROAD_MUSIC = Object.freeze({ coast: "driveCoast", desert: "driveDesert", forest: "driveForest", alpine: "driveAlpine", city: "driveCity", stars: "driveStars" });

// What lines the road: each prop's size in world units, how far out it
// stands (in road half-widths past the edge), and the half-width a car hits.
const PROPS = deepFreeze({
  palm: { w: 1400, h: 2300, out: [0.25, 1.6], hit: 0.1 },
  umbrella: { w: 1000, h: 1100, out: [0.3, 1.2], hit: 0.3 },
  billboard: { w: 1700, h: 1500, out: [0.8, 1.4], hit: 0.6 },
  cactus: { w: 700, h: 1300, out: [0.25, 1.6], hit: 0.22 },
  rock: { w: 1000, h: 600, out: [0.25, 1.4], hit: 0.33 },
  maple: { w: 1600, h: 2200, out: [0.3, 1.6], hit: 0.1 },
  pine: { w: 1200, h: 2400, out: [0.3, 1.6], hit: 0.1 },
  snowpine: { w: 1200, h: 2400, out: [0.3, 1.6], hit: 0.1 },
  snowman: { w: 700, h: 1000, out: [0.25, 1], hit: 0.22 },
  building: { w: 3000, h: 5200, out: [1.4, 2.4], hit: 1 },
  lamp: { w: 300, h: 2200, out: [0.25, 0.3], hit: 0.08 },
  crystal: { w: 800, h: 1500, out: [0.3, 1.5], hit: 0.25 },
});

// The billboards' lines, a little nod to where the game lives.
const SLOGANS = Object.freeze(["SHIP IT", "LGTM", "TESTS PASS", "PLAN FIRST", "NO BUGS AHEAD", "MERGE LANE", "ALL GREEN", "DONE IS DONE"]);

const CAR_COLORS = Object.freeze(["#e2553f", "#1fb6d9", "#f5b301", "#2fbf71", "#a466ff", "#ff8a1f", "#f2f2f2", "#4f7cff", "#ff4fa3"]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pickOf = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
const hash = (n) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/* ---------------------------------------------------------------- road */

// The segment under world position z. Behind the oldest kept segment is
// the oldest; past the newest is the newest.
export function segAt(round, z) {
  const n = Math.floor(z / SEG) - round.first;
  return round.segs[clamp(n, 0, round.segs.length - 1)];
}

const lastIndex = (round) => round.first + round.segs.length;
const lastY = (round) => (round.segs.length ? round.segs[round.segs.length - 1].y2 : 0);

function push(round, region, curve, y, extra) {
  round.segs.push({ i: lastIndex(round), y1: lastY(round), y2: y, curve, region, wide: 1, median: 0, props: [], items: [], mark: null, ...extra });
}

// A stretch of road that eases into a curve and a hill, holds them and eases
// out again.
function addRoad(round, region, enter, hold, leave, curve, hill, extra = {}) {
  const startY = lastY(round);
  const endY = startY + hill * SEG;
  const total = enter + hold + leave;
  for (let n = 0; n < enter; n++) push(round, region, easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total), extra);
  for (let n = 0; n < hold; n++) push(round, region, curve, easeInOut(startY, endY, (enter + n) / total), extra);
  for (let n = 0; n < leave; n++) push(round, region, easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total), extra);
}

// The two roads the next fork offers, the gentler one on the left.
function pickFork(region, random) {
  const pool = REGION_ORDER.filter((k) => k !== region);
  const a = pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0];
  const b = pickOf(pool, random);
  return REGIONS[a].bonus <= REGIONS[b].bonus ? { left: a, right: b } : { left: b, right: a };
}

// Lines the stage's road with props, a billboard now and then, runs of
// coins with the odd clock or nitro can among them, and a power-up box every
// few hundred segments.
function dress(round, from, to, region, stage, random) {
  const spec = REGIONS[region];
  let nextItems = from + 40 + Math.floor(random() * 40);
  let nextPower = from + 120 + Math.floor(random() * 120);
  for (let i = from; i < to; i++) {
    const seg = round.segs[i - round.first];
    if (seg.mark || seg.median > 0) continue;
    if (i % 4 === 0 && random() < 0.55) {
      const kind = pickOf(spec.props, random);
      const p = PROPS[kind];
      const side = random() < 0.5 ? -1 : 1;
      // Never so close that a car still on the road would touch it.
      const out = Math.max(p.hit + 0.15, p.out[0] + random() * (p.out[1] - p.out[0]));
      seg.props.push({ kind, offset: side * (seg.wide + out), text: kind === "billboard" ? pickOf(SLOGANS, random) : null, seed: random() });
    }
    if (i === nextItems) {
      const lane = pickOf(LANES, random);
      const roll = random();
      const special = roll < 0.12 ? "clock" : roll < 0.2 + Math.min(0.1, stage * 0.01) ? "nitro" : null;
      for (let k = 0; k < 5; k++) {
        const at = round.segs[i + k * 3 - round.first];
        if (at && !at.median) at.items.push({ kind: special && k === 2 ? special : "coin", offset: lane });
      }
      nextItems = i + 50 + Math.floor(random() * 60);
    }
    if (i >= nextPower && !seg.items.length) {
      seg.items.push({ kind: "power", power: pickOf(POWER_ORDER, random), offset: pickOf(LANES, random) });
      nextPower = i + POWER_GAP[0] + Math.floor(random() * (POWER_GAP[1] - POWER_GAP[0]));
    }
  }
}

// Appends a whole stage of `region` to the road: the run-in, random bends and
// hills, the straight lead with its sign, the split and the checkpoint.
// Returns where its fork and checkpoint are and which roads the fork offers.
export function buildStage(round, region, stage, random = Math.random, first = false) {
  const spec = REGIONS[region];
  const start = lastIndex(round);
  addRoad(round, region, 0, RUN_IN, 0, 0, 0);
  if (first) round.segs[8].mark = "start";
  const twist = Math.min(1.5, 1 + (stage - 1) * 0.05);
  while (lastIndex(round) - start < STAGE_LEN) {
    const len = pickOf([25, 40, 60], random);
    const curve = Math.min(MAX_CURVE, pickOf([0, 1.5, 2.5, 3.5], random) * spec.curve * twist) * (random() < 0.5 ? -1 : 1);
    const hill = (random() * 2 - 1) * 40 * spec.hill;
    addRoad(round, region, Math.round(len / 2), len, Math.round(len / 2), curve, hill);
  }
  // A straight, level lead, so the fork is in view all the way in.
  addRoad(round, region, 30, FORK_LEAD - 60, 30, 0, 0);
  const forkAt = lastIndex(round);
  round.segs[forkAt - 10 - round.first].mark = "sign";
  for (let n = 0; n < FORK_LEN; n++) {
    const m = clamp(Math.min(n / 25, (FORK_LEN - 1 - n) / 25), 0, 1);
    push(round, region, 0, lastY(round), { wide: 1 + (WIDE - 1) * m, median: MEDIAN * m });
  }
  const gateAt = lastIndex(round);
  push(round, region, 0, lastY(round), { mark: "gate" });
  push(round, region, 0, lastY(round));
  dress(round, start + 12, forkAt - 12, region, stage, random);
  // Cones down the median while it is wide enough to see.
  for (let i = forkAt; i < gateAt; i += 3) {
    const seg = round.segs[i - round.first];
    if (seg.median > 0.08) seg.props.push({ kind: "cone", offset: 0, text: null, seed: 0 });
  }
  return { forkAt, gateAt, fork: pickFork(region, random) };
}

/* ------------------------------------------------------------- traffic */

const carCount = (round) => Math.min(MAX_CARS, Math.round((6 + round.stage * 2) * REGIONS[round.region].traffic));

function placeCar(round, car, z, random) {
  const truck = random() < 0.12 + Math.min(0.2, round.stage * 0.02);
  Object.assign(car, {
    z,
    x: pickOf(LANES, random) + (random() - 0.5) * 0.15,
    speed: MAX_SPEED * (0.3 + random() * 0.32 + Math.min(0.08, round.stage * 0.01)),
    kind: truck ? "truck" : "car",
    color: pickOf(CAR_COLORS, random),
    ahead: true,
  });
  return car;
}

// The furthest a car may be placed: a little short of the road's end.
const roadEnd = (round) => (lastIndex(round) - 3) * SEG;

// Fills the road ahead up to the stage's count of cars.
function fillTraffic(round, random, near = 20) {
  const pz = round.pos + PLAYER_Z;
  while (round.cars.length < carCount(round)) {
    const z = Math.min(roadEnd(round), pz + SEG * (near + random() * (DRAW - near)));
    round.cars.push(placeCar(round, {}, z, random));
  }
}

function moveTraffic(round, dt, random) {
  const pz = round.pos + PLAYER_Z;
  for (const car of round.cars) {
    car.z += car.speed * dt;
    if (car.z < pz - 3 * SEG || car.z > roadEnd(round)) {
      placeCar(round, car, Math.min(roadEnd(round), pz + SEG * (DRAW * 0.7 + random() * DRAW * 0.25)), random);
      continue;
    }
    // Keep off the median and on the road.
    const seg = segAt(round, car.z);
    const side = car.x < 0 ? -1 : 1;
    if (seg.median > 0 && Math.abs(car.x) < seg.median + CAR_HALF + 0.05) car.x = side * (seg.median + CAR_HALF + 0.05);
    car.x = clamp(car.x, -(seg.wide - CAR_HALF), seg.wide - CAR_HALF);
  }
  fillTraffic(round, random, DRAW * 0.6);
}

/* ---------------------------------------------------------------- rules */

export const bonusOf = (round) => REGIONS[round.region].bonus * (1 + (round.stage - 1) * 0.1);

export function newRound(random = Math.random) {
  const round = {
    stage: 1,
    region: "coast",
    pos: 0,
    x: 0,
    speed: 0,
    time: START_TIME_MS,
    lastSecond: Math.ceil(START_TIME_MS / 1000),
    timeUp: false,
    coastMs: 0,
    nitro: START_NITRO,
    nitroMs: 0,
    // The power-ups held, oldest first, and those running: id to ms left,
    // and id to the ms it had in all (for the pill's fill and the hop's arc).
    powers: [],
    active: {},
    activeMax: {},
    points: 0,
    score: 0,
    dist: 0,
    coins: 0,
    closeCalls: 0,
    input: { left: false, right: false, up: false, down: false },
    segs: [],
    first: 0,
    cars: [],
    stageAt: 0,
    forkAt: 0,
    gateAt: 0,
    fork: null,
    warned: false,
    side: 0,
    next: null,
    pending: null,
    offroad: false,
    bumpMs: 0,
    sky: 0,
    clock: 0,
    over: false,
    events: [],
  };
  Object.assign(round, buildStage(round, "coast", 1, random, true));
  fillTraffic(round, random);
  round.events.push({ type: "stage", stage: 1, region: "coast" });
  return round;
}

// Lights a nitro can: false with none left, one already burning or the
// clock run out.
export function boost(round) {
  if (round.timeUp || round.over || round.nitroMs > 0 || round.nitro <= 0) return false;
  round.nitro -= 1;
  round.nitroMs = NITRO_MS;
  round.events.push({ type: "boost" });
  return true;
}

const running = (round, id) => (round.active[id] || 0) > 0;
// How high a Rocket Hop has the car, 0 on the road to 1 at the top.
export const hopHeight = (round) => (running(round, "hop") ? Math.sin(Math.PI * (1 - round.active.hop / round.activeMax.hop)) : 0);
// In the air or a ghost, nothing on the road touches the car.
const untouchable = (round) => running(round, "hop") || running(round, "ghost");

// Fires the oldest power-up held: false with none held or the clock run out.
// Space fires one before it ever burns nitro.
export function usePower(round, random = Math.random) {
  if (round.timeUp || round.over || !round.powers.length) return false;
  const id = round.powers.shift();
  const ms = POWERS[id].ms;
  if (ms) {
    const left = round.active[id] || 0;
    round.active[id] = left + ms;
    round.activeMax[id] = left > 0 ? (round.activeMax[id] || 0) + ms : ms;
  }
  round.events.push({ type: "power", id });
  if (id === "storm") storm(round, random);
  return true;
}

// Coin Storm: every car ahead in sight becomes a short run of coins where it
// was, and is sent off to come back far down the road.
function storm(round, random) {
  const pz = round.pos + PLAYER_Z;
  let n = 0;
  for (const car of round.cars) {
    if (car.z < pz + SEG || car.z > pz + SEG * DRAW * 0.8) continue;
    const at = Math.floor(car.z / SEG) - round.first;
    for (let k = 0; k < STORM_COINS; k++) {
      const seg = round.segs[at + k * 2];
      if (seg) seg.items.push({ kind: "coin", offset: clamp(car.x, -0.9, 0.9) });
    }
    placeCar(round, car, Math.min(roadEnd(round), pz + SEG * (DRAW * 0.85 + random() * DRAW * 0.1)), random);
    n += 1;
  }
  round.events.push({ type: "storm", cars: n });
}

// The running power-ups count down, and say so as each runs out.
function powerClock(round, ms) {
  for (const id of Object.keys(round.active)) {
    round.active[id] -= ms;
    if (round.active[id] > 0) continue;
    delete round.active[id];
    delete round.activeMax[id];
    round.events.push({ type: "powerend", id });
  }
}

function steer(round, seg, dt) {
  const pct = round.speed / MAX_SPEED;
  const dx = dt * STEER * Math.min(1, 0.25 + pct);
  if (round.input.left && !round.timeUp) round.x -= dx;
  if (round.input.right && !round.timeUp) round.x += dx;
  round.x -= dt * STEER * pct * pct * seg.curve * CENTRIFUGAL;
  round.x = clamp(round.x, -(seg.wide + 1.6), seg.wide + 1.6);
}

function throttle(round, seg, dt) {
  const burning = round.nitroMs > 0;
  const top = MAX_SPEED * (burning ? NITRO_BOOST : 1);
  let v = round.speed;
  if (round.timeUp) v += DECEL * 1.5 * dt;
  else if (burning) v += ACCEL * 2 * dt;
  else if (round.input.up) v += ACCEL * dt;
  else if (round.input.down) v += BRAKE * dt;
  else v += DECEL * dt;
  if (round.input.down && !round.timeUp && burning) v += BRAKE * dt;
  // A hop clears the shoulder.
  round.offroad = Math.abs(round.x) > seg.wide && !running(round, "hop");
  if (round.offroad && v > OFFROAD_LIMIT) v += OFFROAD_DECEL * dt;
  if (v > top) v = Math.max(top, v - ACCEL * 2 * dt);
  round.speed = clamp(v, 0, MAX_SPEED * NITRO_BOOST);
}

// The median of a fork is a wall: a car that touches it is pushed back to its
// side and slowed.
function median(round, seg, dt) {
  if (!(seg.median > 0) || Math.abs(round.x) >= seg.median + CAR_HALF) return;
  const side = round.side || (round.x < 0 ? -1 : 1);
  round.x = side * (seg.median + CAR_HALF);
  round.speed *= 1 - Math.min(1, 3 * dt);
  if (round.bumpMs <= 0) {
    round.events.push({ type: "scrape", side });
    round.bumpMs = 400;
  }
}

// A prop on the shoulder stops the car dead and backs it off a little.
// A Monster Truck flattens it instead, and a hop or a ghost misses it.
function hitProps(round, seg) {
  if (!(round.speed > 0) || untouchable(round)) return;
  for (const p of seg.props) {
    if (p.kind === "cone") continue;
    if (Math.abs(round.x - p.offset) >= CAR_HALF + PROPS[p.kind].hit) continue;
    if (running(round, "monster")) {
      seg.props = seg.props.filter((q) => q !== p);
      const points = Math.round(COIN_POINTS * bonusOf(round));
      round.points += points;
      round.events.push({ type: "flatten", kind: p.kind, points });
      return;
    }
    round.speed = Math.min(round.speed, MAX_SPEED / 12);
    round.nitroMs = 0;
    round.pos = Math.max(0, seg.i * SEG - PLAYER_Z - 1);
    if (round.bumpMs <= 0) {
      round.events.push({ type: "smash", kind: p.kind });
      round.bumpMs = 600;
    }
    return;
  }
}

// A car caught up with is a crash: you drop to below its speed just behind
// it. A car still ahead before this step counts, so a step can never drive
// through one. A car passed close at speed is a close call. In the air or a
// ghost, cars pass under or through; a Monster Truck flings them away.
function hitCars(round, random) {
  const pz = round.pos + PLAYER_Z;
  const air = running(round, "hop");
  for (const car of round.cars) {
    const d = car.z - pz;
    const near = Math.abs(round.x - car.x) < CAR_HALF * 2 * 0.9;
    if (untouchable(round) || !(round.speed > car.speed && car.ahead && d < CAR_LEN && near)) continue;
    if (running(round, "monster")) {
      const points = Math.round(FLING_POINTS * bonusOf(round));
      round.points += points;
      round.events.push({ type: "fling", color: car.color, side: car.x < round.x ? -1 : 1, points });
      placeCar(round, car, Math.min(roadEnd(round), pz + SEG * (DRAW * 0.7 + random() * DRAW * 0.25)), random);
      continue;
    }
    round.speed = car.speed * 0.6;
    round.nitroMs = 0;
    round.pos = car.z - CAR_LEN - PLAYER_Z;
    car.ahead = true;
    round.events.push({ type: "crash", color: car.color });
    return;
  }
  for (const car of round.cars) {
    const ahead = car.z > pz;
    if (car.ahead && !ahead && !air && round.speed > CLOSE_SPEED && Math.abs(round.x - car.x) < CLOSE_REACH) {
      const points = Math.round(CLOSE_POINTS * bonusOf(round));
      round.points += points;
      round.closeCalls += 1;
      round.events.push({ type: "close", points });
    }
    car.ahead = ahead;
  }
}

// A Coin Magnet reaches across the whole road.
function pickUp(round, seg) {
  const reach = running(round, "magnet") ? 3 : PICKUP_REACH;
  seg.items = seg.items.filter((it) => {
    if (Math.abs(round.x - it.offset) >= reach) return true;
    if (it.kind === "coin") {
      const points = Math.round(COIN_POINTS * bonusOf(round));
      round.points += points;
      round.coins += 1;
      round.events.push({ type: "coin", points });
    } else if (it.kind === "clock") {
      round.time += CLOCK_MS;
      round.events.push({ type: "clock", ms: CLOCK_MS });
    } else if (it.kind === "nitro") {
      round.nitro = Math.min(MAX_NITRO, round.nitro + 1);
      round.events.push({ type: "can", nitro: round.nitro });
    } else if (it.kind === "power") {
      if (round.powers.length < MAX_POWERS) {
        round.powers.push(it.power);
        round.events.push({ type: "box", id: it.power });
      } else {
        const points = Math.round(POWER_SPARE * bonusOf(round));
        round.points += points;
        round.events.push({ type: "spare", points });
      }
    }
    return false;
  });
}

// The fork: warned of ahead, chosen by the side you are on as the median
// starts (which builds the road behind it), and passed at the checkpoint.
function fork(round, index, random) {
  if (!round.warned && !round.pending && index >= round.forkAt - FORK_WARN) {
    round.warned = true;
    round.events.push({ type: "fork", left: round.fork.left, right: round.fork.right });
  }
  if (!round.pending && index >= round.forkAt) {
    round.side = round.x < 0 ? -1 : 1;
    round.next = round.side < 0 ? round.fork.left : round.fork.right;
    round.pending = buildStage(round, round.next, round.stage + 1, random);
    round.events.push({ type: "choose", region: round.next });
  }
  if (round.pending && index >= round.gateAt) {
    round.stage += 1;
    round.region = round.next;
    round.stageAt = round.gateAt;
    Object.assign(round, round.pending);
    round.pending = null;
    round.next = null;
    round.side = 0;
    round.warned = false;
    const ms = checkTime(round.stage);
    const points = CHECK_POINTS * (round.stage - 1);
    round.time += ms;
    round.lastSecond = Math.ceil(round.time / 1000);
    round.points += points;
    round.events.push({ type: "checkpoint", stage: round.stage, ms, points });
    round.events.push({ type: "stage", stage: round.stage, region: round.region });
  }
}

// The clock ticks down; under ten seconds each second is called, and at none
// the car coasts to a stop and the round is over.
function clock(round, ms) {
  if (round.timeUp) {
    round.coastMs += ms;
    if (round.speed <= 0 || round.coastMs >= COAST_MS) {
      round.over = true;
      round.events.push({ type: "over" });
    }
    return;
  }
  round.time -= ms;
  const sec = Math.ceil(round.time / 1000);
  if (sec < round.lastSecond && sec <= 10 && sec > 0) round.events.push({ type: "hurry", sec });
  round.lastSecond = sec;
  if (round.time <= 0) {
    round.time = 0;
    round.timeUp = true;
    round.nitroMs = 0;
    round.events.push({ type: "timeup" });
  }
}

// Drops road long behind the car, so a long drive keeps a short road.
function trim(round, index) {
  const behind = index - round.first;
  if (behind < 600) return;
  round.segs.splice(0, 400);
  round.first += 400;
}

function update(round, dt, random) {
  const ms = dt * 1000;
  round.clock += ms;
  round.bumpMs = Math.max(0, round.bumpMs - ms);
  round.nitroMs = Math.max(0, round.nitroMs - ms);
  powerClock(round, ms);
  const seg = segAt(round, round.pos + PLAYER_Z);
  steer(round, seg, dt);
  throttle(round, seg, dt);
  median(round, seg, dt);
  const step = round.speed * dt;
  round.pos += step;
  round.dist += step / SEG;
  round.points += (step / SEG) * SEG_POINTS * bonusOf(round);
  round.sky += seg.curve * (round.speed / MAX_SPEED) * dt * 0.06;
  moveTraffic(round, dt, random);
  const now = segAt(round, round.pos + PLAYER_Z);
  hitProps(round, now);
  hitCars(round, random);
  pickUp(round, now);
  const index = Math.floor((round.pos + PLAYER_Z) / SEG);
  fork(round, index, random);
  trim(round, index);
  clock(round, ms);
  round.score = Math.floor(round.points);
}

// Moves the round on by `ms`, in small slices.
export function advance(round, ms, random = Math.random) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    update(round, slice / 1000, random);
  }
  return round.over ? "over" : "running";
}

export const mph = (round) => Math.round((round.speed / MAX_SPEED) * TOP_MPH);
export const miles = (round) => (round.dist * 5) / 1609;

/* -------------------------------------------------------------- drawing */

const FALLBACK_COLORS = Object.freeze({ you: "#206cc3", head: "#1d1a17", panel: "#ffffff" });

// The page's tokens, read again at each round and each resize, so the car
// follows a highlight change made while the game sat paused. A stub canvas
// in Node has no computed style, so every color falls back.
function readColors(canvas) {
  let style = null;
  try {
    style = typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
  } catch {}
  const pick = (name, fallback) => (style && style.getPropertyValue(name).trim()) || fallback;
  return { you: pick("--accent", FALLBACK_COLORS.you), head: pick("--ink", FALLBACK_COLORS.head), panel: pick("--panel", FALLBACK_COLORS.panel) };
}

const SHADE = "rgba(0, 0, 0, 0.55)";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Text with a dark edge, so it reads on any scenery.
function label(ctx, text, x, y, size, color, align = "center") {
  ctx.font = `800 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size / 6);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.fill();
}

function star(ctx, x, y, outer, inner) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? inner : outer;
    if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function poly(ctx, color, pts) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

// A gradient where the canvas makes one; the stub canvas in Node does not.
function gradient(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  if (!g) return stops[stops.length - 1][1];
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

// A ridge line that repeats every screen width, so the hills can scroll
// round forever.
const ridge = (t, seed) => 0.5 + 0.25 * Math.sin(t * Math.PI * 2 + seed) + 0.15 * Math.sin(t * Math.PI * 6 + seed * 2) + 0.1 * Math.sin(t * Math.PI * 14 + seed * 3);

function hills(ctx, w, base, amp, offset, color, seed) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base);
  const step = w / 80;
  for (let x = 0; x <= w + step; x += step) ctx.lineTo(x, base - amp * ridge((x + offset) / w, seed));
  ctx.lineTo(w, base);
  ctx.closePath();
  ctx.fill();
}

// A row of towers that repeats every screen width, for the city.
function skyline(ctx, w, base, amp, offset, color, lit, clock) {
  const cols = 22;
  const cw = w / cols;
  const shift = ((offset % w) + w) % w;
  for (let k = -1; k <= cols; k++) {
    const n = (k + Math.floor(shift / cw) + cols * 100) % cols;
    const x = k * cw - (shift % cw);
    const th = amp * (0.35 + 0.65 * hash(n + 7));
    ctx.fillStyle = color;
    ctx.fillRect(x, base - th, cw * 0.92, th);
    if (!lit) continue;
    for (let wy = base - th + cw * 0.3; wy < base - cw * 0.2; wy += cw * 0.35) {
      for (let wx = 0.2; wx < 0.8; wx += 0.3) {
        if (hash(n * 31 + wy + wx * 7) < 0.55) continue;
        ctx.fillStyle = hash(n + wy) < 0.5 ? "rgba(255, 214, 120, 0.8)" : "rgba(120, 220, 255, 0.7)";
        ctx.fillRect(x + cw * wx, wy, cw * 0.14, cw * 0.12);
      }
    }
  }
  if (lit) {
    // A blinking light on the tallest roofs.
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(clock / 300);
    for (let k = 0; k < cols; k += 5) circle(ctx, k * cw - (shift % cw) + cw * 0.45, base - amp * (0.35 + 0.65 * hash(((k + Math.floor(shift / cw)) % cols) + 7)) - 3, 2, DANGER);
    ctx.globalAlpha = 1;
  }
}

function drawSky(ctx, spec, w, h, round, clock) {
  const horizon = h / 2;
  ctx.fillStyle = gradient(ctx, 0, 0, 0, horizon, [[0, spec.sky[0]], [0.62, spec.sky[1]], [1, spec.sky[2]]]);
  ctx.fillRect(0, 0, w, horizon + 1);
  if (spec.night) {
    for (let s = 0; s < 70; s++) {
      const x = hash(s * 3 + 1) * w;
      const y = hash(s * 5 + 2) * horizon * 0.8;
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(clock / 700 + s));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }
  if (spec === REGIONS.stars) {
    // The aurora: three soft bands that sway.
    for (let b = 0; b < 3; b++) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = ["#57e3a0", "#4fd1ff", "#a466ff"][b];
      ctx.lineWidth = h * 0.05;
      ctx.beginPath();
      for (let x = 0; x <= w; x += w / 40) {
        const y = horizon * (0.25 + b * 0.12) + Math.sin(x / w * 6 + clock / 1800 + b) * horizon * 0.08;
        if (x) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (spec.sun) {
    // A low sun cut by bands, drifting with the bends.
    const r = h * 0.17;
    const span = w * 1.4;
    const cx = ((((w / 2 - round.sky * w * 0.15) % span) + span) % span) - w * 0.2;
    const cy = horizon - r * 0.35;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, horizon);
    ctx.clip();
    ctx.shadowColor = spec.sun;
    ctx.shadowBlur = r * 0.6;
    circle(ctx, cx, cy, r, spec.sun);
    ctx.shadowBlur = 0;
    ctx.fillStyle = spec.sky[2];
    for (let k = 0; k < 5; k++) {
      const y = cy + r * (0.15 + k * 0.17);
      ctx.fillRect(cx - r, y, r * 2, r * (0.03 + k * 0.025));
    }
    ctx.restore();
  }
  if (spec === REGIONS.city) {
    skyline(ctx, w, horizon, h * 0.26, round.sky * w * 0.5, spec.far, true, clock);
    skyline(ctx, w, horizon, h * 0.14, round.sky * w + w * 0.37, spec.near, false, clock);
    return;
  }
  hills(ctx, w, horizon + 1, h * (spec === REGIONS.alpine ? 0.3 : 0.18), round.sky * w * 0.5, spec.far, 1.3);
  if (spec === REGIONS.alpine) {
    // Snow on the far peaks: the same ridge, lighter, only near the top.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, horizon - h * 0.19);
    ctx.clip();
    hills(ctx, w, horizon + 1, h * 0.3, round.sky * w * 0.5, "#ffffff", 1.3);
    ctx.restore();
  }
  hills(ctx, w, horizon + 1, h * 0.09, round.sky * w + w * 0.37, spec.near, 4.1);
}

// Projects a point of the road: its center at depth z and height y, shifted
// sideways by the curve so far, seen from the camera. k is pixels a unit of
// projected space; both axes share it, so nothing stretches.
function project(z, y, x, cam, k, w, h) {
  const rz = z - cam.z;
  const scale = DEPTH / rz;
  return { x: w / 2 + scale * (x - cam.x) * k, y: h / 2 - scale * (y - cam.y) * k, w: scale * ROAD_W * k, scale, rz };
}

function drawSegment(ctx, w, a, b, seg) {
  const spec = REGIONS[seg.region];
  const alt = Math.floor(seg.i / 3) % 2;
  // Each stretch reaches a pixel into the one beyond, which it is drawn
  // over, so no seam shows between them.
  const by = b.y - 1;
  ctx.fillStyle = spec.ground[alt];
  ctx.fillRect(0, by, w, a.y - by + 1);
  const r1 = a.w * seg.wide;
  const r2 = b.w * seg.wide;
  const k1 = a.w * 0.09;
  const k2 = b.w * 0.09;
  poly(ctx, spec.rumble[alt], [a.x - r1 - k1, a.y, a.x - r1, a.y, b.x - r2, by, b.x - r2 - k2, by]);
  poly(ctx, spec.rumble[alt], [a.x + r1 + k1, a.y, a.x + r1, a.y, b.x + r2, by, b.x + r2 + k2, by]);
  poly(ctx, spec.road[alt], [a.x - r1, a.y, a.x + r1, a.y, b.x + r2, by, b.x - r2, by]);
  if (seg.mark === "start" || seg.mark === "gate") {
    // A checkered line across the road.
    const cells = 12;
    for (let c = 0; c < cells; c++) {
      const f0 = -1 + (2 * c) / cells;
      const f1 = f0 + 2 / cells;
      poly(ctx, c % 2 ? "#1d1a17" : "#ffffff", [a.x + r1 * f0, a.y, a.x + r1 * f1, a.y, b.x + r2 * f1, by, b.x + r2 * f0, by]);
    }
    return;
  }
  if (seg.median > 0) {
    const m1 = a.w * seg.median;
    const m2 = b.w * seg.median;
    poly(ctx, spec.rumble[alt], [a.x - m1 - k1, a.y, a.x + m1 + k1, a.y, b.x + m2 + k2, by, b.x - m2 - k2, by]);
    poly(ctx, spec.ground[alt], [a.x - m1, a.y, a.x + m1, a.y, b.x + m2, by, b.x - m2, by]);
    return;
  }
  if (alt) return;
  const l1 = a.w * 0.025;
  const l2 = b.w * 0.025;
  for (const f of [-1 / 3, 1 / 3]) poly(ctx, spec.line, [a.x + r1 * f - l1, a.y, a.x + r1 * f + l1, a.y, b.x + r2 * f + l2, by, b.x + r2 * f - l2, by]);
}

/* -------------------------------------------------------------- sprites */

// Each prop drawn standing on (x, y) at s pixels a world unit.
const PROP_DRAW = {
  palm(ctx, x, y, s, p) {
    const h = PROPS.palm.h * s;
    const lean = (p.seed - 0.5) * h * 0.3;
    ctx.strokeStyle = "#8a5a32";
    ctx.lineWidth = Math.max(1, 110 * s);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.2, y - h * 0.5, x + lean, y - h * 0.86);
    ctx.stroke();
    const tx = x + lean;
    const ty = y - h * 0.86;
    ctx.fillStyle = "#2f8f4a";
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + (k * Math.PI) / 6;
      ctx.beginPath();
      ctx.ellipse(tx + Math.cos(a) * 380 * s, ty + Math.sin(a) * 160 * s + 120 * s, 430 * s, 110 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    circle(ctx, tx - 60 * s, ty + 60 * s, 70 * s, "#6b4a22");
    circle(ctx, tx + 70 * s, ty + 50 * s, 70 * s, "#6b4a22");
  },
  umbrella(ctx, x, y, s, p) {
    const h = PROPS.umbrella.h * s;
    const r = (PROPS.umbrella.w / 2) * s;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 25 * s, y - h, 50 * s, h);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? "#ffffff" : p.seed < 0.5 ? DANGER : NITRO;
      ctx.beginPath();
      ctx.moveTo(x, y - h * 1.05);
      ctx.arc(x, y - h * 0.82, r, Math.PI + (k * Math.PI) / 6, Math.PI + ((k + 1) * Math.PI) / 6);
      ctx.closePath();
      ctx.fill();
    }
  },
  billboard(ctx, x, y, s, p, night) {
    const bw = PROPS.billboard.w * s;
    const bh = 700 * s;
    const top = y - PROPS.billboard.h * s;
    ctx.fillStyle = "#4a4a52";
    ctx.fillRect(x - bw * 0.35, top + bh, 60 * s, y - top - bh);
    ctx.fillRect(x + bw * 0.35 - 60 * s, top + bh, 60 * s, y - top - bh);
    ctx.fillStyle = night ? "#2a1150" : "#1d1a17";
    ctx.fillRect(x - bw / 2, top, bw, bh);
    ctx.fillStyle = CAR_COLORS[Math.floor(p.seed * CAR_COLORS.length)];
    ctx.fillRect(x - bw / 2 + 40 * s, top + 40 * s, bw - 80 * s, bh - 80 * s);
    const size = 260 * s;
    if (size >= 5) {
      ctx.font = `900 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(p.text || "", x, top + bh / 2, bw - 120 * s);
    }
  },
  cactus(ctx, x, y, s) {
    const h = PROPS.cactus.h * s;
    const t = 180 * s;
    ctx.fillStyle = "#3f8f4a";
    roundRect(ctx, x - t / 2, y - h, t, h, t / 2);
    ctx.fill();
    roundRect(ctx, x - t * 2, y - h * 0.7, t * 0.8, h * 0.35, t * 0.4);
    ctx.fill();
    ctx.fillRect(x - t * 2, y - h * 0.42, t * 1.6, t * 0.6);
    roundRect(ctx, x + t * 1.2, y - h * 0.82, t * 0.8, h * 0.35, t * 0.4);
    ctx.fill();
    ctx.fillRect(x + t * 0.3, y - h * 0.54, t * 1.4, t * 0.6);
  },
  rock(ctx, x, y, s, p) {
    const w = PROPS.rock.w * s;
    const h = PROPS.rock.h * s;
    poly(ctx, p.seed < 0.5 ? "#8a7a6a" : "#7a6e66", [x - w / 2, y, x - w * 0.42, y - h * 0.6, x - w * 0.1, y - h, x + w * 0.3, y - h * 0.85, x + w / 2, y - h * 0.3, x + w / 2, y]);
    poly(ctx, "rgba(255, 255, 255, 0.18)", [x - w * 0.42, y - h * 0.6, x - w * 0.1, y - h, x, y - h * 0.55]);
  },
  maple(ctx, x, y, s, p) {
    const h = PROPS.maple.h * s;
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(x - 70 * s, y - h * 0.5, 140 * s, h * 0.5);
    const c = ["#e2553f", "#ff8a1f", "#f5b301"][Math.floor(p.seed * 3)];
    circle(ctx, x, y - h * 0.68, 560 * s, c);
    circle(ctx, x - 380 * s, y - h * 0.55, 380 * s, c);
    circle(ctx, x + 380 * s, y - h * 0.57, 400 * s, c);
    circle(ctx, x - 120 * s, y - h * 0.82, 300 * s, "rgba(255, 255, 255, 0.12)");
  },
  pine(ctx, x, y, s) {
    pineTree(ctx, x, y, s, false);
  },
  snowpine(ctx, x, y, s) {
    pineTree(ctx, x, y, s, true);
  },
  snowman(ctx, x, y, s) {
    circle(ctx, x, y - 260 * s, 260 * s, "#ffffff");
    circle(ctx, x, y - 640 * s, 190 * s, "#ffffff");
    circle(ctx, x, y - 900 * s, 130 * s, "#ffffff");
    ctx.fillStyle = "#1d1a17";
    ctx.fillRect(x - 120 * s, y - 1110 * s, 240 * s, 120 * s);
    ctx.fillRect(x - 170 * s, y - 1000 * s, 340 * s, 30 * s);
    poly(ctx, "#ff8a1f", [x, y - 910 * s, x + 160 * s, y - 890 * s, x, y - 870 * s]);
  },
  building(ctx, x, y, s, p, night, clock) {
    const w = PROPS.building.w * s * (0.8 + p.seed * 0.4);
    const h = PROPS.building.h * s * (0.6 + p.seed * 0.8);
    ctx.fillStyle = ["#2a2140", "#1d2438", "#33213a"][Math.floor(p.seed * 3)];
    ctx.fillRect(x - w / 2, y - h, w, h);
    const cell = 300 * s;
    if (cell >= 2) {
      for (let wy = y - h + cell; wy < y - cell; wy += cell * 1.4) {
        for (let wx = x - w / 2 + cell * 0.6; wx < x + w / 2 - cell; wx += cell * 1.3) {
          if (hash(wx / s + wy / s + p.seed * 100) < 0.4) continue;
          ctx.fillStyle = hash(wy / s + p.seed) < 0.5 ? "#ffd678" : "#7fdcff";
          ctx.fillRect(wx, wy, cell * 0.7, cell * 0.8);
        }
      }
    }
    // A neon strip along the roof.
    ctx.fillStyle = p.seed < 0.5 ? "#ff4fa3" : "#1fb6d9";
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(clock / 250 + p.seed * 10);
    ctx.fillRect(x - w / 2, y - h, w, Math.max(1, 80 * s));
    ctx.globalAlpha = 1;
  },
  lamp(ctx, x, y, s, p, night) {
    const h = PROPS.lamp.h * s;
    const dir = p.offset < 0 ? 1 : -1;
    ctx.strokeStyle = "#6a6f7a";
    ctx.lineWidth = Math.max(1, 70 * s);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + dir * 450 * s, y - h);
    ctx.stroke();
    const lx = x + dir * 450 * s;
    if (night) {
      ctx.globalAlpha = 0.16;
      poly(ctx, "#ffd46b", [lx - 60 * s, y - h, lx + 60 * s, y - h, lx + 500 * s, y, lx - 500 * s, y]);
      ctx.globalAlpha = 1;
    }
    circle(ctx, lx, y - h + 40 * s, 90 * s, night ? "#fff3c4" : "#d8dde6");
  },
  crystal(ctx, x, y, s, p, night, clock) {
    const w = PROPS.crystal.w * s;
    const h = PROPS.crystal.h * s;
    const c = p.seed < 0.5 ? "#a466ff" : "#4fd1ff";
    ctx.shadowColor = c;
    ctx.shadowBlur = Math.max(0, 300 * s * (0.6 + 0.4 * Math.sin(clock / 400 + p.seed * 9)));
    poly(ctx, c, [x - w / 2, y, x - w * 0.3, y - h * 0.6, x, y - h, x + w * 0.25, y - h * 0.55, x + w / 2, y]);
    ctx.shadowBlur = 0;
    poly(ctx, "rgba(255, 255, 255, 0.35)", [x - w * 0.3, y - h * 0.6, x, y - h, x - w * 0.05, y - h * 0.3]);
  },
  cone(ctx, x, y, s) {
    poly(ctx, "#ff8a1f", [x - 120 * s, y, x, y - 420 * s, x + 120 * s, y]);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 60 * s, y - 230 * s, 120 * s, 60 * s);
  },
};

function pineTree(ctx, x, y, s, snow) {
  const h = PROPS.pine.h * s;
  ctx.fillStyle = "#5a3d24";
  ctx.fillRect(x - 70 * s, y - h * 0.22, 140 * s, h * 0.22);
  for (let k = 0; k < 3; k++) {
    const base = y - h * (0.15 + k * 0.25);
    const half = 600 * s * (1 - k * 0.25);
    poly(ctx, "#2d6a3e", [x - half, base, x, base - h * 0.42, x + half, base]);
    if (snow) poly(ctx, "#ffffff", [x - half * 0.35, base - h * 0.27, x, base - h * 0.42, x + half * 0.35, base - h * 0.27]);
  }
}

// An overhead board across the road where it is about to split: each half
// names the road that side leads to, and its bonus.
function drawGantry(ctx, a, seg, fork, s, night) {
  if (!fork) return;
  const half = a.w * seg.wide;
  const top = a.y - 2100 * s;
  const bh = 600 * s;
  ctx.fillStyle = "#4a4f5a";
  ctx.fillRect(a.x - half - 80 * s, top, 80 * s, a.y - top);
  ctx.fillRect(a.x + half, top, 80 * s, a.y - top);
  for (const [dir, id] of [[-1, fork.left], [1, fork.right]]) {
    const spec = REGIONS[id];
    const x0 = dir < 0 ? a.x - half : a.x + 30 * s;
    const bw = half - 30 * s;
    ctx.fillStyle = night ? "#123a2a" : "#1e6b45";
    ctx.fillRect(x0, top, bw, bh);
    ctx.fillStyle = spec.dot;
    ctx.fillRect(x0, top + bh - 70 * s, bw, 70 * s);
    const size = 170 * s;
    if (size < 5) continue;
    ctx.font = `800 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${dir < 0 ? "◀ " : ""}${spec.name}${dir > 0 ? " ▶" : ""}`, x0 + bw / 2, top + bh * 0.36, bw * 0.92);
    ctx.fillStyle = GOLD;
    ctx.fillText(`x${spec.bonus} points`, x0 + bw / 2, top + bh * 0.68, bw * 0.92);
  }
}

// The start line's and each checkpoint's arch.
function drawArch(ctx, a, seg, s, text, clock) {
  const half = a.w * seg.wide + 120 * s;
  const top = a.y - 2000 * s;
  const bh = 420 * s;
  ctx.fillStyle = "#e6e6ea";
  ctx.fillRect(a.x - half - 100 * s, top, 100 * s, a.y - top);
  ctx.fillRect(a.x + half, top, 100 * s, a.y - top);
  const cells = 16;
  for (let c = 0; c < cells; c++) {
    ctx.fillStyle = c % 2 ? "#1d1a17" : "#ffffff";
    ctx.fillRect(a.x - half + (2 * half * c) / cells, top, (2 * half) / cells + 1, bh * 0.22);
  }
  ctx.fillStyle = text === "START" ? DANGER : CLOCK;
  ctx.fillRect(a.x - half, top + bh * 0.22, 2 * half, bh * 0.78);
  const size = 300 * s;
  if (size >= 5) {
    ctx.font = `900 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = Math.floor(clock / 300) % 2 ? "#ffffff" : GOLD;
    ctx.fillText(text, a.x, top + bh * 0.62);
  }
}

function drawItem(ctx, it, x, y, s, clock) {
  const r = 190 * s;
  if (r < 0.6) return;
  const cy = y - 300 * s - Math.sin(clock / 200 + x) * 60 * s;
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (it.kind === "coin") {
    const squash = Math.abs(Math.cos(clock / 260 + x / 40));
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.ellipse(x, cy, Math.max(0.5, r * squash), r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff3c4";
    star(ctx, x, cy, r * 0.55 * squash, r * 0.24 * squash);
    ctx.fill();
  } else if (it.kind === "clock") {
    circle(ctx, x, cy, r * 1.1, CLOCK);
    circle(ctx, x, cy, r * 0.8, "#ffffff");
    ctx.strokeStyle = "#1d1a17";
    ctx.lineWidth = Math.max(1, r * 0.15);
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x, cy - r * 0.6);
    ctx.moveTo(x, cy);
    ctx.lineTo(x + r * 0.45, cy);
    ctx.stroke();
  } else if (it.kind === "power") {
    // A spinning box that runs through every color, with a "?" on its face.
    const spin = Math.abs(Math.cos(clock / 300 + x / 50));
    const bw = r * 2.2 * Math.max(0.2, spin);
    ctx.fillStyle = `hsl(${Math.round((clock / 6 + x) % 360)}, 85%, 55%)`;
    roundRect(ctx, x - bw / 2, cy - r * 1.1, bw, r * 2.2, r * 0.35);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.stroke();
    if (r * 1.4 >= 4 && spin > 0.45) label(ctx, "?", x, cy + 1, r * 1.4, "#ffffff");
  } else {
    ctx.fillStyle = NITRO;
    roundRect(ctx, x - r * 0.65, cy - r * 1.1, r * 1.3, r * 2.2, r * 0.4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - r * 0.65, cy - r * 0.3, r * 1.3, r * 0.6);
    if (r * 0.6 >= 4) label(ctx, "N", x, cy + 1, r * 0.6, NITRO);
  }
}

// A car seen from behind, standing on (x, y).
function drawCar(ctx, car, x, y, s, night) {
  const truck = car.kind === "truck";
  const w = (truck ? 760 : CAR_W) * s;
  const h = (truck ? 900 : 380) * s;
  if (w < 1) return;
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.6, w * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1b1f";
  ctx.fillRect(x - w * 0.46, y - h * (truck ? 0.14 : 0.3), w * 0.18, h * (truck ? 0.14 : 0.3));
  ctx.fillRect(x + w * 0.28, y - h * (truck ? 0.14 : 0.3), w * 0.18, h * (truck ? 0.14 : 0.3));
  if (truck) {
    ctx.fillStyle = "#d8dde6";
    ctx.fillRect(x - w / 2, y - h, w, h * 0.86);
    ctx.fillStyle = car.color;
    ctx.fillRect(x - w / 2, y - h * 0.3, w, h * 0.16);
    ctx.fillStyle = "#9aa1ad";
    ctx.fillRect(x - 3 * s, y - h * 0.95, 6 * s, h * 0.62);
  } else {
    ctx.fillStyle = car.color;
    roundRect(ctx, x - w / 2, y - h * 0.82, w, h * 0.6, h * 0.12);
    ctx.fill();
    ctx.fillStyle = "#26303d";
    poly(ctx, "#26303d", [x - w * 0.4, y - h * 0.82, x - w * 0.3, y - h, x + w * 0.3, y - h, x + w * 0.4, y - h * 0.82]);
    ctx.fillStyle = car.color;
    ctx.fillRect(x - w * 0.34, y - h * 1.04, w * 0.68, h * 0.06);
  }
  const ly = y - h * (truck ? 0.22 : 0.62);
  ctx.fillStyle = "#ff3b3b";
  if (night) {
    ctx.shadowColor = "#ff3b3b";
    ctx.shadowBlur = w * 0.15;
  }
  ctx.fillRect(x - w * 0.46, ly, w * 0.18, h * (truck ? 0.06 : 0.12));
  ctx.fillRect(x + w * 0.28, ly, w * 0.18, h * (truck ? 0.06 : 0.12));
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(x - w * 0.09, y - h * (truck ? 0.12 : 0.42), w * 0.18, h * (truck ? 0.05 : 0.1));
}

// Planny's car, from behind, at the bottom of the screen. He waves both arms
// for a checkpoint. A Rocket Hop lifts it off its shadow on two jets, a Ghost
// Car is see-through (blinking as it runs out) and a Monster Truck is bigger
// and glows.
function drawPlayer(ctx, round, w, h, k, colors, clock, cheer, night) {
  const s = k / CAM_H;
  const monster = running(round, "monster");
  const cw = CAR_W * s * 1.08 * (monster ? 1.3 : 1);
  const ch = cw * 0.42;
  const hop = hopHeight(round);
  const lift = hop * ch * 1.2;
  const ghostMs = round.active.ghost || 0;
  const turn = round.input.left === round.input.right || round.timeUp ? 0 : round.input.left ? -1 : 1;
  const pct = round.speed / MAX_SPEED;
  const rough = round.offroad && round.speed > 0;
  const bob = rough ? Math.sin(clock / 30) * ch * 0.05 : Math.sin(clock / 80) * ch * 0.012 * pct;
  const x = w / 2;
  const y = h - ch * 0.05 + bob;
  const lean = turn * cw * 0.03;
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y, cw * 0.58 * (1 - hop * 0.35), ch * 0.12 * (1 - hop * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(0, -lift);
  if (ghostMs > 0) ctx.globalAlpha = ghostMs < 1000 && Math.floor(clock / 90) % 2 ? 0.8 : 0.4;
  if (monster) {
    ctx.shadowColor = POWERS.monster.color;
    ctx.shadowBlur = cw * 0.12;
  }
  // Wheels, turned a little with the steering.
  ctx.fillStyle = "#16161a";
  ctx.fillRect(x - cw * 0.48 + turn * cw * 0.01, y - ch * 0.36, cw * 0.19, ch * 0.36);
  ctx.fillRect(x + cw * 0.29 + turn * cw * 0.01, y - ch * 0.36, cw * 0.19, ch * 0.36);
  ctx.shadowBlur = 0;
  // Rocket jets under a hop, pointing down at the road.
  if (hop > 0) {
    for (const px of [-0.32, 0.32]) {
      const len = ch * (0.5 + 0.3 * Math.abs(Math.sin(clock / 25 + px * 10)));
      poly(ctx, "#ff8a1f", [x + cw * px - ch * 0.1, y, x + cw * px + ch * 0.1, y, x + cw * px, y + len]);
      poly(ctx, "#fff3c4", [x + cw * px - ch * 0.05, y, x + cw * px + ch * 0.05, y, x + cw * px, y + len * 0.55]);
    }
  }
  // Nitro flames out of the two pipes.
  if (round.nitroMs > 0) {
    for (const px of [-0.2, 0.2]) {
      const len = ch * (0.35 + 0.25 * Math.abs(Math.sin(clock / 30 + px * 10)));
      poly(ctx, "#ff8a1f", [x + cw * px - ch * 0.08, y - ch * 0.2, x + cw * px + ch * 0.08, y - ch * 0.2, x + cw * px, y - ch * 0.2 + len]);
      poly(ctx, "#bfe9ff", [x + cw * px - ch * 0.04, y - ch * 0.2, x + cw * px + ch * 0.04, y - ch * 0.2, x + cw * px, y - ch * 0.2 + len * 0.55]);
    }
  }
  // Body, bumper and rear deck.
  ctx.fillStyle = colors.you;
  roundRect(ctx, x - cw / 2, y - ch * 0.84, cw, ch * 0.64, ch * 0.16);
  ctx.fill();
  ctx.fillStyle = "#2a2a33";
  ctx.fillRect(x - cw * 0.47, y - ch * 0.28, cw * 0.94, ch * 0.1);
  poly(ctx, colors.you, [x - cw * 0.47, y - ch * 0.82, x - cw * 0.37 + lean, y - ch * 1.02, x + cw * 0.37 + lean, y - ch * 1.02, x + cw * 0.47, y - ch * 0.82]);
  poly(ctx, "rgba(255, 255, 255, 0.22)", [x - cw * 0.47, y - ch * 0.82, x - cw * 0.37 + lean, y - ch * 1.02, x + cw * 0.37 + lean, y - ch * 1.02, x + cw * 0.47, y - ch * 0.82]);
  // Planny in the driver's seat: his box, star eye and smile, peeking back.
  const bw = cw * 0.24;
  const bx = x - cw * 0.2 + lean * 1.6;
  const by = y - ch * 1.0 - bw * 0.95;
  if (cheer > 0) {
    ctx.strokeStyle = colors.head;
    ctx.lineWidth = Math.max(2, bw * 0.08);
    ctx.lineCap = "round";
    const wave = Math.sin(clock / 90) * bw * 0.12;
    ctx.beginPath();
    ctx.moveTo(bx, by + bw * 0.45);
    ctx.lineTo(bx - bw * 0.35 + wave, by - bw * 0.15);
    ctx.moveTo(bx + bw, by + bw * 0.45);
    ctx.lineTo(bx + bw * 1.35 - wave, by - bw * 0.15);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = colors.head;
  ctx.lineWidth = Math.max(2, bw * 0.07);
  roundRect(ctx, bx, by, bw, bw, bw * 0.22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = GOLD;
  star(ctx, bx + bw / 2, by + bw * 0.4, bw * 0.24, bw * 0.1);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx + bw / 2, by + bw * 0.62, bw * 0.13, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // The windscreen frame, in front of him.
  ctx.strokeStyle = "#2a2a33";
  ctx.lineWidth = Math.max(1.5, cw * 0.012);
  ctx.beginPath();
  ctx.moveTo(x - cw * 0.34 + lean, y - ch * 1.02);
  ctx.lineTo(x - cw * 0.3 + lean, y - ch * 1.32);
  ctx.lineTo(x + cw * 0.3 + lean, y - ch * 1.32);
  ctx.lineTo(x + cw * 0.34 + lean, y - ch * 1.02);
  ctx.stroke();
  // Tail lights, bright on the brakes, and the plate.
  const braking = round.input.down && round.speed > 0;
  ctx.fillStyle = braking ? "#ff2d2d" : "#b3262a";
  if (braking || night) {
    ctx.shadowColor = "#ff2d2d";
    ctx.shadowBlur = braking ? cw * 0.08 : cw * 0.03;
  }
  roundRect(ctx, x - cw * 0.45, y - ch * 0.7, cw * 0.22, ch * 0.16, ch * 0.05);
  ctx.fill();
  roundRect(ctx, x + cw * 0.23, y - ch * 0.7, cw * 0.22, ch * 0.16, ch * 0.05);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(x - cw * 0.1, y - ch * 0.56, cw * 0.2, ch * 0.18);
  if (ch * 0.14 >= 5) {
    ctx.font = `800 ${Math.round(ch * 0.14)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1d1a17";
    ctx.fillText("P2C", x, y - ch * 0.47);
  }
  ctx.restore();
}

// The scene: sky, road far to near with everything on it, then the car.
// Draws the road and returns how far down the board, in units, its highest
// drawn stretch reaches.
function drawRoad(ctx, round, u, colors, clock, cheer) {
  const w = W * u;
  const h = H * u;
  const k = h / 2;
  const spec = REGIONS[round.region];
  const pz = round.pos + PLAYER_Z;
  const base = segAt(round, round.pos);
  const basePct = (round.pos % SEG) / SEG;
  const pseg = segAt(round, pz);
  const playerY = pseg.y1 + (pseg.y2 - pseg.y1) * ((pz % SEG) / SEG);
  const cam = { x: round.x * ROAD_W, y: playerY + CAM_H, z: round.pos };
  drawSky(ctx, spec, w, h, round, clock);
  ctx.fillStyle = spec.ground[0];
  ctx.fillRect(0, h / 2, w, h / 2);
  const cars = new Map();
  for (const car of round.cars) {
    const i = Math.floor(car.z / SEG);
    if (!cars.has(i)) cars.set(i, []);
    cars.get(i).push(car);
  }
  // Under a Coin Magnet the items close by drift in toward the car.
  const pull = (n) => (running(round, "magnet") ? clamp(1 - n / 18, 0, 1) : 0);
  const rows = [];
  let maxy = h;
  let x = 0;
  let dx = -base.curve * basePct;
  for (let n = 0; n < DRAW; n++) {
    const seg = round.segs[base.i - round.first + n];
    if (!seg) break;
    const a = project(seg.i * SEG, seg.y1, x, cam, k, w, h);
    const b = project((seg.i + 1) * SEG, seg.y2, x + dx, cam, k, w, h);
    x += dx;
    dx += seg.curve;
    const road = a.rz > DEPTH && b.y < a.y && b.y < maxy;
    rows.push({ seg, a, b, n, road });
    if (road) maxy = b.y;
  }
  // Far to near, so a nearer stretch covers whatever is behind a crest.
  for (let r = rows.length - 1; r >= 0; r--) {
    const { seg, a, b, n, road } = rows[r];
    if (road) drawSegment(ctx, w, a, b, seg);
    if (a.rz <= DEPTH) continue;
    const s = a.scale * k;
    const fade = n > DRAW * 0.75 ? (DRAW - n) / (DRAW * 0.25) : 1;
    ctx.globalAlpha = fade;
    const night = REGIONS[seg.region].night;
    for (const p of seg.props) {
      const px = a.x + p.offset * ROAD_W * s;
      if (px < -w || px > 2 * w) continue;
      PROP_DRAW[p.kind](ctx, px, a.y, s, p, night, clock);
    }
    if (seg.mark === "sign") drawGantry(ctx, a, seg, round.pending ? null : round.fork, s, night);
    if (seg.mark === "start") drawArch(ctx, a, seg, s, "START", clock);
    if (seg.mark === "gate") drawArch(ctx, a, seg, s, "CHECKPOINT", clock);
    for (const it of seg.items) drawItem(ctx, it, a.x + (it.offset + (round.x - it.offset) * pull(n)) * ROAD_W * s, a.y, s, clock);
    const here = cars.get(seg.i);
    if (here) {
      for (const car of here) {
        const t = (car.z % SEG) / SEG;
        const cs = (a.scale + (b.scale - a.scale) * t) * k;
        const cx = a.x + (b.x - a.x) * t + car.x * ROAD_W * cs;
        const cy = a.y + (b.y - a.y) * t;
        if (car.z > pz - SEG / 2) drawCar(ctx, car, cx, cy, cs, night);
      }
    }
    ctx.globalAlpha = 1;
  }
  drawPlayer(ctx, round, w, h, k, colors, clock, cheer, spec.night);
  return maxy / u;
}

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${Math.round(h * 0.62)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = h * 0.7 + text.length * h * 0.42;
  drawPill(ctx, x, y, w, h, text, color, fill, y + h / 2 + 1);
  return w;
}

// The clock big in the top middle, the stage, nitro and powers along the
// top left, the way to the checkpoint at the top right, the speed at the
// bottom left, and the fork's two roads while it is coming.
function drawHud(ctx, round, u, clock) {
  const w = W * u;
  const h = Math.max(14, u * 1.05);
  let x = u * 0.5;
  const y = u * 0.45;
  // The clock: big and centered so it leans on the driver, and in the last
  // ten seconds it blinks and swells on every tick.
  const secs = Math.ceil(round.time / 1000);
  const low = secs <= 10;
  const blink = low && Math.floor(clock / 250) % 2 === 0;
  const tick = low ? 1 - (secs - round.time / 1000) : 0;
  const th = h * (1.7 + 0.15 * tick);
  const text = `TIME ${secs}`;
  const tw = th * 0.7 + text.length * th * 0.42;
  const tx = (w - tw) / 2;
  pill(ctx, tx, y - (th - h * 1.7) / 2, th, text, blink ? "#ffffff" : low ? DANGER : "#ffffff");
  // The rest run left to right, starting a second row rather than run under
  // the clock.
  let row = y;
  const add = (text, color, fill) => {
    const pw = h * 0.7 + text.length * h * 0.42;
    if (x + pw > tx - 6 && x > u * 0.5) {
      x = u * 0.5;
      row += h + 4;
    }
    x += pill(ctx, x, row, h, text, color, fill) + 6;
  };
  add(`STAGE ${round.stage}`, REGIONS[round.region].dot);
  const cans = "●".repeat(round.nitro) + "○".repeat(Math.max(0, MAX_NITRO - round.nitro));
  if (round.nitroMs > 0) add("NITRO!", NITRO, round.nitroMs / NITRO_MS);
  else add(`NITRO ${cans}`, NITRO);
  // The power-up space fires next (and how many more wait behind it), then
  // each one running, emptying as it runs out.
  if (round.powers.length) {
    const next = POWERS[round.powers[0]];
    const more = round.powers.length - 1;
    add(`SPACE: ${next.short}${more ? ` +${more}` : ""}`, next.color);
  }
  for (const id of POWER_ORDER) {
    if (running(round, id)) add(`${POWERS[id].short}!`, POWERS[id].color, round.active[id] / round.activeMax[id]);
  }
  // The way to the checkpoint.
  const index = Math.floor((round.pos + PLAYER_Z) / SEG);
  const done = clamp((index - round.stageAt) / Math.max(1, round.gateAt - round.stageAt), 0, 1);
  const bw = u * 12;
  const bx = w - bw - u * 0.6;
  ctx.fillStyle = PILL;
  roundRect(ctx, bx, y, bw, h, h / 2);
  ctx.fill();
  ctx.fillStyle = CLOCK;
  roundRect(ctx, bx + 3, y + 3, Math.max(0, (bw - 6) * done), h - 6, (h - 6) / 2);
  ctx.fill();
  label(ctx, "CHECKPOINT", bx + bw / 2, y + h / 2 + 1, h * 0.55, "#ffffff");
  // The fork's two roads, a postcard each, the side you are on lit.
  const below = y + h * 1.9;
  if (round.warned && !round.pending && round.fork) {
    drawForkCards(ctx, round, u, clock);
    label(ctx, "FORK AHEAD", w / 2, below + u * 1.4, u * 1.05, GOLD);
    label(ctx, "Keep left or right to pick", w / 2, below + u * 2.7, u * 0.7, "#ffffff");
  } else if (round.pending) {
    label(ctx, `Next: ${REGIONS[round.next].name}`, w / 2, below + u * 1.2, u * 0.9, REGIONS[round.next].dot);
  }
  // The speed.
  const sy = H * u - u * 1.6;
  label(ctx, String(mph(round)), u * 0.8, sy - u * 0.6, u * 2.2, round.nitroMs > 0 ? NITRO : "#ffffff", "left");
  label(ctx, "MPH", u * 0.8, sy + u * 0.9, u * 0.7, "#ffffff", "left");
}

// A small picture of a road: its sky and hills, its ground, the road running
// off to the horizon and a few of its props, at `w` by `h` pixels from the
// origin.
function postcard(ctx, spec, w, h, clock) {
  drawSky(ctx, spec, w, h, { sky: 0.35 }, clock);
  const horizon = h / 2;
  ctx.fillStyle = spec.ground[0];
  ctx.fillRect(0, horizon, w, h - horizon);
  const half = (f) => w * (0.03 + 0.33 * f);
  const at = (f) => horizon + (h - horizon) * f;
  poly(ctx, spec.rumble[1], [w / 2 - half(0) * 1.15, horizon, w / 2 + half(0) * 1.15, horizon, w / 2 + half(1) * 1.15, h, w / 2 - half(1) * 1.15, h]);
  poly(ctx, spec.road[0], [w / 2 - half(0), horizon, w / 2 + half(0), horizon, w / 2 + half(1), h, w / 2 - half(1), h]);
  for (let f = 0.1; f < 1; f += 0.3) {
    const g = f + 0.14;
    poly(ctx, spec.line, [w / 2 - half(f) * 0.03, at(f), w / 2 + half(f) * 0.03, at(f), w / 2 + half(g) * 0.03, at(g), w / 2 - half(g) * 0.03, at(g)]);
  }
  const kinds = [...new Set(spec.props)].filter((k) => k !== "billboard");
  const spots = [[-1, 0.25], [1, 0.4], [-1, 0.85], [1, 1]];
  spots.forEach(([dir, f], n) => {
    const kind = kinds[n % kinds.length];
    const ps = (h * (0.04 + 0.14 * f)) / 1000;
    const px = w / 2 + dir * (half(f) * 1.15 + PROPS[kind].w * ps * 0.45);
    PROP_DRAW[kind](ctx, px, at(f), ps, { kind, offset: dir, text: SLOGANS[n], seed: 0.3 + n * 0.15 }, spec.night, clock);
  });
}

// The fork's two postcards, one in each top corner, each named with its
// points bonus. The side the car is on is lit and framed in its road's
// color; the other is dimmed.
function drawForkCards(ctx, round, u, clock) {
  const w = W * u;
  const cw = u * 13;
  const ch = u * 7.6;
  const top = u * 2.2;
  const side = round.x < 0 ? -1 : 1;
  for (const [dir, id] of [[-1, round.fork.left], [1, round.fork.right]]) {
    const spec = REGIONS[id];
    const lit = side === dir;
    const x0 = dir < 0 ? u * 0.7 : w - cw - u * 0.7;
    ctx.save();
    ctx.globalAlpha = lit ? 1 : 0.6;
    ctx.fillStyle = lit ? spec.dot : "rgba(0, 0, 0, 0.6)";
    roundRect(ctx, x0 - u * 0.25, top - u * 0.25, cw + u * 0.5, ch + u * 0.5, u * 0.6);
    ctx.fill();
    roundRect(ctx, x0, top, cw, ch, u * 0.4);
    ctx.clip();
    ctx.translate(x0, top);
    postcard(ctx, spec, cw, ch, clock);
    ctx.fillStyle = SHADE;
    ctx.fillRect(0, ch * 0.68, cw, ch * 0.32);
    label(ctx, `${dir < 0 ? "◀ " : ""}${spec.name}${dir > 0 ? " ▶" : ""}`, cw / 2, ch * 0.78, u * (lit ? 0.85 : 0.75), lit ? "#ffffff" : "#e6e6ea");
    label(ctx, `x${spec.bonus} points`, cw / 2, ch * 0.92, u * 0.6, GOLD);
    ctx.restore();
  }
}

// A banner is a light strip in the sky above the horizon. Over a hill the
// road climbs into it, and then it fades to BANNER_SEE_THROUGH over
// BANNER_FADE_MS, so the cars and the fork ahead stay in sight.
const BANNER_ROWS = 4.6;
const BANNER_Y = H * 0.36;
const BANNER_SHADE = "rgba(0, 0, 0, 0.3)";
const BANNER_SEE_THROUGH = 0.12;
const BANNER_FADE_MS = 140;

// Whether a road whose highest stretch reaches `roadTop` units down the board
// is in the banner's strip.
export const underBanner = (roadTop) => roadTop < BANNER_Y + BANNER_ROWS / 2 + 1;

function drawBanner(ctx, b, u) {
  const w = W * u;
  const p = 1 - b.life / b.max;
  const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.55 : p < 0.22 ? 1.15 - ((p - 0.12) / 0.1) * 0.15 : 1;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  const y = BANNER_Y * u;
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, y - u * (BANNER_ROWS / 2), w, u * BANNER_ROWS);
  if (b.tag) label(ctx, b.tag, w / 2, y - u * 1.55, u * 0.75, GOLD);
  label(ctx, b.title, w / 2, y - u * 0.15, u * 1.75 * pop, b.color);
  if (b.sub) label(ctx, b.sub, w / 2, y + u * 1.4, u * 0.9, "#ffffff");
  ctx.globalAlpha = 1;
}

const countBits = (n) => REGION_ORDER.reduce((sum, _, i) => sum + (n & (1 << i) ? 1 : 0), 0);

// The ready and over screens' strip near the top: a line or two, then one
// dot per road, lit for those reached.
function drawTally(ctx, u, lines, found) {
  const w = W * u;
  const top = u * 2.2;
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, w, u * 6.4);
  lines.forEach((text, i) => label(ctx, text, w / 2, top + u * (1.3 + i * 1.6), u * (i ? 0.9 : 1.1), i ? "#ffffff" : GOLD));
  const r = u * 0.45;
  const gap = r * 3;
  const x = w / 2 - ((REGION_ORDER.length - 1) * gap) / 2;
  const y = top + u * 5.1;
  REGION_ORDER.forEach((id, i) => {
    ctx.beginPath();
    ctx.arc(x + i * gap, y, r, 0, Math.PI * 2);
    if (found & (1 << i)) {
      ctx.fillStyle = REGIONS[id].dot;
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

// The over screen's nudge to drive again.
function teaser(found) {
  const left = REGION_ORDER.length - countBits(found);
  if (left) return `${left} ${left === 1 ? "road is" : "roads are"} still out there. One more drive?`;
  return "You have driven every road. Now beat your best!";
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 300;

// The engine's gearbox, for its sound only: each gear's top as a share of
// top speed (the last one is nitro's). Within a gear the revs climb from
// GEAR_LOW to GEAR_HIGH (1 is idle), and an upshift drops them back.
const GEARS = Object.freeze([0, 0.16, 0.34, 0.54, 0.76, 1.08, NITRO_BOOST + 0.02]);
const GEAR_LOW = 1.9;
const GEAR_HIGH = 3.3;
// A gear is let go only this far under its bottom, so it never chatters.
const GEAR_SLACK = 0.04;
// Steps of a major scale, climbed by coins picked up in quick succession.
const COIN_STEPS = Object.freeze([1, 1.122, 1.26, 1.335, 1.498, 1.682, 1.888, 2]);
// The traffic heard: cars within this many segments, ahead or just behind.
const HEAR_AHEAD = 36;
const HEAR_BEHIND = 6;

function create({ canvas, tone = () => {}, hum = () => {}, music = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // Without a memo (the unit suite) the tally lasts as long as the game.
  let found = 0;
  try {
    found = memo ? Number(memo.get()) | 0 : 0;
  } catch {}
  let fx = null;
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], flung: [], shake: 0, shakeMag: 0, flash: null, cheer: 0, clock: 0, roadTop: H });
  resetFx();

  // Screen-space effects, in units, around the car.
  const CAR_AT = Object.freeze({ x: W / 2, y: H - 4 });
  const burst = (p, color, n, speed = 8) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 400 + Math.random() * 400, max: 800, color, size: 0.2 + Math.random() * 0.25 });
    }
  };
  const float = (text, color) => fx.floats.push({ x: CAR_AT.x + (Math.random() - 0.5) * 4, y: CAR_AT.y - 5, text, color, life: 900, max: 900 });
  const banner = (title, sub, color, ms = 1800) => {
    if (fx.banners.length >= 3 || fx.banners.some((b) => b.title === title)) return null;
    const b = { title, sub, color, life: ms, max: ms, tag: "", see: 1 };
    fx.banners.push(b);
    return b;
  };
  const shake = (ms, mag) => {
    fx.shake = Math.max(fx.shake, ms);
    fx.shakeMag = Math.max(fx.shake > 0 ? fx.shakeMag : 0, mag);
  };
  const flash = (color, ms = 260) => (fx.flash = { color, life: ms, max: ms });

  // A first visit to a road lights its dot for good and tags its banner.
  const discover = (id, b) => {
    const bit = REGION_ORDER.indexOf(id);
    if (bit < 0 || found & (1 << bit)) return;
    found |= 1 << bit;
    try {
      if (memo) memo.set(found);
    } catch {}
    if (b) b.tag = `NEW ROAD ${countBits(found)} / ${REGION_ORDER.length}`;
  };

  // The sound's own memory: the gear, what was held last tick, when a
  // repeating cue last played, and each car's side of you last tick (for its
  // pass). Never read by the rules, so it can never change a round.
  let sfx = null;
  const resetSfx = () => (sfx = { t: 0, gear: 0, up: false, down: false, nitroMs: 0, hitAt: -1e9, coinAt: -1e9, coinStep: 0, honkAt: -1e9, zoomAt: -1e9, fireAt: -1e9, rumbleAt: 0, sides: new WeakMap() });
  resetSfx();
  const jitter = (spread = 0.1) => 1 + (Math.random() - 0.5) * spread;

  const handle = (e) => {
    if (e.type === "stage") {
      const spec = REGIONS[e.region];
      if (e.stage > 1) tone("levelup", 0.6);
      const had = found;
      discover(e.region, banner(e.stage > 1 ? `Stage ${e.stage}: ${spec.name}` : spec.name, spec.sub, spec.dot, 2000));
      if (e.stage > 1 && found !== had) tone("driveNewRoad", 0.9);
    } else if (e.type === "checkpoint") {
      tone("ace");
      tone("driveCheckpoint", 0.8);
      tone("cheer", 0.45);
      flash(CLOCK, 320);
      fx.cheer = 1600;
      burst(CAR_AT, GOLD, 30, 10);
      banner("Checkpoint!", `+${Math.round(e.ms / 1000)} seconds, +${e.points} points`, GOLD, 1600);
    } else if (e.type === "crash") {
      tone("crash");
      tone("smash", 0.85, jitter(0.15));
      tone("skid", 0.5, jitter());
      sfx.hitAt = sfx.t;
      burst({ x: CAR_AT.x, y: CAR_AT.y - 3 }, e.color, 24, 10);
      burst({ x: CAR_AT.x, y: CAR_AT.y - 3 }, "#ffffff", 10, 6);
      shake(380, 0.45);
      flash(DANGER, 240);
    } else if (e.type === "smash") {
      tone("boom");
      tone("crunch", 0.8, jitter(0.2));
      tone("thud", 0.9);
      sfx.hitAt = sfx.t;
      burst({ x: CAR_AT.x, y: CAR_AT.y - 2 }, "#8a7a6a", 24, 9);
      shake(450, 0.6);
      float("Ouch!", DANGER);
    } else if (e.type === "scrape") {
      tone("wall", 0.5);
      tone("driveScrape", 0.7, jitter(0.15));
      burst({ x: CAR_AT.x - e.side * 6, y: CAR_AT.y }, GOLD, 8, 7);
      shake(120, 0.15);
    } else if (e.type === "close") {
      tone("combo");
      // The driver you cut past leans on the horn (not every time in a row).
      if (sfx.t - sfx.honkAt > 700) {
        sfx.honkAt = sfx.t;
        tone("honk", 0.55, 0.85 + Math.random() * 0.3);
      }
      float(`Close call! +${e.points}`, GOLD);
    } else if (e.type === "coin") {
      // Coins in quick succession climb a scale.
      sfx.coinStep = sfx.t - sfx.coinAt < 450 ? Math.min(COIN_STEPS.length - 1, sfx.coinStep + 1) : 0;
      sfx.coinAt = sfx.t;
      tone("coin", 0.6, COIN_STEPS[sfx.coinStep]);
      float(`+${e.points}`, GOLD);
    } else if (e.type === "clock") {
      tone("power");
      tone("driveClock", 0.8);
      float(`+${Math.round(e.ms / 1000)} sec`, CLOCK);
    } else if (e.type === "can") {
      tone("power");
      tone("clank", 0.5, jitter());
      float("+1 NITRO", NITRO);
    } else if (e.type === "boost") {
      tone("zap");
      tone("boost", 0.9);
      tone("driveBackfire", 0.7, jitter());
      flash(NITRO, 220);
      shake(200, 0.2);
    } else if (e.type === "box") {
      tone("power");
      tone("sparkle", 0.6);
      burst({ x: CAR_AT.x, y: CAR_AT.y - 3 }, POWERS[e.id].color, 14, 7);
      float(`${POWERS[e.id].name}!`, POWERS[e.id].color);
    } else if (e.type === "spare") {
      tone("coin", 0.6);
      tone("coinUp", 0.6);
      float(`Full up! +${e.points}`, GOLD);
    } else if (e.type === "power") {
      const spec = POWERS[e.id];
      tone("zap");
      if (e.id === "hop") {
        tone("jump");
        tone("driveLiftoff", 0.8);
      } else if (e.id === "ghost") tone("warp", 0.8);
      else if (e.id === "monster") tone("driveMonsterRev");
      else if (e.id === "magnet") tone("shieldUp", 0.7);
      else if (e.id === "storm") tone("riser", 0.7);
      flash(spec.color, 260);
      shake(200, 0.2);
      banner(spec.name, spec.line, spec.color, 1300);
    } else if (e.type === "storm") {
      tone("ace");
      tone("sparkle");
      if (e.cars) tone("coinUp", 0.8);
      for (let k = 0; k < 4; k++) burst({ x: W * (0.2 + k * 0.2), y: H * 0.45 }, GOLD, 12, 9);
      if (e.cars) float(`${e.cars} ${e.cars === 1 ? "car" : "cars"} to coins!`, GOLD);
    } else if (e.type === "fling") {
      tone("boom");
      tone("crunch", 0.9, jitter(0.2));
      tone("clank", 0.5, jitter(0.2));
      shake(260, 0.35);
      burst({ x: CAR_AT.x, y: CAR_AT.y - 4 }, e.color, 16, 10);
      fx.flung.push({ x: CAR_AT.x + e.side * 2, y: CAR_AT.y - 5, vx: e.side * (10 + Math.random() * 12), vy: -(24 + Math.random() * 10), rot: 0, vr: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8), color: e.color, life: 1300, max: 1300 });
      float(`SMASH! +${e.points}`, POWERS.monster.color);
    } else if (e.type === "flatten") {
      tone("boom", 0.6);
      tone("crunch", 0.7, jitter(0.2));
      burst({ x: CAR_AT.x, y: CAR_AT.y - 2 }, POWERS.monster.color, 14, 8);
      float(`Flattened! +${e.points}`, POWERS.monster.color);
    } else if (e.type === "powerend") {
      tone("swing", 0.4);
      // A hop comes back down to the road; the rest wind down.
      if (e.id === "hop") {
        tone("land");
        tone("thud", 0.6);
      } else tone("powerDown", 0.35);
    } else if (e.type === "fork") {
      tone("mystery");
      tone("whoosh", 0.4);
      banner("Fork ahead!", "Keep left or right to pick your next road", "#ffffff", 2200);
    } else if (e.type === "choose") {
      tone("swing");
      tone("swoosh", 0.7);
      float(`To ${REGIONS[e.region].name}`, REGIONS[e.region].dot);
    } else if (e.type === "hurry") {
      tone("count", 0.6);
      // The last five seconds beep, higher as they run out, and the last
      // three thump like a heartbeat.
      if (e.sec <= 5) tone("driveBeep", 0.7, 1 + (5 - e.sec) * 0.06);
      if (e.sec <= 3) tone("heartbeat", 0.7);
    } else if (e.type === "timeup") {
      tone("fall");
      tone("driveStall", 0.9);
      tone("aww", 0.35);
      banner("Time up!", `${round.score} points`, DANGER, 2400);
    } else if (e.type === "over") {
      // The car has rolled to a stop: a new best cheers, anything else is the end.
      if (beaten) {
        tone("victory");
        tone("applause", 0.6);
      } else tone("gameOver", 0.8);
    }
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    tone("fanfare", 0.6);
    banner("New best!", "Every point from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  const runFx = (ms) => {
    fx.clock += ms;
    fx.cheer = Math.max(0, fx.cheer - ms);
    const s = ms / 1000;
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 + 8 * s;
      return p.life > 0;
    });
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.y -= 2.4 * s;
      return f.life > 0;
    });
    fx.flung = fx.flung.filter((c) => {
      c.life -= ms;
      c.x += c.vx * s;
      c.y += c.vy * s;
      c.vy += 40 * s;
      c.rot += c.vr * s;
      return c.life > 0;
    });
    if (fx.banners.length) {
      const b = fx.banners[0];
      const target = underBanner(fx.roadTop) ? BANNER_SEE_THROUGH : 1;
      b.see += (target - b.see) * Math.min(1, ms / BANNER_FADE_MS);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
    }
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash) {
      fx.flash.life -= ms;
      if (fx.flash.life <= 0) fx.flash = null;
    }
    // Dust off the shoulder.
    if (round.offroad && round.speed > 0 && Math.random() < 0.5) {
      burst({ x: CAR_AT.x + (Math.random() < 0.5 ? -3 : 3), y: H - 0.8 }, REGIONS[round.region].ground[1], 1, 5);
    }
  };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    const w = W * u;
    const h = H * u;
    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * 2 * fx.shakeMag * u, (Math.random() - 0.5) * 2 * fx.shakeMag * u);
    fx.roadTop = drawRoad(ctx, round, u, colors, fx.clock, fx.cheer);
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect((p.x - p.size / 2) * u, (p.y - p.size / 2) * u, p.size * u, p.size * u);
    }
    ctx.globalAlpha = 1;
    // Cars a Monster Truck flung, tumbling off and shrinking into the sky.
    for (const c of fx.flung) {
      const sc = 0.5 + 0.7 * (c.life / c.max);
      ctx.save();
      ctx.translate(c.x * u, c.y * u);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      roundRect(ctx, -2 * u * sc, -0.9 * u * sc, 4 * u * sc, 1.8 * u * sc, 0.4 * u * sc);
      ctx.fill();
      ctx.fillStyle = "#26303d";
      ctx.fillRect(-1.2 * u * sc, -0.9 * u * sc, 2.4 * u * sc, 0.7 * u * sc);
      ctx.restore();
    }
    for (const f of fx.floats) {
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
      label(ctx, f.text, f.x * u, f.y * u, u * 1.0, f.color);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (fx.flash) {
      ctx.globalAlpha = 0.28 * (fx.flash.life / fx.flash.max);
      ctx.fillStyle = fx.flash.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (state === "running" || state === "paused") drawHud(ctx, round, u, fx.clock);
    if (state === "running" && fx.banners.length) drawBanner(ctx, fx.banners[0], u);
    const total = `${countBits(found)} of ${REGION_ORDER.length} roads driven`;
    if (state === "ready") drawTally(ctx, u, ["Hold up to drive, arrows to steer, space for a power-up or nitro", total], found);
    if (state === "over") drawTally(ctx, u, [`Reached stage ${round.stage}, ${miles(round).toFixed(1)} miles driven${beaten ? ", with a new best!" : ""}`, `${total}. ${teaser(found)}`], found);
  };

  // The held sounds, asked for every tick of a running round (a pause, the
  // end or the window closing lets them fade by themselves), and the cues
  // that come from how you drive rather than from a rule's event.
  const soundscape = (ms) => {
    sfx.t += ms;
    const f = round.speed / MAX_SPEED;
    const burning = round.nitroMs > 0;
    const air = running(round, "hop");
    const on = !round.timeUp && (round.input.up || burning);
    const braking = !round.timeUp && round.input.down;

    // The engine: the gear follows the speed, the revs climb through each
    // gear and drop at the shift, and it is loudest with the throttle open.
    let g = sfx.gear;
    while (g < GEARS.length - 2 && f > GEARS[g + 1]) g += 1;
    while (g > 0 && f < GEARS[g] - GEAR_SLACK) g -= 1;
    if (g > sfx.gear && on) tone("shift", 0.6, 0.9 + g * 0.05);
    else if (g < sfx.gear && braking) tone("shift", 0.3, 0.8);
    sfx.gear = g;
    const span = Math.max(0.01, GEARS[g + 1] - GEARS[g]);
    const t = clamp((f - GEARS[g]) / span, 0, 1);
    let rpm = g === 0 ? 1 + (GEAR_HIGH - 1) * t : GEAR_LOW + (GEAR_HIGH - GEAR_LOW) * t;
    // Off the throttle the revs sag a little; on it with the car held still
    // (a crash, a prop) it still revs up some.
    if (!on) rpm *= 0.93;
    else if (f < 0.05) rpm = Math.max(rpm, 1.5);
    const load = round.timeUp ? 0.2 : on ? 1 : braking ? 0.3 : 0.4;
    const ghostly = running(round, "ghost") ? 0.55 : 1;
    const level = (0.5 + 0.5 * load) * ghostly;
    if (running(round, "monster")) hum("drive:engine", "driveMonster", level, rpm);
    else hum("drive:engine", "driveEngine", level, rpm);
    // The road's song builds with your speed and a burst of nitro, changes
    // with the road and stops with the clock.
    const song = ROAD_MUSIC[round.region];
    if (!round.timeUp && song) music(song, Math.min(1, f + (burning ? 0.3 : 0)));

    // The wind rises with speed, more so up in the air.
    hum("drive:wind", "wind", Math.min(1, f ** 1.5 * 0.9 + (air ? 0.35 : 0)), 0.6 + 1.6 * f);

    // The tires: gravel off the road, a squeal cornering or braking hard.
    if (!air && round.offroad && f > 0.01) {
      hum("drive:tires", "driveGravel", Math.min(1, 0.35 + f * 1.8), 0.7 + f);
      if (sfx.t >= sfx.rumbleAt) {
        sfx.rumbleAt = sfx.t + 90 + Math.random() * 140;
        tone("rumble", 0.4 + f, jitter(0.3));
      }
    } else if (!air && f > 0.1) {
      const seg = segAt(round, round.pos + PLAYER_Z);
      const steering = !round.timeUp && round.input.left !== round.input.right;
      const demand = (Math.abs(seg.curve) / MAX_CURVE) * f * f + (steering ? 0.3 * f * f : 0) + (braking ? 0.6 * f : 0);
      if (demand > 0.45) hum("drive:tires", "squeal", Math.min(1, (demand - 0.45) / 0.4), 0.9 + 0.3 * demand);
    }

    // A brake stab at speed, and a pop or two out of the exhaust as you lift
    // off the throttle from high revs.
    if (braking && !sfx.down && f > 0.3) tone("brake", 0.3 + 0.5 * f, jitter());
    if (!round.input.up && sfx.up && !burning && f > 0.6 && sfx.t - sfx.fireAt > 1500) {
      sfx.fireAt = sfx.t;
      tone("driveBackfire", 0.6, jitter(0.2));
    }
    // Nitro burnt out on its own (not cut by a hit): the turbo blows off.
    if (sfx.nitroMs > 0 && !burning && sfx.t - sfx.hitAt > 120 && !round.timeUp) tone("driveBlowoff", 0.7);
    sfx.up = round.input.up;
    sfx.down = round.input.down;
    sfx.nitroMs = round.nitroMs;

    // A power-up's own sound while it runs: nitro first, then the hop, the
    // ghost and the magnet.
    if (burning) hum("drive:power", "driveNitro", Math.min(1, 0.7 + 0.3 * f), 0.8 + 0.5 * f);
    else if (air) hum("drive:power", "driveRocket", 0.8, 0.8 + 0.6 * hopHeight(round));
    else if (running(round, "ghost")) hum("drive:power", "haunt", 0.6, 1);
    else if (running(round, "magnet")) hum("drive:power", "driveMagnet", 0.8, 1);

    // The nearest car heard: louder the closer it is, pitched up as you close
    // on it and down once it is behind you (a Doppler), and a zoom as you
    // pass close by.
    const pz = round.pos + PLAYER_Z;
    let near = null;
    let nearBy = Infinity;
    for (const car of round.cars) {
      const d = car.z - pz;
      const dx = Math.abs(car.x - round.x);
      const was = sfx.sides.get(car);
      sfx.sides.set(car, d);
      if (d < -HEAR_BEHIND * SEG || d > HEAR_AHEAD * SEG) continue;
      if (was !== undefined && Math.abs(was) < 3 * SEG && Math.abs(d) < 3 * SEG && Math.sign(was) !== Math.sign(d) && dx < 1.3 && f > 0.35 && !air && sfx.t - sfx.zoomAt > 150) {
        sfx.zoomAt = sfx.t;
        tone("zoom", 0.35 + 0.45 * (1 - dx / 1.3), 0.9 + 0.3 * f);
      }
      const by = Math.abs(d) / SEG + dx * 4;
      if (by < nearBy) {
        nearBy = by;
        near = { car, d, dx };
      }
    }
    if (near) {
      const { car, d, dx } = near;
      const reach = d >= 0 ? HEAR_AHEAD : HEAR_BEHIND;
      const loud = (1 - Math.abs(d) / (reach * SEG)) ** 2 * (1 - Math.min(0.6, dx * 0.3));
      const closing = clamp(((round.speed - car.speed) / MAX_SPEED) * 2, -1, 1);
      const doppler = 1 + 0.18 * closing * Math.tanh(d / (2 * SEG));
      const pitch = (0.8 + (car.speed / MAX_SPEED) * 1.5) * doppler;
      hum("drive:traffic", car.kind === "truck" ? "driveTruck" : "driveTraffic", loud * ghostly, pitch);
    }
  };

  // Nothing held carries over a pause or a new round: a release may never arrive.
  const letGo = () => Object.keys(round.input).forEach((k) => (round.input[k] = false));

  const start = () => {
    colors = null;
    round = newRound();
    state = "running";
    resetFx();
    resetSfx();
    tone("driveIgnition", 0.8);
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    drain();
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
        // A power-up held goes first; nitro only with none.
        else if (state === "running") usePower(round) || boost(round);
        return true;
      }
      if (!MOVES[name]) return false;
      if (state === "running") round.input[name] = true;
      return true;
    },
    // A key let go: stop steering, braking or driving that way.
    release(name) {
      if (MOVES[name]) round.input[name] = false;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      advance(round, ms);
      drain();
      if (round.over) end();
      else soundscape(ms);
      paint();
    },
    resize(w, h) {
      const next = Math.floor(Math.min(w / W, h / H));
      if (!(next >= MIN_CELL)) return false;
      u = next;
      colors = null;
      const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
      canvas.width = Math.round(W * u * ratio);
      canvas.height = Math.round(H * u * ratio);
      if (canvas.style) {
        canvas.style.width = `${W * u}px`;
        canvas.style.height = `${H * u}px`;
      }
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
      return true;
    },
  };
}

export default Object.freeze({ id: "drive", title: "Sunset Drive", create });
