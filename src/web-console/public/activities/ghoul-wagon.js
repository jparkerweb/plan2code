// Plan2Code Web Console - Ghoul Rush's Torch Mob, its rules: Hollow End Village's bonus round. YOU steal a hay wagon and race out of the village down the cobbled road and over the old stone bridge with a torch-and-pitchfork mob on your heels: jump the barrels, crates, ditches and spooked horses, duck the washing lines and inn signs, shoot (or dodge) the pitchforks and torches the villagers hurl from the windows and roofs, and jump the collapsed bridge off its ramp, as a stage pack that ghoul.js plugs in.
//
// Modeled on the Coffin Sled (ghoul-sled.js: read its header first) and, like it, handed a
// kit `k` of ghoul.js's own helpers, so this file never imports ghoul.js (it borrows the
// cart's track helpers). Pack fields used: `ride` (a hook that moves Planny himself, so no
// key walks him), `place` (Planny put down in a room: a room set up or a respawn) and
// `target` (a bolt strikes something that is no monster: a hurled torch or pitchfork, a
// spooked horse). It adds no monster, boss or hazard kind, so there is nothing to merge by
// name, and it draws NO random number. Its state lives in `round.runner` (the slot the
// bonus rides share, null in any other room; `id` "wagon").
//
// THE TWIST: THE MOB. A pack of villagers and moonhounds runs behind the wagon, `gap`
// units back (GAP_START at the start, never over GAP_MAX). The mob runs at MOB_V, the wagon
// at its own speed, so a clean stretch (WAGON_V) wins ground and everything else loses it:
// DOWN held on the road (a duck, and the brake: BRAKE_V) slows the wagon, a hit shoves the
// mob HIT_CLOSE closer, a burning hay load draws it on (FIRE_BOOST) and its surge spans
// (`surge`, the bridge's run-up) quicken it. A torch or pitchfork shot out of the air pushes
// it back (TORCH_BACK, FORK_BACK, HORSE_BACK). Inside PANIC_ON the horses bolt (PANIC_V
// faster, until PANIC_OFF), which also carries the wagon further off a ramp. At CATCH_GAP
// the mob has you: a heart (cause "mob"), and it falls back to GAP_RESET. A torch that
// lands on the wagon is a heart (cause "torch") and sets the hay alight for FIRE_MS (the
// mob closes faster for as long, ducking on the hay smothers it SMOTHER times quicker).
//
// THE ROOM (spec.ride, see ghoul-rooms.js; `runner: "wagon"` marks it a ride room that the
// Cart's `place` leaves alone):
//
// - `track`: polylines [x, y] the wagon's deck rides, one per stretch of road; a gap between
//   two lines is a DITCH or the collapsed bridge (jump it: the wagon flies on along its last
//   slope, drops, and a fall below DERAIL_Y is a heart, cause "ditch", or "river" in
//   `bridge`). A line ending rising at over RAMP_SLOPE launches (RAMP_POP): the bridge's ramp
//   and the lip at the end (`finish`, where the gate and the green begin, lower).
// - `blocks` [x, line, kind] (kind 0 a barrel, 1 a crate: BARREL_W/CRATE_W by BLOCK_H, jump;
//   smashed on a hit), `lows` [x0, x1, y, kind] (a washing line, kind 0, or an inn sign,
//   kind 1: its underside is y, from there up, so DUCK it; y is 3.0 over the road under it),
//   `throwers` [x, line, kind] (a villager in a window or on a roof at x: kind 0 hurls a
//   pitchfork at chest height, DUCK it, kind 1 lobs a torch at the hay, JUMP it; either can
//   be shot; he winds up WIND_MS once the wagon is WIND_NEAR short, then throws at where the
//   wagon will be, PROJ_V fast: it meets a wagon at WAGON_V THROW_MEET short of him),
//   `horses` [x, line] (a spooked horse: it rears HORSE_REAR_MS once the wagon is HORSE_NEAR
//   short, then charges at HORSE_V, HORSE_W by HORSE_H over the road: jump it, or shoot it
//   HORSE_HP times to turn it back), `checks`, `surge` ([x0, x1, extra] spans where the mob
//   runs extra units a second faster), `bridge` ([x0, x1], the stone bridge, for the art),
//   `finish` and `time` (the room's clock, ms).
// - The ground is the start's cobbles and the green's grass at the end only.
//
// THE WAGON (`round.runner`): { id, room, v, line, coyote, from, left, check, done, gap,
// panic, fireMs, catches, ... }. Planny rides at (you.x, you.y), facing right (`you.state`
// "run" on the road, "air" off it, `you.ducking` ducked on the hay). Up jumps (WAGON_JUMP_V
// against WAGON_G: about 7 high, 0.6 s, 26 across at WAGON_V), COYOTE_MS of grace off a
// line's end; down ducks and brakes; no key steers. A hit costs one of the round's five
// hearts (ghoul-bonus.js), not a life, and the wagon rolls on, Planny blinking safe
// BONUS_SAFE_MS; the last heart gone ends the round with nothing, at once. A derail puts it
// back on the road ahead. Causes: "barrel", "crate", "wash", "sign", "fork", "torch",
// "horse", "ditch", "river", "mob". Every obstacle is a number for the grade (`perf.total`,
// each id once in `perf.hits` if it ever cost a heart; a catch adds one of its own). Shooting
// a torch, a pitchfork or a horse is an act (ACTS_GOAL of them for the die). The steady die
// is the mob kept far: the gap's average over the ride at least STEADY_GAP.
//
// Checkpoints are passed at their x (`wagonCheck`); a restart after the last heart goes
// back to the last one passed (that ends the round, as the cart's does).
//
// WHAT THE ART READS: `spec.ride` (above), `round.runner` { v, line, gap, panic, fireMs,
// check, done, throwers: [{ state "idle"|"wind"|"spent", t }], props: [{ kind, x, y, s,
// dead }], horses: [{ state "wait"|"rear"|"run"|"hit"|"fled", t, x, hp }], smashed: [bool] },
// `round.you` (`state`, `vy`, `ducking`), the events in EVENTS.

