// Plan2Code Web Console - Ghoul Rush's Runaway Cart, its rules: the first ride room of the game. Planny rides a runaway mine cart like a roller coaster along track lines that rise and dip, jump gaps, launch off ramps, split in two and end at a buffer stop; low beams to duck, rubble and crates to jump or shoot, a ledge imp that leaps into the cart, a boulder rolling up behind, and checkpoints, as a stage pack that ghoul.js plugs in.
//
// Like the other stage packs (see ghoul-graveyard.js for what a pack holds,
// and ghoul-mine.js for the Mine this room belongs to), every rule here is
// handed a kit `k` of ghoul.js's own helpers, so this file has no imports.
// It adds three pack fields ghoul.js reads: `ride`, a list of
// `(round, ms, k) => true` hooks run each slice of play before the walking
// rules; one that returns true has moved Planny, so no key walks him (here:
// the cart's motion); `place`, a list of `(round, k)` hooks run whenever
// Planny is put down in a room (a room set up, a life lost and the respawn);
// and `target` (the Chapel's: a bolt strikes something that is no monster:
// the crates). It also uses `round.camLead` (units the camera leads further
// ahead, so the cart's speed shows more of the track).
//
// The room (spec.ride, see ghoul-rooms.js): `track` polylines (each a list of
// [x, y] points with x rising) that the cart rolls along, `beams` [x0, x1, y]
// (a lintel, its underside y over the room's floor, from there up to the roof),
// `rubble` [x, line] and `crates` [x, line] (on a track line), `checks` x
// positions, `stop` where the buffer stands, `time` the clock in ms and `surge`
// [x0, x1, mult] (spans where the boulder rolls mult times faster: a chase, the
// cart must lean to stay ahead). The
// ground is the cave floor only at the start and the end; everywhere else it is
// the chasm.
//
// The cart (`round.cart`, null in any other room): { v, line, coyote, from,
// check, boulder, crates, slides, ... }. `from` is the height it left the track
// at (a landing 8 under it is `big`), `v` is its speed across, `line` the
// track line it rides (-1 in the air), Planny rides it at (you.x, you.y) always
// facing right (`you.state` "run" on track, "air" off it, `you.ducking` when he
// ducks into it). On track v relaxes toward CART_V, speeds up down a slope
// (SLOPE_G) and slows up one; right leans (LEAN_ACC) and left brakes
// (BRAKE_ACC), always between CART_MIN and CART_MAX. Up jumps at CART_JUMP_V
// (plus the slope's own rise) against CART_G, a press up to COYOTE_MS after
// running off a track's end still jumps. In the air left and right steer v
// (AIR_ACC). Off a track's end the cart flies on along its slope; one that ends
// rising at RAMP_SLOPE or more pops RAMP_POP more (`cartLaunch`). It lands on the
// highest line under it that it crossed going down (LAND_TOL); below DERAIL_Y,
// or into the cave floor, is a life (cause "derail"). Down on track ducks.
//
// Obstacles: a beam hits you when your hit box rises above its underside
// (cause "beam"; ducked, you pass under); a rubble heap (RUBBLE_W by RUBBLE_H)
// or a crate (CRATE_W by CRATE_H, CRATE_HP bolts to break) when your hit box
// meets it (cause "crash"); the boulder when it catches the cart (cause
// "boulder"). The boulder rolls BOULDER_V, starts BOULDER_GAP behind the cart and
// is never further than BOULDER_FAR behind; brake and it closes in. A canary's
// scream drops a slide of rubble onto the track ahead (SLIDE_WARN_MS of dust
// first, `slideWarn` then `slideFall`). A ledge imp (`ledgeimp`) waits on a
// ledge and, when the cart is LEDGE_NEAR short of it, crouches LEDGE_CROUCH_MS
// and leaps LEAP_MS to where the cart will be; touching it steals your light, as
// the Mine's imps do. A checkpoint is passed at its x (`checkpoint`); a heart
// lost never stops the ride (Planny blinks safe BONUS_SAFE_MS); a derail puts the cart
// back on the nearest track (the line under it, else the next one ahead) at CART_V,
// the boulder BOULDER_GAP behind; only the last heart ends the round (a restart at
// the last checkpoint passed, then the lost card). At `stop` the cart halts (`cartStop`),
// the door opens (`round.hasKey`) and Planny walks out.
//
// The room is a bonus round (`bonus: true`, ghoul-bonus.js): a hit costs one of
// the round's five hearts (`round.bonusRound`), not a life, and the pack notes
// how it went in `round.bonusRound.perf` (the obstacles that ever hurt, crates
// broken, time spent braking) for the dice the finish pays.
//
// Nothing here draws a random number.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  ledgeimp: freeze({ name: "Ledge Imp", w: 2, h: 2.4, hp: 2, speed: 0, points: 150, stomp: false, head: false, perch: true, color: "#8a6a3a" }),
});

