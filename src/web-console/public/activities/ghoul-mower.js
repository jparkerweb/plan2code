// Plan2Code Web Console - Ghoul Rush's Gardener's Revenge, its rules: the Grounds' bonus round. YOU ride the gardener's rusty, haunted ride-on mower down a long straight run through the overgrown estate lawn at night: jump the gnomes, barrows, flowerpots, ponds and ha-ha ditches, duck the hedge arches and the clothes lines of ghostly gloves, shoot the snapping topiary beasts, and MOW: hold fire and the blades come down, cutting the tall grass, the weeds and the thorn hedges just ahead. As a stage pack that ghoul.js plugs in.
//
// Modeled on the Coffin Sled (ghoul-sled.js: read its header first) and, like it, handed a
// kit `k` of ghoul.js's own helpers, so this file never imports ghoul.js (it borrows the
// cart's track helpers). Pack fields used: `ride` (a hook that moves Planny himself, so no
// key walks him), `place` (Planny put down in a room: a room set up or a respawn) and
// `target` (a bolt strikes something that is no monster: the topiary beasts). It adds no
// monster, boss or hazard kind and it draws NO random number. Its state is the shared
// bonus-ride slot `round.runner` (id "mower"; null in any other room), the room marks its
// ride `runner: "mower"` (the cart's `place` leaves such a room alone).
//
// THE ROOM (spec.ride, see ghoul-rooms.js):
//
// - `track`: polylines [x, y] the mower rolls along, all flat at one height; a gap between
//   two lines is a POND or a HA-HA DITCH (`gaps`: per gap, 0 a pond, 1 a ditch; jump it, or
//   the mower drops in: a heart, cause "pond" or "ditch"). The last line ends at `finish`,
//   where the lawn's end (the ground) begins at the same height: rolling onto it ends the ride.
// - `junk` [x, kind] (a garden gnome, a wheelbarrow or a flowerpot, JUNK: jump it), `lows`
//   [x0, x1, y, kind] (a hedge arch, kind 0, or a clothes line of ghostly gloves, kind 1: its
//   underside is y, from there up to the roof, so DUCK it; y is 3.0 over the lawn, between a
//   ducked box and a standing one), `hedges` [x] (a thorn hedge across the lane, THORN_W by
//   THORN_H: MOW it, or jump it), `beasts` [x] (a snapping topiary beast: it shivers
//   BEAST_WARN_MS when the mower is BEAST_NEAR short of it, then lunges into the lane
//   BEAST_UP_MS, BEAST_W by BEAST_H: shoot it, BEAST_HP bolts, or jump it), `grass` [x0, x1]
//   (tall grass, one cell a unit, mown by the blades), `weeds` [x] (a weed patch with a
//   flower, WEED_CELLS cells), `checks` (x positions of the checkpoints), `finish`, `time`
//   (the room's clock, ms) and `how` (the controls line).
//
// THE MOWER (`round.runner`): { id, room, check, v, line, coyote, from, left, done, heat,
// jam, blade, bogMs, cut, cells, lawn, grass, hedges, weeds, beasts, ... }. Planny rides
// at (you.x, you.y), always facing right (`you.state` "run" on the lawn, "air" off it,
// `you.ducking` ducked). Speed `v` is MOWER_V, bogging down BOG slower for BOG_MS after a
// cut (nothing else changes it: it is a ride). Up jumps at MOWER_JUMP_V against MOWER_G
// (about 11 high, 0.7 s, 22 across at MOWER_V), COYOTE_MS of grace after running off a line's
// end; down ducks.
//
// THE BLADES: while fire is held and the blades are not jammed they are down (`blade`) and cut
// everything in the zone from the mower's front to BLADE_REACH ahead of it: every grass cell
// (GRASS_POINTS each), every weed patch (WEED_POINTS, an act) and every thorn hedge
// (HEDGE_POINTS, an act). Holding fire heats them (`heat` 0 to 1, HEAT_UP a second; they
// cool COOL a second while let go); full heat JAMS them for JAM_MS (no cutting, smoke), after
// which they restart at JAM_RESUME. So the player pulses them. The bolts fly all the time
// fire is held, as always. `lawn` is the share of the room's cells cut (grass cells plus
// WEED_CELLS a weed patch): the grade's `steady` die is lawn at least LAWN_GOAL.
//
// A hit costs one of the round's five hearts (ghoul-bonus.js), not a life, and the mower rolls
// on, Planny blinking safe BONUS_SAFE_MS; the last heart gone ends the round with nothing, at
// once. A fall puts him back on the lawn ahead at MOWER_V. Causes: "gnome", "barrow", "pot",
// "arch", "line", "thorns", "snap", "pond", "ditch". Every obstacle is a number for the grade
// (`perf.total`: junk, lows, hedges, beasts and gaps, each id once in `perf.hits` if it ever
// cost a heart); cutting a hedge or a weed patch, or shooting a beast, counts for `perf.acts`
// (the grade's goal is ACTS_GOAL).
//
// Checkpoints are passed at their x (`mowerCheck`); a restart after the last heart goes back to the
// last one passed (that ends the round, as the sled's does).
//
// WHAT THE ART READS: `spec.ride` (above), `round.runner` { v, line, check, done, left, heat,
// jam, blade, lawn, cut, grass: [[cut cells]], hedges: [cut], weeds: [cut], beasts: [{ state
// "idle"|"warn"|"snap"|"sink"|"spent"|"broken", t }] }, `round.you` (`state`, `vy`, `ducking`),
// the events in EVENTS.

