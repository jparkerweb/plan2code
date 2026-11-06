// Plan2Code Web Console - Ghoul Rush's Holy Roller, its rules: the Chapel's bonus round. YOU surf a runaway church pew down the nave's aisle, seen from behind, in three lanes that speed up the whole way: change lane, jump the kneelers, candle stands, flagstone cracks and crypt hatches, slide under the censers, banners and fallen beams, shoot the gargoyles that drop from the arches (or ring a bell rope to stun them), and gather the wax souls for a combo. A stage pack that ghoul.js plugs in.
//
// An endless-runner (a Subway Surfers) rather than a side-view ride, so it is handed a kit `k` of
// ghoul.js's own helpers like the Coffin Sled (ghoul-sled.js) but never imports ghoul.js. Pack fields
// used: `ride` (a hook that moves Planny himself, so no key walks him), `place` (Planny put down in a
// room: a room set up or a respawn) and `target` (a bolt strikes something that is no monster: a
// gargoyle or a bell rope). It adds no monster, boss or hazard kind, and it draws NO random number.
// Its state lives in the shared ride slot `round.runner` (`id` "pew"), and its room says `runner: "pew"`.
//
// THE FIELD IS THE ART'S ALONE: ghoul-draw.js hands the whole field to pewArt's `field` (a pseudo-3D
// view down the aisle from behind the pew), so Planny's (x, y) here is only the distance run (`you.x`) and
// the floor under it; the lane and height are the pew's own (`c.lane`, `c.h`).
//
// THE COURSE (spec.ride, built by ghoul-pew-course.js, written in seconds and laid by the ramp):
//
// - `items`: [x, lane, kind, len] (see KINDS: SWITCH the lane for a block, JUMP a low thing, SLIDE under
//   a high one, SHOOT a gargoyle or a bell rope); `souls`: [x, lane, h, type] (type 1 a halo, a magnet);
//   `checks` and `finish` (the distance where the ride ends) and `time` (the clock, ms) and `how`.
// - The ride speeds up with the distance covered, from V0 to about 80 over RIDE_S (speedAt): a clear
//   ramp, so a run is about 66 s whatever you do. The art reads `c.v` for its speed lines and vignette.
//
// THE PEW (`round.runner`, null in any other room): { id, room, v, lane (a float, 0 to 2, sliding
// to `laneTo`), lean, h (height over the aisle), vh, slide (ms left), dive, bump, check, done,
// souls (0 open, 1 taken, 2 missed), got, combo, best, mult, comboMs, magnet, gargs, bells, hit, ... }.
// LEFT and RIGHT (a press) change lane (LANE_RATE lanes a second; a press at an edge lane bumps the
// wall, `pewBump`), UP jumps (JUMP_V against JUMP_G, about 6 high and two thirds of a second), DOWN slides
// for SLIDE_MS (in the air it fast-falls and slides on landing), hold fire to shoot straight down the lane.
//
// A hit costs one of the round's five hearts (ghoul-bonus.js), not a life, and the pew rolls on: it is
// shoved to the nearest calm lane and blinks safe for BONUS_SAFE_MS; the last heart gone ends the round
// with nothing, at once. A counted hit breaks the combo. Causes (the game shares them, all prefixed):
// see KINDS. A gargoyle shot (two bolts) or stunned by a bell, a bell rung and the souls taken are
// the grade's: `perf.total` obstacles, `perf.hits` the ids that cost a heart, `perf.acts` against
// ACTS_GOAL, and `perf.steady` once SOUL_SHARE of the souls laid out are taken.
//
// WHAT THE ART READS: `spec.ride`, `round.runner` (above; gargs: [{ state "perch"|"warn"|"drop"|"stand"|
// "stun"|"broken", t, hp }], bells: [rung]), `round.you` (`x`, `safeMs`), `round.shots` ({ x, lane }), the
// events in EVENTS.

import { ACC, COURSE, PEW_START, RIDE_S, V0, V_MAX, speedAt, xAt } from "./ghoul-pew-course.js";