import { linesAt, linesOf, slopeOf, trackY } from "./ghoul-cart.js";

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "wagonJump", "wagonLand", "wagonLaunch", "wagonBrake", "wagonCrash", "wagonCheck", "wagonFinish",
  "wagonWind", "wagonThrow", "wagonShot", "wagonEmber", "wagonCatch", "wagonPanic", "wagonFire", "wagonOut",
  "wagonRear", "wagonHorseHit", "wagonHorseTurn",
]);

// The wagon. Speeds are units across a second, WAGON_G units a second squared.
export const WAGON_V = 42;
export const BRAKE_V = 20;
export const PANIC_V = 9;
export const RELAX = 5;
export const WAGON_JUMP_V = 46;
export const WAGON_G = 150;
export const COYOTE_MS = 100;
export const RAMP_SLOPE = 0.25;
export const RAMP_POP = 22;
export const LAND_TOL = 0.9;
export const BIG_LAND = 8;
export const DERAIL_Y = 3;
// The camera sits this far behind its usual spot, so the mob shows at the left edge.
export const CAM_LEAD = -15;
// How far in front of Planny the wagon's nose (and the horse's chest) meets a barrel or a horse.
export const REACH = 3;
// The mob.
export const MOB_V = 40;
export const GAP_START = 24;
export const GAP_MAX = 32;
export const GAP_RESET = 20;
export const CATCH_GAP = 6.5;
export const PANIC_ON = 14;
export const PANIC_OFF = 19;
export const HIT_CLOSE = 10;
export const TORCH_BACK = 6;
export const FORK_BACK = 3;
export const HORSE_BACK = 4;
export const FIRE_MS = 3200;
export const FIRE_BOOST = 8;
export const SMOTHER = 3;
export const STEADY_GAP = 20;
// Obstacles.
export const BARREL_W = 2.6;
export const CRATE_W = 3.4;
export const BLOCK_H = 3.4;
export const HORSE_W = 4.6;
export const HORSE_H = 4.2;
export const HORSE_HP = 3;
export const HORSE_NEAR = 62;
export const HORSE_REAR_MS = 500;
export const HORSE_V = 26;
export const HORSE_FLEE_V = 48;
// The throwers: wound up WIND_MS once the wagon is WIND_NEAR short, the throw aimed at where
// the wagon will be, PROJ_V fast. A pitchfork flies down to chest height (FORK_Y over the deck)
// from the sill (SILL_Y), a torch lobs from the roof (ROOF_Y) to the hay (TORCH_Y).
export const WIND_NEAR = 62;
export const WIND_MS = 550;
export const PROJ_V = 40;
export const THROW_MEET = 19;
export const FORK_Y = 3.2;
export const FORK_HALF_W = 1.6;
export const FORK_TOL = 0.4;
export const TORCH_Y = 1.6;
export const SILL_Y = 8.5;
export const ROOF_Y = 11;
export const LOB = 3.5;
export const HAY_BACK = 4.5;
export const HAY_FRONT = 1.2;
export const HAY_H = 3;
export const BOLT_R = 0.5;
export const PROP_HIT = 1.3;
export const TORCH_POINTS = 60;
export const FORK_POINTS = 40;
export const HORSE_POINTS = 120;
// The things shot out of the air (or turned back) that are worth a die.
export const ACTS_GOAL = 8;

