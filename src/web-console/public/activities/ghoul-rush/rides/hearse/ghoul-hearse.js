// Plan2Code Web Console - Ghoul Rush's Midnight Hearse, its rules: the Graveyard's bonus round. YOU hijack a runaway black hearse, horse-less and haunted, and tear along the cemetery road at night with the coffins rattling in the back: jump the open graves, headstones and fallen crosses, duck the low branches and the lychgate arch, shoot the grasping hands and the carrion crows, switch between the road and the grass verge at the lane gates, and keep the lamp lit. As a stage pack that ghoul.js plugs in.
//
// Modeled on the Coffin Sled (ghoul-sled.js: read its header first) and, like it, handed a
// kit `k` of ghoul.js's own helpers, so this file never imports ghoul.js. Pack fields used:
// `ride` (a hook that moves Planny himself, so no key walks him), `place` (Planny put
// down in a room: a room set up or a respawn) and `target` (a bolt strikes something that
// is no monster: the hands, the crows and the ghouls out of the coffins). It adds no
// monster, boss or hazard kind, so there is nothing to merge by name, and it draws NO
// random number. Its state is `round.runner` (the shared slot for a rolling bonus ride,
// with `id: "hearse"`; null in any other room) and the room's `ride.runner` is "hearse".
//
// THE ROOM (spec.ride, see ghoul-rooms.js): the ground is one flat road; there are two
// LANES, the road (lane 0, LANE_Y[0]) and the grass verge beside it (lane 1, LANE_Y[1],
// a raised bank), and every obstacle stands in one of them, [x, lane, ...]:
//
// - `graves` [x, lane]: an open grave, GRAVE_W wide (jump it, or fall in: cause "grave").
// - `stones` [x, lane, kind]: kind 0 a leaning headstone (STONE_W by STONE_H, cause "tomb"),
//   kind 1 a fallen cross (CROSS_W by CROSS_H, cause "cross"); jump.
// - `lows` [x0, x1, lane, kind]: a low branch (kind 0) or the lychgate arch (kind 1); its
//   underside is LOW_Y over the lane, so DUCK it (cause "branch").
// - `hands` [x, lane]: a hand grasping out of a grave mound; stirs when the hearse is
//   HAND_NEAR short, shivers HAND_WARN_MS, reaches HAND_UP_MS (HAND_W by HAND_H): jump it
//   or shoot it (HAND_HP bolts; cause "grasp").
// - `crows` [x, lane, h]: a carrion crow perched at x; when the hearse is CROW_NEAR short
//   it takes wing and flies back at the hearse at CROW_V, CROW_W by CROW_H, its underside
//   `h` over the lane (h over a ducked box, under a standing one): duck it, jump it, or
//   shoot it, one bolt (cause "crow"). Its x is where it perches: it meets the hearse
//   about CROW_NEAR * V / (V + CROW_V) short of that.
// - `blocks` [x0, x1, lane]: a stretch of the lane that is closed (a fallen oak across the
//   road, a hedge wall on the verge): the hearse cannot get through. Go round by the lane
//   gate before it, or smash in (cause "wreck", a heart) and be thrown into the other lane.
// - `gates` [x0, x1]: the lane gates; inside one, LEFT puts the hearse on the road and RIGHT
//   on the verge (SWITCH_MS to hop the curb). Nothing stands in a lane near a gate.
// - `lanterns` [x, lane]: a hanging lantern the hearse takes by passing it (not ducking is
//   no matter, a jump over it is: LANTERN_TOP) for LANTERN_GAIN of lamp.
// - `fog` [x0, x1]: a fog bank: the lamp burns faster in it and the art draws it thick.
// - `checks` (x positions of the checkpoints), `finish` (where the ride ends: the hearse
//   brakes and Planny walks out to the door) and `time` (the room's clock, ms).
//
// THE HEARSE (`round.runner`): { id, room, check, lane (where it is bound), from (the lane
// it left), swMs (switch time left), h (height over the lane), air, v, lamp, out, broken,
// coffins, lit, hands, crows, sitters, faced, done, restX }. It runs at HEARSE_V whatever
// is pressed; up jumps at JUMP_V against GRAVITY (about 13 high, 0.75 s, 31 across); down
// ducks; a switch cannot be made in the air and a jump or a duck cannot be made in one.
// A bolt flies level.
//
// THE LAMP: it starts at LAMP_MAX, burns down LAMP_DRAIN a second (and LAMP_FOG more in
// the fog), and each lantern gives LANTERN_GAIN. At nothing it goes OUT (`out`,
// `broken`): the night closes in (the art dims the room and the signs fade) until the
// next lantern. A lamp that never went out is the grade's `steady` die.
//
// THE COFFINS: five in the back (COFFINS). Each hit that costs a heart throws one out
// ahead: it lands SIT_AHEAD on in the lane the hearse is in, the lid pops and a ghoul
// sits up; shoot it for SIT_POINTS (it never hurts; it ducks back down as the hearse
// reaches it or after SIT_MS). A hearse with none left throws no more.
//
// A hit costs one of the round's five hearts (ghoul-bonus.js), not a life, and the
// hearse rolls on, Planny blinking safe BONUS_SAFE_MS; the last heart gone ends the round
// with nothing, at once. Causes: "grave", "tomb", "cross", "branch", "grasp", "crow",
// "wreck". The grade's `perf.total` is the obstacles the hearse FACED (passed in their
// lane; a lane switched away from is dodged and not counted), each id once in
// `perf.hits` if it ever cost a heart. Shooting a hand, a crow or a sitter counts for
// `perf.acts` (the goal is ACTS_GOAL, 8 of them) and the points below.
//
// Checkpoints are passed at their x (`hearseCheck`); a restart after the last heart goes
// back to the last one passed (that ends the round, as the sled's does).
//
// WHAT THE ART READS: `spec.ride` (above), `round.runner` { lane, from, swMs, h, air, lamp,
// out, fog, coffins, lit, done, restX, check, hands: [{ state "mound"|"warn"|"up"|"sink"|
// "broken"|"spent", t }], crows: [{ state "perch"|"fly"|"gone"|"broken", x }], sitters: [{
// x, ox, lane, state "fly"|"sit"|"hid"|"broken", t }] }, `round.you` (`state`, `vy`,
// `ducking`), the events in EVENTS.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "hearseJump", "hearseLand", "hearseDuck", "hearseSwitch", "hearseCrash", "hearseCheck", "hearseFinish",
  "hearseHandWarn", "hearseHandUp", "hearseHandHit", "hearseHandBreak", "hearseCrowWake", "hearseCrowHit",
  "hearseLantern", "hearseLampOut", "hearseLampLit", "hearseCoffin", "hearseSitUp", "hearseSitHit",
]);

