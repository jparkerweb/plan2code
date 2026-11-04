// Plan2Code Web Console - Ghoul Rush's finale, its rules for the finale's second kill, Marrow, Every Room at Once (the Eye), as a pack core/ghoul-tables.js lists in PACKS.
//
// No imports: every rule is handed the kit `k` (see stages/marrow/ghoul-marrow.js and
// stages/bog/ghoul-bog.js for what a pack holds), and draws its randomness only from
// the `random` handed to the boss's fight.
//
// EVERY ROOM AT ONCE. The House with its front torn off: a dollhouse cutaway filling the
// arena, three floors (EYE_FLOORS) of three rooms (EYE_COLS, EYE_ROOM_W wide) with a
// stair of landings at each end. Somewhere in it the Eye opens, one room at a time:
//
// - THE EYE (`b.eye`): shut a while (EYE_SHUT_MS), then a room's lamp flares
//   (EYE_FLARE_MS, a step of the flare heard at FLARE_AT) and the wallpaper splits:
//   the Eye stares out for EYE_OPEN_MS, then shuts (EYE_CLOSE_MS) and moves on, never to
//   the room it just left. Bolts fly level, so YOU must be on its floor: a bolt through
//   its open box hurts it (`eyeShot`, the pack's target), one through it while it flares
//   or shuts clanks (`bossBlock`). Its real box sits far out of reach and is always
//   guarded, as the lawn's house's is. In its last phase two lamps flare and only one is true.
// - SHADES (`eyeShade`): a door in a room creaks open (EYE_DOOR_MS, an `eyeDoorway`
//   hazard) and a pale shade of a keeper YOU beat this run steps out, small, with a few
//   hp, gone again after SHADE_LIFE_MS, at most SHADE_CAP at once. Each has one move of
//   its own (SHADE_MOVES), with a wind-up first; a new stage's boss needs a row there.
// - THE LURCH (`b.lurch`): every so often the House creaks (EYE_CREAK_MS) and lurches
//   one way for EYE_LURCH_MS: YOU slide that way (EYE_PUSH, stopped at the end walls),
//   and a loose dresser (`eyeDresser`) slides down YOUR floor at YOU: jump it, or shoot
//   it apart.
//
// Its phase is 0 at first, 1 below two thirds of its hp, 2 below a third.
//
// THE KILL. The last hit bursts the Eye: a real boss kill (a life, the points,
// `hurtBoss`). Then `b.t` runs the scene (`retreatStep`): the wallpaper of every room
// falls away, the floors crack one after another from the top, a wet gasp (no false
// win this time: it is hurt now), and it sinks into the cellar, leaving a stairway of
// bones down through its front door. Only then can YOU reach that door (`b.gone`).

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const BOSSES = freeze({
  marroweye: freeze({ name: "Marrow, Every Room at Once", sub: "Make yourself at home", w: 30, h: 30, hp: 110, points: 7000, color: "#e8c84a" }),
});

// The shades' monster: small and pale, a few hp (SHADE_HP, more with the room's toughness).
export const MONSTERS = freeze({
  eyeShade: freeze({ name: "Shade", w: 3, h: 4.6, hp: 6, speed: 0, points: 300, stomp: false, head: false, color: "#cfe0f2" }),
});

/* ------------------------------------------------------------- the house */

// The dollhouse fills the arena: EYE_COLS rooms across, each EYE_ROOM_W wide, on the
// floors EYE_FLOORS (the room's ground, then two full-width shelves), under a ceiling
// at EYE_CEIL. A floor's slab is EYE_SLAB thick under its top.
export const EYE_COLS = 3;
export const EYE_ROOM_W = 32;
export const EYE_FLOORS = freeze([6, 20, 34]);
export const EYE_CEIL = 48;
export const EYE_SLAB = 1.6;
export const EYE_ROOMS = EYE_COLS * EYE_FLOORS.length;

// Room `i` (0 to 8, left to right along the ground floor, then up): its edges, its
// floor, the underside of the floor over it, and its middle.
export function roomBox(spec, i) {
  const col = i % EYE_COLS;
  const row = Math.floor(i / EYE_COLS);
  const x0 = spec.arena + col * EYE_ROOM_W;
  const floor = EYE_FLOORS[row];
  const top = row + 1 < EYE_FLOORS.length ? EYE_FLOORS[row + 1] - EYE_SLAB : EYE_CEIL;
  return { i, col, row, x0, x1: x0 + EYE_ROOM_W, floor, top, cx: x0 + EYE_ROOM_W / 2 };
}

// Which floor (0 to 2) a height stands on or over: a landing counts as the floor under it.
export const rowOf = (y) => (y >= EYE_FLOORS[2] ? 2 : y >= EYE_FLOORS[1] ? 1 : 0);

// The Eye in a room's back wall: EYE_W wide, from EYE_LO to EYE_HI over the floor, so a
// bolt from that floor, standing (2.4) or ducked (1.4), goes through it.
export const EYE_W = 5.6;
export const EYE_LO = 0.6;
export const EYE_HI = 6.2;
export const eyeAt = (spec, i) => {
  const r = roomBox(spec, i);
  return { x: r.cx, y: r.floor + (EYE_LO + EYE_HI) / 2 };
};

