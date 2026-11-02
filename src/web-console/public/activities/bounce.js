// Plan2Code Web Console - Bounce Road, the eleventh activity: the cars' driving, jumps, landings and bumps, the hazards on the road, the scoring (the bounce chain and the combo), the round and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys (and their releases) and pauses it. A game never
// runs a timer or listens for a key of its own, so a paused game cannot move.
// The rules are plain functions over a round object (newRound, advance,
// move, jump, land, collide, lose, applyPower, and the road's and rivals'
// own from bounce-road.js and bounce-rivals.js, all exported again here) so
// the unit suite can drive them without a canvas; the stage data lives in
// bounce-roads.js, the drawing in bounce-draw.js and bounce-scenery.js, and
// the default export is the contract every listed game answers.
//
// Planny's springy toy car races up a road laid across a giant's house and
// yard, seen from above, the road scrolling down the board. Up drives, down
// brakes, the arrows steer and space jumps. Rival toy cars share the road
// and mean to stop you: bump one past the road's edge and it is out, land
// on one and it is flattened while you bounce up again, and land on another
// before your wheels touch the road to step the bounce chain. Every stunt
// in quick succession steps the combo, which multiplies the points. The
// road cracks, crosses rivers on broken bridges, drawbridges and swaying
// ones, crumbles behind you, and carries boost strips, ramps, slicks,
// barriers, trains, balls, sprinklers, gusts and things that fall: water or
// a hole under your wheels, a crash or a squash costs one of three lives.
// Each stage ends at a line across the road (the tenth with the Monster
// truck to beat on the way), and the memo keeps the furthest stage reached.

import {
  CAR_L, CAR_W, CRUMBLE_DELAY, CRUMBLE_SPEED, DROP_FALL_MS, DROP_TRIGGER, FIELD_H, FIELD_W, GROUND, JUMP_MIN, LONGEST_JUMP, MAX_HOLE, MAX_SPEED, NITRO_TOP, RAMP_AIR, ROW, SLICE_MS, SPRAY, SPRING_AIR, STAGES, TOP_SPEED,
  airMs, ballX, ensureRoad, firstAt, groundAt, gustAt, holesIn, newRoad, rowIn, rowOf, safeSpot, sprayAt, stageFor, stageName, trainAt,
} from "./bounce-road.js";
import { BOSS_HP, DROP_AHEAD, DROP_BEHIND, HEAVY, RIVALS, RIVAL_ACCEL, RIVAL_KINDS, RIVAL_MIN_SPEED, RIVAL_STEER, makeCar, pickKind, spawnRival, think } from "./bounce-rivals.js";
import { DANGER, GOLD, drawScene, readColors, stageColor } from "./bounce-draw.js";

export * from "./bounce-road.js";
export * from "./bounce-rivals.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The board: the strip of pills along the top, then the field with the
// stage bar beside it. The canvas scales a unit in quarter-pixel steps.
// The strip is one row of pills tall (the draw file's hudLayout shrinks the
// pills to keep them in one row), and the field runs to the canvas's edges
// with no frame, so the play gets the room.
export const HUD_H = 4.5;
export const PAD = 0;
// The gap between the field and the bar beside it.
export const GAP = 1;
export const BAR_W = 6;
export const W = PAD * 2 + FIELD_W + GAP + BAR_W;
export const H = HUD_H + FIELD_H + PAD;

// Below this many pixels a unit, a car is too small to steer by eye; the
// window shows its bigger-window note.
export const MIN_CELL = 3;

// Planny sits CAM_AT of the way down the field, so the road ahead of him is
// that share of it.
export const CAM_AT = 0.8;
export const AHEAD = FIELD_H * CAM_AT;
export const BEHIND = FIELD_H - AHEAD;

// Driving, in units and seconds. Throttle adds ACCEL up to TOP_SPEED; with
// neither key the car coasts down at COAST, and the brake takes BRAKE off,
// both no lower than ROLL_SPEED: a toy car always rolls. Over the top speed
// (the verge's, or a Nitro spent) it slows at OVER_DRAG. Steering eases the
// sideways drift toward STEER_SPEED at STEER_EASE a second; a knock (the
// push of a bump) eases off at KNOCK_EASE. On the verge the top speed is
// VERGE_TOP of it. On a slick the steering eases at SLICK_EASE, the pull is
// SLICK_PULL of its own and a knock lasts longer, for SLICK_MS after.
export const ACCEL = 44;
export const BRAKE = 80;
export const COAST = 10;
export const ROLL_SPEED = 16;
const OVER_DRAG = 60;
export const STEER_SPEED = 48;
const STEER_EASE = 22;
export const KNOCK_EASE = 5;
export const VERGE_TOP = 0.5;
export const SLICK_MS = 650;
const SLICK_EASE = 2.4;
const SLICK_PULL = 0.35;

// In the air the steering does only AIR_STEER of its usual. A press up to
// JUMP_BUFFER_MS before you land jumps as you land. A landing on a car
// rebounds for REBOUND_MS.
export const AIR_STEER = 0.7;
export const JUMP_BUFFER_MS = 120;
export const REBOUND_MS = 520;
// How fast the sideways drift eases toward the steering in the air, a second.
const AIR_EASE = 10;

// A Nitro lifts the top speed by NITRO_TOP and the pull by NITRO_ACCEL for
// NITRO_MS; a boost strip does the same for BOOST_MS, pulling even with no
// throttle. Mega wheels make you MEGA_SIZE bigger for MEGA_MS, heavy, and
// flatten any rival you touch.
export const NITRO_MS = 3000;
const NITRO_ACCEL = 2;
export const BOOST_MS = 1100;
export const MEGA_MS = 5000;
export const MEGA_SIZE = 1.4;
const MEGA_MASS = 3;

// Bumps. Side on, each car takes a knock of SIDE_KICK, plus SIDE_BOUNCE of
// the speed they closed at, split by mass, the one that steered in taking
// RAM_BACK of its share and the other RAM_HIT of its. End on, the car behind
// loses speed to the one in front with END_BOUNCE; into a heavy truck's
// back faster than CRASH_CLOSE is a crash.
export const SIDE_KICK = 14;
const SIDE_BOUNCE = 0.4;
const RAM_BACK = 0.5;
const RAM_HIT = 1.3;
const END_BOUNCE = 0.3;
export const CRASH_CLOSE = 22;
// A rival knocked out within CREDIT_MS of your touch (or of a touch from a
// rival you had just knocked) is yours.
export const CREDIT_MS = 1500;
// Passing a rival with no more than NEAR_GAP between the boxes, at
// NEAR_SPEED or more, is a close shave.
export const NEAR_GAP = 1.6;
const NEAR_SPEED = 34;

// Hazards. A ball knocks a car sideways by BALL_KICK and you down to
// BALL_SLOW of your speed; a sprinkler's jet, SPRAY_HALF either side of
// its line, pushes at SPRAY_PUSH a second; a gust at WIND_PUSH (a rival
// feels RIVAL_WIND of it); a cone or a tire slows you to CONE_SLOW. The
// Monster's landing shakes the road QUAKE_R round it, knocking cars by
// QUAKE_KICK.
const BALL_KICK = 34;
const BALL_SLOW = 0.72;
const SPRAY_HALF = 1.4;
const SPRAY_PUSH = 95;
export const WIND_PUSH = 70;
const RIVAL_WIND = 0.4;
const CONE_SLOW = 0.62;
const QUAKE_R = 16;
const QUAKE_KICK = 26;

// A life lost holds CRASH_MS while the car sinks, falls or spins, then puts
// you back before the spot (on plain road) for a hold of READY_MS, driving
// through the traffic for GHOST_MS.
export const CRASH_MS = 1100;
export const READY_MS = 1100;
// A banner fades to BANNER_SEE_THROUGH over BANNER_FADE_MS while something
// that matters to you is under it.
export const BANNER_SEE_THROUGH = 0.12;
const BANNER_FADE_MS = 140;
export const GHOST_MS = 1600;
export const START_LIVES = 3;
export const MAX_LIVES = 5;
// A knocked out car stays on the board for OUT_MS while it tips, sinks or
// lies flat.
export const OUT_MS = 800;

// Points: DIST_POINTS for every DIST_STEP units of new road, BUMP_POINTS for
// a rival bumped off, a rival's own points for flattening it and HAUL_POINTS
// a truck's roof (both times the chain, up to MAX_CHAIN), HOLE_POINTS for
// each hole jumped, OVER_POINTS for each train, ball or barrier jumped,
// AIR_POINTS for a ramp's jump landed, NEAR_POINTS for a close shave,
// BOOST_POINTS a boost strip, STAR_POINTS a star; STOMP_POINTS a landing on
// the Monster (times the chain) and BOSS_POINTS for beating it (times the
// lap). Each of those but the stars and the distance is a stunt: a stunt
// within STREAK_MS of the last steps the combo, and every COMBO_STEP stunts
// in a row multiply the points one more, up to MAX_COMBO (stars count it
// too). A stage line scores STAGE_POINTS times the stage, TIME_POINTS for
// each second under the stage's par, and FLAWLESS_POINTS and a life back
// with no life lost.
export const DIST_POINTS = 1;
export const DIST_STEP = 10;
export const BUMP_POINTS = 60;
export const HAUL_POINTS = 50;
export const HOLE_POINTS = 25;
export const OVER_POINTS = 40;
export const AIR_POINTS = 60;
export const NEAR_POINTS = 30;
export const BOOST_POINTS = 10;
export const STAR_POINTS = 10;
export const STOMP_POINTS = 250;
export const BOSS_POINTS = 2000;
export const STAGE_POINTS = 100;
export const TIME_POINTS = 15;
export const FLAWLESS_POINTS = 250;
export const MAX_CHAIN = 8;
export const STREAK_MS = 2600;
export const COMBO_STEP = 3;
export const MAX_COMBO = 4;
export const comboOf = (streak) => Math.min(MAX_COMBO, 1 + Math.floor(streak / COMBO_STEP));

// Rivals come one every SPAWN_MS at most while fewer than the stage's count
// are on the road. The Monster comes BOSS_AT of the way into its stage.
const SPAWN_MS = 650;
const BOSS_AT = 0.18;
export const ITEM_R = 1.8;
export const STAR_R = 1.4;

/* ------------------------------------------------------------ powers */

// The power-ups lying on the road.
export const POWERS = Object.freeze({
  spring: Object.freeze({ name: "Spring", blurb: "Your next jump goes higher and further", color: "#ffd84a" }),
  bubble: Object.freeze({ name: "Bubble", blurb: "One free save from water, a hole, a crash or a squash", color: "#7fd8ff" }),
  nitro: Object.freeze({ name: "Nitro", blurb: "A burst of speed", color: "#ff7a2f" }),
  mega: Object.freeze({ name: "Mega wheels", blurb: "Bigger and heavier: flatten whatever you touch", color: "#7ad151" }),
});

