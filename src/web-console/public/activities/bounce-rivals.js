// Plan2Code Web Console - Bounce Road's rivals: the kinds and what each is like, a car's starting state, where a new rival goes on the road, which kind comes next, and each rival's choice of speed and line every slice (blocking, ramming, chasing, dodging your landings, littering, hopping the holes, and the Monster truck's chase).
//
// Rules only: bounce.js moves the cars, bumps them and settles their
// landings; this file decides what a rival wants. Every rival keeps to the
// road on its own: it steers for the narrowest stretch just ahead (its side
// of a flowerbed, the middle of a swaying bridge), hops any hole, barrier or
// train in its way (every toy on Bounce Road has a spring), and holds a
// slower car's speed, so no rival stops or sticks. How keenly it blocks,
// rams and dodges grows with the stage's `sharp`.

import { CAR_L, CAR_W, FIELD_W, GROUND, JUMP_MIN, MAX_SPEED, ROW, SPAN, ensureRoad, firstAt, rowGone, rowIn, spanAt, stageFor, swayOff, trainAt } from "./bounce-road.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The rivals, in the order they are introduced. `w` and `l` are the box,
// `mass` how hard it is to shove, `speed` its own pace before the stage's,
// `points` what flattening it scores, `dodge` how readily it swerves from
// under your landing (times the stage's sharpness), `weight` how often it
// comes, `style` the car it is drawn as, and `behind` true for one that
// comes up from under the board. A rival with no `points` cannot be
// flattened: its roof is a trampoline.
export const RIVALS = Object.freeze({
  zigzag: Object.freeze({ name: "Zigzag", w: 4.2, l: 6.8, mass: 1, speed: 42, points: 100, dodge: 0.45, weight: 3, style: "hatch" }),
  brick: Object.freeze({ name: "Brick", w: 4.6, l: 8.6, mass: 1.4, speed: 37, points: 100, dodge: 0.25, weight: 2.4, style: "van" }),
  frog: Object.freeze({ name: "Frog", w: 4.4, l: 7.1, mass: 0.9, speed: 41, points: 120, dodge: 0.6, weight: 2, style: "jeep" }),
  nudge: Object.freeze({ name: "Nudge", w: 4.2, l: 8.4, mass: 1.2, speed: 46, points: 150, dodge: 0.6, weight: 1.2, style: "muscle", behind: true }),
  hauler: Object.freeze({ name: "Hauler", w: 6, l: 12, mass: 8, speed: 30, points: 0, dodge: 0, weight: 1, style: "truck" }),
  sneak: Object.freeze({ name: "Sneak", w: 4.2, l: 8.4, mass: 1.1, speed: 45, points: 150, dodge: 0.7, weight: 1.2, style: "taxi" }),
  bruiser: Object.freeze({ name: "Bruiser", w: 4.8, l: 10.4, mass: 2.6, speed: 40, points: 180, dodge: 0.3, weight: 1, style: "pickup" }),
  racer: Object.freeze({ name: "Racer", w: 4, l: 7.6, mass: 0.9, speed: 64, points: 300, dodge: 0.9, weight: 0.8, style: "racer", behind: true }),
  cop: Object.freeze({ name: "Cop", w: 4.2, l: 8.6, mass: 1.6, speed: 52, points: 250, dodge: 0.65, weight: 0.9, style: "police", behind: true }),
  monster: Object.freeze({ name: "Monster", w: 9, l: 13, mass: 12, speed: 52, points: 0, dodge: 0, weight: 0, style: "monster" }),
});
export const RIVAL_KINDS = Object.freeze(Object.keys(RIVALS));
// A car this heavy gives no ground to a ram, and its back is a wall.
export const HEAVY = 4;