import { linesAt, linesOf, trackY } from "./ghoul-cart.js";

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "mowerJump", "mowerLand", "mowerDuck", "mowerCrash", "mowerCheck", "mowerFinish",
  "mowerGrass", "mowerHedge", "mowerWeed", "mowerJam",
  "mowerBeastWarn", "mowerBeastSnap", "mowerBeastHit", "mowerBeastBreak",
]);

// The mower. Speeds are units across a second, MOWER_G units a second squared.
export const MOWER_V = 32;
export const BOG = 4;
export const BOG_MS = 220;
export const RELAX = 3;
export const MOWER_JUMP_V = 66;
export const MOWER_G = 190;
export const COYOTE_MS = 100;
export const LAND_TOL = 0.9;
export const BIG_LAND = 5;
export const DERAIL_DROP = 7;
export const CAM_AHEAD = 10;
// The blades.
export const BLADE_REACH = 9;
export const BLADE_NEAR = 0;
export const HEAT_UP = 0.75;
export const COOL = 0.5;
export const JAM_MS = 1800;
export const JAM_RESUME = 0.3;
export const GRASS_POINTS = 4;
export const WEED_POINTS = 40;
export const HEDGE_POINTS = 80;
export const WEED_CELLS = 3;
export const WEED_W = 2.2;
export const LAWN_GOAL = 0.6;
// Obstacles: a gnome, a wheelbarrow, a flowerpot (jump), a thorn hedge (mow or jump).
export const JUNK = freeze([
  freeze({ name: "gnome", w: 2.4, h: 4.2 }),
  freeze({ name: "barrow", w: 5.2, h: 3 }),
  freeze({ name: "pot", w: 2.2, h: 3.6 }),
]);
export const THORN_W = 3.4;
export const THORN_H = 3.8;
// The snapping topiary beast: wakes, lunges into the lane, and the shots at it.
export const BEAST_W = 3.4;
export const BEAST_H = 4.6;
export const BEAST_HP = 2;
export const BEAST_NEAR = 36;
export const BEAST_WARN_MS = 450;
export const BEAST_UP_MS = 1400;
export const BEAST_SINK_MS = 300;
export const BEAST_POINTS = 150;
const SHOT_R = 0.5;
// The shots and cuts (a hedge, a weed patch, a beast) worth a die.
export const ACTS_GOAL = 14;

// Notes for a bonus round that obstacle `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

// The highest line under x, as [line, y], or null over a gap.
const topAt = (R, x) => linesAt(R, x)[0] || null;

// The highest line the mower, falling from `py` to `y` at `x`, crossed going down.
function landOn(R, x, py, y) {
  for (const [line, ly] of linesAt(R, x)) if (py >= ly - LAND_TOL && y <= ly) return { line, y: ly };
  return null;
}