export function applyPower(round, kind) {
  const you = round.cars[0];
  if (kind === "spring") you.spring = true;
  else if (kind === "bubble") you.bubble = true;
  else if (kind === "nitro") you.nitroMs = NITRO_MS;
  else if (kind === "mega") {
    you.megaMs = MEGA_MS;
    sizeYou(you);
  }
}

// Your box: bigger and heavier while Mega wheels last.
function sizeYou(you) {
  const k = you.megaMs > 0 ? MEGA_SIZE : 1;
  you.w = CAR_W * k;
  you.l = CAR_L * k;
  you.mass = you.megaMs > 0 ? MEGA_MASS : 1;
}

// Height in the air, 0 to 1 and back, for the drawing.
export const heightOf = (car) => (car.air > 0 && car.airMax > 0 ? Math.sin(Math.PI * (1 - car.air / car.airMax)) : 0);

/* ------------------------------------------------------------ driving */

// One slice of a car's driving. You follow round.input, a rival what think()
// chose; in the air the speed holds and the line can only be nudged, and the
// slice the air runs out the car lands.
export function move(round, car, ms) {
  const dt = ms / 1000;
  const you = car.id === 0;
  car.pnose = car.d + car.l / 2;
  const slick = car.slickMs > 0;
  car.kx *= Math.exp(-(slick ? KNOCK_EASE * 0.35 : KNOCK_EASE) * dt);
  if (car.slickMs > 0) car.slickMs = Math.max(0, car.slickMs - ms);
  if (car.bonkMs > 0) car.bonkMs = Math.max(0, car.bonkMs - ms);
  if (car.out > 0) {
    car.v = Math.max(0, car.v - 60 * dt);
    car.x += car.kx * dt;
    car.d += car.v * dt;
    return;
  }
  const flying = car.air > 0;
  if (you) {
    const inp = round.input;
    const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (flying) {
      const target = car.rescueX !== null ? clamp((car.rescueX - car.x) * 4, -STEER_SPEED, STEER_SPEED) : steer * STEER_SPEED * AIR_STEER;
      car.vx += (target - car.vx) * Math.min(1, AIR_EASE * dt);
    } else {
      const verge = groundAt(round.road, car.x, car.d, round.clock) === GROUND.verge;
      // The brake beats a boost strip: braking cuts the boost, so a strip
      // before a train or a drawbridge never forces you on.
      if (inp.down) car.boostMs = 0;
      const fast = car.nitroMs > 0 || car.boostMs > 0;
      const top = TOP_SPEED * (fast ? NITRO_TOP : 1) * (verge ? VERGE_TOP : 1);
      const pull = ACCEL * (fast ? NITRO_ACCEL : 1) * (slick ? SLICK_PULL : 1);
      if (inp.up || car.boostMs > 0) car.v = car.v < top ? Math.min(top, car.v + pull * dt) : car.v;
      else if (inp.down) car.v = Math.max(ROLL_SPEED, car.v - BRAKE * dt);
      else if (car.v > ROLL_SPEED) car.v = Math.max(ROLL_SPEED, car.v - COAST * dt);
      if (car.v < ROLL_SPEED) car.v = Math.min(ROLL_SPEED, car.v + ACCEL * dt);
      if (car.v > top) car.v = Math.max(top, car.v - OVER_DRAG * dt);
      car.vx += (steer * STEER_SPEED - car.vx) * Math.min(1, (slick ? SLICK_EASE : STEER_EASE) * dt);
    }
    if (car.nitroMs > 0) car.nitroMs = Math.max(0, car.nitroMs - ms);
    if (car.boostMs > 0) car.boostMs = Math.max(0, car.boostMs - ms);
    if (car.megaMs > 0) {
      car.megaMs = Math.max(0, car.megaMs - ms);
      if (!car.megaMs) sizeYou(car);
    }
  } else if (flying) {
    car.vx *= Math.exp(-6 * dt);
    // A Frog or the Monster leans toward you in the air, never past the
    // road's edge (think() keeps its spot on the road).
    if (car.kind === "frog" || car.kind === "monster") car.vx = clamp((car.tx - car.x) * 0.9, -10, 10);
  } else {
    car.v += clamp(car.tv - car.v, -RIVAL_ACCEL * dt, RIVAL_ACCEL * dt);
    car.v = Math.max(RIVAL_MIN_SPEED, car.v);
    car.vx = clamp((car.tx - car.x) * car.gain, -RIVAL_STEER, RIVAL_STEER);
  }
  car.v = Math.min(MAX_SPEED, car.v);
  car.x = clamp(car.x + (car.vx + car.kx) * dt, car.w / 2, FIELD_W - car.w / 2);
  car.d += car.v * dt;
  if (car.ghostMs > 0) car.ghostMs = Math.max(0, car.ghostMs - ms);
  if (car.credit > 0) car.credit = Math.max(0, car.credit - ms);
  if (flying) {
    car.air -= ms;
    if (car.air <= 0) land(round, car);
  }
}

// Leaves the ground, if the car is on it and quick enough. `scale` lengthens
// the airtime (a Spring, a ramp).
export function jump(round, car, scale = 1) {
  if (car.air > 0 || car.out > 0 || car.v < JUMP_MIN) return false;
  car.air = car.airMax = airMs(car.v) * scale;
  car.jumpFrom = car.d;
  car.jumps++;
  car.rescueX = null;
  return true;
}

// The car another one lands on: on the ground (or landing in this same
// slice, for you, so a dead heat goes to you), not out, not a ghost, and
// under the lander's middle.
function carBelow(round, car) {
  let best = null;
  let gap = Infinity;
  for (const o of round.cars) {
    if (o === car || o.out > 0) continue;
    if (o.air > (car.id === 0 ? SLICE_MS : 0)) continue;
    if (o.id === 0 && o.ghostMs > 0) continue;
    const dx = Math.abs(o.x - car.x);
    const dd = Math.abs(o.d - car.d);
    const reachX = o.w / 2 + (car.kind === "monster" ? car.w / 2 : 1);
    const reachD = o.l / 2 + (car.kind === "monster" ? car.l / 2 : 1.5);
    if (dx < reachX && dd < reachD && dx + dd < gap) {
      gap = dx + dd;
      best = o;
    }
  }
  return best;
}

// A stunt worth `points`: times the combo, and the combo steps on.
export function stunt(round, points) {
  const got = points * comboOf(round.streak);
  round.score += got;
  round.streak++;
  round.streakMs = STREAK_MS;
  round.bestCombo = Math.max(round.bestCombo, comboOf(round.streak));
  return got;
}

const award = (round, points) => {
  round.score += points;
};

// A landing. On a car: it is flattened (a truck only rolls on, the Monster
// loses a life of its own) and the lander rebounds; when that is you, the
// chain steps up. On the road: your chain ends, and the holes and hazards
// you flew over score, and a ramp's jump too. Water or a hole under the
// wheels is settled by the slice's ground check, after the bumps.
export function land(round, car) {
  car.air = 0;
  const you = car.id === 0;
  const under = carBelow(round, car);
  if (under) {
    car.air = car.airMax = REBOUND_MS * (under.kind === "monster" ? 1.3 : 1);
    if (under.id === 0) {
      lose(round, "squash");
      return "squash";
    }
    const pts = RIVALS[under.kind].points;
    if (!you) {
      if (pts) knockOut(round, under, "flat");
      return "crush";
    }
    round.chain = Math.min(MAX_CHAIN, round.chain + 1);
    round.bestChain = Math.max(round.bestChain, round.chain);
    if (under.kind === "monster") return stomp(round, under);
    if (!pts) {
      const points = stunt(round, HAUL_POINTS * round.chain);
      round.stats.hauls++;
      round.events.push({ type: "haul", x: under.x, d: under.d, kind: under.kind, id: under.id, chain: round.chain, points });
      return "haul";
    }
    knockOut(round, under, "flat", true);
    const points = stunt(round, pts * round.chain);
    round.stats.crushed++;
    round.events.push({ type: "crush", x: under.x, d: under.d, kind: under.kind, id: under.id, chain: round.chain, points });
    return "crush";
  }
  car.rescueX = null;
  if (!you) {
    if (car.kind === "monster") quake(round, car);
    return "road";
  }
  const g = groundAt(round.road, car.x, car.d, round.clock);
  const clean = g !== GROUND.water && g !== GROUND.hole;
  let holes = 0;
  if (clean) {
    for (const h of holesIn(round.road, car.jumpFrom, car.d)) {
      if (h.d1 <= round.clearedTo) continue;
      holes++;
      round.clearedTo = h.d1;
    }
  }
  const overs = clean ? car.overs.map((o) => o.kind) : [];
  const big = clean && car.ramped;
  let points = 0;
  if (holes) {
    points += stunt(round, holes * HOLE_POINTS);
    round.stats.holes += holes;
  }
  if (overs.length) {
    points += stunt(round, overs.length * OVER_POINTS);
    round.stats.overs += overs.length;
  }
  if (big) points += stunt(round, AIR_POINTS);
  round.events.push({ type: "land", x: car.x, d: car.d, chain: round.chain, holes, overs, big, points });
  car.overs.length = 0;
  car.ramped = false;
  round.chain = 0;
  return "road";
}

// A landing on the Monster: it loses one of BOSS_HP and slows a moment, and
// the last one flattens it for BOSS_POINTS times the lap and a life back.
function stomp(round, m) {
  m.hp--;
  m.stunMs = 1300;
  const points = stunt(round, STOMP_POINTS * round.chain);
  round.events.push({ type: "stomp", x: m.x, d: m.d, id: m.id, hp: m.hp, chain: round.chain, points });
  if (m.hp > 0) return "stomp";
  knockOut(round, m, "flat", true);
  const lap = stageFor(round.stage).lap || 1;
  const bonus = stunt(round, BOSS_POINTS * lap);
  const life = round.lives < MAX_LIVES;
  if (life) round.lives++;
  round.stats.bosses++;
  round.events.push({ type: "boss", x: m.x, d: m.d, points: bonus, life });
  return "boss";
}

// The Monster coming down: every car on the ground near it is knocked away.
function quake(round, m) {
  round.events.push({ type: "quake", x: m.x, d: m.d, near: Math.abs(round.cars[0].d - m.d) < 60 });
  for (const o of round.cars) {
    if (o === m || o.out > 0 || o.air > 0) continue;
    const dx = o.x - m.x;
    const dd = o.d - m.d;
    if (Math.abs(dd) > QUAKE_R || Math.abs(dx) > QUAKE_R) continue;
    o.kx += ((dx >= 0 ? 1 : -1) * QUAKE_KICK) / o.mass;
  }
}

