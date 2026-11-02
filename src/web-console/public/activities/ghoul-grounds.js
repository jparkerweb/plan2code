// Plan2Code Web Console - Ghoul Rush's Grounds stage, its rules: the monsters of the garden (topiary beasts that creep when your back is turned, rootlings under the lawn, lantern moths, mulch crawlers in the leaf piles) and its boss, the Groundskeeper, as a stage pack that ghoul.js plugs in.
//
// Like the Graveyard's pack (see ghoul-graveyard.js for what a pack holds),
// every rule here is handed a kit `k` of ghoul.js's own helpers, so this file
// never reaches back into it; its one import is the Graveyard's burrow,
// the way something moves along under the ground. The pack adds a few fields
// of its own that ghoul.js reads:
//
// - `cut`: kinds the Hedge Shears (a stage-only power-up, see ghoul-powers.js)
//   kill outright with any shot.
// - `weak`: by boss kind, `(boss, shot)` giving the damage multiplier of a
//   shot that has just hit it (3 on the Groundskeeper's lantern).
// - `cause`: by boss kind, what its touch is called when it costs a life.
//
// A topiary beast is frozen (`still`) while you face it and charges
// (`creep`) the moment your back is turned. A rootling is a crack running
// along under the lawn after you (`trail`), which stops and warns (`warn`)
// where a root will come up (`up`), then sinks (`sink`) and tracks again. A
// lantern moth flutters at you in flocks of three, faster in a dark room and
// faster still, and straight, while you hold the Lantern. A mulch crawler
// waits in its leaf pile (`pile`), bursts out (`burst`) when you come near and
// crawls (`crawl`) at you.
//
// The Groundskeeper is an old gardener with a scythe and a lantern. He
// winds up (`wind`) and sweeps a low scythe along the floor toward you to
// jump, or (now and then, his scythe raised high and a pale band across the
// air in front of him as the wind-up) a high one at the height of a jump, to
// stay down under; then he rests (`rest`). He winds up again (`throwWind`)
// and lobs the lantern's fire to where you stand, which leaves a burning patch
// on the floor. His lantern, at his belt on the side he faces, takes triple
// damage, but only while it swings into the open: late in a rest after the
// scythe and after a mower charge's stall. At half his hp he climbs onto a
// rusted mower (`mount`): now he also revs (`rev`), charges across the arena
// to the far wall (`charge`), and stalls against it (`stall`, no attacks)
// before he turns around, his sweeps and throws come a little quicker, the
// charges a little oftener, the throw lands a second patch where you are
// heading, and each time his lantern opens a few lantern moths flutter in
// toward it (never more than MOTH_CAP alive).

import { burrow } from "./ghoul-graveyard.js";

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  topiary: freeze({ name: "Topiary Beast", w: 4, h: 5.4, hp: 6, speed: 26, points: 220, stomp: false, head: false, color: "#2f6a2a" }),
  rootling: freeze({ name: "Rootling", w: 2.8, h: 4, hp: 3, speed: 20, points: 140, stomp: true, head: false, color: "#5a3e22" }),
  moth: freeze({ name: "Lantern Moth", w: 1.8, h: 1.4, hp: 1, speed: 14, points: 40, stomp: true, head: false, perch: true, flies: true, color: "#f2d68a" }),
  mulch: freeze({ name: "Mulch Crawler", w: 3, h: 2.2, hp: 2, speed: 16, points: 80, stomp: true, head: false, color: "#7a5428" }),
});