// Rivals spawn SPAWN_AHEAD to SPAWN_AHEAD + 40 units ahead of you (just over
// the board's top), one that comes from behind SPAWN_BEHIND under its
// bottom; they go once DROP_BEHIND behind you or DROP_AHEAD ahead.
const SPAWN_AHEAD = 84;
const SPAWN_BEHIND = 34;
export const DROP_BEHIND = 40;
export const DROP_AHEAD = 240;
// A rival looks LOOK_MIN plus LOOK_TIME seconds of its speed ahead for the
// road's narrowest stretch, keeps EDGE_GAP from its edges, steers at up to
// RIVAL_STEER, and hops a hole or a barrier HOP_LOOK ahead of its nose.
const LOOK_MIN = 10;
const LOOK_TIME = 0.35;
const EDGE_GAP = 1.2;
export const RIVAL_STEER = 24;
export const RIVAL_GAIN = 3;
export const RIVAL_ACCEL = 44;
const HOP_LOOK = 4;
const HOP_PAD = 7;
export const RIVAL_MIN_SPEED = 15;
// The pack stays close: a rival more than BAND_BEHIND behind you speeds up,
// one more than BAND_AHEAD ahead eases off, by up to BAND_MAX.
const BAND_BEHIND = 20;
const BAND_AHEAD = 110;
const BAND_MAX = 0.28;
// The Brick holds your lane from BRICK_RANGE behind it and brakes in front
// of you now and then; the Nudge chases for up to CHASE_MS at your speed
// plus NUDGE_CATCH and swipes up to 1 + 2 * sharp times; the Frog hops every
// FROG_EVERY plus up to FROG_SPREAD, quicker when sharper; the Zigzag weaves
// at ZIG_RATE.
const BRICK_RANGE = 46;
const BRICK_GAIN = 1.4;
const BRAKE_MS = 520;
export const BRAKE_REST_MS = 1500;
const BRAKE_REST_SPREAD = 1000;
const CHASE_MS = 7000;
const NUDGE_CATCH = 16;
export const FROG_AIR = 640;
const FROG_EVERY = 1500;
const FROG_SPREAD = 1300;
const ZIG_RATE = 1.1;
// The Cop chases at your speed plus COP_CATCH for up to COP_MS, sits beside
// you on the roomier side and leans in, to push you to the near edge. The
// Bruiser slams you when you come within BRUISER_RANGE. The Sneak drops a
// cone behind it every SNEAK_MS while you follow, up to SNEAK_DROPS. The
// Racer comes past at your speed plus RACER_CATCH, then flees at RACER_TOP.
const COP_CATCH = 18;
export const COP_MS = 9000;
const BRUISER_RANGE = 16;
const SNEAK_MS = 1200;
export const SNEAK_DROPS = 5;
const RACER_CATCH = 20;
const RACER_TOP = 74;
// The Monster keeps BOSS_AHEAD in front of you, hops every BOSS_HOP_MS
// (sooner when sharper) for BOSS_AIR, aimed to come down where you will be,
// and drops a tire every BOSS_DROP_MS.
export const BOSS_AHEAD = 34;
export const BOSS_HOP_MS = 3600;
export const BOSS_AIR = 1000;
const BOSS_DROP_MS = 2600;
export const BOSS_HP = 5;

// A car's state. `kind` is "you" or a rival's.
export function makeCar(id, kind, x, d, v) {
  const spec = kind === "you" ? null : RIVALS[kind];
  return {
    id,
    kind,
    x,
    d,
    v,
    vx: 0,
    kx: 0,
    w: spec ? spec.w : CAR_W,
    l: spec ? spec.l : CAR_L,
    mass: spec ? spec.mass : 1,
    air: 0,
    airMax: 0,
    jumpFrom: d,
    jumps: 0,
    out: 0,
    outKind: "",
    credit: 0,
    ghostMs: 0,
    pnose: d,
    slickMs: 0,
    bonkMs: 0,
    // Rivals: the lane they keep, the side of a flowerbed they took, their
    // own pace, the speed and spot they head for, and their kind's state.
    lane: x,
    side: 0,
    pace: 1,
    tv: v,
    tx: x,
    gain: RIVAL_GAIN,
    seed: id * 1.7,
    hopIn: FROG_EVERY,
    mode: spec && spec.behind ? "chase" : "",
    modeMs: 0,
    chaseMs: 0,
    offside: 1,
    swipes: 0,
    brakeIn: 0,
    dodge: 0,
    dodgeFor: -1,
    nearArmed: false,
    nearDone: false,
    dropIn: SNEAK_MS,
    drops: 0,
    hp: kind === "monster" ? BOSS_HP : 0,
    stunMs: 0,
    // You: the power-ups held, and what your jump flew over.
    spring: false,
    bubble: false,
    nitroMs: 0,
    boostMs: 0,
    megaMs: 0,
    rescueX: null,
    ramped: false,
    overs: [],
  };
}