/* -------------------------------------------------------------- bumps */

// Two cars on the ground whose boxes meet: pushed apart along the shallower
// overlap. Side on, each takes a knock away from the other, split by mass,
// harder for the one that did not steer in; end on, the car behind gives
// speed to the one in front. With Mega wheels you flatten a rival you touch.
// Returns "side", "end", "mega" or null.
export function collide(round, a, b) {
  const dx = b.x - a.x;
  const dd = b.d - a.d;
  const hw = (a.w + b.w) / 2;
  const hl = (a.l + b.l) / 2;
  const ox = hw - Math.abs(dx);
  const od = hl - Math.abs(dd);
  if (ox <= 0 || od <= 0) return null;
  for (const [me, o] of [
    [a, b],
    [b, a],
  ]) {
    if (me.id === 0 && me.megaMs > 0 && o.kind !== "you" && RIVALS[o.kind].points) {
      knockOut(round, o, "flat", true);
      const points = stunt(round, RIVALS[o.kind].points);
      round.stats.crushed++;
      round.events.push({ type: "crush", x: o.x, d: o.d, kind: o.kind, id: o.id, chain: 1, points, mega: true });
      return "mega";
    }
  }
  const ia = 1 / a.mass;
  const ib = 1 / b.mass;
  const sum = ia + ib;
  let kind;
  let speed;
  if (ox / hw < od / hl) {
    kind = "side";
    const s = dx >= 0 ? 1 : -1;
    a.x -= (s * ox * ia) / sum;
    b.x += (s * ox * ib) / sum;
    const pa = (a.vx + a.kx) * s;
    const pb = -(b.vx + b.kx) * s;
    speed = Math.max(0, pa + pb);
    const j = (SIDE_KICK + speed * (1 + SIDE_BOUNCE)) / sum;
    // A heavy truck gives no ground to a ram: only its mass counts.
    const even = a.mass >= HEAVY || b.mass >= HEAVY;
    const aRams = pa >= pb;
    a.kx -= s * j * ia * (even ? 1 : aRams ? RAM_BACK : RAM_HIT);
    b.kx += s * j * ib * (even ? 1 : aRams ? RAM_HIT : RAM_BACK);
  } else {
    kind = "end";
    const s = dd >= 0 ? 1 : -1;
    a.d -= (s * od * ia) / sum;
    b.d += (s * od * ib) / sum;
    const rear = s > 0 ? a : b;
    const front = s > 0 ? b : a;
    speed = Math.max(0, rear.v - front.v);
    if (speed > 0) {
      const j = (speed * (1 + END_BOUNCE)) / (1 / rear.mass + 1 / front.mass);
      rear.v = Math.max(0, rear.v - j / rear.mass);
      front.v += j / front.mass;
    }
    // A stunned Monster (just stomped, slowing) is never a wall.
    if (rear.id === 0 && front.mass >= HEAVY && !(front.stunMs > 0) && speed >= CRASH_CLOSE) {
      round.events.push({ type: "bump", a: a.id, b: b.id, x: (a.x + b.x) / 2, d: (a.d + b.d) / 2, speed, kind });
      lose(round, "crash");
      return kind;
    }
  }
  // Credit: your touch, or a touch from a rival you had just knocked.
  if (a.id === 0) b.credit = CREDIT_MS;
  else if (b.id === 0) a.credit = CREDIT_MS;
  else {
    b.credit = Math.max(b.credit, a.credit);
    a.credit = Math.max(a.credit, b.credit);
  }
  for (const [me, o] of [
    [a, b],
    [b, a],
  ]) {
    if (o.id !== 0) continue;
    me.nearDone = true;
    if (me.mode === "chase") me.swipes++;
    if (me.kind === "bruiser") me.modeMs = 1400;
  }
  round.events.push({ type: "bump", a: a.id, b: b.id, x: (a.x + b.x) / 2, d: (a.d + b.d) / 2, speed, kind });
  return kind;
}

// A close shave: a rival you pass with a hair between you and no touch.
function nearCheck(round, you, o) {
  if (o.nearDone || o.out > 0 || o.air > 0) return;
  const dd = o.d - you.d;
  const hl = (you.l + o.l) / 2;
  if (Math.abs(dd) < hl) {
    const gap = Math.abs(o.x - you.x) - (you.w + o.w) / 2;
    if (gap > 0 && gap < NEAR_GAP && you.v >= NEAR_SPEED) o.nearArmed = true;
  } else if (dd < -hl && o.nearArmed) {
    o.nearDone = true;
    const points = stunt(round, NEAR_POINTS);
    round.stats.near++;
    round.events.push({ type: "near", x: o.x, d: o.d, kind: o.kind, points });
  }
}

// A rival out of the round: tipped off the road, sunk, fallen or flattened.
// One off the road with your credit on it is yours; a flattening by you
// scores where it happens instead.
function knockOut(round, car, how, byYou = false) {
  car.out = OUT_MS;
  car.outKind = how;
  car.air = 0;
  if (how === "flat" && byYou) return;
  if (how !== "flat" && car.credit > 0) {
    const points = stunt(round, BUMP_POINTS);
    round.stats.bumped++;
    round.events.push({ type: "bumped", x: car.x, d: car.d, id: car.id, kind: car.kind, how, points });
  } else round.events.push({ type: "wreck", x: car.x, d: car.d, id: car.id, kind: car.kind, how });
}

const OUT_HOW = Object.freeze(["", "tip", "splash", "fall", "tip"]);

/* ----------------------------------------------- pads, barriers, hazards */

// Boost strips, ramps and slicks under the cars. A boost strip pushes you
// on; a ramp launches whoever crosses its lip quick enough, RAMP_AIR the
// usual jump; a slick takes your grip.
function pads(round) {
  const road = round.road;
  const t = round.clock;
  const you = round.cars[0];
  const lo = firstAt(road.pads, "d", you.d - DROP_BEHIND - 10);
  for (let k = lo; k < road.pads.length && road.pads[k].d < you.d + DROP_AHEAD; k++) {
    const p = road.pads[k];
    for (const car of round.cars) {
      if (car.out > 0 || car.air > 0 || Math.abs(car.x - p.x) > p.w / 2 + (p.kind === "ramp" ? 0.5 : 0)) continue;
      const mine = car.id === 0;
      if (p.kind === "ramp") {
        const lip = p.d + p.l / 2;
        if (car.pnose - car.l / 2 < lip && car.d >= lip && car.v >= JUMP_MIN) {
          if (mine && round.phase !== "drive") continue;
          car.air = car.airMax = airMs(car.v) * RAMP_AIR;
          car.jumpFrom = car.d;
          car.jumps++;
          if (mine) car.ramped = true;
          round.events.push({ type: "ramp", id: car.id, x: car.x, d: car.d, v: car.v });
        }
        continue;
      }
      if (Math.abs(car.d - p.d) > p.l / 2) continue;
      if (p.kind === "slick") {
        if (mine && car.slickMs <= 0) round.events.push({ type: "slick", x: car.x, d: car.d });
        car.slickMs = SLICK_MS;
      } else if (p.kind === "boost" && mine && round.phase === "drive") {
        if (car.boostMs <= 0) {
          const points = stunt(round, BOOST_POINTS);
          round.events.push({ type: "boost", x: p.x, d: p.d, points });
        }
        car.boostMs = BOOST_MS;
      }
    }
  }
  void t;
}

// Barriers and dropped things against the cars: a cone or a tire is knocked
// flying and slows the car; a block, a pot or a bucket is solid, nose first
// a crash (a rival is out) and from the side a push back out. Flown over,
// it scores on landing. Mega wheels smash anything.
function barriers(round) {
  const road = round.road;
  const you = round.cars[0];
  const lo = firstAt(road.blocks, "d", you.d - DROP_BEHIND - 10);
  let hi = lo;
  while (hi < road.blocks.length && road.blocks[hi].d < you.d + DROP_AHEAD) hi++;
  const check = (b) => {
    if (b.hit) return;
    for (const car of round.cars) {
      if (car.out > 0) continue;
      if (Math.abs(car.d - b.d) >= (car.l + b.l) / 2 || Math.abs(car.x - b.x) >= (car.w + b.w) / 2) continue;
      const mine = car.id === 0;
      if (car.air > 0) {
        if (mine && !car.overs.includes(b)) car.overs.push(b);
        continue;
      }
      if (mine && (car.ghostMs > 0 || round.phase !== "drive")) continue;
      const soft = b.kind === "cone" || b.kind === "tire";
      if (soft || (mine && car.megaMs > 0)) {
        b.hit = round.clock || 1;
        b.side = car.x >= b.x ? -1 : 1;
        car.v *= mine ? (car.megaMs > 0 ? 0.95 : CONE_SLOW) : 0.75;
        car.kx += (car.x >= b.x ? 1 : -1) * 6;
        round.events.push({ type: "cone", x: b.x, d: b.d, kind: b.kind, mine });
        return;
      }
      if (car.pnose <= b.d - b.l / 2 + 0.45) {
        if (mine) lose(round, "crash");
        else if (car.kind !== "monster") knockOut(round, car, "tip");
        return;
      }
      car.x = car.x < b.x ? b.x - (b.w + car.w) / 2 : b.x + (b.w + car.w) / 2;
      car.vx = 0;
      car.kx = 0;
    }
  };
  for (let k = lo; k < hi; k++) check(road.blocks[k]);
  for (const b of round.drops) check(b);
}

// Point-to-segment distance, for a sprinkler's jet.
function segGap(px, pd, s) {
  const vx = s.x1 - s.x0;
  const vd = s.d1 - s.d0;
  const len2 = vx * vx + vd * vd || 1;
  const f = clamp(((px - s.x0) * vx + (pd - s.d0) * vd) / len2, 0, 1);
  return Math.hypot(px - (s.x0 + vx * f), pd - (s.d0 + vd * f));
}

