// Plan2Code Web Console - Ghoul Rush's Blackmoor Sanatorium stage, its rules: the monsters of the ward (huge orderlies that grab and throw you, gurneys that rattle and roll, flickers you can only see when the lights go out, specimen bloaters lobbing jars of formaldehyde), the flickering lamps, Smelling Salts and the Bone Saw, and its boss, the Night Matron, as a stage pack that ghoul.js plugs in.
//
// Like the other stage packs (see ghoul-graveyard.js for what a pack holds,
// and ghoul-chapel.js for `tick`, `shot` and `stone`), every rule here is handed
// a kit `k` of ghoul.js's own helpers, so this file has no imports. The pack
// adds a few fields of its own that ghoul.js reads (besides the Chapel's
// `tick` and `shot`, used here for the lamps and for the Salts and the Saw):
//
// - `unseen`: by kind, `(round, m) => true` while a monster is out of sight.
//   ghoul.js asks each slice before the monster moves and keeps the answer in
//   `m.unseen`: an unseen monster is not solid, so bolts pass through it,
//   stomps and touch do nothing, and the aim ignores it. (Like `stone`, but
//   shots go through.) The drawing reads `m.unseen` too.
// - `harmless`: by kind, `(m) => true` while touching it hurts nothing (it can
//   still be shot and, if solid, hit). `hits()` skips it.
// - `platform`: by kind, `(m) => true` while Planny can stand on top of it (a
//   parked gurney): you walk onto it as onto a step of STEP_UP or less and
//   land on it from above. Only Planny uses it; monsters walk past.
// - `land`: by missile kind (a `round.bones` entry), `(round, b, floor, k)`
//   when it comes down on the ground; true when the pack dealt with it (the
//   jar, which breaks into a puddle) so ghoul.js leaves it at that. A missile
//   may carry a `cause` of its own, which is what its hit costs you.
//
// ghoul.js also gives Planny two things to be put out of control for a moment
// (`you.heldMs`: no key does anything while it is over 0, gravity still
// does; the pack refreshes it every slice it holds you) and a throw
// (`k.fling(round, dx, v)`: up at `v` and `dx` units across, no key does
// anything till you land), and the kit hands out `BONE_G`, the missiles' gravity.
//
// The flicker: in a room with `flicker` (ms; the Night Ward gets one from the
// Matron's rage) the lamps stutter every `flicker` ms or so, start to start
// (`flickerWarn`, STUTTER_MS), then go out for BLACKOUT_MS (`lightsOut`,
// `round.blackout` true), then come on again (`lightsOn`). `round.twist` holds
// { next, stage: "calm" | "stutter" | "out", left } for the drawing. In a
// blackout the room is drawn near black but for a glow around Planny, the
// glow of his bolts and what the Lantern lights.
//
// An orderly walks at you; within ORDERLY_NEAR of its edge it reaches
// (`reach`; jump out of it), then, if you are in its grasp, grabs (`hold`: you
// cannot move) and throws you ORDERLY_THROW_BACK across and up (`k.fling`).
// The throw costs no life, only a pit or a monster where you land does; it
// never hurts by touch. Smelling Salts break the grab at once. A gurney is
// parked (harmless, solid to bolts, a floor to stand on) until you come within
// GURNEY_NEAR; it rattles (`rattle`), rolls (`roll`, hurting) at you to a
// wall or an edge, rests (`rest`) and rolls back at you. A flicker creeps at
// you while unseen (lights on, outside the Lantern's light and the Salts'
// glow) and cannot be hit or touched; in a blackout, or lit, it shows
// (`flickerShow`) and lunges. A specimen bloater lobs a jar (`jarWind`) that
// breaks (`jarBreak`) into a puddle of formaldehyde (a hazard, ground level).
//
// Smelling Salts (a stage-only power-up, see ghoul-powers.js): break an
// orderly's grab, light the flickers near you (SALTS_GLOW) and double a bolt's
// damage to them. The Bone Saw: bolts pierce every monster in a line and a
// gurney breaks in one hit.
//
// The Night Matron stands at the ward's end with her lantern (`b.beam`: its
// origin, `angle`, `half` and `range`, sweeping slowly down across the ward;
// `b.heat`, 0 to 1, is how hot Planny is in it). In its light, heat builds
// (HEAT_MS to a life, cause `lantern`) and cools out of it; a medicine
// cabinet (the ward's two raised floor blocks, `b.cabinets`) between her
// lantern and you is cover, and a board above the beam is out of its reach.
// She throws a fan of syringes (`syringeWind`, `syringes`), and sends an arm
// through a wall at your height (`armWarn`, then `armReach`, cause `arm`:
// jump or drop out of it), in turn. At half her hp (`matronRage`) blackouts
// start, the arms come from both walls at once, the fan is five and she
// is quicker.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  orderly: freeze({ name: "Orderly", w: 5, h: 8, hp: 10, speed: 5, points: 400, stomp: false, head: false, color: "#aebcb4" }),
  gurney: freeze({ name: "Gurney", w: 7, h: 2.8, hp: 5, speed: 0, points: 150, stomp: false, head: false, color: "#9aa8a8" }),
  flicker: freeze({ name: "Flicker", w: 2.6, h: 5.2, hp: 2, speed: 7, points: 220, stomp: true, head: false, color: "#c8d4c0" }),
  specimen: freeze({ name: "Specimen Bloater", w: 4.2, h: 4.8, hp: 5, speed: 3, points: 250, stomp: false, head: true, color: "#8fc0a0" }),
});