// The narrowest stretch of the road from `from` to `to` on the side of a
// flowerbed the car keeps (chosen at the first sight of one, dropped when
// none is in view), a swaying bridge narrowed to the band it always covers,
// into SPAN.
function roadAhead(round, car, from, to) {
  const road = round.road;
  let lo = -Infinity;
  let hi = Infinity;
  let bed = false;
  for (let i = rowIn(road, from), last = rowIn(road, to); i <= last; i++) {
    let L = road.L[i];
    let R = road.R[i];
    if (road.deck[i] === 2) {
      const s = road.dyn[road.dynOf[i] - 1];
      const off = swayOff(s, round.clock);
      L = Math.max(L + s.amp, L + off);
      R = Math.min(R - s.amp, R + off);
      if (L > R) L = R = (road.L[i] + road.R[i]) / 2;
    }
    if (road.ML[i] < road.MR[i]) {
      if (!car.side) car.side = car.x < (road.ML[i] + road.MR[i]) / 2 ? -1 : 1;
      bed = true;
      lo = Math.max(lo, car.side < 0 ? L : road.MR[i]);
      hi = Math.min(hi, car.side < 0 ? road.ML[i] : R);
    } else {
      lo = Math.max(lo, L);
      hi = Math.min(hi, R);
    }
  }
  if (!bed) car.side = 0;
  SPAN.lo = lo;
  SPAN.hi = hi;
  return SPAN;
}

// The length of the hole (no deck, a drawbridge lifted, crumbled road)
// starting within `look` of `d`, or 0. A drawbridge counts as a hole all the
// time, lifted or not, so no rival is caught on one as it lifts.
function holeAhead(road, d, look, t) {
  for (let i = rowIn(road, d), last = rowIn(road, d + look); i <= last; i++) {
    const draw = road.dynOf[i] && road.dyn[road.dynOf[i] - 1].kind === "draw";
    if (!draw && !rowGone(road, i, t)) continue;
    let j = i;
    while (j < road.rows && (rowGone(road, j, t) || (road.dynOf[j] && road.dyn[road.dynOf[j] - 1].kind === "draw"))) j++;
    return (j - i) * ROW + (i * ROW - d);
  }
  return 0;
}

// The far end of a barrier, a fallen drop or a train track ahead of the
// nose within `look` and across the car's line, or 0: something to hop.
function thingAhead(round, car, nose, look) {
  const road = round.road;
  const blocking = (b) => !b.hit && b.d + b.l / 2 >= nose - 1 && b.d - b.l / 2 <= nose + look && Math.abs(b.x - car.x) < (b.w + car.w) / 2 + 1;
  for (let k = firstAt(road.blocks, "d", nose - 6); k < road.blocks.length && road.blocks[k].d - road.blocks[k].l / 2 <= nose + look; k++) {
    if (blocking(road.blocks[k])) return road.blocks[k].d + road.blocks[k].l / 2;
  }
  for (const b of round.drops) if (blocking(b)) return b.d + b.l / 2;
  for (let k = firstAt(road.hazards, "d", nose - 8); k < road.hazards.length && road.hazards[k].d < nose + look + 40; k++) {
    const h = road.hazards[k];
    if (h.kind !== "train" || h.d - h.half > nose + look + car.v * 0.15 || h.d + h.half < nose - 1) continue;
    // Hop the track when the train is on it, or will be by the time the
    // car is across.
    const tr = trainAt(h, round.clock + ((h.d - nose) / Math.max(car.v, 1)) * 1000);
    if (tr.warn) return h.d + h.half;
  }
  return 0;
}