// Notes for a bonus round that obstacle `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, cx, you, x, y0, w, h) => Math.abs(cx - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

// The highest line under x, as [line, y], or null over a gap.
const topAt = (R, x) => linesAt(R, x)[0] || null;

// The mob's extra speed at x (the surge spans).
export function surgeAt(R, x) {
  for (const [x0, x1, extra] of R.surge || []) if (x >= x0 && x <= x1) return extra;
  return 0;
}

// The highest line the wagon, falling from `py` to `y` at `x`, crossed going down.
function landOn(R, x, py, y) {
  for (const [line, ly] of linesAt(R, x)) if (py >= ly - LAND_TOL && y <= ly) return { line, y: ly };
  return null;
}

// Where a wagon in the air at (x, y) going up at vy and across at v lands, if nothing changes:
// { x, y, line } or null when it derails. The unit suite's measure of which gaps a jump clears.
export function flight(R, x, y, vy, v) {
  const dt = 0.004;
  for (let t = 0; t < 5; t += dt) {
    const py = y;
    vy = Math.max(-120, vy - WAGON_G * dt);
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

// Where a throw flies, at time fraction s (0 at the window, 1 where it meets the wagon):
// a pitchfork on a straight line down to chest height that goes on past it level (so a wagon slowed
// by the brake still meets it at chest height), a torch on a lob that ends there.
export function propAt(p, s) {
  const x = p.x0 + (p.x1 - p.x0) * s;
  const y = p.y0 + (p.y1 - p.y0) * (p.kind ? s : Math.min(1, s)) + (p.kind === 1 ? LOB * 4 * s * (1 - s) : 0);
  return { x, y };
}

/* -------------------------------------------------------------- placing */

// A fresh set of the room's things: every thrower still, every horse waiting.
function things(R) {
  return {
    throwers: R.throwers.map(() => ({ state: "idle", t: 0 })),
    horses: R.horses.map((h) => ({ state: "wait", t: 0, x: h[0], hp: HORSE_HP })),
    smashed: R.blocks.map(() => false),
    props: [],
  };
}

// Planny put down in the room: on the wagon at the start of a ride, or at the last
// checkpoint passed after the last heart (the same room).
function place(round, k) {
  const R = round.spec.ride;
  if (!R || R.runner !== "wagon") {
    if (round.runner && round.runner.id === "wagon") round.runner = null;
    return;
  }
  const again = round.runner && round.runner.id === "wagon" && round.runner.room === round.room;
  const check = again ? round.runner.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const top = topAt(R, x);
  Object.assign(you, { x, y: top ? top[1] : you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  round.runner = { id: "wagon", room: round.room, check, v: WAGON_V, line: top ? top[0] : -1, coyote: 0, from: you.y, left: top ? top[0] : 0, done: false, gap: GAP_START, panic: false, fireMs: 0, braking: false, catches: again ? round.runner.catches : 0, gapMs: 0, gapSum: 0, ...things(R) };
  round.camLead = CAM_LEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = R.blocks.length + R.lows.length + R.throwers.length + R.horses.length + (R.track.length - 1);
    b.perf.steady = true;
    b.perf.goal = ACTS_GOAL;
  }
}

/* ------------------------------------------------------------ the ride */

// After a derail that cost a heart but not the ride: Planny and the wagon go back onto the
// road nearest where they fell (the highest line under him, else the next one ahead) at
// WAGON_V. He blinks safe (ghoul.js's takeLife).
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
  Object.assign(c, { line, v: WAGON_V, coyote: 0, from: y });
}

// The grade's steady die: the mob kept far, the gap's average over the ride so far.
function steadiness(round, c) {
  const b = round.bonusRound;
  if (b && c.gapMs > 0) b.perf.steady = c.gapSum / c.gapMs >= STEADY_GAP;
}

// The wagon's motion for one slice. Returns true once it has moved Planny (every slice
// of a ride); false outside a ride and once he has stepped out onto the green.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "wagon" || !c || c.id !== "wagon" || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  // Already down on the green (set there, or past the lip some other way): the ride is over.
  if (you.x >= R.finish && you.vy <= 0 && you.y <= k.groundAt(round.spec, you.x) + 0.01) return finish(round, c, R, k.groundAt(round.spec, you.x), k);
  // A stomp's bounce (or anything else) lifts the wagon off its line.
  if (you.state === "air" && c.line >= 0) {
    c.left = c.line;
    c.line = -1;
    c.coyote = 0;
    c.from = you.y;
  }
  const want = inp.jump > 0;
  if (c.line >= 0) {
    // On the road: the mob's pull and the brake set the speed.
    const brake = Boolean(inp.down) && !want;
    if (brake && !c.braking) ev("wagonBrake");
    c.braking = brake;
    const target = brake ? BRAKE_V : WAGON_V + (c.panic ? PANIC_V : 0);
    c.v += (target - c.v) * Math.min(1, RELAX * dt);
    you.ducking = brake;
    if (want) {
      inp.jump = 0;
      you.vy = WAGON_JUMP_V;
      Object.assign(c, { left: c.line, line: -1, coyote: 0, from: you.y, braking: false });
      you.state = "air";
      you.ducking = false;
      ev("wagonJump", { v: c.v });
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
        Object.assign(c, { left: c.line, line: -1, coyote: COYOTE_MS, from: you.y, braking: false });
        you.state = "air";
        you.ducking = false;
        if (ramp) ev("wagonLaunch", { v: c.v, last: c.left === linesOf(R).length - 1 });
      } else {
        you.x = nx;
        you.y = trackY(R, c.line, nx);
      }
    }
  } else {
    // In the air: the speed it left with.
    c.coyote = Math.max(0, c.coyote - ms);
    if (want && c.coyote > 0) {
      inp.jump = 0;
      c.coyote = 0;
      you.vy = WAGON_JUMP_V;
      c.from = you.y;
      ev("wagonJump", { v: c.v });
    }
    const py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - WAGON_G * dt);
    you.x += c.v * dt;
    you.y += you.vy * dt;
    you.ducking = false;
    c.braking = false;
    you.state = "air";
    if (you.vy <= 0) {
      const f = landOn(R, you.x, py, you.y);
      if (f) {
        you.y = f.y;
        you.vy = 0;
        you.state = "run";
        c.line = f.line;
        ev("wagonLand", { big: c.from - f.y >= BIG_LAND });
        c.from = f.y;
      } else if (you.x >= R.finish) {
        // Over the green at the end: down onto it, and the ride is over.
        const g = k.groundAt(round.spec, you.x);
        if (g > -Infinity && you.y <= g + 0.01) return finish(round, c, R, g, k);
      }
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Past the end of the world: a ditch, or the river under the bridge.
  if (you.y < DERAIL_Y || k.groundAt(round.spec, you.x) > you.y + 0.5) {
    const river = R.bridge && you.x >= R.bridge[0] && you.x <= R.bridge[1];
    noteHit(round, `k${c.left}`);
    if (k.lose(round, river ? "river" : "ditch") && round.phase === "play") reseat(round, c, R);
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("wagonCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_LEAD;
  if (obstacles(round, c, R, k)) return true;
  creatures(round, c, R, ms, k);
  if (flying(round, c, R, ms, k)) return true;
  mob(round, c, R, ms, k);
  return true;
}

// The ride is over: the wagon halts on the green, the door opens, Planny walks out.
function finish(round, c, R, g, k) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  Object.assign(you, { y: g, vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  steadiness(round, c);
  round.events.push({ type: "wagonFinish", x: you.x, y: you.y, big: c.from - g >= BIG_LAND });
  return false;
}

// A hit that took a heart: the mob closes, the cause is noted for the grade.
function hurt(round, c, k, cause, id, extra) {
  if (!k.struck(round, cause)) return false;
  noteHit(round, id);
  c.gap = Math.max(CATCH_GAP + 1, c.gap - HIT_CLOSE);
  round.events.push({ type: "wagonCrash", cause, x: round.you.x, y: round.you.y, ...extra });
  return true;
}

// What the wagon runs into: a barrel or crate, a washing line or an inn sign, a charging horse.
// Returns whether it cost a heart.
function obstacles(round, c, R, k) {
  const you = round.you;
  const hh = duckH(k, you);
  const cx = you.x + REACH;
  for (const [i, [x0, x1, y, kind]] of R.lows.entries()) {
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > y && hurt(round, c, k, kind ? "sign" : "wash", `l${i}`, { what: "low", y: you.y + hh })) return true;
  }
  for (const [i, [x, line, kind]] of R.blocks.entries()) {
    if (c.smashed[i] || Math.abs(cx - x) > 6) continue;
    if (boxHit(k, cx, you, x, trackY(R, line, x), kind ? CRATE_W : BARREL_W, BLOCK_H) && hurt(round, c, k, kind ? "crate" : "barrel", `b${i}`, { what: "block", x, kind })) {
      c.smashed[i] = true;
      return true;
    }
  }
  for (const [i, h] of c.horses.entries()) {
    if (h.state !== "run") continue;
    const y = trackY(R, R.horses[i][1], h.x);
    if (y !== null && boxHit(k, cx, you, h.x, y, HORSE_W, HORSE_H) && hurt(round, c, k, "horse", `h${i}`, { what: "horse", x: h.x })) {
      h.state = "hit";
      h.t = 600;
      return true;
    }
  }
  return false;
}

// The throwers wind up and throw; the horses rear and charge.
function creatures(round, c, R, ms, k) {
  const you = round.you;
  R.throwers.forEach(([x, line, kind], i) => {
    const t = c.throwers[i];
    const y = trackY(R, line, x) ?? you.y;
    if (t.state === "idle") {
      const ahead = x - you.x;
      if (ahead < WIND_NEAR && ahead > 4) {
        Object.assign(t, { state: "wind", t: WIND_MS });
        round.events.push({ type: "wagonWind", x, y: y + (kind ? ROOF_Y : SILL_Y), kind });
      }
    } else if (t.state === "wind") {
      t.t -= ms;
      if (t.t > 0) return;
      t.state = "spent";
      // Aimed at where the wagon will be when the throw gets there.
      const d = Math.max(1, x - you.x);
      const tm = d / (c.v + PROJ_V);
      const mx = you.x + c.v * tm;
      const my = (topAt(R, mx) || [0, you.y])[1];
      const p = { kind, x0: x, y0: y + (kind ? ROOF_Y : SILL_Y), x1: mx, y1: my + (kind ? TORCH_Y : FORK_Y), T: tm, t: 0, s: 0, dead: false, age: 0, id: i };
      c.props.push(p);
      round.events.push({ type: "wagonThrow", x, y: p.y0, kind });
    }
  });
  c.horses.forEach((h, i) => {
    const [hx, line] = R.horses[i];
    if (h.state === "wait") {
      const ahead = hx - you.x;
      if (ahead < HORSE_NEAR && ahead > 0) {
        Object.assign(h, { state: "rear", t: HORSE_REAR_MS });
        round.events.push({ type: "wagonRear", x: hx, y: trackY(R, line, hx) });
      }
    } else if (h.state === "rear") {
      h.t -= ms;
      if (h.t <= 0) Object.assign(h, { state: "run", t: 0 });
    } else if (h.state === "run" || h.state === "fled") {
      h.x -= (h.state === "run" ? HORSE_V : HORSE_FLEE_V) * (ms / 1000);
      if (h.x < you.x - 14 || trackY(R, line, h.x) === null) h.state = "gone";
    } else if (h.state === "hit") {
      h.t -= ms;
      h.x -= HORSE_V * (ms / 1000);
      if (h.t <= 0) h.state = "gone";
    }
  });
}

// The hurled torches and pitchforks in flight: one that reaches the wagon is a heart (a torch
// also sets the hay alight); a torch lands where it is aimed and burns out; a fork goes on.
// Returns whether the wagon was hit.
function flying(round, c, R, ms, k) {
  const you = round.you;
  const hh = duckH(k, you);
  let hit = false;
  for (const p of c.props) {
    if (p.dead) {
      p.age += ms;
      continue;
    }
    p.t += ms / 1000;
    p.s = p.t / p.T;
    const { x, y } = propAt(p, p.kind ? Math.min(1, p.s) : p.s);
    p.x = x;
    p.y = y;
    if (!hit) {
      const on = p.kind
        ? x > you.x - HAY_BACK && x < you.x + HAY_FRONT && y > you.y - 0.2 && y < you.y + HAY_H
        : Math.abs(x - you.x) < k.HIT_W / 2 + FORK_HALF_W && y > you.y - FORK_TOL && y < you.y + hh;
      if (on && hurt(round, c, k, p.kind ? "torch" : "fork", `t${p.id}`, { what: p.kind ? "torch" : "fork" })) {
        p.dead = true;
        hit = true;
        if (p.kind) {
          c.fireMs = FIRE_MS;
          round.events.push({ type: "wagonFire", x: you.x, y: you.y });
        }
        continue;
      }
    }
    if (p.kind && p.s >= 1) {
      p.dead = true;
      round.events.push({ type: "wagonEmber", x, y });
    } else if (!p.kind && (p.s > 1.8 || y < -2)) p.dead = true;
  }
  c.props = c.props.filter((p) => !p.dead || p.age < 500);
  return hit;
}

// The mob: its gap, the panic, the hay fire and the grade's steady die, and a catch at CATCH_GAP.
function mob(round, c, R, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  if (c.fireMs > 0) {
    c.fireMs -= ms * (you.ducking && c.line >= 0 ? SMOTHER : 1);
    if (c.fireMs <= 0) {
      c.fireMs = 0;
      ev("wagonOut");
    }
  }
  const mobV = MOB_V + surgeAt(R, you.x) + (c.fireMs > 0 ? FIRE_BOOST : 0);
  c.gap = clamp(c.gap + (c.v - mobV) * dt, 0, GAP_MAX);
  if (!c.panic && c.gap < PANIC_ON) {
    c.panic = true;
    ev("wagonPanic");
  } else if (c.panic && c.gap >= PANIC_OFF) c.panic = false;
  c.gapMs += ms;
  c.gapSum += c.gap * ms;
  steadiness(round, c);
  if (c.gap > CATCH_GAP) return;
  c.gap = GAP_RESET;
  c.panic = false;
  c.catches++;
  noteHit(round, `m${c.catches}`);
  ev("wagonCatch");
  k.struck(round, "mob");
}

/* ------------------------------------------------------------- targets */

// A bolt into something to shoot: a torch or pitchfork in the air, a horse. True when one
// took it (the bolt is spent).
function wagonShot(round, s) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "wagon" || !c || c.id !== "wagon") return false;
  const score = (n) => {
    round.score += n;
    if (round.bonusRound) round.bonusRound.perf.acts++;
  };
  for (const p of c.props) {
    if (p.dead || p.x === undefined) continue;
    if (Math.abs(s.x - p.x) > PROP_HIT + BOLT_R || Math.abs(s.y - p.y) > PROP_HIT + BOLT_R) continue;
    p.dead = true;
    const pts = p.kind ? TORCH_POINTS : FORK_POINTS;
    score(pts);
    c.gap = Math.min(GAP_MAX, c.gap + (p.kind ? TORCH_BACK : FORK_BACK));
    round.events.push({ type: "wagonShot", x: p.x, y: p.y, kind: p.kind, points: pts });
    return true;
  }
  for (let i = 0; i < c.horses.length; i++) {
    const h = c.horses[i];
    if (h.state !== "run" && h.state !== "rear") continue;
    const y = trackY(R, R.horses[i][1], h.x);
    if (y === null || Math.abs(s.x - h.x) > HORSE_W / 2 + BOLT_R || s.y < y - BOLT_R || s.y > y + HORSE_H + BOLT_R) continue;
    h.hp--;
    if (h.hp > 0) round.events.push({ type: "wagonHorseHit", x: h.x, y: y + HORSE_H / 2 });
    else {
      h.state = "fled";
      score(HORSE_POINTS);
      c.gap = Math.min(GAP_MAX, c.gap + HORSE_BACK);
      round.events.push({ type: "wagonHorseTurn", x: h.x, y: y + HORSE_H / 2, points: HORSE_POINTS });
    }
    return true;
  }
  return false;
}

export const WAGON = freeze({
  id: "wagon",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: wagonShot,
});
