// Plan2Code Web Console - Ghoul Rush's Grand Banister, its rules: the Manor's bonus round. YOU slide down the grand staircase's endless polished banister, from the attic landing to the foyer, in one long dizzying descent: jump the vases and candlesticks on the rail, duck the hanging portrait frames and the swinging chandeliers (time them by their pendulum), jump the breaks between the landings, shoot or jump the ghostly butlers that lunge with their silver trays, and shoot the cobwebs. As a stage pack that ghoul.js plugs in.
//
// Modeled on the Coffin Sled (ghoul-sled.js: read its header first) and, like it,
// handed a kit `k` of ghoul.js's own helpers, so this file never imports ghoul.js (it
// borrows the cart's track helpers). Pack fields used: `ride` (a hook that moves YOU, so
// no key walks you), `place` (put down in a room: a room set up or a respawn) and `target`
// (a bolt strikes something that is no monster: the butlers and the cobwebs). No monster,
// boss or hazard kind, so nothing to merge by name, and NO random number is drawn.
//
// Its state is the shared bonus-ride slot `round.runner` (null in any other room; see
// the "runner" lines in ghoul.js and ghoul-cart.js), and its room marks itself with
// `ride.runner: "banister"`.
//
// THE ROOM (spec.ride, see ghoul-rooms.js):
//
// - `track`: polylines [x, y] the rail runs along. The first `rails` of them are the
//   HANDRAIL (the upper rail), 20 flights of stairs: descents (slope -0.10 to -0.11) each
//   followed by a short climb (+0.29 to +0.31, the newel at the landing: the rail sweeps up
//   and over it), every crest a little lower than the last; a gap between two of them is a
//   BREAK in the banister (jump it, as the sled does its cracks: the rail flies on along its
//   last slope, a fall below DERAIL_Y is a heart, cause "plunge"). The lines after those are
//   the brass UNDER-RAILS, RAIL_SEP (7) under the handrail along the length of one descent
//   each (the split track): it begins and ends where the descent does, and ends in the air:
//   jump up off its end (the handrail is above and catches you) or it is a plunge.
//   The hill ends on a lip rising at 0.277 (over RAMP_SLOPE, so it launches: RAMP_POP) and
//   the foyer floor begins `finish` further on, lower; flying onto it ends the ride.
// - Which rail: a jump lands on the HIGHEST rail under you (the handrail). HOLD DOWN in the
//   air (a jump with DOWN held, a DIVE) to fall through it onto the under-rail where there is
//   one; up from the under-rail jumps back up to the handrail.
// - `props` [x, line, kind] (kind 0 a vase, VASE_W by VASE_H, kind 1 a candlestick,
//   CANDLE_W by CANDLE_H: jump), `lows` [x0, x1, y] (a hanging portrait frame, its
//   underside y, from there up to the roof: DUCK it; y is 3.0 over the highest handrail
//   under it, between a ducked box and a standing one), `swings` [x, line, amp, period ms,
//   phase ms] (a chandelier on a chain from the roof, swinging amp each way of x on a
//   pendulum of that period: see swingAt. Its bob is SWING_BOB_W wide and hangs from
//   SWING_LOW over the handrail under it at the middle of its swing to SWING_LOW +
//   SWING_RISE at the ends of it, and the chain makes the whole of it a wall from there up to
//   the roof: DUCK it, but only while the bob is above a ducked head; at the middle of its
//   swing it hangs lower than a ducked box and no ducking helps, so you pass it while it is
//   out at the end of its arc, or take the under-rail, which is under it), `butlers` [x,
//   line] (a ghostly butler waits; when you are BUTLER_NEAR short of it it bows BUTLER_WARN_MS,
//   then lunges up the rail at you at BUTLER_V for up to BUTLER_LUNGE_MS, BUTLER_W by
//   BUTLER_H: jump it, or shoot it, BUTLER_HP bolts), `webs` [x, line] (a cobweb across the
//   rail: shoot it for points; riding through only tears it), `checks`, `finish` and
//   `time` (the room's clock, ms).
// - The ground is the attic landing at the start and the foyer floor at the end only.
//
// YOU (`round.runner`): { id, v, line, coyote, from, left, check, done, clock, dive,
// butlers, webs }. You ride at (you.x, you.y), always facing right (`you.state` "run" on
// the rail, "air" off it, `you.ducking` ducked on it). Speed `v` relaxes to BAN_V (RELAX)
// and is pushed by the slope (SLOPE_G), between BAN_MIN and BAN_MAX; RIGHT leans (LEAN_ACC)
// and LEFT brakes (BRAKE_ACC) on the rail, which is how you time a chandelier. Up jumps at
// BAN_JUMP_V (plus the slope's own rise) against BAN_G (about 13 high, 0.75 s, 34 across at
// BAN_V), COYOTE_MS of grace after running off a line's end; down ducks (on the rail) or
// dives (in the air). `clock` is the pendulums' time in ms: it only runs while you ride.
// A bolt flies parallel to the rail under it, so the shooting is level with the stairs.
//
// A hit costs one of the round's five hearts (ghoul-bonus.js), not a life, and the ride
// rolls on, you blinking safe BONUS_SAFE_MS; the last heart gone ends the round with nothing,
// at once. A derail puts you back on the handrail (the highest line under you, else the next
// ahead) at BAN_V. Causes: "vase", "candle", "frame", "swing", "butler", "plunge". Every
// obstacle is a number for the grade (`perf.total`: props, lows, swings, butlers and breaks,
// each id once in `perf.hits` if it ever cost a heart). Shooting a butler or a web counts for
// `perf.acts` (the grade's goal is ACTS_GOAL) and the points below. The grade's `steady` die
// is a smooth slide: braking for no more than STEADY_BRAKE_MS in all.
//
// WHAT THE ART READS: `spec.ride` (above), `round.runner` { v, line, check, done, left, clock,
// butlers: [{ state "wait"|"warn"|"lunge"|"broken"|"spent", t, x }], webs: ["up"|"torn"|"shot"] },
// `round.you` (`state`, `vy`, `ducking`), the events in EVENTS.

