// Plan2Code Web Console - Ghoul Rush's finale, its rules for the finale's first ride, Down the Hatch: after the House sinks, YOU step through its lone front door and the floor is its throat. YOU surf the WELCOME mat down a wet, ribbed gullet: jump the rib bones, duck the hanging uvula-lamps, duck the rings of muscle that squeeze down from above (the walls throb to warn), ride the bile stretches that speed YOU up, shoot or jump the swallowed furniture that drops in and tumbles at YOU, and jump to the upper rail where the throat forks over a hole. As a pack core/ghoul-tables.js lists in PACKS.
//
// Modeled on the Grand Banister (rides/banister/ghoul-banister.js: read its header first) and,
// like it, handed a kit `k` of the game's own helpers, so this file never imports the game (it
// borrows the cart's track helpers). Pack fields used: `ride` (a hook that moves YOU, so no key
// walks you), `place` (put down in a room: a room set up or a respawn) and `target` (a bolt
// strikes something that is no monster: the furniture). No monster, boss or hazard kind, and NO
// random number is drawn. Every event, cause and tone is prefixed `mat`.
//
// Its state is the shared bonus-ride slot `round.runner` (null in any other room), and its room
// marks itself with `ride.runner: "mat"` and `ride.hearts: 3` (the finale's rides are short: about
// 30 seconds, three hearts, ghoul-bonus.js's makeBonus reads it).
//
// THE ROOM (spec.ride, rides/mat/ghoul-mat-room.js, made by
// prototypes/ghoul-rush-tools/gen-mat.mjs):
//
// - `track`: polylines [x, y]. The first `rails` of them are the throat's FLOOR, eleven swallows
//   (a descent at -0.10 and a short climb at +0.30 over a ridge of muscle, every crest a little
//   lower); a gap between two of them is a HOLE where the throat forks (too wide to jump across:
//   a fall below DERAIL_Y is a heart, cause "matPlunge"). The lines after those are the UPPER
//   RAILS, a ledge of gristle RAIL_SEP over the floor along the length of one descent each,
//   over a hole: jump up onto it (a jump lands on the highest line it comes down on) and ride it
//   past the hole; off its end YOU drop back onto the floor. The last floor line ends on a lip
//   rising at 0.28 (over RAMP_SLOPE, so it launches: RAMP_POP) and the floor of the House's
//   cellar begins `finish` further on, lower; flying onto it ends the ride (`matFinish`).
// - `ribs` [x, line] (a rib bone arching up out of the floor, RIB_W by RIB_H: jump), `lows`
//   [x0, x1, y] (a uvula hanging from the roof with a swallowed lamp at its tip: its underside
//   is y, from there up to the roof, so DUCK it; y is 3.0 over the highest floor under it,
//   between a ducked box and a standing one), `squeezes` [x, line] (a ring of muscle SQ_W wide:
//   see below), `furniture` [x, line, kind] (kind 0 a chair, 1 a side table, 2 a mantel clock:
//   see below), `bile` [x0, x1] (stretches where the mat skids on bile: the speed relaxes to
//   BILE_V, not MAT_V), `checks`, `finish`, `time` (the room's clock, ms), `how` and `hearts`.
// - The ground is the front step at the start and the cellar floor at the end only.
//
// PERISTALSIS (the twist): a squeeze waits ("wait") until YOU are SQ_LEAD_MS of riding short
// of it at your speed, then THROBS SQ_WARN_MS ("throb": the walls pulse and gurgle twice, an
// event `matSqueezeThrob` with n 1 at its start and n 2 halfway), CLOSES over SQ_CLOSE_MS
// ("close": its underside comes down from SQ_OPEN to SQ_LOW over the floor, `matSqueezeClose`),
// holds SQ_HOLD_MS ("shut") and eases back up over SQ_EASE_MS ("ease"), then is "done". It is
// shut SQ_EARLY_MS before YOU reach it and long after, so a rider who ducks passes under it;
// standing, or in the air, it is a heart (cause "matSqueeze"). Nothing draws a random number: it
// runs off your approach alone.
//
// FURNITURE: what the House swallowed before YOU. Each waits until YOU are FURN_LEAD_MS of
// riding short of it at your speed, then drops from the roof FURN_DROP_MS ("drop": a shadow on the floor and a creak above,
// `matFurnDrop`), lands (`matFurnLand`) and tumbles up the throat at YOU at FURN_V for up to
// FURN_ROLL_MS ("roll"), FURN_W by FURN_H: jump it, or shoot it, FURN_HP bolts (`matFurnHit`,
// then `matFurnBreak`: an act for the grade). Meeting it is a heart (cause "matFurniture").
//
// YOU (`round.runner`): { id, room, v, line, coyote, from, left, check, done, bile, squeezes,
// furniture, sweet }. You ride at (you.x, you.y), always facing right (`you.state` "run" on the
// floor, "air" off it, `you.ducking` ducked). Speed `v` relaxes to MAT_V (BILE_V on bile, RELAX)
// and is pushed by the slope (SLOPE_G), between MAT_MIN and MAT_MAX. Up jumps at MAT_JUMP_V
// (plus the slope's own rise) against MAT_G (about 13 high, 0.75 s, 34 across at MAT_V),
// COYOTE_MS of grace after running off a line's end; down ducks. A bolt flies parallel to the
// floor under it, so the shooting is level with the throat.
//
// A hit costs one of the round's three hearts (ghoul-bonus.js), not a life, and the ride rolls
// on, you blinking safe BONUS_SAFE_MS; the last heart gone ends the round with nothing, at once
// (BONUS LOST, no dice, never a run life), and the run goes on to the next room. A plunge puts
// you back on the throat at MAT_V: on the highest line under you (the ledge over the hole you fell
// into), else on the next floor line ahead.
// Causes: "matRib", "matUvula", "matSqueeze", "matFurniture", "matPlunge". Every obstacle is a
// number for the grade (`perf.total`: ribs, lows, squeezes, furniture and holes, each id once in
// `perf.hits` if it ever cost a heart). Shooting a piece of furniture counts for `perf.acts` (the
// grade's goal is every piece of it) and FURN_POINTS. The grade's `steady` die: "Wipe your
// feet", the souls along the throat taken, at least SWEET_SHARE of them.
//
// Checkpoints are passed at their x (`matCheck`); a restart after the last heart goes back to the
// last one passed (that ends the round, as the banister's does).
//
// WHAT THE ART READS: `spec.ride` (above), `round.runner` { v, line, check, done, bile,
// squeezes: [{ state "wait"|"throb"|"close"|"shut"|"ease"|"done", t (ms left in the state) }],
// furniture: [{ state "wait"|"drop"|"roll"|"broken"|"spent", t, x, hp }] }, `round.you`
// (`state`, `vy`, `ducking`), the events in EVENTS; squeezeLow() and furnitureY() for where
// those are.

