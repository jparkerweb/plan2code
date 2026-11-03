// Plan2Code Web Console - Ghoul Rush's Servants' Back Stairs, its rules: the East Wing's bonus round. YOU ride a huge silver serving tray down the cramped back stairs and through the steamy basement kitchens in one long clattering rush: jump the rolling pots, dropped cutlery and the gaps between flights, duck the swinging hams and hanging copper pans, shoot (or jump) the dishes the spectral cooks fling, and eat your way through the courses on the route, as a stage pack that ghoul.js plugs in.
//
// Modeled on the Coffin Sled (ghoul-sled.js: read its header first) and, like it, handed a
// kit `k` of ghoul.js's own helpers, so this file never imports ghoul.js (it borrows the
// Cart's track helpers). Pack fields used: `ride` (a hook that moves Planny himself, so no
// key walks him), `place` (Planny put down in a room) and `target` (a bolt strikes something
// that is no monster: the plates, the cooks and their dishes). It adds no monster, boss or
// hazard kind and draws NO random number. Its state is `round.runner` (the shared slot for a
// rolling bonus ride, with `id: "tray"`), and the room's `ride.runner` is "tray".
//
// THE ROOM (spec.ride, see ghoul-rooms.js):
//
// - `track`: polylines [x, y] the tray slides along (the sled's: a gap between two lines is a
//   crack to jump, cause "tumble"). The route is 17 laps of a climb onto a pantry shelf (+0.28),
//   a flat run along it and a flight of back stairs down (-0.17), each lap a little lower than
//   the last; a gap between two lines is the gap between two flights. The last line ends on a
//   rising lip (over RAMP_SLOPE) that launches the tray onto the dining table at `finish`.
// - `pots` [x, line, kind] (a rolling pot, kind 0, or a drop of cutlery, kind 1: POT_W by POT_H
//   or CUTLERY_W by CUTLERY_H, JUMP), `lows` [x0, x1, y, kind] (a swinging ham, kind 0, or
//   hanging copper pans, kind 1: the underside is y, to the roof, so DUCK it: 3.0 over the
//   highest track under it), `cooks` [x, line] (a spectral cook who, when the tray is COOK_NEAR
//   short of him, winds up COOK_WIND_MS and flings a dish that flies left at DISH_V at
//   DISH_LO up: JUMP it, or shoot the cook, one bolt, or the dish itself),
//   `domes` [x, line, lift] (a silver dome, DOME_W by DOME_H, lift over the track: run through
//   it, a high one takes a jump), `plates` [x, line, lift] (a flying plate with a dessert,
//   PLATE_W by PLATE_H: SHOOT it to catch the dessert), `grease` [x0, x1] (flat stretches
//   where the tray picks up to GREASE_V), `checks`, `finish` and `time`. The room's `candy` are
//   the cherries along the route.
//
// THE TWIST (the courses): every dome run through and every plate shot is a course
// (`round.runner.served`); SEVEN (COURSES_GOAL) is a full seven course meal and the grade's
// "acts" die. The cherries taken are the other die (CHERRY_SHARE of them: `perf.steady`). So
// the best ride is a hungry, aggressive one: jumping for the high domes, shooting plates on
// the way, over greased stretches that come quicker than the rest.
//
// THE TRAY (`round.runner`): { id, room, v, line, coyote, from, left, check, done, served,
// domes, plates, cooks, cherries, ... }. Planny rides at (you.x, you.y), always facing right.
// Speed `v` relaxes to TRAY_V (GREASE_V on a grease stretch) and is pushed by the slope
// (SLOPE_G), between TRAY_MIN and TRAY_MAX. Up jumps (TRAY_JUMP_V against TRAY_G: about 13
// high, 0.75 s, 33 across at TRAY_V), COYOTE_MS of grace; down ducks. A bolt flies parallel
// to the track (`s.off` keeps what he aimed).
//
// A hit costs one of the round's five hearts (ghoul-bonus.js), not a life; the tray rolls on,
// Planny blinking safe BONUS_SAFE_MS; the last heart gone ends the round with nothing. Causes:
// "pot", "cutlery", "ham", "pans", "dish", "tumble" (a fall). Every obstacle is a number for
// the grade (`perf.total`: pots, lows, cooks and cracks, each id once in `perf.hits`).
//
// WHAT THE ART READS: `spec.ride`, `round.runner` { v, line, check, done, served, domes
// [taken], plates [caught], cooks: [{ state "down" | "up" | "toss" | "spent" | "broken", t,
// dish: null | { x, y } }] }, `round.you`, the events in EVENTS.

