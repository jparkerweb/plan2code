// Plan2Code Web Console - Snake, the first activity: rules, drawing and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys and pauses it. A game never runs a timer or listens
// for a key of its own, so a paused game cannot move. The rules are plain
// functions over a round object (newRound, turn, step, age, placeFood),
// exported so the unit suite can drive them without a canvas; the default
// export is the contract every listed game answers.
//
// A round starts as plain Snake and gets wilder as it goes. Every
// FOOD_PER_LEVEL foods is a new level, and each of the first few brings
// something new onto the board (rocks, mystery boxes, portals, comets, chaos,
// then ice), and each level serves its own fruit (FRUITS) on its own scenery
// (THEMES). Odd levels end on a boss fruit, and a runaway fruit sometimes
// turns up to be chased down. Power-ups turn up on their own, a mystery box
// can hold any of nine surprises, and eating quickly builds a combo. Every
// power-up, surprise, level and special a player has ever seen is kept as one
// bit of a saved tally (the host's memo), so the start and end screens can
// say how much is still out there to find.

import { drawPill } from "./pills.js";

// The step at the starting length of three cells, in ms. The snake speeds up as
// it grows (see stepMs), so this is the slowest step a round begins at.
export const STEP_MS = 120;

// The fastest step a long snake reaches, in ms: stepMs never goes under it.
export const MIN_STEP_MS = 60;

// The board is always this many cells; a bigger window only makes the cells
// bigger, so a resize mid-round never moves the snake or the food.
export const GRID = 20;

// Below this many pixels a cell, the board is too small to play: resize()
// says so and the window shows its bigger-window note.
export const MIN_CELL = 12;

// Every this many foods is a new level. Levels past CHAOS_LEVEL bring nothing
// new, only more of everything, and the count stops at MAX_LEVEL.
export const FOOD_PER_LEVEL = 5;
export const MAX_LEVEL = 9;
const CHAOS_LEVEL = 6;

// Food eaten within COMBO_MS of the last raises the combo, which multiplies
// the food's points, up to MAX_COMBO.
export const COMBO_MS = 2600;
export const MAX_COMBO = 5;

// Each level past the first takes this share off the step, on top of the
// speed-up from length. Slow-mo scales the step again, but it never goes
// under FASTEST_MS.
const LEVEL_SPEEDUP = 0.03;
const FASTEST_MS = 40;

// Slow-mo stretches the step by SLOW_FACTOR, and over its last SLOW_EASE_MS
// eases back to the usual pace, so its end is never a jolt.
const SLOW_FACTOR = 1.7;
const SLOW_EASE_MS = 2500;

// A new rock flashes for ROCK_WARN_MS before it turns solid, so it never lands
// on a player without warning. A rock never lands next to the head or in the
// cells right ahead of it.
const ROCK_WARN_MS = 1500;
const MAX_ROCKS = 28;
const CLEAR_AHEAD = 5;

// Power-ups and mystery boxes: the first shows up FIRST_SPAWN_MS into a round,
// the next one every few seconds after, each fading after ITEM_TTL_MS.
const FIRST_SPAWN_MS = 4000;
const SPAWN_MS = 6000;
const SPAWN_SPREAD_MS = 5000;
const ITEM_TTL_MS = 9000;
const MAX_ITEMS = 2;
const MYSTERY_CHANCE = 0.35;
const COIN_TTL_MS = 7000;

const COMET_MS = 190;
const COMET_WARN_MS = 1500;
const MAX_COMETS = 3;
const PORTAL_MOVE_MS = 20000;
const MAGNET_REACH = 7;
const MAX_SHIELDS = 2;
const CHAOS_FIRST_MS = 6000;
const CHAOS_MS = 12000;
const CHAOS_SPREAD_MS = 8000;

// Ice: on ICE_LEVEL a turn slides on for ICE_STEPS steps before it takes. The
// ice melts at the next level.
const ICE_LEVEL = 7;
export const ICE_STEPS = 2;

// A runaway fruit turns up now and then from RUNNER_LEVEL on, in place of a
// power-up. Once the head is within RUNNER_SEES cells it hops up to two cells
// away, resting RUNNER_REST steps between hops, until RUNNER_HOPS hops tire
// it out. Cornered, it has nowhere to hop. Left alone, it runs off.
const RUNNER_LEVEL = 2;
const RUNNER_CHANCE = 0.18;
const RUNNER_TTL_MS = 12000;
const RUNNER_SEES = 3;
const RUNNER_REST = 2;
export const RUNNER_HOPS = 7;
const RUNNER_POINTS = 6;

// The last food of every odd level from BOSS_LEVEL on is a boss fruit: two by
// two cells and BOSS_BITES bites, and the head must leave it between bites.
// The last bite is the food, with BOSS_BONUS points a level on top.
const BOSS_LEVEL = 3;
export const BOSS_BITES = 3;
const BOSS_BONUS = 5;

const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

// The power-ups. A timed one lasts `ms`; Shield and Scissors act at once.
export const POWERS = deepFreeze({
  shield: { name: "Shield", blurb: "Shrug off one crash", color: "#1fb6d9" },
  slow: { name: "Slow-mo", blurb: "Time crawls", color: "#4f7cff", ms: 7000 },
  magnet: { name: "Magnet", blurb: "Food comes to you", color: "#ff3d6e", ms: 9000 },
  ghost: { name: "Ghost", blurb: "Walls wrap around", color: "#a466ff", ms: 9000 },
  scissors: { name: "Scissors", blurb: "Half the tail, all the points", color: "#2fbf71" },
});

// What a mystery box can hold, good and bad alike. Past CHAOS_LEVEL some of
// them also happen on their own (CHAOS).
export const SURPRISES = deepFreeze({
  jackpot: { title: "Jackpot!", sub: "A pile of points", color: "#f5b301" },
  goldRush: { title: "Gold rush!", sub: "Grab the coins before they fade", color: "#f5b301" },
  quake: { title: "Earthquake!", sub: "Every rock crumbles", color: "#c98b4a" },
  meteors: { title: "Meteor shower!", sub: "Rocks incoming", color: "#e2553f" },
  lightsOut: { title: "Lights out!", sub: "Who turned off the lights?", color: "#7a7f99", ms: 7000 },
  disco: { title: "Disco fever!", sub: "Triple points", color: "#ff4fa3", ms: 8000 },
  bigSnack: { title: "Big snack!", sub: "You grow five at once", color: "#57b54a" },
  cometCall: { title: "Incoming!", sub: "A comet joins the board", color: "#ffd84a" },
  treasure: { title: "Treasure!", sub: "Three power-ups appear", color: "#1fb6d9" },
});

const CHAOS = Object.freeze(["meteors", "goldRush", "cometCall", "quake", "treasure", "disco"]);

// What each new level brings. Levels with no entry only speed up.
export const LEVELS = deepFreeze({
  2: { title: "Rocks", sub: "Flashing cells turn to stone" },
  3: { title: "Mystery boxes", sub: "Open one if you dare" },
  4: { title: "Portals", sub: "In one, out the other" },
  5: { title: "Comets", sub: "They cut your tail" },
  6: { title: "Chaos", sub: "Anything can happen" },
  7: { title: "Ice", sub: "Turns slide before they take" },
});

const LEVEL_COLORS = Object.freeze(["#57b54a", "#57b54a", "#c98b4a", "#f5b301", "#a466ff", "#ffd84a", "#ff4fa3", "#1fb6d9", "#ff8a1f", "#e2553f"]);

// The fruit each level serves, from level 1 up, and the color of the sparks it
// makes when eaten. The apple takes the page's warn color, as the food always
// has; past the list the last fruit stays.
export const FRUITS = deepFreeze({
  apple: { name: "Apple", color: null },
  cherries: { name: "Cherries", color: "#d8283b" },
  orange: { name: "Orange", color: "#ff8a1f" },
  grapes: { name: "Grapes", color: "#8a4fd8" },
  banana: { name: "Banana", color: "#f5c800" },
  strawberry: { name: "Strawberry", color: "#ef3b52" },
  watermelon: { name: "Watermelon", color: "#ff5468" },
  peach: { name: "Peach", color: "#ff9f70" },
  golden: { name: "Golden apple", color: "#f5b301" },
});

export const fruitFor = (level) => {
  const kinds = Object.keys(FRUITS);
  return kinds[Math.max(0, Math.min(kinds.length, level || 1) - 1)];
};

// Finds that are neither a power-up, a surprise nor a level.
export const SPECIALS = deepFreeze({
  runaway: { title: "Runaway fruit!", sub: "Corner it before it runs off", color: "#ff8a1f" },
  boss: { title: "Boss fruit!", sub: "Three bites, and back off between them", color: "#f5b301" },
});

// Every find a saved tally has ever had a bit for, in bit order. The order is
// saved, so new entries only ever go on the end, and a find taken out of the
// game (RETIRED) keeps its place so the bits after it never move.
const TALLY = Object.freeze([
  ...["shield", "turbo", "slow", "magnet", "ghost", "scissors"].map((k) => `power:${k}`),
  ...["jackpot", "goldRush", "quake", "meteors", "mirror", "lightsOut", "disco", "bigSnack", "cometCall", "treasure"].map((k) => `surprise:${k}`),
  ...["2", "3", "4", "5", "6", "7"].map((k) => `level:${k}`),
  "special:runaway",
  "special:boss",
]);
const RETIRED = Object.freeze(["power:turbo", "surprise:mirror"]);

// Everything a player can still find, in tally order.
export const DISCOVERIES = Object.freeze(TALLY.filter((id) => !RETIRED.includes(id)));

// The saved tally's bit for a find.
export const tallyBit = (id) => 1 << TALLY.indexOf(id);

const DIRS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

// More than two turns queued in one step is mashing, not steering.
const MAX_QUEUED = 2;

const same = (a, b) => a.x === b.x && a.y === b.y;

const opposite = (a, b) => a.x === -b.x && a.y === -b.y;

const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const pickOf = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/* ---------------------------------------------------------------- rules */

// The step for a snake of this many cells: STEP_MS at the starting three, 4 ms
// quicker for each cell beyond them, never under MIN_STEP_MS.
export function stepMs(length) {
  return Math.max(MIN_STEP_MS, STEP_MS - 4 * (length - 3));
}

// Whether a timed effect (a power-up or a surprise) is on.
export const active = (round, kind) => Boolean(round.effects && round.effects[kind] > 0);

