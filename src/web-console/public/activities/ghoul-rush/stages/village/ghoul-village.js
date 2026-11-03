// Plan2Code Web Console - Ghoul Rush's Hollow End Village stage, its rules: the monsters of the village (torch mob villagers who lob fire and turn into wolf-men at full moon, hanged men that drop on their ropes, shutter ghouls that lunge out of the windows, moonhounds that grow with the moon), the moonrise over each room, Wolfsbane, and its boss, the Beast of Hollow End, as a stage pack that ghoul.js plugs in.
//
// Like the other stage packs (see ghoul-graveyard.js for what a pack holds,
// and ghoul-sanatorium.js for `tick`, `shot`, `land` and `weak`), every rule
// here is handed a kit `k` of ghoul.js's own helpers, so this file has no
// imports. It adds no field to the pack contract: it uses `tick` (the moon),
// `shot` (Wolfsbane's double), `land` (the torch), `weak` (the Beast clinging;
// ghoul.js now hands it `(boss, shot, round, k)`) and `solid` (a shutter ghoul
// is solid only while out). It draws no random number, so a seed plays the
// same as it did before the stage existed.
//
// Moonrise: a room with `moon` (ms) starts a moon at 0 when play begins and
// climbs it to 1 in that time (`round.twist` = { moon, full, ms }: the art
// draws the moon at `moon`, 0 to 1). At 1 it is full (`fullMoon`): every
// villager in view starts to turn (`villagerTurn`, VILLAGER_TURN_MS, then
// `villagerWolf`) into a wolf-man (`m.turned`: fast, leaps at you, no more
// torches, TURNED_HP more hp) and, as one comes into view later, so does
// that one; every moonhound grows MOON_GROW times (`houndGrow`, `m.grown`,
// MOON_HOUND_HP more hp), now and when one is born later. The moon is part of
// the room: it starts over in the next room and after a life lost. In the
// Beast's room (no `moon`) it hangs at BEAST_MOON, full once the Beast has
// raged.
//
// A villager walks at you in a group of VILLAGER_GROUP (a spawn row; a horde
// one comes alone), stops VILLAGER_KEEP away and lobs a torch every TORCH_MS
// or so (`torchWind`, TORCH_WIND_MS first; the `torch` missile, cause `torch`,
// comes down in a patch of fire, `torchLand`, `torchfire` hazard, TORCHFIRE_MS).
// A hanged man sways on his rope under a beam (a spawn row names the beam's
// height; he rests HANGED_HANG under it); when you pass under him he creaks
// (`hangedWarn`, HANGED_WARN_MS), drops to your height (`hangedDrop`, then
// `hangedSnap` at the bottom), holds HANGED_HOLD_MS and is hauled back up
// (`hangedHaul`) like a yo-yo. A shutter ghoul hides in a window (a spawn row
// names the window's height, `hide`: not solid, so bolts go through), rattles
// the shutters when you come near (`shutterRattle`), lunges out at where you
// are (`shutterLunge`, up to SHUTTER_REACH from its window), stays out
// SHUTTER_OUT_MS and pulls back (`shutterPull`). It can be hit, and can hurt,
// only while out. A moonhound leaps like the house hellhound (`growl`,
// `lunge`).
//
// Wolfsbane (a stage-only power-up, see ghoul-powers.js): a turned villager
// and a moonhound shy away from you (`baneShy`) and take double damage from
// your bolts, and so does the Beast.
//
// The Beast of Hollow End walks at you in the arena. In turn it bounds onto
// the wall farther from you (`beastLeap`) and clings there BEAST_CLING_MS
// (`beastCling`; a shot does double damage), then pounces where you stand
// (`beastPounce`; a `shadow` hazard marks the landing, `beastLand` shakes the
// ground). Close up, it winds up a claw (`swipeWind`, SWIPE_WIND_MS) and swipes
// (`beastSwipe`, a `claw` hazard in front of it); every third move it throws
// back its head and howls (`beastHowl`, HOWL_MS) and calls moonhounds
// (`houndCall`, never more than HOUND_CAP alive). At half its hp the moon is
// full (`beastMoon`): its waits are shorter, it pounces twice in a row, and
// the hounds it calls are grown.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  villager: freeze({ name: "Torch Mob Villager", w: 3, h: 5, hp: 3, speed: 8, points: 180, stomp: true, head: true, color: "#8a5a32" }),
  hanged: freeze({ name: "Hanged Man", w: 2.6, h: 5.2, hp: 3, speed: 0, points: 200, stomp: false, head: false, perch: true, color: "#8a8a74" }),
  shutter: freeze({ name: "Shutter Ghoul", w: 3, h: 4.6, hp: 2, speed: 0, points: 200, stomp: false, head: false, perch: true, color: "#7a8a6a" }),
  moonhound: freeze({ name: "Moonhound", w: 3.8, h: 2.6, hp: 2, speed: 15, points: 170, stomp: true, head: false, color: "#6a6a82" }),
});

