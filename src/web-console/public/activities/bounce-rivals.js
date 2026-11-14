// Plan2Code Web Console - Bounce Road's rivals: the kinds and what each is like (the plain cars, the ones with a trick of their own, the friendly supply truck and the five bosses), a car's starting state, where a new rival goes on the road, which kind comes next, and each rival's choice of speed and line every slice (blocking, ramming, chasing, dodging your landings, littering, shooting, hopping the holes, and each boss's fight).
//
// Rules only: bounce.js moves the cars, bumps them and settles their
// landings; this file decides what a rival wants. Every rival keeps to the
// road on its own: it steers for the narrowest stretch just ahead (its side
// of a flowerbed, the middle of a swaying bridge), hops any hole, barrier or
// train in its way (every toy on Bounce Road has a spring), and holds a
// slower car's speed, so no rival stops or sticks. How keenly it blocks,
// rams and dodges grows with the stage's `sharp`.

import { CAR_L, CAR_W, FIELD_W, GROUND, JUMP_MIN, MAX_SPEED, ROW, SPAN, ballX, ensureRoad, firstAt, laserAt, rowGone, rowIn, spanAt, stageFor, swayOff, trainAt } from "./bounce-road.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The rivals, in the order they are introduced. `w` and `l` are the box,
// `mass` how hard it is to shove, `speed` its own pace before the stage's,
// `points` what flattening it scores, `dodge` how readily it swerves from
// under your landing (times the stage's sharpness), `weight` how often it
// comes, `style` the car it is drawn as, and `behind` true for one that
// comes up from under the board. A rival with no `points` cannot be
// flattened: its roof is a trampoline. The later kinds each have a trick:
// the Blaster shoots back down the road, the Slasher's blades cut you when
// it leans in, the Spike's roof is a crash to land on (`spiky`), the Bomber
// leaves lit bombs, the Phantom fades out of reach, the Splitter bursts into
// two Minis when flattened, the Magnet drags you toward it, and the Supply
// truck is a friend (`friend`): land on its roof for a power-up. A `boss`
// has `hp` landings in it and its own fight.
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
  monster: Object.freeze({ name: "Monster", w: 9, l: 13, mass: 12, speed: 52, points: 0, dodge: 0, weight: 0, style: "monster", boss: true, hp: 5, hint: "Land on its roof" }),
  blaster: Object.freeze({ name: "Blaster", w: 4.2, l: 8.2, mass: 1.1, speed: 44, points: 200, dodge: 0.5, weight: 1, style: "coupe", hint: "It shoots back. Jump the bolts" }),
  slasher: Object.freeze({ name: "Slasher", w: 4.2, l: 8.6, mass: 1.3, speed: 48, points: 250, dodge: 0.6, weight: 0.9, style: "sedan", behind: true, hint: "Blades out: keep off its sides" }),
  spike: Object.freeze({ name: "Spike", w: 4.8, l: 7.8, mass: 1.5, speed: 36, points: 200, dodge: 0, weight: 1.1, style: "armor", spiky: true, hint: "Never land on it. Bump it off" }),
  bomber: Object.freeze({ name: "Bomber", w: 4.4, l: 7.4, mass: 1.1, speed: 45, points: 220, dodge: 0.6, weight: 1, style: "buggy", hint: "Steer round its bombs, or jump them" }),
  phantom: Object.freeze({ name: "Phantom", w: 4.2, l: 7.6, mass: 1, speed: 43, points: 220, dodge: 0.5, weight: 0.9, style: "bubble", hint: "Hit it while you can see it" }),
  splitter: Object.freeze({ name: "Splitter", w: 5, l: 11, mass: 2.2, speed: 35, points: 150, dodge: 0.15, weight: 0.9, style: "bus", hint: "Flatten it and two Minis pop out" }),
  mini: Object.freeze({ name: "Mini", w: 3, l: 4.8, mass: 0.6, speed: 54, points: 80, dodge: 0.3, weight: 0, style: "mini" }),
  magnet: Object.freeze({ name: "Magnet", w: 4.6, l: 8.6, mass: 1.6, speed: 42, points: 220, dodge: 0.4, weight: 0.9, style: "tow", hint: "It drags you over. Steer away" }),
  supply: Object.freeze({ name: "Supply truck", w: 5.6, l: 11, mass: 3, speed: 40, points: 0, dodge: 0, weight: 0, style: "supply", friend: true }),
  tanker: Object.freeze({ name: "Big Rig", w: 7, l: 17, mass: 12, speed: 52, points: 0, dodge: 0, weight: 0, style: "tanker", boss: true, hp: 4, hint: "Dodge the barrels. Land on its roof" }),
  vac: Object.freeze({ name: "Robo-Vac", w: 10, l: 10, mass: 10, speed: 52, points: 0, dodge: 0, weight: 0, style: "vac", boss: true, hp: 4, hint: "Jump on it when it charges" }),
  chopper: Object.freeze({ name: "Whirlybird", w: 8, l: 11, mass: 6, speed: 52, points: 0, dodge: 0, weight: 0, style: "chopper", boss: true, hp: 4, hint: "Dodge the bombs. Stomp it when it swoops" }),
  cat: Object.freeze({ name: "The Cat", w: 11, l: 12, mass: 14, speed: 52, points: 0, dodge: 0, weight: 0, style: "paw", boss: true, hp: 6, hint: "Jump its paw as it sweeps, and land on it" }),
});
export const RIVAL_KINDS = Object.freeze(Object.keys(RIVALS));
export const BOSS_KINDS = Object.freeze(RIVAL_KINDS.filter((k) => RIVALS[k].boss));
export const isBoss = (car) => car.kind !== "you" && RIVALS[car.kind].boss === true;
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
// The Blaster lines up on you from BLAST_NEAR to BLAST_FAR ahead, glows for
// AIM_MS and fires a bolt back down the road, then reloads for RELOAD_MS.
const BLAST_NEAR = 26;
const BLAST_FAR = 76;
export const AIM_MS = 650;
const RELOAD_MS = 2300;
export const BOLT_SPEED = 62;
// The Slasher chases like a Nudge for up to SLASH_MS; once alongside, its
// blades glint for BLADE_WARN_MS, then stay out for BLADE_MS (a side touch
// is a crash) and rest for BLADE_REST_MS.
const SLASH_MS = 10000;
export const BLADE_WARN_MS = 550;
export const BLADE_MS = 1500;
const BLADE_REST_MS = 1700;
// The Bomber drops a bomb every BOMBER_MS while you follow BOMB_NEAR to
// BOMB_FAR behind it, up to BOMBER_DROPS; each blows BOMB_FUSE_MS after it
// lands, BOMB_R round.
const BOMBER_MS = 1700;
export const BOMBER_DROPS = 4;
const BOMB_NEAR = 34;
const BOMB_FAR = 96;
export const BOMB_FUSE_MS = 1350;
export const BOMB_R = 8;
// The Phantom is solid for PHASE_ON_MS, then out of reach for PHASE_OFF_MS.
export const PHASE_ON_MS = 2500;
export const PHASE_OFF_MS = 1500;
// The Magnet holds your speed within MAG_RANGE for up to MAG_MS, keeping to
// the road's edge so its pull drags you toward it.
export const MAG_RANGE = 26;
const MAG_MS = 6500;
// The Supply truck keeps SUPPLY_AHEAD in front of you for SUPPLY_MS, then
// drives off.
const SUPPLY_AHEAD = 30;
const SUPPLY_MS = 14000;
// The bosses. The Big Rig keeps TANKER_AHEAD in front and lobs a barrel at
// where you are heading every TANKER_DROP_MS (an oil spill in between). The
// Robo-Vac sweeps from edge to edge VAC_AHEAD in front, then warns for
// VAC_WARN_MS and charges back down the road at you, VAC_CHARGE slower than
// you, every VAC_EVERY_MS. The Whirlybird flies out of reach for
// CHOPPER_HIGH_MS, bombing where you are heading every CHOPPER_BOMB_MS, then
// swoops down to the road for CHOPPER_LOW_MS. The Cat's paw slams down like
// the Monster every CAT_HOP_MS, then sweeps across the road for CAT_SWIPE_MS.
// A thing lobbed lands LOB_MS after it is thrown.
export const TANKER_AHEAD = 44;
const TANKER_DROP_MS = 2500;
// A boss that kept your speed could never be landed on (a jump holds your
// speed), so each comes back to you in its own way. The Big Rig brake-checks
// every TANKER_BRAKE_EVERY_MS: TANKER_BRAKE slower than you for
// TANKER_BRAKE_MS, its back a wall and its roof in reach. The Whirlybird's
// swoop drifts back at CHOPPER_DRIFT, and the Cat's paw sweeps CAT_DRIFT
// slower than you.
export const TANKER_BRAKE_MS = 1200;
const TANKER_BRAKE_EVERY_MS = 5200;
const TANKER_BRAKE = 26;
const CHOPPER_DRIFT = 16;
const CAT_DRIFT = 6;
export const VAC_AHEAD = 42;
export const VAC_WARN_MS = 850;
const VAC_CHARGE = 46;
const VAC_EVERY_MS = 4200;
export const CHOPPER_AHEAD = 38;
export const CHOPPER_HIGH_MS = 4400;
export const CHOPPER_LOW_MS = 3000;
const CHOPPER_BOMB_MS = 1150;
export const CAT_HOP_MS = 2900;
export const CAT_SWIPE_MS = 1700;
const CAT_STEER = 36;
export const LOB_MS = 950;
export const LOB_R = 7;

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
    hp: spec && spec.hp ? spec.hp : 0,
    stunMs: 0,
    // The later kinds' own state: how fast the car may steer, a Blaster's
    // aim, a Slasher's blades ("", "warn" or "out"), a Phantom out of reach,
    // a boss flying (`lift` 0 on the road to 1 up high), a car zapped or
    // spinning on oil, and a boss driving through you on its way back.
    steer: RIVAL_STEER,
    aimMs: 0,
    blade: "",
    bladeMs: 0,
    phased: false,
    phaseIn: PHASE_ON_MS,
    lift: 0,
    high: false,
    thru: false,
    zapMs: 0,
    spinMs: 0,
    wasAir: false,
    gave: false,
    // You: the gadget held ({ kind, uses } or null) and what is running.
    held: null,
    magnetMs: 0,
    pounding: false,
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
  // A laser that will be on, or a roller that will be across the car's
  // line, by the time it gets there.
  for (let k = firstAt(road.hazards, "d", nose - 4); k < road.hazards.length && road.hazards[k].d < nose + look + 12; k++) {
    const h = road.hazards[k];
    if (h.d < nose - 1 || h.d - 2 > nose + look + car.v * 0.1) continue;
    const at = round.clock + ((h.d - nose) / Math.max(car.v, 1)) * 1000;
    if (h.kind === "laser" && laserAt(h, at).warn) return h.d + h.half;
    if (h.kind === "roller" && Math.abs(ballX(h, at) - car.x) < h.half + car.w / 2 + 1.5) return h.d + h.r;
  }
  return 0;
}

