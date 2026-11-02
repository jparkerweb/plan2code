// Plan2Code Web Console - Ghoul Rush's Coffin Sled, its rules: the Frozen Lake's bonus round. Planny rides a coffin lid down a long frozen cemetery hill at speed: jump the cracks, headstones and snowdrifts, duck the low branches and tombstone arches, shoot the icicles and the ghouls that pop up beside the track, and take a gentle jump off the end, as a stage pack that ghoul.js plugs in.
//
// Modeled on the Runaway Cart (ghoul-cart.js: read its header first) and, like it,
// handed a kit `k` of ghoul.js's own helpers, so this file never imports
// ghoul.js (it borrows the cart's track helpers). Pack fields used: `ride` (a hook that
// moves Planny himself, so no key walks him), `place` (Planny put down in a room: a
// room set up or a respawn) and `target` (a bolt strikes something that is no monster:
// the icicles, the popping ghouls and the hands). It adds no monster, boss or hazard
// kind, so there is nothing to merge by name, and it draws NO random number.
//
// THE ROOM (spec.ride, see ghoul-rooms.js; the room has `sled: true` in it, which the
// Cart's `place` knows to leave alone):
//
// - `track`: polylines [x, y] the sled slides along, one per stretch of ice; a gap
//   between two lines is a CRACK (jump it: the sled flies on along its last slope,
//   drops, and a fall below DERAIL_Y is a heart, cause "crevasse"). The hill is 16
//   descents (slope -0.11 to -0.13) with a short climb (+0.29 to +0.31) after each
//   but the last, every crest a little lower than the last: the field is only 54
//   high, so the hill cannot fall more than the room does, and the speed (SLED_V,
//   faster downhill, slower up) and the art give the rest. It ends on a lip rising
//   at 0.28 (over RAMP_SLOPE, so it launches: RAMP_POP) and the snowbank begins
//   `finish` further on, lower; flying onto it ends the ride (`sledFinish`).
// - `stones` [x, line] (STONE_W by STONE_H: jump), `drifts` [x, line] (DRIFT_W by
//   DRIFT_H: jump), `lows` [x0, x1, y, kind] (a low branch, kind 0, or a tombstone
//   arch, kind 1: its underside is y, from there up to the roof, so DUCK it; the
//   room puts y 3.0 over the highest track under it, between a ducked box and a
//   standing one), `hands` [x, line] (a ghoul hand reaching out of the snow: it
//   shows as a stirring mound and, when the sled is HAND_NEAR short of it, shivers
//   HAND_WARN_MS and then reaches up HAND_UP_MS, HAND_W by HAND_H over the track:
//   jump it, or shoot it, HAND_HP bolts), `icicles` [x, line] (a hanging cluster,
//   ICICLE_W wide, from ICICLE_LO to ICICLE_HI over the track, for one bolt),
//   `pops` [x, line] (a ghoul pops up beside the track when the sled is POP_NEAR
//   short of it, stands POP_UP_MS, POP_W by POP_H, one bolt, then ducks down again),
//   `checks` (x positions of the checkpoints), `finish` (where the snowbank starts)
//   and `time` (the room's clock, ms).
// - The ground is the start's hilltop and the snowbank at the end only.
//
// THE SLED (`round.sled`, null in any other room): { v, line, coyote, from, left, check,
// done, hands, pops, icicles, ... }. Planny rides at (you.x, you.y), always facing
// right (`you.state` "run" on the ice, "air" off it, `you.ducking` ducked on the
// lid). Speed `v` relaxes to SLED_V (RELAX) and is pushed by the slope (SLOPE_G),
// between SLED_MIN and SLED_MAX: nothing in the game changes it, it is a ride. Up
// jumps at SLED_JUMP_V (plus the slope's own rise) against SLED_G (about 13 high,
// 0.75 s, 34 across at SLED_V), COYOTE_MS of grace after running off a line's end;
// down ducks. A bolt flies parallel to the track under it (`s.off` keeps what he
// aimed), so the shooting is level with the hill whatever its slope.
//
// A hit costs one of the round's five hearts (ghoul-bonus.js), not a life, and the sled
// rolls on, Planny blinking safe BONUS_SAFE_MS; the last heart gone ends the round
// with nothing, at once. A derail puts him back on the track (the line under him,
// else the next ahead) at SLED_V. Causes: "tomb" (a headstone), "drift", "branch"
// (a low branch or an arch), "grasp" (a hand), "crevasse" (a fall). Every obstacle is
// a number for the grade (`perf.total`: stones, drifts, lows, hands and cracks, each
// id once in `perf.hits` if it ever cost a heart). Shooting an icicle, a ghoul or a
// hand counts for `perf.acts` (the grade's goal is ACTS_GOAL, 12 of them) and the points below.
// The "sweet tooth" die (the grade's `steady`): the souls taken, plus SWEET_COCOA for
// each Hot Cocoa drunk, reach SWEET_SHARE of the souls laid out along the hill.
//
// Checkpoints are passed at their x (`sledCheck`); a restart after the last heart
// goes back to the last one passed (that ends the round, as the cart's does).
//
// WHAT THE ART READS: `spec.ride` (above), `round.sled` { v, line, check, done, left,
// hands: [{ state "snow"|"warn"|"up"|"sink"|"broken", t (ms left in the state) }],
// pops: [{ state "down"|"up"|"hid"|"broken", t }], icicles: [broken], sweet },
// `round.you` (`state`, `vy`, `ducking`), the events in EVENTS.