// Every event this pack puts on the field, for the art and the sounds to
// answer (a hit, a kill, a spawn and a boss's wake, hit and fall are the
// game's own, and so are `growl`, `lunge` and `throw`, which carry the kind).
export const EVENTS = freeze([
  "fullMoon", "villagerTurn", "villagerWolf", "houndGrow", "torchWind", "torchLand", "baneShy",
  "hangedWarn", "hangedDrop", "hangedSnap", "hangedHaul", "shutterRattle", "shutterLunge", "shutterPull",
  "beastLeap", "beastCling", "beastPounce", "beastLand", "swipeWind", "beastSwipe", "beastHowl", "houndCall", "beastMoon",
]);

// The moon. A turn takes VILLAGER_TURN_MS and leaves TURNED_HP more hp. A
// moonhound grows MOON_GROW times as big, with MOON_HOUND_HP more hp. In the
// Beast's room the moon hangs at BEAST_MOON of the way up until it rages.
export const VILLAGER_TURN_MS = 800;
export const TURNED_HP = 2;
export const MOON_GROW = 1.5;
export const MOON_HOUND_HP = 3;
export const BEAST_MOON = 0.85;
// A villager stops VILLAGER_KEEP away (walking at its speed otherwise), throws
// a torch every TORCH_MS (a little different for each, TORCH_WIND_MS to swing
// first) once within TORCH_RANGE and no closer than TORCH_NEAR. A spawn row is
// a group of VILLAGER_GROUP, VILLAGER_SPREAD apart. A torch's fire is a patch
// TORCHFIRE_W wide and TORCHFIRE_H high that burns TORCHFIRE_MS, at most
// TORCHFIRE_CAP of them.
export const VILLAGER_KEEP = 16;
export const TORCH_MS = 2600;
export const TORCH_WIND_MS = 500;
export const TORCH_RANGE = 50;
export const TORCH_NEAR = 6;
export const VILLAGER_GROUP = 3;
export const VILLAGER_SPREAD = 2.6;
export const TORCHFIRE_W = 4.4;
export const TORCHFIRE_H = 2.4;
export const TORCHFIRE_MS = 3200;
export const TORCHFIRE_CAP = 5;
// A hanged man rests HANGED_HANG under his beam. Within HANGED_NEAR of him
// across (and under him, no lower than his rope reaches) he creaks for
// HANGED_WARN_MS, drops at HANGED_DROP_V to HANGED_LOW over your feet (no
// further than HANGED_ROPE below his rest), holds HANGED_HOLD_MS, is hauled
// up at HANGED_HAUL_V and sways HANGED_REST_MS before he drops again.
export const HANGED_HANG = 7.5;
export const HANGED_NEAR = 8;
export const HANGED_ROPE = 8;
export const HANGED_WARN_MS = 220;
export const HANGED_DROP_V = 150;
export const HANGED_LOW = 0.4;
export const HANGED_HOLD_MS = 450;
export const HANGED_HAUL_V = 26;
export const HANGED_REST_MS = 1400;
// A shutter ghoul rattles SHUTTER_RATTLE_MS once you are within SHUTTER_NEAR
// across (and SHUTTER_HIGH up or down from its window), then lunges at
// SHUTTER_LUNGE_V up to SHUTTER_REACH toward your chest, stays out
// SHUTTER_OUT_MS, pulls back at SHUTTER_PULL_V and hides SHUTTER_REST_MS.
export const SHUTTER_NEAR = 14;
export const SHUTTER_HIGH = 14;
export const SHUTTER_RATTLE_MS = 800;
export const SHUTTER_REACH = 9;
export const SHUTTER_LUNGE_V = 60;
export const SHUTTER_OUT_MS = 800;
export const SHUTTER_PULL_V = 40;
export const SHUTTER_REST_MS = 1800;
// A moonhound and a turned villager leap like the house hellhound: within
// `range` they crouch `crouch` ms, leap at `vx` across and `vy` up, and rest
// `rest` ms after landing. Under Wolfsbane one within BANE_SHY of you (beyond
// either leap's range) shies: it backs off at 0.7 of its speed, never
// attacking, until it is BANE_SHY_EXTRA further off.
export const HOUND_LEAP = freeze({ range: 18, crouch: 300, vx: 44, vy: 44, rest: 600 });
export const WOLF_LEAP = freeze({ range: 22, crouch: 240, vx: 54, vy: 54, rest: 500 });
export const TURNED_V = 22;
export const BANE_SHY = 24;
export const BANE_SHY_EXTRA = 4;
export const BANE_SHY_SPEED = 0.7;
export const BANE_MULT = 2;

