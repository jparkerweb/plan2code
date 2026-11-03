// Plan2Code Web Console - Ghoul Rush's Code Blue, its rules: Blackmoor Sanatorium's bonus round. YOU lie strapped to a runaway hospital gurney that flies down the sanatorium's endless corridors and ramps, wheels squealing: jump the wheelchairs, IV stands and elevator shafts, duck the hanging surgical lamps and swinging doors, shoot the orderlies who lunge from doorways, while the lights go out in timed waves, as a stage pack that ghoul.js plugs in.
//
// Modeled on the Coffin Sled (ghoul-sled.js: read its header first) and, like it, handed a
// kit `k` of ghoul.js's own helpers, so this file never imports ghoul.js (it borrows the
// cart's track helpers). Pack fields used: `ride` (a hook that moves Planny himself, so no
// key walks him), `place` (Planny put down in a room: a room set up or a respawn) and
// `target` (a bolt strikes something that is no monster: the orderlies and the surge
// lamps). It adds no monster, boss or hazard kind and draws NO random number.
//
// THE SLOT: the ride's state lives in `round.runner` (the shared slot for a rolling bonus
// ride, null in any other room), marked `pack: "codeblue"`; the room's ride spec has
// `runner: "codeblue"`, which the Cart's `place` knows to leave alone. Another ride's
// `place` could null the slot in this room, so a copy is kept (BACK) and put back.
//
// THE ROOM (spec.ride, see ghoul-rooms.js):
//
// - `track`: polylines [x, y] the gurney rolls along, one per corridor; a gap between two
//   lines is an ELEVATOR SHAFT (jump it; a fall below DERAIL_Y is a heart, cause
//   "elevator"). Corridors are flat with ramps (slope up to 0.22) between floors; the
//   last line ends on a loading ramp rising over RAMP_SLOPE, which launches the gurney
//   out of the ambulance doors onto the bay (`finish` is where the bay begins).
// - `chairs` [x, line] (a wheelchair, CHAIR_W by CHAIR_H, jump: it starts rolling at you
//   CHAIR_V when the gurney is CHAIR_NEAR short of it, at most CHAIR_MAX), `stands` [x, line]
//   (an IV stand, STAND_W by STAND_H, jump), `lows` [x0, x1, y, kind] (a hanging surgical
//   lamp, kind 0, or a swinging door, kind 1: its underside is y, 3.0 over the track, so
//   DUCK it), `orderlies` [x, line] (an orderly in a doorway: the door shivers
//   ORDERLY_WARN_MS when the gurney is ORDERLY_NEAR short, then he lunges onto the track
//   ORDERLY_UP_MS, ORDERLY_W by ORDERLY_H: jump it, or shoot it, ORDERLY_HP bolts),
//   `lamps` [x, line] (the surge lamp of wave i: see below), `waves` [x0, x1] (the span
//   of each blackout), `checks` (x positions of the checkpoints), `finish`, `time` (the
//   room's clock, ms) and `how` (the controls line).
// - The ground is the start's floor and the ambulance bay at the end only.
//
// THE TWIST, LIGHTS OUT: the lights go out in waves. WARN_UNITS (84) before a wave's x0 the
// corridor flickers and buzzes and a countdown (3, 2, 1, one number every TICK_UNITS)
// runs; from x0 to x1 it is pitch black, only the flashlight cone, the dying emergency
// strips and a faint glow on what is near show. Wave i has a surge lamp, SURGE_BACK
// before x0, hung SURGE_LO to SURGE_HI over the track: a bolt fired from the air (a hop
// while holding fire) hits it, it shorts out harmlessly, and that blackout is called off
// (`waves[i].off`): the section stays lit. A heartbeat monitor runs across the top: it
// beeps every BEAT_MS[hearts] and flatlines at the last heart (FLAT_MS).
//
// THE GURNEY (`round.runner`): { pack, room, check, v, line, coyote, from, left, done,
// wave (the wave in its countdown or dark, else -1), phase ("lit" | "warn" | "dark"), n
// (the countdown number), dark (0..1), waves: [{ off, hit }], hitWaves, beatMs, pulse, every
// (the beat's length in ms), flat,
// orderlies, chairs, lamps }. Planny rides at (you.x, you.y), always facing right (`you.state`
// "run" on the floor, "air" off it, `you.ducking` ducked). Speed `v` relaxes to GURNEY_V
// (RELAX) and is pushed by the slope (SLOPE_G), between GURNEY_MIN and GURNEY_MAX. Up
// jumps at JUMP_V (plus the slope's own rise) against GRAV (about 13 high, 0.75 s),
// COYOTE_MS of grace after running off a line's end; down ducks. A bolt flies parallel
// to the track under it (`s.off` keeps what he aimed).
//
// A hit costs one of the round's five hearts (ghoul-bonus.js), not a life, and the gurney
// rolls on, Planny blinking safe BONUS_SAFE_MS; the last heart gone ends the round with
// nothing, at once. A derail puts him back on the track at GURNEY_V. Causes: "wheelchair",
// "ivstand", "overhead" (a lamp or a door), "lunged" (an orderly), "elevator" (a fall).
// Every obstacle is a number for the grade (`perf.total`: chairs, stands, lows, orderlies
// and shafts, each id once in `perf.hits` if it ever cost a heart). Shooting an orderly or
// a surge lamp counts for `perf.acts` (the goal is ACTS_GOAL) and the points below. The
// grade's `steady` die rewards clean dark stretches: it holds while at most WAVE_SLACK
// blackouts (countdown and dark) have cost a heart; a wave called off is a clean one.
//
// WHAT THE ART READS: `spec.ride` (above), `round.runner` { v, line, check, done, wave,
// phase, n, dark, waves, pulse, orderlies: [{ state "door"|"warn"|"up"|"sink"|"broken"|
// "spent", t }], chairs: [{ x, rolling }], lamps: [broken] }, `round.bonusRound.hearts`,
// `round.you` (`state`, `vy`, `ducking`), the events in EVENTS.