// The hearse. Speeds are units across a second, GRAVITY units a second squared.
export const HEARSE_V = 42;
export const JUMP_V = 74;
export const GRAVITY = 200;
export const BIG_LAND = 9;
export const LANE_Y = freeze([9, 15]);
export const SWITCH_MS = 360;
export const SWITCH_HOP = 1.6;
export const CAM_AHEAD = 12;
// Obstacles.
export const GRAVE_W = 10;
export const GRAVE_DEEP = 1.2;
export const STONE_W = 2.6;
export const STONE_H = 4.4;
export const CROSS_W = 5.4;
export const CROSS_H = 1.8;
export const LOW_Y = 3.0;
export const HAND_W = 2.6;
export const HAND_H = 3.6;
export const HAND_HP = 2;
export const HAND_NEAR = 34;
export const HAND_WARN_MS = 450;
export const HAND_UP_MS = 1600;
export const HAND_SINK_MS = 300;
export const CROW_W = 2.2;
export const CROW_H = 1.6;
export const CROW_NEAR = 56;
export const CROW_V = 18;
// Points for what is shot.
export const HAND_POINTS = 100;
export const CROW_POINTS = 80;
export const SIT_POINTS = 150;
export const LANTERN_POINTS = 25;
const SHOT_R = 0.5;
// The lamp.
export const LAMP_MAX = 100;
export const LAMP_DRAIN = 2.2;
export const LAMP_FOG = 2;
export const LANTERN_GAIN = 22;
export const LANTERN_R = 2.2;
export const LANTERN_TOP = 7;
// The coffins in the back, and the ghoul out of each.
export const COFFINS = 5;
export const FLY_MS = 600;
export const SIT_AHEAD = 56;
export const SIT_MS = 3000;
export const SIT_RISE_MS = 250;
export const SIT_W = 2.8;
export const SIT_H = 4.4;
// The shots at things (hands, crows, sitters) worth a die.
export const ACTS_GOAL = 8;

