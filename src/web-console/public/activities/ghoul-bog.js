// Plan2Code Web Console - Ghoul Rush's Gallows Bog stage, its rules: the monsters that haunt it (a lurker's eyes in the water, a drifting leech swarm, a will-o'-wisp whose light lures the rest toward you, and a bog body risen from the muck) and its boss, Old Mother Bog, as a stage pack that ghoul.js plugs in.
//
// No imports: ghoul.js hands every rule here a kit `k` of its own helpers
// (walk, throwBone, spawnMonster, groundAt, struck, hurt and the numbers they
// need), so this file never reaches back into it. A pack is plain data and
// functions:
//
// - `monsters`: each kind's numbers, as in ghoul.js's MONSTERS (`perch`: its
//   spawn names the height it waits at; `flies`: a horde one comes in high).
// - `walkers`, `zombies`: kinds that join ghoul.js's sets of the same names
//   (a bog body is a zombie in every way but how it rises).
// - `act`: what a kind starts out doing; `solid`: whether one can hurt and be
//   hit just now; `swoops`: whether a kind is diving low enough to duck
//   under; `unseen`: kinds out of sight just now, so shots go through and a
//   touch does nothing; `harmless`: kinds that never hurt by touch (the leech
//   latches instead); `move`: one slice of a kind's moving; `kill`: what a
//   death leaves; `horde`: what a kind comes in from the edge with.
// - `tick`: the stage's own twist, run each slice (the wisp's lure).
// - `shot`: what a bolt that hit a monster does besides its damage (a bright
//   wisp is shot out, never hit); `target`: what else a bolt can strike (a
//   harpoon finds a lurker's eyes under the water).
// - `bosses`, `boss` (one slice of a boss's fight), `guard` (true while
//   shots and stomps glance off), `weak` (the damage multiplier of a shot
//   that has just hit), `cause` (what its touch is called) and `hazards` (by
//   kind, one slice of something it left on the field).
//
// A lurker is two eyes at the waterline until you cross it: then it snaps
// out of the water, solid and lunging, and sinks back. A leech swarm drifts
// through the wet spans toward you and latches on contact, one heart and it
// drops off. A wisp is a drifting light: near it the dead pull toward you a
// step quicker (the lure), until a bolt puts it out and it rekindles
// somewhere else. A bog body rises out of the mud and walks.
//
// Old Mother Bog drifts along her planks keeping her distance, winds up and
// sends a low wave of mud down the boards to jump, or spits from her
// cauldron to where you stand, leaving a muck patch that burns. The
// cauldron opens late in her rests: a shot into her then counts triple. At
// half her hp she goes under, bubbles show where she comes back up, and she
// fights on with shorter waits and a second patch aimed ahead of your feet.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  lurker: freeze({ name: "Lurker", w: 3.4, h: 2.6, hp: 3, speed: 16, points: 150, stomp: true, head: false, color: "#2a3a18" }),
  leech: freeze({ name: "Leech Swarm", w: 3, h: 1.8, hp: 2, speed: 9, points: 90, stomp: true, head: false, color: "#3d2a24" }),
  wisp: freeze({ name: "Will-o'-Wisp", w: 1.6, h: 1.6, hp: 1, speed: 12, points: 70, stomp: false, head: false, perch: true, flies: true, color: "#9adfc0" }),
  bogbody: freeze({ name: "Bog Body", w: 3, h: 5, hp: 4, speed: 7, lurch: 14, points: 120, stomp: true, head: true, color: "#4a3a22" }),
});

export const BOSSES = freeze({
  motherbog: freeze({ name: "Old Mother Bog", sub: "Keep to the planks, she owns the water", w: 7, h: 10, hp: 95, points: 3000, color: "#5a4a2a" }),
});