// An orderly reaches once you are within ORDERLY_NEAR of its edge (and level
// with it), for ORDERLY_REACH_MS; if you are then within ORDERLY_GRAB of its
// edge and lower than ORDERLY_GRAB_H over its feet it holds you ORDERLY_HOLD_MS
// and throws you ORDERLY_THROW_BACK away at ORDERLY_THROW_V up. It rests
// ORDERLY_REST_MS after a throw, ORDERLY_MISS_MS after a miss and
// ORDERLY_STAGGER_MS after the Salts broke its grip. While it holds you it
// refreshes your `heldMs` by ORDERLY_KEEP_MS.
export const ORDERLY_NEAR = 3;
export const ORDERLY_GRAB = 4.4;
export const ORDERLY_GRAB_H = 3.4;
export const ORDERLY_REACH_MS = 450;
export const ORDERLY_HOLD_MS = 600;
export const ORDERLY_THROW_BACK = 14;
export const ORDERLY_THROW_V = 70;
export const ORDERLY_REST_MS = 1200;
export const ORDERLY_MISS_MS = 700;
export const ORDERLY_STAGGER_MS = 1500;
export const ORDERLY_KEEP_MS = 24;
// A gurney rattles GURNEY_RATTLE_MS once you are within GURNEY_NEAR of it
// along its floor, rolls at GURNEY_V to a wall or an edge, rests
// GURNEY_REST_MS and rolls back at you, or parks again when you are over
// GURNEY_GIVE_UP away.
export const GURNEY_NEAR = 18;
export const GURNEY_RATTLE_MS = 500;
export const GURNEY_V = 54;
export const GURNEY_REST_MS = 1500;
export const GURNEY_GIVE_UP = 40;
// A flicker creeps at its speed unseen and lunges at FLICKER_LUNGE shown. It
// is shown in a blackout, within LANTERN_LIGHT of you while you hold the
// Lantern, and within SALTS_GLOW of you while you hold the Salts; the Salts
// double a bolt's damage to it.
export const FLICKER_LUNGE = 22;
export const LANTERN_LIGHT = 34;
export const SALTS_GLOW = 22;
export const SALTS_DOUBLE = 2;
// The lamps: the first stutter comes FLICKER_FIRST of a period into the room
// (of the fight, in the ward), they stutter STUTTER_MS and are out
// BLACKOUT_MS; the ward's rage blackouts come every RAGE_BLACKOUT_MS.
export const FLICKER_FIRST = 0.6;
export const STUTTER_MS = 700;
export const BLACKOUT_MS = 1800;
export const RAGE_BLACKOUT_MS = 9000;
// A specimen keeps JAR_KEEP from you, lobs a jar every JAR_MS or so within
// JAR_RANGE (JAR_WIND_MS to swell first); it breaks into a puddle
// FORMALDEHYDE_W wide and FORMALDEHYDE_H high that burns FORMALDEHYDE_MS, at most
// FORMALDEHYDE_CAP about.
export const JAR_KEEP = 22;
export const JAR_MS = 2300;
export const JAR_WIND_MS = 450;
export const JAR_RANGE = 54;
export const FORMALDEHYDE_W = 3.2;
export const FORMALDEHYDE_H = 0.9;
export const FORMALDEHYDE_MS = 2500;
export const FORMALDEHYDE_CAP = 5;