// Every event this pack puts on the field, for the art and the sounds to
// answer.
export const EVENTS = freeze([
  "boulderSurge", "cartJump", "cartLand", "cartLaunch", "cartBrake", "cartDuck", "crateHit", "crateBreak", "cartCrash", "boulderNear", "checkpoint", "cartStop",
  "ledgeLeap", "slideWarn", "slideFall",
]);

// The cart. Speeds are units across a second, CART_G units a second squared.
export const CART_V = 40;
export const CART_MIN = 18;
export const CART_MAX = 62;
export const SLOPE_G = 53;
export const RELAX = 1.5;
export const LEAN_ACC = 16;
export const BRAKE_ACC = 40;
export const AIR_ACC = 21;
export const CART_JUMP_V = 75;
export const CART_G = 200;
export const COYOTE_MS = 100;
export const RAMP_SLOPE = 0.25;
export const RAMP_POP = 30;
export const LAND_TOL = 0.9;
export const BIG_LAND = 8;
export const DERAIL_Y = 3;
// The camera leads CAM_AHEAD further than a walker's, more for every unit of
// speed over CART_V.
export const CAM_AHEAD = 10;
export const CAM_PER_V = 0.25;
// Obstacles.
export const RUBBLE_W = 3.4;
export const RUBBLE_H = 1.8;
export const CRATE_W = 3;
export const CRATE_H = 3.2;
export const CRATE_HP = 2;
const SHOT_R = 0.5;
// The boulder: see the header. It warns within BOULDER_NEAR and rumbles every
// BOULDER_RUMBLE_MS while that close.
export const BOULDER_V = 36;
export const BOULDER_GAP = 48;
export const BOULDER_FAR = 75;
export const BOULDER_CATCH = 2.5;
export const BOULDER_NEAR = 21;
export const BOULDER_RUMBLE_MS = 700;
// The ledge imp: see the header.
export const LEDGE_NEAR = 40;
export const LEDGE_CROUCH_MS = 320;
export const LEAP_MS = 550;
export const IMP_DIM_MS = 5000;
export const HAT_KNOCK = 4;
// A canary's slide of rubble lands SLIDE_LEAD_S of cart travel ahead after
// SLIDE_WARN_MS of dust, no closer than SLIDE_EDGE to a track's end.
export const SLIDE_WARN_MS = 900;
export const SLIDE_LEAD_S = 1.5;
export const SLIDE_EDGE = 8;
// A bonus round's brake time over which the hand is not steady (ghoul-bonus.js).
export const STEADY_BRAKE_MS = 2500;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The room's boulder surge at `x`: how many times faster it rolls (1 off the spans).
export function surgeAt(R, x) {
  for (const [x0, x1, mult] of R.surge || []) if (x >= x0 && x <= x1) return mult;
  return 1;
}

// Notes for a bonus round that obstacle `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

/* ----------------------------------------------------------- the track */

// A ride's lines, each with its points and its x range, built once.
const LINES = new WeakMap();
export function linesOf(R) {
  let lines = LINES.get(R);
  if (!lines) {
    lines = R.track.map((pts) => ({ pts, x0: pts[0][0], x1: pts[pts.length - 1][0] }));
    LINES.set(R, lines);
  }
  return lines;
}

// The segment of line `L` that covers `x`: its index (the segment from point
// i to i + 1).
function segOf(L, x) {
  const p = L.pts;
  let i = 0;
  while (i < p.length - 2 && x > p[i + 1][0]) i++;
  return i;
}