// The moving hazards near you, against every car: trains, balls, sprinklers,
// drops and gusts, each placed by the round's clock.
function hazards(round, ms) {
  const road = round.road;
  const t = round.clock;
  const dt = ms / 1000;
  const you = round.cars[0];
  const driving = round.phase === "drive";
  for (let k = firstAt(road.hazards, "d", you.d - 260); k < road.hazards.length && road.hazards[k].d < you.d + DROP_AHEAD; k++) {
    const h = road.hazards[k];
    if (h.kind === "train") {
      const tr = trainAt(h, t);
      if (tr.warn && !h.warned && Math.abs(h.d - you.d) < 130) round.events.push({ type: "trainWarn", x: (tr.x0 + tr.x1) / 2, d: h.d });
      h.warned = tr.warn;
      if (tr.on && !h.passing && Math.abs(h.d - you.d) < 110) round.events.push({ type: "train", x: tr.head, d: h.d });
      h.passing = tr.on;
      if (!tr.on) continue;
      for (const car of round.cars) {
        if (car.out > 0 || car.kind === "monster" || Math.abs(car.d - h.d) >= h.half + car.l / 2) continue;
        if (car.x + car.w / 2 <= tr.x0 || car.x - car.w / 2 >= tr.x1) continue;
        if (car.air > 0) {
          if (car.id === 0 && !car.overs.includes(h)) car.overs.push(h);
        } else if (car.id !== 0) knockOut(round, car, "tip");
        else if (driving && car.ghostMs <= 0) lose(round, "train");
      }
    } else if (h.kind === "ball") {
      const bx = ballX(h, t);
      for (const car of round.cars) {
        if (car.out > 0 || Math.abs(car.d - h.d) >= car.l / 2 + h.r || Math.abs(car.x - bx) >= car.w / 2 + h.r) continue;
        if (car.air > 0) {
          if (car.id === 0 && !car.overs.includes(h)) car.overs.push(h);
          continue;
        }
        if (car.bonkMs > 0 || (car.id === 0 && car.ghostMs > 0)) continue;
        car.bonkMs = 500;
        car.kx += ((car.x >= bx ? 1 : -1) * BALL_KICK) / car.mass;
        if (car.id === 0) car.v *= BALL_SLOW;
        round.events.push({ type: "bonk", id: car.id, x: bx, d: h.d });
      }
    } else if (h.kind === "sprinkler") {
      const s = sprayAt(h, t);
      for (const car of round.cars) {
        if (car.out > 0 || car.air > 0 || Math.abs(car.d - h.d) > h.reach + car.l) continue;
        if (segGap(car.x, car.d, s) > SPRAY_HALF + car.w * 0.35) continue;
        car.kx += (-h.side * SPRAY_PUSH * dt) / car.mass;
        if (car.id === 0) {
          car.slickMs = Math.max(car.slickMs, 260);
          if (!(h.wet > t - 400)) round.events.push({ type: "spray", x: car.x, d: car.d });
          h.wet = t;
        }
      }
    } else if (h.kind === "drop") {
      if (!h.at && driving && you.d >= h.d - DROP_TRIGGER && you.d < h.d) {
        const i = rowIn(road, h.d);
        h.x = clamp(you.x + you.vx * 0.3, road.L[i] + h.w / 2 + 1, road.R[i] - h.w / 2 - 1);
        h.at = t + DROP_FALL_MS;
        round.events.push({ type: "dropWarn", x: h.x, d: h.d, what: h.what });
      }
      if (h.at && !h.landed && t >= h.at) {
        h.landed = true;
        const soft = h.what === "cone" || h.what === "tire";
        round.drops.push({ kind: soft ? h.what : "block", what: h.what, x: h.x, d: h.d, w: h.w, l: h.l, hit: 0 });
        round.events.push({ type: "dropLand", x: h.x, d: h.d, what: h.what });
        for (const car of round.cars) {
          if (car.out > 0 || car.air > 0 || Math.abs(car.d - h.d) >= (car.l + h.l) / 2 || Math.abs(car.x - h.x) >= (car.w + h.w) / 2) continue;
          if (car.id !== 0) {
            if (car.kind !== "monster") knockOut(round, car, "flat");
          } else if (driving && car.ghostMs <= 0) lose(round, "squash");
        }
      }
    } else if (h.kind === "wind") {
      const g = gustAt(h, t);
      if (g > 0 && !h.blowing && you.d > h.d - 60 && you.d < h.d1) round.events.push({ type: "gust", dir: h.dir, x: you.x, d: you.d });
      h.blowing = g > 0;
      if (!g) continue;
      for (const car of round.cars) {
        if (car.out > 0 || car.air > 0 || car.d < h.d || car.d > h.d1) continue;
        car.kx += (h.dir * WIND_PUSH * g * dt * (car.id === 0 ? 1 : RIVAL_WIND)) / car.mass;
      }
    }
  }
}

/* -------------------------------------------------------------- round */

export function newRound(seed = (Math.random() * 2 ** 31) >>> 0, random = Math.random) {
  const road = newRoad(seed);
  const START_D = 24;
  const i = rowOf(START_D);
  const you = makeCar(0, "you", (road.L[i] + road.R[i]) / 2, START_D, ROLL_SPEED);
  const round = {
    road,
    seed,
    cars: [you],
    drops: [],
    nextId: 1,
    stage: 1,
    lives: START_LIVES,
    score: 0,
    far: START_D,
    chain: 0,
    bestChain: 0,
    streak: 0,
    streakMs: 0,
    bestCombo: 1,
    starRun: 0,
    phase: "drive",
    phaseMs: 0,
    clock: 0,
    stageClock: 0,
    crashD: START_D,
    clearedTo: 0,
    stageLost: false,
    spawnMs: SPAWN_MS,
    bossFor: 0,
    input: { up: false, down: false, left: false, right: false, jump: 0 },
    events: [],
    over: false,
    stats: { bumped: 0, crushed: 0, hauls: 0, holes: 0, overs: 0, near: 0, stars: 0, bosses: 0 },
  };
  // The first rivals already on the road ahead, in sight.
  for (const at of [40, 76]) spawnRival(round, stageFor(1).kinds[round.cars.length - 1] || "zigzag", random, START_D + at);
  return round;
}

export const START_D = 24;

// A life lost, unless a Bubble pops instead: then water or a hole throws
// you clear to the road ahead, and anything else leaves you driving
// through the traffic for a moment.
export function lose(round, cause) {
  const you = round.cars[0];
  if (round.phase !== "drive" || you.out > 0) return false;
  if (you.bubble) {
    you.bubble = false;
    round.events.push({ type: "bubble", x: you.x, d: you.d, cause });
    if (cause === "splash" || cause === "fall") rescue(round, you);
    else {
      you.ghostMs = GHOST_MS;
      you.v = Math.max(ROLL_SPEED, you.v * 0.5);
    }
    return false;
  }
  if (!round.infinite) round.lives--;
  round.chain = 0;
  round.streak = 0;
  round.streakMs = 0;
  round.stageLost = true;
  you.out = CRASH_MS;
  you.outKind = cause === "train" ? "crash" : cause;
  you.air = 0;
  you.overs.length = 0;
  you.ramped = false;
  you.megaMs = 0;
  sizeYou(you);
  round.phase = "crash";
  round.phaseMs = CRASH_MS;
  round.crashD = you.d;
  round.input.jump = 0;
  round.events.push({ type: "lose", cause, x: you.x, d: you.d, lives: round.lives });
  return true;
}

// The Bubble's throw: up and on to the first row ahead with road under the
// middle, steering itself to it. The holes it carries you over are the
// Bubble's, not a jump of yours, so they never score.
function rescue(round, you) {
  const road = round.road;
  let i = rowIn(road, you.d);
  while (i < road.rows - 1 && !(road.deck[i] === 1 && road.under[i] !== GROUND.water && road.under[i] !== GROUND.hole)) i++;
  i = Math.min(road.rows - 1, i + 3);
  const v = Math.max(you.v, 30);
  you.v = v;
  you.air = you.airMax = Math.max(400, ((i * ROW + ROW / 2 - you.d) / v) * 1000 + 120);
  round.clearedTo = Math.max(round.clearedTo, you.d + (v * you.air) / 1000);
  you.jumpFrom = you.d;
  you.overs.length = 0;
  you.ramped = false;
  you.rescueX = (road.L[i] + road.R[i]) / 2;
  if (road.ML[i] < road.MR[i]) you.rescueX = you.x < (road.ML[i] + road.MR[i]) / 2 ? (road.L[i] + road.ML[i]) / 2 : (road.MR[i] + road.R[i]) / 2;
}

// After a crash: out of lives, the round is over; else back on plain road a
// little before the spot, the traffic round it cleared and any crumbled
// road ahead made whole again, for a short hold.
function respawn(round) {
  if (round.lives <= 0) {
    round.over = true;
    return;
  }
  const road = round.road;
  const you = round.cars[0];
  const d = safeSpot(road, round.crashD);
  const i = rowIn(road, d);
  Object.assign(you, { x: (road.L[i] + road.R[i]) / 2, d, v: ROLL_SPEED, vx: 0, kx: 0, air: 0, out: 0, outKind: "", ghostMs: GHOST_MS, nitroMs: 0, boostMs: 0, slickMs: 0, rescueX: null, jumpFrom: d, pnose: d + you.l / 2 });
  round.cars = round.cars.filter((c) => c.id === 0 || c.kind === "monster" || c.d < d - 30 || c.d > d + 80);
  for (const c of round.cars) if (c.kind === "monster" && c.d < d + 70) Object.assign(c, { d: d + 70, air: 0 });
  for (const s of road.dyn) if (s.kind === "crumble" && s.d1 > d) s.start = null;
  round.drops = round.drops.filter((b) => b.d < d - 20 || b.d > d + 60);
  round.phase = "ready";
  round.phaseMs = READY_MS;
  round.input.jump = 0;
  round.events.push({ type: "respawn", x: you.x, d, lives: round.lives });
}

// Your car against a flowerbed: nose first into its front is a crash; from
// the side it pushes you back out onto the road.
function bedCheck(round, you) {
  const road = round.road;
  // The nose, then the middle.
  for (let n = 0; n < 2; n++) {
    const at = n ? you.d : you.d + you.l / 2;
    const i = rowIn(road, at);
    if (!(road.ML[i] < road.MR[i]) || you.x + you.w / 2 <= road.ML[i] || you.x - you.w / 2 >= road.MR[i]) continue;
    const p = rowIn(road, at === you.d ? you.pnose - you.l / 2 : you.pnose);
    if (at !== you.d && !(road.ML[p] < road.MR[p])) {
      lose(round, "crash");
      return;
    }
    const left = you.x < (road.ML[i] + road.MR[i]) / 2;
    you.x = left ? road.ML[i] - you.w / 2 : road.MR[i] + you.w / 2;
    you.vx = 0;
    you.kx = 0;
  }
}