// The Night Matron. She walks to HOME_FROM_END short of the room's end at
// MATRON_WALK. Her lantern is BEAM_ORIGIN_X in front of her and BEAM_ORIGIN_Y
// over her feet, its cone BEAM_HALF either side of its axis and BEAM_RANGE
// long; the axis points down and ahead, DEP_MIN to DEP_MAX below level,
// sweeping back and forth in BEAM_SWEEP_MS (BEAM_SWEEP_RAGE_MS in her rage).
// You heat up in the cone over HEAT_MS and cool in COOL_MS. She rests IDLE_MS,
// then in turn winds up SYRINGE_WIND_MS and throws a fan (SYRINGE_FAN of them,
// SYRINGE_FAN_RAGE in the rage) landing SYRINGE_SPREAD apart around you at
// up to SYRINGE_VX across, rests SYRINGE_REST_MS; or sends an arm (ARM_H thick,
// at your feet's height) through the far wall (both walls in the rage) after
// ARM_WARN_MS of a crack of light, shooting at ARM_V across the arena and
// holding ARM_HOLD_MS, and rests ARM_REST_MS. At RAGE of her hp her waits are
// RAGE_QUICK times as long.
export const BOSSES = freeze({
  matron: freeze({ name: "The Night Matron", sub: "Stay out of her lantern light", w: 8, h: 16, hp: 100, points: 3500, color: "#c9d6cc" }),
});
export const HOME_FROM_END = 12;
export const MATRON_WALK = 8;
export const BEAM_ORIGIN_X = 3.5;
export const BEAM_ORIGIN_Y = 8;
export const BEAM_HALF = 0.17;
export const BEAM_RANGE = 76;
export const DEP_MIN = 0.14;
export const DEP_MAX = 0.9;
export const BEAM_SWEEP_MS = 7000;
export const BEAM_SWEEP_RAGE_MS = 5000;
export const HEAT_MS = 600;
export const COOL_MS = 1000;
export const IDLE_MS = 1500;
export const SYRINGE_WIND_MS = 500;
export const SYRINGE_REST_MS = 900;
export const SYRINGE_FAN = 3;
export const SYRINGE_FAN_RAGE = 5;
export const SYRINGE_SPREAD = 9;
export const SYRINGE_VX = 64;
export const ARM_WARN_MS = 700;
export const ARM_V = 260;
export const ARM_H = 3.4;
export const ARM_HOLD_MS = 120;
export const ARM_REST_MS = 900;
export const RAGE = 0.5;
export const RAGE_QUICK = 0.75;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const inView = (round, m, k) => m.x > round.camX - 2 && m.x < round.camX + k.FIELD_W + 2;
// Planny's middle, over his feet.
const MID = 2.2;

/* ------------------------------------------------------------ monsters */

function moveOrderly(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dx = you.x - m.x;
  const gap = Math.abs(dx) - m.w / 2;
  if (m.act === "reach") {
    m.wait -= ms;
    m.dir = Math.sign(dx) || m.dir;
    if (m.wait > 0) return;
    // Caught if you are still in its grasp and low enough: a jump is out of it.
    if (gap <= ORDERLY_GRAB && you.y - m.y < ORDERLY_GRAB_H && you.out <= 0) {
      m.act = "hold";
      m.wait = ORDERLY_HOLD_MS;
      you.heldMs = ORDERLY_KEEP_MS;
      round.events.push({ type: "orderlyGrab", kind: m.kind, x: m.x, y: m.y + m.h * 0.6 });
      return;
    }
    m.act = "rest";
    m.wait = ORDERLY_MISS_MS;
    return;
  }
  if (m.act === "hold") {
    // The Salts break the grip at once; else it throws you after its hold.
    if (round.effects.salts > 0 || you.out > 0) {
      m.act = "rest";
      m.wait = ORDERLY_STAGGER_MS;
      you.heldMs = 0;
      if (you.out <= 0) round.events.push({ type: "saltsBreak", kind: m.kind, x: m.x, y: m.y + m.h * 0.6 });
      return;
    }
    you.heldMs = ORDERLY_KEEP_MS;
    m.wait -= ms;
    if (m.wait > 0) return;
    const away = Math.sign(dx) || m.dir;
    k.fling(round, away * ORDERLY_THROW_BACK, ORDERLY_THROW_V);
    you.heldMs = 0;
    m.act = "rest";
    m.wait = ORDERLY_REST_MS;
    round.events.push({ type: "orderlyThrow", kind: m.kind, x: you.x, y: you.y + 3, dir: away });
    return;
  }
  if (m.act === "rest") {
    m.wait -= ms;
    if (m.wait <= 0) m.act = "walk";
    return;
  }
  k.walk(round, m, k.towardYou(round, m), MONSTERS.orderly.speed * round.spec.pace, ms / 1000);
  if (gap > ORDERLY_NEAR || Math.abs(you.y - m.y) > ORDERLY_GRAB_H + 1 || you.out > 0) return;
  m.act = "reach";
  m.wait = ORDERLY_REACH_MS;
  m.dir = Math.sign(dx) || m.dir;
  round.events.push({ type: "orderlyReach", kind: m.kind, x: m.x + m.dir * m.w * 0.6, y: m.y + m.h * 0.6 });
}