// A thing thrown at where you are heading: it lands LOB_MS on, on the road
// just ahead of you (`boom`: it blows up LOB_R round; else it lies there).
export function lob(round, from, what, boom = 0) {
  const you = round.cars[0];
  const road = round.road;
  const d = you.d + Math.max(you.v, 20) * (LOB_MS / 1000) + 2;
  ensureRoad(road, d);
  const i = rowIn(road, d);
  const x = clamp(you.x + you.vx * 0.3, road.L[i] + 3, road.R[i] - 3);
  round.lobs.push({ x, d, at: round.clock + LOB_MS, what, boom, w: boom ? 4 : 4.4, l: boom ? 4 : 4.4, fx: from.x, fd: from.d });
  round.events.push({ type: "lob", id: from.id, what, x, d });
}

// A boss's speed to sit `ahead` of you.
const paceTo = (you, car, ahead) => you.v + clamp((you.d + ahead - car.d) * 1.4, -26, 26);

// A boss sweeping from edge to edge between `lo` and `hi`.
function sweep(car, lo, hi) {
  if (car.offside > 0 && car.x > hi - 1.5) car.offside = -1;
  else if (car.offside < 0 && car.x < lo + 1.5) car.offside = 1;
  return car.offside > 0 ? hi : lo;
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
  const stage = stageFor(round.stage, round.road);
  const sharp = stage.sharp || 0;
  const behind = car.d - you.d;
  let base = spec.speed * stage.pace * car.pace;
  // Zapped, or spinning on your oil: it coasts where it points, sees nothing
  // and hops nothing, so a hole or the road's edge takes it.
  if (car.zapMs > 0 || car.spinMs > 0) {
    car.zapMs = Math.max(0, car.zapMs - ms);
    car.spinMs = Math.max(0, car.spinMs - ms);
    car.tv = Math.max(RIVAL_MIN_SPEED, base * 0.6);
    car.tx = car.x;
    car.gain = 0;
    car.blade = "";
    car.aimMs = 0;
    return;
  }
  if (car.kind !== "racer" && car.kind !== "mini" && !spec.boss && !spec.friend) {
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
  car.steer = RIVAL_STEER;
  const youHere = you.out === 0 && round.phase === "drive" && you.ghostMs <= 0;
  const landed = car.wasAir && car.air <= 0;
  car.wasAir = car.air > 0;
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
  } else if (car.kind === "spike") {
    // It sits in your lane and dares you to jump on it.
    if (youHere && behind > 0 && behind < 46 && you.air <= 0) {
      tx = you.x;
      gain = 0.9 + sharp;
      tv = clamp(you.v - 6, base * 0.8, base * 1.3);
    }
  } else if (car.kind === "splitter") {
    if (youHere && behind > 0 && behind < 60) {
      tx = you.x;
      gain = 0.5 + 0.6 * sharp;
    }
  } else if (car.kind === "mini") {
    tx = mid + ((hi - lo) / 2) * Math.sin(round.clock / 420 + car.seed);
    gain = 4;
  } else if (car.kind === "blaster") {
    const inRange = youHere && behind > BLAST_NEAR && behind < BLAST_FAR;
    if (inRange) {
      tx = you.x;
      gain = 1.2 + sharp;
      tv = clamp(you.v + (behind < 44 ? 6 : -4), base * 0.8, base * 1.4);
    }
    car.dropIn -= ms;
    if (car.aimMs > 0) {
      car.aimMs -= ms;
      if (car.aimMs <= 0) {
        car.aimMs = 0;
        car.dropIn = RELOAD_MS * (1.3 - 0.5 * sharp);
        if (car.air <= 0) {
          round.bolts.push({ x: car.x, d: car.d - car.l / 2 - 1, v: car.v - BOLT_SPEED, from: car.id });
          round.events.push({ type: "bolt", id: car.id, x: car.x, d: car.d });
        }
      }
    } else if (inRange && car.dropIn <= 0 && car.air <= 0 && Math.abs(you.x - car.x) < 9) {
      car.aimMs = AIM_MS;
      round.events.push({ type: "aim", id: car.id, x: car.x, d: car.d });
    }
  } else if (car.kind === "slasher") {
    car.chaseMs += ms;
    if (car.mode === "chase" && (!youHere || behind > 16 || car.chaseMs > SLASH_MS)) {
      car.mode = "calm";
      car.blade = "";
    }
    if (car.mode === "chase") {
      tv = Math.min(you.v + NUDGE_CATCH, MAX_SPEED - 2);
      if (behind > -2) tv = you.v + 1;
      const beside = you.x + car.offside * ((you.w + car.w) / 2 + 1.8);
      if (beside < lo || beside > hi) car.offside = -car.offside;
      const along = Math.abs(behind) < (you.l + car.l) * 0.45;
      // Alongside: the blades glint, come out, and it leans in; then a rest.
      car.bladeMs -= ms;
      if (car.blade === "" && along && car.bladeMs <= 0) {
        car.blade = "warn";
        car.bladeMs = BLADE_WARN_MS;
        round.events.push({ type: "blade", id: car.id, x: car.x, d: car.d });
      } else if (car.blade === "warn" && car.bladeMs <= 0) {
        car.blade = "out";
        car.bladeMs = BLADE_MS;
      } else if (car.blade === "out" && car.bladeMs <= 0) {
        car.blade = "";
        car.bladeMs = BLADE_REST_MS * (1.2 - 0.4 * sharp);
      }
      tx = along && car.blade === "out" && you.air <= 0 ? you.x + car.offside * (car.w / 2) : beside;
      gain = 2.6;
    } else tv = base * 1.3;
  } else if (car.kind === "bomber") {
    if (youHere && behind > 12 && behind < BOMB_FAR) {
      tx = you.x;
      gain = 1 + sharp;
      tv = Math.max(base, you.v + 3);
      car.dropIn -= ms;
      if (car.dropIn <= 0 && car.drops < BOMBER_DROPS && car.air <= 0 && behind > BOMB_NEAR) {
        car.dropIn = BOMBER_MS * (1.3 - 0.5 * sharp);
        car.drops++;
        round.bombs.push({ x: car.x, d: car.d - car.l / 2 - 2, at: round.clock + BOMB_FUSE_MS, t0: round.clock, r: BOMB_R });
        round.events.push({ type: "bomb", id: car.id, x: car.x, d: car.d });
      }
    }
  } else if (car.kind === "phantom") {
    tx = mid + ((hi - lo) / 2) * Math.sin((round.clock / 1000) * 0.9 + car.seed);
    if (youHere && behind > 0 && behind < 46) tx += (you.x - tx) * (0.5 + 0.4 * sharp);
    car.phaseIn -= ms;
    if (car.phaseIn <= 0) {
      car.phased = !car.phased;
      car.phaseIn = car.phased ? PHASE_OFF_MS : PHASE_ON_MS * (1.2 - 0.3 * sharp);
      round.events.push({ type: "phase", id: car.id, x: car.x, d: car.d, on: car.phased });
    }
  } else if (car.kind === "magnet") {
    car.chaseMs += youHere && Math.abs(behind) < MAG_RANGE ? ms : 0;
    if (car.mode !== "calm" && car.chaseMs > MAG_MS) car.mode = "calm";
    // Hard against the nearer edge, and at your speed while it has you.
    tx = car.x < mid ? lo : hi;
    gain = 2;
    if (car.mode === "calm") tv = base * 1.3;
    else if (youHere && Math.abs(behind) < MAG_RANGE + 14) tv = clamp(you.v + (behind < 0 ? 8 : -4), RIVAL_MIN_SPEED, MAX_SPEED - 2);
  } else if (car.kind === "supply") {
    car.chaseMs += ms;
    tx = mid;
    gain = 1.2;
    if (car.gave || car.chaseMs > SUPPLY_MS) tv = MAX_SPEED - 4;
    else if (youHere) tv = clamp(paceTo(you, car, SUPPLY_AHEAD), RIVAL_MIN_SPEED, MAX_SPEED - 4);
  } else if (car.kind === "tanker") {
    tv = paceTo(you, car, TANKER_AHEAD);
    if (car.stunMs > 0) tv = Math.max(RIVAL_MIN_SPEED, you.v - 20);
    if (youHere) {
      tx = you.x;
      gain = 0.5 + 0.4 * sharp;
    }
    // The brake check: its brake lights on, and back it comes.
    if (car.mode === "brake" && car.modeMs > 0 && behind > car.l / 2 + 4) tv = Math.max(RIVAL_MIN_SPEED, you.v - TANKER_BRAKE);
    else if (car.mode === "brake") car.mode = "";
    else if (youHere && car.brakeIn <= 0 && car.stunMs <= 0 && car.air <= 0 && behind > 30) {
      car.mode = "brake";
      car.modeMs = TANKER_BRAKE_MS;
      car.brakeIn = TANKER_BRAKE_MS + TANKER_BRAKE_EVERY_MS * (1.2 - 0.3 * sharp);
      round.events.push({ type: "brake", id: car.id, kind: car.kind, x: car.x, d: car.d });
    }
    car.dropIn -= ms;
    if (youHere && car.dropIn <= 0 && car.air <= 0 && car.stunMs <= 0 && car.mode !== "brake" && behind > 16) {
      const rage = car.hp <= 2 ? 0.7 : 1;
      car.dropIn = TANKER_DROP_MS * (1.25 - 0.4 * sharp) * rage;
      car.drops++;
      if (car.drops % 3 === 0) {
        round.spills.push({ x: car.x, d: car.d - car.l / 2 - 5, w: 9, l: 11, until: round.clock + 7000, foe: true });
        round.events.push({ type: "litter", id: car.id, x: car.x, d: car.d, what: "oil" });
      } else lob(round, car, "barrel");
    }
  } else if (car.kind === "vac") {
    car.thru = false;
    if (car.stunMs > 0 && car.mode !== "back") car.mode = "back";
    if (car.mode === "warn") {
      tv = paceTo(you, car, VAC_AHEAD);
      tx = you.x;
      gain = 2.4;
      if (car.modeMs <= 0) {
        car.mode = "charge";
        car.lane = car.x;
        round.events.push({ type: "bossCharge", id: car.id, x: car.x, d: car.d });
      }
    } else if (car.mode === "charge") {
      tv = Math.max(RIVAL_MIN_SPEED, you.v - VAC_CHARGE);
      tx = clamp(car.lane, lo, hi);
      if (!youHere || behind < -14) car.mode = "back";
    } else if (car.mode === "back") {
      // Back up the road, through anything, to sweep again.
      car.thru = behind < 20;
      tv = car.stunMs > 0 ? Math.max(RIVAL_MIN_SPEED, you.v - 12) : you.v + 30;
      tx = you.x > mid ? lo : hi;
      gain = 2.5;
      if (behind > VAC_AHEAD - 8 && car.stunMs <= 0) {
        car.mode = "sweep";
        car.hopIn = VAC_EVERY_MS * (1.2 - 0.4 * sharp) + random() * 800;
      }
    } else {
      car.mode = "sweep";
      tv = paceTo(you, car, VAC_AHEAD);
      tx = sweep(car, lo, hi);
      gain = 3;
      car.hopIn -= ms;
      if (youHere && car.hopIn <= 0 && car.air <= 0 && behind > 20) {
        car.mode = "warn";
        car.modeMs = VAC_WARN_MS;
        round.events.push({ type: "bossWarn", id: car.id, kind: car.kind, x: car.x, d: car.d });
      }
    }
  } else if (car.kind === "chopper") {
    if (car.mode !== "low") {
      // Up high: over your line, bombing where you are heading.
      car.mode = "high";
      car.lift = Math.min(1, car.lift + ms / 500);
      tv = paceTo(you, car, CHOPPER_AHEAD);
      if (youHere) {
        tx = you.x;
        gain = 1.4;
      }
      car.dropIn -= ms;
      car.hopIn -= ms;
      if (youHere && car.dropIn <= 0 && car.lift >= 1) {
        car.dropIn = CHOPPER_BOMB_MS * (1.25 - 0.4 * sharp);
        lob(round, car, "bomb", LOB_R);
      }
      if (youHere && car.hopIn <= 0 && car.stunMs <= 0) {
        car.mode = "low";
        car.modeMs = CHOPPER_LOW_MS;
        round.events.push({ type: "bossWarn", id: car.id, kind: car.kind, x: car.x, d: car.d });
      }
    } else {
      // Down on the road: sweeping across as it drifts back to you, there
      // to be stomped; past you, or out of time, up it goes.
      car.lift = Math.max(0, car.lift - ms / 450);
      tv = Math.max(RIVAL_MIN_SPEED, you.v - CHOPPER_DRIFT);
      tx = sweep(car, lo, hi);
      gain = 2.4;
      if (car.modeMs <= 0 || car.stunMs > 0 || behind < 4) {
        car.mode = "high";
        car.hopIn = CHOPPER_HIGH_MS * (1.15 - 0.3 * sharp);
        car.dropIn = 700;
      }
    }
    car.high = car.lift > 0.35;
  } else if (car.kind === "cat") {
    tv = paceTo(you, car, BOSS_AHEAD - 6);
    if (car.stunMs > 0) tv = Math.max(RIVAL_MIN_SPEED, you.v - 22);
    if (landed && car.stunMs <= 0) {
      car.mode = "swipe";
      car.modeMs = CAT_SWIPE_MS;
      car.offside = car.x < mid ? 1 : -1;
      round.events.push({ type: "swipe", id: car.id, x: car.x, d: car.d });
    }
    if (car.mode === "swipe" && car.modeMs > 0 && car.stunMs <= 0) {
      tx = sweep(car, lo, hi);
      gain = 4;
      car.steer = CAT_STEER;
      if (behind > 8) tv = Math.max(RIVAL_MIN_SPEED, you.v - CAT_DRIFT);
    } else {
      car.mode = "stalk";
      if (youHere) {
        tx = you.x;
        gain = 0.8 + 0.5 * sharp;
      }
      car.hopIn -= ms;
      if (youHere && car.air <= 0 && car.hopIn <= 0 && car.stunMs <= 0 && Math.abs(behind) < 60) {
        car.hopIn = CAT_HOP_MS * (1.2 - 0.4 * sharp) + random() * 700;
        hop(round, car, BOSS_AIR * 0.9, "bossHop");
        car.v = clamp((you.d + you.v * ((BOSS_AIR * 0.9) / 1000) + 6 - car.d) / ((BOSS_AIR * 0.9) / 1000), RIVAL_MIN_SPEED, MAX_SPEED);
      }
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
  if (youHere && you.air > 0 && spec.dodge > 0 && car.air <= 0 && !car.phased) {
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
    if (o === car || o.out > 0 || o.air > 0 || o.high || o.phased || o.thru || car.high || car.thru || car.phased) continue;
    const ahead = o.d - car.d;
    if (ahead <= 0 || ahead > (o.l + car.l) / 2 + 6 || Math.abs(o.x - car.x) > (o.w + car.w) / 2 + 0.5) continue;
    if (o.id === 0 && (car.mode === "chase" || car.kind === "bruiser" || spec.boss)) continue;
    if (o.v < tv) tv = Math.max(RIVAL_MIN_SPEED, o.v);
    if (car.kind === "frog") car.lane = clamp(car.lane + (o.x < car.x ? 1 : -1) * 24 * (ms / 1000), lo, hi);
  }
  car.tx = clamp(tx, lo, hi);
  car.tv = Math.max(RIVAL_MIN_SPEED, tv);
  car.gain = gain;
  // A hole, a barrier or a train just ahead: hop it (never a boss in flight).
  if (car.air <= 0 && !car.high) {
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
    const car = makeCar(round.nextId++, kind, clamp(x, spec.w / 2, FIELD_W - spec.w / 2), d, spec.speed * stageFor(round.stage, round.road).pace);
    car.pace = 0.92 + random() * 0.16;
    car.seed = random() * 6.28;
    car.hopIn = kind === "monster" ? BOSS_HOP_MS * 0.6 : kind === "cat" ? CAT_HOP_MS * 0.7 : kind === "vac" ? VAC_EVERY_MS * 0.7 : kind === "chopper" ? CHOPPER_HIGH_MS : FROG_EVERY * random() + 600;
    car.dropIn = kind === "monster" ? BOSS_DROP_MS : kind === "tanker" ? TANKER_DROP_MS * 0.8 : kind === "chopper" ? CHOPPER_BOMB_MS * 1.6 : kind === "blaster" ? RELOAD_MS * 0.5 : kind === "bomber" ? BOMBER_MS * 0.6 : SNEAK_MS * (0.5 + random());
    car.phaseIn = PHASE_ON_MS * (0.5 + random() * 0.6);
    if (kind === "tanker") car.brakeIn = TANKER_BRAKE_EVERY_MS * 0.6;
    if (kind === "chopper") {
      car.lift = 1;
      car.high = true;
      car.mode = "high";
    }
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
const ONE_AT_A_TIME = Object.freeze(new Set(["hauler", "nudge", "cop", "racer", "bruiser", "sneak", "blaster", "slasher", "spike", "bomber", "phantom", "splitter", "magnet"]));
// A kind new to the stage comes this much more often.
const FRESH_WEIGHT = 2.6;

// The kind to spawn next: weighted among the stage's.
export function pickKind(round, random) {
  const spec = stageFor(round.stage, round.road);
  const you = round.cars[0];
  let total = 0;
  const ok = (k) => {
    if (ONE_AT_A_TIME.has(k) && round.cars.some((c) => c.kind === k && c.out === 0)) return false;
    if (RIVALS[k].behind && you.v < 30) return false;
    return true;
  };
  const weight = (k) => RIVALS[k].weight * (spec.fresh && spec.fresh.includes(k) ? FRESH_WEIGHT : 1);
  for (const k of spec.kinds) if (ok(k)) total += weight(k);
  let roll = random() * total;
  for (const k of spec.kinds) {
    if (!ok(k)) continue;
    roll -= weight(k);
    if (roll < 0) return k;
  }
  return spec.kinds[0];
}

