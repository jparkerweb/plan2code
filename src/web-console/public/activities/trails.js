// Plan2Code Web Console - Light Trails, the third activity: rules, rivals, drawing and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys and pauses it. A game never runs a timer or listens
// for a key of its own, so a paused game cannot move. The rules are plain
// functions over a round object (newRound, turn, boost, advance, choose),
// exported so the unit suite can drive them without a canvas; the default
// export is the contract every listed game answers.
//
// Every rider leaves a glowing wall behind it, and running into any wall is
// out. A round is a string of heats in arenas: the last rider still moving
// wins the heat and moves on to the next arena, and a crash costs one of five
// lives and runs the heat again (a life back every LIFE_SCORE points, and from
// a Heart pad). Each arena brings a rival more or something new (power-ups,
// crystals, portals, then walls that close in, and more kinds of pad), and the
// rivals get sharper as the levels go. Space spends a boost charge. The memo
// keeps the furthest arena ever reached, so the start and end screens can say
// what is still ahead.

import { drawPill, LIVES, livesText } from "./pills.js";

export const COLS = 40;
export const ROWS = 30;

// Below this many pixels a cell, the board is too small to play: resize()
// says so and the window shows its bigger-window note.
export const MIN_CELL = 10;

// The step at level 1, in ms; each level past it takes LEVEL_SPEEDUP off,
// never under MIN_STEP_MS. A boost and Slow-mo scale it again.
export const STEP_MS = 100;
const MIN_STEP_MS = 58;
const LEVEL_SPEEDUP = 0.045;
export const BOOST_PACE = 0.55;
const SLOW_PACE = 1.7;

export const MAX_LEVEL = 9;
export const START_LIVES = 5;
export const MAX_LIVES = 9;

// A life back for every LIFE_SCORE points scored, up to MAX_LIVES.
export const LIFE_SCORE = 750;

// A heat holds still for READY_MS so everyone can see where they are headed
// (the first one only briefly: the window has just counted 3, 2, 1), and
// shows how it went for DONE_MS before the next one.
export const READY_MS = 1200;
const FIRST_READY_MS = 300;
export const DONE_MS = 1800;

// A rider who crashes fades for FADE_MS, then its trail is gone, which opens
// the board up again for whoever is left.
export const FADE_MS = 700;

// When your next step would crash, you hold in place for GRACE_MS first: a
// turn pressed in that time rides out of it, and only then is it a crash.
// Rivals get no grace.
export const GRACE_MS = 150;

// Space spends a charge on BOOST_MS of speed. Every heat starts with
// START_CHARGES, and a Boost pad adds one, up to MAX_CHARGES.
export const BOOST_MS = 1400;
export const START_CHARGES = 2;
export const MAX_CHARGES = 3;

// Points, each times the level: one for every SURVIVE_STEPS cells ridden, a
// rival out while you still ride (more when it hit your own trail), and the
// heat itself.
export const SURVIVE_STEPS = 6;
export const OUT_POINTS = 10;
export const CUT_POINTS = 5;
export const WIN_POINTS = 25;
const COIN_POINTS = 5;

// Power-ups: the first FIRST_ITEM_MS into a heat, then every few seconds,
// each fading after ITEM_TTL_MS.
const FIRST_ITEM_MS = 3000;
const ITEM_MS = 5000;
const ITEM_SPREAD_MS = 3000;
const ITEM_TTL_MS = 9000;
const MAX_ITEMS = 2;
export const ERASE_REACH = 6;

// A Shield pops when your grace runs out, wiping the trails this close and
// riding on the first way clear (straight, then either side).
export const SHIELD_REACH = 3;

// A Laser fires at a rival head in your line, up to LASER_REACH cells ahead,
// through trails (which it cuts) but not crystals, walls or portals; it holds
// LASER_SHOTS shots for as long as it runs.
export const LASER_REACH = 16;
export const LASER_SHOTS = 3;

// Coin Rain drops this many coins round the board, over and above the pads.
export const RAIN_COINS = 7;

// The closing walls: the first ring SHRINK_FIRST_MS into a heat, then one
// every SHRINK_MS, each flashing for SHRINK_WARN_MS first. MAX_RING leaves
// room to play.
export const SHRINK_FIRST_MS = 10000;
const SHRINK_MS = 3500;
export const SHRINK_WARN_MS = 1200;
const MAX_RING = 9;

// Time is handed to the riders in slices this long, so a long frame never
// moves one rider several cells before the others move at all.
const SLICE_MS = 8;

// What a grid cell holds: 0 is open, a rider's trail is its id + 1.
export const BLOCK = -1;
export const WALL = -2;

const ITEMS_LEVEL = 2;
const BLOCKS_LEVEL = 3;
const PORTALS_LEVEL = 4;
const SHRINK_LEVEL = 5;
const TWO_PORTALS_LEVEL = 6;

const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

const GOLD = "#f5b301";

// The pads. A timed one lasts `ms`; the rest act at once. `weight` is how
// often each turns up against the others, and `from` the first arena it can.
// A Heart turns up only while you have room for another life.
export const POWERS = deepFreeze({
  boost: { name: "Boost", blurb: "One more boost charge", color: "#ff8a1f", weight: 3, from: 2 },
  phase: { name: "Phase", blurb: "Ride straight through trails", color: "#a466ff", ms: 3000, weight: 2, from: 2 },
  eraser: { name: "Eraser", blurb: "Wipes the trails around you", color: "#1fb6d9", weight: 2, from: 2 },
  slow: { name: "Slow-mo", blurb: "Your rivals crawl", color: "#57b54a", ms: 4000, weight: 2, from: 2 },
  coin: { name: "Coin", blurb: "", color: GOLD, weight: 3, from: 2 },
  life: { name: "Heart", blurb: "One more life", color: "#ff4fa3", weight: 2, from: 2 },
  shield: { name: "Shield", blurb: "Shrugs off your next crash", color: "#3d7bff", weight: 2, from: 2 },
  laser: { name: "Laser", blurb: "Zaps rivals in your line", color: "#ff2e4d", ms: 6000, weight: 2, from: 3 },
  double: { name: "Score x2", blurb: "Every point counts twice", color: "#ffd23f", ms: 8000, weight: 2, from: 3 },
  wide: { name: "Wide Trail", blurb: "Your wall rides three cells wide", color: "#18c7b0", ms: 4000, weight: 2, from: 4 },
  rain: { name: "Coin Rain", blurb: "Coins all over the grid", color: "#e6a800", weight: 1, from: 4 },
  jump: { name: "Hyperjump", blurb: "Warps you into open space", color: "#d06bff", weight: 1, from: 5 },
  mystery: { name: "Mystery", blurb: "Could be anything", color: "#9b7bff", weight: 1, from: 6 },
});

// Each arena: its rivals, how sharp they ride (0 to 1), and what it adds.
// Every level from a feature's own on keeps it.
export const ARENAS = deepFreeze({
  1: { title: "Neon Grid", sub: "Last rider moving wins", rivals: 1, smart: 0.25 },
  2: { title: "Sunset Strip", sub: "A second rival, and power-ups", rivals: 2, smart: 0.35 },
  3: { title: "Crystal Field", sub: "Crystals block the way", rivals: 2, smart: 0.45 },
  4: { title: "Warp Zone", sub: "In one portal, out the other", rivals: 3, smart: 0.5 },
  5: { title: "Storm Front", sub: "The walls close in", rivals: 3, smart: 0.6 },
  6: { title: "Carnival", sub: "Two pairs of portals", rivals: 3, smart: 0.68 },
  7: { title: "Glacier", sub: "Faster rivals, sharper turns", rivals: 3, smart: 0.76 },
  8: { title: "Volcano", sub: "Hot on your tail", rivals: 3, smart: 0.84 },
  9: { title: "Golden Arena", sub: "The final circuit", rivals: 3, smart: 0.92 },
});

export const arenaFor = (level) => ARENAS[Math.min(Math.max(1, level || 1), MAX_LEVEL)];

// The music: five recorded songs (trails-sfx.js), background music for the
// whole run rather than one a level. A run deals them in a fresh order and
// plays each in full, one after another, starting from the top of the first;
// once the last has played they are dealt again, never opening on the song
// that just ended, and a new run never opens on the song the last was playing.
export const MUSIC_TRACKS = Object.freeze(["trailsSong1", "trailsSong2", "trailsSong3", "trailsSong4", "trailsSong5"]);

// How loud the nearest rival's engine drone is at its closest, a share of the
// shared `cycle` hum's level: low, so the songs carry the run.
const RIVAL_HUM = 0.35;

// How much louder than made the game's sounds play (tones.js's `louder`),
// all but the engine drones, the hums in DRONES.
export const SFX_LOUDER = 1.4;
const DRONES = new Set(["trails:you", "trails:rival"]);

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

const LEVEL_COLORS = Object.freeze(["#1fb6d9", "#1fb6d9", "#ff8a1f", "#a466ff", "#4f7cff", "#7a7f99", "#ff4fa3", "#8fd3ff", "#e2553f", "#f5b301"]);
const levelColor = (level) => LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];

// The rivals, in the order they join.
export const RIVALS = deepFreeze({
  1: { name: "Zip", color: "#ff4fa3" },
  2: { name: "Bolt", color: "#f5b301" },
  3: { name: "Echo", color: "#2fbf71" },
});

const DIRS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});
const LEFT_OF = Object.freeze({ up: "left", left: "down", down: "right", right: "up" });
const RIGHT_OF = Object.freeze({ up: "right", right: "down", down: "left", left: "up" });
const BACK_OF = Object.freeze({ up: "down", down: "up", left: "right", right: "left" });

// More than two turns queued in one step is mashing, not steering.
const MAX_QUEUED = 2;

// Where everyone starts: you on the left, facing in, and the rivals spread
// round the other sides by how many there are.
const MID_Y = ROWS / 2;
export const PLAYER_SPAWN = Object.freeze({ x: 6, y: MID_Y, dir: "right" });
const RIVAL_SPAWNS = Object.freeze({
  1: [{ x: COLS - 7, y: MID_Y, dir: "left" }],
  2: [
    { x: COLS - 7, y: 7, dir: "left" },
    { x: COLS - 7, y: ROWS - 8, dir: "left" },
  ],
  3: [
    { x: COLS / 2, y: 3, dir: "down" },
    { x: COLS - 7, y: MID_Y, dir: "left" },
    { x: COLS / 2, y: ROWS - 4, dir: "up" },
  ],
});