function moveGurney(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dx = you.x - m.x;
  if (m.act === "parked") {
    if (Math.abs(dx) > GURNEY_NEAR || Math.abs(you.y - m.y) > 6 || you.out > 0) return;
    m.act = "rattle";
    m.wait = GURNEY_RATTLE_MS;
    round.events.push({ type: "gurneyRattle", kind: m.kind, x: m.x, y: m.y + m.h });
    return;
  }
  const roll = () => {
    m.act = "roll";
    m.dir = Math.sign(you.x - m.x) || m.dir;
    round.events.push({ type: "gurneyRoll", kind: m.kind, x: m.x, y: m.y + m.h, dir: m.dir });
  };
  if (m.act === "rattle") {
    m.wait -= ms;
    if (m.wait <= 0) roll();
    return;
  }
  if (m.act === "rest") {
    m.wait -= ms;
    if (m.wait > 0) return;
    if (Math.abs(dx) > GURNEY_GIVE_UP) m.act = "parked";
    else roll();
    return;
  }
  // Rolling: on along its floor, until a wall, a step or an edge is ahead.
  const nx = m.x + m.dir * GURNEY_V * spec.pace * (ms / 1000);
  if (Math.abs(k.groundAt(spec, nx + (m.dir * m.w) / 2) - m.y) > 0.01) {
    m.act = "rest";
    m.wait = GURNEY_REST_MS;
    round.events.push({ type: "gurneyRest", kind: m.kind, x: m.x, y: m.y + m.h });
    return;
  }
  m.x = nx;
}

// Whether a flicker is out of sight just now: lights on, and neither in the
// Lantern's light nor in the Salts' glow.
function flickerUnseen(round, m) {
  // Flash Powder shows it a while (ghoul-arms.js).
  if (round.blackout || m.litMs > 0) return false;
  const you = round.you;
  const d = Math.hypot(m.x - you.x, m.y + m.h / 2 - (you.y + MID));
  if (round.effects.lantern > 0 && d <= LANTERN_LIGHT) return false;
  if (round.effects.salts > 0 && d <= SALTS_GLOW) return false;
  return true;
}