import { linesAt, linesOf, slopeOf, trackY } from "../cart/ghoul-cart.js";

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "trayJump", "trayLand", "trayLaunch", "trayDuck", "trayCrash", "trayCheck", "trayFinish",
  "trayDome", "trayPlate", "trayCookUp", "trayToss", "trayCookHit", "trayDishBreak",
]);

// The tray. Speeds are units across a second, TRAY_G units a second squared.
export const TRAY_V = 44;
export const GREASE_V = 60;
export const TRAY_MIN = 28;
export const TRAY_MAX = 66;
export const SLOPE_G = 60;
export const RELAX = 1.5;
export const TRAY_JUMP_V = 74;
export const TRAY_G = 200;
export const COYOTE_MS = 100;
export const RAMP_SLOPE = 0.25;
export const RAMP_POP = 30;
export const LAND_TOL = 0.9;
export const BIG_LAND = 8;
export const DERAIL_Y = 3;
export const CAM_AHEAD = 10;
export const CAM_PER_V = 0.25;
// Obstacles.
export const POT_W = 2.8;
export const POT_H = 2.8;
export const CUTLERY_W = 4.6;
export const CUTLERY_H = 1.8;
export const COOK_W = 2.8;
export const COOK_H = 4.8;
export const COOK_NEAR = 58;
export const COOK_WIND_MS = 700;
export const COOK_STAY_MS = 1500;
export const DISH_V = 24;
export const DISH_W = 2.2;
export const DISH_H = 1.4;
export const DISH_LO = 1.6;
// The courses: a dome run through, a plate shot, a cook shot, and the points for each.
export const DOME_W = 2.8;
export const DOME_H = 2.4;
export const PLATE_W = 3.2;
export const PLATE_H = 2.8;
export const DOME_POINTS = 80;
export const PLATE_POINTS = 120;
export const COOK_POINTS = 150;
const SHOT_R = 0.5;
// The grade: a seven course meal is the acts die; the cherries are the steady die.
export const COURSES_GOAL = 7;
export const CHERRY_SHARE = 0.45;

// Notes for a bonus round that obstacle `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

// The highest line under x, as [line, y], or null over a crack.
const topAt = (R, x) => linesAt(R, x)[0] || null;

// The tray's state in this round, or null (the shared slot may hold another ride's).
const mine = (round) => (round.runner && round.runner.id === "tray" ? round.runner : null);

// Whether x is on a greased stretch.
export const greasy = (R, x) => R.grease.some(([a, b]) => x >= a && x <= b);

// The highest line the tray, falling from `py` to `y` at `x`, crossed going down.
function landOn(R, x, py, y) {
  for (const [line, ly] of linesAt(R, x)) if (py >= ly - LAND_TOL && y <= ly) return { line, y: ly };
  return null;
}