// The Eye's clock: how long it stays shut between rooms (by phase), how long a lamp
// flares first (a second step heard at FLARE_AT of it), how long it stays open (by
// phase), and how long it takes to shut.
export const EYE_SHUT_MS = freeze([1500, 1200, 1000]);
export const EYE_FLARE_MS = 1100;
export const FLARE_AT = 0.55;
export const EYE_OPEN_MS = freeze([4200, 3400, 2800]);
export const EYE_CLOSE_MS = 400;
// Below these shares of its hp it is in its second phase, then its third.
export const PHASE_HP = freeze([2 / 3, 1 / 3]);
export const phaseOf = (b) => (b.hp > b.max * PHASE_HP[0] ? 0 : b.hp > b.max * PHASE_HP[1] ? 1 : 2);

/* ------------------------------------------------------------ the shades */

// Each keeper's shade and its one move. Every boss of every stage needs a row (the
// suite checks): a shade of one without falls back to SHADE_FALLBACK.
export const SHADE_MOVES = freeze({
  gourd: "hop", // a hop that sends a floor ripple each way
  bones: "skull", // a thrown skull that comes back
  angel: "creep", // moves only while YOU look away
  keeper: "scythe", // a long low scythe sweep
  choirmaster: "note", // a note fired along its floor
  matron: "dash", // a dash along its floor, needle first
  beast: "leap", // a leap at where YOU stand
  tommy: "knock", // knocks: rocks fall one, two, three toward YOU
  ringmaster: "hoop", // a hoop rolled along its floor
  frostwidow: "icicles", // icicles drop from the ceiling over YOU
  motherbog: "mud", // a wave of mud along its floor
});
export const SHADE_FALLBACK = "note";
// A practice round (no keepers beaten yet) still meets three.
export const PRACTICE_SHADES = freeze(["gourd", "matron", "frostwidow"]);
// The keepers whose shades this round may call up: those beaten this run.
export function shadesOf(round, k) {
  const beaten = (round.cleared || []).map((id) => k.stageById(id)?.boss).filter((id) => id && id !== "marroweye");
  return beaten.length ? beaten : PRACTICE_SHADES;
}

export const SHADE_HP = 6;
// A door creaks open EYE_DOOR_MS before its shade steps out; a shade fades in over
// SHADE_IN_MS and out over SHADE_OUT_MS (harmless and unhittable both ways), lives
// SHADE_LIFE_MS in all, and waits SHADE_IDLE_MS between moves (SHADE_FIRST_MS the first).
export const EYE_DOOR_MS = 900;
export const SHADE_IN_MS = 600;
export const SHADE_OUT_MS = 500;
export const SHADE_LIFE_MS = 6500;
export const SHADE_IDLE_MS = 700;
export const SHADE_FIRST_MS = 250;
export const SHADE_REST_MS = 600;
// At most this many shades (and doors about to let one out) at once, by phase; a new
// door every SHADE_EVERY_MS (by phase, less at depth); none nearer YOU than SHADE_CLEAR
// on YOUR floor. SHADE_YOUR_FLOOR is how often it comes out on YOUR floor.
export const SHADE_CAP = freeze([1, 2, 2]);
export const SHADE_EVERY_MS = freeze([4200, 3600, 3000]);
export const SHADE_FIRST_DOOR_MS = 2600;
export const SHADE_CLEAR = 16;
export const SHADE_YOUR_FLOOR = 0.6;
// Each move's wind-up: what YOU see and hear before it can hurt.
export const SHADE_WIND = freeze({ hop: 900, skull: 900, scythe: 1100, note: 900, dash: 1000, leap: 1000, knock: 1000, hoop: 900, icicles: 700, mud: 1000 });
// The moves' numbers. A floor thing (ripple, note, hoop, mud) runs along the shade's
// floor at its speed for at most its reach; a skull flies out SKULL_REACH and back at
// the height of YOUR chest (duck it); the scythe sweeps SCYTHE_W beside the shade for
// SCYTHE_LIVE_MS; the matron dashes DASH_REACH at DASH_SPEED; the beast leaps LEAP_MS
// and its landing hurts for POUNCE_MS; rocks and icicles warn ROCK_WARN_MS and
// ICICLE_WARN_MS where they will land, then fall FALL_MS; the angel creeps at
// ANGEL_SPEED while YOU face away from it.
export const RIPPLE = freeze({ w: 1.4, h: 1.6, speed: 24, reach: 60 });
export const NOTE = freeze({ w: 1.6, h: 1.8, speed: 22, reach: 70 });
export const HOOP = freeze({ w: 1.2, h: 3.4, speed: 26, reach: 70 });
export const MUD = freeze({ w: 3, h: 2.4, speed: 15, reach: 40 });
export const HOP_MS = 450;
export const HOP_UP = 5;
export const SKULL_W = 1.5;
export const SKULL_H = 1.4;
export const SKULL_UP = 2.9;
export const SKULL_SPEED = 28;
export const SKULL_REACH = 30;
export const SCYTHE_W = 13;
export const SCYTHE_H = 1.5;
export const SCYTHE_LIVE_MS = 220;
export const DASH_SPEED = 42;
export const DASH_REACH = 34;
export const LEAP_MS = 560;
export const LEAP_UP = 8;
export const POUNCE_W = 5;
export const POUNCE_H = 2;
export const POUNCE_MS = 220;
export const ROCK_W = 2.2;
export const ROCK_H = 2;
export const ROCK_STEP = 6;
export const ROCK_WARN_MS = 900;
export const ICICLE_W = 1.4;
export const ICICLE_H = 2.4;
export const ICICLE_GAP = 6;
export const ICICLE_WARN_MS = 1300;
export const FALL_MS = 260;
export const ANGEL_SPEED = 15;

