// Plan2Code Web Console - Ghoul Rush's Graveyard stage, its rules: the monsters that haunt it (grasping hands, mourners, grave robbers, rotters and the legs they leave, carrion crows) and its boss, Mother Mourning, as a stage pack that ghoul.js plugs in.
//
// No imports: ghoul.js hands every rule here a kit `k` of its own helpers
// (walk, throwBone, spawnMonster, groundAt, struck, hurt and the numbers they
// need), so this file never reaches back into it. A pack is plain data and
// functions:
//
// - `monsters`: each kind's numbers, as in ghoul.js's MONSTERS (`perch`: its
//   spawn names the height it waits at; `flies`: a horde one comes in high).
// - `walkers`, `zombies`, `stackers`, `climbers`: kinds that join ghoul.js's
//   sets of the same names (a rotter is a zombie in every way but its death).
// - `act`: what a kind starts out doing; `solid`: whether one can hurt and be
//   hit just now; `move`: one slice of a kind's moving; `kill`: what a death
//   leaves; `horde`: what a kind comes in from the edge with.
// - `bosses`, `boss` (one slice of a boss's fight), `guard` (true while
//   shots and stomps glance off it) and `hazards` (by kind, one slice of
//   something a boss left on the field: a box `w` by `h` on the floor at x
//   that hurts while `live` is over 0; false once it is gone).
//
// Grasping hands lie under the dirt until you come near, burst up and grab
// at you, sink, and creep along under the ground after you to come up again.
// A mourner glides after you and now and then lifts her veil and wails,
// slowing you to half speed for a moment if you are close. A grave robber
// walks at you, then digs in and comes up behind you. A rotter is a zombie
// whose legs, shot off at the body, keep on walking after you (a headshot or
// a stomp finishes it). A carrion crow perches on a headstone, then dives
// straight at you and climbs away to dive again.
//
// Mother Mourning, a giant weeping angel, weeps (stone: shots and stomps
// glance off, and she flings headstones) and then turns and watches. Moving
// at all while she watches (running, jumping, falling) brings a stone fist
// down where you are, its shadow first; stand still and shoot, for only
// then can she be hurt. And she moves when you are not looking: each time she
// turns back she has blinked a few units nearer you, in a puff of stone dust.
// At half her hp she spreads her wings: a shorter weep, two headstones at a
// throw, a shockwave along the floor as each weep begins, and while she
// watches a stone fist falls near you now and then whether you move or not.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  hands: freeze({ name: "Grasping Hands", w: 3, h: 3.2, hp: 2, speed: 11, points: 90, stomp: true, head: false, color: "#5a6a4a" }),
  mourner: freeze({ name: "Mourner", w: 3, h: 5.6, hp: 4, speed: 6, points: 180, stomp: false, head: true, color: "#34303e" }),
  robber: freeze({ name: "Grave Robber", w: 3, h: 4.8, hp: 3, speed: 9, points: 160, stomp: true, head: true, color: "#6a5030" }),
  rotter: freeze({ name: "Rotter", w: 3, h: 5, hp: 3, speed: 8, lurch: 18, points: 110, stomp: true, head: true, color: "#4a5a20" }),
  legs: freeze({ name: "Rotter's legs", w: 2.2, h: 2.4, hp: 1, speed: 22, points: 40, stomp: true, head: false, color: "#4a5a20" }),
  crow: freeze({ name: "Carrion Crow", w: 2.4, h: 1.6, hp: 1, speed: 30, points: 60, stomp: true, head: false, perch: true, flies: true, color: "#22202a" }),
});