// The step the round moves at right now: stepMs for its length, quicker each
// level, and stretched by Slow-mo, less so as it runs out.
export function pace(round) {
  let ms = stepMs(round.snake.length) * (1 - LEVEL_SPEEDUP * ((round.level || 1) - 1));
  if (active(round, "slow")) ms *= 1 + (SLOW_FACTOR - 1) * Math.min(1, round.effects.slow / SLOW_EASE_MS);
  return Math.max(FASTEST_MS, Math.round(ms));
}

// Disco fever triples every point.
export const multiplier = (round) => (active(round, "disco") ? 3 : 1);

// Whether the board is iced over.
export const icy = (round) => round.level === ICE_LEVEL;

// The cells a food covers: one, or four for a boss.
const foodCells = (f) => (!f ? [] : f.boss ? [f, { x: f.x + 1, y: f.y }, { x: f.x, y: f.y + 1 }, { x: f.x + 1, y: f.y + 1 }] : [f]);

// Whether cell c is on the food.
export const onFood = (f, c) => foodCells(f).some((k) => same(k, c));

// Every cell something already sits on, as y * size + x.
function taken(round) {
  const cells = new Set();
  const add = (c) => c && cells.add(c.y * round.size + c.x);
  round.snake.forEach(add);
  foodCells(round.food).forEach(add);
  add(round.runner);
  (round.rocks || []).forEach(add);
  (round.items || []).forEach(add);
  (round.coins || []).forEach(add);
  (round.portals || []).forEach(add);
  (round.comets || []).forEach(add);
  return cells;
}

// A free cell at random, listed row by row, among those `ok` allows; null
// when there is none.
function pickFree(round, random, ok = () => true) {
  const used = taken(round);
  const free = [];
  for (let y = 0; y < round.size; y++) {
    for (let x = 0; x < round.size; x++) {
      if (!used.has(y * round.size + x) && ok(x, y)) free.push({ x, y });
    }
  }
  return free.length ? free[Math.floor(random() * free.length)] : null;
}

// Not next to the head and not in the cells right ahead of it, so nothing
// lands where the player has no time to steer.
function clearOfHead(round, x, y, gap = 3) {
  const head = round.snake[0];
  if (near(head, { x, y }) < gap) return false;
  for (let i = 1; i <= CLEAR_AHEAD; i++) {
    if (head.x + round.dir.x * i === x && head.y + round.dir.y * i === y) return false;
  }
  return true;
}

// A free cell at random, or null when the snake fills the board.
export function placeFood(round, random = Math.random) {
  return pickFree(round, random);
}

// A boss fruit on four free cells clear of the head, or plain food when no
// such square is left.
export function placeBoss(round, random = Math.random) {
  const used = taken(round);
  const free = (x, y) => !used.has(y * round.size + x) && clearOfHead(round, x, y);
  const spots = [];
  for (let y = 0; y < round.size - 1; y++) {
    for (let x = 0; x < round.size - 1; x++) {
      if (free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1)) spots.push({ x, y });
    }
  }
  if (!spots.length) return placeFood(round, random);
  return { ...pickOf(spots, random), boss: true, bites: BOSS_BITES, inside: false };
}

// Three cells mid-board heading right, food somewhere else, nothing scored,
// and nothing else on the board yet.
export function newRound(size = GRID, random = Math.random) {
  const mid = Math.floor(size / 2);
  const round = {
    size,
    snake: [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }],
    prev: null,
    dir: DIRS.right,
    queue: [],
    // Steps the next queued turn has slid on ice.
    slide: 0,
    food: null,
    runner: null,
    score: 0,
    eaten: 0,
    level: 1,
    combo: 1,
    comboMs: 0,
    grow: 0,
    shield: 0,
    effects: {},
    rocks: [],
    items: [],
    coins: [],
    portals: null,
    portalMs: 0,
    comets: [],
    spawnMs: FIRST_SPAWN_MS,
    chaosMs: 0,
    crashed: null,
    // What happened since the game last looked, for its sounds and sparks.
    events: [],
  };
  round.food = placeFood(round, random);
  return round;
}

// Queues a turn. A turn straight back into the snake's own neck, or the way it
// is already going, is ignored. Returns whether the turn was queued.
export function turn(round, name) {
  const next = DIRS[name];
  if (!next) return false;
  const last = round.queue.length ? round.queue[round.queue.length - 1] : round.dir;
  if (same(next, last) || opposite(next, last) || round.queue.length >= MAX_QUEUED) return false;
  round.queue.push(next);
  return true;
}

/* -------------------------------------------------------- board makers */

export function dropRocks(round, count, random = Math.random) {
  for (let i = 0; i < count && round.rocks.length < MAX_ROCKS; i++) {
    const c = pickFree(round, random, (x, y) => clearOfHead(round, x, y));
    if (!c) return;
    round.rocks.push({ ...c, warn: ROCK_WARN_MS });
  }
}

export function spawnItem(round, kind, random = Math.random) {
  const c = pickFree(round, random, (x, y) => clearOfHead(round, x, y, 2));
  if (c) round.items.push({ ...c, kind, ttl: ITEM_TTL_MS });
}

const randomPower = (random) => pickOf(Object.keys(POWERS), random);

// Two portals, off the edge rows and a good way apart. Opening them again
// moves them.
export function openPortals(round, random = Math.random) {
  round.portals = null;
  const inner = (x, y) => x > 0 && y > 0 && x < round.size - 1 && y < round.size - 1;
  const a = pickFree(round, random, (x, y) => inner(x, y) && clearOfHead(round, x, y));
  if (!a) return;
  const b = pickFree(round, random, (x, y) => inner(x, y) && !same(a, { x, y }) && near(a, { x, y }) >= round.size / 3 && clearOfHead(round, x, y));
  if (!b) return;
  round.portals = [a, b];
  round.portalMs = PORTAL_MOVE_MS;
}

export function addComet(round, random = Math.random) {
  if (round.comets.length >= MAX_COMETS) return;
  const c = pickFree(round, random, (x, y) => clearOfHead(round, x, y, 6));
  if (!c) return;
  round.comets.push({ ...c, dx: random() < 0.5 ? 1 : -1, dy: random() < 0.5 ? 1 : -1, warn: COMET_WARN_MS, ms: 0, trail: [] });
}

export function spawnRunner(round, random = Math.random) {
  const c = pickFree(round, random, (x, y) => clearOfHead(round, x, y, 5));
  if (!c) return;
  round.runner = { ...c, ttl: RUNNER_TTL_MS, hops: RUNNER_HOPS, rest: 0 };
  round.events.push({ type: "runner", x: c.x, y: c.y });
}

// The runaway fruit, once the head is close, hops to the free cell up to two
// away that is farthest from the head. It stays put while resting, tired, or
// cornered (no cell takes it farther away).
function flee(round, random) {
  const r = round.runner;
  if (!r) return;
  if (r.rest > 0) {
    r.rest -= 1;
    return;
  }
  const head = round.snake[0];
  if (r.hops <= 0 || near(head, r) > RUNNER_SEES) return;
  const used = taken(round);
  let far = near(head, r);
  let best = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      const c = { x: r.x + dx, y: r.y + dy };
      if (d < 1 || d > 2 || c.x < 0 || c.y < 0 || c.x >= round.size || c.y >= round.size || used.has(c.y * round.size + c.x)) continue;
      const away = near(head, c);
      if (away > far) {
        far = away;
        best = [c];
      } else if (away === far && best.length) best.push(c);
    }
  }
  if (!best.length) return;
  const to = pickOf(best, random);
  round.events.push({ type: "hop", from: { x: r.x, y: r.y }, to: { ...to } });
  r.x = to.x;
  r.y = to.y;
  r.hops -= 1;
  r.rest = RUNNER_REST;
}

/* ------------------------------------------------------------- pickups */

// Returns the points it scored.
export function applyPower(round, kind) {
  if (kind === "shield") {
    round.shield = Math.min(MAX_SHIELDS, round.shield + 1);
    return 0;
  }
  if (kind === "scissors") {
    const keep = Math.max(3, Math.ceil(round.snake.length / 2));
    const lost = round.snake.length - keep;
    round.snake = round.snake.slice(0, keep);
    if (round.prev) round.prev = round.prev.slice(0, keep);
    round.grow = 0;
    const points = lost * multiplier(round);
    round.score += points;
    return points;
  }
  if (!POWERS[kind]) return 0;
  round.effects[kind] = POWERS[kind].ms;
  return 0;
}

// Returns the points it scored.
export function applySurprise(round, kind, random = Math.random) {
  const spec = SURPRISES[kind];
  if (!spec) return 0;
  if (spec.ms) round.effects[kind] = spec.ms;
  let points = 0;
  if (kind === "jackpot") points = 10 * round.level * multiplier(round);
  else if (kind === "goldRush") {
    for (let i = 0; i < 8; i++) {
      const c = pickFree(round, random, (x, y) => clearOfHead(round, x, y, 2));
      if (c) round.coins.push({ ...c, ttl: COIN_TTL_MS });
    }
  } else if (kind === "quake") {
    points = Math.max(3, round.rocks.length) * multiplier(round);
    round.rocks = [];
  } else if (kind === "meteors") dropRocks(round, 6, random);
  else if (kind === "bigSnack") {
    round.grow += 5;
    points = 5 * multiplier(round);
  } else if (kind === "cometCall") addComet(round, random);
  else if (kind === "treasure") for (let i = 0; i < 3; i++) spawnItem(round, randomPower(random), random);
  round.score += points;
  return points;
}

function levelUp(round, random) {
  round.level += 1;
  round.slide = 0;
  const level = round.level;
  round.events.push({ type: "level", level });
  // Every new level opens in Slow-mo, a moment to take in what it brings.
  applyPower(round, "slow");
  if (level === 2) dropRocks(round, 3, random);
  if (level === 3) spawnItem(round, "mystery", random);
  if (level === 4) openPortals(round, random);
  if (level === 5 || level === 7 || level === 9) addComet(round, random);
  if (level >= CHAOS_LEVEL) dropRocks(round, 2, random);
  if (level === CHAOS_LEVEL) round.chaosMs = CHAOS_FIRST_MS;
}