/* -------------------------------------------------------------- the lurch */

// The House lurches every EYE_LURCH_EVERY_MS (by phase; the first after
// EYE_LURCH_FIRST_MS): a creak of EYE_CREAK_MS (a second at CREAK_AT of it), then
// EYE_LURCH_MS of sliding: YOU at EYE_PUSH a second (on a floor, never in the air),
// a dresser down YOUR floor at DRESSER_SPEED. A dresser takes DRESSER_HP bolts.
export const EYE_LURCH_EVERY_MS = freeze([9500, 8000, 6500]);
export const EYE_LURCH_FIRST_MS = 7000;
export const EYE_CREAK_MS = 1300;
export const CREAK_AT = 0.5;
export const EYE_LURCH_MS = 2000;
export const EYE_PUSH = 14;
export const DRESSER_W = 3.6;
export const DRESSER_H = 4.2;
export const DRESSER_SPEED = 34;
export const DRESSER_HP = 3;
export const DRESSER_CLEAR = 8;
// YOU are kept this far inside the house's end walls by a lurch.
export const WALL_PAD = 1.2;

/* --------------------------------------------------------------- the kill */

// The retreat's clock, in ms of `b.t` after the kill: the wallpaper peels, the floors
// crack from the top (CRACK_AT, one each), a wet gasp, it sinks, and it is gone.
export const PEEL_AT = 600;
export const CRACK_AT = freeze([1600, 2100, 2600]);
export const GASP_AT = 3500;
export const SINK_AT = 4700;
export const GONE_AT = 7200;
// Until it has gone YOU are kept this far short of its door.
export const DOOR_KEEP = 3.4;

/* ----------------------------------------------------------- the Eye's turn */

const shadesAlive = (round) => round.monsters.filter((m) => !m.dead && m.kind === "eyeShade").length + round.hazards.filter((h) => h.kind === "eyeDoorway").length;

// A room for the Eye other than `not` (and `also`), at random.
function pickRoom(random, not, also = -1) {
  const pool = [];
  for (let i = 0; i < EYE_ROOMS; i++) if (i !== not && i !== also) pool.push(i);
  return pool[Math.floor(random() * pool.length) % pool.length];
}

function stepEye(round, b, ms, random) {
  const e = b.eye;
  const spec = round.spec;
  const phase = phaseOf(b);
  const at = (i) => eyeAt(spec, i);
  e.ms -= ms;
  if (e.state === "flare") {
    // The second step of the flare, out loud.
    if (!e.stepped && e.ms <= EYE_FLARE_MS * (1 - FLARE_AT)) {
      e.stepped = true;
      round.events.push({ type: "eyeFlareStep", kind: "marroweye", ...at(e.room), room: e.room });
    }
    if (e.ms > 0) return;
    e.state = "open";
    e.ms = EYE_OPEN_MS[phase];
    e.full = e.ms;
    round.events.push({ type: "eyeOpen", kind: "marroweye", ...at(e.room), room: e.room });
    if (e.decoy >= 0) round.events.push({ type: "eyeDud", kind: "marroweye", ...at(e.decoy), room: e.decoy });
    e.decoy = -1;
    return;
  }
  if (e.ms > 0) return;
  if (e.state === "open") {
    e.state = "closing";
    e.ms = EYE_CLOSE_MS;
    round.events.push({ type: "eyeShut", kind: "marroweye", ...at(e.room), room: e.room });
    return;
  }
  if (e.state === "closing") {
    e.state = "shut";
    e.ms = EYE_SHUT_MS[phase] / spec.pace;
    e.last = e.room;
    return;
  }
  // Shut long enough: a lamp flares where it will open (two in its last phase, one false).
  e.room = b.plan >= 0 && b.plan < EYE_ROOMS && b.plan !== e.last ? b.plan : pickRoom(random, e.last);
  b.plan = -1;
  e.decoy = phase === 2 ? pickRoom(random, e.last, e.room) : -1;
  e.state = "flare";
  e.ms = EYE_FLARE_MS;
  e.full = EYE_FLARE_MS;
  e.stepped = false;
  round.events.push({ type: "eyeFlare", kind: "marroweye", ...at(e.room), room: e.room });
  if (e.decoy >= 0) round.events.push({ type: "eyeFlare", kind: "marroweye", ...at(e.decoy), room: e.decoy, decoy: true });
}