// The Beast. It prowls at BEAST_WALK, waits BEAST_IDLE_MS between moves (it
// walks on while it waits). A move is a swipe when you are within
// BEAST_SWIPE_NEAR of its edge (and it has not swiped for SWIPE_COOL_MS),
// every third move a howl (unless HOUND_CAP moonhounds are alive), else a wall
// leap. The bound to the wall takes BOUND_MS (arcing BOUND_ARC high), the
// Beast clings BEAST_CLING_MS with its feet BEAST_CLING_UP over the floor
// (taking CLING_MULT times the damage), then pounces: POUNCE_MS in the air
// (arcing POUNCE_ARC), the shadow on the floor the whole time, and rests
// LAND_REST_MS. A swipe winds up SWIPE_WIND_MS, then a claw SWIPE_REACH long
// and SWIPE_H high is out SWIPE_LIVE_MS and it rests SWIPE_REST_MS. A howl is
// HOWL_MS and calls HOWL_CALL hounds in from the arena's ends, then rests
// HOWL_REST_MS. At BEAST_RAGE of its hp every wait is BEAST_QUICK times as
// long and a pounce is followed, after SECOND_WAIT_MS, by a second one
// (SECOND_MS in the air).
export const BOSSES = freeze({
  beast: freeze({ name: "The Beast of Hollow End", sub: "Shoot it while it clings to the wall", w: 9, h: 10.5, hp: 110, points: 3500, color: "#6a6478" }),
});
export const BEAST_WALK = 14;
export const BEAST_IDLE_MS = 1100;
export const BEAST_SWIPE_NEAR = 7;
export const SWIPE_COOL_MS = 1500;
export const BOUND_MS = 480;
export const BOUND_ARC = 9;
export const BEAST_CLING_UP = 3.6;
export const BEAST_CLING_MS = 600;
export const CLING_MULT = 2;
export const POUNCE_MS = 700;
export const POUNCE_ARC = 7;
export const LAND_REST_MS = 900;
export const SWIPE_WIND_MS = 400;
export const SWIPE_REACH = 7.5;
export const SWIPE_H = 7;
export const SWIPE_LIVE_MS = 200;
export const SWIPE_REST_MS = 800;
export const HOWL_MS = 1000;
export const HOWL_CALL = 2;
export const HOUND_CAP = 4;
export const HOWL_REST_MS = 600;
export const BEAST_RAGE = 0.5;
export const BEAST_QUICK = 0.7;
export const SECOND_WAIT_MS = 250;
export const SECOND_MS = 560;
export const WALL_INSET = 0.4;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const inView = (round, m, k) => m.x > round.camX - 2 && m.x < round.camX + k.FIELD_W + 2;
const wallAt = (k, round, x, y) => k.groundAt(round.spec, x) > y;
const alive = (round, kind) => round.monsters.filter((m) => !m.dead && m.kind === kind).length;