import { linesAt, linesOf, slopeOf, trackY } from "../cart/ghoul-cart.js";

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "banJump", "banLand", "banLaunch", "banDuck", "banSwitch", "banCrash", "banCheck", "banFinish",
  "banButlerWarn", "banButlerLunge", "banButlerHit", "banButlerBreak", "banWebTear", "banWebShot",
]);

// The ride. Speeds are units across a second, BAN_G units a second squared.
export const BAN_V = 46;
export const BAN_MIN = 28;
export const BAN_MAX = 64;
export const SLOPE_G = 60;
export const RELAX = 1.5;
export const LEAN_ACC = 14;
export const BRAKE_ACC = 36;
export const BAN_JUMP_V = 74;
export const BAN_G = 200;
export const COYOTE_MS = 100;
export const RAMP_SLOPE = 0.25;
export const RAMP_POP = 30;
export const LAND_TOL = 0.9;
export const BIG_LAND = 8;
export const DERAIL_Y = 3;
export const CAM_AHEAD = 10;
export const CAM_PER_V = 0.25;
export const RAIL_SEP = 7;
// Obstacles.
export const VASE_W = 2.6;
export const VASE_H = 3.4;
export const CANDLE_W = 1.6;
export const CANDLE_H = 5.4;
export const SWING_BOB_W = 4.4;
export const SWING_LOW = 2.2;
export const SWING_RISE = 3;
export const BUTLER_W = 2.6;
export const BUTLER_H = 5;
export const BUTLER_HP = 2;
export const BUTLER_NEAR = 44;
export const BUTLER_WARN_MS = 500;
export const BUTLER_V = 14;
export const BUTLER_LUNGE_MS = 1400;
export const WEB_W = 3.2;
export const WEB_LO = 0.6;
export const WEB_HI = 5.6;
export const BUTLER_POINTS = 150;
export const WEB_POINTS = 50;
const SHOT_R = 0.5;
// The shots at things (butlers, webs) worth a die, and the braking a smooth slide allows.
export const ACTS_GOAL = 8;
export const STEADY_BRAKE_MS = 3000;

// Notes for a bonus round that obstacle `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

// Whether line `line` is one of the brass under-rails.
export const lowerLine = (R, line) => line >= R.rails;

// The highest line under x, as [line, y], or null over a break.
const topAt = (R, x) => linesAt(R, x)[0] || null;

// The line a rider falling from `py` to `y` at `x` lands on: the highest he crossed going
// down, or, diving, the lowest line under him (he falls through a rail with another below it).
function landOn(R, x, py, y, dive) {
  const under = linesAt(R, x);
  for (let i = 0; i < under.length; i++) {
    const [line, ly] = under[i];
    if (!(py >= ly - LAND_TOL && y <= ly)) continue;
    if (dive && i + 1 < under.length && under[i + 1][1] < ly - 1) continue;
    return { line, y: ly };
  }
  return null;
}