// Whether a bolt is in room `i`'s Eye box.
function inEye(spec, i, s) {
  const r = roomBox(spec, i);
  return Math.abs(s.x - r.cx) <= EYE_W / 2 + 0.3 && s.y >= r.floor + EYE_LO - 0.3 && s.y <= r.floor + EYE_HI + 0.3;
}

// A bolt through the house: a dresser takes it; the open Eye is hurt by it; the Eye
// flaring or shutting clanks it off. True when the bolt is spent.
function eyeShot(round, s, k) {
  const spec = round.spec;
  if (!spec || spec.boss !== "marroweye") return false;
  for (const h of round.hazards) {
    if (h.kind !== "eyeDresser" || h.dead || Math.abs(s.x - h.x) > h.w / 2 + 0.3 || s.y < h.y || s.y > h.y + h.h) continue;
    h.hp -= 1;
    if (h.hp <= 0) {
      h.dead = true;
      round.events.push({ type: "eyeDresserSmash", kind: "marroweye", x: h.x, y: h.y + h.h / 2 });
    } else round.events.push({ type: "bossBlock", kind: "marroweye", x: s.x, y: s.y });
    return true;
  }
  const b = round.boss;
  if (!b || b.kind !== "marroweye" || b.state !== "fight" || !b.eye) return false;
  const e = b.eye;
  if (e.state === "shut" || !inEye(spec, e.room, s)) return false;
  const at = eyeAt(spec, e.room);
  if (e.state !== "open") {
    round.events.push({ type: "bossBlock", kind: "marroweye", x: s.x, y: s.y });
    return true;
  }
  const dmg = Math.max(1, s.arm ? k.armBossDamage(round, s.bossDmg || 1) : 1);
  k.hurtBoss(round, dmg, "eye", at);
  return true;
}

/* ------------------------------------------------------------ the shades */

// What YOU stand on (or are over, in the air): a floor, a landing, or the ground.
function standing(round, k) {
  const you = round.you;
  if (you.state === "run") return you.y;
  let top = k.groundAt(round.spec, you.x);
  for (const [x0, x1, y] of round.spec.shelves) if (you.x >= x0 && you.x <= x1 && y <= you.y && y > top) top = y;
  return top;
}

// The underside of whatever is over a floor at height y: the next floor's slab, or the ceiling.
const ceilingOver = (y) => {
  for (const f of EYE_FLOORS) if (f > y + 0.01) return f - EYE_SLAB;
  return EYE_CEIL;
};

const inside = (spec, x, pad = 2) => clamp(x, spec.arena + pad, spec.length - pad);

// A door opening somewhere for a shade: on YOUR floor more often than not, at one of
// the room's doorways (its end walls and the frames between its rooms) clear of YOU.
function openDoor(round, b, random, k) {
  const spec = round.spec;
  const you = round.you;
  const yourRow = rowOf(standing(round, k));
  const row = random() < SHADE_YOUR_FLOOR ? yourRow : (yourRow + 1 + Math.floor(random() * 2)) % EYE_FLOORS.length;
  const floor = EYE_FLOORS[row];
  const doors = [spec.arena + 3, spec.arena + EYE_ROOM_W, spec.arena + EYE_ROOM_W * 2, spec.length - 3];
  const taken = (x) => round.monsters.some((m) => m.kind === "eyeShade" && Math.abs(m.y - floor) < 1 && Math.abs(m.x - x) < 4) || round.hazards.some((h) => h.kind === "eyeDoorway" && h.y === floor && Math.abs(h.x - x) < 4);
  let pool = doors.filter((x) => !taken(x) && (row !== yourRow || Math.abs(x - you.x) >= SHADE_CLEAR));
  if (!pool.length) pool = doors.filter((x) => !taken(x) && Math.abs(x - you.x) >= SHADE_CLEAR / 2);
  if (!pool.length) return false;
  const x = pool[Math.floor(random() * pool.length) % pool.length];
  const list = shadesOf(round, k);
  let of = list[Math.floor(random() * list.length) % list.length];
  if (of === b.lastShade && list.length > 1) of = list[(list.indexOf(of) + 1) % list.length];
  if (b.planShade) {
    of = b.planShade;
    b.planShade = null;
  }
  b.lastShade = of;
  round.hazards.push({ kind: "eyeDoorway", x, y: floor, w: 3, h: 5, warn: EYE_DOOR_MS, full: EYE_DOOR_MS, live: 0, of, cause: "marroweye" });
  round.events.push({ type: "eyeDoor", kind: "marroweye", x, y: floor, of });
  return true;
}

