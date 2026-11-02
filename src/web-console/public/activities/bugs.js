// Plan2Code Web Console - Bug Hunt, the fourth activity: rules, waves, bosses, drawing and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, spawnWave,
// advance, applyPower), exported so the unit suite can drive them without a
// canvas; the default export is the contract every listed game answers.
//
// Planny's ship slides along the bottom and fires up at waves of bugs that
// swoop in from the sides into a swaying formation, then break off and dive.
// Every wave is a little bigger, the first few each bring a new kind of bug,
// and every BOSS_EVERY waves is a boss. Squashed bugs drop coins and now and
// then a power-up, and quick kills build a combo. Every bug, boss and power-up
// a player has ever met is one bit of a saved tally (the host's memo), so the
// start and end screens can say how much is still out there.

import { drawPill, LIVES, livesText } from "./pills.js";

// The field, in units. The canvas is a whole number of pixels a unit.
export const W = 48;
export const H = 36;

// Below this many pixels a unit, the board is too small to play.
export const MIN_CELL = 8;

// The ship: how fast it slides (units a second), its size, and the band at
// the bottom it may move in.
const SHIP_SPEED = 24;
const SHIP_R = 1.1;
const SHIP_Y = 32.5;
const SHIP_TOP = 26;
const SHIP_BOTTOM = 34.5;

// Shots: their speed, and the ms between two while fire is held.
const SHOT_SPEED = 46;
export const FIRE_MS = 170;
const RAPID_FIRE_MS = 85;

// A hit takes a life; the ship comes back after RESPAWN_MS and cannot be hit
// for INVULN_MS more.
export const START_LIVES = 3;
const MAX_LIVES = 5;
export const RESPAWN_MS = 1000;
export const INVULN_MS = 2200;
const MAX_SHIELDS = 2;

// A kill within COMBO_MS of the last raises the combo, which multiplies the
// kill's points, up to MAX_COMBO.
export const COMBO_MS = 1200;
export const MAX_COMBO = 5;

// Between waves the board rests for CLEAR_MS. A wave cleared scores
// CLEAR_POINTS a wave, and PERFECT_POINTS a wave more without a hit taken.
export const CLEAR_MS = 1800;
export const CLEAR_POINTS = 50;
export const PERFECT_POINTS = 100;

// Every this many waves is a boss, worth BOSS_POINTS for each time round.
export const BOSS_EVERY = 5;
export const BOSS_POINTS = 500;

// What a squashed bug drops, and how fast it falls.
const DROP_CHANCE = 0.07;
const COIN_CHANCE = 0.25;
export const COIN_POINTS = 20;
const ITEM_FALL = 7;
const COIN_FALL = 9;
const MAGNET_REACH = 14;
const PICKUP_REACH = 2;

// The way in: a bug swoops from the side into its slot over ENTER_MS, one
// after another ENTER_GAP ms apart.
const ENTER_MS = 1800;
const ENTER_GAP = 70;

// Time is handed out in slices this long, so a long frame never moves a shot
// through a bug without touching it.
const SLICE_MS = 8;

const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

const GOLD = "#f5b301";
const DANGER = "#e2553f";

// The bugs, each from the wave it first turns up in.
export const BUGS = deepFreeze({
  ant: { name: "Bug", blurb: "The everyday kind", color: "#e2553f", hp: 1, points: 10, r: 1.1, from: 1 },
  beetle: { name: "Beetle", blurb: "Splits in two when squashed", color: "#2fbf71", hp: 2, points: 20, r: 1.3, from: 2 },
  zigzag: { name: "Race condition", blurb: "Zigzags as it dives", color: "#f5b301", hp: 1, points: 25, r: 1.1, from: 3 },
  spitter: { name: "Exception", blurb: "It throws things at you", color: "#ff8a1f", hp: 2, points: 30, r: 1.2, from: 4 },
  blinker: { name: "Null pointer", blurb: "Shots pass through it while it fades", color: "#a466ff", hp: 1, points: 30, r: 1.1, from: 6 },
  firewall: { name: "Firewall", blurb: "Soaks up shots and never dives", color: "#1fb6d9", hp: 5, points: 40, r: 1.7, from: 7 },
});

// The bosses, in the order they come round. Each time round they take more.
export const BOSSES = deepFreeze({
  leak: { name: "Memory Leak", sub: "It grows while you wait", color: "#ff4fa3", hp: 60 },
  spaghetti: { name: "Spaghetti Monster", sub: "Cut the tentacles first", color: "#e0b400", hp: 50 },
  heisen: { name: "Heisenbug", sub: "Only there when you look", color: "#4f7cff", hp: 70 },
});
const BOSS_ORDER = Object.freeze(Object.keys(BOSSES));
const TENTACLE_HP = 8;

// The power-ups. A timed one lasts `ms`; the rest act at once.
export const POWERS = deepFreeze({
  spread: { name: "Spread shot", blurb: "Three shots at once", color: "#ff8a1f", ms: 9000, weight: 3 },
  rapid: { name: "Rapid fire", blurb: "Twice the shots", color: "#e04dd0", ms: 9000, weight: 3 },
  shield: { name: "Shield", blurb: "Shrug off one hit", color: "#1fb6d9", weight: 3 },
  slow: { name: "Slow-mo", blurb: "The bugs crawl", color: "#57b54a", ms: 6000, weight: 2 },
  magnet: { name: "Magnet", blurb: "Coins come to you", color: "#a466ff", ms: 10000, weight: 2 },
  refactor: { name: "Refactor", blurb: "Cleans up the whole screen", color: "#f5b301", weight: 1 },
  life: { name: "1UP", blurb: "An extra life", color: "#ff4fa3", weight: 1 },
});

// Everything a player can meet, in tally-bit order. The order is saved, so
// new entries only ever go on the end.
export const DISCOVERIES = Object.freeze([...Object.keys(BUGS).map((k) => `bug:${k}`), ...BOSS_ORDER.map((k) => `boss:${k}`), ...Object.keys(POWERS).map((k) => `power:${k}`)]);

// Each run of waves between bosses has its own scenery.
export const SECTORS = deepFreeze({
  0: { title: "The Codebase", tint: null, ink: "#8a8f99", frame: "#57b54a" },
  1: { title: "Legacy Code", tint: "#c98b4a", ink: "#a8743a", frame: "#c98b4a" },
  2: { title: "Production", tint: "#e2553f", ink: "#c94a36", frame: "#e2553f" },
  3: { title: "The Cloud", tint: "#4f7cff", ink: "#4f7cff", frame: "#4f7cff" },
});
export const sectorFor = (wave) => SECTORS[Math.min(3, Math.floor(Math.max(0, wave - 1) / BOSS_EVERY))];

export const active = (round, kind) => Boolean(round.effects && round.effects[kind] > 0);

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pickOf = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/* ---------------------------------------------------------------- rules */

// How much quicker everything moves on this wave.
const speedOf = (round) => 1 + Math.min(0.8, (round.wave - 1) * 0.04);

export function newRound(random = Math.random) {
  const round = {
    wave: 0,
    lives: START_LIVES,
    score: 0,
    combo: 1,
    comboMs: 0,
    kills: 0,
    ship: { x: W / 2, y: SHIP_Y, alive: true, invuln: 0, respawn: 0 },
    input: { left: false, right: false, up: false, down: false, fire: false },
    fireMs: 0,
    shots: [],
    bugs: [],
    bombs: [],
    items: [],
    boss: null,
    effects: {},
    shield: 0,
    clock: 0,
    waveClock: 0,
    nextDive: 0,
    clearMs: 0,
    cols: 6,
    waveHit: false,
    over: false,
    events: [],
  };
  spawnWave(round, random);
  return round;
}

// Where a formation slot is right now: the formation sways side to side.
export function slotPos(round, slot) {
  const sway = Math.sin(round.waveClock / 1600) * 3;
  return { x: W / 2 + (slot.c - (round.cols - 1) / 2) * 3.8 + sway, y: 3.5 + slot.r * 3.2 };
}