import { linesAt, linesOf, slopeOf, trackY } from "./ghoul-cart.js";

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "sledJump", "sledLand", "sledLaunch", "sledDuck", "sledCrash", "sledCheck", "sledFinish",
  "sledHandWarn", "sledHandUp", "sledHandHit", "sledHandBreak", "sledPopUp", "sledPopHit", "sledIcicle",
]);

// The sled. Speeds are units across a second, SLED_G units a second squared.
export const SLED_V = 45;
export const SLED_MIN = 28;
export const SLED_MAX = 62;
export const SLOPE_G = 60;
export const RELAX = 1.5;
export const SLED_JUMP_V = 74;
export const SLED_G = 200;
export const COYOTE_MS = 100;
export const RAMP_SLOPE = 0.25;
export const RAMP_POP = 30;
export const LAND_TOL = 0.9;
export const BIG_LAND = 8;
export const DERAIL_Y = 3;
export const CAM_AHEAD = 10;
export const CAM_PER_V = 0.25;
// Obstacles.
export const STONE_W = 2.6;
export const STONE_H = 5;
export const DRIFT_W = 7.5;
export const DRIFT_H = 2.4;
export const HAND_W = 2.6;
export const HAND_H = 3.6;
export const HAND_HP = 2;
export const HAND_NEAR = 34;
export const HAND_WARN_MS = 450;
export const HAND_UP_MS = 1600;
export const HAND_SINK_MS = 300;
// Targets: an icicle cluster, a popping ghoul, and the points for each.
export const ICICLE_W = 2.2;
export const ICICLE_LO = 1.4;
export const ICICLE_HI = 5.4;
export const POP_W = 2.8;
export const POP_H = 4.6;
export const POP_NEAR = 42;
export const POP_UP_MS = 2400;
export const POP_RISE_MS = 260;
export const ICICLE_POINTS = 50;
export const POP_POINTS = 150;
export const HAND_POINTS = 100;
const SHOT_R = 0.5;
// The sweet tooth die.
export const SWEET_SHARE = 0.45;
export const SWEET_COCOA = 14;
// The shots at things (icicles, ghouls, hands) worth a die.
export const ACTS_GOAL = 12;

// Notes for a bonus round that obstacle `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

// The highest line under x, as [line, y], or null over a crack.
const topAt = (R, x) => linesAt(R, x)[0] || null;

// The highest line the sled, falling from `py` to `y` at `x`, crossed going down.
function landOn(R, x, py, y) {
  for (const [line, ly] of linesAt(R, x)) if (py >= ly - LAND_TOL && y <= ly) return { line, y: ly };
  return null;
}

// Where a sled in the air at (x, y) going up at vy and across at v lands, if it
// does not steer: { x, y, line } or null when it derails. The unit suite's measure
// of which cracks a jump clears.
export function flight(R, x, y, vy, v) {
  const dt = 0.004;
  for (let t = 0; t < 5; t += dt) {
    const py = y;
    vy = Math.max(-120, vy - SLED_G * dt);
    x += v * dt;
    y += vy * dt;
    if (vy <= 0) {
      const f = landOn(R, x, py, y);
      if (f) return { x, y: f.y, line: f.line };
    }
    if (y < DERAIL_Y) return null;
  }
  return null;
}