function eat(round, random) {
  const at = round.snake[0];
  const boss = Boolean(round.food && round.food.boss);
  round.combo = round.comboMs > 0 ? Math.min(MAX_COMBO, round.combo + 1) : 1;
  round.comboMs = COMBO_MS;
  const points = (round.combo + (boss ? BOSS_BONUS * round.level : 0)) * multiplier(round);
  round.score += points;
  round.eaten += 1;
  if (boss) round.grow += 2;
  round.events.push({ type: "eat", x: at.x, y: at.y, points, combo: round.combo, fruit: fruitFor(round.level), boss });
  const level = Math.min(MAX_LEVEL, 1 + Math.floor(round.eaten / FOOD_PER_LEVEL));
  // The next food is a boss when it is the last of an odd level's foods.
  const bossNext = (round.eaten + 1) % FOOD_PER_LEVEL === 0 && level >= BOSS_LEVEL && level % 2 === 1;
  round.food = bossNext ? placeBoss(round, random) : placeFood(round, random);
  if (round.food && round.food.boss) round.events.push({ type: "boss", x: round.food.x + 0.5, y: round.food.y + 0.5 });
  if (round.level >= 2 && random() < 0.35) dropRocks(round, 1, random);
  while (round.level < level) levelUp(round, random);
}

// Magnet: food and coins in reach slide a cell toward the head each step.
function pull(round) {
  const head = round.snake[0];
  const used = taken(round);
  const slide = (thing) => {
    const dx = head.x - thing.x;
    const dy = head.y - thing.y;
    const d = Math.abs(dx) + Math.abs(dy);
    if (d > MAGNET_REACH || d <= 1) return;
    const to = Math.abs(dx) >= Math.abs(dy) ? { x: thing.x + Math.sign(dx), y: thing.y } : { x: thing.x, y: thing.y + Math.sign(dy) };
    const k = to.y * round.size + to.x;
    if (used.has(k)) return;
    used.delete(thing.y * round.size + thing.x);
    used.add(k);
    thing.x = to.x;
    thing.y = to.y;
  };
  // A boss is too big to pull.
  if (round.food && !round.food.boss) slide(round.food);
  round.coins.forEach(slide);
}

function crash(round, by) {
  round.crashed = by;
  round.events.push({ type: "crash", by, x: round.snake[0].x, y: round.snake[0].y });
  return "crash";
}

// A shield takes the hit in place of the snake.
function shielded(round, at) {
  if (!(round.shield > 0)) return false;
  round.shield -= 1;
  round.events.push({ type: "shield", x: at.x, y: at.y });
  return true;
}

// One step: "eat", "crash" or null, with everything else that happened on the
// way pushed to round.events. A crash leaves the snake where it was, so the
// last frame shows what it hit.
export function step(round, random = Math.random) {
  if (round.queue.length) {
    // On ice a turn slides on for ICE_STEPS steps before it takes.
    if (icy(round) && round.slide < ICE_STEPS) round.slide += 1;
    else {
      round.dir = round.queue.shift();
      round.slide = 0;
    }
  }
  const head = round.snake[0];
  const dir = round.dir;
  let next = { x: head.x + dir.x, y: head.y + dir.y };
  const gate = round.portals ? round.portals.findIndex((p) => same(p, next)) : -1;
  if (gate >= 0) {
    const out = round.portals[1 - gate];
    round.events.push({ type: "portal", from: { ...next }, to: { ...out } });
    next = { x: out.x + dir.x, y: out.y + dir.y };
  }
  if (next.x < 0 || next.y < 0 || next.x >= round.size || next.y >= round.size) {
    // Ghost and a shield both wrap the snake to the far side.
    if (!active(round, "ghost") && !shielded(round, head)) return crash(round, "wall");
    next = { x: (next.x + round.size) % round.size, y: (next.y + round.size) % round.size };
  }
  const food = round.food;
  // A boss is bitten on the way in, not while the head stays inside it.
  const eating = Boolean(food && onFood(food, next) && !(food.boss && food.inside));
  // The tail moves out of the way this step unless the snake is growing.
  const body = eating || round.grow > 0 ? round.snake : round.snake.slice(0, -1);
  const rock = round.rocks.findIndex((r) => !(r.warn > 0) && same(r, next));
  if (rock >= 0) {
    if (!shielded(round, next)) return crash(round, "rock");
    round.rocks.splice(rock, 1);
    const points = 3 * multiplier(round);
    round.score += points;
    round.events.push({ type: "smash", x: next.x, y: next.y, points });
  }
  const comet = round.comets.findIndex((c) => !(c.warn > 0) && same(c, next));
  if (comet >= 0) {
    if (!shielded(round, next)) return crash(round, "comet");
    round.comets.splice(comet, 1);
  }
  if (body.some((c) => same(c, next)) && !shielded(round, next)) return crash(round, "self");
  round.prev = round.snake;
  round.snake = [next, ...body];
  if (!eating && round.grow > 0) round.grow -= 1;

  const coin = round.coins.findIndex((c) => same(c, next));
  if (coin >= 0) {
    round.coins.splice(coin, 1);
    const points = 2 * multiplier(round);
    round.score += points;
    round.events.push({ type: "coin", x: next.x, y: next.y, points });
  }
  const item = round.items.findIndex((c) => same(c, next));
  if (item >= 0) {
    const { kind } = round.items.splice(item, 1)[0];
    if (kind === "mystery") {
      const surprise = pickOf(Object.keys(SURPRISES), random);
      const points = applySurprise(round, surprise, random);
      round.events.push({ type: "surprise", kind: surprise, x: next.x, y: next.y, points });
    } else {
      const points = applyPower(round, kind);
      round.events.push({ type: "power", kind, x: next.x, y: next.y, points });
    }
  }
  const runner = round.runner;
  if (runner && same(runner, next)) {
    round.runner = null;
    const points = RUNNER_POINTS * round.level * multiplier(round);
    round.score += points;
    round.events.push({ type: "caught", x: next.x, y: next.y, points, fruit: fruitFor(round.level) });
  }
  if (eating && food.boss && food.bites > 1) {
    food.bites -= 1;
    const points = round.level * multiplier(round);
    round.score += points;
    round.events.push({ type: "bite", x: next.x, y: next.y, points, left: food.bites });
  } else if (eating) eat(round, random);
  if (round.food && round.food.boss) round.food.inside = onFood(round.food, next);
  flee(round, random);
  if (active(round, "magnet")) pull(round);
  return eating ? "eat" : null;
}

// A comet moves one cell on the diagonal, bouncing off the walls and rocks.
// Into the head it is a crash; into the body it cuts the tail off there.
function moveComet(round, c) {
  let nx = c.x + c.dx;
  let ny = c.y + c.dy;
  if (nx < 0 || nx >= round.size) {
    c.dx = -c.dx;
    nx = c.x + c.dx;
  }
  if (ny < 0 || ny >= round.size) {
    c.dy = -c.dy;
    ny = c.y + c.dy;
  }
  const to = { x: nx, y: ny };
  if (round.rocks.some((r) => !(r.warn > 0) && same(r, to)) || (round.portals || []).some((p) => same(p, to))) {
    c.dx = -c.dx;
    c.dy = -c.dy;
    return null;
  }
  c.trail.unshift({ x: c.x, y: c.y });
  c.trail.length = Math.min(c.trail.length, 5);
  c.x = nx;
  c.y = ny;
  const hit = round.snake.findIndex((s) => same(s, c));
  if (hit === 0) {
    if (!shielded(round, c)) return crash(round, "comet");
    round.comets.splice(round.comets.indexOf(c), 1);
    return null;
  }
  if (hit > 0) {
    c.dx = -c.dx;
    c.dy = -c.dy;
    if (hit >= 3) {
      const lost = round.snake.length - hit;
      round.snake = round.snake.slice(0, hit);
      if (round.prev) round.prev = round.prev.slice(0, hit);
      round.events.push({ type: "zap", x: c.x, y: c.y, lost });
    }
  }
  return null;
}

// Time passing, apart from steps: effects and combos run down, rocks land,
// items and coins fade, new items turn up, portals move, comets fly and, past
// CHAOS_LEVEL, a surprise now and then happens on its own. "crash" when a
// comet hits the head, else null.
export function age(round, ms, random = Math.random) {
  for (const kind of Object.keys(round.effects)) {
    round.effects[kind] -= ms;
    if (round.effects[kind] <= 0) {
      delete round.effects[kind];
      round.events.push({ type: "effectEnd", kind });
    }
  }
  if (round.comboMs > 0) {
    round.comboMs = Math.max(0, round.comboMs - ms);
    if (!round.comboMs) round.combo = 1;
  }
  for (const r of round.rocks) {
    if (r.warn > 0) r.warn -= ms;
  }
  // A rock that finishes landing under the snake crumbles instead.
  round.rocks = round.rocks.filter((r) => r.warn > 0 || !round.snake.some((s) => same(s, r)));
  const fade = (list) =>
    list.filter((thing) => {
      thing.ttl -= ms;
      return thing.ttl > 0;
    });
  round.items = fade(round.items);
  round.coins = fade(round.coins);
  if (round.runner) {
    round.runner.ttl -= ms;
    if (round.runner.ttl <= 0) {
      round.events.push({ type: "escape", x: round.runner.x, y: round.runner.y });
      round.runner = null;
    }
  }
  round.spawnMs -= ms;
  if (round.spawnMs <= 0) {
    round.spawnMs = Math.max(3500, SPAWN_MS + random() * SPAWN_SPREAD_MS - 300 * round.level);
    if (round.level >= RUNNER_LEVEL && !round.runner && random() < RUNNER_CHANCE) spawnRunner(round, random);
    else if (round.items.length < MAX_ITEMS) spawnItem(round, round.level >= 3 && random() < MYSTERY_CHANCE ? "mystery" : randomPower(random), random);
  }
  if (round.portals) {
    round.portalMs -= ms;
    if (round.portalMs <= 0) {
      openPortals(round, random);
      round.events.push({ type: "portalMove" });
    }
  }
  if (round.level >= CHAOS_LEVEL) {
    round.chaosMs -= ms;
    if (round.chaosMs <= 0) {
      round.chaosMs = CHAOS_MS + random() * CHAOS_SPREAD_MS;
      const kind = pickOf(CHAOS, random);
      const points = applySurprise(round, kind, random);
      round.events.push({ type: "surprise", kind, chaos: true, points, x: round.snake[0].x, y: round.snake[0].y });
    }
  }
  for (const c of [...round.comets]) {
    if (c.warn > 0) {
      c.warn -= ms;
      continue;
    }
    c.ms += ms;
    while (c.ms >= COMET_MS && round.comets.includes(c)) {
      c.ms -= COMET_MS;
      if (moveComet(round, c) === "crash") return "crash";
    }
  }
  return null;
}