// Where a tray in the air at (x, y) going up at vy and across at v lands, if it does not
// steer: { x, y, line } or null when it derails. The unit suite's measure of which gaps a jump clears.
export function flight(R, x, y, vy, v) {
  const dt = 0.004;
  for (let t = 0; t < 5; t += dt) {
    const py = y;
    vy = Math.max(-120, vy - TRAY_G * dt);
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

// A fresh set of the room's things. What was eaten or shot stays so (`old`, the tray of an earlier try).
function things(R, old) {
  const was = (list, i, state) => (old && old.cooks[i] && old.cooks[i].state === state ? state : null);
  return {
    domes: R.domes.map((d, i) => Boolean(old && old.domes[i])),
    plates: R.plates.map((p, i) => Boolean(old && old.plates[i])),
    cooks: R.cooks.map((c, i) => ({ state: was("cooks", i, "broken") || "down", t: 0, dish: null })),
  };
}

// Planny put down in the room: on the tray at the start of a ride, or at the last checkpoint
// passed after the last heart (the same room). Any other room: this ride's state goes.
function place(round, k) {
  const R = round.spec.ride;
  if (!R || R.runner !== "tray") {
    if (mine(round)) round.runner = null;
    return;
  }
  const old = mine(round);
  const again = old && old.room === round.room;
  const check = again ? old.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const top = topAt(R, x);
  Object.assign(you, { x, y: top ? top[1] : you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  round.runner = { id: "tray", room: round.room, check, v: TRAY_V, line: top ? top[0] : -1, coyote: 0, from: you.y, left: top ? top[0] : 0, done: false, served: again ? old.served : 0, cherries: again ? old.cherries : 0, cherryMs: 0, ...things(R, again ? old : null) };
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = R.pots.length + R.lows.length + R.cooks.length + (R.track.length - 1);
    b.perf.steady = false;
    b.perf.goal = COURSES_GOAL;
  }
}

/* ------------------------------------------------------------ the ride */

// After a tumble that cost a heart but not the ride: Planny and the tray go back onto the
// track nearest where they fell (the highest line under him, else the next one ahead) at TRAY_V.
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
  Object.assign(c, { line, v: TRAY_V, coyote: 0, from: y });
}

// The grade's cherries: the souls taken against what is laid out; and the courses served so far.
function appetite(round, c) {
  c.cherries = round.candy.reduce((n, got) => n + (got ? 1 : 0), 0);
  const b = round.bonusRound;
  if (b) {
    b.perf.steady = c.cherries >= Math.ceil(CHERRY_SHARE * round.candy.length);
    b.perf.acts = c.served;
  }
}

// The tray's motion for one slice. Returns true once it has moved Planny (every slice of a
// ride); false outside a ride and once he has stepped out onto the dining table.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = mine(round);
  if (!R || R.runner !== "tray" || !c || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  // Already down on the table (set there, or past the lip some other way): the ride is over.
  if (you.x >= R.finish && you.vy <= 0 && you.y <= k.groundAt(round.spec, you.x) + 0.01) return finish(round, c, R, k.groundAt(round.spec, you.x), k);
  // A stomp's bounce (or anything else) lifts the tray off its line.
  if (you.state === "air" && c.line >= 0) {
    c.left = c.line;
    c.line = -1;
    c.coyote = 0;
    c.from = you.y;
  }
  steerShots(round, R);
  const want = inp.jump > 0;
  if (c.line >= 0) {
    // On the stairs or the shelf.
    const slope = slopeOf(R, c.line, you.x);
    const goal = greasy(R, you.x) ? GREASE_V : TRAY_V;
    c.v = clamp(c.v + ((goal - c.v) * RELAX - SLOPE_G * slope) * dt, TRAY_MIN, TRAY_MAX);
    const duck = Boolean(inp.down) && !want;
    if (duck && !you.ducking) ev("trayDuck");
    you.ducking = duck;
    if (want) {
      inp.jump = 0;
      you.vy = TRAY_JUMP_V + slope * c.v;
      Object.assign(c, { left: c.line, line: -1, coyote: 0, from: you.y });
      you.state = "air";
      you.ducking = false;
      ev("trayJump", { v: c.v });
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
        if (ramp) ev("trayLaunch", { v: c.v, last: c.left === linesOf(R).length - 1 });
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
      you.vy = TRAY_JUMP_V;
      c.from = you.y;
      ev("trayJump", { v: c.v });
    }
    const py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - TRAY_G * dt);
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
        ev("trayLand", { big: c.from - f.y >= BIG_LAND });
        c.from = f.y;
      } else if (you.x >= R.finish) {
        // Over the dining table at the end: down onto it, and the ride is over.
        const g = k.groundAt(round.spec, you.x);
        if (g > -Infinity && you.y <= g + 0.01) return finish(round, c, R, g, k);
      }
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Past the end of the world: a gap, or the edge of the table.
  if (you.y < DERAIL_Y || k.groundAt(round.spec, you.x) > you.y + 0.5) {
    noteHit(round, `k${c.left}`);
    if (k.lose(round, "tumble") && round.phase === "play") reseat(round, c, R);
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("trayCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD + (c.v - TRAY_V) * CAM_PER_V;
  c.cherryMs -= ms;
  if (c.cherryMs <= 0) {
    c.cherryMs = 400;
    appetite(round, c);
  }
  eat(round, c, R, k);
  if (obstacles(round, c, R, k)) return true;
  creatures(round, c, R, ms);
  return true;
}

// The ride is over: the tray halts on the table, the door opens, Planny walks out.
function finish(round, c, R, g, k) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  Object.assign(you, { y: g, vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  appetite(round, c);
  round.events.push({ type: "trayFinish", x: you.x, y: you.y, big: c.from - g >= BIG_LAND, served: c.served });
  return false;
}

// A bolt flies parallel to the track under it, whatever way he aimed (`s.off`): the stairs are
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

// A course served: the points and the count.
function serve(round, c, type, x, y, points) {
  c.served++;
  round.score += points;
  const b = round.bonusRound;
  if (b) b.perf.acts = c.served;
  round.events.push({ type, x, y, points, n: c.served, goal: COURSES_GOAL });
}

// The silver domes: run through one (a high one takes a jump) and it is a course.
function eat(round, c, R, k) {
  const you = round.you;
  R.domes.forEach(([x, line, lift], i) => {
    if (c.domes[i] || Math.abs(you.x - x) > 4) return;
    const y0 = trackY(R, line, x) + lift;
    if (!boxHit(k, you, x, y0, DOME_W, DOME_H)) return;
    c.domes[i] = true;
    serve(round, c, "trayDome", x, y0 + DOME_H / 2, DOME_POINTS);
  });
}

// What the tray runs into: a pot, a drop of cutlery, a ham or pans, a dish. Returns whether it cost a heart.
function obstacles(round, c, R, k) {
  const you = round.you;
  const hh = duckH(k, you);
  for (const [i, [x0, x1, y, kind]] of R.lows.entries()) {
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > y && k.struck(round, kind ? "pans" : "ham")) {
      noteHit(round, `l${i}`);
      round.events.push({ type: "trayCrash", what: kind ? "pans" : "ham", x: you.x, y: you.y + hh });
      return true;
    }
  }
  for (const [i, [x, line, kind]] of R.pots.entries()) {
    if (Math.abs(you.x - x) > 6) continue;
    if (boxHit(k, you, x, trackY(R, line, x), kind ? CUTLERY_W : POT_W, kind ? CUTLERY_H : POT_H) && k.struck(round, kind ? "cutlery" : "pot")) {
      noteHit(round, `p${i}`);
      round.events.push({ type: "trayCrash", what: kind ? "cutlery" : "pot", x, y: you.y });
      return true;
    }
  }
  for (const [i, cook] of c.cooks.entries()) {
    const d = cook.dish;
    if (!d || Math.abs(you.x - d.x) > 5) continue;
    if (boxHit(k, you, d.x, d.y, DISH_W, DISH_H) && k.struck(round, "dish")) {
      noteHit(round, `c${i}`);
      round.events.push({ type: "trayCrash", what: "dish", x: d.x, y: d.y });
      cook.dish = null;
      return true;
    }
  }
  return false;
}

// The cooks wake when the tray comes near, wind up and fling a dish back along the track.
function creatures(round, c, R, ms) {
  const you = round.you;
  const dt = ms / 1000;
  R.cooks.forEach(([x, line], i) => {
    const o = c.cooks[i];
    const y = trackY(R, line, x);
    if (o.state === "down") {
      const ahead = x - you.x;
      if (ahead < COOK_NEAR && ahead > -COOK_W) {
        Object.assign(o, { state: "up", t: COOK_WIND_MS });
        round.events.push({ type: "trayCookUp", x, y });
      }
    } else if (o.state === "up" || o.state === "toss") {
      o.t -= ms;
      if (o.t <= 0 && o.state === "up") {
        Object.assign(o, { state: "toss", t: COOK_STAY_MS, dish: { x: x - 1.2, y: y + DISH_LO } });
        round.events.push({ type: "trayToss", x, y: y + DISH_LO + 1 });
      } else if (o.t <= 0) Object.assign(o, { state: "spent", t: 0 });
    }
    // A dish in flight, along the track it left, until it is behind the tray or far from its cook.
    const d = o.dish;
    if (d) {
      d.x -= DISH_V * dt;
      const ty = trackY(R, line, d.x);
      if (ty !== null) d.y = ty + DISH_LO;
      if (d.x < you.x - 10 || d.x < x - 110) o.dish = null;
    }
  });
}

/* ------------------------------------------------------------- targets */

// A bolt into something to shoot: a flying plate (a course), a cook winding up or flinging, a
// dish in the air. True when one took it (the bolt is spent).
function trayShot(round, s) {
  const R = round.spec.ride;
  const c = mine(round);
  if (!R || R.runner !== "tray" || !c) return false;
  const hit = (x, y0, w, h) => Math.abs(s.x - x) <= w / 2 + SHOT_R && s.y >= y0 - SHOT_R && s.y <= y0 + h + SHOT_R;
  for (let i = 0; i < R.plates.length; i++) {
    if (c.plates[i]) continue;
    const [x, line, lift] = R.plates[i];
    const y0 = trackY(R, line, x) + lift;
    if (!hit(x, y0, PLATE_W, PLATE_H)) continue;
    c.plates[i] = true;
    serve(round, c, "trayPlate", x, y0 + PLATE_H / 2, PLATE_POINTS);
    return true;
  }
  for (let i = 0; i < R.cooks.length; i++) {
    const o = c.cooks[i];
    const [x, line] = R.cooks[i];
    const y = trackY(R, line, x);
    if (o.dish && hit(o.dish.x, o.dish.y, DISH_W, DISH_H)) {
      round.events.push({ type: "trayDishBreak", x: o.dish.x, y: o.dish.y });
      o.dish = null;
      return true;
    }
    if ((o.state === "up" || o.state === "toss") && hit(x, y, COOK_W, COOK_H)) {
      Object.assign(o, { state: "broken", t: 0 });
      round.score += COOK_POINTS;
      round.events.push({ type: "trayCookHit", x, y: y + COOK_H / 2, points: COOK_POINTS });
      return true;
    }
  }
  return false;
}

export const TRAY = freeze({
  id: "tray",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: trayShot,
});