import { linesAt, linesOf, slopeOf, trackY } from "../cart/ghoul-cart.js";

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "matJump", "matLand", "matLaunch", "matDuck", "matSwitch", "matCrash", "matCheck", "matFinish", "matBile",
  "matSqueezeThrob", "matSqueezeClose", "matFurnDrop", "matFurnLand", "matFurnHit", "matFurnBreak",
]);
// Every way a heart goes here.
export const CAUSES = freeze(["matRib", "matUvula", "matSqueeze", "matFurniture", "matPlunge"]);

// The ride. Speeds are units across a second, MAT_G units a second squared.
export const MAT_V = 46;
export const BILE_V = 60;
export const MAT_MIN = 28;
export const MAT_MAX = 66;
export const SLOPE_G = 60;
export const RELAX = 1.5;
export const MAT_JUMP_V = 74;
export const MAT_G = 200;
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
export const RIB_W = 2.4;
export const RIB_H = 4.2;
export const SQ_W = 6;
export const SQ_OPEN = 22;
export const SQ_LOW = 3;
export const SQ_WARN_MS = 1100;
export const SQ_CLOSE_MS = 260;
export const SQ_EARLY_MS = 340;
export const SQ_LEAD_MS = SQ_WARN_MS + SQ_CLOSE_MS + SQ_EARLY_MS;
export const SQ_HOLD_MS = 1100;
export const SQ_EASE_MS = 450;
export const FURN_W = 3.2;
export const FURN_H = 3.4;
export const FURN_HP = 2;
export const FURN_LEAD_MS = 1700;
export const FURN_DROP_MS = 900;
export const FURN_DROP_H = 18;
export const FURN_V = 12;
export const FURN_ROLL_MS = 2200;
export const FURN_POINTS = 150;
const SHOT_R = 0.5;
// The "Wipe your feet" die: this share of the souls along the throat.
export const SWEET_SHARE = 0.5;

// Notes for a bonus round that obstacle `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

// Whether line `line` is one of the upper rails.
export const upperLine = (R, line) => line >= R.rails;

// The highest line under x, as [line, y], or null over a hole.
const topAt = (R, x) => linesAt(R, x)[0] || null;

// The line a rider falling from `py` to `y` at `x` lands on: the highest he crossed going down.
function landOn(R, x, py, y) {
  for (const [line, ly] of linesAt(R, x)) if (py >= ly - LAND_TOL && y <= ly) return { line, y: ly };
  return null;
}