/* -------------------------------------------------------------- drawing */

const FALLBACK_COLORS = Object.freeze({ board: "#ffffff", line: "#e4ddd1", snake: "#206cc3", head: "#1d1a17", food: "#9c3327" });

// The page's tokens, read again at each round and each resize (an open of the
// window resizes), so the board follows a theme or highlight change made while
// the game sat paused, without a game knowing about themes. A stub canvas in Node has no computed style, so every
// color falls back to its plain value.
function readColors(canvas) {
  let style = null;
  try {
    style = typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
  } catch {}
  const pick = (name, fallback) => (style && style.getPropertyValue(name).trim()) || fallback;
  return {
    board: pick("--panel", FALLBACK_COLORS.board),
    line: pick("--rule", FALLBACK_COLORS.line),
    snake: pick("--accent", FALLBACK_COLORS.snake),
    head: pick("--ink", FALLBACK_COLORS.head),
    food: pick("--warn", FALLBACK_COLORS.food),
  };
}

const GOLD = "#f5b301";
const ROCK = "#6f675e";
const ROCK_LIGHT = "#9a8f82";
const COMET = "#ffd84a";
const SHADE = "rgba(0, 0, 0, 0.55)";

const discoveryColor = (id) => {
  const [group, key] = id.split(":");
  if (group === "power") return POWERS[key].color;
  if (group === "surprise") return SURPRISES[key].color;
  if (group === "special") return SPECIALS[key].color;
  return LEVEL_COLORS[Number(key)];
};

// Each level's scenery over the page's own board: a light tint and a scatter
// of small marks, faint enough that nothing in play is ever harder to see.
// Level 1 is the plain garden. Past the list the last one stays.
const THEMES = deepFreeze({
  1: { tint: null },
  2: { tint: "#57b54a", mark: "grass", ink: "#3f8f36" }, // meadow
  3: { tint: "#e0b062", mark: "sand", ink: "#b8873f" }, // desert
  4: { tint: "#1fb6d9", mark: "wave", ink: "#1b8fb0" }, // lagoon
  5: { tint: "#2c2f7a", mark: "star", ink: "#f5c84a", alpha: 0.2 }, // night
  6: { tint: "#ff4fa3", mark: "confetti", ink: "#ff4fa3" }, // carnival
  7: { tint: "#8fd3ff", mark: "frost", ink: "#4fa8e0", alpha: 0.2 }, // ice
  8: { tint: "#e2553f", mark: "ember", ink: "#ff7a2f" }, // volcano
  9: { tint: "#f5b301", mark: "sparkle", ink: "#e0a000" }, // gold
});
const THEME_MARKS = 18;
const CONFETTI = Object.freeze(["#ff4fa3", "#1fb6d9", "#f5b301", "#57b54a", "#a466ff"]);

const themeFor = (level) => THEMES[Math.min(Math.max(1, level || 1), 9)];