// The portal pairs, fixed and mirrored so neither side of the board gets the
// better of them.
const PORTAL_PAIRS = Object.freeze([
  [{ x: 10, y: 6 }, { x: COLS - 11, y: ROWS - 7 }],
  [{ x: COLS - 11, y: 6 }, { x: 10, y: ROWS - 7 }],
]);

// The crystal shapes, as cells off their top-left corner.
const SHAPES = Object.freeze([
  [[0, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
]);

const at = (x, y) => y * COLS + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const pickOf = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

export const active = (round, kind) => Boolean(round.effects && round.effects[kind] > 0);

/* ---------------------------------------------------------------- rules */

// A rider's step in ms: quicker each level, quicker on a boost (you) and
// slower in Slow-mo (the rivals).
export function pace(round, rider) {
  let ms = Math.max(MIN_STEP_MS, STEP_MS * (1 - LEVEL_SPEEDUP * (round.level - 1)));
  if (rider.id === 0 && active(round, "boost")) ms *= BOOST_PACE;
  if (rider.id !== 0 && active(round, "slow")) ms *= SLOW_PACE;
  return ms;
}

function makeRider(id, spawn) {
  return { id, x: spawn.x, y: spawn.y, dir: spawn.dir, queue: [], alive: true, acc: 0, stall: null, prev: { x: spawn.x, y: spawn.y }, path: [{ x: spawn.x, y: spawn.y }], wide: [], fade: 0, by: null };
}

const portalAt = (round, x, y) => round.portals.find((p) => p.x === x && p.y === y) || null;

// The cells a crystal may never take: on or next to a spawn, or the lane
// straight ahead of one, so nobody starts a heat staring at a wall.
function clearOfSpawns(round, c) {
  for (const r of round.riders) {
    const d = DIRS[r.dir];
    if (near(c, r) <= 4) return false;
    for (let k = 1; k <= 10; k++) {
      const lx = r.x + d.x * k;
      const ly = r.y + d.y * k;
      if (Math.abs(c.x - lx) <= 1 && Math.abs(c.y - ly) <= 1) return false;
    }
  }
  return true;
}

function placeBlocks(round, random) {
  const pairs = Math.min(9, 4 + round.level - BLOCKS_LEVEL);
  for (let n = 0, tries = 0; n < pairs && tries < 300; tries++) {
    const shape = pickOf(SHAPES, random);
    const x = 3 + Math.floor(random() * (COLS - 8));
    const y = 3 + Math.floor(random() * (ROWS - 8));
    const cells = shape.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
    const all = [...cells, ...cells.map((c) => ({ x: COLS - 1 - c.x, y: ROWS - 1 - c.y }))];
    const ok = all.every((c) => c.x >= 2 && c.y >= 2 && c.x < COLS - 2 && c.y < ROWS - 2 && round.grid[at(c.x, c.y)] === 0 && !round.portals.some((p) => near(p, c) <= 2) && clearOfSpawns(round, c));
    if (!ok) continue;
    for (const c of all) {
      if (round.grid[at(c.x, c.y)] !== 0) continue;
      round.grid[at(c.x, c.y)] = BLOCK;
      round.blocks.push(c);
    }
    n++;
  }
}

// A fresh heat at the round's level: the riders on their spawns, the arena's
// crystals and portals, and nothing on the board yet.
export function newHeat(round, random = Math.random, readyMs = READY_MS) {
  const spec = arenaFor(round.level);
  round.grid = new Int8Array(COLS * ROWS);
  round.riders = [makeRider(0, PLAYER_SPAWN), ...RIVAL_SPAWNS[spec.rivals].map((s, i) => makeRider(i + 1, s))];
  for (const r of round.riders) round.grid[at(r.x, r.y)] = r.id + 1;
  round.portals = [];
  if (round.level >= PORTALS_LEVEL) {
    const pairs = round.level >= TWO_PORTALS_LEVEL ? PORTAL_PAIRS : PORTAL_PAIRS.slice(0, 1);
    pairs.forEach(([a, b], pair) => {
      round.portals.push({ x: a.x, y: a.y, to: b, pair }, { x: b.x, y: b.y, to: a, pair });
    });
  }
  round.blocks = [];
  if (round.level >= BLOCKS_LEVEL) placeBlocks(round, random);
  round.items = [];
  round.effects = {};
  round.shots = 0;
  round.charges = START_CHARGES;
  round.ring = 0;
  round.nextRing = SHRINK_FIRST_MS;
  round.nextItem = FIRST_ITEM_MS;
  round.phase = "ready";
  round.phaseMs = readyMs;
  round.clock = 0;
  round.steps = 0;
  round.result = null;
  return round;
}

export function newRound(random = Math.random) {
  // A Shield, once taken, is held until it saves you, from heat to heat.
  const round = { level: 1, lives: START_LIVES, score: 0, nextLifeAt: LIFE_SCORE, shield: false, heatsWon: 0, outs: 0, over: false, events: [] };
  return newHeat(round, random, FIRST_READY_MS);
}

// Queues a turn for you. A turn back the way you came, or the way you are
// already going (or held up on), is ignored, as is any past the second queued.
export function turn(round, name) {
  const you = round.riders[0];
  if (!DIRS[name] || !you.alive || round.phase === "done") return false;
  const last = you.queue.length ? you.queue[you.queue.length - 1] : you.dir;
  const facing = !you.queue.length && you.stall ? you.stall.dir : last;
  if (name === facing || name === BACK_OF[last] || you.queue.length >= MAX_QUEUED) return false;
  you.queue.push(name);
  return true;
}

// Spends a boost charge, when there is one and no boost is running.
export function boost(round) {
  if (round.phase !== "race" || !round.riders[0].alive || active(round, "boost") || round.charges <= 0) return false;
  round.charges -= 1;
  round.effects.boost = BOOST_MS;
  round.events.push({ type: "boost", x: round.riders[0].x, y: round.riders[0].y });
  return true;
}

/* -------------------------------------------------------------- rivals */

// Flood-fill scratch, shared by every call: `seen` marks a cell with the
// call's own stamp, so nothing needs clearing between calls.
const seen = new Int32Array(COLS * ROWS);
let stamp = 0;

// How many open cells can be reached from `start`, up to `cap`.
export function room(round, start, cap = COLS * ROWS) {
  if (round.grid[start] !== 0) return 0;
  stamp += 1;
  const stack = [start];
  seen[start] = stamp;
  let count = 0;
  while (stack.length && count < cap) {
    const i = stack.pop();
    count += 1;
    const x = i % COLS;
    const y = (i - x) / COLS;
    for (const d of Object.values(DIRS)) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (!inside(nx, ny)) continue;
      const j = at(nx, ny);
      if (seen[j] === stamp || round.grid[j] !== 0) continue;
      seen[j] = stamp;
      stack.push(j);
    }
  }
  return count;
}

// Where `name` takes a rider next, through a portal if one is there; null
// when that cell is a crash.
function ahead(round, r, name) {
  const d = DIRS[name];
  let x = r.x + d.x;
  let y = r.y + d.y;
  if (!inside(x, y)) return null;
  const p = portalAt(round, x, y);
  if (p) ({ x, y } = p.to);
  if (round.grid[at(x, y)] !== 0) return null;
  return { x, y, i: at(x, y) };
}

// A rival's next direction: straight, left or right, weighed by how much room
// each leaves, with a nudge toward cutting in ahead of you once it rides
// well. A sloppy rival looks less far, wobbles and now and then just guesses.
export function choose(round, r, random = Math.random) {
  const { smart } = arenaFor(round.level);
  const cap = Math.round(40 + smart * 360);
  const you = round.riders[0];
  const options = [r.dir, LEFT_OF[r.dir], RIGHT_OF[r.dir]].map((name) => {
    const to = ahead(round, r, name);
    return { name, to, space: to ? room(round, to.i, cap) : -1 };
  });
  const open = options.filter((o) => o.to);
  if (!open.length) return r.dir;
  if (random() < (1 - smart) * 0.05) return pickOf(open, random).name;
  const most = Math.max(...open.map((o) => o.space));
  let best = null;
  for (const o of open) {
    let v = o.space;
    if (o.name === r.dir) v += 2;
    // Head to head into the cell another rider is about to take is a gamble.
    for (const other of round.riders) {
      if (other === r || !other.alive) continue;
      const d = DIRS[other.dir];
      if (other.x + d.x === o.to.x && other.y + d.y === o.to.y) v -= 30;
    }
    if (you.alive && smart > 0.3 && o.space >= most * 0.85) {
      const d = DIRS[you.dir];
      const tx = Math.min(COLS - 1, Math.max(0, you.x + d.x * 4));
      const ty = Math.min(ROWS - 1, Math.max(0, you.y + d.y * 4));
      v -= near(o.to, { x: tx, y: ty }) * smart * 1.5;
    }
    v += random() * (1 - smart) * 12;
    if (!best || v > best.v) best = { name: o.name, v };
  }
  return best.name;
}

/* --------------------------------------------------------------- moving */

// Points scored, doubled while Score x2 runs; returns what was scored.
function gain(round, points) {
  const scored = active(round, "double") ? points * 2 : points;
  round.score += scored;
  return scored;
}

// A life back for every LIFE_SCORE points, up to MAX_LIVES: past the cap the
// mark still moves on, so a life is never saved up for later.
export function awardLives(round) {
  while (round.score >= round.nextLifeAt) {
    round.nextLifeAt += LIFE_SCORE;
    if (round.lives >= MAX_LIVES) continue;
    round.lives += 1;
    round.events.push({ type: "bonusLife", lives: round.lives, at: round.nextLifeAt - LIFE_SCORE });
  }
}

function crash(round, r, by) {
  r.alive = false;
  r.fade = FADE_MS;
  r.by = by;
  r.queue = [];
  r.stall = null;
  const you = round.riders[0];
  if (r.id === 0) {
    round.events.push({ type: "crash", x: r.x, y: r.y, by });
    return;
  }
  let points = 0;
  if (you.alive) {
    // Your trail or your laser: either way it was you, and pays the cut.
    points = gain(round, OUT_POINTS * round.level + (by === 0 || by === "laser" ? CUT_POINTS * round.level : 0));
    round.outs += 1;
  }
  round.events.push({ type: "out", id: r.id, x: r.x, y: r.y, by, points });
}

// Drops every trail cell that is no longer its rider's from that rider's
// path (and a Wide Trail's side cells), after an eraser, a closing wall, a
// laser or a faded crash.
function trimPaths(round) {
  for (const r of round.riders) {
    const mine = (c) => round.grid[at(c.x, c.y)] === r.id + 1;
    r.path = r.path.filter(mine);
    r.wide = r.wide.filter(mine);
  }
}

function erase(round, reach = ERASE_REACH) {
  const you = round.riders[0];
  let count = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = at(x, y);
      if (round.grid[i] <= 0) continue;
      if ((x - you.x) ** 2 + (y - you.y) ** 2 > reach ** 2) continue;
      if (round.riders.some((r) => r.alive && r.x === x && r.y === y)) continue;
      round.grid[i] = 0;
      count += 1;
    }
  }
  trimPaths(round);
  return count;
}