/* -------------------------------------------------------------- placing */

// A fresh set of the room's things, each hand in the snow and each ghoul down. What was
// shot stays shot (`old`, the sled of an earlier try in the same room).
function things(R, old) {
  const was = (list, i, state) => (old && old[list] && old[list][i] && old[list][i].state === state ? state : null);
  return {
    hands: R.hands.map((h, i) => ({ state: was("hands", i, "broken") || "snow", t: 0, hp: HAND_HP })),
    pops: R.pops.map((p, i) => ({ state: was("pops", i, "broken") || "down", t: 0 })),
    icicles: R.icicles.map((c, i) => Boolean(old && old.icicles[i])),
  };
}

// Planny put down in the room: on the sled at the start of a ride, or at the last
// checkpoint passed after the last heart (the same room).
function place(round, k) {
  const R = round.spec.ride;
  // (The Cart's `place` runs first and has already zeroed `round.camLead`: another room's lead is not ours to touch.)
  if (!R || !R.sled) {
    round.sled = null;
    return;
  }
  const again = round.sled && round.sled.room === round.room;
  const check = again ? round.sled.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const top = topAt(R, x);
  Object.assign(you, { x, y: top ? top[1] : you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  round.sled = { room: round.room, check, v: SLED_V, line: top ? top[0] : -1, coyote: 0, from: you.y, left: top ? top[0] : 0, done: false, sweet: again ? round.sled.sweet : 0, cocoa: again ? round.sled.cocoa : 0, sweetMs: 0, ...things(R, again ? round.sled : null) };
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = R.stones.length + R.drifts.length + R.lows.length + R.hands.length + (R.track.length - 1);
    b.perf.steady = false;
    b.perf.goal = ACTS_GOAL;
  }
}

/* ------------------------------------------------------------ the ride */

// After a derail that cost a heart but not the ride: Planny and the sled go back onto
// the track nearest where they fell (the highest line under him, else the next one
// ahead) at SLED_V. He blinks safe (ghoul.js's takeLife).
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
  Object.assign(c, { line, v: SLED_V, coyote: 0, from: y });
}

// The grade's sweet tooth: the souls taken and the cocoa drunk against what is laid out.
function sweetness(round, c) {
  c.cocoa = round.spec.items.reduce((n, it, i) => n + (round.items[i] && round.loot[i] === "cocoa" ? 1 : 0), 0);
  c.sweet = round.candy.reduce((n, got) => n + (got ? 1 : 0), 0) + c.cocoa * SWEET_COCOA;
  const b = round.bonusRound;
  if (b) b.perf.steady = c.sweet >= Math.ceil(SWEET_SHARE * round.candy.length);
}