function drawTheme(ctx, round, cell, clock) {
  const theme = themeFor(round.level);
  if (!theme.tint) return;
  const side = round.size * cell;
  ctx.globalAlpha = theme.alpha || 0.13;
  ctx.fillStyle = theme.tint;
  ctx.fillRect(0, 0, side, side);
  // The marks sit on the same cells every time a level is drawn.
  let seed = Math.imul(round.level, 2654435761) >>> 0;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  ctx.strokeStyle = theme.ink;
  ctx.fillStyle = theme.ink;
  ctx.lineWidth = Math.max(1, cell * 0.07);
  ctx.lineCap = "round";
  for (let i = 0; i < THEME_MARKS; i++) {
    const x = (next() * round.size) * cell;
    let y = (next() * round.size) * cell;
    const phase = next() * 6.28;
    const s = cell * 0.18;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    if (theme.mark === "grass") {
      ctx.moveTo(x - s, y);
      ctx.lineTo(x - s * 0.4, y - s * 1.4);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - s * 1.8);
      ctx.moveTo(x + s, y);
      ctx.lineTo(x + s * 0.4, y - s * 1.4);
      ctx.stroke();
    } else if (theme.mark === "sand") {
      ctx.arc(x, y, s * 0.35, 0, Math.PI * 2);
      ctx.arc(x + s * 1.3, y + s * 0.5, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme.mark === "wave") {
      const dx = Math.sin(clock / 700 + phase) * s * 0.6;
      ctx.moveTo(x - s * 1.6 + dx, y);
      ctx.quadraticCurveTo(x - s * 0.8 + dx, y - s, x + dx, y);
      ctx.quadraticCurveTo(x + s * 0.8 + dx, y + s, x + s * 1.6 + dx, y);
      ctx.stroke();
    } else if (theme.mark === "star" || theme.mark === "sparkle") {
      ctx.globalAlpha = 0.2 + 0.5 * Math.abs(Math.sin(clock / 500 + phase));
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s);
      ctx.lineTo(x, y + s);
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
      y = (((y - (clock / 40) * (0.5 + phase / 12)) % side) + side) % side;
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(clock / 300 + phase));
      ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

const levelColor = (level) => LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function radial(ctx, x, y, r0, r1, stops) {
  const g = typeof ctx.createRadialGradient === "function" ? ctx.createRadialGradient(x, y, r0, x, y, r1) : null;
  if (!g || typeof g.addColorStop !== "function") return null;
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  return g;
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

// A power-up's picture, white, centered on x, y and about 2s across.
function glyph(ctx, kind, x, y, s) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, s * 0.22);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "shield") {
    ctx.moveTo(x, y - s * 0.8);
    ctx.lineTo(x + s * 0.7, y - s * 0.5);
    ctx.lineTo(x + s * 0.6, y + s * 0.2);
    ctx.quadraticCurveTo(x + s * 0.4, y + s * 0.7, x, y + s * 0.9);
    ctx.quadraticCurveTo(x - s * 0.4, y + s * 0.7, x - s * 0.6, y + s * 0.2);
    ctx.lineTo(x - s * 0.7, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "slow") {
    ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - s * 0.45);
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.35, y);
    ctx.stroke();
  } else if (kind === "magnet") {
    ctx.arc(x, y, s * 0.5, 0, Math.PI);
    ctx.moveTo(x - s * 0.5, y);
    ctx.lineTo(x - s * 0.5, y - s * 0.7);
    ctx.moveTo(x + s * 0.5, y);
    ctx.lineTo(x + s * 0.5, y - s * 0.7);
    ctx.stroke();
  } else if (kind === "ghost") {
    ctx.arc(x, y - s * 0.1, s * 0.6, Math.PI, 0);
    ctx.lineTo(x + s * 0.6, y + s * 0.75);
    ctx.lineTo(x + s * 0.3, y + s * 0.5);
    ctx.lineTo(x, y + s * 0.75);
    ctx.lineTo(x - s * 0.3, y + s * 0.5);
    ctx.lineTo(x - s * 0.6, y + s * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "scissors") {
    ctx.moveTo(x - s * 0.6, y - s * 0.7);
    ctx.lineTo(x + s * 0.4, y + s * 0.3);
    ctx.moveTo(x + s * 0.6, y - s * 0.7);
    ctx.lineTo(x - s * 0.4, y + s * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - s * 0.45, y + s * 0.55, s * 0.25, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.7, y + s * 0.55);
    ctx.arc(x + s * 0.45, y + s * 0.55, s * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.font = `900 ${Math.round(s * 1.7)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x, y + s * 0.08);
  }
}

const LEAF = "#57b54a";
const STEM = "#7a4a22";
const SHINE = "rgba(255, 255, 255, 0.7)";

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function leaf(ctx, x, y, rx, ry, tilt) {
  ctx.fillStyle = LEAF;
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
  else ctx.arc(x, y, ry, 0, Math.PI * 2);
  ctx.fill();
}

// A level's fruit, centered on x, y and about 2r across.
function drawFruit(ctx, kind, x, y, r, colors, clock) {
  ctx.lineCap = "round";
  if (kind === "cherries") {
    ctx.strokeStyle = STEM;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y + r * 0.2);
    ctx.quadraticCurveTo(x - r * 0.3, y - r * 0.5, x + r * 0.15, y - r * 0.95);
    ctx.moveTo(x + r * 0.5, y + r * 0.1);
    ctx.quadraticCurveTo(x + r * 0.35, y - r * 0.4, x + r * 0.15, y - r * 0.95);
    ctx.stroke();
    leaf(ctx, x + r * 0.45, y - r * 0.9, r * 0.32, r * 0.14, -0.4);
    dot(ctx, x - r * 0.45, y + r * 0.45, r * 0.5, FRUITS.cherries.color);
    dot(ctx, x + r * 0.5, y + r * 0.35, r * 0.5, FRUITS.cherries.color);
    dot(ctx, x - r * 0.6, y + r * 0.3, r * 0.13, SHINE);
    dot(ctx, x + r * 0.35, y + r * 0.2, r * 0.13, SHINE);
  } else if (kind === "orange") {
    dot(ctx, x, y + r * 0.05, r, FRUITS.orange.color);
    ctx.fillStyle = "rgba(160, 70, 0, 0.35)";
    for (const [dx, dy] of [[0.3, 0.3], [-0.2, 0.45], [0.45, -0.1], [-0.4, 0.05]]) ctx.fillRect(x + r * dx, y + r * dy, Math.max(1, r * 0.08), Math.max(1, r * 0.08));
    leaf(ctx, x + r * 0.25, y - r * 0.9, r * 0.35, r * 0.16, -0.5);
    dot(ctx, x - r * 0.35, y - r * 0.25, r * 0.18, SHINE);
  } else if (kind === "grapes") {
    ctx.strokeStyle = STEM;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.6);
    ctx.lineTo(x + r * 0.1, y - r * 1.0);
    ctx.stroke();
    leaf(ctx, x + r * 0.4, y - r * 0.85, r * 0.3, r * 0.14, -0.3);
    for (const [dx, dy] of [[-0.5, -0.35], [0, -0.35], [0.5, -0.35], [-0.25, 0.1], [0.25, 0.1], [0, 0.55]]) dot(ctx, x + r * dx, y + r * dy, r * 0.3, FRUITS.grapes.color);
    dot(ctx, x - r * 0.55, y - r * 0.45, r * 0.09, SHINE);
    dot(ctx, x - r * 0.05, y - r * 0.45, r * 0.09, SHINE);
  } else if (kind === "banana") {
    ctx.strokeStyle = FRUITS.banana.color;
    ctx.lineWidth = r * 0.6;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.95, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.8, Math.PI * 0.3, Math.PI * 0.6);
    ctx.stroke();
    const tip = (a) => dot(ctx, x + Math.cos(a) * r * 0.95, y - r * 0.55 + Math.sin(a) * r * 0.95, r * 0.12, STEM);
    tip(Math.PI * 0.16);
    tip(Math.PI * 0.84);
  } else if (kind === "strawberry") {
    ctx.fillStyle = FRUITS.strawberry.color;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9, y - r * 0.45);
    ctx.quadraticCurveTo(x, y - r * 0.85, x + r * 0.9, y - r * 0.45);
    ctx.quadraticCurveTo(x + r * 0.8, y + r * 0.5, x, y + r * 1.0);
    ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.5, x - r * 0.9, y - r * 0.45);
    ctx.fill();
    for (const [dx, dy] of [[-0.4, -0.15], [0.05, -0.2], [0.45, -0.1], [-0.2, 0.25], [0.25, 0.25], [0, 0.6]]) dot(ctx, x + r * dx, y + r * dy, Math.max(0.8, r * 0.07), "#ffe27a");
    for (const tilt of [-0.9, 0, 0.9]) leaf(ctx, x + Math.sin(tilt) * r * 0.35, y - r * 0.68, r * 0.32, r * 0.13, tilt);
  } else if (kind === "watermelon") {
    // A slice, rind down.
    ctx.fillStyle = "#2f8f3a";
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, r * 1.05, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = FRUITS.watermelon.color;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, r * 0.85, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    for (const [dx, dy] of [[-0.4, 0.05], [0, 0.2], [0.4, 0.05], [-0.15, -0.15], [0.2, -0.15]]) dot(ctx, x + r * dx, y + r * dy, Math.max(0.8, r * 0.08), "#1d1a17");
  } else if (kind === "peach") {
    dot(ctx, x, y + r * 0.05, r, FRUITS.peach.color);
    ctx.strokeStyle = "rgba(200, 70, 50, 0.45)";
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(x + r * 0.05, y - r * 0.85);
    ctx.quadraticCurveTo(x - r * 0.35, y, x + r * 0.05, y + r * 0.9);
    ctx.stroke();
    leaf(ctx, x + r * 0.35, y - r * 0.9, r * 0.4, r * 0.17, -0.5);
    dot(ctx, x + r * 0.4, y - r * 0.2, r * 0.18, SHINE);
  } else {
    // The apple, red on most levels and gold on the last, where it glints.
    const gold = kind === "golden";
    if (gold) {
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = r * 1.2;
    }
    dot(ctx, x, y + r * 0.1, r, gold ? FRUITS.golden.color : colors.food);
    ctx.shadowBlur = 0;
    leaf(ctx, x + r * 0.35, y - r * 0.8, r * 0.42, r * 0.2, -0.6);
    dot(ctx, x - r * 0.35, y - r * 0.15, r * 0.18, SHINE);
    if (gold) {
      const a = clock / 300;
      const s = r * (0.35 + 0.2 * Math.abs(Math.sin(clock / 180)));
      const gx = x + Math.cos(a) * r * 0.9;
      const gy = y + Math.sin(a) * r * 0.9;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(gx - s, gy);
      ctx.lineTo(gx + s, gy);
      ctx.moveTo(gx, gy - s);
      ctx.lineTo(gx, gy + s);
      ctx.stroke();
    }
  }
}

// The boss: the level's fruit filling its four cells, a crown on top, and one
// pip under it for each bite left. It shrinks a little with each bite.
function drawBoss(ctx, round, cell, colors, clock) {
  const f = round.food;
  const x = (f.x + 1) * cell;
  const y = (f.y + 1) * cell;
  const r = cell * (0.55 + 0.12 * f.bites) * (1 + 0.05 * Math.sin(clock / 160));
  drawFruit(ctx, fruitFor(round.level), x, y + cell * 0.1, r, colors, clock);
  const cw = cell * 0.5;
  const cy = y - r - cell * 0.05;
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - cw, cy);
  ctx.lineTo(x - cw, cy - cw * 0.7);
  ctx.lineTo(x - cw * 0.5, cy - cw * 0.3);
  ctx.lineTo(x, cy - cw * 0.9);
  ctx.lineTo(x + cw * 0.5, cy - cw * 0.3);
  ctx.lineTo(x + cw, cy - cw * 0.7);
  ctx.lineTo(x + cw, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < f.bites; i++) dot(ctx, x + (i - (f.bites - 1) / 2) * cell * 0.32, y + cell * 0.88, cell * 0.1, GOLD);
}

// The runaway fruit: the level's fruit on two pattering feet, bobbing while
// it has hops left and puffing (a sweat drop) once it is tired out.
function drawRunner(ctx, round, cell, colors, clock) {
  const rn = round.runner;
  const tired = rn.hops <= 0;
  const x = (rn.x + 0.5) * cell;
  const bob = tired ? 0 : Math.abs(Math.sin(clock / 90)) * cell * 0.08;
  const y = (rn.y + 0.45) * cell - bob;
  const r = cell * 0.3;
  const step = tired ? 0 : Math.sin(clock / 70) * cell * 0.06;
  ctx.fillStyle = colors.head;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (typeof ctx.ellipse === "function") ctx.ellipse(x + side * r * 0.5 + side * step, (rn.y + 0.88) * cell, r * 0.32, r * 0.18, 0, 0, Math.PI * 2);
    else ctx.arc(x + side * r * 0.5, (rn.y + 0.88) * cell, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFruit(ctx, fruitFor(round.level), x, y, r, colors, clock);
  if (tired) dot(ctx, x + r * 1.1, y - r * 0.6 + ((clock / 25) % (r * 0.8)), r * 0.18, "#4fa8e0");
}

// Where each cell of the snake is drawn: part way from where it was to where
// it is, so the snake glides rather than hops. A cell that jumped (a portal,
// a wrap) is drawn where it is.
function snakePoints(round, cell, t) {
  return round.snake.map((c, i) => {
    const p = round.prev && round.prev[i];
    const from = p && near(p, c) === 1 ? p : c;
    return { x: (from.x + (c.x - from.x) * t + 0.5) * cell, y: (from.y + (c.y - from.y) * t + 0.5) * cell };
  });
}

function drawBoard(ctx, round, cell, colors, clock) {
  const side = round.size * cell;
  ctx.fillStyle = colors.board;
  ctx.fillRect(-cell, -cell, side + cell * 2, side + cell * 2);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = colors.line;
  for (let y = 0; y < round.size; y++) {
    for (let x = (y + 1) % 2; x < round.size; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);
  }
  ctx.globalAlpha = 1;
  drawTheme(ctx, round, cell, clock);
  if (active(round, "disco")) {
    ctx.fillStyle = `hsla(${Math.round(clock / 6) % 360}, 90%, 60%, 0.16)`;
    ctx.fillRect(0, 0, side, side);
  }
  // The frame takes the level's color; Ghost dashes it, since walls wrap.
  ctx.strokeStyle = active(round, "ghost") ? POWERS.ghost.color : levelColor(round.level);
  ctx.lineWidth = 3;
  if (typeof ctx.setLineDash === "function") ctx.setLineDash(active(round, "ghost") ? [cell * 0.5, cell * 0.3] : []);
  ctx.strokeRect(1.5, 1.5, side - 3, side - 3);
  if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
}

function drawThings(ctx, round, cell, colors, clock) {
  const mid = (c) => ({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell });
  const blink = (ttl) => ttl < 2000 && Math.floor(clock / 120) % 2 === 0;

  for (const p of round.portals || []) {
    const { x, y } = mid(p);
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k % 2 ? POWERS.ghost.color : POWERS.shield.color;
      ctx.lineWidth = Math.max(2, cell * 0.1);
      const a = (clock / (220 - k * 50)) * (k % 2 ? -1 : 1);
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.18 + 0.13 * k), a, a + Math.PI * 1.4);
      ctx.stroke();
    }
  }

  for (const r of round.rocks) {
    const x = r.x * cell;
    const y = r.y * cell;
    if (r.warn > 0) {
      ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(clock / 90));
      ctx.strokeStyle = "#e2553f";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + cell * 0.15, y + cell * 0.15, cell * 0.7, cell * 0.7);
      ctx.fillStyle = "#e2553f";
      ctx.fillRect(x + cell * 0.45, y + cell * 0.28, cell * 0.1, cell * 0.28);
      ctx.fillRect(x + cell * 0.45, y + cell * 0.62, cell * 0.1, cell * 0.1);
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.fillStyle = ROCK;
    roundRect(ctx, x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.22);
    ctx.fill();
    ctx.fillStyle = ROCK_LIGHT;
    roundRect(ctx, x + cell * 0.18, y + cell * 0.16, cell * 0.38, cell * 0.22, cell * 0.1);
    ctx.fill();
  }

  for (const c of round.coins) {
    if (blink(c.ttl)) continue;
    const { x, y } = mid(c);
    const w = Math.max(0.15, Math.abs(Math.cos(clock / 160 + c.x)));
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, cell * 0.3 * w, cell * 0.3, 0, 0, Math.PI * 2);
    else ctx.arc(x, y, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff3b0";
    ctx.fillRect(x - cell * 0.04 * w, y - cell * 0.16, cell * 0.08 * w, cell * 0.32);
  }

  if (round.food && round.food.boss) drawBoss(ctx, round, cell, colors, clock);
  else if (round.food) {
    const { x, y } = mid(round.food);
    const r = cell * 0.36 * (1 + 0.08 * Math.sin(clock / 140));
    drawFruit(ctx, fruitFor(round.level), x, y, r, colors, clock);
  }

  if (round.runner && !blink(round.runner.ttl)) drawRunner(ctx, round, cell, colors, clock);

  for (const item of round.items) {
    if (blink(item.ttl)) continue;
    const { x, y } = mid(item);
    const s = cell * 0.44 * (1 + 0.1 * Math.sin(clock / 120 + item.x));
    const color = item.kind === "mystery" ? `hsl(${Math.round(clock / 4) % 360}, 85%, 55%)` : POWERS[item.kind].color;
    ctx.shadowColor = color;
    ctx.shadowBlur = cell * 0.6;
    ctx.fillStyle = color;
    roundRect(ctx, x - s, y - s, s * 2, s * 2, s * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;
    glyph(ctx, item.kind, x, y, s * 0.75);
  }

  for (const c of round.comets) {
    const { x, y } = mid(c);
    if (c.warn > 0) {
      if (Math.floor(clock / 150) % 2) continue;
      ctx.strokeStyle = COMET;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.4, 0, Math.PI * 2);
      ctx.moveTo(x - cell * 0.6, y);
      ctx.lineTo(x + cell * 0.6, y);
      ctx.moveTo(x, y - cell * 0.6);
      ctx.lineTo(x, y + cell * 0.6);
      ctx.stroke();
      continue;
    }
    c.trail.forEach((t, i) => {
      const p = mid(t);
      ctx.globalAlpha = 0.5 - i * 0.09;
      ctx.fillStyle = "#ff8a1f";
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * (0.32 - i * 0.05), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowColor = COMET;
    ctx.shadowBlur = cell * 0.8;
    ctx.fillStyle = "#fff6c2";
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // An orange rim, so the pale core still shows on a light board.
    ctx.strokeStyle = "#ff8a1f";
    ctx.lineWidth = Math.max(2, cell * 0.08);
    ctx.stroke();
  }
}

function drawSnake(ctx, round, cell, colors, clock, t, dead) {
  const pts = snakePoints(round, cell, t);
  const disco = active(round, "disco");
  const hue = (i) => `hsl(${(Math.round(clock / 5) + i * 18) % 360}, 85%, 55%)`;
  ctx.globalAlpha = active(round, "ghost") ? 0.55 : 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = pts.length - 1; i > 0; i--) {
    const a = pts[i];
    const b = pts[i - 1];
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > cell * 1.5) continue;
    ctx.strokeStyle = disco ? hue(i) : colors.snake;
    ctx.lineWidth = cell * (0.5 + 0.28 * (1 - i / pts.length));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  const h = pts[0];
  ctx.fillStyle = disco ? hue(0) : colors.head;
  ctx.beginPath();
  ctx.arc(h.x, h.y, cell * 0.46, 0, Math.PI * 2);
  ctx.fill();
  // Eyes look the way the snake is going; a crash crosses them out.
  const d = round.dir;
  const px = -d.y;
  const py = d.x;
  for (const side of [-1, 1]) {
    const ex = h.x + d.x * cell * 0.14 + px * side * cell * 0.2;
    const ey = h.y + d.y * cell * 0.14 + py * side * cell * 0.2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2);
    ctx.fill();
    if (dead) {
      ctx.strokeStyle = "#1d1a17";
      ctx.lineWidth = Math.max(1, cell * 0.05);
      ctx.beginPath();
      ctx.moveTo(ex - cell * 0.07, ey - cell * 0.07);
      ctx.lineTo(ex + cell * 0.07, ey + cell * 0.07);
      ctx.moveTo(ex + cell * 0.07, ey - cell * 0.07);
      ctx.lineTo(ex - cell * 0.07, ey + cell * 0.07);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#1d1a17";
      ctx.beginPath();
      ctx.arc(ex + d.x * cell * 0.04, ey + d.y * cell * 0.04, cell * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // On ice, a turn still sliding shows as a frosty arrow off the head, the way
  // it will go.
  if (icy(round) && round.queue.length && !dead) {
    const q = round.queue[0];
    const ax = h.x + q.x * cell * 0.85;
    const ay = h.y + q.y * cell * 0.85;
    ctx.strokeStyle = THEMES[ICE_LEVEL].ink;
    ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(clock / 80));
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax - q.x * cell * 0.25 - q.y * cell * 0.25, ay - q.y * cell * 0.25 - q.x * cell * 0.25);
    ctx.lineTo(ax, ay);
    ctx.lineTo(ax - q.x * cell * 0.25 + q.y * cell * 0.25, ay - q.y * cell * 0.25 + q.x * cell * 0.25);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < round.shield; i++) {
    ctx.strokeStyle = POWERS.shield.color;
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(clock / 110 + i);
    ctx.lineWidth = Math.max(2, cell * 0.08);
    ctx.beginPath();
    ctx.arc(h.x, h.y, cell * (0.62 + i * 0.16), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return h;
}

// Lights out: the board goes dark but for a pool of light round the head, and
// the food still glints so there is something to steer for.
function drawDark(ctx, round, cell, head, clock) {
  const side = round.size * cell;
  const shade = radial(ctx, head.x, head.y, cell * 1.4, cell * 4.5, [[0, "rgba(0, 0, 0, 0)"], [1, "rgba(0, 0, 0, 0.94)"]]);
  if (!shade) return;
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, side, side);
  if (round.food) {
    const at = round.food.boss ? 1 : 0.5;
    ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(clock / 200));
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc((round.food.x + at) * cell, (round.food.y + at) * cell, cell * (round.food.boss ? 0.2 : 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${Math.round(h * 0.62)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = h * 0.7 + text.length * h * 0.42;
  drawPill(ctx, x, y, w, h, text, color, fill, y + h / 2 + 1);
  return w;
}

const EFFECT_LABELS = Object.freeze({ slow: "SLOW", magnet: "MAGNET", ghost: "GHOST", lightsOut: "DARK", disco: "DISCO x3" });

// The level, the combo and each running effect, small along the top.
function drawHud(ctx, round, cell) {
  const h = Math.max(14, cell * 0.72);
  let x = cell * 0.25;
  const y = cell * 0.2;
  x += pill(ctx, x, y, h, `LV ${round.level}`, levelColor(round.level)) + 6;
  if (round.combo > 1) x += pill(ctx, x, y, h, `x${round.combo} COMBO`, GOLD, round.comboMs / COMBO_MS) + 6;
  if (round.shield > 0) x += pill(ctx, x, y, h, round.shield > 1 ? "SHIELD x2" : "SHIELD", POWERS.shield.color) + 6;
  if (icy(round)) x += pill(ctx, x, y, h, "ICE", THEMES[ICE_LEVEL].tint) + 6;
  for (const [kind, left] of Object.entries(round.effects)) {
    const spec = POWERS[kind] || SURPRISES[kind];
    if (!spec || !EFFECT_LABELS[kind]) continue;
    x += pill(ctx, x, y, h, EFFECT_LABELS[kind], spec.color, left / spec.ms) + 6;
  }
}

// A banner is a light strip BANNER_ROWS cells tall. It opens on the half of
// the board away from the head, and while the head or the cells just ahead of
// it are under the strip it fades to BANNER_SEE_THROUGH, so it never hides
// what the snake is about to run into.
const BANNER_ROWS = 2.8;
const BANNER_AHEAD = 4;
const BANNER_SEE_THROUGH = 0.12;
const BANNER_FADE_MS = 140;
const BANNER_SHADE = "rgba(0, 0, 0, 0.3)";

// The row a banner centers on: the bottom part of the board when the head is
// in the top half, else the top part (below the HUD).
const bannerRow = (round) => (round.snake[0].y < round.size / 2 ? round.size * 0.74 : round.size * 0.3);

// Whether the head, or a cell it reaches in the next few steps, is under a
// banner centered on `row`.
function underBanner(round, row) {
  const reach = BANNER_ROWS / 2 + 0.5;
  const head = round.snake[0];
  for (let i = 0; i <= BANNER_AHEAD; i++) {
    if (Math.abs(head.y + round.dir.y * i + 0.5 - row) < reach) return true;
  }
  return false;
}

function drawBanner(ctx, b, side, cell) {
  const p = 1 - b.life / b.max;
  const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.55 : p < 0.22 ? 1.15 - ((p - 0.12) / 0.1) * 0.15 : 1;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  const y = b.row * cell;
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, y - cell * (BANNER_ROWS / 2), side, cell * BANNER_ROWS);
  if (b.tag) label(ctx, b.tag, side / 2, y - cell * 0.95, cell * 0.48, GOLD);
  label(ctx, b.title, side / 2, y - cell * 0.1, cell * 1.1 * pop, b.color);
  if (b.sub) label(ctx, b.sub, side / 2, y + cell * 0.85, cell * 0.55, "#ffffff");
  ctx.globalAlpha = 1;
}

// The ready and over screens' strip along the bottom: a line or two, then one
// dot per thing to find, lit for those found.
function drawTally(ctx, side, cell, lines, found) {
  const top = side - cell * 4.2;
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, side, cell * 4.2);
  lines.forEach((text, i) => label(ctx, text, side / 2, top + cell * (0.8 + i * 1.0), cell * (i ? 0.58 : 0.7), i ? "#ffffff" : GOLD));
  const r = Math.min(cell * 0.32, (side - cell * 2) / DISCOVERIES.length / 2.6);
  const gap = r * 2.6;
  let x = side / 2 - ((DISCOVERIES.length - 1) * gap) / 2;
  const y = top + cell * 3.25;
  DISCOVERIES.forEach((id, i) => {
    ctx.beginPath();
    ctx.arc(x + i * gap, y, r, 0, Math.PI * 2);
    if (found & tallyBit(id)) {
      ctx.fillStyle = discoveryColor(id);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

const countBits = (n) => DISCOVERIES.reduce((sum, id) => sum + (n & tallyBit(id) ? 1 : 0), 0);

// The over screen's nudge to play again: the next level not yet seen, else how
// much is still hidden.
function teaser(found) {
  const level = Object.keys(LEVELS).find((l) => !(found & tallyBit(`level:${l}`)));
  if (level) return `Something new waits at level ${level}...`;
  const left = DISCOVERIES.length - countBits(found);
  if (left) return `${left} ${left === 1 ? "surprise is" : "surprises are"} still hidden. One more go?`;
  return "You have found them all. Now beat your best!";
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 400;

// How long a timed effect's hum fades over at its end, and the countdown
// ticks across the same stretch (one per EFFECT_TICK_MS).
const EFFECT_FADE_MS = 1500;
const EFFECT_TICK_MS = 300;

// The hums' reach in cells: a comet is heard from COMET_EARSHOT away, the
// portals' shimmer swells from PORTAL_EARSHOT.
const COMET_EARSHOT = 12;
const PORTAL_EARSHOT = 8;

// The pitch of a run of things in a row: a step up the scale each.
const SCALE = Object.freeze([1, 1.122, 1.26, 1.335, 1.498, 1.682, 1.888, 2]);
const scaleStep = (n) => SCALE[Math.max(0, Math.min(SCALE.length - 1, n))];

// A little pitch wobble so a sound heard often never repeats exactly; only
// the sound's pitch, never the game.
const wobble = (spread = 0.06) => 1 - spread / 2 + Math.random() * spread;

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let cell = MIN_CELL;
  let elapsed = 0;
  // The best when this round began, and whether the round has passed it.
  let bestAtStart = 0;
  let beaten = false;
  // Without a memo (the unit suite) the tally lasts as long as the game.
  let found = 0;
  try {
    found = memo ? Number(memo.get()) | 0 : 0;
  } catch {}
  // Sparks, floating points, the big banners, the shake and the flash, all
  // in cell units and ms, so a resize mid-round keeps them in place.
  let fx = null;
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], shake: 0, shakeMag: 0, flash: null, clock: 0 });
  resetFx();

  const burst = (at, color, n, speed = 6) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x: at.x + 0.5, y: at.y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 450 + Math.random() * 400, max: 850, color, size: 0.1 + Math.random() * 0.12 });
    }
  };
  const float = (at, text, color) => fx.floats.push({ x: at.x + 0.5, y: at.y + 0.2, text, color, life: 900, max: 900 });
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

  // What the sounds remember between ticks: things already heard arriving
  // (rocks, comets, items, kept weakly so a new round forgets them), quiet
  // spells for cues that must not repeat too often, and tones queued to play
  // a moment later. Only ever read for sound, never for the rules.
  let sfx = null;
  const resetSfx = () =>
    (sfx = { coins: 0, coinMs: 0, cool: {}, later: [], heartMs: 0, ticks: {}, length: 0, rocks: new WeakSet(), landed: new WeakSet(), comets: new WeakSet(), launched: new WeakSet(), items: new WeakSet(), passed: new WeakSet() });
  resetSfx();
  // Whether a cue that sounded within the last `ms` should stay quiet; if
  // not, it starts a fresh quiet spell and may play.
  const hush = (key, ms) => {
    if (sfx.cool[key] > 0) return true;
    sfx.cool[key] = ms;
    return false;
  };

  // A first sighting lights its dot for good and tags its banner.
  const discover = (id, b) => {
    if (!DISCOVERIES.includes(id) || found & tallyBit(id)) return;
    found |= tallyBit(id);
    tone("sparkle", 0.45);
    try {
      if (memo) memo.set(found);
    } catch {}
    if (b) b.tag = `NEW DISCOVERY ${countBits(found)} / ${DISCOVERIES.length}`;
  };

  const handle = (e) => {
    const at = { x: e.x, y: e.y };
    if (e.type === "eat") {
      // The bite climbs a step per combo; a combo adds a crunch over it.
      const climb = scaleStep(e.combo - 1);
      tone("eat", 1, climb * wobble(0.04));
      burst(at, (FRUITS[e.fruit] && FRUITS[e.fruit].color) || colors.food, e.boss ? 50 : 12, e.boss ? 11 : 6);
      if (e.boss) {
        tone("levelup");
        tone("snakeBossDown", 0.9);
        shake(350, 0.25);
        flash(GOLD, 300);
      }
      float(at, `+${e.points}`, e.combo > 1 ? GOLD : "#ffffff");
      if (e.combo > 1) {
        tone("combo", 1, climb);
        tone("snakeChomp", 0.7, climb);
      }
    } else if (e.type === "coin") {
      // Coins grabbed in quick succession climb the scale.
      sfx.coins = sfx.coinMs > 0 ? sfx.coins + 1 : 0;
      sfx.coinMs = 1200;
      tone("coin", 1, scaleStep(sfx.coins));
      burst(at, GOLD, 8, 4);
      float(at, `+${e.points}`, GOLD);
    } else if (e.type === "power") {
      const spec = POWERS[e.kind];
      tone("power");
      if (e.kind === "shield") tone("shieldUp", 0.8);
      else if (e.kind === "slow") tone("snakeSlowOn", 0.8);
      else if (e.kind === "magnet") tone("snakeMagnetOn", 0.8);
      else if (e.kind === "ghost") tone("snakeGhostOn", 0.8);
      else if (e.kind === "scissors") tone("snakeSnip", 0.9);
      burst(at, spec.color, 24, 8);
      if (e.points) float(at, `+${e.points}`, spec.color);
      discover(`power:${e.kind}`, banner(spec.name, spec.blurb, spec.color, 1400));
    } else if (e.type === "surprise") {
      const spec = SURPRISES[e.kind];
      // A box opens with its jingle; chaos needs no box, so it rises in.
      if (e.chaos) tone("riser", 0.6);
      else tone("mystery");
      if (e.kind === "jackpot") tone("snakeJackpot", 0.9);
      else if (e.kind === "goldRush") {
        tone("coinUp", 0.8);
        tone("sparkle", 0.6);
      } else if (e.kind === "quake") {
        tone("rumbleLong", 1);
        tone("crumble", 0.8);
      } else if (e.kind === "meteors") tone("warn", 0.5);
      else if (e.kind === "lightsOut") tone("snakeLightsOut", 0.9);
      else if (e.kind === "disco") tone("snakeDisco", 0.9);
      else if (e.kind === "bigSnack") tone("snakeGulp", 0.9);
      else if (e.kind === "treasure") tone("powerUp", 0.8);
      // Comet call's comet sounds its own alert as it appears.
      burst(at, spec.color, 30, 9);
      flash(spec.color);
      shake(200, 0.15);
      if (e.points) float(at, `+${e.points}`, spec.color);
      discover(`surprise:${e.kind}`, banner(spec.title, spec.sub, spec.color));
    } else if (e.type === "level") {
      const spec = LEVELS[e.level];
      tone("levelup");
      tone("snakeLevel", 0.9, 1 + 0.04 * (e.level - 2));
      if (LEVELS[e.level]) tone("cheer", 0.35);
      flash(levelColor(e.level), 400);
      discover(`level:${e.level}`, banner(`Level ${e.level}`, spec ? `${spec.title}: ${spec.sub}` : "Faster and wilder", levelColor(e.level), 2200));
      // The new level's fruit names itself, once, where it sits.
      const fruit = FRUITS[fruitFor(e.level)];
      if (round.food && fruit !== FRUITS[fruitFor(e.level - 1)]) float(round.food, fruit.name, fruit.color || colors.food);
      if (round.snake[0]) float(round.snake[0], POWERS.slow.name, POWERS.slow.color);
    } else if (e.type === "shield") {
      tone("shield");
      tone("snakeShieldHit", 0.9);
      burst(at, POWERS.shield.color, 20, 7);
      float(at, "Saved!", POWERS.shield.color);
      shake(150, 0.12);
    } else if (e.type === "smash") {
      tone("boom");
      tone("smash", 0.8, wobble());
      burst(at, ROCK_LIGHT, 20, 8);
      float(at, `+${e.points}`, "#ffffff");
      shake(220, 0.2);
    } else if (e.type === "portal") {
      tone("tunnel");
      tone("warp", 0.6, wobble());
      burst(e.from, POWERS.ghost.color, 12, 5);
      burst(e.to, POWERS.shield.color, 12, 5);
    } else if (e.type === "zap") {
      tone("zap");
      tone("zapBig", 0.7);
      burst(at, COMET, 22, 8);
      float(at, `-${e.lost}`, COMET);
      shake(250, 0.22);
    } else if (e.type === "boss") {
      tone("mystery");
      tone("bossIntro", 0.7);
      shake(220, 0.15);
      burst(at, GOLD, 24, 7);
      discover("special:boss", banner(SPECIALS.boss.title, SPECIALS.boss.sub, SPECIALS.boss.color, 1600));
    } else if (e.type === "bite") {
      tone("boom");
      tone("snakeBite", 0.9, scaleStep(BOSS_BITES - e.left));
      burst(at, FRUITS[fruitFor(round.level)].color || colors.food, 16, 7);
      float(at, `+${e.points}  ${e.left} left`, GOLD);
      shake(160, 0.12);
    } else if (e.type === "runner") {
      tone("tunnel");
      tone("snakeRunner", 0.7);
      discover("special:runaway", banner(SPECIALS.runaway.title, SPECIALS.runaway.sub, SPECIALS.runaway.color, 1400));
    } else if (e.type === "hop") {
      tone("snakeHop", 0.45, wobble(0.2));
      burst(e.from, "#ffffff", 6, 3);
    } else if (e.type === "caught") {
      tone("coin");
      tone("combo");
      tone("snakeChomp", 0.8);
      burst(at, FRUITS[e.fruit].color || colors.food, 26, 9);
      float(at, `Caught! +${e.points}`, GOLD);
    } else if (e.type === "escape") {
      tone("snakeEscape", 0.6);
      float(at, "Got away!", "#ffffff");
    } else if (e.type === "portalMove") {
      tone("snakePortalShift", 0.5);
    } else if (e.type === "effectEnd") {
      // Slow-mo ends every level's opening, so it eases out with a soft rise
      // rather than the power-down the others get.
      if (e.kind === "slow") tone("snakeTimeResume", 0.45);
      else tone("powerDown", 0.5);
    } else if (e.type === "crash") {
      // What it ran into, under the crash end() plays.
      if (e.by === "wall") {
        tone("thud", 1);
        tone("hit", 0.8);
      } else if (e.by === "rock") tone("smash", 1);
      else if (e.by === "comet") tone("blast", 1);
      else tone("squish", 1);
      burst(at, colors.snake, 40, 10);
      burst(at, colors.head, 16, 6);
      shake(450, 0.35);
      flash("#e2553f", 320);
    }
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    // The crowd joins in a beat after the fanfare.
    sfx.later.push({ ms: 380, play: () => tone("sparkle", 0.6) }, { ms: 420, play: () => tone("cheer", 0.45) });
    banner("New best!", "Every point from here is a record", GOLD, 1800);
    for (let i = 0; i < 4; i++) burst({ x: Math.random() * (round.size - 1), y: Math.random() * (round.size - 1) }, ["#ff4fa3", GOLD, "#1fb6d9", "#57b54a"][i], 16, 7);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
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
      // Placed when it first shows, not when queued: the head has moved since.
      if (b.row == null) b.row = bannerRow(round);
      const target = underBanner(round, b.row) ? BANNER_SEE_THROUGH : 1;
      b.see += (target - b.see) * Math.min(1, ms / BANNER_FADE_MS);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
    }
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash) {
      fx.flash.life -= ms;
      if (fx.flash.life <= 0) fx.flash = null;
    }
  };

  // The sounds read off the board rather than off events: rocks and comets
  // arriving and landing, items popping up, a comet whizzing past the head,
  // an effect's last seconds counting down, the dark's heartbeat, the snake
  // passing a length milestone, and the tones queued for later.
  const cues = (ms) => {
    for (const k of Object.keys(sfx.cool)) sfx.cool[k] -= ms;
    sfx.coinMs -= ms;
    sfx.later = sfx.later.filter((l) => {
      l.ms -= ms;
      if (l.ms > 0) return true;
      l.play();
      return false;
    });
    let falling = 0;
    let landing = 0;
    for (const r of round.rocks) {
      if (!sfx.rocks.has(r)) {
        sfx.rocks.add(r);
        if (r.warn > 0) falling += 1;
      }
      if (!(r.warn > 0) && !sfx.landed.has(r)) {
        sfx.landed.add(r);
        landing += 1;
      }
    }
    if (falling && !hush("meteor", 400)) tone("snakeMeteor", Math.min(1, 0.35 + 0.1 * falling), wobble(0.2));
    if (landing && !hush("rockLand", 150)) tone("snakeRockLand", Math.min(1, 0.5 + 0.1 * landing), wobble(0.15));
    const head = round.snake[0];
    for (const c of round.comets) {
      if (!sfx.comets.has(c)) {
        sfx.comets.add(c);
        if (c.warn > 0) tone("snakeCometWarn", 0.6);
      }
      if (!(c.warn > 0) && !sfx.launched.has(c)) {
        sfx.launched.add(c);
        tone("snakeCometLaunch", 0.7);
      }
      // A comet flying right past the head without hitting it, once a pass.
      const close = Boolean(head) && !(c.warn > 0) && Math.max(Math.abs(c.x - head.x), Math.abs(c.y - head.y)) <= 1;
      if (close && !sfx.passed.has(c)) {
        sfx.passed.add(c);
        if (!hush("nearMiss", 600)) tone("snakeNearMiss", 0.6, wobble(0.1));
      } else if (!close) sfx.passed.delete(c);
    }
    for (const it of round.items) {
      if (sfx.items.has(it)) continue;
      sfx.items.add(it);
      tone("snakeItemPop", 0.6, it.kind === "mystery" ? 0.8 : 1.1);
    }
    // An effect's last seconds tick down, climbing (Slow-mo eases out instead).
    for (const [kind, left] of Object.entries(round.effects)) {
      const n = Math.ceil(left / EFFECT_TICK_MS);
      if (kind !== "slow" && left <= EFFECT_FADE_MS && n < (sfx.ticks[kind] ?? Infinity)) tone("tickSoft", 0.55, scaleStep(EFFECT_FADE_MS / EFFECT_TICK_MS - n));
      sfx.ticks[kind] = n;
    }
    for (const kind of Object.keys(sfx.ticks)) if (!(kind in round.effects)) delete sfx.ticks[kind];
    // In the dark, a heartbeat.
    if (active(round, "lightsOut")) {
      sfx.heartMs -= ms;
      if (sfx.heartMs <= 0) {
        sfx.heartMs = 950;
        tone("heartbeat", 0.6);
      }
    } else sfx.heartMs = 0;
    // Every ten cells of snake, a little sparkle.
    const tens = Math.floor(round.snake.length / 10);
    if (tens > sfx.length) tone("sparkle", 0.4, 0.8 + 0.05 * tens);
    sfx.length = tens;
  };

  // The held sounds, asked for every tick of a running round: the slither
  // (its rustle quickening with the pace), each running effect's own hum
  // (fading over its last seconds), the nearest flying comet (louder the
  // closer it is), the portals' shimmer (swelling as the head nears one) and
  // the wind over the ice.
  const hums = () => {
    const head = round.snake[0];
    if (!head) return;
    const speed = STEP_MS / pace(round);
    hum("snake:slither", "snakeSlither", Math.min(1, 0.45 + round.snake.length / 60), speed);
    let comet = null;
    for (const c of round.comets) if (!(c.warn > 0) && (!comet || near(c, head) < near(comet, head))) comet = c;
    if (comet) {
      const close = Math.max(0, 1 - near(comet, head) / COMET_EARSHOT);
      hum("snake:comet", "snakeComet", 0.15 + 0.85 * close, 1 + 0.3 * close);
    }
    const fade = (kind) => Math.min(1, (round.effects[kind] || 0) / EFFECT_FADE_MS);
    if (active(round, "slow")) hum("snake:slow", "snakeSlowmo", 0.8 * fade("slow"), 1);
    if (active(round, "magnet")) {
      const pull = round.food ? Math.max(0, 1 - near(round.food, head) / MAGNET_REACH) : 0;
      hum("snake:magnet", "snakeMagnet", 0.8 * fade("magnet"), 1 + 0.4 * pull);
    }
    if (active(round, "ghost")) hum("snake:ghost", "snakeGhost", fade("ghost"), 1);
    if (active(round, "lightsOut")) hum("snake:dark", "haunt", 0.8 * fade("lightsOut"), 1);
    if (active(round, "disco")) hum("snake:disco", "snakeDiscoBeat", 0.9 * fade("disco"), 1);
    if (round.portals) {
      const d = Math.min(...round.portals.map((p) => near(p, head)));
      hum("snake:portal", "snakePortal", 0.15 + 0.85 * Math.max(0, 1 - d / PORTAL_EARSHOT), 1);
    }
    if (icy(round)) hum("snake:ice", "wind", 0.5, 0.6 + 0.3 * speed);
  };

  // Whether the cell straight ahead is a landed rock or the body (not the
  // tail tip, which moves on): a turn away from one is a close shave. A wall
  // is left out, since turning at the edge is everyday steering.
  const deadlyAhead = () => {
    const head = round.snake[0];
    const c = { x: head.x + round.dir.x, y: head.y + round.dir.y };
    if (round.rocks.some((r) => !(r.warn > 0) && same(r, c))) return true;
    return round.snake.slice(0, -1).some((b) => same(b, c));
  };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    // A banner takes its place on its first frame: a frame painted before the
    // next tick (one whose step queued it) would draw it at the top.
    const shown = fx.banners[0];
    if (shown && shown.row == null) shown.row = bannerRow(round);
    const side = round.size * cell;
    const clock = fx.clock;
    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * 2 * fx.shakeMag * cell, (Math.random() - 0.5) * 2 * fx.shakeMag * cell);
    drawBoard(ctx, round, cell, colors, clock);
    drawThings(ctx, round, cell, colors, clock);
    const t = state === "running" ? Math.min(1, elapsed / pace(round)) : 1;
    const head = drawSnake(ctx, round, cell, colors, clock, t, state === "over" && Boolean(round.crashed));
    if (active(round, "lightsOut")) drawDark(ctx, round, cell, head, clock);
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect((p.x - p.size / 2) * cell, (p.y - p.size / 2) * cell, p.size * cell, p.size * cell);
    }
    ctx.globalAlpha = 1;
    for (const f of fx.floats) {
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
      label(ctx, f.text, f.x * cell, f.y * cell, cell * 0.7, f.color);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (fx.flash) {
      ctx.globalAlpha = 0.28 * (fx.flash.life / fx.flash.max);
      ctx.fillStyle = fx.flash.color;
      ctx.fillRect(0, 0, side, side);
      ctx.globalAlpha = 1;
    }
    if (state === "running" || state === "paused") drawHud(ctx, round, cell);
    if (state === "running" && fx.banners.length) drawBanner(ctx, fx.banners[0], side, cell);
    const total = `${countBits(found)} of ${DISCOVERIES.length} surprises found`;
    if (state === "ready") drawTally(ctx, side, cell, ["Every level brings something new", total], found);
    if (state === "over") drawTally(ctx, side, cell, [`Reached level ${round.level}${beaten ? " with a new best!" : ""}`, `${total}. ${teaser(found)}`], found);
  };

  const start = () => {
    colors = null;
    round = newRound();
    elapsed = 0;
    state = "running";
    resetFx();
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    resetSfx();
    paint();
  };

  // A crash ends on the game over sting and the rattle; a board filled to
  // the last cell ends on a victory. The crash blip always plays last.
  const end = () => {
    state = "over";
    if (round.crashed) {
      tone("gameOver", 0.8);
      tone("snakeRattle", 0.6);
    } else tone("victory", 1);
    tone("crash");
    onScore(round.score);
  };

  return {
    get score() {
      return round.score;
    },
    get state() {
      return state;
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
        return true;
      }
      if (!DIRS[name]) return false;
      if (state === "running" && turn(round, name)) tone("snakeTurn", 0.3, wobble(0.2));
      return true;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      if (age(round, ms) === "crash") {
        drain();
        end();
        return paint();
      }
      drain();
      elapsed += ms;
      // The step is read on each pass, so the step after food is eaten is quicker.
      while (state === "running" && elapsed >= pace(round)) {
        elapsed -= pace(round);
        const danger = deadlyAhead();
        const dir = round.dir;
        const slide = round.slide;
        const what = step(round);
        drain();
        // A full board has nowhere left for food: the round ends there.
        if (what === "crash" || !round.food) end();
        else if (danger && round.dir !== dir && !hush("nearMiss", 600)) tone("snakeNearMiss", 0.5, wobble(0.1));
        // On ice, a turn starting to slide skids.
        if (state === "running" && icy(round) && slide === 0 && round.slide === 1 && !hush("skid", 300)) tone("skid", 0.35, wobble(0.15));
      }
      if (state === "running") {
        cues(ms);
        hums();
      }
      paint();
    },
    resize(w, h) {
      const next = Math.floor(Math.min(w, h) / GRID);
      if (!(next >= MIN_CELL)) return false;
      cell = next;
      colors = null;
      const ratio = (typeof devicePixelRatio === "number" && devicePixelRatio > 0) ? devicePixelRatio : 1;
      const side = GRID * cell;
      canvas.width = Math.round(side * ratio);
      canvas.height = Math.round(side * ratio);
      if (canvas.style) {
        canvas.style.width = `${side}px`;
        canvas.style.height = `${side}px`;
      }
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
      return true;
    },
  };
}

export default Object.freeze({ id: "snake", title: "Snake", create });