// The height of line `line` at `x`, or null off its ends.
export function trackY(R, line, x) {
  const L = linesOf(R)[line];
  if (!L || x < L.x0 || x > L.x1) return null;
  const i = segOf(L, x);
  const [xa, ya] = L.pts[i];
  const [xb, yb] = L.pts[i + 1];
  return ya + ((yb - ya) * (x - xa)) / (xb - xa);
}

// The slope (rise over run) of line `line` at `x`; the last segment's past its end.
export function slopeOf(R, line, x) {
  const L = linesOf(R)[line];
  const i = segOf(L, clamp(x, L.x0, L.x1));
  const [xa, ya] = L.pts[i];
  const [xb, yb] = L.pts[i + 1];
  return (yb - ya) / (xb - xa);
}

// Every line under `x`, as [line, y] pairs, highest first.
export function linesAt(R, x) {
  const out = [];
  linesOf(R).forEach((L, i) => {
    const y = trackY(R, i, x);
    if (y !== null) out.push([i, y]);
  });
  return out.sort((a, b) => b[1] - a[1]);
}

// The highest line the cart, falling from `py` to `y` at `x`, crossed going
// down: { line, y } or null.
function landOn(R, x, py, y) {
  for (const [line, ly] of linesAt(R, x)) if (py >= ly - LAND_TOL && y <= ly) return { line, y: ly };
  return null;
}