// A door: creaking open for its warning, then its shade steps out.
function stepDoorway(round, h, ms, k) {
  h.warn = Math.max(0, h.warn - ms);
  if (h.warn > 0) return true;
  const hp = SHADE_HP + 2 * (round.spec.tough || 0);
  const move = SHADE_MOVES[h.of] || SHADE_FALLBACK;
  const dir = Math.sign(round.you.x - h.x) || -1;
  k.spawnMonster(round, "eyeShade", h.x, h.y, { of: h.of, move, floor: h.y, hp, max: hp, act: "in", wait: SHADE_IN_MS, life: SHADE_LIFE_MS, dir, force: true, awake: true });
  round.events.push({ type: "eyeShadeIn", kind: "eyeShade", x: h.x, y: h.y, of: h.of });
  return false;
}

// A floor thing set rolling along a shade's floor toward `dir`.
const roller = (kind, def, x, y, dir) => ({ kind, x, y, w: def.w, h: def.h, dir, speed: def.speed, reach: def.reach, went: 0, warn: 0, live: 1, cause: kind });

// The wind-up of a shade's move: what YOU see (its pose, and a mark where it will
// strike) and hear before it can hurt.
function windUp(round, m, k) {
  const you = round.you;
  const spec = round.spec;
  const wind = SHADE_WIND[m.move] || 900;
  m.act = "wind";
  m.wait = wind;
  m.full = wind;
  m.dir = Math.sign(you.x - m.x) || m.dir;
  m.knocks = 0;
  const ev = { type: "eyeShadeWind", kind: "eyeShade", x: m.x, y: m.floor + 3, of: m.of, move: m.move };
  if (m.move === "scythe") {
    round.hazards.push({ kind: "eyeScythe", x: inside(spec, m.x + m.dir * (SCYTHE_W / 2 + 1), SCYTHE_W / 2), y: m.floor, w: SCYTHE_W, h: SCYTHE_H, dir: m.dir, warn: wind, full: wind, live: 0, cause: "eyeScythe", owner: m.id });
  } else if (m.move === "leap") {
    m.tx = inside(spec, you.x, 3);
    ev.tx = m.tx;
  } else if (m.move === "icicles") {
    // One over YOU and a second a step ahead, each marked on the ceiling and the floor.
    const y = standing(round, k);
    const ahead = Math.sign(you.vx) || you.face || 1;
    const xs = [inside(spec, you.x), inside(spec, you.x + ahead * ICICLE_GAP)];
    const top = ceilingOver(y);
    xs.forEach((x, i) => {
      const warn = wind + ICICLE_WARN_MS + i * 150;
      round.hazards.push({ kind: "eyeIcicle", x, y: top - ICICLE_H, top, floor: y, w: ICICLE_W, h: ICICLE_H, warn, full: warn, fall: 0, live: 0, cause: "eyeIcicle", id: i });
    });
    ev.xs = xs;
    ev.ty = y;
  }
  round.events.push(ev);
}

// One of the three knocks: a rock to fall on YOUR floor, each nearer YOU from the shade's side.
function knock(round, m, k) {
  const you = round.you;
  const y = standing(round, k);
  const toward = Math.sign(you.x - m.x) || 1;
  const x = inside(round.spec, you.x - toward * ROCK_STEP * (2 - m.knocks));
  const top = ceilingOver(y);
  round.hazards.push({ kind: "eyeRock", x, y: top - ROCK_H, top, floor: y, w: ROCK_W, h: ROCK_H, warn: ROCK_WARN_MS, full: ROCK_WARN_MS, fall: 0, live: 0, cause: "eyeRock", id: m.knocks });
  m.knocks++;
  round.events.push({ type: "eyeKnock", kind: "eyeShade", x: m.x, y: m.floor + 3, n: m.knocks, at: x, ty: y });
}

