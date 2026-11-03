// Plan2Code Web Console - Ghoul Rush's Bog Runner, its rules: Gallows Bog's bonus round. YOU skim a fan boat down a black channel through the swamp at night, with something swimming in your wake: jump the sunken snags and cypress knees, duck the moss veils and low limbs, shoot the hag's charms for points and the gas pockets for a cover burst, and switch between the open channel and the mud flats at the banks, as a stage pack that ghoul.js plugs in.
//
// Modeled on the Midnight Hearse (ghoul-hearse.js: read its header first) for the lanes and
// on the Torch Mob (ghoul-wagon.js) for the pursuit meter, and, like them, handed a kit `k`
// of ghoul.js's own helpers, so this file never imports ghoul.js. Pack fields used: `ride`
// (a hook that moves Planny himself, so no key walks him), `place` (Planny put down in a
// room: a room set up or a respawn) and `target` (a bolt strikes something that is no
// monster: a charm, a gas pocket). It adds no monster, boss or hazard kind, so there is
// nothing to merge by name, and it draws NO random number. Its state is `round.runner`
// (the shared slot for a rolling bonus ride, with `id: "bogboat"`; null in any other room)
// and the room's `ride.runner` is "bogboat". Every event it puts on the field starts with
// `bogboat`.
//
// THE TWIST: THE WAKE. A swarm of leeches boils up in the fan's wake, `gap` units back
// (GAP_START at the start, never over GAP_MAX). It swims at WAKE_V, the boat at its own
// speed: clean riding on open water (BOGBOAT_V) wins ground and everything else loses it:
// DOWN held (an ease of the throttle, and a duck) holds the boat at EASE_V, the mud flats
// slow it (FLATS_V, and FLATS_EASE_V when eased), a fan stalled in the mud stops it dead,
// and a hit shoves the swarm HIT_CLOSE closer. A gas pocket shot pushes it back GAS_PUSH.
// Inside PANIC_ON the swarm boils (the art shows it and the wake meter reads THEY ARE
// CLOSE) until PANIC_OFF. At WAKE_CATCH it has you: a heart (cause "wake"), and it falls
// back to WAKE_FALLBACK.
//
// THE ROOM (spec.ride, see ghoul-rooms.js): the ground is one flat floor under the water;
// there are two LANES, the open channel (lane 0, LANE_Y[0]) and the mud flats beside it
// (lane 1, LANE_Y[1], a raised bank), and every obstacle stands in one of them, [x, lane,
// ...]:
//
// - `banks` [x0, x1]: the banks, where the channel's edge shelves down into the flats;
//   inside one, LEFT puts the boat in the channel and RIGHT on the flats (SWITCH_MS to
//   hop the shelf). The art draws them as mud ramps. Nothing stands in a lane near one.
// - `snags` [x, lane]: a sunken log, SNAG_W by SNAG_H: jump (cause "snag").
// - `knees` [x, lane]: a cluster of cypress knees, KNEE_W by KNEE_H: jump (cause "knee").
// - `veils` [x0, x1, lane]: a curtain of moss, its underside LOW_Y over the lane: duck
//   (cause "veil").
// - `limbs` [x0, x1, lane]: a low cypress limb, its underside LOW_Y over the lane: duck
//   (cause "limb").
// - `props` [x, lane, kind]: one of the hag's charms (kind 0 a skull on a string, kind 1
//   a blue bottle) hung at chest height. It never hurts; shoot it (one bolt) for
//   PROP_POINTS and an act.
// - `gas` [x, lane]: a pocket of marsh gas bubbling up. It never hurts; shoot it for
//   GAS_POINTS, an act and a cover burst that pushes the wake back GAS_PUSH.
// - `checks` (x positions of the checkpoints), `finish` (where the ride ends: the boat
//   cuts its fan and Planny steps out to the door) and `time` (the room's clock, ms).
//
// THE BOAT (`round.runner`): { id, room, check, lane (where it is bound), from (the lane
// it left), swMs (switch time left), h (height over the lane), air, vy, v, gap, panic,
// clog, stall, faced, props, gas, done, restX, ... }. It runs at the speed its lane and
// throttle ask (eased toward it at RELAX a second); UP jumps at JUMP_V against GRAVITY
// (about 13 high, 0.75 s), DOWN ducks and eases; a switch cannot be made in the air and a
// jump or a duck cannot be made in one. A bolt flies level.
//
// THE CLOG: on the flats the fan sucks mud: the `clog` gauge rises CLOG_RISE a second at
// full throttle and cools CLOG_COOL a second eased (and on the channel). At CLOG_WARN the
// art flashes it; at CLOG_MAX the fan STALLS for STALL_MS (the boat coasts to a stop and
// the wake gains), then starts again at CLOG_RESTART.
//
// A hit costs one of the round's five hearts (ghoul-bonus.js), not a life, and the boat
// rolls on, Planny blinking safe BONUS_SAFE_MS; the last heart gone ends the round with
// nothing, at once. Causes: "snag", "knee", "veil", "limb", "wake". The grade's
// `perf.total` is the obstacles the boat FACED (passed in their lane; a lane switched away
// from is dodged and not counted, a catch adds one of its own), each id once in
// `perf.hits` if it ever cost a heart. Shooting a charm or a gas pocket counts for
// `perf.acts` (the goal is ACTS_GOAL, 8 of them) and the points below. The steady die is a
// swarm that never boiled (the wake never reached PANIC_ON).
//
// Checkpoints are passed at their x (`bogboatCheck`); a restart after the last heart goes
// back to the last one passed (that ends the round, as the sled's does).
//
// WHAT THE ART READS: `spec.ride` (above), `round.runner` { lane, from, swMs, h, air, v,
// gap, panic, clog, stall, done, restX, check, props: [{ state "up"|"broken" }], gas: [{
// state "up"|"burst"|"spent", t }] }, `round.you` (`state`, `vy`, `ducking`), the events in
// EVENTS.

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "bogboatJump", "bogboatLand", "bogboatDuck", "bogboatSwitch", "bogboatCrash", "bogboatCheck", "bogboatFinish",
  "bogboatPanic", "bogboatCatch", "bogboatClog", "bogboatStall", "bogboatGas", "bogboatProp",
]);