import { linesAt, linesOf, slopeOf, trackY } from "./ghoul-cart.js";

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const ID = "codeblue";
export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "blueJump", "blueLand", "blueLaunch", "blueDuck", "blueCrash", "blueCheck", "blueFinish",
  "blueWarn", "blueDark", "blueLit", "blueBeat", "blueChair",
  "blueOrderlyWarn", "blueOrderlyUp", "blueOrderlyHit", "blueOrderlyBreak", "blueLamp",
]);

// The gurney. Speeds are units across a second, GRAV units a second squared.
export const GURNEY_V = 48;
export const GURNEY_MIN = 36;
export const GURNEY_MAX = 60;
export const SLOPE_G = 40;
export const RELAX = 1.5;
export const JUMP_V = 74;
export const GRAV = 200;
export const COYOTE_MS = 100;
export const RAMP_SLOPE = 0.25;
export const RAMP_POP = 30;
export const LAND_TOL = 0.9;
export const BIG_LAND = 8;
export const DERAIL_Y = 3;
export const CAM_AHEAD = 10;
export const CAM_PER_V = 0.25;
// Obstacles.
export const CHAIR_W = 3.4;
export const CHAIR_H = 3.6;
export const CHAIR_NEAR = 64;
export const CHAIR_V = 12;
export const CHAIR_MAX = 18;
export const STAND_W = 1.8;
export const STAND_H = 6.2;
export const ORDERLY_W = 2.6;
export const ORDERLY_H = 5.4;
export const ORDERLY_HP = 2;
export const ORDERLY_NEAR = 40;
export const ORDERLY_WARN_MS = 450;
export const ORDERLY_UP_MS = 1600;
export const ORDERLY_SINK_MS = 300;
export const ORDERLY_POINTS = 100;
// The surge lamp: hung high, so a bolt from the air hits it, and the points.
export const LAMP_W = 2.6;
export const SURGE_LO = 3.8;
export const SURGE_HI = 11;
export const SURGE_BACK = 70;
export const LAMP_POINTS = 150;
const SHOT_R = 0.5;
// The lights-out rhythm: the countdown's length and tick, and how fast the dark falls and lifts.
export const WARN_UNITS = 84;
export const TICK_UNITS = 28;
export const FADE_IN = 8;
export const FADE_OUT = 14;
// The heartbeat monitor: a beat every so many ms by hearts left, and the flat tone's repeat at the last.
export const BEAT_MS = freeze({ 5: 1000, 4: 780, 3: 600, 2: 440 });
export const FLAT_MS = 1600;
// The clean dark stretches die: at most this many blackouts may cost a heart.
export const WAVE_SLACK = 1;
// The shots at things (orderlies, surge lamps) worth a die.
export const ACTS_GOAL = 8;

