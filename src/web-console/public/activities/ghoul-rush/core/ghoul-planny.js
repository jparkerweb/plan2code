// Plan2Code Web Console - Ghoul Rush's ground and Planny: what stands where (surfaces, shelves and landing on them), and how Planny runs, jumps and falls.
//
// One of the parts of ghoul.js (see its header and the list of parts there).

import { iceRun } from "../stages/frozen/ghoul-frozen.js";
import { SLOW_SHARE } from "../stages/graveyard/ghoul-graveyard.js";
import { COYOTE_MS, FROZEN, PLATFORMS, EDGE, FALL_MAX, GRAVITY, JUMP_V, RUN_SPEED, STEP_UP, WATER_JUMP, WATER_SPEED, clamp, mudJump, mudSpeed } from "./ghoul-tables.js";

/* ----------------------------------------------------------- surfaces */

// The top of the ground at `x`, or -Infinity over a pit. Pieces are
// [x0, x1); the last one takes its end too.
export function groundAt(spec, x) {
  const g = spec.ground;
  for (let i = 0; i < g.length; i++) {
    const [x0, x1, y] = g[i];
    if (x >= x0 && (x < x1 || (i === g.length - 1 && x <= x1))) return y;
  }
  return -Infinity;
}

// Whether shelf `i` is there (a crumbled board is not, for a while).
export const shelfThere = (round, i) => !(round.down[i] > 0);

// What something walking at height `y` stands on at `x`: the highest
// surface (the ground or a shelf there) within STEP_UP of `y` either way,
// as { y, shelf } (shelf -1 for the ground), or null. `skip` is a shelf to
// ignore (one being dropped through).
export function footing(round, x, y, skip = -1) {
  const spec = round.spec;
  let best = null;
  const g = groundAt(spec, x);
  if (g >= y - STEP_UP && g <= y + STEP_UP) best = { y: g, shelf: -1 };
  spec.shelves.forEach(([x0, x1, top], i) => {
    if (i === skip || !shelfThere(round, i) || x < x0 || x > x1) return;
    if (top >= y - STEP_UP && top <= y + STEP_UP && (!best || top > best.y)) best = { y: top, shelf: i };
  });
  return best;
}

// The surface a fall from (x, py) to (x, y) lands on: the highest one whose
// top it crossed going down, as { y, shelf }, or null.
export function landing(round, x, py, y, skip) {
  const spec = round.spec;
  let best = null;
  const g = groundAt(spec, x);
  if (py >= g - 0.05 && y <= g) best = { y: g, shelf: -1 };
  spec.shelves.forEach(([x0, x1, top], i) => {
    if (i === skip || !shelfThere(round, i) || x < x0 || x > x1) return;
    if (py >= top - 0.05 && y <= top && (!best || top > best.y)) best = { y: top, shelf: i };
  });
  return best;
}

// Like footing() and landing() for Planny alone: a monster the pack says is a
// floor just now (a parked gurney) counts as one more surface, its top.
function standing(round, x, y) {
  let best = footing(round, x, y);
  for (const m of round.monsters) {
    if (m.dead || !PLATFORMS[m.kind] || !PLATFORMS[m.kind](m) || Math.abs(x - m.x) > m.w / 2) continue;
    const top = m.y + m.h;
    if (top >= y - STEP_UP && top <= y + STEP_UP && (!best || top > best.y)) best = { y: top, shelf: -1 };
  }
  return best;
}

function landOn(round, x, py, y, skip) {
  let best = landing(round, x, py, y, skip);
  for (const m of round.monsters) {
    if (m.dead || !PLATFORMS[m.kind] || !PLATFORMS[m.kind](m) || Math.abs(x - m.x) > m.w / 2) continue;
    const top = m.y + m.h;
    if (py >= top - 0.05 && y <= top && (!best || top > best.y)) best = { y: top, shelf: -1 };
  }
  return best;
}

// Whether the ground at `x` stands above `y`: a wall to anything there.
export const wallAt = (spec, x, y) => groundAt(spec, x) > y;

// How far left and right Planny may go: the room, or the arena once locked.
export const leftEdge = (round) => Math.max(1.5, round.lockX >= 0 ? round.lockX + 1.5 : 1.5);
export const rightEdge = (round) => round.spec.length - 1.5;

/* -------------------------------------------------------------- Planny */

export function makeYou(x, y) {
  return { x, y, vx: 0, vy: 0, state: "run", shelf: -1, face: 1, coyote: 0, drop: -1, cuttable: false, airMs: 0, out: 0, outKind: "", safeMs: 0, garlic: false, hat: false, aliveMs: 0, runMs: 0, fireFx: 0, flapped: false, flingMs: 0, flingVx: 0, heldMs: 0, wet: false, mud: false, mudMs: 0, belt: 0, dimMs: 0, dimBy: 0, slide: 0, glide: false, onIce: false };
}

// The conveyor belts (a room's `belts`, the Funhouse's) push him along the floor: the speed of the one he stands on, or 0.
const beltAt = (spec, you) => {
  if (!spec.belts || !spec.belts.length || you.state !== "run" || you.shelf >= 0 || you.y > groundAt(spec, you.x) + 0.01) return 0;
  const b = spec.belts.find(([x0, x1]) => you.x >= x0 && you.x <= x1);
  return b ? b[2] : 0;
};