// Where a rider in the air at (x, y) going up at vy and across at v lands, if he does not steer:
// { x, y, line } or null when he falls through a hole. The unit suite's measure of the forks.
export function flight(R, x, y, vy, v) {
  const dt = 0.004;
  for (let t = 0; t < 5; t += dt) {
    const py = y;
    vy = Math.max(-120, vy - MAT_G * dt);
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

// The height of squeeze `s`'s underside over the floor in its state: SQ_OPEN open, SQ_LOW shut.
export function squeezeLow(s) {
  if (s.state === "close") return SQ_LOW + (SQ_OPEN - SQ_LOW) * clamp(s.t / SQ_CLOSE_MS, 0, 1);
  if (s.state === "shut") return SQ_LOW;
  if (s.state === "ease") return SQ_LOW + (SQ_OPEN - SQ_LOW) * (1 - clamp(s.t / SQ_EASE_MS, 0, 1));
  return SQ_OPEN;
}

// How high a piece of furniture `f` is over the floor: falling while it drops (faster as it goes), 0 after.
export function furnitureLift(f) {
  if (f.state !== "drop") return 0;
  const p = 1 - clamp(f.t / FURN_DROP_MS, 0, 1);
  return FURN_DROP_H * (1 - p * p);
}

// The floor under piece `i` of the room's furniture where it is now.
export function furnitureY(R, i, f) {
  const line = R.furniture[i][1];
  const L = linesOf(R)[line];
  return trackY(R, line, clamp(f.x, L.x0, L.x1)) + furnitureLift(f);
}

/* -------------------------------------------------------------- placing */

// A fresh set of the room's things, each squeeze waiting and each piece of furniture up in the
// roof. What was shot stays shot (`old`, the state of an earlier try in the same room).
function things(R, old) {
  return {
    squeezes: R.squeezes.map(() => ({ state: "wait", t: 0 })),
    furniture: R.furniture.map(([x], i) => ({ state: old && old.furniture[i] && old.furniture[i].state === "broken" ? "broken" : "wait", t: 0, x, hp: FURN_HP })),
  };
}

// Put down in the room: on the mat at the front step at the start of a ride, or at the last
// checkpoint passed after the last heart (the same room).
function place(round) {
  const R = round.spec.ride;
  if (!R || R.runner !== "mat") {
    if (round.runner && round.runner.id === "mat") round.runner = null;
    return;
  }
  const old = round.runner && round.runner.id === "mat" && round.runner.room === round.room ? round.runner : null;
  const check = old ? old.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const top = topAt(R, x);
  Object.assign(you, { x, y: top ? top[1] : you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  round.runner = { id: "mat", room: round.room, check, v: MAT_V, line: top ? top[0] : -1, coyote: 0, from: you.y, left: top ? top[0] : 0, done: false, bile: -1, sweet: old ? old.sweet : 0, sweetMs: 0, ...things(R, old) };
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = R.ribs.length + R.lows.length + R.squeezes.length + R.furniture.length + (R.rails - 1);
    b.perf.steady = false;
    b.perf.goal = R.furniture.length;
  }
}

/* ------------------------------------------------------------ the ride */

// After a plunge that cost a heart but not the ride: back onto the throat nearest where you fell
// (the highest line under you, the ledge over the hole, else the next floor line ahead) at MAT_V.
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
  Object.assign(c, { line, v: MAT_V, coyote: 0, from: y });
}

// The souls taken against those laid along the throat ("Wipe your feet").
function sweetness(round, c) {
  c.sweet = round.candy.reduce((n, got) => n + (got ? 1 : 0), 0);
  const b = round.bonusRound;
  if (b) b.perf.steady = round.candy.length > 0 && c.sweet >= Math.ceil(SWEET_SHARE * round.candy.length);
}

// The bile stretch under x, or -1.
const bileAt = (R, x) => R.bile.findIndex(([x0, x1]) => x >= x0 && x < x1);

// The ride for one slice. Returns true once it has moved you (every slice of a ride); false outside
// a ride and once you have stepped out onto the cellar floor.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "mat" || !c || c.id !== "mat" || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  // Already down on the cellar floor (set there, or past the lip some other way): the ride is over.
  if (you.x >= R.finish && you.vy <= 0 && you.y <= k.groundAt(round.spec, you.x) + 0.01) return finish(round, c, R, k.groundAt(round.spec, you.x), k);
  // A stomp's bounce (or anything else) lifts you off the floor.
  if (you.state === "air" && c.line >= 0) {
    c.left = c.line;
    c.line = -1;
    c.coyote = 0;
    c.from = you.y;
  }
  steerShots(round, R);
  const want = inp.jump > 0;
  const slick = bileAt(R, you.x);
  if (slick >= 0 && slick !== c.bile) ev("matBile", { n: slick });
  c.bile = slick;
  if (c.line >= 0) {
    // On the floor (or the gristle ledge).
    const slope = slopeOf(R, c.line, you.x);
    c.v = clamp(c.v + (((slick >= 0 ? BILE_V : MAT_V) - c.v) * RELAX - SLOPE_G * slope) * dt, MAT_MIN, MAT_MAX);
    const duck = Boolean(inp.down) && !want;
    if (duck && !you.ducking) ev("matDuck");
    you.ducking = duck;
    if (want) {
      inp.jump = 0;
      you.vy = MAT_JUMP_V + slope * c.v;
      Object.assign(c, { left: c.line, line: -1, coyote: 0, from: you.y });
      you.state = "air";
      you.ducking = false;
      ev("matJump", { v: c.v });
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
        if (ramp) ev("matLaunch", { v: c.v, last: c.left === R.rails - 1 });
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
      you.vy = MAT_JUMP_V;
      c.from = you.y;
      ev("matJump", { v: c.v });
    }
    const py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - MAT_G * dt);
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
        const was = upperLine(R, c.left);
        c.line = f.line;
        ev("matLand", { big: c.from - f.y >= BIG_LAND });
        if (upperLine(R, f.line) !== was) ev("matSwitch", { up: upperLine(R, f.line) });
        c.from = f.y;
      } else if (you.x >= R.finish) {
        // Over the cellar floor at the end: down onto it, and the ride is over.
        const g = k.groundAt(round.spec, you.x);
        if (g > -Infinity && you.y <= g + 0.01) return finish(round, c, R, g, k);
      }
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Past the end of the world: a hole, or the face of the cellar.
  if (you.y < DERAIL_Y || k.groundAt(round.spec, you.x) > you.y + 0.5) {
    if (!upperLine(R, c.left)) noteHit(round, `g${c.left}`);
    if (k.lose(round, "matPlunge") && round.phase === "play") reseat(round, c, R);
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("matCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD + (c.v - MAT_V) * CAM_PER_V;
  c.sweetMs -= ms;
  if (c.sweetMs <= 0) {
    c.sweetMs = 400;
    sweetness(round, c);
  }
  if (obstacles(round, c, R, k)) return true;
  creatures(round, c, R, ms);
  return true;
}

// The ride is over: the throat spits you out onto the cellar floor, the door opens.
function finish(round, c, R, g) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  Object.assign(you, { y: g, vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  sweetness(round, c);
  round.events.push({ type: "matFinish", x: you.x, y: you.y, big: c.from - g >= BIG_LAND });
  return false;
}

// A bolt flies parallel to the floor under it, whatever way you aimed (`s.off`).
function steerShots(round, R) {
  for (const s of round.shots) {
    if (s.arm || s.free) continue;
    if (s.off === undefined) s.off = s.vy;
    const top = topAt(R, s.x);
    if (top) s.sl = slopeOf(R, top[0], s.x);
    s.vy = s.vx * (s.sl ?? 0) + s.off;
  }
}

// What you run into: a uvula, a squeeze, a rib, a piece of furniture. Returns whether it cost a heart.
function obstacles(round, c, R, k) {
  const you = round.you;
  const hh = duckH(k, you);
  for (const [i, [x0, x1, y]] of R.lows.entries()) {
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > y && k.struck(round, "matUvula")) {
      noteHit(round, `u${i}`);
      round.events.push({ type: "matCrash", what: "uvula", x: you.x, y: you.y + hh });
      return true;
    }
  }
  for (const [i, [x, line]] of R.squeezes.entries()) {
    const s = c.squeezes[i];
    if (s.state === "wait" || s.state === "throb" || s.state === "done") continue;
    if (Math.abs(you.x - x) >= (k.HIT_W + SQ_W) / 2) continue;
    const floor = trackY(R, line, x);
    if (floor !== null && you.y + hh > floor + squeezeLow(s) && k.struck(round, "matSqueeze")) {
      noteHit(round, `s${i}`);
      round.events.push({ type: "matCrash", what: "squeeze", x: you.x, y: you.y + hh });
      return true;
    }
  }
  for (const [i, [x, line]] of R.ribs.entries()) {
    if (Math.abs(you.x - x) > 6) continue;
    if (boxHit(k, you, x, trackY(R, line, x), RIB_W, RIB_H) && k.struck(round, "matRib")) {
      noteHit(round, `r${i}`);
      round.events.push({ type: "matCrash", what: "rib", x, y: you.y });
      return true;
    }
  }
  for (const [i, f] of c.furniture.entries()) {
    if (f.state !== "drop" && f.state !== "roll") continue;
    if (Math.abs(you.x - f.x) > 6) continue;
    if (boxHit(k, you, f.x, furnitureY(R, i, f), FURN_W, FURN_H) && k.struck(round, "matFurniture")) {
      noteHit(round, `f${i}`);
      round.events.push({ type: "matCrash", what: "furniture", x: f.x, y: you.y, kind: R.furniture[i][2] });
      Object.assign(f, { state: "spent", t: 0 });
      return true;
    }
  }
  return false;
}

// The throat's muscles wake as you come: the squeezes throb and close, the furniture drops and tumbles.
function creatures(round, c, R, ms) {
  const you = round.you;
  R.squeezes.forEach(([x, line], i) => {
    const s = c.squeezes[i];
    const y = trackY(R, line, x);
    if (s.state === "wait") {
      const ahead = x - SQ_W / 2 - you.x;
      if (ahead > -SQ_W && ahead <= (c.v * SQ_LEAD_MS) / 1000) {
        Object.assign(s, { state: "throb", t: SQ_WARN_MS, n: 1 });
        round.events.push({ type: "matSqueezeThrob", x, y, n: 1 });
      }
      return;
    }
    if (s.state === "done") return;
    s.t -= ms;
    if (s.state === "throb" && s.n === 1 && s.t <= SQ_WARN_MS / 2) {
      s.n = 2;
      round.events.push({ type: "matSqueezeThrob", x, y, n: 2 });
    }
    if (s.t > 0) return;
    if (s.state === "throb") {
      Object.assign(s, { state: "close", t: SQ_CLOSE_MS });
      round.events.push({ type: "matSqueezeClose", x, y });
    } else if (s.state === "close") Object.assign(s, { state: "shut", t: SQ_HOLD_MS });
    else if (s.state === "shut") Object.assign(s, { state: "ease", t: SQ_EASE_MS });
    else Object.assign(s, { state: "done", t: 0 });
  });
  R.furniture.forEach(([hx, line], i) => {
    const f = c.furniture[i];
    const L = linesOf(R)[line];
    if (f.state === "wait") {
      const ahead = hx - you.x;
      if (ahead > -FURN_W && ahead <= (c.v * FURN_LEAD_MS) / 1000) {
        Object.assign(f, { state: "drop", t: FURN_DROP_MS });
        round.events.push({ type: "matFurnDrop", x: f.x, y: trackY(R, line, hx) + FURN_DROP_H, kind: R.furniture[i][2] });
      }
    } else if (f.state === "drop") {
      f.t -= ms;
      if (f.t <= 0) {
        Object.assign(f, { state: "roll", t: FURN_ROLL_MS });
        round.events.push({ type: "matFurnLand", x: f.x, y: trackY(R, line, hx), kind: R.furniture[i][2] });
      }
    } else if (f.state === "roll") {
      f.t -= ms;
      f.x = Math.max(L.x0 + 1, f.x - FURN_V * (ms / 1000));
      if (f.t <= 0 || f.x < you.x - 10) Object.assign(f, { state: "spent", t: 0 });
    }
  });
}

/* ------------------------------------------------------------- targets */

// A bolt into a piece of furniture on its way down or tumbling at you. True when one took it.
function matShot(round, s) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "mat" || !c || c.id !== "mat") return false;
  const hit = (x, y0, w, h) => Math.abs(s.x - x) <= w / 2 + SHOT_R && s.y >= y0 - SHOT_R && s.y <= y0 + h + SHOT_R;
  for (let i = 0; i < R.furniture.length; i++) {
    const f = c.furniture[i];
    if (f.state !== "drop" && f.state !== "roll") continue;
    const y = furnitureY(R, i, f);
    if (!hit(f.x, y, FURN_W, FURN_H)) continue;
    f.hp--;
    if (f.hp > 0) round.events.push({ type: "matFurnHit", x: f.x, y: y + FURN_H / 2, kind: R.furniture[i][2] });
    else {
      Object.assign(f, { state: "broken", t: 0 });
      round.score += FURN_POINTS;
      if (round.bonusRound) round.bonusRound.perf.acts++;
      round.events.push({ type: "matFurnBreak", x: f.x, y: y + FURN_H / 2, points: FURN_POINTS, kind: R.furniture[i][2] });
    }
    return true;
  }
  return false;
}

export const MAT = freeze({
  id: "mat",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: matShot,
});