// Notes for a bonus round that obstacle `id` cost a heart (once each), and for the grade
// that the blackout it happened in (if any) was not clean.
function noteHit(round, c, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
  const w = c ? c.wave : -1;
  if (c && w >= 0 && c.waves[w] && !c.waves[w].hit) {
    c.waves[w].hit = true;
    c.hitWaves++;
    if (b) b.perf.steady = c.hitWaves <= WAVE_SLACK;
  }
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

// The highest line under x, as [line, y], or null over a shaft.
const topAt = (R, x) => linesAt(R, x)[0] || null;

// The highest line the gurney, falling from `py` to `y` at `x`, crossed going down.
function landOn(R, x, py, y) {
  for (const [line, ly] of linesAt(R, x)) if (py >= ly - LAND_TOL && y <= ly) return { line, y: ly };
  return null;
}

// Where a gurney in the air at (x, y) going up at vy and across at v lands, if it does
// not steer: { x, y, line } or null when it derails. The unit suite's measure of which
// shafts a jump clears.
export function flight(R, x, y, vy, v) {
  const dt = 0.004;
  for (let t = 0; t < 5; t += dt) {
    const py = y;
    vy = Math.max(-120, vy - GRAV * dt);
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

// The lights at x: { i, phase, n, dark }. `waves` is the runner's list (a wave called
// off is skipped). The countdown is 3, 2, 1 (n), one number every TICK_UNITS; the dark
// falls over FADE_IN from x0 and lifts over FADE_OUT before x1.
export function lightsAt(R, x, waves) {
  for (let i = 0; i < R.waves.length; i++) {
    const [x0, x1] = R.waves[i];
    if (waves && waves[i] && waves[i].off) continue;
    if (x >= x0 - WARN_UNITS && x < x0) return { i, phase: "warn", n: Math.ceil((x0 - x) / TICK_UNITS), dark: 0 };
    if (x >= x0 && x < x1) return { i, phase: "dark", n: 0, dark: Math.min(1, (x - x0) / FADE_IN + 0.15, (x1 - x) / FADE_OUT) };
  }
  return { i: -1, phase: "lit", n: 0, dark: 0 };
}

/* -------------------------------------------------------------- placing */

// The copy of a ride's state that another pack's `place` cannot take away.
const BACK = new WeakMap();
// This ride's state, put back in the shared slot if something cleared it; null elsewhere.
function mine(round) {
  const c = round.runner;
  if (c && c.pack === ID) return c;
  const back = BACK.get(round);
  if (back && back.room === round.room && round.spec.ride && round.spec.ride.runner === ID) {
    round.runner = back;
    return back;
  }
  return null;
}

// A fresh set of the room's things, each orderly in his doorway and each chair where it
// stood. What was shot stays shot (`old`, the state of an earlier try in the same room).
function things(R, old) {
  const was = (list, i, state) => (old && old[list] && old[list][i] && old[list][i].state === state ? state : null);
  return {
    orderlies: R.orderlies.map((o, i) => ({ state: was("orderlies", i, "broken") || "door", t: 0, hp: ORDERLY_HP })),
    chairs: R.chairs.map(([x]) => ({ x, rolling: false, rolled: 0 })),
    lamps: R.lamps.map((l, i) => Boolean(old && old.lamps[i])),
    waves: R.waves.map((w, i) => ({ off: Boolean(old && old.waves[i].off), hit: Boolean(old && old.waves[i].hit) })),
  };
}

// Planny put down in the room: on the gurney at the start of a ride, or at the last
// checkpoint passed after the last heart (the same room).
function place(round, k) {
  const R = round.spec.ride;
  // (The Cart's `place` runs first and has already zeroed `round.camLead`: another room's lead is not ours to touch.)
  if (!R || R.runner !== ID) {
    if (round.runner && round.runner.pack === ID) round.runner = null;
    BACK.delete(round);
    return;
  }
  const old = mine(round);
  const again = Boolean(old && old.room === round.room);
  const check = again ? old.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const top = topAt(R, x);
  Object.assign(you, { x, y: top ? top[1] : you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  const c = { pack: ID, room: round.room, check, v: GURNEY_V, line: top ? top[0] : -1, coyote: 0, from: you.y, left: top ? top[0] : 0, done: false, wave: -1, phase: "lit", n: 0, dark: 0, hitWaves: again ? old.hitWaves : 0, beatMs: 0, pulse: 0, every: BEAT_MS[5], flat: false, ...things(R, again ? old : null) };
  round.runner = c;
  BACK.set(round, c);
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = R.chairs.length + R.stands.length + R.lows.length + R.orderlies.length + (R.track.length - 1);
    b.perf.steady = true;
    b.perf.goal = ACTS_GOAL;
  }
}

/* ------------------------------------------------------------ the ride */

// After a derail that cost a heart but not the ride: Planny and the gurney go back onto
// the track nearest where they fell (the highest line under him, else the next one
// ahead) at GURNEY_V. He blinks safe (ghoul.js's takeLife).
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
  Object.assign(c, { line, v: GURNEY_V, coyote: 0, from: y });
}

// The gurney's motion for one slice. Returns true once it has moved Planny (every slice
// of a ride); false outside a ride and once he has stepped out onto the ambulance bay.
function ride(round, ms, k) {
  const R = round.spec.ride;
  if (!R || R.runner !== ID) return false;
  const c = mine(round);
  if (!c || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  // Already down on the bay (set there, or past the lip some other way): the ride is over.
  if (you.x >= R.finish && you.vy <= 0 && you.y <= k.groundAt(round.spec, you.x) + 0.01) return finish(round, c, R, k.groundAt(round.spec, you.x));
  // A stomp's bounce (or anything else) lifts the gurney off its line.
  if (you.state === "air" && c.line >= 0) {
    c.left = c.line;
    c.line = -1;
    c.coyote = 0;
    c.from = you.y;
  }
  steerShots(round, R);
  const want = inp.jump > 0;
  if (c.line >= 0) {
    // On the floor.
    const slope = slopeOf(R, c.line, you.x);
    c.v = clamp(c.v + ((GURNEY_V - c.v) * RELAX - SLOPE_G * slope) * dt, GURNEY_MIN, GURNEY_MAX);
    const duck = Boolean(inp.down) && !want;
    if (duck && !you.ducking) ev("blueDuck");
    you.ducking = duck;
    if (want) {
      inp.jump = 0;
      you.vy = JUMP_V + slope * c.v;
      Object.assign(c, { left: c.line, line: -1, coyote: 0, from: you.y });
      you.state = "air";
      you.ducking = false;
      ev("blueJump", { v: c.v });
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
        if (ramp) ev("blueLaunch", { v: c.v, last: c.left === linesOf(R).length - 1 });
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
      you.vy = JUMP_V;
      c.from = you.y;
      ev("blueJump", { v: c.v });
    }
    const py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - GRAV * dt);
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
        ev("blueLand", { big: c.from - f.y >= BIG_LAND });
        c.from = f.y;
      } else if (you.x >= R.finish) {
        // Over the bay at the end: down onto it, and the ride is over.
        const g = k.groundAt(round.spec, you.x);
        if (g > -Infinity && you.y <= g + 0.01) return finish(round, c, R, g);
      }
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Past the end of the world: a shaft, or the face of the bay.
  if (you.y < DERAIL_Y || k.groundAt(round.spec, you.x) > you.y + 0.5) {
    noteHit(round, c, `k${c.left}`);
    if (k.lose(round, "elevator") && round.phase === "play") reseat(round, c, R);
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("blueCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD + (c.v - GURNEY_V) * CAM_PER_V;
  blackout(round, c, R);
  heartbeat(round, c, ms);
  if (obstacles(round, c, R, k)) return true;
  creatures(round, c, R, ms);
  return true;
}

// The ride is over: the gurney halts on the bay, the door opens, Planny walks out.
function finish(round, c, R, g) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  c.wave = -1;
  c.phase = "lit";
  c.n = 0;
  c.dark = 0;
  Object.assign(you, { y: g, vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  round.events.push({ type: "blueFinish", x: you.x, y: you.y, big: c.from - g >= BIG_LAND });
  return false;
}

// A bolt flies parallel to the track under it, whatever way he aimed (`s.off`): the
// floor rises and falls, and a level bolt would miss a surge lamp or a lunging orderly on a ramp.
function steerShots(round, R) {
  for (const s of round.shots) {
    if (s.arm || s.free) continue;
    if (s.off === undefined) s.off = s.vy;
    const top = topAt(R, s.x);
    if (top) s.sl = slopeOf(R, top[0], s.x);
    s.vy = s.vx * (s.sl ?? 0) + s.off;
  }
}

/* ------------------------------------------------------ the lights, the beat */

// The blackout's state for where the gurney is: the countdown's ticks, the dark falling
// and lifting, each an event for the sounds and the art.
function blackout(round, c, R) {
  const you = round.you;
  const now = lightsAt(R, you.x, c.waves);
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  if (now.phase === "warn" && (c.phase !== "warn" || c.n !== now.n)) ev("blueWarn", { n: now.n, wave: now.i });
  if (now.phase === "dark" && c.phase !== "dark") ev("blueDark", { wave: now.i });
  if (now.phase === "lit" && c.phase === "dark") ev("blueLit", { wave: c.wave });
  if (now.phase === "warn" && c.phase === "dark") ev("blueLit", { wave: c.wave });
  c.wave = now.i;
  c.phase = now.phase;
  c.n = now.n;
  c.dark = now.dark;
}

// The heartbeat monitor: a beat every BEAT_MS[hearts] ms, quicker the fewer hearts are left,
// and a flat tone at the last heart. `pulse` (0..1) is where the sweep is in its beat.
function heartbeat(round, c, ms) {
  const b = round.bonusRound;
  const hearts = b ? b.hearts : 5;
  const flat = hearts <= 1;
  const every = flat ? FLAT_MS : BEAT_MS[clamp(hearts, 2, 5)];
  c.beatMs += ms;
  if (c.beatMs >= every) {
    c.beatMs -= every;
    round.events.push({ type: "blueBeat", x: round.you.x, y: round.you.y, flat, hearts, bpm: Math.round(60000 / every) });
  }
  c.every = every;
  c.flat = flat;
  c.pulse = Math.min(1, c.beatMs / every);
}

/* ----------------------------------------------------------- obstacles */

// What the gurney runs into: a wheelchair, an IV stand, a lamp or a door overhead, an
// orderly. Returns whether it cost a heart.
function obstacles(round, c, R, k) {
  const you = round.you;
  const hh = duckH(k, you);
  for (const [i, [x0, x1, y]] of R.lows.entries()) {
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > y && k.struck(round, "overhead")) {
      noteHit(round, c, `l${i}`);
      round.events.push({ type: "blueCrash", what: "low", x: you.x, y: you.y + hh });
      return true;
    }
  }
  for (const [i, [, line]] of R.chairs.entries()) {
    const x = c.chairs[i].x;
    if (Math.abs(you.x - x) > 6) continue;
    if (boxHit(k, you, x, trackY(R, line, x), CHAIR_W, CHAIR_H) && k.struck(round, "wheelchair")) {
      noteHit(round, c, `c${i}`);
      round.events.push({ type: "blueCrash", what: "chair", x, y: you.y });
      return true;
    }
  }
  for (const [i, [x, line]] of R.stands.entries()) {
    if (Math.abs(you.x - x) > 6) continue;
    if (boxHit(k, you, x, trackY(R, line, x), STAND_W, STAND_H) && k.struck(round, "ivstand")) {
      noteHit(round, c, `s${i}`);
      round.events.push({ type: "blueCrash", what: "stand", x, y: you.y });
      return true;
    }
  }
  for (const [i, [x, line]] of R.orderlies.entries()) {
    const o = c.orderlies[i];
    if (o.state !== "up" || Math.abs(you.x - x) > 5) continue;
    if (boxHit(k, you, x, trackY(R, line, x), ORDERLY_W, ORDERLY_H) && k.struck(round, "lunged")) {
      noteHit(round, c, `o${i}`);
      round.events.push({ type: "blueCrash", what: "orderly", x, y: you.y });
      Object.assign(o, { state: "sink", t: ORDERLY_SINK_MS });
      return true;
    }
  }
  return false;
}

// The wheelchairs set rolling at the gurney, and the orderlies' doors that burst open, when it comes near.
function creatures(round, c, R, ms) {
  const you = round.you;
  const dt = ms / 1000;
  R.chairs.forEach(([x0, line], i) => {
    const ch = c.chairs[i];
    if (!ch.rolling) {
      const ahead = ch.x - you.x;
      if (ahead < CHAIR_NEAR && ahead > -CHAIR_W) {
        ch.rolling = true;
        round.events.push({ type: "blueChair", x: ch.x, y: trackY(R, line, ch.x) });
      }
    } else {
      ch.rolled = Math.min(CHAIR_MAX, ch.rolled + CHAIR_V * dt);
      ch.x = x0 - ch.rolled;
    }
  });
  R.orderlies.forEach(([x, line], i) => {
    const o = c.orderlies[i];
    const y = trackY(R, line, x);
    if (o.state === "door") {
      const ahead = x - you.x;
      if (ahead < ORDERLY_NEAR && ahead > -ORDERLY_W) {
        Object.assign(o, { state: "warn", t: ORDERLY_WARN_MS });
        round.events.push({ type: "blueOrderlyWarn", x, y });
      }
    } else if (o.state === "warn" || o.state === "up" || o.state === "sink") {
      o.t -= ms;
      if (o.t > 0) return;
      if (o.state === "warn") {
        Object.assign(o, { state: "up", t: ORDERLY_UP_MS });
        round.events.push({ type: "blueOrderlyUp", x, y });
      } else if (o.state === "up") Object.assign(o, { state: "sink", t: ORDERLY_SINK_MS });
      else Object.assign(o, { state: "spent", t: 0 });
    }
  });
}

/* ------------------------------------------------------------- targets */

// A bolt into something to shoot: an orderly lunging from his doorway, a surge lamp. True
// when one took it (the bolt is spent). A lamp shorted out calls its blackout off.
function gurneyShot(round, s) {
  const R = round.spec.ride;
  if (!R || R.runner !== ID) return false;
  const c = mine(round);
  if (!c) return false;
  const hit = (x, y0, w, h) => Math.abs(s.x - x) <= w / 2 + SHOT_R && s.y >= y0 - SHOT_R && s.y <= y0 + h + SHOT_R;
  const score = (n) => {
    round.score += n;
    if (round.bonusRound) round.bonusRound.perf.acts++;
  };
  for (let i = 0; i < R.orderlies.length; i++) {
    const o = c.orderlies[i];
    const [x, line] = R.orderlies[i];
    const y = trackY(R, line, x);
    if (o.state !== "up" || !hit(x, y, ORDERLY_W, ORDERLY_H)) continue;
    o.hp--;
    if (o.hp > 0) round.events.push({ type: "blueOrderlyHit", x, y: y + ORDERLY_H / 2 });
    else {
      Object.assign(o, { state: "broken", t: 0 });
      score(ORDERLY_POINTS);
      round.events.push({ type: "blueOrderlyBreak", x, y: y + ORDERLY_H / 2, points: ORDERLY_POINTS });
    }
    return true;
  }
  for (let i = 0; i < R.lamps.length; i++) {
    if (c.lamps[i]) continue;
    const [x, line] = R.lamps[i];
    const y = trackY(R, line, x);
    if (!hit(x, y + SURGE_LO, LAMP_W, SURGE_HI - SURGE_LO)) continue;
    c.lamps[i] = true;
    c.waves[i].off = true;
    score(LAMP_POINTS);
    round.events.push({ type: "blueLamp", x, y: y + (SURGE_LO + SURGE_HI) / 2, points: LAMP_POINTS, wave: i });
    return true;
  }
  return false;
}

export const GURNEY = freeze({
  id: ID,
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: gurneyShot,
});