export { ACC, COURSE, PEW_START, RIDE_S, V0, V_MAX, speedAt, xAt };

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "pewLane", "pewBump", "pewJump", "pewLand", "pewSlide", "pewDive", "pewSoul", "pewHalo", "pewCrash", "pewCheck", "pewFinish",
  "pewGargWarn", "pewGargDrop", "pewGargChip", "pewGargHit", "pewBell", "pewSpeed",
]);

// The pew. Speeds are units down the aisle a second.
export const LANES = 3;
export const LANE_RATE = 6.5;
export const LANE_HIT = 0.5;
export const HIT_Z = 1.1;
export const JUMP_V = 36;
export const JUMP_G = 110;
export const FAST_FALL = -62;
export const STAND_H = 4.4;
export const SLIDE_H = 2;
export const SLIDE_MS = 700;
export const BUMP_MS = 180;
// The speeds at which the organ swells: the ride is picking up.
export const SWELLS = freeze([44, 54, 64, 74]);
// The things. `d` the depth of one (a row of cracks says its own), `h` the height of a low one
// (clear it with your feet over `h`), `low` the underside of a high one over the aisle.
export const LOW_Y = 2.8;
export const KINDS = freeze({
  pillar: freeze({ answer: "SWITCH", d: 3.2, cause: "pewPillar" }),
  confessional: freeze({ answer: "SWITCH", d: 7, cause: "pewConfessional" }),
  pewx: freeze({ answer: "SWITCH", d: 3.6, cause: "pewCrosswise" }),
  kneeler: freeze({ answer: "JUMP", d: 3.2, h: 2, cause: "pewKneeler" }),
  stand: freeze({ answer: "JUMP", d: 2.2, h: 3.4, cause: "pewCandle" }),
  cracks: freeze({ answer: "JUMP", d: 7, h: 0.8, cause: "pewFlagstone" }),
  hatch: freeze({ answer: "JUMP", d: 5.5, h: 0.8, cause: "pewHatch" }),
  censer: freeze({ answer: "SLIDE", d: 2.6, low: LOW_Y, cause: "pewCenser" }),
  banner: freeze({ answer: "SLIDE", d: 1.8, low: LOW_Y, cause: "pewBanner" }),
  beam: freeze({ answer: "SLIDE", d: 3, low: LOW_Y, cause: "pewBeam" }),
  garg: freeze({ answer: "SHOOT", d: 3, h: 5, cause: "pewGargoyle" }),
  bell: freeze({ answer: "SHOOT", d: 1.6, cause: "" }),
});
// The gargoyles: wake GARG_LEAD_S seconds short, shudder, drop from GARG_PERCH up, take GARG_HP bolts.
export const GARG_LEAD_S = 1.55;
export const GARG_WARN_MS = 600;
export const GARG_DROP_MS = 260;
export const GARG_PERCH = 14;
export const GARG_HP = 2;
export const GARG_POINTS = 150;
// A bell rung stuns every gargoyle still ahead of the pew within BELL_S seconds of the ride beyond the bell's rope.
export const BELL_S = 3.4;
export const BELL_POINTS = 100;
// The wax souls: a combo of COMBO_STEP in a row adds one to the multiplier (to MULT_MAX), COMBO_MS to the next.
export const SOUL_POINTS = 10;
export const HALO_POINTS = 50;
export const COMBO_STEP = 8;
export const MULT_MAX = 5;
export const COMBO_MS = 2200;
export const MAG_MS = 4500;
export const MAG_Z = 26;
export const SOUL_SHARE = 0.6;
// The shots at things (gargoyles shot or stunned, bells rung) worth a die.
export const ACTS_GOAL = 6;

export const multOf = (n) => Math.min(MULT_MAX, 1 + Math.floor(n / COMBO_STEP));