// Whether Planny stands on the floor in one of the room's water spans.
const wetAt = (spec, you) => Boolean(spec.water && spec.water.length) && you.state === "run" && you.shelf < 0 && you.y <= groundAt(spec, you.x) + 0.01 && spec.water.some(([x0, x1]) => you.x >= x0 && you.x <= x1);

// Whether Planny stands on the floor in one of the room's mud spans.
const mudAt = (spec, you) => Boolean(spec.mud && spec.mud.length) && you.state === "run" && you.shelf < 0 && you.y <= groundAt(spec, you.x) + 0.01 && spec.mud.some(([x0, x1]) => you.x >= x0 && you.x <= x1);

// Leaves the ground at JUMP_V, or bounces off a stomp at STOMP_V.
export function jump(round, v = JUMP_V) {
  const you = round.you;
  if (you.out > 0) return false;
  you.vy = v === JUMP_V ? JUMP_V * (you.wet ? WATER_JUMP : 1) * (you.mud ? mudJump(you.mudMs) : 1) : v;
  you.state = "air";
  you.ducking = false;
  you.shelf = -1;
  you.coyote = 0;
  you.drop = -1;
  // Only a jump from a press is cut short by letting up go, and only once it
  // has risen CUT_AFTER_MS.
  you.cuttable = v === JUMP_V;
  you.airMs = 0;
  if (v === JUMP_V) round.events.push({ type: "jump", x: you.x, y: you.y });
  return true;
}

// One slice of your moving: running along the ground or a shelf (walking a
// step, or off an edge into a fall), dropping through a shelf with down,
// ducking with down on the ground (a direction held runs instead), or
// flying, blocked by any wall in the way.
export function moveYou(round, ms) {
  const dt = ms / 1000;
  const you = round.you;
  // Frozen by the bell, held by an orderly or thrown: no key does anything.
  const flung = you.flingMs > 0;
  const inp = round.stunMs > 0 || you.heldMs > 0 || flung ? FROZEN : round.input;
  const spec = round.spec;
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (dir) you.face = dir;
  you.runMs = dir && you.state === "run" ? you.runMs + ms : 0;
  // A mourner's wail leaves you running at SLOW_SHARE of your speed a while.
  // Knee-deep water (a room's `water` spans): slower on the floor in it.
  you.wet = wetAt(spec, you);
  // Sinking mud: it grabs harder the longer he stands in it, and lets go on
  // dry floor or in the air. Stilt Boots wade free of it (ghoul-powers.js).
  you.mud = mudAt(spec, you) && !(round.effects.boots > 0);
  you.mudMs = you.mud ? you.mudMs + ms : Math.max(0, you.mudMs - ms);
  const speed = RUN_SPEED * (you.slowMs > 0 ? SLOW_SHARE : 1) * (you.wet ? WATER_SPEED : 1) * (you.mud ? mudSpeed(you.mudMs) : 1);
  you.belt = beltAt(spec, you);
  // Slippery ice (a room's `ice`, the Frozen Lake's): his run eases and slides (ghoul-frozen.js).
  const run = spec.ice && spec.ice.length ? iceRun(round, dir, speed, dt, you.state === "run" && you.shelf < 0 && you.y <= groundAt(spec, you.x) + 0.01) : dir * speed;
  const want = you.x + (run + you.belt) * dt;
  let nx = clamp(want, leftEdge(round), rightEdge(round));
  if (nx !== want) you.slide = 0;
  if (you.state === "run") {
    if (you.shelf >= 0 && !shelfThere(round, you.shelf)) return fall(you, 0);
    if (inp.down && you.shelf >= 0 && !dir) {
      you.drop = you.shelf;
      you.ducking = false;
      return fall(you, 0);
    }
    const duck = Boolean(inp.down) && !dir && you.shelf < 0;
    if (duck && !you.ducking) round.events.push({ type: "duck", x: you.x, y: you.y });
    you.ducking = duck;
    const way = Math.sign(nx - you.x);
    if (way && wallAt(spec, nx + way * EDGE, you.y + STEP_UP)) {
      nx = you.x;
      you.slide = 0;
    }
    const f = standing(round, nx, you.y);
    you.x = nx;
    if (f) {
      you.y = f.y;
      you.shelf = f.shelf;
      return;
    }
    return fall(you, COYOTE_MS);
  }
  // In the air: no wall passed, gravity, then a landing.
  if (flung) nx = clamp(you.x + you.flingVx * dt, leftEdge(round), rightEdge(round));
  const push = flung ? Math.sign(you.flingVx) : dir || Math.sign(nx - you.x);
  if (push && wallAt(spec, nx + push * EDGE, you.y + 0.05)) {
    nx = you.x;
    you.slide = 0;
  }
  you.coyote = Math.max(0, you.coyote - ms);
  you.vy = Math.max(-FALL_MAX, you.vy - GRAVITY * dt);
  const py = you.y;
  you.x = nx;
  you.y += you.vy * dt;
  if (you.drop >= 0 && you.y < spec.shelves[you.drop][2] - 1) you.drop = -1;
  if (you.vy > 0) return;
  const f = landOn(round, you.x, py, you.y, you.drop);
  if (!f) return;
  you.y = f.y;
  you.vy = 0;
  you.flingMs = 0;
  you.state = "run";
  you.shelf = f.shelf;
  you.drop = -1;
  you.cuttable = false;
  you.flapped = false;
  round.events.push({ type: "land", x: you.x, y: you.y });
}

function fall(you, coyote) {
  you.state = "air";
  you.ducking = false;
  you.vy = 0;
  you.shelf = -1;
  you.coyote = coyote;
}