function moveFlicker(round, m, ms, k) {
  const shown = !m.unseen;
  if (shown && !m.shown && inView(round, m, k)) round.events.push({ type: "flickerShow", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  m.shown = shown;
  if (shown && m.act !== "lunge" && inView(round, m, k)) round.events.push({ type: "flickerLunge", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  m.act = shown ? "lunge" : "creep";
  k.walk(round, m, k.towardYou(round, m), (shown ? FLICKER_LUNGE : MONSTERS.flicker.speed) * round.spec.pace, ms / 1000);
}

function moveSpecimen(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  m.dir = k.towardYou(round, m);
  if (m.windup > 0) {
    m.windup = Math.max(0, m.windup - ms);
    if (!m.windup) {
      const jar = k.throwBone(round, m.x + m.dir * 1.8, m.y + m.h * 0.7, 1, "jar", m.kind);
      jar.cause = "formaldehyde";
    }
    return;
  }
  const dx = you.x - m.x;
  if (Math.abs(dx) > JAR_KEEP) k.walk(round, m, m.dir, MONSTERS.specimen.speed * spec.pace, ms / 1000);
  if (!inView(round, m, k) || Math.abs(dx) > JAR_RANGE || Math.abs(dx) < 6) return;
  m.throwIn -= ms * spec.pace;
  if (m.throwIn > 0) return;
  m.throwIn = JAR_MS * (0.85 + (m.id % 4) * 0.1);
  m.windup = JAR_WIND_MS;
  round.events.push({ type: "jarWind", kind: m.kind, x: m.x, y: m.y + m.h * 0.5 });
}

// A puddle of formaldehyde where something broke (the oldest goes if there
// are too many).
function puddleAt(round, x, y, how) {
  const puddles = round.hazards.filter((h) => h.kind === "formaldehyde");
  if (puddles.length >= FORMALDEHYDE_CAP) round.hazards.splice(round.hazards.indexOf(puddles[0]), 1);
  round.hazards.push({ kind: "formaldehyde", x, y, w: FORMALDEHYDE_W, h: FORMALDEHYDE_H, live: FORMALDEHYDE_MS, max: FORMALDEHYDE_MS, cause: "formaldehyde" });
  round.events.push({ type: "jarBreak", kind: "specimen", x, y, how });
}

// A jar comes down: it breaks into a puddle.
function jarLands(round, b, floor) {
  puddleAt(round, b.x, floor, "jar");
  return true;
}

// A specimen shot to nothing breaks its own jar under it.
function shatter(round, m) {
  puddleAt(round, m.x, m.y, "death");
}

// A puddle only waits out its time. Returns whether it is still on the field.
function stepPuddle(round, h, ms) {
  h.live -= ms;
  return h.live > 0;
}

/* ------------------------------------------------------------ the lamps */

// The lamps, every `flicker` ms of a room that has one (of the ward, in the
// Matron's rage): they stutter, go out and come on again.
function tick(round, ms, k) {
  const spec = round.spec;
  const b = round.boss;
  if (b && b.state === "down") {
    round.blackout = false;
    return;
  }
  if (b && b.state !== "fight") return;
  const period = spec.flicker || (b && b.kind === "matron" && b.raged ? RAGE_BLACKOUT_MS : 0);
  if (!period) {
    round.blackout = false;
    return;
  }
  const tw = (round.twist ||= { next: period * FLICKER_FIRST, stage: "calm", left: 0 });
  const at = { x: round.camX + k.FIELD_W / 2, y: k.CHANDELIER_Y };
  tw.next -= ms;
  if (tw.stage === "calm") {
    if (tw.next > 0) return;
    tw.next += period;
    tw.stage = "stutter";
    tw.left = STUTTER_MS;
    round.events.push({ type: "flickerWarn", ...at, ms: STUTTER_MS });
    return;
  }
  tw.left -= ms;
  if (tw.left > 0) return;
  if (tw.stage === "stutter") {
    tw.stage = "out";
    tw.left = BLACKOUT_MS;
    round.blackout = true;
    round.events.push({ type: "lightsOut", ...at, ms: BLACKOUT_MS });
  } else {
    tw.stage = "calm";
    round.blackout = false;
    round.events.push({ type: "lightsOn", ...at });
  }
}

/* ------------------------------------------------------ salts and the saw */

// What a bolt does beside its own damage: the Salts double it on a flicker, the
// Saw breaks a gurney in one hit (and says so: how "saw").
function shotRule(round, m, s, k, random) {
  if (m.kind === "gurney" && round.effects.saw > 0) {
    k.hurt(round, m, 99, "saw", random);
    return 0;
  }
  // The saw's bolt goes on through (ghoul.js); each monster it cuts is told.
  if (round.effects.saw > 0) round.events.push({ type: "sawCut", kind: m.kind, x: s.x, y: s.y });
  if (m.kind === "flicker" && round.effects.salts > 0) return SALTS_DOUBLE;
  return 1;
}

/* ------------------------------------------------------- the Night Matron */

const rage = (b) => b.hp <= b.max * RAGE;
const quick = (round, b, ms) => (ms * (b.raged ? RAGE_QUICK : 1)) / round.spec.pace;

// Whether the point (x, y) is in the cone of `beam`.
export function inBeam(beam, x, y) {
  const dx = x - beam.x;
  const dy = y - beam.y;
  if (Math.hypot(dx, dy) > beam.range) return false;
  const d = Math.atan2(dy, dx) - beam.angle;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) <= beam.half;
}

// Whether the ground (a medicine cabinet) is between the lantern and (x, y).
export function shadowed(spec, beam, x, y, groundAt) {
  const n = Math.ceil(Math.hypot(x - beam.x, y - beam.y));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (groundAt(spec, beam.x + (x - beam.x) * t) > beam.y + (y - beam.y) * t) return true;
  }
  return false;
}

// The raised floor blocks in the arena: the medicine cabinets, as [x0, x1, top].
function cabinetsOf(spec) {
  const floor = Math.min(...spec.ground.filter((g) => g[1] > spec.arena).map((g) => g[2]));
  return spec.ground.filter((g) => g[0] >= spec.arena && g[2] > floor + 3).map((g) => [g[0], g[1], g[2]]);
}

// Calls an arm (two, in the rage) at your height: a crack of light at the wall
// first. Returns how long until it is gone.
function callArm(round, b, k) {
  const spec = round.spec;
  const you = round.you;
  const y = you.y - 0.2;
  const mid = (spec.arena + spec.length) / 2;
  const walls = b.raged ? [-1, 1] : [you.x < mid ? 1 : -1];
  for (const side of walls) {
    const wall = side < 0 ? spec.arena : spec.length;
    const span = spec.length - spec.arena;
    round.hazards.push({ kind: "arm", x: wall, y, w: 0, h: ARM_H, side, wall, dirx: side < 0 ? 1 : -1, span, len: 0, warn: ARM_WARN_MS, hold: ARM_HOLD_MS, live: 0, cause: "arm" });
    round.events.push({ type: "armWarn", kind: b.kind, x: wall, y: y + ARM_H / 2, side, ms: ARM_WARN_MS });
  }
  return ARM_WARN_MS + ((spec.length - spec.arena) / ARM_V) * 1000 + ARM_HOLD_MS;
}

// A fan of syringes, landing SYRINGE_SPREAD apart around where you stand.
function throwSyringes(round, b, k) {
  const you = round.you;
  const n = b.raged ? SYRINGE_FAN_RAGE : SYRINGE_FAN;
  const ox = b.x + b.dir * 2.5;
  const oy = b.y + 9;
  for (let i = 0; i < n; i++) {
    const tx = clamp(you.x + (i - (n - 1) / 2) * SYRINGE_SPREAD, round.spec.arena + 1, round.spec.length - 1);
    const ty = you.y + k.SHOT_Y;
    const t = clamp(Math.abs(tx - ox) / SYRINGE_VX, 0.35, 1.4);
    const s = k.throwBone(round, ox, oy, 1, "syringe", b.kind);
    s.vx = (tx - ox) / t;
    s.vy = (ty - oy + 0.5 * k.BONE_G * t * t) / t;
    s.cause = "syringe";
  }
  round.events.push({ type: "syringes", kind: b.kind, x: ox, y: oy, n });
}

function moveMatron(round, b, ms, random, k) {
  const spec = round.spec;
  const you = round.you;
  const dt = ms / 1000;
  if (!b.act) {
    Object.assign(b, { act: "walk", wait: 0, heat: 0, phase: 0, turn: 0, sweep: -1, cabinets: cabinetsOf(spec) });
  }
  b.dir = -1;
  if (!b.raged && rage(b)) {
    b.raged = true;
    round.events.push({ type: "matronRage", kind: b.kind, x: b.x, y: b.y + b.h / 2 });
  }
  // The lantern: its axis sweeps down across the ward and back.
  b.phase += ((Math.PI * 2) * ms) / (b.raged ? BEAM_SWEEP_RAGE_MS : BEAM_SWEEP_MS);
  // A short cue at the start of each sweep.
  if (Math.floor(b.phase / (Math.PI * 2)) !== b.sweep) {
    b.sweep = Math.floor(b.phase / (Math.PI * 2));
    round.events.push({ type: "matronBeam", kind: b.kind, x: b.x + b.dir * BEAM_ORIGIN_X, y: b.y + BEAM_ORIGIN_Y });
  }
  const dep = (DEP_MIN + DEP_MAX) / 2 + ((DEP_MAX - DEP_MIN) / 2) * Math.sin(b.phase);
  const beam = (b.beam ||= { x: 0, y: 0, angle: 0, half: BEAM_HALF, range: BEAM_RANGE, dep, on: false, blocked: false });
  Object.assign(beam, { x: b.x + b.dir * BEAM_ORIGIN_X, y: b.y + BEAM_ORIGIN_Y, angle: b.dir < 0 ? Math.PI + dep : -dep, dep });
  // Heat: it builds while you stand in the light (and nothing is in the way),
  // and cools when you do not.
  const mid = you.y + k.HIT_H / 2;
  const cone = you.out <= 0 && inBeam(beam, you.x, mid);
  beam.blocked = cone && shadowed(spec, beam, you.x, mid, k.groundAt);
  beam.on = cone && !beam.blocked && you.safeMs <= 0;
  const cold = b.heat <= 0;
  b.heat = beam.on ? Math.min(1, b.heat + ms / HEAT_MS) : Math.max(0, b.heat - ms / COOL_MS);
  if (cold && b.heat > 0) round.events.push({ type: "matronHeat", kind: b.kind, x: you.x, y: you.y + MID });
  if (b.heat >= 1) {
    b.heat = 0;
    k.struck(round, "lantern");
    return;
  }
  if (b.act === "walk") {
    const home = spec.length - HOME_FROM_END;
    const step = MATRON_WALK * dt;
    if (Math.abs(home - b.x) > step) {
      b.x += Math.sign(home - b.x) * step;
      return;
    }
    b.x = home;
    b.act = "idle";
    b.wait = quick(round, b, IDLE_MS);
    return;
  }
  b.wait -= ms;
  if (b.wait > 0) return;
  if (b.act === "idle") {
    b.turn++;
    if (b.turn % 2) {
      b.act = "syringeWind";
      b.wait = quick(round, b, SYRINGE_WIND_MS);
      round.events.push({ type: "syringeWind", kind: b.kind, x: b.x + b.dir * 2.5, y: b.y + 9 });
    } else {
      b.act = "rest";
      b.wait = callArm(round, b, k) + quick(round, b, ARM_REST_MS);
    }
  } else if (b.act === "syringeWind") {
    throwSyringes(round, b, k);
    b.act = "rest";
    b.wait = quick(round, b, SYRINGE_REST_MS);
  } else if (b.act === "rest") {
    b.act = "idle";
    b.wait = quick(round, b, IDLE_MS);
  }
}

// An arm: a crack of light at the wall for `warn`, then it shoots across the
// ward at ARM_V, holds, and is gone. Returns whether it is still on the field.
function stepArm(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = 1;
    round.events.push({ type: "armReach", kind: "matron", x: h.wall, y: h.y + h.h / 2, side: h.side });
  }
  if (h.len < h.span) h.len = Math.min(h.span, h.len + (ARM_V * ms) / 1000);
  else if ((h.hold -= ms) <= 0) return false;
  h.w = h.len;
  h.x = h.wall + (h.dirx * h.len) / 2;
  return true;
}

export const SANATORIUM = freeze({
  id: "sanatorium",
  monsters: MONSTERS,
  walkers: freeze(["orderly", "flicker", "specimen"]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze(["flicker"]),
  act: freeze({ orderly: "walk", gurney: "parked", flicker: "creep" }),
  solid: freeze({}),
  // Unseen, a flicker is neither hit nor touched; an orderly never hurts and a
  // gurney only while it rolls; a parked gurney is a floor to stand on.
  unseen: freeze({ flicker: flickerUnseen }),
  harmless: freeze({ orderly: () => true, gurney: (m) => m.act !== "roll" }),
  platform: freeze({ gurney: (m) => m.act !== "roll" }),
  land: freeze({ jar: jarLands }),
  move: freeze({ orderly: moveOrderly, gurney: moveGurney, flicker: moveFlicker, specimen: moveSpecimen }),
  kill: freeze({ specimen: shatter }),
  horde: freeze({}),
  tick,
  shot: shotRule,
  bosses: BOSSES,
  boss: freeze({ matron: moveMatron }),
  cause: freeze({ matron: () => "matron" }),
  hazards: freeze({ formaldehyde: stepPuddle, arm: stepArm }),
});