// Notes for a bonus round that cue `id` cost a heart (once each).
function noteHit(round, id) {
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

// Every thing in the course as a cue, by x: { id, kind, i (among its kind), x, lane, len, end, answer }. Built once.
const CUES = new WeakMap();
export function cuesOf(R) {
  let cues = CUES.get(R);
  if (!cues) {
    const seen = {};
    cues = R.items.map(([x, lane, kind, len]) => {
      const i = seen[kind] || 0;
      seen[kind] = i + 1;
      const d = len || KINDS[kind].d;
      return freeze({ id: `${kind}${i}`, kind, i, x, lane, len: d, end: x + d, answer: KINDS[kind].answer });
    });
    CUES.set(R, freeze(cues));
    cues = CUES.get(R);
  }
  return cues;
}
// The cues that count for the grade (the bells are only for shooting).
export const countedOf = (R) => cuesOf(R).filter((q) => q.kind !== "bell");
export const gargsOf = (R) => cuesOf(R).filter((q) => q.kind === "garg");
export const bellsOf = (R) => cuesOf(R).filter((q) => q.kind === "bell");
export const soulTotal = (R) => R.souls.filter((s) => s[3] === 0).length;

/* -------------------------------------------------------------- placing */

// A fresh set of the course's creatures: each gargoyle perched, each bell hanging. What was shot,
// stunned or rung stays so (`old`, the pew of an earlier try in the same room).
function things(R, old) {
  const keep = (s) => s === "broken" || s === "stun";
  return {
    gargs: gargsOf(R).map((q, i) => ({ state: old && old.gargs[i] && keep(old.gargs[i].state) ? old.gargs[i].state : "perch", t: 0, hp: GARG_HP })),
    bells: bellsOf(R).map((q, i) => Boolean(old && old.bells[i])),
    souls: old ? old.souls : R.souls.map(() => 0),
  };
}

// Planny put down in the room: on the pew at the start of a ride, or at the last checkpoint
// passed (the same room).
function place(round, k) {
  const R = round.spec.ride;
  if (!R || R.runner !== "pew") {
    // (Another ride's state in the shared slot is not ours to touch.)
    if (round.runner && round.runner.id === "pew") round.runner = null;
    return;
  }
  const again = round.runner && round.runner.id === "pew" && round.runner.room === round.room;
  const old = again ? round.runner : null;
  const check = again ? round.runner.check : -1;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  const set = things(R, old);
  Object.assign(round.you, { x, y: k.groundAt(round.spec, x), vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  // Souls laid before the checkpoint are behind us now.
  const next = R.souls.findIndex((s, i) => s[0] >= x - 1 || (set.souls[i] = set.souls[i] || 2, false));
  round.runner = {
    id: "pew", room: round.room, check, v: speedAt(x), lane: 1, laneTo: 1, lean: 0, h: 0, vh: 0, slide: 0, dive: false, bump: 0, bumpDir: 0,
    hl: false, hr: false, hd: false, done: false, swell: SWELLS.findIndex((s) => s > speedAt(x)) < 0 ? SWELLS.length : SWELLS.findIndex((s) => s > speedAt(x)),
    got: old ? old.got : 0, combo: 0, best: old ? old.best : 0, mult: 1, comboMs: 0, magnet: 0, sNext: next < 0 ? R.souls.length : next, hit: {}, shove: 0,
    ...set,
  };
  const b = round.bonusRound;
  if (b && !b.perf.total) {
    b.perf.total = countedOf(R).length;
    b.perf.steady = false;
    b.perf.goal = ACTS_GOAL;
  }
}

/* ------------------------------------------------------------ the ride */

// The pew's motion for one slice. Returns true once it has moved Planny (every slice of a ride);
// false once the ride is over.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "pew" || !c || c.id !== "pew" || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, lane: c.lane, h: c.h, ...extra });
  c.v = speedAt(you.x);
  while (c.swell < SWELLS.length && c.v >= SWELLS[c.swell]) ev("pewSpeed", { n: c.swell++, v: c.v });
  steerShots(round, c);
  // Lanes: a press (not a held key) moves one lane; at the edge it bumps the wall.
  const left = Boolean(inp.left);
  const right = Boolean(inp.right);
  for (const [now, was, dir] of [[left, c.hl, -1], [right, c.hr, 1]]) {
    if (!now || was) continue;
    const to = c.laneTo + dir;
    if (to < 0 || to >= LANES) {
      c.bump = BUMP_MS;
      c.bumpDir = dir;
      ev("pewBump", { dir });
    } else {
      c.laneTo = to;
      ev("pewLane", { dir, to });
    }
  }
  c.hl = left;
  c.hr = right;
  const dl = c.laneTo - c.lane;
  const step = LANE_RATE * dt;
  c.lane = Math.abs(dl) <= step ? c.laneTo : c.lane + Math.sign(dl) * step;
  c.lean += (clamp(c.laneTo - c.lane, -1, 1) - c.lean) * Math.min(1, dt * 16);
  c.bump = Math.max(0, c.bump - ms);
  // Jump and slide.
  const ground = c.h <= 0 && c.vh <= 0;
  if (inp.jump > 0 && ground) {
    inp.jump = 0;
    c.vh = JUMP_V;
    c.h = 0.001;
    c.slide = 0;
    ev("pewJump");
  } else if (inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  const down = Boolean(inp.down);
  if (down && !c.hd) {
    if (c.h <= 0 && c.vh <= 0) {
      if (c.slide <= 0) ev("pewSlide");
      c.slide = SLIDE_MS;
    } else if (!c.dive) {
      c.dive = true;
      c.vh = Math.min(c.vh, FAST_FALL);
      ev("pewDive");
    }
  }
  c.hd = down;
  c.slide = Math.max(0, c.slide - ms);
  if (c.h > 0 || c.vh > 0) {
    c.vh = Math.max(-120, c.vh - JUMP_G * dt);
    c.h += c.vh * dt;
    if (c.h <= 0) {
      ev("pewLand", { big: c.vh < -45 });
      c.h = 0;
      c.vh = 0;
      if (c.dive) {
        c.slide = SLIDE_MS;
        ev("pewSlide");
      }
      c.dive = false;
    }
  }
  you.x += c.v * dt;
  Object.assign(you, { y: k.groundAt(round.spec, you.x), vy: c.vh, state: c.h > 0 ? "air" : "run", ducking: c.slide > 0, face: 1 });
  if (you.x >= R.finish) return finish(round, c, R, k);
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("pewCheck", { n: c.check + 1 });
  }
  obstacles(round, c, R, k);
  creatures(round, c, R, ms);
  souls(round, c, R, ms);
  return true;
}

// The ride is over: Planny steps to the door, which the next slice walks through, and the card shows.
function finish(round, c, R, k) {
  const you = round.you;
  c.done = true;
  round.hasKey = true;
  Object.assign(you, { x: round.spec.door, y: k.groundAt(round.spec, round.spec.door), vy: 0, state: "run", ducking: false });
  const b = round.bonusRound;
  const share = soulShare(R, c);
  if (b) b.perf.steady = share >= SOUL_SHARE;
  round.events.push({ type: "pewFinish", x: you.x, y: you.y, share, best: c.best, got: c.got });
  return true;
}

export const soulShare = (R, c) => c.got / Math.max(1, soulTotal(R));

// A bolt flies straight down its lane, level: the lane is the pew's at the moment it is fired.
function steerShots(round, c) {
  for (const s of round.shots) {
    if (s.arm || s.free) continue;
    if (s.lane === undefined) s.lane = clamp(Math.round(c.lane), 0, LANES - 1);
    s.vy = 0;
    s.y = round.you.y + 2.4;
  }
}

// Whether the pew, in its lane and at its height, is in a cue's way right now.
export function touching(c, q, x) {
  const kind = KINDS[q.kind];
  if (q.kind === "bell" || Math.abs(c.lane - q.lane) >= LANE_HIT) return false;
  if (x < q.x - HIT_Z || x > q.end + HIT_Z) return false;
  if (kind.answer === "SWITCH") return true;
  if (kind.answer === "JUMP") return c.h < kind.h;
  if (kind.answer === "SLIDE") return !(c.slide > 0 && c.h < 0.5);
  const g = c.gargs[q.i];
  return g.state === "stand" || (g.state === "drop" && g.t <= GARG_DROP_MS * 0.3);
}

// The lane nearest `from` with nothing in the way a moment before and after `x`.
export function calmLane(R, c, x, from) {
  const gone = (q) => q.kind === "garg" && (c.gargs[q.i].state === "broken" || c.gargs[q.i].state === "stun");
  const open = (lane) => !cuesOf(R).some((q) => q.lane === lane && q.kind !== "bell" && q.end > x - 4 && q.x < x + 14 && !gone(q));
  const order = [0, 1, 2].sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || a - b);
  return order.find(open) ?? Math.round(from);
}

// What the pew runs into. A counted hit shoves it to a calm lane; it does the heart's cost through k.struck.
function obstacles(round, c, R, k) {
  const you = round.you;
  for (const q of cuesOf(R)) {
    if (q.x > you.x + 8) break;
    if (q.end < you.x - 8 || c.hit[q.id]) continue;
    if (!touching(c, q, you.x)) continue;
    if (!k.struck(round, KINDS[q.kind].cause)) continue;
    c.hit[q.id] = true;
    const lost = c.combo;
    c.combo = 0;
    c.mult = 1;
    c.comboMs = 0;
    noteHit(round, q.id);
    c.laneTo = calmLane(R, c, you.x, c.lane);
    c.vh = Math.min(c.vh, 0);
    round.events.push({ type: "pewCrash", what: q.kind, id: q.id, x: you.x, y: you.y, lane: q.lane, h: c.h, lost });
    return;
  }
}

// The gargoyles in the arches wake when the pew comes near: shudder, drop, then stand in the lane.
function creatures(round, c, R, ms) {
  const you = round.you;
  gargsOf(R).forEach((q, i) => {
    const g = c.gargs[i];
    if (g.state === "perch") {
      if ((q.x - you.x) / c.v < GARG_LEAD_S && q.end > you.x) {
        Object.assign(g, { state: "warn", t: GARG_WARN_MS });
        round.events.push({ type: "pewGargWarn", x: q.x, y: you.y, lane: q.lane });
      }
    } else if (g.state === "warn" || g.state === "drop") {
      g.t -= ms;
      if (g.t > 0) return;
      if (g.state === "warn") Object.assign(g, { state: "drop", t: GARG_DROP_MS });
      else {
        Object.assign(g, { state: "stand", t: 0 });
        round.events.push({ type: "pewGargDrop", x: q.x, y: you.y, lane: q.lane });
      }
    }
  });
}

// The wax souls: taken in passing (lane and height), or pulled in by a halo's magnet.
function souls(round, c, R, ms) {
  const you = round.you;
  const S = R.souls;
  c.magnet = Math.max(0, c.magnet - ms);
  c.comboMs = Math.max(0, c.comboMs - ms);
  if (!c.comboMs && c.combo) {
    c.combo = 0;
    c.mult = 1;
  }
  const body = c.slide > 0 ? SLIDE_H : STAND_H;
  const reach = c.magnet > 0 ? MAG_Z : 1;
  for (let i = c.sNext; i < S.length && S[i][0] <= you.x + reach; i++) {
    if (c.souls[i] !== 0) continue;
    const [sx, lane, h, type] = S[i];
    const pulled = c.magnet > 0 && Math.abs(lane - c.lane) <= 1.05 && sx - you.x <= MAG_Z;
    const met = sx <= you.x + 1;
    if (!pulled && !met) continue;
    const hit = pulled || (Math.abs(lane - c.lane) < 0.6 && h >= c.h - 0.8 && h <= c.h + body + 0.8);
    if (!hit) {
      c.souls[i] = 2;
      continue;
    }
    c.souls[i] = 1;
    if (type === 1) {
      c.magnet = MAG_MS;
      round.score += HALO_POINTS;
      round.events.push({ type: "pewHalo", x: sx, y: you.y, lane, h, points: HALO_POINTS });
      continue;
    }
    c.got++;
    c.combo++;
    c.best = Math.max(c.best, c.combo);
    c.comboMs = COMBO_MS;
    const was = c.mult;
    c.mult = multOf(c.combo);
    round.score += SOUL_POINTS * c.mult;
    round.events.push({ type: "pewSoul", x: sx, y: you.y, lane, h, combo: c.combo, mult: c.mult, up: c.mult > was });
    const b = round.bonusRound;
    if (b) b.perf.steady = soulShare(R, c) >= SOUL_SHARE;
  }
  while (c.sNext < S.length && (c.souls[c.sNext] !== 0 || S[c.sNext][0] < you.x - 2)) {
    if (c.souls[c.sNext] === 0) c.souls[c.sNext] = 2;
    c.sNext++;
  }
}

/* ------------------------------------------------------------- targets */

// How high a gargoyle is over the aisle: GARG_PERCH perched, falling as it drops, 0 standing.
export function gargRise(g) {
  if (g.state === "drop") return GARG_PERCH * clamp(g.t / GARG_DROP_MS, 0, 1);
  return g.state === "stand" || g.state === "stun" || g.state === "broken" ? 0 : GARG_PERCH;
}

// A bolt into something to shoot: a gargoyle falling or standing, a bell rope. True when one took it.
function pewShot(round, s) {
  const R = round.spec.ride;
  const c = round.runner;
  if (!R || R.runner !== "pew" || !c || c.id !== "pew") return false;
  if (s.lane === undefined) s.lane = clamp(Math.round(c.lane), 0, LANES - 1);
  const x0 = s.q === undefined ? s.x - 3 : s.q;
  s.q = s.x;
  const lo = Math.min(x0, s.x) - 0.6;
  const hi = Math.max(x0, s.x) + 0.6;
  const over = (q) => q.lane === s.lane && q.end >= lo && q.x <= hi;
  const award = (n) => {
    round.score += n * c.mult;
    if (round.bonusRound) round.bonusRound.perf.acts++;
  };
  const gs = gargsOf(R);
  for (let i = 0; i < gs.length; i++) {
    const g = c.gargs[i];
    if ((g.state !== "drop" && g.state !== "stand") || !over(gs[i])) continue;
    const q = gs[i];
    if (--g.hp > 0) {
      round.events.push({ type: "pewGargChip", x: q.x, y: round.you.y, lane: q.lane, hp: g.hp });
      return true;
    }
    Object.assign(g, { state: "broken", t: 0 });
    award(GARG_POINTS);
    round.events.push({ type: "pewGargHit", x: q.x, y: round.you.y, lane: q.lane, points: GARG_POINTS * c.mult });
    return true;
  }
  const bs = bellsOf(R);
  for (let i = 0; i < bs.length; i++) {
    if (c.bells[i] || !over(bs[i])) continue;
    const q = bs[i];
    c.bells[i] = true;
    // Every gargoyle still to come (or standing), up to BELL_S seconds of ride beyond the rope, is stunned.
    let stunned = 0;
    gs.forEach((gq, j) => {
      const g = c.gargs[j];
      if (g.state !== "broken" && g.state !== "stun" && gq.end > round.you.x && gq.x <= q.x + c.v * BELL_S) {
        Object.assign(g, { state: "stun", t: 0 });
        stunned++;
      }
    });
    award(BELL_POINTS);
    if (round.bonusRound) round.bonusRound.perf.acts += stunned;
    round.events.push({ type: "pewBell", x: q.x, y: round.you.y, lane: q.lane, points: BELL_POINTS * c.mult, stunned });
    return true;
  }
  return false;
}

export const PEW = freeze({
  id: "pew",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: pewShot,
});