// What the ground does to the cars on it after the slice's moves and bumps:
// water or a hole under your middle costs a life, a flowerbed pushes you out
// (or crashes you, nose first); a rival off the road is out. The Monster
// rolls over anything.
function grounds(round) {
  const road = round.road;
  const you = round.cars[0];
  const t = round.clock;
  if (round.phase === "drive" && you.out === 0 && you.air <= 0) {
    const g = groundAt(road, you.x, you.d, t);
    if (g === GROUND.water) lose(round, "splash");
    else if (g === GROUND.hole) lose(round, "fall");
    else bedCheck(round, you);
  }
  for (const car of round.cars) {
    if (car.id === 0 || car.out > 0 || car.air > 0 || car.kind === "monster") continue;
    const g = groundAt(road, car.x, car.d, t);
    if (g !== GROUND.road) knockOut(round, car, OUT_HOW[g]);
  }
}

// The rivals' slice: each chooses and moves.
function rivals(round, ms, random) {
  for (const car of round.cars) {
    if (car.id === 0) continue;
    think(round, car, ms, random);
    move(round, car, ms);
  }
}

function bumps(round) {
  const cars = round.cars;
  const you = cars[0];
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.out > 0 || a.air > 0) continue;
    if (a.id === 0 && (a.ghostMs > 0 || round.phase !== "drive")) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.out > 0 || b.air > 0) continue;
      if (a === you) nearCheck(round, you, b);
      collide(round, a, b);
      if (round.phase !== "drive" && a === you) return;
    }
  }
}

// Rivals come and go: out ones once their tumble is done, ones far behind or
// far ahead, and new ones while the stage wants more; the Monster comes
// BOSS_AT into its stage. Dropped things far behind are cleared.
function traffic(round, ms, random) {
  const you = round.cars[0];
  // Kept in place, never a new list a slice.
  const cars = round.cars;
  let n = 0;
  for (const c of cars) {
    if (c.id !== 0 && c.outKind) c.out -= ms;
    const keep = c.kind === "monster" ? !c.outKind || c.out > 0 : c.outKind ? c.out > 0 : c.d > you.d - DROP_BEHIND && c.d < you.d + DROP_AHEAD;
    if (c.id === 0 || keep) cars[n++] = c;
  }
  cars.length = n;
  if (round.drops.length && round.drops[0].d < you.d - 60) round.drops = round.drops.filter((b) => b.d > you.d - 60);
  const spec = stageFor(round.stage);
  if (spec.boss && round.bossFor !== round.stage && round.phase === "drive") {
    const from = round.road.stageAt[round.stage - 1];
    if (you.d > from + spec.len * BOSS_AT) {
      const m = spawnRival(round, "monster", random, you.d + 70);
      if (m) {
        round.bossFor = round.stage;
        m.hp = BOSS_HP;
      }
    }
  }
  round.spawnMs -= ms;
  const live = round.cars.reduce((k, c) => k + (c.id !== 0 && c.out === 0 && c.kind !== "monster" ? 1 : 0), 0);
  if (round.spawnMs <= 0 && live < spec.rivals && round.phase === "drive") {
    round.spawnMs = SPAWN_MS;
    spawnRival(round, pickKind(round, random), random);
  }
}

// Points for new road, power-ups and stars taken, crumbling road set off,
// and the stage lines crossed (a flawless stage gives a life back).
function progress(round) {
  const road = round.road;
  const you = round.cars[0];
  if (you.d > round.far) {
    const steps = Math.floor(you.d / DIST_STEP) - Math.floor(round.far / DIST_STEP);
    if (steps > 0) award(round, steps * DIST_POINTS);
    round.far = you.d;
  }
  if (you.air <= 0 && you.out === 0) {
    const reachD = you.l / 2 + ITEM_R;
    for (let k = firstAt(road.items, "d", you.d - reachD); k < road.items.length && road.items[k].d <= you.d + reachD; k++) {
      const it = road.items[k];
      if (it.taken || Math.abs(it.x - you.x) > you.w / 2 + ITEM_R) continue;
      it.taken = true;
      applyPower(round, it.kind);
      round.events.push({ type: "power", kind: it.kind, x: it.x, d: it.d });
    }
  }
  const reachS = you.l / 2 + STAR_R;
  for (let k = firstAt(road.stars, "d", you.d - reachS); k < road.stars.length && road.stars[k].d <= you.d + reachS; k++) {
    const s = road.stars[k];
    if (s.taken || Math.abs(s.x - you.x) > you.w / 2 + STAR_R) continue;
    s.taken = true;
    round.starRun++;
    const points = STAR_POINTS * comboOf(round.streak);
    award(round, points);
    round.stats.stars++;
    round.events.push({ type: "star", x: s.x, d: s.d, run: round.starRun, points });
  }
  for (let k = firstAt(road.dyn, "d0", you.d - 200); k < road.dyn.length && road.dyn[k].d0 <= you.d + you.l / 2; k++) {
    const s = road.dyn[k];
    if (s.kind === "crumble" && s.start === null && you.d < s.d1) {
      s.start = round.clock;
      round.events.push({ type: "crumble", x: you.x, d: s.d0 });
    }
  }
  ensureRoad(road, you.d);
  while (you.d >= road.stageAt[round.stage]) {
    const done = round.stage;
    const spec = stageFor(done);
    const secs = (round.clock - round.stageClock) / 1000;
    const bonus = Math.max(0, Math.round((spec.par - secs) * TIME_POINTS));
    const flawless = !round.stageLost;
    const points = STAGE_POINTS * done + bonus + (flawless ? FLAWLESS_POINTS : 0);
    award(round, points);
    const life = flawless && round.lives < MAX_LIVES;
    if (life) round.lives++;
    round.stage++;
    round.stageLost = false;
    round.stageClock = round.clock;
    for (const c of round.cars) {
      if (c.kind !== "monster" || c.out > 0) continue;
      c.out = OUT_MS;
      c.outKind = "gone";
      round.events.push({ type: "escape", x: c.x, d: c.d });
    }
    round.events.push({ type: "stage", stage: round.stage, points, bonus, flawless, life, secs });
    ensureRoad(road, road.stageAt[round.stage]);
  }
}

function drive(round, ms, random) {
  const you = round.cars[0];
  const inp = round.input;
  // A jump press goes first in its slice, ahead of any bump or landing.
  if (inp.jump > 0) {
    const spring = you.spring;
    if (jump(round, you, spring ? SPRING_AIR : 1)) {
      inp.jump = 0;
      if (spring) you.spring = false;
      round.events.push({ type: "jump", x: you.x, d: you.d, v: you.v, spring });
    } else inp.jump = Math.max(0, inp.jump - ms);
  }
  if (round.streakMs > 0 && (round.streakMs -= ms) <= 0) {
    round.streak = 0;
    round.streakMs = 0;
  }
  move(round, you, ms);
  rivals(round, ms, random);
  if (round.phase === "drive") pads(round);
  if (round.phase === "drive") bumps(round);
  if (round.phase === "drive") barriers(round);
  hazards(round, ms);
  grounds(round);
  if (round.phase === "drive") progress(round);
  traffic(round, ms, random);
}

export function advance(round, ms, random = Math.random) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    if (round.phase === "ready") {
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) {
        round.phase = "drive";
        round.input.jump = 0;
        round.events.push({ type: "go" });
      }
      continue;
    }
    round.clock += slice;
    if (round.phase === "crash") {
      round.phaseMs -= slice;
      round.cars[0].out = Math.max(1, round.phaseMs);
      rivals(round, slice, random);
      hazards(round, slice);
      grounds(round);
      traffic(round, slice, random);
      if (round.phaseMs <= 0) respawn(round);
      continue;
    }
    drive(round, slice, random);
  }
  return round.over ? "over" : round.phase;
}

// Whether anything that matters to you is in a banner's strip, `y` on the
// field with its bottom at `cam` along the road: a rival, a train on its
// track, a ball or something falling.
export const BANNER_Y = FIELD_H * 0.3;
export function underBanner(round, y, cam) {
  const yOf = (d) => FIELD_H - (d - cam);
  const near = (d, size) => Math.abs(yOf(d) - y) < 7 + size;
  if (round.cars.some((o, i) => i > 0 && o.out === 0 && near(o.d, o.l))) return true;
  const road = round.road;
  for (let k = firstAt(road.hazards, "d", cam - 10); k < road.hazards.length && road.hazards[k].d < cam + FIELD_H + 10; k++) {
    const h = road.hazards[k];
    if (!near(h.d, 4)) continue;
    if (h.kind === "ball" || (h.kind === "train" && trainAt(h, round.clock).warn) || (h.kind === "drop" && h.at && !h.landed)) return true;
  }
  return false;
}

/* ------------------------------------------------------------- contract */

// The rivals' colors, one per kind in RIVALS order, kept apart from the
// roads and from each other where they share a stage; the Cop is drawn in
// its own black and white, so its color is only its trim.
export const RIVAL_COLORS = Object.freeze(["#a466ff", "#ff8a1f", "#2fbf71", "#e8483c", "#00a39b", "#ffd21f", "#c7623a", "#ff4fa3", "#5aa0ff", "#c6f03a"]);

// Your color is the page's highlight, any of many, so a rival's can land
// next to it. A rival color nearer yours than NEAR_COLOR (a distance in RGB)
// gives way to the spare that stands furthest from yours and from every
// other rival's.
export const SPARE_COLORS = Object.freeze(["#1fb6d9", "#e0368a", "#d4a017", "#7ad151", "#8a5cf0", "#f2f2f2", "#b0f0ff"]);
export const NEAR_COLOR = 70;

// "#rgb", "#rrggbb" or "rgb(r, g, b)" as [r, g, b]; null for anything else.
function rgbOf(color) {
  const c = String(color || "").trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16));
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const colorGap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The rivals' colors in RIVALS order with yours as `you`: RIVAL_COLORS, but
// any too near yours swapped for a spare. A color it cannot read keeps them all.
export function rivalColors(you) {
  const out = [...RIVAL_COLORS];
  const mine = rgbOf(you);
  if (!mine) return out;
  for (let k = 0; k < out.length; k++) {
    if (colorGap(rgbOf(out[k]), mine) >= NEAR_COLOR) continue;
    let best = out[k];
    let bestGap = -1;
    for (const spare of SPARE_COLORS) {
      if (out.includes(spare)) continue;
      const rgb = rgbOf(spare);
      let gap = colorGap(rgb, mine);
      for (let j = 0; j < out.length; j++) if (j !== k) gap = Math.min(gap, colorGap(rgb, rgbOf(out[j])));
      if (gap > bestGap) {
        bestGap = gap;
        best = spare;
      }
    }
    out[k] = best;
  }
  return out;
}