const mine = (round) => (round.runner && round.runner.id === "hearse" ? round.runner : null);
const duckH = (k, you) => (you.ducking ? k.DUCK_H : k.HIT_H);
const boxHit = (k, you, x, y0, w, h) => Math.abs(you.x - x) < (k.HIT_W + w) / 2 && you.y < y0 + h && you.y + duckH(k, you) > y0;
const smooth = (p) => p * p * (3 - 2 * p);

// The lane the hearse counts as being in: the one it left until half way through a switch.
export const laneNow = (c) => (c.swMs > 0 && 1 - c.swMs / SWITCH_MS < 0.5 ? c.from : c.lane);
// The height of the road under the hearse (its lane's, eased across a switch, with a little hop).
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

// A fresh set of the room's things, each hand in its mound and each crow perched. What was
// shot stays shot, and a lantern taken stays taken (`old`, the hearse of an earlier try in
// the same room).
function things(R, old) {
  const was = (list, i, state) => (old && old[list] && old[list][i] && old[list][i].state === state ? state : null);
  return {
    hands: R.hands.map((h, i) => ({ state: was("hands", i, "broken") || "mound", t: 0, hp: HAND_HP })),
    crows: R.crows.map(([x], i) => ({ state: was("crows", i, "broken") || "perch", x })),
    lit: R.lanterns.map((l, i) => Boolean(old && old.lit[i])),
  };
}

// Planny put down in the room: at the wheel at the start of a ride, or at the last
// checkpoint passed after the last heart (the same room).
function place(round, k) {
  const R = round.spec.ride;
  // (The Cart's `place` runs first, leaves a ride with a `runner` alone and has already zeroed `round.camLead`.)
  if (!R || R.runner !== "hearse") {
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
    id: "hearse", room: round.room, check, lane: 0, from: 0, swMs: 0, h: 0, air: false, peak: 0, v: HEARSE_V,
    lamp: again ? old.lamp : LAMP_MAX, out: false, broken: again ? old.broken : false, fog: false, coffins: again ? old.coffins : COFFINS,
    sitters: [], faced: again ? old.faced : {}, wasDown: false, done: false, restX: 0, ...things(R, again ? old : null),
  };
  round.camLead = CAM_AHEAD;
  const b = round.bonusRound;
  if (b) {
    b.perf.goal = ACTS_GOAL;
    if (!again) b.perf.total = 0;
  }
  if (b && round.runner.broken) b.perf.steady = false;
}

/* ------------------------------------------------------------ the ride */