// A lurker's eyes snap when you are within SNAP_RANGE across (and SNAP_HIGH
// up or down): it lunges at SNAP_V for SNAP_MS, then sinks for LURKER_SINK_MS
// back to eyes.
export const SNAP_RANGE = 9;
export const SNAP_HIGH = 5;
export const SNAP_V = 34;
export const SNAP_MS = 900;
export const LURKER_SINK_MS = 500;
// A latched leech swarm costs one heart, then it drops off for
// LEECH_DROP_MS and cannot latch again for LEECH_AGAIN_MS.
export const LEECH_DROP_MS = 350;
export const LEECH_AGAIN_MS = 1400;
// A bog body takes BOG_RISE_MS to climb out of the mud (one out of the
// horde's edge, or out of a door, is already up), then lurches like a zombie
// inside LURCH_RANGE.
export const BOG_RISE_MS = 600;
const LURCH_RANGE = 20;
// A wisp put out stays dim for WISP_RELIGHT_MS, then glows at its seeded
// spot for WISP_REKINDLE_MS before it burns bright again. While it is
// bright, every monster within WISP_LURE of it is pulled toward you and
// runs at WISP_HASTE times its speed.
export const WISP_RELIGHT_MS = 6000;
export const WISP_REKINDLE_MS = 600;
export const WISP_LURE = 10;
export const WISP_HASTE = 1.2;
const LURE_HOLD_MS = 120;
// Old Mother Bog keeps MOTHER_KEEP of plank between you, drifting at
// MOTHER_WALK. Between moves she idles MOTHER_IDLE_MS; the mud wave winds up
// MOTHER_WIND_MS and rests MOTHER_REST_MS after, its cauldron open for the
// last MOTHER_OPEN_MS; the spit winds up SPIT_WIND_MS and lands MUCK_LAND_MS
// later, a patch MUCK_W wide and MUCK_H high burning for MUCK_MS. At
// MOTHER_RAGE of her hp she sinks for MOTHER_SINK_MS, bubbles for
// BUBBLE_MS where she will surface, and rises over RESURFACE_MS near you
// (RESURFACE_NEAR or further); after it her waits are MOTHER_QUICK times as
// long and the spit also lands a patch MUCK_LEAD ahead of where you run.
export const MOTHER_KEEP = 14;
export const MOTHER_WALK = 6;
export const MOTHER_IDLE_MS = 1400;
export const MOTHER_WIND_MS = 600;
export const MOTHER_REST_MS = 1500;
export const MOTHER_OPEN_MS = 540;
export const SPIT_WIND_MS = 550;
export const MUCK_LAND_MS = 750;
export const MUCK_MS = 3000;
export const MUCK_W = 5;
export const MUCK_H = 3;
export const MUCK_LEAD = 11;
export const MOTHER_RAGE = 0.5;
export const MOTHER_QUICK = 0.7;
export const MOTHER_SINK_MS = 600;
export const BUBBLE_MS = 700;
export const RESURFACE_MS = 450;
const RESURFACE_NEAR = 14;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------ monsters */