// A topiary beast creeps only within TOPIARY_NEAR of you and only while you
// do not face it.
export const TOPIARY_NEAR = 60;
// A rootling tracks you while you are within ROOT_NEAR (and ROOT_HIGH up or
// down) for up to ROOT_TRAIL_MS, or until it is under you, then warns for
// ROOT_WARN_MS where it is, is up for ROOT_UP_MS and sinks for ROOT_SINK_MS.
export const ROOT_NEAR = 24;
export const ROOT_HIGH = 4;
export const ROOT_TRAIL_MS = 1500;
export const ROOT_WARN_MS = 500;
export const ROOT_UP_MS = 1200;
export const ROOT_SINK_MS = 300;
// A moth flies at MONSTERS.moth.speed, MOTH_DARK times that in a dark room
// and MOTH_LANTERN times that while you hold the Lantern, wobbling (not
// then) by MOTH_WOBBLE a second. A spawn row of moths is MOTH_FLOCK of
// them, the others MOTH_SPREAD either side.
export const MOTH_DARK = 1.5;
export const MOTH_LANTERN = 2.2;
export const MOTH_WOBBLE = 9;
export const MOTH_FLOCK = 3;
export const MOTH_SPREAD = 2.4;
// A mulch pile bursts when you are within MULCH_NEAR, taking MULCH_BURST_MS.
export const MULCH_NEAR = 10;
export const MULCH_BURST_MS = 350;

// The Groundskeeper. He keeps KEEPER_KEEP from you (walking at KEEPER_WALK),
// rests KEEPER_IDLE_MS between moves and alternates the scythe and the
// lantern; every third move once mounted is a charge. The scythe winds up
// SCYTHE_WIND_MS and rests SCYTHE_REST_MS after, its lantern open for the
// last KEEPER_OPEN_MS; the throw winds up LANTERN_WIND_MS and its fire lands
// FIRE_FLIGHT_MS later, burning FIRE_MS on a patch FIRE_W wide and FIRE_H
// high, then he rests THROW_REST_MS. At KEEPER_RAGE of his hp he mounts the
// mower (KEEPER_MOUNT_MS), widening to MOWER_W; its charge revs
// MOWER_REV_MS, runs at MOWER_V and stalls MOWER_STALL_MS, his lantern open
// (and him turned to you) for the last KEEPER_OPEN_MS. On the mower his waits
// are KEEPER_QUICK times as long, a charge also comes early (the move before
// the third) CHARGE_EARLY of the time, the throw also lands a patch FIRE_LEAD
// ahead of you, and each opening calls MOTH_CALL moths (one more half the
// time) that head for the lantern for MOTH_LURE_MS. A high sweep (the scythe
// swung at the height of a jump, never the first swing, SWEEP_REPEAT of the
// time after a high one and SWEEP_HIGH after a low one) is a box SWEEP_W wide
// from SWEEP_LOW to SWEEP_TOP over the floor, running at SWEEP_V for
// SWEEP_LIFE_MS at most; it hurts only a body off the ground. The lantern is a box LANTERN_W by LANTERN_H
// centered LANTERN_Y up, LANTERN_BACK in from his edge, and a shot in it does
// LANTERN_MULT times the damage.
export const BOSSES = freeze({
  keeper: freeze({ name: "The Groundskeeper", sub: "Jump low sweeps, stay down for high ones, shoot the lantern", w: 9, h: 16, hp: 95, points: 3000, color: "#c8a24a" }),
});
export const KEEPER_KEEP = 16;
export const KEEPER_WALK = 5;
export const KEEPER_POCKET = 6;
export const KEEPER_IDLE_MS = 1300;
export const SCYTHE_WIND_MS = 600;
export const SCYTHE_REST_MS = 1500;
export const KEEPER_OPEN_MS = 540;
export const LANTERN_WIND_MS = 550;
export const FIRE_FLIGHT_MS = 800;
export const FIRE_MS = 3000;
export const FIRE_W = 6;
export const FIRE_H = 3;
export const THROW_REST_MS = 800;
export const KEEPER_RAGE = 0.5;
export const KEEPER_MOUNT_MS = 900;
export const MOWER_W = 12;
export const MOWER_REV_MS = 700;
export const MOWER_V = 55;
export const MOWER_STALL_MS = 1500;
export const KEEPER_QUICK = 0.75;
export const LANTERN_W = 3;
export const LANTERN_H = 3.2;
export const LANTERN_Y = 3.2;
export const LANTERN_BACK = 0.6;
export const LANTERN_MULT = 3;
export const SWEEP_W = 2.4;
export const SWEEP_LOW = 5.4;
export const SWEEP_TOP = 13;
export const SWEEP_V = 40;
export const SWEEP_LIFE_MS = 4000;
export const SWEEP_HIGH = 0.7;
export const SWEEP_REPEAT = 0.3;
export const FIRE_LEAD = 11;
export const CHARGE_EARLY = 0.3;
export const MOTH_CALL = 2;
export const MOTH_CAP = 4;
export const MOTH_LURE_MS = 1300;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------ monsters */