// Where a cart in the air at (x, y) going up at vy and across at v lands, if
// it steers `steer` (-1, 0 or 1) the whole way: { x, y, line } or null when
// it derails. The unit suite's measure of which gaps a jump clears.
export function flight(R, x, y, vy, v, steer = 0, floor = () => -Infinity) {
  const dt = 0.004;
  let vv = v;
  for (let t = 0; t < 5; t += dt) {
    vv = clamp(vv + steer * AIR_ACC * dt, CART_MIN, CART_MAX);
    const py = y;
    vy = Math.max(-120, vy - CART_G * dt);
    x += vv * dt;
    y += vy * dt;
    if (vy <= 0) {
      const f = landOn(R, x, py, y);
      if (f) return { x, y: f.y, line: f.line };
    }
    if (y < DERAIL_Y || floor(x) > y + 0.5) return null;
  }
  return null;
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

/* -------------------------------------------------------------- placing */

// Planny put down in the room: on the cart at the start of a ride, or at the
// last checkpoint passed after a life lost (the same room), the boulder
// BOULDER_GAP behind, every crate whole.
function place(round, k) {
  const R = round.spec.ride;
  round.camLead = 0;
  if (!R || R.gallery || R.sled || R.runner) {
    round.cart = null;
    return;
  }
  const again = round.cart && round.cart.room === round.room;
  const check = again ? round.cart.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const top = linesAt(R, x)[0];
  Object.assign(you, { x, y: top ? top[1] : you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  round.cart = { room: round.room, check, v: CART_V, line: top ? top[0] : -1, coyote: 0, from: you.y, boulder: x - BOULDER_GAP, near: false, rumble: 0, brake: false, crates: R.crates.map(() => CRATE_HP), slides: [], done: false };
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) b.perf.total = R.beams.length + R.rubble.length + R.crates.length;
}

/* ----------------------------------------------------------- the ride */

// After a derail that cost a heart but not the ride: Planny and the cart go back
// onto the track nearest where they fell (the highest line under him, else the
// next one ahead), at CART_V, the boulder BOULDER_GAP behind. The cart's
// progress is kept; he blinks safe (ghoul.js's takeLife).
function reseat(round, c, R) {
  const you = round.you;
  const under = linesAt(R, you.x)[0];
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
    x = ahead ? ahead.x0 + 2 : R.stop - 2;
    y = trackY(R, line, x) ?? you.y;
  }
  Object.assign(you, { x, y, vy: 0, state: "run", shelf: -1, ducking: false, coyote: 0, drop: -1 });
  Object.assign(c, { line, v: CART_V, coyote: 0, from: y, boulder: x - BOULDER_GAP, near: false, rumble: 0 });
}

// A canary's scream (the Mine's) over a cart brings a slide of rubble onto the
// track ahead: found by its event, once.
function slideFor(round, c, R) {
  const you = round.you;
  const evs = round.events;
  for (let i = evs.length - 1; i >= 0 && i >= evs.length - 12; i--) {
    const e = evs[i];
    if (e.type !== "canaryScream" || e.slid) continue;
    e.slid = true;
    const x = you.x + c.v * SLIDE_LEAD_S;
    const under = linesAt(R, x).find(([, y]) => y <= you.y + 3);
    if (!under || x > R.stop - 12 || linesOf(R)[under[0]].x1 - x < SLIDE_EDGE) continue;
    c.slides.push({ x, line: under[0], y: under[1], warn: SLIDE_WARN_MS, down: false });
    round.events.push({ type: "slideWarn", x, y: under[1], ms: SLIDE_WARN_MS });
  }
}

// The cart's motion for one slice. Returns true once it has moved Planny
// (every slice of a ride); false outside a ride and once he has stepped out.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = round.cart;
  if (!R || !c || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  // The buffer stop: the cart halts, the door opens, Planny walks out.
  if (you.x >= R.stop) {
    c.done = true;
    const x = Math.max(you.x, R.stop);
    Object.assign(you, { x, y: k.groundAt(round.spec, x), vy: 0, state: "run", shelf: -1, ducking: false });
    round.hasKey = true;
    round.camLead = 0;
    ev("cartStop");
    return false;
  }
  // A stomp's bounce lifts the cart off its track.
  if (you.state === "air" && c.line >= 0) {
    c.line = -1;
    c.coyote = 0;
    c.from = you.y;
  }
  slideFor(round, c, R);
  for (const s of c.slides) {
    if (s.down) continue;
    s.warn -= ms;
    if (s.warn <= 0) {
      s.down = true;
      ev("slideFall", { x: s.x, y: s.y });
    }
  }
  const want = inp.jump > 0;
  if (c.line >= 0) {
    // On the track.
    const slope = slopeOf(R, c.line, you.x);
    let a = (CART_V - c.v) * RELAX - SLOPE_G * slope;
    if (inp.right) a += LEAN_ACC;
    if (inp.left) a -= BRAKE_ACC;
    c.v = clamp(c.v + a * dt, CART_MIN, CART_MAX);
    if (inp.left && !c.brake && c.v > CART_MIN + 3) ev("cartBrake", { v: c.v });
    c.brake = Boolean(inp.left);
    // Braking is a bonus round's one thing not to do: too much of it is no steady hand.
    if (inp.left && round.bonusRound && (round.bonusRound.perf.brakeMs = (round.bonusRound.perf.brakeMs || 0) + ms) > STEADY_BRAKE_MS) round.bonusRound.perf.steady = false;
    const duck = Boolean(inp.down) && !want;
    if (duck && !you.ducking) ev("cartDuck");
    you.ducking = duck;
    if (want) {
      inp.jump = 0;
      you.vy = CART_JUMP_V + slope * c.v;
      Object.assign(c, { line: -1, coyote: 0, from: you.y });
      you.state = "air";
      you.ducking = false;
      ev("cartJump", { v: c.v });
    } else {
      const L = linesOf(R)[c.line];
      const nx = you.x + c.v * dt;
      you.state = "run";
      you.vy = 0;
      if (nx >= L.x1) {
        // Off the end of the track, on along its last slope.
        const end = L.pts[L.pts.length - 1];
        const rise = slopeOf(R, c.line, L.x1);
        you.x = L.x1;
        you.y = end[1];
        const ramp = rise >= RAMP_SLOPE;
        you.vy = rise * c.v + (ramp ? RAMP_POP : 0);
        Object.assign(c, { line: -1, coyote: COYOTE_MS, from: you.y });
        you.state = "air";
        you.ducking = false;
        if (ramp) ev("cartLaunch", { v: c.v });
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
      you.vy = CART_JUMP_V;
      c.from = you.y;
      ev("cartJump", { v: c.v });
    }
    const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    c.v = clamp(c.v + steer * AIR_ACC * dt, CART_MIN, CART_MAX);
    const py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - CART_G * dt);
    you.x += c.v * dt;
    you.y += you.vy * dt;
    you.ducking = false;
    you.state = "air";
    const f = you.vy <= 0 ? landOn(R, you.x, py, you.y) : null;
    if (f) {
      you.y = f.y;
      you.vy = 0;
      you.state = "run";
      c.line = f.line;
      ev("cartLand", { big: c.from - f.y >= BIG_LAND });
      c.from = f.y;
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Past the end of the world: the chasm, or the cave floor.
  if (you.y < DERAIL_Y || k.groundAt(round.spec, you.x) > you.y + 0.5) {
    // A heart that is not the last keeps the ride going: back onto the track.
    if (k.lose(round, "derail") && round.phase === "play") reseat(round, c, R);
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("checkpoint", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD + (c.v - CART_V) * CAM_PER_V;
  if (obstacles(round, c, R, k)) return true;
  boulder(round, c, ms, k);
  return true;
}

// What the cart runs into: a beam, a heap of rubble, a crate. Returns whether
// it cost a life.
function obstacles(round, c, R, k) {
  const you = round.you;
  const hh = duckH(k, you);
  for (const [i, [x0, x1, y]] of R.beams.entries()) {
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > y && k.struck(round, "beam")) {
      noteHit(round, `b${i}`);
      round.events.push({ type: "cartCrash", what: "beam", x: you.x, y: you.y });
      return true;
    }
  }
  const heaps = R.rubble.map(([x, line], i) => ({ x, y: trackY(R, line, x), id: `r${i}` }));
  for (const s of c.slides) if (s.down) heaps.push({ x: s.x, y: s.y });
  for (const h of heaps) {
    if (boxHit(k, you, h.x, h.y, RUBBLE_W, RUBBLE_H) && k.struck(round, "crash")) {
      if (h.id) noteHit(round, h.id);
      round.events.push({ type: "cartCrash", what: "rubble", x: h.x, y: h.y });
      return true;
    }
  }
  for (let i = 0; i < R.crates.length; i++) {
    if (c.crates[i] <= 0) continue;
    const [x, line] = R.crates[i];
    const y = trackY(R, line, x);
    if (boxHit(k, you, x, y, CRATE_W, CRATE_H) && k.struck(round, "crash")) {
      noteHit(round, `c${i}`);
      round.events.push({ type: "cartCrash", what: "crate", x, y });
      return true;
    }
  }
  return false;
}

// The boulder behind: on at BOULDER_V, never further than BOULDER_FAR back;
// it rumbles when near and catches a cart that is too slow.
function boulder(round, c, ms, k) {
  const you = round.you;
  const mult = surgeAt(round.spec.ride, you.x);
  if (mult > 1 && !c.surging) round.events.push({ type: "boulderSurge", x: you.x, y: you.y, mult });
  c.surging = mult > 1;
  c.boulder = Math.max(c.boulder + BOULDER_V * mult * (ms / 1000), you.x - BOULDER_FAR);
  const gap = you.x - c.boulder;
  c.rumble = clamp(1 - gap / BOULDER_NEAR, 0, 1);
  if (gap > BOULDER_NEAR + 10) c.near = false;
  if (gap <= BOULDER_NEAR) {
    c.rumbleIn = (c.rumbleIn ?? 0) - ms;
    if (!c.near || c.rumbleIn <= 0) {
      c.near = true;
      c.rumbleIn = BOULDER_RUMBLE_MS;
      round.events.push({ type: "boulderNear", x: you.x, y: you.y, level: c.rumble, gap });
    }
  }
  if (gap <= BOULDER_CATCH) {
    if (k.struck(round, "boulder")) {
      round.events.push({ type: "cartCrash", what: "boulder", x: you.x, y: you.y });
      // A heart left and the ride plays on: the boulder falls back.
      if (round.phase === "play") c.boulder = you.x - BOULDER_GAP / 2;
    } else c.boulder = you.x - BOULDER_GAP / 2;
  }
}

/* ---------------------------------------------------------------- crates */

// A bolt into a crate: hp off, and at none it breaks. True when a crate took it.
function crateShot(round, s) {
  const R = round.spec.ride;
  const c = round.cart;
  if (!R || !c) return false;
  for (let i = 0; i < R.crates.length; i++) {
    if (c.crates[i] <= 0) continue;
    const [x, line] = R.crates[i];
    const y = trackY(R, line, x);
    if (Math.abs(s.x - x) > CRATE_W / 2 + SHOT_R || s.y < y - SHOT_R || s.y > y + CRATE_H + SHOT_R) continue;
    c.crates[i]--;
    round.events.push({ type: c.crates[i] > 0 ? "crateHit" : "crateBreak", x, y: y + CRATE_H / 2, hp: c.crates[i] });
    if (c.crates[i] <= 0 && round.bonusRound) round.bonusRound.perf.acts++;
    return true;
  }
  return false;
}

/* ------------------------------------------------------------ ledge imps */

// The light a thief imp holds comes back when it dies (the Mine's rule).
function lightDrop(round, m) {
  const you = round.you;
  if (!(m.stole && you.dimMs > 0 && you.dimBy === m.id)) return;
  you.dimMs = 0;
  you.dimBy = 0;
  round.events.push({ type: "impDrop", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

// A ledge imp: perched, then crouched, then in the air at the cart. Touching
// the cart steals your light, never a life (the Hard Hat is knocked off
// instead), and it falls away with the spark.
function moveLedge(round, m, ms, k) {
  const you = round.you;
  const c = round.cart;
  const R = round.spec.ride;
  if (!c || !R) return;
  if (m.stole && !(you.dimMs > 0 && you.dimBy === m.id)) m.stole = false;
  if (m.act === "perch") {
    const ahead = m.x - you.x;
    if (ahead > LEDGE_NEAR || ahead < 0 || you.out > 0 || m.x > round.camX + k.FIELD_W + 2) return;
    Object.assign(m, { act: "crouch", wait: LEDGE_CROUCH_MS });
    m.dir = -1;
    return;
  }
  if (m.act === "crouch") {
    m.wait -= ms;
    if (m.wait > 0) return;
    const T = LEAP_MS / 1000;
    const tx = you.x + c.v * T;
    const ty = (linesAt(R, tx).find(([, y]) => y <= you.y + 3) || [0, you.y])[1];
    m.vx = (tx - m.x) / T;
    m.vy = (ty + 0.8 - m.y) / T + (k.GRAVITY * T) / 2;
    m.act = "leap";
    m.dir = Math.sign(m.vx) || -1;
    round.events.push({ type: "ledgeLeap", kind: m.kind, x: m.x, y: m.y + m.h / 2, dir: m.dir });
    return;
  }
  // In the air (leaping, or falling away with the light).
  const dt = ms / 1000;
  m.vy -= k.GRAVITY * dt;
  m.x += m.vx * dt;
  m.y += m.vy * dt;
  if (m.act !== "leap" || you.out > 0 || you.safeMs > 0) return;
  if (Math.abs(you.x - m.x) < (k.HIT_W + m.w * 0.8) / 2 && you.y < m.y + m.h * 0.9 && you.y + k.HIT_H > m.y + m.h * 0.1) {
    if (you.hat) {
      you.hat = false;
      m.vx = -HAT_KNOCK * 3;
      m.act = "fall";
      round.events.push({ type: "hatKnock", x: you.x, y: you.y + k.HIT_H });
      return;
    }
    you.dimMs = IMP_DIM_MS;
    you.dimBy = m.id;
    Object.assign(m, { stole: true, act: "fall", vx: -8 });
    round.events.push({ type: "impSteal", kind: m.kind, id: m.id, x: m.x, y: m.y + m.h / 2, ms: IMP_DIM_MS });
  }
}

export const CART = freeze({
  id: "cart",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({ ledgeimp: "perch" }),
  // A ledge imp's touch is its own mover's (it steals light, not a life).
  harmless: freeze({ ledgeimp: () => true }),
  move: freeze({ ledgeimp: moveLedge }),
  kill: freeze({ ledgeimp: lightDrop }),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: crateShot,
});