// Where a rider in the air at (x, y) going up at vy and across at v lands, if he does not
// steer (diving, or not): { x, y, line } or null when he derails. The unit suite's measure of
// which breaks a jump clears and which rail a dive lands on.
export function flight(R, x, y, vy, v, dive = false) {
  const dt = 0.004;
  for (let t = 0; t < 5; t += dt) {
    const py = y;
    vy = Math.max(-120, vy - BAN_G * dt);
    x += v * dt;
    y += vy * dt;
    if (vy <= 0) {
      const f = landOn(R, x, py, y, dive);
      if (f) return { x, y: f.y, line: f.line };
    }
    if (y < DERAIL_Y) return null;
  }
  return null;
}

// Chandelier `i` of the room at `t` ms: { x, u (-1 to 1, where it is on its arc), bottom (its
// underside) }. A pendulum: a sine, hanging lowest at the middle (u 0) and rising toward
// the ends, over the handrail directly under it.
export function swingAt(R, i, t) {
  const [cx, line, amp, period, phase] = R.swings[i];
  const u = Math.sin((2 * Math.PI * (t + phase)) / period);
  const x = cx + amp * u;
  const L = linesOf(R)[line];
  return { x, u, bottom: trackY(R, line, clamp(x, L.x0, L.x1)) + SWING_LOW + SWING_RISE * u * u };
}

/* -------------------------------------------------------------- placing */

// A fresh set of the room's things, each butler waiting and each web up. What was shot stays
// shot (`old`, the state of an earlier try in the same room).
function things(R, old) {
  return {
    butlers: R.butlers.map(([x], i) => ({ state: old && old.butlers[i].state === "broken" ? "broken" : "wait", t: 0, x, hp: BUTLER_HP })),
    webs: R.webs.map((w, i) => (old && old.webs[i] === "shot" ? "shot" : "up")),
  };
}

// Put down in the room: on the handrail at the start of a ride, or at the last checkpoint
// passed after the last heart (the same room).
function place(round) {
  const R = round.spec.ride;
  // (The Cart's `place` runs first and has already zeroed `round.camLead`: another room's lead is not ours to touch.)
  if (!R || R.runner !== "banister") {
    if (round.runner && round.runner.id === "banister") round.runner = null;
    return;
  }
  const old = round.runner && round.runner.id === "banister" && round.runner.room === round.room ? round.runner : null;
  const check = old ? old.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const top = topAt(R, x);
  Object.assign(you, { x, y: top ? top[1] : you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  round.runner = { id: "banister", room: round.room, check, v: BAN_V, line: top ? top[0] : -1, coyote: 0, from: you.y, left: top ? top[0] : 0, done: false, clock: old ? old.clock : 0, dive: false, ...things(R, old) };
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = R.props.length + R.lows.length + R.swings.length + R.butlers.length + (R.rails - 1);
    b.perf.steady = true;
    b.perf.goal = ACTS_GOAL;
  }
}

/* ------------------------------------------------------------ the ride */

// After a derail that cost a heart but not the ride: you and the rail go back onto the line
// nearest where you fell (the highest line under you, else the next one ahead) at BAN_V.
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
      .filter((L) => L.x0 > you.x && L.i < R.rails)
      .sort((a, b) => a.x0 - b.x0)[0];
    line = ahead ? ahead.i : R.rails - 1;
    x = ahead ? ahead.x0 + 2 : R.finish - 2;
    y = trackY(R, line, x) ?? you.y;
  }
  Object.assign(you, { x, y, vy: 0, state: "run", shelf: -1, ducking: false, coyote: 0, drop: -1 });
  Object.assign(c, { line, v: BAN_V, coyote: 0, from: y });
}