const MAX_PARTS = 400;
// Under the held motor hum (see runHums), the engine blips every ENGINE_MS
// while you pick up speed, pitched by your speed, and is quiet once you
// cruise, in the air and while the round holds; the verge rumbles every
// RUMBLE_MS.
export const ENGINE_MS = 110;
const RUMBLE_MS = 170;
const BUMP_TONE_MS = 140;
// A skid's screech at most once a SKID_MS, and steering counts as hard past
// SKID_STEER of the full sideways speed at SKID_SPEED or more.
const SKID_MS = 450;
const SKID_STEER = 0.6;
const SKID_SPEED = 30;
// How near (in road units) a held hum starts to be heard: the Monster truck,
// and a train, crumbling road or a sprinkler.
const MONSTER_EAR = 160;
const HAZARD_EAR = 120;
// A little random pitch, so a sound played often never repeats exactly.
const wob = (spread = 0.1) => 1 - spread / 2 + Math.random() * spread;

// The end screen's nudge to play again: the next stage not yet reached.
function teaser(furthest) {
  if (furthest < STAGES.length) return `Next to reach: ${STAGES[furthest].title}.`;
  return `Every stage reached. How many laps can you go?`;
}

// What a jump flew over, for the word that pops up as you land.
const OVER_WORD = Object.freeze({ train: "the train", ball: "the ball", cone: "the cones", tire: "the tire", block: "the block" });

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // A press waits for the first tick after a start or a play-on, so the key
  // that plays on never also jumps.
  let armed = false;
  // The furthest stage ever reached, and whether this round went past it.
  // Without a memo (the unit suite) it lasts as long as the game.
  let furthest = 1;
  let further = false;
  try {
    furthest = Math.max(1, memo ? Number(memo.get()) | 0 : 1);
  } catch {}
  // Sparks, floating words, rings, the banners, the view's bottom (`cam`, a
  // distance along the road), the chain's big number, the shake and the
  // flash, in field units and ms.
  let fx = null;
  const resetFx = () => (fx = { parts: [], floats: [], banners: [], rings: [], shake: 0, shakeMag: 0, flash: null, clock: 0, cam: START_D - BEHIND, engine: 0, lastV: ROLL_SPEED, rumble: 0, bumpTone: -1e9, cheer: 0, combo: null, skidTone: -1e9, steer: 0, nitro: 0, mega: 0 });
  resetFx();

  // The rivals' colors, worked out again whenever yours changes.
  let rivalPalette = RIVAL_COLORS;
  let paletteFor = null;
  const colorOf = (car) => {
    if (car.id === 0) return colors.you;
    if (paletteFor !== colors.you) {
      rivalPalette = rivalColors(colors.you);
      paletteFor = colors.you;
    }
    return rivalPalette[Math.max(0, RIVAL_KINDS.indexOf(car.kind))];
  };
  const colorOfKind = (kind) => colorOf({ id: -1, kind });

  // A spot on the field for a distance along the road. Effects keep to the
  // distance they began at, so the road scrolling carries them along.
  const yOf = (d) => FIELD_H - (d - fx.cam);
  const burst = (x, d, color, n, speed = 16) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x, d, vx: Math.cos(a) * v, vd: Math.sin(a) * v, life: 300 + Math.random() * 300, max: 600, color, size: 0.5 + Math.random() * 0.6 });
    }
  };
  const float = (x, d, text, color, size = 2.6) => fx.floats.push({ x, d, rise: 0, text, color, size, life: 1000, max: 1000 });
  const ring = (x, d, color, r0, grow, ms = 420) => fx.rings.push({ x, d, color, r0, grow, life: ms, max: ms });
  const banner = (title, sub, color, ms = 1800) => {
    if (fx.banners.length >= 3 || fx.banners.some((b) => b.title === title)) return null;
    const b = { title, sub, color, life: ms, max: ms, tag: "", y: null, see: 1 };
    fx.banners.push(b);
    return b;
  };
  // A shake still running keeps the stronger of the two; a new one starts
  // from its own strength, so one big hit never loudens every later shake.
  const shake = (ms, mag) => {
    fx.shakeMag = Math.max(fx.shake > 0 ? fx.shakeMag : 0, mag);
    fx.shake = Math.max(fx.shake, ms);
  };
  const flash = (color, ms = 260) => (fx.flash = { color, life: ms, max: ms });

  const markFurthest = (n, b) => {
    if (n <= furthest) return;
    furthest = n;
    further = true;
    try {
      if (memo) memo.set(furthest);
    } catch {}
    if (b) b.tag = n > STAGES.length ? `NEW FURTHEST: ${stageFor(n).name.toUpperCase()}` : `NEW STAGE ${n} / ${STAGES.length}`;
  };

  const stageBanner = (n) => {
    const spec = stageFor(n);
    return banner(n > STAGES.length ? spec.name : `Stage ${n}: ${spec.name}`, spec.sub, stageColor(spec.id), 2200);
  };

  const near = (d) => Math.abs(d - round.cars[0].d) < 70;

  const handle = (e) => {
    const you = round.cars[0];
    switch (e.type) {
      case "jump":
        tone("spring", e.spring ? 0.9 : 0.6, (e.spring ? 0.8 : 1) * (0.9 + e.v / 200));
        tone("jump", 0.35, wob() * (0.85 + e.v / 300));
        if (e.spring) tone("bounceSproing", 0.8, wob());
        burst(e.x, e.d - 2, "#d9d1c3", 5, 8);
        break;
      case "ramp":
        if (e.id === 0) {
          tone("spring", 0.9, 0.75);
          tone("tunnel", 0.4);
          tone("bounceSproing", 0.6, 0.8);
          tone("whoosh", 0.5, 0.9 + e.v / 300);
          burst(e.x, e.d - 2, GOLD, 8, 10);
        } else if (near(e.d)) tone("spring", 0.3, 0.7);
        break;
      case "land": {
        // The longer the fall, the louder and lower the thud: a hop is a
        // tap, a Spring or a ramp's big air a proper slam.
        const fall = clamp((you.airMax - 400) / 1100, 0, 1);
        tone("thunk", 0.55);
        tone("bounceLand", 0.35 + 0.65 * fall, wob(0.08) * (1.15 - 0.4 * fall));
        if (fall > 0.6) tone("thud", 0.4 + (0.5 * (fall - 0.6)) / 0.4, 0.9);
        burst(e.x, e.d - 2, "#d9d1c3", 4, 6);
        const words = [];
        if (e.holes) words.push("Jumped it!");
        for (const o of e.overs) words.push(`Over ${OVER_WORD[o] || "it"}!`);
        if (e.big) words.push("Big air!");
        if (e.points) {
          tone("coin", 0.6, 1.2);
          if (e.big) tone("cheer", 0.3);
          float(e.x, e.d + 4, `${words[0] || "Nice!"} +${e.points}`, "#ffffff", 2.4);
        }
        if (e.chain >= 2) {
          tone("perfect", 0.8, 1 + 0.08 * e.chain);
          float(e.x, e.d + 8, `Chain x${e.chain}!`, GOLD, 2.8);
        }
        break;
      }
      case "crush":
      case "haul": {
        const crush = e.type === "crush";
        tone(crush ? "squash" : "boing", 1, 1 + 0.12 * (e.chain - 1));
        if (crush) {
          tone("crunch", 0.8, wob() * (1 + 0.05 * (e.chain - 1)));
          tone("bounceTinCrush", 0.6, wob());
          if (e.mega) tone("smash", 0.7);
        } else tone("clank", 0.45, wob());
        if (e.chain >= 3) tone("combo", 0.5, 1 + 0.06 * Math.min(10, e.chain));
        burst(e.x, e.d, crush ? colorOfKind(e.kind) : "#ffffff", crush ? 14 : 6, 16);
        burst(e.x, e.d, GOLD, 6, 12);
        ring(e.x, e.d, GOLD, 1.5, 5, 380);
        const what = e.mega ? "Mega! " : e.kind === "racer" ? "Caught! " : e.kind === "cop" ? "Busted! " : "";
        float(e.x, e.d + 4, e.chain > 1 ? `${what}+${e.points} chain x${e.chain}` : `${what}+${e.points}`, GOLD, 2.8);
        if (e.chain > 1) fx.combo = { n: e.chain, life: 1200, max: 1200 };
        if (crush) shake(120, 0.4);
        break;
      }
      case "stomp":
        tone("ghoulStomp", 1, 0.8);
        tone("squash", 0.8, 0.6);
        tone("crunch", 0.9, 0.7);
        // Each stomp rings a little higher, the last nearly flat.
        tone("bounceRoofSlam", 1, 1 + 0.08 * (BOSS_HP - Math.max(0, e.hp)));
        burst(e.x, e.d, GOLD, 14, 18);
        ring(e.x, e.d, GOLD, 3, 9, 500);
        shake(200, 0.8);
        float(e.x, e.d + 6, e.hp > 0 ? `Stomp! +${e.points} (${e.hp} to go)` : `Stomp! +${e.points}`, GOLD, 3);
        break;
      case "boss":
        tone("ace");
        tone("levelup", 0.8);
        tone("explode", 0.7);
        tone("bounceMonsterDown", 0.9);
        tone("victory", 0.8);
        tone("applause", 0.5);
        flash(GOLD, 420);
        shake(400, 1.2);
        burst(e.x, e.d, GOLD, 30, 26);
        banner("Monster crushed!", e.life ? `+${e.points}, and a life back` : `+${e.points}`, GOLD, 2200);
        break;
      case "quake":
        if (!e.near) tone("thud", 0.3, 0.6);
        else {
          tone("boom", 0.7);
          tone("thud", 0.9, 0.7);
          tone("rumbleLong", 0.6);
          shake(260, 0.9);
          ring(e.x, e.d, "#ffffff", 3, 12, 500);
        }
        break;
      case "bossHop":
        tone("rev", 0.6, 0.7);
        tone("jump", 0.4, 0.45);
        break;
      case "escape":
        tone("horn", 0.6);
        tone("aww", 0.4);
        float(e.x, e.d, "It got away!", DANGER, 2.6);
        break;
      case "spawn":
        if (e.kind === "monster") {
          tone("ghoulRoar");
          tone("bossIntro", 0.9);
          tone("bounceMonsterRev", 0.8);
          shake(300, 0.7);
          banner("The Monster truck!", "Land on its roof five times", DANGER, 2000);
        } else if (e.kind === "cop") {
          tone("horn", 0.7, 1.2);
          tone("bounceSiren", 0.6);
          float(you.x, you.d - 6, "Cop on your tail!", "#7fb7ff", 2.4);
        } else if (e.kind === "racer") {
          tone("rev", 0.8, 1.3);
          tone("zoom", 0.5, 1.3);
          float(you.x, you.d - 6, "Racer! Catch it!", GOLD, 2.4);
        }
        break;
      case "bumped":
        tone("coin", 0.8);
        float(e.x, e.d + 3, `Bumped off! +${e.points}`, GOLD, 2.6);
        burst(e.x, e.d, e.how === "splash" ? "#bfe6ff" : colorOfKind(e.kind), 10, 14);
        if (e.how === "splash") {
          tone("splash", 0.5);
          tone("splashBig", 0.5, wob());
        } else tone("smash", 0.5, wob());
        break;
      case "wreck":
        if (e.how === "splash" && near(e.d)) tone("splash", 0.25);
        else if (near(e.d)) tone("crunch", 0.3, wob() * 1.2);
        burst(e.x, e.d, e.how === "splash" ? "#bfe6ff" : colorOfKind(e.kind), 5, 10);
        break;
      case "near":
        tone("skim", 0.5, 0.9 + 0.1 * comboOf(round.streak));
        tone("swoosh", 0.45, wob());
        float(e.x, e.d + 2, `Close! +${e.points}`, "#ffffff", 2.2);
        break;
      case "bump":
        if ((e.a === 0 || e.b === 0) && fx.clock - fx.bumpTone >= BUMP_TONE_MS) {
          fx.bumpTone = fx.clock;
          tone("ram", Math.min(1, 0.35 + e.speed / 40), 1 + Math.min(0.5, e.speed / 60));
          tone("hit", Math.min(0.8, 0.2 + e.speed / 50), wob() * (1 + Math.min(0.4, e.speed / 80)));
          burst(e.x, e.d, "#ffffff", 4, 10);
          if (e.speed > 25) shake(110, 0.4);
        }
        break;
      case "hop":
        if (near(e.d)) {
          tone("spring", 0.15, 0.8);
          tone("bounceSproing", 0.2, wob() * 1.2);
        }
        break;
      case "brake":
        if (near(e.d)) {
          tone("shank", 0.3);
          tone("brake", 0.3, wob());
        }
        break;
      case "litter":
        if (near(e.d)) {
          tone("pop", 0.3, 0.8);
          tone("knock", 0.3, wob());
        }
        break;
      case "copGone":
        if (near(e.d)) tone("bounceSirenOff", 0.4);
        break;
      case "boost":
        tone("charge", 0.6);
        tone("boost", 0.6);
        burst(e.x, e.d, "#7fe3ff", 8, 12);
        break;
      case "slick":
        tone("skim", 0.3, 0.6);
        tone("skid", 0.5, wob());
        tone("splat", 0.3);
        fx.skidTone = fx.clock;
        break;
      case "star":
        tone("ghoulCandy", 0.35, Math.min(2, 1 + 0.04 * e.run));
        if (e.run > 0 && e.run % 5 === 0) tone("sparkle", 0.5, Math.min(1.5, 1 + 0.02 * e.run));
        burst(e.x, e.d, GOLD, 3, 6);
        break;
      case "cone":
        if (e.mine) {
          tone("bump", 0.5, 0.8);
          tone(e.kind === "tire" ? "slap" : "knock", 0.6, wob());
          burst(e.x, e.d, e.kind === "tire" ? "#2a2a2a" : "#ff8a1f", 6, 12);
        }
        break;
      case "bonk":
        if (e.id === 0) {
          tone("boing", 0.8);
          tone("slap", 0.6, wob());
          shake(140, 0.5);
          float(e.x, e.d + 4, "Bonk!", DANGER, 2.6);
        }
        break;
      case "spray":
        tone("splash", 0.25, 1.6);
        tone("bounceSpray", 0.6, wob());
        break;
      case "trainWarn":
        tone("bell", 0.6);
        tone("bounceCrossing", 0.6);
        break;
      case "train":
        tone("horn", 0.5, 0.8);
        tone("trainHorn", 0.7);
        break;
      case "dropWarn":
        tone("fall", 0.5, 1.4);
        tone("bounceDropWhistle", 0.5);
        break;
      case "dropLand":
        if (near(e.d)) {
          tone("thunk", 1, 0.7);
          tone(e.what === "cone" || e.what === "tire" ? "thud" : "smash", 0.6, wob());
          shake(120, 0.5);
          burst(e.x, e.d, "#d9d1c3", 8, 10);
        }
        break;
      case "gust":
        tone("batSwoop", 0.4, 0.6);
        tone("gust", 0.7, wob());
        break;
      case "crumble":
        tone("creakBoard", 0.7);
        tone("crumble", 0.8);
        tone("warn", 0.35);
        float(e.x, you.d + 8, "It's crumbling! Floor it!", DANGER, 2.4);
        break;
      case "power": {
        const spec = POWERS[e.kind];
        tone("power");
        tone("powerUp", 0.6);
        burst(e.x, e.d, spec.color, 12, 12);
        banner(spec.name, spec.blurb, spec.color, 1300);
        break;
      }
      case "bubble":
        tone("shield");
        tone("pop", 0.6, 0.6);
        tone("shieldUp", 0.5);
        ring(e.x, e.d, POWERS.bubble.color, 2, 7, 500);
        float(e.x, e.d + 4, "Bubble!", POWERS.bubble.color, 2.8);
        break;
      case "lose":
        if (e.cause === "splash") {
          tone("splash");
          tone("splashBig", 0.9);
          ring(e.x, e.d, "#ffffff", 1, 6, 500);
          burst(e.x, e.d, "#bfe6ff", 14, 12);
        } else if (e.cause === "fall") {
          tone("fall");
          tone("bounceFallAway", 0.8);
        } else {
          tone("crash", 0.9);
          tone(e.cause === "squash" ? "squish" : "smash", 0.9);
          if (e.cause === "train" || e.cause === "squash") tone("crunch", 0.8, 0.7);
          burst(e.x, e.d, "#ffd84a", 12, 16);
        }
        shake(e.cause === "fall" ? 200 : 300, e.cause === "fall" ? 0.5 : 1);
        if (e.lives > 0) tone("lifeLost", 0.5);
        flash(DANGER, 220);
        float(e.x, e.d + 4, { splash: "Splash!", fall: "Down the hole!", squash: "Squashed!", train: "Hit by the train!" }[e.cause] || "Crash!", DANGER, 2.8);
        break;
      case "respawn":
        fx.cam = e.d - BEHIND;
        if (e.lives === 1) tone("heartbeat", 0.7);
        banner("Ready?", e.lives === 1 ? "Last life!" : `${e.lives} lives left`, e.lives === 1 ? DANGER : "#ffffff", READY_MS);
        break;
      case "go":
        tone("go", 0.7);
        tone("rev", 0.4, 1.4);
        break;
      case "stage":
        tone("levelup");
        tone("fanfare", 0.8);
        tone("bounceBeepBeep", 0.6);
        tone("cheer", 0.5);
        if (e.life) tone("extraLife", 0.7);
        else if (e.flawless) tone("sparkle", 0.6);
        flash(stageColor(stageFor(e.stage).id), 360);
        fx.cheer = 1400;
        markFurthest(e.stage, stageBanner(e.stage));
        float(you.x, you.d + 6, `+${e.points}${e.bonus ? `, ${Math.round(e.secs)} s` : ""}${e.life ? ", and a life back!" : e.flawless ? ", flawless!" : ""}`, GOLD, 2.6);
        break;
    }
  };

  // A score past the best this round began with: once a round, a fanfare.
  const checkBest = () => {
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    tone("victory", 0.6);
    banner("New best!", "Every point from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    checkBest();
  };

  // The engine's hum and the verge's rumble, for your car only, and only
  // while you drive with your wheels down. A toy car never stops, so the hum
  // plays only while you pick up speed (or burn a Nitro or a boost), never
  // all the way up the road: cruising, coasting and braking are quiet.
  // The held sounds, asked for again every tick (a paused or finished game
  // stops asking, and they fade by themselves): your motor, pitched by your
  // speed, louder while you gain and revving free in the air; rushing air
  // in the air and through a Nitro or a gust; the tires squealing as you
  // steer hard or slide on a slick; the Monster truck's engine, louder the
  // nearer it is; and the nearest of a passing train, road crumbling behind
  // you or a sprinkler's hiss. Then the one-shots that follow your driving:
  // a skid as you throw the car the other way, and a power-up running out.
  const runHums = (gaining) => {
    const you = round.cars[0];
    const road = round.road;
    const t = round.clock;
    const speed = you.v / TOP_SPEED;
    const down = you.out <= 0;
    const driving = round.phase === "drive" && down;
    if (down) {
      const air = you.air > 0;
      const level = round.phase === "ready" ? 0.35 : air ? 0.4 : gaining ? 0.9 : 0.6;
      hum("bounce:you", "bounceMotor", level, (0.75 + 0.95 * Math.min(1.3, speed)) * (air ? 1.2 : 1));
    }
    const nitro = you.nitroMs > 0 || you.boostMs > 0;
    let wind = driving ? (you.air > 0 ? 0.3 + 0.5 * Math.min(1, speed) : 0) + (nitro ? 0.5 : 0) : 0;
    // The hazards near you: the nearest one that is sounding gets the slot.
    let near = null;
    // A gust zone runs long, so the look back starts where hazards() does.
    for (let k = firstAt(road.hazards, "d", you.d - 260); k < road.hazards.length && road.hazards[k].d < you.d + HAZARD_EAR; k++) {
      const h = road.hazards[k];
      const gap = Math.abs(h.d - you.d);
      const close = 1 - gap / HAZARD_EAR;
      if (h.kind === "wind") {
        if (you.d > h.d - 60 && you.d < h.d1) wind = Math.max(wind, gustAt(h, t));
      } else if (close <= 0) continue;
      else if (h.kind === "train") {
        if (trainAt(h, t).on && (!near || gap < near.gap)) near = { gap, name: "train", level: close, pitch: 1 };
      } else if (h.kind === "sprinkler") {
        if (!near || gap < near.gap) near = { gap, name: "bounceSprinkler", level: close * 0.8, pitch: 1 };
      }
    }
    for (let k = firstAt(road.dyn, "d0", you.d - 200); k < road.dyn.length && road.dyn[k].d0 <= you.d + 10; k++) {
      const c = road.dyn[k];
      if (c.kind !== "crumble" || c.start === null) continue;
      // Where the road is falling away now, and how close behind you it is.
      const edge = c.d0 + ((t - c.start - CRUMBLE_DELAY) / 1000) * CRUMBLE_SPEED;
      if (edge < c.d0 - 20 || edge > c.d1) continue;
      const gap = Math.abs(you.d - edge);
      if (gap < HAZARD_EAR && (!near || gap < near.gap)) near = { gap, name: "bounceCrumbling", level: 1 - gap / HAZARD_EAR, pitch: 1 };
    }
    if (near) hum("bounce:hazard", near.name, near.level, near.pitch);
    if (wind > 0) hum("bounce:wind", "wind", Math.min(1, wind), 0.8 + 0.8 * Math.min(1.3, speed));
    // Tires: hard steering at speed, or any steering on a slick.
    const side = Math.abs(you.vx) / STEER_SPEED;
    const slick = you.slickMs > 0;
    const scrub = driving && you.air <= 0 && you.v >= SKID_SPEED ? Math.max(slick ? side : 0, (side - SKID_STEER) / (1 - SKID_STEER)) : 0;
    if (scrub > 0) hum("bounce:squeal", "squeal", Math.min(1, scrub), 0.9 + 0.3 * Math.min(1, speed));
    const steer = (round.input.right ? 1 : 0) - (round.input.left ? 1 : 0);
    if (driving && you.air <= 0 && steer && steer === -fx.steer && you.v >= SKID_SPEED && side > SKID_STEER / 2 && fx.clock - fx.skidTone >= SKID_MS) {
      fx.skidTone = fx.clock;
      tone("skid", 0.25 + 0.35 * Math.min(1, speed), wob());
    }
    if (steer) fx.steer = steer;
    else if (side < 0.1) fx.steer = 0;
    // The Monster truck: a deep engine, nearer is louder, stunned it idles low.
    let monster = null;
    for (const c of round.cars) if (c.kind === "monster" && c.out <= 0 && (!monster || Math.abs(c.d - you.d) < Math.abs(monster.d - you.d))) monster = c;
    if (monster) {
      const gap = Math.abs(monster.d - you.d);
      if (gap < MONSTER_EAR) {
        const pitch = (0.9 + 1.1 * Math.min(1.4, monster.v / RIVALS.monster.speed)) * (monster.stunMs > 0 ? 0.7 : 1) * (monster.air > 0 ? 1.25 : 1);
        hum("bounce:monster", "bounceMonster", 0.25 + 0.75 * (1 - gap / MONSTER_EAR), pitch);
      }
    }
    // A Nitro or a Mega running out.
    if (fx.nitro > 0 && you.nitroMs <= 0 && down) tone("powerDown", 0.35, 1.2);
    if (fx.mega > 0 && you.megaMs <= 0 && down) tone("powerDown", 0.4);
    fx.nitro = you.nitroMs;
    fx.mega = you.megaMs;
  };

  const runSound = (ms) => {
    const you = round.cars[0];
    const gaining = you.v > fx.lastV + 1e-6 || you.nitroMs > 0 || you.boostMs > 0;
    fx.lastV = you.v;
    runHums(gaining);
    if (round.phase !== "drive" || you.out > 0 || you.air > 0) {
      fx.engine = ENGINE_MS;
      return;
    }
    fx.engine += ms;
    if (!gaining) fx.engine = Math.min(fx.engine, ENGINE_MS);
    else if (fx.engine >= ENGINE_MS) {
      fx.engine = 0;
      tone("engine", 0.18, 0.6 + 0.9 * Math.min(1.3, you.v / TOP_SPEED));
    }
    if (groundAt(round.road, you.x, you.d, round.clock) !== GROUND.verge) return (fx.rumble = RUMBLE_MS);
    fx.rumble += ms;
    if (fx.rumble >= RUMBLE_MS) {
      fx.rumble = 0;
      tone("beat", 0.3, 1.4);
    }
  };

  // The view's bottom follows you, BEHIND under your car; it stays put while
  // you crash, and a respawn sets it straight.
  const camTarget = () => round.cars[0].d - BEHIND;

  const runFx = (ms) => {
    fx.clock += ms;
    const s = ms / 1000;
    if (round.phase !== "crash") fx.cam += (camTarget() - fx.cam) * (1 - Math.exp(-ms / 60));
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.d += p.vd * s;
      // A tenth of its speed off every 16 ms, however long the frame.
      const damp = Math.pow(0.9, ms / 16);
      p.vx *= damp;
      p.vd *= damp;
      return p.life > 0;
    });
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.rise += 5 * s;
      return f.life > 0;
    });
    fx.rings = fx.rings.filter((r) => (r.life -= ms) > 0);
    if (fx.combo && (fx.combo.life -= ms) <= 0) fx.combo = null;
    fx.cheer = Math.max(0, fx.cheer - ms);
    if (fx.banners.length) {
      const b = fx.banners[0];
      if (b.y == null) b.y = BANNER_Y;
      const target = underBanner(round, b.y, fx.cam) ? BANNER_SEE_THROUGH : 1;
      b.see += (target - b.see) * Math.min(1, ms / BANNER_FADE_MS);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
    }
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash && (fx.flash.life -= ms) <= 0) fx.flash = null;
    if (round.starRun && round.streakMs <= 0) round.starRun = 0;
  };

  // The pills' numbers: the stage, lives, the power-ups held (the timed ones
  // emptying as they burn), the chain while it is on and the combo while it
  // multiplies.
  const hudOf = () => {
    const you = round.cars[0];
    const effects = [];
    if (you.spring) effects.push({ text: "SPRING", color: POWERS.spring.color, fill: 1 });
    if (you.bubble) effects.push({ text: "BUBBLE", color: POWERS.bubble.color, fill: 1 });
    if (you.nitroMs > 0) effects.push({ text: "NITRO", color: POWERS.nitro.color, fill: you.nitroMs / NITRO_MS });
    if (you.megaMs > 0) effects.push({ text: "MEGA", color: POWERS.mega.color, fill: you.megaMs / MEGA_MS });
    const road = round.road;
    const from = road.stageAt[round.stage - 1] || 0;
    const to = road.stageAt[round.stage] || from + 1;
    const mult = comboOf(round.streak);
    return { stage: `STAGE ${round.stage}`, effects, chain: round.chain, combo: mult > 1 ? { mult, fill: round.streakMs / STREAK_MS } : null, progress: clamp((you.d - from) / (to - from), 0, 1) };
  };

  // The view bounce-draw.js draws from: one object, refilled each frame.
  const view = { g: Object.freeze({ W, H, HUD_H, PAD, GAP, BAR_W, FIELD_W, FIELD_H, ROW, CAR_W, CAR_L, ITEM_R, CRASH_MS, OUT_MS }), ground: GROUND, powers: POWERS, rivals: RIVALS, colorOf, heightOf, stageFor, firstAt, order: [], maxStage: STAGES.length };
  const shakeAt = { x: 0, y: 0 };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    // A banner takes its place on its first frame: a frame painted before the
    // next tick (the start's, held through the 3, 2, 1) would draw it at the top.
    const head = fx.banners[0] || null;
    if (head && head.y == null) head.y = BANNER_Y;
    view.u = u;
    view.clock = fx.clock;
    view.state = state;
    view.colors = colors;
    view.round = round;
    view.road = round.road;
    view.fx = fx;
    view.cam = fx.cam;
    view.yOf = yOf;
    view.pillH = Math.max(12 / u, 2.4);
    view.hud = hudOf();
    view.cheer = fx.cheer > 0;
    view.combo = fx.combo;
    view.flash = fx.flash;
    view.banner = head;
    view.furthest = furthest;
    view.lost = state === "over";
    view.shake = null;
    if (fx.shake > 0 && state === "running") {
      shakeAt.x = (Math.random() - 0.5) * 2 * fx.shakeMag;
      shakeAt.y = (Math.random() - 0.5) * 2 * fx.shakeMag;
      view.shake = shakeAt;
    }
    view.tally = null;
    view.big = null;
    const reached = `Furthest: ${stageName(furthest)}`;
    if (state === "ready") view.tally = ["Bump them off, jump the gaps, land on top", `Arrows drive, space jumps. ${reached}`];
    else if (state === "over") {
      const st = round.stats;
      view.big = String(round.score);
      view.tally = [`Reached ${stageName(round.stage)}${further ? ". New furthest!" : ""}${beaten ? " A new best!" : ""}`, `${st.bumped} bumped, ${st.crushed} crushed, chain x${Math.max(1, round.bestChain)}, combo x${round.bestCombo}, ${st.stars} stars. ${teaser(furthest)}`];
    }
    drawScene(ctx, view);
  };

  // Nothing held carries over a pause or a new round: a release may never
  // arrive, and a jump pressed early is dropped.
  const letGo = () => {
    const inp = round.input;
    inp.up = inp.down = inp.left = inp.right = false;
    inp.jump = 0;
  };

  const start = () => {
    colors = readColors(canvas);
    round = newRound();
    state = "running";
    further = false;
    armed = false;
    resetFx();
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    stageBanner(1);
    paint();
  };

  const end = () => {
    state = "over";
    tone("gameOver", 0.8);
    letGo();
    onScore(round.score);
  };

  const MOVES = Object.freeze({ left: true, right: true, up: true, down: true });

  return {
    get score() {
      return round.score;
    },
    get state() {
      return state;
    },
    // For the tests only: the window never reads it.
    get round() {
      return round;
    },
    // Endless lives for this round (the Activities window's code), or not.
    cheat(on) {
      round.infinite = Boolean(on);
    },
    start,
    pause() {
      if (state === "running") state = "paused";
      letGo();
      paint();
    },
    resume() {
      if (state !== "paused") return;
      state = "running";
      armed = false;
    },
    // A held arrow drives, brakes or steers until it is let go (its key
    // repeats, held through the countdown, keep it held). Space starts a
    // round or jumps, once a press: a repeat of it, or the press that plays
    // on (the window resumes a paused game through resume()), never jumps.
    key(name, repeat = false) {
      if (name === "action") {
        if (state === "ready" || state === "over") start();
        else if (state === "running" && !repeat && armed && round.phase === "drive") round.input.jump = JUMP_BUFFER_MS;
        return true;
      }
      if (!MOVES[name]) return false;
      if (state !== "running") return true;
      round.input[name] = true;
      return true;
    },
    // A key let go: stop driving, braking or steering that way.
    release(name) {
      if (MOVES[name]) round.input[name] = false;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      runSound(ms);
      advance(round, ms);
      drain();
      if (round.over) end();
      paint();
      armed = true;
    },
    resize(w, h) {
      const next = Math.floor(Math.min(w / W, h / H) * 4) / 4;
      if (!(next >= MIN_CELL)) return false;
      u = next;
      colors = null;
      const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
      canvas.width = Math.round(W * u * ratio);
      canvas.height = Math.round(H * u * ratio);
      if (canvas.style) {
        canvas.style.width = `${Math.round(W * u)}px`;
        canvas.style.height = `${Math.round(H * u)}px`;
      }
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
      return true;
    },
  };
}

export { LONGEST_JUMP, MAX_HOLE };

export default Object.freeze({ id: "bounce", title: "Bounce Road", create });