// Grasping hands wake within HANDS_NEAR (and HANDS_HIGH up or down), take
// HANDS_RISE_MS to come up, grab for HANDS_UP_MS, take HANDS_SINK_MS to go
// down, then creep under the ground after you for up to HANDS_CREEP_MS
// before they come up again; under the ground they cannot cross a pit or a
// step.
export const HANDS_NEAR = 12;
export const HANDS_HIGH = 8;
export const HANDS_RISE_MS = 420;
export const HANDS_UP_MS = 1700;
export const HANDS_SINK_MS = 300;
export const HANDS_CREEP_MS = 1300;
// A mourner wails every WAIL_MS or so within WAIL_RANGE and in view,
// lifting her veil for WAIL_WIND_MS first; within WAIL_REACH of her you run
// at SLOW_SHARE of your speed for SLOW_MS.
export const WAIL_MS = 3400;
export const WAIL_WIND_MS = 550;
export const WAIL_RANGE = 44;
export const WAIL_REACH = 22;
export const SLOW_MS = 1800;
export const SLOW_SHARE = 0.5;
// A grave robber within ROBBER_DIG of you, on your floor, digs in for
// DIG_MS, goes under at ROBBER_UNDER_V to ROBBER_BEHIND behind you (the way
// you are not facing), takes ROBBER_UP_MS to climb out, and walks at you for
// ROBBER_REST_MS before it digs again.
export const ROBBER_DIG = 18;
export const DIG_MS = 450;
export const ROBBER_UNDER_V = 34;
export const ROBBER_BEHIND = 7;
export const ROBBER_UP_MS = 380;
export const ROBBER_REST_MS = 2600;
// A crow wakes within CROW_NEAR, dives at your chest at CROW_DIVE_V, goes on
// CROW_PAST beyond you, then climbs for CROW_CLIMB_MS before it dives again.
export const CROW_NEAR = 34;
export const CROW_DIVE_V = 40;
export const CROW_PAST = 8;
export const CROW_CLIMB_MS = 750;

// Mother Mourning: she weeps ANGEL_WEEP_MS (flinging a headstone every
// ANGEL_THROW_MS), turns over ANGEL_TURN_MS, then watches ANGEL_WATCH_MS.
// Moving while she watches drops a stone fist where you are after
// FIST_WARN_MS (no more than one every FIST_GAP_MS), down for FIST_LIVE_MS,
// FIST_W wide and FIST_H high. Turning back to watch she blinks up to
// BLINK_STEP toward you (never within BLINK_KEEP of you, nor out of the arena).
// At ANGEL_RAGE of her hp she spreads her wings: the weep shortened by
// ANGEL_RAGE_STEP and two headstones thrown each time, and while she watches a
// fist also falls within RAIN_NEAR of you every RAIN_MS, moving or not.
export const BOSSES = freeze({
  angel: freeze({ name: "Mother Mourning", sub: "Move while she weeps. Freeze when she looks. She creeps closer", w: 10, h: 20, hp: 85, points: 3000, color: "#b9c2c9" }),
});
export const ANGEL_WEEP_MS = 2800;
export const ANGEL_THROW_MS = 1100;
export const ANGEL_TURN_MS = 650;
export const ANGEL_WATCH_MS = 1500;
export const ANGEL_RAGE = 0.5;
export const ANGEL_RAGE_STEP = 500;
export const FIST_WARN_MS = 420;
export const FIST_GAP_MS = 550;
export const FIST_LIVE_MS = 260;
export const FIST_W = 6;
export const FIST_H = 9;
export const BLINK_STEP = 5;
export const BLINK_KEEP = 14;
export const RAIN_MS = 900;
export const RAIN_NEAR = 9;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const inView = (round, m, k) => m.x > round.camX - 2 && m.x < round.camX + k.FIELD_W + 2;

// Whether the floor runs level from `x` to `to` (no pit, no step), for what
// moves under the ground.
function levelTo(round, k, x, to, y) {
  const step = to > x ? 0.5 : -0.5;
  for (let at = x; step > 0 ? at <= to : at >= to; at += step) if (k.groundAt(round.spec, at) !== y) return false;
  return true;
}

// Under the ground toward `to` at `speed`, as far as the floor runs level
// (the Grounds' rootlings use it too).
export function burrow(round, m, k, to, speed, dt) {
  const dir = Math.sign(to - m.x);
  if (!dir) return true;
  const nx = m.x + dir * Math.min(Math.abs(to - m.x), speed * dt);
  if (k.groundAt(round.spec, nx + dir * 0.8) !== m.y) return true;
  m.x = nx;
  m.dir = dir;
  return Math.abs(to - m.x) < 0.3;
}