function makeBug(kind, slot, delay, random) {
  const spec = BUGS[kind];
  const left = slot ? slot.left : random() < 0.5;
  return { kind, hp: spec.hp, x: left ? -3 : W + 3, y: 12, slot, state: slot ? "wait" : "dive", t: 0, delay, from: { x: left ? -3 : W + 3, y: 10 + (slot ? slot.r * 2 : 0) }, vx: 0, vy: 0, phase: random() * 2400, flash: 0, shot: false };
}

// The next wave: a formation of bugs, or a boss. A wave that brings a new
// kind of bug says so.
export function spawnWave(round, random = Math.random) {
  round.wave += 1;
  const n = round.wave;
  round.waveClock = 0;
  round.waveHit = false;
  round.nextDive = 3000;
  round.bugs = [];
  if (n % BOSS_EVERY === 0) {
    const turn = n / BOSS_EVERY - 1;
    const kind = BOSS_ORDER[turn % BOSS_ORDER.length];
    const cycle = Math.floor(turn / BOSS_ORDER.length);
    const hp = Math.round(BOSSES[kind].hp * (1 + 0.6 * cycle));
    round.boss = { kind, hp, max: hp, cycle, x: W / 2, y: -6, t: 0, state: "enter", fireMs: 1500, grow: 0, blur: 0, teleMs: 2600, tentacles: kind === "spaghetti" ? [0, 1, 2, 3].map((i) => ({ i, hp: TENTACLE_HP })) : [] };
    round.events.push({ type: "wave", wave: n, boss: kind });
    return round;
  }
  const pool = Object.keys(BUGS).filter((k) => BUGS[k].from <= n);
  const fresh = pool.find((k) => BUGS[k].from === n) || null;
  const rows = Math.min(5, 2 + Math.floor((n + 1) / 3));
  const cols = Math.min(10, 6 + Math.floor(n / 4));
  round.cols = cols;
  // The newest kinds ride at the top, the everyday ones at the bottom.
  const order = [...pool].reverse();
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let kind = order[r % order.length];
      // Firewalls only every third slot, so a row is never a wall.
      if (kind === "firewall" && c % 3 !== 1) kind = order[(r + 1) % order.length];
      const slot = { r, c, left: c < cols / 2 };
      round.bugs.push(makeBug(kind, slot, (k++ % (cols * 2)) * ENTER_GAP + Math.floor(r / 2) * 900, random));
    }
  }
  round.events.push({ type: "wave", wave: n, fresh });
  return round;
}

/* --------------------------------------------------------------- hits */

function pickPower(round, random) {
  const kinds = Object.keys(POWERS).filter((k) => k !== "life" || (round.wave >= 4 && round.lives < MAX_LIVES));
  const total = kinds.reduce((sum, k) => sum + POWERS[k].weight, 0);
  let roll = random() * total;
  for (const k of kinds) {
    roll -= POWERS[k].weight;
    if (roll < 0) return k;
  }
  return kinds[kinds.length - 1];
}

function drop(round, at, random) {
  const roll = random();
  if (roll < DROP_CHANCE) round.items.push({ x: at.x, y: at.y, kind: pickPower(round, random) });
  else if (roll < DROP_CHANCE + COIN_CHANCE) round.items.push({ x: at.x, y: at.y, kind: "coin" });
}

function scoreKill(round, base) {
  round.combo = round.comboMs > 0 ? Math.min(MAX_COMBO, round.combo + 1) : 1;
  round.comboMs = COMBO_MS;
  const points = base * round.combo;
  round.score += points;
  return points;
}

// One point of damage to a bug; at none left it is squashed, scores and may
// drop something. A beetle splits into two bugs that dive on their own.
export function hurtBug(round, b, random = Math.random) {
  b.hp -= 1;
  b.flash = 120;
  if (b.hp > 0) {
    round.events.push({ type: "hurt", x: b.x, y: b.y, kind: b.kind });
    return false;
  }
  round.bugs = round.bugs.filter((o) => o !== b);
  round.kills += 1;
  const points = scoreKill(round, BUGS[b.kind].points);
  round.events.push({ type: "kill", x: b.x, y: b.y, kind: b.kind, points, combo: round.combo });
  drop(round, b, random);
  if (b.kind === "beetle") {
    for (const side of [-1, 1]) {
      const ant = makeBug("ant", null, 0, random);
      Object.assign(ant, { x: b.x + side, y: b.y, vx: side * 8, vy: -4, state: "dive" });
      round.bugs.push(ant);
    }
    round.events.push({ type: "split", x: b.x, y: b.y });
  }
  return true;
}

function bossDown(round, random) {
  const boss = round.boss;
  round.boss = null;
  const points = BOSS_POINTS * (boss.cycle + 1);
  round.score += points;
  round.events.push({ type: "bossdown", kind: boss.kind, x: boss.x, y: boss.y, points });
  round.items.push({ x: boss.x, y: boss.y, kind: pickPower(round, random) });
  for (let i = 0; i < 5; i++) round.items.push({ x: boss.x - 4 + i * 2, y: boss.y + (i % 2), kind: "coin" });
}

// Damage to the boss, where a shot can reach it.
export function hurtBoss(round, amount, random = Math.random) {
  const boss = round.boss;
  if (!boss || boss.state === "enter") return false;
  boss.hp -= amount;
  boss.flash = 120;
  if (boss.hp <= 0) bossDown(round, random);
  return true;
}

// The ship is hit: a shield takes it, or a life goes.
export function hitShip(round) {
  const ship = round.ship;
  if (!ship.alive || ship.invuln > 0) return false;
  if (round.shield > 0) {
    round.shield -= 1;
    ship.invuln = 800;
    round.events.push({ type: "shield", x: ship.x, y: ship.y });
    return true;
  }
  if (!round.infinite) round.lives -= 1;
  round.waveHit = true;
  ship.alive = false;
  ship.respawn = RESPAWN_MS;
  round.bombs = [];
  round.effects = {};
  round.combo = 1;
  round.comboMs = 0;
  round.events.push({ type: "hit", x: ship.x, y: ship.y, lives: round.lives });
  if (round.lives <= 0) {
    round.over = true;
    round.events.push({ type: "over" });
  }
  return true;
}

export function applyPower(round, kind, random = Math.random) {
  const spec = POWERS[kind];
  const at = { x: round.ship.x, y: round.ship.y };
  if (kind === "coin") {
    round.score += COIN_POINTS;
    round.events.push({ type: "coin", ...at, points: COIN_POINTS });
    return;
  }
  if (kind === "shield") round.shield = Math.min(MAX_SHIELDS, round.shield + 1);
  else if (kind === "life") round.lives = Math.min(MAX_LIVES, round.lives + 1);
  else if (kind === "refactor") {
    round.bombs = [];
    for (const b of [...round.bugs]) {
      if (round.bugs.includes(b)) hurtBug(round, b, random);
      if (round.bugs.includes(b)) hurtBug(round, b, random);
    }
    hurtBoss(round, 10, random);
  } else if (spec.ms) round.effects[kind] = spec.ms;
  round.events.push({ type: "power", kind, ...at });
}

/* -------------------------------------------------------------- moving */