// Whether the road from `d` to `look` ahead is plain enough for a Frog to
// hop on: no hole, water, flowerbed, timed part or narrowing to land off.
function plainAhead(road, d, look) {
  const i0 = rowIn(road, d);
  for (let i = i0, last = rowIn(road, d + look); i <= last; i++) {
    if (road.deck[i] !== 1 || road.under[i] !== GROUND.verge || road.ML[i] < road.MR[i] || road.dynOf[i]) return false;
    if (Math.abs(road.L[i] - road.L[i0]) > 3 || Math.abs(road.R[i] - road.R[i0]) > 3) return false;
  }
  return true;
}

// Whether the road round `d`, `reach` either way, is a bridge or has water
// beside it: no place for a rival to shove you, since a knock there drops
// you in the river.
export function nearWater(road, d, reach) {
  for (let i = rowIn(road, d - reach), last = rowIn(road, d + reach); i <= last; i++) {
    if (road.under[i] === GROUND.water || road.deck[i] !== 1) return true;
  }
  return false;
}

// Whether a ramp's lip is just ahead of a car's middle, in its lane, and it
// is quick enough to be launched off it.
function onRamp(road, car) {
  if (car.v < JUMP_MIN) return false;
  for (let k = firstAt(road.pads, "d", car.d - 10); k < road.pads.length && road.pads[k].d < car.d + 10; k++) {
    const p = road.pads[k];
    const lip = p.d + p.l / 2;
    if (p.kind === "ramp" && lip >= car.d && lip - car.d < car.l && Math.abs(car.x - p.x) <= p.w / 2 + 0.5) return true;
  }
  return false;
}

// Puts a rival in the air for `ms`, with a hop for the sound.
function hop(round, car, ms, type = "hop") {
  car.air = car.airMax = ms;
  car.jumpFrom = car.d;
  round.events.push({ type, id: car.id, kind: car.kind, x: car.x, d: car.d });
}