// Where a mower in the air at (x, y) going up at vy and across at v lands, if it does not
// steer: { x, y, line } or null when it drops. The unit suite's measure of which gaps a jump clears.
export function flight(R, x, y, vy, v) {
  const dt = 0.004;
  const floor = y - DERAIL_DROP;
  for (let t = 0; t < 5; t += dt) {
    const py = y;
    vy = Math.max(-120, vy - MOWER_G * dt);
    x += v * dt;
    y += vy * dt;
    if (vy <= 0) {
      const f = landOn(R, x, py, y);
      if (f) return { x, y: f.y, line: f.line };
    }
    if (y < floor) return null;
  }
  return null;
}

// The cells of a stretch of tall grass: one a unit.
export const cellsOf = (g) => Math.max(1, Math.ceil(g[1] - g[0]));
// The room's cells in all, the lawn's whole, and how many of them are cut so far in a runner.
export const totalCells = (R) => R.grass.reduce((n, g) => n + cellsOf(g), 0) + R.weeds.length * WEED_CELLS;

/* -------------------------------------------------------------- placing */

// A fresh set of the room's things, each beast asleep. What was cut or shot stays so (`old`,
// the runner of an earlier try in the same room).
function things(R, old) {
  const same = Boolean(old && old.id === "mower" && old.grass.length === R.grass.length && old.hedges.length === R.hedges.length && old.weeds.length === R.weeds.length && old.beasts.length === R.beasts.length);
  return {
    grass: R.grass.map((g, i) => (same && old.grass[i].length === cellsOf(g) ? old.grass[i].slice() : new Array(cellsOf(g)).fill(false))),
    hedges: R.hedges.map((_, i) => Boolean(same && old.hedges[i])),
    weeds: R.weeds.map((_, i) => Boolean(same && old.weeds[i])),
    beasts: R.beasts.map((_, i) => ({ state: same && old.beasts[i].state === "broken" ? "broken" : "idle", t: 0, hp: BEAST_HP })),
  };
}

// How many cells are cut, from the lists.
function cutCells(c) {
  return c.grass.reduce((n, g) => n + g.filter(Boolean).length, 0) + c.weeds.filter(Boolean).length * WEED_CELLS;
}

