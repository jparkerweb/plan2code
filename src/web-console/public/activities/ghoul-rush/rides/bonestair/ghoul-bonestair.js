// Plan2Code Web Console - Ghoul Rush's finale, its rules for the finale's second ride, down The Bone Stair ahead of the collapse, as a pack core/ghoul-tables.js lists in PACKS. "Every step down is someone": after Kill II the House sinks into its cellar and a stairway of bones opens at the door. YOU run down an endless spiral stair made of bones while the house comes down after YOU: jump the missing treads and the piles of fallen masonry, duck the hanging ribcages, jump the bone hands that grab at the rail, shoot (or jump) the skeletons climbing up at YOU, and never stop where the treads give way. At the bottom YOU run off the last step into the Pit's dark.
//
// Modeled on the Torch Mob (rides/wagon/ghoul-wagon.js: read its header first) and, like it,
// handed a kit `k` of the game's own helpers, so this file imports nothing. Pack fields used:
// `ride` (a hook that moves YOU, so no key walks YOU), `place` (YOU put down in the room: a room
// set up or a respawn) and `target` (a bolt strikes something that is no monster: a skeleton).
// It adds no monster, boss or hazard kind, so there is nothing to merge by name, and it draws
// NO random number. Its state lives in `round.runner` (the slot the bonus rides share, null in
// any other room; `id` "bonestair"). It plays for 3 hearts (`ride.hearts`), not 5.
//
// THE TWIST: THE COLLAPSE BEHIND YOU. A wall of rubble comes down the stair after YOU, `gap`
// units back (GAP_START at the start, never over GAP_MAX). It falls at RUBBLE_V (more in the
// `surge` spans), YOU run at RUN_V, so a clean run wins ground and everything else loses it:
// DOWN (a duck: DUCK_V) and LEFT (holding back: HOLD_V) slow YOU, a hit stumbles YOU (STUMBLE_V,
// then back up to speed) and shoves the rubble HIT_CLOSE closer, a bone hand holds YOU still for
// HELD_MS. At CATCH_GAP it has YOU: a heart (cause "stairRubble"), and it falls back to GAP_RESET.
// The treads also GIVE WAY in stretches (`rot`): once YOU are ROT_LEAD into one, it crumbles
// from its top end down after YOU at ROT_V, faster than a duck or a hold and slower than a run,
// so stopping there drops YOU through (cause "stairGive").
//
// THE SPIRAL. The stair is a run of FLIGHTS, each a straight descent; where one ends the next
// begins at the same x, high again: the stair has wound once round its central column (the art
// stands a column of vertebrae over every seam, in front of YOU). Crossing a seam lifts YOU (and
// a bolt) by the flight's height, so the field never runs out of room going down.
//
// THE ROOM (spec.ride, see rides/bonestair/ghoul-bonestair-room.js; made by
// prototypes/ghoul-rush-tools/gen-bonestair.mjs):
//
// - `flights` [x0, x1, yTop, yBottom]: each flight's line (YOUR feet ride its nosings), x
//   rising, each next one starting where the last ended. `top` [x0, x1, y] is the cellar
//   landing YOU start on, before the first flight. The last flight ends at `finish`, in the air
//   over the Pit's floor (the room's last `ground` piece), lower: run off it and land there.
// - `gaps` [x0, x1]: MISSING TREADS (jump: run off the edge and YOU drop through, a heart,
//   cause "stairGap", then YOU are put back on the treads past it).
// - `rot` [x0, x1]: treads that GIVE WAY (keep running; above).
// - `ribs` [x, y]: a HANGING RIBCAGE, RIB_W wide, its underside at y, from there up: DUCK it
//   (y sits between a ducked box and a standing one along its whole width; cause "stairRib").
// - `skels` [x]: a SKELETON CLIMBING UP at YOU: once YOU are SKEL_NEAR short it pulls itself
//   up over the treads (SKEL_RISE_MS), then climbs the stair toward YOU at SKEL_V, SKEL_W by
//   SKEL_H: SHOOT it (SKEL_HP bolts: an act) or jump it (cause "stairSkel").
// - `hands` [x]: a BONE HAND at the rail: once YOU are HAND_NEAR short its fingers creep up
//   over the tread's edge (HAND_WARN_MS), then it grabs across the tread for HAND_GRAB_MS,
//   HAND_W by HAND_H: JUMP it (a grab is a heart and holds YOU HELD_MS; cause "stairHand").
// - `stones` [x]: FALLING MASONRY from the collapse: once YOU are STONE_NEAR short a shadow
//   grows on the tread for STONE_MS (a creak at its start, a crack halfway: two audible steps),
//   then the block lands (under it is a heart) and lies there as a pile, PILE_W by PILE_H:
//   JUMP it (cause "stairStone").
// - `surge` [x0, x1, extra]: spans where the rubble falls faster. `checks`, `finish`, `time`
//   (the room's clock, ms), `hearts` (3) and `how` (the controls line).
//
// YOU (`round.runner`): { id, room, v, check, done, gap, close, catches, heldMs, coyote,
// flight, rot: [{ state "wait"|"go"|"done", front }], skels: [{ state "wait"|"rise"|"climb"|
// "down"|"smashed"|"gone", t, x, hp }], hands: [{ state "wait"|"reach"|"grab"|"hold"|"gone",
// t }], stones: [{ state "wait"|"warn"|"pile"|"smashed", t, cracked }], clock, gapMs, gapSum }.
// YOU run at (you.x, you.y), facing right (`you.state` "run" on the treads, "air" off them,
// `you.ducking` ducked). Up jumps (STAIR_JUMP_V against STAIR_G: about 7 high, and longer on
// the way down the stair), COYOTE_MS of grace off an edge. A bolt flies parallel to the stair.
//
// A hit costs one of the round's three hearts (core/ghoul-bonus.js), not a life, and the run
// goes on, YOU blinking safe BONUS_SAFE_MS; the last heart gone ends the round with nothing
// ("BONUS LOST", no dice) and the run carries on into the Pit. Every obstacle is a number for
// the grade (`perf.total`, each id once in `perf.hits` if it ever cost a heart; a catch adds
// one of its own). Shooting a skeleton down is an act (ACTS_GOAL is every one of them). The
// steady die is the collapse kept far: the gap's average over the run at least STEADY_GAP.
//
// WHAT THE ART READS: `spec.ride` (above), `round.runner` (above), `round.you`, the events in
// EVENTS, and the helpers exported here (stairY, flightAt, seams, stoneDrop, ribUnder).

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "stairJump", "stairLand", "stairCrash", "stairDrop", "stairCheck", "stairTurn", "stairEdge", "stairFinish",
  "stairClose", "stairCatch", "stairRot", "stairRise", "stairSkelHit", "stairSkelDown", "stairReach", "stairGrab",
  "stairCreak", "stairCrack", "stairThud",
]);
// Every cause a heart can be lost to here.
export const CAUSES = freeze(["stairGap", "stairGive", "stairRib", "stairSkel", "stairHand", "stairStone", "stairRubble"]);