// The boat. Speeds are units across a second, GRAVITY units a second squared.
export const BOGBOAT_V = 40;
export const EASE_V = 24;
export const FLATS_V = 28;
export const FLATS_EASE_V = 22;
export const RELAX = 5;
export const JUMP_V = 74;
export const GRAVITY = 200;
export const BIG_LAND = 9;
export const LANE_Y = freeze([9, 15]);
export const SWITCH_MS = 360;
export const SWITCH_HOP = 1.6;
export const CAM_AHEAD = 12;
// Obstacles.
export const SNAG_W = 3.2;
export const SNAG_H = 3.8;
export const KNEE_W = 4.6;
export const KNEE_H = 2.4;
export const LOW_Y = 3.0;
export const PROP_W = 2.2;
export const PROP_H = 2.4;
export const PROP_UP = 1.6;
export const GAS_W = 3.6;
export const GAS_H = 3.2;
export const GAS_UP = 1.2;
export const GAS_BURST_MS = 700;
export const PROP_POINTS = 60;
export const GAS_POINTS = 90;
const SHOT_R = 0.5;
// The wake.
export const WAKE_V = 28;
export const GAP_START = 28;
export const GAP_MAX = 36;
export const WAKE_CATCH = 8;
export const WAKE_FALLBACK = 24;
export const PANIC_ON = 18;
export const PANIC_OFF = 22;
export const HIT_CLOSE = 8;
export const GAS_PUSH = 8;
// The clog.
export const CLOG_MAX = 100;
export const CLOG_WARN = 70;
export const CLOG_RISE = 30;
export const CLOG_COOL = 40;
export const CLOG_RESTART = 35;
export const STALL_MS = 1400;
// The shots at things (charms, gas pockets) worth a die.
export const ACTS_GOAL = 8;

const mine = (round) => (round.runner && round.runner.id === "bogboat" ? round.runner : null);
const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;
const smooth = (p) => p * p * (3 - 2 * p);