// Planny put down in the room: on the mower at the start of a ride, or at the last
// checkpoint passed after the last heart (the same room).
function place(round, k) {
  const R = round.spec.ride;
  // (The Cart's `place` runs first and has already zeroed `round.camLead`: another room's lead is not ours to touch.)
  if (!R || R.runner !== "mower") {
    if (round.runner && round.runner.id === "mower") round.runner = null;
    return;
  }
  const again = round.runner && round.runner.id === "mower" && round.runner.room === round.room;
  const check = again ? round.runner.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const top = topAt(R, x);
  Object.assign(you, { x, y: top ? top[1] : you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  const t = things(R, again ? round.runner : null);
  const cells = totalCells(R);
  round.runner = { id: "mower", room: round.room, check, v: MOWER_V, line: top ? top[0] : -1, coyote: 0, from: you.y, left: top ? top[0] : 0, done: false, heat: 0, jam: 0, blade: false, bogMs: 0, cells, cut: 0, lawn: 0, ...t };
  round.runner.cut = cutCells(round.runner);
  round.runner.lawn = cells ? round.runner.cut / cells : 0;
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = R.junk.length + R.lows.length + R.hedges.length + R.beasts.length + (R.track.length - 1);
    b.perf.steady = false;
    b.perf.goal = ACTS_GOAL;
  }
}

/* ------------------------------------------------------------ the ride */

// After a fall that cost a heart but not the ride: Planny and the mower go back onto the
// lawn nearest where they fell (the line under him, else the next one ahead) at MOWER_V. He
// blinks safe (ghoul.js's takeLife).
function reseat(round, c, R) {
  const you = round.you;
  const under = topAt(R, you.x);
  let line;
  let x;
  let y;
  if (under) {
    [line, y] = under;
    x = you.x;
  } else {
    const ahead = linesOf(R)
      .map((L, i) => ({ i, x0: L.x0 }))
      .filter((L) => L.x0 > you.x)
      .sort((a, b) => a.x0 - b.x0)[0];
    line = ahead ? ahead.i : linesOf(R).length - 1;
    x = ahead ? ahead.x0 + 2 : R.finish - 2;
    y = trackY(R, line, x) ?? you.y;
  }
  Object.assign(you, { x, y, vy: 0, state: "run", shelf: -1, ducking: false, coyote: 0, drop: -1 });
  Object.assign(c, { line, v: MOWER_V, coyote: 0, from: y });
}

// The mower's motion for one slice. Returns true once it has moved Planny (every slice of a
// ride); false outside a ride and once he has stepped out onto the lawn's end.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "mower" || !c || c.id !== "mower" || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  // Already down on the lawn's end (set there, or rolled on by some other way): the ride is over.
  if (you.x >= R.finish && you.vy <= 0 && you.y <= k.groundAt(round.spec, you.x) + 0.01) return finish(round, c, k);
  // A stomp's bounce (or anything else) lifts the mower off its line.
  if (you.state === "air" && c.line >= 0) {
    c.left = c.line;
    c.line = -1;
    c.coyote = 0;
    c.from = you.y;
  }
  const want = inp.jump > 0;
  const target = MOWER_V - (c.bogMs > 0 ? BOG : 0);
  c.bogMs = Math.max(0, c.bogMs - ms);
  c.v += (target - c.v) * Math.min(1, RELAX * dt);
  if (c.line >= 0) {
    // On the lawn.
    const duck = Boolean(inp.down) && !want;
    if (duck && !you.ducking) ev("mowerDuck");
    you.ducking = duck;
    if (want) {
      inp.jump = 0;
      you.vy = MOWER_JUMP_V;
      Object.assign(c, { left: c.line, line: -1, coyote: 0, from: you.y });
      you.state = "air";
      you.ducking = false;
      ev("mowerJump", { v: c.v });
    } else {
      const L = linesOf(R)[c.line];
      const nx = you.x + c.v * dt;
      you.state = "run";
      you.vy = 0;
      if (nx >= L.x1) {
        // Off the end of the line: into a gap, or onto the lawn's end.
        you.x = L.x1;
        you.y = L.pts[L.pts.length - 1][1];
        Object.assign(c, { left: c.line, line: -1, coyote: COYOTE_MS, from: you.y });
        you.state = "air";
        you.ducking = false;
        you.vy = 0;
      } else {
        you.x = nx;
        you.y = trackY(R, c.line, nx);
      }
    }
  } else {
    // In the air.
    c.coyote = Math.max(0, c.coyote - ms);
    if (want && c.coyote > 0) {
      inp.jump = 0;
      c.coyote = 0;
      you.vy = MOWER_JUMP_V;
      c.from = you.y;
      ev("mowerJump", { v: c.v });
    }
    const py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - MOWER_G * dt);
    you.x += c.v * dt;
    you.y += you.vy * dt;
    you.ducking = false;
    you.state = "air";
    if (you.vy <= 0) {
      const f = landOn(R, you.x, py, you.y);
      if (f) {
        you.y = f.y;
        you.vy = 0;
        you.state = "run";
        c.line = f.line;
        ev("mowerLand", { big: c.from - f.y >= BIG_LAND || c.from - f.y <= -BIG_LAND });
        c.from = f.y;
      } else if (you.x >= R.finish) {
        // Over the lawn's end: down onto it, and the ride is over.
        const g = k.groundAt(round.spec, you.x);
        if (g > -Infinity && you.y <= g + 0.01) return finish(round, c, k, g);
      }
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Into a gap: a pond or a ditch.
  const base = R.track[0][0][1];
  if (you.y < base - DERAIL_DROP || k.groundAt(round.spec, you.x) > you.y + 0.5) {
    noteHit(round, `g${c.left}`);
    const kind = R.gaps[Math.min(R.gaps.length - 1, Math.max(0, c.left))];
    const hit = { type: "mowerCrash", what: kind ? "ditch" : "pond", x: you.x, y: you.y };
    if (k.lose(round, kind ? "ditch" : "pond")) {
      round.events.push(hit);
      if (round.phase === "play") reseat(round, c, R);
    }
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("mowerCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD + (c.v - MOWER_V) * 0.25;
  mow(round, c, R, ms);
  if (obstacles(round, c, R, k)) return true;
  creatures(round, c, R, ms);
  return true;
}

// The ride is over: the mower coughs to a halt on the lawn's end, the door opens, Planny walks out.
function finish(round, c, k, g = k.groundAt(round.spec, round.you.x)) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  c.blade = false;
  Object.assign(you, { y: g, vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  grade(round, c);
  round.events.push({ type: "mowerFinish", x: you.x, y: you.y, big: false });
  return false;
}

// The grade's steady die: the lawn cut reaches LAWN_GOAL.
function grade(round, c) {
  c.lawn = c.cells ? c.cut / c.cells : 0;
  const b = round.bonusRound;
  if (b) b.perf.steady = c.lawn >= LAWN_GOAL;
}

/* ------------------------------------------------------------- the blades */

// The blades for one slice: heat, jam, and what they cut in the zone ahead.
function mow(round, c, R, ms) {
  const you = round.you;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  if (c.jam > 0) {
    c.jam = Math.max(0, c.jam - ms);
    c.blade = false;
    c.heat = c.jam > 0 ? JAM_RESUME + ((1 - JAM_RESUME) * c.jam) / JAM_MS : JAM_RESUME;
  } else if (round.input.fire) {
    c.blade = true;
    c.heat = Math.min(1, c.heat + HEAT_UP * dt);
    if (c.heat >= 1) {
      c.blade = false;
      c.jam = JAM_MS;
      ev("mowerJam");
    }
  } else {
    c.blade = false;
    c.heat = Math.max(0, c.heat - COOL * dt);
  }
  if (c.blade) {
    const z0 = you.x + BLADE_NEAR;
    const z1 = you.x + BLADE_REACH;
    let cells = 0;
    R.grass.forEach((g, i) => {
      if (g[1] < z0 || g[0] > z1) return;
      const row = c.grass[i];
      for (let j = Math.max(0, Math.floor(z0 - g[0])); j < row.length && g[0] + j < z1; j++) {
        const cx = g[0] + j + 0.5;
        if (!row[j] && cx >= z0 && cx <= z1) {
          row[j] = true;
          cells++;
        }
      }
    });
    if (cells) {
      c.cut += cells;
      round.score += cells * GRASS_POINTS;
      ev("mowerGrass", { n: cells, points: cells * GRASS_POINTS, tx: you.x + BLADE_REACH * 0.6 });
    }
    let bog = cells > 0;
    R.hedges.forEach((x, i) => {
      if (c.hedges[i] || x + THORN_W / 2 < z0 || x - THORN_W / 2 > z1) return;
      c.hedges[i] = true;
      bog = true;
      round.score += HEDGE_POINTS;
      if (round.bonusRound) round.bonusRound.perf.acts++;
      ev("mowerHedge", { x, y: trackY(R, c.line >= 0 ? c.line : c.left, x) ?? you.y, points: HEDGE_POINTS });
    });
    R.weeds.forEach((x, i) => {
      if (c.weeds[i] || x + WEED_W / 2 < z0 || x - WEED_W / 2 > z1) return;
      c.weeds[i] = true;
      c.cut += WEED_CELLS;
      round.score += WEED_POINTS;
      if (round.bonusRound) round.bonusRound.perf.acts++;
      ev("mowerWeed", { x, y: trackY(R, c.line >= 0 ? c.line : c.left, x) ?? you.y, points: WEED_POINTS });
    });
    if (bog) c.bogMs = BOG_MS;
  }
  grade(round, c);
}

/* ------------------------------------------------------------ obstacles */

// What the mower runs into: junk, a low arch or line, an uncut thorn hedge, a beast's lunge.
// Returns whether it cost a heart.
function obstacles(round, c, R, k) {
  const you = round.you;
  const hh = duckH(k, you);
  for (const [i, [x0, x1, y, kind]] of R.lows.entries()) {
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > y && k.struck(round, kind ? "line" : "arch")) {
      noteHit(round, `l${i}`);
      round.events.push({ type: "mowerCrash", what: "low", x: you.x, y: you.y + hh });
      return true;
    }
  }
  for (const [i, [x, kind]] of R.junk.entries()) {
    if (Math.abs(you.x - x) > 6) continue;
    const J = JUNK[kind];
    if (boxHit(k, you, x, trackY(R, lineAt(R, x), x) ?? you.y, J.w, J.h) && k.struck(round, J.name)) {
      noteHit(round, `j${i}`);
      round.events.push({ type: "mowerCrash", what: J.name, x, y: you.y });
      return true;
    }
  }
  for (const [i, x] of R.hedges.entries()) {
    if (c.hedges[i] || Math.abs(you.x - x) > 6) continue;
    if (boxHit(k, you, x, trackY(R, lineAt(R, x), x) ?? you.y, THORN_W, THORN_H) && k.struck(round, "thorns")) {
      noteHit(round, `h${i}`);
      round.events.push({ type: "mowerCrash", what: "thorns", x, y: you.y });
      return true;
    }
  }
  for (const [i, x] of R.beasts.entries()) {
    const b = c.beasts[i];
    if (b.state !== "snap" || Math.abs(you.x - x) > 5) continue;
    if (boxHit(k, you, x, trackY(R, lineAt(R, x), x) ?? you.y, BEAST_W, BEAST_H) && k.struck(round, "snap")) {
      noteHit(round, `b${i}`);
      round.events.push({ type: "mowerCrash", what: "snap", x, y: you.y });
      Object.assign(b, { state: "sink", t: BEAST_SINK_MS });
      return true;
    }
  }
  return false;
}

// The line a thing at x stands on (the one under it).
const lineAt = (R, x) => {
  const top = topAt(R, x);
  return top ? top[0] : 0;
};

// The topiary beasts wake when the mower comes near: a shiver, then a lunge, then back to a bush.
function creatures(round, c, R, ms) {
  const you = round.you;
  R.beasts.forEach((x, i) => {
    const b = c.beasts[i];
    const y = trackY(R, lineAt(R, x), x) ?? you.y;
    if (b.state === "idle") {
      const ahead = x - you.x;
      if (ahead < BEAST_NEAR && ahead > -BEAST_W) {
        Object.assign(b, { state: "warn", t: BEAST_WARN_MS });
        round.events.push({ type: "mowerBeastWarn", x, y });
      }
    } else if (b.state === "warn" || b.state === "snap" || b.state === "sink") {
      b.t -= ms;
      if (b.t > 0) return;
      if (b.state === "warn") {
        Object.assign(b, { state: "snap", t: BEAST_UP_MS });
        round.events.push({ type: "mowerBeastSnap", x, y });
      } else if (b.state === "snap") Object.assign(b, { state: "sink", t: BEAST_SINK_MS });
      else Object.assign(b, { state: "spent", t: 0 });
    }
  });
}

/* ------------------------------------------------------------- targets */

// A bolt into something to shoot: a topiary beast lunging into the lane. True when one took it
// (the bolt is spent).
function mowerShot(round, s) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "mower" || !c || c.id !== "mower") return false;
  for (let i = 0; i < R.beasts.length; i++) {
    const b = c.beasts[i];
    const x = R.beasts[i];
    const y = trackY(R, lineAt(R, x), x) ?? 0;
    if (b.state !== "snap" || Math.abs(s.x - x) > BEAST_W / 2 + SHOT_R || s.y < y - SHOT_R || s.y > y + BEAST_H + SHOT_R) continue;
    b.hp--;
    if (b.hp > 0) round.events.push({ type: "mowerBeastHit", x, y: y + BEAST_H / 2 });
    else {
      Object.assign(b, { state: "broken", t: 0 });
      round.score += BEAST_POINTS;
      if (round.bonusRound) round.bonusRound.perf.acts++;
      round.events.push({ type: "mowerBeastBreak", x, y: y + BEAST_H / 2, points: BEAST_POINTS });
    }
    return true;
  }
  return false;
}

export const MOWER = freeze({
  id: "mower",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: mowerShot,
});