/* ------------------------------------------------------------ the moon */

// A villager starts to turn.
function beginTurn(round, m) {
  m.act = "turn";
  m.wait = VILLAGER_TURN_MS;
  m.windup = 0;
  round.events.push({ type: "villagerTurn", kind: m.kind, x: m.x, y: m.y + m.h / 2, ms: VILLAGER_TURN_MS });
}

// A moonhound grows with the moon.
function grow(round, m) {
  m.grown = true;
  m.w *= MOON_GROW;
  m.h *= MOON_GROW;
  m.max += MOON_HOUND_HP;
  m.hp += MOON_HOUND_HP;
  round.events.push({ type: "houndGrow", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

// The moon climbs over the room (over the Beast's fight, it stays high until
// the Beast rages); once it is full the villagers in view turn and the hounds
// grow.
function tick(round, ms, k) {
  const spec = round.spec;
  const b = round.boss;
  const beast = b && b.kind === "beast";
  if (!spec.moon && !beast) return;
  if (beast && b.state === "down") return;
  const tw = (round.twist ||= { moon: beast ? BEAST_MOON : 0, full: false, ms: 0 });
  if (beast) {
    if (b.raged && !tw.full) {
      tw.full = true;
      tw.moon = 1;
    }
  } else if (!tw.full) {
    tw.ms += ms;
    tw.moon = Math.min(1, tw.ms / spec.moon);
    if (tw.moon >= 1) {
      tw.full = true;
      round.events.push({ type: "fullMoon", x: round.camX + k.FIELD_W / 2, y: k.CHANDELIER_Y });
    }
  }
  if (!tw.full) return;
  for (const m of round.monsters) {
    if (m.dead) continue;
    if (m.kind === "villager" && !m.turned && m.act !== "turn" && inView(round, m, k)) beginTurn(round, m);
    else if (m.kind === "moonhound" && !m.grown) grow(round, m);
  }
}

/* ------------------------------------------------- hounds and wolf-men */

// A leaper: prowls at you, crouches and leaps like the house hellhound, rests
// where it lands; under Wolfsbane it backs off instead (and never attacks).
function leaper(round, m, ms, k, leap, speed) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  const toward = k.towardYou(round, m);
  if (m.act === "leap") {
    const py = m.y;
    const nx = m.x + m.vx * dt;
    if (!wallAt(k, round, nx + Math.sign(m.vx) * m.w * 0.4, m.y + 0.05)) m.x = nx;
    m.vy = Math.max(-k.FALL_MAX, m.vy - k.GRAVITY * dt);
    m.y += m.vy * dt;
    const g = k.groundAt(spec, m.x);
    if (m.vy < 0 && py >= g && m.y <= g) Object.assign(m, { y: g, vx: 0, vy: 0, act: "rest", wait: leap.rest });
    if (m.y < k.PIT_Y) m.dead = true;
    return;
  }
  if (round.effects.bane > 0 && Math.abs(you.x - m.x) < BANE_SHY + (m.shy ? BANE_SHY_EXTRA : 0)) {
    if (!m.shy) {
      m.shy = true;
      round.events.push({ type: "baneShy", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    }
    m.act = "prowl";
    m.wait = 0;
    k.walk(round, m, -toward, speed * BANE_SHY_SPEED * pace, dt);
    m.dir = toward;
    return;
  }
  m.shy = false;
  if (m.wait > 0) {
    m.wait = Math.max(0, m.wait - ms * (m.act === "crouch" ? 1 : pace));
    if (m.wait > 0) return;
    if (m.act === "crouch") {
      Object.assign(m, { act: "leap", vx: m.dir * leap.vx * pace, vy: leap.vy });
      round.events.push({ type: "lunge", kind: m.kind, x: m.x, y: m.y });
      return;
    }
  }
  if (Math.abs(you.x - m.x) < leap.range && Math.abs(you.y - m.y) < 5) {
    Object.assign(m, { dir: toward, act: "crouch", wait: leap.crouch });
    round.events.push({ type: "growl", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  m.act = "prowl";
  k.walk(round, m, toward, speed * pace, dt);
}

const moveMoonhound = (round, m, ms, k) => leaper(round, m, ms, k, HOUND_LEAP, MONSTERS.moonhound.speed);

/* ------------------------------------------------------------ villagers */

// The first slice of a villager: a spawn row's is a group of three.
function groupUp(round, m, k) {
  m.init = true;
  m.throwIn = TORCH_MS * (0.35 + (m.id % 3) * 0.3);
  if (m.horde || m.group || round.boss) return;
  for (const s of [-1, 1]) {
    const x = m.x + s * VILLAGER_SPREAD;
    const y = k.groundAt(round.spec, x);
    if (y === -Infinity || Math.abs(y - m.y) > 0.01) continue;
    k.spawnMonster(round, "villager", x, y, { force: true, group: true });
  }
}

function moveVillager(round, m, ms, k) {
  if (!m.init) groupUp(round, m, k);
  if (m.turned) return leaper(round, m, ms, k, WOLF_LEAP, TURNED_V);
  if (m.act === "turn") {
    m.wait -= ms;
    if (m.wait > 0) return;
    Object.assign(m, { turned: true, act: "prowl", wait: 0 });
    m.max += TURNED_HP;
    m.hp += TURNED_HP;
    round.events.push({ type: "villagerWolf", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    return;
  }
  const you = round.you;
  const pace = round.spec.pace;
  const dx = you.x - m.x;
  m.dir = k.towardYou(round, m);
  if (m.windup > 0) {
    m.act = "wind";
    m.windup = Math.max(0, m.windup - ms);
    if (!m.windup) {
      m.act = "walk";
      const torch = k.throwBone(round, m.x + m.dir * 1.4, m.y + m.h * 0.8, 1, "torch", m.kind);
      torch.cause = "torch";
    }
    return;
  }
  if (Math.abs(dx) > VILLAGER_KEEP) k.walk(round, m, m.dir, MONSTERS.villager.speed * pace, ms / 1000);
  if (!inView(round, m, k) || Math.abs(dx) > TORCH_RANGE || Math.abs(dx) < TORCH_NEAR) return;
  m.throwIn -= ms * pace;
  if (m.throwIn > 0) return;
  m.throwIn = TORCH_MS * (0.85 + (m.id % 4) * 0.1);
  m.windup = TORCH_WIND_MS;
  round.events.push({ type: "torchWind", kind: m.kind, x: m.x, y: m.y + m.h * 0.8 });
}

// A patch of fire where a torch came down (the oldest goes if there are too many).
function torchLands(round, b, floor) {
  const fires = round.hazards.filter((h) => h.kind === "torchfire");
  if (fires.length >= TORCHFIRE_CAP) round.hazards.splice(round.hazards.indexOf(fires[0]), 1);
  round.hazards.push({ kind: "torchfire", x: b.x, y: floor, w: TORCHFIRE_W, h: TORCHFIRE_H, live: TORCHFIRE_MS, max: TORCHFIRE_MS, cause: "torch" });
  round.events.push({ type: "torchLand", x: b.x, y: floor });
  return true;
}

// A fire only burns out. Returns whether it is still on the field.
function stepFire(round, h, ms) {
  h.live -= ms;
  return h.live > 0;
}

/* ----------------------------------------------------------- hanged men */

function moveHanged(round, m, ms, k) {
  const you = round.you;
  if (m.beam === undefined) Object.assign(m, { beam: m.y, rest: m.y - HANGED_HANG, low: m.y - HANGED_HANG - HANGED_ROPE, y: m.y - HANGED_HANG, cool: 0, act: "sway" });
  m.cool = Math.max(0, m.cool - ms);
  const dt = ms / 1000;
  const at = () => ({ kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  if (m.act === "sway") {
    if (m.cool > 0 || you.out > 0 || !inView(round, m, k)) return;
    if (Math.abs(you.x - m.x) > HANGED_NEAR || you.y > m.rest - 0.5 || you.y < m.low - 1.5) return;
    m.act = "warn";
    m.wait = HANGED_WARN_MS;
    round.events.push({ type: "hangedWarn", ...at() });
  } else if (m.act === "warn") {
    m.wait -= ms;
    if (m.wait > 0) return;
    m.act = "drop";
    m.to = clamp(you.y + HANGED_LOW, m.low, m.rest);
    round.events.push({ type: "hangedDrop", ...at() });
  } else if (m.act === "drop") {
    m.y = Math.max(m.to, m.y - HANGED_DROP_V * dt);
    if (m.y > m.to) return;
    m.act = "hold";
    m.wait = HANGED_HOLD_MS;
    round.events.push({ type: "hangedSnap", ...at() });
  } else if (m.act === "hold") {
    m.wait -= ms;
    if (m.wait > 0) return;
    m.act = "haul";
    round.events.push({ type: "hangedHaul", ...at() });
  } else if (m.act === "haul") {
    m.y = Math.min(m.rest, m.y + HANGED_HAUL_V * dt);
    if (m.y < m.rest) return;
    m.act = "sway";
    m.cool = HANGED_REST_MS;
  }
}

/* -------------------------------------------------------- shutter ghouls */

function moveShutter(round, m, ms, k) {
  const you = round.you;
  if (m.hx === undefined) Object.assign(m, { hx: m.x, hy: m.y, ext: 0, rx: 0, ry: 0, reach: 1, cool: 0, act: "hide" });
  const dt = ms / 1000;
  const at = () => ({ kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  if (m.act === "hide") {
    m.cool = Math.max(0, m.cool - ms);
    if (m.cool > 0 || you.out > 0 || !inView(round, m, k)) return;
    if (Math.abs(you.x - m.hx) > SHUTTER_NEAR || Math.abs(you.y + k.SHOT_Y - m.hy) > SHUTTER_HIGH) return;
    m.act = "rattle";
    m.wait = SHUTTER_RATTLE_MS;
    m.dir = Math.sign(you.x - m.hx) || m.dir;
    round.events.push({ type: "shutterRattle", ...at() });
    return;
  }
  if (m.act === "rattle") {
    m.wait -= ms;
    if (m.wait > 0) return;
    // Out toward your chest, as far as it reaches.
    const dx = you.x - m.hx;
    const dy = you.y + k.SHOT_Y - m.h / 2 - m.hy;
    const len = Math.hypot(dx, dy) || 1;
    m.reach = Math.min(len, SHUTTER_REACH);
    m.rx = (dx / len) * m.reach;
    m.ry = (dy / len) * m.reach;
    m.dir = Math.sign(dx) || m.dir;
    m.act = "lunge";
    round.events.push({ type: "shutterLunge", ...at(), tx: m.hx + m.rx, ty: m.hy + m.ry });
  } else if (m.act === "lunge") {
    m.ext = Math.min(1, m.ext + (SHUTTER_LUNGE_V * dt) / m.reach);
    if (m.ext >= 1) {
      m.act = "out";
      m.wait = SHUTTER_OUT_MS;
    }
  } else if (m.act === "out") {
    m.wait -= ms;
    if (m.wait > 0) return;
    m.act = "pull";
    round.events.push({ type: "shutterPull", ...at() });
  } else if (m.act === "pull") {
    m.ext = Math.max(0, m.ext - (SHUTTER_PULL_V * dt) / m.reach);
    if (m.ext <= 0) {
      m.act = "hide";
      m.cool = SHUTTER_REST_MS;
    }
  }
  m.x = m.hx + m.rx * m.ext;
  m.y = m.hy + m.ry * m.ext;
}

/* ------------------------------------------------------------- wolfsbane */

// A bolt that hit a turned villager or a moonhound does double under Wolfsbane.
function shotRule(round, m) {
  if (round.effects.bane > 0 && (m.kind === "moonhound" || (m.kind === "villager" && m.turned))) return BANE_MULT;
  return 1;
}

/* ------------------------------------------------------------- the Beast */

const rage = (b) => b.hp <= b.max * BEAST_RAGE;
const quick = (round, b, ms) => (ms * (b.raged ? BEAST_QUICK : 1)) / round.spec.pace;
const at = (b, up = 0.5) => ({ kind: b.kind, x: b.x, y: b.y + b.h * up });

// The Beast in the air along b.fly; true when it has come down.
function fly(b, ms) {
  const f = b.fly;
  f.t = Math.min(f.T, f.t + ms);
  const p = f.t / f.T;
  b.x = f.x0 + (f.x1 - f.x0) * p;
  b.y = f.y0 + (f.y1 - f.y0) * p + f.arc * 4 * p * (1 - p);
  return f.t >= f.T;
}

// A pounce from where it is to where you stand (clamped to the arena), the
// shadow of its landing on the floor.
function pounce(round, b, k, second) {
  const spec = round.spec;
  const tx = clamp(round.you.x, spec.arena + b.w / 2 + 1, spec.length - b.w / 2 - 1);
  const floor = k.groundAt(spec, tx);
  const T = second ? SECOND_MS : POUNCE_MS;
  b.fly = { x0: b.x, y0: b.y, x1: tx, y1: floor, T, t: 0, arc: second ? POUNCE_ARC * 0.6 : POUNCE_ARC };
  b.act = "pounce";
  b.second = second;
  b.dir = Math.sign(tx - b.x) || b.dir;
  round.hazards.push({ kind: "shadow", x: tx, y: floor, w: b.w, h: 0.6, warn: T, total: T, live: 0, cause: "beast" });
  round.events.push({ type: "beastPounce", ...at(b), tx, ty: floor, second });
}

// The next move: a swipe close up, every third a howl, else a wall leap.
function choose(round, b, k) {
  const spec = round.spec;
  const you = round.you;
  b.moves++;
  const gap = Math.abs(you.x - b.x) - b.w / 2;
  if (gap <= BEAST_SWIPE_NEAR && b.swipeCool <= 0) {
    b.act = "swipeWind";
    b.wait = SWIPE_WIND_MS / spec.pace;
    round.events.push({ type: "swipeWind", ...at(b, 0.7), dir: b.dir });
  } else if (b.moves % 3 === 0 && alive(round, "moonhound") < HOUND_CAP) {
    b.act = "howl";
    b.wait = HOWL_MS;
    round.events.push({ type: "beastHowl", ...at(b, 0.9), ms: HOWL_MS });
  } else {
    // Onto the wall farther from you.
    const side = you.x < (spec.arena + spec.length) / 2 ? 1 : -1;
    const wx = side < 0 ? spec.arena + b.w / 2 - WALL_INSET : spec.length - b.w / 2 + WALL_INSET;
    b.side = side;
    b.fly = { x0: b.x, y0: b.y, x1: wx, y1: b.floor + BEAST_CLING_UP, T: BOUND_MS, t: 0, arc: BOUND_ARC };
    b.act = "bound";
    b.dir = side;
    round.events.push({ type: "beastLeap", ...at(b), tx: wx, side });
  }
}

// The howl is over: hounds come in from the arena's ends, the far one first.
function callHounds(round, b, k) {
  const spec = round.spec;
  const n = Math.min(HOWL_CALL, HOUND_CAP - alive(round, "moonhound"));
  const ends = [spec.arena + 3, spec.length - 3];
  if (round.you.x < (spec.arena + spec.length) / 2) ends.reverse();
  for (let i = 0; i < n; i++) {
    const x = ends[i % 2];
    k.spawnMonster(round, "moonhound", x, k.groundAt(spec, x), { force: true, rise: 0 });
  }
  round.events.push({ type: "houndCall", ...at(b, 0.9), n });
}

function moveBeast(round, b, ms, random, k) {
  const spec = round.spec;
  const you = round.you;
  if (!b.act) Object.assign(b, { act: "idle", wait: quick(round, b, BEAST_IDLE_MS), floor: k.groundAt(spec, b.x), moves: 0, swipeCool: 0, fly: null, second: false });
  b.swipeCool = Math.max(0, b.swipeCool - ms);
  if (!b.raged && rage(b)) {
    b.raged = true;
    round.events.push({ type: "beastMoon", ...at(b) });
  }
  if (b.act === "idle" || b.act === "rest" || b.act === "swipeWind" || b.act === "howl" || b.act === "crouch") b.dir = Math.sign(you.x - b.x) || b.dir;
  if (b.act === "bound" || b.act === "pounce") {
    if (!fly(b, ms)) return;
    if (b.act === "bound") {
      b.act = "cling";
      b.wait = BEAST_CLING_MS;
      b.dir = -b.side;
      round.events.push({ type: "beastCling", ...at(b), side: b.side });
      return;
    }
    b.y = b.floor;
    round.events.push({ type: "beastLand", ...at(b, 0), big: true, second: b.second });
    if (b.raged && !b.second) {
      b.act = "crouch";
      b.wait = quick(round, b, SECOND_WAIT_MS);
    } else {
      b.act = "rest";
      b.wait = quick(round, b, LAND_REST_MS);
    }
    return;
  }
  b.wait -= ms;
  if (b.act === "idle") {
    const gap = Math.abs(you.x - b.x) - b.w / 2;
    if (gap > 3) b.x = clamp(b.x + b.dir * BEAST_WALK * spec.pace * (ms / 1000), k.arenaMin(round, b), k.arenaMax(round, b));
    if (b.wait <= 0) choose(round, b, k);
  } else if (b.act === "cling") {
    if (b.wait <= 0) pounce(round, b, k, false);
  } else if (b.act === "crouch") {
    if (b.wait <= 0) pounce(round, b, k, true);
  } else if (b.act === "swipeWind") {
    if (b.wait > 0) return;
    const x = b.x + b.dir * (b.w / 2 + SWIPE_REACH / 2);
    round.hazards.push({ kind: "claw", x, y: b.floor, w: SWIPE_REACH, h: SWIPE_H, dir: b.dir, live: SWIPE_LIVE_MS, max: SWIPE_LIVE_MS, cause: "claw" });
    round.events.push({ type: "beastSwipe", ...at(b, 0.6), dir: b.dir });
    b.swipeCool = SWIPE_COOL_MS;
    b.act = "rest";
    b.wait = quick(round, b, SWIPE_REST_MS);
  } else if (b.act === "howl") {
    if (b.wait > 0) return;
    callHounds(round, b, k);
    b.act = "rest";
    b.wait = quick(round, b, HOWL_REST_MS);
  } else if (b.act === "rest") {
    if (b.wait > 0) return;
    b.act = "idle";
    b.wait = quick(round, b, BEAST_IDLE_MS);
  }
}

// A shot doubles while the Beast clings, and again under Wolfsbane.
function beastWeak(b, s, round) {
  return (b.act === "cling" ? CLING_MULT : 1) * (round && round.effects.bane > 0 ? BANE_MULT : 1);
}

// The landing shadow: it is on the floor till the Beast comes down.
function stepShadow(round, h, ms) {
  h.warn -= ms;
  return h.warn > 0;
}

// A claw: out for its short time. Returns whether it is still on the field.
function stepClaw(round, h, ms) {
  h.live -= ms;
  return h.live > 0;
}

export const VILLAGE = freeze({
  id: "village",
  monsters: MONSTERS,
  walkers: freeze(["villager", "moonhound"]),
  fourLegged: freeze(["moonhound"]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({ villager: "walk", hanged: "sway", shutter: "hide", moonhound: "prowl" }),
  // A shutter ghoul can be hit, and can hurt, only while it is out.
  solid: freeze({ shutter: (m) => m.act === "lunge" || m.act === "out" || m.act === "pull" }),
  move: freeze({ villager: moveVillager, hanged: moveHanged, shutter: moveShutter, moonhound: moveMoonhound }),
  kill: freeze({}),
  horde: freeze({}),
  tick,
  shot: shotRule,
  land: freeze({ torch: torchLands }),
  bosses: BOSSES,
  boss: freeze({ beast: moveBeast }),
  weak: freeze({ beast: beastWeak }),
  hazards: freeze({ torchfire: stepFire, shadow: stepShadow, claw: stepClaw }),
});