// Frozen while you face it (or are far from it), creeping at you the moment
// your back is turned.
function moveTopiary(round, m, ms, k) {
  const you = round.you;
  const seen = Math.sign(m.x - you.x) === you.face;
  const want = seen || Math.abs(you.x - m.x) > TOPIARY_NEAR ? "still" : "creep";
  if (want !== m.act) {
    round.events.push({ type: want === "creep" ? "rustle" : "freeze", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    m.act = want;
  }
  if (m.act === "creep") k.walk(round, m, k.towardYou(round, m), MONSTERS.topiary.speed * round.spec.pace, ms / 1000);
}

function moveRootling(round, m, ms, k) {
  const you = round.you;
  m.wait = Math.max(0, m.wait - ms);
  if (m.act === "warn") {
    if (m.wait) return;
    m.act = "up";
    m.wait = ROOT_UP_MS;
    round.events.push({ type: "rootUp", kind: m.kind, x: m.x, y: m.y });
  } else if (m.act === "up") {
    if (m.wait) return;
    m.act = "sink";
    m.wait = ROOT_SINK_MS;
  } else if (m.act === "sink") {
    if (m.wait) return;
    m.act = "trail";
    m.wait = ROOT_TRAIL_MS;
  } else {
    if (!m.go) {
      m.go = true;
      m.wait = ROOT_TRAIL_MS;
    }
    // The crack only follows you while you are near on its floor.
    if (Math.abs(you.x - m.x) >= ROOT_NEAR || Math.abs(you.y - m.y) >= ROOT_HIGH) {
      m.wait = ROOT_TRAIL_MS;
      return;
    }
    const there = burrow(round, m, k, you.x, MONSTERS.rootling.speed * round.spec.pace, ms / 1000);
    if (!there && m.wait) return;
    m.act = "warn";
    m.wait = ROOT_WARN_MS;
    round.events.push({ type: "rootWarn", kind: m.kind, x: m.x, y: m.y });
  }
}

// A flock of three, fluttering at your chest.
function moveMoth(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  if (!m.flock) {
    m.flock = true;
    if (!m.horde) {
      for (const s of [-1, 1]) {
        const y = Math.max(k.groundAt(spec, m.x + s * MOTH_SPREAD) + 0.6, m.y + s * 1.4);
        k.spawnMonster(round, "moth", m.x + s * MOTH_SPREAD, y, { force: true, flock: true });
      }
    }
  }
  const lit = round.effects.lantern > 0;
  const speed = MONSTERS.moth.speed * spec.pace * (lit ? MOTH_LANTERN : round.dark ? MOTH_DARK : 1);
  // A moth called by the lantern heads for it first.
  let goalX = you.x;
  let goalY = you.y + k.SHOT_Y - MONSTERS.moth.h / 2;
  const boss = round.boss;
  if (m.lure > 0 && boss && boss.state === "fight") {
    m.lure -= ms;
    goalX = boss.x + boss.dir * (boss.w / 2 - LANTERN_BACK);
    goalY = boss.y + LANTERN_Y;
    if (Math.hypot(goalX - m.x, goalY - m.y) < 2.5) m.lure = 0;
  } else m.lure = 0;
  const dx = goalX - m.x;
  const dy = goalY - m.y;
  const d = Math.hypot(dx, dy) || 1;
  m.x += (dx / d) * speed * dt;
  m.y += (dy / d) * speed * dt;
  // The lantern draws them straight in; otherwise they flutter.
  if (!lit) {
    m.y += Math.sin(m.t / 170 + m.id) * MOTH_WOBBLE * dt;
    m.x += Math.cos(m.t / 230 + m.id) * MOTH_WOBBLE * 0.6 * dt;
  }
  m.dir = Math.sign(dx) || m.dir;
  m.y = Math.max(k.groundAt(spec, m.x) + 0.6, Math.min(k.CHANDELIER_Y, m.y));
}

function moveMulch(round, m, ms, k) {
  const you = round.you;
  if (m.act === "pile" && m.horde) m.act = "crawl";
  if (m.act === "pile") {
    if (Math.abs(you.x - m.x) >= MULCH_NEAR || Math.abs(you.y - m.y) >= 5) return;
    m.act = "burst";
    m.wait = MULCH_BURST_MS;
    round.events.push({ type: "leaves", kind: m.kind, x: m.x, y: m.y });
  } else if (m.act === "burst") {
    m.wait = Math.max(0, m.wait - ms);
    if (!m.wait) m.act = "crawl";
  } else k.walk(round, m, k.towardYou(round, m), MONSTERS.mulch.speed * round.spec.pace, ms / 1000);
}

// A beast or a root cut down by the Hedge Shears leaves leaves.
function snipped(round, m, how) {
  if (how === "shears") round.events.push({ type: "snip", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

/* ---------------------------------------------------------- the keeper */

const bounds = (round, b) => [round.spec.arena + KEEPER_POCKET + b.w / 2, round.spec.length - KEEPER_POCKET - b.w / 2];
const wait = (round, b, ms) => (ms * (b.mower ? KEEPER_QUICK : 1)) / round.spec.pace;

// The next move: every third once mounted a charge (sometimes the one before),
// else the scythe (low, or now and then high) and the lantern in turn.
function pick(round, b, random) {
  b.attacks++;
  b.lit = false;
  const early = b.attacks % 3 === 2 && random() < CHARGE_EARLY;
  if (b.mower && b.lastCharge !== b.attacks - 1 && (b.attacks % 3 === 0 || early)) {
    b.lastCharge = b.attacks;
    const [lo, hi] = bounds(round, b);
    b.charge = b.x < (lo + hi) / 2 ? 1 : -1;
    b.dir = b.charge;
    b.act = "rev";
    b.wait = MOWER_REV_MS;
    round.events.push({ type: "mowerRev", kind: b.kind, x: b.x, y: b.y + 3, dir: b.dir });
  } else if (b.attacks % 2) {
    // The first swing is always low; after that the height varies.
    b.high = b.swings > 0 && random() < (b.high ? SWEEP_REPEAT : SWEEP_HIGH);
    b.swings = (b.swings || 0) + 1;
    b.act = "wind";
    b.wait = wait(round, b, SCYTHE_WIND_MS);
    round.events.push({ type: "scytheWind", kind: b.kind, x: b.x, y: b.y + b.h * 0.6, dir: b.dir, high: b.high });
  } else {
    b.act = "throwWind";
    b.wait = wait(round, b, LANTERN_WIND_MS);
    round.events.push({ type: "lanternWind", kind: b.kind, x: b.x + b.dir * b.w * 0.4, y: b.y + LANTERN_Y, dir: b.dir });
  }
}

function moveKeeper(round, b, ms, random, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  const floor = k.groundAt(spec, b.x);
  const [lo, hi] = bounds(round, b);
  if (!b.act) {
    b.act = "idle";
    b.wait = wait(round, b, KEEPER_IDLE_MS);
  }
  b.wait -= ms;
  if (b.act !== "charge" && b.act !== "rev" && !(b.act === "stall" && b.wait > KEEPER_OPEN_MS)) b.dir = Math.sign(you.x - b.x) || b.dir;
  // The lantern swings into the open late in a rest and late in a stall.
  const open = (b.act === "rest" || b.act === "stall") && b.wait <= KEEPER_OPEN_MS;
  if (open && !b.lit) {
    const lx = b.x + b.dir * (b.w / 2 - LANTERN_BACK);
    round.events.push({ type: "lanternOpen", kind: b.kind, x: lx, y: b.y + LANTERN_Y });
    if (b.mower) callMoths(round, b, lx, random, k);
  }
  b.lit = open;
  if (b.act === "idle") {
    const side = Math.sign(b.x - you.x) || 1;
    const goal = clamp(you.x + side * KEEPER_KEEP, lo, hi);
    if (Math.abs(goal - b.x) > 1) b.x += Math.sign(goal - b.x) * KEEPER_WALK * spec.pace * dt;
    if (b.wait > 0) return;
    if (b.hp <= b.max * KEEPER_RAGE && !b.mower) {
      b.mower = true;
      b.w = MOWER_W;
      b.x = clamp(b.x, ...bounds(round, b));
      b.act = "mount";
      b.wait = KEEPER_MOUNT_MS;
      round.events.push({ type: "keeperMower", kind: b.kind, x: b.x, y: b.y + b.h / 2 });
      return;
    }
    pick(round, b, random);
  } else if (b.act === "mount") {
    if (b.wait <= 0) {
      b.act = "idle";
      b.wait = wait(round, b, KEEPER_IDLE_MS);
    }
  } else if (b.act === "wind") {
    if (b.wait > 0) return;
    if (b.high) round.hazards.push({ kind: "sweep", x: b.x + b.dir * (b.w / 2), y: floor, w: SWEEP_W, h: SWEEP_TOP, dir: b.dir, warn: 0, live: 0, life: SWEEP_LIFE_MS, cause: "scythe" });
    else round.waves.push({ x: b.x + b.dir * (b.w / 2), y: floor, dir: b.dir, life: 6000, kind: "scythe", cause: "scythe" });
    round.events.push({ type: "scytheSweep", kind: b.kind, x: b.x + b.dir * (b.w / 2), y: floor, dir: b.dir, high: Boolean(b.high) });
    b.act = "rest";
    b.wait = wait(round, b, SCYTHE_REST_MS);
  } else if (b.act === "throwWind") {
    if (b.wait > 0) return;
    const x = clamp(you.x, spec.arena + 2, spec.length - 2);
    const y = k.groundAt(spec, x);
    const sx = b.x + b.dir * b.w * 0.4;
    const sy = b.y + LANTERN_Y;
    round.hazards.push({ kind: "fire", x, y, w: FIRE_W, h: FIRE_H, warn: FIRE_FLIGHT_MS, live: 0, cause: "fire", sx, sy });
    const throwAt = { type: "lanternThrow", kind: b.kind, x: sx, y: sy, tx: x, ty: y };
    // Mounted, a second patch where you are heading.
    if (b.mower) {
      let ahead = (Math.sign(you.vx) || you.face || 1) * FIRE_LEAD;
      if (Math.abs(clamp(x + ahead, spec.arena + 2, spec.length - 2) - x) < FIRE_W) ahead = -ahead;
      const x2 = clamp(x + ahead, spec.arena + 2, spec.length - 2);
      const y2 = k.groundAt(spec, x2);
      round.hazards.push({ kind: "fire", x: x2, y: y2, w: FIRE_W, h: FIRE_H, warn: FIRE_FLIGHT_MS, live: 0, cause: "fire", sx, sy });
      Object.assign(throwAt, { tx2: x2, ty2: y2 });
    }
    round.events.push(throwAt);
    b.act = "idle";
    b.wait = wait(round, b, THROW_REST_MS);
  } else if (b.act === "rest") {
    if (b.wait > 0) return;
    b.act = "idle";
    b.wait = wait(round, b, KEEPER_IDLE_MS);
  } else if (b.act === "rev") {
    if (b.wait > 0) return;
    b.act = "charge";
    round.events.push({ type: "mowerCharge", kind: b.kind, x: b.x, y: b.y + 3, dir: b.dir });
  } else if (b.act === "charge") {
    b.x += b.dir * MOWER_V * spec.pace * dt;
    if (b.x * b.dir < (b.dir > 0 ? hi : -lo)) return;
    b.x = b.dir > 0 ? hi : lo;
    b.act = "stall";
    b.wait = MOWER_STALL_MS;
    round.events.push({ type: "mowerStall", kind: b.kind, x: b.x + b.dir * (b.w / 2), y: b.y + 2, dir: b.dir });
  } else if (b.act === "stall") {
    if (b.wait > 0) return;
    b.act = "idle";
    b.wait = wait(round, b, KEEPER_IDLE_MS);
  }
}

// The multiplier of a shot that has just hit the Groundskeeper: the lantern
// at his belt on the side he faces, when it is in the open.
function lanternHit(b, s) {
  if (!b.lit) return 1;
  const lx = b.x + b.dir * (b.w / 2 - LANTERN_BACK);
  return Math.abs(s.x - lx) <= LANTERN_W / 2 && Math.abs(s.y - (b.y + LANTERN_Y)) <= LANTERN_H / 2 ? LANTERN_MULT : 1;
}

// The lantern draws a few moths in: up to MOTH_CALL (one more half the time),
// never more than MOTH_CAP alive, from either side, high up.
function callMoths(round, b, lx, random, k) {
  const alive = round.monsters.filter((m) => !m.dead && m.kind === "moth").length;
  const n = Math.min(MOTH_CALL + (random() < 0.5 ? 1 : 0), MOTH_CAP - alive);
  if (n <= 0) return;
  const lo = round.spec.arena + 2;
  const hi = round.spec.length - 2;
  for (let i = 0; i < n; i++) {
    const x = clamp(lx + (i % 2 ? 1 : -1) * (13 + i * 3), lo, hi);
    k.spawnMonster(round, "moth", x, Math.min(k.CHANDELIER_Y, b.y + LANTERN_Y + 5 + i * 2), { force: true, flock: true, lure: MOTH_LURE_MS });
  }
  round.events.push({ type: "mothCall", kind: b.kind, x: lx, y: b.y + LANTERN_Y, n });
}

// A high sweep: the scythe's edge running along the air at the height of a
// jump, the way it was swung. It hurts a body off the ground (the box from
// SWEEP_LOW up); one standing on the floor passes under. Returns whether it
// is still on the field.
function stepSweep(round, h, ms, k) {
  const you = round.you;
  h.x += h.dir * SWEEP_V * round.spec.pace * (ms / 1000);
  h.life -= ms;
  if (Math.abs(you.x - h.x) < (h.w + k.HIT_W) / 2 && you.y < h.y + SWEEP_TOP && you.y + k.HIT_H > h.y + SWEEP_LOW) k.struck(round, h.cause);
  return h.life > 0 && h.x > round.spec.arena - 2 && h.x < round.spec.length && k.groundAt(round.spec, h.x) === h.y;
}

// A patch of fire: the lantern's fire in the air for `warn`, then burning
// for FIRE_MS where it came down. Returns whether it is still on the field.
function stepFire(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = FIRE_MS;
    round.events.push({ type: "fireLand", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

export const GROUNDS = freeze({
  id: "grounds",
  monsters: MONSTERS,
  walkers: freeze(["topiary", "mulch"]),
  fourLegged: freeze(["topiary"]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({ topiary: "still", rootling: "trail", mulch: "pile" }),
  swoops: freeze({ moth: () => true }),
  // A root is solid only while it is up; a mulch pile only once it crawls.
  solid: freeze({
    rootling: (m) => m.act === "up",
    mulch: (m) => m.act === "crawl",
  }),
  move: freeze({ topiary: moveTopiary, rootling: moveRootling, moth: moveMoth, mulch: moveMulch }),
  kill: freeze({ topiary: snipped, rootling: snipped }),
  horde: freeze({}),
  cut: freeze(["topiary", "rootling"]),
  bosses: BOSSES,
  boss: freeze({ keeper: moveKeeper }),
  weak: freeze({ keeper: lanternHit }),
  cause: freeze({ keeper: (b) => (b.mower ? "mower" : "keeper") }),
  hazards: freeze({ fire: stepFire, sweep: stepSweep }),
});