// A pad taken. A Mystery turns into another pad first, and says which.
export function applyPower(round, kind, random = Math.random) {
  const you = round.riders[0];
  const spec = POWERS[kind];
  if (kind === "mystery") {
    const pick = pickPower(round, random, true);
    round.events.push({ type: "mystery", kind: pick, x: you.x, y: you.y });
    return applyPower(round, pick, random);
  }
  let points = 0;
  if (spec.ms) round.effects[kind] = spec.ms;
  if (kind === "boost") round.charges = Math.min(MAX_CHARGES, round.charges + 1);
  else if (kind === "eraser") erase(round);
  else if (kind === "coin") points = gain(round, COIN_POINTS * round.level);
  else if (kind === "life") round.lives = Math.min(MAX_LIVES, round.lives + 1);
  else if (kind === "shield") round.shield = true;
  else if (kind === "laser") round.shots = LASER_SHOTS;
  else if (kind === "rain") {
    for (let n = 0; n < RAIN_COINS; n++) {
      const coin = spawnItem(round, "coin", random);
      if (coin) coin.rain = true;
    }
  }
  round.events.push({ type: "power", kind, x: you.x, y: you.y, points });
  if (kind === "jump") hyperjump(round, random);
  if (kind === "laser") fireLaser(round);
}

// The Laser's shot: a rival head straight ahead within LASER_REACH, with only
// open cells and trails between, is out, and the trails the beam crossed are
// cut. A crystal, a wall, a portal or the edge in the way and it holds fire.
export function fireLaser(round) {
  const you = round.riders[0];
  if (!you.alive || !active(round, "laser") || !(round.shots > 0)) return false;
  const d = DIRS[you.dir];
  const beam = [];
  for (let k = 1; k <= LASER_REACH; k++) {
    const x = you.x + d.x * k;
    const y = you.y + d.y * k;
    if (!inside(x, y)) return false;
    const target = round.riders.find((o) => o.id !== 0 && o.alive && o.x === x && o.y === y);
    if (target) {
      for (const c of beam) round.grid[at(c.x, c.y)] = 0;
      trimPaths(round);
      round.shots -= 1;
      if (round.shots <= 0) delete round.effects.laser;
      round.events.push({ type: "laser", id: target.id, from: { x: you.x, y: you.y }, to: { x, y } });
      crash(round, target, "laser");
      return true;
    }
    const cell = round.grid[at(x, y)];
    if (cell < 0 || portalAt(round, x, y)) return false;
    beam.push({ x, y });
  }
  return false;
}

// Hyperjump: you, gone from where you were and out in the open cell (of a
// good many tried) with the most room round it, facing the way with most room.
export function hyperjump(round, random = Math.random) {
  const you = round.riders[0];
  let best = null;
  for (let tries = 0; tries < 160; tries++) {
    const x = round.ring + 1 + Math.floor(random() * (COLS - 2 * round.ring - 2));
    const y = round.ring + 1 + Math.floor(random() * (ROWS - 2 * round.ring - 2));
    if (!inside(x, y) || round.grid[at(x, y)] !== 0 || portalAt(round, x, y)) continue;
    if (round.items.some((it) => it.x === x && it.y === y)) continue;
    if (round.riders.some((r) => r.alive && near(r, { x, y }) < 4)) continue;
    const space = room(round, at(x, y), 400);
    if (!best || space > best.space) best = { x, y, space };
  }
  if (!best) return false;
  let dir = you.dir;
  let most = -1;
  for (const [name, d] of Object.entries(DIRS)) {
    const nx = best.x + d.x;
    const ny = best.y + d.y;
    if (!inside(nx, ny) || round.grid[at(nx, ny)] !== 0) continue;
    const space = room(round, at(nx, ny), 200);
    if (space > most) [most, dir] = [space, name];
  }
  const from = { x: you.x, y: you.y };
  Object.assign(you, { x: best.x, y: best.y, prev: { x: best.x, y: best.y }, dir, queue: [], stall: null, acc: 0 });
  if (!active(round, "phase")) {
    round.grid[at(best.x, best.y)] = 1;
    you.path.push({ x: best.x, y: best.y });
  }
  round.events.push({ type: "jump", from, to: { x: best.x, y: best.y } });
  return true;
}

// Wide Trail: the cells either side of your head turn to your trail too,
// where they are open.
function widen(round, r) {
  const d = DIRS[r.dir];
  for (const side of [-1, 1]) {
    const x = r.x - d.y * side;
    const y = r.y + d.x * side;
    if (!inside(x, y) || round.grid[at(x, y)] !== 0 || portalAt(round, x, y)) continue;
    if (round.items.some((it) => it.x === x && it.y === y)) continue;
    if (round.riders.some((o) => o.alive && o.x === x && o.y === y)) continue;
    round.grid[at(x, y)] = r.id + 1;
    r.wide.push({ x, y });
  }
}

// Where `dir` takes rider r next, through a portal if one is there, and what
// it would crash into there (`by`, null when the cell is clear).
function landing(round, r, dir) {
  const d = DIRS[dir];
  let x = r.x + d.x;
  let y = r.y + d.y;
  if (!inside(x, y)) return { x, y, portal: null, by: "wall" };
  const portal = portalAt(round, x, y);
  if (portal) ({ x, y } = portal.to);
  const cell = round.grid[at(x, y)];
  const phased = r.id === 0 && active(round, "phase");
  if (cell !== 0 && !(phased && cell > 0)) return { x, y, portal, by: cell > 0 ? cell - 1 : cell === BLOCK ? "block" : "wall" };
  // Only a phased rider or a portal can bring one head onto another.
  const other = round.riders.find((o) => o !== r && o.alive && o.x === x && o.y === y);
  return { x, y, portal, by: other ? other.id : null };
}

function stepRider(round, r, random) {
  const was = r.dir;
  if (r.id === 0) {
    if (r.queue.length) r.dir = r.queue.shift();
  } else r.dir = choose(round, r, random);
  const to = landing(round, r, r.dir);
  if (to.by === null) return move(round, r, to, random);
  if (r.id !== 0) return crash(round, r, to.by);
  // You hold where you are, still heading the way you came, so a turn either
  // way is open; holdOn() rides out or crashes. The grace counts from the
  // step itself, which may have fallen partway through this slice.
  r.stall = { dir: r.dir, ms: GRACE_MS - r.acc };
  r.dir = was;
  r.prev = { x: r.x, y: r.y };
}

// Your grace, a slice at a time: the queued turn (or the way you were held
// up on) is tried again, so a turn or a trail fading clear rides out at once,
// and when GRACE_MS runs out it is a crash, unless a Shield pops first.
function holdOn(round, r, ms, random) {
  const dir = r.queue.length ? r.queue.shift() : r.stall.dir;
  const to = landing(round, r, dir);
  if (to.by === null) {
    r.stall = null;
    r.dir = dir;
    r.acc = 0;
    return move(round, r, to, random);
  }
  r.stall.dir = dir;
  r.stall.ms -= ms;
  if (r.stall.ms > 0) return;
  if (round.shield && shieldSave(round, r, dir, random)) return;
  r.dir = dir;
  crash(round, r, to.by);
}

// The Shield's save: it pops, the trails within SHIELD_REACH go, and you ride
// on the first way now clear (the way you were going, then either side). A
// wall or the edge all round still holds, and that is a crash after all.
function shieldSave(round, r, dir, random) {
  round.shield = false;
  erase(round, SHIELD_REACH);
  round.events.push({ type: "shield", x: r.x, y: r.y });
  for (const name of [dir, LEFT_OF[dir], RIGHT_OF[dir]]) {
    if (name === BACK_OF[r.dir]) continue;
    const to = landing(round, r, name);
    if (to.by !== null) continue;
    r.stall = null;
    r.dir = name;
    r.acc = 0;
    move(round, r, to, random);
    return true;
  }
  return false;
}

function move(round, r, to, random = Math.random) {
  const { x, y, portal } = to;
  r.prev = { x: r.x, y: r.y };
  if (portal) {
    round.events.push({ type: "portal", id: r.id, from: { x: portal.x, y: portal.y }, to: { ...portal.to } });
    // Out the far side at once: no sliding across the whole board.
    r.prev = { x, y };
  }
  const i = at(x, y);
  r.x = x;
  r.y = y;
  if (!(r.id === 0 && active(round, "phase"))) {
    round.grid[i] = r.id + 1;
    r.path.push({ x, y });
    if (r.id === 0 && active(round, "wide")) widen(round, r);
  }
  const item = round.items.findIndex((it) => it.x === x && it.y === y);
  if (item >= 0) {
    const [it] = round.items.splice(item, 1);
    if (r.id === 0) applyPower(round, it.kind, random);
    else round.events.push({ type: "snatch", id: r.id, x, y });
  }
  if (r.id === 0) {
    round.steps += 1;
    if (round.steps % SURVIVE_STEPS === 0) gain(round, round.level);
    fireLaser(round);
  }
}

/* ---------------------------------------------------------- the arena */

export function spawnItem(round, kind, random = Math.random) {
  for (let tries = 0; tries < 60; tries++) {
    const x = round.ring + 1 + Math.floor(random() * (COLS - 2 * round.ring - 2));
    const y = round.ring + 1 + Math.floor(random() * (ROWS - 2 * round.ring - 2));
    if (!inside(x, y) || round.grid[at(x, y)] !== 0 || portalAt(round, x, y)) continue;
    if (round.items.some((it) => it.x === x && it.y === y)) continue;
    if (round.riders.some((r) => r.alive && near(r, { x, y }) < 3)) continue;
    const item = { x, y, kind, ttl: ITEM_TTL_MS };
    round.items.push(item);
    return item;
  }
  return null;
}