function moveHands(round, m, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  m.wait = Math.max(0, m.wait - ms);
  const near = Math.abs(you.x - m.x) < HANDS_NEAR && Math.abs(you.y - m.y) < HANDS_HIGH;
  if (m.act === "lurk") {
    if (!near) return;
    m.act = "rise";
    m.wait = HANDS_RISE_MS;
    round.events.push({ type: "grab", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  if (m.act === "rise" && !m.wait) {
    m.act = "grab";
    m.wait = HANDS_UP_MS;
  } else if (m.act === "grab" && !m.wait) {
    m.act = "sink";
    m.wait = HANDS_SINK_MS;
  } else if (m.act === "sink" && !m.wait) {
    m.act = "creep";
    m.wait = HANDS_CREEP_MS;
  } else if (m.act === "creep") {
    const there = burrow(round, m, k, you.x, MONSTERS.hands.speed * round.spec.pace, dt);
    if ((there || !m.wait) && near) {
      m.act = "rise";
      m.wait = HANDS_RISE_MS;
      round.events.push({ type: "grab", kind: m.kind, x: m.x, y: m.y });
    } else if (!m.wait && !near) m.wait = HANDS_CREEP_MS;
  }
}

function moveMourner(round, m, ms, k) {
  const you = round.you;
  const dx = you.x - m.x;
  const toward = k.towardYou(round, m);
  if (m.windup > 0) {
    m.windup = Math.max(0, m.windup - ms);
    if (m.windup) return;
    const close = Math.hypot(dx, you.y - m.y) < WAIL_REACH;
    round.events.push({ type: "wail", kind: m.kind, x: m.x, y: m.y + m.h * 0.8, close });
    if (close) {
      you.slowMs = SLOW_MS;
      round.events.push({ type: "slowed", x: you.x, y: you.y });
    }
    return;
  }
  if (Math.abs(dx) > 4) k.walk(round, m, toward, MONSTERS.mourner.speed * round.spec.pace, ms / 1000);
  m.dir = toward;
  if (!inView(round, m, k) || Math.abs(dx) > WAIL_RANGE) return;
  m.throwIn -= ms * round.spec.pace;
  if (m.throwIn > 0) return;
  m.throwIn = WAIL_MS * (0.85 + ((m.id * 37) % 30) / 100);
  m.windup = WAIL_WIND_MS;
  round.events.push({ type: "wailWind", kind: m.kind, x: m.x, y: m.y });
}

function moveRobber(round, m, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  const dx = you.x - m.x;
  const toward = k.towardYou(round, m);
  m.wait = Math.max(0, m.wait - ms);
  if (m.act === "dig") {
    if (!m.wait) m.act = "under";
    return;
  }
  if (m.act === "under") {
    const want = clamp(you.x - (you.face || 1) * ROBBER_BEHIND, 2, round.spec.length - 2);
    if (burrow(round, m, k, want, ROBBER_UNDER_V * round.spec.pace, dt)) {
      m.act = "up";
      m.wait = ROBBER_UP_MS;
      m.dir = Math.sign(you.x - m.x) || m.dir;
      round.events.push({ type: "unearth", kind: m.kind, x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "up") {
    if (!m.wait) {
      m.act = "walk";
      m.wait = ROBBER_REST_MS;
    }
    return;
  }
  k.walk(round, m, toward, MONSTERS.robber.speed * round.spec.pace, dt);
  if (m.wait || Math.abs(dx) > ROBBER_DIG || Math.abs(you.y - m.y) > 0.5 || you.state !== "run" || !inView(round, m, k)) return;
  if (!levelTo(round, k, m.x, clamp(you.x - (you.face || 1) * ROBBER_BEHIND, 2, round.spec.length - 2), m.y)) return;
  m.act = "dig";
  m.wait = DIG_MS;
  round.events.push({ type: "dig", kind: m.kind, x: m.x, y: m.y });
}

function moveLegs(round, m, ms, k) {
  const toward = k.towardYou(round, m);
  k.walk(round, m, toward, MONSTERS.legs.speed * round.spec.pace, ms / 1000);
}

function moveCrow(round, m, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  const dx = you.x - m.x;
  if (m.act === "perch") {
    if (Math.abs(dx) > CROW_NEAR) return;
    round.events.push({ type: "caw", kind: m.kind, x: m.x, y: m.y });
    m.act = "climb";
    m.wait = 0;
  }
  const speed = CROW_DIVE_V * round.spec.pace;
  if (m.act === "climb") {
    m.wait = Math.max(0, m.wait - ms);
    m.vy = Math.min(m.vy + 60 * dt, 22);
    if (!m.wait) {
      // Aim at your chest from here, straight there.
      const ty = you.y + k.SHOT_Y;
      const d = Math.hypot(dx, ty - m.y) || 1;
      m.vx = (dx / d) * speed;
      m.vy = ((ty - m.y) / d) * speed;
      m.dive = Math.sign(dx) || m.dir;
      m.act = "dive";
      round.events.push({ type: "dive", kind: m.kind, x: m.x, y: m.y });
    }
  } else if (m.act === "dive" && ((m.x - you.x) * m.dive > CROW_PAST || m.y < k.groundAt(round.spec, m.x) + 1.2)) {
    m.act = "climb";
    m.wait = CROW_CLIMB_MS;
    m.vy = 18;
  }
  m.x += m.vx * dt;
  m.y = clamp(m.y + m.vy * dt, k.groundAt(round.spec, m.x) + 0.8, k.CHANDELIER_Y);
  m.dir = Math.sign(m.vx) || m.dir;
}

// A rotter shot down at the body leaves its legs, which walk on after you.
function rotterDies(round, m, how, k) {
  if (how !== "shot" && how !== "spread") return;
  const legs = k.spawnMonster(round, "legs", m.x, m.y, { dir: m.dir, force: true, horde: m.horde });
  if (legs) round.events.push({ type: "legs", x: m.x, y: m.y });
}

/* ---------------------------------------------------------- the angel */

const rage = (b) => b.hp <= b.max * ANGEL_RAGE;
const weepMs = (b) => ANGEL_WEEP_MS - (rage(b) ? ANGEL_RAGE_STEP : 0);

function weep(round, b, k) {
  b.act = "weep";
  b.wait = weepMs(b) / round.spec.pace;
  b.throwIn = ANGEL_THROW_MS * 0.6;
  round.events.push({ type: "angelWeep", kind: b.kind, x: b.x, y: b.y });
  if (!rage(b)) return;
  const floor = k.groundAt(round.spec, b.x);
  for (const d of [-1, 1]) round.waves.push({ x: b.x + d * (b.w / 2), y: floor, dir: d, life: 6000, kind: "angel" });
  round.events.push({ type: "slam", kind: b.kind, x: b.x, y: b.y, big: true });
}

// She blinks up to BLINK_STEP toward you while you are not looking, as far as
// the arena and BLINK_KEEP from you allow, with stone dust at each end.
function blink(round, b, k) {
  const you = round.you;
  const lo = round.spec.arena + 6 + b.w / 2;
  const hi = round.spec.length - 6 - b.w / 2;
  const dir = Math.sign(you.x - b.x) || b.dir;
  const nearest = you.x - dir * BLINK_KEEP;
  let to = b.x + dir * BLINK_STEP;
  if (dir * (to - nearest) > 0) to = dir * (b.x - nearest) > 0 ? b.x : nearest;
  to = clamp(to, lo, hi);
  if (Math.abs(to - b.x) < 0.5 || k.groundAt(round.spec, to) !== b.y) return;
  round.events.push({ type: "angelBlink", kind: b.kind, x: b.x, y: b.y + b.h * 0.4, tx: to });
  b.x = to;
}

function moveAngel(round, b, ms, random, k) {
  const you = round.you;
  b.dir = Math.sign(you.x - b.x) || b.dir;
  if (!b.act) weep(round, b, k);
  if (rage(b) && !b.raged) {
    b.raged = true;
    round.events.push({ type: "angelWings", kind: b.kind, x: b.x, y: b.y + b.h / 2 });
  }
  b.wait -= ms;
  b.fistIn = Math.max(0, (b.fistIn || 0) - ms);
  if (b.act === "weep") {
    b.throwIn -= ms * round.spec.pace;
    if (b.throwIn <= 0) {
      b.throwIn = ANGEL_THROW_MS * (0.8 + random() * 0.4);
      k.throwBone(round, b.x + b.dir * b.w * 0.35, b.y + b.h * 0.6, 0.9 + random() * 0.25, "stone", b.kind);
      // In a rage, a second headstone, thrown shorter.
      if (rage(b)) k.throwBone(round, b.x + b.dir * b.w * 0.35, b.y + b.h * 0.6, 0.5 + random() * 0.25, "stone", b.kind);
    }
    if (b.wait <= 0) {
      b.act = "turn";
      b.wait = ANGEL_TURN_MS;
      round.events.push({ type: "angelTurn", kind: b.kind, x: b.x, y: b.y + b.h * 0.8 });
    }
    return;
  }
  if (b.act === "turn") {
    if (b.wait <= 0) {
      b.act = "watch";
      b.wait = ANGEL_WATCH_MS;
      b.rainIn = RAIN_MS;
      blink(round, b, k);
      round.events.push({ type: "angelWatch", kind: b.kind, x: b.x, y: b.y + b.h * 0.8 });
    }
    return;
  }
  // Watching: anything but standing still brings a fist down on you, and in
  // a rage one falls near you now and then even if you stand still.
  if (b.wait <= 0) return weep(round, b, k);
  if (rage(b) && !(you.out > 0)) {
    b.rainIn -= ms;
    if (b.rainIn <= 0) {
      b.rainIn = RAIN_MS;
      const x = clamp(you.x + (random() * 2 - 1) * RAIN_NEAR, round.spec.arena + 2, round.spec.length - 2);
      round.hazards.push({ kind: "fist", x, y: k.groundAt(round.spec, x), w: FIST_W, h: FIST_H, warn: FIST_WARN_MS, live: 0, cause: "fist" });
    }
  }
  const moved = you.state !== "run" || you.runMs > 0;
  if (!moved || b.fistIn > 0 || you.out > 0) return;
  b.fistIn = FIST_GAP_MS;
  const x = clamp(you.x, round.spec.arena + 2, round.spec.length - 2);
  round.hazards.push({ kind: "fist", x, y: k.groundAt(round.spec, x), w: FIST_W, h: FIST_H, warn: FIST_WARN_MS, live: 0, cause: "fist" });
  round.events.push({ type: "angelSee", kind: b.kind, x, y: you.y });
}

// A stone fist: its shadow for `warn`, then down for FIST_LIVE_MS, crushing
// whatever is under it, then lifting away as long again. Returns whether it
// is still on the field.
function stepFist(round, h, ms, k) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = FIST_LIVE_MS;
    round.events.push({ type: "fist", x: h.x, y: h.y });
    for (const m of round.monsters) if (!m.dead && Math.abs(m.x - h.x) < (h.w + m.w) / 2 && m.y < h.y + h.h) k.hurt(round, m, 99, "crush");
    return true;
  }
  h.live -= ms;
  return h.live > -FIST_LIVE_MS;
}

export const GRAVEYARD = freeze({
  id: "graveyard",
  monsters: MONSTERS,
  walkers: freeze(["mourner", "robber", "legs"]),
  zombies: freeze(["rotter"]),
  stackers: freeze(["rotter", "legs"]),
  climbers: freeze(["rotter"]),
  act: freeze({ hands: "lurk", robber: "walk", crow: "perch" }),
  swoops: freeze({ crow: (m) => m.act === "dive" || m.act === "climb" }),
  // Hands under the dirt (or coming up, or going down) and a robber under
  // the ground or climbing out can neither hurt nor be hit.
  solid: freeze({
    hands: (m) => m.act === "grab",
    robber: (m) => m.act === "walk",
  }),
  move: freeze({ hands: moveHands, mourner: moveMourner, robber: moveRobber, legs: moveLegs, crow: moveCrow }),
  kill: freeze({ rotter: rotterDies }),
  horde: freeze({ crow: freeze({ act: "climb", wait: 400 }) }),
  bosses: BOSSES,
  boss: freeze({ angel: moveAngel }),
  // Stone while she weeps (and turns): shots and stomps glance off.
  guard: freeze({ angel: (b) => b.act !== "watch" }),
  hazards: freeze({ fist: stepFist }),
});