// Running. Speeds are units across a second, STAIR_G units a second squared.
export const RUN_V = 42;
export const DUCK_V = 30;
export const HOLD_V = 22;
export const STUMBLE_V = 24;
export const RELAX = 4;
export const STAIR_JUMP_V = 46;
export const STAIR_G = 150;
export const COYOTE_MS = 90;
export const LAND_TOL = 0.9;
// How far under the treads YOU may drop before it is a fall (the far edge of a gap is a wall).
export const FALL_DEPTH = 3.5;
// The camera sits this far behind its usual spot, so the rubble shows at the left.
export const CAM_LEAD = -12;
// How far in front of YOU YOUR shins meet a pile or a skeleton.
export const REACH = 1.5;
// The collapse behind YOU.
export const RUBBLE_V = 38;
export const GAP_START = 20;
export const GAP_MAX = 28;
export const GAP_RESET = 15;
export const CATCH_GAP = 4;
export const CLOSE_ON = 10;
export const CLOSE_OFF = 14;
export const HIT_CLOSE = 6;
export const STEADY_GAP = 17;
// Treads that give way.
export const ROT_LEAD = 4;
export const ROT_V = 36;
export const ROT_GRACE = 0.6;
// Hanging ribcages.
export const RIB_W = 5;
// Skeletons climbing up.
export const SKEL_NEAR = 66;
export const SKEL_RISE_MS = 700;
export const SKEL_V = 8;
export const SKEL_W = 2.6;
export const SKEL_H = 5;
export const SKEL_HP = 2;
export const SKEL_POINTS = 120;
// Bone hands at the rail.
export const HAND_NEAR = 56;
export const HAND_WARN_MS = 800;
export const HAND_GRAB_MS = 900;
export const HAND_W = 3;
export const HAND_H = 2.2;
export const HELD_MS = 300;
// Falling masonry.
export const STONE_NEAR = 72;
export const STONE_MS = 1300;
export const STONE_FALL_MS = 260;
export const STONE_FALL_H = 34;
export const PILE_W = 3.2;
export const PILE_H = 2.6;
const BOLT_R = 0.5;