// The move itself, once its wind-up is done (a one-off: the shade rests after it), or
// a slice of one that takes a while (a hop, a dash, a leap): true while it goes on.
function strike(round, m, ms, k) {
  const spec = round.spec;
  const dt = ms / 1000;
  const mv = m.move;
  if (mv === "hop" || mv === "leap") {
    if (!m.going) {
      m.going = true;
      m.t0 = 0;
      m.x0 = m.x;
      if (mv === "leap") round.events.push({ type: "eyeShadeLeap", kind: "eyeShade", x: m.x, y: m.floor + 3, tx: m.tx });
    }
    m.t0 += ms;
    const full = mv === "hop" ? HOP_MS : LEAP_MS;
    const p = Math.min(1, m.t0 / full);
    if (mv === "leap") m.x = m.x0 + (m.tx - m.x0) * p;
    m.y = m.floor + Math.sin(Math.PI * p) * (mv === "hop" ? HOP_UP : LEAP_UP);
    if (p < 1) return true;
    m.y = m.floor;
    m.going = false;
    if (mv === "hop") {
      for (const d of [-1, 1]) round.hazards.push(roller("eyeRipple", RIPPLE, m.x + d * 1.6, m.floor, d));
      round.events.push({ type: "eyeShadeSlam", kind: "eyeShade", x: m.x, y: m.floor });
    } else {
      round.hazards.push({ kind: "eyePounce", x: m.x, y: m.floor, w: POUNCE_W, h: POUNCE_H, warn: 0, live: POUNCE_MS, cause: "eyePounce" });
      round.events.push({ type: "eyePounce", kind: "eyeShade", x: m.x, y: m.floor });
    }
    return false;
  }
  if (mv === "dash") {
    if (!m.going) {
      m.going = true;
      m.went = 0;
      round.events.push({ type: "eyeShadeDash", kind: "eyeShade", x: m.x, y: m.floor + 2, dir: m.dir });
    }
    const step = DASH_SPEED * dt;
    const nx = m.x + m.dir * step;
    m.went += step;
    if (nx <= spec.arena + 2 || nx >= spec.length - 2 || m.went >= DASH_REACH) {
      m.x = inside(spec, nx);
      m.going = false;
      return false;
    }
    m.x = nx;
    return true;
  }
  if (mv === "skull") {
    round.hazards.push({ kind: "eyeSkull", x: m.x + m.dir * 1.6, y: m.floor + SKULL_UP, w: SKULL_W, h: SKULL_H, dir: m.dir, went: 0, back: false, owner: m.id, home: m.x, warn: 0, live: 1, cause: "eyeSkull" });
    round.events.push({ type: "eyeSkullThrow", kind: "eyeShade", x: m.x, y: m.floor + SKULL_UP, dir: m.dir });
  } else if (mv === "note") {
    round.hazards.push(roller("eyeNote", NOTE, m.x + m.dir * 1.8, m.floor, m.dir));
    round.events.push({ type: "eyeNote", kind: "eyeShade", x: m.x, y: m.floor + 2, dir: m.dir });
  } else if (mv === "hoop") {
    round.hazards.push(roller("eyeHoop", HOOP, m.x + m.dir * 1.8, m.floor, m.dir));
    round.events.push({ type: "eyeHoop", kind: "eyeShade", x: m.x, y: m.floor + 2, dir: m.dir });
  } else if (mv === "mud") {
    round.hazards.push(roller("eyeMud", MUD, m.x + m.dir * 2, m.floor, m.dir));
    round.events.push({ type: "eyeMud", kind: "eyeShade", x: m.x, y: m.floor + 1, dir: m.dir });
  }
  // The scythe, the knocks and the icicles were set going in the wind-up.
  return false;
}

// A shade's slice: fading in, then wind-up, move and rest by turns, fading out at the end of its life.
function moveShade(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  m.life -= ms;
  if (m.act === "out") {
    m.wait -= ms;
    if (m.wait <= 0) m.dead = true;
    return;
  }
  if (m.life <= SHADE_OUT_MS && !m.going) {
    m.act = "out";
    m.wait = SHADE_OUT_MS;
    m.y = m.floor;
    round.events.push({ type: "eyeShadeOut", kind: "eyeShade", x: m.x, y: m.floor + 2, of: m.of });
    return;
  }
  if (!m.going) m.dir = Math.sign(you.x - m.x) || m.dir;
  if (m.act === "in") {
    m.wait -= ms;
    if (m.wait <= 0) {
      m.act = m.move === "creep" ? "creep" : "idle";
      m.wait = SHADE_FIRST_MS;
    }
    return;
  }
  // The angel: only while YOU face away from it does it come on, grinding.
  if (m.act === "creep") {
    const away = you.face !== Math.sign(m.x - you.x) && Math.abs(you.x - m.x) > 0.6;
    if (away) {
      if (!m.moving) round.events.push({ type: "eyeShadeGrind", kind: "eyeShade", x: m.x, y: m.floor + 2 });
      m.x = inside(spec, m.x + m.dir * ANGEL_SPEED * (ms / 1000));
    }
    m.moving = away;
    return;
  }
  if (m.act === "idle") {
    m.wait -= ms;
    if (m.wait <= 0) {
      if (m.move === "creep") m.act = "creep";
      else windUp(round, m, k);
    }
    return;
  }
  if (m.act === "wind") {
    m.wait -= ms;
    if (m.move === "knock") while (m.knocks < 3 && m.wait <= m.full * (1 - m.knocks / 3)) knock(round, m, k);
    if (m.wait > 0) return;
    m.act = "go";
  }
  if (m.act === "go") {
    if (strike(round, m, ms, k)) return;
    m.act = "rest";
    m.wait = SHADE_REST_MS;
    return;
  }
  if (m.act === "rest") {
    m.wait -= ms;
    if (m.wait <= 0) {
      m.act = "idle";
      m.wait = SHADE_IDLE_MS / spec.pace;
    }
  }
}

/* -------------------------------------------------------------- hazards */

// A floor thing rolling along: on until its reach or the house's end wall.
function stepRoller(round, h, ms) {
  const step = h.speed * round.spec.pace * (ms / 1000);
  h.x += h.dir * step;
  h.went += step;
  return h.went < h.reach && h.x > round.spec.arena + 0.5 && h.x < round.spec.length - 0.5;
}