// A rival's choice for this slice: the speed it heads for, the spot across
// the road and how keenly, by its kind, kept inside the road just ahead.
// It slows behind a slower car in its way, swerves from under your landing
// when it is sharp enough, and hops a hole, a barrier or a train in its path.
export function think(round, car, ms, random = Math.random) {
  if (car.out > 0) return;
  const you = round.cars[0];
  const spec = RIVALS[car.kind];
  const stage = stageFor(round.stage);
  const sharp = stage.sharp || 0;
  const behind = car.d - you.d;
  let base = spec.speed * stage.pace * car.pace;
  if (car.kind !== "racer" && car.kind !== "monster") {
    if (behind < -BAND_BEHIND) base *= 1 + Math.min(BAND_MAX, (-behind - BAND_BEHIND) / 120);
    else if (behind > BAND_AHEAD) base *= 1 - Math.min(BAND_MAX, (behind - BAND_AHEAD) / 300);
  }
  const span = roadAhead(round, car, car.d - car.l / 2, car.d + car.l / 2 + LOOK_MIN + car.v * LOOK_TIME);
  let lo = span.lo + car.w / 2 + EDGE_GAP;
  let hi = span.hi - car.w / 2 - EDGE_GAP;
  if (lo > hi) lo = hi = (span.lo + span.hi) / 2;
  car.lane = clamp(car.lane, lo, hi);
  const mid = (lo + hi) / 2;
  let tx = car.lane;
  let tv = base;
  let gain = RIVAL_GAIN;
  const youHere = you.out === 0 && round.phase === "drive" && you.ghostMs <= 0;
  car.modeMs = Math.max(0, car.modeMs - ms);
  car.stunMs = Math.max(0, car.stunMs - ms);
  car.brakeIn = Math.max(0, car.brakeIn - ms);
  // The Bruiser and the Cop never shove you on a bridge or by the water.
  const wet = (car.kind === "bruiser" || car.kind === "cop") && (nearWater(round.road, you.d, you.l + 4) || nearWater(round.road, car.d, car.l));
  if (car.kind === "zigzag") {
    tx = mid + ((hi - lo) / 2) * Math.sin((round.clock / 1000) * ZIG_RATE * (1 + 0.6 * sharp) + car.seed);
    // A sharp Zigzag weaves into your path when you come up behind it.
    if (youHere && behind > 0 && behind < 40) tx += (you.x - tx) * 0.6 * sharp;
  } else if (car.kind === "brick") {
    if (youHere && behind > 0 && behind < BRICK_RANGE && you.air <= 0) {
      tx = you.x;
      gain = BRICK_GAIN * (1 + sharp);
      tv = clamp(you.v - 3, base * 0.75, base * 1.35);
      // A brake check now and then, right in front of you, and then a rest
      // of BRAKE_REST_MS to BRAKE_REST_MS + BRAKE_REST_SPREAD before another.
      if (car.mode !== "brake" && car.brakeIn <= 0 && behind < car.l + 10 && random() < sharp * 0.004 * ms) {
        car.mode = "brake";
        car.modeMs = BRAKE_MS;
        car.brakeIn = BRAKE_MS + BRAKE_REST_MS + random() * BRAKE_REST_SPREAD;
        round.events.push({ type: "brake", id: car.id, x: car.x, d: car.d });
      }
      if (car.mode === "brake" && car.modeMs > 0) tv = Math.max(RIVAL_MIN_SPEED, you.v * 0.5);
      else car.mode = "";
    }
  } else if (car.kind === "nudge" || car.kind === "cop") {
    const cop = car.kind === "cop";
    car.chaseMs += ms;
    const limit = cop ? COP_MS : CHASE_MS;
    if (car.mode === "chase" && (!youHere || behind > 14 || car.chaseMs > limit || car.swipes >= 1 + Math.round(2 * sharp) + (cop ? 1 : 0))) {
      car.mode = "calm";
      if (cop) round.events.push({ type: "copGone", id: car.id, x: car.x, d: car.d });
    }
    if (car.mode === "chase") {
      tv = Math.min(you.v + (cop ? COP_CATCH : NUDGE_CATCH), MAX_SPEED - 2);
      if (behind > -2) tv = you.v + 1;
      // The roomier side of you: from there a push sends you to the near edge.
      if (cop && car.modeMs <= 0) {
        const s = spanAt(round.road, you.x, you.d);
        car.offside = s.hi - you.x > you.x - s.lo ? 1 : -1;
        car.modeMs = 600;
      }
      const beside = you.x + car.offside * ((you.w + car.w) / 2 + 1.5);
      if (!cop && (beside < lo || beside > hi)) car.offside = -car.offside;
      const along = Math.abs(behind) < (you.l + car.l) * 0.4;
      tx = along && you.air <= 0 && !wet ? you.x + car.offside * (car.w / 2) : beside;
      gain = cop ? 3 : 2.4;
    } else if (cop) tv = base * 1.3;
  } else if (car.kind === "bruiser") {
    if (youHere && Math.abs(behind) < BRUISER_RANGE && you.air <= 0 && car.modeMs <= 0 && !wet) {
      tx = you.x;
      gain = 1.6 + 2 * sharp;
      tv = you.v;
    }
  } else if (car.kind === "sneak") {
    if (youHere && behind > 12 && behind < 90) {
      tx = you.x;
      gain = 1 + sharp;
      tv = Math.max(base, you.v + 2);
      car.dropIn -= ms;
      if (car.dropIn <= 0 && car.drops < SNEAK_DROPS && car.air <= 0) {
        car.dropIn = SNEAK_MS * (1.3 - 0.5 * sharp);
        car.drops++;
        round.drops.push({ kind: "cone", x: car.x, d: car.d - car.l / 2 - 2, w: 2.4, l: 2.4, hit: 0 });
        round.events.push({ type: "litter", id: car.id, x: car.x, d: car.d });
      }
    }
  } else if (car.kind === "racer") {
    if (car.mode === "chase") {
      tv = you.v + RACER_CATCH;
      if (behind > 50) car.mode = "flee";
    } else tv = RACER_TOP;
    tx = mid + ((hi - lo) / 3) * Math.sin(round.clock / 700 + car.seed);
  } else if (car.kind === "frog") {
    if (youHere && car.air > 0 && Math.abs(behind) < 25) tx = you.x + you.vx * (car.air / 1000);
    else if (youHere && Math.abs(behind) < 40) tx = car.lane + (you.x - car.lane) * (0.3 + 0.4 * sharp);
    car.hopIn -= ms;
    if (car.hopIn <= 0 && car.air <= 0) {
      car.hopIn = FROG_EVERY * (1.15 - 0.5 * sharp) + random() * FROG_SPREAD;
      if (plainAhead(round.road, car.d, 40)) hop(round, car, FROG_AIR);
    }
  } else if (car.kind === "hauler") {
    // It drifts over to block you when you come up behind it.
    if (youHere && behind > 0 && behind < 60) {
      tx = you.x;
      gain = 0.5 + sharp;
    }
  } else if (car.kind === "monster") {
    tv = you.v + clamp((you.d + BOSS_AHEAD - car.d) * 1.4, -26, 26);
    if (car.stunMs > 0) tv = Math.max(RIVAL_MIN_SPEED, you.v - 22);
    if (youHere) {
      tx = you.x;
      gain = 0.7 + 0.5 * sharp;
    }
    car.hopIn -= ms;
    car.dropIn -= ms;
    if (youHere && car.air <= 0 && car.hopIn <= 0 && car.stunMs <= 0 && Math.abs(behind) < 60) {
      car.hopIn = BOSS_HOP_MS * (1.2 - 0.4 * sharp) + random() * 900;
      // Up and back over you: it slows in the air to come down where you will be.
      hop(round, car, BOSS_AIR, "bossHop");
      car.v = clamp((you.d + you.v * (BOSS_AIR / 1000) - car.d) / (BOSS_AIR / 1000), RIVAL_MIN_SPEED, MAX_SPEED);
    }
    if (youHere && car.dropIn <= 0 && car.air <= 0) {
      car.dropIn = BOSS_DROP_MS * (1.2 - 0.4 * sharp);
      round.drops.push({ kind: "tire", x: car.x + (random() - 0.5) * car.w, d: car.d - car.l / 2 - 2, w: 3, l: 3, hit: 0 });
      round.events.push({ type: "litter", id: car.id, x: car.x, d: car.d });
    }
  }
  // Your landing: a sharp enough rival under it swerves away (a Frog hops).
  if (youHere && you.air > 0 && spec.dodge > 0 && car.air <= 0) {
    const t = you.air / 1000;
    const landD = you.d + you.v * t;
    const carD = car.d + car.v * t;
    if (Math.abs(landD - carD) < (car.l + you.l) / 2 + 2 && Math.abs(you.x - car.x) < (car.w + you.w) / 2 + 2) {
      if (car.dodgeFor !== you.jumps) {
        car.dodgeFor = you.jumps;
        car.dodge = random() < spec.dodge * sharp ? (car.x >= you.x ? 1 : -1) : 0;
        if (car.dodge && car.kind === "frog" && t > 0.25 && plainAhead(round.road, car.d, 30)) {
          hop(round, car, FROG_AIR);
          car.dodge = 0;
        }
      }
      if (car.dodge) {
        if ((car.dodge > 0 && car.x + 8 > hi) || (car.dodge < 0 && car.x - 8 < lo)) car.dodge = -car.dodge;
        tx = car.x + car.dodge * 9;
        gain = 4;
      }
    }
  }
  // A slower car in the way, just ahead: hold its speed, and a Frog edges its
  // lane round it. One that means to hit you never holds back for you.
  for (const o of round.cars) {
    if (o === car || o.out > 0 || o.air > 0) continue;
    const ahead = o.d - car.d;
    if (ahead <= 0 || ahead > (o.l + car.l) / 2 + 6 || Math.abs(o.x - car.x) > (o.w + car.w) / 2 + 0.5) continue;
    if (o.id === 0 && (car.mode === "chase" || car.kind === "bruiser" || car.kind === "monster")) continue;
    if (o.v < tv) tv = Math.max(RIVAL_MIN_SPEED, o.v);
    if (car.kind === "frog") car.lane = clamp(car.lane + (o.x < car.x ? 1 : -1) * 24 * (ms / 1000), lo, hi);
  }
  car.tx = clamp(tx, lo, hi);
  car.tv = Math.max(RIVAL_MIN_SPEED, tv);
  car.gain = gain;
  // A hole, a barrier or a train just ahead: hop it.
  if (car.air <= 0) {
    const nose = car.d + car.l / 2;
    const len = holeAhead(round.road, nose, HOP_LOOK, round.clock);
    const v = Math.max(car.v, RIVAL_MIN_SPEED);
    if (len > 0 && onRamp(round.road, car)) {
      // A ramp's lip just ahead in its lane: it flies off that instead.
    } else if (len > 0) hop(round, car, ((len + car.l + HOP_PAD) / v) * 1000);
    else {
      const end = thingAhead(round, car, nose, HOP_LOOK);
      if (end > 0) hop(round, car, Math.max(FROG_AIR * 0.7, ((end - car.d + car.l / 2 + 2) / v) * 1000));
    }
  }
}