// The sled's motion for one slice. Returns true once it has moved Planny (every slice
// of a ride); false outside a ride and once he has stepped out onto the snowbank.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = round.sled;
  if (!R || !R.sled || !c || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  // Already down on the snowbank (set there, or past the lip some other way): the ride is over.
  if (you.x >= R.finish && you.vy <= 0 && you.y <= k.groundAt(round.spec, you.x) + 0.01) return finish(round, c, R, k.groundAt(round.spec, you.x), k);
  // A stomp's bounce (or anything else) lifts the sled off its line.
  if (you.state === "air" && c.line >= 0) {
    c.left = c.line;
    c.line = -1;
    c.coyote = 0;
    c.from = you.y;
  }
  steerShots(round, R);
  const want = inp.jump > 0;
  if (c.line >= 0) {
    // On the ice.
    const slope = slopeOf(R, c.line, you.x);
    c.v = clamp(c.v + ((SLED_V - c.v) * RELAX - SLOPE_G * slope) * dt, SLED_MIN, SLED_MAX);
    const duck = Boolean(inp.down) && !want;
    if (duck && !you.ducking) ev("sledDuck");
    you.ducking = duck;
    if (want) {
      inp.jump = 0;
      you.vy = SLED_JUMP_V + slope * c.v;
      Object.assign(c, { left: c.line, line: -1, coyote: 0, from: you.y });
      you.state = "air";
      you.ducking = false;
      ev("sledJump", { v: c.v });
    } else {
      const L = linesOf(R)[c.line];
      const nx = you.x + c.v * dt;
      you.state = "run";
      you.vy = 0;
      if (nx >= L.x1) {
        // Off the end of the line, on along its last slope.
        const end = L.pts[L.pts.length - 1];
        const rise = slopeOf(R, c.line, L.x1);
        you.x = L.x1;
        you.y = end[1];
        const ramp = rise >= RAMP_SLOPE;
        you.vy = rise * c.v + (ramp ? RAMP_POP : 0);
        Object.assign(c, { left: c.line, line: -1, coyote: COYOTE_MS, from: you.y });
        you.state = "air";
        you.ducking = false;
        if (ramp) ev("sledLaunch", { v: c.v, last: c.left === linesOf(R).length - 1 });
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
      you.vy = SLED_JUMP_V;
      c.from = you.y;
      ev("sledJump", { v: c.v });
    }
    const py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - SLED_G * dt);
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
        ev("sledLand", { big: c.from - f.y >= BIG_LAND });
        c.from = f.y;
      } else if (you.x >= R.finish) {
        // Over the snowbank at the end: down onto it, and the ride is over.
        const g = k.groundAt(round.spec, you.x);
        if (g > -Infinity && you.y <= g + 0.01) return finish(round, c, R, g, k);
      }
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Past the end of the world: a crack, or the face of the snowbank.
  if (you.y < DERAIL_Y || k.groundAt(round.spec, you.x) > you.y + 0.5) {
    noteHit(round, `k${c.left}`);
    if (k.lose(round, "crevasse") && round.phase === "play") reseat(round, c, R);
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("sledCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD + (c.v - SLED_V) * CAM_PER_V;
  c.sweetMs -= ms;
  if (c.sweetMs <= 0) {
    c.sweetMs = 400;
    sweetness(round, c);
  }
  if (obstacles(round, c, R, k)) return true;
  creatures(round, c, R, ms, k);
  return true;
}

// The ride is over: the sled halts on the snowbank, the door opens, Planny walks out.
function finish(round, c, R, g, k) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  Object.assign(you, { y: g, vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  sweetness(round, c);
  round.events.push({ type: "sledFinish", x: you.x, y: you.y, big: c.from - g >= BIG_LAND });
  return false;
}

// A bolt flies parallel to the track under it, whatever way he aimed (`s.off`): the
// hill is steep, and a level bolt would sail over everything on a descent.
function steerShots(round, R) {
  for (const s of round.shots) {
    if (s.arm || s.free) continue;
    if (s.off === undefined) s.off = s.vy;
    const top = topAt(R, s.x);
    if (top) s.sl = slopeOf(R, top[0], s.x);
    s.vy = s.vx * (s.sl ?? 0) + s.off;
  }
}

// What the sled runs into: a headstone, a drift, a low branch or arch, a hand.
// Returns whether it cost a heart.
function obstacles(round, c, R, k) {
  const you = round.you;
  const hh = duckH(k, you);
  for (const [i, [x0, x1, y]] of R.lows.entries()) {
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > y && k.struck(round, "branch")) {
      noteHit(round, `l${i}`);
      round.events.push({ type: "sledCrash", what: "low", x: you.x, y: you.y + hh });
      return true;
    }
  }
  for (const [i, [x, line]] of R.stones.entries()) {
    if (Math.abs(you.x - x) > 6) continue;
    if (boxHit(k, you, x, trackY(R, line, x), STONE_W, STONE_H) && k.struck(round, "tomb")) {
      noteHit(round, `s${i}`);
      round.events.push({ type: "sledCrash", what: "stone", x, y: you.y });
      return true;
    }
  }
  for (const [i, [x, line]] of R.drifts.entries()) {
    if (Math.abs(you.x - x) > 8) continue;
    if (boxHit(k, you, x, trackY(R, line, x), DRIFT_W, DRIFT_H) && k.struck(round, "drift")) {
      noteHit(round, `d${i}`);
      round.events.push({ type: "sledCrash", what: "drift", x, y: you.y });
      return true;
    }
  }
  for (const [i, [x, line]] of R.hands.entries()) {
    const h = c.hands[i];
    if (h.state !== "up" || Math.abs(you.x - x) > 5) continue;
    if (boxHit(k, you, x, trackY(R, line, x), HAND_W, HAND_H) && k.struck(round, "grasp")) {
      noteHit(round, `h${i}`);
      round.events.push({ type: "sledCrash", what: "hand", x, y: you.y });
      Object.assign(h, { state: "sink", t: HAND_SINK_MS });
      return true;
    }
  }
  return false;
}

// The hands in the snow and the ghouls beside the track wake when the sled comes near.
function creatures(round, c, R, ms, k) {
  const you = round.you;
  R.hands.forEach(([x, line], i) => {
    const h = c.hands[i];
    const y = trackY(R, line, x);
    if (h.state === "snow") {
      const ahead = x - you.x;
      if (ahead < HAND_NEAR && ahead > -HAND_W) {
        Object.assign(h, { state: "warn", t: HAND_WARN_MS });
        round.events.push({ type: "sledHandWarn", x, y });
      }
    } else if (h.state === "warn" || h.state === "up" || h.state === "sink") {
      h.t -= ms;
      if (h.t > 0) return;
      if (h.state === "warn") {
        Object.assign(h, { state: "up", t: HAND_UP_MS });
        round.events.push({ type: "sledHandUp", x, y });
      } else if (h.state === "up") Object.assign(h, { state: "sink", t: HAND_SINK_MS });
      else Object.assign(h, { state: "spent", t: 0 });
    }
  });
  R.pops.forEach(([x], i) => {
    const p = c.pops[i];
    if (p.state === "down") {
      const ahead = x - you.x;
      if (ahead < POP_NEAR && ahead > -POP_W) {
        Object.assign(p, { state: "up", t: POP_UP_MS });
        round.events.push({ type: "sledPopUp", x, y: trackY(R, R.pops[i][1], x) });
      }
    } else if (p.state === "up") {
      p.t -= ms;
      if (p.t <= 0) Object.assign(p, { state: "hid", t: 0 });
    }
  });
}

/* ------------------------------------------------------------- targets */

// A bolt into something to shoot: a hand reaching out, a ghoul that has popped up, an
// icicle. True when one took it (the bolt is spent).
function sledShot(round, s) {
  const R = round.spec.ride;
  const c = round.sled;
  if (!R || !R.sled || !c) return false;
  const hit = (x, y0, w, h) => Math.abs(s.x - x) <= w / 2 + SHOT_R && s.y >= y0 - SHOT_R && s.y <= y0 + h + SHOT_R;
  const score = (n) => {
    round.score += n;
    if (round.bonusRound) round.bonusRound.perf.acts++;
  };
  for (let i = 0; i < R.hands.length; i++) {
    const h = c.hands[i];
    const [x, line] = R.hands[i];
    const y = trackY(R, line, x);
    if (h.state !== "up" || !hit(x, y, HAND_W, HAND_H)) continue;
    h.hp--;
    if (h.hp > 0) round.events.push({ type: "sledHandHit", x, y: y + HAND_H / 2 });
    else {
      Object.assign(h, { state: "broken", t: 0 });
      score(HAND_POINTS);
      round.events.push({ type: "sledHandBreak", x, y: y + HAND_H / 2, points: HAND_POINTS });
    }
    return true;
  }
  for (let i = 0; i < R.pops.length; i++) {
    const p = c.pops[i];
    const [x, line] = R.pops[i];
    const y = trackY(R, line, x);
    if (p.state !== "up" || POP_UP_MS - p.t < POP_RISE_MS || !hit(x, y, POP_W, POP_H)) continue;
    p.state = "broken";
    score(POP_POINTS);
    round.events.push({ type: "sledPopHit", x, y: y + POP_H / 2, points: POP_POINTS });
    return true;
  }
  for (let i = 0; i < R.icicles.length; i++) {
    if (c.icicles[i]) continue;
    const [x, line] = R.icicles[i];
    const y = trackY(R, line, x);
    if (!hit(x, y + ICICLE_LO, ICICLE_W, ICICLE_HI - ICICLE_LO)) continue;
    c.icicles[i] = true;
    score(ICICLE_POINTS);
    round.events.push({ type: "sledIcicle", x, y: y + (ICICLE_LO + ICICLE_HI) / 2, points: ICICLE_POINTS });
    return true;
  }
  return false;
}

export const SLED = freeze({
  id: "sled",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: sledShot,
});