// The skull: out at YOUR chest's height, then back to the shade that threw it (or where it stood).
function stepSkull(round, h, ms) {
  const step = SKULL_SPEED * (ms / 1000);
  if (!h.back) {
    h.x += h.dir * step;
    h.went += step;
    if (h.went >= SKULL_REACH || h.x <= round.spec.arena + 1 || h.x >= round.spec.length - 1) {
      h.back = true;
      round.events.push({ type: "eyeSkullTurn", kind: "eyeShade", x: h.x, y: h.y });
    }
    return true;
  }
  const owner = round.monsters.find((m) => m.id === h.owner && !m.dead);
  const home = owner ? owner.x : h.home;
  const d = home - h.x;
  if (Math.abs(d) <= step) return false;
  h.x += Math.sign(d) * step;
  return true;
}

// The scythe: its arc shows for `warn`, then it sweeps, live SCYTHE_LIVE_MS.
function stepScythe(round, h, ms) {
  if (h.warn > 0) {
    // Its shade gone (shot, faded), the sweep never comes.
    if (!round.monsters.some((m) => m.id === h.owner && !m.dead)) return false;
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = SCYTHE_LIVE_MS;
    round.events.push({ type: "eyeScythe", kind: "eyeShade", x: h.x, y: h.y, dir: h.dir });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// A rock or an icicle: a mark where it lands for `warn`, then it falls from the ceiling.
function stepDrop(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = 1;
    h.fall = 0;
    return true;
  }
  h.fall += ms;
  const p = Math.min(1, h.fall / FALL_MS);
  h.y = h.top - h.h + (h.floor - (h.top - h.h)) * p;
  if (p < 1) return true;
  round.events.push({ type: h.kind === "eyeRock" ? "eyeRockLand" : "eyeIcicleLand", kind: "eyeShade", x: h.x, y: h.floor });
  return false;
}

// The beast's landing: live a moment.
function stepPounce(round, h, ms) {
  h.live -= ms;
  return h.live > 0;
}

// A dresser: rocking at the uphill end through the creak, then sliding down the floor
// while the house leans, until it hits the far wall or the lurch is over.
function stepDresser(round, h, ms) {
  if (h.dead) return false;
  const b = round.boss;
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn <= 0) h.live = 1;
    return true;
  }
  const leaning = b && b.lurch && b.lurch.state === "go";
  if (!leaning) {
    round.events.push({ type: "eyeDresserCrash", kind: "marroweye", x: h.x, y: h.y + 1 });
    return false;
  }
  h.x += h.dir * DRESSER_SPEED * (ms / 1000);
  if (h.x <= round.spec.arena + DRESSER_W / 2 || h.x >= round.spec.length - DRESSER_W / 2) {
    round.events.push({ type: "eyeDresserCrash", kind: "marroweye", x: h.x, y: h.y + 1 });
    return false;
  }
  return true;
}

/* ------------------------------------------------------------- the fight */

// The lurch's turn: waiting, creaking (a dresser rocking at the uphill end of YOUR
// floor), then sliding.
function stepLurch(round, b, ms, random, k) {
  const l = b.lurch;
  const spec = round.spec;
  const phase = phaseOf(b);
  l.ms -= ms;
  if (l.state === "creak") {
    if (!l.stepped && l.ms <= EYE_CREAK_MS * (1 - CREAK_AT)) {
      l.stepped = true;
      round.events.push({ type: "eyeCreakStep", kind: "marroweye", x: (spec.arena + spec.length) / 2, y: 30, dir: l.dir });
    }
    if (l.ms > 0) return;
    l.state = "go";
    l.ms = EYE_LURCH_MS;
    round.events.push({ type: "eyeLurch", kind: "marroweye", x: (spec.arena + spec.length) / 2, y: 30, dir: l.dir });
    return;
  }
  if (l.state === "go") {
    if (l.ms > 0) return;
    l.state = "wait";
    l.ms = EYE_LURCH_EVERY_MS[phase] / spec.pace;
    return;
  }
  if (l.ms > 0 && !b.planLurch) return;
  l.dir = b.planLurch || (random() < 0.5 ? -1 : 1);
  b.planLurch = 0;
  l.state = "creak";
  l.ms = EYE_CREAK_MS;
  l.stepped = false;
  // A dresser at the uphill end of YOUR floor, unless YOU stand there: then of another floor.
  const you = round.you;
  const end = l.dir > 0 ? spec.arena + DRESSER_W / 2 + 0.6 : spec.length - DRESSER_W / 2 - 0.6;
  let row = rowOf(standing(round, k));
  if (Math.abs(you.x - end) < DRESSER_CLEAR) row = (row + 1 + Math.floor(random() * 2)) % EYE_FLOORS.length;
  const rows = phase === 2 ? [row, (row + 1) % EYE_FLOORS.length] : [row];
  for (const r of rows) round.hazards.push({ kind: "eyeDresser", x: end, y: EYE_FLOORS[r], w: DRESSER_W, h: DRESSER_H, dir: l.dir, hp: DRESSER_HP, warn: EYE_CREAK_MS, full: EYE_CREAK_MS, live: 0, cause: "eyeDresser" });
  round.events.push({ type: "eyeCreak", kind: "marroweye", x: (spec.arena + spec.length) / 2, y: 30, dir: l.dir });
}