// The lane the boat counts as being in: the one it left until half way through a switch.
export const laneNow = (c) => (c.swMs > 0 && 1 - c.swMs / SWITCH_MS < 0.5 ? c.from : c.lane);
// The height of the water under the boat (its lane's, eased across a switch, with a little hop).
export function baseOf(c) {
  if (c.swMs <= 0) return LANE_Y[c.lane];
  const p = 1 - c.swMs / SWITCH_MS;
  return LANE_Y[c.from] + (LANE_Y[c.lane] - LANE_Y[c.from]) * smooth(p) + Math.sin(p * Math.PI) * SWITCH_HOP;
}

// Notes for a bonus round that obstacle `id` was faced (counted for the grade) and, with
// `cost`, that it cost a heart (once each).
function face(round, c, id, cost = false) {
  const b = round.bonusRound;
  if (!b) return;
  if (!c.faced[id]) {
    c.faced[id] = true;
    b.perf.total++;
  }
  if (cost && !b.perf.hits.includes(id)) b.perf.hits.push(id);
}

/* -------------------------------------------------------------- placing */

// A fresh set of the room's things, each charm hanging and each pocket full. What was shot
// stays shot (`old`, the boat of an earlier try in the same room).
function things(R, old) {
  const was = (list, i, state) => (old && old[list] && old[list][i] && old[list][i].state === state ? state : null);
  return {
    props: R.props.map((p, i) => ({ state: was("props", i, "broken") || "up" })),
    gas: R.gas.map((g, i) => ({ state: was("gas", i, "spent") || was("gas", i, "burst") ? "spent" : "up", t: 0 })),
  };
}