// A new rival of `kind`: ahead of you just over the board's top, or one
// that comes from behind just under its bottom (or at `at`, when given), on
// plain road clear of holes, rivers and every other car. Null when no such
// spot turns up.
export function spawnRival(round, kind, random = Math.random, at = null) {
  const you = round.cars[0];
  const road = round.road;
  const spec = RIVALS[kind];
  for (let tries = 0; tries < 4; tries++) {
    const d = at !== null ? at + tries * 9 : spec.behind ? you.d - SPAWN_BEHIND - random() * 6 : you.d + SPAWN_AHEAD + random() * 40;
    ensureRoad(road, d);
    let ok = d > 0;
    for (let i = rowIn(road, d - 14), last = rowIn(road, d + 14); ok && i <= last; i++) ok = road.deck[i] === 1 && road.under[i] === GROUND.verge && !road.dynOf[i];
    if (!ok) continue;
    const span = spanAt(road, (road.L[rowIn(road, d)] + road.R[rowIn(road, d)]) / 2 + (random() - 0.5) * 20, d);
    const room = span.hi - span.lo - spec.w - 4;
    if (room < 0) continue;
    const x = span.lo + spec.w / 2 + 2 + random() * room;
    if (round.cars.some((o) => o.out === 0 && Math.abs(o.d - d) < (o.l + spec.l) / 2 + 8 && Math.abs(o.x - x) < (o.w + spec.w) / 2 + 3)) continue;
    const car = makeCar(round.nextId++, kind, clamp(x, spec.w / 2, FIELD_W - spec.w / 2), d, spec.speed * stageFor(round.stage).pace);
    car.pace = 0.92 + random() * 0.16;
    car.seed = random() * 6.28;
    car.hopIn = kind === "monster" ? BOSS_HOP_MS * 0.6 : FROG_EVERY * random() + 600;
    car.dropIn = kind === "monster" ? BOSS_DROP_MS : SNEAK_MS * (0.5 + random());
    car.offside = x < you.x ? -1 : 1;
    if (spec.behind) car.v = kind === "racer" ? you.v + RACER_CATCH : you.v;
    round.cars.push(car);
    round.events.push({ type: "spawn", id: car.id, kind, x: car.x, d: car.d });
    return car;
  }
  return null;
}

// Kinds only one of which is on the road at a time, and those that come up
// from behind only once you are quick enough to chase.
const ONE_AT_A_TIME = Object.freeze(new Set(["hauler", "nudge", "cop", "racer", "bruiser", "sneak"]));

// The kind to spawn next: weighted among the stage's.
export function pickKind(round, random) {
  const spec = stageFor(round.stage);
  const you = round.cars[0];
  let total = 0;
  const ok = (k) => {
    if (ONE_AT_A_TIME.has(k) && round.cars.some((c) => c.kind === k && c.out === 0)) return false;
    if (RIVALS[k].behind && you.v < 30) return false;
    return true;
  };
  for (const k of spec.kinds) if (ok(k)) total += RIVALS[k].weight;
  let roll = random() * total;
  for (const k of spec.kinds) {
    if (!ok(k)) continue;
    roll -= RIVALS[k].weight;
    if (roll < 0) return k;
  }
  return spec.kinds[0];
}