function moveEye(round, b, ms, random, k) {
  const spec = round.spec;
  if (!b.eye) {
    b.eye = { state: "shut", ms: 700, room: -1, last: -1, decoy: -1, full: 1, stepped: false };
    b.lurch = { state: "wait", ms: EYE_LURCH_FIRST_MS / spec.pace, dir: 1, stepped: false };
    b.shadeMs = SHADE_FIRST_DOOR_MS;
    b.plan = b.plan ?? -1;
  }
  stepEye(round, b, ms, random);
  stepLurch(round, b, ms, random, k);
  const phase = phaseOf(b);
  b.shadeMs -= ms;
  if ((b.shadeMs <= 0 || b.planShade) && shadesAlive(round) < SHADE_CAP[phase]) {
    if (openDoor(round, b, random, k)) b.shadeMs = SHADE_EVERY_MS[phase] / spec.pace;
    else b.shadeMs = 500;
  }
}

/* --------------------------------------------------------- the stage's tick */

function retreatStep(round, b) {
  const spec = round.spec;
  const mid = (spec.arena + spec.length) / 2;
  const stamp = (key, at, type, extra = {}) => {
    if (b[key] || b.t < at) return;
    b[key] = true;
    round.events.push({ type, kind: "marroweye", x: mid, y: 26, ...extra });
  };
  stamp("burst", 0, "eyeBurst", b.eye && b.eye.room >= 0 ? eyeAt(spec, b.eye.room) : {});
  stamp("peeled", PEEL_AT, "eyePeel");
  CRACK_AT.forEach((at, n) => stamp(`cracked${n}`, at, "eyeCrack", { n, y: EYE_FLOORS[EYE_FLOORS.length - 1 - n] }));
  stamp("gasped", GASP_AT, "eyeGasp");
  stamp("sinking", SINK_AT, "eyeSink");
  if (b.t >= GONE_AT && !b.gone) {
    b.gone = true;
    round.events.push({ type: "eyeGone", kind: "marroweye", x: spec.door, y: EYE_FLOORS[0] + 6 });
  }
}

// Its box out of everything's way (only its Eye can be hurt, through eyeShot), the
// lurch pushing YOU while YOU stand, the retreat's beats, and YOU kept off its door
// until it has gone.
function eyeTick(round, ms) {
  const b = round.boss;
  if (!b || b.kind !== "marroweye") return;
  const spec = round.spec;
  if (!b.placed) {
    b.placed = true;
    b.x = spec.length - 0.75;
    b.y = 60;
    b.w = 1.5;
    b.h = 2;
  }
  const you = round.you;
  const l = b.lurch;
  // How far the house leans, -1 to 1, for the art: easing in through the creak, full while it slides.
  if (l && b.state === "fight") {
    const target = l.state === "go" ? l.dir : l.state === "creak" ? l.dir * 0.25 * (1 - l.ms / EYE_CREAK_MS) : 0;
    b.tilt = (b.tilt || 0) + (target - (b.tilt || 0)) * Math.min(1, ms / 140);
    if (l.state === "go" && you.state === "run" && round.phase === "play" && !(you.out > 0)) {
      you.x = clamp(you.x + l.dir * EYE_PUSH * (ms / 1000), spec.arena + WALL_PAD, spec.length - WALL_PAD);
    }
  } else b.tilt = (b.tilt || 0) * Math.max(0, 1 - ms / 200);
  if (b.state === "down") retreatStep(round, b);
  if (b.state === "down" && !b.gone && you.x > spec.door - DOOR_KEEP) {
    you.x = spec.door - DOOR_KEEP;
    if (you.vx > 0) you.vx = 0;
  }
}

export const EYE = freeze({
  id: "dollhouse",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  swoops: freeze({}),
  // A shade fading in or out can neither be hit nor hurt.
  solid: freeze({ eyeShade: (m) => m.act !== "in" && m.act !== "out" }),
  move: freeze({ eyeShade: moveShade }),
  kill: freeze({}),
  horde: freeze({}),
  tick: freeze([eyeTick]),
  target: eyeShot,
  bosses: BOSSES,
  boss: freeze({ marroweye: moveEye }),
  // Only its open Eye can be hurt (eyeShot): anything else glances off.
  guard: freeze({ marroweye: () => true }),
  cause: freeze({ marroweye: () => "marroweye" }),
  hazards: freeze({
    eyeDoorway: stepDoorway,
    eyeRipple: stepRoller,
    eyeNote: stepRoller,
    eyeHoop: stepRoller,
    eyeMud: stepRoller,
    eyeSkull: stepSkull,
    eyeScythe: stepScythe,
    eyeRock: stepDrop,
    eyeIcicle: stepDrop,
    eyePounce: stepPounce,
    eyeDresser: stepDresser,
  }),
});