function aimed(from, to, speed, spread = 0) {
  const a = Math.atan2(to.y - from.y, to.x - from.x) + spread;
  return { x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

const bombSpeed = (round) => 13 + Math.min(10, round.wave * 0.3);
const maxBombs = (round) => 10 + Math.min(14, round.wave);

function throwBomb(round, b) {
  if (round.bombs.length >= maxBombs(round)) return;
  const target = round.ship.alive ? round.ship : { x: b.x, y: H };
  round.bombs.push(aimed(b, target, bombSpeed(round)));
}

function moveShip(round, dt) {
  const ship = round.ship;
  if (!ship.alive) {
    ship.respawn -= dt * 1000;
    if (ship.respawn <= 0 && !round.over) {
      Object.assign(ship, { alive: true, x: W / 2, y: SHIP_Y, invuln: INVULN_MS, respawn: 0 });
      round.events.push({ type: "respawn" });
    }
    return;
  }
  ship.invuln = Math.max(0, ship.invuln - dt * 1000);
  const { left, right, up, down } = round.input;
  ship.x = clamp(ship.x + (Number(right) - Number(left)) * SHIP_SPEED * dt, 2, W - 2);
  ship.y = clamp(ship.y + (Number(down) - Number(up)) * SHIP_SPEED * 0.7 * dt, SHIP_TOP, SHIP_BOTTOM);
}

function fire(round, dt) {
  round.fireMs -= dt * 1000;
  if (!round.input.fire || !round.ship.alive || round.fireMs > 0) return;
  round.fireMs = active(round, "rapid") ? RAPID_FIRE_MS : FIRE_MS;
  const { x, y } = round.ship;
  const spreads = active(round, "spread") ? [-9, 0, 9] : [0];
  for (const vx of spreads) round.shots.push({ x, y: y - 1.2, vx, vy: -SHOT_SPEED });
  round.events.push({ type: "shoot" });
}

// A blinker fades for part of each cycle, and shots pass through it then.
export const ghostly = (round, b) => b.kind === "blinker" && (round.clock + b.phase) % 2400 >= 1600;

function moveBugs(round, dt, random) {
  const sp = speedOf(round);
  const ship = round.ship;
  for (const b of [...round.bugs]) {
    b.t += dt * 1000;
    b.flash = Math.max(0, b.flash - dt * 1000);
    if (b.state === "wait") {
      if (b.t >= b.delay) {
        b.state = "enter";
        b.t = 0;
      }
      continue;
    }
    if (b.state === "enter") {
      // A swoop from the side, down and round into the slot.
      const p = Math.min(1, b.t / ENTER_MS);
      const to = slotPos(round, b.slot);
      const ctrl = { x: b.from.x < 0 ? W * 0.35 : W * 0.65, y: H * 0.6 };
      const q = 1 - p;
      b.x = q * q * b.from.x + 2 * q * p * ctrl.x + p * p * to.x;
      b.y = q * q * b.from.y + 2 * q * p * ctrl.y + p * p * to.y;
      if (p >= 1) b.state = "form";
      continue;
    }
    if (b.state === "form") {
      const to = slotPos(round, b.slot);
      b.x = to.x;
      b.y = to.y;
      if (b.kind === "spitter" && random() < (0.12 + round.wave * 0.008) * dt) throwBomb(round, b);
      continue;
    }
    if (b.state === "return") {
      const to = slotPos(round, b.slot);
      const dx = to.x - b.x;
      const dy = to.y - b.y;
      const d = Math.hypot(dx, dy);
      const step = 18 * sp * dt;
      if (d <= step) {
        b.state = "form";
        b.x = to.x;
        b.y = to.y;
      } else {
        b.x += (dx / d) * step;
        b.y += (dy / d) * step;
      }
      continue;
    }
    // Diving: a hop, then down and toward the ship, a race condition zigzagging.
    b.vy = Math.min(13 * sp + 3, b.vy + 30 * dt);
    if (ship.alive) b.vx = clamp(b.vx + Math.sign(ship.x - b.x) * 18 * dt, -9, 9);
    const zig = b.kind === "zigzag" ? Math.cos(b.t / 140) * 16 : 0;
    b.x = clamp(b.x + (b.vx + zig) * dt, 1, W - 1);
    b.y += b.vy * sp * dt;
    if (!b.shot && b.t > 450 && b.y < SHIP_TOP - 2) {
      b.shot = true;
      if (b.kind === "spitter" || random() < 0.5) throwBomb(round, b);
    }
    if (ship.alive && ship.invuln <= 0 && !ghostly(round, b) && dist2(b, ship) < (BUGS[b.kind].r + SHIP_R) ** 2) {
      hitShip(round);
      hurtBug(round, Object.assign(b, { hp: 1 }), random);
      continue;
    }
    if (b.y > H + 2) {
      b.shot = false;
      b.t = 0;
      if (b.slot) {
        b.state = "return";
        b.x = slotPos(round, b.slot).x;
        b.y = -3;
      } else {
        // A bug with no slot (a beetle's half) just dives again from the top.
        Object.assign(b, { x: 4 + random() * (W - 8), y: -2, vx: 0, vy: 4 });
      }
    }
  }
}

// Every so often a bug or two in formation breaks off and dives.
function startDives(round, dt, random) {
  round.nextDive -= dt * 1000;
  if (round.nextDive > 0) return;
  round.nextDive = Math.max(700, 2600 - round.wave * 120) * (0.7 + random() * 0.6);
  const ready = round.bugs.filter((b) => b.state === "form" && b.kind !== "firewall");
  const count = 1 + (round.wave >= 6 ? 1 : 0) + (round.wave >= 12 ? 1 : 0);
  for (let i = 0; i < count && ready.length; i++) {
    const b = ready.splice(Math.floor(random() * ready.length), 1)[0];
    Object.assign(b, { state: "dive", t: 0, vx: 0, vy: -6, shot: false });
  }
}

// Where each tentacle tip of the Spaghetti Monster is.
export function tentacleTip(boss, t) {
  const i = t.i;
  const a = [-1.1, -0.4, 0.4, 1.1][i] + Math.sin(boss.t / 500 + i) * 0.4;
  return { x: boss.x + Math.sin(a) * 7, y: boss.y + Math.cos(a) * 7 };
}

// How big the boss's body is, for hits and drawing.
export function bossRadius(boss) {
  if (boss.kind === "leak") return 3 + 2 * (boss.hp / boss.max) + boss.grow;
  return boss.kind === "heisen" ? 2.6 : 3;
}

function moveBoss(round, dt, random) {
  const boss = round.boss;
  if (!boss) return;
  const ms = dt * 1000;
  boss.t += ms;
  boss.flash = Math.max(0, (boss.flash || 0) - ms);
  if (boss.state === "enter") {
    boss.y += 6 * dt;
    if (boss.y >= 8) {
      boss.y = 8;
      boss.state = "fight";
      round.events.push({ type: "bossin", kind: boss.kind });
    }
    return;
  }
  const ship = round.ship.alive ? round.ship : { x: boss.x, y: H };
  boss.fireMs -= ms;
  if (boss.kind === "leak") {
    boss.x = W / 2 + Math.sin(boss.t / 1400) * 14;
    boss.grow = Math.min(3, boss.grow + dt * 0.15);
    if (boss.fireMs <= 0) {
      boss.fireMs = 1600 / speedOf(round);
      for (let k = -2; k <= 2; k++) round.bombs.push({ x: boss.x, y: boss.y + bossRadius(boss), vx: k * 3.5, vy: bombSpeed(round) * 0.8 });
    }
  } else if (boss.kind === "spaghetti") {
    boss.x = W / 2 + Math.sin(boss.t / 1800) * 10;
    const alive = boss.tentacles.filter((t) => t.hp > 0);
    if (boss.fireMs <= 0) {
      boss.fireMs = (alive.length ? 1200 : 700) / speedOf(round);
      if (alive.length) round.bombs.push(aimed(tentacleTip(boss, pickOf(alive, random)), ship, bombSpeed(round)));
      else round.bombs.push(aimed(boss, ship, bombSpeed(round)), aimed(boss, ship, bombSpeed(round), 0.25), aimed(boss, ship, bombSpeed(round), -0.25));
    }
  } else {
    boss.teleMs -= ms;
    if (boss.blur > 0) {
      boss.blur -= ms;
      if (boss.blur <= 0) {
        boss.blur = 0;
        boss.x = 8 + random() * (W - 16);
        boss.y = 5 + random() * 8;
        round.events.push({ type: "teleport", x: boss.x, y: boss.y });
      }
    } else if (boss.teleMs <= 0) {
      boss.teleMs = 2600;
      boss.blur = 500;
    }
    if (boss.fireMs <= 0 && boss.blur <= 0) {
      boss.fireMs = 1100 / speedOf(round);
      for (const s of [-0.22, 0, 0.22]) round.bombs.push(aimed(boss, ship, bombSpeed(round), s));
    }
  }
  round.bombs = round.bombs.slice(-maxBombs(round) * 2);
}

function moveShots(round, random) {
  const kept = [];
  for (const s of round.shots) {
    if (s.y < -2 || s.x < -2 || s.x > W + 2) continue;
    let used = false;
    for (const b of round.bugs) {
      if (b.state === "wait" || ghostly(round, b)) continue;
      if (dist2(s, b) < (BUGS[b.kind].r + 0.3) ** 2) {
        hurtBug(round, b, random);
        used = true;
        break;
      }
    }
    const boss = round.boss;
    if (!used && boss && boss.state !== "enter") {
      if (boss.kind === "spaghetti") {
        const t = boss.tentacles.find((t) => t.hp > 0 && dist2(s, tentacleTip(boss, t)) < 1.5 ** 2);
        if (t) {
          t.hp -= 1;
          used = true;
          round.events.push(t.hp > 0 ? { type: "hurt", ...tentacleTip(boss, t), kind: "tentacle" } : { type: "cut", ...tentacleTip(boss, t) });
        }
      }
      if (!used && dist2(s, boss) < (bossRadius(boss) + 0.3) ** 2) {
        used = true;
        const shielded = (boss.kind === "spaghetti" && boss.tentacles.some((t) => t.hp > 0)) || (boss.kind === "heisen" && boss.blur > 0);
        if (shielded) round.events.push({ type: "clink", x: s.x, y: s.y });
        else hurtBoss(round, 1, random);
      }
    }
    if (!used) kept.push(s);
  }
  round.shots = kept;
}

function moveBombs(round, dt) {
  const ship = round.ship;
  round.bombs = round.bombs.filter((m) => {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (ship.alive && ship.invuln <= 0 && dist2(m, ship) < (SHIP_R + 0.35) ** 2) {
      hitShip(round);
      return false;
    }
    return m.y < H + 2 && m.y > -4 && m.x > -2 && m.x < W + 2;
  });
}

function moveItems(round, dt, random) {
  const ship = round.ship;
  round.items = round.items.filter((it) => {
    it.y += (it.kind === "coin" ? COIN_FALL : ITEM_FALL) * dt;
    if (ship.alive && active(round, "magnet") && it.kind === "coin" && dist2(it, ship) < MAGNET_REACH ** 2) {
      const d = Math.hypot(ship.x - it.x, ship.y - it.y) || 1;
      it.x += ((ship.x - it.x) / d) * 22 * dt;
      it.y += ((ship.y - it.y) / d) * 22 * dt;
    }
    if (ship.alive && dist2(it, ship) < PICKUP_REACH ** 2) {
      applyPower(round, it.kind, random);
      return false;
    }
    return it.y < H + 2;
  });
}

function update(round, dt, random) {
  const ms = dt * 1000;
  round.clock += ms;
  round.waveClock += ms;
  for (const kind of Object.keys(round.effects)) {
    round.effects[kind] -= ms;
    if (round.effects[kind] <= 0) delete round.effects[kind];
  }
  round.comboMs = Math.max(0, round.comboMs - ms);
  if (round.comboMs === 0) round.combo = 1;
  // Slow-mo halves the bugs, the boss and what they throw; never you.
  const slow = active(round, "slow") ? 0.5 : 1;
  moveShip(round, dt);
  fire(round, dt);
  for (const s of round.shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  moveShots(round, random);
  if (round.clearMs > 0) {
    round.clearMs -= ms;
    if (round.clearMs <= 0) {
      round.clearMs = 0;
      spawnWave(round, random);
    }
  } else {
    startDives(round, dt * slow, random);
    moveBugs(round, dt * slow, random);
    moveBoss(round, dt * slow, random);
  }
  moveBombs(round, dt * slow);
  moveItems(round, dt, random);
  if (round.over) return;
  if (round.clearMs === 0 && !round.bugs.length && !round.boss) {
    const points = CLEAR_POINTS * round.wave + (round.waveHit ? 0 : PERFECT_POINTS * round.wave);
    round.score += points;
    round.clearMs = CLEAR_MS;
    round.events.push({ type: "clear", wave: round.wave, points, perfect: !round.waveHit });
  }
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
const CODE_MARKS = Object.freeze(["{ }", ";", "0", "1", "</>", "( )", "=>", "[ ]", "//", "#"]);
const CHECK = 2;

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

// Snake's checkerboard, scrolling down so the ship seems to fly, with faint
// bits of code drifting past faster above it, and the sector's tint.
function drawBoard(ctx, round, u, colors, clock) {
  const w = W * u;
  const h = H * u;
  ctx.fillStyle = colors.board;
  ctx.fillRect(-u, -u, w + u * 2, h + u * 2);
  const off = ((clock / 1000) * 1.5) % (CHECK * 2);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = colors.line;
  for (let row = -2; row * CHECK < H; row++) {
    const y = (row * CHECK + off) * u;
    for (let col = (row + 100) % 2; col * CHECK < W; col += 2) ctx.fillRect(col * CHECK * u, y, CHECK * u, CHECK * u);
  }
  const sector = sectorFor(round.wave);
  if (sector.tint) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = sector.tint;
    ctx.fillRect(0, 0, w, h);
  }
  // The code drifts in the same places each time, wrapping at the bottom.
  let seed = 2654435761;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = sector.ink;
  ctx.font = `700 ${Math.round(u * 0.9)}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 22; i++) {
    const x = next() * W;
    const speed = 3 + next() * 4;
    const y = ((next() * H + (clock / 1000) * speed) % (H + 4)) - 2;
    ctx.globalAlpha = 0.18 + next() * 0.15;
    ctx.fillText(CODE_MARKS[i % CODE_MARKS.length], x * u, y * u);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = sector.frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
}

// A bug, seen from above and facing down at you: legs that scuttle, a body,
// a head with eyes that follow the ship, and each kind's own mark.
function drawBug(ctx, round, b, u, clock) {
  if (b.state === "wait") return;
  const spec = BUGS[b.kind];
  const x = b.x * u;
  const y = b.y * u;
  const s = spec.r * u;
  const ghost = ghostly(round, b);
  ctx.globalAlpha = ghost ? 0.22 : 1;
  const color = b.flash > 0 ? "#ffffff" : spec.color;
  if (b.kind === "firewall") {
    // A wall plate with two eyes peeking over it.
    circle(ctx, x - s * 0.4, y - s * 0.45, s * 0.22, "#ffffff");
    circle(ctx, x + s * 0.4, y - s * 0.45, s * 0.22, "#ffffff");
    circle(ctx, x - s * 0.4, y - s * 0.38, s * 0.11, "#1d1a17");
    circle(ctx, x + s * 0.4, y - s * 0.38, s * 0.11, "#1d1a17");
    ctx.fillStyle = color;
    roundRect(ctx, x - s, y - s * 0.3, s * 2, s * 1.1, s * 0.2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = Math.max(1, u * 0.1);
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.25);
    ctx.lineTo(x + s, y + s * 0.25);
    for (const k of [-0.5, 0.5]) {
      ctx.moveTo(x + s * k, y - s * 0.3);
      ctx.lineTo(x + s * k, y + s * 0.25);
    }
    ctx.moveTo(x, y + s * 0.25);
    ctx.lineTo(x, y + s * 0.8);
    ctx.stroke();
    // A damaged wall shows its cracks.
    if (b.hp < spec.hp) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y - s * 0.2);
      ctx.lineTo(x - s * 0.3, y + s * 0.3);
      ctx.lineTo(x - s * 0.5, y + s * 0.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }
  // Legs, three a side, scuttling.
  ctx.strokeStyle = "#1d1a17";
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let k = -1; k <= 1; k++) {
    const wiggle = Math.sin(clock / 70 + k * 2 + b.phase) * s * 0.18;
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * s * 0.5, y + k * s * 0.45);
      ctx.lineTo(x + side * s * 1.05, y + k * s * 0.55 + wiggle * side);
    }
  }
  ctx.stroke();
  // Wings for a race condition, a blur of them.
  if (b.kind === "zigzag") {
    ctx.globalAlpha = (ghost ? 0.22 : 1) * 0.45;
    const flap = 0.8 + 0.2 * Math.sin(clock / 30);
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      if (typeof ctx.ellipse === "function") ctx.ellipse(x + side * s * 0.75, y - s * 0.3, s * 0.7 * flap, s * 0.4, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = ghost ? 0.22 : 1;
  }
  // The body, then the head at the front (facing down).
  ctx.fillStyle = color;
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(x, y - s * 0.1, s * 0.72, s * 0.85, 0, 0, Math.PI * 2);
  else ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
  ctx.fill();
  if (b.kind === "beetle") {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = Math.max(1, u * 0.1);
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.9);
    ctx.lineTo(x, y + s * 0.5);
    ctx.stroke();
    circle(ctx, x - s * 0.32, y - s * 0.35, s * 0.12, "rgba(0, 0, 0, 0.3)");
    circle(ctx, x + s * 0.3, y - s * 0.05, s * 0.12, "rgba(0, 0, 0, 0.3)");
  } else if (b.kind === "zigzag") {
    ctx.strokeStyle = "#1d1a17";
    ctx.lineWidth = Math.max(1, u * 0.14);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.1, y - s * 0.75);
    ctx.lineTo(x + s * 0.2, y - s * 0.35);
    ctx.lineTo(x - s * 0.2, y - s * 0.05);
    ctx.lineTo(x + s * 0.1, y + s * 0.35);
    ctx.stroke();
  } else if (b.kind === "spitter") {
    label(ctx, "!", x, y - s * 0.25, s * 1.1, "#ffffff");
  } else if (b.kind === "blinker") {
    label(ctx, "?", x, y - s * 0.25, s * 1.0, "#ffffff");
  }
  const hx = x;
  const hy = y + s * 0.7;
  circle(ctx, hx, hy, s * 0.45, b.flash > 0 ? "#ffffff" : "#1d1a17");
  // A rim in the bug's color, so the dark head still shows on a dark board.
  ctx.strokeStyle = spec.color;
  ctx.lineWidth = Math.max(1, u * 0.1);
  ctx.stroke();
  // Antennae.
  ctx.strokeStyle = "#1d1a17";
  ctx.lineWidth = Math.max(1, u * 0.08);
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(hx + side * s * 0.15, hy + s * 0.3);
    ctx.quadraticCurveTo(hx + side * s * 0.3, hy + s * 0.75, hx + side * s * 0.55, hy + s * 0.8);
  }
  ctx.stroke();
  const ship = round.ship;
  const lx = clamp((ship.x - b.x) * 0.02, -0.06, 0.06) * u;
  for (const side of [-1, 1]) {
    circle(ctx, hx + side * s * 0.2, hy + s * 0.05, s * 0.16, "#ffffff");
    circle(ctx, hx + side * s * 0.2 + lx, hy + s * 0.1, s * 0.08, "#1d1a17");
  }
  if (ghost) {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = Math.max(1, u * 0.1);
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([u * 0.3, u * 0.25]);
    ctx.beginPath();
    ctx.arc(x, y, s * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

function drawBoss(ctx, round, u, clock) {
  const boss = round.boss;
  if (!boss) return;
  const spec = BOSSES[boss.kind];
  const x = boss.x * u;
  const y = boss.y * u;
  const r = bossRadius(boss) * u;
  const color = boss.flash > 0 ? "#ffffff" : spec.color;
  if (boss.kind === "spaghetti") {
    // Noodle tentacles, each ending in a meatball you can shoot off.
    for (const t of boss.tentacles) {
      if (t.hp <= 0) continue;
      const tip = tentacleTip(boss, t);
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = u * 0.55;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (tip.x * u - x) * 0.3 + Math.sin(clock / 200 + t.i) * u * 2, (y + tip.y * u) / 2, tip.x * u, tip.y * u);
      ctx.stroke();
      circle(ctx, tip.x * u, tip.y * u, u * 1.2, "#8a4a2a");
      circle(ctx, tip.x * u - u * 0.35, tip.y * u - u * 0.35, u * 0.3, "#b06a40");
    }
  }
  ctx.globalAlpha = boss.kind === "heisen" && boss.blur > 0 ? 0.25 + 0.25 * Math.abs(Math.sin(clock / 40)) : 1;
  if (boss.kind === "leak") {
    // A wobbling blob, dripping.
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const rr = r * (1 + 0.07 * Math.sin(a * 5 + clock / 180));
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (k) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    const drip = ((clock / 600) % 1) * u * 2.5;
    circle(ctx, x + r * 0.3, y + r + drip, u * 0.45, spec.color);
  } else if (boss.kind === "spaghetti") {
    circle(ctx, x, y, r, color);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = Math.max(1, u * 0.15);
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(k * 1.3) * r * 0.3, y + Math.sin(k * 1.7) * r * 0.3, r * 0.45, k, k + 2.2);
      ctx.stroke();
    }
  } else {
    circle(ctx, x, y, r, color);
    label(ctx, "?", x, y - r * 0.15, r * 1.1, "#ffffff");
  }
  // Big eyes that follow the ship.
  const lx = clamp((round.ship.x - boss.x) * 0.03, -0.25, 0.25) * u;
  for (const side of [-1, 1]) {
    circle(ctx, x + side * r * 0.38, y + r * 0.25, r * 0.22, "#ffffff");
    circle(ctx, x + side * r * 0.38 + lx, y + r * 0.32, r * 0.11, "#1d1a17");
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx, round, u, colors, clock) {
  const ship = round.ship;
  if (!ship.alive) return;
  if (ship.invuln > 0 && Math.floor(clock / 90) % 2) return;
  const x = ship.x * u;
  const y = ship.y * u;
  const s = u * 1.3;
  // Flames under the ship, flickering.
  const flick = 0.7 + 0.3 * Math.sin(clock / 25);
  ctx.fillStyle = "#ff8a1f";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.35, y + s * 0.55);
  ctx.lineTo(x, y + s * (0.95 + 0.5 * flick));
  ctx.lineTo(x + s * 0.35, y + s * 0.55);
  ctx.closePath();
  ctx.fill();
  // Wings in your color, then the body.
  ctx.fillStyle = colors.you;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.4);
  ctx.lineTo(x + s * 1.1, y + s * 0.6);
  ctx.lineTo(x + s * 0.35, y + s * 0.45);
  ctx.lineTo(x - s * 0.35, y + s * 0.45);
  ctx.lineTo(x - s * 1.1, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, s * 0.5, s * 0.9, 0, 0, Math.PI * 2);
  else ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
  ctx.fill();
  // The cockpit: Planny's star eye, in the board's color on your ink.
  circle(ctx, x, y - s * 0.1, s * 0.4, colors.head);
  ctx.fillStyle = colors.board;
  star(ctx, x, y - s * 0.1, s * 0.27, s * 0.12);
  ctx.fill();
  for (let i = 0; i < round.shield; i++) {
    ctx.strokeStyle = POWERS.shield.color;
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(clock / 110 + i);
    ctx.lineWidth = Math.max(2, u * 0.15);
    ctx.beginPath();
    ctx.arc(x, y + s * 0.1, s * (1.35 + i * 0.3), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function glyph(ctx, kind, x, y, s) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, s * 0.22);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "spread") {
    for (const a of [-0.5, 0, 0.5]) {
      ctx.moveTo(x, y + s * 0.7);
      ctx.lineTo(x + Math.sin(a) * s * 0.9, y + s * 0.7 - Math.cos(a) * s * 1.3);
    }
    ctx.stroke();
  } else if (kind === "rapid") {
    for (const dx of [-0.35, 0.35]) {
      ctx.moveTo(x + dx * s, y + s * 0.7);
      ctx.lineTo(x + dx * s, y - s * 0.7);
    }
    ctx.stroke();
  } else if (kind === "shield") {
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
  } else if (kind === "refactor") {
    star(ctx, x, y, s * 0.9, s * 0.4);
    ctx.fill();
  } else if (kind === "life") {
    ctx.moveTo(x, y + s * 0.8);
    ctx.bezierCurveTo(x - s * 1.1, y, x - s * 0.6, y - s * 0.9, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 0.9, x + s * 1.1, y, x, y + s * 0.8);
    ctx.fill();
  }
}

function drawItems(ctx, round, u, clock) {
  for (const it of round.items) {
    const x = it.x * u;
    const y = it.y * u;
    if (it.kind === "coin") {
      const w = Math.max(0.15, Math.abs(Math.cos(clock / 160 + it.x)));
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, u * 0.6 * w, u * 0.6, 0, 0, Math.PI * 2);
      else ctx.arc(x, y, u * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff3b0";
      ctx.fillRect(x - u * 0.07 * w, y - u * 0.32, u * 0.14 * w, u * 0.64);
      continue;
    }
    const color = POWERS[it.kind].color;
    const s = u * 0.85 * (1 + 0.1 * Math.sin(clock / 120 + it.x));
    ctx.shadowColor = color;
    ctx.shadowBlur = u;
    ctx.fillStyle = color;
    roundRect(ctx, x - s, y - s, s * 2, s * 2, s * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;
    glyph(ctx, it.kind, x, y, s * 0.7);
  }
}

function drawShots(ctx, round, u, colors) {
  ctx.lineCap = "round";
  ctx.shadowColor = colors.you;
  ctx.shadowBlur = u * 0.8;
  ctx.strokeStyle = colors.you;
  ctx.lineWidth = u * 0.42;
  ctx.beginPath();
  for (const s of round.shots) {
    ctx.moveTo(s.x * u, s.y * u);
    ctx.lineTo((s.x - s.vx * 0.02) * u, (s.y + 0.9) * u);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = u * 0.14;
  ctx.stroke();
  for (const m of round.bombs) {
    ctx.shadowColor = DANGER;
    ctx.shadowBlur = u * 0.8;
    circle(ctx, m.x * u, m.y * u, u * 0.45, DANGER);
    ctx.shadowBlur = 0;
    circle(ctx, m.x * u, m.y * u, u * 0.18, "#fff0d8");
  }
}

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${Math.round(h * 0.62)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = h * 0.7 + text.length * h * 0.42;
  drawPill(ctx, x, y, w, h, text, color, fill, y + h / 2 + 1);
  return w;
}

const EFFECT_LABELS = Object.freeze({ spread: "SPREAD", rapid: "RAPID", slow: "SLOW-MO", magnet: "MAGNET" });

// The wave, lives, the combo, shields and each running power, along the top,
// and the boss's health under them while there is one.
function drawHud(ctx, round, u) {
  const h = Math.max(14, u * 1.05);
  let x = u * 0.5;
  const y = u * 0.45;
  x += pill(ctx, x, y, h, `WAVE ${round.wave}`, sectorFor(round.wave).frame) + 6;
  x += pill(ctx, x, y, h, livesText(round.infinite ? Infinity : round.lives), LIVES) + 6;
  if (round.combo > 1) x += pill(ctx, x, y, h, `x${round.combo} COMBO`, GOLD, round.comboMs / COMBO_MS) + 6;
  if (round.shield > 0) x += pill(ctx, x, y, h, round.shield > 1 ? "SHIELD x2" : "SHIELD", POWERS.shield.color) + 6;
  for (const [kind, ms] of Object.entries(round.effects)) {
    if (!EFFECT_LABELS[kind]) continue;
    x += pill(ctx, x, y, h, EFFECT_LABELS[kind], POWERS[kind].color, ms / POWERS[kind].ms) + 6;
  }
  const boss = round.boss;
  if (boss && boss.state !== "enter") {
    const bw = W * u * 0.5;
    const bx = (W * u - bw) / 2;
    const by = y + h + u * 0.4;
    ctx.fillStyle = SHADE;
    roundRect(ctx, bx, by, bw, u * 0.7, u * 0.35);
    ctx.fill();
    ctx.fillStyle = BOSSES[boss.kind].color;
    roundRect(ctx, bx, by, bw * Math.max(0, boss.hp / boss.max), u * 0.7, u * 0.35);
    ctx.fill();
    label(ctx, BOSSES[boss.kind].name.toUpperCase(), W * u / 2, by + u * 1.45, u * 0.75, "#ffffff");
  }
}

// A banner is a light strip across the middle, between the bugs and you.
// While a diving bug or a bomb crosses it, it fades to BANNER_SEE_THROUGH
// over BANNER_FADE_MS, so it never hides what is coming at you.
const BANNER_ROWS = 4.6;
const BANNER_Y = H * 0.55;
const BANNER_SHADE = "rgba(0, 0, 0, 0.3)";
const BANNER_SEE_THROUGH = 0.12;
const BANNER_FADE_MS = 140;

// Whether a diving bug or a bomb is in the banner's strip.
export function underBanner(round) {
  const reach = BANNER_ROWS / 2 + 1;
  const near = (y) => Math.abs(y - BANNER_Y) < reach;
  return round.bugs.some((b) => b.state === "dive" && near(b.y)) || round.bombs.some((b) => near(b.y));
}

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

const discoveryColor = (id) => {
  const [group, key] = id.split(":");
  if (group === "bug") return BUGS[key].color;
  if (group === "boss") return BOSSES[key].color;
  return POWERS[key].color;
};

const countBits = (n) => DISCOVERIES.reduce((sum, _, i) => sum + (n & (1 << i) ? 1 : 0), 0);

// The ready and over screens' strip along the bottom: a line or two, then one
// dot per thing to find, lit for those found.
function drawTally(ctx, u, lines, found) {
  const w = W * u;
  const h = H * u;
  const top = h - u * 6.4;
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, w, u * 6.4);
  lines.forEach((text, i) => label(ctx, text, w / 2, top + u * (1.3 + i * 1.6), u * (i ? 0.9 : 1.1), i ? "#ffffff" : GOLD));
  const r = u * 0.45;
  const gap = r * 3;
  const x = w / 2 - ((DISCOVERIES.length - 1) * gap) / 2;
  const y = top + u * 5.1;
  DISCOVERIES.forEach((id, i) => {
    ctx.beginPath();
    ctx.arc(x + i * gap, y, r, 0, Math.PI * 2);
    if (found & (1 << i)) {
      ctx.fillStyle = discoveryColor(id);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

// The over screen's nudge to play again: the next bug not yet met, else how
// much is still hidden.
function teaser(found) {
  const bug = Object.keys(BUGS).find((k) => !(found & (1 << DISCOVERIES.indexOf(`bug:${k}`))));
  if (bug) return `A new bug waits at wave ${BUGS[bug].from}...`;
  const boss = BOSS_ORDER.findIndex((k) => !(found & (1 << DISCOVERIES.indexOf(`boss:${k}`))));
  if (boss >= 0) return `A boss waits at wave ${(boss + 1) * BOSS_EVERY}...`;
  const left = DISCOVERIES.length - countBits(found);
  if (left) return `${left} ${left === 1 ? "power-up is" : "power-ups are"} still to find. One more go?`;
  return "You have found them all. Now beat your best!";
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 500;

// Each bug's squash: a shared or own tone, its loudness and its pitch.
const KILL_SOUNDS = Object.freeze({
  ant: ["squish", 0.7, 1.15],
  beetle: ["bugsCrackShell", 0.8, 1],
  zigzag: ["bugsBuzzPop", 0.7, 1],
  spitter: ["splat", 0.8, 0.95],
  blinker: ["bugsGlitch", 0.7, 1],
  firewall: ["bugsWallBreak", 0.9, 1],
});

// Each boss's held drone, and the pitch of its roar on arrival.
const BOSS_HUMS = Object.freeze({ leak: "bugsBossLeak", spaghetti: "bugsBossTangle", heisen: "bugsBossFlicker" });
const BOSS_ROAR = Object.freeze({ leak: 0.85, spaghetti: 1, heisen: 1.3 });

// At most this many squashes sound in one frame, so a Refactor wiping the
// screen is one crunchy burst rather than a pile-up.
const KILL_SOUNDS_PER_FRAME = 4;

// A timed power-up ticks this many times before it runs out, this far apart.
const EXPIRE_TICKS = 3;
const EXPIRE_STEP_MS = 500;

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
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
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], shake: 0, shakeMag: 0, flash: null, clock: 0 });
  resetFx();

  const burst = (p, color, n, speed = 8) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 400 + Math.random() * 400, max: 800, color, size: 0.2 + Math.random() * 0.25 });
    }
  };
  const float = (p, text, color) => fx.floats.push({ x: p.x, y: p.y - 0.6, text, color, life: 900, max: 900 });
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

  // A first meeting lights its dot for good and tags its banner.
  const discover = (id, b) => {
    const bit = DISCOVERIES.indexOf(id);
    if (bit < 0 || found & (1 << bit)) return;
    found |= 1 << bit;
    try {
      if (memo) memo.set(found);
    } catch {}
    if (b) b.tag = `NEW DISCOVERY ${countBits(found)} / ${DISCOVERIES.length}`;
  };

  /* --------------------------------------------------------- the sounds

     Sounds only listen: nothing here changes the round. Events the rules
     push get their sound in handle(); what the rules do quietly (a bug
     peeling off to dive, a bomb thrown, a boss hit, a power-up running out)
     is spotted each frame by listen(), which also keeps the hums going: the
     swarm (louder the more bugs are up), your thruster, the nearest diving
     bug's whistle, the boss's drone and a running slow-mo or magnet. */
  let sfx = null;
  const resetSfx = () =>
    (sfx = { clock: 0, last: {}, later: [], seed: 7, kills: 0, hit: false, coins: 0, coinMs: 0, bugs: new WeakMap(), bombs: new WeakSet(), items: new WeakSet(), effects: {}, boss: null, bossHp: 0, bossLow: false, blur: 0 });
  resetSfx();
  // A little pitch wobble so repeats never sound identical; its own seed, so
  // the game's dice are never touched.
  const wobble = (spread) => {
    sfx.seed = (Math.imul(sfx.seed, 1103515245) + 12345) >>> 0;
    return 1 + ((sfx.seed / 4294967296) * 2 - 1) * spread;
  };
  // Whether `key` has been quiet at least `ms`; if so it counts as heard now.
  const every = (key, ms) => {
    if (sfx.clock - (sfx.last[key] ?? -Infinity) < ms) return false;
    sfx.last[key] = sfx.clock;
    return true;
  };
  // A tone a moment from now, on the game's clock, so a pause holds it too.
  const later = (ms, name, level = 1, pitch = 1) => sfx.later.push({ at: sfx.clock + ms, name, level, pitch });

  const handle = (e) => {
    const p = { x: e.x, y: e.y };
    if (e.type === "shoot") {
      const pitch = (active(round, "rapid") ? 1.15 : 1) * (active(round, "spread") ? 0.9 : 1);
      tone("bugsShot", active(round, "spread") ? 0.3 : 0.22, pitch * wobble(0.04));
    } else if (e.type === "kill") {
      if (sfx.kills++ < KILL_SOUNDS_PER_FRAME) {
        const [name, level, pitch] = KILL_SOUNDS[e.kind] || KILL_SOUNDS.ant;
        tone(name, level, pitch * wobble(0.06));
        // Each kill in a combo climbs the chime a step.
        if (e.combo > 1) tone("bugsComboChime", 0.45, 1 + (e.combo - 2) * 0.12);
      }
      burst(p, BUGS[e.kind].color, 16, 9);
      float(p, `+${e.points}`, e.combo > 1 ? GOLD : "#ffffff");
    } else if (e.type === "hurt") {
      if (e.kind === "tentacle") tone("squish", 0.5, 0.7 * wobble(0.08));
      else if (e.kind === "firewall") tone("clank", 0.4, wobble(0.05));
      else tone("bugsDent", 0.5, (e.kind === "spitter" ? 0.85 : 1) * wobble(0.05));
      burst(p, "#ffffff", 5, 5);
    } else if (e.type === "split") tone("bugsSplit", 0.7);
    else if (e.type === "clink") {
      if (every("clink", 80)) tone("bugsRicochet", 0.35, wobble(0.08));
      burst(p, "#ffffff", 3, 4);
    } else if (e.type === "cut") {
      tone("bugsSnip", 0.8);
      tone("splat", 0.9, 0.75);
      tone("blast", 0.5, 1.3);
      burst(p, BOSSES.spaghetti.color, 24, 10);
      float(p, "Snip!", BOSSES.spaghetti.color);
      shake(160, 0.2);
    } else if (e.type === "hit") {
      sfx.hit = true;
      if (e.lives > 0) {
        tone("blast", 0.9);
        tone("lifeLost", 0.8);
        // Down to the last life: a heartbeat once the dust settles.
        if (e.lives === 1) later(700, "heartbeat", 0.9);
      } else tone("explode");
      burst(p, colors.you, 40, 12);
      burst(p, "#ff8a1f", 20, 8);
      shake(450, 0.5);
      flash(DANGER, 320);
      if (e.lives > 0) banner("Hit!", `${e.lives} ${e.lives === 1 ? "life" : "lives"} left`, DANGER, 1200);
    } else if (e.type === "shield") {
      tone("shield", 0.6);
      tone("bugsShieldBounce", 0.8);
      burst(p, POWERS.shield.color, 20, 8);
      float(p, "Saved!", POWERS.shield.color);
      shake(150, 0.2);
    } else if (e.type === "power") {
      const spec = POWERS[e.kind];
      if (e.kind === "life") tone("extraLife");
      else if (e.kind === "shield") tone("shieldUp");
      else if (e.kind === "slow") tone("bugsSlowDown");
      else if (e.kind === "magnet") tone("bugsMagnetOn");
      else if (e.kind === "rapid") tone("powerUp", 0.9, 1.12);
      else if (e.kind === "spread") tone("powerUp", 0.9);
      burst(p, spec.color, 22, 9);
      if (e.kind === "refactor") {
        // The whole screen wiped: a big zap and the blast behind it.
        tone("zapBig");
        tone("explode", 0.8, 1.2);
        later(180, "sparkle", 0.6);
        flash(GOLD, 380);
        shake(300, 0.35);
      }
      discover(`power:${e.kind}`, banner(spec.name, spec.blurb, spec.color, 1400));
    } else if (e.type === "coin") {
      // Coins grabbed close together climb in pitch.
      sfx.coins = sfx.coinMs > 0 ? Math.min(8, sfx.coins + 1) : 0;
      sfx.coinMs = 600;
      tone("coinUp", 0.6, 1 + sfx.coins * 0.06);
      float(p, `+${e.points}`, GOLD);
    } else if (e.type === "wave") {
      if (e.boss) {
        tone("bossIntro");
        later(350, "warn", 0.55, 0.8);
        shake(300, 0.25);
        const spec = BOSSES[e.boss];
        discover(`boss:${e.boss}`, banner(`Wave ${e.wave}: boss!`, `${spec.name}. ${spec.sub}`, spec.color, 2200));
        return;
      }
      tone("bugsWaveIn", e.wave > 1 ? 0.8 : 0.6);
      const spec = e.fresh ? BUGS[e.fresh] : null;
      if (spec) later(450, "bugsNewBug", 0.8);
      const sector = sectorFor(e.wave);
      const b = banner(`Wave ${e.wave}`, spec ? `New bug: ${spec.name}. ${spec.blurb}` : sector.title, spec ? spec.color : sector.frame, 2000);
      if (e.wave === 1) discover("bug:ant", b);
      if (spec) discover(`bug:${e.fresh}`, b);
    } else if (e.type === "bossin") {
      tone("bugsBossRoar", 1, BOSS_ROAR[e.kind] || 1);
      shake(250, 0.3);
    } else if (e.type === "teleport") {
      tone("warp", 0.6, 1.3);
      tone("tunnel", 0.3);
      burst(p, BOSSES.heisen.color, 16, 7);
    } else if (e.type === "bossdown") {
      // A chain of blasts as it comes apart, then the victory.
      tone("explode");
      later(220, "blast", 0.8, 1.2);
      later(460, "blast", 0.7, 0.8);
      later(720, "victory");
      later(1200, "sparkle", 0.7);
      flash(GOLD, 420);
      shake(600, 0.6);
      burst(p, BOSSES[e.kind].color, 80, 16);
      burst(p, GOLD, 40, 12);
      banner("Boss down!", `+${e.points} points`, GOLD, 2000);
    } else if (e.type === "clear") {
      // A boss's wave already has its victory, in the chain of blasts.
      const bossWave = e.wave % BOSS_EVERY === 0;
      if (!bossWave && e.perfect) {
        tone("fanfare", 0.85);
        later(650, "sparkle", 0.6);
      } else if (!bossWave) tone("victory", 0.75);
      banner("Wave cleared!", `+${e.points} points${e.perfect ? ", perfect!" : ""}`, e.perfect ? GOLD : "#ffffff", 1600);
    } else if (e.type === "respawn") tone("bugsRespawn", 0.7);
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    later(250, "sparkle", 0.7);
    banner("New best!", "Every point from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    sfx.kills = 0;
    sfx.hit = false;
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  // What the rules did without an event, heard, and the hums kept going.
  const listen = (ms) => {
    sfx.coinMs = Math.max(0, sfx.coinMs - ms);
    const ship = round.ship;
    const sp = speedOf(round);
    const slow = active(round, "slow");
    // Bugs swooping in, and peeling off the formation to dive.
    let up = 0;
    let diving = 0;
    let nearest = null;
    let near = Infinity;
    for (const b of round.bugs) {
      const was = sfx.bugs.get(b);
      if (was !== b.state) {
        sfx.bugs.set(b, b.state);
        if (b.state === "enter" && every("swoop", 160)) tone("swoosh", 0.16, wobble(0.1));
        else if (b.state === "dive" && was === "form" && every("dive", 220)) tone("bugsDiveCry", 0.35, (b.kind === "zigzag" ? 1.2 : 1) * wobble(0.05));
      }
      if (b.state === "wait") continue;
      up += 1;
      if (b.state === "dive") {
        diving += 1;
        const d = dist2(b, ship);
        if (b.y < ship.y && d < near) {
          near = d;
          nearest = b;
        }
      }
    }
    // Bombs thrown: a bug's spit, or a boss's volley.
    let thrown = 0;
    for (const m of round.bombs) {
      if (sfx.bombs.has(m)) continue;
      sfx.bombs.add(m);
      thrown += 1;
    }
    if (thrown && round.boss && every("bossSpit", 150)) tone("bugsBossSpit", 0.6, wobble(0.06));
    else if (thrown && !round.boss && every("spit", 110)) tone("bugsSpit", 0.4, wobble(0.1));
    // A power-up dropped: a twinkle, so you look for it.
    for (const it of round.items) {
      if (sfx.items.has(it)) continue;
      sfx.items.add(it);
      if (it.kind !== "coin" && every("drop", 200)) tone("bugsDrop", 0.5);
    }
    // The boss taking hits, pitched up as it weakens; a warning when it is nearly done.
    const boss = round.boss;
    if (boss && boss === sfx.boss) {
      if (boss.hp < sfx.bossHp && every("bossHit", 60)) tone("bugsBossHit", 0.6, 0.8 + 0.6 * (1 - boss.hp / boss.max));
      if (!sfx.bossLow && boss.hp <= boss.max * 0.25) {
        sfx.bossLow = true;
        tone("warn", 0.45, 1.25);
        tone("bugsBossRoar", 0.7, (BOSS_ROAR[boss.kind] || 1) * 1.3);
      }
      if (boss.kind === "heisen" && boss.blur > 0 && !(sfx.blur > 0)) tone("warp", 0.35, 0.7);
    } else sfx.bossLow = false;
    sfx.boss = boss;
    sfx.bossHp = boss ? boss.hp : 0;
    sfx.blur = boss ? boss.blur : 0;
    // Timed power-ups: three ticks as one runs out, then it winds down. A
    // hit clears them all, and the hit has said enough.
    for (const [kind, left] of Object.entries(round.effects)) {
      const step = Math.ceil(left / EXPIRE_STEP_MS);
      if (step <= EXPIRE_TICKS && step !== sfx.effects[kind]) tone("bugsExpiring", 0.45, 1 + (EXPIRE_TICKS - step) * 0.12);
      sfx.effects[kind] = step;
    }
    for (const kind of Object.keys(sfx.effects)) {
      if (round.effects[kind] > 0) continue;
      delete sfx.effects[kind];
      if (!sfx.hit && ship.alive) tone("powerDown", 0.5);
    }
    // The tones held back for a moment.
    sfx.later = sfx.later.filter((t) => {
      if (t.at > sfx.clock) return true;
      tone(t.name, t.level, t.pitch);
      return false;
    });
    // The hums.
    if (up) hum("bugs:swarm", "swarm", 0.35 + 0.65 * Math.min(1, up / 30), sp * (slow ? 0.6 : 1) * (1 + Math.min(0.3, diving * 0.06)));
    if (ship.alive) {
      const { left, right, up: rise, down } = round.input;
      const moving = left !== right || rise !== down;
      hum("bugs:ship", "bugsThruster", moving ? 1 : 0.45, (moving ? 1.35 : 1) + (rise && !down ? 0.2 : 0));
    }
    if (nearest) {
      const close = Math.max(0, 1 - Math.sqrt(near) / 30);
      hum("bugs:dive", "bugsDiveWhine", 0.25 + 0.75 * close, (1.6 - 0.9 * clamp(nearest.y / H, 0, 1)) * (slow ? 0.7 : 1));
    }
    if (boss) {
      const arrive = boss.state === "enter" ? 0.3 + 0.7 * clamp((boss.y + 6) / 14, 0, 1) : 1;
      const grow = boss.kind === "leak" ? 1.15 - 0.1 * boss.grow : 1;
      const blur = boss.kind === "heisen" && boss.blur > 0 ? 1.5 : 1;
      const rage = boss.hp <= boss.max * 0.25 ? 1.25 : 1;
      hum("bugs:boss", BOSS_HUMS[boss.kind], arrive * (blur > 1 ? 0.6 : 1), grow * blur * rage * (slow ? 0.7 : 1));
    }
    if (slow) hum("bugs:slow", "bugsSlowmo", 1, 1);
    if (active(round, "magnet")) hum("bugs:magnet", "bugsMagnetField", 1, 1);
  };

  const runFx = (ms) => {
    fx.clock += ms;
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
    if (fx.banners.length) {
      const b = fx.banners[0];
      const target = underBanner(round) ? BANNER_SEE_THROUGH : 1;
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

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    const w = W * u;
    const h = H * u;
    const clock = fx.clock;
    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * 2 * fx.shakeMag * u, (Math.random() - 0.5) * 2 * fx.shakeMag * u);
    drawBoard(ctx, round, u, colors, clock);
    drawItems(ctx, round, u, clock);
    drawBoss(ctx, round, u, clock);
    for (const b of round.bugs) drawBug(ctx, round, b, u, clock);
    drawShots(ctx, round, u, colors);
    drawShip(ctx, round, u, colors, clock);
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect((p.x - p.size / 2) * u, (p.y - p.size / 2) * u, p.size * u, p.size * u);
    }
    ctx.globalAlpha = 1;
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
    if (state === "running" || state === "paused") drawHud(ctx, round, u);
    if (state === "running" && fx.banners.length) drawBanner(ctx, fx.banners[0], u);
    const total = `${countBits(found)} of ${DISCOVERIES.length} bugs, bosses and power-ups found`;
    if (state === "ready") drawTally(ctx, u, ["Hold space to fire, arrows to move", total], found);
    if (state === "over") drawTally(ctx, u, [`Reached wave ${round.wave}, ${round.kills} bugs squashed${beaten ? ", with a new best!" : ""}`, `${total}. ${teaser(found)}`], found);
  };

  // Nothing held carries over a pause or a new round: a release may never arrive.
  const letGo = () => Object.keys(round.input).forEach((k) => (round.input[k] = false));

  const start = () => {
    colors = null;
    round = newRound();
    state = "running";
    resetFx();
    resetSfx();
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
    tone("crash", 0.6);
    tone("gameOver");
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
        if (state === "running") round.input.fire = true;
        return true;
      }
      if (!MOVES[name]) return false;
      if (state === "running") round.input[name] = true;
      return true;
    },
    // A key let go: stop moving that way, or stop firing.
    release(name) {
      if (name === "action") round.input.fire = false;
      else if (MOVES[name]) round.input[name] = false;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      sfx.clock += ms;
      advance(round, ms);
      drain();
      listen(ms);
      if (round.over) end();
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

export default Object.freeze({ id: "bugs", title: "Bug Hunt", create });