// The ride for one slice. Returns true once it has moved you (every slice of a ride); false
// outside a ride and once you have stepped out onto the foyer floor.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "banister" || !c || c.id !== "banister" || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  c.clock += ms;
  // Already down on the foyer floor (set there, or past the lip some other way): the ride is over.
  if (you.x >= R.finish && you.vy <= 0 && you.y <= k.groundAt(round.spec, you.x) + 0.01) return finish(round, c, R, k.groundAt(round.spec, you.x), k);
  // A stomp's bounce (or anything else) lifts you off the rail.
  if (you.state === "air" && c.line >= 0) {
    c.left = c.line;
    c.line = -1;
    c.coyote = 0;
    c.from = you.y;
  }
  steerShots(round, R);
  const want = inp.jump > 0;
  if (c.line >= 0) {
    // On the rail.
    const slope = slopeOf(R, c.line, you.x);
    let a = (BAN_V - c.v) * RELAX - SLOPE_G * slope;
    if (inp.right) a += LEAN_ACC;
    if (inp.left) a -= BRAKE_ACC;
    c.v = clamp(c.v + a * dt, BAN_MIN, BAN_MAX);
    // Braking is a bonus round's one thing not to do much of: too much is no smooth slide.
    if (inp.left && round.bonusRound && (round.bonusRound.perf.brakeMs = (round.bonusRound.perf.brakeMs || 0) + ms) > STEADY_BRAKE_MS) round.bonusRound.perf.steady = false;
    const duck = Boolean(inp.down) && !want;
    if (duck && !you.ducking) ev("banDuck");
    you.ducking = duck;
    if (want) {
      inp.jump = 0;
      you.vy = BAN_JUMP_V + slope * c.v;
      Object.assign(c, { left: c.line, line: -1, coyote: 0, from: you.y });
      you.state = "air";
      you.ducking = false;
      ev("banJump", { v: c.v });
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
        if (ramp) ev("banLaunch", { v: c.v, last: c.left === R.rails - 1 });
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
      you.vy = BAN_JUMP_V;
      c.from = you.y;
      ev("banJump", { v: c.v });
    }
    c.dive = Boolean(inp.down);
    const py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - BAN_G * dt);
    you.x += c.v * dt;
    you.y += you.vy * dt;
    you.ducking = false;
    you.state = "air";
    if (you.vy <= 0) {
      const f = landOn(R, you.x, py, you.y, c.dive);
      if (f) {
        you.y = f.y;
        you.vy = 0;
        you.state = "run";
        const was = lowerLine(R, c.left);
        c.line = f.line;
        ev("banLand", { big: c.from - f.y >= BIG_LAND });
        if (lowerLine(R, f.line) !== was) ev("banSwitch", { lower: lowerLine(R, f.line) });
        c.from = f.y;
      } else if (you.x >= R.finish) {
        // Over the foyer floor at the end: down onto it, and the ride is over.
        const g = k.groundAt(round.spec, you.x);
        if (g > -Infinity && you.y <= g + 0.01) return finish(round, c, R, g, k);
      }
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Past the end of the world: a break, the end of an under-rail, or the face of the foyer.
  if (you.y < DERAIL_Y || k.groundAt(round.spec, you.x) > you.y + 0.5) {
    if (!lowerLine(R, c.left)) noteHit(round, `g${c.left}`);
    if (k.lose(round, "plunge") && round.phase === "play") reseat(round, c, R);
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("banCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD + (c.v - BAN_V) * CAM_PER_V;
  if (obstacles(round, c, R, k)) return true;
  creatures(round, c, R, ms);
  return true;
}

// The ride is over: the banister ends, the door opens, you walk out across the foyer.
function finish(round, c, R, g, k) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  Object.assign(you, { y: g, vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  round.events.push({ type: "banFinish", x: you.x, y: you.y, big: c.from - g >= BIG_LAND });
  return false;
}

// A bolt flies parallel to the rail under it, whatever way you aimed (`s.off`): the stairs are
// steep, and a level bolt would sail over everything on a descent.
function steerShots(round, R) {
  for (const s of round.shots) {
    if (s.arm || s.free) continue;
    if (s.off === undefined) s.off = s.vy;
    const top = topAt(R, s.x);
    if (top) s.sl = slopeOf(R, top[0], s.x);
    s.vy = s.vx * (s.sl ?? 0) + s.off;
  }
}

// What you run into: a prop, a hanging frame, a chandelier, a butler. Returns whether it
// cost a heart. A web only tears.
function obstacles(round, c, R, k) {
  const you = round.you;
  const hh = duckH(k, you);
  for (const [i, [x0, x1, y]] of R.lows.entries()) {
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > y && k.struck(round, "frame")) {
      noteHit(round, `f${i}`);
      round.events.push({ type: "banCrash", what: "frame", x: you.x, y: you.y + hh });
      return true;
    }
  }
  for (let i = 0; i < R.swings.length; i++) {
    const [cx, , amp] = R.swings[i];
    if (Math.abs(you.x - cx) > amp + SWING_BOB_W + 2) continue;
    const s = swingAt(R, i, c.clock);
    if (Math.abs(you.x - s.x) < (SWING_BOB_W + k.HIT_W) / 2 && you.y + hh > s.bottom && k.struck(round, "swing")) {
      noteHit(round, `w${i}`);
      round.events.push({ type: "banCrash", what: "swing", x: s.x, y: s.bottom });
      return true;
    }
  }
  for (const [i, [x, line, kind]] of R.props.entries()) {
    if (Math.abs(you.x - x) > 6) continue;
    const cause = kind ? "candle" : "vase";
    if (boxHit(k, you, x, trackY(R, line, x), kind ? CANDLE_W : VASE_W, kind ? CANDLE_H : VASE_H) && k.struck(round, cause)) {
      noteHit(round, `p${i}`);
      round.events.push({ type: "banCrash", what: cause, x, y: you.y });
      return true;
    }
  }
  for (const [i, b] of c.butlers.entries()) {
    if (b.state !== "warn" && b.state !== "lunge") continue;
    if (Math.abs(you.x - b.x) > 6) continue;
    const y = trackY(R, R.butlers[i][1], clamp(b.x, linesOf(R)[R.butlers[i][1]].x0, linesOf(R)[R.butlers[i][1]].x1));
    if (boxHit(k, you, b.x, y, BUTLER_W, BUTLER_H) && k.struck(round, "butler")) {
      noteHit(round, `b${i}`);
      round.events.push({ type: "banCrash", what: "butler", x: b.x, y: you.y });
      Object.assign(b, { state: "spent", t: 0 });
      return true;
    }
  }
  R.webs.forEach(([x, line], i) => {
    if (c.webs[i] !== "up" || Math.abs(you.x - x) > 4) return;
    const y = trackY(R, line, x);
    if (y !== null && Math.abs(you.x - x) < (k.HIT_W + WEB_W) / 2 && you.y < y + WEB_HI && you.y + hh > y + WEB_LO) {
      c.webs[i] = "torn";
      round.events.push({ type: "banWebTear", x, y: y + 3 });
    }
  });
  return false;
}

// The butlers wake when you come near, bow, and lunge up the rail at you.
function creatures(round, c, R, ms) {
  const you = round.you;
  R.butlers.forEach(([hx, line], i) => {
    const b = c.butlers[i];
    const L = linesOf(R)[line];
    const y = () => trackY(R, line, clamp(b.x, L.x0, L.x1));
    if (b.state === "wait") {
      const ahead = hx - you.x;
      if (ahead < BUTLER_NEAR && ahead > -BUTLER_W) {
        Object.assign(b, { state: "warn", t: BUTLER_WARN_MS });
        round.events.push({ type: "banButlerWarn", x: b.x, y: y() });
      }
    } else if (b.state === "warn") {
      b.t -= ms;
      if (b.t <= 0) {
        Object.assign(b, { state: "lunge", t: BUTLER_LUNGE_MS });
        round.events.push({ type: "banButlerLunge", x: b.x, y: y() });
      }
    } else if (b.state === "lunge") {
      b.t -= ms;
      b.x = Math.max(L.x0 + 1, b.x - BUTLER_V * (ms / 1000));
      if (b.t <= 0 || b.x < you.x - 10) Object.assign(b, { state: "spent", t: 0 });
    }
  });
}

/* ------------------------------------------------------------- targets */

// A bolt into something to shoot: a butler on the move, a cobweb. True when one took it.
function banisterShot(round, s) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "banister" || !c || c.id !== "banister") return false;
  const hit = (x, y0, w, h) => Math.abs(s.x - x) <= w / 2 + SHOT_R && s.y >= y0 - SHOT_R && s.y <= y0 + h + SHOT_R;
  const score = (n) => {
    round.score += n;
    if (round.bonusRound) round.bonusRound.perf.acts++;
  };
  for (let i = 0; i < R.butlers.length; i++) {
    const b = c.butlers[i];
    if (b.state !== "warn" && b.state !== "lunge") continue;
    const L = linesOf(R)[R.butlers[i][1]];
    const y = trackY(R, R.butlers[i][1], clamp(b.x, L.x0, L.x1));
    if (!hit(b.x, y, BUTLER_W, BUTLER_H)) continue;
    b.hp--;
    if (b.hp > 0) round.events.push({ type: "banButlerHit", x: b.x, y: y + BUTLER_H / 2 });
    else {
      Object.assign(b, { state: "broken", t: 0 });
      score(BUTLER_POINTS);
      round.events.push({ type: "banButlerBreak", x: b.x, y: y + BUTLER_H / 2, points: BUTLER_POINTS });
    }
    return true;
  }
  for (let i = 0; i < R.webs.length; i++) {
    if (c.webs[i] !== "up") continue;
    const [x, line] = R.webs[i];
    const y = trackY(R, line, x);
    if (y === null || !hit(x, y + WEB_LO, WEB_W, WEB_HI - WEB_LO)) continue;
    c.webs[i] = "shot";
    score(WEB_POINTS);
    round.events.push({ type: "banWebShot", x, y: y + 3, points: WEB_POINTS });
    return true;
  }
  return false;
}

export const BANISTER = freeze({
  id: "banister",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: banisterShot,
});