// Planny put down in the room: at the helm at the start of a ride, or at the last
// checkpoint passed after the last heart (the same room).
function place(round, k) {
  const R = round.spec.ride;
  // (The Cart's `place` runs first, leaves a ride with a `runner` alone and has already zeroed `round.camLead`.)
  if (!R || R.runner !== "bogboat") {
    if (mine(round)) round.runner = null;
    return;
  }
  const old = mine(round);
  const again = old && old.room === round.room;
  const check = again ? old.check : -1;
  const you = round.you;
  const x = check >= 0 ? R.checks[check] : round.spec.start;
  Object.assign(you, { x, y: LANE_Y[0], vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  round.runner = {
    id: "bogboat", room: round.room, check, lane: 0, from: 0, swMs: 0, h: 0, vy: 0, air: false, peak: 0, v: BOGBOAT_V,
    gap: GAP_START, panic: false, panicked: again ? old.panicked : false, clog: 0, warned: false, stall: 0,
    faced: again ? old.faced : {}, catches: again ? old.catches : 0, done: false, restX: 0, ...things(R, again ? old : null),
  };
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b) {
    b.perf.goal = ACTS_GOAL;
    if (!again) b.perf.total = 0;
    if (round.runner.panicked) b.perf.steady = false;
  }
}

/* ------------------------------------------------------------ the ride */

// The boat's motion for one slice. Returns true once it has moved Planny (every slice of
// a ride); false outside a ride and once he has stepped out.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = mine(round);
  if (!R || R.runner !== "bogboat" || !c || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  if (you.x >= R.finish) return finish(round, c, R, k);
  // The throttle: the lane and DOWN set the speed it eases toward, a stalled fan none.
  const ease = Boolean(inp.down) && !c.air;
  const flats = c.lane === 1;
  const target = c.stall > 0 ? 0 : flats ? (ease ? FLATS_EASE_V : FLATS_V) : ease ? EASE_V : BOGBOAT_V;
  c.v = c.stall > 0 && c.v < 0.5 ? 0 : c.v + (target - c.v) * Math.min(1, RELAX * dt);
  you.x += c.v * dt;
  // The banks: LEFT is the channel, RIGHT the flats.
  const want = inp.left && !inp.right ? 0 : inp.right && !inp.left ? 1 : -1;
  const bank = R.banks.some(([a, b]) => you.x >= a && you.x <= b);
  if (bank && !c.air && c.swMs <= 0 && want >= 0 && want !== c.lane) startSwitch(c, want, ev, you);
  if (c.swMs > 0) {
    c.swMs = Math.max(0, c.swMs - ms);
    you.ducking = false;
    you.state = "run";
    you.vy = 0;
  } else {
    // On the water: jump, duck, or in the air.
    const jump = inp.jump > 0;
    if (!c.air && jump) {
      inp.jump = 0;
      c.air = true;
      c.h = 0.001;
      c.vy = JUMP_V;
      c.peak = 0;
      you.ducking = false;
      ev("bogboatJump");
    } else if (!c.air) {
      const duck = Boolean(inp.down);
      if (duck && !you.ducking) ev("bogboatDuck");
      you.ducking = duck;
    }
    if (c.air) {
      c.vy -= GRAVITY * dt;
      c.h += c.vy * dt;
      c.peak = Math.max(c.peak, c.h);
      you.ducking = false;
      if (c.h <= 0) {
        ev("bogboatLand", { big: c.peak >= BIG_LAND });
        Object.assign(c, { air: false, h: 0, vy: 0 });
      }
    }
    you.state = c.air ? "air" : "run";
    you.vy = c.air ? c.vy : 0;
  }
  you.y = baseOf(c) + (c.swMs > 0 ? 0 : c.h);
  // A press nothing took waits a moment for a landing, then goes.
  if (inp.jump > 0) inp.jump = Math.max(0, inp.jump - ms);
  while (c.check + 1 < R.checks.length && you.x >= R.checks[c.check + 1]) {
    c.check++;
    ev("bogboatCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD;
  clogging(round, c, ms, ev, ease);
  if (obstacles(round, c, R, k)) return true;
  wake(round, c, ms, ev, k);
  return true;
}

function startSwitch(c, to, ev, you) {
  Object.assign(c, { from: c.lane, lane: to, swMs: SWITCH_MS, air: false, h: 0, vy: 0 });
  ev("bogboatSwitch", { to, y: LANE_Y[to], x: you.x });
}

// The ride is over: the boat cuts its fan at the finish, the door opens, Planny steps out.
function finish(round, c, R, k) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  Object.assign(c, { air: false, h: 0, vy: 0, swMs: 0 });
  Object.assign(you, { y: k.groundAt(round.spec, you.x), vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  round.events.push({ type: "bogboatFinish", x: you.x, y: you.y });
  return false;
}

// The fan on the flats: mud clogs it while it runs full, an ease or open water clears it,
// and a clogged fan stalls the boat for STALL_MS.
function clogging(round, c, ms, ev, ease) {
  const dt = ms / 1000;
  if (c.stall > 0) {
    c.stall -= ms;
    if (c.stall <= 0) Object.assign(c, { stall: 0, clog: CLOG_RESTART, warned: false });
    return;
  }
  const flats = laneNow(c) === 1 && c.swMs <= 0;
  c.clog = clamp(c.clog + (flats && !ease ? CLOG_RISE : -CLOG_COOL) * dt, 0, CLOG_MAX);
  if (c.clog >= CLOG_WARN && !c.warned) {
    c.warned = true;
    ev("bogboatClog");
  } else if (c.clog < CLOG_WARN - 15) c.warned = false;
  if (c.clog >= CLOG_MAX) {
    c.stall = STALL_MS;
    ev("bogboatStall");
  }
}

// A heart lost on obstacle `id`: it was faced and cost, the wake closes, and the crash is
// an event. Returns true.
function cost(round, c, id, what, x) {
  face(round, c, id, true);
  c.gap = Math.max(WAKE_CATCH + 1, c.gap - HIT_CLOSE);
  round.events.push({ type: "bogboatCrash", what, x, y: round.you.y });
  return true;
}

// What the boat runs into: a snag, cypress knees, a moss veil or a limb. Returns whether it
// cost a heart. (Nothing counts while it hops between lanes: the banks keep their
// neighborhood clear.)
function obstacles(round, c, R, k) {
  const you = round.you;
  if (c.swMs > 0) return false;
  const lane = c.lane;
  const base = LANE_Y[lane];
  const hh = duckH(k, you);
  const seen = (id, x) => {
    if (you.x >= x && !c.faced[id]) face(round, c, id);
  };
  for (const [i, [x, l]] of R.snags.entries()) {
    if (l !== lane) continue;
    seen(`s${i}`, x);
    if (Math.abs(you.x - x) <= 6 && boxHit(k, you, x, base, SNAG_W, SNAG_H) && k.struck(round, "snag")) return cost(round, c, `s${i}`, "snag", x);
  }
  for (const [i, [x, l]] of R.knees.entries()) {
    if (l !== lane) continue;
    seen(`k${i}`, x);
    if (Math.abs(you.x - x) <= 6 && boxHit(k, you, x, base, KNEE_W, KNEE_H) && k.struck(round, "knee")) return cost(round, c, `k${i}`, "knee", x);
  }
  for (const [list, key, cause, what] of [[R.veils, "v", "veil", "veil"], [R.limbs, "l", "limb", "limb"]]) {
    for (const [i, [x0, x1, l]] of list.entries()) {
      if (l !== lane) continue;
      seen(`${key}${i}`, (x0 + x1) / 2);
      if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > base + LOW_Y && k.struck(round, cause)) return cost(round, c, `${key}${i}`, what, you.x);
    }
  }
  return false;
}

// The wake: its gap, the panic, the grade's steady die, and a catch at WAKE_CATCH.
function wake(round, c, ms, ev, k) {
  const dt = ms / 1000;
  c.gap = clamp(c.gap + (c.v - WAKE_V) * dt, 0, GAP_MAX);
  if (!c.panic && c.gap < PANIC_ON) {
    c.panic = true;
    c.panicked = true;
    if (round.bonusRound) round.bonusRound.perf.steady = false;
    ev("bogboatPanic");
  } else if (c.panic && c.gap >= PANIC_OFF) c.panic = false;
  for (const g of c.gas) if (g.state === "burst" && (g.t -= ms) <= 0) g.state = "spent";
  if (c.gap > WAKE_CATCH) return;
  c.gap = WAKE_FALLBACK;
  c.panic = false;
  c.catches++;
  face(round, c, `w${c.catches}`, true);
  ev("bogboatCatch");
  k.struck(round, "wake");
}

/* ------------------------------------------------------------- targets */

// A bolt into something to shoot: a charm, a gas pocket. True when one took it (the bolt is
// spent).
function bogboatShot(round, s) {
  const R = round.spec.ride;
  const c = mine(round);
  if (!R || R.runner !== "bogboat" || !c) return false;
  const hit = (x, y0, w, h) => Math.abs(s.x - x) <= w / 2 + SHOT_R && s.y >= y0 - SHOT_R && s.y <= y0 + h + SHOT_R;
  const score = (n) => {
    round.score += n;
    if (round.bonusRound) round.bonusRound.perf.acts++;
  };
  for (let i = 0; i < R.gas.length; i++) {
    const g = c.gas[i];
    const [x, lane] = R.gas[i];
    if (g.state !== "up" || !hit(x, LANE_Y[lane] + GAS_UP, GAS_W, GAS_H)) continue;
    Object.assign(g, { state: "burst", t: GAS_BURST_MS });
    c.gap = Math.min(GAP_MAX, c.gap + GAS_PUSH);
    score(GAS_POINTS);
    round.events.push({ type: "bogboatGas", x, y: LANE_Y[lane] + GAS_UP + GAS_H / 2, points: GAS_POINTS });
    return true;
  }
  for (let i = 0; i < R.props.length; i++) {
    const p = c.props[i];
    const [x, lane, kind] = R.props[i];
    if (p.state !== "up" || !hit(x, LANE_Y[lane] + PROP_UP, PROP_W, PROP_H)) continue;
    p.state = "broken";
    score(PROP_POINTS);
    round.events.push({ type: "bogboatProp", x, y: LANE_Y[lane] + PROP_UP + PROP_H / 2, kind, points: PROP_POINTS });
    return true;
  }
  return false;
}

export const BOGBOAT = freeze({
  id: "bogboat",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: bogboatShot,
});