// Two eyes at the waterline: unseen till you cross it, then a snap out of
// the water, solid and lunging, and a sink back to eyes.
function moveLurker(round, m, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  if (m.act === "snap") {
    m.wait = Math.max(0, m.wait - ms);
    k.walk(round, m, k.towardYou(round, m), SNAP_V * round.spec.pace, dt);
    if (m.wait) return;
    m.act = "sink";
    m.wait = LURKER_SINK_MS;
    round.events.push({ type: "lurkerSink", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  if (m.act === "sink") {
    m.wait = Math.max(0, m.wait - ms);
    if (m.wait) return;
    m.act = "eyes";
    return;
  }
  m.dir = k.towardYou(round, m);
  if (Math.abs(you.x - m.x) < SNAP_RANGE && Math.abs(you.y - m.y) < SNAP_HIGH && you.out <= 0) {
    m.act = "snap";
    m.wait = SNAP_MS;
    round.events.push({ type: "lurkerSnap", kind: m.kind, x: m.x, y: m.y + 1, dir: m.dir });
  }
}

// Drifting along its floor toward you; contact is a latch (one heart, cause
// `leeches`, then it drops off and drifts again once it can).
function moveLeech(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  m.latchIn = Math.max(0, (m.latchIn || 0) - ms);
  if (m.act === "drop") {
    m.wait = Math.max(0, m.wait - ms);
    if (m.wait) return;
    m.act = "drift";
    return;
  }
  const hitH = you.ducking ? k.DUCK_H : k.HIT_H;
  const touch = Math.abs(you.x - m.x) < (k.HIT_W + m.w * 0.8) / 2 && you.y < m.y + m.h * 0.9 && you.y + hitH > m.y + m.h * 0.1;
  if (touch && !(m.latchIn > 0) && you.out <= 0) {
    m.act = "drop";
    m.wait = LEECH_DROP_MS;
    m.latchIn = LEECH_AGAIN_MS;
    round.events.push({ type: "leechLatch", kind: m.kind, x: m.x, y: m.y });
    k.struck(round, "leeches");
    return;
  }
  const dir = k.towardYou(round, m);
  k.walk(round, m, dir, MONSTERS.leech.speed * spec.pace, dt);
  m.dir = dir;
}

// A mud-caked riser: it climbs out of the muck (harmless till up, the
// zombie rule), then shambles and lurches like one. A horde one, or one out
// of a door, is already up.
function moveBogbody(round, m, ms, k) {
  const you = round.you;
  if (m.act === "rise") {
    if (m.horde) {
      m.act = "walk";
    } else {
      if (!(m.rise > 0)) {
        m.rise = BOG_RISE_MS;
        round.events.push({ type: "bogRise", kind: m.kind, x: m.x, y: m.y });
      }
      m.rise = Math.max(0, m.rise - ms);
      if (!m.rise) m.act = "walk";
      return;
    }
  }
  const near = Math.abs(you.x - m.x) < LURCH_RANGE && Math.abs(you.y - m.y) < 6;
  k.walk(round, m, k.towardYou(round, m), (near ? MONSTERS.bogbody.lurch : MONSTERS.bogbody.speed) * round.spec.pace, ms / 1000);
  m.lurching = near;
}

// A drifting light: while bright it wanders toward your chest (its dips are
// duckable), while dim it sinks and waits out its relight, and while
// rekindling it glows where it will burn again.
function moveWisp(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  if (m.act === "dim") {
    m.wait = Math.max(0, m.wait - ms);
    const floor = k.groundAt(spec, m.x);
    if (Number.isFinite(floor)) m.y = Math.max(floor + 0.6, m.y - 18 * dt);
    if (m.wait) return;
    if (m.relight) {
      m.x = m.relight.x;
      m.y = m.relight.y;
    }
    m.act = "rekindle";
    m.wait = WISP_REKINDLE_MS;
    round.events.push({ type: "wispRelight", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  if (m.act === "rekindle") {
    m.wait = Math.max(0, m.wait - ms);
    if (m.wait) return;
    m.act = "bright";
    round.events.push({ type: "wispOn", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  const speed = MONSTERS.wisp.speed * spec.pace;
  const ty = you.y + k.SHOT_Y - m.h / 2;
  const dx = you.x - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy) || 1;
  m.x += (dx / d) * speed * dt;
  m.y += (dy / d) * speed * dt;
  m.y += Math.sin(m.t / 190 + m.id) * 4 * dt;
  m.dir = Math.sign(dx) || m.dir;
  m.y = Math.max(k.groundAt(spec, m.x) + 0.6, Math.min(k.CHANDELIER_Y, m.y));
}

// A bolt puts a bright wisp out (never hurt: it is light), starting its
// rekindle clock and seeding the spot it will burn again from its id.
function wispShot(round, m, s, k) {
  if (m.kind !== "wisp" || m.act !== "bright") return 1;
  m.act = "dim";
  m.wait = WISP_RELIGHT_MS;
  m.vx = 0;
  m.vy = 0;
  const spec = round.spec;
  const rx = clamp(m.x + (((m.id * 37) % 23) - 11), 4, spec.length - 4);
  m.relight = { x: rx, y: Math.min(k.CHANDELIER_Y, Math.max(k.groundAt(spec, rx) + 7, 10)) };
  round.events.push({ type: "wispOut", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  return 0;
}

// A dispersed swarm is told so (its voice lands with the art).
function leechDies(round, m) {
  round.events.push({ type: "leechDie", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

/* --------------------------------------------------------- the wisp lure */

// The stage's twist, run each slice: the dead inside a bright wisp's light
// are pulled toward you and run quicker, till the wisp dims or they drift
// out of it. In another stage's room it never touches `lure` or `hasteMs`:
// those fields are another pack's there (the grounds' moth call).
function bogTick(round, ms) {
  if (round.stage !== "bog") return;
  const wisps = [];
  for (const w of round.monsters) if (!w.dead && w.kind === "wisp" && w.act === "bright") wisps.push(w);
  for (const m of round.monsters) {
    if (m.dead || m.kind === "wisp") continue;
    let near = false;
    for (const w of wisps) {
      if (Math.hypot(m.x - w.x, m.y - w.y) <= WISP_LURE) {
        near = true;
        break;
      }
    }
    if (near) {
      if (!(m.lure > 0)) round.events.push({ type: "wispLure", kind: m.kind, x: m.x, y: m.y + m.h });
      m.lure = LURE_HOLD_MS;
      m.hasteMs = LURE_HOLD_MS;
      m.haste = WISP_HASTE;
    } else if (m.lure > 0) {
      m.lure = 0;
      m.hasteMs = 0;
      m.haste = 1;
    }
  }
}

/* ------------------------------------------------------------ the hag */

const motherWait = (round, b, v) => (v * (b.raged ? MOTHER_QUICK : 1)) / round.spec.pace;

// The plank nearest `x` within reach, as { x, y }, or null over open water.
function plankAt(spec, x, k) {
  for (const d of [0, 2, -2, 4, -4, 6, -6]) {
    const g = k.groundAt(spec, x + d);
    if (Number.isFinite(g)) return { x: x + d, y: g };
  }
  return null;
}

function moveMother(round, b, ms, random, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  const wait = (v) => motherWait(round, b, v);
  if (!b.act) {
    b.act = "idle";
    b.wait = wait(MOTHER_IDLE_MS);
  }
  b.wait -= ms;
  if (b.act !== "sink" && b.act !== "under" && b.act !== "resurface") b.dir = Math.sign(you.x - b.x) || b.dir;
  // At half her hp she goes under once, and comes back up meaner.
  if (!b.sank && b.hp <= b.max * MOTHER_RAGE) {
    b.sank = true;
    b.raged = true;
    b.home = b.y;
    b.act = "sink";
    b.wait = MOTHER_SINK_MS;
    b.hidden = true;
    // Down at once: a box she slides through you with while nothing can hurt
    // her is a hit you could not answer.
    b.y = b.home - (b.h + 4);
    round.events.push({ type: "motherSink", kind: b.kind, x: b.x, y: b.home });
    return;
  }
  // The cauldron opens late in a rest: a shot then counts triple (see `weak`).
  const open = b.act === "rest" && b.wait <= MOTHER_OPEN_MS;
  if (open && !b.lit) round.events.push({ type: "cauldronOpen", kind: b.kind, x: b.x + b.dir * b.w * 0.3, y: b.y + b.h * 0.35 });
  b.lit = open;
  if (b.act === "idle") {
    // She drifts to keep about MOTHER_KEEP of plank between her and you,
    // never stepping off the boards onto open water.
    const side = Math.sign(b.x - you.x) || 1;
    const goal = clamp(you.x + side * MOTHER_KEEP, k.arenaMin(round, b), k.arenaMax(round, b));
    if (Math.abs(goal - b.x) > 1 && k.groundAt(spec, goal) === b.y) {
      const nx = b.x + Math.sign(goal - b.x) * MOTHER_WALK * spec.pace * dt;
      if (k.groundAt(spec, nx) === b.y) b.x = nx;
    }
    if (b.wait > 0) return;
    // The mud wave and the cauldron in turn.
    b.attacks++;
    if (b.attacks % 2) {
      b.act = "wind";
      b.wait = wait(MOTHER_WIND_MS);
      round.events.push({ type: "motherWind", kind: b.kind, x: b.x, y: b.y + b.h * 0.6, dir: b.dir });
    } else {
      b.act = "throwWind";
      b.wait = wait(SPIT_WIND_MS);
      round.events.push({ type: "spitWind", kind: b.kind, x: b.x + b.dir * b.w * 0.3, y: b.y + b.h * 0.55, dir: b.dir });
    }
    return;
  }
  if (b.act === "wind") {
    if (b.wait > 0) return;
    const floor = k.groundAt(spec, b.x);
    round.waves.push({ x: b.x + b.dir * (b.w / 2), y: floor, dir: b.dir, life: 6000, kind: "mudwave", cause: "mudwave" });
    round.events.push({ type: "mudWave", kind: b.kind, x: b.x + b.dir * (b.w / 2), y: floor, dir: b.dir });
    b.act = "rest";
    b.wait = wait(MOTHER_REST_MS);
    return;
  }
  if (b.act === "throwWind") {
    if (b.wait > 0) return;
    const sx = b.x + b.dir * b.w * 0.35;
    const sy = b.y + b.h * 0.55;
    const at = { type: "cauldronSpit", kind: b.kind, x: sx, y: sy };
    const x = clamp(you.x, spec.arena + 2, spec.length - 2);
    const spot = plankAt(spec, x, k);
    if (spot) {
      round.hazards.push({ kind: "muck", x: spot.x, y: spot.y, w: MUCK_W, h: MUCK_H, warn: MUCK_LAND_MS, live: 0, cause: "muck", sx, sy });
      Object.assign(at, { tx: spot.x, ty: spot.y });
    }
    // Meaner: a second patch lands ahead of where you run.
    if (b.raged) {
      let ahead = (Math.sign(you.vx) || you.face || 1) * MUCK_LEAD;
      let x2 = clamp(x + ahead, spec.arena + 2, spec.length - 2);
      if (Math.abs(x2 - x) < MUCK_W) x2 = clamp(x - ahead, spec.arena + 2, spec.length - 2);
      const spot2 = plankAt(spec, x2, k);
      if (spot2 && (!spot || spot2.x !== spot.x)) {
        round.hazards.push({ kind: "muck", x: spot2.x, y: spot2.y, w: MUCK_W, h: MUCK_H, warn: MUCK_LAND_MS, live: 0, cause: "muck", sx, sy });
        Object.assign(at, { tx2: spot2.x, ty2: spot2.y });
      }
    }
    round.events.push(at);
    b.act = "idle";
    b.wait = wait(MOTHER_REST_MS);
    return;
  }
  if (b.act === "rest") {
    if (b.wait > 0) return;
    b.act = "idle";
    b.wait = wait(MOTHER_IDLE_MS);
    return;
  }
  if (b.act === "sink") {
    if (b.wait > 0) return;
    // Where she comes back up: on a plank near you, never on top of you.
    const lo = spec.arena + 4 + b.w / 2;
    const hi = spec.length - 4 - b.w / 2;
    let spot = null;
    for (const d of [RESURFACE_NEAR, -RESURFACE_NEAR, RESURFACE_NEAR * 1.7, -RESURFACE_NEAR * 1.7, RESURFACE_NEAR * 2.4, -RESURFACE_NEAR * 2.4]) {
      const x = clamp(you.x + d, lo, hi);
      if (Math.abs(x - you.x) >= 6 && k.groundAt(spec, x) === b.home) {
        spot = x;
        break;
      }
    }
    if (spot === null) for (const d of [0, 8, -8]) {
      const x = clamp(b.x + d, lo, hi);
      if (Math.abs(x - you.x) >= 6 && k.groundAt(spec, x) === b.home) {
        spot = x;
        break;
      }
    }
    b.sinkX = spot ?? clamp(b.x, lo, hi);
    b.act = "under";
    b.wait = BUBBLE_MS;
    round.events.push({ type: "motherBubble", kind: b.kind, x: b.sinkX, y: b.home });
    return;
  }
  if (b.act === "under") {
    if (b.wait > 0) return;
    // Up at once where the bubbles showed, touchable and hittable again.
    b.x = b.sinkX;
    b.y = b.home;
    b.hidden = false;
    b.act = "resurface";
    b.wait = RESURFACE_MS;
    round.events.push({ type: "motherRise", kind: b.kind, x: b.x, y: b.home });
    return;
  }
  if (b.act === "resurface") {
    if (b.wait > 0) return;
    b.act = "rest";
    b.wait = wait(MOTHER_REST_MS);
    return;
  }
}

// A muck patch: a glob in the air for `warn`, then burning for MUCK_MS
// where it came down. Returns whether it is still on the field.
function stepMuck(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = MUCK_MS;
    round.events.push({ type: "muckLand", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// A harpoon is the one bolt that reaches a lurker's eyes under the water:
// every other shot goes through them (they are `unseen`).
function harpoonShot(round, s, k) {
  if (s.arm !== "harpoon") return false;
  for (const m of round.monsters) {
    if (m.dead || m.kind !== "lurker" || !m.unseen || (s.hit || []).includes(m.id)) continue;
    if (Math.abs(s.x - m.x) > m.w / 2 + 0.5 || s.y < m.y - 0.5 || s.y > m.y + m.h + 0.5) continue;
    s.hit = [...(s.hit || []), m.id];
    k.hurt(round, m, s.dmg || 1, "harpoon");
    round.events.push({ type: "harpoonHit", kind: m.kind, x: s.x, y: s.y });
  }
  return false;
}

export const BOG = freeze({
  id: "bog",
  monsters: MONSTERS,
  walkers: freeze(["lurker", "leech"]),
  zombies: freeze(["bogbody"]),
  stackers: freeze(["bogbody"]),
  climbers: freeze(["bogbody"]),
  act: freeze({ lurker: "eyes", leech: "drift", wisp: "bright", bogbody: "rise" }),
  swoops: freeze({ wisp: (m) => m.act === "bright" }),
  // A lurker can hurt and be hit only while it is snapping; a dim or
  // rekindling wisp can do neither.
  solid: freeze({
    lurker: (m) => m.act === "snap",
    wisp: (m) => m.act === "bright",
  }),
  // A lurker's eyes are never solid: a stomp or a bolt passes over them.
  unseen: freeze({ lurker: (round, m) => m.act !== "snap" }),
  // The swarm never hurts by touch: it latches instead (see moveLeech).
  harmless: freeze({ leech: () => true }),
  move: freeze({ lurker: moveLurker, leech: moveLeech, wisp: moveWisp, bogbody: moveBogbody }),
  kill: freeze({ leech: leechDies }),
  horde: freeze({}),
  tick: freeze([bogTick]),
  shot: wispShot,
  target: harpoonShot,
  bosses: BOSSES,
  boss: freeze({ motherbog: moveMother }),
  // She is gone while she is under: shots and stomps meet only water.
  guard: freeze({ motherbog: (b) => Boolean(b.hidden) }),
  // A shot into the open cauldron counts triple.
  weak: freeze({ motherbog: (b) => (b.lit ? 3 : 1) }),
  cause: freeze({ motherbog: () => "motherbog" }),
  hazards: freeze({ muck: stepMuck }),
});