// The hearse's motion for one slice. Returns true once it has moved Planny (every slice of
// a ride); false outside a ride and once he has stepped out.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = mine(round);
  if (!R || R.runner !== "hearse" || !c || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const dt = ms / 1000;
  const ev = (type, extra = {}) => round.events.push({ type, x: you.x, y: you.y, ...extra });
  if (you.x >= R.finish) return finish(round, c, R, k);
  you.x += HEARSE_V * dt;
  // The lane gates: LEFT is the road, RIGHT the verge.
  const want = inp.left && !inp.right ? 0 : inp.right && !inp.left ? 1 : -1;
  const gate = R.gates.some(([a, b]) => you.x >= a && you.x <= b);
  if (gate && !c.air && c.swMs <= 0 && want >= 0 && want !== c.lane) startSwitch(c, want, ev, you);
  if (c.swMs > 0) {
    c.swMs = Math.max(0, c.swMs - ms);
    you.ducking = false;
    you.state = "run";
    you.vy = 0;
  } else {
    // On the road: jump, duck, or in the air.
    const jump = inp.jump > 0;
    if (!c.air && jump) {
      inp.jump = 0;
      c.air = true;
      c.h = 0.001;
      c.vy = JUMP_V;
      c.peak = 0;
      you.ducking = false;
      ev("hearseJump");
    } else if (!c.air) {
      const duck = Boolean(inp.down);
      if (duck && !you.ducking) ev("hearseDuck");
      you.ducking = duck;
    }
    if (c.air) {
      c.vy -= GRAVITY * dt;
      c.h += c.vy * dt;
      c.peak = Math.max(c.peak, c.h);
      you.ducking = false;
      if (c.h <= 0) {
        ev("hearseLand", { big: c.peak >= BIG_LAND });
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
    ev("hearseCheck", { n: c.check + 1 });
  }
  round.camLead = CAM_AHEAD;
  lamp(round, c, R, ms, ev);
  if (obstacles(round, c, R, k)) return true;
  creatures(round, c, R, ms);
  return true;
}

function startSwitch(c, to, ev, you) {
  Object.assign(c, { from: c.lane, lane: to, swMs: SWITCH_MS, air: false, h: 0, vy: 0 });
  ev("hearseSwitch", { to, y: LANE_Y[to], x: you.x });
}

// The ride is over: the hearse brakes at the finish, the door opens, Planny walks out.
function finish(round, c, R, k) {
  const you = round.you;
  c.done = true;
  c.restX = you.x;
  Object.assign(c, { air: false, h: 0, vy: 0, swMs: 0 });
  Object.assign(you, { y: k.groundAt(round.spec, you.x), vy: 0, state: "run", shelf: -1, ducking: false });
  round.hasKey = true;
  round.camLead = 0;
  round.events.push({ type: "hearseFinish", x: you.x, y: you.y });
  return false;
}

// The lamp burns down (faster in the fog), a lantern passed gives it back, and one that
// goes out leaves the night closed in until the next.
function lamp(round, c, R, ms, ev) {
  const you = round.you;
  const dt = ms / 1000;
  const b = round.bonusRound;
  c.fog = R.fog.some(([a, z]) => you.x >= a && you.x <= z);
  c.lamp = Math.max(0, c.lamp - (LAMP_DRAIN + (c.fog ? LAMP_FOG : 0)) * dt);
  if (c.lamp <= 0 && !c.out) {
    c.out = true;
    c.broken = true;
    if (b) b.perf.steady = false;
    ev("hearseLampOut");
  }
  const lane = laneNow(c);
  R.lanterns.forEach(([x, l], i) => {
    if (c.lit[i] || l !== lane || Math.abs(you.x - x) > LANTERN_R || you.y > LANE_Y[l] + LANTERN_TOP) return;
    c.lit[i] = true;
    c.lamp = Math.min(LAMP_MAX, c.lamp + LANTERN_GAIN);
    round.score += LANTERN_POINTS;
    ev("hearseLantern", { x, y: LANE_Y[l] + 3.4, points: LANTERN_POINTS });
    if (c.out) {
      c.out = false;
      ev("hearseLampLit");
    }
  });
}

// A heart lost on obstacle `id`: it was faced and cost, a coffin flies out ahead, and the
// crash is an event. Returns true.
function cost(round, c, id, what, x) {
  face(round, c, id, true);
  round.events.push({ type: "hearseCrash", what, x, y: round.you.y });
  if (c.coffins > 0) {
    c.coffins--;
    const lane = laneNow(c);
    const tx = round.you.x + SIT_AHEAD;
    c.sitters.push({ x: tx, ox: round.you.x, lane, state: "fly", t: FLY_MS });
    round.events.push({ type: "hearseCoffin", x: round.you.x - 4, y: round.you.y + 3, tx, lane, left: c.coffins });
  }
  return true;
}

// What the hearse runs into: a grave, a headstone or a cross, a low branch or the arch, a
// hand, a crow, a closed stretch. Returns whether it cost a heart. (Nothing counts while it
// hops between lanes: the lanes' gates keep their neighborhood clear.)
function obstacles(round, c, R, k) {
  const you = round.you;
  if (c.swMs > 0) return false;
  const lane = c.lane;
  const base = LANE_Y[lane];
  const hh = duckH(k, you);
  const seen = (id, x) => {
    if (you.x >= x && !c.faced[id]) face(round, c, id);
  };
  for (const [i, [x, l]] of R.graves.entries()) {
    if (l !== lane) continue;
    seen(`g${i}`, x);
    if (Math.abs(you.x - x) < GRAVE_W / 2 - 1 && you.y < base + GRAVE_DEEP && k.struck(round, "grave")) return cost(round, c, `g${i}`, "grave", x);
  }
  for (const [i, [x, l, kind]] of R.stones.entries()) {
    if (l !== lane) continue;
    seen(`s${i}`, x);
    if (Math.abs(you.x - x) > 6) continue;
    if (boxHit(k, you, x, base, kind ? CROSS_W : STONE_W, kind ? CROSS_H : STONE_H) && k.struck(round, kind ? "cross" : "tomb")) return cost(round, c, `s${i}`, kind ? "cross" : "stone", x);
  }
  for (const [i, [x0, x1, l]] of R.lows.entries()) {
    if (l !== lane) continue;
    seen(`l${i}`, (x0 + x1) / 2);
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2 && you.y + hh > base + LOW_Y && k.struck(round, "branch")) return cost(round, c, `l${i}`, "low", you.x);
  }
  for (const [i, [x, l]] of R.hands.entries()) {
    const h = c.hands[i];
    if (l !== lane) continue;
    seen(`h${i}`, x);
    if (h.state !== "up" || Math.abs(you.x - x) > 5) continue;
    if (boxHit(k, you, x, base, HAND_W, HAND_H) && k.struck(round, "grasp")) {
      Object.assign(h, { state: "sink", t: HAND_SINK_MS });
      return cost(round, c, `h${i}`, "hand", x);
    }
  }
  for (const [i, [, l, up]] of R.crows.entries()) {
    const w = c.crows[i];
    if (l !== lane || w.state !== "fly") continue;
    seen(`c${i}`, w.x);
    if (boxHit(k, you, w.x, base + up, CROW_W, CROW_H) && k.struck(round, "crow")) {
      w.state = "gone";
      return cost(round, c, `c${i}`, "crow", w.x);
    }
  }
  for (const [i, [x0, x1, l]] of R.blocks.entries()) {
    if (l !== lane) continue;
    face(round, c, `b${i}`);
    if (you.x > x0 - k.HIT_W / 2 && you.x < x1 + k.HIT_W / 2) {
      // Thrown across into the other lane, a heart lighter (unless safe a moment).
      const hit = k.struck(round, "wreck");
      startSwitch(c, 1 - lane, (type, extra) => round.events.push({ type, x: you.x, y: you.y, ...extra }), you);
      if (hit) return cost(round, c, `b${i}`, "wreck", you.x);
      return false;
    }
  }
  return false;
}

// The hands in their mounds, the crows on their perches and the ghouls out of the coffins wake
// as the hearse comes near.
function creatures(round, c, R, ms) {
  const you = round.you;
  const dt = ms / 1000;
  R.hands.forEach(([x, lane], i) => {
    const h = c.hands[i];
    const y = LANE_Y[lane];
    if (h.state === "mound") {
      const ahead = x - you.x;
      if (ahead < HAND_NEAR && ahead > -HAND_W) {
        Object.assign(h, { state: "warn", t: HAND_WARN_MS });
        round.events.push({ type: "hearseHandWarn", x, y });
      }
    } else if (h.state === "warn" || h.state === "up" || h.state === "sink") {
      h.t -= ms;
      if (h.t > 0) return;
      if (h.state === "warn") {
        Object.assign(h, { state: "up", t: HAND_UP_MS });
        round.events.push({ type: "hearseHandUp", x, y });
      } else if (h.state === "up") Object.assign(h, { state: "sink", t: HAND_SINK_MS });
      else Object.assign(h, { state: "spent", t: 0 });
    }
  });
  R.crows.forEach(([x, lane, up], i) => {
    const w = c.crows[i];
    if (w.state === "perch") {
      if (x - you.x < CROW_NEAR && x - you.x > -CROW_W) {
        w.state = "fly";
        round.events.push({ type: "hearseCrowWake", x, y: LANE_Y[lane] + up });
      }
    } else if (w.state === "fly") {
      w.x -= CROW_V * dt;
      if (w.x < you.x - 16) w.state = "gone";
    }
  });
  for (const s of c.sitters) {
    if (s.state === "fly") {
      s.t -= ms;
      if (s.t <= 0) {
        Object.assign(s, { state: "sit", t: SIT_MS });
        round.events.push({ type: "hearseSitUp", x: s.x, y: LANE_Y[s.lane] });
      }
    } else if (s.state === "sit") {
      s.t -= ms;
      if (s.t <= 0 || you.x > s.x - 3) s.state = "hid";
    }
  }
}

/* ------------------------------------------------------------- targets */

// A bolt into something to shoot: a hand reaching out, a crow, a ghoul sat up out of a
// coffin. True when one took it (the bolt is spent).
function hearseShot(round, s) {
  const R = round.spec.ride;
  const c = mine(round);
  if (!R || R.runner !== "hearse" || !c) return false;
  const hit = (x, y0, w, h) => Math.abs(s.x - x) <= w / 2 + SHOT_R && s.y >= y0 - SHOT_R && s.y <= y0 + h + SHOT_R;
  const score = (n) => {
    round.score += n;
    if (round.bonusRound) round.bonusRound.perf.acts++;
  };
  for (let i = 0; i < R.hands.length; i++) {
    const h = c.hands[i];
    const [x, lane] = R.hands[i];
    const y = LANE_Y[lane];
    if (h.state !== "up" || !hit(x, y, HAND_W, HAND_H)) continue;
    h.hp--;
    if (h.hp > 0) round.events.push({ type: "hearseHandHit", x, y: y + HAND_H / 2 });
    else {
      Object.assign(h, { state: "broken", t: 0 });
      score(HAND_POINTS);
      round.events.push({ type: "hearseHandBreak", x, y: y + HAND_H / 2, points: HAND_POINTS });
    }
    return true;
  }
  for (let i = 0; i < R.crows.length; i++) {
    const w = c.crows[i];
    const [, lane, up] = R.crows[i];
    if ((w.state !== "fly" && w.state !== "perch") || !hit(w.x, LANE_Y[lane] + up, CROW_W, CROW_H)) continue;
    w.state = "broken";
    score(CROW_POINTS);
    round.events.push({ type: "hearseCrowHit", x: w.x, y: LANE_Y[lane] + up + CROW_H / 2, points: CROW_POINTS });
    return true;
  }
  for (const p of c.sitters) {
    if (p.state !== "sit" || SIT_MS - p.t < SIT_RISE_MS || !hit(p.x, LANE_Y[p.lane], SIT_W, SIT_H)) continue;
    p.state = "broken";
    score(SIT_POINTS);
    round.events.push({ type: "hearseSitHit", x: p.x, y: LANE_Y[p.lane] + SIT_H / 2, points: SIT_POINTS });
    return true;
  }
  return false;
}

export const HEARSE = freeze({
  id: "hearse",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
  target: hearseShot,
});