// A pad for the arena: any whose `from` it has reached, a Heart only while
// there is room for a life, and for a Mystery to become, anything but another.
export function pickPower(round, random = Math.random, mystery = false) {
  const kinds = Object.keys(POWERS).filter((k) => round.level >= POWERS[k].from && (k !== "life" || round.lives < MAX_LIVES) && !(mystery && k === "mystery"));
  const total = kinds.reduce((sum, k) => sum + POWERS[k].weight, 0);
  let roll = random() * total;
  for (const k of kinds) {
    roll -= POWERS[k].weight;
    if (roll < 0) return k;
  }
  return kinds[kinds.length - 1];
}

const onRing = (x, y, k) => (x === k || y === k || x === COLS - 1 - k || y === ROWS - 1 - k) && x >= k && y >= k && x <= COLS - 1 - k && y <= ROWS - 1 - k;

// The next ring in from the edge turns to wall: whatever is on it goes, and a
// rider caught on it is out.
export function closeRing(round) {
  const k = round.ring;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) if (onRing(x, y, k)) round.grid[at(x, y)] = WALL;
  }
  round.items = round.items.filter((it) => !onRing(it.x, it.y, k));
  round.blocks = round.blocks.filter((b) => !onRing(b.x, b.y, k));
  const gone = new Set(round.portals.filter((p) => onRing(p.x, p.y, k)).map((p) => p.pair));
  round.portals = round.portals.filter((p) => !gone.has(p.pair));
  round.ring += 1;
  round.events.push({ type: "squeeze", ring: round.ring });
  for (const r of round.riders) if (r.alive && onRing(r.x, r.y, k)) crash(round, r, "wall");
  trimPaths(round);
}

function fadeRiders(round, ms) {
  for (const r of round.riders) {
    if (r.alive || r.fade <= 0) continue;
    r.fade -= ms;
    if (r.fade > 0) continue;
    r.fade = 0;
    for (let i = 0; i < round.grid.length; i++) if (round.grid[i] === r.id + 1) round.grid[i] = 0;
    r.path = [];
    r.wide = [];
  }
}

function endHeat(round, result) {
  round.phase = "done";
  round.phaseMs = DONE_MS;
  round.result = result;
  if (result === "win") {
    const points = gain(round, WIN_POINTS * round.level);
    round.heatsWon += 1;
    round.events.push({ type: "win", points, level: round.level });
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
  const champion = won && round.level === MAX_LEVEL;
  if (won) round.level = Math.min(MAX_LEVEL, round.level + 1);
  newHeat(round, random);
  if (champion) round.events.push({ type: "champion" });
  else if (won) round.events.push({ type: "level", level: round.level });
  else round.events.push({ type: "retry", lives: round.lives });
}

function race(round, ms, random) {
  round.clock += ms;
  for (const kind of Object.keys(round.effects)) {
    round.effects[kind] -= ms;
    if (round.effects[kind] <= 0) delete round.effects[kind];
  }
  fadeRiders(round, ms);
  round.items = round.items.filter((it) => (it.ttl -= ms) > 0);
  if (round.level >= ITEMS_LEVEL) {
    round.nextItem -= ms;
    if (round.nextItem <= 0) {
      round.nextItem = ITEM_MS + random() * ITEM_SPREAD_MS;
      // Coin Rain's coins come on top: they never hold back a pad.
      if (round.items.filter((it) => !it.rain).length < MAX_ITEMS) spawnItem(round, pickPower(round, random), random);
    }
  }
  if (round.level >= SHRINK_LEVEL && round.ring < MAX_RING) {
    const was = round.nextRing;
    round.nextRing -= ms;
    if (was > SHRINK_WARN_MS && round.nextRing <= SHRINK_WARN_MS) round.events.push({ type: "warn" });
    if (round.nextRing <= 0) {
      closeRing(round);
      round.nextRing = SHRINK_MS;
    }
  }
  for (const r of round.riders) {
    if (!r.alive) continue;
    if (r.stall) {
      holdOn(round, r, ms, random);
      continue;
    }
    r.acc += ms;
    const step = pace(round, r);
    if (r.acc < step) continue;
    r.acc -= step;
    stepRider(round, r, random);
  }
  const you = round.riders[0];
  const left = round.riders.slice(1).filter((r) => r.alive).length;
  // You and the last rival out together is a draw: nobody loses a life. While
  // you are held up on a crash the win waits, so a crash in your grace still
  // counts as together.
  if (!you.alive) endHeat(round, left ? "lose" : "draw");
  else if (!left && !you.stall) endHeat(round, "win");
}

// Moves the round on by `ms`: the hold before a heat, the race, and the
// pause after it, in small slices.
export function advance(round, ms, random = Math.random) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    if (round.phase === "ready") {
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) {
        round.phase = "race";
        round.events.push({ type: "go" });
      }
    } else if (round.phase === "done") {
      round.phaseMs -= slice;
      fadeRiders(round, slice);
      if (round.phaseMs <= 0) nextHeat(round, random);
    } else race(round, slice, random);
    awardLives(round);
  }
  return round.over ? "over" : round.phase;
}

/* -------------------------------------------------------------- drawing */

const FALLBACK_COLORS = Object.freeze({ board: "#ffffff", line: "#e4ddd1", you: "#206cc3", head: "#1d1a17" });

// The page's tokens, read again at each round and each resize, so the board
// follows a theme or highlight change made while the game sat paused. A stub
// canvas in Node has no computed style, so every color falls back.
function readColors(canvas) {
  let style = null;
  try {
    style = typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
  } catch {}
  const pick = (name, fallback) => (style && style.getPropertyValue(name).trim()) || fallback;
  return {
    board: pick("--panel", FALLBACK_COLORS.board),
    line: pick("--rule", FALLBACK_COLORS.line),
    you: pick("--accent", FALLBACK_COLORS.you),
    head: pick("--ink", FALLBACK_COLORS.head),
  };
}

const SHADE = "rgba(0, 0, 0, 0.55)";
const CRYSTAL = "#8a5ae0";
const CRYSTAL_LIGHT = "#d9c6ff";
const STONE = "#5a534c";
const STONE_LIGHT = "#857b70";
const DANGER = "#e2553f";
const PORTAL_COLORS = Object.freeze([["#1fb6d9", "#a466ff"], ["#ff8a1f", "#ffd84a"]]);

// Each arena's scenery over the page's own board: a light tint and a scatter
// of small marks, faint enough that no trail is ever harder to see.
const THEMES = deepFreeze({
  1: { tint: null },
  2: { tint: "#ff8a1f", mark: "dot", ink: "#e07020" },
  3: { tint: "#a466ff", mark: "sparkle", ink: "#8a5ae0" },
  4: { tint: "#1fb6d9", mark: "wave", ink: "#1b8fb0" },
  5: { tint: "#2c2f7a", mark: "rain", ink: "#8fa8ff", alpha: 0.2 },
  6: { tint: "#ff4fa3", mark: "confetti", ink: "#ff4fa3" },
  7: { tint: "#8fd3ff", mark: "frost", ink: "#4fa8e0", alpha: 0.2 },
  8: { tint: "#e2553f", mark: "ember", ink: "#ff7a2f" },
  9: { tint: "#f5b301", mark: "sparkle", ink: "#e0a000" },
});
const THEME_MARKS = 26;
const CONFETTI = Object.freeze(["#ff4fa3", "#1fb6d9", "#f5b301", "#57b54a", "#a466ff"]);