// Notes for a bonus round that obstacle `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, cx, you, x, y0, w, h) => Math.abs(cx - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;

/* ----------------------------------------------------------- the stair */

// The flight covering x (its index), or -1 before the first and past the last.
export function flightAt(R, x) {
  const F = R.flights;
  if (x < F[0][0] || x > F[F.length - 1][1]) return -1;
  for (let i = 0; i < F.length; i++) if (x < F[i][1] || i === F.length - 1) return i;
  return F.length - 1;
}

// The height of the stair's line at x (the landing before the first flight), or null past the last.
export function stairY(R, x) {
  if (R.top && x >= R.top[0] && x < R.flights[0][0]) return R.top[2];
  const i = flightAt(R, x);
  if (i < 0) return null;
  const [x0, x1, y0, y1] = R.flights[i];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

// The stair's slope at x (rise over run; 0 on the landing).
export function slopeAt(R, x) {
  const i = flightAt(R, x);
  if (i < 0) return 0;
  const [x0, x1, y0, y1] = R.flights[i];
  return (y1 - y0) / (x1 - x0);
}

// Each seam where the stair winds round its column: { x, rise } (how far up the next flight begins).
const SEAMS = new WeakMap();
export function seams(R) {
  let s = SEAMS.get(R);
  if (!s) {
    s = [];
    for (let i = 0; i + 1 < R.flights.length; i++) s.push(freeze({ x: R.flights[i][1], rise: R.flights[i + 1][2] - R.flights[i][3], n: i + 1 }));
    s = freeze(s);
    SEAMS.set(R, s);
  }
  return s;
}

// How far up a thing moving from x0 to x1 is lifted by the seams it crosses.
function liftBetween(R, x0, x1) {
  let up = 0;
  for (const s of seams(R)) if (x0 < s.x && x1 >= s.x) up += s.rise;
  return up;
}

// A ribcage's underside at its x, from its row.
export const ribUnder = (rib) => rib[1];

// The surge's extra speed at x.
export function surgeAt(R, x) {
  for (const [x0, x1, extra] of R.surge || []) if (x >= x0 && x <= x1) return extra;
  return 0;
}

// Footing at x: the stair's line, or null over a gap, a stretch given way, or past the end.
function foot(R, c, x) {
  const y = stairY(R, x);
  if (y === null) return null;
  for (const [x0, x1] of R.gaps) if (x > x0 && x < x1) return null;
  if (c) {
    for (const [i, [x0, x1]] of R.rot.entries()) {
      const r = c.rot[i];
      if (r.state !== "wait" && x >= x0 && x <= x1 && x < r.front) return null;
    }
  }
  return y;
}

// Where a stone dropping on x is, `t` ms from landing (its bottom's height over the tread;
// null before it has begun to fall): the art and the rules read the same fall.
export function stoneDrop(t) {
  if (t > STONE_FALL_MS) return null;
  const p = Math.max(0, t) / STONE_FALL_MS;
  return STONE_FALL_H * p * p;
}

/* -------------------------------------------------------------- placing */

// A fresh set of the room's things: every skeleton waiting under the treads, every hand still.
function things(R) {
  return {
    rot: R.rot.map(([x0]) => ({ state: "wait", front: x0 })),
    skels: R.skels.map(([x]) => ({ state: "wait", t: 0, x, hp: SKEL_HP })),
    hands: R.hands.map(() => ({ state: "wait", t: 0 })),
    stones: R.stones.map(() => ({ state: "wait", t: 0, cracked: false })),
  };
}

// YOU put down in the room: on the cellar landing at the start of the run, or at the last
// checkpoint passed after the last heart (the same room).
function place(round, k) {
  const R = round.spec.ride;
  if (!R || R.runner !== "bonestair") {
    if (round.runner && round.runner.id === "bonestair") round.runner = null;
    return;
  }
  const again = round.runner && round.runner.id === "bonestair" && round.runner.room === round.room;
  const check = again ? round.runner.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const y = stairY(R, x);
  Object.assign(you, { x, y: y ?? you.y, vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  round.runner = { id: "bonestair", room: round.room, check, v: RUN_V, done: false, gap: GAP_START, close: false, catches: again ? round.runner.catches : 0, heldMs: 0, coyote: 0, flight: Math.max(0, flightAt(R, x)), clock: 0, gapMs: 0, gapSum: 0, from: you.y, ...things(R) };
  round.camLead = CAM_LEAD;
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = R.gaps.length + R.rot.length + R.ribs.length + R.skels.length + R.hands.length + R.stones.length;
    b.perf.steady = true;
    b.perf.goal = ACTS_GOAL(R);
  }
}

// Every skeleton shot down is worth the die.
export const ACTS_GOAL = (R) => R.skels.length;

/* ------------------------------------------------------------- the run */

// After a fall that cost a heart but not the run: back onto the treads at the first solid
// footing ahead (past the gap, past a stretch that gave way), at RUN_V.
function reseat(round, c, R) {
  const you = round.you;
  let x = you.x;
  for (let guard = 0; guard < 8; guard++) {
    const g = R.gaps.find(([x0, x1]) => x > x0 - 0.5 && x < x1 + 0.5);
    if (g) {
      x = g[1] + 2;
      continue;
    }
    const ri = R.rot.findIndex(([x0, x1], i) => c.rot[i].state !== "wait" && x >= x0 - 0.5 && x <= x1 + 0.5);
    if (ri >= 0) {
      x = R.rot[ri][1] + 2;
      continue;
    }
    break;
  }
  x = Math.min(x, R.finish - 2);
  const y = stairY(R, x) ?? you.y;
  Object.assign(you, { x, y, vy: 0, state: "run", shelf: -1, ducking: false, coyote: 0, drop: -1 });
  Object.assign(c, { v: RUN_V, coyote: 0, from: y, flight: Math.max(0, flightAt(R, x)) });
}

// The grade's steady die: the collapse kept far, the gap's average over the run so far.
function steadiness(round, c) {
  const b = round.bonusRound;
  if (b && c.gapMs > 0) b.perf.steady = c.gapSum / c.gapMs >= STEADY_GAP;
}

// The run's motion for one slice. Returns true once it has moved YOU (every slice of the
// run); false outside the room and once YOU are down on the Pit's floor.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "bonestair" || !c || c.id !== "bonestair" || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  c.clock += ms;
  // Already down on the Pit's floor (set there, or past the end some other way): the run is over.
  const floor = k.groundAt(round.spec, you.x);
  if (you.x >= R.finish && you.vy <= 0 && you.y <= floor + 0.01) return finish(round, c, floor);
  const want = inp.jump > 0;
  const px = you.x;
  if (you.state === "run") {
    const held = c.heldMs > 0;
    c.heldMs = Math.max(0, c.heldMs - ms);
    const duck = Boolean(inp.down) && !want && !held;
    const hold = Boolean(inp.left) && !want && !held;
    you.ducking = duck;
    const target = held ? 0 : duck ? DUCK_V : hold ? HOLD_V : RUN_V;
    c.v = held ? 0 : c.v + (target - c.v) * Math.min(1, RELAX * dt * (target < c.v ? 2.5 : 1));
    if (want && !held) {
      inp.jump = 0;
      you.vy = STAIR_JUMP_V;
      you.state = "air";
      you.ducking = false;
      c.v = Math.max(c.v, DUCK_V);
      c.from = you.y;
      ev("stairJump", { v: c.v });
    } else {
      const nx = you.x + c.v * dt;
      const f = foot(R, c, nx);
      if (f !== null) {
        you.x = nx;
        you.y = f;
        you.vy = 0;
        you.runMs = c.v > 1 ? (you.runMs || 0) + ms : 0;
      } else {
        // Off an edge: a gap, treads given way, or the last step.
        you.x = nx;
        you.vy = slopeAt(R, Math.min(px, R.finish - 0.01)) * c.v;
        you.state = "air";
        you.ducking = false;
        c.coyote = COYOTE_MS;
        c.from = you.y;
        if (nx >= R.finish) ev("stairEdge");
      }
    }
  } else {
    // In the air: the speed YOU left with.
    c.coyote = Math.max(0, c.coyote - ms);
    if (want && c.coyote > 0) {
      inp.jump = 0;
      c.coyote = 0;
      you.vy = STAIR_JUMP_V;
      ev("stairJump", { v: c.v });
    }
    let py = you.y;
    you.vy = Math.max(-k.FALL_MAX, you.vy - STAIR_G * dt);
    you.x += c.v * dt;
    you.y += you.vy * dt;
    const up = liftBetween(R, px, you.x);
    you.y += up;
    py += up;
    you.ducking = false;
    you.runMs = 0;
    if (you.vy <= 0) {
      const f = foot(R, c, you.x);
      if (f !== null && py >= f - LAND_TOL && you.y <= f) {
        you.y = f;
        you.vy = 0;
        you.state = "run";
        ev("stairLand", { big: c.from - f >= 8 });
        c.from = f;
      } else if (you.x >= R.finish) {
        const g = k.groundAt(round.spec, you.x);
        if (g > -Infinity && you.y <= g + 0.01) return finish(round, c, g);
      }
    }
  }
  // A press nothing took waits a moment for a landing, then goes.
  if (want && inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  // Round the column: the stair winds on, high again.
  for (const s of seams(R)) {
    if (px < s.x && you.x >= s.x) {
      c.flight = s.n;
      ev("stairTurn", { n: s.n });
    }
  }
  // Treads that give way: the crumbling runs down after YOU.
  rotting(round, c, R, ms, k);
  // Under the treads: a fall through a gap, or through treads that went.
  const line = stairY(R, you.x);
  if (you.state === "air" && line !== null && you.y < line - FALL_DEPTH) {
    const ri = R.rot.findIndex(([x0, x1], i) => c.rot[i].state !== "wait" && you.x >= x0 - 1 && you.x <= x1 + 1);
    const gi = R.gaps.findIndex(([x0, x1]) => you.x > x0 - 2 && you.x < x1 + 2);
    const cause = ri >= 0 && gi < 0 ? "stairGive" : "stairGap";
    noteHit(round, cause === "stairGive" ? `r${ri}` : `g${gi}`);
    c.gap = Math.max(CATCH_GAP + 1, c.gap - HIT_CLOSE);
    ev("stairDrop", { cause });
    if (k.lose(round, cause) && round.phase === "play") reseat(round, c, R);
    return true;
  }
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("stairCheck", { n: c.check + 1 });
  }
  steerShots(round, R);
  round.camLead = CAM_LEAD;
  if (obstacles(round, c, R, ms, k)) return true;
  rubble(round, c, R, ms, k);
  return true;
}

// The run is over: YOU are down on the Pit's floor, the way on is open.
function finish(round, c, g) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  Object.assign(you, { y: g, vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  steadiness(round, c);
  round.events.push({ type: "stairFinish", x: you.x, y: you.y });
  return false;
}

// A hit that took a heart: YOU stumble and the rubble closes; the cause is noted for the grade.
function hurt(round, c, k, cause, id, extra, close = HIT_CLOSE) {
  if (!k.struck(round, cause)) return false;
  noteHit(round, id);
  c.gap = Math.max(CATCH_GAP + 1, c.gap - close);
  c.v = Math.min(c.v, STUMBLE_V);
  round.events.push({ type: "stairCrash", cause, x: round.you.x, y: round.you.y, ...extra });
  return true;
}

// The stretches that give way: each starts crumbling once YOU are ROT_LEAD into it, and the
// crumbling runs down it at ROT_V; treads it has passed are gone, so slower than it, YOU drop
// through.
function rotting(round, c, R, ms, k) {
  const you = round.you;
  R.rot.forEach(([x0, x1], i) => {
    const r = c.rot[i];
    if (r.state === "wait") {
      if (you.x >= x0 + ROT_LEAD && you.x < x1) {
        r.state = "go";
        r.front = x0;
        round.events.push({ type: "stairRot", x: x0, y: stairY(R, x0) ?? you.y, n: i });
      }
      return;
    }
    if (r.state !== "go") return;
    r.front += ROT_V * (ms / 1000);
    // Blinking safe after a heart, the crumbling waits just behind YOU.
    if (you.safeMs > 0 && you.x > x0 && you.x < x1) r.front = Math.min(r.front, you.x - ROT_GRACE);
    // Once it overtakes YOU the treads ahead are gone too (see foot), so YOU drop through.
    if (r.front >= x1) {
      r.front = x1;
      r.state = "done";
    }
  });
}

// A bolt flies parallel to the stair under it, whatever way it was aimed (`s.off`), and winds
// round the column with it.
function steerShots(round, R) {
  for (const s of round.shots) {
    if (s.arm || s.free) continue;
    if (s.off === undefined) s.off = s.vy;
    // First seen a slice after it was fired: from where it left the blaster.
    const from = s.stairX ?? s.x - (s.vx * (s.gone || 0)) / (Math.hypot(s.vx, s.vy) || 1);
    s.y += liftBetween(R, from, s.x);
    s.stairX = s.x;
    s.vy = s.vx * slopeAt(R, s.x) + s.off;
  }
}

// What YOU run into: a ribcage, a pile or a falling block, a hand, a skeleton. Returns whether
// it cost a heart.
function obstacles(round, c, R, ms, k) {
  const you = round.you;
  const hh = duckH(k, you);
  const cx = you.x + REACH;
  for (const [i, [x, under]] of R.ribs.entries()) {
    if (Math.abs(you.x - x) < (RIB_W + k.HIT_W) / 2 && you.y + hh > under && hurt(round, c, k, "stairRib", `b${i}`, { what: "rib", x })) return true;
  }
  // Masonry: the shadow, the creak, the crack, the drop, the pile.
  for (const [i, [x]] of R.stones.entries()) {
    const s = c.stones[i];
    const base = stairY(R, x) ?? 0;
    if (s.state === "wait") {
      if (x - you.x < STONE_NEAR && x - you.x > 0) {
        Object.assign(s, { state: "warn", t: STONE_MS, cracked: false });
        round.events.push({ type: "stairCreak", x, y: base, n: i });
      }
      continue;
    }
    if (s.state === "warn") {
      s.t -= ms;
      if (!s.cracked && s.t <= STONE_MS / 2) {
        s.cracked = true;
        round.events.push({ type: "stairCrack", x, y: base + 20, n: i });
      }
      const drop = stoneDrop(s.t);
      if (drop !== null && Math.abs(cx - x) < (k.HIT_W + PILE_W) / 2 && you.y < base + drop + PILE_H && you.y + hh > base + drop) {
        s.state = "smashed";
        if (hurt(round, c, k, "stairStone", `s${i}`, { what: "stone", x })) return true;
        continue;
      }
      if (s.t <= 0) {
        s.state = "pile";
        round.events.push({ type: "stairThud", x, y: base, n: i });
      }
      continue;
    }
    if (s.state === "pile" && Math.abs(cx - x) < 6 && boxHit(k, cx, you, x, base, PILE_W, PILE_H)) {
      s.state = "smashed";
      if (hurt(round, c, k, "stairStone", `s${i}`, { what: "stone", x })) return true;
    }
  }
  // Hands: fingers over the edge, then the grab.
  for (const [i, [x]] of R.hands.entries()) {
    const h = c.hands[i];
    const base = stairY(R, x) ?? 0;
    if (h.state === "wait") {
      if (x - you.x < HAND_NEAR && x - you.x > 2) {
        Object.assign(h, { state: "reach", t: HAND_WARN_MS });
        round.events.push({ type: "stairReach", x, y: base, n: i });
      }
    } else if (h.state === "reach") {
      h.t -= ms;
      if (h.t <= 0) {
        Object.assign(h, { state: "grab", t: HAND_GRAB_MS });
        round.events.push({ type: "stairGrab", x, y: base, n: i });
      }
    } else if (h.state === "grab") {
      h.t -= ms;
      if (boxHit(k, you.x, you, x, base, HAND_W, HAND_H) && hurt(round, c, k, "stairHand", `h${i}`, { what: "hand", x }, 0)) {
        Object.assign(h, { state: "hold", t: HELD_MS });
        c.heldMs = HELD_MS;
        c.v = 0;
        return true;
      }
      if (h.t <= 0) h.state = "gone";
    } else if (h.state === "hold") {
      h.t -= ms;
      if (h.t <= 0) h.state = "gone";
    }
  }
  // Skeletons: up over the treads, then up the stair at YOU.
  for (const [i, [sx]] of R.skels.entries()) {
    const s = c.skels[i];
    if (s.state === "wait") {
      if (sx - you.x < SKEL_NEAR && sx - you.x > 4) {
        Object.assign(s, { state: "rise", t: SKEL_RISE_MS });
        round.events.push({ type: "stairRise", x: sx, y: stairY(R, sx) ?? you.y, n: i });
      }
      continue;
    }
    if (s.state === "rise") {
      s.t -= ms;
      if (s.t <= 0) Object.assign(s, { state: "climb", t: 0 });
      continue;
    }
    if (s.state === "climb") {
      const fl = R.flights[Math.max(0, flightAt(R, sx))];
      s.x = Math.max(fl[0] + 1, s.x - SKEL_V * (ms / 1000));
      const y = stairY(R, s.x);
      if (y !== null && boxHit(k, cx, you, s.x, y, SKEL_W, SKEL_H) && hurt(round, c, k, "stairSkel", `k${i}`, { what: "skel", x: s.x })) {
        s.state = "smashed";
        return true;
      }
      if (s.x < you.x - 30) s.state = "gone";
    }
  }
  return false;
}

// The collapse: its gap, its warning, the grade's steady die, and a catch at CATCH_GAP.
function rubble(round, c, R, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  const moving = c.heldMs > 0 ? 0 : c.v;
  c.gap = clamp(c.gap + (moving - RUBBLE_V - surgeAt(R, you.x)) * dt, 0, GAP_MAX);
  if (!c.close && c.gap < CLOSE_ON) {
    c.close = true;
    ev("stairClose");
  } else if (c.close && c.gap >= CLOSE_OFF) c.close = false;
  c.gapMs += ms;
  c.gapSum += c.gap * ms;
  steadiness(round, c);
  if (c.gap > CATCH_GAP) return;
  // Blinking safe after a heart, it waits right behind YOU, to have YOU once the blink is over.
  if (you.safeMs > 0) {
    c.gap = CATCH_GAP;
    return;
  }
  c.gap = GAP_RESET;
  c.close = false;
  c.catches++;
  noteHit(round, `m${c.catches}`);
  ev("stairCatch");
  k.struck(round, "stairRubble");
}

/* ------------------------------------------------------------- targets */

// A bolt into a skeleton (rising or climbing): SKEL_HP of them knock it down. True when one
// took it (the bolt is spent).
function stairShot(round, s) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "bonestair" || !c || c.id !== "bonestair") return false;
  for (let i = 0; i < c.skels.length; i++) {
    const sk = c.skels[i];
    if (sk.state !== "rise" && sk.state !== "climb") continue;
    const y = stairY(R, sk.x);
    if (y === null) continue;
    // Rising, it is still half under the treads.
    const top = y + (sk.state === "rise" ? SKEL_H * (1 - Math.max(0, sk.t) / SKEL_RISE_MS) : SKEL_H);
    if (Math.abs(s.x - sk.x) > SKEL_W / 2 + BOLT_R || s.y < y - BOLT_R || s.y > top + BOLT_R) continue;
    sk.hp--;
    if (sk.hp > 0) round.events.push({ type: "stairSkelHit", x: sk.x, y: y + SKEL_H / 2 });
    else {
      sk.state = "down";
      sk.t = 0;
      round.score += SKEL_POINTS;
      if (round.bonusRound) round.bonusRound.perf.acts++;
      c.gap = Math.min(GAP_MAX, c.gap + 2);
      round.events.push({ type: "stairSkelDown", x: sk.x, y: y + SKEL_H / 2, points: SKEL_POINTS, n: i });
    }
    return true;
  }
  return false;
}

export const BONESTAIR = freeze({
  id: "bonestair",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: stairShot,
});