function drawTheme(ctx, round, cell, clock) {
  const theme = THEMES[Math.min(Math.max(1, round.level), MAX_LEVEL)];
  if (!theme.tint) return;
  const w = COLS * cell;
  const h = ROWS * cell;
  ctx.globalAlpha = theme.alpha || 0.12;
  ctx.fillStyle = theme.tint;
  ctx.fillRect(0, 0, w, h);
  // The marks sit in the same places every time an arena is drawn.
  let seed = Math.imul(round.level + 7, 2654435761) >>> 0;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  ctx.strokeStyle = theme.ink;
  ctx.fillStyle = theme.ink;
  ctx.lineWidth = Math.max(1, cell * 0.08);
  ctx.lineCap = "round";
  for (let i = 0; i < THEME_MARKS; i++) {
    const x = next() * w;
    let y = next() * h;
    const phase = next() * 6.28;
    const s = cell * 0.3;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    if (theme.mark === "dot") {
      ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
      ctx.arc(x + s * 1.4, y + s * 0.6, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme.mark === "sparkle") {
      ctx.globalAlpha = 0.2 + 0.5 * Math.abs(Math.sin(clock / 500 + phase));
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s);
      ctx.lineTo(x, y + s);
      ctx.stroke();
    } else if (theme.mark === "wave") {
      const dx = Math.sin(clock / 700 + phase) * s * 0.6;
      ctx.moveTo(x - s * 1.6 + dx, y);
      ctx.quadraticCurveTo(x - s * 0.8 + dx, y - s, x + dx, y);
      ctx.quadraticCurveTo(x + s * 0.8 + dx, y + s, x + s * 1.6 + dx, y);
      ctx.stroke();
    } else if (theme.mark === "rain") {
      // Rain falls and starts again at the top.
      y = (y + (clock / 6) * (0.6 + phase / 10)) % h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - s * 0.4, y + s * 1.4);
      ctx.stroke();
    } else if (theme.mark === "confetti") {
      ctx.fillStyle = CONFETTI[i % CONFETTI.length];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(phase + clock / 900);
      ctx.fillRect(-s * 0.6, -s * 0.25, s * 1.2, s * 0.5);
      ctx.restore();
    } else if (theme.mark === "frost") {
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
        ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
      ctx.stroke();
    } else if (theme.mark === "ember") {
      // Embers drift up and start again at the bottom.
      y = (((y - (clock / 40) * (0.5 + phase / 12)) % h) + h) % h;
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(clock / 300 + phase));
      ctx.arc(x, y, s * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Text with a dark edge, so it reads on any board in either theme.
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

function star(ctx, x, y, outer, inner, spin) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = spin - Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? inner : outer;
    if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// A pad's picture, white, centered on x, y and about 2s across.
function glyph(ctx, kind, x, y, s) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, s * 0.22);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "boost") {
    ctx.moveTo(x + s * 0.2, y - s * 0.9);
    ctx.lineTo(x - s * 0.5, y + s * 0.1);
    ctx.lineTo(x - s * 0.05, y + s * 0.1);
    ctx.lineTo(x - s * 0.2, y + s * 0.9);
    ctx.lineTo(x + s * 0.5, y - s * 0.15);
    ctx.lineTo(x + s * 0.05, y - s * 0.15);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "phase") {
    ctx.arc(x, y - s * 0.1, s * 0.6, Math.PI, 0);
    ctx.lineTo(x + s * 0.6, y + s * 0.75);
    ctx.lineTo(x + s * 0.3, y + s * 0.5);
    ctx.lineTo(x, y + s * 0.75);
    ctx.lineTo(x - s * 0.3, y + s * 0.5);
    ctx.lineTo(x - s * 0.6, y + s * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "eraser") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.strokeRect(-s * 0.75, -s * 0.38, s * 1.5, s * 0.76);
    ctx.fillRect(-s * 0.75, -s * 0.38, s * 0.6, s * 0.76);
    ctx.restore();
  } else if (kind === "slow") {
    ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - s * 0.45);
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.35, y);
    ctx.stroke();
  } else if (kind === "life") {
    heartPath(ctx, x, y, s);
    ctx.fill();
  } else if (kind === "shield") {
    ctx.moveTo(x, y - s * 0.85);
    ctx.lineTo(x + s * 0.7, y - s * 0.55);
    ctx.quadraticCurveTo(x + s * 0.65, y + s * 0.45, x, y + s * 0.9);
    ctx.quadraticCurveTo(x - s * 0.65, y + s * 0.45, x - s * 0.7, y - s * 0.55);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.45);
    ctx.lineTo(x, y + s * 0.5);
    ctx.stroke();
  } else if (kind === "laser") {
    ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(x + dx * s * 0.3, y + dy * s * 0.3);
      ctx.lineTo(x + dx * s * 0.95, y + dy * s * 0.95);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "double" || kind === "mystery") {
    // Dark on the bright yellow pad, white on the rest.
    ctx.fillStyle = kind === "double" ? "#1d1a17" : "#ffffff";
    ctx.font = `900 ${Math.round(s * (kind === "double" ? 1.25 : 1.7))}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(kind === "double" ? "x2" : "?", x, y + s * 0.08);
  } else if (kind === "wide") {
    for (const dx of [-0.55, 0, 0.55]) {
      ctx.moveTo(x + dx * s, y - s * 0.75);
      ctx.lineTo(x + dx * s, y + s * 0.75);
    }
    ctx.stroke();
  } else if (kind === "rain") {
    for (const [dx, dy] of [[-0.45, -0.35], [0.45, -0.35], [0, 0.4]]) {
      ctx.moveTo(x + dx * s + s * 0.32, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, s * 0.32, 0, Math.PI * 2);
    }
    ctx.fill();
  } else if (kind === "jump") {
    // A spiral into an arrow: in here, out somewhere else.
    ctx.arc(x - s * 0.1, y + s * 0.1, s * 0.55, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.25, y - s * 0.35);
    ctx.lineTo(x + s * 0.9, y - s * 0.9);
    ctx.moveTo(x + s * 0.4, y - s * 0.9);
    ctx.lineTo(x + s * 0.9, y - s * 0.9);
    ctx.lineTo(x + s * 0.9, y - s * 0.4);
    ctx.stroke();
  }
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 1.1, y, x - s * 0.6, y - s * 0.9, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.9, x + s * 1.1, y, x, y + s * 0.8);
}

// A Mystery pad's color, cycling through the rainbow.
const mysteryColor = (clock) => `hsl(${Math.round(clock / 6) % 360}, 85%, 58%)`;

function drawBoard(ctx, round, cell, colors, clock) {
  const w = COLS * cell;
  const h = ROWS * cell;
  ctx.fillStyle = colors.board;
  ctx.fillRect(-cell, -cell, w + cell * 2, h + cell * 2);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = colors.line;
  for (let y = 0; y < ROWS; y++) {
    for (let x = (y + 1) % 2; x < COLS; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);
  }
  ctx.globalAlpha = 1;
  drawTheme(ctx, round, cell, clock);
  ctx.strokeStyle = levelColor(round.level);
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
}

// The closed rings as stone, and the next one flashing its warning.
function drawWalls(ctx, round, cell, clock) {
  const w = COLS * cell;
  const h = ROWS * cell;
  const band = (k, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(k * cell, k * cell, w - 2 * k * cell, cell);
    ctx.fillRect(k * cell, h - (k + 1) * cell, w - 2 * k * cell, cell);
    ctx.fillRect(k * cell, (k + 1) * cell, cell, h - 2 * (k + 1) * cell);
    ctx.fillRect(w - (k + 1) * cell, (k + 1) * cell, cell, h - 2 * (k + 1) * cell);
  };
  for (let k = 0; k < round.ring; k++) band(k, k % 2 ? STONE_LIGHT : STONE);
  if (round.level >= SHRINK_LEVEL && round.phase === "race" && round.ring < MAX_RING && round.nextRing <= SHRINK_WARN_MS) {
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(clock / 90));
    band(round.ring, DANGER);
    ctx.globalAlpha = 1;
  }
}

function drawBlocks(ctx, round, cell) {
  for (const b of round.blocks) {
    const x = b.x * cell;
    const y = b.y * cell;
    ctx.fillStyle = CRYSTAL;
    roundRect(ctx, x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.18);
    ctx.fill();
    ctx.fillStyle = CRYSTAL_LIGHT;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + cell * 0.2, y + cell * 0.2);
    ctx.lineTo(x + cell * 0.62, y + cell * 0.2);
    ctx.lineTo(x + cell * 0.2, y + cell * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPortals(ctx, round, cell, clock) {
  for (const p of round.portals) {
    const x = (p.x + 0.5) * cell;
    const y = (p.y + 0.5) * cell;
    const [a, b] = PORTAL_COLORS[p.pair % PORTAL_COLORS.length];
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k % 2 ? b : a;
      ctx.lineWidth = Math.max(2, cell * 0.12);
      const turn = (clock / (220 - k * 50)) * (k % 2 ? -1 : 1);
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.22 + 0.16 * k), turn, turn + Math.PI * 1.4);
      ctx.stroke();
    }
  }
}

function drawItems(ctx, round, cell, clock) {
  for (const item of round.items) {
    if (item.ttl < 2000 && Math.floor(clock / 120) % 2 === 0) continue;
    const x = (item.x + 0.5) * cell;
    const y = (item.y + 0.5) * cell;
    if (item.kind === "coin") {
      const w = Math.max(0.15, Math.abs(Math.cos(clock / 160 + item.x)));
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, cell * 0.42 * w, cell * 0.42, 0, 0, Math.PI * 2);
      else ctx.arc(x, y, cell * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff3b0";
      ctx.fillRect(x - cell * 0.05 * w, y - cell * 0.22, cell * 0.1 * w, cell * 0.44);
      continue;
    }
    if (item.kind === "life") {
      // A Heart is just a heart, beating: lub-dub, then a rest.
      const t = (clock % 900) / 900;
      const beat = 1 + 0.16 * Math.max(0, Math.sin(t * Math.PI * 4)) * (t < 0.5 ? 1 : 0);
      const s = cell * 0.62 * beat;
      ctx.shadowColor = POWERS.life.color;
      ctx.shadowBlur = cell * 1.1;
      ctx.fillStyle = POWERS.life.color;
      heartPath(ctx, x, y + cell * 0.05, s);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffd1e6";
      ctx.beginPath();
      ctx.arc(x - s * 0.38, y - s * 0.18, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const color = item.kind === "mystery" ? mysteryColor(clock + item.x * 40) : POWERS[item.kind].color;
    const s = cell * 0.62 * (1 + 0.1 * Math.sin(clock / 120 + item.x));
    ctx.shadowColor = color;
    ctx.shadowBlur = cell * 0.8;
    ctx.fillStyle = color;
    roundRect(ctx, x - s, y - s, s * 2, s * 2, s * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;
    glyph(ctx, item.kind, x, y, s * 0.72);
  }
}

const riderColor = (r, colors) => (r.id === 0 ? colors.you : RIVALS[r.id].color);

// Where a rider's head is drawn: partway from its last cell to this one.
function headPoint(round, r, cell, state) {
  const t = state === "running" && round.phase === "race" && r.alive ? Math.min(1, r.acc / pace(round, r)) : 1;
  return { x: (r.prev.x + (r.x - r.prev.x) * t + 0.5) * cell, y: (r.prev.y + (r.y - r.prev.y) * t + 0.5) * cell };
}

// A trail as one stroke: joined where cells touch, broken where a portal, an
// eraser or a phase left a gap, and run on to the head.
function tracePath(ctx, r, cell, head) {
  const pts = r.path;
  ctx.beginPath();
  for (let k = 0; k < pts.length; k++) {
    const c = pts[k];
    // The last cell is the head's, drawn by the leg to the head below.
    if (head && k === pts.length - 1 && c.x === r.x && c.y === r.y) break;
    const px = (c.x + 0.5) * cell;
    const py = (c.y + 0.5) * cell;
    if (k === 0 || near(pts[k - 1], c) !== 1) {
      ctx.moveTo(px, py);
      ctx.lineTo(px + 0.01, py);
    } else ctx.lineTo(px, py);
  }
  if (head && pts.length > 1) {
    const last = pts[pts.length - 1];
    const before = last.x === r.x && last.y === r.y ? pts[pts.length - 2] : last;
    if (near(before, r.prev) === 0) ctx.lineTo(head.x, head.y);
  }
}

function drawTrail(ctx, round, r, cell, colors, clock, head) {
  if (!r.path.length && !head && !r.wide.length) return;
  const color = riderColor(r, colors);
  let alpha = 1;
  if (!r.alive) {
    alpha = Math.max(0, r.fade / FADE_MS);
    if (Math.floor(clock / 60) % 2) alpha *= 0.5;
  }
  ctx.globalAlpha = alpha;
  // A Wide Trail's side cells: glowing blocks either side of the line.
  if (r.wide.length) {
    ctx.shadowColor = color;
    ctx.shadowBlur = cell * 0.5;
    ctx.fillStyle = color;
    for (const c of r.wide) {
      roundRect(ctx, c.x * cell + cell * 0.16, c.y * cell + cell * 0.16, cell * 0.68, cell * 0.68, cell * 0.2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = cell * 0.7;
  ctx.strokeStyle = color;
  ctx.lineWidth = cell * 0.5;
  tracePath(ctx, r, cell, head);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // A bright core down the middle, for the light in Light Trails.
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, cell * 0.14);
  tracePath(ctx, r, cell, head);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawHead(ctx, round, r, cell, colors, clock, h, state) {
  const color = riderColor(r, colors);
  const d = DIRS[r.dir];
  ctx.globalAlpha = r.alive ? (r.id === 0 && active(round, "phase") ? 0.6 : 1) : Math.max(0, r.fade / FADE_MS);
  // A boost burns behind you.
  if (r.id === 0 && r.alive && active(round, "boost")) {
    const flick = 0.75 + 0.25 * Math.sin(clock / 30);
    ctx.fillStyle = POWERS.boost.color;
    ctx.beginPath();
    ctx.moveTo(h.x - d.x * cell * 0.3 - d.y * cell * 0.3, h.y - d.y * cell * 0.3 - d.x * cell * 0.3);
    ctx.lineTo(h.x - d.x * cell * 1.3 * flick, h.y - d.y * cell * 1.3 * flick);
    ctx.lineTo(h.x - d.x * cell * 0.3 + d.y * cell * 0.3, h.y - d.y * cell * 0.3 + d.x * cell * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = r.id === 0 ? colors.head : color;
  ctx.beginPath();
  ctx.arc(h.x, h.y, cell * 0.58, 0, Math.PI * 2);
  ctx.fill();
  if (r.id === 0) {
    // Planny's star eye, looking the way you ride, in the board's color so it
    // shows on the head in either theme; a ring of your color round it.
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.stroke();
    ctx.fillStyle = colors.board;
    star(ctx, h.x + d.x * cell * 0.1, h.y + d.y * cell * 0.1, cell * 0.32, cell * 0.14, r.alive ? 0 : Math.PI / 5);
    ctx.fill();
  } else {
    const px = -d.y;
    const py = d.x;
    for (const side of [-1, 1]) {
      const ex = h.x + d.x * cell * 0.16 + px * side * cell * 0.24;
      const ey = h.y + d.y * cell * 0.16 + py * side * cell * 0.24;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 0.15, 0, Math.PI * 2);
      ctx.fill();
      if (!r.alive) {
        ctx.strokeStyle = "#1d1a17";
        ctx.lineWidth = Math.max(1, cell * 0.06);
        ctx.beginPath();
        ctx.moveTo(ex - cell * 0.08, ey - cell * 0.08);
        ctx.lineTo(ex + cell * 0.08, ey + cell * 0.08);
        ctx.moveTo(ex + cell * 0.08, ey - cell * 0.08);
        ctx.lineTo(ex - cell * 0.08, ey + cell * 0.08);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#1d1a17";
        ctx.beginPath();
        ctx.arc(ex + d.x * cell * 0.05, ey + d.y * cell * 0.05, cell * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // A held Shield: a hexagon of light turning round your head.
  if (r.id === 0 && r.alive && round.shield) {
    ctx.strokeStyle = POWERS.shield.color;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(clock / 160);
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const a = clock / 700 + (k * Math.PI) / 3;
      const px = h.x + Math.cos(a) * cell * 1.05;
      const py = h.y + Math.sin(a) * cell * 1.05;
      if (k) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // A running Laser: a dotted sight line out ahead of you.
  if (r.id === 0 && r.alive && active(round, "laser") && round.phase === "race") {
    ctx.strokeStyle = POWERS.laser.color;
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(clock / 80);
    ctx.lineWidth = Math.max(1, cell * 0.08);
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([cell * 0.2, cell * 0.35]);
    ctx.beginPath();
    ctx.moveTo(h.x + d.x * cell * 0.7, h.y + d.y * cell * 0.7);
    ctx.lineTo(h.x + d.x * cell * LASER_REACH, h.y + d.y * cell * LASER_REACH);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  // Score x2: gold sparks wheeling round you.
  if (r.id === 0 && r.alive && active(round, "double")) {
    ctx.fillStyle = POWERS.double.color;
    for (let k = 0; k < 3; k++) {
      const a = clock / 260 + (k * Math.PI * 2) / 3;
      star(ctx, h.x + Math.cos(a) * cell * 0.95, h.y + Math.sin(a) * cell * 0.95, cell * 0.2, cell * 0.08, a);
      ctx.fill();
    }
  }
  if (r.id === 0 && r.alive && active(round, "phase")) {
    ctx.strokeStyle = POWERS.phase.color;
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(clock / 90);
    ctx.lineWidth = Math.max(2, cell * 0.1);
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([cell * 0.3, cell * 0.2]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, cell * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  // Before a heat: each rider's name, and a pulsing arrow the way it will go.
  if (round.phase === "ready" && r.alive && (state === "running" || state === "paused")) {
    label(ctx, r.id === 0 ? "YOU" : RIVALS[r.id].name.toUpperCase(), h.x, h.y - cell * 1.25, cell * 0.62, r.id === 0 ? "#ffffff" : color);
    const dir = r.id === 0 && r.queue.length ? DIRS[r.queue[r.queue.length - 1]] : d;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(clock / 120));
    ctx.lineWidth = Math.max(2, cell * 0.14);
    for (let k = 1; k <= 2; k++) {
      const ax = h.x + dir.x * cell * (0.7 + k * 0.55);
      const ay = h.y + dir.y * cell * (0.7 + k * 0.55);
      ctx.beginPath();
      ctx.moveTo(ax - dir.x * cell * 0.25 - dir.y * cell * 0.25, ay - dir.y * cell * 0.25 - dir.x * cell * 0.25);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax - dir.x * cell * 0.25 + dir.y * cell * 0.25, ay - dir.y * cell * 0.25 + dir.x * cell * 0.25);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// The Laser's shots: a hot white core in a red glow, fading fast.
function drawBeams(ctx, beams, cell) {
  for (const b of beams) {
    const t = b.life / b.max;
    const ax = (b.from.x + 0.5) * cell;
    const ay = (b.from.y + 0.5) * cell;
    const bx = (b.to.x + 0.5) * cell;
    const by = (b.to.y + 0.5) * cell;
    ctx.lineCap = "round";
    ctx.globalAlpha = t;
    ctx.shadowColor = POWERS.laser.color;
    ctx.shadowBlur = cell * 1.2;
    ctx.strokeStyle = POWERS.laser.color;
    ctx.lineWidth = cell * 0.55 * t + 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, cell * 0.16 * t);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${Math.round(h * 0.62)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = h * 0.7 + text.length * h * 0.42;
  drawPill(ctx, x, y, w, h, text, color, fill, y + h / 2 + 1);
  return w;
}

const EFFECT_LABELS = Object.freeze({ phase: "PHASE", slow: "SLOW-MO", laser: "LASER", double: "x2 SCORE", wide: "WIDE" });

// The level, lives, boost charges, rivals left, a held Shield and each
// running effect (a Laser with its shots left), small along the top.
function drawHud(ctx, round, cell) {
  const h = Math.max(14, cell * 0.78);
  let x = cell * 0.35;
  const y = cell * 0.3;
  x += pill(ctx, x, y, h, `LV ${round.level}`, levelColor(round.level)) + 6;
  x += pill(ctx, x, y, h, livesText(round.infinite ? Infinity : round.lives), LIVES) + 6;
  const charges = "●".repeat(round.charges) + "○".repeat(Math.max(0, MAX_CHARGES - round.charges));
  x += pill(ctx, x, y, h, `BOOST ${charges}`, POWERS.boost.color, active(round, "boost") ? round.effects.boost / BOOST_MS : 1) + 6;
  const left = round.riders.slice(1).filter((r) => r.alive).length;
  x += pill(ctx, x, y, h, left === 1 ? "1 RIVAL" : `${left} RIVALS`, "#ffffff") + 6;
  if (round.shield) x += pill(ctx, x, y, h, "SHIELD", POWERS.shield.color) + 6;
  for (const [kind, ms] of Object.entries(round.effects)) {
    if (!EFFECT_LABELS[kind]) continue;
    const text = kind === "laser" ? `LASER ${"●".repeat(Math.max(0, round.shots))}` : EFFECT_LABELS[kind];
    x += pill(ctx, x, y, h, text, POWERS[kind].color, ms / POWERS[kind].ms) + 6;
  }
}

// A banner is a light strip BANNER_ROWS cells tall, on the half of the board
// away from you, fading almost clear while you ride under it.
const BANNER_ROWS = 3.4;
const BANNER_SEE_THROUGH = 0.12;
const BANNER_FADE_MS = 140;
const BANNER_SHADE = "rgba(0, 0, 0, 0.3)";

const bannerRow = (round) => (round.riders[0].y < ROWS / 2 ? ROWS * 0.74 : ROWS * 0.3);

function underBanner(round, row) {
  const you = round.riders[0];
  const d = DIRS[you.dir];
  for (let i = 0; i <= 4; i++) if (Math.abs(you.y + d.y * i + 0.5 - row) < BANNER_ROWS / 2 + 0.5) return true;
  return false;
}

function drawBanner(ctx, b, cell) {
  const w = COLS * cell;
  const p = 1 - b.life / b.max;
  const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.55 : p < 0.22 ? 1.15 - ((p - 0.12) / 0.1) * 0.15 : 1;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  const y = b.row * cell;
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, y - cell * (BANNER_ROWS / 2), w, cell * BANNER_ROWS);
  if (b.tag) label(ctx, b.tag, w / 2, y - cell * 1.15, cell * 0.55, GOLD);
  label(ctx, b.title, w / 2, y - cell * 0.1, cell * 1.3 * pop, b.color);
  if (b.sub) label(ctx, b.sub, w / 2, y + cell * 1.05, cell * 0.65, "#ffffff");
  ctx.globalAlpha = 1;
}

// The ready and over screens' strip along the bottom: a line or two, then one
// dot per arena, lit for those reached.
function drawTally(ctx, cell, lines, furthest) {
  const w = COLS * cell;
  const h = ROWS * cell;
  const top = h - cell * 5;
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, w, cell * 5);
  lines.forEach((text, i) => label(ctx, text, w / 2, top + cell * (1 + i * 1.2), cell * (i ? 0.68 : 0.82), i ? "#ffffff" : GOLD));
  const r = cell * 0.36;
  const gap = r * 3;
  const x = w / 2 - ((MAX_LEVEL - 1) * gap) / 2;
  const y = top + cell * 3.9;
  for (let i = 0; i < MAX_LEVEL; i++) {
    ctx.beginPath();
    ctx.arc(x + i * gap, y, r, 0, Math.PI * 2);
    if (i < furthest) {
      ctx.fillStyle = levelColor(i + 1);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

// The over screen's nudge to play again: the next arena not yet reached.
function teaser(furthest) {
  if (furthest < MAX_LEVEL) return `Next up at level ${furthest + 1}: ${ARENAS[furthest + 1].title}.`;
  return "Every arena reached. Now beat your best!";
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 400;

function create({ canvas, tone: playTone = () => {}, hum: playHum = () => {}, music = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  // Every sound a little louder than made, so it carries over the songs; the
  // engine drones are left as they are, low under them.
  const tone = (name, level = 1, pitch = 1) => playTone(name, level, pitch, SFX_LOUDER);
  const hum = (id, name, level = 1, pitch = 1) => playHum(id, name, level, pitch, DRONES.has(id) ? 1 : SFX_LOUDER);
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  // The run's deal of songs, the one playing in it, and whether that one
  // still has to be started from the top (cleared once the music takes it).
  let deck = [];
  let songAt = 0;
  let fresh = false;
  let state = "ready";
  let cell = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // The furthest arena ever reached. Without a memo (the unit suite) it lasts
  // as long as the game.
  let furthest = 1;
  try {
    furthest = Math.min(MAX_LEVEL, Math.max(1, memo ? Number(memo.get()) | 0 : 1));
  } catch {}
  // Sparks, floating points, the big banners, the shake and the flash, all
  // in cell units and ms, so a resize mid-round keeps them in place.
  let fx = null;
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], beams: [], shake: 0, shakeMag: 0, flash: null, clock: 0 });
  resetFx();

  const burst = (p, color, n, speed = 6) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x: p.x + 0.5, y: p.y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 450 + Math.random() * 400, max: 850, color, size: 0.14 + Math.random() * 0.16 });
    }
  };
  const float = (p, text, color) => fx.floats.push({ x: p.x + 0.5, y: p.y - 0.2, text, color, life: 1000, max: 1000 });
  const banner = (title, sub, color, ms = 1800) => {
    if (fx.banners.length >= 3 || fx.banners.some((b) => b.title === title)) return null;
    const b = { title, sub, color, life: ms, max: ms, tag: "", row: null, see: 1 };
    fx.banners.push(b);
    return b;
  };
  const shake = (ms, mag) => {
    fx.shake = Math.max(fx.shake, ms);
    fx.shakeMag = Math.max(fx.shake > 0 ? fx.shakeMag : 0, mag);
  };
  const flash = (color, ms = 260) => (fx.flash = { color, life: ms, max: ms });

  // What the sound last heard, so a held hum or a one-shot follows changes
  // rather than firing every frame: a sound due a moment later (on the fx
  // clock, so a pause holds it), the effects running, the pads on the board,
  // and whether you were held up, grazing a wall or passing a rival. It only
  // reads the round; nothing here changes a rule or a score.
  let sfx = null;
  // The kinds of pad taken this run, so the first of each says it is new.
  let seenPowers = new Set();
  const resetSfx = () => (sfx = { later: [], effects: {}, items: new Set(), stalled: false, grazing: false, close: false, swooshAt: 0, whooshAt: 0, mystery: false });
  resetSfx();
  const later = (ms, name, level = 1, pitch = 1) => sfx.later.push({ at: fx.clock + ms, name, level, pitch });
  const vary = (spread = 0.08) => 1 - spread / 2 + Math.random() * spread;

  const reach = (level, b) => {
    if (level <= furthest) return;
    furthest = level;
    try {
      if (memo) memo.set(furthest);
    } catch {}
    if (b) b.tag = `NEW ARENA ${furthest} / ${MAX_LEVEL}`;
  };

  const handle = (e) => {
    const p = { x: e.x, y: e.y };
    if (e.type === "go") {
      tone("go");
      tone("trailsIgnite", 0.8);
    } else if (e.type === "boost") {
      tone("max");
      tone("boost", 0.8);
      burst(p, POWERS.boost.color, 14, 5);
    } else if (e.type === "out") {
      const color = RIVALS[e.id].color;
      tone("zap");
      tone("trailsDerez", 0.85, vary());
      if (e.by === 0 && e.points) later(120, "trailsCutOff", 0.7);
      burst(p, color, 34, 9);
      shake(200, 0.15);
      if (e.points && e.by === "laser") float(p, `Zapped! +${e.points}`, POWERS.laser.color);
      else if (e.points) float(p, e.by === 0 ? `Cut off! +${e.points}` : `+${e.points}`, e.by === 0 ? GOLD : color);
      else float(p, "Out!", color);
    } else if (e.type === "crash") {
      tone("crash");
      tone("trailsShatter");
      burst(p, colors.you, 44, 10);
      burst(p, colors.head, 16, 6);
      shake(450, 0.35);
      flash(DANGER, 320);
    } else if (e.type === "power") {
      const spec = POWERS[e.kind];
      const fromMystery = sfx.mystery;
      sfx.mystery = false;
      if (e.kind === "coin" && !fromMystery) {
        tone("coin");
        tone("sparkle", 0.5, vary());
        burst(p, GOLD, 10, 4);
        float(p, `+${e.points}`, GOLD);
        return;
      }
      tone("power");
      if (e.kind === "boost") tone("trailsCharge", 0.8);
      else if (e.kind === "phase") tone("trailsPhaseIn", 0.8);
      else if (e.kind === "slow") tone("trailsSlowmo", 0.8);
      else if (e.kind === "life") {
        tone("trailsHeart", 0.9);
        later(300, "extraLife", 0.7);
        float(p, "+1 ♥", POWERS.life.color);
      } else if (e.kind === "shield") tone("shieldUp", 0.8);
      else if (e.kind === "laser") tone("laser", 0.7);
      else if (e.kind === "double") {
        tone("coinUp", 0.8);
        later(160, "sparkle", 0.6);
      } else if (e.kind === "wide") tone("riser", 0.7);
      else if (e.kind === "rain") {
        tone("coinUp", 0.8);
        for (let k = 1; k <= 4; k++) later(k * 110, "coin", 0.4, 1 + k * 0.08);
        for (const it of round.items) if (it.rain) burst(it, GOLD, 8, 3);
      } else if (e.kind === "coin") {
        tone("coin");
        float(p, `+${e.points}`, GOLD);
      }
      burst(p, spec.color, 26, 8);
      if (e.kind === "eraser") {
        tone("sizzle");
        tone("swoosh", 0.8, 0.8);
        burst(p, spec.color, 60, 14);
        shake(180, 0.12);
      }
      // The first of a kind in a run says it is new; a Mystery says what it was.
      const b = banner(fromMystery ? `Mystery: ${spec.name}!` : spec.name, spec.blurb, spec.color, 1400);
      if (b && !seenPowers.has(e.kind)) b.tag = "NEW POWER-UP";
      seenPowers.add(e.kind);
    } else if (e.type === "mystery") {
      tone("mystery");
      sfx.mystery = true;
      burst(p, POWERS.mystery.color, 20, 7);
      burst(p, GOLD, 12, 5);
    } else if (e.type === "laser") {
      tone("trailsLaser", 0.9, vary());
      fx.beams.push({ from: e.from, to: e.to, life: 260, max: 260 });
      burst(e.to, POWERS.laser.color, 30, 9);
      shake(180, 0.15);
    } else if (e.type === "shield") {
      tone("trailsShieldPop");
      later(200, "trailsSave", 0.8);
      burst(p, POWERS.shield.color, 50, 11);
      burst(p, "#ffffff", 16, 6);
      shake(260, 0.2);
      flash(POWERS.shield.color, 300);
      banner("Shield!", "It took the crash for you", POWERS.shield.color, 1400);
    } else if (e.type === "jump") {
      tone("trailsJump");
      burst(e.from, POWERS.jump.color, 24, 7);
      burst(e.to, POWERS.jump.color, 34, 9);
      flash(POWERS.jump.color, 220);
    } else if (e.type === "bonusLife") {
      tone("trailsHeart");
      later(320, "extraLife", 0.8);
      const you = round.riders[0];
      burst(you, POWERS.life.color, 30, 8);
      float(you, "+1 ♥", POWERS.life.color);
      banner("Extra life!", `${e.at} points scored`, POWERS.life.color, 1600);
    } else if (e.type === "snatch") {
      tone("trailsSnatch", 0.6);
      burst(p, RIVALS[e.id].color, 10, 4);
      float(p, "Snatched!", RIVALS[e.id].color);
    } else if (e.type === "portal") {
      // Yours whooshes through; a rival's is heard, further off.
      tone("tunnel", e.id === 0 ? 1 : 0.4);
      if (e.id === 0) tone("warp", 0.6, vary());
      burst(e.from, PORTAL_COLORS[0][0], 10, 5);
      burst(e.to, PORTAL_COLORS[0][1], 10, 5);
    } else if (e.type === "warn") {
      tone("count");
      tone("warn", 0.5);
    } else if (e.type === "squeeze") {
      tone("boom");
      tone("trailsSlam", 0.9, vary());
      shake(220, 0.18);
    } else if (e.type === "win") {
      tone("levelup");
      later(200, "trailsStanding", 0.9);
      flash(GOLD, 300);
      banner("Heat won!", `+${e.points} points`, GOLD, DONE_MS);
      const you = round.riders[0];
      burst(you, GOLD, 40, 9);
    } else if (e.type === "lose") {
      // After the shatter has had its moment; the last life lost is the game
      // over's to mourn.
      if (e.lives > 0) later(450, "lifeLost", 0.7);
      banner("Crashed!", e.lives > 0 ? `${e.lives} ${e.lives === 1 ? "life" : "lives"} left` : "That was your last life", DANGER, DONE_MS);
    } else if (e.type === "draw") {
      tone("mystery");
      later(250, "powerDown", 0.5);
      banner("Draw!", "Nobody loses a life", "#ffffff", DONE_MS);
    } else if (e.type === "level") {
      const spec = arenaFor(e.level);
      tone("levelup");
      later(300, "trailsArena", 0.9, 1 + (e.level - 1) * 0.03);
      if (e.level > furthest) later(1100, "sparkle", 0.7);
      flash(levelColor(e.level), 400);
      reach(e.level, banner(`Level ${e.level}`, `${spec.title}: ${spec.sub}`, levelColor(e.level), 2200));
    } else if (e.type === "champion") {
      tone("best");
      later(250, "victory");
      later(800, "cheer", 0.7);
      flash(GOLD, 400);
      banner("Champion!", "Every arena beaten. Again!", GOLD, 2200);
    } else if (e.type === "retry") {
      // One life left: a heartbeat under the banner.
      if (e.lives === 1) {
        tone("heartbeat", 0.8);
        later(700, "heartbeat", 0.6);
      }
      banner(arenaFor(round.level).title, "Again! Last rider moving wins", levelColor(round.level), 1400);
    }
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    later(280, "fanfare", 0.6);
    banner("New best!", "Every point from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  // The held sounds, every tick the game runs (stop calling and each fades by
  // itself, so a pause or the end goes quiet): your cycle pitched with your
  // pace, the nearest rival's louder the closer it rides, a crackle along a
  // rival's wall, Phase's shimmer and a closing ring's siren. Then the
  // one-shots that follow a change: a sound due now, an effect wearing off, a
  // pad appearing, being held up and riding out of it, and passing close.
  const listen = () => {
    const due = sfx.later.filter((s) => s.at <= fx.clock);
    if (due.length) {
      sfx.later = sfx.later.filter((s) => s.at > fx.clock);
      for (const s of due) tone(s.name, s.level, s.pitch);
    }
    const racing = round.phase === "race";
    const you = round.riders[0];
    const on = Object.fromEntries(["boost", "phase", "slow", "laser", "double", "wide"].map((k) => [k, active(round, k)]));
    if (racing && you.alive) {
      if (sfx.effects.boost && !on.boost) tone("trailsBoostOut", 0.7);
      if (sfx.effects.phase && !on.phase) tone("trailsPhaseOut", 0.7);
      if (sfx.effects.slow && !on.slow) tone("trailsSlowEnd", 0.7);
      for (const k of ["laser", "double", "wide"]) if (sfx.effects[k] && !on[k]) tone("powerDown", 0.5);
    }
    sfx.effects = on;
    if (round.phase === "ready") {
      hum("trails:you", "trailsCycle", 0.35, 0.8);
      sfx.items = new Set(round.items);
      return;
    }
    if (!racing || !you.alive) return;
    for (const it of round.items) if (!sfx.items.has(it)) tone("trailsPadSpawn", 0.45, vary());
    sfx.items = new Set(round.items);

    const speed = STEP_MS / pace(round, you);
    const stalled = Boolean(you.stall);
    hum("trails:you", "trailsCycle", stalled ? 0.6 : 0.85, (0.7 + 0.35 * speed) * (stalled ? 0.8 : 1));
    if (stalled && !sfx.stalled) tone("skid", 0.5);
    else if (!stalled && sfx.stalled) tone("trailsSave", 0.8);
    sfx.stalled = stalled;

    let rival = null;
    let gap = Infinity;
    for (const r of round.riders) {
      if (r === you || !r.alive) continue;
      const d = Math.hypot(r.x - you.x, r.y - you.y);
      if (d < gap) [rival, gap] = [r, d];
    }
    // The nearest rival's drone, kept low under the songs (the shared hum is louder).
    if (rival) hum("trails:rival", "cycle", RIVAL_HUM * Math.max(0, 1 - gap / 18), (0.8 + 0.25 * (STEP_MS / pace(round, rival))) * (1 + rival.id * 0.04));
    const close = gap <= 2.5;
    if (close && !sfx.close && fx.clock >= sfx.whooshAt) {
      tone("whoosh", 0.6, vary(0.2));
      sfx.whooshAt = fx.clock + 500;
    }
    sfx.close = close;

    // A rival's wall at either side of you (your own and the arena's edge do
    // not count, or a careful ride would crackle all the way).
    let sides = 0;
    for (const side of [LEFT_OF[you.dir], RIGHT_OF[you.dir]]) {
      const x = you.x + DIRS[side].x;
      const y = you.y + DIRS[side].y;
      if (inside(x, y) && round.grid[at(x, y)] > 1) sides += 1;
    }
    if (stalled) hum("trails:graze", "trailsGraze", 1, 0.6);
    else if (sides) hum("trails:graze", "trailsGraze", sides === 1 ? 0.55 : 0.9, 0.9 + speed * 0.15);
    if (sides && !sfx.grazing && fx.clock >= sfx.swooshAt) {
      tone("swoosh", 0.45, vary(0.2));
      sfx.swooshAt = fx.clock + 400;
    }
    sfx.grazing = sides > 0;

    if (on.phase) hum("trails:phase", "trailsPhase", 0.8, 1 + 0.25 * (1 - round.effects.phase / POWERS.phase.ms));
    if (round.level >= SHRINK_LEVEL && round.ring < MAX_RING && round.nextRing <= SHRINK_WARN_MS) {
      hum("trails:siren", "trailsSiren", 0.8, 1 + 0.5 * (1 - round.nextRing / SHRINK_WARN_MS));
    }
  };

  const runFx = (ms) => {
    fx.clock += ms;
    const s = ms / 1000;
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 + 6 * s;
      return p.life > 0;
    });
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.y -= 1.6 * s;
      return f.life > 0;
    });
    if (fx.banners.length) {
      const b = fx.banners[0];
      if (b.row == null) b.row = bannerRow(round);
      const target = underBanner(round, b.row) ? BANNER_SEE_THROUGH : 1;
      b.see += (target - b.see) * Math.min(1, ms / BANNER_FADE_MS);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
    }
    fx.beams = fx.beams.filter((b) => (b.life -= ms) > 0);
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash) {
      fx.flash.life -= ms;
      if (fx.flash.life <= 0) fx.flash = null;
    }
  };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    // A banner takes its place on its first frame: a frame painted before the
    // next tick (the start's, held through the 3, 2, 1) would draw it at the top.
    const head = fx.banners[0];
    if (head && head.row == null) head.row = bannerRow(round);
    const w = COLS * cell;
    const h = ROWS * cell;
    const clock = fx.clock;
    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * 2 * fx.shakeMag * cell, (Math.random() - 0.5) * 2 * fx.shakeMag * cell);
    drawBoard(ctx, round, cell, colors, clock);
    drawWalls(ctx, round, cell, clock);
    drawBlocks(ctx, round, cell);
    drawPortals(ctx, round, cell, clock);
    drawItems(ctx, round, cell, clock);
    // The fallen first, under whoever still rides; you on top of everyone.
    const order = [...round.riders].sort((a, b) => Number(a.alive) - Number(b.alive) || b.id - a.id);
    const heads = new Map(order.map((r) => [r, r.alive || r.fade > 0 ? headPoint(round, r, cell, state) : null]));
    for (const r of order) drawTrail(ctx, round, r, cell, colors, clock, r.alive ? heads.get(r) : null);
    for (const r of order) if (heads.get(r)) drawHead(ctx, round, r, cell, colors, clock, heads.get(r), state);
    drawBeams(ctx, fx.beams, cell);
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect((p.x - p.size / 2) * cell, (p.y - p.size / 2) * cell, p.size * cell, p.size * cell);
    }
    ctx.globalAlpha = 1;
    for (const f of fx.floats) {
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
      label(ctx, f.text, f.x * cell, f.y * cell, cell * 0.8, f.color);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (fx.flash) {
      ctx.globalAlpha = 0.28 * (fx.flash.life / fx.flash.max);
      ctx.fillStyle = fx.flash.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (state === "running" || state === "paused") drawHud(ctx, round, cell);
    if (state === "running" && fx.banners.length) drawBanner(ctx, fx.banners[0], cell);
    const reached = `Furthest arena: ${furthest}, ${ARENAS[furthest].title}`;
    if (state === "ready") drawTally(ctx, cell, ["Last rider moving wins the heat", `Arrows steer, space boosts. ${reached}`], furthest);
    if (state === "over") drawTally(ctx, cell, [`Reached level ${round.level}, ${arenaFor(round.level).title}${beaten ? ", with a new best!" : ""}`, `${round.outs} rivals out, ${round.heatsWon} heats won. ${teaser(furthest)}`], furthest);
  };

  const start = () => {
    colors = null;
    round = newRound();
    deck = dealMusic(Math.random, deck[songAt] ?? null);
    songAt = 0;
    fresh = true;
    state = "running";
    resetFx();
    resetSfx();
    seenPowers = new Set();
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    banner(ARENAS[1].title, ARENAS[1].sub, levelColor(1), 1600);
    paint();
  };

  // Keeps the song going; once it has played through, the next in the deal,
  // and after the last a fresh deal.
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

  const end = () => {
    state = "over";
    tone("crash");
    tone("gameOver");
    onScore(round.score);
  };

  return {
    get score() {
      return round.score;
    },
    get state() {
      return state;
    },
    // For the tests only, as Mini golf's is: the window never reads it.
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
      paint();
    },
    resume() {
      if (state === "paused") state = "running";
    },
    key(name) {
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        else if (state === "paused") state = "running";
        else if (boost(round)) drain();
        return true;
      }
      if (!DIRS[name]) return false;
      if (state === "running" && turn(round, name)) tone("trailsTurn", 0.35, vary(0.12));
      return true;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      advance(round, ms);
      drain();
      if (round.over) end();
      else {
        listen();
        if (deck.length) playMusic();
      }
      paint();
    },
    resize(w, h) {
      const next = Math.floor(Math.min(w / COLS, h / ROWS));
      if (!(next >= MIN_CELL)) return false;
      cell = next;
      colors = null;
      const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
      canvas.width = Math.round(COLS * cell * ratio);
      canvas.height = Math.round(ROWS * cell * ratio);
      if (canvas.style) {
        canvas.style.width = `${COLS * cell}px`;
        canvas.style.height = `${ROWS * cell}px`;
      }
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
      return true;
    },
  };
}

export default Object.freeze({ id: "trails", title: "Light Trails", create });
